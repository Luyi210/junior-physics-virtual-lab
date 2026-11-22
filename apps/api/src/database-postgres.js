import pg from "pg";
import { hashPassword } from "./security.js";
import { countInvalidDatabaseIdentities, initializationResult, planDatabaseInitialization } from "./database-initialization.js";

const schema = `
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    last_login_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS class_members (
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY(class_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    experiment_id TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    inquiry_question TEXT NOT NULL,
    prediction_prompt TEXT,
    controlled_variable TEXT,
    evidence_requirement TEXT,
    reflection_prompt TEXT,
    duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('draft','ready','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    lesson_id TEXT NOT NULL REFERENCES lessons(id),
    title TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('before-class','in-class','after-class')),
    status TEXT NOT NULL CHECK(status IN ('draft','published','closed','archived')),
    opens_at TEXT,
    due_at TEXT,
    allow_retry INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    task_id TEXT NOT NULL REFERENCES tasks(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    learner_id TEXT NOT NULL REFERENCES users(id),
    experiment_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active','completed')),
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS session_learning_records (
    session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id),
    prediction TEXT NOT NULL,
    measurements TEXT NOT NULL,
    conclusion TEXT NOT NULL,
    question TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision > 0),
    last_mutation_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session_learning_feedback (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    task_id TEXT NOT NULL REFERENCES tasks(id),
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL CHECK(author_role IN ('teacher','admin')),
    body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
    report_revision INTEGER NOT NULL CHECK(report_revision > 0),
    report_updated_at TEXT NOT NULL,
    report_prediction TEXT NOT NULL,
    report_measurements TEXT NOT NULL,
    report_conclusion TEXT NOT NULL,
    report_question TEXT NOT NULL,
    mutation_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(author_id, session_id, mutation_id)
  );

  CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    area TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS class_prompts (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learner_memories (
    id TEXT NOT NULL,
    school_id TEXT NOT NULL REFERENCES schools(id),
    learner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL CHECK(scope IN ('junior','high-school')),
    experiment_id TEXT,
    kind TEXT NOT NULL CHECK(kind IN ('misconception','goal','strength','preference')),
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 1 CHECK(evidence_count > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(school_id, learner_id, id)
  );

  CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON class_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_lessons_school ON lessons(school_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id, status);
  CREATE INDEX IF NOT EXISTS idx_sessions_class_status ON sessions(class_id, status);
  CREATE INDEX IF NOT EXISTS idx_feedback_session ON session_learning_feedback(session_id, created_at, id);
  CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id, occurred_at);
  CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_learner_memories_owner ON learner_memories(school_id, learner_id, scope, updated_at);
`;

function placeholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function clientAdapter(client) {
  return {
    dialect: "postgresql",
    async get(sql, params = []) { return (await client.query(placeholders(sql), params)).rows[0]; },
    async all(sql, params = []) { return (await client.query(placeholders(sql), params)).rows; },
    async run(sql, params = []) {
      const result = await client.query(placeholders(sql), params);
      return { changes: result.rowCount ?? 0 };
    },
    async exec(sql) { await client.query(sql); }
  };
}

async function initializationState(database) {
  const schools = await database.get("SELECT COUNT(*) AS count FROM schools");
  const users = await database.get("SELECT COUNT(*) AS count FROM users");
  const orphans = await database.get("SELECT COUNT(*) AS count FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE s.id IS NULL");
  const invalidIdentityCount = countInvalidDatabaseIdentities(
    await database.all("SELECT id FROM schools"),
    await database.all("SELECT id, school_id FROM users")
  );
  const administrators = await database.all("SELECT email, password_hash FROM users WHERE role = 'admin'");
  return {
    dialect: "postgresql",
    schoolCount: Number(schools.count),
    userCount: Number(users.count),
    orphanUserCount: Number(orphans.count),
    invalidIdentityCount,
    administrators: administrators.map((row) => ({ email: row.email, passwordHash: row.password_hash }))
  };
}

async function bootstrap(database, plan) {
  const now = new Date().toISOString();
  await database.run("INSERT INTO schools (id, name, created_at) VALUES (?, ?, ?)", ["school-primary", plan.schoolName, now]);
  await database.run(
    "INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ["user-admin", "school-primary", plan.adminEmail, hashPassword(plan.adminPassword), plan.adminName, "admin", now]
  );
}

export async function openPostgresDatabase(config, options = {}) {
  const ownsPool = options.pool == null;
  const pool = options.pool ?? new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  const base = clientAdapter(pool);
  const database = {
    ...base,
    async transaction(work) {
      const client = await pool.connect();
      const transaction = clientAdapter(client);
      try {
        await client.query("BEGIN");
        const result = await work(transaction);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    // An injected pool belongs to its caller, on both success and failure.
    async close() { if (ownsPool) await pool.end(); }
  };
  try {
    const client = await pool.connect();
    const connection = clientAdapter(client);
    let began = false, failure, rollbackFailure;
    try {
      await client.query("BEGIN");
      began = true;
      // Every initializer uses this transaction-scoped lock on the same client,
      // including schema creation and the read-before-insert policy decision.
      await client.query("SELECT pg_advisory_xact_lock(1819271539, 1701736308)");
      await connection.exec(schema);
      const plan = planDatabaseInitialization(await initializationState(connection), config);
      if (plan.mode === "bootstrap") await bootstrap(connection, plan);
      await client.query("COMMIT");
      database.initialization = initializationResult(plan);
    } catch (error) {
      failure = error;
      if (began) {
        try { await client.query("ROLLBACK"); } catch (error) { rollbackFailure = error; }
      }
      throw error;
    } finally {
      // An unconfirmed rollback must not return a possibly active transaction
      // to a caller-owned pool; release(error) discards only this connection.
      try { client.release(rollbackFailure); } catch (error) { if (!failure) throw error; }
    }
  } catch (error) {
    if (ownsPool) {
      try { await pool.end(); } catch { /* Preserve the initialization failure. */ }
    }
    throw error;
  }
  return database;
}
