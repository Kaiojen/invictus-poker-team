"""
Configurações de banco de dados com suporte a SQLite (dev) e PostgreSQL (prod).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool


def get_database_config():
    """
    Retorna a configuração de banco baseada na variável de ambiente.
    
    Returns:
        dict: Configuração do SQLAlchemy
    """
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        # Ambiente de desenvolvimento - SQLite
        return {
            'SQLALCHEMY_DATABASE_URI': 'sqlite:///invictus_poker.db',
            'SQLALCHEMY_TRACK_MODIFICATIONS': False,
            'SQLALCHEMY_ENGINE_OPTIONS': {
                'poolclass': StaticPool,
                'pool_pre_ping': True,
                'connect_args': {
                    'check_same_thread': False,
                    'timeout': 20
                }
            }
        }
    
    # Produção - PostgreSQL
    if database_url.startswith('postgres://'):
        # Heroku fix: postgres:// -> postgresql://
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
    return {
        'SQLALCHEMY_DATABASE_URI': database_url,
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_size': int(os.environ.get('DB_POOL_SIZE', '10')),
            'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', '20')),
            'pool_timeout': int(os.environ.get('DB_POOL_TIMEOUT', '30')),
            'pool_recycle': int(os.environ.get('DB_POOL_RECYCLE', '3600')),
            'pool_pre_ping': True,
            'connect_args': {
                'sslmode': os.environ.get('DB_SSL_MODE', 'require')
            }
        }
    }


def create_database_engine():
    """
    Criar engine customizado baseado no ambiente.
    
    Returns:
        SQLAlchemy Engine
    """
    config = get_database_config()
    
    return create_engine(
        config['SQLALCHEMY_DATABASE_URI'],
        **config['SQLALCHEMY_ENGINE_OPTIONS']
    )


# Configurações recomendadas para produção PostgreSQL
PRODUCTION_RECOMMENDATIONS = """
# PostgreSQL Production Settings
# Adicionar ao arquivo de configuração do PostgreSQL (postgresql.conf):

# Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Write performance
wal_buffers = 16MB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# Logging
log_min_duration_statement = 1000
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Variáveis de ambiente recomendadas para produção:
# DATABASE_URL=postgresql://user:password@host:5432/database
# DB_POOL_SIZE=10
# DB_MAX_OVERFLOW=20
# DB_POOL_TIMEOUT=30
# DB_POOL_RECYCLE=3600
# DB_SSL_MODE=require
"""

