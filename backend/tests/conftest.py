"""
Configuração de testes pytest para o sistema Invictus Poker Team
"""
import pytest
import tempfile
import os
from src.main import app, db
from src.models.models import User, Platform, Account, UserRole
from src.utils.init_data import create_initial_data


@pytest.fixture(scope="session")
def test_app():
    """App Flask configurada para testes"""
    # Criar DB temporário
    db_fd, db_path = tempfile.mkstemp()
    
    app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
        'SECRET_KEY': 'test-secret-key',
        'WTF_CSRF_ENABLED': False,
        'SQLALCHEMY_TRACK_MODIFICATIONS': False
    })
    
    with app.app_context():
        db.create_all()
        create_initial_data()  # Criar dados iniciais
        yield app
        
    # Cleanup
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(test_app):
    """Cliente de teste Flask"""
    return test_app.test_client()


@pytest.fixture
def app_context(test_app):
    """Contexto da aplicação"""
    with test_app.app_context():
        yield test_app


@pytest.fixture
def db_session(app_context):
    """Sessão de banco limpa para cada teste"""
    db.session.begin()
    yield db.session
    db.session.rollback()


@pytest.fixture
def admin_user(db_session):
    """Usuário administrador para testes"""
    admin = User(
        username='admin_test',
        email='admin@test.com',
        full_name='Admin Test',
        role=UserRole.ADMIN,
        is_active=True
    )
    admin.set_password('admin123')
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture
def player_user(db_session):
    """Usuário jogador para testes"""
    player = User(
        username='player_test',
        email='player@test.com',
        full_name='Player Test',
        role=UserRole.PLAYER,
        is_active=True,
        reta_id=1  # Reta padrão
    )
    player.set_password('player123')
    db_session.add(player)
    db_session.commit()
    return player


@pytest.fixture
def platforms(db_session):
    """Plataformas padrão para testes"""
    platforms = []
    
    platform_data = [
        {'name': 'pokerstars', 'display_name': 'PokerStars'},
        {'name': 'gg', 'display_name': 'GGPoker'},
        {'name': 'luxon', 'display_name': 'Luxon'}
    ]
    
    for data in platform_data:
        platform = Platform(
            name=data['name'],
            display_name=data['display_name'],
            is_active=True
        )
        db_session.add(platform)
        platforms.append(platform)
    
    db_session.commit()
    return platforms


@pytest.fixture
def player_accounts(db_session, player_user, platforms):
    """Contas do jogador para testes P&L"""
    accounts = []
    
    # Configuração inicial baseada no exemplo do ABA:
    # Time deposita $100 → Player: GG $50, PS $30, Luxon $20
    account_data = [
        {'platform': 'pokerstars', 'initial': 30.0, 'current': 25.0},  # -$5
        {'platform': 'gg', 'initial': 50.0, 'current': 100.0},        # +$50
        {'platform': 'luxon', 'initial': 20.0, 'current': 20.0}       # Luxon não varia
    ]
    
    for data in account_data:
        platform = next(p for p in platforms if p.name == data['platform'])
        account = Account(
            user_id=player_user.id,
            platform_id=platform.id,
            has_account=True,
            initial_balance=data['initial'],
            current_balance=data['current'],
            previous_balance=data['initial']  # Para cálculo diário
        )
        db_session.add(account)
        accounts.append(account)
    
    db_session.commit()
    return accounts


@pytest.fixture
def authenticated_session(client, admin_user):
    """Sessão autenticada como admin"""
    with client.session_transaction() as sess:
        sess['user_id'] = admin_user.id
        sess['user_role'] = admin_user.role.value
    return client

