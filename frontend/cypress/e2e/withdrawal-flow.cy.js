describe("Fluxo de Saques", () => {
  beforeEach(() => {
    cy.setupApiMocks();
  });

  context("Como Jogador", () => {
    beforeEach(() => {
      cy.login("player1", "player123");
      cy.visit("/withdrawals");
    });

    it("deve permitir solicitar saque", () => {
      cy.intercept("POST", "/api/withdrawals", {
        statusCode: 201,
        body: {
          id: 200,
          amount: 300,
          platform_id: 1,
          status: "pending",
          player_notes: "Saque teste",
        },
      }).as("createWithdrawal");

      cy.get('[data-cy="new-withdrawal-button"]').click();
      cy.get('[data-cy="platform-select"]').select("pokerstars");
      cy.get('[data-cy="amount-input"]').type("300");
      cy.get('[data-cy="notes-input"]').type("Saque teste");
      cy.get('[data-cy="submit-withdrawal"]').click();

      cy.wait("@createWithdrawal");
      cy.get('[data-cy="success-message"]').should(
        "contain",
        "Saque solicitado com sucesso"
      );
    });

    it("deve validar saldo suficiente", () => {
      cy.intercept("GET", "/api/accounts/balance/1", {
        body: { current_balance: 100.0 },
      }).as("getBalance");

      cy.get('[data-cy="new-withdrawal-button"]').click();
      cy.get('[data-cy="platform-select"]').select("pokerstars");
      cy.wait("@getBalance");

      cy.get('[data-cy="amount-input"]').type("500"); // Maior que saldo
      cy.get('[data-cy="submit-withdrawal"]').click();

      cy.get('[data-cy="amount-error"]').should(
        "contain",
        "Saldo insuficiente"
      );
    });

    it("deve exibir histórico de saques", () => {
      cy.intercept("GET", "/api/withdrawals*", {
        fixture: "player-withdrawals.json",
      }).as("getWithdrawals");

      cy.visit("/withdrawals");
      cy.wait("@getWithdrawals");

      cy.get('[data-cy="withdrawal-list"]').should("be.visible");
      cy.get('[data-cy="withdrawal-item"]').should(
        "have.length.greaterThan",
        0
      );
    });

    it("deve cancelar saque pendente", () => {
      cy.intercept("PUT", "/api/withdrawals/*/cancel", {
        statusCode: 200,
        body: { success: true, message: "Saque cancelado" },
      }).as("cancelWithdrawal");

      cy.get('[data-cy="withdrawal-1"][data-status="pending"]').within(() => {
        cy.get('[data-cy="cancel-button"]').click();
      });

      cy.get('[data-cy="confirm-cancel"]').click();
      cy.wait("@cancelWithdrawal");

      cy.get('[data-cy="success-message"]').should(
        "contain",
        "Saque cancelado"
      );
    });
  });

  context("Como Administrador", () => {
    beforeEach(() => {
      cy.login("admin", "admin123");
      cy.visit("/admin/withdrawals");
    });

    it("deve aprovar saque pendente", () => {
      cy.intercept("GET", "/api/admin/withdrawals*", {
        fixture: "admin-withdrawals.json",
      }).as("getAdminWithdrawals");

      cy.intercept("PUT", "/api/admin/withdrawals/*/approve", {
        statusCode: 200,
        body: { success: true, message: "Saque aprovado com sucesso" },
      }).as("approveWithdrawal");

      cy.wait("@getAdminWithdrawals");

      cy.get('[data-cy="withdrawal-1"]').within(() => {
        cy.get('[data-cy="approve-button"]').click();
      });

      cy.get('[data-cy="approval-notes"]').type("Saque aprovado via teste");
      cy.get('[data-cy="confirm-approval"]').click();

      cy.wait("@approveWithdrawal");
      cy.get('[data-cy="success-message"]').should("contain", "Saque aprovado");
    });

    it("deve verificar atualização automática de saldos", () => {
      cy.intercept("PUT", "/api/admin/withdrawals/*/approve", {
        statusCode: 200,
        body: { success: true, message: "Saque aprovado" },
      }).as("approveWithdrawal");

      // Mock da atualização de saldo após aprovação
      cy.intercept("GET", "/api/accounts/1", {
        body: {
          current_balance: 700.0, // Saldo reduzido após saque
          previous_balance: 1000.0,
        },
      }).as("getUpdatedBalance");

      cy.get('[data-cy="withdrawal-1"]').within(() => {
        cy.get('[data-cy="approve-button"]').click();
      });

      cy.get('[data-cy="confirm-approval"]').click();
      cy.wait("@approveWithdrawal");
      cy.wait("@getUpdatedBalance");

      // Verificar se saldo foi atualizado na interface
      cy.visit("/admin/accounts");
      cy.get('[data-cy="account-1-balance"]').should("contain", "$700.00");
    });

    it("deve gerar auditoria para aprovações", () => {
      cy.intercept("PUT", "/api/admin/withdrawals/*/approve", {
        statusCode: 200,
        body: { success: true },
      }).as("approveWithdrawal");

      cy.intercept("GET", "/api/admin/audit-logs*", {
        body: {
          logs: [
            {
              id: 1,
              action: "withdrawal_approved",
              user_id: 1,
              entity_type: "WithdrawalRequest",
              entity_id: 1,
              notes: "Saque aprovado via teste",
              created_at: new Date().toISOString(),
            },
          ],
        },
      }).as("getAuditLogs");

      cy.get('[data-cy="withdrawal-1"]').within(() => {
        cy.get('[data-cy="approve-button"]').click();
      });

      cy.get('[data-cy="approval-notes"]').type("Saque aprovado via teste");
      cy.get('[data-cy="confirm-approval"]').click();
      cy.wait("@approveWithdrawal");

      // Verificar se log de auditoria foi criado
      cy.visit("/admin/audit");
      cy.wait("@getAuditLogs");
      cy.get('[data-cy="audit-log-1"]').should(
        "contain",
        "withdrawal_approved"
      );
    });
  });
});
