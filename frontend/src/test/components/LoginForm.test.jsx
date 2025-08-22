import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "../../components/LoginForm";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("deve renderizar o formulário de login", () => {
    render(<LoginForm onLogin={vi.fn()} />);

    expect(screen.getByLabelText(/usuário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("deve permitir digitar nos campos de entrada", async () => {
    const user = userEvent.setup();
    render(<LoginForm onLogin={vi.fn()} />);

    const usernameInput = screen.getByLabelText(/usuário/i);
    const passwordInput = screen.getByLabelText(/senha/i);

    await user.type(usernameInput, "test_user");
    await user.type(passwordInput, "test_password");

    expect(usernameInput).toHaveValue("test_user");
    expect(passwordInput).toHaveValue("test_password");
  });

  it("deve fazer login com sucesso", async () => {
    const user = userEvent.setup();
    const mockOnLogin = vi.fn();

    // Mock do fetch para resposta de sucesso
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        user: { id: 1, username: "test_user", role: "PLAYER" },
      }),
    });

    render(<LoginForm onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText(/usuário/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    const submitButton = screen.getByRole("button", { name: /entrar/i });

    await user.type(usernameInput, "test_user");
    await user.type(passwordInput, "test_password");
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: "test_user",
          password: "test_password",
        }),
      });
    });
  });

  it("deve mostrar erro quando credenciais são inválidas", async () => {
    const user = userEvent.setup();

    // Mock do fetch para resposta de erro
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: "Credenciais inválidas",
      }),
    });

    render(<LoginForm onLogin={vi.fn()} />);

    const usernameInput = screen.getByLabelText(/usuário/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    const submitButton = screen.getByRole("button", { name: /entrar/i });

    await user.type(usernameInput, "invalid_user");
    await user.type(passwordInput, "wrong_password");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/erro ao fazer login/i)).toBeInTheDocument();
    });
  });

  it("deve mostrar botão de cadastro", () => {
    render(<LoginForm onLogin={vi.fn()} />);

    const registerButton = screen.getByText(/cadastrar-se como jogador/i);
    expect(registerButton).toBeInTheDocument();
  });

  it("deve mostrar botão esqueceu a senha", () => {
    render(<LoginForm onLogin={vi.fn()} />);

    const forgotButton = screen.getByText(/esqueceu a senha/i);
    expect(forgotButton).toBeInTheDocument();
  });
});
