import { describe, expect, it } from "vitest";
import type { CapacitorHistory } from "@physics-lab/contracts";
import { classroomExperiments } from "@physics-lab/knowledge/classroom";
import { getHighSchoolExperiment, highSchoolExperiments } from "@physics-lab/knowledge/high-school";
import { analyzeHighSchoolMeasurements, defaultHighSchoolParameters, simulateHighSchoolExperiment, type HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { createDefaultTeacherWorkspace, teacherExperimentCatalog, teacherLessonDefaults } from "./teacherWorkspace";

const templates = teacherExperimentCatalog.filter(({ stage }) => stage === "high-school");
function analysis(id: HighSchoolExperimentId, samples: Array<{ parameters?: Record<string, number>; time?: number }>) {
  return analyzeHighSchoolMeasurements(id, samples.map(({ parameters, time = 0 }, index) => {
    const settings = { ...defaultHighSchoolParameters(id), ...parameters };
    return { id: `template-${index}`, parameters: settings, timeSeconds: time, metrics: simulateHighSchoolExperiment(id, settings, time).metrics };
  }));
}

describe("new classroom lesson templates", () => {
  it("uses the same published experiment IDs and routes as student task launches", () => {
    expect(teacherExperimentCatalog.map(({ id }) => id).sort()).toEqual(classroomExperiments.map(({ id }) => id).sort());
    expect(templates.map(({ id }) => id).sort()).toEqual(highSchoolExperiments.filter(({ status }) => status === "ready").map(({ id }) => id).sort());
    for (const item of teacherExperimentCatalog) expect(classroomExperiments.find(({ id }) => id === item.id)).toMatchObject({ path: item.path, stage: item.stage });
  });

  it("prepares a capacitor-specific template without registering a planned route or claiming real instrument measurements", () => {
    const catalog = getHighSchoolExperiment("capacitor-charge")!;
    const defaults = teacherLessonDefaults({ id: catalog.id, stage: "high-school", title: catalog.name,
      field: "电场与电路", subtitle: catalog.learningGoal, path: "/high-school/experiments/capacitor-charge", formula: "τ = RC", accent: "#85c5a4" });
    if (catalog.status === "planned") {
      expect(teacherExperimentCatalog.some(({ id }) => id === catalog.id)).toBe(false);
      expect(classroomExperiments.some(({ id }) => id === catalog.id)).toBe(false);
    }
    expect(defaults.objective).toContain("同一分段的已保存模型读数");
    expect(defaults.controlledVariable).toContain("τ=4.7 s");
    expect(defaults.controlledVariable).toContain("0、1、2 s");
    expect(defaults.controlledVariable).toContain("数值调参重开一轮");
    expect(defaults.evidenceRequirement).toContain("完整开关过程");
    expect(defaults.evidenceRequirement).toContain("ln(|U−U∞|/1V)");
    expect(defaults.evidenceRequirement).toContain("断路及初始已平衡的段不能估τ");
    expect(defaults.evidenceRequirement).toContain("不混合不同段");
    expect(defaults.evidenceRequirement).toContain("不以条数判完成");
    expect(defaults.evidenceRequirement).toContain("没有独立手动电表");
    expect(defaults.reflectionPrompt).toContain("电源提供的能量不全存入电容");
    for (const [key, value] of Object.entries(defaults)) expect(value.length).toBeLessThanOrEqual(key === "title" ? 160 : 1000);
  });

  it("the capacitor protocol yields the default RC from its saved segment and keeps an open-circuit comparison out of that fit", () => {
    const parameters = defaultHighSchoolParameters("capacitor-charge");
    const capacitorHistory: CapacitorHistory = { kind: "capacitor-rc-v1", runId: "teacher-protocol", initialVoltage: 0, segments: [{ startTimeSeconds: 0, mode: "charge" }] };
    const samples = [0, 1, 2].map((timeSeconds, index) => ({ id: `capacitor-charge-${index}`, parameters, timeSeconds, capacitorHistory,
      metrics: simulateHighSchoolExperiment("capacitor-charge", parameters, timeSeconds, capacitorHistory).metrics }));
    const openHistory: CapacitorHistory = { ...capacitorHistory, segments: [...capacitorHistory.segments, { startTimeSeconds: 2, mode: "open" }] };
    const atSwitch = simulateHighSchoolExperiment("capacitor-charge", parameters, 2, openHistory);
    const later = simulateHighSchoolExperiment("capacitor-charge", parameters, 3, openHistory);
    expect(later.state.voltage).toBe(atSwitch.state.voltage);
    expect(later.state.current).toBe(0);
    const groups = analyzeHighSchoolMeasurements("capacitor-charge", [...samples, ...[2, 3, 4].map((timeSeconds, index) => ({ id: `capacitor-open-${index}`, parameters, timeSeconds, capacitorHistory: openHistory,
      metrics: simulateHighSchoolExperiment("capacitor-charge", parameters, timeSeconds, openHistory).metrics }))]).groups;
    const charge = groups.find((group) => group.status === "ready")!;
    expect(charge.relationshipId).toBe("capacitor-log-voltage-time");
    expect(charge.distinctXCount).toBe(3);
    expect(charge.estimates.find((estimate) => estimate.key === "timeConstant")?.value).toBeCloseTo(4.7, 10);
    expect(groups.find((group) => group.status === "unsupported")?.fit).toBeNull();
  });

  it.each(templates)("fills all $id instructions from its curriculum and applicable model conditions", (item) => {
    const original = JSON.stringify(createDefaultTeacherWorkspace());
    const defaults = teacherLessonDefaults(item);
    const catalog = getHighSchoolExperiment(item.id)!;
    expect(defaults.objective).toContain(catalog.learningGoal);
    expect(defaults.objective).toContain("不称为实体器材实测");
    for (const evidence of catalog.evidence) expect(defaults.evidenceRequirement).toContain(evidence);
    for (const assumption of catalog.assumptions) expect(defaults.reflectionPrompt).toContain(assumption);
    expect(defaults.evidenceRequirement).toContain("保存到账号才供教师查看");
    for (const [key, value] of Object.entries(defaults)) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(key === "title" ? 160 : 1000);
    }
    expect(JSON.stringify(createDefaultTeacherWorkspace())).toBe(original);
  });

  it("the uniform and horizontal-projection sampling requirements produce the intended evidence", () => {
    const uniform = analysis("uniform-acceleration", [0, 1, 2, 3].map((time) => ({ time })));
    expect(uniform.groups.find(({ relationshipId }) => relationshipId === "interval-velocity-time")?.status).toBe("ready");
    const projectile = analysis("projectile-motion", [0, .1, .2].map((time) => ({ time, parameters: { angleDegrees: 0, initialHeight: 2, initialSpeed: 8 } })));
    expect(projectile.groups.find(({ relationshipId }) => relationshipId === "vertical-drop-time-squared")?.status).toBe("ready");
  });

  it("the two Newton control protocols create separate valid force and inverse-mass relationships", () => {
    const force = analysis("newton-second-law", [.05, .1, .15].map((hangingMass) => ({ parameters: { hangingMass, cartMass: .6 - hangingMass } })));
    expect(force.groups.find(({ relationshipId }) => relationshipId === "acceleration-net-force")?.status).toBe("ready");
    const mass = analysis("newton-second-law", [.5, 1, 1.5].map((cartMass) => ({ parameters: { cartMass } })));
    expect(mass.groups.find(({ relationshipId }) => relationshipId === "acceleration-inverse-mass")?.status).toBe("ready");
  });

  it("the pendulum, source and slit model protocols each provide enough comparable conditions", () => {
    for (const [id, entries] of [
      ["pendulum", [.5, 1, 1.5].map((length) => ({ parameters: { length, amplitudeDegrees: 5 } }))],
      ["emf-internal-resistance", [2, 6, 12].map((loadResistance) => ({ parameters: { loadResistance } }))],
      ["double-slit", [1, 1.5, 2].map((screenDistance) => ({ parameters: { screenDistance } }))]
    ] as const) expect(analysis(id, [...entries]).groups.some(({ status }) => status === "ready")).toBe(true);
  });

  it("the spring template uses extension and achievable loads while distinguishing its unimplemented ruler", () => {
    const defaults = teacherLessonDefaults(templates.find(({ id }) => id === "spring-force")!);
    expect(defaults.evidenceRequirement).toContain("50、100、150 g");
    expect(defaults.evidenceRequirement).toContain("当前没有手动读尺");
    expect(defaults.reflectionPrompt).toContain("不预测真实弹性限度");
    const group = analysis("spring-force", [0, 50, 100, 150].map((loadMassGrams) => ({ parameters: { loadMassGrams } }))).groups[0]!;
    expect(group.status).toBe("ready");
    expect(group.fit!.slope).toBeCloseTo(20, 10);
  });

  it("the force template varies relative angle while preserving an independently chosen trial force", () => {
    const defaults = teacherLessonDefaults(templates.find(({ id }) => id === "force-composition")!);
    expect(defaults.controlledVariable).toContain("预设不替学生调整试配力");
    expect(defaults.evidenceRequirement).toContain("0.05 N仅为教学比较阈值");
    const group = analysis("force-composition", [0, 60, 90, 120, 180].map((angle2Degrees) => ({ parameters: { angle2Degrees, trialForceN: 2.7, trialAngleDegrees: -35 } }))).groups[0];
    expect(group.status).toBe("ready");
    expect(group.fit!.slope).toBeCloseTo(24, 10);
    expect(group.fit!.intercept).toBeCloseTo(25, 10);
    expect(group.points).toHaveLength(5);
  });

  it("the energy template compares two moving internal points and keeps tape readings separate from release-model energy", () => {
    const item = templates.find(({ id }) => id === "mechanical-energy")!;
    expect(item.path).toBe("/high-school/experiments/mechanical-energy");
    const defaults = teacherLessonDefaults(item);
    expect(defaults.controlledVariable).toContain("0.02 s");
    expect(defaults.controlledVariable).toContain("B>A");
    expect(defaults.controlledVariable).toContain("共享同一点的读数须一致");
    expect(defaults.evidenceRequirement).toContain("A−1、A、A+1、B−1、B、B+1");
    expect(defaults.evidenceRequirement).toContain("vB²−vA²");
    expect(defaults.evidenceRequirement).toContain("不得用模型答案回填");
    for (const resistanceRatio of [0, .2]) {
      const group = analysis("mechanical-energy", [.1, .2, .3].map((time) => ({ time, parameters: { resistanceRatio } }))).groups.find(({ relationshipId }) => relationshipId === "kinetic-gain-potential-loss")!;
      expect(group.status).toBe("ready");
      expect(group.fit!.slope).toBeCloseTo(1 - resistanceRatio, 10);
      expect(group.fit!.intercept).toBeCloseTo(0, 10);
    }
  });
});
