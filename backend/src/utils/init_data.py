from src.models.models import (
    db, User, Platform, Account, PlayerData, UserRole, Reta, ReloadRequest, 
    Transaction, WithdrawalRequest, TransactionType, ReloadStatus, AccountStatus,
    BalanceHistory, AuditLog, RequiredField
)
from datetime import datetime, date
from decimal import Decimal
import json

def create_initial_data():
    """Criar dados iniciais se não existirem"""
    
    # Verificar se já existem dados
    if User.query.first() is not None:
        return  # Dados já existem
    
    try:
        # Criar retas primeiro
        retas = [
            Reta(name='Reta 0', min_stake=Decimal('1.00'), max_stake=Decimal('2.50'), description='ABI $1-2.5 - Proibido Hyper'),
            Reta(name='Reta 1', min_stake=Decimal('2.00'), max_stake=Decimal('5.50'), description='ABI $2-5.5 - Proibido Hyper'),
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
            bank_name='Banco Administração',
            bank_agency='0001',
            bank_account='00000-0'
        )
        admin_user.set_password('admin123')  # Senha padrão - deve ser alterada
        db.session.add(admin_user)
        
        # Criar usuário manager padrão
        manager_user = User(
            username='manager',
            email='manager@invictuspoker.com',
            full_name='Gestor Principal',
            role=UserRole.MANAGER,
            phone='(11) 99999-0001',
            document='111.111.111-11',
            birth_date=date(1988, 6, 15),
            pix_key='manager@invictuspoker.com',
            bank_name='Banco do Brasil',
            bank_agency='1111-1',
            bank_account='11111-1'
        )
        manager_user.set_password('manager123')  # Senha padrão - deve ser alterada
        db.session.add(manager_user)
        
        # Criar jogadores de exemplo realistas (8 jogadores)
        players_data = [
            {
                'username': 'joao_silva',
                'email': 'joao.silva@invictuspoker.com',
                'full_name': 'João Silva',
                'password': 'jogador123',
                'phone': '(11) 99999-1111',
                'document': '111.222.333-44',
                'birth_date': date(1990, 5, 15),
                'bank_name': 'Banco do Brasil',
                'bank_agency': '1234-5',
                'bank_account': '12345-6',
                'pix_key': 'joao.silva@email.com',
                'reta_id': 2,  # Reta 1 - Mid stakes
                'makeup': Decimal('0.00')
            },
            {
                'username': 'maria_santos',
                'email': 'maria.santos@invictuspoker.com',
                'full_name': 'Maria Santos',
                'password': 'jogador123',
                'phone': '(21) 88888-2222',
                'document': '222.333.444-55',
                'birth_date': date(1992, 8, 20),
                'bank_name': 'Itaú',
                'bank_agency': '5678-9',
                'bank_account': '54321-0',
                'pix_key': '(21) 88888-2222',
                'reta_id': 1,  # Reta 0 - Low stakes
                'makeup': Decimal('150.00')
            },
            {
                'username': 'pedro_costa',
                'email': 'pedro.costa@invictuspoker.com',
                'full_name': 'Pedro Costa',
                'password': 'jogador123',
                'phone': '(31) 77777-3333',
                'document': '333.444.555-66',
                'birth_date': date(1988, 12, 10),
                'bank_name': 'Bradesco',
                'bank_agency': '9876-1',
                'bank_account': '98765-4',
                'pix_key': 'pedro.costa.pix@gmail.com',
                'reta_id': 3,  # Reta 2 - High stakes
                'makeup': Decimal('0.00')
            },
            {
                'username': 'ana_oliveira',
                'email': 'ana.oliveira@invictuspoker.com',
                'full_name': 'Ana Oliveira',
                'password': 'jogador123',
                'phone': '(85) 66666-4444',
                'document': '444.555.666-77',
                'birth_date': date(1995, 3, 25),
                'bank_name': 'Nubank',
                'bank_agency': '0001',
                'bank_account': '11111-1',
                'pix_key': 'ana.oliveira@nubank.com.br',
                'reta_id': 1,  # Reta 0 - Low stakes
                'makeup': Decimal('75.50')
            },
            {
                'username': 'carlos_rodrigues',
                'email': 'carlos.rodrigues@invictuspoker.com',
                'full_name': 'Carlos Rodrigues',
                'password': 'jogador123',
                'phone': '(47) 55555-5555',
                'document': '555.666.777-88',
                'birth_date': date(1991, 7, 8),
                'bank_name': 'Santander',
                'bank_agency': '1111-2',
                'bank_account': '22222-3',
                'pix_key': 'carlos.rodrigues@santander.com.br',
                'reta_id': 2,  # Reta 1 - Mid stakes
                'makeup': Decimal('0.00')
            },
            {
                'username': 'fernanda_lima',
                'email': 'fernanda.lima@invictuspoker.com',
                'full_name': 'Fernanda Lima',
                'password': 'jogador123',
                'phone': '(19) 44444-6666',
                'document': '666.777.888-99',
                'birth_date': date(1993, 11, 14),
                'bank_name': 'Caixa Econômica',
                'bank_agency': '2222-3',
                'bank_account': '33333-4',
                'pix_key': 'fernanda.lima.pix@caixa.gov.br',
                'reta_id': 2,  # Reta 1 - Mid stakes
                'makeup': Decimal('0.00')
            },
            {
                'username': 'ricardo_alves',
                'email': 'ricardo.alves@invictuspoker.com',
                'full_name': 'Ricardo Alves',
                'password': 'jogador123',
                'phone': '(62) 33333-7777',
                'document': '777.888.999-00',
                'birth_date': date(1987, 9, 30),
                'bank_name': 'Inter',
                'bank_agency': '0001',
                'bank_account': '44444-5',
                'pix_key': 'ricardo.alves@bancointer.com.br',
                'reta_id': 4,  # Reta 3 - High stakes
                'makeup': Decimal('0.00')
            },
            {
                'username': 'patricia_souza',
                'email': 'patricia.souza@invictuspoker.com',
                'full_name': 'Patrícia Souza',
                'password': 'jogador123',
                'phone': '(51) 22222-8888',
                'document': '888.999.000-11',
                'birth_date': date(1994, 4, 18),
                'bank_name': 'Banco Original',
                'bank_agency': '3333-4',
                'bank_account': '55555-6',
                'pix_key': 'patricia.souza@original.com.br',
                'reta_id': 3,  # Reta 2 - High stakes
                'makeup': Decimal('0.00')
            }
        ]
        
        player_users = []
        for i, player_data in enumerate(players_data):
            player_user = User(
                username=player_data['username'],
                email=player_data['email'],
                full_name=player_data['full_name'],
                role=UserRole.PLAYER,
                phone=player_data['phone'],
                document=player_data['document'],
                birth_date=player_data['birth_date'],
                bank_name=player_data['bank_name'],
                bank_agency=player_data['bank_agency'],
                bank_account=player_data['bank_account'],
                pix_key=player_data['pix_key'],
                reta_id=player_data['reta_id'],
                makeup=player_data['makeup'],
                manager_notes=f'Jogador {i+1} - Dados completos e verificados'
            )
            player_user.set_password(player_data['password'])
            db.session.add(player_user)
            player_users.append(player_user)
        
        # Criar plataformas padrão expandidas
        platforms_data = [
            Platform(name='luxon', display_name='Luxon'),
            Platform(name='pokerstars', display_name='PokerStars'),
            Platform(name='party', display_name='Party'),
            Platform(name='gg', display_name='GG'),
            Platform(name='888', display_name='888'),
            Platform(name='ya', display_name='Ya')
        ]
        
        for platform in platforms_data:
            db.session.add(platform)
        
        # Commit para obter IDs dos usuários e plataformas
        db.session.commit()
        
        # Criar contas realistas para todos os 8 jogadores
        accounts_data = [
            # João Silva - Player profissional, múltiplas plataformas
            {'user_idx': 0, 'platform_idx': 0, 'account_name': 'joao_ps_br', 'balance': Decimal('3250.75'), 'initial': Decimal('2000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 0, 'platform_idx': 1, 'account_name': 'joao_gg_global', 'balance': Decimal('1890.50'), 'initial': Decimal('1500.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 0, 'platform_idx': 2, 'account_name': 'joao_party', 'balance': Decimal('680.25'), 'initial': Decimal('500.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            
            # Maria Santos - MTT specialist
            {'user_idx': 1, 'platform_idx': 0, 'account_name': 'maria_ps_mtt', 'balance': Decimal('1650.00'), 'initial': Decimal('1800.00'), 'status': AccountStatus.LOSS, 'has_account': True},
            {'user_idx': 1, 'platform_idx': 1, 'account_name': 'maria_gg_bounty', 'balance': Decimal('1420.75'), 'initial': Decimal('1200.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            
            # Pedro Costa - Cash game specialist
            {'user_idx': 2, 'platform_idx': 0, 'account_name': 'pedro_ps_cash', 'balance': Decimal('5670.25'), 'initial': Decimal('4000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 2, 'platform_idx': 1, 'account_name': 'pedro_gg_nl500', 'balance': Decimal('3240.80'), 'initial': Decimal('2500.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 2, 'platform_idx': 4, 'account_name': 'pedro_winamax', 'balance': Decimal('760.45'), 'initial': Decimal('600.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            
            # Ana Oliveira - SNG specialist
            {'user_idx': 3, 'platform_idx': 1, 'account_name': 'ana_gg_sng', 'balance': Decimal('1180.30'), 'initial': Decimal('1000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 3, 'platform_idx': 3, 'account_name': 'ana_888_mtt', 'balance': Decimal('550.60'), 'initial': Decimal('600.00'), 'status': AccountStatus.LOSS, 'has_account': True},
            
            # Carlos Rodrigues - Recreational player
            {'user_idx': 4, 'platform_idx': 0, 'account_name': 'carlos_ps_micro', 'balance': Decimal('820.50'), 'initial': Decimal('500.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 4, 'platform_idx': 1, 'account_name': 'carlos_gg_zoom', 'balance': Decimal('590.75'), 'initial': Decimal('400.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            
            # Fernanda Lima - Spin&Go specialist
            {'user_idx': 5, 'platform_idx': 0, 'account_name': 'fernanda_ps_spin', 'balance': Decimal('1950.80'), 'initial': Decimal('1500.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 5, 'platform_idx': 1, 'account_name': 'fernanda_gg_all_in', 'balance': Decimal('1320.40'), 'initial': Decimal('1000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 5, 'platform_idx': 7, 'account_name': 'fernanda_pppoker', 'balance': Decimal('450.70'), 'initial': Decimal('300.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            
            # Ricardo Alves - High stakes player
            {'user_idx': 6, 'platform_idx': 0, 'account_name': 'ricardo_ps_hs', 'balance': Decimal('8950.00'), 'initial': Decimal('5000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 6, 'platform_idx': 1, 'account_name': 'ricardo_gg_high', 'balance': Decimal('4230.75'), 'initial': Decimal('3000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 6, 'platform_idx': 9, 'account_name': 'ricardo_live_wsop', 'balance': Decimal('12500.00'), 'initial': Decimal('8000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            
            # Patrícia Souza - Mixed games
            {'user_idx': 7, 'platform_idx': 0, 'account_name': 'patricia_ps_mix', 'balance': Decimal('2780.90'), 'initial': Decimal('2000.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 7, 'platform_idx': 1, 'account_name': 'patricia_gg_plo', 'balance': Decimal('1540.60'), 'initial': Decimal('1200.00'), 'status': AccountStatus.PROFIT, 'has_account': True},
            {'user_idx': 7, 'platform_idx': 2, 'account_name': 'patricia_party', 'balance': Decimal('1890.25'), 'initial': Decimal('1500.00'), 'status': AccountStatus.PROFIT, 'has_account': True}
        ]
        
        created_accounts = []
        for acc_data in accounts_data:
            account = Account(
                user_id=player_users[acc_data['user_idx']].id,
                platform_id=platforms_data[acc_data['platform_idx']].id,
                account_name=acc_data['account_name'],
                current_balance=acc_data['balance'],
                initial_balance=acc_data['initial'],
                status=acc_data['status'],
                has_account=acc_data['has_account'],
                last_balance_update=datetime.utcnow(),
                balance_verified=True
            )
            db.session.add(account)
            created_accounts.append(account)
        
        # Commit para obter IDs das contas
        db.session.commit()
        
        # Criar transações e histórico de reload realistas
        reload_requests_data = [
            # Reloads aprovados recentes
            {
                'user_id': player_users[1].id, 'platform_id': platforms_data[0].id, 
                'amount': Decimal('500.00'), 'status': ReloadStatus.APPROVED,
                'player_notes': 'Reload para MTT Sunday Million',
                'manager_notes': 'Aprovado - jogadora regular',
                'approved_by': admin_user.id
            },
            {
                'user_id': player_users[4].id, 'platform_id': platforms_data[1].id,
                'amount': Decimal('200.00'), 'status': ReloadStatus.APPROVED,
                'player_notes': 'Preciso de mais banca para cash game',
                'manager_notes': 'Aprovado - primeiro reload do mês',
                'approved_by': manager_user.id
            },
            # Reload pendente
            {
                'user_id': player_users[3].id, 'platform_id': platforms_data[1].id,
                'amount': Decimal('300.00'), 'status': ReloadStatus.PENDING,
                'player_notes': 'Reload para torneio especial',
                'manager_notes': None,
                'approved_by': None
            }
        ]
        
        created_reload_requests = []
        for reload_data in reload_requests_data:
            reload_request = ReloadRequest(
                user_id=reload_data['user_id'],
                platform_id=reload_data['platform_id'],
                amount=reload_data['amount'],
                status=reload_data['status'],
                player_notes=reload_data['player_notes'],
                manager_notes=reload_data['manager_notes'],
                approved_by=reload_data['approved_by'],
                approved_at=datetime.utcnow() if reload_data['status'] == ReloadStatus.APPROVED else None
            )
            db.session.add(reload_request)
            created_reload_requests.append(reload_request)
        
        db.session.commit()
        
        # Criar transações baseadas nos reloads aprovados
        transactions_data = [
            {
                'user_id': player_users[1].id, 'platform_id': platforms_data[0].id,
                'transaction_type': TransactionType.RELOAD, 'amount': Decimal('500.00'),
                'description': 'Reload aprovado para MTT Sunday Million',
                'reload_request_id': created_reload_requests[0].id,
                'created_by': admin_user.id
            },
            {
                'user_id': player_users[4].id, 'platform_id': platforms_data[1].id,
                'transaction_type': TransactionType.RELOAD, 'amount': Decimal('200.00'),
                'description': 'Reload aprovado para cash game',
                'reload_request_id': created_reload_requests[1].id,
                'created_by': manager_user.id
            },
            # Algumas transações de lucro/prejuízo
            {
                'user_id': player_users[0].id, 'platform_id': platforms_data[0].id,
                'transaction_type': TransactionType.PROFIT, 'amount': Decimal('1250.75'),
                'description': 'Lucro acumulado PokerStars - Janeiro',
                'reload_request_id': None,
                'created_by': admin_user.id
            },
            {
                'user_id': player_users[6].id, 'platform_id': platforms_data[9].id,
                'transaction_type': TransactionType.PROFIT, 'amount': Decimal('4500.00'),
                'description': 'ITM WSOP Event #25 - Live',
                'reload_request_id': None,
                'created_by': admin_user.id
            }
        ]
        
        for trans_data in transactions_data:
            transaction = Transaction(
                user_id=trans_data['user_id'],
                platform_id=trans_data['platform_id'],
                transaction_type=trans_data['transaction_type'],
                amount=trans_data['amount'],
                description=trans_data['description'],
                reload_request_id=trans_data['reload_request_id'],
                created_by=trans_data['created_by']
            )
            db.session.add(transaction)
        
        # Criar histórico de saldos
        balance_history_data = []
        for i, account in enumerate(created_accounts):
            # Histórico inicial de criação da conta
            balance_history = BalanceHistory(
                account_id=account.id,
                old_balance=Decimal('0.00'),
                new_balance=account.initial_balance,
                change_reason='account_creation',
                notes=f'Conta criada com banca inicial de $ {account.initial_balance}',
                changed_by=admin_user.id
            )
            balance_history_data.append(balance_history)
            
            # Se houve mudança de saldo, criar histórico
            if account.current_balance != account.initial_balance:
                balance_change = BalanceHistory(
                    account_id=account.id,
                    old_balance=account.initial_balance,
                    new_balance=account.current_balance,
                    change_reason='profit' if account.current_balance > account.initial_balance else 'loss',
                    notes=f'Atualização de saldo - {"Lucro" if account.current_balance > account.initial_balance else "Prejuízo"} acumulado',
                    changed_by=admin_user.id
                )
                balance_history_data.append(balance_change)
        
        for balance_hist in balance_history_data:
            db.session.add(balance_hist)
        
        # Criar logs de auditoria para ações importantes
        audit_logs_data = [
            {
                'user_id': admin_user.id, 'action': 'system_initialization',
                'entity_type': 'System', 'entity_id': 1,
                'old_values': None, 'new_values': json.dumps({'status': 'initialized', 'users_created': 10, 'accounts_created': len(created_accounts)}),
                'ip_address': '127.0.0.1', 'user_agent': 'System Initialization'
            }
        ]
        
        for i, user in enumerate(player_users):
            audit_logs_data.append({
                'user_id': admin_user.id, 'action': 'user_created',
                'entity_type': 'User', 'entity_id': user.id,
                'old_values': None, 'new_values': json.dumps({'username': user.username, 'full_name': user.full_name, 'role': user.role.value}),
                'ip_address': '127.0.0.1', 'user_agent': 'System Initialization'
            })
        
        for audit_data in audit_logs_data:
            audit_log = AuditLog(
                user_id=audit_data['user_id'],
                action=audit_data['action'],
                entity_type=audit_data['entity_type'],
                entity_id=audit_data['entity_id'],
                old_values=audit_data['old_values'],
                new_values=audit_data['new_values'],
                ip_address=audit_data['ip_address'],
                user_agent=audit_data['user_agent']
            )
            db.session.add(audit_log)
        
        db.session.commit()
        
        print("🎯 SISTEMA INVICTUS POKER TEAM - FASE 3 COMPLETA! 🎯")
        print("=" * 60)
        print("\n🔐 USUÁRIOS CRIADOS:")
        print("- Admin: admin / admin123")
        print("- Manager: manager / manager123")
        print("\n👥 JOGADORES CADASTRADOS (8 players):")
        for i, user in enumerate(player_users):
            profit_accounts = [acc for acc in created_accounts if acc.user_id == user.id and acc.status == AccountStatus.PROFIT]
            total_profit = sum(acc.current_balance - acc.initial_balance for acc in profit_accounts)
            print(f"- {user.full_name}: {user.username} / jogador123 (Reta {user.reta_id}, P&L: +$ {total_profit:.2f})")
        
        print(f"\n🏦 PLATAFORMAS ATIVAS: {len(platforms_data)}")
        print(f"💰 CONTAS CRIADAS: {len(created_accounts)}")
        print(f"📊 TRANSAÇÕES: {len(transactions_data)}")
        print(f"🔄 RELOADS: {len(reload_requests_data)}")
        print(f"📝 LOGS DE AUDITORIA: {len(audit_logs_data)}")
        
        total_bankroll = sum(acc.current_balance for acc in created_accounts)
        print(f"\n💎 BANKROLL TOTAL DO TIME: $ {total_bankroll:.2f}")
        
        # Criar campos padrão da planilha
        print("\n📋 Criando campos padrão da planilha...")
        default_fields = [
            # Dados pessoais
            RequiredField(
                field_name='cpf',
                field_label='CPF',
                field_type='text',
                field_category='personal',
                placeholder='000.000.000-00',
                validation_regex=r'^\d{3}\.\d{3}\.\d{3}-\d{2}$',
                is_required=True,
                order=1,
                created_by=admin_user.id
            ),
            RequiredField(
                field_name='phone',
                field_label='Telefone',
                field_type='text',
                field_category='personal',
                placeholder='(00) 00000-0000',
                is_required=True,
                order=2,
                created_by=admin_user.id
            ),
            RequiredField(
                field_name='birth_date',
                field_label='Data de Nascimento',
                field_type='date',
                field_category='personal',
                is_required=True,
                order=3,
                created_by=admin_user.id
            ),
            # Dados bancários
            RequiredField(
                field_name='pix_key',
                field_label='Chave PIX',
                field_type='text',
                field_category='banking',
                placeholder='E-mail, CPF ou telefone',
                is_required=True,
                order=4,
                created_by=admin_user.id
            ),
            RequiredField(
                field_name='bank_name',
                field_label='Nome do Banco',
                field_type='text',
                field_category='banking',
                placeholder='Ex: Banco do Brasil',
                is_required=True,
                order=5,
                created_by=admin_user.id
            ),
            RequiredField(
                field_name='bank_agency',
                field_label='Agência',
                field_type='text',
                field_category='banking',
                placeholder='0000',
                is_required=False,
                order=6,
                created_by=admin_user.id
            ),
            RequiredField(
                field_name='bank_account',
                field_label='Conta',
                field_type='text',
                field_category='banking',
                placeholder='00000-0',
                is_required=False,
                order=7,
                created_by=admin_user.id
            ),
        ]
        
        for field in default_fields:
            db.session.add(field)
        
        db.session.commit()
        print(f"✅ {len(default_fields)} campos padrão criados!")
        
        print("\n✅ Sistema completamente funcional com dados realistas!")
        print("✅ Auto-cadastro implementado!")
        print("✅ Sistema de auditoria ativo!")
        print("✅ Dados de 8 jogadores com histórico completo!")
        print("✅ Sistema de planilhas configurado!")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao criar dados iniciais: {e}")
        import traceback
        traceback.print_exc()
        raise

