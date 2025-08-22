"""
TESTES CRÍTICOS: Lógica P&L - Regra de Negócio Principal
Baseado no exemplo do ABA Administrador_.md
Versão corrigida com fixtures isoladas
"""
import pytest
import uuid
from decimal import Decimal
from src.models.models import Account, Platform, User, UserRole, ReloadRequest, ReloadStatus


@pytest.mark.critical
class TestPnLLogicFixed:
    """Testes da lógica P&L - CRÍTICO para funcionamento correto"""
    
    def test_pnl_calculation_example_aba_administrador(self, db_session, player_user, platforms, player_accounts):
        """
        Teste baseado no exemplo exato do ABA Administrador_.md:
        
        Time deposita $100 → Player: GG $50, PS $30, Luxon $20
        Após jogo: GG $100, PS $25, Luxon $20
        P&L = (100-50) + (25-30) = +$45 (LUXON NÃO ENTRA)
        Saldo Total = 100 + 25 + 20 = $145 (LUXON ENTRA no total)
        """
        # Buscar contas do jogador
        ps_account = next(acc for acc in player_accounts if acc.platform.name == 'pokerstars')
        gg_account = next(acc for acc in player_accounts if acc.platform.name == 'gg')
        luxon_account = next(acc for acc in player_accounts if acc.platform.name == 'luxon')
        
        # Verificar P&L individual por conta
        assert ps_account.pnl == -5.0, f"PS P&L esperado: -5.0, atual: {ps_account.pnl}"
        assert gg_account.pnl == 50.0, f"GG P&L esperado: 50.0, atual: {gg_account.pnl}"
        assert luxon_account.pnl == 0.0, f"Luxon P&L deve ser 0.0 (FORA do P&L), atual: {luxon_account.pnl}"
        
        # Calcular P&L total (Luxon FORA)
        total_pnl = sum(acc.pnl for acc in player_accounts if acc.platform.name != 'luxon')
        expected_pnl = 45.0  # 50 - 5 = 45
        assert total_pnl == expected_pnl, f"P&L total esperado: {expected_pnl}, atual: {total_pnl}"
        
        # Calcular saldo total (Luxon ENTRA)
        total_balance = sum(acc.current_balance for acc in player_accounts if acc.has_account)
        expected_balance = 145.0  # 100 + 25 + 20 = 145
        assert total_balance == expected_balance, f"Saldo total esperado: {expected_balance}, atual: {total_balance}"

    def test_luxon_never_contributes_to_pnl(self, db_session):
        """Luxon NUNCA deve contribuir para P&L, independente do valor"""
        # Criar plataforma Luxon isolada - DEVE ter nome exato "luxon" para a regra funcionar
        unique_id = str(uuid.uuid4())[:8]
        
        # Tentar encontrar Luxon existente ou criar nova
        luxon_platform = db_session.query(Platform).filter_by(name='luxon').first()
        if not luxon_platform:
            luxon_platform = Platform(name='luxon', display_name='Luxon', is_active=True)
            db_session.add(luxon_platform)
            db_session.commit()
        
        # Cenários extremos para Luxon
        test_cases = [
            {'initial': 0.0, 'current': 1000.0},    # Grande ganho
            {'initial': 1000.0, 'current': 0.0},    # Grande perda  
            {'initial': 500.0, 'current': 500.0},   # Sem mudança
            {'initial': 100.0, 'current': 150.0}    # Pequeno ganho
        ]
        
        for i, case in enumerate(test_cases):
            # Criar usuário único para cada teste
            user_unique = str(uuid.uuid4())[:8]
            test_user = User(
                username=f'luxon_test_user_{unique_id}_{i}',
                email=f'luxon_test_{user_unique}@test.com',
                full_name=f'Luxon Test User {unique_id} {i}',
                role=UserRole.PLAYER
            )
            test_user.set_password('test123')
            db_session.add(test_user)
            db_session.commit()
            
            account = Account(
                user_id=test_user.id,
                platform_id=luxon_platform.id,
                account_name=f"luxon_test_{unique_id}_{i}",
                has_account=True,
                initial_balance=case['initial'],
                current_balance=case['current']
            )
            db_session.add(account)
            db_session.commit()
            
            # Recarregar para ter as relações
            db_session.refresh(account)
            
            # P&L deve SEMPRE ser 0 para Luxon
            assert account.pnl == 0.0, f"Luxon P&L deve ser 0, mas foi {account.pnl} para caso {case}"

    def test_poker_sites_normal_pnl_calculation(self, db_session):
        """Sites de poker devem calcular P&L normalmente"""
        # Criar plataformas isoladas com nomes únicos
        unique_id = str(uuid.uuid4())[:8]
        ps_platform = Platform(name=f'pokerstars_test_{unique_id}', display_name=f'PokerStars Test {unique_id}', is_active=True)
        gg_platform = Platform(name=f'gg_test_{unique_id}', display_name=f'GG Test {unique_id}', is_active=True)
        db_session.add_all([ps_platform, gg_platform])
        db_session.commit()
        
        # Criar usuário isolado com nome único
        user_unique = str(uuid.uuid4())[:8]
        test_user = User(
            username=f'pnl_test_user_{user_unique}',
            email=f'pnl_test_{user_unique}@test.com',
            full_name=f'PnL Test User {user_unique}',
            role=UserRole.PLAYER
        )
        test_user.set_password('test123')
        db_session.add(test_user)
        db_session.commit()
        
        test_cases = [
            # Platform, initial, current, expected_pnl
            (ps_platform, 100.0, 150.0, 50.0),   # Lucro
            (gg_platform, 200.0, 180.0, -20.0),  # Prejuízo
        ]
        
        for i, (platform, initial, current, expected) in enumerate(test_cases):
            account = Account(
                user_id=test_user.id,
                platform_id=platform.id,
                account_name=f"test_{unique_id}_{i}",
                has_account=True,
                initial_balance=initial,
                current_balance=current
            )
            db_session.add(account)
            db_session.commit()
            
            # Recarregar para ter as relações
            db_session.refresh(account)
            
            assert account.pnl == expected, f"P&L esperado: {expected}, atual: {account.pnl}"

    def test_account_without_account_has_zero_pnl(self, db_session):
        """Contas desativadas (has_account=False) devem ter P&L zero"""
        # Criar plataforma e usuário isolados com nomes únicos
        unique_id = str(uuid.uuid4())[:8]
        ps_platform = Platform(name=f'ps_inactive_test_{unique_id}', display_name=f'PS Inactive Test {unique_id}', is_active=True)
        db_session.add(ps_platform)
        db_session.commit()
        
        user_unique = str(uuid.uuid4())[:8]
        test_user = User(
            username=f'inactive_test_user_{user_unique}',
            email=f'inactive_test_{user_unique}@test.com',
            full_name=f'Inactive Test User {user_unique}',
            role=UserRole.PLAYER
        )
        test_user.set_password('test123')
        db_session.add(test_user)
        db_session.commit()
        
        account = Account(
            user_id=test_user.id,
            platform_id=ps_platform.id,
            account_name=f"test_inactive_{unique_id}",
            has_account=False,  # Conta desativada
            initial_balance=100.0,
            current_balance=200.0  # Mesmo com saldo, P&L deve ser 0
        )
        db_session.add(account)
        db_session.commit()
        
        # Recarregar para ter as relações
        db_session.refresh(account)
        
        assert account.pnl == 0.0, "Contas desativadas devem ter P&L zero"

    def test_multiple_players_pnl_isolation(self, db_session):
        """P&L de jogadores diferentes deve ser isolado"""
        # Criar plataforma isolada com nome único
        unique_id = str(uuid.uuid4())[:8]
        ps_platform = Platform(name=f'ps_isolation_test_{unique_id}', display_name=f'PS Isolation Test {unique_id}', is_active=True)
        db_session.add(ps_platform)
        db_session.commit()
        
        # Criar dois jogadores com nomes únicos
        user1_unique = str(uuid.uuid4())[:8]
        user2_unique = str(uuid.uuid4())[:8]
        
        player1 = User(
            username=f'isolation_player1_{user1_unique}', 
            email=f'isolation_p1_{user1_unique}@test.com', 
            full_name=f'Isolation Player 1 {user1_unique}',
            role=UserRole.PLAYER
        )
        player1.set_password('test123')
        
        player2 = User(
            username=f'isolation_player2_{user2_unique}', 
            email=f'isolation_p2_{user2_unique}@test.com', 
            full_name=f'Isolation Player 2 {user2_unique}',
            role=UserRole.PLAYER
        )
        player2.set_password('test123')
        
        db_session.add_all([player1, player2])
        db_session.commit()
        
        # Contas com valores diferentes
        account1 = Account(
            user_id=player1.id,
            platform_id=ps_platform.id,
            account_name=f"isolation_player1_ps_{unique_id}",
            has_account=True,
            initial_balance=100.0,
            current_balance=150.0  # +50
        )
        
        account2 = Account(
            user_id=player2.id,
            platform_id=ps_platform.id,
            account_name=f"isolation_player2_ps_{unique_id}",
            has_account=True,
            initial_balance=200.0,
            current_balance=180.0  # -20
        )
        
        db_session.add_all([account1, account2])
        db_session.commit()
        
        # Recarregar para ter as relações
        db_session.refresh(account1)
        db_session.refresh(account2)
        
        # P&L deve ser calculado independentemente
        assert account1.pnl == 50.0, "Player 1 deve ter P&L +50"
        assert account2.pnl == -20.0, "Player 2 deve ter P&L -20"

    @pytest.mark.integration
    def test_pnl_with_pending_reload(self, db_session, player_user, platforms, player_accounts):
        """P&L não deve ser afetado por reloads pendentes"""
        ps_platform = next(p for p in platforms if p.name == 'pokerstars')
        ps_account = next(acc for acc in player_accounts if acc.platform.name == 'pokerstars')
        
        # P&L inicial
        initial_pnl = ps_account.pnl
        
        # Criar reload pendente
        reload = ReloadRequest(
            user_id=player_user.id,
            platform_id=ps_platform.id,
            amount=100.0,
            status=ReloadStatus.PENDING
        )
        db_session.add(reload)
        db_session.commit()
        
        # P&L não deve mudar até aprovação
        db_session.refresh(ps_account)
        assert ps_account.pnl == initial_pnl, "P&L não deve mudar com reload pendente"
