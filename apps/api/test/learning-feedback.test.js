import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { Readable } from "node:stream";
import { createMemoryPostgres } from "./helpers/postgres-memory.js";
import { LEARNING_FEEDBACK_BODY_LIMIT } from "@physics-lab/contracts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApiHandler } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/database.js";
import { openPostgresDatabase } from "../src/database-postgres.js";
import { signAccessToken } from "../src/security.js";
import { createSessionLearningFeedback } from "../src/learning-feedback.js";

const content = { prediction: "入射角增大时，反射角也增大。", measurements: "20°→20°\n40°→40°", conclusion: "  反射角等于入射角。\n", question: "反向照射会怎样？" };
const saveBody = (overrides = {}) => ({ ...content, expectedRevision: 0, mutationId: "save-first", ...overrides });
const feedbackBody = (overrides = {}) => ({ body: "  请说明这两组读数保持了哪个条件。\n", expectedRevision: 1, mutationId: "feedback-first", ...overrides });

async function fixture(dialect, databasePath = ":memory:", legacyFeedbackSchema = false) {
  const config = loadConfig({
    databaseUrl: "", databasePath, seedDemoData: false,
    tokenSecret: "learning-record-test-only", bootstrapSchoolName: "记录测试学校",
    bootstrapAdminName: "测试管理员", bootstrapAdminEmail: "records-admin@example.invalid",
    bootstrapAdminPassword: "RecordTestOnly123!", deepseekApiKey: "", siliconflowApiKey: "",
    guangguangEnabled: false, vectorRagEnabled: false
  });
  const pool = dialect === "sqlite" ? null : createMemoryPostgres({ allowRepeatedSchema: true }).pool;
  const originalConnect = pool?.connect.bind(pool);
  if (legacyFeedbackSchema) {
    // Construct the previous schema before opening the new version. pg-mem's
    // DROP TABLE leaves index names behind; never rewrite production queries.
    pool.connect = async () => {
      const client = await originalConnect();
      return {
        query(sql, params) {
          const legacy = sql.replace(/  CREATE TABLE IF NOT EXISTS session_learning_feedback \([\s\S]*?\n  \);\n\n/, "")
            .replace(/  CREATE INDEX IF NOT EXISTS idx_feedback_session[^\n]*\n/, "");
          return client.query(legacy, params);
        },
        release(error) { client.release(error); }
      };
    };
  }
  const db = dialect === "sqlite" ? await openDatabase(config) : await openPostgresDatabase(config, { pool });
  if (legacyFeedbackSchema) pool.connect = originalConnect;
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
  return { db, pool, config, request, post: (body, user = "teacher-a", session = "session-a") => request(`/sessions/${session}/feedback`, { method: "POST", user, body }), put: (body, user = "student-a", session = "session-a") => request(`/sessions/${session}/record`, { method: "PUT", user, body }) };
}

const originalTables = ["schools", "users", "classes", "class_members", "lessons", "tasks", "sessions", "session_learning_records", "session_events", "observations", "class_prompts"];
async function businessRows(db) {
  const result = {};
  for (const table of originalTables) result[table] = (await db.all(`SELECT * FROM ${table}`)).map((row) => JSON.stringify(row)).sort();
  return result;
}

