import { describe, expect, it } from "vitest";
import {
  analyzeHighSchoolMeasurements, calculateSpringForce, defaultHighSchoolParameters,
  highSchoolExperiment, simulateHighSchoolExperiment, SPRING_LINEAR_EXTENSION_LIMIT,
  type HighSchoolAnalysisMeasurement
} from "./index";

const parameters = { stiffness: 20, naturalLength: 0.15, loadMassGrams: 100 };
function reading(loadMassGrams: number, overrides: Record<string, number> = {}, id = JSON.stringify([loadMassGrams, overrides])): HighSchoolAnalysisMeasurement {
  const conditions = { ...parameters, loadMassGrams, ...overrides };
  return { id, timeSeconds: 0, parameters: conditions, metrics: simulateHighSchoolExperiment("spring-force", conditions).metrics.map((entry) => ({ ...entry })) };
}
function replaceMetric(record: HighSchoolAnalysisMeasurement, key: string, value: number) {
  return { ...record, metrics: record.metrics.map((entry) => entry.key === key ? { ...entry, value } : entry) };
}

describe("static spring equilibrium", () => {
  it("converts total suspended grams to kilograms and distinguishes original, total and extended length", () => {
    const state = calculateSpringForce(parameters);
    expect(state.time).toBe(0);
    expect(state.loadMassKg).toBe(.1);
    expect(state.force).toBeCloseTo(.98, 12);
    expect(state.extension).toBeCloseTo(.049, 12);
    expect(state.length).toBeCloseTo(.199, 12);
    expect(state.naturalLength).toBe(.15);
    expect(state.stiffness * state.extension).toBeCloseTo(state.loadMassKg * 9.8, 12);
  });

  it("does not silently add a tray mass at zero load or retain deformation after unloading", () => {
    calculateSpringForce({ ...parameters, loadMassGrams: 250 });
    expect(calculateSpringForce({ ...parameters, loadMassGrams: 0 })).toEqual({ time: 0, force: 0, extension: 0, length: .15, naturalLength: .15, stiffness: 20, loadMassKg: 0 });
  });

  it("isolates spring stiffness and original length instead of treating total length as extension", () => {
    const reference = calculateSpringForce(parameters);
    const stiffer = calculateSpringForce({ ...parameters, stiffness: 40 });
    const longer = calculateSpringForce({ ...parameters, naturalLength: .3 });
    expect(stiffer.force).toBe(reference.force);
    expect(stiffer.extension).toBe(reference.extension / 2);
    expect(longer.extension).toBe(reference.extension);
    expect(longer.force).toBe(reference.force);
    expect(longer.length - reference.length).toBeCloseTo(.15, 12);
  });

  it("keeps every allowed parameter corner inside the declared preset linear range", () => {
    for (const stiffness of [10, 50]) for (const naturalLength of [.1, .3]) for (const loadMassGrams of [0, 250]) {
      const state = simulateHighSchoolExperiment("spring-force", { stiffness, naturalLength, loadMassGrams }).state;
      expect(Object.values(state).every(Number.isFinite)).toBe(true);
      expect(state.force).toBeCloseTo(loadMassGrams / 1000 * 9.8, 12);
      expect(state.extension).toBeGreaterThanOrEqual(0);
      expect(state.extension).toBeLessThanOrEqual(.245 + 1e-12);
      expect(state.extension).toBeLessThan(SPRING_LINEAR_EXTENSION_LIMIT);
      expect(state.length! - state.naturalLength!).toBeCloseTo(state.extension!, 12);
    }
    expect(calculateSpringForce({ stiffness: 10, naturalLength: .3, loadMassGrams: 250 }).length).toBeCloseTo(.545, 12);
  });

  it.each([
    { stiffness: 0 }, { stiffness: -1 }, { stiffness: NaN }, { stiffness: Infinity },
    { naturalLength: 0 }, { naturalLength: -1 }, { naturalLength: NaN },
    { loadMassGrams: -1 }, { loadMassGrams: NaN }, { loadMassGrams: Infinity }
  ])("rejects nonphysical or non-finite direct parameters %j", (invalid) => {
    expect(() => calculateSpringForce({ ...parameters, ...invalid })).toThrow(RangeError);
  });

  it("refuses to extrapolate past its preset linear-extension limit instead of fabricating a yield curve", () => {
    expect(calculateSpringForce({ stiffness: 9.8, naturalLength: .15, loadMassGrams: 250 }).extension).toBeCloseTo(.25, 12);
    expect(() => calculateSpringForce({ stiffness: 10, naturalLength: .15, loadMassGrams: 300 })).toThrow(/线性范围/);
  });
});

