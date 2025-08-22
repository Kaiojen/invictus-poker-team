"""
Rate Limiting middleware para proteger endpoints críticos.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask import request, jsonify
import time
from typing import Dict, List
from datetime import datetime, timedelta
import redis


class RateLimiter:
    """Rate limiter com bloqueio progressivo"""
    
    def __init__(self, app=None):
        self.limiter = None
        self.failed_attempts: Dict[str, List[datetime]] = {}
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Inicializar rate limiter com a app Flask"""
        try:
            # Tentar usar Redis se disponível
            from redis import Redis
            redis_client = Redis(host='localhost', port=6379, db=0, decode_responses=True)
            redis_client.ping()
            storage_uri = "redis://localhost:6379"
        except:
            # Fallback para in-memory storage
            storage_uri = "memory://"
        
        self.limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            storage_uri=storage_uri,
            default_limits=["200 per day", "50 per hour"],
            headers_enabled=True
        )
        
        # Rate limits específicos por endpoint
        @self.limiter.limit("5 per minute")
        def login_limit():
            pass
        
        @self.limiter.limit("3 per minute")
        def sensitive_limit():
            pass
        
        @self.limiter.limit("10 per minute")
        def api_limit():
            pass
        
        # Registrar handlers de erro
        @app.errorhandler(429)
        def ratelimit_handler(e):
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': 'Too many requests. Please try again later.',
                'retry_after': e.retry_after
            }), 429
    
    def get_delay_for_ip(self, ip: str) -> int:
        """Calcular delay progressivo baseado em tentativas falhadas"""
        if ip not in self.failed_attempts:
            return 0
        
        # Limpar tentativas antigas (> 1 hora)
        cutoff = datetime.now() - timedelta(hours=1)
        self.failed_attempts[ip] = [
            attempt for attempt in self.failed_attempts[ip] 
            if attempt > cutoff
        ]
        
        failed_count = len(self.failed_attempts[ip])
        
        if failed_count == 0:
            return 0
        elif failed_count <= 3:
            return 0
        elif failed_count <= 5:
            return 5  # 5 segundos
        elif failed_count <= 10:
            return 30  # 30 segundos
        else:
            return 300  # 5 minutos
    
    def record_failed_attempt(self, ip: str):
        """Registrar tentativa falhada"""
        if ip not in self.failed_attempts:
            self.failed_attempts[ip] = []
        
        self.failed_attempts[ip].append(datetime.now())
        
        # Manter apenas últimas 20 tentativas
        if len(self.failed_attempts[ip]) > 20:
            self.failed_attempts[ip] = self.failed_attempts[ip][-20:]
    
    def clear_failed_attempts(self, ip: str):
        """Limpar tentativas falhadas após sucesso"""
        if ip in self.failed_attempts:
            del self.failed_attempts[ip]


# Instância global
rate_limiter = RateLimiter()


def progressive_limit(endpoint_type: str = "api"):
    """
    Decorator para aplicar rate limiting progressivo
    
    Args:
        endpoint_type: 'login', 'sensitive', 'api'
    """
    def decorator(f):
        # Seleciona o decorador de limite apropriado
        if endpoint_type == "login":
            limit_decorator = rate_limiter.limiter.limit("5 per minute") if rate_limiter.limiter else (lambda x: x)
        elif endpoint_type == "sensitive":
            limit_decorator = rate_limiter.limiter.limit("3 per minute") if rate_limiter.limiter else (lambda x: x)
        else:
            limit_decorator = rate_limiter.limiter.limit("10 per minute") if rate_limiter.limiter else (lambda x: x)

        @limit_decorator
        def wrapped(*args, **kwargs):
            ip = get_remote_address()
            delay = rate_limiter.get_delay_for_ip(ip)

            if delay > 0:
                return jsonify({
                    'error': 'Too many failed attempts',
                    'message': f'Please wait {delay} seconds before trying again',
                    'retry_after': delay
                }), 429

            return f(*args, **kwargs)

        wrapped.__name__ = f.__name__
        return wrapped
    return decorator


def login_rate_limit(f):
    """Decorator específico para rotas de login"""
    return progressive_limit("login")(f)


def sensitive_rate_limit(f):
    """Decorator específico para rotas sensíveis"""
    return progressive_limit("sensitive")(f)


def api_rate_limit(f):
    """Decorator específico para rotas de API"""
    return progressive_limit("api")(f)


