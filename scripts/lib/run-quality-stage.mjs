import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { finished } from "node:stream/promises";

// One bounded command with a private process group on macOS/Linux. npm itself
// is only the parent of the compiler/test processes; killing npm is insufficient.
export async function runQualityStage({ file, args, cwd, env = process.env, logPath,
  signal, timeoutMs = 600_000, terminationGraceMs = 2_000 }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0
    || !Number.isFinite(terminationGraceMs) || terminationGraceMs < 0) {
    throw new RangeError("Quality stage time limits must be finite and positive.");
  }
  const output = createWriteStream(logPath);
  await once(output, "open");
  // Attach rejection handling immediately so a disk error cannot go unhandled.
  const outputFinished = finished(output).then(() => null, (error) => error);
  let child;
  let timer;
  let forceTimer;
  let stopReason = null;
  let commandError = null;
  let streamError = null;
  const write = (message) => { if (!output.destroyed) output.write(`${message}\n`); };
  const killTree = (force = false) => {
    if (!child?.pid) return;
    if (process.platform === "win32") {
      // taskkill is argv-based; no user-provided shell command is constructed.
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", ...(force ? ["/F"] : [])],
        { stdio: "ignore", windowsHide: true });
      killer.on("error", () => child.kill(force ? "SIGKILL" : "SIGTERM"));
      return;
    }
    try { process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM"); }
    catch (error) { if (error.code !== "ESRCH") write(`Unable to stop process group: ${error.code}`); }
  };
  const stop = (reason) => {
    if (stopReason) return;
    stopReason = reason;
    write(`Quality stage stopped: ${reason}`);
    killTree();
    forceTimer = setTimeout(() => killTree(true), terminationGraceMs);
  };
  const abort = () => stop("interrupted");
  output.on("error", (error) => { streamError = error; stop("log-error"); });
  let exit = { code: null, signal: null };
  try {
    if (signal?.aborted) stop("interrupted");
    else {
      child = spawn(file, args, { cwd, env, detached: process.platform !== "win32",
        windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.pipe(output, { end: false });
      child.stderr.pipe(output, { end: false });
      const closed = new Promise((resolve) => {
        child.once("error", (error) => { commandError = error; write(`Command could not start: ${error.message}`); });
        child.once("close", (code, exitSignal) => resolve({ code, signal: exitSignal }));
      });
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => stop("timeout"), timeoutMs);
      // Covers an abort that arrived between the preflight and listener setup.
      if (signal?.aborted) abort();
      exit = await closed;
    }
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    signal?.removeEventListener("abort", abort);
    // A parent may close while a descendant with redirected stdio is still alive.
    if (stopReason) killTree(true);
    output.end();
    streamError ??= await outputFinished;
    // A final flush error may have scheduled a new termination timer.
    clearTimeout(forceTimer);
  }
  return {
    exitCode: stopReason || commandError || streamError ? 1 : (exit.code ?? 1),
    signal: exit.signal,
    interrupted: stopReason === "interrupted",
    timedOut: stopReason === "timeout",
    ...(commandError || streamError ? { error: (commandError ?? streamError).message } : {}),
  };
}