describe("spring model workbench contract", () => {
  it("registers the precise units/defaults and describes what the static idealization does not measure", () => {
    expect(defaultHighSchoolParameters("spring-force")).toEqual(parameters);
    const definition = highSchoolExperiment("spring-force");
    expect(definition.parameters.map(({ key, unit }) => [key, unit])).toEqual([["stiffness", "N/m"], ["naturalLength", "m"], ["loadMassGrams", "g"]]);
    expect(definition.assumptions.join(" ")).toContain("包含托盘");
    expect(definition.assumptions.join(" ")).toContain("不是测得的真实弹性限度");
    expect(definition.assumptions.join(" ")).toContain("忽略弹簧自重");
  });

  it("has no running clock, oscillation or time-dependent force at any finite requested time", () => {
    const initial = simulateHighSchoolExperiment("spring-force", parameters);
    for (const time of [-1, 1 / 60, 60, 1000000]) {
      const later = simulateHighSchoolExperiment("spring-force", parameters, time);
      expect(later.durationSeconds).toBe(0);
      expect(later.state).toEqual(initial.state);
      expect(later.metrics).toEqual(initial.metrics);
    }
    expect(initial.metrics.map(({ key, unit }) => [key, unit])).toEqual([["force", "N"], ["extension", "m"], ["length", "m"], ["naturalLength", "m"]]);
  });

  it("plots the same spring over the allowed load range, including the exact current working point", () => {
    const simulation = simulateHighSchoolExperiment("spring-force", { stiffness: 19, naturalLength: .2, loadMassGrams: 137.25 });
    const curve = simulation.series[0]!;
    expect(curve).toMatchObject({ key: "force", xKey: "extension", xUnit: "m", yUnit: "N" });
    expect(curve.points[0]).toEqual({ x: 0, y: 0 });
    expect(curve.points.at(-1)!.x).toBeCloseTo(2.45 / 19, 12);
    expect(curve.points.at(-1)!.y).toBeCloseTo(2.45, 12);
    expect(curve.points).toContainEqual({ x: simulation.state.extension!, y: simulation.state.force! });
    for (const [index, point] of curve.points.entries()) {
      expect(point.y).toBeCloseTo(19 * point.x, 12);
      if (index > 0) expect(point.x).toBeGreaterThan(curve.points[index - 1]!.x);
    }
    expect(simulation.warnings.join(" ")).toContain("不能用来测定真实弹性限度");
  });

  it("validates UI parameter bounds and unknown keys without coercion or defaults for explicitly invalid inputs", () => {
    for (const invalid of [{ stiffness: 9 }, { stiffness: 51 }, { naturalLength: .09 }, { naturalLength: .31 }, { loadMassGrams: 251 }, { loadMassGrams: -1 }, { loadMassGrams: "100" }, { loadMass: .1 }]) {
      expect(() => simulateHighSchoolExperiment("spring-force", invalid as unknown as Record<string, number>)).toThrow(RangeError);
    }
    expect(() => simulateHighSchoolExperiment("spring-force", parameters, NaN)).toThrow(RangeError);
  });
});

