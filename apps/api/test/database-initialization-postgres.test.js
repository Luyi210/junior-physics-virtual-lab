import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { openPostgresDatabase } from "../src/database-postgres.js";
import { hashPassword, verifyPassword } from "../src/security.js";
import { isolatedSqliteConfig } from "./helpers/isolated-config.js";
import { createMemoryPostgres } from "./helpers/postgres-memory.js";

const config = (overrides = {}) => isolatedSqliteConfig({
  seedDemoData: false,
  bootstrapSchoolName: "  初始化测试学校  ",
  bootstrapAdminName: "  首位管理员  ",
  bootstrapAdminEmail: " OWNER@EXAMPLE.INVALID ",
  bootstrapAdminPassword: "InitializationOnly123!",
  ...overrides
});
const lockSql = "SELECT pg_advisory_xact_lock(1819271539, 1701736308)";

// This adapter records which connection receives every statement. It tests the
// real startup control flow, not PostgreSQL rollback or lock implementation.
function recordingPool({ schoolCount = 0, userCount = 0, orphanUserCount = 0, administrators = [], invalidSchoolIds = [], invalidUserIdentities = [], failAt, connectError, rollbackError, endError } = {}) {
  const calls = [];
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params, via: "client" });
      if (failAt?.(sql)) throw failure;
      if (sql === "ROLLBACK" && rollbackError) throw rollbackError;
      if (sql === "SELECT COUNT(*) AS count FROM schools") return { rows: [{ count: String(schoolCount) }] };
      if (sql === "SELECT COUNT(*) AS count FROM users") return { rows: [{ count: String(userCount) }] };
      if (sql.startsWith("SELECT COUNT(*) AS count FROM users u LEFT JOIN schools")) return { rows: [{ count: String(orphanUserCount) }] };
      if (sql === "SELECT id FROM schools") return { rows: invalidSchoolIds.map((id) => ({ id })) };
      if (sql === "SELECT id, school_id FROM users") return { rows: invalidUserIdentities };
      if (sql.startsWith("SELECT email, password_hash FROM users")) return { rows: administrators.map((row) => ({ email: row.email, password_hash: row.passwordHash })) };
      return { rows: [], rowCount: sql.startsWith("INSERT") ? 1 : 0 };
    },
    release(error) { calls.push({ sql: "release", via: "client", error }); }
  };
  const failure = new Error("intentional initialization failure");
  const pool = {
    async connect() { calls.push({ sql: "connect", via: "pool" }); if (connectError) throw connectError; return client; },
    async query(sql) { calls.push({ sql, via: "pool" }); throw new Error("Initialization must not query the pool outside its locked client"); },
    async end() { calls.push({ sql: "end", via: "pool" }); if (endError) throw endError; }
  };
  return { pool, calls, failure };
}

test("PostgreSQL initialization uses one locked client and strict inserts before commit", async () => {
  const fixture = recordingPool();
  const database = await openPostgresDatabase(config(), { pool: fixture.pool });
  const sql = fixture.calls.map((call) => call.sql);
  assert.equal(sql[0], "connect");
  assert.equal(sql[1], "BEGIN");
  assert.equal(sql[2], lockSql);
  assert.match(sql[3], /CREATE TABLE IF NOT EXISTS schools/);
  assert.equal(sql[4], "SELECT COUNT(*) AS count FROM schools");
  const inserts = fixture.calls.filter((call) => call.sql.startsWith("INSERT"));
  assert.equal(inserts.length, 2);
  assert.ok(inserts.every((call) => call.via === "client" && !call.sql.includes("ON CONFLICT")));
  assert.deepEqual(inserts[0].params.slice(0, 2), ["school-primary", "初始化测试学校"]);
  assert.deepEqual(inserts[1].params.slice(0, 3), ["user-admin", "school-primary", "owner@example.invalid"]);
  assert.equal(inserts[1].params[4], "首位管理员");
  assert.equal(verifyPassword("InitializationOnly123!", inserts[1].params[3]), true);
  assert.equal(sql.at(-2), "COMMIT");
  assert.equal(sql.at(-1), "release");
  assert.equal(database.initialization.mode, "bootstrap");
  assert.doesNotMatch(JSON.stringify(database.initialization), /InitializationOnly|scrypt\$/);
  await database.close();
  assert.equal(fixture.calls.filter((call) => call.sql === "end").length, 0, "borrowed pools remain caller-owned after success");
});

