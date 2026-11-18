import {
  getPlatformAuthMetadata, isPlatformAuthStorageKey, PLATFORM_AUTH_EVENT, STUDENT_AUTH_EVENT,
  setHighSchoolAuthSelection, type HighSchoolAuthSelection, type PlatformAuthChannel
} from "./teacherApi";

export interface HighSchoolRecordScope {
  key: string | null;
  mode: "account" | "guest" | "demo" | "blocked";
  label: string;
  canWrite: boolean;
  authChannel: PlatformAuthChannel | null;
  revision: number;
}
export interface HighSchoolRecordScopeOption {
  channel: HighSchoolAuthSelection;
  label: string;
  selected: boolean;
  expired: boolean;
}
interface LocalAccount { id: string; schoolId: string; role: "student" | "teacher" | "admin"; name: string; expiresAt: number }

/** The API uses payload.signature, not a three-part JWT. This is classification, never signature verification. */
function localAccount(token: string, channel: PlatformAuthChannel): LocalAccount | null {
  if (!token || token.length > 16_384) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const encoded = parts[0].replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const value = payload as Record<string, unknown>;
    if (typeof value.sub !== "string" || !value.sub.trim() || value.sub.length > 200
      || typeof value.schoolId !== "string" || !value.schoolId.trim() || value.schoolId.length > 200
      || typeof value.exp !== "number" || !Number.isFinite(value.exp) || value.exp <= 0 || !Number.isFinite(value.exp * 1000)) return null;
    if (channel === "student" ? value.role !== "student" : value.role !== "teacher" && value.role !== "admin") return null;
    // JSON can encode lone surrogates, which cannot safely form a storage-key segment.
    encodeURIComponent(value.sub); encodeURIComponent(value.schoolId);
    return { id: value.sub, schoolId: value.schoolId, role: value.role as LocalAccount["role"],
      name: typeof value.name === "string" && value.name.trim() && value.name.length <= 160 ? value.name.trim() : value.sub,
      expiresAt: value.exp * 1000 };
  } catch { return null; }
}

const listeners = new Set<() => void>();
let snapshot: HighSchoolRecordScope | undefined;
let options: HighSchoolRecordScopeOption[] = [];
let fingerprint = "";
let expirationTimer: ReturnType<typeof setTimeout> | undefined;
let nextExpiry = Infinity;
let removeEvents: (() => void) | undefined;
let notificationQueued = false;
const roleLabel = { student: "学生", teacher: "教师", admin: "管理员" };
const emit = () => { for (const listener of [...listeners]) listener(); };
function deferNotification() {
  if (notificationQueued) return;
  notificationQueued = true;
  queueMicrotask(() => { notificationQueued = false; emit(); });
}
function armExpiration() {
  clearTimeout(expirationTimer);
  expirationTimer = undefined;
  if (listeners.size && Number.isFinite(nextExpiry)) {
    expirationTimer = setTimeout(() => refresh(true), Math.min(2_147_483_647, Math.max(1, nextExpiry - Date.now())));
  }
}

