"""
CSRF Protection middleware para proteger formulários mutantes.
"""
import hmac
import hashlib
import secrets
import time
from functools import wraps
from flask import request, jsonify, session, g


class CSRFProtection:
    """Proteção CSRF usando double-submit cookie pattern"""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key.encode() if isinstance(secret_key, str) else secret_key
    
    def generate_token(self, user_id: str = None) -> str:
        """Gerar token CSRF único"""
        timestamp = str(int(time.time()))
        user_id = user_id or session.get('user_id', 'anonymous')
        
        # Criar payload: timestamp:user_id:random
        random_bytes = secrets.token_hex(16)
        payload = f"{timestamp}:{user_id}:{random_bytes}"
        
        # Assinar com HMAC
        signature = hmac.new(
            self.secret_key,
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{payload}:{signature}"
    
    def validate_token(self, token: str, user_id: str = None, max_age: int = 3600) -> bool:
        """Validar token CSRF"""
        try:
            if not token:
                return False
            
            parts = token.split(':')
            if len(parts) != 4:
                return False
            
            timestamp_str, token_user_id, random_part, signature = parts
            
            # Verificar timestamp (expiração)
            timestamp = int(timestamp_str)
            if time.time() - timestamp > max_age:
                return False
            
            # Verificar user_id
            current_user_id = user_id or session.get('user_id', 'anonymous')
            if token_user_id != str(current_user_id):
                return False
            
            # Verificar assinatura
            payload = f"{timestamp_str}:{token_user_id}:{random_part}"
            expected_signature = hmac.new(
                self.secret_key,
                payload.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_signature)
            
        except (ValueError, TypeError):
            return False


# Instância global
csrf_protection = None


def init_csrf_protection(secret_key: str):
    """Inicializar proteção CSRF"""
    global csrf_protection
    csrf_protection = CSRFProtection(secret_key)


def csrf_protect(f):
    """
    Decorator para proteger rotas contra CSRF.
    Aplica apenas em métodos mutantes (POST, PUT, DELETE, PATCH).
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Aplicar apenas em métodos mutantes
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return f(*args, **kwargs)
        
        if not csrf_protection:
            # CSRF não configurado - permitir (modo dev)
            return f(*args, **kwargs)
        
        # Obter token do header ou form
        token = (
            request.headers.get('X-CSRF-Token') or
            request.form.get('csrf_token') or
            (request.get_json() or {}).get('csrf_token')
        )
        
        if not token:
            return jsonify({
                'error': 'CSRF token missing',
                'message': 'CSRF token is required for this operation'
            }), 403
        
        # Validar token
        user_id = session.get('user_id')
        if not csrf_protection.validate_token(token, str(user_id) if user_id else None):
            return jsonify({
                'error': 'CSRF token invalid',
                'message': 'Invalid or expired CSRF token'
            }), 403
        
        return f(*args, **kwargs)
    
    wrapper.__name__ = f.__name__
    return wrapper


def get_csrf_token() -> str:
    """Obter token CSRF atual para o usuário logado"""
    if not csrf_protection:
        return "csrf-disabled"
    
    user_id = session.get('user_id')
    return csrf_protection.generate_token(str(user_id) if user_id else None)


def csrf_exempt(f):
    """Decorator para isentar rota de proteção CSRF"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        g.csrf_exempt = True
        return f(*args, **kwargs)
    
    wrapper.__name__ = f.__name__
    return wrapper


