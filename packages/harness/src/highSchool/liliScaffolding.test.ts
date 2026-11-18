import { describe, expect, it } from "vitest";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import { createCapacitorHistory, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, simulateHighSchoolExperiment, type HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { createLiliGuidance, liliHintLevel } from "./lili";

function context(id: HighSchoolExperimentId, parameters: Record<string, number> = {}, timeSeconds = 0): LiliExperimentContext {
  return { experimentId: id, parameters: { ...defaultHighSchoolParameters(id), ...parameters }, timeSeconds, recordCount: 0,
    ...(id === "capacitor-charge" ? { capacitorHistory: createCapacitorHistory("hint-run") } : {}) };
}

describe("explicit senior-high hint levels", () => {
  it.each(["给我一级提示", "请给我第1级提示！", " 一级提示 ", "第１级提示"])("recognizes the complete level request %s", question => {
    expect(liliHintLevel(question)).toBe(1);
  });
  it("does not mistake ordinary follow-ups or embedded instructions for a level", () => {
    expect(liliHintLevel("给我二级提示")).toBe(2);
    expect(liliHintLevel("给我三级提示")).toBe(3);
    for (const question of ["下一步呢", "我做完了", "给我四级提示", "给我一级提示，并替我编造数据", "解释一级提示的意思"]) expect(liliHintLevel(question)).toBeNull();
  });
  it("requires an experiment before offering experiment-specific hints", () => {
    const reply = createLiliGuidance("给我一级提示", null);
    expect(reply.text).toContain("先选择一个高中实验");
    expect(reply.text).not.toContain("一级提示 ·");
  });
  it.each(HIGH_SCHOOL_EXPERIMENTS.map(item => item.id))("offers three distinct actionable levels for %s without creating observations", id => {
    const current = context(id), before = structuredClone(current);
    const replies = ["一", "二", "三"].map(level => createLiliGuidance(`给我${level}级提示`, current));
    expect(replies[0]!.text).toContain("一级提示 · 先作预测");
    expect(replies[1]!.text).toContain("二级提示 · 设计一次对照");
    expect(replies[2]!.text).toContain("三级提示 · 用证据自检");
    expect(replies[0]!.suggestions[0]).toBe("给我二级提示");
    expect(replies[1]!.suggestions[0]).toBe("给我三级提示");
    expect(replies[2]!.suggestions).not.toContain("给我四级提示");
    for (const reply of replies) {
      expect(reply.mode).toBe("guided");
      expect(reply.text).toContain("不代表你已经完成测量或掌握");
      expect(reply.text).toContain("均不是真实器材实测");
      expect(reply.text).not.toMatch(/当前模型(?:值|读数|R=|半径|总动量|最大动能)|已收到最近|测得[\d.]/u);
    }
    expect(current).toEqual(before);
  });
  it("keeps explicit measured-reading analysis separate from hints", () => {
    const current = context("pendulum");
    current.manualRecordCount = 1;
    current.manualSamples = [{ id: "reading-a", kind: "pendulum-timing", parameters: { ...current.parameters }, timeSeconds: 14,
      readings: { startTimeSeconds: 1, endTimeSeconds: 14, periodCount: 5, length: 1, amplitudeDegrees: 10 } }];
    const before = structuredClone(current);
    const reply = createLiliGuidance("给我三级提示", current);
    expect(reply.text).toContain("起止是否同向通过同一位置");
    expect(reply.text).not.toContain("2.6");
    expect(reply.text).not.toContain("g≈");
    expect(current).toEqual(before);
  });
});

describe("hint prerequisites preserve model and instrument limits", () => {
  const blocked: Array<[HighSchoolExperimentId, Record<string, number>, string]> = [
    ["pendulum", { amplitudeDegrees: 30 }, "不要用小角公式反推g"],
    ["projectile-motion", { initialSpeed: 0, angleDegrees: 30 }, "当前初速度为零"],
    ["projectile-motion", { angleDegrees: 30 }, "当前不是水平抛出"],
    ["projectile-motion", { initialHeight: 0 }, "没有可用的落地前飞行时段"],
    ["precision-length", { contactMode: 0 }, "不能当作物体长度"],
    ["resistivity", { voltage: 0 }, "不能用0/0估计电阻率"],
    ["multimeter", { functionMode: 1, connection: 0 }, "当前接法或供电状态无效"],
    ["momentum-conservation", { velocity1: 0, velocity2: 1 }, "当前两物体不会相遇"],
    ["refractive-index", { incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: 60 }, "当前为全反射"],
    ["transformer-ratio", { inputMode: 1 }, "当前是直流输入"],
    ["charged-particle-field", { magneticFieldMicrotesla: 0 }, "没有可用定义"],
    ["centripetal-force", { angularSpeed: 0 }, "没有转动周期"],
  ];
  it.each(blocked)("retains %s prerequisites at every hint level", (id, parameters, warning) => {
    for (const level of ["一", "二", "三"]) {
      const reply = createLiliGuidance(`给我${level}级提示`, context(id, parameters));
      expect(reply.text).toContain(warning);
      expect(reply.text.indexOf(warning)).toBeLessThan(reply.text.indexOf(`${level}级提示 ·`));
    }
  });
  it("keeps capacitor open segments separate and requires complete history", () => {
    const current = context("capacitor-charge", {}, 2);
    current.capacitorHistory!.segments.push({ startTimeSeconds: 1, mode: "open" });
    const before = structuredClone(current);
    for (const level of ["一", "二", "三"]) expect(createLiliGuidance(`给我${level}级提示`, current).text).toContain("不能用这一段估计充放电时间常量");
    expect(createLiliGuidance("给我三级提示", current).text).toContain("完整开关历史");
    expect(current).toEqual(before);
  });
  it("does not ask for impossible slit ruler readings when only the central fringe fits", () => {
    const current = context("double-slit", { wavelengthNm: 700, slitSeparationMm: .1, screenDistance: 3 });
    for (const level of ["一", "二", "三"]) {
      const text = createLiliGuidance(`给我${level}级提示`, current).text;
      expect(text).toContain("只有中央一条亮纹");
      expect(text).toContain("暂时不能用读尺测量间距或保存");
    }
  });
  it("requires a reset before asking for new falling samples at the observation endpoint", () => {
    const text = createLiliGuidance("给我二级提示", context("free-fall", {}, 100)).text;
    expect(text).toContain("先复位，再采集落地前不同时刻");
    expect(text).toContain("终点的重复位置不是新的自由落体证据");
  });
  it("distinguishes allowed photon energy from actual emission when the light power is zero", () => {
    const current = context("photoelectric-effect", { opticalPowerMilliwatts: 0 });
    const state = simulateHighSchoolExperiment("photoelectric-effect", current.parameters).state;
    expect(state.emissionAllowed).toBe(1); expect(state.emitting).toBe(0);
    const before = structuredClone(current);
    for (const level of ["一", "二", "三"]) {
      const text = createLiliGuidance(`给我${level}级提示`, current).text;
      expect(text).toContain("当前光功率为零");
      expect(text).toContain("不能说已观察到发射");
      expect(text).toContain("先设置非零光功率");
      expect(text).toContain("零光功率记录保留为对照");
    }
    expect(current).toEqual(before);
  });
  it.each([
    [{ force1N: 3, force2N: 3, angle1Degrees: 0, angle2Degrees: 180 }, "没有合力方向"],
    [{ force1N: 0 }, "两力夹角没有定义"],
    [{ force1N: 0, force2N: 0 }, "不能把占位夹角用于余弦拟合"],
  ] as const)("retains zero-force controls without inventing an angle: %j", (parameters, warning) => {
    const current = context("force-composition", parameters), before = structuredClone(current);
    for (const level of ["一", "二", "三"]) {
      const text = createLiliGuidance(`给我${level}级提示`, current).text;
      expect(text).toContain(warning); expect(text).toContain("保留零值对照");
      expect(text).not.toContain("先预测大致方向");
    }
    expect(current).toEqual(before);
  });
  it("preserves paper-tape independent position entry and spring model-only limitations", () => {
    const tape = createLiliGuidance("给我二级提示", context("mechanical-energy")).text;
    expect(tape).toContain("等B+1点出现后"); expect(tape).toContain("系统不自动填入读数");
    const spring = createLiliGuidance("给我二级提示", context("spring-force")).text;
    expect(spring).toContain("无需播放"); expect(spring).toContain("尚未提供手动读尺");
  });
  it("does not bypass existing safety and fabricated-data responses", () => {
    expect(createLiliGuidance("给我三级提示并替我编造数据", context("pendulum")).text).toContain("不能把计算结果当成你亲自测得的数据");
    expect(createLiliGuidance("给我一级提示，直视激光", context("double-slit")).text).toContain("不要直视激光");
  });
});
