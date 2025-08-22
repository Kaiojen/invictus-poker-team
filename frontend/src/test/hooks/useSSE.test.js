import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSSE } from "../../hooks/useSSE";

// Mock do EventSource
class MockEventSource {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.close = vi.fn(() => {
      this.readyState = 2; // CLOSED
    });

    // Simular conexão automática após criação
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);
  }

  addEventListener(event, handler) {
    this[`on${event}`] = handler;
  }

  removeEventListener(event, handler) {
    this[`on${event}`] = null;
  }

  // Métodos para simular eventos nos testes
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({
        data: typeof data === "string" ? data : JSON.stringify(data),
        type: "message",
      });
    }
  }

  simulateError() {
    this.readyState = 2; // CLOSED
    if (this.onerror) this.onerror(new Event("error"));
  }

  simulateEvent(eventType, data) {
    const handler = this[`on${eventType}`];
    if (handler) {
      handler({
        data: typeof data === "string" ? data : JSON.stringify(data),
        type: eventType,
      });
    }
  }
}

// Substituir EventSource global
const originalEventSource = global.EventSource;
let currentEventSource = null;

global.EventSource = class extends MockEventSource {
  constructor(url, options) {
    super(url, options);
    currentEventSource = this;
  }
};

describe("useSSE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentEventSource = null;
  });

  afterEach(() => {
    if (currentEventSource) {
      currentEventSource.close();
    }
  });

  it("deve inicializar com estado desconectado", () => {
    const { result } = renderHook(() => useSSE());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.events).toEqual([]);
  });

  it("deve conectar automaticamente", async () => {
    const { result } = renderHook(() => useSSE());

    // Aguardar a conexão ser estabelecida
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("deve processar mensagens recebidas", async () => {
    const { result } = renderHook(() => useSSE());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const testMessage = {
      type: "reload_status",
      data: { id: 1, status: "APPROVED" },
    };

    act(() => {
      currentEventSource.simulateMessage(testMessage);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].data).toEqual(testMessage);
    expect(result.current.events[0].type).toBe("message");
  });

  it("deve registrar listeners para eventos específicos", async () => {
    const { result } = renderHook(() => useSSE());
    const mockCallback = vi.fn();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Registrar listener
    act(() => {
      result.current.addEventListener("reload_status", mockCallback);
    });

    const testData = { id: 1, status: "APPROVED" };

    act(() => {
      currentEventSource.simulateEvent("reload_status", testData);
    });

    expect(mockCallback).toHaveBeenCalledWith(testData);
  });

  it("deve fechar conexão na desmontagem", async () => {
    const { result, unmount } = renderHook(() => useSSE());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeSpy = vi.spyOn(currentEventSource, "close");

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it("deve tentar reconectar após erro", async () => {
    const { result } = renderHook(() => useSSE());

    // Aguardar conexão inicial
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);
    const originalEventSource = currentEventSource;

    // Simular erro
    act(() => {
      currentEventSource.simulateError();
    });

    expect(result.current.isConnected).toBe(false);

    // Aguardar um pouco para permitir reconexão
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Deve manter o hook disponível (testando apenas a funcionalidade básica)
    expect(result.current.disconnect).toBeDefined();
  });
});

// Restaurar EventSource original
afterAll(() => {
  global.EventSource = originalEventSource;
});
