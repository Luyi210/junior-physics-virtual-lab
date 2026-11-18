import { describe, expect, it } from "vitest";
import type { LiliExperimentContext, LiliSimulationSample } from "@physics-lab/contracts";
import { defaultHighSchoolParameters, type HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { createLiliGuidance, liliAnalysisReference, liliRequestedRelationship, prepareLiliContext } from "./lili";

function context(id: HighSchoolExperimentId, samples: { changes?: Record<string, number>; time?: number }[]): LiliExperimentContext {
  const parameters = defaultHighSchoolParameters(id);
  return { experimentId: id, parameters, timeSeconds: 0, recordCount: samples.length,
    samples: samples.map(({ changes, time = 0 }, index): LiliSimulationSample => ({ id: `sample-${index}`, timeSeconds: time, parameters: { ...parameters, ...changes } })) };
}

describe("Lili selects the requested scientific relationship", () => {
  it.each([
    ["newton-second-law", "分析 a—1/M", "acceleration-inverse-mass"],
    ["newton-second-law", "固定合力时加速度和质量怎么分析", "acceleration-inverse-mass"],
    ["newton-second-law", "分析 a–F", "acceleration-net-force"],
    ["newton-second-law", "固定总质量研究加速度与合力", "acceleration-net-force"],
    ["uniform-acceleration", "怎样用位置数据估计速度", "interval-velocity-time"],
    ["uniform-acceleration", "分析模型 v–t", "velocity-time"],
    ["projectile-motion", "分析 y–t²", "vertical-drop-time-squared"],
    ["projectile-motion", "分析竖直速度—时间", "vertical-velocity-time"],
    ["projectile-motion", "分析 x–t", "horizontal-position-time"],
  ])("recognizes %s: %s", (id, question, expected) => {
    expect(liliRequestedRelationship(id, question)).toBe(expected);
  });

  it("fits fixed-force mass trials without asking the student to switch to a fixed-mass experiment", () => {
    const saved = context("newton-second-law", [.5, 1, 1.5].map((cartMass) => ({ changes: { cartMass } })));
    const reference = liliAnalysisReference(saved, "分析 a–1/M")!;
    expect(reference.groups).toHaveLength(1);
    expect(reference.groups[0]).toMatchObject({ relationshipId: "acceleration-inverse-mass", status: "ready", pointSource: "saved-reading" });
    expect(reference.groups[0]!.fit!.slope).toBeCloseTo(.44, 10);
    const text = createLiliGuidance("分析 a–1/M", saved).text;
    expect(text).toContain("可用于拟合");
    expect(text).toContain("0.44");
    expect(text).toContain("只改变小车质量");
    expect(text).not.toContain("转移质量");
  });

  it("does not substitute a ready force fit when the requested mass relation lacks evidence", () => {
    const saved = context("newton-second-law", [.05, .1, .15].map((hangingMass) => ({ changes: { hangingMass, cartMass: .6 - hangingMass } })));
    expect(liliAnalysisReference(saved, "a–F")!.groups.some((group) => group.status === "ready")).toBe(true);
    const reference = liliAnalysisReference(saved, "a–1/M")!;
    expect(reference.groups.every((group) => group.relationshipId === "acceleration-inverse-mass" && group.status === "insufficient")).toBe(true);
    const text = createLiliGuidance("分析 a–1/M", saved).text;
    expect(text).toContain("还不能");
    expect(text).not.toContain("可用于拟合");
  });

  it("filters the relationship before the six-group limit, including unsupported groups", () => {
    const saved = context("projectile-motion", Array.from({ length: 7 }, (_, group) => [0, .1, .2].map((time) => ({ time, changes: { initialHeight: 1 + group * .1, angleDegrees: 30 } }))).flat());
    const reference = liliAnalysisReference(saved, "分析下落距离与时间平方")!;
    expect(reference.requestedRelationshipId).toBe("vertical-drop-time-squared");
    expect(reference.groups).toHaveLength(6);
    expect(reference.groups.every((group) => group.relationshipId === "vertical-drop-time-squared" && group.status === "unsupported")).toBe(true);
    expect(reference.omittedGroupCount).toBe(1);
    expect(reference.otherRelationshipGroupCount).toBe(14);
    const text = createLiliGuidance("分析下落距离与时间平方", saved).text;
    expect(text).toContain("竖直");
    expect(text).toContain("还不能");
    expect(text).not.toContain("可用于拟合");
  });

  it("distinguishes adjacent-position interval speeds from directly sampled model velocities", () => {
    const saved = context("uniform-acceleration", [0, .5, 1.5, 3].map((time) => ({ time })));
    const reference = liliAnalysisReference(saved, "由位置估计速度")!;
    expect(reference.groups[0]).toMatchObject({ relationshipId: "interval-velocity-time", pointSource: "position-interval", sampleCount: 3, status: "ready" });
    expect(reference.groups[0]!.fit!.slope).toBeCloseTo(.8, 10);
    expect(reference.note).toContain("不是手动测量");
    const derived = createLiliGuidance("由位置估计速度", saved).text;
    expect(derived).toContain("区间平均速度");
    expect(derived).toContain("区间中点时间");
    expect(derived).toContain("没有直接把模型瞬时速度");
    const direct = createLiliGuidance("分析模型 v–t", saved).text;
    expect(direct).toContain("模型瞬时速度");
    expect(direct).toContain("尚未用位置差独立估速");
  });

  it("requires four saved times for interval analysis even when three direct velocities already fit", () => {
    const saved = context("uniform-acceleration", [0, 1, 2].map((time) => ({ time })));
    expect(liliAnalysisReference(saved, "v–t")!.groups[0]!.status).toBe("ready");
    const text = createLiliGuidance("分析相邻区间平均速度", saved).text;
    expect(text).toContain("还不能");
    expect(text).toMatch(/4\s*个不同时刻/);
    expect(text).not.toContain("可用于拟合");
  });

  it("gives the selected executable sampling instructions before any records exist", () => {
    const text = createLiliGuidance("怎样用位置估计速度", context("uniform-acceleration", [])).text;
    expect(text).toContain("没有收到");
    expect(text).toMatch(/4\s*个不同时刻/);
    expect(text).toContain("位置");
    expect(text).not.toContain("可用于拟合");
  });
});

describe("Lili respects stationary and zero-launch boundaries", () => {
  it("does not propose a flight observation when a stationary object is already on the ground", () => {
    const saved = context("projectile-motion", []);
    saved.parameters = { ...saved.parameters, initialSpeed: 0, angleDegrees: 30, initialHeight: 0 };
    expect(createLiliGuidance("我应该先做哪一步？", saved).text).toContain("没有离地飞行段");
  });

  it("recognizes a nonzero horizontal launch at ground level still has no flight interval", () => {
    const saved = context("projectile-motion", []);
    saved.parameters = { ...saved.parameters, initialSpeed: 8, angleDegrees: 0, initialHeight: 0 };
    const prepared = prepareLiliContext(saved);
    expect(prepared.snapshot!.durationSeconds).toBe(0);
    expect(prepared.snapshot!.state.vx).toBe(8);
    for (const question of ["我应该先做哪一步？", "分析 x–t"]) {
      const text = createLiliGuidance(question, prepared.context).text;
      expect(text).toContain("没有离地飞行段");
      expect(text).toContain("先增加释放高度");
      expect(text).not.toContain("当前初速度为0");
      expect(text).not.toContain("至少3个");
    }
  });

  it("still analyzes saved flight evidence after current settings are moved to ground level", () => {
    const saved = context("projectile-motion", [0, .1, .2].map((time) => ({ time })));
    saved.parameters = { ...saved.parameters, initialHeight: 0 };
    expect(createLiliGuidance("分析 x–t", saved).text).toContain("可用于拟合");
  });

  it("describes a vertical launch using its effective horizontal speed", () => {
    const saved = context("projectile-motion", []);
    saved.parameters = { ...saved.parameters, angleDegrees: 90 };
    expect(createLiliGuidance("怎么分析图像？", saved).text).toContain("竖直上抛");
  });

  it("does not invent vertical launch speed from an angle when the speed is zero", () => {
    const saved = context("projectile-motion", []);
    saved.parameters = { ...saved.parameters, initialSpeed: 0, angleDegrees: 30 };
    const { context: validated, snapshot } = prepareLiliContext(saved);
    expect(snapshot!.state.vx).toBe(0);
    expect(snapshot!.state.vy).toBe(0);
    const text = createLiliGuidance("怎么分析图像？", validated).text;
    expect(text).toContain("自由下落");
    expect(text).toContain("初速度都为0");
    expect(text).not.toContain("竖直初速度不为零");
  });

  it("distinguishes static balance from accelerating hanging masses", () => {
    const saved = context("newton-second-law", []);
    saved.parameters = { ...saved.parameters, resistance: 2 };
    const { context: validated, snapshot } = prepareLiliContext(saved);
    expect(snapshot!.state.acceleration).toBe(0);
    expect(snapshot!.state.tension).toBeCloseTo(.49, 12);
    const text = createLiliGuidance("为什么挂码重力不等于拉力？", validated).text;
    expect(text).toContain("系统保持静止");
    expect(text).toContain("T 等于挂码重力 mg");
    expect(text).not.toContain("挂码自身也在加速");
  });

  it("makes the suggested static-system startup question actionable without mixing changed controls", () => {
    const saved = context("newton-second-law", []);
    saved.parameters = { ...saved.parameters, resistance: 2 };
    const balance = createLiliGuidance("为什么挂码重力不等于拉力？", saved);
    const suggested = balance.suggestions.find((question) => question.includes("启动"))!;
    expect(suggested).toBeDefined();
    const text = createLiliGuidance(suggested, saved).text;
    expect(text).toContain("减小等效阻力");
    expect(text).toContain("增大挂码质量");
    expect(text).toContain("mg 严格超过最大静摩擦力");
    expect(text).toContain("为后续控制变量实验重新设定");
  });

  it.each([0, 1])("states the exact U/E boundary for an internal resistance of %s ohms", (internalResistance) => {
    const saved = context("emf-internal-resistance", []);
    saved.parameters = { ...saved.parameters, internalResistance };
    const text = createLiliGuidance("怎么看图像？", saved).text;
    expect(text).toContain("I>0 且 r>0 时 U<E");
    expect(text).toContain("r=0 时 U=E");
  });
});
