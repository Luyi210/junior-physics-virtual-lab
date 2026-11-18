import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { Readable } from "node:stream";
import { createMemoryPostgres } from "./helpers/postgres-memory.js";
import { LEARNING_RECORD_FIELD_LIMITS } from "@physics-lab/contracts";
import { createApiHandler } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/database.js";
import { openPostgresDatabase } from "../src/database-postgres.js";
import { signAccessToken } from "../src/security.js";

const content = { prediction: "入射角增大时，反射角也增大。", measurements: "20°→20°\n40°→40°", conclusion: "  反射角等于入射角。\n", question: "反向照射会怎样？" };
const saveBody = (overrides = {}) => ({ ...content, expectedRevision: 0, mutationId: "save-first", ...overrides });

async function fixture(dialect) {
  const config = loadConfig({
    databaseUrl: "", databasePath: ":memory:", seedDemoData: false,
    tokenSecret: "learning-record-test-only", bootstrapSchoolName: "记录测试学校",
    bootstrapAdminName: "测试管理员", bootstrapAdminEmail: "records-admin@example.invalid",
    bootstrapAdminPassword: "RecordTestOnly123!", deepseekApiKey: "", siliconflowApiKey: "",
    guangguangEnabled: false, vectorRagEnabled: false
  });
  const pool = dialect === "sqlite" ? null : createMemoryPostgres().pool;
  const db = dialect === "sqlite" ? await openDatabase(config) : await openPostgresDatabase(config, { pool });
  const now = "2026-11-10T10:00:00.000Z";
  await db.run("INSERT INTO schools (id, name, created_at) VALUES (?, ?, ?)", ["school-foreign", "另一所学校", now]);
  const users = [
    ["teacher-a", "school-primary", "teacher"], ["teacher-b", "school-primary", "teacher"],
    ["student-a", "school-primary", "student"], ["student-b", "school-primary", "student"],
    ["teacher-foreign", "school-foreign", "teacher"], ["student-foreign", "school-foreign", "student"],
    ["admin-foreign", "school-foreign", "admin"]
  ];
  const tokens = { "user-admin": signAccessToken({ id: "user-admin", schoolId: "school-primary", role: "admin", name: "测试管理员" }, config) };
  for (const [id, schoolId, role] of users) {
    await db.run("INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, schoolId, `${id}@example.invalid`, "unused-test-password-hash", id, role, now]);
    tokens[id] = signAccessToken({ id, schoolId, role, name: id }, config);
  }
  for (const [suffix, owner, schoolId] of [["a", "teacher-a", "school-primary"], ["b", "teacher-b", "school-primary"], ["foreign", "teacher-foreign", "school-foreign"]]) {
    await db.run("INSERT INTO classes (id, school_id, name, grade, join_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [`class-${suffix}`, schoolId, `班级${suffix}`, "八年级", `CODE-${suffix}`, owner, now]);
    await db.run("INSERT INTO lessons (id, school_id, created_by, experiment_id, title, objective, inquiry_question, duration_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [`lesson-${suffix}`, schoolId, owner, "reflection", `反射课例${suffix}`, "归纳规律", "两个角有什么关系？", 40, "ready", now, now]);
    await db.run("INSERT INTO tasks (id, school_id, class_id, lesson_id, title, mode, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [`task-${suffix}`, schoolId, `class-${suffix}`, `lesson-${suffix}`, `探究任务${suffix}`, "in-class", "published", owner, now, now]);
  }
  for (const [id, suffix, learner, schoolId] of [["session-a", "a", "student-a", "school-primary"], ["session-b", "a", "student-b", "school-primary"], ["session-other-class", "b", "student-a", "school-primary"], ["session-foreign", "foreign", "student-foreign", "school-foreign"]]) {
    await db.run("INSERT INTO sessions (id, school_id, task_id, class_id, learner_id, experiment_id, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, schoolId, `task-${suffix}`, `class-${suffix}`, learner, "reflection", "active", now, now]);
  }
  const handler = createApiHandler({ db, config });
  async function request(path, { method = "GET", user = "student-a", body } = {}) {
    const input = body === undefined ? "" : JSON.stringify(body);
    const stream = Readable.from(input ? [Buffer.from(input)] : []);
    stream.method = method;
    stream.url = `/api${path}`;
    stream.headers = { host: "127.0.0.1", "content-type": "application/json", ...(tokens[user] ? { authorization: `Bearer ${tokens[user]}` } : {}) };
    stream.socket = { remoteAddress: "learning-record-test" };
    const response = { status: 0, headers: {}, body: "" };
    await handler(stream, {
      writeHead(status, headers) { response.status = status; response.headers = headers; },
      end(value = "") { response.body += String(value); }
    });
    return { status: response.status, headers: response.headers, payload: response.body ? JSON.parse(response.body) : null };
  }
  return { db, pool, request, put: (body, user = "student-a", session = "session-a") => request(`/sessions/${session}/record`, { method: "PUT", user, body }) };
}

for (const dialect of ["sqlite", "postgresql"]) {
  describe(`${dialect} structured learning records`, () => {
    let f;
    beforeEach(async () => { f = await fixture(dialect); });
    afterEach(async () => { try { await f?.db.close(); } finally { await f?.pool?.end(); } });

    test("saves complete text, preserves whitespace and exposes task context to authorized readers", async () => {
      const initial = await f.request("/sessions/session-a/record");
      assert.equal(initial.status, 200);
      assert.equal(initial.payload.data.record, null);
      const saved = await f.put(saveBody());
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.payload.data.record, {
        ...content, sessionId: "session-a", learnerId: "student-a", revision: 1,
        lastMutationId: "save-first", updatedAt: saved.payload.data.record.updatedAt
      });
      assert.equal(saved.payload.data.taskTitle, "探究任务a");
      assert.equal(saved.payload.data.className, "班级a");
      assert.equal(saved.payload.data.lessonTitle, "反射课例a");
      assert.equal(saved.payload.data.learnerName, "student-a");
      assert.equal(saved.payload.data.session.id, "session-a");
      for (const user of ["student-a", "teacher-a", "user-admin"]) {
        const read = await f.request("/sessions/session-a/record", { user });
        assert.equal(read.status, 200);
        assert.deepEqual(read.payload.data.record, saved.payload.data.record);
      }
    });

    test("task listing includes started sessions with no draft and all saved attempts", async () => {
      await f.put(saveBody());
      const listed = await f.request("/tasks/task-a/records", { user: "teacher-a" });
      assert.equal(listed.status, 200);
      assert.equal(listed.payload.data.length, 2);
      assert.equal(listed.payload.data.find((item) => item.session.id === "session-a").record.revision, 1);
      assert.equal(listed.payload.data.find((item) => item.session.id === "session-b").record, null);
      const admin = await f.request("/tasks/task-a/records", { user: "user-admin" });
      assert.deepEqual(admin.payload.data, listed.payload.data);
    });

    test("keeps student, class-owner and school access boundaries for reads and writes", async () => {
      await f.put(saveBody());
      for (const user of ["student-b", "teacher-b"]) {
        assert.equal((await f.request("/sessions/session-a/record", { user })).status, 403);
        assert.equal((await f.put(saveBody(), user)).status, 403);
      }
      for (const user of ["student-foreign", "teacher-foreign", "admin-foreign"]) {
        assert.equal((await f.request("/sessions/session-a/record", { user })).status, 404);
      }
      assert.equal((await f.put(saveBody(), "student-foreign")).status, 404);
      for (const user of ["teacher-a", "user-admin"]) assert.equal((await f.put(saveBody(), user)).status, 403);
      for (const user of ["student-a", "teacher-b"]) assert.equal((await f.request("/tasks/task-a/records", { user })).status, 403);
      assert.equal((await f.request("/tasks/task-a/records", { user: "admin-foreign" })).status, 404);
      assert.equal((await f.request("/sessions/session-other-class/record", { user: "teacher-b" })).status, 200);
      assert.equal((await f.request("/sessions/session-a/record", { user: "anonymous" })).status, 401);
      assert.equal((await f.request("/sessions/missing/record")).status, 404);
      assert.equal((await f.request("/tasks/missing/records", { user: "teacher-a" })).status, 404);
    });

    test("accepts empty drafts and exact field limits", async () => {
      const blank = Object.fromEntries(Object.keys(content).map((key) => [key, ""]));
      const empty = await f.put(saveBody(blank));
      assert.equal(empty.status, 200);
      assert.equal(empty.payload.data.record.measurements, "");
      const maximum = Object.fromEntries(Object.entries(LEARNING_RECORD_FIELD_LIMITS).map(([key, limit]) => [key, "字".repeat(limit)]));
      const saved = await f.put(saveBody({ ...maximum, expectedRevision: 1, mutationId: "maximum" }));
      assert.equal(saved.status, 200);
      assert.equal(saved.payload.data.record.revision, 2);
      for (const key of Object.keys(content)) assert.equal(saved.payload.data.record[key], maximum[key]);
    });

    test("retries are idempotent and changed or stale mutations cannot replace a newer draft", async () => {
      const first = await f.put(saveBody());
      const retried = await f.put(saveBody());
      assert.equal(retried.status, 200);
      assert.deepEqual(retried.payload.data.record, first.payload.data.record);
      const changedRetry = await f.put(saveBody({ question: "同一个请求标识却改了内容" }));
      assert.equal(changedRetry.status, 409);
      assert.equal(changedRetry.payload.error.code, "RECORD_CONFLICT");
      const second = await f.put(saveBody({ expectedRevision: 1, mutationId: "save-second", question: "第二版问题" }));
      assert.equal(second.status, 200);
      assert.equal(second.payload.data.record.revision, 2);
      for (const body of [saveBody(), saveBody({ expectedRevision: 1, mutationId: "other-device" }), saveBody({ expectedRevision: 3, mutationId: "future" }), saveBody({ expectedRevision: 2, mutationId: "save-second" })]) {
        const stale = await f.put(body);
        assert.equal(stale.status, 409);
        assert.equal(stale.payload.error.code, "RECORD_CONFLICT");
      }
      assert.deepEqual((await f.request("/sessions/session-a/record")).payload.data.record, second.payload.data.record);
    });

    test("concurrent different saves produce one winner for creation and for revision updates", async () => {
      for (const expectedRevision of [0, 1]) {
        const attempts = await Promise.all(["left", "right"].map((side) => f.put(saveBody({
          expectedRevision, mutationId: `${side}-${expectedRevision}`, conclusion: `${side} version ${expectedRevision}`
        }))));
        assert.deepEqual(attempts.map((item) => item.status).sort(), [200, 409]);
        const winner = attempts.find((item) => item.status === 200).payload.data.record;
        assert.equal(winner.revision, expectedRevision + 1);
        assert.deepEqual((await f.request("/sessions/session-a/record")).payload.data.record, winner);
      }
    });

    test("concurrent identical retries return the same revision without duplicate saves", async () => {
      const results = await Promise.all([f.put(saveBody()), f.put(saveBody())]);
      assert.deepEqual(results.map((item) => item.status), [200, 200]);
      assert.deepEqual(results[0].payload.data.record, results[1].payload.data.record);
      assert.equal(results[0].payload.data.record.revision, 1);
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_records")).total, 1);
    });

    test("completed sessions remain readable and reject all writes including duplicate retries", async () => {
      const before = await f.put(saveBody());
      assert.equal((await f.request("/sessions/session-a/complete", { method: "PATCH" })).status, 200);
      for (const body of [saveBody(), saveBody({ expectedRevision: 1, mutationId: "after-completion" })]) {
        const rejected = await f.put(body);
        assert.equal(rejected.status, 409);
        assert.equal(rejected.payload.error.code, "SESSION_COMPLETED");
      }
      for (const user of ["student-a", "teacher-a", "user-admin"]) {
        const read = await f.request("/sessions/session-a/record", { user });
        assert.equal(read.status, 200);
        assert.equal(read.payload.data.session.status, "completed");
        assert.deepEqual(read.payload.data.record, before.payload.data.record);
      }
    });

    test("rejects malformed payloads, field types and lengths without creating a record", async () => {
      const invalid = [null, [], "text", 42, {}, saveBody({ extra: true })];
      for (const [field, limit] of Object.entries(LEARNING_RECORD_FIELD_LIMITS)) {
        for (const value of [undefined, null, false, 123, [], {}, "x".repeat(limit + 1)]) invalid.push(saveBody({ [field]: value }));
      }
      for (const value of [undefined, null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) invalid.push(saveBody({ expectedRevision: value }));
      for (const value of [undefined, null, 1, [], "", "with space", "x".repeat(161)]) invalid.push(saveBody({ mutationId: value }));
      for (const body of invalid) {
        const response = await f.put(body);
        assert.equal(response.status, 422, JSON.stringify(body)?.slice(0, 100));
        assert.equal(response.payload.error.code, "VALIDATION_ERROR");
      }
      assert.equal((await f.request("/sessions/session-a/record")).payload.data.record, null);
    });

    test("allows PUT through CORS and advertises the new record capability", async () => {
      const options = await f.request("/sessions/session-a/record", { method: "OPTIONS", user: "anonymous" });
      assert.equal(options.status, 204);
      assert.ok(options.headers["access-control-allow-methods"].includes("PUT"));
      const health = await f.request("/health", { user: "anonymous" });
      assert.ok(health.payload.data.capabilities.includes("structured-learning-records"));
    });
  });
}
