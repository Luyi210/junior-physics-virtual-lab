import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryPostgres } from "./helpers/postgres-memory.js";
import { classroomExperiments } from "@physics-lab/knowledge/classroom";
import { highSchoolExperiments } from "@physics-lab/knowledge/high-school";
import { createApiHandler } from "../src/app.js";
import { openDatabase } from "../src/database.js";
import { openPostgresDatabase } from "../src/database-postgres.js";
import { signAccessToken } from "../src/security.js";
import { isolatedSqliteConfig } from "./helpers/isolated-config.js";

const highSchool = classroomExperiments.filter((item) => item.stage === "high-school");
const record = { prediction: "增加悬挂总质量，伸长增大。", measurements: "明确选入的模型采样：F=0.98 N，伸长=0.049 m。\n这不是实体器材测量。", conclusion: "模型预设线性范围内，F 与伸长成正比。", question: "本模型能测出真实弹性限度吗？" };
const lessonBody = (experimentId) => ({ experimentId, title: `${experimentId}课堂`, objective: "用保存的证据解释关系", inquiryQuestion: "应该保持哪些条件不变？", predictionPrompt: "先预测", controlledVariable: "按课例保持条件", evidenceRequirement: "明确标注模型采样或虚拟手动读数", reflectionPrompt: "说明模型边界", durationMinutes: 40, status: "ready" });
const taskBody = (lessonId, overrides = {}) => ({ lessonId, classId: "class-a", title: "高中探究任务", mode: "in-class", status: "published", allowRetry: true, ...overrides });
const saveBody = (overrides = {}) => ({ ...record, expectedRevision: 0, mutationId: "first-draft", ...overrides });

