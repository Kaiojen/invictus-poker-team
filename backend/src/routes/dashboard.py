from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta
from sqlalchemy import func, and_, desc
from src.models.models import db, User, Account, ReloadRequest, Transaction, PlayerData, UserRole, ReloadStatus, TransactionType, BalanceHistory
from src.routes.auth import login_required

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/manager', methods=['GET'])
@login_required
def get_manager_dashboard():
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem acessar
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Estatísticas gerais
        total_players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).count()
        
        # Contar TODAS as solicitações pendentes (reload + withdrawal)
        pending_reload_requests = ReloadRequest.query.filter_by(status=ReloadStatus.PENDING).count()
        
        from src.models.models import WithdrawalRequest, WithdrawalStatus
        pending_withdrawal_requests = WithdrawalRequest.query.filter_by(status=WithdrawalStatus.PENDING).count()
        
        pending_requests = pending_reload_requests + pending_withdrawal_requests
        
        # Jogadores com pendências - OTIMIZADO com joins
        players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).all()
        player_ids = [p.id for p in players]
        
        # Buscar dados incompletos de todos os players em uma query
        incomplete_data_counts = db.session.query(
            PlayerData.user_id,
            func.count(PlayerData.id).label('count')
        ).filter(
            PlayerData.user_id.in_(player_ids),
            PlayerData.is_required == True,
            PlayerData.is_complete == False
        ).group_by(PlayerData.user_id).all()
        
        incomplete_by_user = {row.user_id: row.count for row in incomplete_data_counts}
        
        # Buscar reload requests pendentes de todos os players em uma query
        pending_reload_counts = db.session.query(
            ReloadRequest.user_id,
            func.count(ReloadRequest.id).label('count')
        ).filter(
            ReloadRequest.user_id.in_(player_ids),
            ReloadRequest.status == ReloadStatus.PENDING
        ).group_by(ReloadRequest.user_id).all()
        
        pending_by_user = {row.user_id: row.count for row in pending_reload_counts}
        
        # Construir lista de players
        players_with_pending_data = []
        for player in players:
            incomplete_data = incomplete_by_user.get(player.id, 0)
            pending_reload_requests = pending_by_user.get(player.id, 0)
            
            status = 'complete'
            if incomplete_data > 0:
                status = 'pending'
            if pending_reload_requests > 0:
                status = 'critical'
            
            players_with_pending_data.append({
                'id': player.id,
                'full_name': player.full_name,
                'username': player.username,
                'status': status,
                'incomplete_data_count': incomplete_data,
                'pending_requests_count': pending_reload_requests,
                'last_activity': player.updated_at.isoformat() if player.updated_at else None
            })
        
        # Solicitações de reload recentes
        recent_requests = ReloadRequest.query.filter_by(status=ReloadStatus.PENDING)\
            .order_by(ReloadRequest.created_at.desc()).limit(10).all()
        
        # Transações recentes
        recent_transactions = Transaction.query\
            .order_by(Transaction.created_at.desc()).limit(10).all()
        
        # Resumo financeiro (últimos 30 dias) – alinhado com gráfico
        end_date = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        thirty_days_ago = end_date - timedelta(days=29)  # 30 dias incluindo hoje

        financial_summary = {
            'total_reloads': 0,
            'total_withdrawals': 0,
            'total_profits': 0,
            'total_losses': 0,
            'net_result': 0,
            'monthly_profit_chart_aligned': 0
        }

        # Mantém estatísticas por tipo para cards gerais
        transactions_last_30_days = Transaction.query.filter(
            Transaction.created_at >= thirty_days_ago
        ).all()

        for transaction in transactions_last_30_days:
            amount = float(transaction.amount)
            if transaction.transaction_type == TransactionType.RELOAD:
                financial_summary['total_reloads'] += amount
            elif transaction.transaction_type == TransactionType.WITHDRAWAL:
                financial_summary['total_withdrawals'] += amount
            elif transaction.transaction_type == TransactionType.PROFIT:
                financial_summary['total_profits'] += amount
            elif transaction.transaction_type == TransactionType.LOSS:
                financial_summary['total_losses'] += amount

        financial_summary['net_result'] = financial_summary['total_profits'] - financial_summary['total_losses']

        # Cálculo do lucro mensal alinhado ao gráfico: soma de deltas do BalanceHistory do período
        rows = db.session.query(
            func.sum(BalanceHistory.new_balance - BalanceHistory.old_balance)
        ).filter(
            BalanceHistory.created_at >= thirty_days_ago,
            BalanceHistory.created_at <= end_date,
            BalanceHistory.change_reason == 'close_day'
        ).scalar() or 0.0
        financial_summary['monthly_profit_chart_aligned'] = float(rows)
        
        return jsonify({
            'statistics': {
                'total_players': total_players,
                'pending_requests': pending_requests,
                'pending_reload_requests': pending_reload_requests,
                'pending_withdrawal_requests': pending_withdrawal_requests,
                'players_with_issues': len([p for p in players_with_pending_data if p['status'] != 'complete'])
            },
            'players': players_with_pending_data,
            'recent_requests': [req.to_dict() for req in recent_requests],
            'recent_transactions': [trans.to_dict() for trans in recent_transactions],
            'financial_summary': financial_summary
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/player', methods=['GET'])
@login_required
def get_player_dashboard():
    try:
        current_user = User.query.get(session['user_id'])
        user_id = request.args.get('user_id', type=int)
        
        # Determinar qual usuário buscar
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            target_user = User.query.get(user_id)
        else:
            target_user = current_user
        
        if not target_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Contas do jogador
        accounts = Account.query.filter_by(user_id=target_user.id, is_active=True).all()
        
        # Dados do jogador
        player_data = PlayerData.query.filter_by(user_id=target_user.id).all()
        incomplete_data = [data for data in player_data if data.is_required and not data.is_complete]
        
        # Solicitações de reload
        reload_requests = ReloadRequest.query.filter_by(user_id=target_user.id)\
            .order_by(ReloadRequest.created_at.desc()).limit(10).all()
        
        pending_requests = [req for req in reload_requests if req.status == ReloadStatus.PENDING]
        
        # Transações recentes
        recent_transactions = Transaction.query.filter_by(user_id=target_user.id)\
            .order_by(Transaction.created_at.desc()).limit(10).all()
        
        # Resumo financeiro pessoal (últimos 30 dias)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        personal_summary = {
            'total_reloads': 0,
            'total_withdrawals': 0,
            'total_profits': 0,
            'total_losses': 0,
            'net_result': 0,
            'current_total_balance': 0
        }
        
        # Calcular saldo total atual
        for account in accounts:
            personal_summary['current_total_balance'] += float(account.current_balance)
        
        # Calcular resumo dos últimos 30 dias
        personal_transactions = Transaction.query.filter(
            Transaction.user_id == target_user.id,
            Transaction.created_at >= thirty_days_ago
        ).all()
        
        for transaction in personal_transactions:
            amount = float(transaction.amount)
            if transaction.transaction_type == TransactionType.RELOAD:
                personal_summary['total_reloads'] += amount
            elif transaction.transaction_type == TransactionType.WITHDRAWAL:
                personal_summary['total_withdrawals'] += amount
            elif transaction.transaction_type == TransactionType.PROFIT:
                personal_summary['total_profits'] += amount
            elif transaction.transaction_type == TransactionType.LOSS:
                personal_summary['total_losses'] += amount
        
        personal_summary['net_result'] = personal_summary['total_profits'] - personal_summary['total_losses']
        
        # Status geral do jogador
        player_status = 'complete'
        if len(incomplete_data) > 0:
            player_status = 'pending'
        if len(pending_requests) > 0:
            player_status = 'critical'
        
        return jsonify({
            'user': target_user.to_dict(),
            'status': player_status,
            'accounts': [account.to_dict() for account in accounts],
            'incomplete_data': [data.to_dict() for data in incomplete_data],
            'pending_requests': [req.to_dict() for req in pending_requests],
            'recent_requests': [req.to_dict() for req in reload_requests],
            'recent_transactions': [trans.to_dict() for trans in recent_transactions],
            'financial_summary': personal_summary
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/statistics', methods=['GET'])
@login_required
def get_statistics():
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver estatísticas gerais
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Parâmetros de filtro
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Definir período padrão (últimos 30 dias)
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid date format'}), 400
        
        # Estatísticas de usuários
        total_users = User.query.filter_by(is_active=True).count()
        total_players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).count()
        total_managers = User.query.filter(
            User.role.in_([UserRole.ADMIN, UserRole.MANAGER]),
            User.is_active == True
        ).count()
        
        # Estatísticas de solicitações
        total_requests = ReloadRequest.query.filter(
            ReloadRequest.created_at >= start_dt,
            ReloadRequest.created_at <= end_dt
        ).count()
        
        approved_requests = ReloadRequest.query.filter(
            ReloadRequest.created_at >= start_dt,
            ReloadRequest.created_at <= end_dt,
            ReloadRequest.status == ReloadStatus.APPROVED
        ).count()
        
        rejected_requests = ReloadRequest.query.filter(
            ReloadRequest.created_at >= start_dt,
            ReloadRequest.created_at <= end_dt,
            ReloadRequest.status == ReloadStatus.REJECTED
        ).count()
        
        pending_requests = ReloadRequest.query.filter_by(status=ReloadStatus.PENDING).count()
        
        # Estatísticas financeiras
        transactions = Transaction.query.filter(
            Transaction.created_at >= start_dt,
            Transaction.created_at <= end_dt
        ).all()
        
        financial_stats = {
            'total_transactions': len(transactions),
            'total_reloads': 0,
            'total_withdrawals': 0,
            'total_profits': 0,
            'total_losses': 0,
            'net_result': 0
        }
        
        for transaction in transactions:
            amount = float(transaction.amount)
            if transaction.transaction_type == TransactionType.RELOAD:
                financial_stats['total_reloads'] += amount
            elif transaction.transaction_type == TransactionType.WITHDRAWAL:
                financial_stats['total_withdrawals'] += amount
            elif transaction.transaction_type == TransactionType.PROFIT:
                financial_stats['total_profits'] += amount
            elif transaction.transaction_type == TransactionType.LOSS:
                financial_stats['total_losses'] += amount
        
        financial_stats['net_result'] = financial_stats['total_profits'] - financial_stats['total_losses']
        
        # Saldo total atual de todas as contas
        total_balance = db.session.query(func.sum(Account.current_balance)).filter_by(is_active=True).scalar() or 0
        
        return jsonify({
            'period': {
                'start_date': start_date,
                'end_date': end_date
            },
            'user_stats': {
                'total_users': total_users,
                'total_players': total_players,
                'total_managers': total_managers
            },
            'request_stats': {
                'total_requests': total_requests,
                'approved_requests': approved_requests,
                'rejected_requests': rejected_requests,
                'pending_requests': pending_requests,
                'approval_rate': (approved_requests / total_requests * 100) if total_requests > 0 else 0
            },
            'financial_stats': financial_stats,
            'current_total_balance': float(total_balance)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/team-financials', methods=['GET'])
@login_required
def get_team_financials():
    """Endpoint para dados financeiros detalhados do time (para admin/manager)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem acessar
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar todos os jogadores
        players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).all()
        player_ids = [p.id for p in players]
        
        # Período (últimos 30 dias) - alinhado com o gráfico
        end_date = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        thirty_days_ago = end_date - timedelta(days=29)  # 30 dias incluindo hoje
        
        # OTIMIZAR: Buscar todos os dados necessários em queries agrupadas
        
        # 1. Contas agrupadas por usuário
        accounts_by_user = db.session.query(
            Account.user_id,
            func.sum(Account.current_balance).label('total_balance'),
            func.count(Account.id).label('account_count')
        ).filter(
            Account.user_id.in_(player_ids),
            Account.is_active == True
        ).group_by(Account.user_id).all()
        
        balance_by_user = {row.user_id: {'balance': float(row.total_balance), 'count': row.account_count} for row in accounts_by_user}
        
        # 2. Dados incompletos agrupados por usuário
        incomplete_data_counts = db.session.query(
            PlayerData.user_id,
            func.count(PlayerData.id).label('count')
        ).filter(
            PlayerData.user_id.in_(player_ids),
            PlayerData.is_required == True,
            PlayerData.is_complete == False
        ).group_by(PlayerData.user_id).all()
        
        incomplete_by_user = {row.user_id: row.count for row in incomplete_data_counts}
        
        # 3. Reload requests pendentes agrupados por usuário
        pending_reload_counts = db.session.query(
            ReloadRequest.user_id,
            func.count(ReloadRequest.id).label('count')
        ).filter(
            ReloadRequest.user_id.in_(player_ids),
            ReloadRequest.status == ReloadStatus.PENDING
        ).group_by(ReloadRequest.user_id).all()
        
        pending_by_user = {row.user_id: row.count for row in pending_reload_counts}
        
        # 4. Transações mensais agrupadas por usuário
        monthly_transactions = db.session.query(
            Transaction.user_id,
            Transaction.transaction_type,
            func.sum(Transaction.amount).label('total_amount')
        ).filter(
            Transaction.user_id.in_(player_ids),
            Transaction.created_at >= thirty_days_ago,
            Transaction.transaction_type.in_([TransactionType.PROFIT, TransactionType.LOSS])
        ).group_by(Transaction.user_id, Transaction.transaction_type).all()
        
        profit_by_user = {}
        for row in monthly_transactions:
            if row.user_id not in profit_by_user:
                profit_by_user[row.user_id] = 0
            amount = float(row.total_amount)
            if row.transaction_type == TransactionType.PROFIT:
                profit_by_user[row.user_id] += amount
            elif row.transaction_type == TransactionType.LOSS:
                profit_by_user[row.user_id] -= amount
        
        # Calcular estatísticas
        total_balance = sum(data['balance'] for data in balance_by_user.values())
        pending_reloads = sum(pending_by_user.values())
        active_players = len(balance_by_user)
        monthly_profit = sum(profit_by_user.values())
        
        # Construir dados dos players
        players_data = []
        for player in players:
            balance_data = balance_by_user.get(player.id, {'balance': 0, 'count': 0})
            incomplete_data = incomplete_by_user.get(player.id, 0)
            pending_reload_requests = pending_by_user.get(player.id, 0)
            player_monthly_profit = profit_by_user.get(player.id, 0)
            
            # Determinar status do jogador
            status = 'complete'
            if incomplete_data > 0:
                status = 'pending'
            if pending_reload_requests > 0:
                status = 'critical'
            
            players_data.append({
                'id': player.id,
                'full_name': player.full_name,
                'username': player.username,
                'status': status,
                'totalBalance': balance_data['balance'],
                'accountCount': balance_data['count'],
                'pendingCount': incomplete_data + pending_reload_requests,
                'monthlyProfit': player_monthly_profit,
                'last_activity': player.updated_at.isoformat() if player.updated_at else None
            })
        
        # Organizar jogadores por status (crítico primeiro)
        players_data.sort(key=lambda x: {
            'critical': 0,
            'pending': 1,
            'complete': 2
        }.get(x['status'], 3))

        # Alinhar o lucro mensal com o gráfico (BalanceHistory)
        monthly_profit_aligned = db.session.query(
            func.sum(BalanceHistory.new_balance - BalanceHistory.old_balance)
        ).filter(
            BalanceHistory.created_at >= thirty_days_ago,
            BalanceHistory.created_at <= end_date,
            BalanceHistory.change_reason == 'close_day'
        ).scalar() or 0.0
        monthly_profit = float(monthly_profit_aligned)
        
        return jsonify({
            'totalBalance': total_balance,
            'monthlyProfit': monthly_profit,
            'pendingReloads': pending_reloads,
            'activePlayers': active_players,
            'players': players_data,
            'summary': {
                'totalPlayers': len(players),
                'playersWithIssues': len([p for p in players_data if p['status'] != 'complete']),
                'averageBalance': total_balance / len(players) if players else 0,
                'teamPerformance': 'excellent' if monthly_profit > 0 else 'needs_attention'
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/team-pnl-series', methods=['GET'])
@login_required
def get_team_pnl_series():
    """Série diária de P&L do time baseada em TODAS as mudanças de BalanceHistory."""
    try:
        current_user = User.query.get(session['user_id'])
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403

        days = request.args.get('days', default=30, type=int)
        end_date = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        start_date = end_date - timedelta(days=days - 1)

        # ✅ CORRIGIDO: Buscar TODAS as mudanças de saldo, não só 'close_day'
        # Isso incluirá todas as atualizações de planilha em tempo real
        rows = db.session.query(
            func.date(BalanceHistory.created_at).label('d'),
            func.sum(BalanceHistory.new_balance - BalanceHistory.old_balance).label('delta')
        ).filter(
            BalanceHistory.created_at >= start_date,
            BalanceHistory.created_at <= end_date
            # ❌ Removido: BalanceHistory.change_reason == 'close_day'
        ).group_by(func.date(BalanceHistory.created_at)).all()

        delta_by_day = {str(r.d): float(r.delta or 0.0) for r in rows}

        series = []
        cursor = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        cumulative = 0.0
        
        # Calcular saldo inicial (antes do período)
        initial_balance = db.session.query(
            func.sum(BalanceHistory.new_balance - BalanceHistory.old_balance)
        ).filter(
            BalanceHistory.created_at < start_date
        ).scalar() or 0.0
        
        cumulative = float(initial_balance)
        
        while cursor <= end_date:
            key = cursor.date().isoformat()
            delta = delta_by_day.get(key, 0.0)
            cumulative += delta
            series.append({'date': key, 'delta': delta, 'cumulative': cumulative})
            cursor += timedelta(days=1)

        return jsonify({'series': series}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/player/details', methods=['GET'])
@login_required
def get_player_dashboard_details():
    """Detalhes do dashboard do jogador (rota separada para evitar conflito com /player)"""
    try:
        current_user = User.query.get(session['user_id'])
        days = int(request.args.get('days', 30))
        
        # Data de início do período
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Buscar contas do jogador
        accounts = Account.query.filter_by(user_id=current_user.id).all()
        
        # Calcular P&L por conta
        accounts_data = []
        for account in accounts:
            pnl = float(account.current_balance) - float(account.initial_balance) if account.initial_balance else float(account.current_balance)
            
            accounts_data.append({
                'id': account.id,
                'platform_name': account.platform.display_name,
                'current_balance': float(account.current_balance),
                'initial_balance': float(account.initial_balance) if account.initial_balance else 0,
                'pnl': pnl,
                'is_active': account.is_active,
                'status': account.status.value if account.status else 'unknown'
            })
        
        # Solicitações de reload pendentes
        pending_reloads = ReloadRequest.query.filter(
            ReloadRequest.user_id == current_user.id,
            ReloadRequest.status == ReloadStatus.PENDING
        ).count()
        
        # Histórico de transações recentes
        recent_transactions = Transaction.query.filter(
            Transaction.user_id == current_user.id,
            Transaction.created_at >= start_date
        ).order_by(desc(Transaction.created_at)).limit(10).all()
        
        transactions_data = []
        for transaction in recent_transactions:
            transactions_data.append({
                'id': transaction.id,
                'type': transaction.transaction_type.value,
                'amount': float(transaction.amount),
                'description': transaction.description,
                'created_at': transaction.created_at.isoformat(),
                'platform_name': transaction.platform.display_name if transaction.platform else None
            })
        
        return jsonify({
            'accounts': accounts_data,
            'pending_reloads': pending_reloads,
            'recent_transactions': transactions_data,
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@dashboard_bp.route('/performance', methods=['GET'])
@login_required
def get_performance_data():
    """Dados de performance detalhados para jogadores"""
    try:
        current_user = User.query.get(session['user_id'])
        days = int(request.args.get('days', 30))
        
        # Data de início do período
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Calcular métricas de performance
        accounts = Account.query.filter_by(user_id=current_user.id).all()
        
        total_initial = sum(float(acc.initial_balance) for acc in accounts if acc.initial_balance)
        total_current = sum(float(acc.current_balance) for acc in accounts)
        total_pnl = total_current - total_initial
        
        # ROI
        monthly_roi = (total_pnl / total_initial * 100) if total_initial > 0 else 0
        
        # Transações do período
        transactions = Transaction.query.filter(
            Transaction.user_id == current_user.id,
            Transaction.created_at >= start_date
        ).all()
        
        # Análise de dias lucrativos
        daily_results = {}
        biggest_win = 0
        biggest_loss = 0
        
        for transaction in transactions:
            date_key = transaction.created_at.date()
            amount = float(transaction.amount)
            
            if date_key not in daily_results:
                daily_results[date_key] = 0
            
            if transaction.transaction_type == TransactionType.PROFIT:
                daily_results[date_key] += amount
                if amount > biggest_win:
                    biggest_win = amount
            elif transaction.transaction_type == TransactionType.LOSS:
                daily_results[date_key] -= amount
                if amount > biggest_loss:
                    biggest_loss = amount
        
        profitable_days = sum(1 for result in daily_results.values() if result > 0)
        
        # Histórico de saldo (últimas alterações)
        balance_history = BalanceHistory.query.filter(
            BalanceHistory.account_id.in_([acc.id for acc in accounts]),
            BalanceHistory.created_at >= start_date
        ).order_by(desc(BalanceHistory.created_at)).limit(20).all()
        
        history_data = []
        for history in balance_history:
            history_data.append({
                'date': history.created_at.isoformat(),
                'old_balance': float(history.old_balance),
                'new_balance': float(history.new_balance),
                'change': float(history.new_balance) - float(history.old_balance),
                'reason': history.change_reason,
                'platform': history.account.platform.display_name if history.account and history.account.platform else None
            })
        
        # Metas fictícias (podem ser configuradas no futuro)
        goals = [
            {
                'name': 'ROI Mensal',
                'target': 10,
                'current': monthly_roi,
                'description': 'Meta de retorno sobre investimento'
            },
            {
                'name': 'Dias Lucrativos',
                'target': 20,
                'current': profitable_days,
                'description': 'Dias com resultado positivo'
            }
        ]
        
        return jsonify({
            'monthly_roi': monthly_roi,
            'profitable_days': profitable_days,
            'biggest_win': biggest_win,
            'biggest_loss': biggest_loss,
            'total_pnl': total_pnl,
            'total_trades': len(transactions),
            'balance_history': history_data,
            'goals': goals,
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

