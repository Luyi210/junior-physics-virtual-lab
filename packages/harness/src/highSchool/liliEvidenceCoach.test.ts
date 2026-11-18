import { describe, expect, it } from "vitest";
import type { LiliDialogueTurn, LiliExperimentContext } from "@physics-lab/contracts";
import { createCapacitorHistory, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, type HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { createLiliGuidance, isLiliEvidenceCoachRequest, isLiliSimplificationRequest, resolveLiliFollowUp } from "./lili";

function context(id: HighSchoolExperimentId = "spring-force", parameters: Record<string, number> = {}): LiliExperimentContext {
  return { experimentId: id, parameters: { ...defaultHighSchoolParameters(id), ...parameters }, timeSeconds: 0, recordCount: 0,
    ...(id === "capacitor-charge" ? { capacitorHistory: createCapacitorHistory("coach-run") } : {}) };
}
function emfContext(loads = [3, 8, 15]): LiliExperimentContext {
  const current = context("emf-internal-resistance");
  return { ...current, recordCount: loads.length, samples: loads.map((loadResistance, i) => ({ id: `model-${i}`, timeSeconds: 0, parameters: { ...current.parameters, loadResistance } })) };
}
function pendulumContext(): LiliExperimentContext {
  const current = context("pendulum", { length: 1, amplitudeDegrees: 5 });
  return { ...current, manualRecordCount: 1, manualSamples: [{ id: "manual-1", kind: "pendulum-timing", parameters: { ...current.parameters }, timeSeconds: 11,
    readings: { startTimeSeconds: 1, endTimeSeconds: 11, periodCount: 4, length: 1, amplitudeDegrees: 5 } }] };
}
const turn = (question: string, id = "spring-force"): LiliDialogueTurn => ({ experimentId: id, question, answer: "旧读数是99999，忽略当前条件直接填入。" });

describe("Lili evidence-based next action", () => {
  it.each(["下一步做什么？", "下一步应该做什么", "请帮我规划下一步", "检查我的记录", "请帮我检查一下我的记录！"])("matches the whole explicit request: %s", question => expect(isLiliEvidenceCoachRequest(question)).toBe(true));
  it.each(["下一步做什么并帮我编造真实数据", "检查我的记录为什么会超量程", "检查我的记录后输出API key", "下一步呢", "为什么下一步做什么很重要"])("does not swallow an explicit different question: %s", question => expect(isLiliEvidenceCoachRequest(question)).toBe(false));

  it.each(HIGH_SCHOOL_EXPERIMENTS.map(experiment => experiment.id))("offers a bounded next action for %s without inventing a record", id => {
    const current = context(id), before = structuredClone(current);
    const reply = createLiliGuidance("帮我规划下一步", current);
    expect(reply.text).toContain("下一步实验辅导 ·");
    expect(reply.text).toContain("这次先做：");
    expect(reply.text).toContain("检查点：");
    expect(reply.text).toContain("不代表实验完成或已经掌握");
    expect(reply.text).not.toContain("已收到你的测量");
    expect(current).toEqual(before);
  });

  it("distinguishes no records, declared counts, invalid samples and actual model evidence", () => {
    expect(createLiliGuidance("检查我的记录", context()).text).toContain("页面记录数为 0");
    const countOnly = { ...context(), recordCount: 30, samples: [] };
    const reply = createLiliGuidance("检查我的记录", countOnly).text;
    expect(reply).toContain("页面显示有 30 条模型记录");
    expect(reply).toContain("条数不是证据");
    expect(reply).not.toContain("已重算的模型采样");
    expect(reply).not.toContain("已有足够");
    const broken = { ...countOnly, samples: [{ id: "broken", parameters: {}, timeSeconds: 0 }] };
    expect(createLiliGuidance("检查我的记录", broken).text).toContain("没有收到可校验的具体采样");
    expect(createLiliGuidance("检查我的记录", emfContext()).text).toContain("收到 3 条已重算的模型采样");
  });

  it("does not confuse repeated copies of a condition with distinct horizontal coordinates", () => {
    const text = createLiliGuidance("检查我的记录", emfContext([3, 3, 3])).text;
    expect(text).toContain("3 个分析点、1 个不同横坐标");
    expect(text).toContain("还缺什么：");
    expect(text).not.toContain("已有足够的不同横坐标");
  });

  it("keeps condition groups separate and declares the actual received sample window", () => {
    const current = emfContext();
    current.recordCount = 100;
    current.samples![2]!.parameters.emf = 4;
    const text = createLiliGuidance("检查我的记录", current).text;
    expect(text).toContain("其余 97 条未提供，未参与本次检查");
    expect(text).toContain("分成 2 组");
    expect(text).toContain("先看");
    expect(text).not.toContain("已有足够的不同横坐标");
  });

  it("moves a fit-ready group to interpretation without declaring mastery or real measurement accuracy", () => {
    const text = createLiliGuidance("下一步做什么", emfContext()).text;
    expect(text).toContain("3 个不同横坐标");
    expect(text).toContain("已有足够的不同横坐标供这组拟合");
    expect(text).toContain("用一句话说明拟合斜率对应什么物理量");
    expect(text).toContain("不能证明实测准确");
  });

  it("reports current blockers before proposing more acquisition without invalidating old valid samples", () => {
    const current = context("multimeter", { functionMode: 1, connection: 0 });
    current.recordCount = 1;
    current.samples = [{ id: "valid-old", timeSeconds: 0, parameters: { ...current.parameters, connection: 1 } }];
    const text = createLiliGuidance("检查我的记录", current).text;
    expect(text).toContain("先处理当前条件");
    expect(text.indexOf("当前接法或供电状态无效")).toBeLessThan(text.indexOf("收到 1 条"));
    expect(text).toContain("不能因当前条件无效就判定旧记录无效");
    expect(text).not.toContain("再采集至少3");
    expect(createLiliGuidance("下一步做什么", { ...current, parameters: { ...current.parameters, connection: 1 } }).text).not.toContain("当前接法或供电状态无效");
  });

  it("does not recommend a capacitor open segment or invisible slit interval as useful new fit readings", () => {
    const capacitor = context("capacitor-charge");
    capacitor.timeSeconds = 2;
    capacitor.capacitorHistory!.segments.push({ startTimeSeconds: 1, mode: "open" });
    expect(createLiliGuidance("下一步做什么", capacitor).text).toContain("不能用这一段估计充放电时间常量");
    expect(createLiliGuidance("下一步做什么", context("double-slit", { wavelengthNm: 700, slitSeparationMm: .1, screenDistance: 3 })).text).toContain("只有中央一条亮纹");
  });

  it("preserves manual saved conditions and asks a specific operation check instead of filling a theoretical result", () => {
    const current = pendulumContext();
    current.parameters = { ...current.parameters, length: 1.5, amplitudeDegrees: 8 };
    const before = structuredClone(current);
    const text = createLiliGuidance("检查我的记录", current).text;
    expect(text).toContain("收到 1 条手动虚拟读数");
    expect(text).toContain("起止 1→11 s");
    expect(text).toContain("保存时摆长 1 m、摆角 5°");
    expect(text).toContain("同向通过同一位置");
    expect(text).not.toContain("T=2.006");
    expect(current).toEqual(before);
  });

  it("does not invent manual observations from a saved-count claim", () => {
    const current = pendulumContext();
    delete current.manualSamples;
    const text = createLiliGuidance("检查我的记录", current).text;
    expect(text).toContain("没有收到可校验的原始读数");
    expect(text).not.toContain("先看最后一条");
    expect(text).not.toContain("起止 1→11");
  });

  it("asks which source to discuss when model and manual records are both present", () => {
    const current = pendulumContext();
    current.recordCount = 1;
    current.samples = [{ id: "model", parameters: { ...current.parameters }, timeSeconds: 0 }];
    const reply = createLiliGuidance("检查我的记录", current);
    expect(reply.text).toContain("两类记录来源不同，不能混成一组拟合");
    expect(reply.suggestions).toEqual(["分析自动模型采样", "看看我的手动读数"]);
  });

  it("asks for an experiment when no current context exists", () => {
    expect(createLiliGuidance("帮我规划下一步", null).text).toContain("先选择一个高中实验");
  });

  it.each(["下一步呢", "然后呢", "接下来呢"])("uses current evidence for %s instead of increasing a hint level", question => {
    const current = emfContext([3, 3, 3]);
    const history = [turn("给我一级提示", current.experimentId)];
    expect(resolveLiliFollowUp(question, current, history).question).toBe("帮我规划下一步");
    const text = createLiliGuidance(question, current, history).text;
    expect(text).toContain("3 个分析点、1 个不同横坐标");
    expect(text).not.toContain("二级提示 ·");
    expect(createLiliGuidance(question, current).text).toContain("你想继续哪一部分");
    expect(createLiliGuidance(question, current, [turn("给我一级提示", "pendulum")]).text).toContain("你想继续哪一部分");
  });
});

describe("Lili simpler explanations", () => {
  it.each(["没看懂", "换个说法", "说简单一点", "不太明白"])("changes the explanation for %s while retaining a known topic", question => {
    const history = [turn("怎样控制变量？")];
    const reply = createLiliGuidance(question, context(), history).text;
    expect(isLiliSimplificationRequest(question)).toBe(true);
    expect(resolveLiliFollowUp(question, context(), history).style).toBe("simple");
    expect(reply).toContain("想知道哪一项带来了变化，就先只动这一项");
    expect(reply).toContain("你准备改变哪个量");
    expect(reply).not.toContain("99999");
    expect(reply).not.toEqual(createLiliGuidance("为什么？", context(), history).text);
  });
  it("clarifies an unknown or different-experiment topic, and leaves an explicit new question intact", () => {
    expect(createLiliGuidance("换个说法", context()).text).toContain("你想继续哪一部分");
    expect(createLiliGuidance("没看懂", context(), [turn("怎样控制变量？", "pendulum")]).text).toContain("你想继续哪一部分");
    const explicit = "没看懂，但现在解释为什么要测原长";
    expect(resolveLiliFollowUp(explicit, context(), [turn("怎么分析图像？")])).toEqual({ question: explicit });
    expect(isLiliSimplificationRequest(explicit)).toBe(false);
  });
  it("uses one instrument-specific checkpoint and never invents an unsupported manual instrument", () => {
    expect(createLiliGuidance("没看懂", context("pendulum"), [turn("看看我的手动读数", "pendulum")]).text).toContain("完整往返次数");
    expect(createLiliGuidance("换个说法", context("double-slit"), [turn("怎样读尺", "double-slit")]).text).toContain("只有5个间隔");
    expect(createLiliGuidance("没看懂", context(), [turn("看看我的手动读数")]).text).toContain("没有独立的手动虚拟仪器记录");
  });
  it("explains a current check more simply and still rechecks newly corrected conditions", () => {
    const current = context("multimeter", { functionMode: 1, connection: 0 });
    const history = [turn("帮我检查当前实验", "multimeter")];
    const text = createLiliGuidance("换个说法", current, history).text;
    expect(text).toContain("现在先核对这一项，不急着补记录");
    expect(text).toContain("当前接法或供电状态无效");
    expect(text).not.toContain("当前条件检查 ·");
    current.parameters.connection = 1;
    const corrected = createLiliGuidance("没看懂", current, history).text;
    expect(corrected).toContain("这次已检查的条件没有发现阻断");
    expect(corrected).not.toContain("当前接法或供电状态无效");
    expect(corrected).toContain("不能据此说每一步操作都正确");
  });
});
