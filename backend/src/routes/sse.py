#!/usr/bin/env python3
"""
Server-Sent Events para atualizações em tempo real
"""

from flask import Blueprint, Response, session, request, jsonify
from src.routes.auth import login_required
from src.models.models import User, UserRole
import json
import time
import threading
from typing import Dict, Set
import logging

logger = logging.getLogger(__name__)

sse_bp = Blueprint('sse', __name__)

# Armazenar conexões ativas por user_id
active_connections: Dict[int, Set] = {}
connection_lock = threading.Lock()

class SSEConnection:
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.last_ping = time.time()
        
    def send_event(self, event_type: str, data: dict):
        """Envia um evento SSE"""
        try:
            event_data = json.dumps(data)
            return f"event: {event_type}\ndata: {event_data}\n\n"
        except Exception as e:
            logger.error(f"Erro ao formatar evento SSE: {e}")
            return None

def add_connection(user_id: int, connection):
    """Adiciona uma conexão ativa"""
    with connection_lock:
        if user_id not in active_connections:
            active_connections[user_id] = set()
        active_connections[user_id].add(connection)
        logger.info(f"Conexão SSE adicionada para usuário {user_id}")

def remove_connection(user_id: int, connection):
    """Remove uma conexão ativa"""
    with connection_lock:
        if user_id in active_connections:
            active_connections[user_id].discard(connection)
            if not active_connections[user_id]:
                del active_connections[user_id]
            logger.info(f"Conexão SSE removida para usuário {user_id}")

def broadcast_to_user(user_id: int, event_type: str, data: dict):
    """Envia evento para todas as conexões de um usuário"""
    with connection_lock:
        if user_id in active_connections:
            connections_to_remove = set()
            for connection in active_connections[user_id]:
                try:
                    event_data = connection.send_event(event_type, data)
                    if event_data:
                        # Adicionar à queue da conexão (simulado)
                        logger.debug(f"Evento {event_type} enviado para usuário {user_id}")
                except Exception as e:
                    logger.error(f"Erro ao enviar evento SSE: {e}")
                    connections_to_remove.add(connection)
            
            # Remover conexões com erro
            for conn in connections_to_remove:
                active_connections[user_id].discard(conn)

def broadcast_to_role(role: UserRole, event_type: str, data: dict):
    """Envia evento para todos os usuários de uma role"""
    try:
        from src.main import app
        with app.app_context():
            users = User.query.filter_by(role=role, is_active=True).all()
            for user in users:
                broadcast_to_user(user.id, event_type, data)
    except Exception as e:
        logger.error(f"Erro ao broadcast para role {role}: {e}")

@sse_bp.route('/events')
@login_required
def stream_events():
    """Endpoint SSE para receber eventos em tempo real"""
    user_id = session['user_id']
    
    def event_generator():
        connection = SSEConnection(user_id)
        add_connection(user_id, connection)
        
        try:
            # Enviar evento inicial de conexão
            yield connection.send_event('connected', {
                'message': 'Conectado ao stream de eventos',
                'timestamp': time.time()
            })
            
            # Manter conexão viva com pings
            while True:
                yield connection.send_event('ping', {
                    'timestamp': time.time()
                })
                time.sleep(30)  # Ping a cada 30 segundos
                
        except GeneratorExit:
            logger.info(f"Conexão SSE encerrada para usuário {user_id}")
        except Exception as e:
            logger.error(f"Erro na conexão SSE: {e}")
        finally:
            remove_connection(user_id, connection)
    
    response = Response(
        event_generator(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        }
    )
    
    return response

