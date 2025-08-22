from flask import Blueprint, request, jsonify, session
from src.models.models import db, User, UserRole, PlayerData, AuditLog
from src.routes.audit import log_action
from werkzeug.security import generate_password_hash
from datetime import datetime, date
import re
import json
import time

registration_bp = Blueprint('registration', __name__)

def validate_cpf(cpf):
    """Validar CPF brasileiro"""
    # Remove caracteres não numéricos
    cpf = re.sub(r'[^0-9]', '', cpf)
    
    # CPF deve ter 11 dígitos
    if len(cpf) != 11:
        return False
    
    # CPF não pode ser uma sequência de números iguais
    if cpf == cpf[0] * 11:
        return False
    
    # Validar dígitos verificadores
    def calculate_digit(cpf_digits):
        total = sum(int(digit) * weight for digit, weight in zip(cpf_digits, range(len(cpf_digits) + 1, 1, -1)))
        remainder = total % 11
        return 0 if remainder < 2 else 11 - remainder
    
    # Verificar primeiro dígito
    if int(cpf[9]) != calculate_digit(cpf[:9]):
        return False
    
    # Verificar segundo dígito
    if int(cpf[10]) != calculate_digit(cpf[:10]):
        return False
    
    return True

def validate_email(email):
    """Validar formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """Validar telefone brasileiro"""
    # Remove caracteres não numéricos
    phone_digits = re.sub(r'[^0-9]', '', phone)
    
    # Telefone brasileiro: 10 ou 11 dígitos (com DDD)
    return len(phone_digits) in [10, 11]

@registration_bp.route('/player', methods=['POST'])
def register_player():
    """Auto-cadastro de jogador - Fase 3"""
    try:
        data = request.get_json()
        
        # Campos obrigatórios
        required_fields = [
            'username', 'email', 'password', 'full_name', 
            'phone', 'document', 'birth_date'
        ]
        
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Campo {field} é obrigatório'}), 400
        
        # Validações específicas
        if not validate_email(data['email']):
            return jsonify({'error': 'Email inválido'}), 400
        
        if not validate_phone(data['phone']):
            return jsonify({'error': 'Telefone inválido. Use formato brasileiro com DDD'}), 400
        
        if not validate_cpf(data['document']):
            return jsonify({'error': 'CPF inválido'}), 400
        
        # Validar data de nascimento
        try:
            birth_date = datetime.strptime(data['birth_date'], '%Y-%m-%d').date()
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            
            if age < 18:
                return jsonify({'error': 'Jogador deve ser maior de 18 anos'}), 400
            
            if age > 100:
                return jsonify({'error': 'Data de nascimento inválida'}), 400
                
        except ValueError:
            return jsonify({'error': 'Data de nascimento inválida. Use formato YYYY-MM-DD'}), 400
        
        # Validar senha
        password = data['password']
        if len(password) < 8:
            return jsonify({'error': 'Senha deve ter pelo menos 8 caracteres'}), 400
        
        # Verificar se username ou email já existem
        existing_user = User.query.filter(
            (User.username == data['username']) | 
            (User.email == data['email']) |
            (User.document == data['document'])
        ).first()
        
        if existing_user:
            if existing_user.username == data['username']:
                return jsonify({'error': 'Nome de usuário já existe'}), 400
            elif existing_user.email == data['email']:
                return jsonify({'error': 'Email já está cadastrado'}), 400
            elif existing_user.document == data['document']:
                return jsonify({'error': 'CPF já está cadastrado'}), 400
        
        # Criar novo usuário
        new_user = User(
            username=data['username'],
            email=data['email'],
            full_name=data['full_name'],
            role=UserRole.PLAYER,
            phone=data['phone'],
            document=data['document'],
            birth_date=birth_date,
            pix_key=data.get('pix_key', ''),
            bank_name=data.get('bank_name', ''),
            bank_agency=data.get('bank_agency', ''),
            bank_account=data.get('bank_account', ''),
            reta_id=1,  # Começar na Reta 0 (Low stakes)
            makeup=0.00,
            is_active=False,  # Usuário inativo até aprovação
            manager_notes='Usuário criado via auto-cadastro - Aguardando aprovação'
        )
        
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        # Criar log de auditoria
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', 'Unknown')
        
        audit_log = AuditLog(
            user_id=new_user.id,  # O próprio usuário
            action='player_self_registered',
            entity_type='User',
            entity_id=new_user.id,
            old_values=None,
            new_values=json.dumps({
                'username': new_user.username,
                'email': new_user.email,
                'full_name': new_user.full_name,
                'phone': new_user.phone,
                'status': 'pending_approval'
            }),
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(audit_log)
        
        # Criar notificação para admin/manager
        from src.models.notifications import Notification, NotificationType, NotificationCategory
        
        # Notificar todos os admins
        admins = User.query.filter(User.role.in_([UserRole.ADMIN, UserRole.MANAGER])).all()
        for admin in admins:
            notification = Notification(
                user_id=admin.id,
                title="Novo Cadastro de Jogador",
                message=f"O jogador {new_user.full_name} (@{new_user.username}) se cadastrou e está aguardando aprovação.",
                notification_type=NotificationType.ACTION_REQUIRED,
                category=NotificationCategory.REGISTRATION,
                is_urgent=True,
                related_entity_type='User',
                related_entity_id=new_user.id,
                action_url='/dashboard?tab=gestao&subtab=jogadores'
            )
            db.session.add(notification)
        
        db.session.commit()
        
        # Broadcast via SSE
        from src.routes.sse import broadcast_to_role
        broadcast_to_role(UserRole.ADMIN, 'new_registration', {
            'user_id': new_user.id,
            'username': new_user.username,
            'full_name': new_user.full_name,
            'message': f'Novo cadastro: {new_user.full_name}',
            'timestamp': time.time()
        })
        broadcast_to_role(UserRole.MANAGER, 'new_registration', {
            'user_id': new_user.id,
            'username': new_user.username,
            'full_name': new_user.full_name,
            'message': f'Novo cadastro: {new_user.full_name}',
            'timestamp': time.time()
        })
        
        return jsonify({
            'message': 'Cadastro realizado com sucesso! Aguarde aprovação do gestor.',
            'user_id': new_user.id,
            'status': 'pending_approval'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Erro interno: {str(e)}'}), 500

@registration_bp.route('/pending', methods=['GET'])
def get_pending_registrations():
    """Obter usuários pendentes de aprovação - apenas admins/managers"""
    try:
        # Verificar se usuário está logado e é admin/manager
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        current_user = User.query.get(session['user_id'])
        if not current_user or current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar usuários inativos (pendentes de aprovação)
        pending_users = User.query.filter(
            User.role == UserRole.PLAYER,
            User.is_active == False
        ).order_by(User.created_at.desc()).all()
        
        users_data = []
        for user in pending_users:
            user_dict = user.to_dict()
            user_dict['days_waiting'] = (datetime.utcnow() - user.created_at).days
            users_data.append(user_dict)
        
        return jsonify({
            'pending_users': users_data,
            'total_pending': len(pending_users)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@registration_bp.route('/approve/<int:user_id>', methods=['POST'])
def approve_registration(user_id):
    """Aprovar cadastro de jogador"""
    try:
        # Verificar se usuário está logado e é admin/manager
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        current_user = User.query.get(session['user_id'])
        if not current_user or current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar usuário pendente
        pending_user = User.query.get(user_id)
        if not pending_user:
            return jsonify({'error': 'User not found'}), 404
        
        if pending_user.is_active:
            return jsonify({'error': 'User is already active'}), 400
        
        # Dados da aprovação
        data = request.get_json() or {}
        reta_id = data.get('reta_id', 1)  # Reta padrão
        manager_notes = data.get('manager_notes', 'Usuário aprovado via sistema')
        
        # Valores antigos para auditoria
        old_values = {
            'is_active': pending_user.is_active,
            'reta_id': pending_user.reta_id,
            'manager_notes': pending_user.manager_notes
        }
        
        # Aprovar usuário
        pending_user.is_active = True
        pending_user.reta_id = reta_id
        pending_user.manager_notes = f"{manager_notes} - Aprovado por {current_user.full_name} em {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}"
        
        # Valores novos para auditoria
        new_values = {
            'is_active': pending_user.is_active,
            'reta_id': pending_user.reta_id,
            'manager_notes': pending_user.manager_notes,
            'approved_by': current_user.full_name
        }
        
        db.session.commit()
        
        # Log de auditoria
        log_action(
            user_id=current_user.id,
            action='player_registration_approved',
            entity_type='User',
            entity_id=pending_user.id,
            old_values=old_values,
            new_values=new_values,
            request_obj=request
        )
        
        db.session.commit()
        
        return jsonify({
            'message': f'Jogador {pending_user.full_name} aprovado com sucesso!',
            'user': pending_user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@registration_bp.route('/reject/<int:user_id>', methods=['POST'])
def reject_registration(user_id):
    """Rejeitar cadastro de jogador"""
    try:
        # Verificar se usuário está logado e é admin/manager
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        current_user = User.query.get(session['user_id'])
        if not current_user or current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Access denied'}), 403
        
        # Buscar usuário pendente
        pending_user = User.query.get(user_id)
        if not pending_user:
            return jsonify({'error': 'User not found'}), 404
        
        if pending_user.is_active:
            return jsonify({'error': 'Cannot reject active user'}), 400
        
        data = request.get_json() or {}
        rejection_reason = data.get('reason', 'Não especificado')
        
        # Valores para auditoria
        old_values = pending_user.to_dict()
        
        # Log de auditoria antes de deletar
        log_action(
            user_id=current_user.id,
            action='player_registration_rejected',
            entity_type='User',
            entity_id=pending_user.id,
            old_values=old_values,
            new_values={'reason': rejection_reason, 'rejected_by': current_user.full_name},
            request_obj=request
        )
        
        user_name = pending_user.full_name
        
        # Remover usuário rejeitado
        db.session.delete(pending_user)
        db.session.commit()
        
        return jsonify({
            'message': f'Cadastro de {user_name} rejeitado.',
            'reason': rejection_reason
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@registration_bp.route('/check-availability', methods=['POST'])
def check_availability():
    """Verificar disponibilidade de username, email ou CPF"""
    try:
        data = request.get_json()
        
        result = {
            'username_available': True,
            'email_available': True,
            'document_available': True
        }
        
        if data.get('username'):
            existing = User.query.filter_by(username=data['username']).first()
            result['username_available'] = existing is None
        
        if data.get('email'):
            existing = User.query.filter_by(email=data['email']).first()
            result['email_available'] = existing is None
        
        if data.get('document'):
            existing = User.query.filter_by(document=data['document']).first()
            result['document_available'] = existing is None
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
