/** Upstream budgets only; the browser keeps its own existing waiting limit. */
export function apiProxyTimeoutMs(pathname, environment = process.env) {
  if (pathname === "/api/guangguang/chat") return 165_000;
  // The API accepts one trailing slash. Keep other routes on their old budget.
  if (pathname.replace(/\/$/, "") !== "/api/lili/chat") return 15_000;

  // Match config.js number parsing and lili.js's bounded service deadline.
  // The extra five seconds allow its guided fallback/response to reach the proxy.
  const configured = Number(environment.PHYSICS_LILI_TIMEOUT_MS);
  const serviceBudget = Number.isFinite(configured) && configured > 0
    ? Math.max(1, Math.min(Math.trunc(configured), 120_000))
    : 45_000;
  return serviceBudget + 5_000;
}
