import { describe, expect, it } from "vitest";
import {
  analyzeHighSchoolMeasurements, calculateForceComposition, defaultHighSchoolParameters,
  highSchoolExperiment, simulateHighSchoolExperiment,
  type ForceCompositionParameters, type HighSchoolAnalysisMeasurement
} from "./index";

const parameters: ForceCompositionParameters = { force1N: 3, angle1Degrees: 0, force2N: 4, angle2Degrees: 90, trialForceN: 5, trialAngleDegrees: 0 };
const state = (changes: Partial<ForceCompositionParameters> = {}) => calculateForceComposition({ ...parameters, ...changes });
const normalized = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
function reading(angle: number, changes: Partial<ForceCompositionParameters> = {}, id = JSON.stringify([angle, changes])): HighSchoolAnalysisMeasurement {
  const p = { ...parameters, angle2Degrees: angle, ...changes };
  return { id, timeSeconds: 0, parameters: p, metrics: simulateHighSchoolExperiment("force-composition", p).metrics.map((entry) => ({ ...entry })) };
}
function replaceMetric(record: HighSchoolAnalysisMeasurement, key: string, amount: number) {
  return { ...record, metrics: record.metrics.map((entry) => entry.key === key ? { ...entry, value: amount } : entry) };
}

describe("planar concurrent force composition", () => {
  it("adds perpendicular components and leaves the independent trial unchanged", () => {
    const result = state();
    expect(result).toMatchObject({ time: 0, force1X: 3, force1Y: 0, force2X: 0, force2Y: 4,
      resultantX: 3, resultantY: 4, resultantMagnitude: 5, resultantSquared: 25,
      trialX: 5, trialY: 0, residualX: 2, residualY: -4, angleBetweenDegrees: 90, angleBetweenCosine: 0,
      resultantDirectionDefined: 1, angleBetweenDefined: 1 });
    expect(result.resultantAngleDegrees).toBeCloseTo(53.13010235415598, 12);
    expect(result.residualMagnitude).toBeCloseTo(Math.sqrt(20), 12);
    expect(parameters.trialAngleDegrees).toBe(0);
  });

  it("distinguishes an equivalent same-direction force from the opposite balancing force", () => {
    const reference = state();
    const equivalent = state({ trialAngleDegrees: reference.resultantAngleDegrees });
    expect(equivalent).toMatchObject({ trialForceN: 5, residualMagnitude: 0, residualX: 0, residualY: 0 });
    const balance = state({ trialAngleDegrees: reference.resultantAngleDegrees - 180 });
    expect(balance.residualMagnitude).toBeCloseTo(10, 12);
    expect(balance.trialX + reference.resultantX).toBeCloseTo(0, 12);
    expect(balance.trialY + reference.resultantY).toBeCloseTo(0, 12);
  });

  it("changes only trial/residual outputs when the learner adjusts the trial", () => {
    const original = state(); const changed = state({ trialForceN: 8, trialAngleDegrees: -40 });
    for (const key of ["force1X", "force1Y", "force2X", "force2Y", "resultantX", "resultantY", "resultantMagnitude", "resultantAngleDegrees", "angleBetweenDegrees"] as const) expect(changed[key]).toBe(original[key]);
    expect(changed.residualMagnitude).not.toBe(original.residualMagnitude);
    expect(changed.trialForceN).toBe(8);
  });

  it("has no resultant direction when equal antiparallel forces cancel, at arbitrary orientation", () => {
    for (const angle of [-180, -150, -37.5, 0, 30.25, 90, 179.5, 180]) {
      const result = state({ force1N: 3, angle1Degrees: angle, force2N: 3, angle2Degrees: normalized(angle + 180), trialForceN: 0 });
      expect(result).toMatchObject({ resultantX: 0, resultantY: 0, resultantMagnitude: 0, resultantSquared: 0, resultantDirectionDefined: 0, resultantAngleDegrees: 0,
        angleBetweenDefined: 1, angleBetweenDegrees: 180, angleBetweenCosine: -1, residualMagnitude: 0 });
    }
  });

  it("keeps the larger force's direction for unequal antiparallel forces", () => {
    expect(state({ force1N: 2, force2N: 5, angle2Degrees: 180 })).toMatchObject({ resultantX: -3, resultantY: 0, resultantMagnitude: 3, resultantAngleDegrees: -180, resultantDirectionDefined: 1 });
    expect(state({ force1N: 5, force2N: 2, angle1Degrees: -90, angle2Degrees: 90 })).toMatchObject({ resultantX: 0, resultantY: -3, resultantMagnitude: 3, resultantAngleDegrees: -90 });
  });

  it("does not invent a relative angle when either force is zero", () => {
    const single = state({ force1N: 0, angle1Degrees: -135, angle2Degrees: -90 });
    expect(single).toMatchObject({ force1X: 0, force1Y: 0, resultantX: 0, resultantY: -4, resultantAngleDegrees: -90, resultantDirectionDefined: 1,
      angleBetweenDefined: 0, angleBetweenDegrees: 0, angleBetweenCosine: 0 });
    const neither = state({ force1N: 0, force2N: 0, trialForceN: 0, angle1Degrees: 180, angle2Degrees: -90, trialAngleDegrees: -90 });
    expect(neither).toMatchObject({ resultantMagnitude: 0, resultantDirectionDefined: 0, angleBetweenDefined: 0, residualMagnitude: 0 });
    expect(Object.values(neither).every((value) => Number.isFinite(value) && !Object.is(value, -0))).toBe(true);
  });

  it("normalizes signed directions and distinguishes the smaller included angle from a reflex angle", () => {
    expect(state({ angle1Degrees: -180, angle2Degrees: 180 })).toMatchObject({ resultantAngleDegrees: -180, angleBetweenDegrees: 0, resultantMagnitude: 7 });
    expect(state({ angle1Degrees: 170, angle2Degrees: -170 }).angleBetweenDegrees).toBe(20);
    for (const angle of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
      const result = state({ angle1Degrees: angle, angle2Degrees: angle });
      expect(result.resultantAngleDegrees).toBeCloseTo(angle === 180 ? -180 : angle, 10);
      expect(result.resultantAngleDegrees).toBeGreaterThanOrEqual(-180);
      expect(result.resultantAngleDegrees).toBeLessThan(180);
    }
  });

  it("preserves magnitude, included angle and residual norm under a common rotation", () => {
    const base = { force1N: 2.7, angle1Degrees: -35, force2N: 4.2, angle2Degrees: 105, trialForceN: 6.4, trialAngleDegrees: 15 };
    const reference = calculateForceComposition(base);
    for (const rotation of [-180, -90, -37, 30, 90, 179]) {
      const result = calculateForceComposition({ ...base, angle1Degrees: normalized(base.angle1Degrees + rotation), angle2Degrees: normalized(base.angle2Degrees + rotation), trialAngleDegrees: normalized(base.trialAngleDegrees + rotation) });
      expect(result.resultantMagnitude).toBeCloseTo(reference.resultantMagnitude, 12);
      expect(result.residualMagnitude).toBeCloseTo(reference.residualMagnitude, 12);
      expect(result.angleBetweenDegrees).toBe(reference.angleBetweenDegrees);
      expect(result.resultantAngleDegrees).toBeCloseTo(normalized(reference.resultantAngleDegrees + rotation), 10);
    }
  });

  it("satisfies the squared-resultant law and triangle bounds over parameter corners and oblique angles", () => {
    for (const force1N of [0, .1, 2.7, 5]) for (const force2N of [0, .1, 3.4, 5]) for (const angle2Degrees of [-180, -127.5, -90, 0, 47.25, 90, 180]) {
      const result = state({ force1N, force2N, angle2Degrees });
      const expectedSquared = force1N ** 2 + force2N ** 2 + 2 * force1N * force2N * Math.cos(angle2Degrees * Math.PI / 180);
      expect(result.resultantSquared).toBeCloseTo(expectedSquared, 11);
      expect(result.resultantMagnitude + 1e-12).toBeGreaterThanOrEqual(Math.abs(force1N - force2N));
      expect(result.resultantMagnitude).toBeLessThanOrEqual(force1N + force2N + 1e-12);
      expect(Object.values(result).every(Number.isFinite)).toBe(true);
    }
  });

  it("does not confuse tiny nonzero forces or a resolvable near-cancellation with zero", () => {
    const tiny = state({ force1N: 1e-20, force2N: 0, trialForceN: 0 });
    expect(tiny.resultantMagnitude).toBe(1e-20); expect(tiny.resultantDirectionDefined).toBe(1);
    const nearby = state({ force1N: 3, force2N: 3 - 1e-10, angle2Degrees: 180 });
    expect(nearby.resultantMagnitude).toBeGreaterThan(9.9e-11); expect(nearby.resultantDirectionDefined).toBe(1);
  });

  it("rejects invalid direct magnitudes and degree ranges without coercion", () => {
    for (const key of Object.keys(parameters) as Array<keyof ForceCompositionParameters>) {
      for (const invalid of [NaN, Infinity, -Infinity, "1", null, undefined]) expect(() => state({ [key]: invalid } as Partial<ForceCompositionParameters>)).toThrow(RangeError);
      const bounds = key.includes("Degrees") ? [-180, 180] : [0, key === "trialForceN" ? 10 : 5];
      expect(() => state({ [key]: bounds[0]! - .01 })).toThrow(RangeError);
      expect(() => state({ [key]: bounds[1]! + .01 })).toThrow(RangeError);
    }
  });
});

