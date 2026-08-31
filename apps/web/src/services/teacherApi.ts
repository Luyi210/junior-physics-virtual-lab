import type {
  ApiEnvelope,
  ApiHealth,
  AuthSession,
  ExperimentSession,
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

const LEGACY_TOKEN_KEY = "physics-lab-v2-api-access-token";
const TEACHER_TOKEN_KEY = "physics-lab-v2-api-teacher-token";
const STUDENT_TOKEN_KEY = "physics-lab-v2-api-student-token";
const configuredBaseUrl = import.meta.env.VITE_API_URL as string | undefined;
const localProductionBaseUrl = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname) ? "/api" : "";
const API_BASE_URL = configuredBaseUrl?.replace(/\/$/, "") ?? (import.meta.env.DEV ? "http://127.0.0.1:8787/api" : localProductionBaseUrl);

export class TeacherApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const PlatformApiError = TeacherApiError;

function storedToken(key: string, includeLegacy = false) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) ?? (includeLegacy ? window.localStorage.getItem(LEGACY_TOKEN_KEY) ?? "" : "");
}

async function request<T>(tokenKey: string, path: string, options: RequestInit = {}, authenticated = true, includeLegacy = false): Promise<T> {
  if (!API_BASE_URL) throw new TeacherApiError(0, "API_NOT_CONFIGURED", "线上版本尚未配置后台地址");
  const accessToken = storedToken(tokenKey, includeLegacy);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(authenticated && accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers
    }
  });
  const payload = await response.json() as ApiEnvelope<T> | { error?: { code?: string; message?: string } };
  if (!response.ok) {
    const error = "error" in payload ? payload.error : undefined;
    throw new TeacherApiError(response.status, error?.code ?? "API_ERROR", error?.message ?? "后台请求失败");
  }
  return (payload as ApiEnvelope<T>).data;
}

const health = () => request<ApiHealth>(TEACHER_TOKEN_KEY, "/health", {}, false);

export const teacherApi = {
  isConfigured: () => Boolean(API_BASE_URL),
  hasSession: () => Boolean(storedToken(TEACHER_TOKEN_KEY, true)),
  health,
  async login(email: string, password: string) {
    const session = await request<AuthSession>(TEACHER_TOKEN_KEY, "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
    window.localStorage.setItem(TEACHER_TOKEN_KEY, session.accessToken);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    return session;
  },
  logout() {
    window.localStorage.removeItem(TEACHER_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
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
  createTask: (input: { classId: string; lessonId: string; title: string; mode: TeachingTaskMode; status: "draft" | "published"; opensAt?: string | null; dueAt?: string | null; allowRetry: boolean }) => request<TeachingTask>(TEACHER_TOKEN_KEY, "/tasks", { method: "POST", body: JSON.stringify(input) }, true, true),
  updateTaskStatus: (taskId: string, status: TeachingTaskStatus) => request<TeachingTask>(TEACHER_TOKEN_KEY, `/tasks/${encodeURIComponent(taskId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, true, true)
};

export const studentApi = {
  isConfigured: () => Boolean(API_BASE_URL),
  hasSession: () => Boolean(storedToken(STUDENT_TOKEN_KEY)),
  health,
  async login(email: string, password: string) {
    const session = await request<AuthSession>(STUDENT_TOKEN_KEY, "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
    window.localStorage.setItem(STUDENT_TOKEN_KEY, session.accessToken);
    return session;
  },
  logout() { window.localStorage.removeItem(STUDENT_TOKEN_KEY); },
  me: () => request<PlatformUser>(STUDENT_TOKEN_KEY, "/auth/me"),
  classes: () => request<TeachingClass[]>(STUDENT_TOKEN_KEY, "/classes"),
  tasks: () => request<TeachingTask[]>(STUDENT_TOKEN_KEY, "/tasks"),
  taskLesson: (taskId: string) => request<StudentTaskLessonContext>(STUDENT_TOKEN_KEY, `/tasks/${encodeURIComponent(taskId)}/lesson-context`),
  sessions: () => request<StudentExperimentSession[]>(STUDENT_TOKEN_KEY, "/sessions"),
  startSession: (taskId: string) => request<ExperimentSession>(STUDENT_TOKEN_KEY, "/sessions", { method: "POST", body: JSON.stringify({ taskId }) }),
  appendSessionEvents: (sessionId: string, events: Array<{ id: string; type: string; area: string; occurredAt: string; payload: Record<string, unknown> }>) => request<{ accepted: number }>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/events`, { method: "POST", body: JSON.stringify({ events }) }),
  addObservation: (sessionId: string, text: string) => request<{ id: string; sessionId: string; learnerId: string; text: string; createdAt: string }>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/observations`, { method: "POST", body: JSON.stringify({ text }) }),
  completeSession: (sessionId: string) => request<ExperimentSession>(STUDENT_TOKEN_KEY, `/sessions/${encodeURIComponent(sessionId)}/complete`, { method: "PATCH" })
};
