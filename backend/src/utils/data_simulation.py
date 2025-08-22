"""
Sistema de simulação de dados para 1 ano completo de operação
Gera jogadores realistas com diferentes perfis e histórico temporal
"""

import random
from datetime import datetime, timedelta, date
from decimal import Decimal
from src.models.models import (
    db, User, Account, Platform, Reta, BalanceHistory, 
    ReloadRequest, WithdrawalRequest, Transaction, UserRole,
    ReloadStatus, WithdrawalStatus, TransactionType
)


# Perfis de jogadores realistas
PLAYER_PROFILES = [
    # Jogadores lucrativos
    {
        "name": "Carlos Henrique Silva", 
        "username": "carlos_pro", 
        "type": "profitable",
        "reta_id": 4, 
        "initial_investment": 800,
        "monthly_variance": 0.15,
        "avg_monthly_return": 0.12,
        "makeup_tendency": 0.1
    },
    {
        "name": "Ana Carolina Santos", 
        "username": "ana_grinder", 
        "type": "profitable",
        "reta_id": 3, 
        "initial_investment": 500,
        "monthly_variance": 0.12,
        "avg_monthly_return": 0.08,
        "makeup_tendency": 0.2
    },
    {
        "name": "Roberto Lima Filho", 
        "username": "rob_shark", 
        "type": "profitable",
        "reta_id": 4, 
        "initial_investment": 1200,
        "monthly_variance": 0.20,
        "avg_monthly_return": 0.15,
        "makeup_tendency": 0.05
    },
    # Jogadores em desenvolvimento (breakeven)
    {
        "name": "Felipe Oliveira", 
        "username": "felipe_dev", 
        "type": "developing",
        "reta_id": 2, 
        "initial_investment": 300,
        "monthly_variance": 0.25,
        "avg_monthly_return": 0.02,
        "makeup_tendency": 0.4
    },
    {
        "name": "Mariana Costa", 
        "username": "mari_learn", 
        "type": "developing",
        "reta_id": 2, 
        "initial_investment": 350,
        "monthly_variance": 0.22,
        "avg_monthly_return": -0.01,
        "makeup_tendency": 0.5
    },
    # Jogadores em makeup
    {
        "name": "Pedro Nascimento", 
        "username": "pedro_tilt", 
        "type": "makeup",
        "reta_id": 3, 
        "initial_investment": 600,
        "monthly_variance": 0.30,
        "avg_monthly_return": -0.05,
        "makeup_tendency": 0.7
    },
    {
        "name": "Juliana Ferreira", 
        "username": "ju_recovery", 
        "type": "makeup",
        "reta_id": 2, 
        "initial_investment": 400,
        "monthly_variance": 0.28,
        "avg_monthly_return": -0.03,
        "makeup_tendency": 0.6
    },
    # Jogador novo (3 meses)
    {
        "name": "Lucas Almeida", 
        "username": "lucas_new", 
        "type": "new",
        "reta_id": 1, 
        "initial_investment": 200,
        "monthly_variance": 0.35,
        "avg_monthly_return": 0.05,
        "makeup_tendency": 0.3
    },
    # Jogador sazonal (altos e baixos)
    {
        "name": "Thiago Rodrigues", 
        "username": "thiago_swing", 
        "type": "volatile",
        "reta_id": 3, 
        "initial_investment": 550,
        "monthly_variance": 0.40,
        "avg_monthly_return": 0.06,
        "makeup_tendency": 0.45
    }
]