// PostgreSQL cases execute the real adapter/SQL against pg-mem. They are SQL
// compatibility coverage, not evidence of real PostgreSQL locking or MVCC.
for (const dialect of ["sqlite", "postgresql"]) {
  describe(`${dialect} append-only learning feedback`, () => {
    let f;
    beforeEach(async () => { f = await fixture(dialect); });
    afterEach(async () => { try { await f?.db.close(); } finally { await f?.pool?.end(); } });

    test("captures the server report and author, preserves exact text, and changes none of the original tables", async () => {
      const report = (await f.put(saveBody())).payload.data.record;
      const before = await businessRows(f.db);
      assert.deepEqual((await f.request("/sessions/session-a/feedback")).payload.data, []);
      const posted = await f.post(feedbackBody());
      assert.equal(posted.status, 201);
      const saved = posted.payload.data;
      assert.deepEqual(saved, {
        id: saved.id, schoolId: "school-primary", classId: "class-a", taskId: "task-a", sessionId: "session-a", learnerId: "student-a",
        authorId: "teacher-a", authorName: "teacher-a", authorRole: "teacher", body: feedbackBody().body,
        reportRevision: 1, reportUpdatedAt: report.updatedAt, reportSnapshot: content, mutationId: "feedback-first", createdAt: saved.createdAt
      });
      assert.match(saved.id, /^[\da-f-]{36}$/); assert.ok(Number.isFinite(Date.parse(saved.createdAt)));
      assert.deepEqual(await businessRows(f.db), before);
      for (const user of ["student-a", "teacher-a", "user-admin"]) {
        const listed = await f.request("/sessions/session-a/feedback", { user });
        assert.equal(listed.status, 200); assert.deepEqual(listed.payload.data, [saved]);
      }
      const health = await f.request("/health", { user: "anonymous" });
      assert.ok(health.payload.data.capabilities.includes("learning-feedback"));
    });

    test("enforces authentication, student ownership, class-owner teacher and same-school admin boundaries", async () => {
      await f.put(saveBody());
      assert.equal((await f.post(feedbackBody(), "user-admin")).status, 201);
      for (const user of ["student-a", "student-b", "student-foreign"]) assert.equal((await f.post(feedbackBody(), user)).status, 403);
      for (const user of ["student-b", "teacher-b"]) assert.equal((await f.request("/sessions/session-a/feedback", { user })).status, 403);
      assert.equal((await f.post(feedbackBody(), "teacher-b")).status, 403);
      for (const user of ["teacher-foreign", "admin-foreign", "student-foreign"]) {
        assert.equal((await f.request("/sessions/session-a/feedback", { user })).status, 404);
        if (user !== "student-foreign") assert.equal((await f.post(feedbackBody(), user)).status, 404);
      }
      for (const method of ["GET", "POST"]) {
        assert.equal((await f.request("/sessions/session-a/feedback", { user: "anonymous", method, body: feedbackBody() })).status, 401);
        assert.equal((await f.request("/sessions/missing/feedback", { user: "teacher-a", method, body: feedbackBody() })).status, 404);
      }
      assert.equal((await f.request("/sessions/session-other-class/feedback", { user: "teacher-b" })).status, 200);
      assert.equal((await f.post(feedbackBody(), "teacher-a", "session-other-class")).status, 403);
    });

    test("requires a saved report, rejects stale/future previews and accepts the exact body limit", async () => {
      const missing = await f.post(feedbackBody());
      assert.equal(missing.status, 409); assert.equal(missing.payload.error.code, "RECORD_REQUIRED");
      await f.put(saveBody());
      await f.put(saveBody({ expectedRevision: 1, mutationId: "revision-two", conclusion: "第二版" }));
      for (const expectedRevision of [1, 3, Number.MAX_SAFE_INTEGER]) {
        const stale = await f.post(feedbackBody({ expectedRevision }));
        assert.equal(stale.status, 409); assert.equal(stale.payload.error.code, "RECORD_CONFLICT");
      }
      const maximum = await f.post(feedbackBody({ expectedRevision: 2, body: "字".repeat(LEARNING_FEEDBACK_BODY_LIMIT) }));
      assert.equal(maximum.status, 201); assert.equal(maximum.payload.data.body.length, 4000);
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 1);
    });

    test("retries return the original feedback and snapshot after student revision or author rename", async () => {
      await f.put(saveBody());
      const first = (await f.post(feedbackBody())).payload.data;
      await f.put(saveBody({ expectedRevision: 1, mutationId: "new-report", measurements: "学生自行补充的数据" }));
      await f.db.run("UPDATE users SET name=? WHERE id=?", ["教师后来更名", "teacher-a"]);
      const retry = await f.post(feedbackBody());
      assert.equal(retry.status, 201); assert.deepEqual(retry.payload.data, first);
      for (const changes of [{ body: "更正后的反馈" }, { expectedRevision: 2 }]) {
        const collision = await f.post(feedbackBody(changes));
        assert.equal(collision.status, 409); assert.equal(collision.payload.error.code, "FEEDBACK_CONFLICT");
      }
      const next = await f.post(feedbackBody({ expectedRevision: 2, mutationId: "feedback-next", body: "第二次追加反馈" }));
      assert.equal(next.status, 201); assert.equal(next.payload.data.reportRevision, 2);
      assert.equal(next.payload.data.reportSnapshot.measurements, "学生自行补充的数据");
      assert.equal(next.payload.data.authorName, "教师后来更名");
      const rows = (await f.request("/sessions/session-a/feedback")).payload.data;
      assert.equal(rows.length, 2); assert.deepEqual(rows.find((item) => item.id === first.id), first);
    });

    test("identical concurrent requests create one row, conflicting reuse has one winner, actors and sessions have independent IDs", async () => {
      await f.put(saveBody());
      const retries = await Promise.all([f.post(feedbackBody()), f.post(feedbackBody())]);
      assert.deepEqual(retries.map((item) => item.status), [201, 201]);
      assert.deepEqual(retries[0].payload.data, retries[1].payload.data);
      const collisions = await Promise.all(["A", "B"].map((body) => f.post(feedbackBody({ body, mutationId: "concurrent-collision" }))));
      assert.deepEqual(collisions.map((item) => item.status).sort(), [201, 409]);
      const independent = await Promise.all([f.post(feedbackBody({ mutationId: "independent-one" })), f.post(feedbackBody({ mutationId: "independent-two" }))]);
      assert.deepEqual(independent.map((item) => item.status), [201, 201]);
      const admin = await f.post(feedbackBody(), "user-admin");
      assert.equal(admin.status, 201); assert.equal(admin.payload.data.authorRole, "admin");
      await f.put(saveBody(), "student-b", "session-b");
      assert.equal((await f.post(feedbackBody(), "teacher-a", "session-b")).status, 201);
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 6);
    });

    test("a student revision between preflight and atomic INSERT rejects the old preview without a mixed snapshot", async () => {
      await f.put(saveBody());
      const originalGet = f.db.get;
      let advanced = false;
      f.db.get = async (sql, params) => {
        if (!advanced && sql.startsWith("INSERT INTO session_learning_feedback")) {
          advanced = true;
          const result = await f.put(saveBody({ expectedRevision: 1, mutationId: "racing-student", prediction: "新预测", measurements: "新测量", conclusion: "新结论", question: "新问题" }));
          assert.equal(result.status, 200);
        }
        return originalGet(sql, params);
      };
      const stale = await f.post(feedbackBody());
      assert.equal(stale.status, 409); assert.equal(stale.payload.error.code, "RECORD_CONFLICT");
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 0);
      const latest = await f.post(feedbackBody({ expectedRevision: 2, mutationId: "reviewed-new" }));
      assert.equal(latest.status, 201);
      assert.deepEqual(latest.payload.data.reportSnapshot, { prediction: "新预测", measurements: "新测量", conclusion: "新结论", question: "新问题" });
    });

    test("permissions and author status are rechecked atomically, not trusted from the preflight", async () => {
      await f.put(saveBody());
      const originalGet = f.db.get;
      let beforeInsert = () => f.db.run("UPDATE classes SET created_by='teacher-b' WHERE id='class-a'");
      f.db.get = async (sql, params) => {
        if (sql.startsWith("INSERT INTO session_learning_feedback") && beforeInsert) {
          const action = beforeInsert; beforeInsert = null; await action();
        }
        return originalGet(sql, params);
      };
      assert.equal((await f.post(feedbackBody())).status, 403);
      await f.db.run("UPDATE classes SET created_by='teacher-a' WHERE id='class-a'");
      beforeInsert = () => f.db.run("UPDATE users SET status='disabled' WHERE id='teacher-a'");
      const disabled = await f.post(feedbackBody());
      assert.equal(disabled.status, 401); assert.equal(disabled.payload.error.code, "AUTH_INVALID");
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 0);
    });

    test("completed and closed non-retry tasks still accept feedback while reports/status stay read-only", async () => {
      await f.put(saveBody());
      assert.equal((await f.request("/sessions/session-a/complete", { method: "PATCH" })).status, 200);
      await f.db.run("UPDATE tasks SET status='closed',allow_retry=0 WHERE id='task-a'");
      const before = await businessRows(f.db);
      const feedback = await f.post(feedbackBody());
      assert.equal(feedback.status, 201);
      assert.deepEqual((await f.post(feedbackBody())).payload.data, feedback.payload.data);
      const attemptedRevision = await f.put(saveBody({ expectedRevision: 1, mutationId: "after-completion" }));
      assert.equal(attemptedRevision.status, 409); assert.equal(attemptedRevision.payload.error.code, "SESSION_COMPLETED");
      assert.deepEqual(await businessRows(f.db), before);
      assert.equal((await f.request("/sessions/session-a/feedback")).payload.data.length, 1);
    });

    test("rejects malformed or forged payloads without any feedback or report mutation", async () => {
      await f.put(saveBody());
      const before = await businessRows(f.db);
      const invalid = [null, [], 42, "text", {}, feedbackBody({ extra: true }), feedbackBody({ authorId: "user-admin" }), feedbackBody({ reportSnapshot: content })];
      for (const body of [undefined, null, false, 1, {}, [], "", " \n\t", "字".repeat(4001), "\u0000text", "a\u0000b", "\ud800", "\udc00", "a\ud800b"]) invalid.push(feedbackBody({ body }));
      for (const expectedRevision of [undefined, null, "1", 0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1]) invalid.push(feedbackBody({ expectedRevision }));
      for (const mutationId of [undefined, null, 1, {}, [], "", "has space", "x".repeat(161)]) invalid.push(feedbackBody({ mutationId }));
      for (const input of invalid) {
        const result = await f.post(input);
        assert.equal(result.status, 422, JSON.stringify(input)?.slice(0, 100)); assert.equal(result.payload.error.code, "VALIDATION_ERROR");
      }
      assert.deepEqual(await businessRows(f.db), before);
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 0);
    });

    test("normal emoji, newlines and intentional spaces remain exact through storage and retry", async () => {
      await f.put(saveBody());
      const input = feedbackBody({ body: "  请复核测量 🔬\n" + "🌱".repeat(1994) });
      assert.ok(input.body.length <= LEARNING_FEEDBACK_BODY_LIMIT);
      const first = await f.post(input); assert.equal(first.status, 201);
      assert.equal(first.payload.data.body, input.body);
      assert.deepEqual((await f.post(input)).payload.data, first.payload.data);
    });

    test("a failed storage operation leaves report and feedback untouched and the same request can retry", async (t) => {
      await f.put(saveBody()); const before = await businessRows(f.db);
      const originalGet = f.db.get;
      let fail = true;
      f.db.get = async (sql, params) => {
        if (fail && sql.startsWith("INSERT INTO session_learning_feedback")) throw new Error("fixture write unavailable");
        return originalGet(sql, params);
      };
      const errorLog = t.mock.method(console, "error", () => {});
      const failure = await f.post(feedbackBody());
      assert.equal(failure.status, 500); assert.equal(errorLog.mock.callCount(), 1);
      assert.equal((await f.db.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 0);
      assert.deepEqual(await businessRows(f.db), before);
      fail = false; assert.equal((await f.post(feedbackBody())).status, 201);
    });
  });
}

