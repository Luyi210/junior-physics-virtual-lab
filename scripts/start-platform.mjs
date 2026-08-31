import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = resolve(projectRoot, ".runtime");
const stateFile = resolve(runtimeRoot, "platform-state.json");
const secretFile = resolve(runtimeRoot, "token-secret");
const databaseFile = resolve(projectRoot, "apps/api/data/physics-lab.sqlite");
const backupRoot = resolve(projectRoot, "apps/api/data/backups");
const webUrl = "http://127.0.0.1:5173/";
const apiUrl = "http://127.0.0.1:8787/api/health";
const apiCompatibility = "desktop-managed-accounts-v1";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

mkdirSync(runtimeRoot, { recursive: true });

function note(message) {
  console.log(`[格物实验室] ${message}`);
}

function portIsOpen(port) {
  return new Promise((resolvePort) => {
    const socket = connect({ host: "127.0.0.1", port });
    socket.setTimeout(800);
    socket.once("connect", () => { socket.destroy(); resolvePort(true); });
    socket.once("timeout", () => { socket.destroy(); resolvePort(false); });
    socket.once("error", () => resolvePort(false));
  });
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function processCommand(pid) {
  if (process.platform === "win32") return "";
  return spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).stdout.trim();
}

async function stopTrackedService(service, expectedCommand, label) {
  if (!service?.pid || !isRunning(service.pid)) return false;
  const command = processCommand(service.pid);
  if (command && !command.includes(expectedCommand)) return false;
  process.kill(service.pid, "SIGTERM");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!isRunning(service.pid)) {
      note(`已替换旧版${label}（PID ${service.pid}）。`);
      return true;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`旧版${label}没有按预期停止，请先双击“关闭格物实验室.command”后重试。`);
}

async function responseMatches(url, expectedText) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1600), cache: "no-store" });
    return response.ok && (await response.text()).includes(expectedText);
  } catch {
    return false;
  }
}

async function waitFor(label, probe, logFile) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await probe()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`${label}没有在 30 秒内启动。请查看日志：${logFile}`);
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit", ...options });
    child.once("error", rejectRun);
    child.once("exit", (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${command} 执行失败，退出码 ${code}`)));
  });
}

function startDetached(label, command, args, environment, logName) {
  const logFile = resolve(runtimeRoot, logName);
  const descriptor = openSync(logFile, "a");
  const child = spawn(command, args, {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, ...environment },
    stdio: ["ignore", descriptor, descriptor]
  });
  child.unref();
  closeSync(descriptor);
  note(`${label}正在启动（PID ${child.pid}）`);
  return { pid: child.pid, logFile };
}

async function backupDatabase() {
  if (!existsSync(databaseFile)) return null;
  const stamp = new Date().toISOString().replaceAll(":", "-").replace("T", "_").slice(0, 19);
  const destination = resolve(backupRoot, stamp);
  await mkdir(destination, { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${databaseFile}${suffix}`;
    if (existsSync(source)) await copyFile(source, resolve(destination, `physics-lab.sqlite${suffix}`));
  }
  const backups = (await readdir(backupRoot, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name).sort().reverse();
  await Promise.all(backups.slice(10).map((name) => rm(resolve(backupRoot, name), { recursive: true, force: true })));
  return destination;
}

async function tokenSecret() {
  try {
    return (await readFile(secretFile, "utf8")).trim();
  } catch {
    const secret = randomBytes(32).toString("hex");
    await writeFile(secretFile, secret, { mode: 0o600 });
    return secret;
  }
}

async function readState() {
  try { return JSON.parse(await readFile(stateFile, "utf8")); }
  catch { return {}; }
}

async function writeState(state) {
  await writeFile(stateFile, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function openWebsite() {
  const edgeLocations = [
    "/Applications/Microsoft Edge.app",
    resolve(homedir(), "Applications/Microsoft Edge.app")
  ];
  let command;
  let args;
  if (process.platform === "darwin") {
    command = "open";
    args = edgeLocations.some(existsSync) ? ["-a", "Microsoft Edge", webUrl] : [webUrl];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", webUrl];
  } else {
    command = "xdg-open";
    args = [webUrl];
  }
  const opener = spawn(command, args, { detached: true, stdio: "ignore" });
  opener.unref();
}

async function main() {
  const majorVersion = Number(process.versions.node.split(".")[0]);
  if (majorVersion < 24) throw new Error(`需要 Node.js 24 或更高版本，当前为 ${process.versions.node}`);

  note("正在检查网页与教学数据服务……");
  const state = await readState();
  let apiReady = await responseMatches(apiUrl, apiCompatibility);
  if (!apiReady && await portIsOpen(8787)) {
    const stopped = await stopTrackedService(state.api, "apps/api/src/server.js", "教学数据服务");
    if (!stopped) throw new Error("8787 端口被无法确认身份的程序占用。为保护数据，启动器没有强制关闭它。请关闭旧版格物实验室后重试。");
    apiReady = false;
  }
  if (!apiReady) {
    const backup = await backupDatabase();
    if (backup) note(`教学数据已备份到 ${backup}`);
    const api = startDetached("教学数据服务", process.execPath, [resolve(projectRoot, "apps/api/src/server.js")], {
      PHYSICS_API_TOKEN_SECRET: await tokenSecret(),
      PHYSICS_API_ALLOWED_ORIGINS: "http://127.0.0.1:5173,http://localhost:5173"
    }, "api.log");
    state.api = { pid: api.pid, command: "apps/api/src/server.js" };
    await writeState(state);
    await waitFor("教学数据服务", () => responseMatches(apiUrl, apiCompatibility), api.logFile);
  } else {
    note("教学数据服务已就绪，直接复用。");
  }

  const webReady = await responseMatches(webUrl, "格物实验室");
  if (!webReady) {
    if (await portIsOpen(5173)) throw new Error("5173 端口被其他程序占用，无法安全启动网页。");
    note("正在生成经过验收的正式网页……");
    await run(npmCommand, ["run", "build", "--workspace", "@physics-lab/web"]);
    const web = startDetached("网页服务", process.execPath, [resolve(projectRoot, "scripts/serve-web.mjs")], {}, "web.log");
    state.web = { pid: web.pid, command: "scripts/serve-web.mjs" };
    await writeState(state);
    await waitFor("网页服务", () => responseMatches(webUrl, "格物实验室"), web.logFile);
  } else {
    note("网页服务已就绪，直接复用。");
  }

  note("正在执行页面、资源与前后端连接自检……");
  await run(process.execPath, [resolve(projectRoot, "scripts/smoke-test-platform.mjs")]);
  openWebsite();
  note(`平台已打开：${webUrl}`);
  note("以后双击“关闭格物实验室.command”即可安全停止本次启动的服务。");
}

main().catch((error) => {
  console.error(`\n启动失败：${error.message}`);
  console.error(`运行日志位于：${runtimeRoot}`);
  process.exitCode = 1;
});
