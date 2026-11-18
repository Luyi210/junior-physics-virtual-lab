import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { backupBeforeApiStart } from "../lib/platform-backup.mjs";
import { runBackupCommand } from "../database-backup.mjs";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../database-backup.mjs", import.meta.url));
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "physics-backup-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = join(directory, "有空格的 classroom.sqlite");
  const db = new DatabaseSync(sourcePath);
  db.exec("CREATE TABLE records(id INTEGER PRIMARY KEY, body TEXT); INSERT INTO records VALUES(1, '原始课堂记录')");
  db.close();
  return { directory, sourcePath };
}
async function command(args) {
  const { stdout } = await execute(process.execPath, [cli, ...args], { timeout: 15_000 });
  return JSON.parse(stdout);
}

test("CLI backup, verify and isolated restore preserve data without selecting a new service database", async (t) => {
  const { directory, sourcePath } = await fixture(t);
  const sourceBefore = await readFile(sourcePath);
  const saved = await command(["backup", "--source", sourcePath, "--output", join(directory, "backups")]);
  assert.equal(saved.ok, true);
  assert.equal((await command(["verify", "--backup", saved.directory])).verified, true);
  const restored = await command(["restore", "--backup", saved.directory, "--destination", join(directory, "独立 恢复")]);
  assert.equal(restored.serviceConfigurationChanged, false);
  const db = new DatabaseSync(restored.databasePath, { readOnly: true });
  try { assert.equal(db.prepare("SELECT body FROM records WHERE id=1").get().body, "原始课堂记录"); }
  finally { db.close(); }
  assert.deepEqual(await readFile(sourcePath), sourceBefore);
  await assert.rejects(command(["restore", "--backup", saved.directory, "--destination", restored.directory]));
  assert.deepEqual(await readFile(sourcePath), sourceBefore);
});

test("CLI rejects ambiguous, unsupported and incomplete commands before touching paths", async (t) => {
  const { directory, sourcePath } = await fixture(t);
  const initial = await readdir(directory);
  for (const args of [
    ["constructor"], ["restore", "--backup", directory],
    ["backup", "--source", sourcePath, "--source", sourcePath, "--output", join(directory, "never")],
    ["restore", "--backup", directory, "--destination", join(directory, "never"), "--force"],
    ["backup", "--source", "", "--output", join(directory, "never")],
  ]) await assert.rejects(runBackupCommand(args));
  assert.deepEqual(await readdir(directory), initial);
  assert.match((await runBackupCommand(["--help"])).help, /不覆盖现库/);
});

test("CLI failure exits nonzero and never emits a success result", async (t) => {
  const { directory } = await fixture(t);
  try {
    await execute(process.execPath, [cli, "verify", "--backup", directory], { timeout: 15_000 });
    assert.fail("missing manifest must fail");
  } catch (error) {
    assert.equal(error.code, 1);
    assert.equal(error.stdout, "");
    assert.match(error.stderr, /数据库操作未完成/);
  }
});

test("launcher backs up the configured SQLite path and preserves all historical directories", async (t) => {
  const { directory, sourcePath } = await fixture(t);
  const backups = join(directory, "backups");
  for (let index = 0; index < 12; index++) {
    const old = join(backups, `old-${index}`);
    await mkdir(old, { recursive: true });
    await writeFile(join(old, "keep.txt"), `old-${index}`);
  }
  const result = await backupBeforeApiStart({ databaseUrl: "", databasePath: sourcePath }, directory);
  assert.equal(result.kind, "sqlite");
  assert.equal((await readdir(backups)).length, 13);
  for (let index = 0; index < 12; index++) assert.equal(await readFile(join(backups, `old-${index}`, "keep.txt"), "utf8"), `old-${index}`);
  const check = new DatabaseSync(result.databasePath, { readOnly: true });
  try { assert.equal(check.prepare("SELECT COUNT(*) AS n FROM records").get().n, 1); }
  finally { check.close(); }
});

test("launcher never creates missing SQLite files or claims a local backup for PostgreSQL", async (t) => {
  const { directory } = await fixture(t);
  const before = await readdir(directory);
  assert.deepEqual(await backupBeforeApiStart({ databaseUrl: "", databasePath: "missing.sqlite" }, directory), { kind: "new-sqlite", directory: null });
  assert.deepEqual(await backupBeforeApiStart({ databaseUrl: "postgresql://invalid.test/example", databasePath: "missing.sqlite" }, directory), { kind: "postgresql", directory: null });
  assert.deepEqual(await readdir(directory), before);
});

test("invalid configured database rejects the launch preparation without deleting existing backup history", async (t) => {
  const { directory } = await fixture(t);
  const sourcePath = join(directory, "invalid.sqlite");
  await writeFile(sourcePath, "not a database");
  await mkdir(join(directory, "backups", "keep"), { recursive: true });
  await writeFile(join(directory, "backups", "keep", "marker"), "preserved");
  await assert.rejects(backupBeforeApiStart({ databaseUrl: "", databasePath: sourcePath }, directory));
  assert.equal(await readFile(join(directory, "backups", "keep", "marker"), "utf8"), "preserved");
  assert.equal(await readFile(sourcePath, "utf8"), "not a database");
});
