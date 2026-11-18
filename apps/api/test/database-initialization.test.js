import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { countInvalidDatabaseIdentities, initializationMessage, initializationResult, planDatabaseInitialization } from "../src/database-initialization.js";

const empty = { dialect: "sqlite", schoolCount: 0, userCount: 0, orphanUserCount: 0, invalidIdentityCount: 0, administrators: [] };
const existing = { ...empty, schoolCount: 1, userCount: 3, administrators: [{ email: "owner@example.invalid", passwordHash: "existing-hash", status: "disabled" }] };
const bootstrap = { seedDemoData: false, bootstrapAdminEmail: " OWNER@EXAMPLE.INVALID ", bootstrapAdminPassword: " LongPassword123! ", bootstrapAdminName: " 管理员 ", bootstrapSchoolName: " 学校 " };

test("existing accounts take precedence over every bootstrap/demo setting without exposing or validating a replacement password", () => {
  for (const dialect of ["sqlite", "postgresql"]) for (const seedDemoData of [false, true]) {
    const plan = planDatabaseInitialization({ ...existing, dialect }, { seedDemoData, bootstrapAdminEmail: "invalid", bootstrapAdminPassword: "x" });
    assert.deepEqual(plan, { mode: "existing" });
    assert.deepEqual(initializationResult(plan), { mode: "existing", created: false });
    assert.doesNotMatch(initializationMessage(initializationResult(plan)), /invalid|password|created \(/);
  }
});

test("empty SQLite demo initializes explicitly while empty PostgreSQL demo fails instead of creating an empty administrator", () => {
  assert.deepEqual(initializationResult(planDatabaseInitialization(empty, { seedDemoData: true })), { mode: "demo", created: true, schoolId: "school-demo" });
  assert.throws(() => planDatabaseInitialization({ ...empty, dialect: "postgresql" }, { ...bootstrap, seedDemoData: true }), { code: "DATABASE_DEMO_UNSUPPORTED" });
});

test("bootstrap normalizes identity text but preserves password bytes; the returned public result and log contain no secret", () => {
  const plan = planDatabaseInitialization(empty, bootstrap);
  assert.equal(plan.adminEmail, "owner@example.invalid");
  assert.equal(plan.adminName, "管理员"); assert.equal(plan.schoolName, "学校");
  assert.equal(plan.adminPassword, bootstrap.bootstrapAdminPassword);
  const result = initializationResult(plan);
  assert.deepEqual(result, { mode: "bootstrap", created: true, schoolId: "school-primary", adminEmail: "owner@example.invalid" });
  assert.ok(!JSON.stringify(result).includes("LongPassword123"));
  assert.ok(!initializationMessage(result).includes("LongPassword123"));
});

test("partial schools/users, orphan owners and legacy blank administrator email fail without a recovery-by-configuration path", () => {
  for (const state of [
    { ...empty, schoolCount: 1 }, { ...empty, userCount: 1 }, { ...existing, orphanUserCount: 1 }, { ...existing, invalidIdentityCount: 1 },
    { ...existing, administrators: [] }, { ...existing, administrators: [{ email: "", passwordHash: "hash-of-an-empty-password" }] },
    { ...existing, administrators: [{ email: "owner@example.invalid", passwordHash: "" }] }
  ]) for (const seedDemoData of [true, false]) {
    assert.throws(() => planDatabaseInitialization(state, { ...bootstrap, seedDemoData }), { code: "DATABASE_INITIALIZATION_INCOMPLETE" });
  }
});

test("only empty formal databases validate credentials; invalid values fail without reflecting them in error messages", () => {
  for (const changes of [
    { bootstrapAdminEmail: "" }, { bootstrapAdminEmail: "injected-secret" }, { bootstrapAdminPassword: "short" },
    { bootstrapAdminPassword: " ".repeat(12) }, { bootstrapAdminPassword: "x".repeat(201) },
    { bootstrapAdminName: " " }, { bootstrapSchoolName: "x".repeat(161) }
  ]) {
    assert.throws(() => planDatabaseInitialization(empty, { ...bootstrap, ...changes }), (error) => error.code === "DATABASE_INITIALIZATION_CONFIG_INVALID" && !error.message.includes("injected-secret"));
  }
});

test("unreadable state cannot be interpreted as an empty database", () => {
  const { invalidIdentityCount: omitted, ...missingIdentityCount } = empty;
  for (const state of [{ ...empty, schoolCount: NaN }, { ...empty, userCount: "0" }, { ...empty, dialect: "unknown" }, { ...empty, administrators: null },
    missingIdentityCount, ...[undefined, null, "0", -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map((invalidIdentityCount) => ({ ...empty, invalidIdentityCount }))]) {
    assert.throws(() => planDatabaseInitialization(state, bootstrap), { code: "DATABASE_INITIALIZATION_STATE_INVALID" });
  }
  assert.throws(() => initializationMessage({}), { code: "DATABASE_INITIALIZATION_STATE_INVALID" });
});

test("identity validation covers every school and user, including non-ASCII whitespace without changing opaque IDs", () => {
  assert.equal(countInvalidDatabaseIdentities([{ id: "school" }], [{ id: "admin", school_id: "school" }]), 0);
  for (const invalid of [null, undefined, "", " \t\r\n", "\u3000\u00a0", 0]) {
    assert.equal(countInvalidDatabaseIdentities([{ id: invalid }], []), 1);
    assert.equal(countInvalidDatabaseIdentities([], [{ id: invalid, school_id: "school" }]), 1);
    assert.equal(countInvalidDatabaseIdentities([], [{ id: "student", school_id: invalid }]), 1);
  }
  assert.equal(countInvalidDatabaseIdentities([{ id: " school " }], [{ id: " user ", school_id: " school " }]), 0);
});

test("PostgreSQL defaults to formal initialization while the explicit demo choice remains visible to policy", () => {
  const env = { ...process.env };
  try {
    delete process.env.PHYSICS_API_SEED_DEMO; delete process.env.RENDER;
    process.env.NODE_ENV = "development";
    assert.equal(loadConfig({ databaseUrl: "postgresql://example.invalid/test" }).seedDemoData, false);
    assert.equal(loadConfig({ databaseUrl: "" }).seedDemoData, true);
    assert.equal(loadConfig({ databaseUrl: "postgresql://example.invalid/test", seedDemoData: true }).seedDemoData, true);
    process.env.PHYSICS_API_SEED_DEMO = "true";
    assert.equal(loadConfig({ databaseUrl: "postgresql://example.invalid/test" }).seedDemoData, true);
    process.env.NODE_ENV = "production"; delete process.env.PHYSICS_API_SEED_DEMO;
    assert.equal(loadConfig({ databaseUrl: "" }).seedDemoData, false);
  } finally {
    for (const key of ["PHYSICS_API_SEED_DEMO", "RENDER", "NODE_ENV"]) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
  }
});
