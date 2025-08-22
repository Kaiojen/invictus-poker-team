# gunicorn_config.py
# Configuração do Gunicorn para Render

import os

# Bind to the port provided by Render
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"

# Worker configuration for Render's resource limits
workers = 2
worker_class = "sync" 
worker_connections = 1000

# Timeouts
timeout = 120
keepalive = 60

# Performance tuning
max_requests = 1000
max_requests_jitter = 100
preload_app = True

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "invictus-poker-backend"

# Enable auto-restart on code changes in development
reload = os.environ.get('FLASK_ENV') == 'development'
