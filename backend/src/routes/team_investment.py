"""
🎯 NOVA ROTA: Gestão manual do investimento do time pelo admin
Permite admin definir manualmente o total investido, sobrescrevendo cálculo automático
"""

from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.models import User, Account, UserRole, db
from src.routes.auth import login_required, admin_required
from src.middleware.csrf_protection import csrf_protect
from src.middleware.audit_middleware import audit_action
from decimal import Decimal

team_investment_bp = Blueprint('team_investment', __name__)

@team_investment_bp.route('/user/<int:user_id>/manual', methods=['PUT'])
@admin_required
@csrf_protect
@audit_action('manual_investment_set', 'Account', include_body=True)
def set_manual_investment(user_id):
    """Definir investimento manual para um usuário (somente admin)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Só admin pode definir investimento manual
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Only admins can set manual investment'}), 403
        
        user = User.query.get(user_id)
        if not user or user.role != UserRole.PLAYER:
            return jsonify({'error': 'Player not found'}), 404
        
        data = request.get_json()
        investment_amount = data.get('investment_amount')
        notes = data.get('notes', '')
        
        if investment_amount is None:
            return jsonify({'error': 'investment_amount is required'}), 400
        
        investment_amount = float(investment_amount)
        if investment_amount < 0:
            return jsonify({'error': 'Investment amount cannot be negative'}), 400
        
        # Atualizar conta principal (normalmente Luxon) ou criar se não existir
        # Buscar conta Luxon primeiro
        luxon_account = None
        for acc in Account.query.filter_by(user_id=user_id, is_active=True).all():
            if acc.platform and 'luxon' in acc.platform.name.lower():
                luxon_account = acc
                break
        
        if not luxon_account:
            # Se não há Luxon, usar primeira conta disponível
            luxon_account = Account.query.filter_by(user_id=user_id, is_active=True).first()
        
        if not luxon_account:
            return jsonify({'error': 'User has no active accounts'}), 400
        
        # Definir investimento manual
        luxon_account.manual_team_investment = Decimal(str(investment_amount))
        luxon_account.investment_notes = notes
        
        db.session.commit()
        
        return jsonify({
            'message': 'Manual investment set successfully',
            'user_id': user_id,
            'investment_amount': investment_amount,
            'notes': notes,
            'account_id': luxon_account.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@team_investment_bp.route('/user/<int:user_id>/manual', methods=['GET'])
@login_required
def get_manual_investment(user_id):
    """Obter investimento manual definido para um usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar conta com investimento manual
        account_with_manual = Account.query.filter(
            Account.user_id == user_id,
            Account.is_active == True,
            Account.manual_team_investment.isnot(None)
        ).first()
        
        if account_with_manual:
            return jsonify({
                'has_manual_investment': True,
                'investment_amount': float(account_with_manual.manual_team_investment),
                'notes': account_with_manual.investment_notes,
                'account_id': account_with_manual.id
            }), 200
        else:
            return jsonify({
                'has_manual_investment': False,
                'investment_amount': None,
                'notes': None
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@team_investment_bp.route('/user/<int:user_id>/manual', methods=['DELETE'])
@admin_required
@csrf_protect
def remove_manual_investment(user_id):
    """Remover investimento manual (volta para cálculo automático)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Only admins can remove manual investment'}), 403
        
        # Buscar conta com investimento manual
        account_with_manual = Account.query.filter(
            Account.user_id == user_id,
            Account.is_active == True,
            Account.manual_team_investment.isnot(None)
        ).first()
        
        if account_with_manual:
            account_with_manual.manual_team_investment = None
            account_with_manual.investment_notes = None
            db.session.commit()
            
            return jsonify({
                'message': 'Manual investment removed, reverting to automatic calculation'
            }), 200
        else:
            return jsonify({'message': 'No manual investment found'}), 200
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@team_investment_bp.route('/user/<int:user_id>/manual-reload', methods=['PUT'])
@admin_required
@csrf_protect
@audit_action('manual_reload_set', 'Account', include_body=True)
def set_manual_reload(user_id):
    """Definir reloads manual para um usuário (somente admin)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        user = User.query.get(user_id)
        if not user or user.role != UserRole.PLAYER:
            return jsonify({'error': 'Player not found'}), 404
        
        data = request.get_json()
        reload_amount = data.get('reload_amount')
        notes = data.get('notes', '')
        
        if reload_amount is None:
            return jsonify({'error': 'reload_amount is required'}), 400
        
        reload_amount = float(reload_amount)
        if reload_amount < 0:
            return jsonify({'error': 'Reload amount cannot be negative'}), 400
        
        # ✅ USAR CAMPO DEDICADO: manual_reload_amount
        main_account = Account.query.filter_by(user_id=user_id, is_active=True).first()
        
        if not main_account:
            return jsonify({'error': 'User has no active accounts'}), 400
        
        # Definir reload manual no campo dedicado
        main_account.manual_reload_amount = Decimal(str(reload_amount))
        main_account.reload_notes = notes
        
        db.session.commit()
        
        return jsonify({
            'message': 'Manual reload set successfully',
            'user_id': user_id,
            'reload_amount': reload_amount,
            'notes': notes
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500