def clear_all_player_data():
    """Remove todos os jogadores e dados relacionados, mantém admin"""
    try:
        # Manter apenas admin e manager
        players = User.query.filter_by(role=UserRole.PLAYER).all()
        player_ids = [p.id for p in players]
        
        if not player_ids:
            return {"message": "Nenhum jogador para remover"}
        
        # Remover em ordem para respeitar foreign keys
        from src.utils.cleanup import cleanup_test_data
        
        # Remover registros dependentes
        account_ids = [a.id for a in Account.query.filter(Account.user_id.in_(player_ids)).all()]
        
        # Balance history
        BalanceHistory.query.filter(BalanceHistory.account_id.in_(account_ids)).delete(synchronize_session=False)
        
        # Transactions
        Transaction.query.filter(Transaction.user_id.in_(player_ids)).delete(synchronize_session=False)
        
        # Requests
        ReloadRequest.query.filter(ReloadRequest.user_id.in_(player_ids)).delete(synchronize_session=False)
        WithdrawalRequest.query.filter(WithdrawalRequest.user_id.in_(player_ids)).delete(synchronize_session=False)
        
        # Accounts
        Account.query.filter(Account.user_id.in_(player_ids)).delete(synchronize_session=False)
        
        # Players
        User.query.filter(User.id.in_(player_ids)).delete(synchronize_session=False)
        
        db.session.commit()
        return {"players_removed": len(players), "accounts_removed": len(account_ids)}
        
    except Exception as e:
        db.session.rollback()
        raise e


def generate_realistic_timeline(profile, start_date, months=12):
    """Gera timeline realística de performance para um jogador"""
    timeline = []
    current_bankroll = profile["initial_investment"]
    current_makeup = 0
    
    # Período mais difícil no começo para jogadores em makeup
    difficulty_curve = 1.0
    if profile["type"] == "makeup":
        difficulty_curve = 1.5  # Mais difícil no início
    elif profile["type"] == "new":
        months = min(months, 3)  # Jogador novo só tem 3 meses
    
    for month in range(months):
        # Ajustar dificuldade ao longo do tempo
        if profile["type"] == "makeup" and month > 6:
            difficulty_curve = max(0.8, difficulty_curve - 0.1)  # Melhora após 6 meses
        
        # Base return com variância
        base_return = profile["avg_monthly_return"]
        variance = profile["monthly_variance"]
        
        # Adicionar sazonalidade (férias e final de ano são piores)
        seasonal_factor = 1.0
        if month in [5, 6, 11]:  # Jun, Jul, Dez
            seasonal_factor = 0.7
        
        # Calcular retorno do mês
        monthly_return = random.gauss(base_return * seasonal_factor, variance) / difficulty_curve
        
        # Aplicar resultado
        month_pnl = current_bankroll * monthly_return
        new_bankroll = max(0, current_bankroll + month_pnl)
        
        # Lógica de makeup
        if month_pnl < 0:
            current_makeup += abs(month_pnl)
        elif current_makeup > 0 and month_pnl > 0:
            makeup_payment = min(current_makeup, month_pnl * 0.7)  # 70% dos lucros pagam makeup
            current_makeup -= makeup_payment
            month_pnl -= makeup_payment
        
        # Solicitações de reload (mais comum quando em baixa)
        reload_probability = 0.1
        if new_bankroll < current_bankroll * 0.5:  # Perdeu 50%+
            reload_probability = 0.6
        elif profile["makeup_tendency"] > 0.5:
            reload_probability = 0.3
        
        # Solicitações de saque (apenas se lucrativo)
        withdrawal_probability = 0.0
        if month_pnl > current_bankroll * 0.2 and profile["type"] == "profitable":
            withdrawal_probability = 0.4
        
        timeline.append({
            "month": month,
            "date": start_date + timedelta(days=30 * month),
            "starting_bankroll": current_bankroll,
            "pnl": month_pnl,
            "ending_bankroll": new_bankroll,
            "makeup": current_makeup,
            "needs_reload": random.random() < reload_probability,
            "wants_withdrawal": random.random() < withdrawal_probability,
            "reload_amount": random.randint(200, 800) if random.random() < reload_probability else 0,
            "withdrawal_amount": int(month_pnl * random.uniform(0.3, 0.7)) if random.random() < withdrawal_probability else 0
        })
        
        current_bankroll = new_bankroll
    
    return timeline


