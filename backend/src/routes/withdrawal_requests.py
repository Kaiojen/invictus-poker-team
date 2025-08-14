from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.models import (
    db, WithdrawalRequest, User, Platform, Account, Transaction, 
    UserRole, WithdrawalStatus, TransactionType
)
from src.routes.auth import login_required, admin_required
from src.utils.notification_service import get_notification_service

withdrawal_requests_bp = Blueprint('withdrawal_requests', __name__)

@withdrawal_requests_bp.route('/', methods=['GET'])
@login_required
def get_withdrawal_requests():
    """Listar solicitações de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        # Normaliza para minúsculas para casar com o Enum
        status = request.args.get('status')
        if status:
            status = status.lower()
        user_id = request.args.get('user_id', type=int)
        
        query = WithdrawalRequest.query
        
        # Filtrar por usuário se especificado
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            query = query.filter_by(user_id=user_id)
        else:
            # Jogadores veem apenas suas próprias solicitações
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                query = query.filter_by(user_id=current_user.id)
        
        # Filtrar por status se especificado
        if status:
            try:
                status_enum = WithdrawalStatus(status)
                query = query.filter_by(status=status_enum)
            except ValueError:
                return jsonify({'error': 'Invalid status'}), 400
        
        withdrawal_requests = query.order_by(WithdrawalRequest.created_at.desc()).all()
        return jsonify({'withdrawal_requests': [req.to_dict() for req in withdrawal_requests]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/', methods=['POST'])
@login_required
def create_withdrawal_request():
    """Criar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        data = request.get_json()
        
        required_fields = ['platform_id', 'amount']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Determinar o user_id
        user_id = data.get('user_id')
        if user_id:
            # Apenas admins/managers podem criar solicitações para outros usuários
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Access denied'}), 403
        else:
            user_id = current_user.id
        
        # Verificar se a plataforma existe
        platform = Platform.query.get(data['platform_id'])
        if not platform or not platform.is_active:
            return jsonify({'error': 'Platform not found or inactive'}), 404
        
        # Verificar se o usuário tem conta nesta plataforma
        account = Account.query.filter_by(
            user_id=user_id, 
            platform_id=data['platform_id'],
            is_active=True,
            has_account=True
        ).first()
        if not account:
            return jsonify({'error': 'User does not have an active account on this platform'}), 400
        
        # Validar valor
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than zero'}), 400
        
        # Verificar se há saldo suficiente
        if amount > float(account.current_balance):
            return jsonify({'error': 'Insufficient balance for withdrawal'}), 400
        
        withdrawal_request = WithdrawalRequest(
            user_id=user_id,
            platform_id=data['platform_id'],
            amount=amount,
            player_notes=data.get('player_notes', '')
        )
        
        db.session.add(withdrawal_request)
        db.session.commit()
        
        # Enviar notificações automáticas
        notification_service = get_notification_service()
        notification_service.notify_withdrawal_request(withdrawal_request, action="created")
        
        return jsonify({
            'message': 'Withdrawal request created successfully',
            'withdrawal_request': withdrawal_request.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>', methods=['GET'])
@login_required
def get_withdrawal_request(request_id):
    """Obter detalhes de uma solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != withdrawal_request.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({'withdrawal_request': withdrawal_request.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>/approve', methods=['POST'])
@admin_required
def approve_withdrawal_request(request_id):
    """Aprovar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        if withdrawal_request.status != WithdrawalStatus.PENDING:
            return jsonify({'error': 'Request is not pending'}), 400
        
        data = request.get_json() or {}
        manager_notes = data.get('manager_notes', '')
        
        # Verificar se ainda há saldo suficiente
        account = Account.query.filter_by(
            user_id=withdrawal_request.user_id,
            platform_id=withdrawal_request.platform_id
        ).first()
        
        if not account or float(account.current_balance) < float(withdrawal_request.amount):
            return jsonify({'error': 'Insufficient balance for withdrawal'}), 400
        
        # Atualizar a solicitação
        withdrawal_request.status = WithdrawalStatus.APPROVED
        withdrawal_request.manager_notes = manager_notes
        withdrawal_request.approved_by = current_user.id
        withdrawal_request.approved_at = datetime.utcnow()
        
        # Criar transação
        transaction = Transaction(
            user_id=withdrawal_request.user_id,
            platform_id=withdrawal_request.platform_id,
            transaction_type=TransactionType.WITHDRAWAL,
            amount=withdrawal_request.amount,
            description=f'Saque aprovado - Solicitação #{withdrawal_request.id}',
            created_by=current_user.id
        )
        
        # Atualizar saldo da conta (subtrair o valor)
        account.current_balance -= withdrawal_request.amount
        account.total_withdrawals += withdrawal_request.amount
        
        # Criar histórico de alteração
        from src.models.models import BalanceHistory
        history = BalanceHistory(
            account_id=account.id,
            old_balance=float(account.current_balance) + float(withdrawal_request.amount),
            new_balance=float(account.current_balance),
            change_reason='withdrawal_approved',
            notes=f'Saque aprovado: {manager_notes}',
            changed_by=current_user.id
        )
        
        db.session.add(transaction)
        db.session.add(history)
        db.session.commit()
        
        # Enviar notificações automáticas
        notification_service = get_notification_service()
        notification_service.notify_withdrawal_request(withdrawal_request, action="completed")
        
        return jsonify({
            'message': 'Withdrawal request approved successfully',
            'withdrawal_request': withdrawal_request.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>/reject', methods=['POST'])
@admin_required
def reject_withdrawal_request(request_id):
    """Rejeitar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        if withdrawal_request.status != WithdrawalStatus.PENDING:
            return jsonify({'error': 'Request is not pending'}), 400
        
        data = request.get_json() or {}
        manager_notes = data.get('manager_notes', '')
        
        if not manager_notes:
            return jsonify({'error': 'Manager notes are required for rejection'}), 400
        
        # Atualizar a solicitação
        withdrawal_request.status = WithdrawalStatus.REJECTED
        withdrawal_request.manager_notes = manager_notes
        withdrawal_request.approved_by = current_user.id
        withdrawal_request.approved_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Withdrawal request rejected successfully',
            'withdrawal_request': withdrawal_request.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>/complete', methods=['POST'])
@admin_required
def complete_withdrawal_request(request_id):
    """Marcar solicitação de saque como concluída"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        if withdrawal_request.status != WithdrawalStatus.APPROVED:
            return jsonify({'error': 'Request must be approved first'}), 400
        
        data = request.get_json() or {}
        
        # Atualizar a solicitação
        withdrawal_request.status = WithdrawalStatus.COMPLETED
        withdrawal_request.completed_at = datetime.utcnow()
        
        # Adicionar nota se fornecida
        if data.get('completion_notes'):
            if withdrawal_request.manager_notes:
                withdrawal_request.manager_notes += f"\n\nConclusão: {data['completion_notes']}"
            else:
                withdrawal_request.manager_notes = f"Concluído: {data['completion_notes']}"
        
        db.session.commit()
        
        return jsonify({
            'message': 'Withdrawal request marked as completed',
            'withdrawal_request': withdrawal_request.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>', methods=['PUT'])
@login_required
def update_withdrawal_request(request_id):
    """Atualizar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        # Apenas o próprio usuário ou admins/managers podem editar
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != withdrawal_request.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Apenas solicitações pendentes podem ser editadas
        if withdrawal_request.status != WithdrawalStatus.PENDING:
            return jsonify({'error': 'Only pending requests can be edited'}), 400
        
        data = request.get_json()
        
        # Jogadores podem editar apenas suas notas
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            if 'player_notes' in data:
                withdrawal_request.player_notes = data['player_notes']
        else:
            # Admins/managers podem editar mais campos
            if 'amount' in data:
                amount = float(data['amount'])
                if amount <= 0:
                    return jsonify({'error': 'Amount must be greater than zero'}), 400
                
                # Verificar saldo disponível
                account = Account.query.filter_by(
                    user_id=withdrawal_request.user_id,
                    platform_id=withdrawal_request.platform_id
                ).first()
                
                if account and amount > float(account.current_balance):
                    return jsonify({'error': 'Amount exceeds available balance'}), 400
                
                withdrawal_request.amount = amount
            
            if 'player_notes' in data:
                withdrawal_request.player_notes = data['player_notes']
            
            if 'manager_notes' in data:
                withdrawal_request.manager_notes = data['manager_notes']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Withdrawal request updated successfully',
            'withdrawal_request': withdrawal_request.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>', methods=['DELETE'])
@login_required
def delete_withdrawal_request(request_id):
    """Deletar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        # Apenas o próprio usuário ou admins podem deletar
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != withdrawal_request.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Apenas solicitações pendentes podem ser deletadas
        if withdrawal_request.status != WithdrawalStatus.PENDING:
            return jsonify({'error': 'Only pending requests can be deleted'}), 400
        
        db.session.delete(withdrawal_request)
        db.session.commit()
        
        return jsonify({'message': 'Withdrawal request deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
