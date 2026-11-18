import { describe, expect, it } from "vitest";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import { createCapacitorHistory, switchCapacitorMode } from "@physics-lab/physics/high-school";
import { analyzeLiliSamples, createLiliGuidance, liliAnalysisReference, prepareLiliContext } from "./lili";
import { liliManualReference } from "./liliManual";
const parameters = { resistanceKOhm: 10, capacitanceMicrofarads: 470, emf: 6 };
function context(): LiliExperimentContext {
  const initial = createCapacitorHistory("lili-rc-a");
  const open = switchCapacitorMode(parameters, initial, 2, "open");
  return { experimentId: "capacitor-charge", parameters: { ...parameters }, timeSeconds: 4, recordCount: 0, capacitorHistory: switchCapacitorMode(parameters, open, 3, "discharge") };
}
describe("Lili replayable RC context", () => {
  it("recomputes the current state from the complete history and ignores forged answers", () => {
    const input = { ...context(), snapshot: { state: { voltage: 999, current: 999 } }, metrics: "FAKE" };
    const result = prepareLiliContext(input);
    const expected = 6 * (1 - Math.exp(-2 / 4.7)) * Math.exp(-1 / 4.7);
    expect(result.snapshot!.state.voltage).toBeCloseTo(expected, 12);
    expect(result.snapshot!.state.current).toBeCloseTo(-expected / 10000, 12);
    expect(result.context!.capacitorHistory).toEqual(input.capacitorHistory);
    expect(result.context!.capacitorHistory).not.toBe(input.capacitorHistory);
    expect(JSON.stringify(result.context)).not.toContain("999");
    expect(liliManualReference(result.context)).toBeNull();
  });
  it("retains each old run's own parameters and prefix while current controls change", () => {
    const input = context(); input.parameters = { resistanceKOhm: 2, capacitanceMicrofarads: 500, emf: 3 };
    input.capacitorHistory = createCapacitorHistory("new-run"); input.timeSeconds = 1; input.recordCount = 3;
    input.samples = [0, 1, 2].map((timeSeconds, index) => ({ id: `old-${index}`, parameters: { ...parameters }, timeSeconds, capacitorHistory: createCapacitorHistory("old-run") }));
    const result = prepareLiliContext(input);
    expect(result.context!.samples).toEqual(input.samples);
    const analysis = analyzeLiliSamples(result.context)!;
    expect(analysis.groups[0]!.estimates[0]!.value).toBeCloseTo(4.7, 12);
    expect(analysis.groups[0]!.conditions.join()).toContain("old-run");
  });
  it("does not pool runs, switched segments or conflicting prefixes into one fit", () => {
    const input = context(); input.recordCount = 3;
    input.samples = ["a", "b", "c"].map((runId, i) => ({ id: runId, parameters: { ...parameters }, timeSeconds: i, capacitorHistory: createCapacitorHistory(runId) }));
    const reference = liliAnalysisReference(input, "分析时间常量")!;
    expect(reference.requestedRelationshipId).toBe("capacitor-log-voltage-time");
    expect(reference.groups).toHaveLength(3); expect(reference.groups.every((group) => group.fit === null)).toBe(true);
    expect(createLiliGuidance("分析时间常量", input).text).toContain("不能得出可靠");
  });
  it.each([
    { capacitorHistory: undefined }, { capacitorHistory: null }, { capacitorHistory: { ...context().capacitorHistory!, initialVoltage: 6 } },
    { capacitorHistory: { ...context().capacitorHistory!, initialVoltage: 0, guessedVoltage: 99 } },
    { capacitorHistory: { ...context().capacitorHistory!, segments: [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 5, mode: "discharge" }] } },
    { capacitorHistory: { ...context().capacitorHistory!, segments: [{ startTimeSeconds: 0, mode: "charge", voltage: 999 }] } },
    { capacitorHistory: { ...context().capacitorHistory!, runId: "" } }, { parameters: { emf: 6 } }, { timeSeconds: 95 },
    { manualRecordCount: 0, manualSamples: [] }
  ])("rejects incomplete or invented process inputs %#", (change) => {
    expect(() => prepareLiliContext({ ...context(), ...change })).toThrow(RangeError);
  });
  it("rejects missing or future sample histories instead of substituting the current run", () => {
    const input = context(); input.recordCount = 1;
    for (const capacitorHistory of [undefined, context().capacitorHistory]) {
      input.samples = [{ id: "old", parameters, timeSeconds: 1, capacitorHistory }];
      expect(() => prepareLiliContext(input)).toThrow(RangeError);
    }
    expect(() => prepareLiliContext({ ...context(), experimentId: "emf-internal-resistance", parameters: { emf: 3, internalResistance: 1, loadResistance: 5 } })).toThrow(RangeError);
  });
  it("rejects forged sample metrics by projection and recalculates the log-fit evidence", () => {
    const input = context(); input.recordCount = 3;
    input.samples = [0, 1, 2].map((timeSeconds, index) => ({ id: `s-${index}`, parameters, timeSeconds, capacitorHistory: createCapacitorHistory("sampled") }));
    const raw = { ...input, samples: input.samples.map((sample) => ({ ...sample, metrics: [{ key: "voltage", value: 999, unit: "V" }] })) };
    const prepared = prepareLiliContext(raw);
    expect(JSON.stringify(prepared.context)).not.toContain("999");
    const reference = liliAnalysisReference(prepared.context, "时间常量拟合")!;
    expect(reference.groups[0]!.estimates[0]!.value).toBeCloseTo(4.7, 12);
    expect(reference.provenance).toBe("simulation-recomputed");
  });
});

