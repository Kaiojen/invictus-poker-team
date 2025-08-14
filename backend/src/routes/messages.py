from flask import Blueprint, request, jsonify, session
from datetime import datetime
from sqlalchemy import or_, and_, desc
from src.models.models import db, User, UserRole
from src.models.messages import Message, MessageType, MessagePriority
from src.routes.auth import login_required
from src.utils.notification_service import get_notification_service
from src.models.notifications import NotificationType, NotificationCategory
import uuid
import logging

messages_bp = Blueprint('messages', __name__)
logger = logging.getLogger(__name__)

@messages_bp.route('/', methods=['GET'])
@login_required
def get_messages():
    """Buscar mensagens do usuário"""
    try:
        user_id = session['user_id']
        
        # Parâmetros de query
        message_type = request.args.get('type', 'all')  # all, sent, received
        is_read = request.args.get('is_read')
        thread_id = request.args.get('thread_id')
        limit = min(int(request.args.get('limit', 50)), 100)
        
        # Query base
        query = Message.query
        
        # Filtrar por tipo
        if message_type == 'sent':
            query = query.filter(Message.sender_id == user_id)
        elif message_type == 'received':
            query = query.filter(Message.recipient_id == user_id)
        else:  # all
            query = query.filter(
                or_(
                    Message.sender_id == user_id,
                    Message.recipient_id == user_id
                )
            )
        
        # Filtrar por status de leitura
        if is_read is not None:
            is_read_bool = is_read.lower() == 'true'
            query = query.filter(Message.is_read == is_read_bool)
        
        # Filtrar por thread
        if thread_id:
            query = query.filter(Message.thread_id == thread_id)
        
        # Excluir arquivadas
        query = query.filter(Message.is_archived == False)
        
        # Ordenar por data (mais recentes primeiro)
        messages = query.order_by(desc(Message.created_at)).limit(limit).all()
        
        return jsonify({
            'messages': [msg.to_dict() for msg in messages],
            'total': len(messages)
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar mensagens: {str(e)}")
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/', methods=['POST'])
@login_required
def send_message():
    """Enviar nova mensagem"""
    try:
        user_id = session['user_id']
        current_user = User.query.get(user_id)
        data = request.get_json()
        
        # Validações
        required_fields = ['recipient_id', 'subject', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        recipient_id = data['recipient_id']
        
        # Verificar se destinatário existe
        recipient = User.query.get(recipient_id)
        if not recipient:
            return jsonify({'error': 'Recipient not found'}), 404
        
        # Verificar permissões (jogadores só podem enviar para admins/managers)
        if current_user.role == UserRole.PLAYER:
            if recipient.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Players can only send messages to managers/admins'}), 403
        
        # Gerar thread_id se for uma nova conversa
        thread_id = data.get('thread_id')
        parent_message_id = data.get('parent_message_id')
        
        if not thread_id:
            thread_id = str(uuid.uuid4())
        
        # Determinar prioridade
        priority_str = data.get('priority', 'normal')
        try:
            priority = MessagePriority(priority_str)
        except ValueError:
            priority = MessagePriority.NORMAL
        
        # Criar mensagem
        message = Message(
            sender_id=user_id,
            recipient_id=recipient_id,
            subject=data['subject'],
            content=data['content'],
            message_type=MessageType.DIRECT,
            priority=priority,
            parent_message_id=parent_message_id,
            thread_id=thread_id
        )
        
        db.session.add(message)
        db.session.commit()
        
        # Enviar notificação ao destinatário
        notification_service = get_notification_service()
        notification_service.create_notification(
            user_id=recipient_id,
            title=f"💬 Nova mensagem de {current_user.full_name}",
            message=f"Assunto: {data['subject']}",
            notification_type=NotificationType.INFO,
            category=NotificationCategory.SYSTEM_MESSAGE,
            is_urgent=(priority == MessagePriority.URGENT),
            related_entity_type="message",
            related_entity_id=message.id,
            action_url="/dashboard?tab=mensagens",
            expires_hours=168  # 1 semana
        )
        
        return jsonify({
            'message': 'Message sent successfully',
            'message_data': message.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<int:message_id>', methods=['GET'])
@login_required
def get_message(message_id):
    """Buscar mensagem específica"""
    try:
        user_id = session['user_id']
        
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Verificar permissões
        if message.sender_id != user_id and message.recipient_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Marcar como lida se for o destinatário
        if message.recipient_id == user_id and not message.is_read:
            message.is_read = True
            message.read_at = datetime.utcnow()
            db.session.commit()
        
        return jsonify(message.to_dict()), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar mensagem: {str(e)}")
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<int:message_id>/read', methods=['POST'])
@login_required
def mark_message_read(message_id):
    """Marcar mensagem como lida"""
    try:
        user_id = session['user_id']
        
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        # Apenas o destinatário pode marcar como lida
        if message.recipient_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        if not message.is_read:
            message.is_read = True
            message.read_at = datetime.utcnow()
            db.session.commit()
        
        return jsonify({'message': 'Message marked as read'}), 200
        
    except Exception as e:
        logger.error(f"Erro ao marcar mensagem como lida: {str(e)}")
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/thread/<thread_id>', methods=['GET'])
@login_required
def get_thread_messages(thread_id):
    """Buscar todas as mensagens de uma conversa"""
    try:
        user_id = session['user_id']
        
        # Buscar mensagens da thread onde o usuário participa
        messages = Message.query.filter(
            Message.thread_id == thread_id,
            or_(
                Message.sender_id == user_id,
                Message.recipient_id == user_id
            )
        ).order_by(Message.created_at.asc()).all()
        
        # Marcar mensagens não lidas como lidas
        unread_messages = [msg for msg in messages if not msg.is_read and msg.recipient_id == user_id]
        for msg in unread_messages:
            msg.is_read = True
            msg.read_at = datetime.utcnow()
        
        if unread_messages:
            db.session.commit()
        
        return jsonify({
            'messages': [msg.to_dict() for msg in messages],
            'thread_id': thread_id
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar thread: {str(e)}")
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/contacts', methods=['GET'])
@login_required
def get_message_contacts():
    """Buscar contatos para envio de mensagem"""
    try:
        user_id = session['user_id']
        current_user = User.query.get(user_id)
        
        contacts = []
        
        if current_user.role in [UserRole.ADMIN, UserRole.MANAGER]:
            # Admins e managers podem enviar para qualquer um
            users = User.query.filter(
                User.id != user_id,
                User.is_active == True
            ).all()
            
            for user in users:
                contacts.append({
                    'id': user.id,
                    'full_name': user.full_name,
                    'username': user.username,
                    'role': user.role.value,
                    'email': user.email
                })
        
        elif current_user.role == UserRole.PLAYER:
            # Jogadores podem enviar apenas para admins e managers
            managers = User.query.filter(
                User.role.in_([UserRole.ADMIN, UserRole.MANAGER]),
                User.is_active == True
            ).all()
            
            for manager in managers:
                contacts.append({
                    'id': manager.id,
                    'full_name': manager.full_name,
                    'username': manager.username,
                    'role': manager.role.value,
                    'email': manager.email
                })
        
        return jsonify({'contacts': contacts}), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar contatos: {str(e)}")
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/stats', methods=['GET'])
@login_required
def get_message_stats():
    """Estatísticas de mensagens do usuário"""
    try:
        user_id = session['user_id']
        
        # Mensagens recebidas não lidas
        unread_received = Message.query.filter(
            Message.recipient_id == user_id,
            Message.is_read == False,
            Message.is_archived == False
        ).count()
        
        # Total de mensagens recebidas
        total_received = Message.query.filter(
            Message.recipient_id == user_id,
            Message.is_archived == False
        ).count()
        
        # Total de mensagens enviadas
        total_sent = Message.query.filter(
            Message.sender_id == user_id,
            Message.is_archived == False
        ).count()
        
        # Mensagens urgentes não lidas
        urgent_unread = Message.query.filter(
            Message.recipient_id == user_id,
            Message.is_read == False,
            Message.priority == MessagePriority.URGENT,
            Message.is_archived == False
        ).count()
        
        return jsonify({
            'unread_received': unread_received,
            'total_received': total_received,
            'total_sent': total_sent,
            'urgent_unread': urgent_unread
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {str(e)}")
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/broadcast', methods=['POST'])
@login_required
def send_broadcast_message():
    """Enviar mensagem para múltiplos usuários (apenas admins)"""
    try:
        user_id = session['user_id']
        current_user = User.query.get(user_id)
        
        # Apenas admins podem enviar broadcasts
        if current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Validações
        required_fields = ['recipient_ids', 'subject', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        recipient_ids = data['recipient_ids']
        if not isinstance(recipient_ids, list) or len(recipient_ids) == 0:
            return jsonify({'error': 'recipient_ids must be a non-empty list'}), 400
        
        # Verificar se todos os destinatários existem
        recipients = User.query.filter(User.id.in_(recipient_ids)).all()
        if len(recipients) != len(recipient_ids):
            return jsonify({'error': 'Some recipients not found'}), 404
        
        # Criar mensagens para cada destinatário
        messages_created = []
        base_thread_id = str(uuid.uuid4())
        
        for recipient in recipients:
            message = Message(
                sender_id=user_id,
                recipient_id=recipient.id,
                subject=data['subject'],
                content=data['content'],
                message_type=MessageType.BROADCAST,
                priority=MessagePriority.HIGH,
                thread_id=f"{base_thread_id}_{recipient.id}"
            )
            
            db.session.add(message)
            messages_created.append(message)
        
        db.session.commit()
        
        # Enviar notificações
        notification_service = get_notification_service()
        for recipient in recipients:
            notification_service.create_notification(
                user_id=recipient.id,
                title=f"📢 Comunicado da Administração",
                message=f"Assunto: {data['subject']}",
                notification_type=NotificationType.WARNING,
                category=NotificationCategory.SYSTEM_MESSAGE,
                is_urgent=True,
                related_entity_type="message",
                related_entity_id=messages_created[0].id,  # Primeira mensagem como referência
                action_url="/dashboard?tab=mensagens",
                expires_hours=72
            )
        
        return jsonify({
            'message': f'Broadcast sent to {len(recipients)} recipients',
            'recipients_count': len(recipients)
        }), 201
        
    except Exception as e:
        logger.error(f"Erro ao enviar broadcast: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

