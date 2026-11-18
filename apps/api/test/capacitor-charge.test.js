import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { Readable } from "node:stream";
import { getHighSchoolExperiment } from "@physics-lab/knowledge/high-school";
import { simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import { createApiHandler } from "../src/app.js";
import { openDatabase } from "../src/database.js";
import { createLiliService } from "../src/lili.js";
import { signAccessToken } from "../src/security.js";
import { isolatedSqliteConfig } from "./helpers/isolated-config.js";

const parameters = { resistanceKOhm: 10, capacitanceMicrofarads: 470, emf: 6 };
const history = (runId = "capacitor-test", segments = [{ startTimeSeconds: 0, mode: "charge" }]) => ({ kind: "capacitor-rc-v1", runId, initialVoltage: 0, segments });
const capacitorContext = (overrides = {}) => ({ experimentId: "capacitor-charge", parameters: { ...parameters }, timeSeconds: 3, recordCount: 0, capacitorHistory: history(), ...overrides });
const chatBody = (context = capacitorContext(), question = "我应该先做哪一步？") => ({ conversationId: "capacitor-handler-test", question, context });
const reference = (prompt) => JSON.parse(prompt.match(/<reference>(.*?)<\/reference>/s)[1]);
let db, config, local, handler, factories, services;

beforeEach(async () => {
  config = isolatedSqliteConfig({ tokenSecret: "capacitor-handler-synthetic-only", liliRequestsPerMinute: 60 });
  db = await openDatabase(config); factories = 0; services = [];
  local = createLiliService(config, { runtimeFactory: () => { factories += 1; throw new Error("Local guidance must never initialize a paid runtime"); } });
  services.push(local);
  handler = createApiHandler({ db, config, lili: local });
});
afterEach(async () => { try { await Promise.all(services.map((item) => item.close())); } finally { await db?.close(); } });

function token(user = "student") {
  const identities = {
    student: { id: "user-student-1", role: "student" }, other: { id: "user-student-2", role: "student" },
    teacher: { id: "user-teacher", role: "teacher" },
  };
  const identity = identities[user];
  return identity ? signAccessToken({ ...identity, schoolId: "school-demo", name: "合成账号" }, config) : null;
}
async function request(path, { method = "GET", body, user = "student", using = handler } = {}) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  const bearer = token(user);
  Object.assign(stream, { method, url: `/api${path}`, headers: { host: "localhost", "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) }, socket: { remoteAddress: "capacitor-test" } });
  let status, payload;
  await using(stream, { writeHead(value) { status = value; }, end(value) { payload = value ? JSON.parse(value) : null; } });
  return { status, payload };
}
function capturingHandler(captured) {
  const service = createLiliService({ ...config, liliEnabled: true, deepseekApiKey: "test-placeholder-not-a-real-key" }, {
    runtimeFactory: async () => ({ run: async (prompt) => { captured.push(reference(prompt)); return { finalResponse: "这是测试替身返回，未发起真实模型请求。" }; }, close: async () => {} }),
  });
  services.push(service);
  return createApiHandler({ db, config, lili: service });
}

test("capacitor HTTP requires authentication and provides local open-circuit guidance with no upstream runtime", async () => {
  const context = capacitorContext({ capacitorHistory: history("open-run", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 1, mode: "open" }]) });
  assert.equal((await request("/lili/chat", { method: "POST", user: "anonymous", body: chatBody(context) })).status, 401);
  const before = structuredClone(context);
  const result = await request("/lili/chat", { method: "POST", body: chatBody(context, "断路后为什么还有电压？") });
  assert.equal(result.status, 200); assert.equal(result.payload.data.mode, "guided");
  assert.match(result.payload.data.text, /断路|开路/);
  assert.match(result.payload.data.text, /保持|保留|不等于放空/);
  assert.deepEqual(context, before); assert.equal(factories, 0);
});

test("malformed or missing capacitor histories and forged segment voltages fail closed at the actual handler", async () => {
  const base = capacitorContext();
  const { capacitorHistory: omitted, ...missing } = base;
  const invalid = [missing,
    { ...base, capacitorHistory: { ...history(), initialVoltage: 1 } },
    { ...base, capacitorHistory: { ...history(), segmentInitialVoltage: 2 } },
    { ...base, capacitorHistory: history("bad-first", [{ startTimeSeconds: .1, mode: "charge" }]) },
    { ...base, capacitorHistory: history("bad-mode", [{ startTimeSeconds: 0, mode: "short" }]) },
    { ...base, capacitorHistory: history("bad-voltage", [{ startTimeSeconds: 0, mode: "charge", initialVoltage: 4 }]) },
    { ...base, capacitorHistory: history("future", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 4, mode: "open" }]) },
    { ...base, capacitorHistory: history("reverse", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 2, mode: "open" }, { startTimeSeconds: 1, mode: "discharge" }]) },
    { ...base, capacitorHistory: history("repeat", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 1, mode: "charge" }]) },
    { ...base, capacitorHistory: history("too-many", Array.from({ length: 33 }, (_, index) => ({ startTimeSeconds: index / 20, mode: index % 2 ? "open" : "charge" }))) },
    { ...base, timeSeconds: 95 },
    { ...base, parameters: { ...parameters, resistanceKOhm: 0 } },
    { ...base, recordCount: 1, samples: [{ id: "missing-history", parameters, timeSeconds: 1 }] },
    { ...base, manualRecordCount: 0, manualSamples: [] },
    { experimentId: "pendulum", parameters: { length: 1, amplitudeDegrees: 5, mass: .1 }, timeSeconds: 1, recordCount: 0, capacitorHistory: history() },
  ];
  for (const context of invalid) {
    const result = await request("/lili/chat", { method: "POST", body: chatBody(context) });
    assert.equal(result.status, 422); assert.equal(result.payload.error.code, "VALIDATION_ERROR");
  }
  assert.equal(factories, 0);
});

