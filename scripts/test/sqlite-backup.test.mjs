import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Worker } from "node:worker_threads";
import { createHash } from "node:crypto";
import { createSqliteBackup, verifySqliteBackup, restoreSqliteBackup } from "../lib/sqlite-backup.mjs";
import { openDatabase } from "../../apps/api/src/database.js";
import { loadConfig } from "../../apps/api/src/config.js";
import { hashPassword, verifyPassword } from "../../apps/api/src/security.js";
import { getSessionLearningRecord, saveSessionLearningRecord } from "../../apps/api/src/learning-records.js";
import { listSessionLearningFeedback, createSessionLearningFeedback } from "../../apps/api/src/learning-feedback.js";

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "physics-sqlite-backup-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = join(directory, "source.sqlite"); const backupRoot = join(directory, "backups");
  const db = new DatabaseSync(sourcePath, options); t.after(() => { if (db.isOpen) db.close(); });
  return { directory, sourcePath, backupRoot, db, create: () => createSqliteBackup({ sourcePath, backupRoot }) };
}
async function readDatabase(path, work) {
  const db = new DatabaseSync(path, { readOnly: true, readBigInts: true });
  try { return work(db); } finally { db.close(); }
}
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function assertNoCompletedBundle(root) {
  for (const name of await readdir(root)) await assert.rejects(readFile(join(root, name, "manifest.json")), { code: "ENOENT" });
}

