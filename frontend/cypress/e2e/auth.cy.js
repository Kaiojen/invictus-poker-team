describe("Autenticação", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("deve exibir formulário de login", () => {
    cy.get('[data-cy="login-form"]').should("be.visible");
    cy.get('[data-cy="username-input"]').should("be.visible");
    cy.get('[data-cy="password-input"]').should("be.visible");
    cy.get('[data-cy="login-button"]').should("be.visible");
  });

  it("deve mostrar erro com credenciais inválidas", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 401,
      body: { message: "Credenciais inválidas" },
    }).as("loginFail");

    cy.get('[data-cy="username-input"]').type("usuario_invalido");
    cy.get('[data-cy="password-input"]').type("senha_errada");
    cy.get('[data-cy="login-button"]').click();

    cy.wait("@loginFail");
    cy.get('[data-cy="error-message"]').should(
      "contain",
      "Credenciais inválidas"
    );
  });

  it("deve fazer login com sucesso e redirecionar", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 200,
      body: {
        success: true,
        user: {
          id: 1,
          username: "admin",
          role: "ADMIN",
          full_name: "Administrador",
        },
      },
    }).as("loginSuccess");

    cy.setupApiMocks();

    cy.get('[data-cy="username-input"]').type("admin");
    cy.get('[data-cy="password-input"]').type("admin123");
    cy.get('[data-cy="login-button"]').click();

    cy.wait("@loginSuccess");
    cy.url().should("not.include", "/login");
    cy.get('[data-cy="user-info"]').should("contain", "Administrador");
  });

  it("deve validar campos obrigatórios", () => {
    cy.get('[data-cy="login-button"]').click();

    cy.get('[data-cy="username-error"]').should("be.visible");
    cy.get('[data-cy="password-error"]').should("be.visible");
  });

  it("deve mostrar/ocultar senha", () => {
    cy.get('[data-cy="password-input"]').should(
      "have.attr",
      "type",
      "password"
    );
    cy.get('[data-cy="toggle-password"]').click();
    cy.get('[data-cy="password-input"]').should("have.attr", "type", "text");
    cy.get('[data-cy="toggle-password"]').click();
    cy.get('[data-cy="password-input"]').should(
      "have.attr",
      "type",
      "password"
    );
  });

  it("deve fazer logout corretamente", () => {
    // Primeiro fazer login
    cy.login("admin", "admin123");
    cy.visit("/dashboard");

    // Depois fazer logout
    cy.logout();
    cy.url().should("include", "/login");
  });
});
