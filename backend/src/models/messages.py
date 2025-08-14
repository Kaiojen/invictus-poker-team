from src.models.models import db
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

class MessageType(enum.Enum):
    DIRECT = "direct"
    SYSTEM = "system"
    BROADCAST = "broadcast"

class MessagePriority(enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class Message(db.Model):
    """Modelo para sistema de mensagens internas"""
    __tablename__ = 'messages'
    
    id = Column(Integer, primary_key=True)
    
    # Remetente e destinatário
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    recipient_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Conteúdo
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(Enum(MessageType), nullable=False, default=MessageType.DIRECT)
    priority = Column(Enum(MessagePriority), nullable=False, default=MessagePriority.NORMAL)
    
    # Status
    is_read = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    
    # Thread (para respostas)
    parent_message_id = Column(Integer, ForeignKey('messages.id'), nullable=True)
    thread_id = Column(String(50), nullable=True)  # Para agrupar conversas
    
    # Metadados
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    
    # Relacionamentos
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_id], backref="received_messages")
    parent_message = relationship("Message", remote_side=[id], backref="replies")
    
    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'recipient_id': self.recipient_id,
            'sender_name': self.sender.full_name if self.sender else None,
            'recipient_name': self.recipient.full_name if self.recipient else None,
            'subject': self.subject,
            'content': self.content,
            'message_type': self.message_type.value,
            'priority': self.priority.value,
            'is_read': self.is_read,
            'is_archived': self.is_archived,
            'parent_message_id': self.parent_message_id,
            'thread_id': self.thread_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'replied_at': self.replied_at.isoformat() if self.replied_at else None,
            'time_ago': self._get_time_ago(),
            'reply_count': len(self.replies) if hasattr(self, 'replies') else 0
        }
    
    def _get_time_ago(self):
        """Calcula tempo relativo da mensagem"""
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

class MessageAttachment(db.Model):
    """Anexos de mensagens"""
    __tablename__ = 'message_attachments'
    
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey('messages.id'), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    message = relationship("Message", backref="attachments")
    
    def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.message_id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

