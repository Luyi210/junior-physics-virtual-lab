import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createSqliteBackup } from "./sqlite-backup.mjs";

/** Match the database selected by the API configuration. Never back up the
 * default SQLite file and claim that a configured PostgreSQL database is safe. */
export async function backupBeforeApiStart(config, projectRoot) {
  if (config.databaseUrl) return { kind: "postgresql", directory: null };
  const sourcePath = resolve(projectRoot, config.databasePath);
  try { await lstat(sourcePath); }
  catch (error) {
    if (error.code === "ENOENT") return { kind: "new-sqlite", directory: null };
    throw error;
  }
  const result = await createSqliteBackup({ sourcePath, backupRoot: resolve(dirname(sourcePath), "backups") });
  return { kind: "sqlite", ...result };
}
