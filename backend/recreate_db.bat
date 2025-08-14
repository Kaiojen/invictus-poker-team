@echo off
echo 🔄 Recriando banco de dados...
if exist "src\database\app.db" del "src\database\app.db"
python setup_db.py
echo ✅ Banco recriado! Agora execute: python src/main.py
pause