test("trusted capacitor reference retains validated switching provenance and recomputes state instead of accepting client answers", async () => {
  const captured = []; const using = capturingHandler(captured);
  const context = capacitorContext({ capacitorHistory: history("preserved-switches", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 1, mode: "open" }]),
    snapshot: { state: { voltage: 987654, segmentInitialVoltage: 987654 }, capacitor: { mode: "discharge", segmentIndex: 999 } },
    metrics: [{ key: "storedEnergy", value: 987654 }], state: { current: 987654 } });
  const before = structuredClone(context);
  const result = await request("/lili/chat", { method: "POST", using, body: chatBody(context, "解释当前开关状态和能量") });
  assert.equal(result.status, 200); assert.equal(result.payload.data.mode, "ai");
  const expected = simulateHighSchoolExperiment("capacitor-charge", parameters, context.timeSeconds, context.capacitorHistory);
  assert.deepEqual(captured[0].capacitorHistory, context.capacitorHistory);
  assert.deepEqual(captured[0].modelSnapshot.capacitor, { mode: "open", segmentIndex: 1 });
  assert.deepEqual(captured[0].modelSnapshot.state, expected.state);
  assert.equal(captured[0].modelSnapshot.state.current, 0); assert.ok(captured[0].modelSnapshot.state.voltage > 0);
  assert.equal(captured[0].manualInstrumentReadings, null);
  assert.doesNotMatch(JSON.stringify(captured[0]), /987654/);
  assert.match(captured[0].rules, /绝不是学生实际测量/);
  assert.deepEqual(context, before);
});

test("capacitor saved analysis separates distinct runs and full history prefixes while estimating RC from recomputed values", async () => {
  const captured = []; const using = capturingHandler(captured);
  const histories = [
    history("run-a", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 2, mode: "discharge" }]),
    history("run-a", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 1, mode: "open" }, { startTimeSeconds: 2, mode: "discharge" }]),
    history("run-b", [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 2, mode: "discharge" }]),
  ];
  const samples = histories.flatMap((capacitorHistory, group) => [3, 4, 5].map((timeSeconds, index) => ({
    id: `history-${group}-${index}`, parameters, timeSeconds, capacitorHistory,
    metrics: [{ key: "voltage", value: 987654 }], fit: { slope: 987654 },
  })));
  const context = capacitorContext({ timeSeconds: 5, recordCount: samples.length, samples, capacitorHistory: histories[2] });
  const result = await request("/lili/chat", { method: "POST", using, body: chatBody(context, "分析保存的时间常量和电压差对数图") });
  assert.equal(result.status, 200);
  const analysis = captured[0].savedSimulationAnalysis;
  assert.equal(analysis.provenance, "simulation-recomputed");
  assert.equal(analysis.requestedRelationshipId, "capacitor-log-voltage-time");
  assert.equal(analysis.includedCount, 9); assert.equal(analysis.groups.length, 3);
  for (const group of analysis.groups) {
    assert.equal(group.status, "ready"); assert.equal(group.distinctXCount, 3);
    assert.ok(Math.abs(group.fit.slope + 1 / 4.7) < 1e-10);
    assert.ok(Math.abs(group.estimates.find((estimate) => estimate.key === "timeConstant").value - 4.7) < 1e-10);
  }
  assert.doesNotMatch(JSON.stringify(analysis), /987654/);
});

