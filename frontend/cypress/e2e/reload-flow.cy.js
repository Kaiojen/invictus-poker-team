describe("Fluxo de Reloads", () => {
  beforeEach(() => {
    cy.setupApiMocks();
  });

  context("Como Jogador", () => {
    beforeEach(() => {
      cy.login("player1", "player123");
      cy.visit("/reloads");
    });

    it("deve permitir criar novo reload", () => {
      cy.intercept("POST", "/api/reloads", {
        statusCode: 201,
        body: {
          id: 100,
          amount: 500,
          platform_id: 1,
          status: "pending",
          player_notes: "Teste automatizado",
        },
      }).as("createReload");

      cy.createReloadRequest(500, "pokerstars");

      cy.wait("@createReload");
      cy.get('[data-cy="success-message"]').should(
        "contain",
        "Reload solicitado com sucesso"
      );
      cy.get('[data-cy="reload-100"]').should("be.visible");
    });

    it("deve validar valores mínimos e máximos", () => {
      cy.get('[data-cy="new-reload-button"]').click();
      cy.get('[data-cy="platform-select"]').select("pokerstars");

      // Valor muito baixo
      cy.get('[data-cy="amount-input"]').clear().type("5");
      cy.get('[data-cy="submit-reload"]').click();
      cy.get('[data-cy="amount-error"]').should(
        "contain",
        "Valor mínimo é $50"
      );

      // Valor muito alto
      cy.get('[data-cy="amount-input"]').clear().type("5000");
      cy.get('[data-cy="submit-reload"]').click();
      cy.get('[data-cy="amount-error"]').should(
        "contain",
        "Valor máximo é $2000"
      );
    });

    it("deve exibir histórico de reloads", () => {
      cy.intercept("GET", "/api/reloads*", {
        fixture: "player-reloads.json",
      }).as("getReloads");

      cy.visit("/reloads");
      cy.wait("@getReloads");

      cy.get('[data-cy="reload-list"]').should("be.visible");
      cy.get('[data-cy="reload-item"]').should("have.length.greaterThan", 0);
    });

    it("deve filtrar reloads por status", () => {
      cy.visit("/reloads");

      cy.get('[data-cy="status-filter"]').select("pending");
      cy.get('[data-cy="reload-item"][data-status="pending"]').should(
        "be.visible"
      );
      cy.get('[data-cy="reload-item"][data-status="approved"]').should(
        "not.exist"
      );

      cy.get('[data-cy="status-filter"]').select("approved");
      cy.get('[data-cy="reload-item"][data-status="approved"]').should(
        "be.visible"
      );
      cy.get('[data-cy="reload-item"][data-status="pending"]').should(
        "not.exist"
      );
    });
  });

  context("Como Administrador", () => {
    beforeEach(() => {
      cy.login("admin", "admin123");
      cy.visit("/admin/reloads");
    });

    it("deve aprovar reload pendente", () => {
      cy.intercept("GET", "/api/admin/reloads*", {
        fixture: "admin-reloads.json",
      }).as("getAdminReloads");

      cy.intercept("PUT", "/api/admin/reloads/*/approve", {
        statusCode: 200,
        body: { success: true, message: "Reload aprovado com sucesso" },
      }).as("approveReload");

      cy.wait("@getAdminReloads");
      cy.approveReload(1);

      cy.wait("@approveReload");
      cy.get('[data-cy="success-message"]').should(
        "contain",
        "Reload aprovado"
      );
    });

    it("deve rejeitar reload com justificativa", () => {
      cy.intercept("PUT", "/api/admin/reloads/*/reject", {
        statusCode: 200,
        body: { success: true, message: "Reload rejeitado" },
      }).as("rejectReload");

      cy.get('[data-cy="reload-1"]').within(() => {
        cy.get('[data-cy="reject-button"]').click();
      });

      cy.get('[data-cy="rejection-reason"]').type("Documentação insuficiente");
      cy.get('[data-cy="confirm-rejection"]').click();

      cy.wait("@rejectReload");
      cy.get('[data-cy="success-message"]').should(
        "contain",
        "Reload rejeitado"
      );
    });

    it("deve filtrar reloads por jogador", () => {
      cy.get('[data-cy="player-filter"]').type("player1");
      cy.get('[data-cy="filter-button"]').click();

      cy.get('[data-cy="reload-item"]').each(($el) => {
        cy.wrap($el).should("contain", "player1");
      });
    });

    it("deve exportar relatório de reloads", () => {
      cy.get('[data-cy="export-button"]').click();
      cy.get('[data-cy="date-from"]').type("2025-01-01");
      cy.get('[data-cy="date-to"]').type("2025-01-31");
      cy.get('[data-cy="confirm-export"]').click();

      // Verificar se download foi iniciado
      cy.get('[data-cy="download-status"]').should(
        "contain",
        "Download iniciado"
      );
    });
  });

  context("Notificações em Tempo Real", () => {
    it("deve receber notificação quando reload é aprovado", () => {
      cy.login("player1", "player123");
      cy.visit("/dashboard");

      // Simular SSE event de reload aprovado
      cy.window().then((win) => {
        win.dispatchEvent(
          new CustomEvent("sse-message", {
            detail: {
              type: "reload_approved",
              data: {
                id: 1,
                amount: 500,
                platform: "pokerstars",
              },
            },
          })
        );
      });

      cy.get('[data-cy="notification-bell"]').should(
        "have.class",
        "has-new-notifications"
      );
      cy.get('[data-cy="notification-bell"]').click();
      cy.get('[data-cy="notification-item"]').should(
        "contain",
        "Reload aprovado"
      );
    });
  });
});
