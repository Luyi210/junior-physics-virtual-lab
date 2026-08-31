import { readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = resolve(projectRoot, ".runtime");
const stateFile = resolve(runtimeRoot, "platform-state.json");

function processCommand(pid) {
  if (process.platform === "win32") return "";
  return spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).stdout.trim();
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

async function main() {
  let state;
  try { state = JSON.parse(await readFile(stateFile, "utf8")); }
  catch {
    console.log("没有发现由一键启动器创建的运行服务。");
    return;
  }

  for (const [label, service] of [["网页服务", state.web], ["教学数据服务", state.api]]) {
    if (!service?.pid || !isRunning(service.pid)) continue;
    const command = processCommand(service.pid);
    if (command && !command.includes(service.command)) {
      console.warn(`跳过 ${label} PID ${service.pid}：该 PID 已被其他程序使用。`);
      continue;
    }
    process.kill(service.pid, "SIGTERM");
    console.log(`已停止${label}（PID ${service.pid}）。`);
  }
  await rm(stateFile, { force: true });
  console.log("格物实验室已安全关闭，教学数据仍保存在 apps/api/data 中。");
}

main().catch((error) => {
  console.error(`关闭失败：${error.message}`);
  process.exitCode = 1;
});
