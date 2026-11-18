import { describe, expect, it } from "vitest";
import type { LiliExperimentContext, LiliManualSample } from "@physics-lab/contracts";
import { createLiliGuidance, liliAnalysisReference, prepareLiliContext } from "./lili";
import { liliManualReference, prepareLiliManualContext } from "./liliManual";

const parameters = { mass: 0.2, dropHeight: 1.2, resistanceRatio: 0 };
const readings = { ...parameters, indexA: 5, indexB: 10, aBeforeMm: 31.4, aCenterMm: 49, aAfterMm: 70.6, bBeforeMm: 158.8, bCenterMm: 196, bAfterMm: 237.2 };
function sample(): LiliManualSample { return { id: "manual-tape-1", kind: "mechanical-energy-tape", parameters: { ...parameters }, timeSeconds: 0.3, readings: { ...readings } }; }
function context(withManual = true): LiliExperimentContext {
  return { experimentId: "mechanical-energy", parameters: { ...parameters }, timeSeconds: 0.3, recordCount: 0,
    manualRecordCount: withManual ? 1 : 0, manualSamples: withManual ? [sample()] : [] };
}
function value(reference: NonNullable<ReturnType<typeof liliManualReference>>, key: string) { return reference.records[0]!.metrics.find((metric) => metric.key === key)!.value; }

