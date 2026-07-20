import { describe, expect, it } from "vitest";
import { appendDialogueExchange, createHarnessObservation, createHarnessSession, processHarnessEvent, RuleBasedDialogueAssistant, RuleBasedLearningAssistant } from "./index";

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

  it("persists a learner and assistant exchange with a trace event", () => {
    const base = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    const reply = dialogueAssistant.respondToQuestion(base, "sound-features", "为什么频率会影响音调？");
    const session = appendDialogueExchange(base, "sound-features", "为什么频率会影响音调？", reply, "2026-01-01T00:00:01.000Z");
    expect(session.dialogue).toHaveLength(2);
    expect(session.dialogue?.[1]?.role).toBe("assistant");
    expect(session.events[0]?.type).toBe("dialogue.asked");
  });
});
