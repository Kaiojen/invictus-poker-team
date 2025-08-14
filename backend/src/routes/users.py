from flask import Blueprint, request, jsonify, session
from src.models.models import db, User, UserRole, PlayerData, Account, Transaction, TransactionType, Reta, BalanceHistory
from src.routes.auth import login_required, admin_required
from sqlalchemy import func
from datetime import datetime, timedelta
from sqlalchemy import and_

users_bp = Blueprint('users', __name__)
@users_bp.route('/<int:user_id>/calendar-tracker', methods=['GET'])
@login_required
def get_calendar_tracker(user_id):
    """Retorna os últimos N dias com informação se a planilha foi preenchida (close-day)."""
    try:
        current_user = User.query.get(session['user_id'])
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        days = request.args.get('days', default=30, type=int)
        end_date = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        start_date = end_date - timedelta(days=days - 1)

        # Um dia está "preenchido" se existe pelo menos um BalanceHistory com reason 'close_day'
        # em qualquer conta do usuário naquele dia.
        accounts = Account.query.filter_by(user_id=user_id, is_active=True).all()
        account_ids = [acc.id for acc in accounts]

        calendar = []
        for i in range(days):
            day = start_date + timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)

            filled = False
            if account_ids:
                exists = db.session.query(BalanceHistory.id).filter(
                    BalanceHistory.account_id.in_(account_ids),
                    BalanceHistory.change_reason == 'close_day',
                    BalanceHistory.created_at >= day_start,
                    BalanceHistory.created_at <= day_end
                ).first()
                filled = exists is not None

            calendar.append({
                'date': day_start.isoformat(),
                'filled': filled,
                'status': '✅' if filled else '❌'
            })

        return jsonify({'calendar': calendar}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/', methods=['GET'])
@login_required
def get_users():
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver todos os usuários
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        users = User.query.filter_by(is_active=True).all()
        return jsonify({'users': [user.to_dict() for user in users]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/', methods=['POST'])
@admin_required
def create_user():
    try:
        data = request.get_json()
        
        required_fields = ['username', 'email', 'password', 'full_name', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verificar se username ou email já existem
        existing_user = User.query.filter(
            (User.username == data['username']) | (User.email == data['email'])
        ).first()
        
        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 400
        
        # Validar role
        try:
            role = UserRole(data['role'])
        except ValueError:
            return jsonify({'error': 'Invalid role'}), 400
        
        user = User(
            username=data['username'],
            email=data['email'],
            full_name=data['full_name'],
            role=role,
            phone=data.get('phone'),
            document=data.get('document'),
            birth_date=datetime.fromisoformat(data['birth_date']) if data.get('birth_date') else None,
            bank_name=data.get('bank_name'),
            bank_agency=data.get('bank_agency'),
            bank_account=data.get('bank_account'),
            pix_key=data.get('pix_key'),
            reta_id=data.get('reta_id')
        )
        
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    try:
        current_user = User.query.get(session['user_id'])
        
        # Usuários só podem ver seu próprio perfil, exceto admins/managers
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Usuários só podem editar seu próprio perfil, exceto admins
        if current_user.role != UserRole.ADMIN and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Campos que podem ser atualizados
        if 'full_name' in data:
            user.full_name = data['full_name']
        
        if 'email' in data and data['email'] != user.email:
            # Verificar se email já existe
            existing_user = User.query.filter(User.email == data['email'], User.id != user_id).first()
            if existing_user:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']
        
        if 'phone' in data:
            user.phone = data['phone']
        
        if 'document' in data:
            user.document = data['document']
        
        if 'birth_date' in data and data['birth_date']:
            user.birth_date = datetime.fromisoformat(data['birth_date'])
        
        if 'bank_name' in data:
            user.bank_name = data['bank_name']
        
        if 'bank_agency' in data:
            user.bank_agency = data['bank_agency']
        
        if 'bank_account' in data:
            user.bank_account = data['bank_account']
        
        if 'pix_key' in data:
            user.pix_key = data['pix_key']
        
        # Apenas admins podem alterar reta e role
        if current_user.role == UserRole.ADMIN:
            if 'reta_id' in data:
                user.reta_id = data['reta_id']
            
            if 'role' in data:
                try:
                    user.role = UserRole(data['role'])
                except ValueError:
                    return jsonify({'error': 'Invalid role'}), 400
        
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>/player-data', methods=['GET'])
@login_required
def get_player_data(user_id):
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        player_data = PlayerData.query.filter_by(user_id=user_id).first()
        if not player_data:
            return jsonify({'player_data': None}), 200
        
        return jsonify({'player_data': player_data.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>/player-data', methods=['POST', 'PUT'])
@login_required
def update_player_data(user_id):
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Buscar ou criar player_data
        player_data = PlayerData.query.filter_by(user_id=user_id).first()
        if not player_data:
            player_data = PlayerData(
                user_id=user_id,
                total_profit_loss=data.get('total_profit_loss', 0),
                total_rakeback=data.get('total_rakeback', 0),
                total_bonuses=data.get('total_bonuses', 0),
                makeup=data.get('makeup', 0),
                monthly_target=data.get('monthly_target', 0),
                notes=data.get('notes', '')
            )
            db.session.add(player_data)
        else:
            # Atualizar campos existentes
            if 'total_profit_loss' in data:
                player_data.total_profit_loss = data['total_profit_loss']
            if 'total_rakeback' in data:
                player_data.total_rakeback = data['total_rakeback']
            if 'total_bonuses' in data:
                player_data.total_bonuses = data['total_bonuses']
            if 'makeup' in data:
                player_data.makeup = data['makeup']
            if 'monthly_target' in data:
                player_data.monthly_target = data['monthly_target']
            if 'notes' in data:
                player_data.notes = data['notes']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Player data updated successfully',
            'player_data': player_data.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/players', methods=['GET'])
@login_required
def get_players():
    """Obter lista de jogadores com informações de reta e saldo"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver jogadores
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar jogadores ativos
        players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).all()
        
        players_data = []
        for player in players:
            # Calcular saldo total
            total_balance = db.session.query(func.sum(Account.current_balance)).filter(
                Account.user_id == player.id,
                Account.has_account == True
            ).scalar() or 0
            
            # Contar contas ativas
            account_count = db.session.query(func.count(Account.id)).filter(
                Account.user_id == player.id,
                Account.has_account == True
            ).scalar() or 0
            
            player_data = {
                'id': player.id,
                'username': player.username,
                'full_name': player.full_name,
                'email': player.email,
                'reta_id': player.reta_id,
                'makeup': float(player.makeup or 0),
                'total_balance': float(total_balance),
                'account_count': account_count,
                'created_at': player.created_at.isoformat() if player.created_at else None
            }
            
            players_data.append(player_data)
        
        return jsonify({'players': players_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/performance-ranking', methods=['GET'])
@login_required
def get_performance_ranking():
    """Obter ranking de performance dos jogadores"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver ranking
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        days_back = request.args.get('days', 7, type=int)
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Buscar jogadores ativos
        players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).all()
        
        players_performance = []
        for player in players:
            # Calcular lucro no período
            profit = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == player.id,
                Transaction.transaction_type.in_([TransactionType.PROFIT, TransactionType.LOSS]),
                Transaction.created_at >= start_date
            ).scalar() or 0
            
            # Calcular saldo total atual
            total_balance = db.session.query(func.sum(Account.current_balance)).filter(
                Account.user_id == player.id,
                Account.has_account == True
            ).scalar() or 0
            
            # Calcular ROI (retorno sobre investimento)
            initial_balance = db.session.query(func.sum(Account.initial_balance)).filter(
                Account.user_id == player.id,
                Account.has_account == True
            ).scalar() or 1
            
            roi = ((total_balance - initial_balance) / initial_balance * 100) if initial_balance > 0 else 0
            
            # Buscar nome da reta
            reta = Reta.query.get(player.reta_id) if player.reta_id else None
            
            player_perf = {
                'id': player.id,
                'username': player.username,
                'full_name': player.full_name,
                'reta_id': player.reta_id,
                'reta_name': reta.name if reta else 'Sem reta',
                'profit': float(profit),
                'total_balance': float(total_balance),
                'makeup': float(player.makeup or 0),
                'roi': float(roi)
            }
            
            players_performance.append(player_perf)
        
        # Ordenar por lucro (maior para menor)
        players_performance.sort(key=lambda x: x['profit'], reverse=True)
        
        return jsonify({
            'players': players_performance,
            'period_days': days_back
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/<int:user_id>/bankroll-history', methods=['GET'])
@login_required
def get_bankroll_history(user_id):
    """Obter histórico de evolução do bankroll do jogador"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        days_back = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Buscar transações do período
        transactions = Transaction.query.filter(
            Transaction.user_id == user_id,
            Transaction.created_at >= start_date
        ).order_by(Transaction.created_at).all()
        
        # Calcular evolução do bankroll
        history = []
        running_balance = 0
        
        for transaction in transactions:
            if transaction.transaction_type in [TransactionType.PROFIT, TransactionType.LOSS]:
                running_balance += float(transaction.amount)
            
            history.append({
                'date': transaction.created_at.isoformat(),
                'amount': float(transaction.amount),
                'type': transaction.transaction_type.value,
                'balance': running_balance,
                'description': transaction.description
            })
        
        return jsonify({
            'history': history,
            'period_days': days_back
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

 

@users_bp.route('/<int:user_id>/accounts-by-platform', methods=['GET'])
@login_required
def get_accounts_by_platform(user_id):
    """Obter contas do jogador separadas por plataforma"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        from src.models.models import Platform
        
        # Buscar contas ativas do usuário com informações da plataforma
        accounts = db.session.query(Account, Platform).join(Platform).filter(
            Account.user_id == user_id,
            Account.has_account == True
        ).all()
        
        # Agrupar por plataforma
        platforms_data = {}
        for account, platform in accounts:
            platform_name = platform.display_name
            
            if platform_name not in platforms_data:
                platforms_data[platform_name] = {
                    'platform_id': platform.id,
                    'platform_name': platform_name,
                    'accounts': [],
                    'total_balance': 0,
                    'total_initial': 0
                }
            
            account_data = {
                'id': account.id,
                'account_name': account.account_name,
                'current_balance': float(account.current_balance),
                'initial_balance': float(account.initial_balance),
                'profit_loss': float(account.current_balance - account.initial_balance),
                'status': account.status.value if account.status else 'unknown',
                'last_update': account.last_balance_update.isoformat() if account.last_balance_update else None
            }
            
            platforms_data[platform_name]['accounts'].append(account_data)
            platforms_data[platform_name]['total_balance'] += float(account.current_balance)
            platforms_data[platform_name]['total_initial'] += float(account.initial_balance)
        
        return jsonify({
            'platforms': list(platforms_data.values())
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500