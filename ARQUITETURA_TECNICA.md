# Arquitetura Técnica - Sistema Invictus Poker Team

## Introdução

Este documento apresenta uma análise detalhada da arquitetura técnica do Sistema Invictus Poker Team, desenvolvido como uma solução completa para gestão de jogadores profissionais de poker. O sistema foi concebido seguindo princípios de arquitetura limpa, separação de responsabilidades e escalabilidade, utilizando tecnologias modernas tanto no backend quanto no frontend.

A arquitetura adotada segue o padrão de aplicação web de três camadas (3-tier architecture), com uma clara separação entre a camada de apresentação (frontend React), camada de lógica de negócio (backend Flask) e camada de dados (SQLite). Esta separação permite maior flexibilidade, manutenibilidade e possibilita futuras expansões do sistema.

## Visão Geral da Arquitetura

### Padrão Arquitetural

O sistema utiliza uma arquitetura cliente-servidor com API RESTful, onde o frontend React atua como cliente consumindo serviços do backend Flask através de requisições HTTP. Esta abordagem oferece várias vantagens, incluindo a possibilidade de desenvolvimento independente das camadas, reutilização da API por diferentes clientes (web, mobile, desktop) e facilidade de manutenção e testes.

A comunicação entre as camadas é realizada através de interfaces bem definidas, utilizando JSON como formato de troca de dados. O backend expõe endpoints RESTful que seguem as convenções HTTP, utilizando os métodos GET, POST, PUT e DELETE de forma semântica. O frontend, por sua vez, consome estes endpoints através de requisições assíncronas, proporcionando uma experiência de usuário fluida e responsiva.

### Tecnologias Principais

#### Backend - Flask Framework

O backend foi desenvolvido utilizando Flask, um microframework Python conhecido por sua simplicidade e flexibilidade. Flask foi escolhido por várias razões técnicas importantes. Primeiro, sua natureza minimalista permite um controle fino sobre a arquitetura da aplicação, evitando o overhead de frameworks mais pesados. Segundo, sua extensa documentação e comunidade ativa facilitam o desenvolvimento e manutenção. Terceiro, sua compatibilidade com diversas extensões permite a adição de funcionalidades conforme necessário.

A estrutura do backend segue o padrão Blueprint do Flask, organizando as rotas em módulos lógicos separados. Cada blueprint representa um domínio específico da aplicação (autenticação, usuários, plataformas, etc.), promovendo a organização do código e facilitando a manutenção. Esta abordagem modular também permite que diferentes desenvolvedores trabalhem em módulos distintos sem conflitos significativos.

O sistema de autenticação implementado utiliza sessões baseadas em cookies, proporcionando segurança adequada para uma aplicação web interna. As senhas são criptografadas utilizando a biblioteca Werkzeug, que implementa algoritmos de hash seguros com salt automático. O controle de acesso é implementado através de decoradores que verificam tanto a autenticação quanto a autorização baseada em roles.

#### Frontend - React com Vite

O frontend foi desenvolvido em React 18, aproveitando as mais recentes funcionalidades do framework, incluindo Hooks e Concurrent Features. React foi escolhido por sua maturidade, performance e ecossistema robusto. A utilização de Hooks permite um código mais limpo e funcional, evitando a complexidade das classes e facilitando o compartilhamento de lógica entre componentes.

Vite foi escolhido como bundler e servidor de desenvolvimento devido à sua velocidade superior comparada a ferramentas tradicionais como Webpack. Vite utiliza ES modules nativos durante o desenvolvimento, resultando em tempos de inicialização e hot reload significativamente mais rápidos. Para produção, Vite utiliza Rollup para gerar bundles otimizados.

A estilização utiliza Tailwind CSS combinado com shadcn/ui, uma biblioteca de componentes que oferece elementos pré-construídos seguindo princípios de design system. Esta combinação permite desenvolvimento rápido mantendo consistência visual e acessibilidade. Tailwind CSS oferece utility classes que promovem reutilização e manutenibilidade, enquanto shadcn/ui fornece componentes complexos já testados e acessíveis.

## Camada de Dados

### Modelo de Dados

O modelo de dados foi projetado seguindo princípios de normalização de banco de dados, evitando redundâncias e garantindo integridade referencial. O esquema principal consiste em seis entidades principais interconectadas através de chaves estrangeiras.

A entidade User representa os usuários do sistema, incluindo administradores, gestores e jogadores. Esta entidade contém informações básicas como nome, email, username e role, além de campos de auditoria (created_at, updated_at). O campo role utiliza um enum Python que é mapeado para o banco de dados, garantindo consistência nos tipos de usuário.

