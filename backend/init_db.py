#!/usr/bin/env python3
"""
Script para inicializar o banco de dados do sistema Invictus Poker Team
"""

import os
import sys

# Adicionar o diretório src ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.models.models import db
from src.main import app
import src.utils.init_data
from sqlalchemy.exc import OperationalError

def init_database():
    """Inicializa o banco de dados com dados iniciais"""
    print("🔄 Inicializando banco de dados...")
    
    # Usar contexto da aplicação
    with app.app_context():
        try:
            # Criar todas as tabelas
            print("📊 Criando tabelas...")
            db.create_all()

            # Inserir dados iniciais
            print("💾 Inserindo dados iniciais...")
            try:
                src.utils.init_data.create_initial_data()
            except OperationalError as op_err:
                # Provável divergência de schema (ex.: colunas novas) em um DB existente
                print(f"⚠️ Divergência de schema detectada: {op_err}")
                print("🧹 Reinicializando banco (drop_all -> create_all) e tentando novamente...")
                db.drop_all()
                db.create_all()
                src.utils.init_data.create_initial_data()

            print("✅ Banco de dados inicializado com sucesso!")
            return True

        except Exception as e:
            print(f"❌ Erro ao inicializar banco: {e}")
            return False

if __name__ == "__main__":
    if init_database():
        print("\n🚀 Sistema pronto para uso!")
        print("Backend: http://localhost:5000")
    else:
        print("\n💥 Falha na inicialização!")
        sys.exit(1)
