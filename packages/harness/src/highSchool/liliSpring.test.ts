import { describe, expect, it } from "vitest";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import { defaultHighSchoolParameters, highSchoolExperiment, simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import { createLiliGuidance, liliAnalysisReference, liliReferenceNotes, liliRequestedRelationship, prepareLiliContext } from "./lili";

function springContext(loads: number[] = [], overrides: Record<string, number> = {}): LiliExperimentContext {
  const parameters = { ...defaultHighSchoolParameters("spring-force"), ...overrides };
  return { experimentId: "spring-force", parameters, timeSeconds: 0, recordCount: loads.length,
    samples: loads.map((loadMassGrams, index) => ({ id: `spring-${index}`, parameters: { ...parameters, loadMassGrams }, timeSeconds: 0 })) };
}

describe("Lili spring-force guidance uses executable static-model evidence", () => {
  it("recomputes default working conditions and discards client-supplied lengths and forces", () => {
    const { context, snapshot } = prepareLiliContext({ ...springContext(), snapshot: { state: { force: 999, extension: 999 } } });
    expect(context?.timeSeconds).toBe(0);
    expect(snapshot!.durationSeconds).toBe(0);
    expect(snapshot!.state.loadMassKg).toBe(.1);
    expect(snapshot!.state.force).toBeCloseTo(.98, 12);
    expect(snapshot!.state.extension).toBeCloseTo(.049, 12);
    expect(snapshot!.state.length).toBeCloseTo(.199, 12);
    expect(snapshot!.metrics.map(({ key }) => key)).toEqual(["force", "extension", "length", "naturalLength"]);
  });

  it("the suggested zero-load baseline and 50/100/150 g trials fit k without changing controlled conditions", () => {
    const context = springContext([0, 50, 100, 150]);
    const guide = createLiliGuidance("我应该先做哪一步？", springContext()).text;
    expect(guide).toContain("50、100、150 g");
    expect(guide).toContain("无需播放");
    expect(guide).toContain("自动模型记录");
    const massControl = highSchoolExperiment("spring-force").parameters.find(({ key }) => key === "loadMassGrams")!;
    for (const sample of context.samples!) {
      expect(sample.parameters.loadMassGrams).toBeGreaterThanOrEqual(massControl.min);
      expect(sample.parameters.loadMassGrams).toBeLessThanOrEqual(massControl.max);
    }
    const analysis = liliAnalysisReference(context, "分析弹力与伸长量")!;
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0]).toMatchObject({ relationshipId: "force-extension", status: "ready", distinctXCount: 4 });
    expect(analysis.groups[0]!.fit!.slope).toBeCloseTo(20, 10);
    expect(analysis.groups[0]!.fit!.intercept).toBeCloseTo(0, 10);
    expect(analysis.groups[0]!.controls.map(({ key }) => key)).toEqual(expect.arrayContaining(["stiffness", "naturalLength"]));
    const baseline = simulateHighSchoolExperiment("spring-force", context.samples![0]!.parameters).state;
    expect(baseline.force).toBe(0);
    expect(baseline.extension).toBe(0);
    expect(baseline.length).toBe(baseline.naturalLength);
  });

  it.each(["stiffness", "naturalLength"])("changing %s splits the saved evidence instead of fitting incompatible springs", (key) => {
    const context = springContext([50, 100, 150]);
    context.samples![2]!.parameters[key] = key === "stiffness" ? 30 : .2;
    const analysis = liliAnalysisReference(context, "分析 F–x")!;
    expect(analysis.groups).toHaveLength(2);
    expect(analysis.groups.every(({ status }) => status === "insufficient")).toBe(true);
    const text = createLiliGuidance("分析弹力与伸长量", context).text;
    expect(text).toContain("还不能");
    expect(text).not.toContain("可用于拟合");
    const controls = createLiliGuidance("哪些量要保持不变？", context).text;
    expect(controls).toContain("固定劲度系数和原长");
    expect(controls).toContain("含托盘");
    expect(controls).toContain("9.8 m/s²");
  });

  it("repeated copies of one load do not meet the distinct-extension requirement", () => {
    const context = springContext([100, 100, 100]);
    expect(liliAnalysisReference(context)!.groups[0]!.distinctXCount).toBe(1);
    expect(createLiliGuidance("分析记录", context).text).toContain("还不能");
  });

  it("saved original conditions determine the fit after the current stiffness changes", () => {
    const context = springContext([50, 100, 150]);
    context.parameters = { ...context.parameters, stiffness: 50 };
    const analysis = liliAnalysisReference(context, "分析劲度系数")!;
    expect(analysis.groups[0]!.fit!.slope).toBeCloseTo(20, 10);
    const text = createLiliGuidance("分析劲度系数", context).text;
    expect(text).toContain("可用于拟合");
    expect(text).toContain("20 N/m");
    expect(text).toContain("模型采样");
    expect(text).not.toContain("50 N/m");
  });

  it("distinguishes original length, total length and extension in the current conditions", () => {
    const text = createLiliGuidance("原长、总长和伸长量有什么区别？", springContext()).text;
    expect(text).toContain("L₀=0.15 m");
    expect(text).toContain("L=0.199 m");
    expect(text).toContain("x=0.049 m");
    expect(text).toContain("以x而非L");
    const graph = createLiliGuidance("怎么分析图像？", springContext()).text;
    expect(graph).toContain("没有收到");
    expect(graph).toContain("横轴用伸长量");
    expect(graph).toContain("拟合截距不强制为0");
    expect(graph).toContain("不能把F/L当作k");
  });

  it("converts the complete suspended mass from grams without treating the tray as another uncounted load", () => {
    const text = createLiliGuidance("250克怎么换算？需要加托盘吗？", springContext([], { loadMassGrams: 250 })).text;
    expect(text).toContain("250 g=0.25 kg");
    expect(text).toContain("2.45 N");
    expect(text).toContain("包含托盘");
    expect(text).toContain("不应重复加一次托盘质量");
  });

  it("explains zero load and the largest allowed extension as current model states, not observed motion", () => {
    const zero = createLiliGuidance("现在什么状态？", springContext([], { loadMassGrams: 0 })).text;
    expect(zero).toContain("无外部悬挂载荷");
    expect(zero).toContain("总长等于原长");
    const maximum = createLiliGuidance("当前读数是多少？", springContext([], { loadMassGrams: 250, stiffness: 10, naturalLength: .3 })).text;
    expect(maximum).toContain("伸长量0.245 m");
    expect(maximum).toContain("总长0.545 m");
    expect(maximum).toContain("自动模型读数");
  });

  it("does not mistake the preset linear range or a perfect model fit for a measured elastic limit", () => {
    const text = createLiliGuidance("可以测出真实弹性限度吗？", springContext([0, 100, 250])).text;
    expect(text).toContain("0.25 m");
    expect(text).toContain("不是通过仿真测出的真实弹性限度");
    expect(text).toContain("理想轻弹簧的静态模型");
    const notes = liliReferenceNotes("spring-force")!;
    expect(notes.error).toContain("未模拟这些误差");
    expect(notes.error).toContain("自动记录不是真实测量");
    expect(createLiliGuidance("有哪些误差来源？", springContext()).text).toContain("总长当成伸长量");
  });

  it.each(["看看我的手动读数", "如何读尺？", "需要秒表吗？"])("does not send the spring question '%s' to another experiment's instruments", (question) => {
    const text = createLiliGuidance(question, springContext([50, 100, 150])).text;
    expect(text).toContain("尚未提供手动读尺");
    expect(text).toContain("自动模型读数");
    expect(text).not.toMatch(/单摆|双缝|亮纹|周期/);
    expect(text).not.toContain("已收到");
  });

  it("rejects a fabricated spring manual context instead of reinterpreting it as a pendulum record", () => {
    expect(() => prepareLiliContext({ ...springContext(), manualRecordCount: 0, manualSamples: [] })).toThrow("当前实验不支持手动虚拟仪器记录");
    const parameters = defaultHighSchoolParameters("uniform-acceleration");
    const text = createLiliGuidance("看看我的手动读数", { experimentId: "uniform-acceleration", parameters, timeSeconds: 0, recordCount: 0 }).text;
    expect(text).toContain("当前实验尚未提供");
    expect(text).not.toMatch(/单摆|双缝/);
  });

  it.each(["分析 F–x", "F—ΔL 图线", "分析弹力和伸长量", "求劲度系数", "force-extension", "胡克定律"])("selects force-extension for '%s'", (question) => {
    expect(liliRequestedRelationship("spring-force", question)).toBe("force-extension");
  });
});
