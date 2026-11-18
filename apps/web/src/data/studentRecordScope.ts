import { getStudentAuthMetadata, PLATFORM_AUTH_EVENT, STUDENT_AUTH_EVENT } from "./teacherApi";

export interface StudentRecordScope {
  readonly key: string | null;
  readonly apiNamespace: string;
  readonly schoolId: string | null;
  readonly studentId: string | null;
  readonly mode: "account" | "signed-out" | "demo" | "blocked";
  readonly label: string;
  readonly canWrite: boolean;
  readonly revision: number;
}

interface LocalStudent { id: string; schoolId: string; name: string; expiresAt: number }

// The server's token is payload.signature. Local decoding only selects a cache;
// authentication and school/session authorization still belong to the API.
function localStudent(token: string): LocalStudent | null {
  if (!token || token.length > 16_384) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const encoded = parts[0].replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const value = payload as Record<string, unknown>;
    if (value.role !== "student" || typeof value.sub !== "string" || !value.sub.trim() || value.sub.length > 200
      || typeof value.schoolId !== "string" || !value.schoolId.trim() || value.schoolId.length > 200
      || typeof value.exp !== "number" || !Number.isFinite(value.exp) || value.exp <= 0 || !Number.isFinite(value.exp * 1000)) return null;
    encodeURIComponent(value.sub); encodeURIComponent(value.schoolId);
    return { id: value.sub, schoolId: value.schoolId, expiresAt: value.exp * 1000,
      name: typeof value.name === "string" && value.name.trim() && value.name.length <= 160 ? value.name.trim() : value.sub };
  } catch { return null; }
}

const listeners = new Set<() => void>();
let snapshot: StudentRecordScope | undefined;
let fingerprint = "";
let nextExpiry = Infinity;
let expirationTimer: ReturnType<typeof setTimeout> | undefined;
let removeEvents: (() => void) | undefined;
let notificationQueued = false;
const emit = () => { for (const listener of [...listeners]) listener(); };
function notifyDeferred() {
  if (notificationQueued) return;
  notificationQueued = true;
  queueMicrotask(() => { if (!notificationQueued) return; notificationQueued = false; emit(); });
}
function armExpiration() {
  clearTimeout(expirationTimer); expirationTimer = undefined;
  if (listeners.size && Number.isFinite(nextExpiry)) expirationTimer = setTimeout(() => refresh(true), Math.min(2_147_483_647, Math.max(1, nextExpiry - Date.now())));
}
function refresh(immediate = false): StudentRecordScope {
  const metadata = getStudentAuthMetadata();
  const student = metadata.demoOnly ? null : localStudent(metadata.studentToken);
  const expired = !!student && student.expiresAt <= Date.now();
  const nextFingerprint = JSON.stringify([metadata.apiNamespace, metadata.demoOnly, metadata.storageAvailable, metadata.studentToken, expired]);
  if (snapshot && fingerprint === nextFingerprint) { armExpiration(); return snapshot; }
  fingerprint = nextFingerprint;
  nextExpiry = student && !expired ? student.expiresAt : Infinity;
  let value: Omit<StudentRecordScope, "revision"> = {
    key: null, apiNamespace: metadata.apiNamespace, schoolId: null, studentId: null,
    mode: "blocked", label: "登录身份无效，请重新登录学生账号", canWrite: false
  };
  if (metadata.demoOnly) value = { ...value, mode: "demo", label: "演示模式不读取学生课堂档案" };
  else if (!metadata.storageAvailable) value = { ...value, label: "无法读取学生登录身份，请检查本机存储" };
  else if (!metadata.studentToken) value = { ...value, mode: "signed-out", label: "请登录学生账号查看课堂档案" };
  else if (student) value = {
    key: `student:${encodeURIComponent(metadata.apiNamespace)}:${encodeURIComponent(student.schoolId)}:${encodeURIComponent(student.id)}`,
    apiNamespace: metadata.apiNamespace, schoolId: student.schoolId, studentId: student.id,
    mode: "account", label: `学生 · ${student.name}${expired ? "（登录已过期，只读）" : ""}`, canWrite: !expired
  };
  const previous = snapshot;
  snapshot = Object.freeze({ ...value, revision: (previous?.revision ?? 0) + 1 });
  armExpiration();
  if (previous && listeners.size) {
    if (immediate) { notificationQueued = false; emit(); }
    else notifyDeferred();
  }
  return snapshot;
}

export function getStudentRecordScope(): StudentRecordScope { return refresh(); }
export function isCurrentStudentRecordScope(scope: StudentRecordScope, requireWrite = false): boolean {
  const current = getStudentRecordScope();
  return current.key !== null && current.mode === "account" && current.key === scope.key && current.mode === scope.mode
    && current.apiNamespace === scope.apiNamespace && current.schoolId === scope.schoolId && current.studentId === scope.studentId
    && current.revision === scope.revision && (!requireWrite || (current.canWrite && scope.canWrite));
}
export function subscribeStudentRecordScope(listener: () => void): () => void {
  listeners.add(listener);
  if (!removeEvents && typeof window !== "undefined") {
    const changed = () => { refresh(true); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === "physics-lab-v2-api-student-token") changed(); };
    window.addEventListener(PLATFORM_AUTH_EVENT, changed);
    window.addEventListener(STUDENT_AUTH_EVENT, changed);
    window.addEventListener("storage", storage);
    window.addEventListener("focus", changed);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", changed);
    removeEvents = () => {
      window.removeEventListener(PLATFORM_AUTH_EVENT, changed); window.removeEventListener(STUDENT_AUTH_EVENT, changed);
      window.removeEventListener("storage", storage); window.removeEventListener("focus", changed);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", changed);
    };
  }
  refresh();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { removeEvents?.(); removeEvents = undefined; clearTimeout(expirationTimer); expirationTimer = undefined; notificationQueued = false; }
  };
}