A entidade Platform representa as diferentes plataformas de poker onde os jogadores mantêm contas. Esta entidade é relativamente simples, contendo apenas nome, nome de exibição e status ativo. A separação das plataformas em uma entidade própria permite fácil adição de novas plataformas sem modificar outras partes do sistema.

A entidade Account estabelece a relação many-to-many entre usuários e plataformas, representando as contas específicas que cada jogador possui em cada plataforma. Esta entidade contém informações financeiras importantes como saldo atual, total de reloads e total de saques. A constraint unique (user_id, platform_id) garante que cada usuário tenha apenas uma conta por plataforma.

### SQLite e Otimizações

SQLite foi escolhido como sistema de gerenciamento de banco de dados por várias razões práticas. Para uma aplicação de porte médio como esta, SQLite oferece performance adequada com zero configuração e manutenção. Sua natureza serverless elimina a necessidade de configurar e manter um servidor de banco de dados separado, simplificando o deployment e reduzindo custos operacionais.

O sistema utiliza WAL (Write-Ahead Logging) mode, que oferece melhor concorrência comparado ao modo journal padrão. No modo WAL, operações de leitura não bloqueiam escritas e vice-versa, melhorando significativamente a performance em cenários com múltiplos usuários simultâneos. Além disso, WAL mode oferece melhor durabilidade dos dados e facilita backups online.

Índices foram criados estrategicamente nas colunas mais consultadas, incluindo chaves estrangeiras e campos utilizados em filtros frequentes. O SQLAlchemy ORM foi configurado para utilizar lazy loading por padrão, evitando consultas desnecessárias, mas permitindo eager loading quando necessário através de joinedload e selectinload.

### Integridade e Consistência

O sistema implementa várias camadas de validação para garantir integridade dos dados. No nível do banco de dados, constraints de chave estrangeira garantem integridade referencial. Constraints unique previnem duplicação de dados críticos como usernames e emails. Check constraints validam ranges de valores onde aplicável.

No nível da aplicação, o SQLAlchemy implementa validações adicionais através de validators e hybrid properties. Por exemplo, o modelo User possui um método set_password que automaticamente gera hash da senha, e um método check_password para verificação. Estas validações garantem que regras de negócio sejam sempre respeitadas, independentemente de como os dados são inseridos.

O sistema também implementa soft delete para entidades críticas, marcando registros como inativos ao invés de removê-los fisicamente. Esta abordagem preserva integridade referencial e permite auditoria completa das operações. Registros marcados como inativos são automaticamente filtrados nas consultas normais através de scopes padrão.

## Camada de Lógica de Negócio

### Estrutura de Rotas e Blueprints

A organização das rotas segue uma estrutura modular baseada em domínios de negócio. Cada blueprint representa um conjunto coeso de funcionalidades relacionadas, promovendo alta coesão e baixo acoplamento. Esta organização facilita tanto o desenvolvimento quanto a manutenção, permitindo que desenvolvedores se especializem em domínios específicos.

O blueprint de autenticação (auth.py) centraliza todas as operações relacionadas à segurança, incluindo login, logout, verificação de sessão e alteração de senhas. Este blueprint implementa decoradores reutilizáveis para verificação de autenticação e autorização, que são utilizados por outros blueprints conforme necessário.

O blueprint de usuários (users.py) gerencia operações CRUD para usuários, incluindo validações específicas como verificação de unicidade de username e email. Este blueprint também implementa controles de acesso granulares, permitindo que usuários vejam apenas seus próprios dados enquanto administradores têm acesso completo.

### Sistema de Permissões

O sistema de permissões foi projetado seguindo o princípio do menor privilégio, onde usuários recebem apenas as permissões mínimas necessárias para suas funções. Quatro roles foram definidos: Admin, Manager, Player e Viewer, cada um com níveis crescentes de restrição.

Administradores possuem acesso completo ao sistema, incluindo criação e modificação de usuários, plataformas e configurações globais. Managers têm permissões similares mas com algumas restrições, como impossibilidade de modificar outros administradores. Players podem acessar apenas seus próprios dados e realizar operações limitadas como solicitação de reloads. Viewers têm acesso apenas de leitura a dados específicos.

A implementação utiliza decoradores Python que verificam tanto autenticação quanto autorização antes de executar funções de rota. Estes decoradores são composáveis, permitindo combinações flexíveis de verificações. Por exemplo, uma rota pode requerer autenticação básica, role específico e ownership de recurso simultaneamente.

### Fluxo de Solicitação de Reload

O fluxo de solicitação de reload representa um dos processos de negócio mais complexos do sistema, envolvendo múltiplas validações e atualizações transacionais. Este fluxo foi projetado para garantir integridade financeira e auditabilidade completa.