test("existing PostgreSQL accounts ignore bootstrap credentials and the demo flag without insert/update", async () => {
  const fixture = recordingPool({ schoolCount: 2, userCount: 4, administrators: [{ email: "real@school.invalid", passwordHash: "stored-hash" }] });
  const database = await openPostgresDatabase(config({ seedDemoData: true, bootstrapAdminEmail: "", bootstrapAdminPassword: "" }), { pool: fixture.pool });
  assert.equal(database.initialization.mode, "existing");
  assert.equal(fixture.calls.some((call) => /^(INSERT|UPDATE|DELETE)/.test(call.sql)), false);
  assert.equal(fixture.calls.filter((call) => call.sql === lockSql).length, 1);
  await database.close();
});

test("an empty PostgreSQL demo request is rejected before any business insert", async () => {
  const fixture = recordingPool();
  await assert.rejects(openPostgresDatabase(config({ seedDemoData: true, bootstrapAdminEmail: "", bootstrapAdminPassword: "" }), { pool: fixture.pool }), { code: "DATABASE_DEMO_UNSUPPORTED" });
  assert.equal(fixture.calls.some((call) => call.sql.startsWith("INSERT")), false);
  assert.deepEqual(fixture.calls.slice(-2).map((call) => call.sql), ["ROLLBACK", "release"]);
  assert.equal(fixture.calls.some((call) => call.sql === "end"), false);
});

for (const [label, state] of [
  ["school without accounts", { schoolCount: 1 }],
  ["orphan user even beside a valid administrator", { schoolCount: 1, userCount: 2, orphanUserCount: 1, administrators: [{ email: "admin@school.invalid", passwordHash: "stored-hash" }] }],
  ["accounts without an administrator", { schoolCount: 1, userCount: 1 }],
  ["administrator with an invalid email", { schoolCount: 1, userCount: 1, administrators: [{ email: "", passwordHash: "stored-hash" }] }],
  ["administrator without a password hash", { schoolCount: 1, userCount: 1, administrators: [{ email: "admin@school.invalid", passwordHash: "" }] }],
  ["blank school identifier", { schoolCount: 1, userCount: 1, administrators: [{ email: "admin@school.invalid", passwordHash: "stored-hash" }], invalidSchoolIds: ["\t\u3000"] }],
  ["blank user identifier", { schoolCount: 1, userCount: 1, administrators: [{ email: "admin@school.invalid", passwordHash: "stored-hash" }], invalidUserIdentities: [{ id: "", school_id: "school" }] }],
  ["blank school membership identifier", { schoolCount: 1, userCount: 1, administrators: [{ email: "admin@school.invalid", passwordHash: "stored-hash" }], invalidUserIdentities: [{ id: "admin", school_id: "" }] }]
]) {
  test(`partial PostgreSQL state (${label}) is not silently repaired with bootstrap records`, async () => {
    const fixture = recordingPool(state);
    await assert.rejects(openPostgresDatabase(config(), { pool: fixture.pool }), (error) => String(error.code).startsWith("DATABASE_"));
    assert.equal(fixture.calls.some((call) => call.sql.startsWith("INSERT")), false);
    assert.deepEqual(fixture.calls.slice(-2).map((call) => call.sql), ["ROLLBACK", "release"]);
  });
}

for (const [label, failAt] of [
  ["lock acquisition", (sql) => sql === lockSql],
  ["schema creation", (sql) => sql.includes("CREATE TABLE")],
  ["state read", (sql) => sql === "SELECT COUNT(*) AS count FROM users"],
  ["second bootstrap insert", (sql) => sql.startsWith("INSERT INTO users")],
  ["commit", (sql) => sql === "COMMIT"]
]) {
  test(`PostgreSQL ${label} failure rolls back and releases without ending a caller pool`, async () => {
    const fixture = recordingPool({ failAt });
    await assert.rejects(openPostgresDatabase(config(), { pool: fixture.pool }), (error) => error === fixture.failure);
    assert.deepEqual(fixture.calls.slice(-2).map((call) => call.sql), ["ROLLBACK", "release"]);
    assert.equal(fixture.calls.filter((call) => call.sql === "release").length, 1);
    assert.equal(fixture.calls.some((call) => call.sql === "end"), false);
    if (label !== "commit") assert.equal(fixture.calls.some((call) => call.sql === "COMMIT"), false);
  });
}

