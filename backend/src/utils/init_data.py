from src.models.models import (
    db, User, Platform, UserRole, Reta
)
from datetime import date
from decimal import Decimal

def create_initial_data():
    """Criar dados iniciais essenciais apenas (sem dados mock)"""
    
    # Verificar se já existem dados
    if User.query.first() is not None:
        return  # Dados já existem
    
    try:
        # Criar retas padrão (essenciais para o sistema)
        retas = [
            Reta(name='Reta 0', min_stake=Decimal('1.00'), max_stake=Decimal('2.50'), description='ABI $1-2.5'),
            Reta(name='Reta 1', min_stake=Decimal('2.00'), max_stake=Decimal('5.50'), description='ABI $2-5.5'),
            Reta(name='Reta 2', min_stake=Decimal('3.30'), max_stake=Decimal('7.50'), description='ABI $3.3-7.50'),
            Reta(name='Reta 3', min_stake=Decimal('5.50'), max_stake=Decimal('12.00'), description='ABI $5.5-12'),
        ]
        
        for reta in retas:
            db.session.add(reta)
        
        # Commit para obter IDs das retas
        db.session.commit()
        
        # Criar usuário administrador padrão
        admin_user = User(
            username='admin',
            email='admin@invictuspoker.com',
            full_name='Administrador Sistema',
            role=UserRole.ADMIN,
            phone='(11) 99999-0000',
            document='000.000.000-00',
            birth_date=date(1985, 1, 1),
            pix_key='admin@invictuspoker.com',
            bank_name='Sistema',
            bank_agency='0001',
            bank_account='00000-0'
        )
        admin_user.set_password('admin123')  # DEVE SER ALTERADA no primeiro acesso
        db.session.add(admin_user)
        
        # ✅ CORRIGIDO: Criar plataformas SEM campo is_poker_site 
        platforms = [
            Platform(name='pokerstars', display_name='PokerStars'),
            Platform(name='ggpoker', display_name='GGPoker'),
            Platform(name='partypoker', display_name='PartyPoker'),
            Platform(name='888poker', display_name='888poker'),
            Platform(name='luxonpay', display_name='LuxonPay'),  # Carteira digital
        ]
        
        for platform in platforms:
            db.session.add(platform)
        
        # Commit final
        db.session.commit()
        print("✅ Dados iniciais essenciais criados com sucesso")
        print(f"👤 Usuário admin criado - Login: admin | Senha: admin123")
        print("⚠️ IMPORTANTE: Altere a senha padrão após o primeiro login!")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao criar dados iniciais: {e}")
        raise