describe("force-composition workbench contract", () => {
  it("registers all six independent controls and a static, honest model boundary", () => {
    expect(defaultHighSchoolParameters("force-composition")).toEqual(parameters);
    const definition = highSchoolExperiment("force-composition");
    expect(definition.parameters.map(({ key, unit }) => [key, unit])).toEqual([["force1N", "N"], ["angle1Degrees", "°"], ["force2N", "N"], ["angle2Degrees", "°"], ["trialForceN", "N"], ["trialAngleDegrees", "°"]]);
    expect(definition.assumptions.join(" ")).toContain("不自动填入模型答案");
    expect(definition.assumptions.join(" ")).toContain("不模拟物体运动或真实测力计");
    const initial = simulateHighSchoolExperiment("force-composition", { ...parameters });
    for (const time of [-1, 1 / 60, 60, 10000]) expect(simulateHighSchoolExperiment("force-composition", { ...parameters }, time)).toEqual(initial);
    expect(initial.durationSeconds).toBe(0); expect(initial.state.time).toBe(0);
  });

  it("omits undefined angles from measured-value displays and disables the angle curve for a zero force", () => {
    const cancelled = simulateHighSchoolExperiment("force-composition", { ...parameters, force2N: 3, angle2Degrees: 180 });
    expect(cancelled.metrics.some(({ key }) => key === "resultantAngleDegrees")).toBe(false);
    expect(cancelled.metrics.find(({ key }) => key === "angleBetweenDegrees")?.value).toBe(180);
    expect(cancelled.warnings.join(" ")).toContain("没有合力方向");
    const single = simulateHighSchoolExperiment("force-composition", { ...parameters, force1N: 0 });
    expect(single.metrics.some(({ key }) => key === "angleBetweenDegrees")).toBe(false);
    expect(single.series).toEqual([]);
    expect(single.warnings.join(" ")).toContain("夹角无定义");
  });

  it("plots the fixed force magnitudes against cosθ and includes the exact current working point", () => {
    const result = simulateHighSchoolExperiment("force-composition", { ...parameters, force1N: 2.7, angle1Degrees: -37, angle2Degrees: 112.3 });
    const curve = result.series[0]!;
    expect(curve).toMatchObject({ key: "resultantSquared", xKey: "angleBetweenCosine", xUnit: "", yUnit: "N²" });
    expect(curve.points).toContainEqual({ x: result.state.angleBetweenCosine, y: result.state.resultantSquared });
    expect(curve.points[0]!.x).toBe(-1); expect(curve.points.at(-1)!.x).toBe(1);
    for (const [index, point] of curve.points.entries()) {
      expect(point.y).toBeCloseTo(2.7 ** 2 + 4 ** 2 + 2 * 2.7 * 4 * point.x, 11);
      expect(point.y).toBeGreaterThanOrEqual(0);
      if (index > 0) expect(point.x).toBeGreaterThan(curve.points[index - 1]!.x);
    }
  });

  it("rejects unknown keys, explicit bad values and non-finite clock arguments", () => {
    for (const p of [{ force1N: 5.1 }, { angle1Degrees: -181 }, { trialForceN: 10.1 }, { trialAngleDegrees: "90" }, { unknown: 1 }]) expect(() => simulateHighSchoolExperiment("force-composition", p as unknown as Record<string, number>)).toThrow(RangeError);
    expect(() => simulateHighSchoolExperiment("force-composition", {}, NaN)).toThrow(RangeError);
  });
});

