import { describe, expect, it } from "vitest";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import { defaultHighSchoolParameters } from "@physics-lab/physics/high-school";
import { createLiliGuidance, liliAnalysisReference, liliReferenceNotes, liliRequestedRelationship, prepareLiliContext } from "./lili";

function forceContext(angles: number[] = [], overrides: Record<string, number> = {}): LiliExperimentContext {
  const parameters = { ...defaultHighSchoolParameters("force-composition"), ...overrides };
  return { experimentId: "force-composition", parameters, timeSeconds: 0, recordCount: angles.length,
    samples: angles.map((angle2Degrees, index) => ({ id: `forces-${index}`, parameters: { ...parameters, angle2Degrees }, timeSeconds: 0 })) };
}

describe("Lili force-composition uses independent virtual trials and dated model evidence", () => {
  it("recomputes the model while preserving the original independently selected trial", () => {
    const input = forceContext();
    const { context, snapshot } = prepareLiliContext({ ...input, state: { trialForceN: 999, resultantMagnitude: 999 } });
    expect(snapshot!.durationSeconds).toBe(0);
    expect(snapshot!.state.resultantX).toBeCloseTo(3, 12);
    expect(snapshot!.state.resultantY).toBeCloseTo(4, 12);
    expect(snapshot!.state.resultantMagnitude).toBeCloseTo(5, 12);
    expect(snapshot!.state.residualMagnitude).toBeCloseTo(Math.sqrt(20), 12);
    expect(context!.parameters.trialForceN).toBe(5);
    expect(context!.parameters.trialAngleDegrees).toBe(0);
    expect(input.parameters.trialAngleDegrees).toBe(0);
  });

  it("gives executable static steps without auto-filling the equivalent force", () => {
    const text = createLiliGuidance("我应该先做哪一步？", forceContext()).text;
    for (const word of ["独立拖动", "原始试配", "不会自动", "无需播放", "不模拟橡皮筋"]) expect(text).toContain(word);
    expect(text).not.toContain("53.13");
    const current = createLiliGuidance("当前试配残差是多少？", forceContext()).text;
    expect(current).toContain("(3, 4) N");
    expect(current).toContain("方向53.13°");
    expect(current).toContain("试配选择仍为5 N、方向0°");
    expect(current).toContain("4.4721 N");
    expect(current).toContain("不是真实测量");
  });

  it("fits three saved cosine values with a free intercept and keeps the student's trial out of the fit", () => {
    const context = forceContext([60, 90, 120]);
    context.samples![0]!.parameters.trialForceN = 0;
    context.samples![1]!.parameters.trialAngleDegrees = -170;
    context.samples![2]!.parameters.trialForceN = 10;
    const reference = liliAnalysisReference(context, "分析 R²—cosθ")!;
    expect(reference.requestedRelationshipId).toBe("resultant-squared-cosine");
    expect(reference.groups).toHaveLength(1);
    expect(reference.groups[0]).toMatchObject({ status: "ready", distinctXCount: 3, pointSource: "saved-reading" });
    expect(reference.groups[0]!.fit!.slope).toBeCloseTo(24, 10);
    expect(reference.groups[0]!.fit!.intercept).toBeCloseTo(25, 10);
    expect(reference.note).toContain("不是fit.rSquared中的统计决定系数");
    expect(reference.note).toContain("不能据此判断试配正确");
    expect(createLiliGuidance("分析 R²—cosθ", context).text).toContain("模型采样");
    expect(createLiliGuidance("怎样控制变量？", context).text).toContain("60°、90°、120°");
  });

  it("analyzes saved forces after the live controls change, without rewriting their original trials", () => {
    const context = forceContext([60, 90, 120]);
    context.parameters = { ...context.parameters, force1N: 5, force2N: 5, trialForceN: 0 };
    const group = liliAnalysisReference(context, "合力平方与夹角余弦")!.groups[0]!;
    expect(group.fit!.slope).toBeCloseTo(24, 10);
    expect(group.fit!.intercept).toBeCloseTo(25, 10);
    expect(context.samples!.every(({ parameters }) => parameters.trialForceN === 5)).toBe(true);
  });

  it("changing a force magnitude splits conditions while mirrored angles do not add independent cosine values", () => {
    const split = forceContext([60, 90, 120]);
    split.samples![2]!.parameters.force1N = 2;
    expect(liliAnalysisReference(split)!.groups).toHaveLength(2);
    expect(liliAnalysisReference(split)!.groups.every(({ status }) => status === "insufficient")).toBe(true);
    const mirrored = forceContext([60, -60, 90]);
    expect(liliAnalysisReference(mirrored)!.groups[0]!.distinctXCount).toBe(2);
    expect(createLiliGuidance("分析数据", mirrored).text).toContain("还不能");
  });

  it("does not invent a direction for cancelling forces or a balance direction for a zero resultant", () => {
    const context = forceContext([], { force1N: 3, force2N: 3, angle1Degrees: 0, angle2Degrees: 180, trialForceN: 0 });
    const text = createLiliGuidance("当前合力为零吗？", context).text;
    expect(text).toContain("合力为零，没有方向");
    expect(text).toContain("不能把占位角度0°当作物理方向");
    expect(createLiliGuidance("平衡力是什么方向？", context).text).toContain("不需要再添加非零力");
    expect(createLiliGuidance("平衡力是什么方向？", context).text).toContain("零向量也没有");
  });

  it.each(["force1N", "force2N"])("a zero %s cannot produce a defined inter-force angle or valid cosine fit", (key) => {
    const context = forceContext([0, 90, 180], { [key]: 0 });
    const current = createLiliGuidance("当前状态如何？", context).text;
    expect(current).toContain("两力夹角没有定义");
    expect(current).toContain("改变零力的方向不会改变矢量");
    const reference = liliAnalysisReference(context, "分析图像")!;
    expect(reference.groups.every(({ status }) => status !== "ready")).toBe(true);
  });

  it("distinguishes equivalent force from opposite balancing force", () => {
    const text = createLiliGuidance("合力和平衡力有什么区别？", forceContext()).text;
    expect(text).toContain("等效力要与两力合力大小相等、方向相同");
    expect(text).toContain("平衡力则大小相等、方向相反");
  });

  it.each(["0.05 N 是测量精度吗？", "试配误差范围是多少？"])("teaching threshold is not instrument precision: %s", (question) => {
    const text = createLiliGuidance(question, forceContext()).text;
    expect(text).toContain("教学对照阈值");
    expect(text).toContain("不是测量精度");
    expect(text).toContain("不能据此判定学习完成");
  });

  it.each(["已经保存 100 条，算完成吗？", "残差是 0，我已经掌握了吗？"])("does not infer learning completion from counts or coincidence: %s", (question) => {
    const context = forceContext(); context.recordCount = 100;
    const text = createLiliGuidance(question, context).text;
    expect(text).toContain("不能按保存条数");
    expect(text).toContain("不代表完成了实体器材操作");
  });

  it.each(["看看我的手动读数", "手动调等效力怎么保存？", "怎样校零橡皮筋装置？"])("keeps virtual choices separate from physical instrument measurements: %s", (question) => {
    const text = createLiliGuidance(question, forceContext()).text;
    expect(text).toContain("原始选择会随模型记录保存");
    expect(text).toContain("不是手动测力计实测");
    expect(text).not.toMatch(/单摆|双缝|已收到/);
  });

  it.each(["分析 R²–cosθ", "resultant-squared-cosine", "合力平方与夹角余弦", "怎么分析图像？"])("selects the force relation before reference truncation for %s", (question) => {
    expect(liliRequestedRelationship("force-composition", question)).toBe("resultant-squared-cosine");
  });

  it("explains the nonzero intercept and undefined angle before any records have been saved", () => {
    const text = createLiliGuidance("怎么分析图像？", forceContext()).text;
    expect(text).toContain("没有收到");
    expect(text).toContain("拟合不强制过原点");
    expect(text).toContain("不是拟合优度的统计决定系数");
    expect(text).toContain("任一分力为0时夹角没有定义");
    expect(liliReferenceNotes("force-composition")!.error).toContain("未模拟实体安装");
    expect(() => prepareLiliContext({ ...forceContext(), manualRecordCount: 0, manualSamples: [] })).toThrow("当前实验不支持手动虚拟仪器记录");
  });
});
