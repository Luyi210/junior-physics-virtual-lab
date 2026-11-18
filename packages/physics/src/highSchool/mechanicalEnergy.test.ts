import { describe, expect, it } from "vitest";
import {
  calculateMechanicalEnergy, mechanicalEnergyTapePoints, MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS,
  calculateMechanicalEnergyTapeMeasurement, quantizeMechanicalEnergyTapePositionMm, validateMechanicalEnergyTapeObservation,
  MECHANICAL_ENERGY_TAPE_READING_KEYS, analyzeHighSchoolMeasurements, defaultHighSchoolParameters, simulateHighSchoolExperiment,
  type MechanicalEnergyTapeMeasurementInput, type HighSchoolAnalysisMeasurement
} from "./index";

const parameters = { mass: 0.2, dropHeight: 1.2, resistanceRatio: 0 };
const readings: MechanicalEnergyTapeMeasurementInput = { ...parameters, indexA: 5, indexB: 10,
  aBeforeMm: 31.4, aCenterMm: 49, aAfterMm: 70.6, bBeforeMm: 158.8, bCenterMm: 196, bAfterMm: 237.2 };
function values(input = readings) { return Object.fromEntries(calculateMechanicalEnergyTapeMeasurement(input).metrics.map(({ key, value }) => [key, value])); }
function sample(timeSeconds: number, overrides = {}): HighSchoolAnalysisMeasurement {
  const p = { ...parameters, ...overrides };
  return { id: `${timeSeconds}:${JSON.stringify(p)}`, timeSeconds, parameters: p, metrics: simulateHighSchoolExperiment("mechanical-energy", p, timeSeconds).metrics };
}

