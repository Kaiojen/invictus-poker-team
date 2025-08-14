import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Hook para conectar aos Server-Sent Events (SSE)
 * Permite receber atualizações em tempo real do backend
 */
export const useSSE = () => {
  const eventSourceRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const listenersRef = useRef({});

  // Conectar ao SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Já conectado
    }

    try {
      const eventSource = new EventSource("/api/sse/events", {
        withCredentials: true,
      });

      eventSource.onopen = () => {
        console.log("SSE: Conectado");
        setIsConnected(true);
      };

      eventSource.onerror = (error) => {
        console.error("SSE: Erro de conexão", error);
        setIsConnected(false);

        // Reconectar após 5 segundos
        setTimeout(() => {
          if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
            console.log("SSE: Tentando reconectar...");
            connect();
          }
        }, 5000);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("SSE: Evento recebido", data);

          setEvents((prev) => [
            ...prev.slice(-99),
            {
              id: Date.now(),
              type: "message",
              data,
              timestamp: new Date(),
            },
          ]);
        } catch (e) {
          console.error("SSE: Erro ao processar mensagem", e);
        }
      };

      // Eventos personalizados
      eventSource.addEventListener("connected", (event) => {
        const data = JSON.parse(event.data);
        console.log("SSE: Conectado com sucesso", data);
        toast.success("🟢 Conectado em tempo real");
      });

      eventSource.addEventListener("ping", (event) => {
        // Apenas manter conexão viva - não exibir
      });

      eventSource.addEventListener("reload_created", (event) => {
        const data = JSON.parse(event.data);
        console.log("SSE: Novo reload criado", data);

        // Chamar listeners registrados
        if (listenersRef.current.reload_created) {
          listenersRef.current.reload_created.forEach((listener) =>
            listener(data)
          );
        }

        toast.info(
          `💰 Novo reload: ${data.username} - $${data.amount.toFixed(2)}`
        );
      });

      eventSource.addEventListener("reload_approved", (event) => {
        const data = JSON.parse(event.data);
        console.log("SSE: Reload aprovado", data);

        if (listenersRef.current.reload_approved) {
          listenersRef.current.reload_approved.forEach((listener) =>
            listener(data)
          );
        }

        toast.success(
          `🎉 Reload aprovado: ${data.username} - $${data.amount.toFixed(2)}`
        );
      });

      eventSource.addEventListener("reload_status", (event) => {
        const data = JSON.parse(event.data);
        console.log("SSE: Status do reload atualizado", data);

        if (listenersRef.current.reload_status) {
          listenersRef.current.reload_status.forEach((listener) =>
            listener(data)
          );
        }

        if (data.status === "approved") {
          toast.success(data.message);
        } else if (data.status === "rejected") {
          toast.error(data.message);
        } else {
          toast.info(data.message);
        }
      });

      eventSource.addEventListener("balance_updated", (event) => {
        const data = JSON.parse(event.data);
        console.log("SSE: Saldo atualizado", data);

        if (listenersRef.current.balance_updated) {
          listenersRef.current.balance_updated.forEach((listener) =>
            listener(data)
          );
        }

        const diff = data.new_balance - data.old_balance;
        if (Math.abs(diff) > 0.01) {
          toast.info(
            `💰 Saldo atualizado: ${diff > 0 ? "+" : ""}$${diff.toFixed(2)}`
          );
        }
      });

      eventSource.addEventListener("dashboard_refresh", (event) => {
        console.log("SSE: Dashboard refresh solicitado");

        if (listenersRef.current.dashboard_refresh) {
          listenersRef.current.dashboard_refresh.forEach((listener) =>
            listener()
          );
        }
      });

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("SSE: Erro ao conectar", error);
      setIsConnected(false);
    }
  }, []);

  // Desconectar do SSE
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log("SSE: Desconectado");
    }
  }, []);

  // Adicionar listener para eventos específicos
  const addEventListener = useCallback((eventType, listener) => {
    if (!listenersRef.current[eventType]) {
      listenersRef.current[eventType] = [];
    }
    listenersRef.current[eventType].push(listener);

    // Retornar função para remover o listener
    return () => {
      if (listenersRef.current[eventType]) {
        listenersRef.current[eventType] = listenersRef.current[
          eventType
        ].filter((l) => l !== listener);
      }
    };
  }, []);

  // Conectar automaticamente quando o hook é usado
  useEffect(() => {
    connect();

    // Cleanup ao desmontar
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconectar quando a página ganha foco (usuário volta para a aba)
  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && !eventSourceRef.current) {
        console.log("SSE: Reconectando após foco da página");
        connect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isConnected) {
        console.log("SSE: Reconectando após página voltar a ser visível");
        connect();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isConnected, connect]);

  return {
    isConnected,
    events,
    connect,
    disconnect,
    addEventListener,
  };
};

export default useSSE;
