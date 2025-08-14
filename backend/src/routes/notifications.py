from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.models import User
from src.models.notifications import Notification, UserNotificationSettings
from src.routes.auth import login_required, admin_required
from src.utils.notification_service import get_notification_service
import logging

notifications_bp = Blueprint('notifications', __name__)
logger = logging.getLogger(__name__)

@notifications_bp.route('/', methods=['GET'])
@login_required
def get_notifications():
    """Buscar notificações do usuário"""
    try:
        user_id = session['user_id']
        
        # Parâmetros de query
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100
        
        notification_service = get_notification_service()
        notifications = notification_service.get_user_notifications(
            user_id=user_id,
            unread_only=unread_only,
            limit=limit
        )
        
        # Obter estatísticas
        stats = notification_service.get_notification_stats(user_id)
        
        return jsonify({
            'notifications': [notif.to_dict() for notif in notifications],
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar notificações: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/<int:notification_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    """Marcar notificação como lida"""
    try:
        user_id = session['user_id']
        
        notification_service = get_notification_service()
        success = notification_service.mark_as_read(notification_id, user_id)
        
        if success:
            return jsonify({'message': 'Notification marked as read'}), 200
        else:
            return jsonify({'error': 'Notification not found or already read'}), 404
            
    except Exception as e:
        logger.error(f"Erro ao marcar notificação como lida: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/read-all', methods=['POST'])
@login_required
def mark_all_notifications_read():
    """Marcar todas as notificações como lidas"""
    try:
        user_id = session['user_id']
        
        notification_service = get_notification_service()
        count = notification_service.mark_all_as_read(user_id)
        
        return jsonify({
            'message': f'{count} notifications marked as read',
            'count': count
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao marcar todas como lidas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/settings', methods=['GET'])
@login_required
def get_notification_settings():
    """Buscar configurações de notificação do usuário"""
    try:
        user_id = session['user_id']
        
        settings = UserNotificationSettings.query.filter_by(user_id=user_id).first()
        
        if not settings:
            # Criar configurações padrão
            settings = UserNotificationSettings(user_id=user_id)
            from src.models.models import db
            db.session.add(settings)
            db.session.commit()
        
        return jsonify(settings.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar configurações: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/settings', methods=['PUT'])
@login_required
def update_notification_settings():
    """Atualizar configurações de notificação"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        settings = UserNotificationSettings.query.filter_by(user_id=user_id).first()
        
        if not settings:
            settings = UserNotificationSettings(user_id=user_id)
            from src.models.models import db
            db.session.add(settings)
        
        # Atualizar campos permitidos
        allowed_fields = [
            'reload_requests_enabled', 'withdrawal_requests_enabled',
            'account_updates_enabled', 'system_messages_enabled',
            'player_alerts_enabled', 'compliance_enabled',
            'performance_enabled', 'email_notifications_enabled',
            'urgent_only'
        ]
        
        for field in allowed_fields:
            if field in data:
                setattr(settings, field, bool(data[field]))
        
        settings.updated_at = datetime.utcnow()
        
        from src.models.models import db
        db.session.commit()
        
        return jsonify({
            'message': 'Settings updated successfully',
            'settings': settings.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao atualizar configurações: {str(e)}")
        from src.models.models import db
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/test', methods=['POST'])
@login_required
def create_test_notification():
    """Criar notificação de teste (apenas para desenvolvimento)"""
    try:
        user_id = session['user_id']
        
        notification_service = get_notification_service()
        notification = notification_service.create_notification(
            user_id=user_id,
            title="🧪 Notificação de Teste",
            message="Esta é uma notificação de teste do sistema Invictus Poker Team.",
            notification_type="info",
            category="system_message",
            expires_hours=1
        )
        
        if notification:
            return jsonify({
                'message': 'Test notification created',
                'notification': notification.to_dict()
            }), 201
        else:
            return jsonify({'error': 'Failed to create notification'}), 500
            
    except Exception as e:
        logger.error(f"Erro ao criar notificação de teste: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/stats', methods=['GET'])
@login_required
def get_notification_stats():
    """Obter estatísticas de notificações"""
    try:
        user_id = session['user_id']
        
        notification_service = get_notification_service()
        stats = notification_service.get_notification_stats(user_id)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/urgent', methods=['GET'])
@login_required
def get_urgent_notifications():
    """Buscar apenas notificações urgentes não lidas"""
    try:
        user_id = session['user_id']
        
        urgent_notifications = Notification.query.filter(
            Notification.user_id == user_id,
            Notification.is_urgent == True,
            Notification.is_read == False
        ).order_by(Notification.created_at.desc()).limit(10).all()
        
        return jsonify({
            'urgent_notifications': [notif.to_dict() for notif in urgent_notifications],
            'count': len(urgent_notifications)
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar notificações urgentes: {str(e)}")
        return jsonify({'error': str(e)}), 500

@notifications_bp.route('/check-incomplete-data', methods=['POST'])
@admin_required
def check_incomplete_data():
    """Executar verificação de dados incompletos (apenas admin)"""
    try:
        from src.utils.notification_service import get_notification_service
        
        notification_service = get_notification_service()
        notification_service.notify_incomplete_data()
        
        return jsonify({
            'message': 'Verificação de dados incompletos executada com sucesso'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

