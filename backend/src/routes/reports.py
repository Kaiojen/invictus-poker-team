from flask import Blueprint, request, jsonify, session, make_response
from datetime import datetime, timedelta
from sqlalchemy import func, extract
from src.models.models import User, UserRole, Reta, db, Account, ReloadRequest, ReloadStatus, WithdrawalRequest, WithdrawalStatus
from src.routes.auth import login_required, admin_required
from src.utils.report_generator import get_report_generator
import logging

reports_bp = Blueprint('reports', __name__)
logger = logging.getLogger(__name__)

@reports_bp.route('/player/<int:user_id>', methods=['GET'])
@login_required
def generate_player_report(user_id):
    """Gerar relatório individual de jogador"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        target_user = User.query.get(user_id)
        if not target_user or target_user.role != UserRole.PLAYER:
            return jsonify({'error': 'Player not found'}), 404
        
        # Parâmetros da requisição
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        format_type = request.args.get('format', 'pdf').lower()
        
        # Validar formato
        if format_type not in ['pdf', 'csv']:
            return jsonify({'error': 'Format must be pdf or csv'}), 400
        
        # Processar datas
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)  # Padrão: últimos 30 dias
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
                end_date = end_date.replace(hour=23, minute=59, second=59)  # Fim do dia
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
        
        # Validar período
        if start_date >= end_date:
            return jsonify({'error': 'Start date must be before end date'}), 400
        
        if (end_date - start_date).days > 365:
            return jsonify({'error': 'Period cannot exceed 365 days'}), 400
        
        # Gerar relatório
        report_generator = get_report_generator()
        report_data, filename = report_generator.generate_player_report(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            format_type=format_type
        )
        
        # Log da operação
        from src.routes.audit import log_action
        log_action(
            user_id=current_user.id,
            action='player_report_generated',
            entity_type='Report',
            entity_id=user_id,
            old_values=None,
            new_values=f"Relatório {format_type.upper()} do jogador {target_user.full_name} ({start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')})",
            request_obj=request
        )
        
        # Preparar resposta
        response = make_response(report_data)
        
        if format_type == 'pdf':
            response.headers['Content-Type'] = 'application/pdf'
        else:
            response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório do jogador: {str(e)}")
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/team', methods=['GET'])
@login_required
def generate_team_report():
    """Gerar relatório consolidado do time"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem gerar relatórios do time
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Parâmetros da requisição
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        reta_id = request.args.get('reta_id', type=int)
        format_type = request.args.get('format', 'pdf').lower()
        
        # Validar formato
        if format_type not in ['pdf', 'csv']:
            return jsonify({'error': 'Format must be pdf or csv'}), 400
        
        # Verificar se reta existe (se especificada)
        if reta_id:
            reta = Reta.query.get(reta_id)
            if not reta:
                return jsonify({'error': 'Reta not found'}), 404
        
        # Processar datas
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)  # Padrão: últimos 30 dias
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
                end_date = end_date.replace(hour=23, minute=59, second=59)  # Fim do dia
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
        
        # Validar período
        if start_date >= end_date:
            return jsonify({'error': 'Start date must be before end date'}), 400
        
        if (end_date - start_date).days > 365:
            return jsonify({'error': 'Period cannot exceed 365 days'}), 400
        
        # Gerar relatório
        report_generator = get_report_generator()
        report_data, filename = report_generator.generate_team_report(
            start_date=start_date,
            end_date=end_date,
            reta_id=reta_id,
            format_type=format_type
        )
        
        # Log da operação
        from src.routes.audit import log_action
        reta_filter = f" - Reta {reta_id}" if reta_id else ""
        log_action(
            user_id=current_user.id,
            action='team_report_generated',
            entity_type='Report',
            entity_id=0,
            old_values=None,
            new_values=f"Relatório {format_type.upper()} do time{reta_filter} ({start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')})",
            request_obj=request
        )
        
        # Preparar resposta
        response = make_response(report_data)
        
        if format_type == 'pdf':
            response.headers['Content-Type'] = 'application/pdf'
        else:
            response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório do time: {str(e)}")
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/reta/<int:reta_id>', methods=['GET'])
@login_required
def generate_reta_report(reta_id):
    """Gerar relatório específico de uma reta"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins e managers podem gerar relatórios de reta
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Verificar se reta existe
        reta = Reta.query.get(reta_id)
        if not reta:
            return jsonify({'error': 'Reta not found'}), 404
        
        # Parâmetros da requisição
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        format_type = request.args.get('format', 'pdf').lower()
        
        # Validar formato
        if format_type not in ['pdf', 'csv']:
            return jsonify({'error': 'Format must be pdf or csv'}), 400
        
        # Processar datas
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)  # Padrão: últimos 30 dias
        
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
        
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
                end_date = end_date.replace(hour=23, minute=59, second=59)  # Fim do dia
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
        
        # Validar período
        if start_date >= end_date:
            return jsonify({'error': 'Start date must be before end date'}), 400
        
        if (end_date - start_date).days > 365:
            return jsonify({'error': 'Period cannot exceed 365 days'}), 400
        
        # Gerar relatório
        report_generator = get_report_generator()
        report_data, filename = report_generator.generate_reta_report(
            reta_id=reta_id,
            start_date=start_date,
            end_date=end_date,
            format_type=format_type
        )
        
        # Log da operação
        from src.routes.audit import log_action
        log_action(
            user_id=current_user.id,
            action='reta_report_generated',
            entity_type='Report',
            entity_id=reta_id,
            old_values=None,
            new_values=f"Relatório {format_type.upper()} da {reta.name} ({start_date.strftime('%Y-%m-%d')} a {end_date.strftime('%Y-%m-%d')})",
            request_obj=request
        )
        
        # Preparar resposta
        response = make_response(report_data)
        
        if format_type == 'pdf':
            response.headers['Content-Type'] = 'application/pdf'
        else:
            response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório da reta: {str(e)}")
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/available', methods=['GET'])
@login_required
def get_available_reports():
    """Listar tipos de relatórios disponíveis para o usuário"""
    try:
        current_user = User.query.get(session['user_id'])
        
        available_reports = []
        
        # Relatório individual (todos podem gerar o próprio)
        available_reports.append({
            'type': 'player',
            'name': 'Relatório Individual',
            'description': 'Relatório detalhado de um jogador específico',
            'formats': ['pdf', 'csv'],
            'permissions': ['own'] if current_user.role == UserRole.PLAYER else ['own', 'all']
        })
        
        # Relatórios administrativos
        if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
            available_reports.extend([
                {
                    'type': 'team',
                    'name': 'Relatório do Time',
                    'description': 'Relatório consolidado de todo o time ou reta específica',
                    'formats': ['pdf', 'csv'],
                    'permissions': ['all']
                },
                {
                    'type': 'reta',
                    'name': 'Relatório por Reta',
                    'description': 'Relatório detalhado de uma reta específica',
                    'formats': ['pdf', 'csv'],
                    'permissions': ['all']
                }
            ])
        
        # Listar retas disponíveis
        retas = Reta.query.filter_by(is_active=True).all()
        
        return jsonify({
            'available_reports': available_reports,
            'available_retas': [reta.to_dict() for reta in retas],
            'date_range_limits': {
                'max_days': 365,
                'default_days': 30
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar relatórios disponíveis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/preview/<report_type>', methods=['GET'])
@login_required
def preview_report_data(report_type):
    """Visualizar dados que serão incluídos no relatório (sem gerar o arquivo)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Parâmetros da requisição
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        user_id = request.args.get('user_id', type=int)
        reta_id = request.args.get('reta_id', type=int)
        
        # Processar datas
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59)
        
        report_generator = get_report_generator()
        
        if report_type == 'player':
            # Verificar permissões
            if not user_id:
                user_id = current_user.id
            
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            
            target_user = User.query.get(user_id)
            if not target_user or target_user.role != UserRole.PLAYER:
                return jsonify({'error': 'Player not found'}), 404
            
            data = report_generator._collect_player_data(target_user, start_date, end_date)
            
            return jsonify({
                'report_type': 'player',
                'player': data['user'].to_dict(),
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                },
                'summary': data['totals'],
                'accounts_count': len(data['accounts']),
                'transactions_count': len(data['balance_history']),
                'reload_requests_count': len(data['reload_requests']),
                'withdrawal_requests_count': len(data['withdrawal_requests'])
            }), 200
        
        elif report_type == 'team':
            # Verificar permissões
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Access denied'}), 403
            
            data = report_generator._collect_team_data(start_date, end_date, reta_id)
            
            return jsonify({
                'report_type': 'team',
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                },
                'reta_filter': reta_id,
                'summary': data['totals'],
                'players_included': len(data['players'])
            }), 200
        
        elif report_type == 'reta':
            # Verificar permissões
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Access denied'}), 403
            
            if not reta_id:
                return jsonify({'error': 'reta_id is required'}), 400
            
            reta = Reta.query.get(reta_id)
            if not reta:
                return jsonify({'error': 'Reta not found'}), 404
            
            data = report_generator._collect_reta_data(reta, start_date, end_date)
            
            return jsonify({
                'report_type': 'reta',
                'reta': data['reta'].to_dict(),
                'period': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                },
                'summary': data['totals'],
                'players_included': len(data['players'])
            }), 200
        
        else:
            return jsonify({'error': 'Invalid report type'}), 400
        
    except Exception as e:
        logger.error(f"Erro ao gerar preview do relatório: {str(e)}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/monthly-detailed', methods=['GET'])
@login_required  
def generate_monthly_detailed_report():
    """Gerar relatório mensal detalhado para substituir snapshots"""
    try:
        current_user = User.query.get(session['user_id'])
        
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Parâmetros
        month = request.args.get('month', type=int) or datetime.now().month
        year = request.args.get('year', type=int) or datetime.now().year
        
        # Data range for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        # 1. TOTAL DE RELOADS DO MÊS
        total_reloads = db.session.query(func.sum(ReloadRequest.amount)).filter(
            ReloadRequest.status == ReloadStatus.APPROVED,
            ReloadRequest.approved_at >= start_date,
            ReloadRequest.approved_at < end_date
        ).scalar() or 0
        
        # 2. TOTAL DE SAQUES DO MÊS
        from src.models.models import WithdrawalRequest, WithdrawalStatus
        total_withdrawals = db.session.query(func.sum(WithdrawalRequest.amount)).filter(
            WithdrawalRequest.status.in_([WithdrawalStatus.APPROVED, WithdrawalStatus.COMPLETED]),
            WithdrawalRequest.approved_at >= start_date,
            WithdrawalRequest.approved_at < end_date
        ).scalar() or 0
        
        # 📊 RELATÓRIO DETALHADO CONFORME SOLICITADO
        
        # Obter todos os jogadores ativos
        players = User.query.filter(User.role == UserRole.PLAYER, User.is_active == True).all()
        players_summary = []
        
        total_team_investment = 0.0
        total_team_withdrawals = 0.0
        total_player_withdrawals = 0.0
        platform_balances = {}
        profitable_players = []
        
        for player in players:
            # Contas do jogador
            player_accounts = Account.query.filter_by(user_id=player.id, is_active=True).all()
            
            # Saldos por plataforma para este jogador
            player_balances = {}
            total_player_balance = 0.0
            total_player_investment = 0.0
            
            for account in player_accounts:
                platform_name = account.platform.name if account.platform else "Unknown"
                balance = float(account.current_balance or 0)
                investment = float(account.manual_team_investment or account.initial_balance or 0)
                
                player_balances[platform_name] = {
                    'current_balance': balance,
                    'investment': investment,
                    'pnl': balance - investment
                }
                
                total_player_balance += balance
                total_player_investment += investment
                
                # Acumular saldos por plataforma global
                if platform_name not in platform_balances:
                    platform_balances[platform_name] = {'balance': 0, 'investment': 0, 'pnl': 0}
                platform_balances[platform_name]['balance'] += balance
                platform_balances[platform_name]['investment'] += investment
                platform_balances[platform_name]['pnl'] += (balance - investment)
            
            # Reloads do jogador no mês
            player_monthly_reloads = db.session.query(func.sum(ReloadRequest.amount)).filter(
                ReloadRequest.user_id == player.id,
                ReloadRequest.status == ReloadStatus.APPROVED,
                ReloadRequest.approved_at >= start_date,
                ReloadRequest.approved_at < end_date
            ).scalar() or 0
            
            # Saques do jogador no mês
            player_monthly_withdrawals = db.session.query(func.sum(WithdrawalRequest.amount)).filter(
                WithdrawalRequest.user_id == player.id,
                WithdrawalRequest.status == WithdrawalStatus.COMPLETED,
                WithdrawalRequest.approved_at >= start_date,
                WithdrawalRequest.approved_at < end_date
            ).scalar() or 0
            
            player_pnl = total_player_balance - total_player_investment
            
            # Dados do jogador para o relatório
            player_data = {
                'id': player.id,
                'name': player.full_name,
                'username': player.username,
                'total_balance': total_player_balance,
                'total_investment': total_player_investment,
                'pnl': player_pnl,
                'monthly_reloads': float(player_monthly_reloads),
                'monthly_withdrawals': float(player_monthly_withdrawals),
                'platform_balances': player_balances,
                'is_profitable': player_pnl > 0
            }
            
            players_summary.append(player_data)
            
            # Acumular totais
            total_team_investment += total_player_investment
            total_team_withdrawals += float(player_monthly_reloads)  # Reloads = investimento do time
            total_player_withdrawals += float(player_monthly_withdrawals)  # Saques = retirada dos jogadores
            
            # Jogadores lucrativos
            if player_pnl > 0:
                profitable_players.append({
                    'name': player.full_name,
                    'pnl': player_pnl
                })
        
        # Ordenar por lucratividade
        players_summary.sort(key=lambda x: x['pnl'], reverse=True)
        profitable_players.sort(key=lambda x: x['pnl'], reverse=True)
        
        report_data = {
            'period': {
                'month': month,
                'year': year,
                'month_name': start_date.strftime('%B %Y'),
                'generated_at': datetime.utcnow().isoformat()
            },
            'financial_summary': {
                'total_reloads': float(total_reloads),
                'total_withdrawals': float(total_withdrawals),
                'net_movement': float(total_reloads) - float(total_withdrawals),
                'total_team_investment': total_team_investment,
                'total_team_withdrawals': total_team_withdrawals,  # Reloads dados ao time
                'total_player_withdrawals': total_player_withdrawals,  # Saques pelos jogadores
                'team_net_result': total_player_withdrawals - total_team_withdrawals  # Lucro líquido do time
            },
            'players_summary': players_summary,
            'profitable_players': profitable_players,
            'platform_balances': platform_balances,
            'statistics': {
                'total_players': len(players),
                'profitable_players_count': len(profitable_players),
                'profitable_players_percentage': (len(profitable_players) / len(players) * 100) if players else 0,
                'active_platforms': len(platform_balances),
                'avg_player_pnl': sum([p['pnl'] for p in players_summary]) / len(players_summary) if players_summary else 0
            }
        }
        
        # ✅ VERIFICAR FORMATO DE SAÍDA
        output_format = request.args.get('format', 'json').lower()
        
        if output_format == 'pdf':
            # ✅ GERAR PDF (mesmo padrão dos outros relatórios)
            try:
                report_generator = get_report_generator()
                pdf_content = report_generator.generate_monthly_detailed_pdf(report_data)
                
                # Criar resposta com PDF
                response = make_response(pdf_content)
                response.headers['Content-Type'] = 'application/pdf'
                response.headers['Content-Disposition'] = f'attachment; filename="relatorio_mensal_detalhado_{year}_{month:02d}.pdf"'
                
                return response
                
            except Exception as pdf_error:
                logger.error(f"Erro ao gerar PDF: {str(pdf_error)}")
                # Retornar erro específico para debug
                return jsonify({
                    'error': f'Erro ao gerar PDF: {str(pdf_error)}',
                    'fallback_data': report_data
                }), 500
        else:
            # Retornar JSON para outros formatos
            return jsonify(report_data), 200
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório mensal detalhado: {str(e)}")
        return jsonify({'error': str(e)}), 500