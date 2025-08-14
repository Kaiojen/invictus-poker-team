from flask import Blueprint, request, jsonify, session, send_file
from datetime import datetime
from src.models.models import User, UserRole
from src.routes.auth import login_required, admin_required
from src.utils.backup_manager import get_backup_manager
import os

backup_bp = Blueprint('backup', __name__)

@backup_bp.route('/status', methods=['GET'])
@admin_required
def get_backup_status():
    """Obter status do sistema de backup"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        db_info = backup_manager.get_database_info()
        recent_backups = backup_manager.list_backups()[:5]  # 5 mais recentes
        
        status = {
            'database_info': db_info,
            'recent_backups': recent_backups,
            'total_backups': len(backup_manager.list_backups()),
            'backup_directory': backup_manager.backup_dir,
            'automatic_backup_running': backup_manager.running,
            'max_backups_retained': backup_manager.max_backups
        }
        
        return jsonify(status), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/create', methods=['POST'])
@admin_required
def create_backup():
    """Criar backup manual"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        data = request.get_json() or {}
        current_user = User.query.get(session['user_id'])
        
        description = data.get('description') or f"Backup manual por {current_user.full_name}"
        
        backup_info = backup_manager.create_backup(description)
        
        return jsonify({
            'message': 'Backup criado com sucesso',
            'backup_info': backup_info
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/list', methods=['GET'])
@admin_required
def list_backups():
    """Listar todos os backups"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        # Parâmetros de paginação
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        all_backups = backup_manager.list_backups()
        total = len(all_backups)
        
        # Paginação manual
        start = (page - 1) * per_page
        end = start + per_page
        backups = all_backups[start:end]
        
        return jsonify({
            'backups': backups,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page,
                'has_next': end < total,
                'has_prev': page > 1
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/download/<filename>', methods=['GET'])
@admin_required
def download_backup(filename):
    """Download de arquivo de backup"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        backup_path = os.path.join(backup_manager.backup_dir, filename)
        
        if not os.path.exists(backup_path):
            return jsonify({'error': 'Arquivo de backup não encontrado'}), 404
        
        # Verificar se o arquivo está na lista de backups válidos
        backups = backup_manager.list_backups()
        valid_files = [b['filename'] for b in backups]
        
        if filename not in valid_files:
            return jsonify({'error': 'Arquivo não autorizado para download'}), 403
        
        return send_file(
            backup_path,
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/restore', methods=['POST'])
@admin_required
def restore_backup():
    """Restaurar backup (CUIDADO: Operação destrutiva!)"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        data = request.get_json()
        if not data or 'filename' not in data:
            return jsonify({'error': 'Nome do arquivo é obrigatório'}), 400
        
        filename = data['filename']
        confirm = data.get('confirm', False)
        
        if not confirm:
            return jsonify({
                'error': 'Confirmação obrigatória para restore',
                'message': 'Esta operação irá substituir o banco atual. Envie confirm: true para confirmar.'
            }), 400
        
        current_user = User.query.get(session['user_id'])
        
        # Log da operação crítica
        from src.routes.audit import log_action
        log_action(
            user_id=current_user.id,
            action='database_restore',
            entity_type='Database',
            entity_id=0,
            old_values=None,
            new_values=f"Restore do backup: {filename}",
            request_obj=request
        )
        
        success = backup_manager.restore_backup(filename)
        
        if success:
            return jsonify({
                'message': 'Backup restaurado com sucesso',
                'warning': 'Sistema deve ser reiniciado para aplicar mudanças completamente'
            }), 200
        else:
            return jsonify({'error': 'Falha ao restaurar backup'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/delete/<filename>', methods=['DELETE'])
@admin_required
def delete_backup(filename):
    """Deletar arquivo de backup"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        current_user = User.query.get(session['user_id'])
        
        # Log da operação
        from src.routes.audit import log_action
        log_action(
            user_id=current_user.id,
            action='backup_deleted',
            entity_type='Backup',
            entity_id=0,
            old_values=None,
            new_values=f"Backup deletado: {filename}",
            request_obj=request
        )
        
        success = backup_manager.delete_backup(filename)
        
        if success:
            return jsonify({'message': 'Backup deletado com sucesso'}), 200
        else:
            return jsonify({'error': 'Backup não encontrado ou erro ao deletar'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/auto-backup/start', methods=['POST'])
@admin_required
def start_auto_backup():
    """Iniciar backup automático"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        data = request.get_json() or {}
        interval_hours = data.get('interval_hours', 6)
        
        if backup_manager.running:
            return jsonify({'message': 'Backup automático já está em execução'}), 200
        
        backup_manager.start_automatic_backup(interval_hours)
        
        current_user = User.query.get(session['user_id'])
        from src.routes.audit import log_action
        log_action(
            user_id=current_user.id,
            action='auto_backup_started',
            entity_type='System',
            entity_id=0,
            old_values=None,
            new_values=f"Backup automático iniciado (intervalo: {interval_hours}h)",
            request_obj=request
        )
        
        return jsonify({
            'message': 'Backup automático iniciado',
            'interval_hours': interval_hours
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/auto-backup/stop', methods=['POST'])
@admin_required
def stop_auto_backup():
    """Parar backup automático"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        backup_manager.stop_automatic_backup()
        
        current_user = User.query.get(session['user_id'])
        from src.routes.audit import log_action
        log_action(
            user_id=current_user.id,
            action='auto_backup_stopped',
            entity_type='System',
            entity_id=0,
            old_values=None,
            new_values="Backup automático parado",
            request_obj=request
        )
        
        return jsonify({'message': 'Backup automático parado'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@backup_bp.route('/verify/<filename>', methods=['POST'])
@admin_required
def verify_backup(filename):
    """Verificar integridade de um backup"""
    try:
        backup_manager = get_backup_manager()
        if not backup_manager:
            return jsonify({'error': 'Sistema de backup não inicializado'}), 500
        
        backup_path = os.path.join(backup_manager.backup_dir, filename)
        
        if not os.path.exists(backup_path):
            return jsonify({'error': 'Arquivo de backup não encontrado'}), 404
        
        is_valid = backup_manager._verify_backup_integrity(backup_path)
        
        return jsonify({
            'filename': filename,
            'is_valid': is_valid,
            'message': 'Backup íntegro' if is_valid else 'Backup corrompido'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

