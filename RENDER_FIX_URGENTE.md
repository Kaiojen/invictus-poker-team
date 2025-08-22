# 🚨 **CORREÇÃO URGENTE - Deploy Render**

## ❌ **PROBLEMA IDENTIFICADO:**
O Render está detectando seu projeto como **Node.js** em vez de **Python**!

**Log do erro:**
```
==> Using Node.js version 22.16.0 (default)
==> Running build command 'yarn'...
npm error Could not read package.json
```

---

## ✅ **SOLUÇÃO IMEDIATA:**

### **1. 🗑️ DELETAR O SERVIÇO ATUAL**
1. Acesse o **Dashboard do Render**
2. Vá no seu serviço `invictus-poker-backend`
3. **Settings → Delete Service**

### **2. 🆕 CRIAR NOVO SERVIÇO (CONFIGURAÇÃO CORRETA)**

1. **New → Web Service**
2. **Connect GitHub**: `Kaiojen/invictus-poker-team`

3. **⚠️ CONFIGURAÇÕES CRÍTICAS:**
   ```
   Name: invictus-poker-backend
   Environment: Python 3  ⚠️ SELECIONE "Python 3", NÃO Node.js!
   Region: Ohio (US East)  
   Branch: master  ⚠️ Use "master", não "main"!
   Root Directory: backend  ⚠️ Escreva exatamente "backend"
   
   Build Command: pip install -r requirements.txt
   Start Command: chmod +x start.sh && ./start.sh
   ```

4. **Adicionar PostgreSQL:**
   - **New → PostgreSQL** (Free)
   - Conectar ao Web Service

5. **Environment Variables** (Adicione UMA POR VEZ):
   ```
   DATABASE_URL: [será gerado automaticamente]
   SECRET_KEY: invictus-poker-super-secret-key-2024
   FLASK_ENV: production  
   PYTHON_VERSION: 3.11.0
   CORS_ORIGINS: https://invictus-poker.vercel.app
   ```

---

## 📋 **CHECKLIST DE VERIFICAÇÃO:**

### **Antes de clicar "Create Web Service":**
- [ ] **Environment** = "Python 3" (NÃO Node.js)
- [ ] **Root Directory** = "backend"
- [ ] **Branch** = "master"
- [ ] **Build Command** = `pip install -r requirements.txt`
- [ ] **Start Command** = `chmod +x start.sh && ./start.sh`

### **Se ainda der erro:**
1. Verifique nos **logs** se aparece:
   - ✅ `Python Version: 3.11.x`
   - ✅ `pip install -r requirements.txt`
   - ❌ Se aparecer `yarn` ou `npm`, refaça tudo!

---

## 🔍 **ARQUIVOS CRIADOS PARA AJUDAR:**

- ✅ `backend/runtime.txt` - Define Python 3.11
- ✅ `backend/Procfile` - Comando de start
- ✅ `backend/render.yaml` - Configuração específica
- ✅ `backend/start.sh` - Script melhorado

---

## 🚀 **PRÓXIMOS PASSOS APÓS CORREÇÃO:**

1. **Deploy Backend** com configuração correta
2. **Pegar URL** do backend: `https://nome-do-seu-servico.onrender.com`
3. **Deploy Frontend** no Vercel com `VITE_API_URL`

---

## 🆘 **SE AINDA ASSIM DER PROBLEMA:**

**Mande screenshot das configurações do Render** para eu verificar!

**O importante é garantir que está selecionado "Python 3" e não Node.js!** 🐍
