"""
Middleware para auditoria automática de ações críticas
Fase 3 - Sistema de Auditoria Completo
"""

from functools import wraps
from flask import request, session, g
from src.models.models import db, AuditLog, User
from src.routes.audit import log_action
import json

def audit_action(action_name, entity_type=None, include_body=False):
    """
    Decorator para auditoria automática de rotas
    
    Args:
        action_name (str): Nome da ação (ex: 'balance_updated', 'user_created')
        entity_type (str): Tipo da entidade (ex: 'Account', 'User')
        include_body (bool): Se deve incluir o body da requisição nos logs
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Executar a função original primeiro
            result = f(*args, **kwargs)
            
            # Só criar log se a operação foi bem-sucedida
            if hasattr(result, 'status_code') and 200 <= result.status_code < 300:
                try:
                    user_id = session.get('user_id')
                    if user_id:
                        # Extrair ID da entidade da URL se possível
                        entity_id = None
                        if entity_type and kwargs:
                            # Tentar encontrar ID nos parâmetros da rota
                            for key, value in kwargs.items():
                                if key.endswith('_id') or key == 'id':
                                    entity_id = value
                                    break
                        
                        # Preparar valores para log
                        new_values = {}
                        if include_body and request.is_json:
                            new_values = request.get_json() or {}
                        
                        # Remover dados sensíveis
                        if 'password' in new_values:
                            new_values['password'] = '[REDACTED]'
                        
                        # Criar log de auditoria
                        log_action(
                            user_id=user_id,
                            action=action_name,
                            entity_type=entity_type or 'Unknown',
                            entity_id=entity_id or 0,
                            old_values=None,
                            new_values=new_values if new_values else None,
                            request_obj=request
                        )
                        
                        # Commit do log (não falhar a operação principal)
                        try:
                            db.session.commit()
                        except Exception as e:
                            print(f"Erro ao salvar log de auditoria: {e}")
                            db.session.rollback()
                            
                except Exception as e:
                    print(f"Erro no middleware de auditoria: {e}")
            
            return result
        
        return decorated_function
    return decorator

def audit_model_changes(model_class, action, user_id, old_values=None, new_values=None):
    """
    Função utilitária para auditoria de mudanças em modelos
    
    Args:
        model_class: Classe do modelo (User, Account, etc.)
        action: Ação realizada ('created', 'updated', 'deleted')
        user_id: ID do usuário que realizou a ação
        old_values: Valores antigos (para updates)
        new_values: Valores novos
    """
    try:
        entity_type = model_class.__name__
        entity_id = new_values.get('id') if new_values else (old_values.get('id') if old_values else 0)
        
        log_action(
            user_id=user_id,
            action=f"{entity_type.lower()}_{action}",
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values
        )
        
    except Exception as e:
        print(f"Erro ao criar log de modelo: {e}")

# Decorators específicos para operações comuns
def audit_balance_update(f):
    """Decorator específico para atualizações de saldo"""
    return audit_action('balance_updated', 'Account', include_body=True)(f)

def audit_user_creation(f):
    """Decorator específico para criação de usuários"""
    return audit_action('user_created', 'User', include_body=False)(f)

def audit_reload_approval(f):
    """Decorator específico para aprovação de reload"""
    return audit_action('reload_approved', 'ReloadRequest', include_body=True)(f)

def audit_transaction_creation(f):
    """Decorator específico para criação de transações"""
    return audit_action('transaction_created', 'Transaction', include_body=True)(f)

def audit_system_action(f):
    """Decorator para ações administrativas do sistema"""
    return audit_action('system_action', 'System', include_body=False)(f)

class AuditTracker:
    """Classe para rastreamento de mudanças em sessão"""
    
    def __init__(self):
        self.changes = []
    
    def track_change(self, entity_type, entity_id, action, old_data=None, new_data=None):
        """Rastrear uma mudança para commit posterior"""
        self.changes.append({
            'entity_type': entity_type,
            'entity_id': entity_id,
            'action': action,
            'old_data': old_data,
            'new_data': new_data
        })
    
    def commit_changes(self, user_id):
        """Commit todas as mudanças rastreadas"""
        for change in self.changes:
            log_action(
                user_id=user_id,
                action=f"{change['entity_type'].lower()}_{change['action']}",
                entity_type=change['entity_type'],
                entity_id=change['entity_id'],
                old_values=change['old_data'],
                new_values=change['new_data']
            )
        
        try:
            db.session.commit()
            self.changes.clear()
        except Exception as e:
            print(f"Erro ao commit de mudanças de auditoria: {e}")
            db.session.rollback()

# Instância global do tracker
audit_tracker = AuditTracker()

def get_current_user_for_audit():
    """Obter usuário atual para logs de auditoria"""
    try:
        user_id = session.get('user_id')
        if user_id:
            return User.query.get(user_id)
    except:
        pass
    return None

def create_security_log(event_type, details, severity='INFO'):
    """
    Criar log de segurança para eventos importantes
    
    Args:
        event_type: Tipo do evento ('login_attempt', 'unauthorized_access', etc.)
        details: Detalhes do evento
        severity: Severidade ('INFO', 'WARNING', 'CRITICAL')
    """
    try:
        user = get_current_user_for_audit()
        user_id = user.id if user else 1  # Sistema
        
        log_action(
            user_id=user_id,
            action=f"security_{event_type}",
            entity_type='Security',
            entity_id=0,
            old_values=None,
            new_values={
                'event_type': event_type,
                'details': details,
                'severity': severity,
                'timestamp': str(db.func.now())
            },
            request_obj=request if request else None
        )
        
        db.session.commit()
        
    except Exception as e:
        print(f"Erro ao criar log de segurança: {e}")

# Configurações de auditoria
AUDIT_CONFIG = {
    'enabled': True,
    'log_successful_logins': True,
    'log_failed_logins': True,
    'log_balance_changes': True,
    'log_user_modifications': True,
    'log_admin_actions': True,
    'retention_days': 365,  # Manter logs por 1 ano
    'sensitive_fields': ['password', 'password_hash', 'pix_key', 'bank_account'],
    'max_log_size': 10000  # Máximo caracteres por campo de log
}

def should_audit_action(action_type):
    """Verificar se uma ação deve ser auditada"""
    if not AUDIT_CONFIG['enabled']:
        return False
    
    # Regras específicas de auditoria
    audit_rules = {
        'login': AUDIT_CONFIG['log_successful_logins'],
        'login_failed': AUDIT_CONFIG['log_failed_logins'],
        'balance_update': AUDIT_CONFIG['log_balance_changes'],
        'user_update': AUDIT_CONFIG['log_user_modifications'],
        'admin_action': AUDIT_CONFIG['log_admin_actions']
    }
    
    return audit_rules.get(action_type, True)  # Default: auditar

def sanitize_log_data(data):
    """Sanitizar dados sensíveis antes de logar"""
    if not isinstance(data, dict):
        return data
    
    sanitized = data.copy()
    
    for field in AUDIT_CONFIG['sensitive_fields']:
        if field in sanitized:
            sanitized[field] = '[REDACTED]'
    
    # Limitar tamanho dos campos
    for key, value in sanitized.items():
        if isinstance(value, str) and len(value) > AUDIT_CONFIG['max_log_size']:
            sanitized[key] = value[:AUDIT_CONFIG['max_log_size']] + '[TRUNCATED]'
    
    return sanitized
