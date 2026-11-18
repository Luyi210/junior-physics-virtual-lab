import { describe, expect, it } from "vitest";
import {
  appendDialogueExchange, createHarnessObservation, createHarnessSession, diagnoseHarnessExperiment,
  getHarnessCoachAlert, getHarnessKnowledgeMastery, getHarnessLearnerModel, getHarnessLearningBranch, harnessShortFollowUp, isHarnessNextStepQuestion,
  processHarnessEvent, RuleBasedDialogueAssistant, RuleBasedLearningAssistant,
} from "./index";
import type { HarnessApparatusContext, HarnessSession } from "./types";

const tutor = new RuleBasedDialogueAssistant();
const rules = new RuleBasedLearningAssistant();
const module = "sound-features";
function apparatus(ready = true, issues: string[] = []): HarnessApparatusContext {
  return { current: { module, capturedAt: "2026-11-12T00:00:00.000Z", origin: "learner",
    controls: [{ id: "frequency", label: "频率", value: 600, unit: "Hz", source: "control" }], apparatus: [],
    readings: [{ id: "display", label: "页面显示", value: 600, unit: "Hz", source: "reading" }],
    derived: [{ id: "prediction", label: "预测值", value: 12345, source: "model" }], validity: { ready, issues } } };
}
function enter() {
  return processHarnessEvent(createHarnessSession("sound"), { type: "module.entered", payload: { module } }, rules);
}
function operation(session: HarnessSession, control: string, value: number) {
  return processHarnessEvent(session, { type: "control.changed", payload: { control, value } }, rules);
}
function next(session: HarnessSession, context?: HarnessApparatusContext) {
  return tutor.respondToQuestion(session, module, "下一步做什么？", context).text;
}
function complete(session: HarnessSession, question: string, context = apparatus()) {
  const reply = tutor.respondToQuestion(session, module, question, context);
  return { reply, session: appendDialogueExchange(session, module, question, reply) };
}

describe("junior one-step coaching", () => {
  it.each(["下一步做什么？", "帮我规划下一步", "请帮我安排一下下一步操作", "我现在该做什么", "接下来怎么做？"])("recognizes an explicit request without needing old discussion: %s", (question) => {
    expect(isHarnessNextStepQuestion(question)).toBe(true);
    expect(tutor.respondToQuestion(enter(), module, question, apparatus()).text).toContain("只把频率调到另一个值");
  });

  it.each(["下一步为什么固定振幅？", "帮我规划下一步，为什么频率变高音调变高？", "下一步读数是多少", "我没看懂频率为什么变高"])("does not replace a specific question with a generic plan: %s", (question) => {
    expect(isHarnessNextStepQuestion(question)).toBe(false);
    expect(harnessShortFollowUp(question)).toBeUndefined();
  });

  it("offers only a provisional first action with no snapshot or a wrong-module snapshot", () => {
    const wrong = apparatus(); wrong.current.module = "sound-medium";
    for (const context of [undefined, wrong]) {
      const text = next(enter(), context);
      expect(text).toContain("不能判断你做到哪一步");
      expect(text).not.toContain("600"); expect(text).not.toContain("12345");
    }
  });

  it("prioritizes current blockers even when records and readiness suggest progress", () => {
    let session = operation(operation(enter(), "频率", 300), "频率", 600);
    session = createHarnessObservation(session, "振幅不变时，600Hz 比 300Hz 音调更高。", rules);
    const text = next(session, apparatus(true, ["设备仍未就绪"]));
    expect(text).toContain("先处理当前页面这一项提醒"); expect(text).toContain("设备仍未就绪");
    expect(text).not.toContain("用自己的话补一句"); expect(text).not.toContain("测量完成");
  });

  it("does not diagnose an invented failure when not ready without a stated reason", () => {
    expect(next(enter(), apparatus(false))).toContain("不能猜测故障");
  });

  it("asks for actual observations before pushing another parameter change", () => {
    const text = next(operation(enter(), "频率", 300), apparatus());
    expect(text).toContain("先保留当前设置");
    expect(text).toContain("不能写成自己手动测得");
  });

  it("uses repeated one-control values only as a cue to verify complete comparison conditions", () => {
    const text = next(operation(operation(enter(), "频率", 300), "频率", 600), apparatus());
    expect(text).toContain("不能证明两组条件可比");
    expect(text).toContain("没有留下前一组现象"); expect(text).not.toContain("12345");
  });

  it("asks for the missing evidence component and labels a learner record as unverified", () => {
    const session = createHarnessObservation(operation(enter(), "频率", 300), "音调更高", rules);
    const text = next(session, apparatus());
    expect(text).toContain("先补这条记录中的“实验条件”");
    expect(text).toContain("还没有独立核验其真实性");
  });

  it("does not treat another experiment's records or assistant prose as current evidence", () => {
    let session = createHarnessObservation(operation(enter(), "频率", 300), "别的实验记录秘密值88888", rules);
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "sound-medium" } }, rules);
    const text = next(session, apparatus());
    expect(text).not.toContain("88888"); expect(text).toContain("先做这一小步");
    expect(diagnoseHarnessExperiment(session, module).observationCount).toBe(0);
  });

  it("ignores generated summaries as learner observations", () => {
    const session = createHarnessObservation(operation(enter(), "频率", 300), "【声音三要素探究小结】完成所有验证。", rules);
    expect(next(session, apparatus())).toContain("还没有可引用的观察记录");
  });
});

