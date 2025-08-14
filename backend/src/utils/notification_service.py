#!/usr/bin/env python3
"""
Serviço de Notificações - Invictus Poker Team
Gerencia criação, envio e limpeza de notificações in-app.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import and_, or_, func
from src.models.models import db, User, UserRole, Account, ReloadRequest, WithdrawalRequest
from src.models.notifications import Notification, NotificationType, NotificationCategory, UserNotificationSettings
import logging

logger = logging.getLogger(__name__)

class NotificationService:
    """Serviço centralizado de notificações"""
    
    @staticmethod
    def create_notification(
        user_id: int,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
        category: NotificationCategory = NotificationCategory.SYSTEM_MESSAGE,
        is_urgent: bool = False,
        related_entity_type: str = None,
        related_entity_id: int = None,
        action_url: str = None,
        expires_hours: int = None
    ) -> Notification:
        """
        Cria uma nova notificação.
        
        Args:
            user_id: ID do usuário destinatário
            title: Título da notificação
            message: Mensagem detalhada
            notification_type: Tipo da notificação
            category: Categoria da notificação
            is_urgent: Se é urgente
            related_entity_type: Tipo da entidade relacionada
            related_entity_id: ID da entidade relacionada
            action_url: URL para ação direta
            expires_hours: Horas até expirar (None = não expira)
            
        Returns:
            Notification: Notificação criada
        """
        try:
            # Verificar se usuário existe
            user = User.query.get(user_id)
            if not user:
                logger.error(f"Usuário {user_id} não encontrado para notificação")
                return None
            
            # Verificar configurações do usuário
            settings = UserNotificationSettings.query.filter_by(user_id=user_id).first()
            if settings and settings.urgent_only and not is_urgent:
                logger.info(f"Notificação não urgente ignorada para usuário {user_id} (configuração)")
                return None
            
            # Verificar se categoria está habilitada
            if settings and not NotificationService._is_category_enabled(settings, category):
                logger.info(f"Categoria {category.value} desabilitada para usuário {user_id}")
                return None
            
            # Calcular expiração
            expires_at = None
            if expires_hours:
                expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
            
            # Criar notificação
            notification = Notification(
                user_id=user_id,
                title=title,
                message=message,
                notification_type=notification_type,
                category=category,
                is_urgent=is_urgent,
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                action_url=action_url,
                expires_at=expires_at
            )
            
            db.session.add(notification)
            db.session.commit()
            
            logger.info(f"Notificação criada: {title} para usuário {user_id}")
            return notification
            
        except Exception as e:
            logger.error(f"Erro ao criar notificação: {str(e)}")
            db.session.rollback()
            return None
    
    @staticmethod
    def _is_category_enabled(settings: UserNotificationSettings, category: NotificationCategory) -> bool:
        """Verifica se uma categoria está habilitada para o usuário"""
        category_mapping = {
            NotificationCategory.RELOAD_REQUEST: settings.reload_requests_enabled,
            NotificationCategory.WITHDRAWAL_REQUEST: settings.withdrawal_requests_enabled,
            NotificationCategory.ACCOUNT_UPDATE: settings.account_updates_enabled,
            NotificationCategory.SYSTEM_MESSAGE: settings.system_messages_enabled,
            NotificationCategory.PLAYER_ALERT: settings.player_alerts_enabled,
            NotificationCategory.COMPLIANCE: settings.compliance_enabled,
            NotificationCategory.PERFORMANCE: settings.performance_enabled,
        }
        
        return category_mapping.get(category, True)
    
    @staticmethod
    def notify_reload_request(reload_request: ReloadRequest, action: str = "created"):
        """Notifica sobre solicitação de reload"""
        try:
            player = reload_request.user
            platform = reload_request.platform
            
            if action == "created":
                # Notificar admins e managers
                admins_managers = User.query.filter(
                    User.role.in_([UserRole.ADMIN, UserRole.MANAGER]),
                    User.is_active == True
                ).all()
                
                for admin in admins_managers:
                    NotificationService.create_notification(
                        user_id=admin.id,
                        title="💰 Nova Solicitação de Reload",
                        message=f"{player.full_name} solicitou reload de $ {float(reload_request.amount):,.2f} na {platform.display_name}",
                        notification_type=NotificationType.WARNING,
                        category=NotificationCategory.RELOAD_REQUEST,
                        is_urgent=True,
                        related_entity_type="reload_request",
                        related_entity_id=reload_request.id,
                        action_url=f"/dashboard?tab=gestao&subtab=reloads",
                        expires_hours=72
                    )
                
                # Notificar o próprio jogador
                NotificationService.create_notification(
                    user_id=player.id,
                    title="✅ Solicitação de Reload Enviada",
                    message=f"Sua solicitação de $ {float(reload_request.amount):,.2f} na {platform.display_name} foi enviada e está aguardando aprovação.",
                    notification_type=NotificationType.SUCCESS,
                    category=NotificationCategory.RELOAD_REQUEST,
                    related_entity_type="reload_request",
                    related_entity_id=reload_request.id,
                    expires_hours=168  # 1 semana
                )
            
            elif action == "approved":
                NotificationService.create_notification(
                    user_id=player.id,
                    title="🎉 Reload Aprovado!",
                    message=f"Seu reload de $ {float(reload_request.amount):,.2f} na {platform.display_name} foi aprovado!",
                    notification_type=NotificationType.SUCCESS,
                    category=NotificationCategory.RELOAD_REQUEST,
                    related_entity_type="reload_request",
                    related_entity_id=reload_request.id,
                    expires_hours=48
                )
            
            elif action == "rejected":
                NotificationService.create_notification(
                    user_id=player.id,
                    title="❌ Reload Rejeitado",
                    message=f"Seu reload de $ {float(reload_request.amount):,.2f} na {platform.display_name} foi rejeitado. Entre em contato com a gestão.",
                    notification_type=NotificationType.ERROR,
                    category=NotificationCategory.RELOAD_REQUEST,
                    is_urgent=True,
                    related_entity_type="reload_request",
                    related_entity_id=reload_request.id,
                    expires_hours=168
                )
                
        except Exception as e:
            logger.error(f"Erro ao notificar reload request: {str(e)}")
    
    @staticmethod
    def notify_withdrawal_request(withdrawal_request: WithdrawalRequest, action: str = "created"):
        """Notifica sobre solicitação de saque"""
        try:
            player = withdrawal_request.user
            
            if action == "created":
                # Notificar admins
                admins = User.query.filter(
                    User.role == UserRole.ADMIN,
                    User.is_active == True
                ).all()
                
                for admin in admins:
                    NotificationService.create_notification(
                        user_id=admin.id,
                        title="💸 Nova Solicitação de Saque",
                        message=f"{player.full_name} solicitou saque de $ {float(withdrawal_request.amount):,.2f}",
                        notification_type=NotificationType.WARNING,
                        category=NotificationCategory.WITHDRAWAL_REQUEST,
                        is_urgent=True,
                        related_entity_type="withdrawal_request",
                        related_entity_id=withdrawal_request.id,
                        action_url=f"/dashboard?tab=gestao&subtab=withdrawals",
                        expires_hours=48
                    )
                
                # Notificar o jogador
                NotificationService.create_notification(
                    user_id=player.id,
                    title="✅ Solicitação de Saque Enviada",
                    message=f"Sua solicitação de saque de $ {float(withdrawal_request.amount):,.2f} foi enviada e está sendo processada.",
                    notification_type=NotificationType.SUCCESS,
                    category=NotificationCategory.WITHDRAWAL_REQUEST,
                    related_entity_type="withdrawal_request",
                    related_entity_id=withdrawal_request.id,
                    expires_hours=168
                )
            
            elif action == "completed":
                NotificationService.create_notification(
                    user_id=player.id,
                    title="💰 Saque Processado!",
                    message=f"Seu saque de $ {float(withdrawal_request.amount):,.2f} foi processado com sucesso!",
                    notification_type=NotificationType.SUCCESS,
                    category=NotificationCategory.WITHDRAWAL_REQUEST,
                    related_entity_type="withdrawal_request",
                    related_entity_id=withdrawal_request.id,
                    expires_hours=48
                )
                
        except Exception as e:
            logger.error(f"Erro ao notificar withdrawal request: {str(e)}")
    
    @staticmethod
    def notify_incomplete_data():
        """Notifica jogadores com dados incompletos"""
        try:
            # Importar aqui para evitar import circular
            from src.models.models import RequiredField, PlayerFieldValue
            
            # Buscar jogadores ativos
            players = User.query.filter(
                User.role == UserRole.PLAYER,
                User.is_active == True
            ).all()
            
            for player in players:
                issues = []
                
                # Verificar campos obrigatórios não preenchidos
                required_fields = RequiredField.query.filter_by(
                    is_required=True,
                    is_active=True
                ).all()
                
                if required_fields:
                    filled_values = PlayerFieldValue.query.filter(
                        PlayerFieldValue.user_id == player.id,
                        PlayerFieldValue.field_id.in_([f.id for f in required_fields]),
                        PlayerFieldValue.field_value != None,
                        PlayerFieldValue.field_value != ''
                    ).all()
                    
                    filled_field_ids = {v.field_id for v in filled_values}
                    missing_fields = []
                    
                    for field in required_fields:
                        if field.id not in filled_field_ids:
                            missing_fields.append(field.field_label)
                    
                    if missing_fields:
                        issues.append(f"Campos pendentes: {', '.join(missing_fields)}")
                
                # Verificar contas sem saldo definido
                incomplete_accounts = Account.query.filter(
                    Account.user_id == player.id,
                    Account.is_active == True,
                    or_(
                        Account.current_balance == None,
                        Account.current_balance == 0,
                        Account.has_account == False
                    )
                ).count()
                
                if incomplete_accounts > 0:
                    issues.append(f"{incomplete_accounts} conta(s) com dados incompletos")
                
                # Verificar reloads pendentes antigos
                old_pending_reloads = ReloadRequest.query.filter(
                    ReloadRequest.user_id == player.id,
                    ReloadRequest.status == 'pending',
                    ReloadRequest.created_at < datetime.utcnow() - timedelta(days=3)
                ).count()
                
                if old_pending_reloads > 0:
                    issues.append(f"{old_pending_reloads} reload(s) pendente(s) há mais de 3 dias")
                
                # Se há problemas, notificar
                if issues:
                    NotificationService.create_notification(
                        user_id=player.id,
                        title="⚠️ Dados Incompletos",
                        message=f"Você tem: {', '.join(issues)}. Complete suas informações para melhor gestão.",
                        notification_type=NotificationType.WARNING,
                        category=NotificationCategory.PLAYER_ALERT,
                        action_url="/dashboard?tab=planilha",
                        expires_hours=168  # 1 semana
                    )
                
        except Exception as e:
            logger.error(f"Erro ao verificar dados incompletos: {str(e)}")
    
    @staticmethod
    def notify_performance_alert(user_id: int, alert_type: str, data: dict):
        """Notifica sobre alertas de performance"""
        try:
            if alert_type == "negative_streak":
                days = data.get('days', 0)
                loss_amount = data.get('amount', 0)
                
                NotificationService.create_notification(
                    user_id=user_id,
                    title="📉 Alerta de Performance",
                    message=f"Sequência negativa de {days} dias com prejuízo total de $ {loss_amount:,.2f}. Considere revisar sua estratégia.",
                    notification_type=NotificationType.WARNING,
                    category=NotificationCategory.PERFORMANCE,
                    is_urgent=True,
                    expires_hours=48
                )
            
            elif alert_type == "profit_milestone":
                amount = data.get('amount', 0)
                
                NotificationService.create_notification(
                    user_id=user_id,
                    title="🎯 Meta Alcançada!",
                    message=f"Parabéns! Você atingiu $ {amount:,.2f} de lucro este mês!",
                    notification_type=NotificationType.SUCCESS,
                    category=NotificationCategory.PERFORMANCE,
                    expires_hours=24
                )
                
        except Exception as e:
            logger.error(f"Erro ao notificar performance: {str(e)}")
    
    @staticmethod
    def get_user_notifications(user_id: int, unread_only: bool = False, limit: int = 50) -> List[Notification]:
        """Busca notificações de um usuário"""
        try:
            query = Notification.query.filter(Notification.user_id == user_id)
            
            # Filtrar apenas não lidas
            if unread_only:
                query = query.filter(Notification.is_read == False)
            
            # Filtrar expiradas
            query = query.filter(
                or_(
                    Notification.expires_at.is_(None),
                    Notification.expires_at > datetime.utcnow()
                )
            )
            
            # Ordenar por urgência e data
            query = query.order_by(
                Notification.is_urgent.desc(),
                Notification.created_at.desc()
            )
            
            return query.limit(limit).all()
            
        except Exception as e:
            logger.error(f"Erro ao buscar notificações: {str(e)}")
            return []
    
    @staticmethod
    def mark_as_read(notification_id: int, user_id: int) -> bool:
        """Marca notificação como lida"""
        try:
            notification = Notification.query.filter(
                Notification.id == notification_id,
                Notification.user_id == user_id
            ).first()
            
            if notification and not notification.is_read:
                notification.is_read = True
                notification.read_at = datetime.utcnow()
                db.session.commit()
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Erro ao marcar notificação como lida: {str(e)}")
            db.session.rollback()
            return False
    
    @staticmethod
    def mark_all_as_read(user_id: int) -> int:
        """Marca todas as notificações como lidas"""
        try:
            count = Notification.query.filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            ).update({
                'is_read': True,
                'read_at': datetime.utcnow()
            })
            
            db.session.commit()
            return count
            
        except Exception as e:
            logger.error(f"Erro ao marcar todas como lidas: {str(e)}")
            db.session.rollback()
            return 0
    
    @staticmethod
    def clean_old_notifications(days: int = 30):
        """Remove notificações antigas"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            count = Notification.query.filter(
                Notification.created_at < cutoff_date,
                Notification.is_read == True
            ).delete()
            
            db.session.commit()
            logger.info(f"Removidas {count} notificações antigas")
            
        except Exception as e:
            logger.error(f"Erro ao limpar notificações antigas: {str(e)}")
            db.session.rollback()
    
    @staticmethod
    def get_notification_stats(user_id: int) -> dict:
        """Estatísticas de notificações do usuário"""
        try:
            total = Notification.query.filter(Notification.user_id == user_id).count()
            unread = Notification.query.filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            ).count()
            urgent = Notification.query.filter(
                Notification.user_id == user_id,
                Notification.is_urgent == True,
                Notification.is_read == False
            ).count()
            
            return {
                'total': total,
                'unread': unread,
                'urgent': urgent
            }
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas: {str(e)}")
            return {'total': 0, 'unread': 0, 'urgent': 0}

# Instância global do serviço
notification_service = NotificationService()

def get_notification_service() -> NotificationService:
    """Retorna a instância global do serviço de notificações"""
    return notification_service

