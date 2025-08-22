"""
Testes de Integração para Rotas de Autenticação
Objetivo: Elevar cobertura de auth.py de 22% → 70%+
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from src.models.models import User, UserRole
from src.main import create_app


@pytest.fixture
def app():
    """Criar app Flask para testes"""
    app = create_app()
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    app.config['WTF_CSRF_ENABLED'] = False  # Desabilitar CSRF para testes
    return app


@pytest.fixture
def client(app):
    """Cliente de teste Flask"""
    return app.test_client()


@pytest.fixture
def test_user(db_session):
    """Usuário de teste"""
    user = User(
        username='testuser',
        email='test@example.com',
        full_name='Test User',
        role=UserRole.PLAYER
    )
    user.set_password('testpassword123')
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    """Usuário admin de teste"""
    user = User(
        username='admin',
        email='admin@example.com',
        full_name='Admin User',
        role=UserRole.ADMIN
    )
    user.set_password('adminpass123')
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.mark.integration
class TestAuthRoutes:
    """Testes das rotas de autenticação"""

    def test_login_success(self, client, test_user):
        """Teste login com sucesso"""
        response = client.post('/auth/login', json={
            'username': 'testuser',
            'password': 'testpassword123'
        })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['user']['username'] == 'testuser'

    def test_login_invalid_credentials(self, client, test_user):
        """Teste login com credenciais inválidas"""
        response = client.post('/auth/login', json={
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        
        assert response.status_code == 401

    def test_logout_success(self, client, test_user):
        """Teste logout com sucesso"""
        # Fazer login primeiro
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/logout')
        assert response.status_code == 200

    def test_get_current_user_success(self, client, test_user):
        """Teste obter usuário atual com sucesso"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.get('/auth/me')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['user']['username'] == 'testuser'

    def test_get_csrf_token(self, client, test_user):
        """Teste obter token CSRF"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.get('/auth/csrf-token')
        assert response.status_code == 200

    def test_change_password_success(self, client, test_user):
        """Teste mudança de senha com sucesso"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/change-password', json={
            'current_password': 'testpassword123',
            'new_password': 'newpassword123'
        })
        
        assert response.status_code == 200