Quando um jogador solicita um reload, o sistema primeiro valida se o jogador possui uma conta ativa na plataforma especificada. Em seguida, valida se o valor solicitado está dentro de limites aceitáveis e se não há outras solicitações pendentes que possam conflitar. Todas estas validações ocorrem dentro de uma transação de banco de dados para garantir consistência.

Após a criação da solicitação, gestores recebem notificações automáticas através do dashboard. O processo de aprovação envolve validações adicionais e atualizações atômicas do saldo da conta e criação de registros de transação. Rejeições requerem justificativa obrigatória e também geram registros de auditoria.

## Camada de Apresentação

### Arquitetura de Componentes React

A arquitetura frontend segue princípios de componentização, onde cada elemento da interface é encapsulado em componentes reutilizáveis. Esta abordagem promove reutilização de código, facilita testes e melhora a manutenibilidade. Componentes são organizados hierarquicamente, com componentes de alto nível orquestrando componentes menores e mais específicos.

O componente App atua como root component, gerenciando estado global da aplicação como informações do usuário autenticado e configurações gerais. Este componente implementa roteamento condicional baseado no estado de autenticação, redirecionando usuários não autenticados para a tela de login.

Componentes de UI utilizam a biblioteca shadcn/ui, que oferece componentes pré-construídos seguindo princípios de design system. Estes componentes são altamente customizáveis através de props e CSS classes, permitindo adaptação ao tema visual específico do Invictus Poker Team. A utilização de uma biblioteca estabelecida garante acessibilidade e compatibilidade cross-browser.

### Gerenciamento de Estado

O gerenciamento de estado utiliza React Hooks nativos, evitando a complexidade de bibliotecas externas como Redux para uma aplicação de porte médio. useState é utilizado para estado local de componentes, enquanto useEffect gerencia efeitos colaterais como requisições HTTP e subscriptions.

Para estado compartilhado entre componentes, o padrão de "lifting state up" é aplicado, movendo estado para o componente pai comum mais próximo. Em casos onde múltiplos componentes distantes precisam do mesmo estado, Context API é utilizada para evitar prop drilling excessivo.

O estado da aplicação é mantido sincronizado com o backend através de requisições HTTP. Não há cache local complexo, optando por simplicidade e consistência. Cada operação que modifica dados no backend resulta em uma nova requisição para buscar dados atualizados, garantindo que a interface sempre reflita o estado atual do sistema.

### Sistema de Roteamento e Navegação

O roteamento é implementado de forma condicional baseada no estado de autenticação. Usuários não autenticados veem apenas a tela de login, enquanto usuários autenticados são direcionados para dashboards específicos baseados em seu role. Esta abordagem simplifica a lógica de roteamento e melhora a segurança.

A navegação entre diferentes seções do sistema é implementada através de componentes de navegação que se adaptam ao role do usuário. Administradores veem todas as opções de menu, enquanto jogadores veem apenas seções relevantes para suas necessidades. Esta personalização melhora a experiência do usuário e reduz confusão.

## Segurança

### Autenticação e Autorização

O sistema de autenticação implementa múltiplas camadas de segurança. Senhas são criptografadas utilizando PBKDF2 com salt aleatório, oferecendo proteção robusta contra ataques de força bruta e rainbow tables. O algoritmo utiliza múltiplas iterações para aumentar o custo computacional de ataques.

Sessões são gerenciadas através de cookies seguros com flags HttpOnly e Secure quando em produção. O tempo de vida das sessões é limitado, forçando re-autenticação periódica. Tokens de sessão são gerados aleatoriamente e não contêm informações sensíveis, seguindo princípios de segurança por design.

A autorização é implementada através de verificações granulares em cada endpoint. Além da verificação de autenticação, cada rota verifica se o usuário possui permissões adequadas para a operação solicitada. Verificações adicionais de ownership garantem que usuários só possam acessar recursos que lhes pertencem.

### Proteção contra Vulnerabilidades Comuns

O sistema implementa proteções contra as vulnerabilidades mais comuns em aplicações web. Injeção SQL é prevenida através do uso exclusivo de queries parametrizadas via SQLAlchemy ORM. Cross-Site Scripting (XSS) é mitigado através de sanitização automática de dados de entrada e uso de templates que escapam conteúdo por padrão.

Cross-Site Request Forgery (CSRF) é prevenido através de verificação de origem das requisições e uso de tokens CSRF quando necessário. O sistema também implementa rate limiting básico para prevenir ataques de força bruta e denial of service.

Dados sensíveis como senhas nunca são logados ou expostos em respostas de API. Logs são estruturados para facilitar análise de segurança sem expor informações confidenciais. Configurações de segurança são centralizadas e facilmente auditáveis.

## Performance e Otimização

### Otimizações de Backend

