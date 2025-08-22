"""
🚨 NOVA ROTA: Sistema de quitação de reloads
Permite quitar reloads aprovados antes de solicitar saques
"""

from flask import Blueprint, request, jsonify, session
from datetime import datetime
from sqlalchemy import func
from src.models.models import (
    User, Account, ReloadRequest, ReloadStatus, UserRole, 
    BalanceHistory, db
)
from src.routes.auth import login_required
from src.middleware.csrf_protection import csrf_protect

reload_payback_bp = Blueprint('reload_payback', __name__)

@reload_payback_bp.route('/unpaid', methods=['GET'])
@login_required
def get_unpaid_reloads():
    """Obter reloads aprovados não quitados de um usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        user_id = request.args.get('user_id', current_user.id, type=int)
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar reloads aprovados não quitados
        unpaid_reloads = ReloadRequest.query.filter_by(
            user_id=user_id,
            status=ReloadStatus.APPROVED,
            paid_back=False
        ).all()
        
        total_unpaid = sum(float(reload.amount) for reload in unpaid_reloads)
        
        # Verificar saldo disponível para quitação
        total_balance = db.session.query(func.sum(Account.current_balance)).filter_by(
            user_id=user_id, 
            has_account=True, 
            is_active=True
        ).scalar() or 0
        
        can_payback = float(total_balance) >= total_unpaid
        
        return jsonify({
            'unpaid_reloads': [reload.to_dict() for reload in unpaid_reloads],
            'total_unpaid_amount': total_unpaid,
            'total_user_balance': float(total_balance),
            'can_payback': can_payback,
            'message': f"{'Pode quitar automaticamente' if can_payback else 'Saldo insuficiente para quitação'}"
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@reload_payback_bp.route('/payback', methods=['POST'])
@login_required
@csrf_protect
def payback_reloads():
    """Quitar todos os reloads aprovados não quitados"""
    try:
        current_user = User.query.get(session['user_id'])
        data = request.get_json() or {}
        user_id = data.get('user_id', current_user.id)
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar reloads não quitados
        unpaid_reloads = ReloadRequest.query.filter_by(
            user_id=user_id,
            status=ReloadStatus.APPROVED,
            paid_back=False
        ).all()
        
        if not unpaid_reloads:
            return jsonify({'message': 'No outstanding reloads to pay back'}), 200
        
        total_unpaid = sum(float(reload.amount) for reload in unpaid_reloads)
        
        # Verificar saldo total do usuário
        accounts = Account.query.filter_by(
            user_id=user_id, 
            has_account=True, 
            is_active=True
        ).all()
        
        total_balance = sum(float(acc.current_balance) for acc in accounts)
        
        if total_balance < total_unpaid:
            return jsonify({
                'error': 'Insufficient balance to pay back reloads',
                'total_balance': total_balance,
                'required_amount': total_unpaid
            }), 400
        
        # 🚨 PROCESSAR QUITAÇÃO DOS RELOADS
        
        # 1. Deduzir proporcionalmente de cada conta
        remaining_to_deduct = total_unpaid
        deduction_details = []
        
        for account in accounts:
            if remaining_to_deduct <= 0:
                break
                
            account_balance = float(account.current_balance)
            if account_balance > 0:
                # Deduzir proporcionalmente
                proportion = account_balance / total_balance
                deduction = min(remaining_to_deduct, proportion * total_unpaid)
                
                if deduction > 0:
                    old_balance = account.current_balance
                    account.current_balance -= deduction
                    remaining_to_deduct -= deduction
                    
                    # Registrar histórico
                    history = BalanceHistory(
                        account_id=account.id,
                        old_balance=old_balance,
                        new_balance=account.current_balance,
                        change_reason='reload_payback',
                        notes=f'Quitação de reloads: ${total_unpaid:.2f}',
                        changed_by=current_user.id
                    )
                    db.session.add(history)
                    
                    deduction_details.append({
                        'platform': account.platform.display_name,
                        'amount_deducted': deduction,
                        'old_balance': float(old_balance),
                        'new_balance': float(account.current_balance)
                    })
        
        # 2. Marcar reloads como quitados
        reload_details = []
        for reload in unpaid_reloads:
            reload.paid_back = True
            reload.paid_back_at = datetime.utcnow()
            reload_details.append({
                'id': reload.id,
                'amount': float(reload.amount),
                'platform': reload.platform.display_name if reload.platform else None
            })
        
        db.session.commit()
        
        # 3. Notificar via SSE (se disponível)
        try:
            from src.routes.sse import notify_balance_updated, notify_dashboard_refresh
            for detail in deduction_details:
                # Simular notificação (não temos account_id aqui, mas é para atualizar)
                pass
            notify_dashboard_refresh()
        except Exception:
            pass
        
        return jsonify({
            'message': 'Reloads paid back successfully',
            'total_paid_back': total_unpaid,
            'reloads_settled': reload_details,
            'account_deductions': deduction_details,
            'remaining_balance': total_balance - total_unpaid
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@reload_payback_bp.route('/status/<int:user_id>', methods=['GET'])
@login_required 
def get_payback_status(user_id):
    """Verificar status de quitação de reloads para validação de saque"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar reloads não quitados
        unpaid_reloads = ReloadRequest.query.filter_by(
            user_id=user_id,
            status=ReloadStatus.APPROVED,
            paid_back=False
        ).count()
        
        total_unpaid = db.session.query(func.sum(ReloadRequest.amount)).filter_by(
            user_id=user_id,
            status=ReloadStatus.APPROVED,
            paid_back=False
        ).scalar() or 0
        
        return jsonify({
            'has_unpaid_reloads': unpaid_reloads > 0,
            'unpaid_reload_count': unpaid_reloads,
            'total_unpaid_amount': float(total_unpaid),
            'can_withdraw': unpaid_reloads == 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
