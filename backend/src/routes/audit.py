from flask import Blueprint, request, jsonify, session, make_response
from src.models.models import db, AuditLog, User, UserRole
from src.routes.auth import login_required, admin_required
from datetime import datetime, timedelta
import json

audit_bp = Blueprint('audit', __name__)

@audit_bp.route('/logs', methods=['GET'])
@admin_required
def get_audit_logs():
    """Obter logs de auditoria com filtros"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Filtros opcionais
        action_filter = request.args.get('action')
        entity_type_filter = request.args.get('entity_type')
        user_id_filter = request.args.get('user_id', type=int)
        days_back = request.args.get('days_back', 7, type=int)
        
        # Query base
        query = AuditLog.query
        
        # Aplicar filtros
        if action_filter:
            query = query.filter(AuditLog.action.like(f'%{action_filter}%'))
        
        if entity_type_filter:
            query = query.filter(AuditLog.entity_type == entity_type_filter)
        
        if user_id_filter:
            query = query.filter(AuditLog.user_id == user_id_filter)
        
        # Filtro de data
        if days_back > 0:
            start_date = datetime.utcnow() - timedelta(days=days_back)
            query = query.filter(AuditLog.created_at >= start_date)
        
        # Ordenar por mais recente
        query = query.order_by(AuditLog.created_at.desc())
        
        # Paginação
        paginated_logs = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'logs': [log.to_dict() for log in paginated_logs.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated_logs.total,
                'pages': paginated_logs.pages,
                'has_next': paginated_logs.has_next,
                'has_prev': paginated_logs.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audit_bp.route('/logs/<int:log_id>', methods=['GET'])
@admin_required
def get_audit_log_detail(log_id):
    """Obter detalhes de um log específico"""
    try:
        log = AuditLog.query.get(log_id)
        if not log:
            return jsonify({'error': 'Log not found'}), 404
        
        # Parse JSON fields
        log_dict = log.to_dict()
        if log.old_values:
            try:
                log_dict['old_values_parsed'] = json.loads(log.old_values)
            except:
                log_dict['old_values_parsed'] = {}
        
        if log.new_values:
            try:
                log_dict['new_values_parsed'] = json.loads(log.new_values)
            except:
                log_dict['new_values_parsed'] = {}
        
        return jsonify({'log': log_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audit_bp.route('/stats', methods=['GET'])
@admin_required
def get_audit_stats():
    """Obter estatísticas de auditoria"""
    try:
        days_back = request.args.get('days_back', 7, type=int)
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        # Total de logs no período
        total_logs = AuditLog.query.filter(AuditLog.created_at >= start_date).count()
        
        # Logs por ação
        from sqlalchemy import func
        actions_stats = db.session.query(
            AuditLog.action,
            func.count(AuditLog.id).label('count')
        ).filter(
            AuditLog.created_at >= start_date
        ).group_by(AuditLog.action).all()
        
        # Logs por tipo de entidade
        entity_stats = db.session.query(
            AuditLog.entity_type,
            func.count(AuditLog.id).label('count')
        ).filter(
            AuditLog.created_at >= start_date
        ).group_by(AuditLog.entity_type).all()
        
        # Usuários mais ativos
        user_stats = db.session.query(
            AuditLog.user_id,
            User.full_name,
            func.count(AuditLog.id).label('count')
        ).join(User).filter(
            AuditLog.created_at >= start_date
        ).group_by(AuditLog.user_id, User.full_name).order_by(
            func.count(AuditLog.id).desc()
        ).limit(10).all()
        
        return jsonify({
            'total_logs': total_logs,
            'period_days': days_back,
            'actions': [{'action': action, 'count': count} for action, count in actions_stats],
            'entities': [{'entity_type': entity, 'count': count} for entity, count in entity_stats],
            'active_users': [
                {'user_id': user_id, 'user_name': name, 'actions_count': count} 
                for user_id, name, count in user_stats
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@audit_bp.route('/create', methods=['POST'])
@login_required
def create_audit_log():
    """Criar log de auditoria manualmente (para ações críticas)"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Apenas admins podem criar logs manuais
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        required_fields = ['action', 'entity_type', 'entity_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Obter IP do cliente
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', 'Unknown')
        
        audit_log = AuditLog(
            user_id=current_user.id,
            action=data['action'],
            entity_type=data['entity_type'],
            entity_id=data['entity_id'],
            old_values=json.dumps(data.get('old_values')) if data.get('old_values') else None,
            new_values=json.dumps(data.get('new_values')) if data.get('new_values') else None,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.session.add(audit_log)
        db.session.commit()
        
        return jsonify({
            'message': 'Audit log created successfully',
            'log': audit_log.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def log_action(user_id, action, entity_type, entity_id, old_values=None, new_values=None, request_obj=None):
    """
    Função utilitária para criar logs de auditoria automaticamente
    
    Args:
        user_id: ID do usuário que realizou a ação
        action: Ação realizada (ex: 'user_created', 'balance_updated')
        entity_type: Tipo da entidade (ex: 'User', 'Account', 'ReloadRequest')
        entity_id: ID da entidade afetada
        old_values: Valores antigos (dict)
        new_values: Valores novos (dict)
        request_obj: Objeto request do Flask para obter IP e User-Agent
    """
    try:
        ip_address = '127.0.0.1'
        user_agent = 'System'
        
        if request_obj:
            ip_address = request_obj.headers.get('X-Forwarded-For', request_obj.remote_addr)
            user_agent = request_obj.headers.get('User-Agent', 'Unknown')
        
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=json.dumps(old_values) if old_values else None,
            new_values=json.dumps(new_values) if new_values else None,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        db.session.add(audit_log)
        # Não fazer commit aqui - deixar para a função que chama
        
    except Exception as e:
        print(f"Erro ao criar log de auditoria: {e}")
        # Não falhar a operação principal por causa do log

@audit_bp.route('/export', methods=['GET'])
@admin_required
def export_audit_logs():
    """Exportar logs de auditoria em CSV ou PDF"""
    try:
        days_back = request.args.get('days_back', 30, type=int)
        format_type = request.args.get('format', 'csv').lower()
        start_date = datetime.utcnow() - timedelta(days=days_back)
        
        logs = AuditLog.query.filter(
            AuditLog.created_at >= start_date
        ).order_by(AuditLog.created_at.desc()).all()
        
        if format_type == 'pdf':
            # ✅ GERAR PDF (mesma qualidade dos outros relatórios)
            from src.utils.report_generator import get_report_generator
            
            # Preparar dados para o PDF
            audit_data = {
                'period': {
                    'days_back': days_back,
                    'start_date': start_date.strftime('%d/%m/%Y'),
                    'end_date': datetime.utcnow().strftime('%d/%m/%Y'),
                    'generated_at': datetime.utcnow().isoformat()
                },
                'logs': [
                    {
                        'id': log.id,
                        'created_at': log.created_at.strftime('%d/%m/%Y %H:%M:%S'),
                        'user_name': log.user.full_name if log.user else 'Sistema',
                        'action_name': log.action,
                        'entity_type': log.entity_type or 'N/A',
                        'ip_address': log.ip_address or 'N/A',
                        'old_values': log.old_values or 'N/A',
                        'new_values': log.new_values or 'N/A',
                        'notes': log.notes if hasattr(log, 'notes') else 'N/A'
                    }
                    for log in logs
                ],
                'stats': {
                    'total_logs': len(logs),
                    'period_days': days_back
                }
            }
            
            report_generator = get_report_generator()
            pdf_content = report_generator.generate_audit_logs_pdf(audit_data)
            
            response = make_response(pdf_content)
            response.headers['Content-Type'] = 'application/pdf'
            response.headers['Content-Disposition'] = f'attachment; filename="audit_logs_{datetime.now().strftime("%Y%m%d")}.pdf"'
            
            return response
        else:
            # Gerar CSV (original)
            import io
            import csv
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Cabeçalho
            writer.writerow([
                'ID', 'Data/Hora', 'Usuário', 'Ação', 'Tipo Entidade', 
                'ID Entidade', 'Valores Antigos', 'Valores Novos', 'IP', 'User Agent'
            ])
            
            # Dados
            for log in logs:
                writer.writerow([
                    log.id,
                    log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    log.user.full_name if log.user else 'Sistema',
                    log.action,
                    log.entity_type,
                    log.entity_id,
                    log.old_values or '',
                    log.new_values or '',
                    log.ip_address or '',
                    log.user_agent or ''
                ])
            
            output.seek(0)
            
            response = make_response(output.getvalue())
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename=audit_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
