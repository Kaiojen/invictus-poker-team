"""
Migration: Adicionar campos paid_back e paid_back_at na tabela reload_requests
Para implementar lógica de quitação de reload antes de permitir saque

Executar: python -c "from add_reload_payback_fields import add_reload_payback_fields; add_reload_payback_fields()"
"""

import sqlite3
import os

def add_reload_payback_fields():
    """Adiciona campos de quitação de reload à tabela reload_requests"""
    
    # Tentar diferentes locais do banco
    possible_paths = [
        os.path.join(os.path.dirname(__file__), '..', '..', '..', 'instance', 'poker_system.db'),
        os.path.join(os.path.dirname(__file__), '..', '..', '..', 'instance', 'invictus_poker.db'),
        os.path.join(os.path.dirname(__file__), '..', '..', '..', 'invictus_poker.db'),
        os.path.join(os.path.dirname(__file__), '..', 'app.db')
    ]
    
    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            print(f"🔍 Banco encontrado em: {path}")
            break
    
    if not db_path:
        print(f"❌ Nenhum banco de dados encontrado nos locais esperados")
        print(f"   Locais verificados: {possible_paths}")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Verificar se as colunas já existem
        cursor.execute("PRAGMA table_info(reload_requests)")
        columns = [column[1] for column in cursor.fetchall()]
        
        changes_made = False
        
        if 'paid_back' not in columns:
            print("🔧 Adicionando campo paid_back...")
            cursor.execute("""
                ALTER TABLE reload_requests 
                ADD COLUMN paid_back BOOLEAN DEFAULT 0
            """)
            changes_made = True
            print("✅ Campo paid_back adicionado!")
        else:
            print("✅ Campo paid_back já existe!")
            
        if 'paid_back_at' not in columns:
            print("🔧 Adicionando campo paid_back_at...")
            cursor.execute("""
                ALTER TABLE reload_requests 
                ADD COLUMN paid_back_at DATETIME
            """)
            changes_made = True
            print("✅ Campo paid_back_at adicionado!")
        else:
            print("✅ Campo paid_back_at já existe!")
            
        if changes_made:
            conn.commit()
            print("🎉 Migration concluída com sucesso!")
        else:
            print("📋 Nenhuma alteração necessária!")
        
    except sqlite3.Error as e:
        print(f"❌ Erro na migration: {e}")
        
    finally:
        conn.close()

if __name__ == '__main__':
    add_reload_payback_fields()
