import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicPort = process.env.PORT ?? "10000";
const internalApiPort = process.env.PHYSICS_RENDER_API_PORT ?? "8787";

function launch(label, script, environment) {
  const child = spawn(process.execPath, [resolve(projectRoot, script)], {
    cwd: projectRoot,
    env: { ...process.env, ...environment },
    stdio: "inherit"
  });
  child.label = label;
  return child;
}

const api = launch("教学数据服务", "apps/api/src/server.js", {
  PHYSICS_API_HOST: "127.0.0.1",
  PHYSICS_API_PORT: internalApiPort
});
const web = launch("网页服务", "scripts/serve-web.mjs", {
  PHYSICS_WEB_HOST: "0.0.0.0",
  PHYSICS_WEB_PORT: publicPort,
  PHYSICS_API_UPSTREAM: `http://127.0.0.1:${internalApiPort}`
});
const children = [api, web];
let stopping = false;

function stop(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }, 8_000);
  forceTimer.unref();
  Promise.all(children.map((child) => new Promise((resolveExit) => {
    if (child.exitCode !== null || child.signalCode !== null) resolveExit();
    else child.once("exit", resolveExit);
  }))).then(() => process.exit(exitCode));
  if (signal) console.log(`\n${signal}: 正在关闭格物实验室服务`);
}

for (const child of children) {
  child.once("error", (error) => {
    console.error(`${child.label}启动失败`, error);
    stop("CHILD_ERROR", 1);
  });
  child.once("exit", (code, signal) => {
    if (stopping) return;
    console.error(`${child.label}意外退出（${signal ?? code ?? "unknown"}）`);
    stop("CHILD_EXIT", code || 1);
  });
}

process.on("SIGINT", () => stop("SIGINT", 0));
process.on("SIGTERM", () => stop("SIGTERM", 0));
