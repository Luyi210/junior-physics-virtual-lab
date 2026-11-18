import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { openDatabase } from "../src/database.js";
import { createApiHandler } from "../src/app.js";
import { isolatedSqliteConfig } from "./helpers/isolated-config.js";

const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
const password = "  ExactBootstrap123!  ";
async function fixture(t) {
  assert.equal(email.length, 254);
  const config = isolatedSqliteConfig({ seedDemoData: false, bootstrapAdminEmail: email, bootstrapAdminPassword: password });
  const db = await openDatabase(config); t.after(() => db.close());
  const handler = createApiHandler({ db, config });
  let sequence = 0;
  async function request(path, { method = "POST", body, token } = {}) {
    const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    Object.assign(stream, { method, url: `/api${path}`, headers: { host: "localhost", "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, socket: { remoteAddress: `credential-input-${++sequence}` } });
    let status, payload;
    await handler(stream, { writeHead: (value) => { status = value; }, end: (value) => { payload = JSON.parse(value); } });
    return { status, payload };
  }
  return { request };
}

test("the longest accepted bootstrap email and exact password can log in, including surrounding password spaces", async (t) => {
  const { request } = await fixture(t);
  const result = await request("/auth/login", { body: { email: ` ${email.toUpperCase()} `, password } });
  assert.equal(result.status, 200); assert.equal(result.payload.data.user.role, "admin");
  assert.equal((await request("/auth/login", { body: { email, password: password.trim() } })).status, 401);
});

test("managed account creation and password reset preserve the exact credential that login verifies", async (t) => {
  const { request } = await fixture(t);
  const token = (await request("/auth/login", { body: { email, password } })).payload.data.accessToken;
  const student = { email: "exact@student.invalid", password: "  ManagedExact123!  ", name: "学生", role: "student" };
  const created = await request("/users", { body: student, token });
  assert.equal(created.status, 201);
  assert.equal((await request("/auth/login", { body: student })).status, 200);
  assert.equal((await request("/auth/login", { body: { ...student, password: student.password.trim() } })).status, 401);
  const reset = " ResetExact456! ";
  assert.equal((await request(`/users/${created.payload.data.id}/password`, { method: "PATCH", body: { password: reset }, token })).status, 200);
  assert.equal((await request("/auth/login", { body: { ...student, password: reset } })).status, 200);
  assert.equal((await request("/auth/login", { body: student })).status, 401);
  assert.equal((await request("/auth/login", { body: { ...student, password: reset.trim() } })).status, 401);
});

test("blank and oversized credentials are rejected without silently trimming away the input limit", async (t) => {
  const { request } = await fixture(t);
  const token = (await request("/auth/login", { body: { email, password } })).payload.data.accessToken;
  for (const invalid of ["", " ".repeat(12), "x".repeat(201), ` ${"x".repeat(199)} `, 123, null]) {
    assert.equal((await request("/auth/login", { body: { email, password: invalid } })).status, 422);
    assert.equal((await request("/users", { body: { email: "invalid@student.invalid", password: invalid, name: "学生" }, token })).status, 422);
    assert.equal((await request("/users/missing/password", { method: "PATCH", body: { password: invalid }, token })).status, 422);
  }
  assert.equal((await request("/auth/login", { body: { email: `a${email}`, password } })).status, 422);
});
