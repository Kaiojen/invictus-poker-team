describe("Relatórios", () => {
  beforeEach(() => {
    cy.login("admin", "admin123");
    cy.setupApiMocks();
  });

  context("Relatório P&L", () => {
    beforeEach(() => {
      cy.visit("/admin/reports/pnl");
    });

    it("deve exibir gráfico de P&L mensal", () => {
      cy.intercept("GET", "/api/reports/pnl/monthly*", {
        fixture: "pnl-monthly.json",
      }).as("getPnLMonthly");

      cy.wait("@getPnLMonthly");
      cy.get('[data-cy="pnl-chart"]').should("be.visible");
      cy.get('[data-cy="chart-legend"]').should("contain", "P&L Mensal");
    });

    it("deve filtrar P&L por período", () => {
      cy.intercept("GET", "/api/reports/pnl/monthly*from=2025-01*to=2025-03*", {
        fixture: "pnl-filtered.json",
      }).as("getPnLFiltered");

      cy.get('[data-cy="date-from"]').type("2025-01-01");
      cy.get('[data-cy="date-to"]').type("2025-03-31");
      cy.get('[data-cy="apply-filter"]').click();

      cy.wait("@getPnLFiltered");
      cy.get('[data-cy="total-pnl"]').should("contain", "$2,450.75");
    });

    it("deve excluir Luxon do cálculo P&L", () => {
      cy.intercept("GET", "/api/reports/pnl/by-platform*", {
        body: {
          platforms: [
            { name: "pokerstars", pnl: 1200.5, included_in_total: true },
            { name: "gg", pnl: 800.25, included_in_total: true },
            { name: "luxon", pnl: 500.0, included_in_total: false },
          ],
          total_pnl: 2000.75, // Sem luxon
        },
      }).as("getPnLByPlatform");

      cy.get('[data-cy="by-platform-tab"]').click();
      cy.wait("@getPnLByPlatform");

      cy.get('[data-cy="platform-pokerstars"]').should("contain", "$1,200.50");
      cy.get('[data-cy="platform-gg"]').should("contain", "$800.25");
      cy.get('[data-cy="platform-luxon"]').should(
        "contain",
        "Excluído do cálculo"
      );
      cy.get('[data-cy="total-pnl-calculated"]').should("contain", "$2,000.75");
    });

    it("deve exportar relatório P&L", () => {
      cy.get('[data-cy="export-pnl"]').click();
      cy.get('[data-cy="export-format"]').select("excel");
      cy.get('[data-cy="include-charts"]').check();
      cy.get('[data-cy="confirm-export"]').click();

      cy.get('[data-cy="export-status"]').should(
        "contain",
        "Relatório gerado com sucesso"
      );
    });
  });

  context("Relatório de Transações", () => {
    beforeEach(() => {
      cy.visit("/admin/reports/transactions");
    });

    it("deve exibir sumário de transações", () => {
      cy.intercept("GET", "/api/reports/transactions/summary*", {
        body: {
          total_reloads: 45,
          total_withdrawals: 23,
          total_reload_amount: 15750.0,
          total_withdrawal_amount: 8900.0,
          pending_reloads: 3,
          pending_withdrawals: 1,
        },
      }).as("getTransactionSummary");

      cy.wait("@getTransactionSummary");
      cy.get('[data-cy="total-reloads"]').should("contain", "45");
      cy.get('[data-cy="total-withdrawals"]').should("contain", "23");
      cy.get('[data-cy="pending-reloads"]').should("contain", "3");
    });

    it("deve filtrar transações por tipo", () => {
      cy.intercept("GET", "/api/reports/transactions*type=reload*", {
        fixture: "transactions-reloads.json",
      }).as("getReloadTransactions");

      cy.get('[data-cy="transaction-type"]').select("reload");
      cy.get('[data-cy="apply-filter"]').click();

      cy.wait("@getReloadTransactions");
      cy.get('[data-cy="transaction-item"]').each(($el) => {
        cy.wrap($el).should("have.attr", "data-type", "reload");
      });
    });

    it("deve filtrar transações por jogador", () => {
      cy.get('[data-cy="player-search"]').type("player1");
      cy.get('[data-cy="search-button"]').click();

      cy.get('[data-cy="transaction-item"]').each(($el) => {
        cy.wrap($el).should("contain", "player1");
      });
    });

    it("deve exibir detalhes da transação", () => {
      cy.get('[data-cy="transaction-1"]').click();

      cy.get('[data-cy="transaction-details"]').should("be.visible");
      cy.get('[data-cy="transaction-amount"]').should("be.visible");
      cy.get('[data-cy="transaction-date"]').should("be.visible");
      cy.get('[data-cy="transaction-platform"]').should("be.visible");
      cy.get('[data-cy="transaction-status"]').should("be.visible");
    });
  });

  context("Relatório de Jogadores", () => {
    beforeEach(() => {
      cy.visit("/admin/reports/players");
    });

    it("deve exibir ranking de jogadores por P&L", () => {
      cy.intercept("GET", "/api/reports/players/ranking*", {
        fixture: "players-ranking.json",
      }).as("getPlayersRanking");

      cy.wait("@getPlayersRanking");
      cy.get('[data-cy="player-ranking"]').should("be.visible");
      cy.get('[data-cy="rank-1"]').should("contain", "player1");
    });

    it("deve filtrar jogadores ativos/inativos", () => {
      cy.get('[data-cy="status-filter"]').select("active");
      cy.get('[data-cy="apply-filter"]').click();

      cy.get('[data-cy="player-item"]').each(($el) => {
        cy.wrap($el).should("have.attr", "data-status", "active");
      });
    });

    it("deve exibir estatísticas do jogador", () => {
      cy.get('[data-cy="player-1"]').click();

      cy.get('[data-cy="player-stats"]').should("be.visible");
      cy.get('[data-cy="total-reloads"]').should("be.visible");
      cy.get('[data-cy="total-withdrawals"]').should("be.visible");
      cy.get('[data-cy="current-pnl"]').should("be.visible");
      cy.get('[data-cy="account-balances"]').should("be.visible");
    });
  });

  context("Dashboard Executivo", () => {
    beforeEach(() => {
      cy.visit("/admin/dashboard");
    });

    it("deve exibir KPIs principais", () => {
      cy.intercept("GET", "/api/admin/dashboard/kpis", {
        body: {
          total_active_players: 25,
          total_balance: 45678.9,
          monthly_pnl: 3456.78,
          pending_requests: 7,
          revenue_this_month: 2345.67,
        },
      }).as("getKPIs");

      cy.wait("@getKPIs");
      cy.get('[data-cy="kpi-active-players"]').should("contain", "25");
      cy.get('[data-cy="kpi-total-balance"]').should("contain", "$45,678.90");
      cy.get('[data-cy="kpi-monthly-pnl"]').should("contain", "$3,456.78");
    });

    it("deve atualizar dados em tempo real", () => {
      // Simular SSE event de nova transação
      cy.window().then((win) => {
        win.dispatchEvent(
          new CustomEvent("sse-message", {
            detail: {
              type: "transaction_update",
              data: {
                pending_requests: 8, // +1
                total_balance: 45778.9, // +100
              },
            },
          })
        );
      });

      cy.get('[data-cy="kpi-pending-requests"]').should("contain", "8");
      cy.get('[data-cy="kpi-total-balance"]').should("contain", "$45,778.90");
    });
  });
});
