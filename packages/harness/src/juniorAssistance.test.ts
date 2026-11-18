import { describe, expect, it } from "vitest";
import { appendDialogueExchange, createHarnessSession, diagnoseHarnessExperiment, harnessShortFollowUp, isHarnessApparatusCheckQuestion, processHarnessEvent, RuleBasedDialogueAssistant, RuleBasedLearningAssistant } from "./index";
import type { HarnessApparatusContext, HarnessSession } from "./types";

const tutor = new RuleBasedDialogueAssistant();
function apparatus(module = "sound-features", ready = true, issues: string[] = []): HarnessApparatusContext {
  return { current: { module, capturedAt: "2026-11-12T00:00:00.000Z", origin: "learner",
    controls: [{ id: "frequency", label: "频率", value: 600, unit: "Hz", source: "control" }], apparatus: [],
    readings: [{ id: "display", label: "页面显示", value: 600, unit: "Hz", source: "reading" }],
    derived: [{ id: "prediction", label: "预测值", value: 12345, source: "model" }], validity: { ready, issues } } };
}
function complete(session: HarnessSession, module: string, question: string, context?: HarnessApparatusContext) {
  return appendDialogueExchange(session, module, question, tutor.respondToQuestion(session, module, question, context));
}

describe("junior current apparatus diagnostics", () => {
  it("reports an actual issue even if snapshot ready is true, without declaring a completed measurement", () => {
    const context = apparatus("bench", true, ["当前能形成实像，但光屏还没有移到清晰像面。"]);
    const reply = tutor.respondToQuestion(createHarnessSession("lens"), "bench", "帮我检查当前实验", context);
    expect(reply.text).toContain("光屏还没有移到清晰像面"); expect(reply.text).toContain("先处理第一项");
    expect(reply.text).toContain("模型推导不代替手动测量"); expect(reply.text).not.toContain("12345");
    expect(reply.text).not.toContain("测量已经完成");
  });

  it.each([undefined, apparatus("circuit-basic")])("does not substitute another module or old conversation for a missing current snapshot", (context) => {
    const session = complete(createHarnessSession("sound"), "sound-features", "频率为什么会变？", apparatus());
    const reply = tutor.respondToQuestion(session, "sound-features", "现在呢？", context);
    expect(reply.text).toContain("还没有取得"); expect(reply.text).not.toContain("600");
  });

  it("does not equate readiness with proof, and treats multiple changed controls only as a conditional warning", () => {
    const context = apparatus(); context.current.controls.push({ id: "amplitude", label: "振幅", value: 20, unit: "%", source: "control" });
    context.previous = structuredClone(context.current); context.previous.controls[0]!.value = 300; context.previous.controls[1]!.value = 10;
    const reply = tutor.respondToQuestion(createHarnessSession("sound"), "sound-features", "这样可以吗？", context);
    expect(reply.text).toContain("不等于实验已完成或结论正确"); expect(reply.text).toContain("频率、振幅");
    expect(reply.text).toContain("如果准备用它们作对照"); expect(reply.text).toContain("不能认定你做错了");
  });

  it("does not fabricate a fault when readiness is false without a reason or numerical readings", () => {
    const context = apparatus("sound-features", false); context.current.controls = []; context.current.readings = [];
    const reply = tutor.respondToQuestion(createHarnessSession("sound"), "sound-features", "检查当前实验", context);
    expect(reply.text).toContain("不能把空白补成测量结果"); expect(reply.text).toContain("不能猜测是哪一处故障");
  });

  it.each(["为什么要检查当前实验？", "检查这条观察：振幅变大时波形变高", "现在读数对吗，为什么频率变高了？"])("preserves explicit questions rather than converting them to check commands: %s", (question) => {
    expect(isHarnessApparatusCheckQuestion(question)).toBe(false); expect(harnessShortFollowUp(question)).toBeUndefined();
  });

  it("does not certify a controlled comparison from mixed U and R operation histories", () => {
    let session = createHarnessSession("circuit"); const rules = new RuleBasedLearningAssistant();
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "circuit-ohm" } }, rules);
    for (const [control, value] of [["U", 3], ["R", 10], ["U", 6], ["R", 20]] as const) session = processHarnessEvent(session, { type: "control.changed", payload: { control, value } }, rules);
    expect(diagnoseHarnessExperiment(session, "circuit-ohm").comparisonReady).toBe(false);
    const hint = tutor.respondToQuestion(session, "circuit-ohm", "给我三级提示");
    expect(hint.text).toContain("还不能确认完整对照"); expect(hint.text).not.toContain("已经形成两组");
  });
});

describe("junior bounded follow-up guidance", () => {
  it("continues a short why from the recent same-module topic using the latest apparatus state", () => {
    const context = apparatus(); let session = complete(createHarnessSession("sound"), "sound-features", "频率变高会怎样？", context);
    context.current.controls[0]!.value = 900;
    const reply = tutor.respondToQuestion(session, "sound-features", "为什么？", context);
    expect(reply.text).toContain("继续问“频率变高会怎样？"); expect(reply.text).toContain("900"); expect(reply.text).toContain("音调");
    session = complete(session, "sound-features", "为什么？", context);
    const simple = tutor.respondToQuestion(session, "sound-features", "没看懂", context);
    expect(simple.text).toContain("频率变高会怎样"); expect(simple.text).toContain("还不是你已经做过的记录");
  });

  it("asks for the missing topic instead of inferring it from another module or no completed exchange", () => {
    const session = complete(createHarnessSession("sound"), "sound-medium", "介质怎样影响声音？", apparatus("sound-medium"));
    expect(tutor.respondToQuestion(session, "sound-features", "为什么？", apparatus()).text).toContain("还不能确定");
    expect(tutor.respondToQuestion(createHarnessSession("sound"), "sound-features", "下一步呢", apparatus()).text).toContain("还不能确定");
  });

  it("checks current blockers for next-step follow-ups instead of assuming the earlier instruction happened", () => {
    const session = complete(createHarnessSession("lens"), "bench", "给我二级提示");
    const reply = tutor.respondToQuestion(session, "bench", "下一步呢？", apparatus("bench", true, ["光屏还未对焦"]));
    expect(reply.text).toContain("不假定你已经做完上一步"); expect(reply.text).toContain("光屏还未对焦");
  });

  it("advances only from explicitly requested hint levels, never from an ordinary answer", () => {
    let session = complete(createHarnessSession("sound"), "sound-features", "解释一下声音", apparatus());
    expect(tutor.respondToQuestion(session, "sound-features", "再给一点提示", apparatus()).text).toContain("一级提示");
    session = complete(session, "sound-features", "给我二级提示", apparatus());
    expect(tutor.respondToQuestion(session, "sound-features", "再给一点提示", apparatus()).text).toContain("三级提示");
  });
});
