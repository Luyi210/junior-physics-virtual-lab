import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSqliteBackup, restoreSqliteBackup, verifySqliteBackup } from "./lib/sqlite-backup.mjs";

const usage = `SQLite 教学数据备份与隔离恢复（Node.js 24）

备份：node scripts/database-backup.mjs backup --source <数据库文件> --output <备份根目录>
核验：node scripts/database-backup.mjs verify --backup <单份备份目录>
恢复：node scripts/database-backup.mjs restore --backup <单份备份目录> --destination <不存在的新目录>

恢复只生成独立副本，不覆盖现库、不启动服务、不修改服务配置。
备份目录含账号和课堂数据，请存放在受保护位置；工具不自动删除历史备份。
`;

export async function runBackupCommand(argv) {
  if (argv.length === 0 || (argv.length === 1 && ["--help", "-h"].includes(argv[0]))) return { help: usage };
  const [operation, ...args] = argv;
  const fields = new Map([
    ["backup", ["source", "output"]],
    ["verify", ["backup"]],
    ["restore", ["backup", "destination"]],
  ]).get(operation);
  if (!fields) throw new Error("未知操作；请使用 backup、verify 或 restore，或查看 --help。");
  const { values } = parseArgs({ args, strict: true, allowPositionals: false,
    options: Object.fromEntries(fields.map((name) => [name, { type: "string" }])) });
  for (const name of fields) {
    if (typeof values[name] !== "string" || !values[name].trim()) throw new Error(`缺少 --${name} 路径。`);
    // A duplicate path is usually a mistaken shell command. Do not silently
    // choose which source or destination the operator meant to use.
    if (args.filter((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`)).length !== 1) {
      throw new Error(`--${name} 只能提供一次。`);
    }
  }
  let result;
  if (operation === "backup") result = await createSqliteBackup({ sourcePath: values.source, backupRoot: values.output });
  else if (operation === "verify") result = await verifySqliteBackup({ directory: values.backup });
  else result = await restoreSqliteBackup({ directory: values.backup, destination: values.destination });
  return { ok: true, operation, directory: result.directory, databasePath: result.databasePath,
    verified: true, serviceConfigurationChanged: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBackupCommand(process.argv.slice(2)).then((result) => {
    console.log(result.help ?? JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(`数据库操作未完成：${error.message}`);
    process.exitCode = 1;
  });
}
