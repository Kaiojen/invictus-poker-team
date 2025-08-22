from flask import Blueprint, request, jsonify, session
from src.models.models import db, User, UserRole, PlayerData, Account, Transaction, TransactionType, Reta, BalanceHistory
from src.routes.auth import login_required, admin_required
from src.middleware.audit_middleware import audit_user_creation, audit_action
from src.middleware.csrf_protection import csrf_protect
from src.schemas.users import CreateUserSchema, UpdateUserSchema
from src.utils.pagination import paginate_query
from src.services.users import UserService, CreateUserDTO, UpdateUserDTO
import bleach
from sqlalchemy import func
from datetime import datetime, timedelta
from sqlalchemy import and_

users_bp = Blueprint('users', __name__)
@users_bp.route('/cleanup-tests', methods=['POST'])
@admin_required
def cleanup_tests():
    """Endpoint administrativo para limpar usuários/contas de teste."""
    try:
        from src.utils.cleanup import cleanup_test_data, cleanup_test_platforms
        result = cleanup_test_data(commit=True)
        result.update(cleanup_test_platforms(commit=True))
        return jsonify({"message": "Test data removed", "result": result}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@users_bp.route('/simulate-year-data', methods=['POST'])
@admin_required
def simulate_year_data():
    """Endpoint administrativo para simular 1 ano completo de dados."""
    try:
        from src.utils.data_simulation import simulate_full_year_operation
        result = simulate_full_year_operation()
        return jsonify({"message": "Year simulation completed", "result": result}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

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
        
        query = User.query.filter_by(is_active=True).order_by(User.created_at.desc())
        result = paginate_query(query, max_per_page=200)
        return jsonify({
            'users': [user.to_dict() for user in result['items']],
            'pagination': result['pagination']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/', methods=['POST'])
@admin_required
@csrf_protect
@audit_user_creation
def create_user():
    try:
        payload = CreateUserSchema().load(request.get_json() or {})

        existing_user = User.query.filter(
            (User.username == payload['username']) | (User.email == payload['email'])
        ).first()
        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 400

        user = UserService.create(CreateUserDTO(
            username=payload['username'],
            email=payload['email'],
            password=payload['password'],
            full_name=payload['full_name'],
            role=payload['role'],
            phone=payload.get('phone'),
            document=payload.get('document'),
            birth_date=payload.get('birth_date'),
            bank_name=payload.get('bank_name'),
            bank_agency=payload.get('bank_agency'),
            bank_account=payload.get('bank_account'),
            pix_key=payload.get('pix_key'),
            reta_id=payload.get('reta_id')
        ))

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
@csrf_protect
@audit_action('user_updated', 'User', include_body=True)
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
        
        payload = UpdateUserSchema().load(request.get_json() or {})
        
        # Verificar email único se fornecido
        if 'email' in payload and payload['email'] and payload['email'] != user.email:
            existing_user = User.query.filter(User.email == payload['email'], User.id != user_id).first()
            if existing_user:
                return jsonify({'error': 'Email already exists'}), 400
        
        # Sanitizar campos de texto livre
        if payload.get('document'):
            payload['document'] = bleach.clean(payload['document'], tags=[], strip=True)
        if payload.get('bank_name'):
            payload['bank_name'] = bleach.clean(payload['bank_name'], tags=[], strip=True)
        if payload.get('bank_agency'):
            payload['bank_agency'] = bleach.clean(payload['bank_agency'], tags=[], strip=True)
        if payload.get('bank_account'):
            payload['bank_account'] = bleach.clean(payload['bank_account'], tags=[], strip=True)
        if payload.get('pix_key'):
            payload['pix_key'] = bleach.clean(payload['pix_key'], tags=[], strip=True)
        
        # Verificar mudança de reta
        reta_changed = False
        old_reta_id = user.reta_id
        if current_user.role == UserRole.ADMIN and payload.get('reta_id') is not None:
            if payload['reta_id'] != user.reta_id:
                reta_changed = True
        
        # Usar serviço para atualizar
        user = UserService.update(UpdateUserDTO(
            user_id=user_id,
            full_name=payload.get('full_name'),
            phone=payload.get('phone'),
            document=payload.get('document'),
            birth_date=payload.get('birth_date'),
            bank_name=payload.get('bank_name'),
            bank_agency=payload.get('bank_agency'),
            bank_account=payload.get('bank_account'),
            pix_key=payload.get('pix_key'),
            reta_id=payload.get('reta_id') if current_user.role == UserRole.ADMIN else None
        ))
        
        # T2.3.2 - Notificar jogador sobre mudança de reta
        if reta_changed:
            try:
                from src.utils.notification_service import get_notification_service
                from src.routes.sse import broadcast_to_user
                
                notification_service = get_notification_service()
                notification_service.create_notification(
                    user_id=user.id,
                    title="Reta alterada",
                    message=f"Sua reta foi alterada pelo administrador",
                    category="system",
                    is_urgent=True
                )
                
                # SSE para atualização imediata
                broadcast_to_user(user.id, 'reta_changed', {
                    'user_id': user.id,
                    'old_reta_id': old_reta_id,
                    'new_reta_id': user.reta_id,
                    'message': 'Sua reta foi alterada',
                    'timestamp': datetime.utcnow().timestamp()
                })
            except Exception as e:
                print(f"Erro ao notificar mudança de reta: {e}")
        
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
@csrf_protect
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
        
        # Buscar todas as contas do usuário
        user_accounts = Account.query.filter_by(user_id=user_id, is_active=True).all()
        account_ids = [acc.id for acc in user_accounts]
        
        if not account_ids:
            return jsonify({'history': [], 'period_days': days_back}), 200
        
        # ✅ CORRIGIDO: Sempre usar dados reais, nunca fictícios
        # Se não há histórico, retornar dados vazios ou saldo atual apenas
        balance_history_exists = BalanceHistory.query.filter(BalanceHistory.account_id.in_(account_ids)).first()
        
        if not balance_history_exists:
            # ✅ MELHORADO: Criar histórico baseado no saldo atual + pontos dos últimos 7 dias
            current_balance = sum(float(acc.current_balance or 0) for acc in user_accounts)
            
            history = []
            # Criar pontos dos últimos 7 dias para dar contexto visual
            for i in range(7):
                date = (datetime.utcnow() - timedelta(days=6-i)).date()
                # Saldo atual nos últimos dias (sem variação fictícia, apenas saldo real)
                history.append({
                    'date': date.isoformat(),
                    'balance': current_balance,
                    'change': 0
                })
                
            # ✅ IMPORTANTE: Criar entrada inicial de BalanceHistory para futuras atualizações
            try:
                for acc in user_accounts:
                    existing_history = BalanceHistory.query.filter_by(account_id=acc.id).first()
                    if not existing_history:
                        # Criar primeira entrada de histórico
                        initial_history = BalanceHistory(
                            account_id=acc.id,
                            old_balance=acc.current_balance,
                            new_balance=acc.current_balance,
                            change_reason='initial_state',
                            notes='Estado inicial da conta',
                            changed_by=1  # Admin system
                        )
                        db.session.add(initial_history)
                db.session.commit()
                print(f"✅ Histórico inicial criado para jogador {user_id}")
            except Exception as e:
                print(f"Aviso: Erro ao criar histórico inicial: {e}")
                db.session.rollback()
            
        else:
            # ✅ CORRIGIDO: Buscar TODAS as alterações de saldo, não só 'close_day'
            # Isso mostrará a evolução real baseada em todas as atualizações
            balance_history = BalanceHistory.query.filter(
                BalanceHistory.account_id.in_(account_ids),
                BalanceHistory.created_at >= start_date
            ).order_by(BalanceHistory.created_at).all()
            
            # Calcular saldo total acumulativo por data
            daily_balances = {}
            running_total = 0
            
            # Pegar saldo inicial (antes do período)
            initial_balances = {}
            for acc in user_accounts:
                last_balance_before = BalanceHistory.query.filter(
                    BalanceHistory.account_id == acc.id,
                    BalanceHistory.created_at < start_date
                ).order_by(BalanceHistory.created_at.desc()).first()
                
                if last_balance_before:
                    initial_balances[acc.id] = float(last_balance_before.new_balance)
                else:
                    initial_balances[acc.id] = float(acc.current_balance or 0)
            
            running_total = sum(initial_balances.values())
            
            for bh in balance_history:
                date_key = bh.created_at.date().isoformat()
                if date_key not in daily_balances:
                    daily_balances[date_key] = running_total
                
                # Atualizar o saldo com a mudança
                change = float(bh.new_balance) - float(bh.old_balance)
                daily_balances[date_key] += change
                running_total += change
            
            # Converter para lista ordenada
            history = []
            for date_str in sorted(daily_balances.keys()):
                history.append({
                    'date': date_str,
                    'balance': daily_balances[date_str],
                    'change': 0
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