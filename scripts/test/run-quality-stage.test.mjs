import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { runQualityStage } from "../lib/run-quality-stage.mjs";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "physics-quality-stage-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, logPath: join(directory, "command.log") };
}

test("successful stage flushes stdout and stderr before returning", async (t) => {
  const { directory, logPath } = await fixture(t);
  const result = await runQualityStage({ file: process.execPath,
    args: ["-e", "process.stdout.write('model ok\\n');process.stderr.write('diagnostic\\n')"], cwd: directory, logPath });
  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  const log = await readFile(logPath, "utf8");
  assert.match(log, /model ok/);
  assert.match(log, /diagnostic/);
});

test("nonzero command status and missing executable remain failures", async (t) => {
  const { directory, logPath } = await fixture(t);
  const failed = await runQualityStage({ file: process.execPath,
    args: ["-e", "console.error('invalid model');process.exitCode=7"], cwd: directory, logPath });
  assert.equal(failed.exitCode, 7);
  assert.match(await readFile(logPath, "utf8"), /invalid model/);
  const missing = await runQualityStage({ file: join(directory, "missing-command"), args: [], cwd: directory, logPath });
  assert.equal(missing.exitCode, 1);
  assert.match(missing.error, /ENOENT/);
});

test("an already cancelled stage never starts its command", async (t) => {
  const { directory, logPath } = await fixture(t);
  const result = await runQualityStage({ file: process.execPath,
    args: ["-e", "console.log('should not run')"], cwd: directory, logPath, signal: AbortSignal.abort() });
  assert.equal(result.interrupted, true);
  assert.equal(result.exitCode, 1);
  assert.doesNotMatch(await readFile(logPath, "utf8"), /should not run/);
});

test("a hung command has a bounded timeout and a failed result", { timeout: 5000 }, async (t) => {
  const { directory, logPath } = await fixture(t);
  const started = Date.now();
  const result = await runQualityStage({ file: process.execPath,
    args: ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},100)"], cwd: directory, logPath,
    timeoutMs: 300, terminationGraceMs: 100 });
  assert.equal(result.timedOut, true);
  assert.equal(result.interrupted, false);
  assert.equal(result.exitCode, 1);
  assert.ok(Date.now() - started < 4000);
  assert.match(await readFile(logPath, "utf8"), /stopped: timeout/);
});

for (const redirectDescendant of [false, true]) test(`cancellation kills descendants with ${redirectDescendant ? "redirected stdio after parent exit" : "inherited pipes and a resistant parent"}`, {
  skip: process.platform === "win32" ? "POSIX process-group regression; Windows taskkill needs a Windows runner" : false,
  timeout: 8000,
}, async (t) => {
  const { directory, logPath } = await fixture(t);
  const heartbeat = join(directory, "heartbeat");
  const controller = new AbortController();
  const workerCode = `const fs=require('node:fs');process.on('SIGTERM',()=>{});setInterval(()=>fs.writeFileSync(${JSON.stringify(heartbeat)},String(Date.now())),20);`;
  const parentCode = `const {spawn}=require('node:child_process');${redirectDescendant ? "" : "process.on('SIGTERM',()=>{});"}spawn(process.execPath,['-e',${JSON.stringify(workerCode)}],{stdio:'${redirectDescendant ? "ignore" : "inherit"}'});setInterval(()=>{},100);`;
  const running = runQualityStage({ file: process.execPath, args: ["-e", parentCode], cwd: directory,
    logPath, signal: controller.signal, timeoutMs: 4000, terminationGraceMs: 100 });
  t.after(() => controller.abort());
  const deadline = Date.now() + 3000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = Boolean(await readFile(heartbeat, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!ready) await delay(20);
  }
  controller.abort();
  const result = await running;
  assert.equal(ready, true, "descendant started before cancellation");
  assert.equal(result.interrupted, true);
  assert.equal(result.timedOut, false);
  assert.equal(result.exitCode, 1);
  const stoppedValue = await readFile(heartbeat, "utf8");
  await delay(150);
  assert.equal(await readFile(heartbeat, "utf8"), stoppedValue, "no descendant keeps running after cancellation");
});

test("invalid stage bounds reject before launching a command", async (t) => {
  const { directory, logPath } = await fixture(t);
  await assert.rejects(runQualityStage({ file: process.execPath, args: [], cwd: directory, logPath, timeoutMs: NaN }), RangeError);
});

test("an unusable log path fails before the command starts", async (t) => {
  const { directory } = await fixture(t);
  const marker = join(directory, "must-not-start");
  await assert.rejects(runQualityStage({ file: process.execPath,
    args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)},'started')`],
    cwd: directory, logPath: directory }), { code: "EISDIR" });
  await assert.rejects(readFile(marker), { code: "ENOENT" });
});

test("a disk write failure stops the running command and cannot pass", {
  skip: process.platform !== "linux" ? "/dev/full regression runs on Linux CI" : false,
  timeout: 5000,
}, async (t) => {
  const { directory } = await fixture(t);
  const result = await runQualityStage({ file: process.execPath,
    args: ["-e", "console.log('write to full device');setInterval(()=>{},100)"],
    cwd: directory, logPath: "/dev/full", timeoutMs: 3000, terminationGraceMs: 100 });
  assert.equal(result.exitCode, 1);
  assert.equal(result.timedOut, false);
  assert.match(result.error, /ENOSPC/);
});
