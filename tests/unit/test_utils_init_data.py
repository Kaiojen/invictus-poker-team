"""
Testes para src/utils/init_data.py
Objetivo: Elevar cobertura de 7% → 80%+
"""
import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from src.utils.init_data import create_initial_data
from src.models.models import User, Platform, Account, Reta, UserRole


@pytest.mark.unit
class TestInitialDataCreation:
    """Testes de criação de dados iniciais"""

    def test_create_initial_data_when_no_data_exists(self, db_session):
        """Teste criação de dados quando nenhum dado existe"""
        # Garantir que não há dados iniciais
        assert User.query.first() is None
        
        # Executar criação de dados iniciais
        create_initial_data()
        
        # Verificar se dados foram criados
        users = User.query.all()
        platforms = Platform.query.all()
        retas = Reta.query.all()
        
        assert len(users) > 0
        assert len(platforms) > 0
        assert len(retas) > 0

    def test_create_initial_data_when_data_exists(self, db_session):
        """Teste que não cria dados se já existem"""
        # Criar um usuário para simular dados existentes
        existing_user = User(
            username='existing',
            email='existing@test.com',
            full_name='Existing User',
            role=UserRole.ADMIN
        )
        existing_user.set_password('password123')
        db_session.add(existing_user)
        db_session.commit()
        
        # Contar dados antes
        users_before = User.query.count()
        
        # Executar criação
        create_initial_data()
        
        # Verificar que não foram criados novos dados
        assert User.query.count() == users_before

    def test_retas_creation(self, db_session):
        """Teste criação das retas específicas"""
        create_initial_data()
        
        retas = Reta.query.all()
        reta_names = [reta.name for reta in retas]
        
        expected_retas = ['Reta 0', 'Reta 1', 'Reta 2', 'Reta 3']
        for expected_reta in expected_retas:
            assert expected_reta in reta_names

    def test_platforms_creation(self, db_session):
        """Teste criação das plataformas"""
        create_initial_data()
        
        platforms = Platform.query.all()
        platform_names = [platform.name for platform in platforms]
        
        expected_platforms = ['pokerstars', 'gg', 'luxon']
        for expected_platform in expected_platforms:
            assert expected_platform in platform_names

    def test_admin_user_creation(self, db_session):
        """Teste criação do usuário admin"""
        create_initial_data()
        
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()
        assert admin_user is not None
        assert admin_user.username == 'admin'

    def test_user_password_encryption(self, db_session):
        """Teste que senhas são criptografadas"""
        create_initial_data()
        
        users = User.query.all()
        for user in users:
            # Hash deve existir e não ser texto plano
            assert user.password_hash is not None
            assert len(user.password_hash) > 20  # Hash é longo
            assert user.password_hash != 'admin123'