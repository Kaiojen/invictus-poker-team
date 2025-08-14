# **Prompt para desenvolvedor — Sistema de gestão “Invictus Poker Team”**

Resumo curto:

Construir um sistema web (web app) para gestão do time “Invictus Poker Team”. Objetivo: centralizar controle financeiro, gestão de jogadores/retas, solicitações de reload, relatórios e observações de performance. Sem integrações externas nesta fase. Armazenamento obrigatório: SQLite (com atenção especial para persistência, WAL mode, backups automáticos e migrações). Não usar serviços externos para autenticação ou pagamentos. Notificações internas in‑app (alertas/flags). Exportação de relatórios em CSV/PDF.

---

## **Requisitos funcionais (alto nível)**

1. Autenticação e permissões

   * Roles: admin (gestor), manager (subgestor), player (jogador, acesso limitado), viewer (visualização).

   * Login com email \+ senha (hash bcrypt). Sessões curtas. Opção de “esqueci senha” local (token DB).

2. Perfis dos jogadores

   * Formulário com: nome completo, nickname, data de nascimento/idade, foto, contato (telefone/email), documentos (opcional), nota/skill tags, reta (0/1/2/3), plataformas (lista), observações públicas/privadas, status (ativo/inativo), data de entrada.

   * Visualização histórica de observações e anotações (audit trail).

3. Contas por plataforma & saldos

   * Plataformas suportadas (ex.: Luxon, 8.8, EA, GG, PokerStars) — apenas como strings (sem integração).

   * Cada jogador pode ter múltiplas contas (por plataforma). Cada conta mantém saldo atual (valor numérico), histórico de transações (deposit, withdrawal, transfer in/out, buy-in, winnings).

   * Interface para o jogador atualizar manualmente seus saldos por plataforma (com upload de comprovante — imagem).

4. Solicitação e aprovação de Reload

   * Jogador clica em “Solicitar Reload”, escolhe plataforma e valor, descreve motivo e anexa comprovante (opcional).

   * Sistema cria reload\_request com status pending/approved/rejected/completed.

   * Notificação in‑app para admin (lista de pendentes). Admin aprova/rejeita. Ao aprovar, o sistema registra transação financeira (tipo reload) e marca como completed após confirmação manual do admin.

   * Histórico de todos os reloads com filtros.

5. Fluxo financeiro do time

   * Dashboard financeiro consolidado: total por plataforma, total por reta, lucro/prejuízo acumulado (somando registros manuais de ganhos/perdas e transações).

   * Registro de despesas do time (ex.: taxas, coaching, deslocamento) com categoria, responsável, comprovante.

   * Lançamentos manuais (entrada/saida) e importação de CSV simples.

6. Gestão por retas

   * Jogadores atribuídos a reta (0..n). Filtrar dashboards, relatórios e listas por reta.

   * Possibilidade de adicionar novas retas no admin.

7. Relatórios / Exports

   * Gerar e baixar relatórios:

     * Relatório por jogador (transações, saldo por plataforma, desempenho).

     * Relatório consolidado do time (por período).

     * Relatório por reta.

   * Formatos: CSV e PDF (layout simples), com filtros de data, jogadores, plataformas, retas.

   * Relatórios também exportáveis como planilha com colunas definidas.

8. Gestão de pessoas / recrutamento

   * Formulário para incluir novos candidatos: dados pessoais \+ vídeo/links \+ observações iniciais \+ resultado da avaliação.

   * Workflow para mover candidato → trial → efetivado/inativo.

   * Registro das avaliações (data, avaliador, nota, comentário).

9. Métricas e análises básicas

   * KPI sugeridos: saldo total do time, lucro líquido no período, número de reloads pendentes, % de jogadores positivos (com lucro), média de saldo por reta.

   * Visualização por gráfico simples (não precisa polir estilo agora).

10. Uploads e comprovações

    * Uploads de imagens (prints de caixa, comprovantes, sharkscope). Armazenar path/local no filesystem \+ referência no DB. Limitar tamanho e tipos.

    * Mecanismo de verificação manual (admin marca como “verificado”).

11. Audit & logs

    * Registrar audit trail para ações críticas (criação/edição/exclusão de transações, approvals, mudança de saldo).

    * Logs de login/timeout.

