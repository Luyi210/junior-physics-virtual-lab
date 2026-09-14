import { createServer } from "node:http";
import { verifyAccessToken, verifyPassword, signAccessToken } from "./security.js";
import { ApiError, optionalString, readJson, requestId, requiredEnum, requiredNumber, requiredString, sendJson } from "./http.js";
import {
  addClassMember, addClassPrompt, addObservation, appendEvents, completeSession, createClass, createLesson, createSession, createTask,
  createManagedAccount, findUser, findUserForLogin, getClass, getClassReport, getLiveClass, listClasses, listLessons, listTasks, listUsers,
  getStudentTaskLesson, listStudentSessions, recordUserLogin, removeClassMember, resetManagedAccountPassword, updateManagedAccountStatus, updateTaskStatus
} from "./repositories.js";

const loginAttempts = new Map();
export const API_COMPATIBILITY = "desktop-managed-accounts-v1";

function corsHeaders(request, config) {
  const origin = request.headers.origin;
  const allowedOrigin = typeof origin === "string" && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, content-type, x-request-id",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
    "x-content-type-options": "nosniff",
    "cache-control": "no-store"
  };
}

async function authenticate(request, db, config) {
  const header = request.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyAccessToken(token, config);
  if (!payload) throw new ApiError(401, "AUTH_REQUIRED", "需要有效的登录令牌");
  const user = await findUser(db, payload.sub);
  if (!user || user.schoolId !== payload.schoolId || user.role !== payload.role || user.status !== "active") throw new ApiError(401, "AUTH_INVALID", "登录身份已经失效");
  return user;
}

function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) throw new ApiError(403, "ROLE_FORBIDDEN", "当前身份没有执行此操作的权限");
}

function match(pathname, pattern) {
  const names = [];
  const expression = pattern.replace(/:([a-zA-Z]+)/g, (_, name) => { names.push(name); return "([^/]+)"; });
  const result = pathname.match(new RegExp(`^${expression}$`));
  if (!result) return null;
  return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(result[index + 1])]));
}

function throttleLogin(request) {
  const address = request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const record = loginAttempts.get(address) ?? { count: 0, resetAt: now + 60_000 };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + 60_000; }
  record.count += 1;
  loginAttempts.set(address, record);
  if (record.count > 12) throw new ApiError(429, "LOGIN_RATE_LIMIT", "登录尝试过于频繁，请稍后再试");
}

function validateEvents(body) {
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 500) throw new ApiError(422, "VALIDATION_ERROR", "events 必须包含 1 到 500 条事件");
  return body.events.map((event) => ({
    id: typeof event.id === "string" ? event.id : undefined,
    type: requiredString(event, "type", { max: 80 }),
    area: requiredString(event, "area", { max: 40 }),
    occurredAt: requiredString(event, "occurredAt", { max: 40 }),
    payload: event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {}
  }));
}

