import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { startApiRuntime } from "../src/server-runtime.js";

function fixture({ failAt, cleanupFailure, initialization = { mode: "existing", created: false } } = {}) {
  const calls = [], logs = [];
  const mark = (name) => { calls.push(name); if (failAt === name) throw new Error(`failure:${name}`); };
  const close = (name) => async () => { calls.push(`close:${name}`); if (cleanupFailure === name) throw new Error(`close-failure:${name}`); };
  const db = { initialization, close: close("db") };
  const vectorKnowledge = { initialize: async () => mark("vector-initialize"), status: () => ({ enabled: false }), close: close("vector") };
  const server = Object.assign(new EventEmitter(), {
    listening: false,
    listen() {
      mark("listen");
      queueMicrotask(() => {
        if (failAt === "bind") this.emit("error", new Error("EADDRINUSE"));
        else { this.listening = true; this.emit("listening"); }
      });
      return this;
    },
    address: () => ({ port: 54321 }),
    close(done) { calls.push("close:server"); this.listening = false; done(); }
  });
  const dependencies = {
    openDatabase: async () => { mark("database"); return db; },
    createVectorKnowledgeService: () => { mark("vector"); return vectorKnowledge; },
    createGuangguangService: () => { mark("guangguang"); return { close: close("guangguang") }; },
    createLiliService: () => { mark("lili"); return { close: close("lili") }; },
    createApiServer: () => { mark("server"); return server; },
    logger: { log: (line) => logs.push(line) }
  };
  const config = { host: "127.0.0.1", port: 0, seedDemoData: false, bootstrapAdminEmail: "replacement@invalid.test", bootstrapAdminPassword: "secret-not-to-log", deepseekApiKey: "private-provider-key", guangguangEnabled: false };
  return { calls, logs, config, dependencies, server };
}

test("an existing database starts without bootstrap validation and logs only the adapter-confirmed result", async () => {
  const f = fixture();
  const runtime = await startApiRuntime(f.config, f.dependencies);
  assert.deepEqual(f.calls, ["database", "vector", "vector-initialize", "guangguang", "lili", "server", "listen"]);
  assert.match(f.logs.join("\n"), /existing accounts and classroom data preserved/);
  assert.match(f.logs.join("\n"), /54321\/api/);
  assert.doesNotMatch(f.logs.join("\n"), /secret-not-to-log|private-provider-key|replacement@invalid.test|administrator created/);
  const first = runtime.close(); const second = runtime.close();
  assert.equal(first, second); await first;
  assert.deepEqual(f.calls.slice(-5), ["close:server", "close:lili", "close:guangguang", "close:vector", "close:db"]);
});

test("new bootstrap and demo logs follow actual results, not the environment's requested mode", async () => {
  for (const initialization of [{ mode: "bootstrap", created: true, adminEmail: "actual-owner@example.invalid" }, { mode: "demo", created: true, schoolId: "school-demo" }]) {
    const f = fixture({ initialization });
    const runtime = await startApiRuntime(f.config, f.dependencies);
    assert.match(f.logs.join("\n"), initialization.mode === "bootstrap" ? /actual-owner@example.invalid/ : /new SQLite demo data initialized/);
    assert.doesNotMatch(f.logs.join("\n"), /Teacher123|secret-not-to-log|replacement@invalid.test/);
    await runtime.close();
  }
});

test("database initialization failure starts no service or listener and publishes no success log", async () => {
  const f = fixture({ failAt: "database" });
  await assert.rejects(startApiRuntime(f.config, f.dependencies), /failure:database/);
  assert.deepEqual(f.calls, ["database"]); assert.deepEqual(f.logs, []);
});

test("service initialization failure releases every acquired resource including the database", async () => {
  for (const failAt of ["vector-initialize", "guangguang", "lili", "server", "listen", "bind"]) {
    const f = fixture({ failAt });
    await assert.rejects(startApiRuntime(f.config, f.dependencies), failAt === "bind" ? /EADDRINUSE/ : new RegExp(`failure:${failAt}`));
    assert.equal(f.calls.at(-1), "close:db");
    assert.equal(f.calls.filter((name) => name === "close:db").length, 1);
    assert.equal(f.calls.filter((name) => name === "close:vector").length, 1);
    assert.deepEqual(f.logs, []);
    assert.equal(f.server.listenerCount("listening"), 0);
  }
});

test("cleanup failure cannot skip resources, replace the startup cause, or duplicate shutdown", async () => {
  const failed = fixture({ failAt: "bind", cleanupFailure: "lili" });
  await assert.rejects(startApiRuntime(failed.config, failed.dependencies), /EADDRINUSE/);
  assert.deepEqual(failed.calls.slice(-4), ["close:lili", "close:guangguang", "close:vector", "close:db"]);
  const f = fixture({ cleanupFailure: "lili" });
  const runtime = await startApiRuntime(f.config, f.dependencies);
  await assert.rejects(runtime.close(), AggregateError);
  await assert.rejects(runtime.close(), AggregateError);
  assert.equal(f.calls.filter((name) => name === "close:db").length, 1);
});

test("unknown database initialization outcomes close the database and cannot imply successful bootstrap", async () => {
  const f = fixture({ initialization: {} });
  await assert.rejects(startApiRuntime(f.config, f.dependencies), { code: "DATABASE_INITIALIZATION_STATE_INVALID" });
  assert.deepEqual(f.calls, ["database", "close:db"]);
  assert.deepEqual(f.logs, []);
});
