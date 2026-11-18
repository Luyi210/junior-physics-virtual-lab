import type {
  ApiEnvelope,
  ApiHealth,
  AuthSession,
  ExperimentSession,
  GuangguangChatReply,
  GuangguangChatRequest,
  StudentExperimentSession,
  PlatformUser,
  TeachingClass,
  TeachingClassDetail,
  TeachingLesson,
  StudentTaskLessonContext,
  TeachingTask,
  TeachingTaskMode,
  TeachingTaskStatus
} from "@physics-lab/contracts";
import type { SaveLearningRecordRequest, SessionLearningRecord } from "@physics-lab/contracts";
import type { CreateLearningFeedbackRequest, LearningFeedback } from "@physics-lab/contracts";
import type { LiliChatReply, LiliChatRequest } from "@physics-lab/contracts";

const LEGACY_TOKEN_KEY = "physics-lab-v2-api-access-token";
const TEACHER_TOKEN_KEY = "physics-lab-v2-api-teacher-token";
const STUDENT_TOKEN_KEY = "physics-lab-v2-api-student-token";
const STUDENT_ID_KEY = "physics-lab-v2-api-student-id";
export const STUDENT_AUTH_EVENT = "physics-student-auth-changed";
export const PLATFORM_AUTH_EVENT = "physics-platform-auth-changed";
export type PlatformAuthChannel = "student" | "teacher";
export type HighSchoolAuthSelection = PlatformAuthChannel | "guest";
export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "true";
const configuredBaseUrl = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE_URL = DEMO_ONLY ? "" : configuredBaseUrl?.replace(/\/$/, "") ?? (import.meta.env.DEV ? "http://127.0.0.1:8787/api" : "/api");

export class TeacherApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const PlatformApiError = TeacherApiError;

function storedToken(key: string, includeLegacy = false) {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(key) ?? (includeLegacy ? window.localStorage.getItem(LEGACY_TOKEN_KEY) ?? "" : ""); }
  catch { return ""; }
}

