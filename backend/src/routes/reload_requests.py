from flask import Blueprint, request, jsonify, session
from datetime import datetime
from src.models.models import db, ReloadRequest, User, Platform, Account, Transaction, UserRole, ReloadStatus, TransactionType
from src.routes.auth import login_required, admin_required
from src.utils.notification_service import get_notification_service
from src.middleware.audit_middleware import audit_reload_approval
from src.utils.pagination import paginate_query
from src.middleware.csrf_protection import csrf_protect
from src.routes.sse import notify_reload_approved, notify_reload_created, broadcast_to_user
from src.services.reloads import ReloadService, ApproveReloadDTO, RejectReloadDTO
from src.schemas.reloads import ApproveReloadSchema, RejectReloadSchema
import bleach

reload_requests_bp = Blueprint('reload_requests', __name__)

@reload_requests_bp.route('/', methods=['GET'])
@login_required
def get_reload_requests():
    try:
        current_user = User.query.get(session['user_id'])
        # Normaliza o status para minúsculas, já que o Enum usa valores em lowercase
        status = request.args.get('status')
        if status:
            status = status.lower()
        user_id = request.args.get('user_id', type=int)
        
        query = ReloadRequest.query
        
        # Filtrar por usuário se especificado
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            query = query.filter_by(user_id=user_id)
        else:
            # Jogadores veem apenas suas próprias solicitações
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                query = query.filter_by(user_id=current_user.id)
        
        # Filtrar por status se especificado
        if status:
            try:
                status_enum = ReloadStatus(status)
                query = query.filter_by(status=status_enum)
            except ValueError:
                return jsonify({'error': 'Invalid status'}), 400
        
        # Paginação
        query = query.order_by(ReloadRequest.created_at.desc())
        result = paginate_query(query, max_per_page=200)
        return jsonify({
            'reload_requests': [req.to_dict() for req in result['items']],
            'pagination': result['pagination']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reload_requests_bp.route('/', methods=['POST'])
@login_required
@csrf_protect
def create_reload_request():
    try:
        current_user = User.query.get(session['user_id'])
        data = request.get_json()
        
        required_fields = ['platform_id', 'amount']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Determinar o user_id
        user_id = data.get('user_id')
        if user_id:
            # Apenas admins/managers podem criar solicitações para outros usuários
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Access denied'}), 403
        else:
            user_id = current_user.id
        
        # Verificar se a plataforma existe
        platform = Platform.query.get(data['platform_id'])
        if not platform or not platform.is_active:
            return jsonify({'error': 'Platform not found or inactive'}), 404
        
        # Verificar se o usuário tem conta nesta plataforma
        account = Account.query.filter_by(
            user_id=user_id, 
            platform_id=data['platform_id'],
            is_active=True
        ).first()
        if not account:
            return jsonify({'error': 'User does not have an active account on this platform'}), 400
        
        # Validar valor
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than zero'}), 400
        
        reload_request = ReloadRequest(
            user_id=user_id,
            platform_id=data['platform_id'],
            amount=amount,
            player_notes=data.get('player_notes', '')
        )
        
        db.session.add(reload_request)
        db.session.commit()
        
        # Enviar notificações automáticas
        notification_service = get_notification_service()
        notification_service.notify_reload_request(reload_request, action="created")
        
        # Notificar via SSE (tempo real)
        try:
            from src.routes.sse import notify_reload_created
            notify_reload_created(reload_request)
        except Exception as e:
            # Não falhar se SSE não funcionar
            pass
        
        return jsonify({
            'message': 'Reload request created successfully',
            'reload_request': reload_request.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reload_requests_bp.route('/<int:request_id>', methods=['GET'])
@login_required
def get_reload_request(request_id):
    try:
        current_user = User.query.get(session['user_id'])
        reload_request = ReloadRequest.query.get(request_id)
        
        if not reload_request:
            return jsonify({'error': 'Reload request not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != reload_request.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({'reload_request': reload_request.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reload_requests_bp.route('/<int:request_id>/approve', methods=['POST'])
@admin_required
@csrf_protect
@audit_reload_approval
def approve_reload_request(request_id):
    try:
        current_user = User.query.get(session['user_id'])
        reload_request = ReloadRequest.query.get(request_id)
        
        if not reload_request:
            return jsonify({'error': 'Reload request not found'}), 404
        
        if reload_request.status != ReloadStatus.PENDING:
            return jsonify({'error': 'Request is not pending'}), 400
        
        payload = ApproveReloadSchema().load(request.get_json() or {})
        notes = bleach.clean(payload.get('manager_notes', ''), tags=[], strip=True)
        req = ReloadService.approve(ApproveReloadDTO(
            reload_id=request_id,
            manager_id=current_user.id,
            manager_notes=notes
        ))
        
        # Enviar notificações automáticas
        notification_service = get_notification_service()
        notification_service.notify_reload_request(reload_request, action="approved")
        
        # Notificar via SSE
        try:
            notify_reload_approved(req)
        except Exception as e:
            # Não falhar se SSE não funcionar
            pass
        
        return jsonify({
            'message': 'Reload request approved successfully',
            'reload_request': req.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reload_requests_bp.route('/<int:request_id>/reject', methods=['POST'])
@admin_required
@csrf_protect
@audit_reload_approval
def reject_reload_request(request_id):
    try:
        current_user = User.query.get(session['user_id'])
        reload_request = ReloadRequest.query.get(request_id)
        
        if not reload_request:
            return jsonify({'error': 'Reload request not found'}), 404
        
        if reload_request.status != ReloadStatus.PENDING:
            return jsonify({'error': 'Request is not pending'}), 400
        
        payload = RejectReloadSchema().load(request.get_json() or {})
        manager_notes = bleach.clean(payload['manager_notes'], tags=[], strip=True)
        
        if not manager_notes:
            return jsonify({'error': 'Manager notes are required for rejection'}), 400
        
        req = ReloadService.reject(RejectReloadDTO(
            reload_id=request_id,
            manager_id=current_user.id,
            manager_notes=manager_notes
        ))
        broadcast_to_user(req.user_id, 'reload_status', {
            'id': req.id,
            'status': 'rejected',
            'message': 'Sua solicitação de reload foi rejeitada',
            'timestamp': datetime.utcnow().timestamp()
        })
        
        # Enviar notificações automáticas
        notification_service = get_notification_service()
        notification_service.notify_reload_request(reload_request, action="rejected")
        
        return jsonify({
            'message': 'Reload request rejected successfully',
            'reload_request': req.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reload_requests_bp.route('/<int:request_id>', methods=['PUT'])
@login_required
@csrf_protect
def update_reload_request(request_id):
    try:
        current_user = User.query.get(session['user_id'])
        reload_request = ReloadRequest.query.get(request_id)
        
        if not reload_request:
            return jsonify({'error': 'Reload request not found'}), 404
        
        # Apenas o próprio usuário ou admins/managers podem editar
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != reload_request.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Apenas solicitações pendentes podem ser editadas
        if reload_request.status != ReloadStatus.PENDING:
            return jsonify({'error': 'Only pending requests can be edited'}), 400
        
        data = request.get_json()
        
        # Jogadores podem editar apenas suas notas
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            if 'player_notes' in data:
                reload_request.player_notes = data['player_notes']
        else:
            # Admins/managers podem editar mais campos
            if 'amount' in data:
                amount = float(data['amount'])
                if amount <= 0:
                    return jsonify({'error': 'Amount must be greater than zero'}), 400
                reload_request.amount = amount
            
            if 'player_notes' in data:
                reload_request.player_notes = data['player_notes']
            
            if 'manager_notes' in data:
                reload_request.manager_notes = data['manager_notes']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Reload request updated successfully',
            'reload_request': reload_request.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reload_requests_bp.route('/<int:request_id>', methods=['DELETE'])
@login_required
@csrf_protect
def delete_reload_request(request_id):
    try:
        current_user = User.query.get(session['user_id'])
        reload_request = ReloadRequest.query.get(request_id)
        
        if not reload_request:
            return jsonify({'error': 'Reload request not found'}), 404
        
        # Apenas o próprio usuário ou admins podem deletar
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != reload_request.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Apenas solicitações pendentes podem ser deletadas
        if reload_request.status != ReloadStatus.PENDING:
            return jsonify({'error': 'Only pending requests can be deleted'}), 400
        
        db.session.delete(reload_request)
        db.session.commit()
        
        return jsonify({'message': 'Reload request deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