test("owned PostgreSQL pool closes after a startup failure while preserving the original error", async (t) => {
  const rollbackError = new Error("rollback disconnected");
  const fixture = recordingPool({ failAt: (sql) => sql.startsWith("INSERT INTO users"), rollbackError, endError: new Error("pool end disconnected") });
  t.mock.method(pg, "Pool", function () { return fixture.pool; });
  await assert.rejects(openPostgresDatabase(config()), (error) => error === fixture.failure);
  assert.deepEqual(fixture.calls.slice(-3).map((call) => call.sql), ["ROLLBACK", "release", "end"]);
  assert.equal(fixture.calls.find((call) => call.sql === "release").error, rollbackError);
});

test("a failed startup rollback discards its client without closing the borrowed PostgreSQL pool or replacing the cause", async () => {
  const rollbackError = new Error("rollback could not be confirmed");
  const fixture = recordingPool({ failAt: (sql) => sql.startsWith("INSERT INTO users"), rollbackError });
  await assert.rejects(openPostgresDatabase(config(), { pool: fixture.pool }), (error) => error === fixture.failure);
  assert.deepEqual(fixture.calls.slice(-2).map((call) => call.sql), ["ROLLBACK", "release"]);
  assert.equal(fixture.calls.filter((call) => call.sql === "release").length, 1);
  assert.equal(fixture.calls.find((call) => call.sql === "release").error, rollbackError);
  assert.equal(fixture.calls.some((call) => call.sql === "end"), false);
});

test("owned PostgreSQL connection acquisition failure closes its pool without a fictitious transaction", async (t) => {
  const error = new Error("connection refused");
  const fixture = recordingPool({ connectError: error });
  t.mock.method(pg, "Pool", function () { return fixture.pool; });
  await assert.rejects(openPostgresDatabase(config()), (caught) => caught === error);
  assert.deepEqual(fixture.calls.map((call) => call.sql), ["connect", "end"]);
});

test("a successful owned PostgreSQL pool closes only when the database owner closes it", async (t) => {
  const fixture = recordingPool();
  t.mock.method(pg, "Pool", function () { return fixture.pool; });
  const database = await openPostgresDatabase(config());
  assert.equal(fixture.calls.some((call) => call.sql === "end"), false);
  await database.close();
  assert.equal(fixture.calls.at(-1).sql, "end");
});

test("the ordinary PostgreSQL transaction interface still uses and releases its own client", async () => {
  const fixture = recordingPool();
  const database = await openPostgresDatabase(config(), { pool: fixture.pool });
  fixture.calls.length = 0;
  const value = await database.transaction(async (tx) => { await tx.run("INSERT INTO observations (id) VALUES (?)", ["transaction-probe"]); return "saved"; });
  assert.equal(value, "saved");
  assert.deepEqual(fixture.calls.map((call) => call.sql), ["connect", "BEGIN", "INSERT INTO observations (id) VALUES ($1)", "COMMIT", "release"]);
  fixture.calls.length = 0;
  const failure = new Error("work rejected");
  await assert.rejects(database.transaction(async () => { throw failure; }), (error) => error === failure);
  assert.deepEqual(fixture.calls.map((call) => call.sql), ["connect", "BEGIN", "ROLLBACK", "release"]);
});

test("pg-mem SQL compatibility: reopening preserves changed account identity and hash without requiring bootstrap credentials", async () => {
  const { pool } = createMemoryPostgres({ allowRepeatedSchema: true });
  try {
    const database = await openPostgresDatabase(config(), { pool });
    const changedHash = hashPassword("ChangedByAdmin123!");
    await database.run("UPDATE users SET email=?, name=?, password_hash=?, status=? WHERE id=?", ["renamed@school.invalid", "真实管理员", changedHash, "disabled", "user-admin"]);
    const before = await database.all("SELECT * FROM users ORDER BY id");
    const schoolsBefore = await database.all("SELECT * FROM schools ORDER BY id");
    await database.close();
    const reopened = await openPostgresDatabase(config({ seedDemoData: true, bootstrapAdminEmail: "", bootstrapAdminPassword: "" }), { pool });
    assert.equal(reopened.initialization.mode, "existing");
    assert.deepEqual(await reopened.all("SELECT * FROM users ORDER BY id"), before);
    assert.deepEqual(await reopened.all("SELECT * FROM schools ORDER BY id"), schoolsBefore);
    assert.equal(verifyPassword("ChangedByAdmin123!", before[0].password_hash), true);
    assert.equal(verifyPassword("InitializationOnly123!", before[0].password_hash), false);
    await reopened.close();
  } finally { await pool.end(); }
});

