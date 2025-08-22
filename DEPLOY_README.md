# 🚀 Deploy Guide - Invictus Poker System

## 📋 Opções de Deploy

### 🎯 **Opção 1: Vercel (Frontend) + Render (Backend) - RECOMENDADO**

### 🔄 **Opção 2: Render Full-Stack**

---

## 🛠️ **Opção 1: Deploy Separado (Vercel + Render)**

### **🌐 Deploy Frontend no Vercel**

1. **Acesse [vercel.com](https://vercel.com)**
2. **Connect GitHub**: Importe este repositório
3. **Configure o projeto**:

   ```
   Framework Preset: Vite
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Adicione variável de ambiente**:

   ```
   VITE_API_URL = https://seu-backend.onrender.com
   ```

5. **Deploy**: Clique em "Deploy"

### **⚙️ Deploy Backend no Render**

1. **Acesse [render.com](https://render.com)**
2. **New → Web Service**
3. **Connect GitHub**: Selecione este repositório
4. **Configure o serviço**:

   ```
   Name: invictus-poker-backend
   Environment: Python 3
   Region: Ohio (US East)
   Branch: main
   Root Directory: backend
   Build Command: pip install -r requirements.txt
   Start Command: ./start.sh
   ```

5. **Adicione PostgreSQL**:

   - **New → PostgreSQL**
   - Conecte ao Web Service

6. **Environment Variables** (Adicione uma por uma):
   ```
   DATABASE_URL: [Auto-gerado pelo PostgreSQL]
   SECRET_KEY: invictus-poker-super-secret-key-2024
   FLASK_ENV: production
   CORS_ORIGINS: https://seu-frontend.vercel.app
   PYTHON_VERSION: 3.11.0
   ```

---

## 🔄 **Opção 2: Deploy Full-Stack no Render**

### **📦 Deploy Único no Render**

1. **Acesse [render.com](https://render.com)**
2. **New → Web Service**
3. **Configure**:

   ```
   Name: invictus-poker-fullstack
   Environment: Python 3
   Root Directory: backend
   Build Command: pip install -r requirements.txt && cd ../frontend && npm install && npm run build && cp -r dist/* ../backend/src/static/
   Start Command: ./start.sh
   ```

4. **Environment Variables**:
   ```
   DATABASE_URL: [Auto-gerado]
   SECRET_KEY: sua-chave-secreta
   FLASK_ENV: production
   ```

---

## 🔧 **Configurações Já Implementadas**

### ✅ **Backend (Flask)**

- ✅ Gunicorn configuration
- ✅ PostgreSQL support
- ✅ CORS configurado para produção
- ✅ Environment variables
- ✅ Start script otimizado

### ✅ **Frontend (React)**

- ✅ Vite build configuration
- ✅ API configuration dynamic
- ✅ Vercel.json configurado
- ✅ Environment variables support

### ✅ **Database**

- ✅ SQLite (desenvolvimento)
- ✅ PostgreSQL (produção)
- ✅ Auto-migration support

---

## 🌍 **URLs Finais**

### **Opção 1 (Separado):**

- **Frontend**: `https://invictus-poker.vercel.app`
- **Backend**: `https://invictus-poker-backend.onrender.com`

### **Opção 2 (Full-Stack):**

- **Aplicação**: `https://invictus-poker-fullstack.onrender.com`

---

## 🔐 **Variáveis de Ambiente Necessárias**

### **Backend (Render):**

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
SECRET_KEY=sua-chave-secreta-super-forte-aqui
FLASK_ENV=production
CORS_ORIGINS=https://seu-frontend.vercel.app
```

### **Frontend (Vercel):**

```bash
VITE_API_URL=https://seu-backend.onrender.com
```

---

## 📝 **Checklist de Deploy**

### **Pré-Deploy:**

- [x] Arquivos de configuração criados
- [x] Dependencies atualizadas
- [x] CORS configurado
- [x] Environment variables mapeadas
- [x] Build scripts configurados

### **Deploy Backend:**

- [ ] Criar conta no Render
- [ ] Conectar repositório GitHub
- [ ] Configurar Web Service
- [ ] Adicionar PostgreSQL
- [ ] Configurar Environment Variables
- [ ] Fazer deploy

### **Deploy Frontend:**

- [ ] Criar conta no Vercel
- [ ] Conectar repositório GitHub
- [ ] Configurar project settings
- [ ] Adicionar VITE_API_URL
- [ ] Fazer deploy

### **Pós-Deploy:**

- [ ] Testar login no sistema
- [ ] Verificar API calls
- [ ] Testar funcionalidades principais
- [ ] Configurar domínio personalizado (opcional)

---

## 🆘 **Troubleshooting**

### **Problema: Frontend não conecta com Backend**

**Solução**: Verificar se `VITE_API_URL` está correto e `CORS_ORIGINS` inclui a URL do frontend

### **Problema: Database connection failed**

**Solução**: Verificar se PostgreSQL está conectado ao Web Service no Render

### **Problema: Build failed**

**Solução**: Verificar se todas as dependências estão no requirements.txt e package.json

---

## 🎯 **Recomendação Final**

**Para iniciantes**: Use **Opção 2 (Render Full-Stack)** - mais simples
**Para produção**: Use **Opção 1 (Vercel + Render)** - melhor performance

---

## 📞 **Suporte**

Em caso de problemas:

1. Verificar logs no dashboard da plataforma
2. Confirmar environment variables
3. Testar localmente antes do deploy

**Sistema preparado por**: Gabriel Peçanha  
**Data**: Janeiro 2025