describe("saved resultant-squared versus cosine analysis", () => {
  it("recovers the expected slope and free intercept from three stored included angles", () => {
    const analysis = analyzeHighSchoolMeasurements("force-composition", [0, 90, 180].map((angle) => reading(angle)));
    expect(analysis.acceptedCount).toBe(3);
    const group = analysis.groups[0]!;
    expect(group).toMatchObject({ relationshipId: "resultant-squared-cosine", pointSource: "saved-reading", status: "ready", distinctXCount: 3, xAxis: { unit: "" }, yAxis: { unit: "N²" } });
    expect(group.points.map(({ x, y }) => [x, y])).toEqual([[-1, 1], [0, 25], [1, 49]]);
    expect(group.fit!.slope).toBeCloseTo(24, 12); expect(group.fit!.intercept).toBeCloseTo(25, 12);
    expect(group.estimates.map(({ key, unit }) => [key, unit])).toEqual([["forceProductCoefficient", "N²"], ["forceSquaresIntercept", "N²"]]);
    expect(group.controls.map(({ key }) => key)).toEqual(["force1N", "force2N"]);
    expect(group.conditions.join(" ")).toContain("不是独立实测");
    expect(group.conditions.join(" ")).toContain("不能与拟合优度 R² 混淆");
  });

  it("uses archived resultants rather than recomputing the model or substituting learner trials", () => {
    const entries = [0, 90, 180].map((angle) => replaceMetric(reading(angle, { trialForceN: 10, trialAngleDegrees: -80 }), "resultantMagnitude", Math.sqrt(40 + 30 * Math.cos(angle * Math.PI / 180))));
    const group = analyzeHighSchoolMeasurements("force-composition", entries).groups[0]!;
    expect(group.fit!.slope).toBeCloseTo(30, 11); expect(group.fit!.intercept).toBeCloseTo(40, 11);
    expect(group.points.some(({ y }) => y === 100)).toBe(false);
  });

  it("separates changed force magnitudes but permits rotations and independent trial changes", () => {
    const entries = [0, 90, 180].flatMap((angle) => [reading(angle), reading(normalized(angle + 30), { angle1Degrees: 30, trialForceN: 1, trialAngleDegrees: -170 }), reading(angle, { force1N: 2 }), reading(angle, { force2N: 5 })]);
    const groups = analyzeHighSchoolMeasurements("force-composition", entries).groups;
    expect(groups).toHaveLength(3);
    expect(groups.every(({ status, distinctXCount }) => status === "ready" && distinctXCount === 3)).toBe(true);
    const original = groups.find(({ controls }) => controls[0]!.value === 3 && controls[1]!.value === 4)!;
    expect(original.points).toHaveLength(6);
    expect(original.fit!.slope).toBeCloseTo(24, 12);
  });

  it("does not count a rotated or reflected repeated angle as a new cosθ", () => {
    const entries = [reading(60), reading(-60), reading(90, { angle1Degrees: 30 }), reading(150, { angle1Degrees: 90 })];
    const group = analyzeHighSchoolMeasurements("force-composition", entries).groups[0]!;
    expect(group).toMatchObject({ status: "insufficient", distinctXCount: 1, fit: null });
    expect(group.points).toHaveLength(4);
    expect(group.nextStep).toContain("至少 3 个不同 cosθ");
    expect(analyzeHighSchoolMeasurements("force-composition", []).groups[0]).toMatchObject({ status: "insufficient", points: [] });
  });

  it("accepts a cancelling pair's zero resultant but excludes zero-force undefined-angle records", () => {
    const analysis = analyzeHighSchoolMeasurements("force-composition", [reading(180, { force2N: 3 }), reading(90, { force1N: 0 })]);
    expect(analysis.acceptedCount).toBe(1);
    expect(analysis.groups[0]!.points[0]).toMatchObject({ x: -1, y: 0 });
    expect(analysis.excluded[0]!.reason).toContain("夹角无定义");
  });

  it("requires stored values with their units, complete parameter snapshots and a static timestamp", () => {
    const base = reading(90);
    const invalid = [
      ...["force1N", "force2N", "resultantMagnitude", "angleBetweenDegrees"].map((key) => ({ ...base, id: `missing-${key}`, metrics: base.metrics.filter((entry) => entry.key !== key) })),
      ...["force1N", "force2N", "resultantMagnitude", "angleBetweenDegrees"].map((key) => ({ ...base, id: `unit-${key}`, metrics: base.metrics.map((entry) => entry.key === key ? { ...entry, unit: "wrong" } : entry) })),
      { ...replaceMetric(base, "resultantMagnitude", NaN), id: "nan" },
      { ...base, id: "incomplete", parameters: { force1N: 3 } },
      { ...base, id: "time", timeSeconds: .1 }
    ];
    const analysis = analyzeHighSchoolMeasurements("force-composition", invalid);
    expect(analysis.acceptedCount).toBe(0); expect(analysis.excluded).toHaveLength(invalid.length);
    expect(analysis.excluded.at(-1)!.reason).toContain("静态模型");
  });

  it("rejects mismatched archived angle/force conditions and negative magnitude without repairing them", () => {
    const base = reading(90);
    for (const [key, amount] of [["force1N", 4], ["force2N", 3], ["angleBetweenDegrees", 60], ["angleBetweenDegrees", 181], ["resultantMagnitude", -1]] as const) {
      const analysis = analyzeHighSchoolMeasurements("force-composition", [replaceMetric(base, key, amount)]);
      expect(analysis.acceptedCount).toBe(0); expect(analysis.excluded).toHaveLength(1);
    }
  });
});