---

## **Requisitos não‑funcionais / técnicos**

* Banco: SQLite (arquivo único .db). Obrigatório: habilitar WAL mode, configurar journal\_mode/pragma adequadamente; fornecer endpoints/rotina para backup automático (ex.: dump periódico para backups/ com timestamp) e instruções para restaurar. Fornecer scripts de migração (SQL) e instruções para garantir que commits sejam persistidos no arquivo após operações (fsync considerations).

* Sem integrações externas na primeira versão.

* Security: proteção contra SQL injection (usar ORM/prepared statements), validação de uploads, rate limiting básico, senhas com bcrypt, CSRF protections.

* Deploy: app containerizável (Dockerfile), instruções para persistir o arquivo SQLite num volume. Especificar que o arquivo DB deve ficar em volume persistente (ex.: /data/invictus.db) e que backups são essenciais.

* Testes: unitários mínimos \+ testes de E2E para fluxos críticos (reload request, approval, export).

* Docs: README com setup, migrations, backup/restore, endpoints, e um pequeno diagrama ER.

* UI/UX: responsivo, mobile friendly. Tema escuro/claro opcional; aceitar identidade visual se fornecida.

---

## **Modelo de dados sugerido (SQLite) — tabelas principais (DDL resumido)**

\-- jogadores  
CREATE TABLE players (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  name TEXT NOT NULL,  
  nickname TEXT,  
  birthdate DATE,  
  email TEXT,  
  phone TEXT,  
  photo\_path TEXT,  
  status TEXT DEFAULT 'active', \-- active/inactive  
  reta INTEGER DEFAULT 0,  
  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
  updated\_at DATETIME  
);

\-- plataformas e contas  
CREATE TABLE platforms (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  name TEXT NOT NULL UNIQUE  
);

CREATE TABLE player\_accounts (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  player\_id INTEGER NOT NULL,  
  platform\_id INTEGER NOT NULL,  
  account\_identifier TEXT,  
  balance REAL DEFAULT 0,  
  FOREIGN KEY(player\_id) REFERENCES players(id),  
  FOREIGN KEY(platform\_id) REFERENCES platforms(id)  
);

\-- transações (movimentações de saldo)  
CREATE TABLE transactions (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  player\_account\_id INTEGER,  
  type TEXT NOT NULL, \-- deposit, withdrawal, reload, buyin, win, fee, transfer  
  amount REAL NOT NULL,  
  description TEXT,  
  created\_by INTEGER, \-- user id  
  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
  meta\_json TEXT,  
  FOREIGN KEY(player\_account\_id) REFERENCES player\_accounts(id)  
);

\-- pedidos de reload  
CREATE TABLE reload\_requests (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  player\_id INTEGER NOT NULL,  
  platform\_id INTEGER NOT NULL,  
  amount REAL NOT NULL,  
  status TEXT DEFAULT 'pending', \-- pending/approved/rejected/completed  
  requested\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
  processed\_by INTEGER,  
  processed\_at DATETIME,  
  proof\_path TEXT,  
  note TEXT,  
  FOREIGN KEY(player\_id) REFERENCES players(id),  
  FOREIGN KEY(platform\_id) REFERENCES platforms(id)  
);

\-- despesas e entradas do time  
CREATE TABLE team\_finances (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  type TEXT NOT NULL, \-- expense/income  
  amount REAL NOT NULL,  
  category TEXT,  
  description TEXT,  
  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
  created\_by INTEGER,  
  receipt\_path TEXT  
);

\-- observações de jogador  
CREATE TABLE player\_notes (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  player\_id INTEGER NOT NULL,  
  note TEXT,  
  visibility TEXT DEFAULT 'private', \-- private/public  
  created\_by INTEGER,  
  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
  FOREIGN KEY(player\_id) REFERENCES players(id)  
);

