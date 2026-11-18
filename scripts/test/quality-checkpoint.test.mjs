import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Run the real coordinator in an isolated tree; the fake npm command controls
// exit conditions without running or cancelling the user's actual builds.
async function fixture(t, mode) {
  const root = await mkdtemp(join(tmpdir(), "physics-checkpoint-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "scripts/lib"), { recursive: true });
  await cp(new URL("../quality-checkpoint.mjs", import.meta.url), join(root, "scripts/quality-checkpoint.mjs"));
  await cp(new URL("../lib/run-quality-stage.mjs", import.meta.url), join(root, "scripts/lib/run-quality-stage.mjs"));
  const npm = join(root, "fixture-npm.mjs");
  await writeFile(npm, `
    const stage = process.argv[3];
    console.log('fixture stage started: ' + stage);
    if (${JSON.stringify(mode)} === 'failure' && stage === 'test') process.exitCode = 7;
    if (${JSON.stringify(mode)} === 'cancel') setInterval(() => {}, 100);
  `);
  const launch = () => {
    const child = spawn(process.execPath, [join(root, "scripts/quality-checkpoint.mjs")], {
      cwd: root, env: { npm_execpath: npm }, stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const closed = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, output }));
    });
    return { child, closed };
  };
  const reportDirectory = join(root, ".runtime/quality-checkpoints");
  return { launch, reportDirectory,
    report: async () => JSON.parse(await readFile(join(reportDirectory, "latest.json"), "utf8")),
    assertUnlocked: () => assert.rejects(readFile(join(reportDirectory, "running.lock")), { code: "ENOENT" }),
  };
}

test("checkpoint publishes a passed report only after all four successful stages and releases its lock", async (t) => {
  const setup = await fixture(t, "success");
  assert.equal((await setup.launch().closed).code, 0);
  const report = await setup.report();
  assert.equal(report.passed, true);
  assert.deepEqual(report.stages.map((stage) => stage.command), ["npm run typecheck", "npm run test", "npm run knowledge:evaluate", "npm run build"]);
  assert.ok(report.stages.every((stage) => stage.exitCode === 0));
  await setup.assertUnlocked();
});

test("a failed test stage prevents evaluation/build and leaves a failed report with diagnostics", async (t) => {
  const setup = await fixture(t, "failure");
  assert.equal((await setup.launch().closed).code, 1);
  const report = await setup.report();
  assert.equal(report.passed, false);
  assert.deepEqual(report.stages.map((stage) => stage.exitCode), [0, 7]);
  assert.match(await readFile(report.stages[1].logPath, "utf8"), /fixture stage started: test/);
  await setup.assertUnlocked();
});

test("a live checkpoint owns its lock; cancellation records failure and permits the next run", {
  skip: process.platform === "win32" ? "POSIX signal integration; Windows requires a Windows runner" : false,
  timeout: 8000,
}, async (t) => {
  const setup = await fixture(t, "cancel");
  const first = setup.launch();
  t.after(() => first.child.kill("SIGTERM"));
  const deadline = Date.now() + 3000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = Boolean(await readFile(join(setup.reportDirectory, "running.lock"), "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!ready) await delay(10);
  }
  assert.equal(ready, true);
  const competitor = await setup.launch().closed;
  assert.equal(competitor.code, 1);
  assert.match(competitor.output, /已有质量检查在运行/);
  first.child.kill("SIGTERM");
  assert.equal((await first.closed).code, 1);
  const report = await setup.report();
  assert.equal(report.passed, false);
  assert.equal(report.interrupted, true);
  assert.equal(report.signal, "SIGTERM");
  assert.ok(report.stages.length <= 1);
  await setup.assertUnlocked();
});
