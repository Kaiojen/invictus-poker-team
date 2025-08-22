"""
Testes dos Services - Camada de Negócio
"""
import pytest
from unittest.mock import patch, MagicMock
from src.services.reloads import ReloadService, ApproveReloadDTO, RejectReloadDTO
from src.services.transactions import TransactionService, CreateTransactionDTO
from src.services.withdrawals import WithdrawalService, ApproveWithdrawalDTO
from src.models.models import ReloadRequest, ReloadStatus, TransactionType, WithdrawalRequest, WithdrawalStatus


@pytest.mark.unit
class TestReloadService:
    """Testes do ReloadService"""
    
    def test_approve_reload_success(self, db_session, player_user, platforms, player_accounts):
        """Teste de aprovação de reload com sucesso"""
        from src.models.models import Account
        
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        ps_account = next(acc for acc in player_accounts if acc.platform.name == 'pokerstars')
        
        # Criar reload request pendente
        reload = ReloadRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=100.0,
            status=ReloadStatus.PENDING,
            player_notes="Preciso de reload"
        )
        db_session.add(reload)
        db_session.commit()
        
        # Saldo inicial
        initial_balance = ps_account.current_balance
        
        # Aprovar reload
        dto = ApproveReloadDTO(
            reload_id=reload.id,
            manager_id=1,  # Admin ID
            manager_notes="Aprovado para testes"
        )
        
        approved_reload = ReloadService.approve(dto)
        
        # Verificações
        assert approved_reload.status == ReloadStatus.APPROVED
        assert approved_reload.manager_notes == "Aprovado para testes"
        assert approved_reload.approved_by == 1
        assert approved_reload.approved_at is not None
        
        # Verificar atualização do saldo
        db_session.refresh(ps_account)
        from decimal import Decimal
        assert ps_account.current_balance == initial_balance + Decimal('100.0')
        assert ps_account.total_reloads == Decimal('100.0')

    def test_approve_reload_invalid_status(self, db_session, player_user, platforms):
        """Teste de erro ao aprovar reload já processado"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        
        # Reload já aprovado
        reload = ReloadRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=100.0,
            status=ReloadStatus.APPROVED  # Já aprovado
        )
        db_session.add(reload)
        db_session.commit()
        
        dto = ApproveReloadDTO(reload_id=reload.id, manager_id=1)
        
        with pytest.raises(ValueError, match="request is not pending"):
            ReloadService.approve(dto)

    def test_reject_reload_success(self, db_session, player_user, platforms):
        """Teste de rejeição de reload"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        
        reload = ReloadRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=100.0,
            status=ReloadStatus.PENDING
        )
        db_session.add(reload)
        db_session.commit()
        
        dto = RejectReloadDTO(
            reload_id=reload.id,
            manager_id=1,
            manager_notes="Dados insuficientes"
        )
        
        rejected_reload = ReloadService.reject(dto)
        
        assert rejected_reload.status == ReloadStatus.REJECTED
        assert rejected_reload.manager_notes == "Dados insuficientes"


@pytest.mark.unit
class TestTransactionService:
    """Testes do TransactionService"""
    
    def test_create_transaction_success(self, db_session, player_user, platforms):
        """Teste de criação de transação válida"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        
        dto = CreateTransactionDTO(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            transaction_type="reload",
            amount=150.0,
            created_by=1
        )
        
        transaction = TransactionService.create(dto)
        
        assert transaction.user_id == player_user.id
        assert transaction.platform_id == ps_platform.id
        assert transaction.transaction_type == TransactionType.RELOAD
        assert float(transaction.amount) == 150.0

    def test_create_transaction_invalid_amount(self, db_session, player_user, platforms):
        """Teste de erro com valor inválido"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        
        dto = CreateTransactionDTO(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            transaction_type="reload",
            amount=-50.0  # Valor negativo
        )
        
        with pytest.raises(ValueError, match="amount must be positive"):
            TransactionService.create(dto)

    def test_create_transaction_invalid_type(self, db_session, player_user, platforms):
        """Teste de erro com tipo inválido"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        
        dto = CreateTransactionDTO(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            transaction_type="invalid_type",  # Tipo inválido
            amount=100.0
        )
        
        with pytest.raises(ValueError, match="invalid transaction_type"):
            TransactionService.create(dto)


@pytest.mark.unit
class TestWithdrawalService:
    """Testes do WithdrawalService"""
    
    def test_approve_withdrawal_success(self, db_session, player_user, platforms, player_accounts):
        """Teste de aprovação de saque com sucesso"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        ps_account = next(acc for acc in player_accounts if acc.platform.name == 'pokerstars')
        
        # Garantir saldo suficiente
        from decimal import Decimal
        ps_account.current_balance = Decimal('100.0')
        db_session.commit()
        
        # Criar withdrawal request
        withdrawal = WithdrawalRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=50.0,
            status=WithdrawalStatus.PENDING
        )
        db_session.add(withdrawal)
        db_session.commit()
        
        dto = ApproveWithdrawalDTO(
            withdrawal_id=withdrawal.id,
            manager_id=1,
            manager_notes="Saque aprovado"
        )
        
        approved_withdrawal = WithdrawalService.approve(dto)
        
        assert approved_withdrawal.status == WithdrawalStatus.APPROVED
        assert approved_withdrawal.manager_notes == "Saque aprovado"
        
        # Verificar desconto no saldo
        db_session.refresh(ps_account)
        from decimal import Decimal
        assert ps_account.current_balance == Decimal('50.0')  # 100 - 50

    def test_approve_withdrawal_insufficient_balance(self, db_session, player_user, platforms, player_accounts):
        """Teste de erro por saldo insuficiente"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        ps_account = next(acc for acc in player_accounts if acc.platform.name == 'pokerstars')
        
        # Saldo menor que o saque
        from decimal import Decimal
        ps_account.current_balance = Decimal('30.0')
        db_session.commit()
        
        withdrawal = WithdrawalRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=50.0,  # Maior que o saldo
            status=WithdrawalStatus.PENDING
        )
        db_session.add(withdrawal)
        db_session.commit()
        
        dto = ApproveWithdrawalDTO(withdrawal_id=withdrawal.id, manager_id=1)
        
        with pytest.raises(ValueError, match="insufficient balance"):
            WithdrawalService.approve(dto)


@pytest.mark.integration
class TestServiceIntegration:
    """Testes de integração entre serviços"""
    
    @patch('src.services.reloads.notify_reload_approved')
    def test_reload_approval_with_sse_notification(self, mock_sse, db_session, player_user, platforms, player_accounts):
        """Teste de integração: aprovação de reload com notificação SSE"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        
        reload = ReloadRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=200.0,
            status=ReloadStatus.PENDING
        )
        db_session.add(reload)
        db_session.commit()
        
        dto = ApproveReloadDTO(reload_id=reload.id, manager_id=1)
        
        # Aprovar reload
        approved_reload = ReloadService.approve(dto)
        
        # Verificar que SSE foi chamado
        mock_sse.assert_called_once_with(approved_reload)
        
        # Verificar que transação foi criada
        from src.models.models import Transaction
        transaction = Transaction.query.filter_by(reload_request_id=reload.id).first()
        assert transaction is not None
        assert transaction.transaction_type == TransactionType.RELOAD
        assert float(transaction.amount) == 200.0