describe("Lili RC teaching boundaries", () => {
  it("explains open holding and the current sign without resetting voltage", () => {
    const input = context();
    const text = createLiliGuidance("当前放电电流为什么反向？", input).text;
    expect(text).toContain("为负"); expect(text).toContain("完整历史"); expect(text).toContain("连续");
    input.capacitorHistory = switchCapacitorMode(parameters, createCapacitorHistory("hold"), 2, "open");
    const open = createLiliGuidance("断路时为什么还有电压？", input).text;
    expect(open).toContain("I=0"); expect(open).toContain("不等于放空");
  });
  it("distinguishes stored energy, resistor heat and total source work", () => {
    const text = createLiliGuidance("电源能量去了哪里？", context()).text;
    expect(text).toContain("不能把电源功全部当成储能"); expect(text).toContain("耗散"); expect(text).toContain("½CE²");
  });
  it("defines plate charge and signed current area without conduction through dielectric", () => {
    const text = createLiliGuidance("I—t面积是整个电容器净电荷吗？", context()).text;
    expect(text).toContain("净电荷为0"); expect(text).toContain("有符号面积"); expect(text).toContain("不画成电荷穿过");
  });
  it("does not call 5tau, endpoint or sample count complete learning or exact charging", () => {
    expect(createLiliGuidance("5τ就充满了吗？", context()).text).toContain("不强制U变为E/0");
    expect(createLiliGuidance("我已完成掌握了吗？", context()).text).toContain("不能按保存条数");
  });
  it("does not claim a fitted tau or manual measurement without evidence", () => {
    const text = createLiliGuidance("怎样估计时间常量？", context()).text;
    expect(text).toContain("还没有"); expect(text).toContain("不能称为已经测得");
    expect(createLiliGuidance("手动读数在哪里？", context()).text).toContain("尚未提供手动");
  });
  it("reports open/equilibrium samples as unsupported and explains useful next samples", () => {
    const input = context(); input.recordCount = 3;
    input.samples = [0, 1, 2].map((timeSeconds, i) => ({ id: `open-${i}`, parameters, timeSeconds, capacitorHistory: createCapacitorHistory("open-run", "open") }));
    const text = createLiliGuidance("分析保存数据的时间常量", input).text;
    expect(text).toContain("断路保持"); expect(text).toContain("不能"); expect(text).toContain("同一");
  });
});
