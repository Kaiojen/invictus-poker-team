from flask import Blueprint, request, jsonify, session
from src.models.models import db, Reta, User, UserRole, RetaPermission, Platform
from src.routes.auth import login_required, admin_required

retas_bp = Blueprint('retas', __name__)

@retas_bp.route('/', methods=['GET'])
@login_required
def get_retas():
    """Listar todas as retas"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver todas as retas
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        retas = Reta.query.filter_by(is_active=True).order_by(Reta.name).all()
        return jsonify({'retas': [reta.to_dict() for reta in retas]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@retas_bp.route('/', methods=['POST'])
@admin_required
def create_reta():
    """Criar nova reta"""
    try:
        data = request.get_json()
        
        required_fields = ['name', 'min_stake', 'max_stake']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verificar se o nome já existe
        existing_reta = Reta.query.filter_by(name=data['name']).first()
        if existing_reta:
            return jsonify({'error': 'Reta name already exists'}), 400
        
        # Validar valores
        min_stake = float(data['min_stake'])
        max_stake = float(data['max_stake'])
        
        if min_stake <= 0 or max_stake <= 0:
            return jsonify({'error': 'Stakes must be positive values'}), 400
        
        if min_stake >= max_stake:
            return jsonify({'error': 'Min stake must be less than max stake'}), 400
        
        reta = Reta(
            name=data['name'],
            min_stake=min_stake,
            max_stake=max_stake,
            description=data.get('description', '')
        )
        
        db.session.add(reta)
        db.session.commit()
        
        return jsonify({
            'message': 'Reta created successfully',
            'reta': reta.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@retas_bp.route('/<int:reta_id>', methods=['PUT'])
@admin_required
def update_reta(reta_id):
    """Atualizar reta"""
    try:
        reta = Reta.query.get(reta_id)
        if not reta:
            return jsonify({'error': 'Reta not found'}), 404
        
        data = request.get_json()
        
        if 'name' in data:
            # Verificar se o novo nome já existe (exceto na própria reta)
            existing_reta = Reta.query.filter(
                Reta.name == data['name'],
                Reta.id != reta_id
            ).first()
            if existing_reta:
                return jsonify({'error': 'Reta name already exists'}), 400
            reta.name = data['name']
        
        if 'min_stake' in data:
            min_stake = float(data['min_stake'])
            if min_stake <= 0:
                return jsonify({'error': 'Min stake must be positive'}), 400
            reta.min_stake = min_stake
        
        if 'max_stake' in data:
            max_stake = float(data['max_stake'])
            if max_stake <= 0:
                return jsonify({'error': 'Max stake must be positive'}), 400
            reta.max_stake = max_stake
        
        # Validar se min_stake < max_stake
        if reta.min_stake >= reta.max_stake:
            return jsonify({'error': 'Min stake must be less than max stake'}), 400
        
        if 'description' in data:
            reta.description = data['description']
        
        if 'is_active' in data:
            reta.is_active = bool(data['is_active'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Reta updated successfully',
            'reta': reta.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@retas_bp.route('/<int:reta_id>/permissions', methods=['GET'])
@login_required
def get_reta_permissions(reta_id):
    """Obter permissões específicas de uma reta para todos os jogadores"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        reta = Reta.query.get(reta_id)
        if not reta:
            return jsonify({'error': 'Reta not found'}), 404
        
        # Buscar todos os jogadores da reta
        players = User.query.filter_by(reta_id=reta_id, role=UserRole.PLAYER, is_active=True).all()
        
        permissions_data = []
        for player in players:
            # Buscar permissões específicas do jogador
            permissions = RetaPermission.query.filter_by(user_id=player.id).all()
            
            player_permissions = {
                'user_id': player.id,
                'user_name': player.full_name,
                'permissions': [perm.to_dict() for perm in permissions]
            }
            permissions_data.append(player_permissions)
        
        return jsonify({
            'reta': reta.to_dict(),
            'players_permissions': permissions_data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@retas_bp.route('/permissions', methods=['POST'])
@admin_required
def create_or_update_permission():
    """Criar ou atualizar permissão específica de jogador"""
    try:
        data = request.get_json()
        current_user = User.query.get(session['user_id'])
        
        required_fields = ['user_id', 'platform_id', 'is_allowed']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verificar se usuário e plataforma existem
        user = User.query.get(data['user_id'])
        if not user or user.role != UserRole.PLAYER:
            return jsonify({'error': 'Player not found'}), 404
        
        platform = Platform.query.get(data['platform_id'])
        if not platform:
            return jsonify({'error': 'Platform not found'}), 404
        
        # Buscar permissão existente ou criar nova
        permission = RetaPermission.query.filter_by(
            user_id=data['user_id'],
            platform_id=data['platform_id']
        ).first()
        
        if permission:
            # Atualizar existente
            permission.is_allowed = bool(data['is_allowed'])
            permission.special_limit = data.get('special_limit')
            permission.special_limit_expires = None
            if data.get('special_limit_expires'):
                from datetime import datetime
                permission.special_limit_expires = datetime.fromisoformat(
                    data['special_limit_expires'].replace('Z', '+00:00')
                )
            permission.notes = data.get('notes', '')
            permission.created_by = current_user.id
        else:
            # Criar nova
            permission = RetaPermission(
                user_id=data['user_id'],
                platform_id=data['platform_id'],
                is_allowed=bool(data['is_allowed']),
                special_limit=data.get('special_limit'),
                notes=data.get('notes', ''),
                created_by=current_user.id
            )
            if data.get('special_limit_expires'):
                from datetime import datetime
                permission.special_limit_expires = datetime.fromisoformat(
                    data['special_limit_expires'].replace('Z', '+00:00')
                )
            
            db.session.add(permission)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Permission updated successfully',
            'permission': permission.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@retas_bp.route('/permissions/<int:permission_id>', methods=['DELETE'])
@admin_required
def delete_permission(permission_id):
    """Deletar permissão específica"""
    try:
        permission = RetaPermission.query.get(permission_id)
        if not permission:
            return jsonify({'error': 'Permission not found'}), 404
        
        db.session.delete(permission)
        db.session.commit()
        
        return jsonify({'message': 'Permission deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@retas_bp.route('/dashboard-stats', methods=['GET'])
@login_required
def get_reta_dashboard_stats():
    """Obter estatísticas do dashboard de retas"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver estatísticas
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        days_back = request.args.get('days', 7, type=int)
        from datetime import datetime, timedelta
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Buscar todas as retas
        retas = Reta.query.filter_by(is_active=True).all()
        
        reta_stats = []
        for reta in retas:
            # Contar jogadores na reta
            player_count = User.query.filter_by(
                reta_id=reta.id, 
                role=UserRole.PLAYER, 
                is_active=True
            ).count()
            
            # Calcular lucro total da reta no período
            from sqlalchemy import func
            from src.models.models import Transaction, TransactionType, Account
            
            # Buscar IDs dos jogadores da reta
            player_ids = [p.id for p in User.query.filter_by(reta_id=reta.id, role=UserRole.PLAYER, is_active=True).all()]
            
            # Soma de transações de lucro/prejuízo dos jogadores da reta
            profit_sum = 0
            if player_ids:
                profit_sum = db.session.query(func.sum(Transaction.amount)).filter(
                    Transaction.user_id.in_(player_ids),
                    Transaction.transaction_type.in_([TransactionType.PROFIT, TransactionType.LOSS]),
                    Transaction.created_at >= start_date
                ).scalar() or 0
            
            # Calcular saldo atual total dos jogadores da reta
            current_balance_sum = 0
            if player_ids:
                current_balance_sum = db.session.query(func.sum(Account.current_balance)).filter(
                    Account.user_id.in_(player_ids),
                    Account.has_account == True
                ).scalar() or 0
            
            avg_profit_per_player = profit_sum / player_count if player_count > 0 else 0
            
            reta_stats.append({
                'reta_id': reta.id,
                'reta_name': reta.name,
                'min_stake': float(reta.min_stake),
                'max_stake': float(reta.max_stake),
                'player_count': player_count,
                'total_profit': float(profit_sum),
                'avg_profit_per_player': float(avg_profit_per_player),
                'current_balance_sum': float(current_balance_sum)
            })
        
        return jsonify({
            'reta_stats': reta_stats,
            'period_days': days_back
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500