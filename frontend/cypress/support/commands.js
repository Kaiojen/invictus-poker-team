// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Comando para login
Cypress.Commands.add("login", (username = "admin", password = "admin123") => {
  cy.session([username, password], () => {
    cy.visit("/");
    cy.get('[data-cy="username-input"]').type(username);
    cy.get('[data-cy="password-input"]').type(password);
    cy.get('[data-cy="login-button"]').click();

    // Aguardar redirecionamento após login bem-sucedido
    cy.url().should("not.include", "/login");
  });
});

// Comando para logout
Cypress.Commands.add("logout", () => {
  cy.get('[data-cy="user-menu"]').click();
  cy.get('[data-cy="logout-button"]').click();
  cy.url().should("include", "/login");
});

// Comando para interceptar APIs comuns
Cypress.Commands.add("setupApiMocks", () => {
  // Mock da API de stats do dashboard
  cy.intercept("GET", "/api/dashboard/stats", {
    fixture: "dashboard-stats.json",
  }).as("getDashboardStats");

  // Mock da API de notificações
  cy.intercept("GET", "/api/notifications/stats", {
    body: { total: 5, unread: 2, urgent: 1 },
  }).as("getNotificationStats");

  // Mock da API de plataformas
  cy.intercept("GET", "/api/platforms", {
    fixture: "platforms.json",
  }).as("getPlatforms");
});

// Comando para aguardar loading
Cypress.Commands.add("waitForPageLoad", () => {
  cy.get('[data-cy="loading"]', { timeout: 1000 }).should("not.exist");
});

// Comando para criar reload request
Cypress.Commands.add(
  "createReloadRequest",
  (amount = 100, platform = "pokerstars") => {
    cy.get('[data-cy="new-reload-button"]').click();
    cy.get('[data-cy="platform-select"]').select(platform);
    cy.get('[data-cy="amount-input"]').type(amount.toString());
    cy.get('[data-cy="notes-input"]').type("Teste automatizado");
    cy.get('[data-cy="submit-reload"]').click();
  }
);

// Comando para aprovar reload como admin
Cypress.Commands.add("approveReload", (reloadId) => {
  cy.get(`[data-cy="reload-${reloadId}"]`).within(() => {
    cy.get('[data-cy="approve-button"]').click();
  });
  cy.get('[data-cy="approval-notes"]').type("Aprovado via teste");
  cy.get('[data-cy="confirm-approval"]').click();
});