test("SQLite existing database adds only the feedback table/index and preserves all original business rows across restart", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "physics-feedback-migration-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const f = await fixture("sqlite", join(directory, "old.sqlite"));
  await f.put(saveBody());
  await f.db.run("UPDATE users SET name='保留姓名',status='disabled',last_login_at='2020-01-01' WHERE id='student-b'");
  await f.db.exec("DROP TABLE session_learning_feedback");
  const before = await businessRows(f.db); await f.db.close();
  let reopened = await openDatabase({ ...f.config, seedDemoData: true });
  t.after(() => reopened.close());
  assert.equal(reopened.initialization.mode, "existing");
  assert.deepEqual(await businessRows(reopened), before);
  assert.equal((await reopened.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 0);
  assert.ok(await reopened.get("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_feedback_session'"));
  const feedback = await createSessionLearningFeedback(reopened, { id: "teacher-a", schoolId: "school-primary", role: "teacher" }, "session-a", feedbackBody());
  const feedbackRows = await reopened.all("SELECT * FROM session_learning_feedback");
  await reopened.close(); reopened = await openDatabase({ ...f.config, seedDemoData: true });
  assert.deepEqual(await businessRows(reopened), before);
  assert.deepEqual(await reopened.all("SELECT * FROM session_learning_feedback"), feedbackRows);
  assert.equal(feedback.reportRevision, 1);
});

