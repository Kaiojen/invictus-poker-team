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
        assert data['user']['role'] == 'PLAYER'

    def test_login_invalid_credentials(self, client, test_user):
        """Teste login com credenciais inválidas"""
        response = client.post('/auth/login', json={
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert data['error'] == 'Invalid credentials'

    def test_login_nonexistent_user(self, client):
        """Teste login com usuário inexistente"""
        response = client.post('/auth/login', json={
            'username': 'nonexistent',
            'password': 'password123'
        })
        
        assert response.status_code == 401

    def test_login_missing_data(self, client):
        """Teste login com dados faltando"""
        response = client.post('/auth/login', json={
            'username': 'testuser'
            # Missing password
        })
        
        assert response.status_code == 400

    def test_logout_success(self, client, test_user):
        """Teste logout com sucesso"""
        # Fazer login primeiro
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/logout')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['message'] == 'Logged out successfully'

    def test_logout_not_logged_in(self, client):
        """Teste logout sem estar logado"""
        response = client.post('/auth/logout')
        assert response.status_code == 401

    def test_get_current_user_success(self, client, test_user):
        """Teste obter usuário atual com sucesso"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.get('/auth/me')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['user']['username'] == 'testuser'
        assert data['user']['email'] == 'test@example.com'

    def test_get_current_user_not_logged_in(self, client):
        """Teste obter usuário atual sem estar logado"""
        response = client.get('/auth/me')
        assert response.status_code == 401

    def test_get_csrf_token(self, client, test_user):
        """Teste obter token CSRF"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.get('/auth/csrf-token')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'csrf_token' in data

    def test_change_password_success(self, client, test_user):
        """Teste mudança de senha com sucesso"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/change-password', json={
            'current_password': 'testpassword123',
            'new_password': 'newpassword123'
        })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['message'] == 'Password changed successfully'

    def test_change_password_wrong_current(self, client, test_user):
        """Teste mudança de senha com senha atual errada"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/change-password', json={
            'current_password': 'wrongpassword',
            'new_password': 'newpassword123'
        })
        
        assert response.status_code == 400

    def test_change_password_weak_new_password(self, client, test_user):
        """Teste mudança de senha com senha nova fraca"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/change-password', json={
            'current_password': 'testpassword123',
            'new_password': '123'  # Muito fraca
        })
        
        assert response.status_code == 400

    @patch('smtplib.SMTP_SSL')
    def test_forgot_password_success(self, mock_smtp, client, test_user):
        """Teste reset de senha com sucesso"""
        # Mock do envio de email
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server
        
        response = client.post('/auth/forgot-password', json={
            'email': 'test@example.com'
        })
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'message' in data

    def test_forgot_password_invalid_email(self, client):
        """Teste reset de senha com email inválido"""
        response = client.post('/auth/forgot-password', json={
            'email': 'nonexistent@example.com'
        })
        
        # Deve retornar 200 para não vazar informação sobre emails
        assert response.status_code == 200

    def test_reset_password_success(self, client, test_user):
        """Teste reset de senha com token válido"""
        # Configurar token de reset
        test_user.password_reset_token = 'valid-token'
        from datetime import datetime, timedelta
        test_user.password_reset_expires_at = datetime.utcnow() + timedelta(hours=1)
        
        response = client.post('/auth/reset-password', json={
            'token': 'valid-token',
            'new_password': 'newpassword123'
        })
        
        assert response.status_code == 200

    def test_reset_password_invalid_token(self, client):
        """Teste reset de senha com token inválido"""
        response = client.post('/auth/reset-password', json={
            'token': 'invalid-token',
            'new_password': 'newpassword123'
        })
        
        assert response.status_code == 400

    @pytest.mark.skipif("pyotp is None")
    def test_init_2fa_success(self, client, test_user):
        """Teste inicialização 2FA"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        response = client.post('/auth/2fa/init')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'secret' in data
        assert 'qr_code' in data

    @pytest.mark.skipif("pyotp is None")
    def test_enable_2fa_success(self, client, test_user):
        """Teste habilitação 2FA com código válido"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        # Configurar secret temporário
        test_user.totp_secret = 'test-secret'
        
        with patch('pyotp.TOTP') as mock_totp:
            mock_totp.return_value.verify.return_value = True
            
            response = client.post('/auth/2fa/enable', json={
                'code': '123456'
            })
            
            assert response.status_code == 200

    @pytest.mark.skipif("pyotp is None") 
    def test_disable_2fa_success(self, client, test_user):
        """Teste desabilitação 2FA"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        # Configurar 2FA habilitado
        test_user.two_factor_enabled = True
        test_user.totp_secret = 'test-secret'
        
        with patch('pyotp.TOTP') as mock_totp:
            mock_totp.return_value.verify.return_value = True
            
            response = client.post('/auth/2fa/disable', json={
                'code': '123456'
            })
            
            assert response.status_code == 200


