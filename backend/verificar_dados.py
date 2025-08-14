#!/usr/bin/env python3
"""
Script para verificar se os dados da Fase 3 foram criados corretamente
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

try:
    from src.main import app
    from src.models.models import db, User, Account, Platform, Reta, ReloadRequest, Transaction, AuditLog
    
    print("🔍 VERIFICANDO DADOS DA FASE 3...")
    print("=" * 50)
    
    with app.app_context():
        # Verificar usuários
        users = User.query.all()
        print(f"👥 USUÁRIOS: {len(users)} encontrados")
        
        admins = [u for u in users if u.role.value in ['admin', 'manager']]
        players = [u for u in users if u.role.value == 'player']
        
        print(f"   🔑 Admins/Managers: {len(admins)}")
        for admin in admins:
            print(f"      - {admin.username} ({admin.role.value})")
        
        print(f"   🎰 Jogadores: {len(players)}")
        for player in players:
            print(f"      - {player.username} ({player.full_name})")
        
        # Verificar plataformas
        platforms = Platform.query.all()
        print(f"\n🏦 PLATAFORMAS: {len(platforms)} cadastradas")
        for platform in platforms:
            print(f"   - {platform.display_name}")
        
        # Verificar contas
        accounts = Account.query.all()
        print(f"\n💰 CONTAS: {len(accounts)} criadas")
        total_balance = sum(float(acc.current_balance) for acc in accounts)
        print(f"   💎 Bankroll Total: R$ {total_balance:,.2f}")
        
        # Verificar retas
        retas = Reta.query.all()
        print(f"\n🎯 RETAS: {len(retas)} configuradas")
        for reta in retas:
            players_in_reta = User.query.filter_by(reta_id=reta.id).count()
            print(f"   - {reta.name}: {players_in_reta} jogadores")
        
        # Verificar transações
        transactions = Transaction.query.all()
        print(f"\n📊 TRANSAÇÕES: {len(transactions)} registradas")
        
        # Verificar reloads
        reloads = ReloadRequest.query.all()
        print(f"\n🔄 RELOADS: {len(reloads)} solicitações")
        
        # Verificar logs de auditoria
        logs = AuditLog.query.all()
        print(f"\n📝 LOGS DE AUDITORIA: {len(logs)} registros")
        
        print("\n" + "=" * 50)
        
        if len(users) >= 10 and len(players) == 8 and len(accounts) >= 20:
            print("✅ DADOS DA FASE 3 CRIADOS CORRETAMENTE!")
            print("✅ Sistema pronto para uso!")
            print("\n🚀 Para iniciar:")
            print("   Backend: python src/main.py")
            print("   Frontend: npm run dev (no diretório frontend)")
        else:
            print("❌ DADOS INCOMPLETOS!")
            print(f"   Esperado: 10+ usuários, 8 jogadores, 20+ contas")
            print(f"   Encontrado: {len(users)} usuários, {len(players)} jogadores, {len(accounts)} contas")
            print("\n🔧 Execute novamente: python setup_db.py")

except Exception as e:
    print(f"❌ ERRO: {e}")
    print("\n🔧 Possíveis soluções:")
    print("1. Execute: python setup_db.py")
    print("2. Verifique se está no diretório backend/")
    print("3. Verifique se o Python está funcionando")
