import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Readable } from "node:stream";
import { newDb } from "pg-mem";
import { createApiHandler } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openPostgresDatabase } from "../src/database-postgres.js";

let database;
let handler;

before(async () => {
  const memoryPostgres = newDb();
  const { Pool } = memoryPostgres.adapters.createPg();
  database = await openPostgresDatabase(loadConfig({
    databaseUrl: "postgresql://memory/test",
    tokenSecret: "postgres-test-secret",
    allowedOrigins: ["https://example.onrender.com"],
    seedDemoData: false,
    bootstrapSchoolName: "格物测试学校",
    bootstrapAdminName: "测试管理员",
    bootstrapAdminEmail: "admin@example.com",
    bootstrapAdminPassword: "PostgresTest123!"
  }), { pool: new Pool() });
  handler = createApiHandler({ db: database, config: loadConfig({ tokenSecret: "postgres-test-secret", allowedOrigins: ["https://example.onrender.com"] }) });
});

after(async () => {
  await database.close();
});

async function request(path, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : "";
  const requestStream = Readable.from(body ? [Buffer.from(body)] : []);
  requestStream.method = options.method ?? "GET";
  requestStream.url = `/api${path}`;
  requestStream.headers = { host: "example.onrender.com", "content-type": "application/json", ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) };
  requestStream.socket = { remoteAddress: options.remoteAddress ?? `postgres-${Math.random()}` };
  const result = { status: 0, headers: {}, body: "" };
  const response = {
    writeHead(status, headers) { result.status = status; result.headers = headers; },
    end(value = "") { result.body += value ? String(value) : ""; }
  };
  await handler(requestStream, response);
  return { status: result.status, payload: result.body ? JSON.parse(result.body) : null };
}

async function login(email, password) {
  const result = await request("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.status, 200);
  return result.payload.data.accessToken;
}

test("PostgreSQL mode persists the managed classroom workflow", async () => {
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.payload.data.database, "postgresql");

  const adminToken = await login("admin@example.com", "PostgresTest123!");
  const student = await request("/users", { method: "POST", token: adminToken, body: { name: "测试学生", email: "student@example.com", password: "StudentTest123!", role: "student" } });
  assert.equal(student.status, 201);

  const classResult = await request("/classes", { method: "POST", token: adminToken, body: { name: "八年级测试班", grade: "八年级" } });
  assert.equal(classResult.status, 201);
  const classId = classResult.payload.data.id;
  assert.equal((await request(`/classes/${classId}/members`, { method: "POST", token: adminToken, body: { email: "student@example.com" } })).status, 201);

  const lesson = await request("/lessons", { method: "POST", token: adminToken, body: {
    experimentId: "reflection", title: "反射规律", objective: "研究入射角与反射角", inquiryQuestion: "两个角有什么关系？", durationMinutes: 40, status: "ready"
  } });
  assert.equal(lesson.status, 201);
  const task = await request("/tasks", { method: "POST", token: adminToken, body: {
    classId, lessonId: lesson.payload.data.id, title: "反射实验任务", mode: "in-class", status: "published", allowRetry: true
  } });
  assert.equal(task.status, 201);

  const studentToken = await login("student@example.com", "StudentTest123!");
  const session = await request("/sessions", { method: "POST", token: studentToken, body: { taskId: task.payload.data.id } });
  assert.equal(session.status, 201);
  const events = await request(`/sessions/${session.payload.data.id}/events`, { method: "POST", token: studentToken, body: { events: [
    { id: "postgres-event-1", type: "control.changed", area: "optics", occurredAt: new Date().toISOString(), payload: { angle: 30 } }
  ] } });
  assert.equal(events.status, 202);

  const report = await request(`/classes/${classId}/report`, { token: adminToken });
  assert.equal(report.status, 200);
  assert.equal(report.payload.data.metrics.sessions, 1);
  assert.equal(report.payload.data.metrics.events, 1);
});
