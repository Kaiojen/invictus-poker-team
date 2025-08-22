from flask import Blueprint, request, jsonify, session
from datetime import datetime, date
from sqlalchemy import func, and_, or_
from ..models.models import (
    db, User, UserRole, Account, ReloadRequest, WithdrawalRequest,
    TeamMonthlySnapshot, Transaction, ReloadStatus
)
from .auth import login_required

team_snapshots_bp = Blueprint('team_snapshots', __name__)

@team_snapshots_bp.route('/monthly', methods=['GET'])
@login_required
def get_monthly_snapshots():
    """Buscar todos os snapshots mensais do time"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem ver snapshots
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Parâmetros de paginação e filtros
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 12, type=int), 100)
        year = request.args.get('year', type=int)
        
        # Query base
        query = TeamMonthlySnapshot.query
        
        # Filtro por ano se especificado
        if year:
            query = query.filter(TeamMonthlySnapshot.year == year)
        
        # Ordenar por ano e mês (mais recente primeiro)
        snapshots = query.order_by(
            TeamMonthlySnapshot.year.desc(),
            TeamMonthlySnapshot.month.desc()
        ).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Formatar anos disponíveis corretamente
        years_query = db.session.query(
            TeamMonthlySnapshot.year
        ).distinct().order_by(TeamMonthlySnapshot.year.desc()).all()
        
        years_available = [year[0] for year in years_query] if years_query else []
        
        return jsonify({
            'snapshots': [s.to_dict() for s in snapshots.items],
            'total': snapshots.total,
            'pages': snapshots.pages,
            'current_page': snapshots.page,
            'per_page': per_page,
            'years_available': years_available
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@team_snapshots_bp.route('/monthly/current', methods=['GET'])
@login_required 
def get_current_month_data():
    """Buscar dados do mês atual (para preview antes de criar snapshot)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Data atual
        now = datetime.now()
        current_month = now.month
        current_year = now.year
        
        # Verificar se já existe snapshot para este mês
        existing_snapshot = TeamMonthlySnapshot.query.filter_by(
            month=current_month,
            year=current_year
        ).first()
        
        # Calcular dados atuais do time
        current_data = calculate_team_data()
        
        return jsonify({
            'current_data': current_data,
            'period': f"{current_year}-{current_month:02d}",
            'has_snapshot': existing_snapshot is not None,
            'existing_snapshot': existing_snapshot.to_dict() if existing_snapshot else None
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@team_snapshots_bp.route('/monthly', methods=['POST'])
@login_required
def create_monthly_snapshot():
    """Criar snapshot mensal do time"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins podem criar snapshots
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Validar dados obrigatórios
        month = data.get('month')
        year = data.get('year')
        
        if not month or not year:
            return jsonify({'error': 'Month and year are required'}), 400
        
        if month < 1 or month > 12:
            return jsonify({'error': 'Month must be between 1 and 12'}), 400
        
        # Verificar se já existe snapshot para este mês/ano
        existing = TeamMonthlySnapshot.query.filter_by(
            month=month,
            year=year
        ).first()
        
        if existing:
            return jsonify({'error': 'Snapshot already exists for this period'}), 400
        
        # Calcular dados do time
        team_data = calculate_team_data()
        
        # Criar snapshot
        snapshot = TeamMonthlySnapshot(
            month=month,
            year=year,
            total_balance=team_data['total_balance'],
            total_pnl=team_data['total_pnl'],
            total_investment=team_data['total_investment'],
            active_players=team_data['active_players'],
            total_accounts=team_data['total_accounts'],
            profitable_players=team_data['profitable_players'],
            players_in_makeup=team_data['players_in_makeup'],
            is_closed=data.get('is_closed', False),
            closed_by=current_user.id,
            notes=data.get('notes', '')
        )
        
        db.session.add(snapshot)
        db.session.commit()
        
        return jsonify({
            'message': 'Monthly snapshot created successfully',
            'snapshot': snapshot.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@team_snapshots_bp.route('/monthly/<int:snapshot_id>', methods=['PUT'])
@login_required
def update_monthly_snapshot(snapshot_id):
    """Atualizar snapshot mensal (apenas notas e status de fechamento)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins podem atualizar snapshots
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Access denied'}), 403
        
        snapshot = TeamMonthlySnapshot.query.get_or_404(snapshot_id)
        data = request.get_json()
        
        # Atualizar campos editáveis
        if 'is_closed' in data:
            snapshot.is_closed = data['is_closed']
            
        if 'notes' in data:
            snapshot.notes = data['notes']
        
        snapshot.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Snapshot updated successfully',
            'snapshot': snapshot.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def calculate_team_data():
    """Calcular dados atuais do time para snapshot"""
    
    # Buscar todos os jogadores ativos
    players = User.query.filter_by(role=UserRole.PLAYER, is_active=True).all()
    
    total_balance = 0
    total_pnl = 0
    total_investment = 0
    active_players = 0
    total_accounts = 0
    profitable_players = 0
    players_in_makeup = 0
    
    for player in players:
        # Buscar contas ativas do jogador
        accounts = Account.query.filter_by(user_id=player.id, is_active=True).all()
        
        if not accounts:
            continue
            
        active_players += 1
        total_accounts += len(accounts)
        
        # Somar saldos atuais
        player_balance = sum(float(acc.current_balance or 0) for acc in accounts)
        total_balance += player_balance
        
        # Somar P&L (excluindo Luxon) - com verificação de segurança
        player_pnl = 0
        for acc in accounts:
            if acc.platform and acc.platform.name.lower() not in ['luxonpay', 'luxon']:
                player_pnl += float(acc.pnl or 0)
        total_pnl += player_pnl
        
        # Calcular investimento total (inicial + reloads aprovados)
        initial_investment = sum(float(acc.initial_balance or 0) for acc in accounts)
        
        approved_reloads = db.session.query(
            func.sum(ReloadRequest.amount)
        ).filter_by(
            user_id=player.id,
            status=ReloadStatus.APPROVED
        ).scalar() or 0
        
        player_investment = initial_investment + float(approved_reloads)
        total_investment += player_investment
        
        # Verificar se está em lucro
        if player_pnl > 0:
            profitable_players += 1
            
        # Verificar se está em makeup (simplificado: P&L negativo)
        if player_pnl < 0:
            players_in_makeup += 1
    
    return {
        'total_balance': total_balance,
        'total_pnl': total_pnl,
        'total_investment': total_investment,
        'active_players': active_players,
        'total_accounts': total_accounts,
        'profitable_players': profitable_players,
        'players_in_makeup': players_in_makeup
    }
