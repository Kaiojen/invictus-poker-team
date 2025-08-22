#!/bin/bash
# start.sh - Script de inicialização para Render

echo "🚀 Iniciando Invictus Poker Backend..."

# Verificar se estamos no diretório correto
if [ ! -f "src/main.py" ]; then
    echo "❌ Arquivo main.py não encontrado. Verificando estrutura..."
    ls -la
    exit 1
fi

# Configurar variáveis de ambiente padrão
export FLASK_ENV=${FLASK_ENV:-production}
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

echo "📁 Estrutura do projeto:"
ls -la

echo "📦 Inicializando banco de dados..."
cd src
python -c "from main import app; app.app_context().push(); from models.models import db; db.create_all(); print('✅ Banco inicializado')"

echo "🌐 Iniciando servidor com Gunicorn..."
cd ..
exec gunicorn -c gunicorn_config.py src.main:app