describe("Lili mechanical-energy model and independent tape evidence", () => {
  it("recomputes the current model and ignores client state or energy claims", () => {
    const input = { ...context(false), state: { kineticEnergy: 999 }, snapshot: { state: { position: 999 } } };
    const prepared = prepareLiliContext(input);
    expect(prepared.snapshot!.state.position).toBeCloseTo(0.441, 12);
    expect(prepared.snapshot!.state.kineticEnergy).toBeCloseTo(0.86436, 12);
    expect(prepared.context!.parameters).toEqual(parameters);
    expect(JSON.stringify(prepared.context)).not.toContain("999");
  });

  it("keeps all six original readings and recomputes only their arithmetic", () => {
    const original = context();
    const forged = { ...original, manualSamples: [{ ...sample(), metrics: [{ key: "velocityA", value: 999 }], warnings: ["UNTRUSTED"] }] };
    const prepared = prepareLiliContext(forged).context!;
    expect(prepared.manualSamples).toEqual(original.manualSamples);
    const reference = liliManualReference(prepared)!;
    expect(reference.provenance).toBe("virtual-manual");
    expect(reference.records[0]!.readings).toEqual(readings);
    expect(value(reference, "velocityA")).toBeCloseTo(0.98, 12);
    expect(value(reference, "velocityB")).toBeCloseTo(1.96, 12);
    expect(value(reference, "kineticEnergyIncrease")).toBeCloseTo(0.28812, 12);
    expect(value(reference, "potentialEnergyLoss")).toBeCloseTo(0.28812, 12);
    expect(JSON.stringify(reference)).not.toContain("UNTRUSTED");
    expect(reference.notice).toContain("六个");
  });

  it("does not repair a student's wrong coordinates with model velocity or energy-derived answers", () => {
    const input = context(); input.manualSamples![0]!.readings.bAfterMm = 300;
    const reference = liliManualReference(input)!;
    expect(reference.records[0]!.readings.bAfterMm).toBe(300);
    expect(value(reference, "velocityB")).toBeCloseTo(3.53, 12);
    expect(value(reference, "energyDifference")).toBeLessThan(0);
    const text = createLiliGuidance("核对我的纸带读数", input).text;
    expect(text).toContain("300");
    expect(text).toContain("复核");
    expect(text).toContain("没有用gt");
  });

  it("keeps saved conditions after current controls change", () => {
    const input = context(); input.parameters = { mass: 0.5, dropHeight: 2, resistanceRatio: 0.4 };
    const reference = liliManualReference(input)!;
    expect(reference.records[0]!.parameters).toEqual(parameters);
    expect(value(reference, "kineticEnergyIncrease")).toBeCloseTo(0.28812, 12);
  });

  it.each([
    { timeSeconds: 0.219999 }, { timeSeconds: 0.6 },
    { parameters: { ...parameters, mass: 0.3 } },
    { readings: { ...readings, aBeforeMm: 31.41 } },
    { readings: { ...readings, indexB: 6, bBeforeMm: 49.1, bCenterMm: 70.6, bAfterMm: 96 } },
    { readings: { ...readings, indexA: 0 } },
    { readings: { ...readings, bAfterMm: Infinity } },
    { readings: { ...readings, suppliedVelocity: 0.98 } },
    { kind: "pendulum-timing" }
  ])("rejects invalid, future or silently rewritten tape evidence %j", (override) => {
    expect(() => prepareLiliManualContext("mechanical-energy", { ...context(), manualSamples: [{ ...sample(), ...override }] })).toThrow(RangeError);
  });

  it("allows adjacent internal points with exact overlapping readings", () => {
    const input = { ...context(), manualSamples: [{ ...sample(), readings: { ...readings, indexB: 6, bBeforeMm: 49, bCenterMm: 70.6, bAfterMm: 96 } }] };
    expect(prepareLiliContext(input).context!.manualSamples![0]!.readings.indexB).toBe(6);
  });

  it("explains absent manual data without claiming a measured speed or silently using automatic samples", () => {
    const input = context(false);
    input.recordCount = 3;
    input.samples = [0.1, 0.2, 0.3].map((timeSeconds, i) => ({ id: `auto-${i}`, parameters: { ...parameters }, timeSeconds }));
    const text = createLiliGuidance("看看我的纸带读数", input).text;
    expect(text).toContain("没有");
    expect(text).toContain("两组三个");
    expect(text).toContain("不用gt");
    expect(text).not.toContain("vA=0");
  });

  it("reports central speeds and changes between A/B, not B's kinetic energy alone", () => {
    const text = createLiliGuidance("分析我的纸带读数", context()).text;
    expect(text).toContain("A=5"); expect(text).toContain("B=10");
    expect(text).toContain("0.98"); expect(text).toContain("1.96");
    expect(text).toContain("0.2881");
    expect(text).toContain("A点速度没有被设为零");
    expect(text).toContain("0.1 mm");
  });

  it("distinguishes constant upward resistance, model energy and pre-impact stopping", () => {
    const input = context(false); input.parameters.resistanceRatio = 0.2;
    const text = createLiliGuidance("当前阻力下能量状态如何？", input).text;
    expect(text).toContain("恒定阻力");
    expect(text).toContain("不是真实空气阻力");
    expect(text).toContain("不是手动纸带测量");
    expect(text).toContain("碰撞前");
    expect(createLiliGuidance("这样满分并掌握了吗？", context()).text).toContain("不能按保存数量");
  });

  it("fits only saved automatic conditions and separates changed resistance ratios", () => {
    const input = context(false);
    input.recordCount = 4;
    input.samples = [0.1, 0.2, 0.3].map((timeSeconds, i) => ({ id: `auto-${i}`, parameters: { ...parameters, resistanceRatio: 0.2 }, timeSeconds }));
    input.samples.push({ id: "other", parameters: { ...parameters }, timeSeconds: 0.1 });
    const reference = liliAnalysisReference(input, "自动模型动能和势能拟合")!;
    expect(reference.requestedRelationshipId).toBe("kinetic-gain-potential-loss");
    expect(reference.groups).toHaveLength(2);
    expect(reference.groups[0]!.fit!.slope).toBeCloseTo(0.8, 12);
    expect(reference.groups[0]!.fit!.intercept).toBeCloseTo(0, 12);
    expect(reference.groups[0]!.conditions.join(" ")).toContain("不是独立测量");
    expect(createLiliGuidance("分析自动模型数据", input).text).toContain("模型采样");
  });

  it("asks which provenance to discuss when both automatic samples and manual readings are present", () => {
    const input = context();
    input.recordCount = 1; input.samples = [{ id: "auto-1", parameters, timeSeconds: 0.2 }];
    expect(createLiliGuidance("帮我分析记录", input).text).toContain("请选择要讨论哪组");
  });
  it("answers tape-error questions using the recorded conditions rather than current controls", () => {
    const input = context(); input.parameters.resistanceRatio = 0.4;
    const text = createLiliGuidance("纸带有哪些误差来源？", input).text;
    for (const phrase of ["r=0", "49、196", "0.1 mm量化", "共享点", "mm到m", "区间太短", "匀变速", "不是读尺误差", "不为凑守恒"]) expect(text).toContain(phrase);
    expect(text).not.toContain("r=0.4");
  });

  it("offers error-checking methods without pretending unsaved tape evidence exists", () => {
    const text = createLiliGuidance("纸带能量偏小是什么误差？", context(false)).text;
    expect(text).toContain("还没有收到");
    expect(text).toContain("不能断言");
    expect(text).toContain("中央差分");
    expect(text).not.toContain("这条记录选");
  });

});
