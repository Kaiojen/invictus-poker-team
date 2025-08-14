#!/usr/bin/env python3
"""
Script para configuração inicial do banco de dados
Fase 3 - Sistema Invictus Poker Team Completo
"""

import sys
import os

# Adicionar o diretório src ao path
sys.path.insert(0, os.path.dirname(__file__))

from src.main import app
from src.models.models import db
from src.utils.init_data import create_initial_data

def setup_database():
    """Configurar banco de dados e criar dados iniciais"""
    try:
        print("🎯 INVICTUS POKER TEAM - FASE 3 SETUP")
        print("=" * 50)
        
        with app.app_context():
            print("📊 Criando tabelas do banco de dados...")
            db.create_all()
            print("✅ Tabelas criadas com sucesso!")
            
            print("\n📝 Inicializando dados do sistema...")
            create_initial_data()
            
            print("\n🎉 SETUP COMPLETO!")
            print("=" * 50)
            print("\n🚀 Para iniciar o sistema, execute:")
            print("   python src/main.py")
            print("\n🌐 Acesse: http://localhost:5000")
            print("\n👤 Credenciais disponíveis:")
            print("   • Admin: admin / admin123")
            print("   • Manager: manager / manager123") 
            print("   • Jogador: joao_silva / jogador123")
            print("\n✨ Recursos da Fase 3:")
            print("   ✅ Auto-cadastro de jogadores")
            print("   ✅ Sistema de auditoria completo") 
            print("   ✅ 8 jogadores com dados realistas")
            print("   ✅ Histórico de transações e saldos")
            print("   ✅ Dashboard completo para gestores")
            
    except Exception as e:
        print(f"❌ Erro durante o setup: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = setup_database()
    sys.exit(0 if success else 1)