describe("mechanical-energy model and equal-time tape", () => {
  it("uses SI units, synchronized rest and downward displacement", () => {
    expect(defaultHighSchoolParameters("mechanical-energy")).toEqual(parameters);
    const start = calculateMechanicalEnergy(parameters);
    expect(start).toMatchObject({ time: 0, position: 0, velocity: 0, kineticEnergy: 0, height: 1.2 });
    expect(start.totalMechanicalEnergy).toBeCloseTo(2.352, 12);
    const state = calculateMechanicalEnergy(parameters, 0.2);
    expect(state.position).toBeCloseTo(0.196, 12);
    expect(state.velocity).toBeCloseTo(1.96, 12);
    expect(state.kineticEnergy).toBeCloseTo(0.38416, 12);
    expect(state.potentialEnergyLoss).toBeCloseTo(state.kineticEnergy, 12);
  });

  it.each([0.05, 1].flatMap((mass) => [0.5, 2].flatMap((dropHeight) => [0, 0.4].map((resistanceRatio) => ({ mass, dropHeight, resistanceRatio })))))
    ("accounts for energy including constant-resistance dissipation at the corner %j", (p) => {
      const start = calculateMechanicalEnergy(p);
      for (let fraction = 0; fraction <= 1; fraction += 0.1) {
        const s = calculateMechanicalEnergy(p, fraction * start.durationSeconds);
        expect(s.kineticEnergy + s.potentialEnergy + s.dissipatedEnergy).toBeCloseTo(p.mass * 9.8 * p.dropHeight, 12);
        expect(s.dissipatedEnergy).toBeCloseTo(p.resistanceRatio * p.mass * 9.8 * s.position, 12);
        expect(s.kineticEnergy).toBeCloseTo((1 - p.resistanceRatio) * s.potentialEnergyLoss, 12);
      }
    });

  it("mass changes energies, not trajectory; resistance changes acceleration without impersonating air drag", () => {
    const light = calculateMechanicalEnergy({ ...parameters, resistanceRatio: 0.2 }, 0.2);
    const heavy = calculateMechanicalEnergy({ ...parameters, mass: 0.4, resistanceRatio: 0.2 }, 0.2);
    expect(heavy.durationSeconds).toBe(light.durationSeconds);
    expect(heavy.position).toBe(light.position);
    expect(heavy.kineticEnergy).toBe(2 * light.kineticEnergy);
    expect(light.acceleration).toBeCloseTo(7.84, 12);
    expect(light.totalMechanicalEnergy).toBeLessThan(2.352);
  });

  it("clamps to the pre-impact endpoint and never fabricates a stopped or rebounding body", () => {
    const end = calculateMechanicalEnergy(parameters, 100);
    expect(end.position).toBeCloseTo(1.2, 12);
    expect(end.height).toBeCloseTo(0, 12);
    expect(end.velocity).toBeGreaterThan(0);
    expect(end).toEqual(calculateMechanicalEnergy(parameters, end.durationSeconds));
    expect(calculateMechanicalEnergy(parameters, -1).time).toBe(0);
    expect(() => calculateMechanicalEnergy(parameters, Infinity)).toThrow(RangeError);
  });

  it("rejects invalid parameter values and refuses a configurable tape interval", () => {
    for (const [key, value] of [["mass", 0.04], ["mass", 1.01], ["dropHeight", 0.49], ["dropHeight", 2.01], ["resistanceRatio", -0.01], ["resistanceRatio", 0.41], ["mass", NaN], ["dropHeight", Infinity]] as const) {
      expect(() => calculateMechanicalEnergy({ ...parameters, [key]: value })).toThrow(RangeError);
    }
    expect(() => simulateHighSchoolExperiment("mechanical-energy", { ...parameters, sampleIntervalSeconds: 0.01 }, 0)).toThrow(RangeError);
  });

  it("emits only visible 0.02-second grid points, never a non-grid clamped landing point", () => {
    expect(MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS).toBe(0.02);
    const points = mechanicalEnergyTapePoints(parameters);
    expect(points.at(-1)!.timeSeconds).toBe(0.48);
    expect(points.at(-1)!.positionMm).toBeLessThan(1200);
    expect(points.every((p, i) => p.index === i && p.timeSeconds === Number((i * 0.02).toFixed(2)))).toBe(true);
    expect(mechanicalEnergyTapePoints(parameters, 0.219999).at(-1)!.index).toBe(10);
    expect(mechanicalEnergyTapePoints(parameters, 0.22).at(-1)!.index).toBe(11);
    expect(mechanicalEnergyTapePoints(parameters, 100)).toEqual(points);
    expect(mechanicalEnergyTapePoints(parameters, -1)).toEqual([{ index: 0, timeSeconds: 0, positionMm: 0 }]);
    const onGrid = { ...parameters, dropHeight: 0.5 * 9.8 * 0.4 ** 2 };
    expect(mechanicalEnergyTapePoints(onGrid).at(-1)!.timeSeconds).toBe(0.4);
  });

  it("offers actual state coordinates for every chart and distinguishes energy curves from tape samples", () => {
    const result = simulateHighSchoolExperiment("mechanical-energy", parameters, 0.2);
    for (const series of result.series) {
      expect(Number.isFinite(result.state[series.xKey])).toBe(true);
      expect(Number.isFinite(result.state[series.key])).toBe(true);
    }
    expect(result.metrics.find(({ key }) => key === "position")!.unit).toBe("m");
    expect(result.metrics.find(({ key }) => key === "kineticEnergy")!.unit).toBe("J");
    expect(result.warnings.join(" ")).toContain("碰撞");
  });
});

