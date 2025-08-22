from flask import Blueprint, request, jsonify, session
from src.models.models import db, User, UserRole
from functools import wraps
from src.middleware.rate_limiter import login_rate_limit, sensitive_rate_limit, rate_limiter
from src.middleware.csrf_protection import get_csrf_token
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
import os
import base64
import secrets
import json
import smtplib
import ssl
from email.message import EmailMessage
try:
    import pyotp
except Exception:
    pyotp = None

auth_bp = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        user = User.query.get(session['user_id'])
        if not user or user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route('/login', methods=['POST'])
@login_rate_limit
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        totp_code = data.get('totp')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        user = User.query.filter_by(username=username).first()
        ip = get_remote_address()
        
        if user and user.check_password(password) and user.is_active:
            # Verificação 2FA (se habilitado)
            if user.two_factor_enabled:
                # Exigir TOTP se 2FA ativo
                if not totp_code:
                    return jsonify({'error': 'TOTP required', 'two_factor_required': True}), 401
                if not pyotp:
                    return jsonify({'error': '2FA not available on server'}), 500
                totp = pyotp.TOTP(user.totp_secret)
                valid = totp.verify(str(totp_code), valid_window=1)
                if not valid:
                    # permitir uso de recovery code
                    recovery = str(totp_code).strip()
                    try:
                        codes = json.loads(user.recovery_codes or '[]')
                    except Exception:
                        codes = []
                    match = next((c for c in codes if c.get('code') == recovery and not c.get('used')), None)
                    if not match:
                        return jsonify({'error': 'Invalid TOTP or recovery code'}), 401
                    # marcar recovery code como usado
                    match['used'] = True
                    user.recovery_codes = json.dumps(codes)
                    db.session.commit()

            session['user_id'] = user.id
            session['user_role'] = user.role.value
            
            # Limpar tentativas falhadas após sucesso
            rate_limiter.clear_failed_attempts(ip)
            
            return jsonify({
                'message': 'Login successful',
                'user': user.to_dict()
            }), 200
        else:
            # Registrar tentativa falhada
            rate_limiter.record_failed_attempt(ip)
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    try:
        session.clear()
        return jsonify({'message': 'Logout successful'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    try:
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': user.to_dict(),
            'csrf_token': get_csrf_token()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/csrf-token', methods=['GET'])
@login_required
def get_csrf_token_endpoint():
    """Endpoint dedicado para obter token CSRF"""
    try:
        return jsonify({'csrf_token': get_csrf_token()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
@login_required
@sensitive_rate_limit
def change_password():
    try:
        data = request.get_json()
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current and new passwords are required'}), 400
        
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.check_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ====== Forgot password flow ======

@auth_bp.route('/forgot-password', methods=['POST'])
@sensitive_rate_limit
def forgot_password():
    try:
        data = request.get_json()
        username_or_email = data.get('username') or data.get('email')
        if not username_or_email:
            return jsonify({'error': 'username or email is required'}), 400

        user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
        if not user or not user.is_active:
            # Não revelar existência
            return jsonify({'message': 'If the user exists, a reset link was created'}), 200

        token = base64.urlsafe_b64encode(os.urandom(24)).decode('utf-8').rstrip('=')
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()

        # Enviar email se SMTP estiver configurado
        sent = False
        send_error = None
        try:
            smtp_host = os.environ.get('SMTP_HOST')
            smtp_port = int(os.environ.get('SMTP_PORT', '587'))
            smtp_user = os.environ.get('SMTP_USER')
            smtp_pass = os.environ.get('SMTP_PASS')
            smtp_from = os.environ.get('SMTP_FROM') or smtp_user
            frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

            if smtp_host and smtp_user and smtp_pass and smtp_from:
                msg = EmailMessage()
                msg['Subject'] = 'Invictus Poker Team - Password reset'
                msg['From'] = smtp_from
                msg['To'] = user.email or smtp_user
                reset_link = f"{frontend_url}/#reset?token={token}"
                msg.set_content(
                    f"Hello {user.full_name or user.username},\n\n"
                    f"We received a request to reset your password.\n"
                    f"Use the token below in the app or click the link to proceed.\n\n"
                    f"Token: {token}\nLink: {reset_link}\n\n"
                    f"This token expires in 1 hour. If you did not request this, please ignore this email."
                )

                context = ssl.create_default_context()
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls(context=context)
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                sent = True
        except Exception as e:
            send_error = str(e)

        # Sempre responder 200 para não expor existência; inclui token para ambiente interno
        return jsonify({
            'message': 'Reset token generated',
            'reset_token': token,
            'expires_in_hours': 1,
            'email_sent': sent,
            'email_error': send_error if not sent else None,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/reset-password', methods=['POST'])
@sensitive_rate_limit
def reset_password():
    try:
        data = request.get_json()
        token = data.get('token')
        new_password = data.get('new_password')
        if not token or not new_password:
            return jsonify({'error': 'token and new_password are required'}), 400

        user = User.query.filter_by(password_reset_token=token).first()
        if not user or not user.password_reset_expires_at or user.password_reset_expires_at < datetime.utcnow():
            return jsonify({'error': 'Invalid or expired token'}), 400

        user.set_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires_at = None
        db.session.commit()

        return jsonify({'message': 'Password reset successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ====== 2FA management (admin/manager first-class) ======

def roles_admin_manager_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        user = User.query.get(session['user_id'])
        if not user or user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            return jsonify({'error': 'Only admin/manager can manage 2FA at this endpoint'}), 403
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/2fa/init', methods=['POST'])
@login_required
def init_2fa():
    try:
        user = User.query.get(session['user_id'])
        if not pyotp:
            return jsonify({'error': '2FA not available on server'}), 500
        # Para admin/manager: permitir imediatamente; demais podem habilitar opcionalmente
        secret = pyotp.random_base32()
        user.totp_secret = secret
        db.session.commit()
        # Provisioning URI para apps autenticadores
        issuer = 'InvictusPokerTeam'
        uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email or user.username, issuer_name=issuer)
        return jsonify({'secret': secret, 'provisioning_uri': uri}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/2fa/enable', methods=['POST'])
@login_required
def enable_2fa():
    try:
        if not pyotp:
            return jsonify({'error': '2FA not available on server'}), 500
        data = request.get_json()
        code = data.get('totp')
        if not code:
            return jsonify({'error': 'TOTP is required'}), 400
        user = User.query.get(session['user_id'])
        if not user.totp_secret:
            return jsonify({'error': '2FA not initialized'}), 400
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(str(code), valid_window=1):
            return jsonify({'error': 'Invalid TOTP'}), 400
        user.two_factor_enabled = True
        # Gerar recovery codes (10 códigos, uso único)
        codes = []
        for _ in range(10):
            code_val = secrets.token_urlsafe(8)
            codes.append({'code': code_val, 'used': False})
        user.recovery_codes = json.dumps(codes)
        db.session.commit()
        return jsonify({'message': '2FA enabled', 'recovery_codes': [c['code'] for c in codes]}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/2fa/disable', methods=['POST'])
@login_required
def disable_2fa():
    try:
        user = User.query.get(session['user_id'])
        data = request.get_json() or {}
        confirm = data.get('confirm')
        if not confirm:
            return jsonify({'error': 'Confirmation required'}), 400
        user.two_factor_enabled = False
        user.totp_secret = None
        user.recovery_codes = None
        db.session.commit()
        return jsonify({'message': '2FA disabled'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

