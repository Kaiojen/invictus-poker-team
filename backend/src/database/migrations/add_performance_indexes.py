#!/usr/bin/env python3
"""
Migração para adicionar índices de performance
Phase 5 - Otimizações de performance e índices do banco
"""

import sqlite3
import sys
import os
from pathlib import Path

# Adicionar o diretório pai ao path para imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config.database import get_database_config

def add_performance_indexes():
    """Adicionar índices para melhorar performance das queries principais"""
    
    try:
        config = get_database_config()
        db_path = config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        
        print(f"Conectando ao banco: {db_path}")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Lista de índices para criar
        indexes = [
            # Tabela users - filtros comuns
            "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
            "CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_users_reta_id ON users(reta_id)",
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            
            # Tabela accounts - queries de dashboard e planilhas
            "CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_accounts_platform_id ON accounts(platform_id)",
            "CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON accounts(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_accounts_has_account ON accounts(has_account)",
            "CREATE INDEX IF NOT EXISTS idx_accounts_user_platform ON accounts(user_id, platform_id)",
            "CREATE INDEX IF NOT EXISTS idx_accounts_balance_update ON accounts(last_balance_update)",
            
            # Tabela transactions - histórico e relatórios
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_platform_id ON transactions(platform_id)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by)",
            
            # Tabela reload_requests - pendências e aprovações
            "CREATE INDEX IF NOT EXISTS idx_reload_requests_user_id ON reload_requests(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_reload_requests_status ON reload_requests(status)",
            "CREATE INDEX IF NOT EXISTS idx_reload_requests_platform_id ON reload_requests(platform_id)",
            "CREATE INDEX IF NOT EXISTS idx_reload_requests_created_at ON reload_requests(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_reload_requests_approved_by ON reload_requests(approved_by)",
            "CREATE INDEX IF NOT EXISTS idx_reload_requests_user_status ON reload_requests(user_id, status)",
            
            # Tabela withdrawal_requests - pendências e aprovações
            "CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status)",
            "CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_approved_by ON withdrawal_requests(approved_by)",
            "CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_status ON withdrawal_requests(user_id, status)",
            
            # Tabela notifications - centro de notificações
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_is_urgent ON notifications(is_urgent)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)",
            
            # Tabela audit_logs - auditoria e relatórios
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address)",
            
            # Tabela balance_history - gráficos de evolução
            "CREATE INDEX IF NOT EXISTS idx_balance_history_account_id ON balance_history(account_id)",
            "CREATE INDEX IF NOT EXISTS idx_balance_history_user_id ON balance_history(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_balance_history_created_at ON balance_history(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_balance_history_user_date ON balance_history(user_id, created_at)",
            
            # Tabela platforms - joins frequentes
            "CREATE INDEX IF NOT EXISTS idx_platforms_is_active ON platforms(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_platforms_name ON platforms(name)",
            
            # Tabela retas - gestão de retas
            "CREATE INDEX IF NOT EXISTS idx_retas_is_active ON retas(is_active)",
            
            # Tabela player_data - perfis e dados incompletos
            "CREATE INDEX IF NOT EXISTS idx_player_data_user_id ON player_data(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_player_data_is_required ON player_data(is_required)",
            "CREATE INDEX IF NOT EXISTS idx_player_data_is_complete ON player_data(is_complete)",
            "CREATE INDEX IF NOT EXISTS idx_player_data_field_name ON player_data(field_name)",
        ]
        
        # Executar criação dos índices
        created_count = 0
        for index_sql in indexes:
            try:
                print(f"Criando índice: {index_sql.split('IF NOT EXISTS ')[1].split(' ON')[0]}")
                cursor.execute(index_sql)
                created_count += 1
            except Exception as e:
                print(f"Erro ao criar índice: {e}")
                continue
        
        # Atualizar estatísticas do SQLite
        print("Atualizando estatísticas do banco...")
        cursor.execute("ANALYZE")
        
        conn.commit()
        conn.close()
        
        print(f"\n✅ Migração concluída!")
        print(f"   - {created_count}/{len(indexes)} índices criados com sucesso")
        print(f"   - Estatísticas do banco atualizadas")
        print(f"   - Performance das queries deve melhorar significativamente")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Iniciando migração de performance - Adicionando índices...")
    success = add_performance_indexes()
    if success:
        print("\n🎉 Migração de performance concluída com sucesso!")
    else:
        print("\n💥 Falha na migração de performance")
        sys.exit(1)
