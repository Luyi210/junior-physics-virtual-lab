import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles/global.css";

window.addEventListener("vite:preloadError", () => {
  const recoveryKey = "physics-lab-preload-recovery";
  const previous = Number(window.sessionStorage.getItem(recoveryKey) ?? 0);
  if (Date.now() - previous < 15_000) return;
  window.sessionStorage.setItem(recoveryKey, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </AppErrorBoundary>
  </StrictMode>
);