describe("independent manual six-position tape readings", () => {
  it("derives central speeds and A-to-B energy changes from six displayed positions", () => {
    const result = calculateMechanicalEnergyTapeMeasurement(readings);
    const m = values();
    expect(result.kind).toBe("mechanical-energy-tape");
    expect(result.provenance).toBe("virtual-manual");
    expect(result.readings).toEqual(readings);
    expect(Object.keys(result.readings).sort()).toEqual([...MECHANICAL_ENERGY_TAPE_READING_KEYS].sort());
    expect(result.resolution).toEqual({ value: 0.1, unit: "mm" });
    expect(m.velocityA).toBeCloseTo(0.98, 12);
    expect(m.velocityB).toBeCloseTo(1.96, 12);
    expect(m.dropDistance).toBeCloseTo(0.147, 12);
    expect(m.kineticEnergyIncrease).toBeCloseTo(0.28812, 12);
    expect(m.potentialEnergyLoss).toBeCloseTo(0.28812, 12);
    expect(m.energyDifference).toBeCloseTo(0, 12);
    expect(result.assumptions.join(" ")).toContain("A 不是释放点");
  });

  it("uses student's independent coordinates even when they disagree with model motion or energy conservation", () => {
    const altered = { ...readings, bAfterMm: 300 };
    const result = calculateMechanicalEnergyTapeMeasurement(altered);
    expect(result.readings.bAfterMm).toBe(300);
    expect(values(altered).velocityB).toBeCloseTo(3.53, 12);
    expect(values(altered).energyDifference).toBeLessThan(0);
    expect(result.warnings[0]).toContain("保留原值");
    expect(values({ ...altered, resistanceRatio: 0.4 })).toEqual(values(altered));
    expect(values({ ...altered, mass: 0.4 }).kineticEnergyIncrease).toBeCloseTo(2 * values(altered).kineticEnergyIncrease!, 12);
  });

  it("allows adjacent A/B or a one-point overlap only when shared raw positions are identical", () => {
    const adjacent = { ...readings, indexB: 6, bBeforeMm: 49, bCenterMm: 70.6, bAfterMm: 96 };
    expect(() => calculateMechanicalEnergyTapeMeasurement(adjacent)).not.toThrow();
    expect(() => calculateMechanicalEnergyTapeMeasurement({ ...adjacent, bBeforeMm: 49.1 })).toThrow(/共享/);
    const overlap = { ...readings, indexB: 7, bBeforeMm: 70.6, bCenterMm: 96, bAfterMm: 125.4 };
    expect(() => calculateMechanicalEnergyTapeMeasurement(overlap)).not.toThrow();
    expect(() => calculateMechanicalEnergyTapeMeasurement({ ...overlap, bBeforeMm: 70.5 })).toThrow(/共享/);
  });

  it("quantizes before arithmetic and rejects saved unquantized or incomplete raw evidence", () => {
    const input = { ...readings, aBeforeMm: 31.44 };
    expect(calculateMechanicalEnergyTapeMeasurement(input).readings.aBeforeMm).toBe(31.4);
    expect(values(input)).toEqual(values());
    expect(() => validateMechanicalEnergyTapeObservation(parameters, input, 0.3)).toThrow(/0.1 mm/);
    expect(quantizeMechanicalEnergyTapePositionMm(31.45)).toBe(31.5);
    const missing = { ...readings } as Partial<MechanicalEnergyTapeMeasurementInput>; delete missing.aCenterMm;
    expect(() => calculateMechanicalEnergyTapeMeasurement(missing as MechanicalEnergyTapeMeasurementInput)).toThrow(/完整/);
    expect(() => calculateMechanicalEnergyTapeMeasurement({ ...readings, extra: 1 } as MechanicalEnergyTapeMeasurementInput)).toThrow(/完整/);
  });

  it("rejects malformed indices, non-finite positions, reversal and zero-length intervals", () => {
    for (const override of [{ indexA: 0 }, { indexB: 24 }, { indexB: 5 }, { indexB: 10.1 }, { aBeforeMm: -0.1 }, { bAfterMm: 1200.1 }, { aCenterMm: NaN }, { bAfterMm: Infinity }, { aAfterMm: 49 }, { bBeforeMm: 60 }]) {
      expect(() => calculateMechanicalEnergyTapeMeasurement({ ...readings, ...override })).toThrow(RangeError);
    }
  });

  it("checks the saved apparatus and visible B+1 without replacing any selected position", () => {
    expect(() => validateMechanicalEnergyTapeObservation(parameters, readings, 0.22)).not.toThrow();
    for (const time of [-1, 0.219999, Infinity, 1]) expect(() => validateMechanicalEnergyTapeObservation(parameters, readings, time)).toThrow(RangeError);
    expect(() => validateMechanicalEnergyTapeObservation({ ...parameters, mass: 0.3 }, readings, 0.3)).toThrow(/快照/);
    expect(() => validateMechanicalEnergyTapeObservation({ ...parameters, extra: 0 }, readings, 0.3)).toThrow(/快照/);
  });

  it("accepts an exact-grid endpoint whose displayed 0.1 mm value rounds above the geometric height", () => {
    const p = { ...parameters, resistanceRatio: 0.123, dropHeight: 0.5 * 9.8 * (1 - 0.123) * 0.4 ** 2 };
    const points = mechanicalEnergyTapePoints(p);
    expect(points.at(-1)!.index).toBe(20);
    const at = (index: number) => quantizeMechanicalEnergyTapePositionMm(points[index]!.positionMm);
    const input = { ...p, indexA: 5, indexB: 19, aBeforeMm: at(4), aCenterMm: at(5), aAfterMm: at(6), bBeforeMm: at(18), bCenterMm: at(19), bAfterMm: at(20) };
    expect(input.bAfterMm).toBe(687.6);
    expect(input.bAfterMm).toBeGreaterThan(p.dropHeight * 1000);
    expect(() => validateMechanicalEnergyTapeObservation(p, input, 0.4)).not.toThrow();
    expect(() => calculateMechanicalEnergyTapeMeasurement({ ...input, bAfterMm: 687.7 })).toThrow(RangeError);
  });
});

