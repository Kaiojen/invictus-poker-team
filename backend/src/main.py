import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from sqlalchemy import event, Engine
import sqlite3
from src.models.models import db
from src.config.database import get_database_config
from src.routes.auth import auth_bp
from src.routes.users import users_bp
from src.routes.platforms import platforms_bp
from src.routes.accounts import accounts_bp
from src.routes.reload_requests import reload_requests_bp
from src.routes.transactions import transactions_bp
from src.routes.dashboard import dashboard_bp
from src.routes.retas import retas_bp
from src.routes.planilhas import planilhas_bp
from src.routes.withdrawal_requests import withdrawal_requests_bp
from src.routes.documents import documents_bp
from src.routes.audit import audit_bp
from src.routes.registration import registration_bp
from src.routes.backup import backup_bp
from src.routes.reports import reports_bp
from src.routes.notifications import notifications_bp
from src.routes.messages import messages_bp
from src.routes.sse import sse_bp
from src.routes.reload_payback import reload_payback_bp
from src.routes.team_investment import team_investment_bp
from src.routes.team_snapshots import team_snapshots_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Configurações de segurança (SECRET_KEY via ambiente)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'invictus-poker-team-secret-key-2024')

# Configurações de sessão segura
app.config['SESSION_COOKIE_SECURE'] = True  # HTTPS apenas
app.config['SESSION_COOKIE_HTTPONLY'] = True  # JavaScript não pode acessar
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Proteção CSRF básica

# Configurações de banco de dados
db_config = get_database_config()
app.config.update(db_config)

# Configurar CORS para desenvolvimento e produção
allowed_origins = [
    "http://localhost:3000", 
    "http://localhost:5173", 
    "http://127.0.0.1:3000", 
    "http://127.0.0.1:5173",
]

# Adicionar origins de produção se definidos
cors_origins = os.environ.get('CORS_ORIGINS', '')
if cors_origins:
    production_origins = [origin.strip() for origin in cors_origins.split(',') if origin.strip()]
    allowed_origins.extend(production_origins)

# Habilitar CORS para todas as rotas
CORS(app, 
     origins=allowed_origins,
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])

# Registrar blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(users_bp, url_prefix='/api/users')
app.register_blueprint(platforms_bp, url_prefix='/api/platforms')
app.register_blueprint(accounts_bp, url_prefix='/api/accounts')
app.register_blueprint(reload_requests_bp, url_prefix='/api/reload-requests')
app.register_blueprint(transactions_bp, url_prefix='/api/transactions')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(retas_bp, url_prefix='/api/retas')
app.register_blueprint(planilhas_bp, url_prefix='/api/planilhas')
app.register_blueprint(withdrawal_requests_bp, url_prefix='/api/withdrawal-requests')
app.register_blueprint(documents_bp, url_prefix='/api/documents')
app.register_blueprint(audit_bp, url_prefix='/api/audit')
app.register_blueprint(registration_bp, url_prefix='/api/registration')
app.register_blueprint(backup_bp, url_prefix='/api/backup')
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
# Mensagens internas desativadas por diretriz (usar Discord externo)
# app.register_blueprint(messages_bp, url_prefix='/api/messages')
app.register_blueprint(sse_bp, url_prefix='/api/sse')
app.register_blueprint(reload_payback_bp, url_prefix='/api/reload-payback')
app.register_blueprint(team_investment_bp, url_prefix='/api/team-investment')
app.register_blueprint(team_snapshots_bp, url_prefix='/api/team')

# Configuração SQLite com WAL mode e otimizações
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Configura SQLite para WAL mode e otimizações de performance"""
    if 'sqlite' in str(dbapi_connection):
        cursor = dbapi_connection.cursor()
        # Habilitar WAL mode para melhor concorrência
        cursor.execute("PRAGMA journal_mode=WAL")
        # Configurar sincronização para balance entre performance e segurança
        cursor.execute("PRAGMA synchronous=NORMAL")
        # Otimizações de performance
        cursor.execute("PRAGMA temp_store=memory")
        cursor.execute("PRAGMA mmap_size=268435456")  # 256MB
        cursor.execute("PRAGMA cache_size=10000")
        # Configurar timeout para operações
        cursor.execute("PRAGMA busy_timeout=30000")  # 30 segundos
        cursor.close()

# Inicializar banco de dados
db.init_app(app)

# Inicializar banco de dados e dados iniciais
with app.app_context():
    db.create_all()
    
    # Criar dados iniciais se não existirem, tolerando divergências de schema
    from src.utils.init_data import create_initial_data
    try:
        create_initial_data()
    except Exception as e:
        from sqlalchemy.exc import OperationalError
        if isinstance(e, OperationalError):
            print(f"ATENCAO: Divergencia de schema detectada ao criar dados iniciais: {e}")
            print("Reinicializando banco (drop_all -> create_all) e tentando novamente...")
            db.drop_all()
            db.create_all()
            create_initial_data()
        else:
            raise
    
    # Inicializar sistema de backup automático
    from src.utils.backup_manager import init_backup_manager
    try:
        # Obter o caminho do banco de dados da configuração
        database_uri = app.config['SQLALCHEMY_DATABASE_URI']
        if database_uri.startswith('sqlite:///'):
            database_path = database_uri.replace('sqlite:///', '')
        else:
            database_path = None
        
        if database_path:
            backup_manager = init_backup_manager(database_path, auto_start=True)
            print("OK: Sistema de backup automatico inicializado")
            print(f"INFO: Backups salvos em: {backup_manager.backup_dir}")
            print("INFO: Backup automatico configurado para cada 6 horas")
        else:
            print("INFO: Sistema de backup disponivel apenas para SQLite")
    except Exception as e:
        print(f"ATENCAO: Erro ao inicializar sistema de backup: {e}")
        print("ATENCAO: Sistema funcionara sem backup automatico")
    
    # Inicializar verificação periódica de dados incompletos
    import threading
    import time
    from src.utils.notification_service import get_notification_service
    
    def check_incomplete_data_periodically():
        """Verificar dados incompletos a cada 24 horas"""
        while True:
            time.sleep(86400)  # 24 horas
            try:
                notification_service = get_notification_service()
                notification_service.notify_incomplete_data()
                print("OK: Verificacao de dados incompletos executada")
            except Exception as e:
                print(f"ERRO: Verificacao de dados incompletos falhou: {e}")
    
    # Iniciar thread de verificação
    check_thread = threading.Thread(target=check_incomplete_data_periodically, daemon=True)
    check_thread.start()
    print("OK: Sistema de notificacoes de pendencias ativado")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == '__main__':
    # Configuração para produção (Render) e desenvolvimento
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