def create_player_with_history(profile, start_date):
    """Cria jogador com histórico completo"""
    
    # Criar usuário
    user = User(
        username=profile["username"],
        email=f"{profile['username']}@invictuspoker.com",
        full_name=profile["name"],
        role=UserRole.PLAYER,
        phone=f"(11) 9{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
        document=f"{random.randint(100, 999)}.{random.randint(100, 999)}.{random.randint(100, 999)}-{random.randint(10, 99)}",
        birth_date=date(random.randint(1990, 2000), random.randint(1, 12), random.randint(1, 28)),
        pix_key=f"{profile['username']}@pix.com",
        bank_name="Banco do Brasil",
        bank_agency=f"{random.randint(1000, 9999)}-{random.randint(0, 9)}",
        bank_account=f"{random.randint(10000, 99999)}-{random.randint(0, 9)}",
        reta_id=profile["reta_id"]
    )
    user.set_password("player123")
    db.session.add(user)
    db.session.flush()  # Para obter o ID
    
    # Definir makeup atual se aplicável
    if profile["type"] == "makeup":
        user.makeup = Decimal(random.randint(100, 500))
    
    # Buscar plataformas existentes e criar Luxon se não existir
    platforms = Platform.query.all()
    platform_dict = {p.name: p for p in platforms}
    
    # Criar Luxon se não existir
    if 'luxonpay' not in platform_dict:
        luxon_platform = Platform(
            name='luxonpay',
            display_name='LuxonPay',
            is_active=True
        )
        db.session.add(luxon_platform)
        db.session.flush()
        platform_dict['luxonpay'] = luxon_platform
    
    # Mapear nomes esperados para nomes reais
    name_mapping = {
        'pokerstars': 'pokerstars',
        'ggpoker': 'gg', 
        'partypoker': 'party',
        'luxonpay': 'luxonpay'
    }
    
    # Criar contas nas principais plataformas
    accounts = []
    
    # Luxon (carteira principal)
    luxon_account = Account(
        user_id=user.id,
        platform_id=platform_dict['luxonpay'].id,
        account_name=f"luxon_{user.username}",
        initial_balance=Decimal(profile["initial_investment"]),
        current_balance=Decimal(random.randint(50, 200)),  # Sempre baixo na Luxon
        has_account=True
    )
    accounts.append(luxon_account)
    
    # Sites de poker (distribuição do saldo)
    poker_sites = ['pokerstars', 'ggpoker', 'partypoker'] 
    remaining_balance = profile["initial_investment"] - float(luxon_account.current_balance)
    
    for i, expected_name in enumerate(poker_sites):
        real_name = name_mapping.get(expected_name, expected_name)
        if real_name in platform_dict:
            # Distribuir saldo restante
            if i == len(poker_sites) - 1:  # Último site recebe o resto
                balance = max(0, remaining_balance)
            else:
                balance = remaining_balance * random.uniform(0.2, 0.5)
                remaining_balance -= balance
            
            initial = balance * random.uniform(0.8, 1.2)  # Variação do inicial
            
            account = Account(
                user_id=user.id,
                platform_id=platform_dict[real_name].id,
                account_name=f"{user.username}_{real_name}",
                initial_balance=Decimal(initial),
                current_balance=Decimal(balance),
                has_account=True,
                last_balance_update=datetime.utcnow() - timedelta(days=random.randint(1, 7))
            )
            accounts.append(account)
    
    for account in accounts:
        db.session.add(account)
    
    db.session.flush()
    
    # Gerar histórico temporal
    timeline = generate_realistic_timeline(profile, start_date)
    
    # Criar histórico de balance
    for month_data in timeline:
        for account in accounts:
            if account.platform.name != 'luxonpay':  # Apenas sites de poker têm histórico de P&L
                # Simular atualização mensal
                old_balance = float(account.current_balance) 
                change = month_data["pnl"] * random.uniform(0.1, 0.3)  # Cada conta contribui parcialmente
                new_balance = max(0, old_balance + change)
                
                history = BalanceHistory(
                    account_id=account.id,
                    old_balance=Decimal(old_balance),
                    new_balance=Decimal(new_balance),
                    change_reason="monthly_update",
                    changed_by=1,  # Admin
                    created_at=month_data["date"]
                )
                db.session.add(history)
                
                # Atualizar saldo atual da conta
                account.current_balance = Decimal(new_balance)
        
        # Criar solicitações se necessário
        if month_data["needs_reload"] and month_data["reload_amount"] > 0:
            reload = ReloadRequest(
                user_id=user.id,
                platform_id=platform_dict['luxonpay'].id,
                amount=Decimal(month_data["reload_amount"]),
                status=ReloadStatus.PENDING if random.random() < 0.3 else ReloadStatus.APPROVED,
                player_notes="Preciso de reload para continuar jogando",
                created_at=month_data["date"]
            )
            db.session.add(reload)
        
        if month_data["wants_withdrawal"] and month_data["withdrawal_amount"] > 0:
            poker_accounts = [acc for acc in accounts if acc.platform.name != 'luxonpay']
            if poker_accounts:
                withdrawal = WithdrawalRequest(
                    user_id=user.id,
                    platform_id=random.choice(poker_accounts).platform_id,
                    amount=Decimal(month_data["withdrawal_amount"]),
                    status=WithdrawalStatus.PENDING if random.random() < 0.2 else WithdrawalStatus.COMPLETED,
                    player_notes="Solicitação de saque dos lucros",
                    created_at=month_data["date"]
                )
                db.session.add(withdrawal)
    
    return user


