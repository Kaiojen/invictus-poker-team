from src.models.models import db
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

class NotificationType(enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    URGENT = "URGENT"
    ACTION_REQUIRED = "ACTION_REQUIRED"

class NotificationCategory(enum.Enum):
    RELOAD_REQUEST = "RELOAD_REQUEST"
    WITHDRAWAL_REQUEST = "WITHDRAWAL_REQUEST"
    ACCOUNT_UPDATE = "ACCOUNT_UPDATE"
    SYSTEM_MESSAGE = "SYSTEM_MESSAGE"
    PLAYER_ALERT = "PLAYER_ALERT"
    REGISTRATION = "REGISTRATION"
    COMPLIANCE = "compliance"
    PERFORMANCE = "performance"

class Notification(db.Model):
    """Modelo de notificações in-app"""
    __tablename__ = 'notifications'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False, default=NotificationType.INFO)
    category = Column(Enum(NotificationCategory), nullable=False)
    
    # Metadados
    is_read = Column(Boolean, default=False, nullable=False)
    is_urgent = Column(Boolean, default=False, nullable=False)
    
    # Dados relacionados (opcional)
    related_entity_type = Column(String(50), nullable=True)  # 'reload_request', 'account', etc.
    related_entity_id = Column(Integer, nullable=True)
    action_url = Column(String(500), nullable=True)  # URL para ação direta
    
    # Datas
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Notificações temporárias
    
    # Relacionamentos
    user = relationship("User", backref="notifications")
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'notification_type': self.notification_type.value,
            'category': self.category.value,
            'is_read': self.is_read,
            'is_urgent': self.is_urgent,
            'related_entity_type': self.related_entity_type,
            'related_entity_id': self.related_entity_id,
            'action_url': self.action_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'time_ago': self._get_time_ago()
        }
    
    def _get_time_ago(self):
        """Calcula tempo relativo da notificação"""
        if not self.created_at:
            return ""
        
        now = datetime.utcnow()
        diff = now - self.created_at
        
        if diff.days > 0:
            return f"{diff.days}d atrás"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours}h atrás"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes}m atrás"
        else:
            return "Agora"

class UserNotificationSettings(db.Model):
    """Configurações de notificação por usuário"""
    __tablename__ = 'user_notification_settings'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    
    # Configurações por categoria
    reload_requests_enabled = Column(Boolean, default=True)
    withdrawal_requests_enabled = Column(Boolean, default=True)
    account_updates_enabled = Column(Boolean, default=True)
    system_messages_enabled = Column(Boolean, default=True)
    player_alerts_enabled = Column(Boolean, default=True)
    compliance_enabled = Column(Boolean, default=True)
    performance_enabled = Column(Boolean, default=True)
    
    # Configurações gerais
    email_notifications_enabled = Column(Boolean, default=False)
    urgent_only = Column(Boolean, default=False)
    
    # Datas
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    user = relationship("User", backref="notification_settings")
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'reload_requests_enabled': self.reload_requests_enabled,
            'withdrawal_requests_enabled': self.withdrawal_requests_enabled,
            'account_updates_enabled': self.account_updates_enabled,
            'system_messages_enabled': self.system_messages_enabled,
            'player_alerts_enabled': self.player_alerts_enabled,
            'compliance_enabled': self.compliance_enabled,
            'performance_enabled': self.performance_enabled,
            'email_notifications_enabled': self.email_notifications_enabled,
            'urgent_only': self.urgent_only
        }