O backend implementa várias otimizações para garantir performance adequada mesmo com crescimento da base de usuários. Consultas ao banco de dados são otimizadas através de índices estratégicos e uso de eager loading quando necessário para evitar problemas N+1.

Paginação é implementada em endpoints que retornam listas grandes, limitando a quantidade de dados transferidos e processados. Filtros são aplicados no nível do banco de dados sempre que possível, reduzindo a quantidade de dados processados pela aplicação.

O sistema utiliza connection pooling do SQLAlchemy para reutilizar conexões de banco de dados, reduzindo overhead de estabelecimento de conexões. Transações são mantidas o mais curtas possível para minimizar bloqueios e melhorar concorrência.

### Otimizações de Frontend

O frontend implementa lazy loading de componentes para reduzir o tamanho inicial do bundle JavaScript. Componentes são carregados sob demanda conforme necessário, melhorando o tempo de carregamento inicial da aplicação.

Imagens e outros recursos estáticos são otimizados através do pipeline de build do Vite, incluindo compressão e geração de formatos modernos quando suportados pelo browser. CSS é purificado durante o build, removendo estilos não utilizados e reduzindo o tamanho final.

Requisições HTTP são otimizadas através de debouncing em campos de busca e cache de requisições idênticas. O sistema evita requisições desnecessárias através de verificações de estado antes de fazer chamadas para o backend.

## Monitoramento e Observabilidade

### Sistema de Logs

O sistema implementa logging estruturado utilizando o módulo logging padrão do Python. Logs são formatados em JSON para facilitar parsing e análise automatizada. Diferentes níveis de log (DEBUG, INFO, WARNING, ERROR, CRITICAL) são utilizados apropriadamente para categorizar eventos.

Logs incluem informações contextuais importantes como user ID, session ID e request ID quando disponíveis. Esta informação facilita rastreamento de problemas e análise de comportamento de usuários. Logs sensíveis são sanitizados para evitar exposição de dados confidenciais.

Rotação de logs é configurada para prevenir crescimento descontrolado de arquivos de log. Logs antigos são comprimidos e eventualmente removidos baseado em políticas de retenção configuráveis.

### Métricas e Alertas

O sistema coleta métricas básicas de performance incluindo tempo de resposta de endpoints, taxa de erro e utilização de recursos. Estas métricas são essenciais para identificar gargalos e problemas de performance antes que afetem usuários.

Alertas são configurados para condições críticas como alta taxa de erro, tempo de resposta elevado ou falhas de autenticação excessivas. Estes alertas permitem resposta rápida a problemas operacionais.

## Deployment e DevOps

### Estratégia de Deployment

O sistema foi projetado para deployment simples utilizando um único servidor. O backend Flask pode ser executado através de Gunicorn para melhor performance em produção, enquanto o frontend é servido como arquivos estáticos pelo próprio Flask após build.

Configurações específicas de ambiente são gerenciadas através de variáveis de ambiente, permitindo diferentes configurações para desenvolvimento, teste e produção sem modificação de código. Secrets como chaves de criptografia são injetados no momento do deployment.

O banco de dados SQLite é adequado para deployment inicial, mas o sistema foi projetado para facilitar migração futura para PostgreSQL ou MySQL se necessário. Migrações de schema são gerenciadas através do Flask-Migrate quando necessário.

### Backup e Recuperação

Estratégias de backup são implementadas para garantir durabilidade dos dados. O banco SQLite é copiado regularmente para localizações seguras, aproveitando o modo WAL para backups online sem interrupção do serviço.

Procedimentos de recuperação são documentados e testados regularmente para garantir que backups são válidos e podem ser restaurados quando necessário. Scripts automatizados facilitam tanto backup quanto restauração.

## Considerações Futuras

### Escalabilidade

Embora o sistema atual seja adequado para uso de pequeno a médio porte, várias considerações foram feitas para facilitar escalabilidade futura. A arquitetura modular permite separação de componentes em diferentes servidores quando necessário.

O uso de SQLite pode ser limitante para alta concorrência, mas a migração para PostgreSQL é relativamente simples devido ao uso do SQLAlchemy ORM. Cache distribuído com Redis pode ser adicionado para melhorar performance de consultas frequentes.

### Funcionalidades Adicionais

A arquitetura atual suporta facilmente adição de novas funcionalidades. Novos blueprints podem ser adicionados para funcionalidades como relatórios avançados, integração com APIs externas ou sistemas de notificação em tempo real.

O frontend React é altamente extensível, permitindo adição de novas telas e componentes sem afetar funcionalidades existentes. O sistema de roteamento pode ser expandido para suportar navegação mais complexa quando necessário.

---

**Autor**: Manus AI  
**Versão do Documento**: 1.0  
**Data**: Agosto 2025

