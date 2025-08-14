## Configurar envio de e‑mail (SMTP) para “Esqueci a senha”

Este guia explica como habilitar o envio de e‑mails no backend (Flask) para o fluxo de recuperação de senha.

### 1) O que é SMTP?

SMTP é o protocolo usado para enviar e‑mails. Você precisa de uma conta de e‑mail que ofereça acesso SMTP (Gmail, Outlook, provedor do seu domínio etc.).

### 2) Opção recomendada: Gmail com “Senha de app”

Requisitos: Verificação em duas etapas ativa na sua conta Google.

Passos:

1. Acesse sua Conta Google > Segurança > “Senhas de app”.
2. Crie uma nova senha de app (App: “Outro (personalizado)”, Nome: “Invictus Poker”).
3. Guarde a senha de 16 caracteres gerada.

Valores para configurar:

- SMTP_HOST: `smtp.gmail.com`
- SMTP_PORT: `587`
- SMTP_USER: `seu_email@gmail.com`
- SMTP_PASS: `SENHA_DE_APP` (a de 16 caracteres)
- SMTP_FROM: opcional (se vazio, usa SMTP_USER)
- FRONTEND_URL: `http://localhost:5173` (ou a URL pública do frontend)

### 3) Onde configurar no projeto

Crie um arquivo `.env` (ou defina variáveis de ambiente do sistema) com:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=seu_email@gmail.com
FRONTEND_URL=http://localhost:5173
```

Importante: reinicie o backend após configurar.

Observação: O backend já lê essas variáveis via `os.environ.get(...)`. Caso use `.env`, utilize uma ferramenta/terminal que exporte essas variáveis para o processo do Python, ou peça para o desenvolvedor habilitar `python-dotenv` (opcional) para carregar automaticamente.

### 4) Como funciona o fluxo de recuperação

1. Na tela de Login, clique em “Esqueceu a senha?”.
2. Informe seu nome de usuário ou e‑mail. Se existir, o sistema gera um token e tenta enviar um e‑mail com instruções.
3. Você tem duas formas de concluir a troca de senha:
   - Via link do e‑mail: o link abre o app já com o token preenchido (usa `#reset?token=...`).
   - Manualmente: clique em “Já tem o token? Inserir manualmente” e cole o token recebido por e‑mail.
4. Defina a nova senha (com confirmação) e conclua.

O e‑mail contém:

- Token de recuperação (válido por 1 hora)
- Link direto: `${FRONTEND_URL}/#reset?token=<TOKEN>`

### 5) Teste sem e‑mail (ambiente de desenvolvimento)

Se as variáveis SMTP não estiverem configuradas:

- O backend ainda gera o token e responde 200.
- O frontend exibe mensagem genérica e, em modo dev, registra o token no console do navegador (para testes). Você pode usar “Inserir manualmente” para colar o token e redefinir.

### 6) Alternativas ao Gmail

- Outlook/Office365: `smtp.office365.com` porta `587` (pode exigir app password se MFA).
- Provedor do seu domínio (cPanel etc.): consulte no painel as credenciais SMTP.

### 7) Segurança

- Nunca compartilhe senhas reais. Prefira “senhas de app”.
- Em produção, não exponha token na interface (já está oculto). O token expira em 1 hora.
