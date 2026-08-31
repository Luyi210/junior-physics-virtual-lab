import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Readable } from "node:stream";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/database.js";
import { createApiHandler } from "../src/app.js";

let db;
let handler;

before(async () => {
  const config = loadConfig({ databasePath: ":memory:", tokenSecret: "test-secret", allowedOrigins: ["http://127.0.0.1:5173"] });
  db = openDatabase(config);
  handler = createApiHandler({ db, config });
});

after(() => {
  db.close();
});

async function request(path, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : "";
  const requestStream = Readable.from(body ? [Buffer.from(body)] : []);
  requestStream.method = options.method ?? "GET";
  requestStream.url = `/api${path}`;
  requestStream.headers = { host: "127.0.0.1", "content-type": "application/json", ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...options.headers };
  requestStream.socket = { remoteAddress: options.remoteAddress ?? "test-client" };
  const result = { status: 0, headers: {}, body: "" };
  const response = {
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(value = "") { result.body += value ? String(value) : ""; }
  };
  await handler(requestStream, response);
  const payload = result.body ? JSON.parse(result.body) : null;
  return { response: { status: result.status, headers: result.headers }, payload };
}

async function login(email, password) {
  const { response, payload } = await request("/auth/login", { method: "POST", body: { email, password }, remoteAddress: `test-${email}` });
  assert.equal(response.status, 200);
  return payload.data.accessToken;
}

test("health endpoint exposes service state", async () => {
  const { response, payload } = await request("/health");
  assert.equal(response.status, 200);
  assert.equal(payload.data.status, "ok");
  assert.equal(payload.data.database, "sqlite");
  assert.equal(payload.data.compatibility, "desktop-managed-accounts-v1");
  assert.ok(payload.data.capabilities.includes("managed-teacher-accounts"));
});

test("protected endpoints require a valid token", async () => {
  const { response, payload } = await request("/classes");
  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "AUTH_REQUIRED");
});

test("teacher can manage classes, lessons and teaching tasks", async () => {
  const token = await login("teacher@physics.local", "Teacher123!");
  const me = await request("/auth/me", { token });
  assert.equal(me.payload.data.role, "teacher");
  const students = await request("/users?role=student", { token });
  assert.equal(students.payload.data.length, 10);
  assert.equal(students.payload.data[9].role, "student");

  const createdStudent = await request("/users", { method: "POST", token, body: {
    name: "测试新生", email: "new-student@physics.local", password: "NewStudent123!"
  } });
  assert.equal(createdStudent.response.status, 201);
  assert.equal(createdStudent.payload.data.role, "student");
  assert.equal(createdStudent.payload.data.email, "new-student@physics.local");

  const addedMember = await request("/classes/class-801/members", { method: "POST", token, body: { email: "new-student@physics.local" } });
  assert.equal(addedMember.response.status, 201);
  const classDetail = await request("/classes/class-801", { token });
  assert.equal(classDetail.payload.data.members.length, 11);

  const disabled = await request(`/users/${createdStudent.payload.data.id}/status`, { method: "PATCH", token, body: { status: "disabled" } });
  assert.equal(disabled.payload.data.status, "disabled");
  const disabledLogin = await request("/auth/login", { method: "POST", body: { email: "new-student@physics.local", password: "NewStudent123!" } });
  assert.equal(disabledLogin.response.status, 403);
  assert.equal(disabledLogin.payload.error.code, "ACCOUNT_DISABLED");

  await request(`/users/${createdStudent.payload.data.id}/status`, { method: "PATCH", token, body: { status: "active" } });
  const reset = await request(`/users/${createdStudent.payload.data.id}/password`, { method: "PATCH", token, body: { password: "ResetStudent123!" } });
  assert.equal(reset.response.status, 200);
  const resetLogin = await request("/auth/login", { method: "POST", body: { email: "new-student@physics.local", password: "ResetStudent123!" } });
  assert.equal(resetLogin.response.status, 200);

  const removedMember = await request(`/classes/class-801/members/${createdStudent.payload.data.id}`, { method: "DELETE", token });
  assert.equal(removedMember.payload.data.removed, true);

  const classResult = await request("/classes", { method: "POST", token, body: { name: "九年级（2）班", grade: "九年级" } });
  assert.equal(classResult.response.status, 201);
  assert.match(classResult.payload.data.joinCode, /^PHY/);

  const lessonResult = await request("/lessons", { method: "POST", token, body: {
    experimentId: "circuit", title: "欧姆定律证据课", objective: "通过多组电压电流数据形成解释。", inquiryQuestion: "电阻不变时电流怎样随电压变化？",
    predictionPrompt: "先画出预测曲线。", controlledVariable: "保持电阻不变。", evidenceRequirement: "记录三组读数。", reflectionPrompt: "更换电阻后关系是否相同？", durationMinutes: 40, status: "ready"
  } });
  assert.equal(lessonResult.response.status, 201);

  const taskResult = await request("/tasks", { method: "POST", token, body: { classId: classResult.payload.data.id, lessonId: lessonResult.payload.data.id, title: "欧姆定律课前探究", mode: "before-class", status: "published", allowRetry: true } });
  assert.equal(taskResult.response.status, 201);
  assert.equal(taskResult.payload.data.status, "published");

  const closeResult = await request(`/tasks/${taskResult.payload.data.id}/status`, { method: "PATCH", token, body: { status: "closed" } });
  assert.equal(closeResult.payload.data.status, "closed");
});