test("online backup contains committed active-WAL rows without copying sidecars or changing the source", async (t) => {
  const f = await fixture(t);
  f.db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE work(id INTEGER PRIMARY KEY, note TEXT); INSERT INTO work VALUES(1,'committed in WAL')");
  const mainBefore = await readFile(f.sourcePath); const walBefore = await readFile(f.sourcePath + "-wal");
  assert.ok(walBefore.length > 0);
  const result = await f.create();
  assert.deepEqual((await readdir(result.directory)).sort(), ["database.sqlite", "manifest.json"]);
  assert.equal(await readDatabase(result.databasePath, (db) => db.prepare("SELECT note FROM work").get().note), "committed in WAL");
  assert.deepEqual(await readFile(f.sourcePath), mainBefore);
  assert.deepEqual(await readFile(f.sourcePath + "-wal"), walBefore);
  assert.equal(f.db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");
  assert.equal(await readDatabase(result.databasePath, (db) => db.prepare("PRAGMA journal_mode").get().journal_mode), "delete");
  assert.deepEqual(await verifySqliteBackup({ directory: result.directory }), result);
  if (process.platform !== "win32") {
    assert.equal((await stat(result.directory)).mode & 0o777, 0o700);
    assert.equal((await stat(result.databasePath)).mode & 0o777, 0o600);
  }
});

test("an uncommitted transaction is never mistaken for committed backup evidence", async (t) => {
  const f = await fixture(t);
  f.db.exec("PRAGMA journal_mode=WAL; CREATE TABLE pair(id INTEGER PRIMARY KEY, amount INTEGER); INSERT INTO pair VALUES(1,50),(2,50); BEGIN IMMEDIATE; UPDATE pair SET amount=0 WHERE id=1");
  const result = await f.create();
  assert.deepEqual(await readDatabase(result.databasePath, (db) => db.prepare("SELECT amount FROM pair ORDER BY id").all().map((r) => r.amount)), [50n, 50n]);
  f.db.exec("ROLLBACK");
});

test("concurrent WAL transactions yield one complete snapshot, never mixed versions across tables", { timeout: 10_000 }, async (t) => {
  const f = await fixture(t);
  f.db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE a(epoch INTEGER); CREATE TABLE b(epoch INTEGER); CREATE TABLE padding(data BLOB); INSERT INTO a VALUES(0); INSERT INTO b VALUES(0)");
  f.db.prepare("INSERT INTO padding VALUES(?)").run(Buffer.alloc(3 * 1024 * 1024, 7));
  const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(workerData,{timeout:1000});let epoch=0,stopping=false;parentPort.on('message',()=>{stopping=true;});
    function step(){epoch++;db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE a SET epoch=?').run(epoch);db.prepare('UPDATE b SET epoch=?').run(epoch);db.exec('COMMIT');
    if(epoch===1)parentPort.postMessage('ready');if(!stopping)setTimeout(step,2);else{db.close();parentPort.postMessage('done');parentPort.close();}}step();`, { eval: true, workerData: f.sourcePath });
  t.after(() => worker.terminate());
  await new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
  const result = await f.create();
  const [a, b] = await readDatabase(result.databasePath, (db) => [db.prepare("SELECT epoch FROM a").get().epoch, db.prepare("SELECT epoch FROM b").get().epoch]);
  assert.equal(a, b); assert.ok(a >= 1n);
  worker.postMessage("stop-after-one-final-transaction");
  await new Promise((resolve, reject) => { if (worker.threadId === -1) resolve(); else { worker.once("exit", resolve); worker.once("error", reject); } });
  const finalEpoch = BigInt(f.db.prepare("SELECT epoch FROM a").get().epoch);
  assert.ok(a < finalEpoch, "the pinned backup snapshot predates later committed writer transactions");
});

test("typed summaries preserve int64, BLOB, duplicate rows and schema without exposing row contents", async (t) => {
  const f = await fixture(t);
  f.db.exec("CREATE TABLE typed(n INTEGER, payload BLOB, label TEXT, measure REAL); CREATE INDEX typed_label ON typed(label); CREATE VIEW typed_view AS SELECT label FROM typed");
  const insert = f.db.prepare("INSERT INTO typed VALUES(?,?,?,?)");
  insert.run(9223372036854775807n, Buffer.from([0, 255, 128]), "PRIVATE_ROW_PASSWORD_HASH", 1.25);
  insert.run(9223372036854775807n, Buffer.from([0, 255, 128]), "PRIVATE_ROW_PASSWORD_HASH", 1.25);
  insert.run(-9223372036854775808n, Buffer.alloc(0), "", -Infinity);
  const backup = await f.create();
  assert.equal(backup.manifest.tables.find((table) => table.name === "typed").rowCount, 3);
  assert.ok(backup.manifest.schema.objects.some(({ type, name }) => type === "view" && name === "typed_view"));
  assert.doesNotMatch(await readFile(join(backup.directory, "manifest.json"), "utf8"), /PRIVATE_ROW_PASSWORD_HASH|9223372036854775807/);
  const restored = await restoreSqliteBackup({ directory: backup.directory, destination: join(f.directory, "restored") });
  const rows = await readDatabase(restored.databasePath, (db) => db.prepare("SELECT * FROM typed").all());
  assert.equal(rows[0].n, 9223372036854775807n); assert.deepEqual(Buffer.from(rows[0].payload), Buffer.from([0, 255, 128]));
  assert.equal(rows[2].n, -9223372036854775808n); assert.equal(rows[2].measure, -Infinity);
  assert.deepEqual(restored.manifest, backup.manifest);
});

test("parallel backups have unique private directories and never prune historical copies", async (t) => {
  const f = await fixture(t); f.db.exec("CREATE TABLE x(n); INSERT INTO x VALUES(1)");
  await mkdir(f.backupRoot);
  for (let i = 0; i < 12; i++) { const old = join(f.backupRoot, `historic-${i}`); await mkdir(old); await writeFile(join(old, "keep"), "untouched"); }
  const copies = await Promise.all([f.create(), f.create(), f.create()]);
  assert.equal(new Set(copies.map((copy) => copy.directory)).size, 3);
  for (let i = 0; i < 12; i++) assert.equal(await readFile(join(f.backupRoot, `historic-${i}`, "keep"), "utf8"), "untouched");
  for (const copy of copies) await verifySqliteBackup({ directory: copy.directory });
});

test("missing/corrupt databases fail without a successful completion manifest", async (t) => {
  const f = await fixture(t); f.db.close();
  await assert.rejects(createSqliteBackup({ sourcePath: join(f.directory, "missing.sqlite"), backupRoot: f.backupRoot }), { code: "ENOENT" });
  await writeFile(f.sourcePath, "not a SQLite database");
  await assert.rejects(f.create());
  await assertNoCompletedBundle(f.backupRoot);
});

test("foreign-key violations cannot produce an apparently valid backup", async (t) => {
  const f = await fixture(t, { enableForeignKeyConstraints: false });
  f.db.exec("CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id)); INSERT INTO child VALUES(999)");
  await assert.rejects(f.create(), /foreign_key_check failed/);
  await assertNoCompletedBundle(f.backupRoot);
});

test("a cancelled progress deadline rejects and never writes a successful manifest", async (t) => {
  const f = await fixture(t); f.db.exec("CREATE TABLE x(n); INSERT INTO x VALUES(1)");
  let calls = 0; t.mock.method(Date, "now", () => calls++ < 2 ? 0 : 31_000);
  await assert.rejects(f.create(), { code: "SQLITE_BACKUP_TIMEOUT" });
  assert.ok(calls >= 3, "deadline is reached inside the actual backup progress callback");
  await assertNoCompletedBundle(f.backupRoot);
  t.mock.restoreAll();
  assert.equal(f.db.prepare("SELECT n FROM x").get().n, 1);
});

test("verification rejects missing manifests, altered bytes, forged summaries and extra WAL/SHM files", async (t) => {
  const f = await fixture(t); f.db.exec("CREATE TABLE x(n); INSERT INTO x VALUES(1)");
  const missing = await f.create(); await rm(join(missing.directory, "manifest.json"));
  await assert.rejects(verifySqliteBackup({ directory: missing.directory }), { code: "ENOENT" });
  const changed = await f.create(); const db = new DatabaseSync(changed.databasePath); db.exec("UPDATE x SET n=2"); db.close();
  await assert.rejects(verifySqliteBackup({ directory: changed.directory }), /do not match/);
  const fake = await f.create(); fake.manifest.tables[0].rowCount = 99;
  await writeFile(join(fake.directory, "manifest.json"), JSON.stringify(fake.manifest));
  await assert.rejects(verifySqliteBackup({ directory: fake.directory }), /do not match/);
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const extra = await f.create(); await writeFile(extra.databasePath + suffix, "untrusted");
    await assert.rejects(verifySqliteBackup({ directory: extra.directory }), /unexpected files|sidecars/);
  }
});

test("even a matching byte checksum cannot bypass SQLite structure and foreign-key checks", async (t) => {
  const f = await fixture(t); f.db.exec("CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id))");
  const good = await f.create();
  const db = new DatabaseSync(good.databasePath, { enableForeignKeyConstraints: false }); db.exec("INSERT INTO child VALUES(99)"); db.close();
  const bytes = await readFile(good.databasePath); good.manifest.database.bytes = bytes.length; good.manifest.database.sha256 = sha256(bytes);
  await writeFile(join(good.directory, "manifest.json"), JSON.stringify(good.manifest));
  await assert.rejects(verifySqliteBackup({ directory: good.directory }), /foreign_key_check failed/);
});

test("restoration refuses existing/source destinations and never invalidates its original bundle", async (t) => {
  const f = await fixture(t); f.db.exec("CREATE TABLE x(n); INSERT INTO x VALUES(1)");
  const copy = await f.create(); const existing = join(f.directory, "existing"); await mkdir(existing); await writeFile(join(existing, "keep"), "must survive");
  for (const destination of [existing, copy.directory, join(copy.directory, "nested"), f.sourcePath]) {
    await assert.rejects(restoreSqliteBackup({ directory: copy.directory, destination }), { code: "SQLITE_BACKUP_DESTINATION_EXISTS" });
  }
  assert.equal(await readFile(join(existing, "keep"), "utf8"), "must survive");
  await verifySqliteBackup({ directory: copy.directory });
  const broken = await f.create(); await writeFile(join(broken.directory, "manifest.json"), "{}");
  const destination = join(f.directory, "must-not-be-created");
  await assert.rejects(restoreSqliteBackup({ directory: broken.directory, destination }));
  await assert.rejects(stat(destination), { code: "ENOENT" });
});

test("symbolic-link source, manifest, database, bundle and existing destination are refused", { skip: process.platform === "win32" ? "Windows symlink permissions require a dedicated runner" : false }, async (t) => {
  const f = await fixture(t); f.db.exec("CREATE TABLE x(n)");
  const alias = join(f.directory, "source-link"); await symlink(f.sourcePath, alias);
  await assert.rejects(createSqliteBackup({ sourcePath: alias, backupRoot: f.backupRoot }), /symbolic-link/);
  const copy = await f.create(); const bundleLink = join(f.directory, "bundle-link"); await symlink(copy.directory, bundleLink);
  await assert.rejects(verifySqliteBackup({ directory: bundleLink }), /symbolic-link/);
  const destination = join(f.directory, "destination-link"); await symlink(copy.directory, destination);
  await assert.rejects(restoreSqliteBackup({ directory: copy.directory, destination }), { code: "SQLITE_BACKUP_DESTINATION_EXISTS" });
  for (const name of ["manifest.json", "database.sqlite"]) {
    const other = await f.create(); await rm(join(other.directory, name)); await symlink(join(copy.directory, name), join(other.directory, name));
    await assert.rejects(verifySqliteBackup({ directory: other.directory }), /symbolic-link/);
  }
});

test("a real product database restores changed accounts, completed reports and nonempty version-bound feedback without reseeding", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "physics-product-restore-")); t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = join(directory, "product.sqlite");
  const config = loadConfig({ databaseUrl: "", databasePath: sourcePath, seedDemoData: false,
    bootstrapSchoolName: "隔离恢复学校", bootstrapAdminName: "隔离管理员", bootstrapAdminEmail: "restore-admin@example.invalid", bootstrapAdminPassword: "SyntheticRestoreOnly123!",
    tokenSecret: "restore-test-secret", deepseekApiKey: "", siliconflowApiKey: "", liliEnabled: false, guangguangEnabled: false, vectorRagEnabled: false });
  const original = await openDatabase(config); let restored;
  t.after(async () => { await restored?.close(); await original.close(); });
  const now = "2026-11-11T00:00:00Z";
  const learner = { id: "restore-student", schoolId: "school-primary", role: "student", name: "合成学生" };
  const teacher = { id: "restore-teacher", schoolId: "school-primary", role: "teacher", name: "合成教师" };
  for (const user of [learner, teacher]) await original.run("INSERT INTO users(id,school_id,email,password_hash,name,role,created_at) VALUES(?,?,?,?,?,?,?)", [user.id, user.schoolId, `${user.id}@example.invalid`, hashPassword("SyntheticStudentOnly123!"), user.name, user.role, now]);
  await original.run("UPDATE users SET name=?,email=?,password_hash=?,status=? WHERE id=?", ["更名后管理员", "changed-admin@example.invalid", hashPassword("ChangedSyntheticOnly123!"), "disabled", "user-admin"]);
  await original.run("INSERT INTO classes(id,school_id,name,grade,join_code,created_by,created_at) VALUES(?,?,?,?,?,?,?)", ["restore-class", "school-primary", "恢复班", "高一", "RESTORE", teacher.id, now]);
  await original.run("INSERT INTO class_members(class_id,user_id,joined_at) VALUES(?,?,?)", ["restore-class", learner.id, now]);
  await original.run("INSERT INTO lessons(id,school_id,created_by,experiment_id,title,objective,inquiry_question,duration_minutes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", ["restore-lesson", "school-primary", teacher.id, "mechanical-energy", "纸带恢复课例", "比较能量", "两点间怎样求速度？", 40, "ready", now, now]);
  await original.run("INSERT INTO tasks(id,school_id,class_id,lesson_id,title,mode,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", ["restore-task", "school-primary", "restore-class", "restore-lesson", "纸带恢复任务", "in-class", "published", teacher.id, now, now]);
  await original.run("INSERT INTO sessions(id,school_id,task_id,class_id,learner_id,experiment_id,status,started_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", ["restore-session", "school-primary", "restore-task", "restore-class", learner.id, "mechanical-energy", "active", now, now]);
  const content = { prediction: "  无阻力模型的机械能守恒。\n", measurements: "A/B为内部点；六个自主读数，ΔK=0.075 J。", conclusion: "仍须核对共享点及量化。", question: "阻力和读尺误差如何区分？" };
  await saveSessionLearningRecord(original, learner, "restore-session", { ...content, expectedRevision: 0, mutationId: "restore-report" });
  const feedbackInput = { body: "  请补充两侧平均速度的计算过程。\n", expectedRevision: 1, mutationId: "restore-feedback" };
  const feedback = await createSessionLearningFeedback(original, teacher, "restore-session", feedbackInput);
  await original.run("UPDATE sessions SET status='completed',completed_at=?,updated_at=? WHERE id=?", [now, now, "restore-session"]);
  await original.run("INSERT INTO observations(id,session_id,learner_id,text,created_at) VALUES(?,?,?,?,?)", ["restore-observation", "restore-session", learner.id, "保留原始观察", now]);
  const beforeRecord = await getSessionLearningRecord(original, learner, "restore-session");
  const backup = await createSqliteBackup({ sourcePath, backupRoot: join(directory, "backups") });
  assert.equal(backup.manifest.tables.length, 13);
  assert.equal(backup.manifest.tables.find(({ name }) => name === "session_learning_feedback").rowCount, 1);
  const copy = await restoreSqliteBackup({ directory: backup.directory, destination: join(directory, "restored") });
  restored = await openDatabase({ ...config, databasePath: copy.databasePath, seedDemoData: true, bootstrapAdminEmail: "", bootstrapAdminPassword: "" });
  assert.equal(restored.initialization.mode, "existing");
  assert.deepEqual(await getSessionLearningRecord(restored, learner, "restore-session"), beforeRecord);
  assert.deepEqual(await listSessionLearningFeedback(restored, learner, "restore-session"), [feedback]);
  assert.deepEqual(await createSessionLearningFeedback(restored, teacher, "restore-session", feedbackInput), feedback, "mutation retry keeps its original id and version snapshot");
  await assert.rejects(saveSessionLearningRecord(restored, learner, "restore-session", { ...content, expectedRevision: 1, mutationId: "must-not-save" }), { code: "SESSION_COMPLETED" });
  const admin = await restored.get("SELECT * FROM users WHERE id=?", ["user-admin"]);
  assert.equal(admin.name, "更名后管理员"); assert.equal(admin.status, "disabled"); assert.equal(admin.email, "changed-admin@example.invalid");
  assert.ok(verifyPassword("ChangedSyntheticOnly123!", admin.password_hash));
  assert.equal(Number((await restored.get("SELECT COUNT(*) n FROM users")).n), 3, "no deleted/unseeded demo students are created");
  // Capture the restored live WAL database again: all schema and typed table
  // digests must still equal the original, including idempotent feedback retry.
  const second = await createSqliteBackup({ sourcePath: copy.databasePath, backupRoot: join(directory, "second-backups") });
  assert.deepEqual(second.manifest.schema, backup.manifest.schema);
  assert.deepEqual(second.manifest.tables, backup.manifest.tables);
  assert.equal((await verifySqliteBackup({ directory: backup.directory })).manifest.database.sha256, backup.manifest.database.sha256);
});
