# Guia de Testes - Invictus Poker System Frontend

## 🎯 Visão Geral

Este projeto implementa uma estratégia completa de testes para garantir a qualidade e confiabilidade do sistema de gestão de poker.

## 📋 Estrutura de Testes

### 🔧 Configuração

- **Vitest**: Framework de testes unitários e de componentes
- **Testing Library**: Utilities para testes de React
- **Cypress**: Testes End-to-End (E2E)
- **Coverage**: Relatórios de cobertura com V8

### 📁 Organização de Arquivos

```
frontend/
├── src/test/
│   ├── components/
│   │   ├── LoginForm.test.jsx         # Testes do formulário de login
│   │   ├── NotificationBell.test.jsx  # Testes de notificações
│   │   ├── basic-ui.test.jsx          # Testes de componentes UI básicos
│   │   └── simple-components.test.jsx # Testes de funcionalidades mock
│   ├── hooks/
│   │   └── useSSE.test.js             # Testes do hook SSE
│   └── setup.js                       # Configurações globais de teste
├── cypress/
│   ├── e2e/
│   │   ├── auth.cy.js                 # Testes E2E de autenticação
│   │   ├── dashboard.cy.js            # Testes E2E do dashboard
│   │   ├── reload-flow.cy.js          # Testes E2E do fluxo de reloads
│   │   ├── withdrawal-flow.cy.js      # Testes E2E do fluxo de saques
│   │   └── reports.cy.js              # Testes E2E de relatórios
│   ├── fixtures/                      # Dados mock para testes E2E
│   └── support/                       # Comandos e configurações Cypress
└── vitest.config.js                   # Configuração do Vitest
```

## 🚀 Scripts Disponíveis

### Testes Unitários (Vitest)

```bash
# Executar todos os testes
npm test

# Executar testes no modo watch
npm run test:ui

# Executar testes uma vez só
npm run test:run

# Executar testes com coverage
npm run test:coverage
```

### Testes E2E (Cypress)

```bash
# Abrir interface do Cypress
npm run cypress:open

# Executar testes E2E em modo headless
npm run cypress:run

# Executar dev server + Cypress simultaneamente
npm run e2e:dev

# Executar testes E2E para CI
npm run e2e:ci
```

## 🎨 Estratégia de Testes

### 1. Testes Unitários e de Componentes

- **Componentes UI**: Testes de renderização e interação
- **Hooks**: Testes de lógica de estado e efeitos
- **Utilities**: Testes de funções auxiliares

### 2. Testes End-to-End

- **Fluxos Críticos**: Login, reloads, saques, relatórios
- **Integrações**: SSE, APIs, navegação
- **Cenários Reais**: Simulação de uso real do sistema

### 3. Testes de Regras de Negócio

- **P&L Logic**: Luxon excluído dos cálculos
- **Validações**: Limites, saldos, permissões
- **Auditoria**: Logs e rastreabilidade

## 📊 Coverage e Métricas

### Objetivos de Cobertura

- **Backend**: 80%+ (crítico para lógica de negócio)
- **Frontend**: 60%+ (focado em componentes principais)

### Componentes Prioritários para Testes

1. **LoginForm** - Autenticação
2. **Dashboard** - Visão geral do sistema
3. **ReloadFlow** - Solicitação e aprovação de reloads
4. **WithdrawalFlow** - Solicitação e aprovação de saques
5. **Reports** - Relatórios P&L e transações
6. **NotificationSystem** - Alertas em tempo real

## 🔍 Executando Testes Específicos

### Por Arquivo

```bash
# Teste específico de componente
npm run test:run src/test/components/LoginForm.test.jsx

# Teste específico E2E
npm run cypress:run --spec "cypress/e2e/auth.cy.js"
```

### Por Padrão

```bash
# Todos os testes de componentes
npm run test:run src/test/components/

# Todos os testes E2E de fluxos
npm run cypress:run --spec "cypress/e2e/*-flow.cy.js"
```

## 🛠️ Debugging

### Vitest

```bash
# Executar em modo debug
npm run test -- --reporter=verbose

# Executar teste específico em watch mode
npm run test -- src/test/components/LoginForm.test.jsx
```

### Cypress

```bash
# Abrir com debug habilitado
DEBUG=cypress:* npm run cypress:open

# Screenshots e vídeos automáticos em falhas
# (Configurado em cypress.config.js)
```

## 📝 Padrões de Teste

### Estrutura de Teste

```javascript
describe("ComponentName", () => {
  beforeEach(() => {
    // Setup comum
  });

  it("deve comportamento específico", async () => {
    // Arrange
    render(<Component />);

    // Act
    await user.click(screen.getByRole("button"));

    // Assert
    expect(screen.getByText("Expected")).toBeInTheDocument();
  });
});
```

### Mocks e Fixtures

- **API Mocks**: Interceptar chamadas HTTP
- **Fixtures**: Dados de exemplo para testes
- **SSE Mocks**: Simular eventos em tempo real

## ✅ Checklist de Qualidade

### Antes do Deploy

- [ ] Todos os testes passando
- [ ] Coverage mínimo atingido
- [ ] Testes E2E dos fluxos críticos
- [ ] Validação de regras de negócio
- [ ] Testes de auditoria funcionando

### Monitoramento Contínuo

- [ ] CI/CD executando testes automaticamente
- [ ] Reports de coverage atualizados
- [ ] Testes de regressão para mudanças críticas

## 🔧 Configurações Especiais

### P&L Testing

```javascript
// Teste específico da regra Luxon
it("deve excluir Luxon do cálculo P&L", () => {
  // Luxon deve aparecer no saldo total
  // Luxon NÃO deve aparecer no P&L calculado
});
```

### SSE Testing

```javascript
// Teste de eventos em tempo real
it("deve receber notificações via SSE", () => {
  // Mock do EventSource
  // Simulação de eventos
  // Verificação de updates na UI
});
```

## 📈 Relatórios

### Coverage Report

```bash
npm run test:coverage
# Gera relatório em ./coverage/index.html
```

### Cypress Reports

```bash
npm run cypress:run
# Screenshots em ./cypress/screenshots/
# Vídeos em ./cypress/videos/
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Dependências**: Verificar se todas as deps estão instaladas
2. **Ports**: Backend deve estar rodando para alguns testes
3. **Timeouts**: Ajustar timeouts em testes E2E lentos
4. **Mocks**: Verificar se mocks estão corretos

### Debug Tips

- Use `screen.debug()` para ver DOM atual
- Use `cy.debug()` para pausar execução Cypress
- Verificar console do browser em testes E2E
- Usar `--verbose` para mais informações

---

**✨ Sistema de testes robusto implementado com sucesso!**
**🎯 Pronto para garantir qualidade e confiabilidade do Invictus Poker System**
