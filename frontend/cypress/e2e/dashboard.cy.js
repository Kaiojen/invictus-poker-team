describe("Dashboard", () => {
  beforeEach(() => {
    cy.setupApiMocks();
  });

  context("Dashboard do Jogador", () => {
    beforeEach(() => {
      cy.login("player1", "player123");
      cy.visit("/dashboard");
    });

    it("deve exibir resumo de contas e saldos", () => {
      cy.intercept("GET", "/api/accounts", {
        fixture: "player-accounts.json",
      }).as("getPlayerAccounts");

      cy.wait("@getPlayerAccounts");

      cy.get('[data-cy="account-pokerstars"]').should("be.visible");
      cy.get('[data-cy="account-gg"]').should("be.visible");
      cy.get('[data-cy="account-luxon"]').should("be.visible");

      cy.get('[data-cy="total-balance"]').should("contain", "$");
      cy.get('[data-cy="total-pnl"]').should("contain", "$");
    });

    it("deve mostrar P&L excluindo Luxon", () => {
      cy.intercept("GET", "/api/accounts", {
        body: [
          {
            platform: { name: "pokerstars" },
            current_balance: 1200.0,
            pnl: 200.5,
            includes_in_pnl: true,
          },
          {
            platform: { name: "gg" },
            current_balance: 800.0,
            pnl: 150.25,
            includes_in_pnl: true,
          },
          {
            platform: { name: "luxon" },
            current_balance: 300.0,
            pnl: 100.0,
            includes_in_pnl: false,
          },
        ],
      }).as("getAccounts");

      cy.wait("@getAccounts");

      // P&L total deve ser 200.5 + 150.25 = 350.75 (sem Luxon)
      cy.get('[data-cy="calculated-pnl"]').should("contain", "$350.75");

      // Saldo total deve incluir Luxon: 1200 + 800 + 300 = 2300
      cy.get('[data-cy="total-balance"]').should("contain", "$2,300.00");

      // Luxon deve aparecer com indicador de "não contabilizado"
      cy.get('[data-cy="platform-luxon"]').should(
        "contain",
        "Não contabilizado no P&L"
      );
    });

    it("deve exibir transações recentes", () => {
      cy.intercept("GET", "/api/transactions/recent", {
        fixture: "recent-transactions.json",
      }).as("getRecentTransactions");

      cy.wait("@getRecentTransactions");

      cy.get('[data-cy="recent-transactions"]').should("be.visible");
      cy.get('[data-cy="transaction-item"]').should(
        "have.length.greaterThan",
        0
      );
    });

    it("deve permitir solicitar reload rápido", () => {
      cy.intercept("POST", "/api/reloads", {
        statusCode: 201,
        body: { id: 100, status: "pending" },
      }).as("quickReload");

      cy.get('[data-cy="quick-reload-pokerstars"]').click();
      cy.get('[data-cy="amount-input"]').type("500");
      cy.get('[data-cy="submit-quick-reload"]').click();

      cy.wait("@quickReload");
      cy.get('[data-cy="success-message"]').should("be.visible");
    });
  });

  context("Dashboard do Administrador", () => {
    beforeEach(() => {
      cy.login("admin", "admin123");
      cy.visit("/admin/dashboard");
    });

    it("deve exibir métricas principais", () => {
      cy.intercept("GET", "/api/admin/dashboard/metrics", {
        body: {
          total_players: 25,
          active_players: 18,
          total_balance: 45678.9,
          monthly_pnl: 3456.78,
          pending_requests: 7,
        },
      }).as("getMetrics");

      cy.wait("@getMetrics");

      cy.get('[data-cy="metric-total-players"]').should("contain", "25");
      cy.get('[data-cy="metric-active-players"]').should("contain", "18");
      cy.get('[data-cy="metric-total-balance"]').should(
        "contain",
        "$45,678.90"
      );
      cy.get('[data-cy="metric-monthly-pnl"]').should("contain", "$3,456.78");
      cy.get('[data-cy="metric-pending-requests"]').should("contain", "7");
    });

    it("deve exibir gráfico de P&L dos últimos meses", () => {
      cy.intercept("GET", "/api/admin/dashboard/pnl-chart", {
        fixture: "pnl-chart-data.json",
      }).as("getPnLChart");

      cy.wait("@getPnLChart");

      cy.get('[data-cy="pnl-chart"]').should("be.visible");
      cy.get('[data-cy="chart-tooltip"]').should("exist");
    });

    it("deve mostrar requests pendentes", () => {
      cy.intercept("GET", "/api/admin/dashboard/pending-requests", {
        body: {
          reloads: [
            { id: 1, user: "player1", amount: 500, urgent: true },
            { id: 2, user: "player2", amount: 300, urgent: false },
          ],
          withdrawals: [{ id: 3, user: "player3", amount: 200, urgent: false }],
        },
      }).as("getPendingRequests");

      cy.wait("@getPendingRequests");

      cy.get('[data-cy="pending-reloads"]').should("be.visible");
      cy.get('[data-cy="pending-withdrawals"]').should("be.visible");
      cy.get('[data-cy="urgent-request"]').should("be.visible");
    });

    it("deve permitir aprovação rápida de requests", () => {
      cy.intercept("PUT", "/api/admin/reloads/*/approve", {
        statusCode: 200,
        body: { success: true },
      }).as("quickApprove");

      cy.get('[data-cy="quick-approve-1"]').click();
      cy.get('[data-cy="confirm-quick-approve"]').click();

      cy.wait("@quickApprove");
      cy.get('[data-cy="success-notification"]').should("be.visible");
    });
  });
});