function apiNamespace() {
  if (DEMO_ONLY) return "demo-only";
  try {
    const url = new URL(API_BASE_URL || "/api", typeof window === "undefined" ? "http://local.invalid" : window.location?.origin || "http://local.invalid");
    url.search = ""; url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch { return API_BASE_URL || "unconfigured"; }
}
const selectionKey = () => `physics-high-school-auth-selection-v1:${encodeURIComponent(apiNamespace())}`;
let authWriteFailed = false;

export interface PlatformAuthMetadata {
  demoOnly: boolean;
  apiNamespace: string;
  storageAvailable: boolean;
  studentToken: string;
  teacherToken: string;
  selection: string | null;
}

export interface TeacherTokenClaims { id: string; schoolId: string; role: "teacher" | "admin"; name: string; expiresAt: number }
/** Scope hints only; signature verification and authorization remain server-side. */
export function readTeacherTokenClaims(token: string): TeacherTokenClaims | null {
  if (typeof token !== "string" || !token || token.length > 16_384) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const encoded = parts[0].replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0))));
    if (!value || Array.isArray(value) || (value.role !== "teacher" && value.role !== "admin")
      || typeof value.sub !== "string" || !value.sub.trim() || value.sub.length > 200
      || typeof value.schoolId !== "string" || !value.schoolId.trim() || value.schoolId.length > 200
      || typeof value.exp !== "number" || !Number.isFinite(value.exp) || value.exp <= 0 || !Number.isFinite(value.exp * 1000)) return null;
    encodeURIComponent(value.sub); encodeURIComponent(value.schoolId);
    return { id: value.sub, schoolId: value.schoolId, role: value.role, expiresAt: value.exp * 1000,
      name: typeof value.name === "string" && value.name.trim() && value.name.length <= 160 ? value.name.trim() : value.sub };
  } catch { return null; }
}
export interface TeacherAuthMetadata {
  demoOnly: boolean; apiNamespace: string; storageAvailable: boolean; teacherToken: string; generation: number;
}
let teacherStorageBlocked = false;
let teacherGeneration = 0;
let teacherFingerprint = "";
let teacherLoginAttempt = 0;
let observedTeacherWindow: Window | undefined;
export function isTeacherAuthStorageKey(key: string | null) {
  return key === null || key === TEACHER_TOKEN_KEY || key === LEGACY_TOKEN_KEY;
}
function observeTeacherCredentials() {
  if (typeof window === "undefined" || !window.addEventListener || observedTeacherWindow === window) return;
  observedTeacherWindow = window;
  window.addEventListener("storage", (event: StorageEvent) => {
    if (!isTeacherAuthStorageKey(event.key)) return;
    // Count observed transitions, even when A -> B -> A ends with the same token.
    if (event.key === null || event.oldValue !== event.newValue) teacherGeneration += 1;
    getTeacherAuthMetadata();
  });
  const refresh = () => { getTeacherAuthMetadata(); };
  window.addEventListener(PLATFORM_AUTH_EVENT, refresh);
  window.addEventListener("focus", refresh);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", refresh);
}
/** Teacher failures are isolated from student storage and high-school selection. */
export function getTeacherAuthMetadata(): TeacherAuthMetadata {
  observeTeacherCredentials();
  let teacherToken = ""; let storageAvailable = false;
  if (!DEMO_ONLY && typeof window !== "undefined") {
    try {
      teacherToken = window.localStorage.getItem(TEACHER_TOKEN_KEY) ?? window.localStorage.getItem(LEGACY_TOKEN_KEY) ?? "";
      storageAvailable = !teacherStorageBlocked;
    } catch { /* inaccessible credentials fail closed */ }
  }
  const namespace = apiNamespace();
  const claims = readTeacherTokenClaims(teacherToken);
  const fingerprint = JSON.stringify([namespace, DEMO_ONLY, storageAvailable, teacherToken, !!claims && claims.expiresAt <= Date.now()]);
  if (fingerprint !== teacherFingerprint) { teacherFingerprint = fingerprint; teacherGeneration += 1; }
  return { demoOnly: DEMO_ONLY, apiNamespace: namespace, storageAvailable, teacherToken, generation: teacherGeneration };
}
function teacherCredentials() {
  const metadata = getTeacherAuthMetadata();
  if (!metadata.storageAvailable) throw new TeacherApiError(401, "AUTH_STORAGE_UNAVAILABLE", "教师登录身份不可用，请检查本机存储并重新登录");
  if (!metadata.teacherToken) throw new TeacherApiError(401, "AUTH_REQUIRED", "请先登录教师账号");
  const claims = readTeacherTokenClaims(metadata.teacherToken);
  if (!claims) throw new TeacherApiError(401, "INVALID_SESSION", "教师登录身份无效，请重新登录");
  if (claims.expiresAt <= Date.now()) throw new TeacherApiError(401, "SESSION_EXPIRED", "教师登录已过期，请重新登录");
  return metadata;
}
function assertTeacherCredentials(captured: TeacherAuthMetadata) {
  const current = getTeacherAuthMetadata();
  if (current.generation !== captured.generation || current.teacherToken !== captured.teacherToken
    || current.apiNamespace !== captured.apiNamespace || current.storageAvailable !== captured.storageAvailable) {
    throw new TeacherApiError(401, "ACCOUNT_CHANGED", "教师登录身份已改变，请在当前身份下重新操作");
  }
}

export type StudentAuthMetadata = Pick<PlatformAuthMetadata, "demoOnly" | "apiNamespace" | "storageAvailable" | "studentToken">;

/** Classroom records always belong to the student channel, independently of
 * the high-school archive selector or a teacher's partially persisted login. */
export function getStudentAuthMetadata(): StudentAuthMetadata {
  const base = { demoOnly: DEMO_ONLY, apiNamespace: apiNamespace(), storageAvailable: false, studentToken: "" };
  if (typeof window === "undefined") return base;
  if (DEMO_ONLY) return base;
  try {
    return { ...base, storageAvailable: true, studentToken: window.localStorage.getItem(STUDENT_TOKEN_KEY) ?? "" };
  } catch { return base; }
}

/** Low-level metadata only. Decoding a token locally never authenticates a user. */
export function getPlatformAuthMetadata(): PlatformAuthMetadata {
  const base = { demoOnly: DEMO_ONLY, apiNamespace: apiNamespace(), storageAvailable: false, studentToken: "", teacherToken: "", selection: null };
  if (typeof window === "undefined") return base;
  try {
    const storage = window.localStorage;
    // Demo builds must not inspect or react to accounts left by a full build.
    if (DEMO_ONLY) { storage.getItem(selectionKey()); return { ...base, storageAvailable: !authWriteFailed }; }
    return { ...base, storageAvailable: !authWriteFailed,
      studentToken: storage.getItem(STUDENT_TOKEN_KEY) ?? "",
      teacherToken: teacherStorageBlocked ? "" : storage.getItem(TEACHER_TOKEN_KEY) ?? storage.getItem(LEGACY_TOKEN_KEY) ?? "",
      selection: storage.getItem(selectionKey()) };
  } catch { return base; }
}