async function fixture(dialect, databasePath = ":memory:") {
  const config = isolatedSqliteConfig({ seedDemoData: false, bootstrapAdminName: "管理员", bootstrapAdminEmail: "admin@classroom.invalid", bootstrapAdminPassword: "OnlyForTests123!" });
  config.databasePath = databasePath;
  const pool = dialect === "sqlite" ? null : createMemoryPostgres().pool;
  const db = dialect === "sqlite" ? await openDatabase(config) : await openPostgresDatabase(config, { pool });
  const now = "2026-11-11T00:00:00.000Z";
  await db.run("INSERT INTO schools (id, name, created_at) VALUES (?, ?, ?)", ["foreign-school", "其他学校", now]);
  const tokens = {};
  for (const [id, schoolId, role] of [["teacher-a", "school-primary", "teacher"], ["teacher-b", "school-primary", "teacher"], ["student-a", "school-primary", "student"], ["student-b", "school-primary", "student"], ["foreign-teacher", "foreign-school", "teacher"], ["foreign-student", "foreign-school", "student"]]) {
    await db.run("INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, schoolId, `${id}@classroom.invalid`, "unused-password-hash", id, role, now]);
    tokens[id] = signAccessToken({ id, schoolId, role, name: id }, config);
  }
  tokens["user-admin"] = signAccessToken({ id: "user-admin", schoolId: "school-primary", role: "admin", name: "管理员" }, config);
  for (const suffix of ["a", "b"]) {
    await db.run("INSERT INTO classes (id, school_id, name, grade, join_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [`class-${suffix}`, "school-primary", `高中班级${suffix}`, "高一", `HIGH-${suffix}`, `teacher-${suffix}`, now]);
    await db.run("INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)", [`class-${suffix}`, `student-${suffix}`, now]);
  }
  const handler = createApiHandler({ db, config });
  async function request(path, { method = "GET", user = "student-a", body } = {}, requestHandler = handler) {
    const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    stream.method = method; stream.url = `/api${path}`;
    stream.headers = { host: "127.0.0.1", "content-type": "application/json", ...(tokens[user] ? { authorization: `Bearer ${tokens[user]}` } : {}) };
    stream.socket = { remoteAddress: "classroom-test" };
    let status; let response = "";
    await requestHandler(stream, { writeHead(value) { status = value; }, end(value = "") { response += String(value); } });
    return { status, payload: response ? JSON.parse(response) : null };
  }
  async function createWork(experimentId = "spring-force", overrides = {}) {
    const lesson = await request("/lessons", { method: "POST", user: "teacher-a", body: lessonBody(experimentId) });
    assert.equal(lesson.status, 201, JSON.stringify(lesson.payload));
    const task = await request("/tasks", { method: "POST", user: "teacher-a", body: taskBody(lesson.payload.data.id, overrides) });
    assert.equal(task.status, 201, JSON.stringify(task.payload));
    return { lesson: lesson.payload.data, task: task.payload.data };
  }
  return { db, pool, config, request, createWork, requestWithDatabase(otherDb) {
    const otherHandler = createApiHandler({ db: otherDb, config });
    return (path, options) => request(path, options, otherHandler);
  } };
}

for (const dialect of ["sqlite", "postgresql"]) {
  describe(`${dialect} high-school classroom workflow`, () => {
    let f;
    beforeEach(async () => { f = await fixture(dialect); });
    afterEach(async () => { try { await f?.db.close(); } finally { await f?.pool?.end(); } });

    test("all published high-school experiments complete lesson → task → session → report → teacher view → read-only, with independent retries", async () => {
      assert.deepEqual(highSchool.map((item) => item.id).sort(), highSchoolExperiments.filter((item) => item.status === "ready").map((item) => item.id).sort());
      assert.ok(highSchool.length > 0);
      for (const experiment of highSchool) {
        const report = experiment.id === "capacitor-charge" ? {
          prediction: "接电源后电压逐渐升高；断路时电流为零而电容电压可保持。",
          measurements: "明确选入的模型过程：R=10 kΩ，C=470 μF，E=6 V；每轮从0 V开始，0 s接电源、2 s断路、4 s经R放电。完整切换过程与每条采样条件分别保留；不是实体电表实测。",
          conclusion: "同一充放电段可比较衰减时间常量；不能把断路段混入对数拟合，也不能根据记录条数判定掌握。",
          question: "为什么切换瞬间电容电压连续而电流可跳变？"
        } : experiment.id === "force-composition" ? {
          prediction: "3 N 与 4 N 垂直时，合力大小应为 5 N，但试配力还要同时核对方向。",
          measurements: "明确选入的模型采样：F₁=3 N@0°，F₂=4 N@90°；学生试配=5 N@0°。\n模型合力分量=(3,4) N，大小=5 N，方向≈53.13°；试配矢量差大小≈4.472 N。\n这是静态矢量板，不是实体测力计或手动仪器实测。",
          conclusion: "试配大小相同而方向不同，还不能等效；固定两分力大小可研究合力平方与夹角余弦。",
          question: "零合力为什么没有方向，合力与平衡力有何区别？"
        } : record;
        const submission = (overrides = {}) => saveBody({ ...report, ...overrides });
        const { lesson, task } = await f.createWork(experiment.id);
        const listed = await f.request("/tasks");
        assert.equal(listed.payload.data.find((item) => item.id === task.id).experimentId, experiment.id);
        const context = await f.request(`/tasks/${task.id}/lesson-context`);
        assert.equal(context.payload.data.evidenceRequirement, lesson.evidenceRequirement);
        const start = await f.request("/sessions", { method: "POST", body: { taskId: task.id, experimentId: "injected-unknown" } });
        assert.equal(start.status, 201); const session = start.payload.data;
        assert.equal(session.experimentId, experiment.id);
        assert.equal((await f.request("/sessions", { method: "POST", body: { taskId: task.id } })).payload.data.id, session.id);
        const endpoint = `/sessions/${session.id}/record`;
        assert.equal((await f.request(endpoint)).payload.data.record, null);
        assert.equal((await f.request(`/tasks/${task.id}/records`, { user: "teacher-a" })).payload.data[0].record, null);
        const first = await f.request(endpoint, { method: "PUT", body: submission() });
        assert.equal(first.status, 200); assert.equal(first.payload.data.record.revision, 1);
        assert.equal(first.payload.data.record.measurements, report.measurements);
        assert.deepEqual((await f.request(endpoint, { method: "PUT", body: submission() })).payload.data.record, first.payload.data.record);
        const second = await f.request(endpoint, { method: "PUT", body: submission({ expectedRevision: 1, mutationId: "second-draft", question: "第二版反思" }) });
        assert.equal(second.status, 200); assert.equal(second.payload.data.record.revision, 2);
        const stale = await f.request(endpoint, { method: "PUT", body: submission() });
        assert.equal(stale.status, 409); assert.equal(stale.payload.error.code, "RECORD_CONFLICT");
        const teacher = await f.request(`/tasks/${task.id}/records`, { user: "teacher-a" });
        assert.deepEqual(teacher.payload.data[0].record, second.payload.data.record);
        assert.equal(teacher.payload.data[0].session.experimentId, experiment.id);
        assert.equal((await f.request(`/sessions/${session.id}/complete`, { method: "PATCH" })).status, 200);
        const locked = await f.request(endpoint, { method: "PUT", body: submission({ expectedRevision: 2, mutationId: "after-completion" }) });
        assert.equal(locked.status, 409); assert.equal(locked.payload.error.code, "SESSION_COMPLETED");
        assert.equal((await f.request(endpoint)).payload.data.session.status, "completed");
        const retry = await f.request("/sessions", { method: "POST", body: { taskId: task.id } });
        assert.equal(retry.status, 201); assert.notEqual(retry.payload.data.id, session.id);
        assert.equal((await f.request(`/sessions/${retry.payload.data.id}/record`)).payload.data.record, null);
        const attempts = (await f.request(`/tasks/${task.id}/records`, { user: "teacher-a" })).payload.data;
        assert.equal(attempts.length, 2); assert.equal(attempts.find((item) => item.session.id === session.id).record.revision, 2);
      }
    });

    test("unknown and unavailable historical experiments cannot create new lessons, tasks or sessions, while historical reads and completion survive", async () => {
      for (const experimentId of ["not-an-experiment", "future-unpublished-experiment"]) {
        const rejectedLesson = await f.request("/lessons", { method: "POST", user: "teacher-a", body: lessonBody(experimentId) });
        assert.equal(rejectedLesson.status, 422); assert.equal(rejectedLesson.payload.error.code, "EXPERIMENT_NOT_AVAILABLE");
        const { lesson, task } = await f.createWork();
        const oldSession = (await f.request("/sessions", { method: "POST", body: { taskId: task.id } })).payload.data;
        await f.request(`/sessions/${oldSession.id}/record`, { method: "PUT", body: saveBody() });
        // Represents persisted historical ids; the new validation must not migrate or delete them.
        await f.db.run("UPDATE lessons SET experiment_id=? WHERE id=?", [experimentId, lesson.id]);
        await f.db.run("UPDATE sessions SET experiment_id=? WHERE id=?", [experimentId, oldSession.id]);
        assert.equal((await f.request("/lessons", { user: "teacher-a" })).payload.data.find((item) => item.id === lesson.id).experimentId, experimentId);
        assert.equal((await f.request("/tasks")).payload.data.find((item) => item.id === task.id).experimentId, experimentId);
        const rejectedTask = await f.request("/tasks", { method: "POST", user: "teacher-a", body: taskBody(lesson.id) });
        assert.equal(rejectedTask.status, 422); assert.equal(rejectedTask.payload.error.code, "EXPERIMENT_NOT_AVAILABLE");
        assert.equal((await f.request("/sessions", { method: "POST", body: { taskId: task.id } })).payload.data.id, oldSession.id);
        assert.equal((await f.request(`/sessions/${oldSession.id}/record`, { user: "teacher-a" })).payload.data.record.revision, 1);
        assert.equal((await f.request(`/sessions/${oldSession.id}/complete`, { method: "PATCH" })).status, 200);
        const rejectedSession = await f.request("/sessions", { method: "POST", body: { taskId: task.id } });
        assert.equal(rejectedSession.status, 422); assert.equal(rejectedSession.payload.error.code, "EXPERIMENT_NOT_AVAILABLE");
        assert.equal((await f.request(`/tasks/${task.id}/records`, { user: "teacher-a" })).payload.data.length, 1);
      }
    });

    test("teachers can create and update tasks only for their own classes; same-school admins retain access", async () => {
      const { lesson, task } = await f.createWork();
      const before = await f.db.get("SELECT * FROM tasks WHERE id=?", [task.id]);
      const deniedCreate = await f.request("/tasks", { method: "POST", user: "teacher-b", body: taskBody(lesson.id) });
      assert.equal(deniedCreate.status, 403); assert.equal(deniedCreate.payload.error.code, "TASK_FORBIDDEN");
      const deniedUpdate = await f.request(`/tasks/${task.id}/status`, { method: "PATCH", user: "teacher-b", body: { status: "closed" } });
      assert.equal(deniedUpdate.status, 403);
      assert.deepEqual(await f.db.get("SELECT * FROM tasks WHERE id=?", [task.id]), before);
      assert.equal((await f.request("/tasks", { user: "teacher-b" })).payload.data.some((item) => item.id === task.id), true, "existing same-school read access is retained");
      assert.equal((await f.request(`/tasks/${task.id}/status`, { method: "PATCH", user: "teacher-a", body: { status: "closed" } })).status, 200);
      assert.equal((await f.request(`/tasks/${task.id}/status`, { method: "PATCH", user: "user-admin", body: { status: "published" } })).status, 200);
      assert.equal((await f.request("/tasks", { method: "POST", user: "user-admin", body: taskBody(lesson.id, { classId: "class-b" }) })).status, 201);
      assert.equal((await f.request("/tasks", { method: "POST", user: "foreign-teacher", body: taskBody(lesson.id) })).status, 404);
      assert.equal((await f.request(`/tasks/${task.id}/status`, { method: "PATCH", user: "foreign-teacher", body: { status: "closed" } })).status, 404);
    });

    test("high-school records retain student, class-owner, school and retry-disabled boundaries", async () => {
      const { task } = await f.createWork("force-composition", { allowRetry: false });
      for (const user of ["student-b", "foreign-student", "anonymous"]) {
        assert.equal((await f.request("/sessions", { method: "POST", user, body: { taskId: task.id } })).status, user === "anonymous" ? 401 : 403);
      }
      const session = (await f.request("/sessions", { method: "POST", body: { taskId: task.id } })).payload.data;
      const endpoint = `/sessions/${session.id}/record`;
      await f.request(endpoint, { method: "PUT", body: saveBody() });
      for (const user of ["student-b", "teacher-b"]) assert.equal((await f.request(endpoint, { user })).status, 403);
      for (const user of ["foreign-student", "foreign-teacher"]) assert.equal((await f.request(endpoint, { user })).status, 404);
      assert.equal((await f.request(`/tasks/${task.id}/records`, { user: "teacher-b" })).status, 403);
      assert.equal((await f.request(endpoint, { user: "user-admin" })).status, 200);
      await f.request(`/sessions/${session.id}/complete`, { method: "PATCH" });
      const retry = await f.request("/sessions", { method: "POST", body: { taskId: task.id } });
      assert.equal(retry.status, 409); assert.equal(retry.payload.error.code, "TASK_ALREADY_COMPLETED");
    });

    test("concurrent first starts reuse one active classroom attempt", async () => {
      const { task } = await f.createWork();
      const attempts = await Promise.all([1, 2].map(() => f.request("/sessions", { method: "POST", body: { taskId: task.id } })));
      assert.deepEqual(attempts.map((item) => item.status), [201, 201]);
      assert.equal(attempts[0].payload.data.id, attempts[1].payload.data.id);
      assert.equal(Number((await f.db.get("SELECT COUNT(*) total FROM sessions WHERE task_id=? AND learner_id=? AND status='active'", [task.id, "student-a"])).total), 1);
    });

    if (dialect === "sqlite") test("independent SQLite connections race safely without a new schema constraint", async () => {
      const directory = mkdtempSync(join(tmpdir(), "physics-classroom-concurrency-"));
      let otherDb;
      try {
        await f.db.close(); f = await fixture("sqlite", join(directory, "classroom.sqlite"));
        otherDb = await openDatabase(f.config);
        const otherRequest = f.requestWithDatabase(otherDb);
        for (const allowRetry of [true, false]) {
          const { task } = await f.createWork("spring-force", { allowRetry });
          const starts = await Promise.all([f.request, otherRequest].map((request) => request("/sessions", { method: "POST", body: { taskId: task.id } })));
          assert.deepEqual(starts.map((item) => item.status), [201, 201]);
          assert.equal(starts[0].payload.data.id, starts[1].payload.data.id);
          assert.equal(Number((await f.db.get("SELECT COUNT(*) total FROM sessions WHERE task_id=? AND learner_id=?", [task.id, "student-a"])).total), 1);
        }
      } finally {
        await otherDb?.close(); await f.db.close(); f = undefined;
        rmSync(directory, { recursive: true, force: true });
      }
    });

    if (dialect === "postgresql") test("starts acquire the PostgreSQL task row lock before reading attempts", async () => {
      const { task } = await f.createWork();
      const transaction = f.db.transaction.bind(f.db); const reads = [];
      f.db.transaction = (work) => transaction((client) => work({ ...client, get: (sql, params) => { reads.push(sql); return client.get(sql, params); } }));
      const result = await f.request("/sessions", { method: "POST", body: { taskId: task.id } });
      assert.equal(result.status, 201);
      assert.match(reads[0], /FROM tasks .*FOR UPDATE$/);
      assert.ok(reads.findIndex((sql) => sql.includes("FROM sessions")) > 0);
      // pg-mem checks SQL/handler compatibility but does not implement real
      // concurrent PostgreSQL row locking; that needs a real PostgreSQL test.
    });
  });
}
