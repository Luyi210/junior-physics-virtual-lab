type Persistence = "local" | "session";

function storage(persistence: Persistence) {
  return persistence === "local" ? window.localStorage : window.sessionStorage;
}

/** An optional guide preference must never prevent the page from opening. */
export function hasSeenPageIntroduction(key: string, persistence: Persistence) {
  if (typeof window === "undefined") return true;
  try { return storage(persistence).getItem(key) === "seen"; }
  catch { return false; }
}

/** Closing the guide still works when browser storage is disabled or full. */
export function rememberPageIntroduction(key: string, persistence: Persistence) {
  if (typeof window === "undefined") return;
  try { storage(persistence).setItem(key, "seen"); }
  catch { /* The component's open state is sufficient for this visit. */ }
}
