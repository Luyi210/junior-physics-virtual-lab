import pg from "pg";
import { hashPassword } from "./security.js";

const { Pool } = pg;

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

  CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON class_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_lessons_school ON lessons(school_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id, status);
  CREATE INDEX IF NOT EXISTS idx_sessions_class_status ON sessions(class_id, status);
  CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id, occurred_at);
  CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(session_id, created_at);
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

async function bootstrap(database, config) {
  const now = new Date().toISOString();
  await database.run("INSERT INTO schools (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", ["school-primary", config.bootstrapSchoolName, now]);
  await database.run(
    "INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
    ["user-admin", "school-primary", config.bootstrapAdminEmail.toLowerCase(), hashPassword(config.bootstrapAdminPassword), config.bootstrapAdminName, "admin", now]
  );
}

export async function openPostgresDatabase(config, options = {}) {
  const pool = options.pool ?? new Pool({ connectionString: config.databaseUrl, max: 5 });
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
    async close() { await pool.end(); }
  };
  await database.exec(schema);
  await bootstrap(database, config);
  return database;
}