describe("junior simpler explanations", () => {
  it("changes explanation form on successive requests without reusing old numerical claims", () => {
    let session = appendDialogueExchange(enter(), module, "频率为什么影响音调？", { intent: "explain", text: "假的旧答案77777", followUps: [] });
    const answers: string[] = [];
    for (const question of ["没看懂", "还是没看懂", "换个说法"]) {
      const result = complete(session, question); session = result.session; answers.push(result.reply.text);
    }
    expect(answers[0]).toContain("一秒里振动多少次");
    expect(answers[1]).toContain("换成一个观察问题");
    expect(answers[2]).toContain("这次换成两句话来区分");
    for (const text of answers) { expect(text).not.toContain("77777"); expect(text).not.toContain("12345"); }
  });

  it.each([
    ["振幅为什么影响响度？", "振动的幅度有多大"],
    ["音色为什么不同？", "音色帮助我们区分不同声源"],
    ["为什么一次只改变一个量，其他保持不变？", "如果一次改了两件事"],
    ["我应该记录哪些证据？", "先写条件，再写你实际看到"],
  ])("keeps the actual topic when simplifying: %s", (question, expected) => {
    const initial = complete(enter(), question);
    const reply = tutor.respondToQuestion(initial.session, module, "换个说法", apparatus());
    expect(reply.text).toContain(expected);
  });

  it("clarifies a missing prior topic instead of fabricating an explanation", () => {
    expect(tutor.respondToQuestion(enter(), module, "换个说法", apparatus()).text).toContain("还不能确定");
  });

  it("explains a principle without claiming a missing or blocked observation already happened", () => {
    const initial = complete(enter(), "频率为什么影响音调？");
    expect(tutor.respondToQuestion(initial.session, module, "没看懂").text).toContain("没有确认你已得到相应现象");
    expect(tutor.respondToQuestion(initial.session, module, "没看懂", apparatus(false, ["未开启振动"])).text).toContain("当前先处理页面提醒：“未开启振动”");
  });
});

describe("junior learning evidence is not mastery", () => {
  it("never counts assistant explanations or repeated clicks as learner reasoning", () => {
    let session = enter();
    for (let index = 0; index < 10; index++) {
      session = operation(session, "频率", 300 + index);
      session = appendDialogueExchange(session, module, "为什么？", { intent: "explain", text: "因为频率更高，所以音调更高。", followUps: [] });
    }
    session = createHarnessObservation(session, "振幅相同，两组频率不同。", rules);
    const model = getHarnessLearnerModel(session, module);
    expect(model.dimensions.find((item) => item.id === "reasoning")?.score).toBe(0);
    expect(model.dimensions.find((item) => item.id === "comparison")?.score).toBeLessThan(100);
    expect(model.strength).toContain("不是掌握程度");
    expect(getHarnessLearningBranch(session, module)?.id).toBe("explain");
    expect(getHarnessKnowledgeMastery(session, module).reasoningTurns).toBe(0);
    expect(getHarnessCoachAlert(session, module).id).toMatch(/^reason-/);
    expect(getHarnessCoachAlert(session, module).evidence).not.toContain("完整探究链");
  });

  it("counts the structure of a learner attempt without certifying its physics", () => {
    let session = operation(operation(enter(), "频率", 300), "频率", 600);
    session = createHarnessObservation(session, "保持振幅不变，600Hz 比 300Hz 的音调更高。", rules);
    session = appendDialogueExchange(session, module, "我的解释：保持振幅不变，我观察到音调更高；因为频率就是音量，所以这证明了音量变大。", { intent: "reflect", text: "这句的物理解释仍有问题。", followUps: [] });
    const reasoning = getHarnessLearnerModel(session, module).dimensions.find((item) => item.id === "reasoning");
    expect(reasoning?.score).toBeGreaterThan(0); expect(reasoning?.note).toContain("不判断物理正确性");
    expect(getHarnessLearningBranch(session, module)?.reason).toContain("仍需核验");
    expect(getHarnessKnowledgeMastery(session, module).reasoningTurns).toBe(1);
    expect(getHarnessCoachAlert(session, module).evidence).toContain("不认证完成或掌握");
  });

  it("keeps old learner explanations in historical memory but does not claim they were done on a new visit", () => {
    let session = enter();
    session = appendDialogueExchange(session, module, "我的解释：保持振幅不变，我观察到频率高时音调高；因为频率表示振动快慢，所以本次支持频率影响音调。", { intent: "reflect", text: "核对实际记录。", followUps: [] }, "2020-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module } }, rules);
    session = createHarnessObservation(operation(operation(session, "频率", 300), "频率", 600), "两组音调有变化。", rules);
    expect(getHarnessKnowledgeMastery(session, module).reasoningTurns).toBe(1);
    expect(getHarnessLearnerModel(session, module).dimensions.find((item) => item.id === "reasoning")?.score).toBe(0);
    expect(getHarnessCoachAlert(session, module).id).toMatch(/^reason-/);
  });

  it("repeated clicks do not raise category coverage and generated summaries are excluded", () => {
    let session = operation(operation(enter(), "频率", 300), "频率", 600);
    const before = getHarnessKnowledgeMastery(session, module).confidence;
    for (let index = 0; index < 20; index++) session = operation(session, "频率", 600);
    session = createHarnessObservation(session, "【声音三要素探究小结】模型自动解释。", rules);
    const mastery = getHarnessKnowledgeMastery(session, module);
    expect(mastery.confidence).toBe(before); expect(mastery.observations).toBe(0);
  });
});
