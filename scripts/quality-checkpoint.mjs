import { mkdir, open, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runQualityStage } from "./lib/run-quality-stage.mjs";

// A bounded verification run. This does not start another agent or an infinite loop.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, ".runtime/quality-checkpoints");
const lockPath = resolve(directory, "running.lock");
await mkdir(directory, { recursive: true });
let lock;
try { lock = await open(lockPath, "wx"); }
catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.error("已有质量检查在运行。若上次异常退出，请确认没有检查进程后再移除 .runtime/quality-checkpoints/running.lock。");
  process.exit(1);
}
const id = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const report = { startedAt: new Date().toISOString(), finishedAt: null, passed: false, interrupted: false, signal: null, stages: [] };
const controller = new AbortController();
const stop = (signal) => { report.interrupted = true; report.signal ??= signal; controller.abort(); };
const onInterrupt = () => stop("SIGINT");
const onTerminate = () => stop("SIGTERM");
process.on("SIGINT", onInterrupt);
process.on("SIGTERM", onTerminate);
try {
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: report.startedAt }));
  for (const command of ["typecheck", "test", "knowledge:evaluate", "build"]) {
    if (report.interrupted) break;
    const logPath = resolve(directory, `${id}-${command.replaceAll(":", "-")}.log`);
    console.log(`检查 ${command}，日志：${logPath}`);
    const startedAt = new Date().toISOString();
    // npm_execpath allows direct Node invocation, including Windows .cmd setups.
    const file = process.env.npm_execpath ? process.execPath : (process.platform === "win32" ? "cmd.exe" : "npm");
    const args = process.env.npm_execpath ? [process.env.npm_execpath, "run", command]
      : process.platform === "win32" ? ["/d", "/s", "/c", `npm run ${command}`] : ["run", command];
    const result = await runQualityStage({ file, args, cwd: root, logPath, signal: controller.signal });
    report.stages.push({ command: `npm run ${command}`, startedAt, finishedAt: new Date().toISOString(), ...result, logPath });
    if (result.exitCode !== 0) break;
  }
  report.passed = !report.interrupted && report.stages.length === 4 && report.stages.every((stage) => stage.exitCode === 0);
  process.exitCode = report.passed ? 0 : 1;
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  const reportPath = resolve(directory, `${id}.json`);
  try {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(resolve(directory, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  } finally {
    try { await lock.close(); }
    finally {
      try { await unlink(lockPath); }
      finally {
        process.off("SIGINT", onInterrupt);
        process.off("SIGTERM", onTerminate);
      }
    }
  }
  console.log(`${report.passed ? "自动检查通过" : "检查未全部通过"}：${reportPath}。真实设备操作仍需单独验收。`);
}
