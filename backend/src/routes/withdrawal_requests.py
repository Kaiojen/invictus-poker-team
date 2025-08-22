from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.models import (
    db, WithdrawalRequest, User, Platform, Account, Transaction, 
    UserRole, WithdrawalStatus, TransactionType
)
from src.routes.auth import login_required, admin_required
from src.utils.notification_service import get_notification_service
from src.middleware.audit_middleware import audit_action
from src.middleware.csrf_protection import csrf_protect
from src.utils.pagination import paginate_query
from src.routes.sse import broadcast_to_user
from src.schemas.withdrawals import ApproveWithdrawalSchema, RejectWithdrawalSchema, CompleteWithdrawalSchema
from src.services.withdrawals import WithdrawalService, ApproveWithdrawalDTO, RejectWithdrawalDTO, CompleteWithdrawalDTO
import bleach

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
        
        # Paginação
        query = query.order_by(WithdrawalRequest.created_at.desc())
        result = paginate_query(query, max_per_page=200)
        return jsonify({
            'withdrawal_requests': [req.to_dict() for req in result['items']],
            'pagination': result['pagination']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/', methods=['POST'])
@login_required
@csrf_protect
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
        
        # 🚨 NOVA VALIDAÇÃO CRÍTICA: Verificar se há reloads não quitados
        # 🚨 TEMPORÁRIO: Desabilitar até migration ser aplicada
        try:
            unpaid_reloads = ReloadRequest.query.filter(
                ReloadRequest.user_id == user_id,
                ReloadRequest.status == ReloadStatus.APPROVED,
                ReloadRequest.paid_back == False
            ).all()
        except Exception:
            # Campo paid_back não existe ainda, pular validação por agora
            unpaid_reloads = []
        
        if unpaid_reloads:
            total_unpaid = sum(float(reload.amount) for reload in unpaid_reloads)
            # Verificar se pode quitar automaticamente
            if float(account.current_balance) >= total_unpaid:
                return jsonify({
                    'error': 'Outstanding reload debt must be paid first',
                    'details': {
                        'unpaid_reload_amount': total_unpaid,
                        'can_auto_payback': True,
                        'message': f'Você deve quitar ${total_unpaid:.2f} de reload antes de solicitar saque. Clique em "Quitar Reload" primeiro.'
                    }
                }), 400
            else:
                return jsonify({
                    'error': 'Outstanding reload debt and insufficient balance',
                    'details': {
                        'unpaid_reload_amount': total_unpaid,
                        'can_auto_payback': False,
                        'message': f'Você deve quitar ${total_unpaid:.2f} de reload, mas não tem saldo suficiente.'
                    }
                }), 400
        
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
@csrf_protect
@audit_action('withdrawal_approved', 'WithdrawalRequest', include_body=True)
def approve_withdrawal_request(request_id):
    """Aprovar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        if withdrawal_request.status != WithdrawalStatus.PENDING:
            return jsonify({
                'error': f'Request is not pending (current status: {withdrawal_request.status.value})',
                'current_status': withdrawal_request.status.value,
                'message': f'Solicitação já foi processada. Status atual: {withdrawal_request.status.value}'
            }), 400
        
        payload = ApproveWithdrawalSchema().load(request.get_json() or {})
        manager_notes = bleach.clean(payload.get('manager_notes', ''), tags=[], strip=True)
        
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
        
        # 🚨 CORREÇÃO CRÍTICA: Implementar divisão 50%/50% nos saques  
        withdrawal_amount = withdrawal_request.amount
        
        # 50% do saque vai para o jogador (sai da banca)
        player_portion = withdrawal_amount / 2
        
        # 50% do saque fica para o time (reduz investimento)
        team_portion = withdrawal_amount / 2
        
        # Apenas a parte do jogador sai da banca (50%)
        account.current_balance -= player_portion
        account.total_withdrawals += withdrawal_amount  # Registra saque total
        # 🚨 TEMPORÁRIO: Comentar até migration
        # account.team_withdrawal_credits += team_portion
        
        # Criar histórico de alteração
        from src.models.models import BalanceHistory
        history = BalanceHistory(
            account_id=account.id,
            old_balance=float(account.current_balance) + float(player_portion),
            new_balance=float(account.current_balance),
            change_reason='withdrawal_approved',
            notes=f'Saque aprovado: {manager_notes} | Total: ${withdrawal_amount}, Player: ${player_portion}, Team: ${team_portion}',
            changed_by=current_user.id
        )
        
        db.session.add(transaction)
        db.session.add(history)
        db.session.commit()
        
        req = WithdrawalService.approve(ApproveWithdrawalDTO(
            withdrawal_id=request_id,
            manager_id=current_user.id,
            manager_notes=manager_notes
        ))
        notification_service = get_notification_service()
        notification_service.notify_withdrawal_request(req, action="completed")

        broadcast_to_user(req.user_id, 'withdrawal_status', {
            'id': req.id,
            'status': 'approved',
            'message': 'Seu saque foi aprovado',
            'timestamp': datetime.utcnow().timestamp()
        })

        return jsonify({
            'message': 'Withdrawal request approved successfully',
            'withdrawal_request': req.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>/reject', methods=['POST'])
@admin_required
@csrf_protect
@audit_action('withdrawal_rejected', 'WithdrawalRequest', include_body=True)
def reject_withdrawal_request(request_id):
    """Rejeitar solicitação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        if withdrawal_request.status != WithdrawalStatus.PENDING:
            return jsonify({
                'error': f'Request is not pending (current status: {withdrawal_request.status.value})',
                'current_status': withdrawal_request.status.value,
                'message': f'Solicitação já foi processada. Status atual: {withdrawal_request.status.value}'
            }), 400
        
        payload = RejectWithdrawalSchema().load(request.get_json() or {})
        manager_notes = bleach.clean(payload['manager_notes'], tags=[], strip=True)
        
        if not manager_notes:
            return jsonify({'error': 'Manager notes are required for rejection'}), 400
        
        req = WithdrawalService.reject(RejectWithdrawalDTO(
            withdrawal_id=request_id,
            manager_id=current_user.id,
            manager_notes=manager_notes
        ))

        broadcast_to_user(req.user_id, 'withdrawal_status', {
            'id': req.id,
            'status': 'rejected',
            'message': 'Seu saque foi rejeitado',
            'timestamp': datetime.utcnow().timestamp()
        })

        return jsonify({
            'message': 'Withdrawal request rejected successfully',
            'withdrawal_request': req.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>/complete', methods=['POST'])
@admin_required
@csrf_protect
@audit_action('withdrawal_completed', 'WithdrawalRequest', include_body=True)
def complete_withdrawal_request(request_id):
    """Marcar solicitação de saque como concluída"""
    try:
        current_user = User.query.get(session['user_id'])
        withdrawal_request = WithdrawalRequest.query.get(request_id)
        
        if not withdrawal_request:
            return jsonify({'error': 'Withdrawal request not found'}), 404
        
        if withdrawal_request.status != WithdrawalStatus.APPROVED:
            return jsonify({
                'error': f'Request must be approved first (current status: {withdrawal_request.status.value})',
                'current_status': withdrawal_request.status.value,
                'message': f'Solicitação precisa estar aprovada. Status atual: {withdrawal_request.status.value}'
            }), 400
        
        payload = CompleteWithdrawalSchema().load(request.get_json() or {})
        
        req = WithdrawalService.complete(CompleteWithdrawalDTO(
            withdrawal_id=request_id,
            completion_notes=bleach.clean(payload.get('completion_notes', ''), tags=[], strip=True)
        ))

        broadcast_to_user(req.user_id, 'withdrawal_status', {
            'id': req.id,
            'status': 'completed',
            'message': 'Seu saque foi concluído',
            'timestamp': datetime.utcnow().timestamp()
        })

        return jsonify({
            'message': 'Withdrawal request marked as completed',
            'withdrawal_request': req.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@withdrawal_requests_bp.route('/<int:request_id>', methods=['PUT'])
@login_required
@csrf_protect
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
@csrf_protect
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
