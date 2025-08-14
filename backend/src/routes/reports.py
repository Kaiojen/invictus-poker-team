from flask import Blueprint, request, jsonify, session, make_response
from datetime import datetime, timedelta
from src.models.models import User, UserRole, Reta
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

