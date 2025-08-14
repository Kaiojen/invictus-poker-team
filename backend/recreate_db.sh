#!/bin/bash
echo "🔄 Recriando banco de dados..."
rm -f src/database/app.db
python setup_db.py
echo "✅ Banco recriado! Agora execute: python src/main.py"