describe("saved automatic mechanical-energy analysis", () => {
  it("fits ΔK against ΔEp separately under all three fixed controls", () => {
    const records = [0.1, 0.2, 0.3].map((t) => sample(t, { resistanceRatio: 0.2 }));
    const result = analyzeHighSchoolMeasurements("mechanical-energy", [...records, sample(0.1, { mass: 0.4 }), sample(0.1, { dropHeight: 1.5 }), sample(0.1)]);
    expect(result.groups).toHaveLength(4);
    const group = result.groups.find(({ status }) => status === "ready")!;
    expect(group.relationshipId).toBe("kinetic-gain-potential-loss");
    expect(group.fit!.slope).toBeCloseTo(0.8, 12);
    expect(group.fit!.intercept).toBeCloseTo(0, 12);
    expect(group.pointSource).toBe("saved-reading");
    expect(group.estimates.map(({ key }) => key)).toEqual(["kineticGainFraction", "energyIntercept"]);
    expect(group.conditions.join(" ")).toContain("不是独立测量");
    expect(group.conditions.join(" ")).toContain("½m(vB²−vA²)");
  });

  it("uses saved energy values and a free intercept rather than recomputing model answers", () => {
    const records = [0.1, 0.2, 0.3].map((t) => {
      const record = sample(t);
      return { ...record, metrics: record.metrics.map((metric) => metric.key === "kineticEnergy" ? { ...metric, value: 0.5 * metric.value + 0.1 } : metric) };
    });
    const group = analyzeHighSchoolMeasurements("mechanical-energy", records).groups[0]!;
    expect(group.fit!.slope).toBeCloseTo(0.5, 12);
    expect(group.fit!.intercept).toBeCloseTo(0.1, 12);
  });

  it("requires three distinct energies and rejects missing units, impossible times or manual metric substitution", () => {
    expect(analyzeHighSchoolMeasurements("mechanical-energy", [sample(0.1), sample(0.2)]).groups[0]!.fit).toBeNull();
    const good = sample(0.2);
    const wrongUnit = { ...good, id: "unit", metrics: good.metrics.map((metric) => metric.key === "kineticEnergy" ? { ...metric, unit: "N" } : metric) };
    const missingDuration = { ...good, id: "duration", metrics: good.metrics.filter(({ key }) => key !== "durationSeconds") };
    const future = { ...good, id: "future", timeSeconds: 1 };
    const manual = { ...good, id: "manual", metrics: calculateMechanicalEnergyTapeMeasurement(readings).metrics };
    const analysis = analyzeHighSchoolMeasurements("mechanical-energy", [wrongUnit, missingDuration, future, manual]);
    expect(analysis.acceptedCount).toBe(0);
    expect(analysis.excluded).toHaveLength(4);
  });
});