test("admin can create and manage teacher accounts while teachers cannot", async () => {
  const adminToken = await login("admin@physics.local", "Admin123!");
  const teacherToken = await login("teacher@physics.local", "Teacher123!");

  const forbidden = await request("/users", { method: "POST", token: teacherToken, body: {
    name: "越权教师", email: "forbidden-teacher@physics.local", password: "Teacher123!", role: "teacher"
  } });
  assert.equal(forbidden.response.status, 403);
  assert.equal(forbidden.payload.error.code, "TEACHER_CREATE_FORBIDDEN");

  const created = await request("/users", { method: "POST", token: adminToken, body: {
    name: "王老师", email: "teacher02@physics.local", password: "Teacher456!", role: "teacher"
  } });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.data.role, "teacher");

  const teachers = await request("/users?role=teacher", { token: adminToken });
  assert.ok(teachers.payload.data.some((account) => account.email === "teacher02@physics.local"));

  const disabled = await request(`/users/${created.payload.data.id}/status`, { method: "PATCH", token: adminToken, body: { status: "disabled" } });
  assert.equal(disabled.payload.data.status, "disabled");
  const disabledLogin = await request("/auth/login", { method: "POST", body: { email: "teacher02@physics.local", password: "Teacher456!" } });
  assert.equal(disabledLogin.response.status, 403);

  await request(`/users/${created.payload.data.id}/status`, { method: "PATCH", token: adminToken, body: { status: "active" } });
  const reset = await request(`/users/${created.payload.data.id}/password`, { method: "PATCH", token: adminToken, body: { password: "Teacher789!" } });
  assert.equal(reset.response.status, 200);
});

