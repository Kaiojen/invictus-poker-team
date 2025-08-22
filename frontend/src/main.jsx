import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// CSRF util import para pré-carregar token ao iniciar app
import { getCsrfToken } from "./lib/csrf.js";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Pré-carregar token CSRF
getCsrfToken();

// Monkey-patch global fetch para anexar X-CSRF-Token automaticamente em métodos mutantes
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  try {
    const method = (init?.method || "GET").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const headers = new Headers(init.headers || {});
      const token = await getCsrfToken();
      if (token) headers.set("X-CSRF-Token", token);
      init = { ...init, headers, credentials: "include" };
    }
  } catch (_) {
    // segue com fetch mesmo sem CSRF (ex.: rotas GET ou durante boot)
  }
  return originalFetch(input, init);
};