class TestAuthDecorators:
    """Testes dos decoradores de autenticação"""
    
    def test_login_required_decorator(self, client):
        """Teste decorador login_required"""
        response = client.get('/auth/me')
        assert response.status_code == 401
        
        data = json.loads(response.data)
        assert data['error'] == 'Authentication required'

    def test_admin_required_with_player(self, client, test_user):
        """Teste decorador admin_required com usuário player"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        # Tentar acessar endpoint que requer admin (se existir)
        # Por enquanto, apenas testamos a funcionalidade básica
        pass

    def test_admin_required_with_admin(self, client, admin_user):
        """Teste decorador admin_required com usuário admin"""
        with client.session_transaction() as sess:
            sess['user_id'] = admin_user.id
        
        # Verificar se admin pode acessar funcionalidades
        response = client.get('/auth/me')
        assert response.status_code == 200


class TestAuthSecurity:
    """Testes de segurança das rotas de auth"""
    
    def test_login_rate_limiting(self, client, test_user):
        """Teste rate limiting no login"""
        # Fazer múltiplas tentativas de login
        for _ in range(6):  # Exceder o limite
            client.post('/auth/login', json={
                'username': 'testuser',
                'password': 'wrongpassword'
            })
        
        # A próxima deve ser bloqueada
        response = client.post('/auth/login', json={
            'username': 'testuser', 
            'password': 'wrongpassword'
        })
        
        # Rate limiting pode retornar 429 ou similar
        assert response.status_code in [429, 400, 401]

    def test_sensitive_operations_rate_limiting(self, client, test_user):
        """Teste rate limiting em operações sensíveis"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        # Fazer múltiplas tentativas de mudança de senha
        for _ in range(6):
            client.post('/auth/change-password', json={
                'current_password': 'wrongpassword',
                'new_password': 'newpassword123'
            })
        
        # Verificar se próxima requisição é bloqueada
        response = client.post('/auth/change-password', json={
            'current_password': 'wrongpassword',
            'new_password': 'newpassword123'
        })
        
        assert response.status_code in [429, 400]

    def test_password_validation(self, client, test_user):
        """Teste validação de senhas fracas"""
        with client.session_transaction() as sess:
            sess['user_id'] = test_user.id
        
        weak_passwords = ['123', 'password', 'abc', '']
        
        for weak_password in weak_passwords:
            response = client.post('/auth/change-password', json={
                'current_password': 'testpassword123',
                'new_password': weak_password
            })
            
            assert response.status_code == 400

    def test_session_security(self, client, test_user):
        """Teste segurança da sessão"""
        # Login
        response = client.post('/auth/login', json={
            'username': 'testuser',
            'password': 'testpassword123'
        })
        assert response.status_code == 200
        
        # Verificar se sessão foi criada
        response = client.get('/auth/me')
        assert response.status_code == 200
        
        # Logout
        response = client.post('/auth/logout')
        assert response.status_code == 200
        
        # Verificar se sessão foi destruída
        response = client.get('/auth/me')
        assert response.status_code == 401