test("student session events become teacher live evidence and reports", async () => {
  const studentToken = await login("student01@physics.local", "Student123!");
  const teacherToken = await login("teacher@physics.local", "Teacher123!");

  const tasks = await request("/tasks?classId=class-801", { token: studentToken });
  assert.ok(tasks.payload.data.length >= 10);
  const reflectionTask = tasks.payload.data.find((task) => task.id === "task-reflection");
  assert.ok(reflectionTask);
  assert.ok(["light", "reflection"].includes(reflectionTask.experimentId));
  const lessonContext = await request("/tasks/task-reflection/lesson-context", { token: studentToken });
  assert.equal(lessonContext.response.status, 200);
  assert.match(lessonContext.payload.data.inquiryQuestion, /反射光线/);

  const sessionResult = await request("/sessions", { method: "POST", token: studentToken, body: { taskId: "task-reflection" } });
  assert.equal(sessionResult.response.status, 201);
  const sessionId = sessionResult.payload.data.id;

  const eventsResult = await request(`/sessions/${sessionId}/events`, { method: "POST", token: studentToken, body: { events: [
    { id: "event-1", type: "control.changed", area: "optics", occurredAt: new Date().toISOString(), payload: { control: "入射角", value: 30, unit: "°" } },
    { id: "event-2", type: "observation.created", area: "optics", occurredAt: new Date().toISOString(), payload: { module: "reflection" } }
  ] } });
  assert.equal(eventsResult.response.status, 202);
  assert.equal(eventsResult.payload.data.accepted, 2);

  const observationResult = await request(`/sessions/${sessionId}/observations`, { method: "POST", token: studentToken, body: { text: "入射角为 30° 时，反射角也接近 30°。" } });
  assert.equal(observationResult.response.status, 201);

  const live = await request("/classes/class-801/live", { token: teacherToken });
  assert.equal(live.payload.data.sessions.length, 1);
  assert.equal(live.payload.data.sessions[0].eventCount, 2);
  assert.equal(live.payload.data.sessions[0].observationCount, 1);

  const prompt = await request("/classes/class-801/prompts", { method: "POST", token: teacherToken, body: { text: "再选择一组入射角进行比较。" } });
  assert.equal(prompt.response.status, 201);

  const complete = await request(`/sessions/${sessionId}/complete`, { method: "PATCH", token: studentToken });
  assert.equal(complete.payload.data.status, "completed");

  const studentArchive = await request("/sessions", { token: studentToken });
  assert.equal(studentArchive.response.status, 200);
  assert.equal(studentArchive.payload.data[0].taskTitle, "光的反射课堂探究");
  assert.equal(studentArchive.payload.data[0].className, "八年级（1）班");
  assert.equal(studentArchive.payload.data[0].eventCount, 2);
  assert.equal(studentArchive.payload.data[0].observationCount, 1);

  const lateObservation = await request(`/sessions/${sessionId}/observations`, { method: "POST", token: studentToken, body: { text: "会话完成后不能补写。" } });
  assert.equal(lateObservation.response.status, 409);
  assert.equal(lateObservation.payload.error.code, "SESSION_COMPLETED");

  const report = await request("/classes/class-801/report", { token: teacherToken });
  assert.equal(report.payload.data.metrics.sessions, 1);
  assert.equal(report.payload.data.metrics.events, 2);
  assert.equal(report.payload.data.metrics.observations, 1);
  assert.match(report.payload.data.boundary, /不自动生成学生能力排名/);
});

test("student cannot access teacher-only class report", async () => {
  const token = await login("student10@physics.local", "Student123!");
  const { response, payload } = await request("/classes/class-801/report", { token });
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "ROLE_FORBIDDEN");
});

test("student cannot start a published task before its opening time", async () => {
  const teacherToken = await login("teacher@physics.local", "Teacher123!");
  const studentToken = await login("student02@physics.local", "Student123!");
  const futureTask = await request("/tasks", { method: "POST", token: teacherToken, body: {
    classId: "class-801", lessonId: "lesson-reflection", title: "未来开放的反射探究", mode: "before-class", status: "published", opensAt: "2099-01-01T08:00:00.000Z", allowRetry: true
  } });
  assert.equal(futureTask.response.status, 201);
  const start = await request("/sessions", { method: "POST", token: studentToken, body: { taskId: futureTask.payload.data.id } });
  assert.equal(start.response.status, 403);
  assert.equal(start.payload.error.code, "TASK_NOT_OPEN");
});

test("student cannot repeat a completed task when retry is disabled", async () => {
  const teacherToken = await login("teacher@physics.local", "Teacher123!");
  const studentToken = await login("student03@physics.local", "Student123!");
  const task = await request("/tasks", { method: "POST", token: teacherToken, body: {
    classId: "class-801", lessonId: "lesson-reflection", title: "单次反射证据任务", mode: "in-class", status: "published", allowRetry: false
  } });
  const first = await request("/sessions", { method: "POST", token: studentToken, body: { taskId: task.payload.data.id } });
  assert.equal(first.response.status, 201);
  await request(`/sessions/${first.payload.data.id}/complete`, { method: "PATCH", token: studentToken });
  const retry = await request("/sessions", { method: "POST", token: studentToken, body: { taskId: task.payload.data.id } });
  assert.equal(retry.response.status, 409);
  assert.equal(retry.payload.error.code, "TASK_ALREADY_COMPLETED");
});
