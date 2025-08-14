# Sistema Invictus Poker Team

## Visão Geral

O Sistema Invictus Poker Team é uma aplicação web completa desenvolvida para gerenciar jogadores de poker profissionais, suas contas em diferentes plataformas, solicitações de reload, transações financeiras e dados pessoais. O sistema foi projetado com uma identidade visual elegante em preto e dourado, refletindo a sofisticação e profissionalismo do time Invictus Poker Team.

## Características Principais

### Identidade Visual

- **Tema**: Preto e dourado (tons ouro metálico)
- **Layout**: Minimalista, moderno e elegante
- **Tipografia**: Montserrat (limpa e sofisticada)
- **Elementos visuais**: Ícones com bordas arredondadas e detalhes dourados
- **Sistema de cores para status**:
  - 🟢 Verde: Status completo/OK
  - 🟡 Amarelo/Ouro: Avisos e pendências
  - 🔴 Vermelho: Alertas graves e críticos

### Funcionalidades do Sistema

#### Gestão de Usuários

- Sistema de autenticação seguro com diferentes níveis de acesso
- Perfis de usuário: Admin, Manager, Player, Viewer
- Gerenciamento de dados pessoais dos jogadores
- Sistema de notificações para pendências

#### Gestão de Plataformas e Contas

- Cadastro de plataformas de poker (PokerStars, GGPoker, etc.)
- Gerenciamento de contas dos jogadores por plataforma
- Controle de saldos e histórico financeiro

#### Sistema de Reload

- Solicitação de reloads pelos jogadores
- Fluxo de aprovação/rejeição pelos gestores
- Histórico completo de solicitações
- Notificações automáticas

#### Dashboard Inteligente

- Visão consolidada para gestores com estatísticas gerais
- Dashboard personalizado para jogadores com seus dados
- Indicadores visuais de status e pendências
- Relatórios financeiros em tempo real

## Arquitetura do Sistema

### Backend (Flask)

- **Framework**: Flask (Python)
- **Banco de dados**: SQLite com WAL mode
- **Autenticação**: Session-based com cookies seguros
- **API**: RESTful com endpoints organizados por funcionalidade
- **CORS**: Habilitado para integração frontend-backend

### Frontend (React)

- **Framework**: React 18 com Vite
- **Estilização**: Tailwind CSS + shadcn/ui
- **Ícones**: Lucide React
- **Responsividade**: Mobile-first design
- **Estado**: React Hooks para gerenciamento local

### Estrutura de Dados

#### Modelos Principais

1. **User**: Usuários do sistema com diferentes roles
2. **Platform**: Plataformas de poker disponíveis
3. **Account**: Contas dos jogadores nas plataformas
4. **ReloadRequest**: Solicitações de reload
5. **Transaction**: Histórico de transações financeiras
6. **PlayerData**: Dados específicos dos jogadores

## Instalação e Configuração

### Pré-requisitos

- Python 3.11+
- Node.js 20+
- pnpm (gerenciador de pacotes)

### Backend (Flask)