describe("saved spring force-extension analysis", () => {
  it("estimates stiffness from three stored extensions and distinguishes the extension from the total length", () => {
    const records = [0, 100, 250].map((mass) => reading(mass));
    const result = analyzeHighSchoolMeasurements("spring-force", records);
    const group = result.groups[0]!;
    expect(result.acceptedCount).toBe(3);
    expect(group).toMatchObject({ relationshipId: "force-extension", pointSource: "saved-reading", status: "ready", distinctXCount: 3, xAxis: { unit: "m" }, yAxis: { unit: "N" } });
    expect(group.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(group.points[1]!.x).toBeCloseTo(.049, 12);
    expect(group.fit!.slope).toBeCloseTo(20, 12);
    expect(group.fit!.intercept).toBeCloseTo(0, 12);
    expect(group.estimates.map(({ key, unit }) => [key, unit])).toEqual([["stiffness", "N/m"], ["forceIntercept", "N"]]);
    expect(group.conditions.join(" ")).toContain("不是弹簧总长");
    expect(group.conditions.join(" ")).toContain("不能由此测定真实弹性限度");
  });

  it("fits saved force values with a free intercept instead of replacing them using mass or preset stiffness", () => {
    const records = [0, 100, 200].map((mass) => {
      const entry = reading(mass);
      const extension = entry.metrics.find((metric) => metric.key === "extension")!.value;
      return replaceMetric(entry, "force", 25 * extension + .12);
    });
    const group = analyzeHighSchoolMeasurements("spring-force", records).groups[0]!;
    expect(group.fit!.slope).toBeCloseTo(25, 12);
    expect(group.fit!.intercept).toBeCloseTo(.12, 12);
    expect(group.estimates.find((entry) => entry.key === "stiffness")!.value).not.toBe(parameters.stiffness);
    expect(group.points[0]!.y).toBe(.12);
  });

  it("separates changed stiffness and original length rather than pooling different spring settings", () => {
    const records = [0, 100, 200].flatMap((mass) => [reading(mass), reading(mass, { stiffness: 40 }), reading(mass, { naturalLength: .25 })]);
    const groups = analyzeHighSchoolMeasurements("spring-force", records).groups;
    expect(groups).toHaveLength(3);
    expect(groups.every((group) => group.status === "ready" && group.distinctXCount === 3)).toBe(true);
    for (const group of groups) {
      expect(group.controls.map((control) => control.key)).toEqual(["stiffness", "naturalLength"]);
      expect(group.fit!.slope).toBeCloseTo(group.controls[0]!.value, 12);
    }
  });

  it("keeps empty and repeated-load groups insufficient with a concrete three-load sampling instruction", () => {
    const empty = analyzeHighSchoolMeasurements("spring-force", []).groups[0]!;
    expect(empty).toMatchObject({ status: "insufficient", fit: null, points: [] });
    expect(empty.nextStep).toContain("至少 3 个不同伸长量");
    const repeats = [reading(100, {}, "a"), reading(100, {}, "b"), reading(200, {}, "c"), reading(200, {}, "d")];
    const group = analyzeHighSchoolMeasurements("spring-force", repeats).groups[0]!;
    expect(group).toMatchObject({ status: "insufficient", distinctXCount: 2, fit: null });
    expect(group.points).toHaveLength(4);
  });

  it("requires full stored dimensions and units, finite values, valid conditions and a static timestamp", () => {
    const base = reading(100);
    const invalid = [
      ...["force", "extension", "length", "naturalLength"].map((key) => ({ ...base, id: `missing-${key}`, metrics: base.metrics.filter((metric) => metric.key !== key) })),
      ...["force", "extension", "length", "naturalLength"].map((key) => ({ ...base, id: `unit-${key}`, metrics: base.metrics.map((metric) => metric.key === key ? { ...metric, unit: "wrong" } : metric) })),
      { ...replaceMetric(base, "force", NaN), id: "nan" },
      { ...base, id: "missing-condition", parameters: { stiffness: 20, loadMassGrams: 100 } },
      { ...base, id: "time", timeSeconds: .01 }
    ];
    const result = analyzeHighSchoolMeasurements("spring-force", invalid);
    expect(result.acceptedCount).toBe(0);
    expect(result.excluded).toHaveLength(invalid.length);
    expect(result.excluded.at(-1)!.reason).toContain("静态模型");
  });

  it("rejects negative/over-range extension and inconsistent archived length evidence without inventing replacement values", () => {
    const base = reading(100);
    for (const [key, amount] of [["extension", -.01], ["extension", .251], ["force", -1], ["length", .4], ["naturalLength", .2]] as const) {
      const result = analyzeHighSchoolMeasurements("spring-force", [replaceMetric(base, key, amount)]);
      expect(result.acceptedCount).toBe(0);
      expect(result.excluded[0]!.reason).toMatch(/预设线性范围|不一致/);
    }
  });

  it("does not report a physical stiffness when saved values imply a nonpositive slope", () => {
    const records = [0, 100, 200].map((mass) => replaceMetric(reading(mass), "force", 2 - mass / 1000));
    const group = analyzeHighSchoolMeasurements("spring-force", records).groups[0]!;
    expect(group.fit).toBeNull();
    expect(group.estimates).toEqual([]);
    expect(group.reasons.join(" ")).toContain("斜率不为正");
  });
});