test("independent real SQLite connections deduplicate retries and capture the current report without changing any original rows", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "physics-feedback-concurrent-"));
  const f = await fixture("sqlite", join(directory, "concurrent.sqlite"));
  let second;
  t.after(async () => { await second?.close(); await f.db.close(); rmSync(directory, { recursive: true, force: true }); });
  await f.put(saveBody()); second = await openDatabase(f.config);
  const before = await businessRows(f.db);
  const user = { id: "teacher-a", schoolId: "school-primary", role: "teacher" };
  const retries = await Promise.all([f.db, second].map((db) => createSessionLearningFeedback(db, user, "session-a", feedbackBody())));
  assert.deepEqual(retries[0], retries[1]);
  const collisions = await Promise.allSettled([f.db, second].map((db, index) => createSessionLearningFeedback(db, user, "session-a", feedbackBody({ mutationId: "two-connections", body: `反馈${index}` }))));
  assert.equal(collisions.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(collisions.find((result) => result.status === "rejected").reason.code, "FEEDBACK_CONFLICT");
  assert.equal((await second.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 2);
  assert.deepEqual(await businessRows(second), before);
  // The second connection commits the student revision after the first
  // connection's preflight but before its single feedback INSERT statement.
  const originalGet = f.db.get;
  let changed = false;
  f.db.get = async (sql, params) => {
    if (!changed && sql.startsWith("INSERT INTO session_learning_feedback")) {
      changed = true;
      await second.run("UPDATE session_learning_records SET revision=2,measurements='另一连接的新读数',updated_at='2026-11-11',last_mutation_id='second-connection' WHERE session_id='session-a'");
    }
    return originalGet(sql, params);
  };
  await assert.rejects(createSessionLearningFeedback(f.db, user, "session-a", feedbackBody({ mutationId: "stale-on-other-connection" })), { code: "RECORD_CONFLICT" });
  assert.equal((await second.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 2);
  const reviewed = await createSessionLearningFeedback(f.db, user, "session-a", feedbackBody({ expectedRevision: 2, mutationId: "reviewed-on-other-connection" }));
  assert.equal(reviewed.reportRevision, 2); assert.equal(reviewed.reportSnapshot.measurements, "另一连接的新读数");
});

test("PostgreSQL adapter schema migration preserves existing rows (pg-mem SQL compatibility, not real PG rollback/MVCC)", async (t) => {
  const f = await fixture("postgresql", ":memory:", true); t.after(async () => { await f.db.close(); await f.pool.end(); });
  await f.put(saveBody());
  await f.db.run("UPDATE users SET name='保留姓名',status='disabled' WHERE id='student-b'");
  assert.equal((await f.db.get("SELECT COUNT(*) total FROM information_schema.tables WHERE table_name='session_learning_feedback'")).total, 0);
  const before = await businessRows(f.db);
  const reopened = await openPostgresDatabase(f.config, { pool: f.pool });
  assert.equal(reopened.initialization.mode, "existing");
  assert.deepEqual(await businessRows(reopened), before);
  assert.equal((await reopened.get("SELECT COUNT(*) total FROM session_learning_feedback")).total, 0);
});
