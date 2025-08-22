"""
Migration: Adicionar campo team_withdrawal_credits na tabela accounts
Para implementar lógica correta de saques com divisão 50%/50%

Executar: python -c "from add_team_withdrawal_credits import add_team_withdrawal_credits; add_team_withdrawal_credits()"
"""

import sqlite3
import os

def add_team_withdrawal_credits():
    """Adiciona campo team_withdrawal_credits à tabela accounts"""
    
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
        
        # Verificar se a coluna já existe
        cursor.execute("PRAGMA table_info(accounts)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'team_withdrawal_credits' not in columns:
            print("🔧 Adicionando campo team_withdrawal_credits...")
            
            cursor.execute("""
                ALTER TABLE accounts 
                ADD COLUMN team_withdrawal_credits DECIMAL(10, 2) DEFAULT 0.00
            """)
            
            print("✅ Campo team_withdrawal_credits adicionado com sucesso!")
        else:
            print("✅ Campo team_withdrawal_credits já existe!")
            
        conn.commit()
        
    except sqlite3.Error as e:
        print(f"❌ Erro na migration: {e}")
        
    finally:
        conn.close()

if __name__ == '__main__':
    add_team_withdrawal_credits()
