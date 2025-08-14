from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta
from sqlalchemy import func
from src.models.models import (
    db, User, Account, Platform, BalanceHistory, UserRole, 
    AccountStatus, ReloadRequest, WithdrawalRequest, PlayerData,
    RequiredField, PlayerFieldValue
)
from src.routes.auth import login_required, admin_required
import json

planilhas_bp = Blueprint('planilhas', __name__)

@planilhas_bp.route('/user/<int:user_id>', methods=['GET'])
@login_required
def get_user_spreadsheet(user_id):
    """Obter planilha completa de um usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        user = User.query.get(user_id)
        if not user or user.role != UserRole.PLAYER:
            return jsonify({'error': 'Player not found'}), 404
        
        # Buscar todas as contas do usuário
        accounts = Account.query.filter_by(user_id=user_id, is_active=True).all()
        
        # Buscar todas as plataformas disponíveis
        all_platforms = Platform.query.filter_by(is_active=True).all()
        
        # Criar lista de todas as plataformas com contas (existentes ou não)
        all_platform_accounts = []
        for platform in all_platforms:
            # Verificar se o usuário tem conta nesta plataforma
            existing_account = next((acc for acc in accounts if acc.platform_id == platform.id), None)
            
            if existing_account:
                # Usar conta existente
                platform_account = existing_account.to_dict()
                platform_account['platform_name'] = platform.display_name
            else:
                # Criar representação de plataforma sem conta
                platform_account = {
                    'id': None,
                    'platform_id': platform.id,
                    'platform_name': platform.display_name,
                    'has_account': False,
                    'account_name': None,
                    'current_balance': 0,
                    'initial_balance': 0,
                    'pnl': 0,
                    'last_balance_update': None,
                    'needs_update': False
                }
            
            all_platform_accounts.append(platform_account)
        
        # Calcular totais seguindo a regra do time:
        # - Banca inicial do time vinculada somente à Luxon
        # - Sites não usam banca inicial (apenas banca atual)
        total_initial = 0.0
        total_current = 0.0
        for acc in accounts:
            if acc.platform and acc.platform.name.lower() == 'luxon':
                total_initial += float(acc.initial_balance)
                total_current += float(acc.current_balance)
            else:
                total_current += float(acc.current_balance)
        total_pnl = total_current - total_initial
        
        # Buscar solicitações pendentes
        pending_reloads = ReloadRequest.query.filter_by(
            user_id=user_id, 
            status='pending'
        ).all()
        
        pending_withdrawals = WithdrawalRequest.query.filter_by(
            user_id=user_id, 
            status='pending'
        ).all()
        
        # Verificar dados incompletos
        incomplete_data = PlayerData.query.filter_by(
            user_id=user_id,
            is_required=True,
            is_complete=False
        ).all()
        
        # Determinar status geral
        status = 'complete'
        if len(incomplete_data) > 0:
            status = 'pending'
        if len(pending_reloads) > 0 or len(pending_withdrawals) > 0:
            status = 'critical'
        
        # Histórico recente de alterações (últimos 10)
        recent_changes = BalanceHistory.query.filter(
            BalanceHistory.account_id.in_([acc.id for acc in accounts])
        ).order_by(BalanceHistory.created_at.desc()).limit(10).all()
        
        # Construir links diretos (deep-link) para pendências
        deep_links = {
            'first_pending_field': None,
            'pending_reloads': '/dashboard?tab=planilha',
            'pending_withdrawals': '/dashboard?tab=planilha'
        }
        if incomplete_data:
            deep_links['first_pending_field'] = f"/dashboard?tab=planilha#field-{incomplete_data[0].field_name}"

        # Banca anterior (dia anterior) por plataforma
        start_today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        previous_balances = {}
        for acc in accounts:
            hist = BalanceHistory.query \
                .filter(BalanceHistory.account_id == acc.id, BalanceHistory.created_at < start_today) \
                .order_by(BalanceHistory.created_at.desc()) \
                .first()
            previous_balances[acc.id] = float(hist.new_balance) if hist else None

        return jsonify({
            'user': user.to_dict(),
            'status': status,
            'accounts': [
                {**acc.to_dict(), 'previous_balance': previous_balances.get(acc.id)}
                for acc in accounts
            ],
            'all_platform_accounts': all_platform_accounts,  # Todas as plataformas, com ou sem conta
            'summary': {
                'total_initial_balance': total_initial,
                'total_current_balance': total_current,
                'total_pnl': total_pnl,
                'accounts_count': len(accounts),
                'active_accounts': len([acc for acc in accounts if acc.has_account])
            },
            'pending_requests': {
                'reloads': [req.to_dict() for req in pending_reloads],
                'withdrawals': [req.to_dict() for req in pending_withdrawals]
            },
            'deep_links': deep_links,
            'incomplete_data': [data.to_dict() for data in incomplete_data],
            'recent_changes': [change.to_dict() for change in recent_changes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@planilhas_bp.route('/user/<int:user_id>/platform/<int:platform_id>/upsert', methods=['PUT'])
@login_required
def upsert_account_by_platform(user_id, platform_id):
    """Criar ou atualizar conta de um usuário em uma plataforma específica.
    - Admins/Managers podem alterar qualquer usuário
    - Jogadores só podem alterar a própria conta
    """
    try:
        current_user = User.query.get(session['user_id'])

        # Permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        user = User.query.get(user_id)
        if not user or user.role != UserRole.PLAYER:
            return jsonify({'error': 'Player not found'}), 404

        platform = Platform.query.get(platform_id)
        if not platform or not platform.is_active:
            return jsonify({'error': 'Platform not found or inactive'}), 404

        data = request.get_json() or {}
        desired_has_account = data.get('has_account', True)
        account_name = data.get('account_name')
        current_balance = data.get('current_balance')

        # Buscar conta existente
        account = Account.query.filter_by(user_id=user_id, platform_id=platform_id).first()

        # Criar se não existe e desejado ter conta
        if not account and desired_has_account:
            account = Account(
                user_id=user_id,
                platform_id=platform_id,
                account_name=account_name or platform.display_name,
                current_balance=current_balance or 0.0,
                has_account=True,
                is_active=True,
            )
            db.session.add(account)
        elif account:
            # Atualizar
            if account_name is not None:
                account.account_name = account_name
            if current_balance is not None and current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
                account.current_balance = float(current_balance)
            account.has_account = bool(desired_has_account)
            account.is_active = bool(desired_has_account)

        db.session.commit()

        return jsonify({'account': account.to_dict() if account else None}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@planilhas_bp.route('/user/<int:user_id>/close-day', methods=['POST'])
@login_required
def close_day(user_id):
    """Fechar o dia: grava o saldo atual de todas as contas ativas no histórico,
    para uso como 'banca anterior' no dia seguinte."""
    try:
        current_user = User.query.get(session['user_id'])
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403

        accounts = Account.query.filter_by(user_id=user_id, is_active=True).all()
        for acc in accounts:
            history = BalanceHistory(
                account_id=acc.id,
                old_balance=acc.current_balance,
                new_balance=acc.current_balance,
                change_reason='close_day',
                notes='Fechamento diário automático',
                changed_by=current_user.id,
            )
            db.session.add(history)
            # Atualiza timestamp de última atualização
            acc.last_balance_update = datetime.utcnow()

        db.session.commit()
        
        # Notificar via SSE sobre fechamento do dia
        try:
            from src.routes.sse import notify_dashboard_refresh
            notify_dashboard_refresh()  # Atualizar dashboards após close_day
        except Exception as e:
            # Não falhar se SSE não funcionar
            pass
        
        return jsonify({'message': 'Dia fechado com sucesso'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/account/<int:account_id>/update-balance', methods=['PUT'])
@login_required
def update_account_balance(account_id):
    """Atualizar saldo de uma conta"""
    try:
        current_user = User.query.get(session['user_id'])
        account = Account.query.get(account_id)
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != account.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        if 'current_balance' not in data:
            return jsonify({'error': 'current_balance is required'}), 400
        
        new_balance = float(data['current_balance'])
        if new_balance < 0:
            return jsonify({'error': 'Balance cannot be negative'}), 400
        
        old_balance = float(account.current_balance)
        
        # Criar registro no histórico
        history = BalanceHistory(
            account_id=account_id,
            old_balance=old_balance,
            new_balance=new_balance,
            change_reason='manual_update',
            notes=data.get('notes', ''),
            changed_by=current_user.id
        )
        
        # Atualizar conta
        account.current_balance = new_balance
        account.last_balance_update = datetime.utcnow()
        account.balance_verified = data.get('verified', False)
        
        # Atualizar status baseado no saldo
        if not account.has_account:
            account.status = AccountStatus.INACTIVE
        elif new_balance == 0:
            account.status = AccountStatus.ZEROED
        elif account.pnl > 0:
            account.status = AccountStatus.PROFIT
        elif account.pnl < 0:
            account.status = AccountStatus.LOSS
        else:
            account.status = AccountStatus.ACTIVE
        
        db.session.add(history)
        db.session.commit()
        
        # Notificar via SSE sobre atualização de saldo
        try:
            from src.routes.sse import notify_balance_updated, notify_dashboard_refresh
            notify_balance_updated(account.user_id, account_id, old_balance, new_balance)
            notify_dashboard_refresh()  # Atualizar dashboards
        except Exception as e:
            # Não falhar se SSE não funcionar
            pass
        
        return jsonify({
            'message': 'Balance updated successfully',
            'account': account.to_dict(),
            'history': history.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/account/<int:account_id>/toggle-account', methods=['PUT'])
@login_required
def toggle_account_status(account_id):
    """Ativar/desativar se o jogador tem conta na plataforma"""
    try:
        current_user = User.query.get(session['user_id'])
        account = Account.query.get(account_id)
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != account.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        has_account = bool(data.get('has_account', not account.has_account))
        
        old_status = account.has_account
        account.has_account = has_account
        
        # Se está ativando a conta pela primeira vez, definir banca inicial
        if has_account and not old_status and data.get('initial_balance') is not None:
            account.initial_balance = float(data['initial_balance'])
        
        # Se está desativando, zerar valores
        if not has_account:
            account.current_balance = 0
            account.initial_balance = 0
            account.status = AccountStatus.INACTIVE
        
        # Criar registro no histórico se necessário
        if old_status != has_account:
            history = BalanceHistory(
                account_id=account_id,
                old_balance=0,
                new_balance=float(account.current_balance),
                change_reason='account_status_change',
                notes=f"Conta {'ativada' if has_account else 'desativada'} por {current_user.full_name}",
                changed_by=current_user.id
            )
            db.session.add(history)
        
        db.session.commit()
        
        return jsonify({
            'message': f"Account {'activated' if has_account else 'deactivated'} successfully",
            'account': account.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/overview', methods=['GET'])
@login_required
def get_all_players_overview():
    """Visão geral de todos os jogadores (para gestores)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver overview geral
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar todos os jogadores ativos
        players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).all()
        
        players_data = []
        total_team_balance = 0
        total_team_pnl = 0
        
        for player in players:
            # Buscar contas do jogador
            accounts = Account.query.filter_by(user_id=player.id, is_active=True).all()
            
            # Calcular totais do jogador
            player_current_balance = sum(float(acc.current_balance) for acc in accounts)
            player_pnl = sum(acc.pnl for acc in accounts)
            
            total_team_balance += player_current_balance
            total_team_pnl += player_pnl
            
            # Verificar pendências
            pending_reloads = ReloadRequest.query.filter_by(
                user_id=player.id, status='pending'
            ).count()
            
            pending_withdrawals = WithdrawalRequest.query.filter_by(
                user_id=player.id, status='pending'
            ).count()
            
            incomplete_data = PlayerData.query.filter_by(
                user_id=player.id, is_required=True, is_complete=False
            ).count()
            
            # Determinar status
            status = 'complete'
            if incomplete_data > 0:
                status = 'pending'
            if pending_reloads > 0 or pending_withdrawals > 0:
                status = 'critical'
            
            # Última atualização
            last_update = None
            for account in accounts:
                if account.last_balance_update:
                    if not last_update or account.last_balance_update > last_update:
                        last_update = account.last_balance_update
            
            players_data.append({
                'user': player.to_dict(),
                'status': status,
                'current_balance': player_current_balance,
                'pnl': player_pnl,
                'accounts_count': len(accounts),
                'active_accounts': len([acc for acc in accounts if acc.has_account]),
                'pending_reloads': pending_reloads,
                'pending_withdrawals': pending_withdrawals,
                'incomplete_data': incomplete_data,
                'last_update': last_update.isoformat() if last_update else None,
                'needs_attention': status in ['pending', 'critical']
            })
        
        # Estatísticas do time
        team_stats = {
            'total_players': len(players),
            'total_balance': total_team_balance,
            'total_pnl': total_team_pnl,
            'players_with_issues': len([p for p in players_data if p['needs_attention']]),
            'total_pending_reloads': sum(p['pending_reloads'] for p in players_data),
            'total_pending_withdrawals': sum(p['pending_withdrawals'] for p in players_data)
        }
        
        return jsonify({
            'team_stats': team_stats,
            'players': players_data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/account/<int:account_id>/history', methods=['GET'])
@login_required
def get_account_history(account_id):
    """Obter histórico de alterações de uma conta"""
    try:
        current_user = User.query.get(session['user_id'])
        account = Account.query.get(account_id)
        
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != account.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Parâmetros de paginação
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Buscar histórico
        history_query = BalanceHistory.query.filter_by(account_id=account_id)\
            .order_by(BalanceHistory.created_at.desc())
        
        history_paginated = history_query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'account': account.to_dict(),
            'history': [item.to_dict() for item in history_paginated.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': history_paginated.total,
                'pages': history_paginated.pages,
                'has_next': history_paginated.has_next,
                'has_prev': history_paginated.has_prev
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/fields', methods=['GET'])
@login_required
def get_fields():
    """Obter campos configurados da planilha"""
    try:
        fields = RequiredField.query.filter_by(is_active=True).order_by(RequiredField.order).all()
        return jsonify({'fields': [field.to_dict() for field in fields]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/fields', methods=['POST'])
@admin_required
def create_field():
    """Criar novo campo na planilha (apenas admin)"""
    try:
        current_user = User.query.get(session['user_id'])
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Only admins can create fields'}), 403
        
        data = request.get_json()
        
        # Validar campos obrigatórios
        required = ['field_name', 'field_label', 'field_type']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verificar se campo já existe
        existing = RequiredField.query.filter_by(field_name=data['field_name']).first()
        if existing:
            return jsonify({'error': 'Field already exists'}), 400
        
        # Criar novo campo
        new_field = RequiredField(
            field_name=data['field_name'],
            field_label=data['field_label'],
            field_type=data['field_type'],
            field_category=data.get('field_category', 'other'),
            placeholder=data.get('placeholder', ''),
            validation_regex=data.get('validation_regex'),
            is_required=data.get('is_required', True),
            order=data.get('order', 0),
            options=json.dumps(data.get('options', [])) if data.get('options') else None,
            created_by=current_user.id
        )
        
        db.session.add(new_field)
        db.session.commit()
        
        return jsonify({
            'message': 'Field created successfully',
            'field': new_field.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/fields/<int:field_id>', methods=['PUT'])
@admin_required
def update_field(field_id):
    """Atualizar campo existente (apenas admin)"""
    try:
        current_user = User.query.get(session['user_id'])
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Only admins can update fields'}), 403
        
        field = RequiredField.query.get(field_id)
        if not field:
            return jsonify({'error': 'Field not found'}), 404
        
        data = request.get_json()
        
        # Atualizar campos permitidos
        if 'field_label' in data:
            field.field_label = data['field_label']
        if 'placeholder' in data:
            field.placeholder = data['placeholder']
        if 'validation_regex' in data:
            field.validation_regex = data['validation_regex']
        if 'is_required' in data:
            field.is_required = bool(data['is_required'])
        if 'is_active' in data:
            field.is_active = bool(data['is_active'])
        if 'order' in data:
            field.order = int(data['order'])
        if 'options' in data:
            field.options = json.dumps(data['options'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Field updated successfully',
            'field': field.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/user/<int:user_id>/fields', methods=['GET'])
@login_required
def get_user_field_values(user_id):
    """Obter valores dos campos preenchidos pelo usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Obter todos os campos ativos
        fields = RequiredField.query.filter_by(is_active=True).order_by(RequiredField.order).all()
        
        # Obter valores preenchidos
        values = PlayerFieldValue.query.filter_by(user_id=user_id).all()
        values_dict = {v.field_id: v for v in values}
        
        # Combinar campos com valores
        result = []
        for field in fields:
            field_data = field.to_dict()
            if field.id in values_dict:
                value = values_dict[field.id]
                field_data['value'] = value.field_value
                field_data['is_verified'] = value.is_verified
                field_data['updated_at'] = value.updated_at.isoformat() if value.updated_at else None
            else:
                field_data['value'] = None
                field_data['is_verified'] = False
                field_data['updated_at'] = None
            result.append(field_data)
        
        return jsonify({'fields': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/user/<int:user_id>/field', methods=['PUT'])
@login_required
def update_user_field_value(user_id):
    """Atualizar valor de um campo do usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas o próprio usuário ou admin pode editar
        if current_user.id != user_id and current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        if 'field_id' not in data:
            return jsonify({'error': 'field_id is required'}), 400
        
        field_id = data['field_id']
        field_value = data.get('value', '')
        
        # Verificar se o campo existe e está ativo
        field = RequiredField.query.filter_by(id=field_id, is_active=True).first()
        if not field:
            return jsonify({'error': 'Field not found or inactive'}), 404
        
        # Buscar ou criar valor
        value_obj = PlayerFieldValue.query.filter_by(
            user_id=user_id,
            field_id=field_id
        ).first()
        
        if not value_obj:
            value_obj = PlayerFieldValue(
                user_id=user_id,
                field_id=field_id
            )
            db.session.add(value_obj)
        
        # Atualizar valor
        value_obj.field_value = field_value
        value_obj.updated_by = current_user.id
        value_obj.updated_at = datetime.utcnow()
        
        # Admin pode verificar o campo
        if current_user.role == UserRole.ADMIN and 'is_verified' in data:
            value_obj.is_verified = bool(data['is_verified'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'Field value updated successfully',
            'field': value_obj.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@planilhas_bp.route('/user/<int:user_id>/completeness', methods=['GET'])
@login_required
def get_user_completeness(user_id):
    """Calcular completude da planilha do usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Campos obrigatórios
        required_fields = RequiredField.query.filter_by(
            is_required=True,
            is_active=True
        ).all()
        
        if not required_fields:
            return jsonify({
                'completeness': 100,
                'status': 'complete',
                'pending_fields': [],
                'has_pending_requests': False
            }), 200
        
        # Valores preenchidos
        filled_values = PlayerFieldValue.query.filter(
            PlayerFieldValue.user_id == user_id,
            PlayerFieldValue.field_id.in_([f.id for f in required_fields]),
            PlayerFieldValue.field_value != None,
            PlayerFieldValue.field_value != ''
        ).all()
        
        filled_field_ids = {v.field_id for v in filled_values}
        
        # Calcular pendências
        pending_fields = []
        for field in required_fields:
            if field.id not in filled_field_ids:
                pending_fields.append({
                    'field_name': field.field_name,
                    'field_label': field.field_label
                })
        
        completeness = (len(filled_field_ids) / len(required_fields)) * 100
        
        # Verificar solicitações pendentes
        has_pending_requests = db.session.query(
            db.exists().where(
                db.or_(
                    db.and_(
                        ReloadRequest.user_id == user_id,
                        ReloadRequest.status == 'pending'
                    ),
                    db.and_(
                        WithdrawalRequest.user_id == user_id,
                        WithdrawalRequest.status == 'pending'
                    )
                )
            )
        ).scalar()
        
        # Determinar status (verde ou vermelho)
        if completeness == 100 and not has_pending_requests:
            status = 'complete'  # Verde
        else:
            status = 'critical'  # Vermelho
        
        return jsonify({
            'completeness': round(completeness, 2),
            'status': status,
            'pending_fields': pending_fields,
            'has_pending_requests': has_pending_requests
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