@sse_bp.route('/broadcast', methods=['POST'])
@login_required
def broadcast_event():
    """Endpoint para disparar eventos (apenas para admins/managers)"""
    current_user = User.query.get(session['user_id'])
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if not data or 'event_type' not in data:
        return jsonify({'error': 'event_type is required'}), 400
    
    event_type = data['event_type']
    event_data = data.get('data', {})
    target_type = data.get('target_type', 'all')  # 'all', 'admins', 'managers', 'players', 'user'
    target_id = data.get('target_id')  # Para target_type = 'user'
    
    try:
        if target_type == 'user' and target_id:
            broadcast_to_user(target_id, event_type, event_data)
        elif target_type == 'admins':
            broadcast_to_role(UserRole.ADMIN, event_type, event_data)
        elif target_type == 'managers':
            broadcast_to_role(UserRole.MANAGER, event_type, event_data)
            broadcast_to_role(UserRole.ADMIN, event_type, event_data)
        elif target_type == 'players':
            broadcast_to_role(UserRole.PLAYER, event_type, event_data)
        elif target_type == 'all':
            for role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.PLAYER]:
                broadcast_to_role(role, event_type, event_data)
        
        return jsonify({'message': 'Event broadcasted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Erro ao fazer broadcast: {e}")
        return jsonify({'error': str(e)}), 500

@sse_bp.route('/connections')
@login_required
def get_active_connections():
    """Endpoint para ver conexões ativas (apenas admins)"""
    current_user = User.query.get(session['user_id'])
    
    if current_user.role != UserRole.ADMIN:
        return jsonify({'error': 'Access denied'}), 403
    
    with connection_lock:
        connections_info = {}
        for user_id, connections in active_connections.items():
            try:
                user = User.query.get(user_id)
                connections_info[user_id] = {
                    'username': user.username if user else 'unknown',
                    'connection_count': len(connections)
                }
            except:
                connections_info[user_id] = {
                    'username': 'error',
                    'connection_count': len(connections)
                }
    
    return jsonify({
        'total_users': len(connections_info),
        'connections': connections_info
    }), 200

# Funções utilitárias para serem usadas em outros módulos
def notify_reload_created(reload_request):
    """Notifica sobre novo reload request"""
    try:
        # Notificar admins e managers
        broadcast_to_role(UserRole.ADMIN, 'reload_created', {
            'id': reload_request.id,
            'user_id': reload_request.user_id,
            'username': reload_request.user.username,
            'platform_name': reload_request.platform.display_name,
            'amount': float(reload_request.amount),
            'timestamp': time.time()
        })
        broadcast_to_role(UserRole.MANAGER, 'reload_created', {
            'id': reload_request.id,
            'user_id': reload_request.user_id,
            'username': reload_request.user.username,
            'platform_name': reload_request.platform.display_name,
            'amount': float(reload_request.amount),
            'timestamp': time.time()
        })
        
        # Notificar o jogador
        broadcast_to_user(reload_request.user_id, 'reload_status', {
            'id': reload_request.id,
            'status': 'created',
            'message': 'Sua solicitação de reload foi enviada',
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Erro ao notificar reload criado: {e}")

def notify_reload_approved(reload_request):
    """Notifica sobre reload aprovado"""
    try:
        broadcast_to_user(reload_request.user_id, 'reload_status', {
            'id': reload_request.id,
            'status': 'approved',
            'message': 'Sua solicitação de reload foi aprovada!',
            'timestamp': time.time()
        })
        
        # Notificar outros admins/managers
        broadcast_to_role(UserRole.ADMIN, 'reload_approved', {
            'id': reload_request.id,
            'username': reload_request.user.username,
            'amount': float(reload_request.amount),
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Erro ao notificar reload aprovado: {e}")

def notify_balance_updated(user_id, account_id, old_balance, new_balance):
    """Notifica sobre atualização de saldo"""
    try:
        broadcast_to_user(user_id, 'balance_updated', {
            'account_id': account_id,
            'old_balance': float(old_balance),
            'new_balance': float(new_balance),
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Erro ao notificar saldo atualizado: {e}")

def notify_dashboard_refresh():
    """Notifica que o dashboard precisa ser atualizado"""
    try:
        broadcast_to_role(UserRole.ADMIN, 'dashboard_refresh', {
            'timestamp': time.time()
        })
        broadcast_to_role(UserRole.MANAGER, 'dashboard_refresh', {
            'timestamp': time.time()
        })
    except Exception as e:
        logger.error(f"Erro ao notificar refresh do dashboard: {e}")