```bash
cd invictus-poker-backend
source venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

### Frontend (React)

```bash
cd invictus-poker-frontend
pnpm install
pnpm run dev --host
```

## Usuários Padrão

O sistema vem com usuários pré-configurados para teste:

- **Admin**: `admin` / `admin123`
- **Manager**: `manager` / `manager123`
- **Jogador**: `jogador1` / `jogador123`

## Estrutura de Arquivos

### Backend

```
invictus-poker-backend/
├── src/
│   ├── models/
│   │   └── models.py          # Modelos de dados SQLAlchemy
│   ├── routes/
│   │   ├── auth.py            # Autenticação
│   │   ├── users.py           # Gestão de usuários
│   │   ├── platforms.py       # Gestão de plataformas
│   │   ├── accounts.py        # Gestão de contas
│   │   ├── reload_requests.py # Solicitações de reload
│   │   ├── transactions.py    # Transações
│   │   └── dashboard.py       # Dados do dashboard
│   ├── utils/
│   │   └── init_data.py       # Dados iniciais
│   ├── database/
│   │   └── app.db            # Banco SQLite
│   └── main.py               # Aplicação principal
├── venv/                     # Ambiente virtual Python
└── requirements.txt          # Dependências Python
```

### Frontend

```
invictus-poker-frontend/
├── src/
│   ├── components/
│   │   ├── ui/               # Componentes shadcn/ui
│   │   ├── LoginForm.jsx     # Formulário de login
│   │   └── Dashboard.jsx     # Dashboard principal
│   ├── assets/               # Recursos estáticos
│   ├── App.jsx              # Componente principal
│   ├── App.css              # Estilos personalizados
│   └── main.jsx             # Ponto de entrada
├── public/                   # Arquivos públicos
├── package.json             # Dependências Node.js
└── vite.config.js           # Configuração Vite
```

## API Endpoints

### Autenticação

- `POST /api/auth/login` - Login do usuário
- `POST /api/auth/logout` - Logout do usuário
- `GET /api/auth/me` - Dados do usuário atual
- `POST /api/auth/change-password` - Alterar senha

### Usuários

- `GET /api/users/` - Listar usuários
- `POST /api/users/` - Criar usuário
- `GET /api/users/{id}` - Obter usuário específico
- `PUT /api/users/{id}` - Atualizar usuário
- `DELETE /api/users/{id}` - Desativar usuário

### Plataformas

- `GET /api/platforms/` - Listar plataformas
- `POST /api/platforms/` - Criar plataforma
- `PUT /api/platforms/{id}` - Atualizar plataforma

### Contas

- `GET /api/accounts/` - Listar contas
- `POST /api/accounts/` - Criar conta
- `PUT /api/accounts/{id}` - Atualizar conta

### Solicitações de Reload

- `GET /api/reload-requests/` - Listar solicitações
- `POST /api/reload-requests/` - Criar solicitação
- `POST /api/reload-requests/{id}/approve` - Aprovar solicitação
- `POST /api/reload-requests/{id}/reject` - Rejeitar solicitação

### Dashboard

- `GET /api/dashboard/manager` - Dashboard do gestor
- `GET /api/dashboard/player` - Dashboard do jogador
- `GET /api/dashboard/statistics` - Estatísticas gerais

## Segurança

### Autenticação e Autorização

- Sistema de sessões com cookies seguros
- Controle de acesso baseado em roles
- Validação de permissões em todas as rotas
- Proteção contra CSRF

### Banco de Dados

- Senhas criptografadas com Werkzeug
- Soft delete para preservar integridade
- Constraints de integridade referencial
- Backup automático com WAL mode

## Desenvolvimento

### Padrões de Código

- Backend: PEP 8 (Python)
- Frontend: ESLint + Prettier
- Commits semânticos
- Documentação inline

### Testes

- Testes unitários para modelos
- Testes de integração para APIs
- Testes E2E para fluxos críticos

## Deployment

### Produção

O sistema está preparado para deployment usando:

- Backend: Gunicorn + Nginx
- Frontend: Build estático servido pelo Flask
- Banco: SQLite com backup automático

### Variáveis de Ambiente

```bash
FLASK_ENV=production
SECRET_KEY=sua-chave-secreta-aqui
DATABASE_URL=sqlite:///app.db
```

## Suporte e Manutenção

### Logs

- Logs estruturados em JSON
- Rotação automática de logs
- Monitoramento de erros

### Backup

- Backup automático do banco de dados
- Versionamento de schema
- Procedimentos de restore

## Roadmap

### Próximas Funcionalidades

1. Sistema de relatórios avançados
2. Integração com APIs das plataformas
3. Notificações push
4. App mobile
5. Sistema de chat interno

### Melhorias Técnicas

1. Migração para PostgreSQL
2. Cache com Redis
3. Containerização com Docker
4. CI/CD pipeline
5. Monitoramento com Prometheus

---

**Desenvolvido por**: Manus AI  
**Versão**: 1.0.0  
**Data**: Agosto 2025