export function isPlatformAuthStorageKey(key: string | null) {
  return key === null || [LEGACY_TOKEN_KEY, TEACHER_TOKEN_KEY, STUDENT_TOKEN_KEY, STUDENT_ID_KEY, selectionKey()].includes(key);
}

function notifyAuthChanged(student = false) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new Event(PLATFORM_AUTH_EVENT));
  if (student) window.dispatchEvent(new Event(STUDENT_AUTH_EVENT));
}

function updateAuthStorage(change: (storage: Storage) => void, student = false) {
  try {
    if (typeof window === "undefined") throw new Error("Storage unavailable");
    change(window.localStorage);
    authWriteFailed = false;
    notifyAuthChanged(student);
    return true;
  } catch {
    authWriteFailed = true;
    notifyAuthChanged(student);
    return false;
  }
}

export function setHighSchoolAuthSelection(selection: HighSchoolAuthSelection) {
  if (!["student", "teacher", "guest"].includes(selection)) return false;
  // A single setItem is atomic: failure leaves the previous identity intact.
  // Unlike a partially persisted login, this must not revoke its record access.
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(selectionKey(), selection);
  } catch { return false; }
  authWriteFailed = false;
  notifyAuthChanged();
  return true;
}

function clearAuthSelection(storage: Storage, channel: PlatformAuthChannel) {
  const selected = storage.getItem(selectionKey());
  // Logging out must not silently activate another account whose token remains.
  if (selected === null || selected === channel) storage.setItem(selectionKey(), "guest");
}

async function request<T>(tokenKey: string, path: string, options: RequestInit = {}, authenticated = true, includeLegacy = false): Promise<T> {
  if (!API_BASE_URL) throw new TeacherApiError(0, "API_NOT_CONFIGURED", DEMO_ONLY ? "演示版使用本地数据" : "线上版本尚未配置后台地址");
  const teacher = authenticated && tokenKey === TEACHER_TOKEN_KEY ? teacherCredentials() : null;
  const accessToken = teacher?.teacherToken ?? storedToken(tokenKey, includeLegacy);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(authenticated && accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers
      }
    });
    if (teacher) assertTeacherCredentials(teacher);
    const payload = await response.json() as ApiEnvelope<T> | { error?: { code?: string; message?: string } };
    if (teacher) assertTeacherCredentials(teacher);
    if (!response.ok) {
      const error = "error" in payload ? payload.error : undefined;
      throw new TeacherApiError(response.status, error?.code ?? "API_ERROR", error?.message ?? "后台请求失败");
    }
    return (payload as ApiEnvelope<T>).data;
  } catch (error) {
    if (teacher) assertTeacherCredentials(teacher);
    throw error;
  }
}

const health = () => request<ApiHealth>(TEACHER_TOKEN_KEY, "/health", {}, false);