\-- users (admin/manager/player)  
CREATE TABLE users (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  email TEXT UNIQUE,  
  password\_hash TEXT,  
  role TEXT,  
  name TEXT,  
  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

\-- audit log  
CREATE TABLE audit\_logs (  
  id INTEGER PRIMARY KEY AUTOINCREMENT,  
  user\_id INTEGER,  
  action TEXT,  
  entity TEXT,  
  entity\_id INTEGER,  
  detail TEXT,  
  created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

Obs: incluir índices para consultas frequentes (player\_id, created\_at, status).  
---

## **Endpoints / telas principais (exemplos)**

* Auth: POST /auth/login, POST /auth/forgot

* Players: CRUD /players (list, get, create, update, delete)

* Accounts: /players/:id/accounts (balance update)

* Transactions: /transactions (list, create)

* Reloads: /reloads (create request), /reloads/pending, /reloads/:id/approve

* Team finances: /team/finances

* Reports: /reports/player/:id?start=\&end=, /reports/team?start=\&end=\&reta=

* Upload endpoints: /uploads (store files with safe filenames)

* Admin UI: dashboards e filtros

Telas:

1. Login

2. Dashboard financeiro (resumo \+ cards: saldo total, reloads pendentes, lucro do período, alertas)

3. Lista de jogadores (filtro por reta, status)

4. Perfil do jogador — saldos por plataforma, histórico de transações, notas, botão “solicitar reload”

5. Criar/gerenciar reloads (lista pendentes, ação aprovar/rejeitar)

6. Tela de lançamentos financeiros (despesas/entradas)

7. Relatórios (selector de filtros \+ export CSV/PDF)

8. Gestão de retas e usuários

9. Área de uploads/comprovantes

---

## **Fluxos críticos descritos**

Solicitar reload (player)

1. Jogador abre perfil → “Solicitar Reload” → escolhe plataforma e valor → envia (opcional: comprovante).

2. Sistema grava reload\_requests status pending \+ notifica in‑app admin.

3. Admin abre lista → aprova/rejeita. Ao aprovar, admin cria transação manual (type=reload) ou o sistema pode gerar transação em transactions e atualizar player\_accounts.balance (após confirmação). Registrar audit log.

Backup e persistência (criticamente importante)

* Ao iniciar app, executar PRAGMA journal\_mode \= WAL e PRAGMA synchronous \= NORMAL ou FULL conforme tradeoff.

* Implementar rotina que a cada X minutos (e/ou antes de operações críticas) faça sqlite3 VACUUM ou .backup() para arquivo com timestamp (ex.: /data/backups/invictus-YYYYMMDD-HHMMSS.db).

* No README, explicar que o container/host deve mapear /data e que não se deve usar ephemeral storage.

* Testes de reinício: garantir que uma alteração feita por UI é persistida e permanece após restart do container.

---

## **Critérios de aceitação (QA)**

1. Criar novo jogador, preencher conta em 2 plataformas e salvar — ao reiniciar app, dados persistem.

2. Jogador faz request de reload → aparece em listagem do admin como pending.

3. Admin aprova reload → transação é registrada e saldo atualizado manualmente; audit log aparece.

4. Gerar relatório CSV com filtros por reta e data — arquivo correto com colunas definidas.

5. Upload de comprovante aparece no perfil e pode ser baixado.

6. Backup automático cria arquivo .db em /data/backups e restore funciona (documentado).

7. Testes unitários cobrindo criação de reload e transação.

---

## **Observações e restrições importantes (do cliente)**

* Sem integrações externas com plataformas de poker, bancos, APIs de pagamento ou serviços em nuvem nesta fase. Tudo manual/in‑app.

* SQLite é obrigatório; dar muita atenção para que os dados fiquem realmente salvos após deploy/restart (volume persistente \+ WAL \+ backup). Já houve problema anterior em que deploy “perdia” dados — então documentar claramente o processo de deploy e onde colocar o arquivo DB.

* Armazenar uploads e o arquivo SQLite em volume persistente.

* Priorizar confiabilidade do armazenamento e roteiros de recuperação (backup/restore).

* Design simples, foco em usabilidade administrativa — UI não precisa ser finalíssima, mas deve ser clara.

---

## **Entregáveis esperados**

* Repositório com código-fonte \+ Dockerfile.

* README com setup, como executar localmente e em container (incl. mapping do volume), instruções de backup/restore.

* Banco SQLite de exemplo com dados seed.

* Endpoints documentados (OpenAPI/Swagger mínimo).

* Migrações SQL e scripts de backup.

* Testes unitários e pelo menos 1 teste E2E do fluxo de reload.

* Wireframes das telas principais (pelo menos imagens/descrição).

