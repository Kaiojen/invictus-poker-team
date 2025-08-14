from flask import Blueprint, request, jsonify, session
from src.models.models import db, Account, User, Platform, UserRole
from src.routes.auth import login_required, admin_required

accounts_bp = Blueprint('accounts', __name__)

@accounts_bp.route('/', methods=['GET'])
@login_required
def get_accounts():
    try:
        current_user = User.query.get(session['user_id'])
        user_id = request.args.get('user_id', type=int)
        
        # Se user_id for especificado, verificar permissões
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            accounts = Account.query.filter_by(user_id=user_id, is_active=True).all()
        else:
            # Admins/managers podem ver todas as contas, jogadores apenas as suas
            if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
                accounts = Account.query.filter_by(is_active=True).all()
            else:
                accounts = Account.query.filter_by(user_id=current_user.id, is_active=True).all()
        
        return jsonify({'accounts': [account.to_dict() for account in accounts]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@accounts_bp.route('/', methods=['POST'])
@login_required
def create_account():
    try:
        current_user = User.query.get(session['user_id'])
        data = request.get_json()
        
        required_fields = ['platform_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Determinar o user_id
        user_id = data.get('user_id')
        if user_id:
            # Apenas admins/managers podem criar contas para outros usuários
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Access denied'}), 403
        else:
            user_id = current_user.id
        
        # Verificar se a plataforma existe
        platform = Platform.query.get(data['platform_id'])
        if not platform or not platform.is_active:
            return jsonify({'error': 'Platform not found or inactive'}), 404
        
        # Verificar se o usuário já tem conta nesta plataforma
        existing_account = Account.query.filter_by(
            user_id=user_id, 
            platform_id=data['platform_id']
        ).first()
        if existing_account:
            return jsonify({'error': 'User already has an account on this platform'}), 400
        
        account = Account(
            user_id=user_id,
            platform_id=data['platform_id'],
            account_name=data['account_name'],
            current_balance=data.get('current_balance', 0.00)
        )
        
        db.session.add(account)
        db.session.commit()
        
        return jsonify({
            'message': 'Account created successfully',
            'account': account.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@accounts_bp.route('/<int:account_id>', methods=['GET'])
@login_required
def get_account(account_id):
    try:
        current_user = User.query.get(session['user_id'])
        account = Account.query.get(account_id)
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Verificar permissões GET
        # ADMIN tem acesso total
        if current_user.role == UserRole.ADMIN:
            pass  # Admin pode ver tudo
        # MANAGER tem acesso total
        elif current_user.role == UserRole.MANAGER:
            pass  # Manager pode ver tudo
        # JOGADOR só pode ver suas próprias contas
        elif current_user.role == UserRole.PLAYER:
            if current_user.id != account.user_id:
                return jsonify({'error': 'Access denied - can only view own accounts'}), 403
        # Outros roles sem acesso
        else:
            return jsonify({'error': 'Access denied - invalid role'}), 403
        
        return jsonify({'account': account.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@accounts_bp.route('/<int:account_id>', methods=['PUT'])
@login_required
def update_account(account_id):
    try:
        current_user = User.query.get(session['user_id'])
        account = Account.query.get(account_id)
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Verificar permissões
        # ADMIN tem acesso total
        if current_user.role == UserRole.ADMIN:
            pass  # Admin pode editar tudo
        # MANAGER tem acesso total
        elif current_user.role == UserRole.MANAGER:
            pass  # Manager pode editar tudo
        # JOGADOR só pode editar suas próprias contas
        elif current_user.role == UserRole.PLAYER:
            if current_user.id != account.user_id:
                return jsonify({'error': 'Access denied - can only edit own accounts'}), 403
        # Outros roles sem acesso
        else:
            return jsonify({'error': 'Access denied - invalid role'}), 403
        
        data = request.get_json()
        
        if 'account_name' in data:
            account.account_name = data['account_name']
        
        # Apenas admins/managers podem alterar saldo e status
        if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
            if 'current_balance' in data:
                account.current_balance = data['current_balance']
            
            if 'is_active' in data:
                account.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Account updated successfully',
            'account': account.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@accounts_bp.route('/<int:account_id>', methods=['DELETE'])
@admin_required
def delete_account(account_id):
    try:
        account = Account.query.get(account_id)
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Soft delete - apenas marcar como inativo
        account.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Account deactivated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

