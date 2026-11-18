import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { openDatabase } from "../src/database.js";
import { hashPassword, verifyPassword } from "../src/security.js";
import { isolatedSqliteConfig } from "./helpers/isolated-config.js";

const bootstrap = { seedDemoData: false, bootstrapSchoolName: "初始化测试学校", bootstrapAdminName: "初始化管理员",
  bootstrapAdminEmail: "owner@initialization.invalid", bootstrapAdminPassword: "InitializationOnly123!" };

const resources = new WeakMap();
function temporaryDatabase(t) {
  const directory = mkdtempSync(join(tmpdir(), "physics-sqlite-initialization-"));
  const cleanup = []; resources.set(t, cleanup);
  t.after(async () => {
    for (const release of cleanup.toReversed()) await release();
    rmSync(directory, { recursive: true, force: true });
  });
  return join(directory, "test.sqlite");
}
function config(file, changes = {}) { return { ...isolatedSqliteConfig(changes), databasePath: file }; }
async function open(t, file, changes = {}) {
  const db = await openDatabase(config(file, changes));
  resources.get(t).push(() => { try { db.close(); } catch { /* a restart test already closed it */ } });
  return db;
}
function snapshot(file) {
  const native = new DatabaseSync(file, { readOnly: true });
  try {
    const schema = native.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const rows = {};
    for (const { name } of schema.filter((entry) => entry.type === "table")) {
      rows[name] = native.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map((row) => JSON.stringify(row)).sort();
    }
    return { schema, rows };
  } finally { native.close(); }
}
function legacyTables(file) {
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE schools (id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE users (id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),created_at TEXT NOT NULL);`);
  return db;
}
function insertLegacyUser(native, { id = "old-admin", schoolId = "old-school", email = "old@initialization.invalid", passwordHash = "existing-password-hash", role = "admin" } = {}) {
  native.prepare("INSERT INTO users(id,school_id,email,password_hash,name,role,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, schoolId, email, passwordHash, "既有用户", role, "2020-01-01T00:00:00.000Z");
}

test("SQLite demo initialization is single-use and restart preserves edited accounts and every classroom table", async (t) => {
  const file = temporaryDatabase(t);
  let db = await open(t, file);
  assert.equal(db.initialization.mode, "demo"); assert.equal(db.initialization.created, true);
  assert.equal(db.initialization.schoolId, "school-demo");
  assert.equal((await db.get("PRAGMA busy_timeout")).timeout, 5000);
  assert.equal((await db.get("PRAGMA foreign_keys")).foreign_keys, 1);
  assert.equal((await db.get("PRAGMA journal_mode")).journal_mode, "wal");
  const passwordHash = hashPassword("ChangedBySchool123!");
  await db.run("UPDATE users SET email=?,name=?,password_hash=?,status='disabled',last_login_at=? WHERE id='user-student-1'",
    ["renamed@student.invalid", "学校修改的姓名", passwordHash, "2025-05-01T10:00:00.000Z"]);
  await db.run("UPDATE users SET status='disabled' WHERE id='user-admin'");
  await db.run("UPDATE schools SET name='学校自己的名称'");
  await db.run("UPDATE classes SET name='自建课堂名称'");
  await db.run("UPDATE lessons SET objective='教师修改的目标' WHERE id='lesson-reflection'");
  await db.run("UPDATE tasks SET title='教师修改的任务' WHERE id='task-reflection'");
  await db.run("INSERT INTO sessions(id,school_id,task_id,class_id,learner_id,experiment_id,status,started_at,updated_at,completed_at) VALUES('saved-session','school-demo','task-reflection','class-801','user-student-1','reflection','completed','2025-01-01','2025-01-02','2025-01-02')");
  await db.run("INSERT INTO session_learning_records(session_id,learner_id,prediction,measurements,conclusion,question,revision,last_mutation_id,updated_at) VALUES('saved-session','user-student-1','原预测','原记录','原结论','原问题',2,'original-mutation','2025-01-02')");
  await db.run("INSERT INTO session_events(id,session_id,event_type,area,occurred_at,payload_json) VALUES('event-old','saved-session','record','optics','2025-01-02','{}')");
  await db.run("INSERT INTO observations(id,session_id,learner_id,text,created_at) VALUES('observation-old','saved-session','user-student-1','原观察','2025-01-02')");
  await db.run("INSERT INTO class_prompts(id,class_id,teacher_id,text,created_at) VALUES('prompt-old','class-801','user-teacher','原提示','2025-01-02')");
  db.close();
  const before = snapshot(file);
  for (const changes of [
    { seedDemoData: true },
    { seedDemoData: false, bootstrapAdminEmail: "", bootstrapAdminPassword: "" },
    { ...bootstrap, bootstrapSchoolName: "不能覆盖", bootstrapAdminName: "不能替换", bootstrapAdminEmail: "new-owner@invalid.example", bootstrapAdminPassword: "DifferentConfigured123!" }
  ]) {
    db = await open(t, file, changes);
    assert.equal(db.initialization.mode, "existing"); assert.equal(db.initialization.created, false);
    assert.equal(await db.get("SELECT id FROM schools WHERE id='school-primary'"), undefined);
    const user = await db.get("SELECT * FROM users WHERE id='user-student-1'");
    assert.equal(user.password_hash, passwordHash);
    assert.equal(verifyPassword("ChangedBySchool123!", user.password_hash), true);
    assert.equal(verifyPassword("Student123!", user.password_hash), false);
    assert.equal(user.status, "disabled");
    assert.equal((await db.get("SELECT status FROM users WHERE id='user-admin'")).status, "disabled");
    db.close();
    assert.deepEqual(snapshot(file), before);
  }
});

test("SQLite restart does not resurrect deleted demo students, memberships, tasks or lessons", async (t) => {
  const file = temporaryDatabase(t);
  let db = await open(t, file);
  await db.run("DELETE FROM users WHERE id='user-student-10'");
  await db.run("DELETE FROM class_members WHERE user_id='user-student-9'");
  await db.run("DELETE FROM tasks WHERE id='task-density'");
  await db.run("DELETE FROM lessons WHERE id='lesson-density'");
  db.close(); const before = snapshot(file);
  db = await open(t, file, { seedDemoData: true });
  assert.equal(db.initialization.mode, "existing");
  assert.equal((await db.get("SELECT COUNT(*) total FROM users")).total, 11);
  assert.equal(await db.get("SELECT id FROM users WHERE id='user-student-10'"), undefined);
  assert.equal(await db.get("SELECT user_id FROM class_members WHERE user_id='user-student-9'"), undefined);
  db.close(); assert.deepEqual(snapshot(file), before);
});

test("SQLite formal initialization normalizes its bootstrap identity and never becomes demo data on restart", async (t) => {
  const file = temporaryDatabase(t);
  let db = await open(t, file, { ...bootstrap, bootstrapSchoolName: "  初始化测试学校  ", bootstrapAdminName: "  初始化管理员  ", bootstrapAdminEmail: "  OWNER@INITIALIZATION.INVALID  " });
  assert.equal(db.initialization.mode, "bootstrap"); assert.equal(db.initialization.created, true);
  assert.equal(db.initialization.adminEmail, "owner@initialization.invalid");
  assert.equal(db.initialization.schoolId, "school-primary");
  assert.ok(!Object.hasOwn(db.initialization, "adminPassword"));
  assert.ok(!JSON.stringify(db.initialization).includes(bootstrap.bootstrapAdminPassword));
  const users = await db.all("SELECT * FROM users");
  assert.equal(users.length, 1); assert.equal(users[0].name, "初始化管理员");
  assert.equal(users[0].email, "owner@initialization.invalid");
  assert.equal(verifyPassword(bootstrap.bootstrapAdminPassword, users[0].password_hash), true);
  assert.equal((await db.get("SELECT name FROM schools")).name, "初始化测试学校");
  await db.run("UPDATE users SET status='disabled' WHERE id='user-admin'");
  db.close(); const before = snapshot(file);
  db = await open(t, file, { seedDemoData: true, bootstrapAdminPassword: "irrelevant" });
  assert.equal(db.initialization.mode, "existing");
  assert.equal((await db.get("SELECT COUNT(*) total FROM users")).total, 1);
  assert.equal((await db.get("SELECT COUNT(*) total FROM lessons")).total, 0);
  assert.equal(await db.get("SELECT id FROM schools WHERE id='school-demo'"), undefined);
  db.close(); assert.deepEqual(snapshot(file), before);
});

test("SQLite existing legacy users are migrated without reseeding or rewriting identity data", async (t) => {
  const file = temporaryDatabase(t); const native = legacyTables(file);
  native.prepare("INSERT INTO schools VALUES(?,?,?)").run("old-school", "旧学校", "2020-01-01");
  insertLegacyUser(native); native.close();
  const db = await open(t, file, { seedDemoData: true });
  assert.equal(db.initialization.mode, "existing");
  const user = await db.get("SELECT * FROM users");
  assert.equal(user.id, "old-admin"); assert.equal(user.email, "old@initialization.invalid");
  assert.equal(user.password_hash, "existing-password-hash"); assert.equal(user.name, "既有用户");
  assert.equal(user.status, "active"); assert.equal(user.last_login_at, null);
  assert.equal((await db.get("SELECT COUNT(*) total FROM schools")).total, 1);
  assert.equal((await db.get("SELECT COUNT(*) total FROM users")).total, 1);
  assert.equal((await db.get("SELECT COUNT(*) total FROM lessons")).total, 0);
});

test("SQLite empty formal database rejects missing credentials atomically and closes the failed connection", async (t) => {
  const file = temporaryDatabase(t);
  const close = DatabaseSync.prototype.close; let closed = 0;
  t.mock.method(DatabaseSync.prototype, "close", function () { closed += 1; return close.call(this); });
  await assert.rejects(openDatabase(config(file, { seedDemoData: false, bootstrapAdminEmail: "", bootstrapAdminPassword: "" })), { code: "DATABASE_INITIALIZATION_CONFIG_INVALID" });
  assert.equal(closed, 1);
  assert.deepEqual(snapshot(file), { schema: [], rows: {} });
  const db = await open(t, file, bootstrap);
  assert.equal(db.initialization.mode, "bootstrap", "failed initialization must release its lock for recovery");
});

for (const kind of ["school-only", "orphan-user", "teacher-only", "invalid-admin-email", "empty-admin-hash"]) {
  test(`SQLite refuses ${kind} partial data without repairing, deleting, seeding or committing migrations`, async (t) => {
    const file = temporaryDatabase(t); const native = legacyTables(file);
    if (kind !== "orphan-user") native.prepare("INSERT INTO schools VALUES(?,?,?)").run("old-school", "不能改写的学校", "2020-01-01");
    if (kind === "orphan-user") { native.exec("PRAGMA foreign_keys=OFF"); insertLegacyUser(native); }
    else if (kind === "teacher-only") insertLegacyUser(native, { role: "teacher" });
    else if (kind === "invalid-admin-email") insertLegacyUser(native, { email: "invalid-email" });
    else if (kind === "empty-admin-hash") insertLegacyUser(native, { passwordHash: "  " });
    native.close(); const before = snapshot(file);
    for (const changes of [{ seedDemoData: true }, bootstrap]) {
      await assert.rejects(openDatabase(config(file, changes)), { code: "DATABASE_INITIALIZATION_INCOMPLETE" });
      assert.deepEqual(snapshot(file), before);
    }
  });
}

for (const [kind, schoolId, userId] of [
  ["null administrator id", "old-school", null],
  ["empty administrator id", "old-school", ""],
  ["whitespace administrator id", "old-school", "\t\n\u3000"],
  ["empty school and school membership id", "", "old-admin"],
  ["whitespace school and school membership id", "\t\u00a0", "old-admin"]
]) {
  test(`SQLite rejects ${kind} and preserves the entire legacy snapshot`, async (t) => {
    const file = temporaryDatabase(t); const native = legacyTables(file);
    native.prepare("INSERT INTO schools VALUES(?,?,?)").run(schoolId, "原学校不能改写", "2020-01-01");
    insertLegacyUser(native, { id: userId, schoolId });
    native.close(); const before = snapshot(file);
    for (const changes of [{ seedDemoData: true }, bootstrap]) {
      await assert.rejects(openDatabase(config(file, changes)), { code: "DATABASE_INITIALIZATION_INCOMPLETE" });
      assert.deepEqual(snapshot(file), before);
    }
  });
}

test("SQLite rejects a malformed student identity even beside a valid administrator", async (t) => {
  const file = temporaryDatabase(t); const native = legacyTables(file);
  native.prepare("INSERT INTO schools VALUES(?,?,?)").run("old-school", "原学校", "2020-01-01");
  insertLegacyUser(native);
  insertLegacyUser(native, { id: "", email: "student@initialization.invalid", role: "student" });
  native.close(); const before = snapshot(file);
  await assert.rejects(openDatabase(config(file, bootstrap)), { code: "DATABASE_INITIALIZATION_INCOMPLETE" });
  assert.deepEqual(snapshot(file), before);
});

for (const mode of ["demo", "bootstrap"]) {
  test(`SQLite ${mode} write failure rolls back partial initialization and schema migration, then closes the connection`, async (t) => {
    const file = temporaryDatabase(t); const native = legacyTables(file);
    const rejectedId = mode === "demo" ? "user-student-5" : "user-admin";
    native.exec(`CREATE TRIGGER reject_initialization BEFORE INSERT ON users WHEN NEW.id='${rejectedId}' BEGIN SELECT RAISE(ABORT,'injected initializer failure'); END;`);
    native.close(); const before = snapshot(file);
    const close = DatabaseSync.prototype.close; let closed = 0;
    t.mock.method(DatabaseSync.prototype, "close", function () { closed += 1; return close.call(this); });
    await assert.rejects(openDatabase(config(file, mode === "demo" ? { seedDemoData: true } : bootstrap)), /injected initializer failure/);
    assert.equal(closed, 1);
    assert.deepEqual(snapshot(file), before);
    const repaired = new DatabaseSync(file);
    repaired.exec("BEGIN IMMEDIATE; DROP TRIGGER reject_initialization; COMMIT;"); repaired.close();
    const db = await open(t, file, mode === "demo" ? { seedDemoData: true } : bootstrap);
    assert.equal(db.initialization.mode, mode);
    assert.equal((await db.get("SELECT COUNT(*) total FROM users")).total, mode === "demo" ? 12 : 1);
  });
}

test("SQLite lock wait is bounded, closes its failed connection and leaves the existing database unchanged", { timeout: 12000 }, async (t) => {
  const file = temporaryDatabase(t);
  const initialized = await open(t, file, bootstrap); initialized.close();
  const before = snapshot(file);
  const holder = new DatabaseSync(file);
  resources.get(t).push(() => { try { holder.close(); } catch {} });
  holder.exec("BEGIN IMMEDIATE");
  const close = DatabaseSync.prototype.close; let closed = 0;
  t.mock.method(DatabaseSync.prototype, "close", function () { closed += 1; return close.call(this); });
  const started = performance.now();
  await assert.rejects(openDatabase(config(file, { seedDemoData: true })), (error) => error.errcode === 5);
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= 4000 && elapsed < 9000, `bounded lock wait took ${elapsed} ms`);
  assert.equal(closed, 1, "the connection that failed before BEGIN must also be closed");
  holder.exec("ROLLBACK"); holder.close();
  assert.deepEqual(snapshot(file), before);
  const reopened = await open(t, file, { seedDemoData: true });
  assert.deepEqual(reopened.initialization, { mode: "existing", created: false });
  reopened.close(); assert.deepEqual(snapshot(file), before);
});

async function parallelInitializers(t, file, changes) {
  const source = `
    import { openDatabase } from ${JSON.stringify(new URL("../src/database.js", import.meta.url).href)};
    import { isolatedSqliteConfig } from ${JSON.stringify(new URL("./helpers/isolated-config.js", import.meta.url).href)};
    process.once("message", async ({file,changes}) => {
      let db;
      try {
        db=await openDatabase({...isolatedSqliteConfig(changes),databasePath:file});
        const users=(await db.get("SELECT COUNT(*) total FROM users")).total;
        process.send({result:{initialization:db.initialization,users}});
      } catch(error) { process.send({failure:{message:error.message,code:error.code,errcode:error.errcode,stack:error.stack}});process.exitCode=1; }
      finally { if(db) await db.close();process.disconnect(); }
    });
    process.send({ready:true});
  `;
  const workers = Array.from({ length: 4 }, () => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", source], { env: { NODE_NO_WARNINGS: "1" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    resources.get(t).push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise((resolve) => child.once("exit", resolve));
        child.kill(); await exited;
      }
    });
    let result; let failure; let stderr = ""; let readyResolve; let readyReject;
    const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("message", (message) => {
      if (message.ready) readyResolve();
      if (message.result) result = message.result;
      if (message.failure) failure = message.failure;
    });
    const done = new Promise((resolve, reject) => {
      child.on("error", (error) => { readyReject(error); reject(error); });
      child.on("exit", (code, signal) => {
        if (code === 0 && result) resolve(result);
        else { const error = new Error(`initializer failed: ${JSON.stringify({ code, signal, failure, stderr })}`); readyReject(error); reject(error); }
      });
    });
    // Keep early child exit from creating an unhandled rejection while peers load.
    void done.catch(() => {});
    return { child, ready, done };
  });
  await Promise.all(workers.map((worker) => worker.ready));
  for (const worker of workers) worker.child.send({ file, changes });
  return Promise.all(workers.map((worker) => worker.done));
}

for (const mode of ["demo", "bootstrap"]) {
  test(`four real processes initialize one SQLite file exactly once in ${mode} mode`, { timeout: 15000 }, async (t) => {
    const file = temporaryDatabase(t);
    const results = await parallelInitializers(t, file, mode === "demo" ? { seedDemoData: true } : bootstrap);
    assert.equal(results.filter((result) => result.initialization.mode === mode && result.initialization.created).length, 1);
    assert.equal(results.filter((result) => result.initialization.mode === "existing" && !result.initialization.created).length, 3);
    assert.ok(results.every((result) => result.users === (mode === "demo" ? 12 : 1)));
    const before = snapshot(file);
    const db = await open(t, file, { seedDemoData: mode !== "demo" });
    assert.equal(db.initialization.mode, "existing");
    assert.equal((await db.get("SELECT COUNT(*) total FROM schools")).total, 1);
    assert.equal((await db.get("SELECT COUNT(*) total FROM lessons")).total, mode === "demo" ? 15 : 0);
    assert.equal((await db.get("SELECT COUNT(*) total FROM tasks")).total, mode === "demo" ? 15 : 0);
    db.close(); assert.deepEqual(snapshot(file), before);
  });
}
