#!/bin/bash
# start.sh - Script de inicialização para Render

echo "🚀 Iniciando Invictus Poker Backend..."
echo "🐍 Python Version: $(python --version)"
echo "📁 Current Directory: $(pwd)"

# Configurar variáveis de ambiente
export FLASK_ENV=${FLASK_ENV:-production}
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
export PORT=${PORT:-10000}

# Verificar estrutura
echo "📁 Estrutura do projeto:"
ls -la

# Verificar se o arquivo principal existe
if [ ! -f "src/main.py" ]; then
    echo "❌ Arquivo src/main.py não encontrado!"
    echo "📋 Arquivos na pasta src:"
    ls -la src/ 2>/dev/null || echo "❌ Pasta src não encontrada!"
    exit 1
fi

# Verificar se gunicorn está instalado
if ! command -v gunicorn &> /dev/null; then
    echo "❌ Gunicorn não encontrado! Instalando..."
    pip install gunicorn
fi

echo "📦 Inicializando banco de dados..."
cd src
python -c "
try:
    from main import app
    with app.app_context():
        from models.models import db
        db.create_all()
        print('✅ Banco inicializado com sucesso')
except Exception as e:
    print(f'⚠️ Erro na inicialização do banco: {e}')
    print('🔄 Continuando mesmo assim...')
"

echo "🌐 Iniciando servidor com Gunicorn..."
echo "🔗 Servidor rodará na porta: $PORT"

cd ..
exec gunicorn -c gunicorn_config.py src.main:app