export function createApiHandler({ db, config, guangguang }) {
  return async function handle(request, response) {
    const id = requestId(request);
    const headers = corsHeaders(request, config);
    try {
      if (request.method === "OPTIONS") return sendJson(response, 204, null, id, headers);
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
      const path = url.pathname.replace(/\/$/, "") || "/";

      if (request.method === "GET" && path === "/api/health") {
        const guangguangStatus = guangguang?.status?.() ?? { enabled: false, provider: "rules", model: "local" };
        const capabilities = ["managed-teacher-accounts", "managed-student-accounts", "class-membership", "teaching-tasks", "experiment-evidence"];
        if (guangguangStatus.enabled) capabilities.push("deepseek-harness-guangguang");
        return sendJson(response, 200, { status: "ok", service: "physics-lab-api", version: "0.1.0", compatibility: API_COMPATIBILITY, capabilities, database: db.dialect, guangguang: guangguangStatus, time: new Date().toISOString() }, id, headers);
      }

      if (request.method === "POST" && path === "/api/auth/login") {
        throttleLogin(request);
        const body = await readJson(request, config.bodyLimitBytes);
        const email = requiredString(body, "email", { max: 180 });
        const password = requiredString(body, "password", { max: 200 });
        const row = await findUserForLogin(db, email);
        if (!row || !verifyPassword(password, row.password_hash)) throw new ApiError(401, "LOGIN_FAILED", "邮箱或密码不正确");
        if (row.status === "disabled") throw new ApiError(403, "ACCOUNT_DISABLED", "这个账号已停用，请联系学校管理员");
        const user = await recordUserLogin(db, row.id);
        return sendJson(response, 200, { accessToken: signAccessToken(user, config), expiresIn: config.tokenTtlSeconds, user }, id, headers);
      }

      const user = await authenticate(request, db, config);

      if (request.method === "GET" && path === "/api/auth/me") return sendJson(response, 200, user, id, headers);

      if (request.method === "POST" && path === "/api/guangguang/chat") {
        const body = await readJson(request, config.bodyLimitBytes);
        const context = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {};
        const audience = user.role === "student" ? "student" : "teacher";
        if (!guangguang?.ask) throw new ApiError(503, "GUANGGUANG_AI_DISABLED", "光光的 DeepSeek 增强模式尚未启用");
        const result = await guangguang.ask({
          user,
          audience,
          conversationId: requiredString(body, "conversationId", { max: 160 }),
          question: requiredString(body, "question", { max: 1600 }),
          context
        });
        return sendJson(response, 200, result, id, headers);
      }

      if (request.method === "GET" && path === "/api/users") {
        requireRole(user, "teacher", "admin");
        const role = url.searchParams.get("role");
        if (role && !["admin", "teacher", "student"].includes(role)) throw new ApiError(422, "VALIDATION_ERROR", "role 参数无效");
        if (user.role === "teacher" && role && role !== "student") throw new ApiError(403, "ROLE_FORBIDDEN", "教师只能查看学生账号");
        return sendJson(response, 200, await listUsers(db, user, user.role === "teacher" ? "student" : role), id, headers);
      }
      if (request.method === "POST" && path === "/api/users") {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        const email = requiredString(body, "email", { max: 180 });
        const password = requiredString(body, "password", { max: 200 });
        const role = body.role ? requiredEnum(body, "role", ["teacher", "student"]) : "student";
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(422, "VALIDATION_ERROR", "email 格式不正确");
        if (password.length < 8) throw new ApiError(422, "VALIDATION_ERROR", "临时密码至少需要 8 个字符");
        return sendJson(response, 201, await createManagedAccount(db, user, { email, password, name: requiredString(body, "name", { max: 80 }), role }), id, headers);
      }

      let params = match(path, "/api/users/:userId/status");
      if (request.method === "PATCH" && params) {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 200, await updateManagedAccountStatus(db, user, params.userId, requiredEnum(body, "status", ["active", "disabled"])), id, headers);
      }

      params = match(path, "/api/users/:userId/password");
      if (request.method === "PATCH" && params) {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        const password = requiredString(body, "password", { max: 200 });
        if (password.length < 8) throw new ApiError(422, "VALIDATION_ERROR", "新密码至少需要 8 个字符");
        return sendJson(response, 200, await resetManagedAccountPassword(db, user, params.userId, password), id, headers);
      }

      if (request.method === "GET" && path === "/api/classes") return sendJson(response, 200, await listClasses(db, user), id, headers);
      if (request.method === "POST" && path === "/api/classes") {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await createClass(db, user, { name: requiredString(body, "name", { max: 80 }), grade: requiredString(body, "grade", { max: 30 }) }), id, headers);
      }

      params = match(path, "/api/classes/:classId");
      if (request.method === "GET" && params) {
        requireRole(user, "teacher", "admin");
        return sendJson(response, 200, await getClass(db, params.classId, user.schoolId), id, headers);
      }

      params = match(path, "/api/classes/:classId/members");
      if (request.method === "POST" && params) {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await addClassMember(db, params.classId, user.schoolId, requiredString(body, "email", { max: 180 })), id, headers);
      }

      params = match(path, "/api/classes/:classId/members/:userId");
      if (request.method === "DELETE" && params) {
        requireRole(user, "teacher", "admin");
        return sendJson(response, 200, await removeClassMember(db, params.classId, user.schoolId, params.userId), id, headers);
      }

      params = match(path, "/api/classes/:classId/live");
      if (request.method === "GET" && params) {
        requireRole(user, "teacher", "admin");
        return sendJson(response, 200, await getLiveClass(db, user, params.classId), id, headers);
      }

      params = match(path, "/api/classes/:classId/prompts");
      if (request.method === "POST" && params) {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await addClassPrompt(db, user, params.classId, requiredString(body, "text", { max: 600 })), id, headers);
      }

      params = match(path, "/api/classes/:classId/report");
      if (request.method === "GET" && params) {
        requireRole(user, "teacher", "admin");
        return sendJson(response, 200, await getClassReport(db, user, params.classId), id, headers);
      }

      if (request.method === "GET" && path === "/api/lessons") {
        requireRole(user, "teacher", "admin");
        return sendJson(response, 200, await listLessons(db, user), id, headers);
      }
      if (request.method === "POST" && path === "/api/lessons") {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await createLesson(db, user, {
          experimentId: requiredString(body, "experimentId", { max: 60 }), title: requiredString(body, "title", { max: 160 }), objective: requiredString(body, "objective", { max: 1000 }),
          inquiryQuestion: requiredString(body, "inquiryQuestion", { max: 1000 }), predictionPrompt: optionalString(body, "predictionPrompt", { max: 1000 }), controlledVariable: optionalString(body, "controlledVariable", { max: 1000 }),
          evidenceRequirement: optionalString(body, "evidenceRequirement", { max: 1000 }), reflectionPrompt: optionalString(body, "reflectionPrompt", { max: 1000 }), durationMinutes: requiredNumber(body, "durationMinutes", { min: 5, max: 180 }),
          status: body.status ? requiredEnum(body, "status", ["draft", "ready"]) : "draft"
        }), id, headers);
      }

      if (request.method === "GET" && path === "/api/tasks") return sendJson(response, 200, await listTasks(db, user, url.searchParams.get("classId")), id, headers);
      if (request.method === "POST" && path === "/api/tasks") {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await createTask(db, user, {
          classId: requiredString(body, "classId"), lessonId: requiredString(body, "lessonId"), title: requiredString(body, "title", { max: 160 }), mode: requiredEnum(body, "mode", ["before-class", "in-class", "after-class"]),
          status: body.status ? requiredEnum(body, "status", ["draft", "published"]) : "draft", opensAt: optionalString(body, "opensAt", { max: 40 }), dueAt: optionalString(body, "dueAt", { max: 40 }), allowRetry: body.allowRetry !== false
        }), id, headers);
      }

      params = match(path, "/api/tasks/:taskId/status");
      if (request.method === "PATCH" && params) {
        requireRole(user, "teacher", "admin");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 200, await updateTaskStatus(db, user, params.taskId, requiredEnum(body, "status", ["draft", "published", "closed", "archived"])), id, headers);
      }

      params = match(path, "/api/tasks/:taskId/lesson-context");
      if (request.method === "GET" && params) {
        requireRole(user, "student");
        return sendJson(response, 200, await getStudentTaskLesson(db, user, params.taskId), id, headers);
      }

      if (request.method === "POST" && path === "/api/sessions") {
        requireRole(user, "student");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await createSession(db, user, { taskId: requiredString(body, "taskId") }), id, headers);
      }

      if (request.method === "GET" && path === "/api/sessions") {
        requireRole(user, "student");
        return sendJson(response, 200, await listStudentSessions(db, user), id, headers);
      }

      params = match(path, "/api/sessions/:sessionId/events");
      if (request.method === "POST" && params) {
        requireRole(user, "student");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 202, await appendEvents(db, user, params.sessionId, validateEvents(body)), id, headers);
      }

      params = match(path, "/api/sessions/:sessionId/observations");
      if (request.method === "POST" && params) {
        requireRole(user, "student");
        const body = await readJson(request, config.bodyLimitBytes);
        return sendJson(response, 201, await addObservation(db, user, params.sessionId, requiredString(body, "text", { max: 2000 })), id, headers);
      }

      params = match(path, "/api/sessions/:sessionId/complete");
      if (request.method === "PATCH" && params) {
        requireRole(user, "student");
        return sendJson(response, 200, await completeSession(db, user, params.sessionId), id, headers);
      }

      throw new ApiError(404, "ROUTE_NOT_FOUND", "接口不存在");
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError(500, "INTERNAL_ERROR", "服务器处理请求时发生错误");
      if (apiError.status >= 500) console.error(`[${id}]`, error);
      return sendJson(response, apiError.status, { error: { code: apiError.code, message: apiError.message, details: apiError.details }, requestId: id }, id, headers);
    }
  };
}

export function createApiServer(options) {
  return createServer(createApiHandler(options));
}
