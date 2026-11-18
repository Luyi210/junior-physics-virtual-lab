import { backup, DatabaseSync } from "node:sqlite";
import { constants } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join, resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";

const DATABASE_FILE = "database.sqlite";
const MANIFEST_FILE = "manifest.json";
const BACKUP_DEADLINE_MS = 30_000;
const SQLITE_TIMEOUT_MS = 5_000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const quote = (identifier) => `"${identifier.replaceAll('"', '""')}"`;
function fail(message, code = "SQLITE_BACKUP_INVALID") { return Object.assign(new Error(message), { code }); }
function pathArgument(value, label) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw fail(`${label} must be a nonempty filesystem path.`);
  return resolve(value);
}
async function regularFile(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw fail("A regular, non-symbolic-link database or manifest file is required.");
  return stat;
}
async function ordinaryDirectory(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail("A non-symbolic-link directory is required.");
}
async function noSidecars(databasePath) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    try { await lstat(databasePath + suffix); }
    catch (error) { if (error.code === "ENOENT") continue; throw error; }
    throw fail("A standalone backup must not have WAL, SHM or journal sidecars.");
  }
}

// Type tags distinguish INTEGER/TEXT/REAL/BLOB without rounding 64-bit integers
// or printing any business row. Sorting row digests preserves duplicate counts.
function cell(value) {
  if (value === null) return ["null"];
  if (typeof value === "bigint") return ["integer", value.toString()];
  if (typeof value === "number") { const bytes = Buffer.allocUnsafe(8); bytes.writeDoubleBE(value); return ["real", bytes.toString("hex")]; }
  if (typeof value === "string") return ["text", value];
  if (ArrayBuffer.isView(value)) return ["blob", Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("base64")];
  throw fail("Unsupported SQLite value type.");
}
function databaseSummary(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true, timeout: SQLITE_TIMEOUT_MS, readBigInts: true });
  try {
    db.exec("PRAGMA query_only=ON; BEGIN");
    const integrity = db.prepare("PRAGMA integrity_check", { returnArrays: true }).all();
    if (integrity.length !== 1 || integrity[0][0] !== "ok") throw fail("SQLite integrity_check failed; no successful backup is recorded.");
    if (db.prepare("PRAGMA foreign_key_check").all().length !== 0) throw fail("SQLite foreign_key_check failed; no successful backup is recorded.");
    const objects = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name", { returnArrays: true }).all();
    const schema = {
      sha256: digest(JSON.stringify(objects)),
      objects: objects.map(([type, name, tableName, sql]) => ({ type, name, tableName, sqlSha256: sql === null ? null : digest(sql) }))
    };
    const tables = objects.filter(([type]) => type === "table").map(([, name]) => {
      const statement = db.prepare(`SELECT * FROM ${quote(name)}`, { returnArrays: true, readBigInts: true });
      const columns = statement.columns().map((column) => column.name);
      const rows = [];
      for (const row of statement.iterate()) rows.push(digest(JSON.stringify(row.map(cell))));
      rows.sort();
      return { name, columns, rowCount: rows.length, sha256: digest(JSON.stringify([columns, rows])) };
    }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    return { schema, tables };
  } finally {
    try { if (db.isTransaction) db.exec("ROLLBACK"); } finally { db.close(); }
  }
}
async function inspectStandalone(databasePath) {
  await regularFile(databasePath); await noSidecars(databasePath);
  const before = await readFile(databasePath);
  // Refuse WAL-mode headers before opening: a read-only WAL connection can still
  // need sidecars. Every bundle we create is normalized on its private copy.
  if (before.length < 100 || before.subarray(0, 16).toString("binary") !== "SQLite format 3\0" || before[18] !== 1 || before[19] !== 1) {
    throw fail("Backup is not a standalone rollback-journal SQLite main file.");
  }
  const summary = databaseSummary(databasePath);
  await noSidecars(databasePath); await regularFile(databasePath);
  const after = await readFile(databasePath);
  const sha256 = digest(before);
  if (before.length !== after.length || sha256 !== digest(after)) throw fail("Backup changed during verification.");
  return { database: { filename: DATABASE_FILE, bytes: before.length, sha256 }, ...summary };
}
async function writeManifest(directory, manifest) {
  const temporary = join(directory, `.manifest-${randomUUID()}.incomplete`);
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`); await handle.sync(); }
  finally { await handle.close(); }
  // The directory is exclusively created by this operation. The final name is
  // the completion marker; no existing bundle is modified or garbage-collected.
  await rename(temporary, join(directory, MANIFEST_FILE));
}

/** Online snapshot, never a sequential copy of a live main file and sidecars.
 * Node's backup API is documented at nodejs/node v24.14.0 doc/api/sqlite.md.
 * Source connections are private/read-only; the explicit read transaction pins
 * one committed snapshot while other WAL writers continue independently. */
export async function createSqliteBackup({ sourcePath, backupRoot } = {}) {
  const source = pathArgument(sourcePath, "sourcePath");
  const root = pathArgument(backupRoot, "backupRoot");
  await regularFile(source);
  await mkdir(root, { recursive: true, mode: 0o700 }); await ordinaryDirectory(root);
  const directory = await mkdtemp(join(await realpath(root), "sqlite-"));
  await chmod(directory, 0o700);
  const databasePath = join(directory, DATABASE_FILE);
  const db = new DatabaseSync(source, { readOnly: true, timeout: SQLITE_TIMEOUT_MS });
  const deadline = Date.now() + BACKUP_DEADLINE_MS;
  const checkDeadline = () => { if (Date.now() > deadline) throw fail("SQLite online backup exceeded its time limit.", "SQLITE_BACKUP_TIMEOUT"); };
  try {
    db.exec("BEGIN");
    db.prepare("SELECT COUNT(*) FROM sqlite_schema").get();
    checkDeadline();
    // Throwing from progress cancels/rejects backup in Node 24.14, verified by a
    // real local probe and a regression below; there is no detached late writer.
    await backup(db, databasePath, { rate: 100, progress: checkDeadline });
    checkDeadline();
  } finally {
    try { if (db.isTransaction) db.exec("ROLLBACK"); } finally { db.close(); }
  }
  await chmod(databasePath, 0o600);
  const copy = new DatabaseSync(databasePath, { timeout: SQLITE_TIMEOUT_MS });
  try {
    const mode = copy.prepare("PRAGMA journal_mode=DELETE").get();
    if (Object.values(mode)[0] !== "delete") throw fail("Could not make the private backup a standalone SQLite file.");
  } finally { copy.close(); }
  const summary = await inspectStandalone(databasePath);
  const manifest = { version: 1, createdAt: new Date().toISOString(), ...summary };
  await writeManifest(directory, manifest);
  return { directory, databasePath, manifest };
}

/** Verify content and SQLite structure, not just existence or a manifest claim.
 * Checksums detect accidental corruption; this is not a signed/authentic bundle. */
export async function verifySqliteBackup({ directory } = {}) {
  directory = pathArgument(directory, "directory");
  await ordinaryDirectory(directory);
  const manifestPath = join(directory, MANIFEST_FILE);
  await regularFile(manifestPath);
  const raw = await readFile(manifestPath, "utf8");
  let manifest;
  try { manifest = JSON.parse(raw); } catch { throw fail("Backup manifest is not valid JSON."); }
  if (!manifest || manifest.version !== 1 || typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt)) ||
      manifest.database?.filename !== DATABASE_FILE || !Number.isSafeInteger(manifest.database?.bytes) || manifest.database.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(manifest.database?.sha256 ?? "") || !manifest.schema || !Array.isArray(manifest.tables) ||
      Object.keys(manifest).sort().join(",") !== "createdAt,database,schema,tables,version") throw fail("Backup manifest has an unsupported or incomplete format.");
  const entries = await readdir(directory);
  if (entries.length !== 2 || !entries.includes(DATABASE_FILE) || !entries.includes(MANIFEST_FILE)) throw fail("Backup directory contains unexpected files or SQLite sidecars.");
  const databasePath = join(directory, DATABASE_FILE);
  const summary = await inspectStandalone(databasePath);
  if (!isDeepStrictEqual(summary, { database: manifest.database, schema: manifest.schema, tables: manifest.tables })) throw fail("Backup bytes, schema or table summaries do not match the manifest.");
  if (await readFile(manifestPath, "utf8") !== raw) throw fail("Backup manifest changed during verification.");
  return { directory, databasePath, manifest };
}

/** Restore only into a brand-new directory. Never roll back or overwrite a live
 * database. The original bundle is retained and the copied file is reverified. */
export async function restoreSqliteBackup({ directory, destination } = {}) {
  const verified = await verifySqliteBackup({ directory });
  destination = pathArgument(destination, "destination");
  const parent = await realpath(dirname(destination));
  destination = join(parent, basename(destination));
  const sourceDirectory = await realpath(verified.directory);
  if (destination === sourceDirectory || destination.startsWith(sourceDirectory + sep)) {
    throw fail("Restore destination must be separate from the original backup bundle.", "SQLITE_BACKUP_DESTINATION_EXISTS");
  }
  try { await mkdir(destination, { mode: 0o700 }); }
  catch (error) { if (error.code === "EEXIST") throw fail("Restore destination already exists; choose a new directory.", "SQLITE_BACKUP_DESTINATION_EXISTS"); throw error; }
  const databasePath = join(destination, DATABASE_FILE);
  await copyFile(verified.databasePath, databasePath, constants.COPYFILE_EXCL);
  await chmod(databasePath, 0o600);
  const summary = await inspectStandalone(databasePath);
  if (!isDeepStrictEqual(summary, { database: verified.manifest.database, schema: verified.manifest.schema, tables: verified.manifest.tables })) {
    throw fail("Restored copy differs from the verified backup; no successful restore is recorded.");
  }
  await writeManifest(destination, verified.manifest);
  return { directory: destination, databasePath, manifest: verified.manifest };
}