test("pg-mem SQL compatibility: a valid custom school is not joined by school-primary on reopening", async () => {
  const { pool } = createMemoryPostgres({ allowRepeatedSchema: true });
  try {
    const database = await openPostgresDatabase(config(), { pool });
    await database.run("INSERT INTO schools (id, name, created_at) VALUES (?, ?, ?)", ["school-custom", "已有学校", "2026-11-11T00:00:00Z"]);
    await database.run("INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ["admin-custom", "school-custom", "custom@school.invalid", hashPassword("CustomAdmin123!"), "已有管理员", "admin", "2026-11-11T00:00:00Z"]);
    await database.run("DELETE FROM users WHERE id=?", ["user-admin"]);
    await database.run("DELETE FROM schools WHERE id=?", ["school-primary"]);
    const reopened = await openPostgresDatabase(config({ bootstrapAdminEmail: "", bootstrapAdminPassword: "" }), { pool });
    assert.deepEqual((await reopened.all("SELECT id FROM schools ORDER BY id")).map((row) => row.id), ["school-custom"]);
    assert.deepEqual((await reopened.all("SELECT id FROM users ORDER BY id")).map((row) => row.id), ["admin-custom"]);
    assert.equal(reopened.initialization.mode, "existing");
    await reopened.close(); await database.close();
  } finally { await pool.end(); }
});

for (const kind of ["empty administrator id", "empty school and school membership id"]) {
  test(`pg-mem SQL compatibility: ${kind} fails without rewriting existing identities`, async () => {
    const { pool } = createMemoryPostgres({ allowRepeatedSchema: true });
    try {
      const database = await openPostgresDatabase(config(), { pool });
      if (kind === "empty administrator id") await database.run("UPDATE users SET id='' WHERE id='user-admin'");
      else {
        await database.run("INSERT INTO schools(id,name,created_at) VALUES(?,?,?)", ["", "保留的损坏学校", "2026-11-11"]);
        await database.run("UPDATE users SET school_id='' WHERE id='user-admin'");
      }
      const before = { schools: await database.all("SELECT * FROM schools ORDER BY id"), users: await database.all("SELECT * FROM users ORDER BY id") };
      await database.close();
      for (const changes of [{ seedDemoData: true }, { bootstrapAdminEmail: "replacement@school.invalid" }]) {
        await assert.rejects(openPostgresDatabase(config(changes), { pool }), { code: "DATABASE_INITIALIZATION_INCOMPLETE" });
        assert.deepEqual({ schools: await database.all("SELECT * FROM schools ORDER BY id"), users: await database.all("SELECT * FROM users ORDER BY id") }, before);
      }
    } finally { await pool.end(); }
  });
}

test("pg-mem SQL compatibility: first initialization normalizes names and email and returns no password material", async () => {
  const { pool } = createMemoryPostgres();
  try {
    const database = await openPostgresDatabase(config(), { pool });
    assert.equal((await database.get("SELECT name FROM schools")).name, "初始化测试学校");
    const users = await database.all("SELECT * FROM users");
    assert.equal(users.length, 1);
    assert.equal(users[0].email, "owner@example.invalid");
    assert.equal(users[0].name, "首位管理员");
    assert.equal(verifyPassword("InitializationOnly123!", users[0].password_hash), true);
    assert.equal((await database.all("SELECT id FROM classes")).length, 0);
    assert.equal((await database.all("SELECT id FROM lessons")).length, 0);
    assert.equal(database.initialization.mode, "bootstrap");
    assert.doesNotMatch(JSON.stringify(database.initialization), /InitializationOnly|scrypt\$|adminPassword|passwordHash/);
    await database.close();
  } finally { await pool.end(); }
});
