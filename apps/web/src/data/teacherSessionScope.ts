import { getTeacherAuthMetadata, isTeacherAuthStorageKey, PLATFORM_AUTH_EVENT, readTeacherTokenClaims } from "./teacherApi";

export interface TeacherSessionScope {
  readonly key: string | null;
  readonly apiNamespace: string;
  readonly userId: string | null;
  readonly schoolId: string | null;
  readonly role: "teacher" | "admin" | null;
  readonly expiresAt: number | null;
  readonly mode: "account" | "signed-out" | "expired" | "blocked" | "demo";
  readonly label: string;
  readonly canAccess: boolean;
  readonly revision: number;
}
const listeners = new Set<() => void>();
let snapshot: TeacherSessionScope | undefined;
let fingerprint = "";
let nextExpiry = Infinity;
let timer: ReturnType<typeof setTimeout> | undefined;
let removeEvents: (() => void) | undefined;
let notificationQueued = false;
const emit = () => { for (const listener of [...listeners]) listener(); };
function armExpiration() {
  clearTimeout(timer); timer = undefined;
  if (listeners.size && Number.isFinite(nextExpiry)) timer = setTimeout(() => refresh(true), Math.min(2_147_483_647, Math.max(1, nextExpiry - Date.now())));
}
function refresh(immediate = false): TeacherSessionScope {
  const metadata = getTeacherAuthMetadata();
  const claims = metadata.demoOnly ? null : readTeacherTokenClaims(metadata.teacherToken);
  const expired = !!claims && claims.expiresAt <= Date.now();
  const nextFingerprint = JSON.stringify([metadata.apiNamespace, metadata.demoOnly, metadata.storageAvailable, metadata.generation, expired]);
  if (snapshot && nextFingerprint === fingerprint) { armExpiration(); return snapshot; }
  fingerprint = nextFingerprint;
  nextExpiry = claims && !expired && metadata.storageAvailable ? claims.expiresAt : Infinity;
  let value: Omit<TeacherSessionScope, "revision"> = {
    key: null, apiNamespace: metadata.apiNamespace, userId: null, schoolId: null, role: null, expiresAt: null,
    mode: "blocked", label: "教师登录身份无效，请重新登录", canAccess: false
  };
  if (metadata.demoOnly) value = { ...value, mode: "demo", label: "演示模式不读取学校后台资料" };
  else if (!metadata.storageAvailable) value = { ...value, label: "教师登录身份不可用，请检查本机存储并重新登录" };
  else if (!metadata.teacherToken) value = { ...value, mode: "signed-out", label: "请登录教师或管理员账号" };
  else if (claims) value = {
    key: `teacher:${encodeURIComponent(metadata.apiNamespace)}:${encodeURIComponent(claims.schoolId)}:${encodeURIComponent(claims.id)}:${claims.role}`,
    apiNamespace: metadata.apiNamespace, userId: claims.id, schoolId: claims.schoolId, role: claims.role, expiresAt: claims.expiresAt,
    mode: expired ? "expired" : "account", label: `${claims.role === "admin" ? "管理员" : "教师"} · ${claims.name}${expired ? "（登录已过期）" : ""}`, canAccess: !expired
  };
  const previous = snapshot;
  snapshot = Object.freeze({ ...value, revision: (previous?.revision ?? 0) + 1 });
  armExpiration();
  if (previous && listeners.size) {
    if (immediate) { notificationQueued = false; emit(); }
    else if (!notificationQueued) {
      notificationQueued = true;
      queueMicrotask(() => { if (notificationQueued) { notificationQueued = false; emit(); } });
    }
  }
  return snapshot;
}
export function getTeacherSessionScope(): TeacherSessionScope { return refresh(); }
export function isCurrentTeacherSessionScope(scope: TeacherSessionScope, requireAccount = true): boolean {
  const current = getTeacherSessionScope();
  return current.revision === scope.revision && current.key === scope.key && current.apiNamespace === scope.apiNamespace
    && current.mode === scope.mode && (!requireAccount || (current.canAccess && scope.canAccess));
}
export function subscribeTeacherSessionScope(listener: () => void): () => void {
  // Install the credential observer before scope listeners so ABA generations
  // are settled before subscribers receive this event.
  getTeacherAuthMetadata();
  listeners.add(listener);
  if (!removeEvents && typeof window !== "undefined") {
    const changed = () => { refresh(true); };
    const storage = (event: StorageEvent) => { if (isTeacherAuthStorageKey(event.key)) changed(); };
    window.addEventListener(PLATFORM_AUTH_EVENT, changed); window.addEventListener("storage", storage); window.addEventListener("focus", changed);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", changed);
    removeEvents = () => {
      window.removeEventListener(PLATFORM_AUTH_EVENT, changed); window.removeEventListener("storage", storage); window.removeEventListener("focus", changed);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", changed);
    };
  }
  refresh();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { removeEvents?.(); removeEvents = undefined; clearTimeout(timer); timer = undefined; notificationQueued = false; }
  };
}