export const teacherApi = {
  isConfigured: () => Boolean(API_BASE_URL),
  hasSession: () => { try { return !DEMO_ONLY && !!teacherCredentials(); } catch { return false; } },
  health,
  async login(email: string, password: string) {
    const attempt = ++teacherLoginAttempt;
    const before = getTeacherAuthMetadata();
    let session: AuthSession;
    try {
      session = await request<AuthSession>(TEACHER_TOKEN_KEY, "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
    } catch (error) {
      assertTeacherCredentials(before);
      if (attempt !== teacherLoginAttempt) throw new TeacherApiError(401, "ACCOUNT_CHANGED", "本次登录已失效，请使用当前登录结果");
      throw error;
    }
    assertTeacherCredentials(before);
    if (attempt !== teacherLoginAttempt) throw new TeacherApiError(401, "ACCOUNT_CHANGED", "本次登录已失效，请使用当前登录结果");
    const claims = readTeacherTokenClaims(session.accessToken);
    if (!claims || claims.expiresAt <= Date.now()) throw new TeacherApiError(401, "INVALID_SESSION", "该登录结果不是有效的教师或管理员身份");
    teacherGeneration += 1;
    teacherStorageBlocked = true;
    try {
      if (typeof window === "undefined") throw new Error("Storage unavailable");
      const storage = window.localStorage;
      storage.setItem(TEACHER_TOKEN_KEY, session.accessToken);
      storage.removeItem(LEGACY_TOKEN_KEY);
      storage.setItem(selectionKey(), "teacher");
      teacherStorageBlocked = false; authWriteFailed = false;
    } catch {
      authWriteFailed = true;
      notifyAuthChanged();
      throw new TeacherApiError(0, "AUTH_STORAGE_UNAVAILABLE", "无法保存登录身份，请检查浏览器本机存储后重试");
    }
    notifyAuthChanged();
    return session;
  },
  logout() {
    // Revoke locally before storage access, including empty and failed logouts.
    teacherLoginAttempt += 1; teacherGeneration += 1; teacherStorageBlocked = true;
    try {
      if (typeof window === "undefined") throw new Error("Storage unavailable");
      const storage = window.localStorage;
      storage.removeItem(TEACHER_TOKEN_KEY); storage.removeItem(LEGACY_TOKEN_KEY);
      clearAuthSelection(storage, "teacher");
      teacherStorageBlocked = false; authWriteFailed = false;
    } catch { authWriteFailed = true; }
    notifyAuthChanged();
  },
  me: () => request<PlatformUser>(TEACHER_TOKEN_KEY, "/auth/me", {}, true, true),
  users: (role?: "admin" | "teacher" | "student") => request<PlatformUser[]>(TEACHER_TOKEN_KEY, `/users${role ? `?role=${role}` : ""}`, {}, true, true),
  createAccount: (input: { name: string; email: string; password: string; role: "teacher" | "student" }) => request<PlatformUser>(TEACHER_TOKEN_KEY, "/users", { method: "POST", body: JSON.stringify(input) }, true, true),
  updateAccountStatus: (userId: string, status: "active" | "disabled") => request<PlatformUser>(TEACHER_TOKEN_KEY, `/users/${encodeURIComponent(userId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, true, true),
  resetAccountPassword: (userId: string, password: string) => request<{ userId: string; resetAt: string }>(TEACHER_TOKEN_KEY, `/users/${encodeURIComponent(userId)}/password`, { method: "PATCH", body: JSON.stringify({ password }) }, true, true),
  classes: () => request<TeachingClass[]>(TEACHER_TOKEN_KEY, "/classes", {}, true, true),
  createClass: (input: { name: string; grade: string }) => request<TeachingClassDetail>(TEACHER_TOKEN_KEY, "/classes", { method: "POST", body: JSON.stringify(input) }, true, true),
  classDetail: (classId: string) => request<TeachingClassDetail>(TEACHER_TOKEN_KEY, `/classes/${encodeURIComponent(classId)}`, {}, true, true),
  addClassMember: (classId: string, email: string) => request<PlatformUser>(TEACHER_TOKEN_KEY, `/classes/${encodeURIComponent(classId)}/members`, { method: "POST", body: JSON.stringify({ email }) }, true, true),
  removeClassMember: (classId: string, userId: string) => request<{ classId: string; userId: string; removed: true }>(TEACHER_TOKEN_KEY, `/classes/${encodeURIComponent(classId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }, true, true),
  lessons: () => request<TeachingLesson[]>(TEACHER_TOKEN_KEY, "/lessons", {}, true, true),
  createLesson: (input: Omit<TeachingLesson, "id" | "schoolId" | "createdBy" | "createdAt" | "updatedAt">) => request<TeachingLesson>(TEACHER_TOKEN_KEY, "/lessons", { method: "POST", body: JSON.stringify(input) }, true, true),
  tasks: (classId?: string) => request<TeachingTask[]>(TEACHER_TOKEN_KEY, `/tasks${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`, {}, true, true),
  taskRecords: (taskId: string) => request<SessionLearningRecord[]>(TEACHER_TOKEN_KEY, `/tasks/${encodeURIComponent(taskId)}/records`, {}, true, true),
  feedback: (sessionId: string) => request<LearningFeedback[]>(TEACHER_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/feedback`, {}, true, true),
  createFeedback: (sessionId: string, input: CreateLearningFeedbackRequest) => request<LearningFeedback>(TEACHER_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/feedback`, { method: "POST", body: JSON.stringify(input) }, true, true),
  createTask: (input: { classId: string; lessonId: string; title: string; mode: TeachingTaskMode; status: "draft" | "published"; opensAt?: string | null; dueAt?: string | null; allowRetry: boolean }) => request<TeachingTask>(TEACHER_TOKEN_KEY, "/tasks", { method: "POST", body: JSON.stringify(input) }, true, true),
  updateTaskStatus: (taskId: string, status: TeachingTaskStatus) => request<TeachingTask>(TEACHER_TOKEN_KEY, `/tasks/${encodeURIComponent(taskId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, true, true),
  askGuangguang: (input: GuangguangChatRequest) => request<GuangguangChatReply>(TEACHER_TOKEN_KEY, "/guangguang/chat", { method: "POST", body: JSON.stringify(input) }, true, true)
};

// Legacy unscoped classroom pointers and queues remain available for backup;
// login/logout changes credentials, while v3 consumers enforce the new scope.
export const studentApi = {
  isConfigured: () => Boolean(API_BASE_URL),
  hasSession: () => !DEMO_ONLY && Boolean(storedToken(STUDENT_TOKEN_KEY)),
  currentUserId: () => !DEMO_ONLY && storedToken(STUDENT_TOKEN_KEY) ? storedToken(STUDENT_ID_KEY) : "",
  health,
  askLili: (input: LiliChatRequest, signal?: AbortSignal) => request<LiliChatReply>(STUDENT_TOKEN_KEY, "/lili/chat", { method: "POST", body: JSON.stringify(input), signal }),
  async login(email: string, password: string) {
    const session = await request<AuthSession>(STUDENT_TOKEN_KEY, "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
    if (!updateAuthStorage((storage) => {
      storage.setItem(STUDENT_TOKEN_KEY, session.accessToken);
      storage.setItem(STUDENT_ID_KEY, session.user.id);
      storage.setItem(selectionKey(), "student");
    }, true)) throw new TeacherApiError(0, "AUTH_STORAGE_UNAVAILABLE", "无法保存登录身份，请检查浏览器本机存储后重试");
    return session;
  },
  logout() {
    updateAuthStorage((storage) => {
      storage.removeItem(STUDENT_TOKEN_KEY);
      storage.removeItem(STUDENT_ID_KEY);
      clearAuthSelection(storage, "student");
    }, true);
  },
  async me() {
    const token = storedToken(STUDENT_TOKEN_KEY);
    const user = await request<PlatformUser>(STUDENT_TOKEN_KEY, "/auth/me");
    if (storedToken(STUDENT_TOKEN_KEY) !== token) throw new TeacherApiError(401, "ACCOUNT_CHANGED", "登录身份已改变，请重新打开记录");
    window.localStorage.setItem(STUDENT_ID_KEY, user.id);
    return user;
  },
  classes: () => request<TeachingClass[]>(STUDENT_TOKEN_KEY, "/classes"),
  tasks: () => request<TeachingTask[]>(STUDENT_TOKEN_KEY, "/tasks"),
  taskLesson: (taskId: string) => request<StudentTaskLessonContext>(STUDENT_TOKEN_KEY, `/tasks/${encodeURIComponent(taskId)}/lesson-context`),
  sessions: () => request<StudentExperimentSession[]>(STUDENT_TOKEN_KEY, "/sessions"),
  learningRecord: (sessionId: string) => request<SessionLearningRecord>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/record`),
  feedback: (sessionId: string) => request<LearningFeedback[]>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/feedback`),
  saveLearningRecord: (sessionId: string, input: SaveLearningRecordRequest) => request<SessionLearningRecord>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/record`, { method: "PUT", body: JSON.stringify(input) }),
  startSession: (taskId: string) => request<ExperimentSession>(STUDENT_TOKEN_KEY, "/sessions", { method: "POST", body: JSON.stringify({ taskId }) }),
  appendSessionEvents: (sessionId: string, events: Array<{ id: string; type: string; area: string; occurredAt: string; payload: Record<string, unknown> }>) => request<{ accepted: number }>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/events`, { method: "POST", body: JSON.stringify({ events }) }),
  addObservation: (sessionId: string, text: string) => request<{ id: string; sessionId: string; learnerId: string; text: string; createdAt: string }>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/observations`, { method: "POST", body: JSON.stringify({ text }) }),
  completeSession: (sessionId: string) => request<ExperimentSession>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/complete`, { method: "PATCH" }),
  askGuangguang: (input: GuangguangChatRequest, signal?: AbortSignal) => request<GuangguangChatReply>(STUDENT_TOKEN_KEY, "/guangguang/chat", { method: "POST", body: JSON.stringify(input), signal })
};