test("the handler accepts 30 complete 32-segment saved histories above the old body limit without trimming them", async () => {
  const complete = history("maximal-run", Array.from({ length: 32 }, (_, index) => ({ startTimeSeconds: index, mode: ["charge", "open", "discharge"][index % 3] })));
  const samples = Array.from({ length: 30 }, (_, index) => ({ id: `complete-${index}`, parameters, timeSeconds: 32 + index / 10, capacitorHistory: structuredClone(complete) }));
  const body = chatBody(capacitorContext({ timeSeconds: 35, recordCount: 30, samples, capacitorHistory: complete }), "断路与暂停有什么区别？");
  assert.ok(Buffer.byteLength(JSON.stringify(body)) > 32_768);
  assert.ok(Buffer.byteLength(JSON.stringify(body)) < 128 * 1024);
  const captured = []; const using = capturingHandler(captured);
  const result = await request("/lili/chat", { method: "POST", using, body });
  assert.equal(result.status, 200);
  assert.deepEqual(captured[0].capacitorHistory, complete);
  assert.equal(captured[0].savedSimulationAnalysis.includedCount, 30);
  assert.equal(captured[0].capacitorHistory.segments.length, 32);
});

test("capacitor classroom publication gate preserves planned exclusion and, once released, the report/feedback/read-only workflow", async () => {
  const lessonBody = { experimentId: "capacitor-charge", title: "电容器分段探究", objective: "保存完整切换过程并解释断路保持", inquiryQuestion: "为什么断路仍有电压？", predictionPrompt: "区分电压连续与电流跳变", controlledVariable: "同一轮固定R/C/E", evidenceRequirement: "同段模型采样与完整开关来源", reflectionPrompt: "理想电表与漏电边界", durationMinutes: 30, status: "ready" };
  const lesson = await request("/lessons", { method: "POST", user: "teacher", body: lessonBody });
  if (getHighSchoolExperiment("capacitor-charge").status !== "ready") {
    assert.equal(lesson.status, 422); assert.equal(lesson.payload.error.code, "EXPERIMENT_NOT_AVAILABLE");
    return;
  }
  assert.equal(lesson.status, 201);
  const task = await request("/tasks", { method: "POST", user: "teacher", body: { classId: "class-801", lessonId: lesson.payload.data.id, title: "电容器课堂任务", mode: "in-class", status: "published", allowRetry: false } });
  assert.equal(task.status, 201);
  const start = await request("/sessions", { method: "POST", body: { taskId: task.payload.data.id } });
  assert.equal(start.status, 201); const sessionId = start.payload.data.id;
  assert.equal(start.payload.data.experimentId, "capacitor-charge");
  const report = { prediction: " 断路时I为0，U可保持非零。\n", measurements: `模型采样及完整过程，非实体实测：\n${JSON.stringify(capacitorContext())}`, conclusion: "分段分析，不把开路当作放电。", question: "暂停时钟与断路有什么区别？" };
  const saved = await request(`/sessions/${sessionId}/record`, { method: "PUT", body: { ...report, expectedRevision: 0, mutationId: "capacitor-report" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.payload.data.record.measurements, report.measurements);
  const teacher = await request(`/tasks/${task.payload.data.id}/records`, { user: "teacher" });
  assert.deepEqual(teacher.payload.data[0].record, saved.payload.data.record);
  const feedback = await request(`/sessions/${sessionId}/feedback`, { method: "POST", user: "teacher", body: { body: "请说明完整切换过程和电容储能。", expectedRevision: 1, mutationId: "capacitor-feedback" } });
  assert.equal(feedback.status, 201); assert.deepEqual(feedback.payload.data.reportSnapshot, report);
  assert.deepEqual((await request(`/sessions/${sessionId}/feedback`)).payload.data, [feedback.payload.data]);
  assert.equal((await request(`/sessions/${sessionId}/record`, { user: "other" })).status, 403);
  assert.equal((await request(`/sessions/${sessionId}/feedback`, { user: "other" })).status, 403);
  assert.equal((await request(`/sessions/${sessionId}/complete`, { method: "PATCH" })).status, 200);
  const locked = await request(`/sessions/${sessionId}/record`, { method: "PUT", body: { ...report, expectedRevision: 1, mutationId: "after-completion" } });
  assert.equal(locked.status, 409); assert.equal(locked.payload.error.code, "SESSION_COMPLETED");
  const retry = await request("/sessions", { method: "POST", body: { taskId: task.payload.data.id } });
  assert.equal(retry.status, 409); assert.equal(retry.payload.error.code, "TASK_ALREADY_COMPLETED");
});
