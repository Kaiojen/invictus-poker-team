#!/usr/bin/env python3
"""
Script para migrar dados do SQLite para PostgreSQL.

Uso:
1. Configurar variáveis de ambiente:
   - DATABASE_URL=postgresql://user:password@host:5432/database
   - SQLITE_PATH=/path/to/sqlite/database.db (opcional, usa o padrão)

2. Executar:
   python migrate_to_postgresql.py

Este script:
- Conecta ao SQLite existente
- Conecta ao PostgreSQL de destino
- Migra todos os dados preservando integridade referencial
- Faz backup do SQLite antes da migração
"""

import os
import sys
import shutil
from datetime import datetime
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.orm import sessionmaker
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_sqlite_path():
    """Obter caminho do banco SQLite."""
    return os.environ.get('SQLITE_PATH', 'src/database/app.db')

def get_postgresql_url():
    """Obter URL do PostgreSQL."""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL não definida. Configure com postgresql://user:password@host:5432/database")
    
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    return database_url

def backup_sqlite():
    """Fazer backup do SQLite antes da migração."""
    sqlite_path = get_sqlite_path()
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"Banco SQLite não encontrado: {sqlite_path}")
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = f"{sqlite_path}.backup_{timestamp}"
    
    logger.info(f"Fazendo backup do SQLite: {backup_path}")
    shutil.copy2(sqlite_path, backup_path)
    return backup_path

def migrate_data():
    """Migrar dados do SQLite para PostgreSQL."""
    
    # Fazer backup
    backup_path = backup_sqlite()
    logger.info(f"Backup criado: {backup_path}")
    
    # Conectar aos bancos
    sqlite_url = f"sqlite:///{get_sqlite_path()}"
    postgresql_url = get_postgresql_url()
    
    logger.info("Conectando ao SQLite...")
    sqlite_engine = create_engine(sqlite_url)
    
    logger.info("Conectando ao PostgreSQL...")
    postgresql_engine = create_engine(postgresql_url)
    
    # Criar sessões
    SqliteSession = sessionmaker(bind=sqlite_engine)
    PostgreSQLSession = sessionmaker(bind=postgresql_engine)
    
    sqlite_session = SqliteSession()
    postgresql_session = PostgreSQLSession()
    
    try:
        # Obter metadados das tabelas
        metadata = MetaData()
        metadata.reflect(bind=sqlite_engine)
        
        # Ordem de migração (respeitando foreign keys)
        table_order = [
            'users',
            'platforms', 
            'retas',
            'required_fields',
            'accounts',
            'player_data',
            'player_field_values',
            'platform_permissions',
            'reload_requests',
            'withdrawal_requests',
            'transactions',
            'documents',
            'balance_history',
            'audit_logs',
            'notifications'
        ]
        
        # Desabilitar constraints temporariamente no PostgreSQL
        postgresql_session.execute(text("SET session_replication_role = replica;"))
        
        for table_name in table_order:
            if table_name not in metadata.tables:
                logger.warning(f"Tabela {table_name} não encontrada no SQLite")
                continue
                
            table = metadata.tables[table_name]
            
            logger.info(f"Migrando tabela: {table_name}")
            
            # Buscar dados do SQLite
            select_stmt = table.select()
            sqlite_data = sqlite_session.execute(select_stmt).fetchall()
            
            if not sqlite_data:
                logger.info(f"  - Tabela {table_name} está vazia")
                continue
            
            # Limpar tabela de destino
            postgresql_session.execute(table.delete())
            
            # Inserir dados no PostgreSQL
            for row in sqlite_data:
                insert_stmt = table.insert().values(**row._mapping)
                postgresql_session.execute(insert_stmt)
            
            logger.info(f"  - Migrados {len(sqlite_data)} registros")
        
        # Reabilitar constraints
        postgresql_session.execute(text("SET session_replication_role = DEFAULT;"))
        
        # Atualizar sequences do PostgreSQL
        logger.info("Atualizando sequences do PostgreSQL...")
        
        for table_name in table_order:
            if table_name not in metadata.tables:
                continue
                
            table = metadata.tables[table_name]
            
            # Verificar se há coluna id (primary key)
            if 'id' in table.columns:
                seq_name = f"{table_name}_id_seq"
                
                # Obter o maior ID
                max_id_result = postgresql_session.execute(
                    text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")
                ).scalar()
                
                if max_id_result and max_id_result > 0:
                    # Atualizar sequence
                    postgresql_session.execute(
                        text(f"SELECT setval('{seq_name}', {max_id_result}, true)")
                    )
                    logger.info(f"  - Sequence {seq_name} atualizada para {max_id_result}")
        
        # Commit da transação
        postgresql_session.commit()
        
        logger.info("✅ Migração concluída com sucesso!")
        logger.info(f"📁 Backup do SQLite salvo em: {backup_path}")
        
        # Validar migração
        validate_migration(sqlite_session, postgresql_session, metadata)
        
    except Exception as e:
        logger.error(f"❌ Erro durante a migração: {e}")
        postgresql_session.rollback()
        raise
    finally:
        sqlite_session.close()
        postgresql_session.close()

def validate_migration(sqlite_session, postgresql_session, metadata):
    """Validar se a migração foi bem-sucedida."""
    logger.info("Validando migração...")
    
    for table_name, table in metadata.tables.items():
        # Contar registros em ambos os bancos
        sqlite_count = sqlite_session.execute(
            text(f"SELECT COUNT(*) FROM {table_name}")
        ).scalar()
        
        postgresql_count = postgresql_session.execute(
            text(f"SELECT COUNT(*) FROM {table_name}")
        ).scalar()
        
        if sqlite_count != postgresql_count:
            logger.error(f"❌ Divergência na tabela {table_name}: SQLite={sqlite_count}, PostgreSQL={postgresql_count}")
        else:
            logger.info(f"✅ Tabela {table_name}: {sqlite_count} registros")

if __name__ == "__main__":
    try:
        print("🚀 Iniciando migração SQLite → PostgreSQL")
        print("=" * 50)
        
        migrate_data()
        
        print("=" * 50)
        print("✅ Migração concluída!")
        print("\n📝 Próximos passos:")
        print("1. Atualizar DATABASE_URL no ambiente de produção")
        print("2. Verificar se todas as funcionalidades estão funcionando")
        print("3. Monitorar logs para identificar problemas")
        
    except Exception as e:
        logger.error(f"💥 Falha na migração: {e}")
        sys.exit(1)