def simulate_full_year_operation():
    """Simula 1 ano completo de operação do time"""
    
    print("🧹 Limpando dados existentes...")
    clear_result = clear_all_player_data()
    print(f"   Removidos: {clear_result}")
    
    print("👥 Criando jogadores com histórico de 1 ano...")
    start_date = datetime.utcnow() - timedelta(days=365)
    
    created_players = []
    for profile in PLAYER_PROFILES:
        print(f"   Criando: {profile['name']} ({profile['type']})")
        player = create_player_with_history(profile, start_date)
        created_players.append(player)
    
    # Criar algumas solicitações pendentes recentes
    print("📋 Criando solicitações pendentes atuais...")
    for i in range(3):
        player = random.choice(created_players)
        
        # Reload pendente
        luxon_platform = Platform.query.filter_by(name='luxonpay').first()
        if not luxon_platform:
            continue
        reload = ReloadRequest(
            user_id=player.id,
            platform_id=luxon_platform.id,
            amount=Decimal(random.randint(300, 800)),
            status=ReloadStatus.PENDING,
            player_notes=f"Reload urgente - {random.choice(['bad beat', 'downswing', 'oportunidade boa'])}",
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 5))
        )
        db.session.add(reload)
        
        # Saque pendente
        if random.random() < 0.7:  # 70% chance
            withdrawal = WithdrawalRequest(
                user_id=player.id,
                platform_id=random.choice([
                    acc.platform_id for acc in player.accounts 
                    if acc.platform.name != 'luxonpay'
                ]),
                amount=Decimal(random.randint(200, 600)),
                status=WithdrawalStatus.PENDING,
                player_notes="Saque dos lucros do mês",
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 3))
            )
            db.session.add(withdrawal)
    
    db.session.commit()
    
    print(f"✅ Simulação completa! {len(created_players)} jogadores criados com 1 ano de histórico")
    return {
        "players_created": len(created_players),
        "profiles": [p["type"] for p in PLAYER_PROFILES],
        "start_date": start_date.isoformat(),
        "end_date": datetime.utcnow().isoformat()
    }
