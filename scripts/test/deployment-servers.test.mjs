import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { apiProxyTimeoutMs } from "../lib/api-proxy-timeout.mjs";

test("Lili proxy leaves response time after the default backend deadline", () => {
  assert.equal(apiProxyTimeoutMs("/api/lili/chat", {}), 50_000);
  assert.equal(apiProxyTimeoutMs("/api/lili/chat/", {}), 50_000);
});

test("Lili proxy follows the backend's configured, bounded timeout semantics", () => {
  for (const [configured, expected] of [
    ["20000", 25_000], ["120000", 125_000], ["900000", 125_000],
    ["3.9", 5003], ["0.5", 5001],
    ["0", 50_000], ["-10", 50_000], ["", 50_000],
    ["not-a-number", 50_000], ["Infinity", 50_000],
  ]) {
    assert.equal(apiProxyTimeoutMs("/api/lili/chat", { PHYSICS_LILI_TIMEOUT_MS: configured }), expected, configured);
  }
});

test("other API routes retain their existing budgets regardless of Lili configuration", () => {
  const environment = { PHYSICS_LILI_TIMEOUT_MS: "120000" };
  assert.equal(apiProxyTimeoutMs("/api/guangguang/chat", environment), 165_000);
  for (const path of ["/api/health", "/api/sessions/one/record", "/api/lili/chat/extra", "/api/lili/chat//", "/api/guangguang/chat/"]) {
    assert.equal(apiProxyTimeoutMs(path, environment), 15_000, path);
  }
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "physics-deployment-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function copyScript(directory, name) {
  const target = join(directory, "scripts", name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(new URL(`../${name}`, import.meta.url), target);
  return target;
}

function runIsolated(t, script, environment) {
  // No inherited database, credentials, NODE_OPTIONS or deployment settings.
  const env = Object.fromEntries(["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR"]
    .filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]));
  const child = spawn(process.execPath, [script], { env: { ...env, ...environment }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "", errors = "", spawnError;
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  child.on("error", (error) => { spawnError = error; });
  const closed = new Promise((resolve) => child.once("close", (code, signal) => resolve({ code, signal })));
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null || spawnError) return;
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    try { await closed; } finally { clearTimeout(timer); }
  });
  return {
    output: () => output,
    async waitFor(predicate) {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        if (predicate(output)) return;
        if (spawnError) throw spawnError;
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Isolated server exited: ${errors}`);
        await delay(20);
      }
      throw new Error(`Isolated server did not become ready: ${errors}`);
    },
  };
}

for (const explicitHost of [undefined, "127.0.0.1"]) {
  test(`Render launcher passes ${explicitHost ?? "the original public default"} to only its web child`, { timeout: 15_000 }, async (t) => {
    const directory = await fixture(t);
    const script = await copyScript(directory, "serve-render.mjs");
    await mkdir(join(directory, "apps/api/src"), { recursive: true });
    // Only stub children run: no real API, SQLite, listener or bootstrap.
    const stub = `
      const api = process.argv[1].endsWith("server.js");
      console.log(JSON.stringify({ kind: api ? "api" : "web",
        host: process.env[api ? "PHYSICS_API_HOST" : "PHYSICS_WEB_HOST"],
        port: process.env[api ? "PHYSICS_API_PORT" : "PHYSICS_WEB_PORT"],
        upstream: api ? null : process.env.PHYSICS_API_UPSTREAM }));
      setInterval(() => {}, 1000);
    `;
    await writeFile(join(directory, "apps/api/src/server.js"), stub);
    await writeFile(join(directory, "scripts/serve-web.mjs"), stub);
    const environment = explicitHost === undefined ? {} : {
      PHYSICS_WEB_HOST: explicitHost, PORT: "18080", PHYSICS_RENDER_API_PORT: "18787",
      // The launcher must continue to keep its API internal and select its ports.
      PHYSICS_API_HOST: "0.0.0.0", PHYSICS_API_PORT: "1", PHYSICS_WEB_PORT: "2",
    };
    const running = runIsolated(t, script, environment);
    await running.waitFor((output) => output.split("\n").filter((line) => line.startsWith("{")).length === 2);
    const children = running.output().trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(children.find((child) => child.kind === "api"), {
      kind: "api", host: "127.0.0.1", port: explicitHost ? "18787" : "8787", upstream: null,
    });
    assert.deepEqual(children.find((child) => child.kind === "web"), {
      kind: "web", host: explicitHost ?? "0.0.0.0", port: explicitHost ? "18080" : "10000",
      upstream: `http://127.0.0.1:${explicitHost ? "18787" : "8787"}`,
    });
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

test("real proxy accepts a Lili reply beyond 15 seconds while ordinary requests still time out", { timeout: 30_000 }, async (t) => {
  const directory = await fixture(t);
  const script = await copyScript(directory, "serve-web.mjs");
  await copyScript(directory, "lib/api-proxy-timeout.mjs");
  const timers = new Set();
  const received = [];
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({ url: request.url, method: request.method, body: Buffer.concat(chunks).toString(), authorization: request.headers.authorization });
    const timer = setTimeout(() => {
      timers.delete(timer);
      response.writeHead(200, { "content-type": "application/json", "x-request-id": "fake-upstream-request" });
      response.end(JSON.stringify({ mode: "guided", source: "isolated-fake-upstream" }));
    }, 16_500);
    timers.add(timer);
  });
  const upstreamPort = await listen(upstream);
  t.after(async () => {
    for (const timer of timers) clearTimeout(timer);
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  });
  // Reserve an OS-selected port briefly, never use any product/preview port.
  const reservation = createServer();
  const port = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));
  const running = runIsolated(t, script, {
    PHYSICS_WEB_HOST: "127.0.0.1", PHYSICS_WEB_PORT: String(port),
    PHYSICS_API_UPSTREAM: `http://127.0.0.1:${upstreamPort}`, PHYSICS_DEMO_ONLY: "false",
  });
  await running.waitFor((output) => output.includes(`http://127.0.0.1:${port}/`));
  const body = JSON.stringify({ question: "only synthetic test data" });
  const [lili, ordinary] = await Promise.all([
    fetch(`http://127.0.0.1:${port}/api/lili/chat/?sample=1`, {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer synthetic-fixture" },
      body, signal: AbortSignal.timeout(25_000),
    }),
    fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(25_000) }),
  ]);
  assert.equal(lili.status, 200);
  assert.deepEqual(await lili.json(), { mode: "guided", source: "isolated-fake-upstream" });
  assert.equal(lili.headers.get("x-request-id"), "fake-upstream-request");
  assert.equal(ordinary.status, 502);
  assert.equal((await ordinary.json()).error.code, "API_PROXY_UNAVAILABLE");
  assert.deepEqual(received.find((request) => request.method === "POST"), {
    url: "/api/lili/chat/?sample=1", method: "POST", body, authorization: "Bearer synthetic-fixture",
  });
});
