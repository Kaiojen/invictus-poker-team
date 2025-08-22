import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "../../components/NotificationBell";

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("deve renderizar o sino de notificação", () => {
    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    expect(bellButton).toBeInTheDocument();
  });

  it("deve mostrar badge quando há notificações não lidas", async () => {
    // Mock da resposta da API
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 5,
          unread: 3,
          urgent: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            { id: 1, title: "Reload aprovado", priority: "medium", read: false },
            { id: 2, title: "Saque processado", priority: "high", read: false },
            { id: 3, title: "Mensagem", priority: "low", read: true },
          ],
        }),
      });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.getByText("3");
      expect(badge).toBeInTheDocument();
    });
  });

  it("deve abrir dropdown ao clicar", async () => {
    const user = userEvent.setup();

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          unread: 1,
          urgent: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            {
              id: 1,
              title: "Nova notificação",
              message: "Seu reload foi aprovado",
              priority: "medium",
              read: false,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    const bellButton = screen.getByRole("button");
    await user.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Nova notificação")).toBeInTheDocument();
    });
  });

  it("deve marcar notificação como lida ao clicar", async () => {
    const user = userEvent.setup();

    // Mock inicial com notificação não lida
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          unread: 1,
          urgent: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            {
              id: 1,
              title: "Nova notificação",
              message: "Teste",
              priority: "medium",
              read: false,
              created_at: new Date().toISOString(),
            },
          ],
        }),
      })
      // Mock para marcar como lida
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<NotificationBell />);

    const bellButton = screen.getByRole("button");
    await user.click(bellButton);

    await waitFor(() => {
      const notification = screen.getByText("Nova notificação");
      expect(notification).toBeInTheDocument();
    });

    const notificationItem = screen
      .getByText("Nova notificação")
      .closest('[role="menuitem"]');
    await user.click(notificationItem);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/notifications/1/read", {
        method: "POST",
        credentials: "include",
      });
    });
  });

  it("não deve mostrar badge quando não há notificações não lidas", async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 2,
          unread: 0,
          urgent: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            { id: 1, title: "Mensagem lida", priority: "low", read: true },
          ],
        }),
      });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });
});