function refresh(notifyImmediately = false): HighSchoolRecordScope {
  const metadata = getPlatformAuthMetadata();
  const student = metadata.demoOnly ? null : localAccount(metadata.studentToken, "student");
  const teacher = metadata.demoOnly ? null : localAccount(metadata.teacherToken, "teacher");
  const now = Date.now();
  const expired = (account: LocalAccount | null) => Boolean(account && account.expiresAt <= now);
  const nextFingerprint = JSON.stringify([metadata.apiNamespace, metadata.demoOnly, metadata.storageAvailable,
    metadata.studentToken, metadata.teacherToken, metadata.selection, expired(student), expired(teacher)]);
  if (snapshot && fingerprint === nextFingerprint) { armExpiration(); return snapshot; }
  fingerprint = nextFingerprint;
  const namespace = encodeURIComponent(metadata.apiNamespace);
  const accounts = { student, teacher };
  let result: Omit<HighSchoolRecordScope, "revision"> = { key: null, mode: "blocked", label: "请明确选择本次使用的档案身份", canWrite: false, authChannel: null };
  let selected: HighSchoolAuthSelection | null = null;
  nextExpiry = Math.min(...[student, teacher].flatMap((account) => account && account.expiresAt > now ? [account.expiresAt] : []));

  if (!metadata.storageAvailable) result.label = "本机存储不可用，暂时不能确定档案身份";
  else if (metadata.demoOnly) {
    result = { key: `demo:${namespace}`, mode: "demo", label: "演示档案 · 当前浏览器", canWrite: true, authChannel: null };
  } else {
    if (metadata.selection === "guest") selected = "guest";
    else if (metadata.selection === "student" || metadata.selection === "teacher") selected = metadata.selection;
    else if (metadata.selection !== null) result.label = "档案身份选择无效，请重新选择";
    else if (!metadata.studentToken && !metadata.teacherToken) selected = "guest";
    else if (metadata.studentToken && !metadata.teacherToken && student) selected = "student";
    else if (metadata.teacherToken && !metadata.studentToken && teacher) selected = "teacher";

    if (selected === "guest") result = { key: `guest:${namespace}`, mode: "guest", label: "游客档案 · 当前浏览器共享", canWrite: true, authChannel: null };
    else if (selected) {
      const account = accounts[selected];
      if (account) result = {
        key: `account:${namespace}:${encodeURIComponent(account.schoolId)}:${account.role}:${encodeURIComponent(account.id)}`,
        mode: "account", label: `${roleLabel[account.role]} · ${account.name}${expired(account) ? "（登录已过期，只读）" : ""}`,
        canWrite: !expired(account), authChannel: selected
      };
      else result.label = "所选登录身份缺失或无效，请重新登录或明确选择游客档案";
    } else if ((metadata.studentToken && !student) || (metadata.teacherToken && !teacher)) result.label = "登录身份格式无效，请重新登录或明确选择游客档案";
  }
  const previous = snapshot;
  snapshot = Object.freeze({ ...result, revision: (previous?.revision ?? 0) + 1 });
  options = metadata.demoOnly ? [] : [
    ...(["student", "teacher"] as const).flatMap((channel) => {
      const account = accounts[channel];
      return account ? [{ channel, label: `${roleLabel[account.role]} · ${account.name}${expired(account) ? "（已过期）" : ""}`, expired: expired(account), selected: result.mode === "account" && result.authChannel === channel }] : [];
    }),
    { channel: "guest", label: "游客档案 · 当前浏览器共享", expired: false, selected: result.mode === "guest" }
  ];
  armExpiration();
  // getSnapshot may run during React rendering. Notify from an event or a microtask, not inside another render.
  if (previous && listeners.size) { if (notifyImmediately) emit(); else deferNotification(); }
  return snapshot;
}

export function getHighSchoolRecordScope() { return refresh(); }
export function getHighSchoolRecordScopeOptions() { refresh(); return options; }
export function selectHighSchoolRecordScope(channel: HighSchoolAuthSelection) {
  if (!setHighSchoolAuthSelection(channel)) throw new Error("无法保存档案身份选择，当前档案保持不变。请检查浏览器本机存储后重试。");
  return refresh(true);
}
export function isCurrentHighSchoolRecordScope(scope: HighSchoolRecordScope, requireWrite = false) {
  const current = getHighSchoolRecordScope();
  return current.key !== null && current.key === scope.key && current.mode === scope.mode && current.revision === scope.revision
    && (!requireWrite || current.canWrite);
}
export function subscribeHighSchoolRecordScope(listener: () => void) {
  listeners.add(listener);
  if (!removeEvents && typeof window !== "undefined") {
    const changed = () => { refresh(true); };
    const storage = (event: StorageEvent) => { if (isPlatformAuthStorageKey(event.key)) changed(); };
    window.addEventListener(PLATFORM_AUTH_EVENT, changed);
    window.addEventListener(STUDENT_AUTH_EVENT, changed);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", changed);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", changed);
    removeEvents = () => {
      window.removeEventListener(PLATFORM_AUTH_EVENT, changed);
      window.removeEventListener(STUDENT_AUTH_EVENT, changed);
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", changed);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", changed);
    };
  }
  refresh();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { removeEvents?.(); removeEvents = undefined; clearTimeout(expirationTimer); expirationTimer = undefined; }
  };
}
