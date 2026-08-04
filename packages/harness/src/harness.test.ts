import { describe, expect, it } from "vitest";
import { appendDialogueExchange, createHarnessObservation, createHarnessSession, diagnoseHarnessExperiment, getHarnessLearnerModel, harnessSessionToXAPIStatements, processHarnessEvent, RuleBasedDialogueAssistant, RuleBasedLearningAssistant, validateHarnessSession } from "./index";

const assistant = new RuleBasedLearningAssistant();
const dialogueAssistant = new RuleBasedDialogueAssistant();

describe("rule based learning harness", () => {
  it("creates a domain orientation when entering an experiment", () => {
    const session = processHarnessEvent(createHarnessSession("circuit", "test", "2026-01-01T00:00:00.000Z"), {
      type: "module.entered",
      payload: { module: "circuit" },
      occurredAt: "2026-01-01T00:00:01.000Z"
    }, assistant);
    expect(session.events).toHaveLength(1);
    expect(session.insights[0]?.ruleId).toBe("orientation-on-entry");
    expect(session.insights[0]?.message).toContain("串联");
  });

  it("suggests a controlled comparison after repeated changes", () => {
    let session = createHarnessSession("sound", "test");
    for (let index = 0; index < 3; index += 1) {
      session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: index + 1 } }, assistant);
    }
    expect(session.insights.some((item) => item.ruleId === "change-one-variable")).toBe(true);
  });

  it("turns a learner note into evidence-oriented feedback", () => {
    const session = createHarnessObservation(createHarnessSession("thermal", "test"), "水沸腾后温度基本不再升高。", assistant);
    expect(session.observations).toHaveLength(1);
    expect(session.events.at(-1)?.type).toBe("observation.created");
    expect(session.insights.some((item) => item.ruleId === "compare-after-observation")).toBe(true);
  });

  it("connects 3D camera navigation back to the measurement plane", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), {
      type: "scene.navigated",
      payload: { experiment: "reflection", action: "rotate", angle: 35 }
    }, assistant);
    expect(session.insights.some((item) => item.ruleId === "three-dimensional-view-is-not-a-new-law")).toBe(true);
  });

  it("suggests comparing presets after two distinct 3D views", () => {
    let session = createHarnessSession("optics", "test");
    session = processHarnessEvent(session, { type: "view.changed", payload: { experiment: "refraction", view: "front" } }, assistant);
    session = processHarnessEvent(session, { type: "view.changed", payload: { experiment: "refraction", view: "top" } }, assistant);
    expect(session.insights.some((item) => item.ruleId === "compare-spatial-view-presets")).toBe(true);
  });

  it("connects the black-hole extension back to straight-line propagation", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), {
      type: "control.changed",
      payload: { experiment: "black-hole", control: "光线与黑洞中心的距离", value: 120 }
    }, assistant);
    expect(session.insights.some((item) => item.ruleId === "black-hole-extends-straight-light")).toBe(true);
  });

  it("answers a method question with current experiment context", () => {
    let session = createHarnessSession("circuit", "test");
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "电源电压", value: 9, unit: "V" } }, assistant);
    const reply = dialogueAssistant.respondToQuestion(session, "circuit-basic", "下一步应该观察什么？");
    expect(reply.intent).toBe("method");
    expect(reply.text).toContain("电源电压");
    expect(reply.text).toContain("完整路径");
  });

  it("turns a guess into a testable prediction instead of judging it", () => {
    const session = createHarnessSession("thermal", "test");
    const reply = dialogueAssistant.respondToQuestion(session, "thermal-boiling", "我猜功率越大沸点越高，对吗？");
    expect(reply.intent).toBe("predict");
    expect(reply.text).toContain("先不判对错");
    expect(reply.followUps.length).toBeGreaterThan(0);
  });

  it("diagnoses the current module without borrowing controls from the previous experiment", () => {
    let session = createHarnessSession("optics", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "入射角", value: 30, unit: "°" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "refraction" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    const diagnosis = diagnoseHarnessExperiment(session, "refraction");
    expect(diagnosis.stage).toBe("orientation");
    expect(diagnosis.operationCount).toBe(0);
    expect(diagnosis.summary).not.toContain("入射角");
  });

  it("recognizes a comparison after one control receives two different values", () => {
    let session = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "sound-features" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 300, unit: "Hz" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 600, unit: "Hz" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    const diagnosis = diagnoseHarnessExperiment(session, "sound-features");
    expect(diagnosis.stage).toBe("comparing");
    expect(diagnosis.comparisonReady).toBe(true);
    expect(diagnosis.nextMove).toContain("记录");
  });

  it("builds a transparent learner model from operations, comparison and evidence", () => {
    let session = createHarnessSession("mechanics", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "mechanics-speed" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "运动时间", value: 10, unit: "s" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "运动时间", value: 20, unit: "s" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    session = createHarnessObservation(session, "路程相同时，20秒对应的平均速度更小。", assistant);
    const model = getHarnessLearnerModel(session, "mechanics-speed");
    expect(model.dimensions.find((item) => item.id === "comparison")?.score).toBe(100);
    expect(model.dimensions.find((item) => item.id === "evidence")?.score).toBeGreaterThan(0);
    expect(model.memoryLine).toContain("运动时间");
  });

  it("uses a Socratic scaffold when a learner asks for the answer directly", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), { type: "module.entered", payload: { module: "reflection" } }, assistant);
    const reply = dialogueAssistant.respondToQuestion(session, "reflection", "直接告诉我正确答案");
    expect(reply.intent).toBe("method");
    expect(reply.text).toContain("先不直接给答案");
    expect(reply.text).toContain("预测");
  });

  it("reveals help through a three-level scaffold without leaking the conclusion", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), { type: "module.entered", payload: { module: "refraction" } }, assistant);
    const first = dialogueAssistant.respondToQuestion(session, "refraction", "给我一级提示");
    const second = dialogueAssistant.respondToQuestion(session, "refraction", "给我二级提示");
    const third = dialogueAssistant.respondToQuestion(session, "refraction", "给我三级提示");
    expect(first.text).toContain("观察方向");
    expect(second.text).toContain("操作脚手架");
    expect(third.text).toContain("仍不替你写结论");
  });

  it("persists a learner and assistant exchange with a trace event", () => {
    const base = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    const reply = dialogueAssistant.respondToQuestion(base, "sound-features", "为什么频率会影响音调？");
    const session = appendDialogueExchange(base, "sound-features", "为什么频率会影响音调？", reply, "2026-01-01T00:00:01.000Z");
    expect(session.dialogue).toHaveLength(2);
    expect(session.dialogue?.[1]?.role).toBe("assistant");
    expect(session.events[0]?.type).toBe("dialogue.asked");
  });

  it("validates and migrates an early local session without a version field", () => {
    const current = createHarnessSession("measurement", "test", "2026-01-01T00:00:00.000Z");
    const { schemaVersion: _version, ...legacy } = current;
    const result = validateHarnessSession(legacy);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.schemaVersion).toBe(1);
  });

  it("rejects a damaged stored session before it reaches the interface", () => {
    const result = validateHarnessSession({ ...createHarnessSession("sound"), area: "chemistry" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((error) => error.path === "$.area")).toBe(true);
  });

  it("projects experiment events into actor-verb-object xAPI statements", () => {
    let session = createHarnessSession("circuit", "learner-7", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, {
      type: "module.entered",
      payload: { module: "circuit-ohm" },
      occurredAt: "2026-01-01T00:00:01.000Z"
    }, assistant);
    session = processHarnessEvent(session, {
      type: "control.changed",
      payload: { control: "导体两端电压", value: 6, unit: "V" },
      occurredAt: "2026-01-01T00:00:02.000Z"
    }, assistant);
    const statements = harnessSessionToXAPIStatements(session);
    expect(statements).toHaveLength(2);
    expect(statements[1]?.actor.account.name).toBe("learner-7");
    expect(statements[1]?.verb.display["zh-CN"]).toBe("调节了");
    expect(statements[1]?.object.id).toContain("circuit-ohm");
    expect(statements[1]?.result?.response).toBe("导体两端电压=6 V");
  });
});
