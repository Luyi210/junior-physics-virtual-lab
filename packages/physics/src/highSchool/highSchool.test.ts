import { describe, expect, it } from "vitest";
import {
  HIGH_SCHOOL_EXPERIMENTS, calculateDoubleSlit, calculateDoubleSlitBrightPosition,
  calculateEmfInternalResistance, calculateNewtonSecondLaw, calculatePendulum,
  calculatePendulumPeriod, calculateProjectileMotion, calculateUniformAcceleration,
  defaultHighSchoolParameters, simulateHighSchoolExperiment, createCapacitorHistory
} from "./index";

describe("uniform acceleration", () => {
  it("keeps direction on a reversal instead of treating displacement as travelled distance", () => {
    const p = { initialVelocity: 2, acceleration: -1, duration: 5 };
    expect(calculateUniformAcceleration(p, 2)).toMatchObject({ position: 2, velocity: 0 });
    expect(calculateUniformAcceleration(p, 4)).toMatchObject({ position: 0, velocity: -2 });
  });
  it("reduces to uniform motion and satisfies the velocity-displacement invariant", () => {
    expect(calculateUniformAcceleration({ initialVelocity: 3, acceleration: 0, duration: 4 }, 4)).toMatchObject({ position: 12, velocity: 3 });
    const state = calculateUniformAcceleration({ initialVelocity: -2, acceleration: 0.7, duration: 8 }, 6);
    expect(state.velocity ** 2 - 4).toBeCloseTo(2 * 0.7 * state.position, 12);
  });
  it("clamps the observation time but rejects non-finite parameters and zero duration", () => {
    const p = { initialVelocity: 1, acceleration: 2, duration: 4 };
    expect(calculateUniformAcceleration(p, -1).time).toBe(0);
    expect(calculateUniformAcceleration(p, 20).time).toBe(4);
    expect(() => calculateUniformAcceleration({ ...p, acceleration: NaN }, 1)).toThrow(RangeError);
    expect(() => calculateUniformAcceleration({ ...p, duration: 0 }, 1)).toThrow(RangeError);
  });
});

describe("cart and hanging mass", () => {
  const p = { cartMass: 0.5, hangingMass: 0.05, resistance: 0.05, travelDistance: 1 };
  it("uses the whole accelerated mass and distinguishes rope tension from hanging weight", () => {
    const result = calculateNewtonSecondLaw(p, 0.5);
    expect(result.acceleration).toBeCloseTo(0.8, 12);
    expect(result.tension).toBeCloseTo(0.45, 12);
    expect(result.totalMass).toBeCloseTo(0.55, 12);
    expect(result.tension - result.resistance).toBeCloseTo(p.cartMass * result.acceleration, 12);
    expect(p.hangingMass * 9.8 - result.tension).toBeCloseTo(p.hangingMass * result.acceleration, 12);
  });
  it("conserves lost gravitational energy as kinetic energy and friction work", () => {
    for (const time of [0, 0.2, 0.5, 1, 10]) {
      const result = calculateNewtonSecondLaw(p, time);
      expect(result.kineticEnergy + result.dissipatedEnergy).toBeCloseTo(result.lostPotentialEnergy, 11);
      expect(result.position).toBeLessThanOrEqual(p.travelDistance);
    }
  });
  it("does not accelerate backwards or creep at the static threshold", () => {
    for (const resistance of [0.98, 1, 2]) {
      const result = calculateNewtonSecondLaw({ ...p, hangingMass: 0.1, resistance }, 4);
      expect(result.acceleration).toBe(0);
      expect(result.position).toBe(0);
      expect(result.resistance).toBeCloseTo(0.98, 12);
      expect(result.tension).toBeCloseTo(0.98, 12);
    }
  });
  it("remains below free-fall acceleration and rejects unphysical mass or force inputs", () => {
    const result = calculateNewtonSecondLaw({ ...p, hangingMass: 10, resistance: 0 }, 1);
    expect(result.acceleration).toBeLessThan(9.8);
    expect(() => calculateNewtonSecondLaw({ ...p, cartMass: 0 }, 1)).toThrow(RangeError);
    expect(() => calculateNewtonSecondLaw({ ...p, resistance: -1 }, 1)).toThrow(RangeError);
    expect(() => calculateNewtonSecondLaw({ ...p, hangingMass: Infinity }, 1)).toThrow(RangeError);
  });
});

describe("projectile motion", () => {
  it("separates horizontal launch speed from the fall time", () => {
    for (const initialSpeed of [0, 5, 10]) {
      const p = { initialSpeed, angleDegrees: 0, initialHeight: 4.9 };
      const state = calculateProjectileMotion(p, 10);
      expect(state.flightTime).toBeCloseTo(1, 12);
      expect(state.range).toBeCloseTo(initialSpeed, 12);
      expect(state.vy).toBeCloseTo(-9.8, 12);
      expect(state.y).toBe(0);
    }
  });
  it("conserves mechanical energy per unit mass during flight", () => {
    const p = { initialSpeed: 12, angleDegrees: 37, initialHeight: 2 };
    const initial = calculateProjectileMotion(p, 0);
    for (const fraction of [0.1, 0.25, 0.5, 0.9, 1]) {
      const state = calculateProjectileMotion(p, initial.flightTime * fraction);
      expect(state.specificEnergy).toBeCloseTo(initial.specificEnergy, 10);
      expect(state.vx).toBe(initial.vx);
    }
  });
  it("has equal ranges at complementary angles only for equal launch and landing heights", () => {
    const range = (angleDegrees: number) => calculateProjectileMotion({ initialSpeed: 9.8, angleDegrees, initialHeight: 0 }, 0).range;
    expect(range(30)).toBeCloseTo(range(60), 12);
    expect(range(45)).toBeCloseTo(9.8, 12);
  });
  it("handles vertical launch and the zero-flight boundary without NaN", () => {
    expect(calculateProjectileMotion({ initialSpeed: 9.8, angleDegrees: 90, initialHeight: 0 }, 1).y).toBeCloseTo(4.9, 12);
    const zero = calculateProjectileMotion({ initialSpeed: 0, angleDegrees: 0, initialHeight: 0 }, 2);
    expect(zero.flightTime).toBe(0);
    expect(zero.x).toBe(0);
    expect(Object.values(zero).every(Number.isFinite)).toBe(true);
    expect(() => calculateProjectileMotion({ initialSpeed: 5, angleDegrees: 100, initialHeight: 0 }, 0)).toThrow(RangeError);
  });
});

describe("nonlinear pendulum", () => {
  const p = { length: 1, amplitudeDegrees: 60, mass: 0.1 };
  it("matches the complete elliptic integral reference at 60 degrees", () => {
    const period = calculatePendulumPeriod(p);
    // K(k=1/2) = 1.685750354812596; ratio T/T0 = 2 K / π.
    expect(period.period / period.smallAnglePeriod).toBeCloseTo(1.0731820071493644, 11);
    expect(calculatePendulumPeriod({ ...p, amplitudeDegrees: 0 }).period).toBeCloseTo(2 * Math.PI / Math.sqrt(9.8), 12);
  });
  it("makes the mass irrelevant to period and obeys square-root length scaling", () => {
    const reference = calculatePendulumPeriod(p).period;
    expect(calculatePendulumPeriod({ ...p, mass: 5 }).period).toBe(reference);
    expect(calculatePendulumPeriod({ ...p, length: 4 }).period).toBeCloseTo(2 * reference, 12);
    expect(calculatePendulumPeriod({ ...p, amplitudeDegrees: 75 }).period).toBeGreaterThan(reference);
  });
  it("reaches the equilibrium and opposite turning point at the nonlinear quarter and half periods", () => {
    const period = calculatePendulumPeriod(p).period;
    const quarter = calculatePendulum(p, period / 4);
    expect(quarter.angleRadians).toBeCloseTo(0, 9);
    expect(quarter.angularVelocity).toBeLessThan(0);
    const half = calculatePendulum(p, period / 2);
    expect(half.angleRadians).toBeCloseTo(-Math.PI / 3, 9);
    expect(half.angularVelocity).toBeCloseTo(0, 9);
  });
  it("conserves energy and string length through large-angle motion", () => {
    const large = { ...p, amplitudeDegrees: 75 };
    const initial = calculatePendulum(large, 0);
    for (const fraction of [0.13, 0.25, 0.61, 0.99, 1.2, 2.8]) {
      const state = calculatePendulum(large, initial.period * fraction);
      expect(state.totalEnergy).toBeCloseTo(initial.totalEnergy, 9);
      expect(Math.hypot(state.x, state.y)).toBeCloseTo(large.length, 12);
    }
  });
  it("keeps oscillating throughout a fixed 60-second observation window without counting periods", () => {
    const initial = calculatePendulum(p, 0);
    expect(initial.durationSeconds).toBe(60);
    expect(calculatePendulum({ ...p, length: 0.3, amplitudeDegrees: 2 }, 0).durationSeconds).toBe(60);
    for (const time of [30, 60]) {
      const current = calculatePendulum(p, time);
      expect(current.time).toBe(time);
      expect(current.angleRadians).not.toBe(initial.angleRadians);
      expect(Math.abs(current.angularVelocity)).toBeGreaterThan(1e-3);
      expect(current.totalEnergy).toBeCloseTo(initial.totalEnergy, 9);
    }
    const atThirty = calculatePendulum(p, 30);
    const nextCycle = calculatePendulum(p, 30 + initial.period);
    expect(nextCycle.angleRadians).toBeCloseTo(atThirty.angleRadians, 9);
    expect(nextCycle.angularVelocity).toBeCloseTo(atThirty.angularVelocity, 9);
    expect(calculatePendulum(p, 61).time).toBe(60);
  });
  it("resolves a short pendulum throughout 60 seconds without aliasing or reintegrating every plotted cycle", () => {
    const parameters = { length: 0.3, amplitudeDegrees: 2, mass: 0.1 };
    const result = simulateHighSchoolExperiment("pendulum", parameters, 30);
    const period = result.state.period!;
    const angles = result.series.find((entry) => entry.key === "angleDegrees")!.points;
    expect(angles[0]!.x).toBe(0);
    expect(angles.at(-1)!.x).toBe(60);
    expect(angles.length).toBeGreaterThan(2500);
    expect(angles.length).toBeLessThan(2700);
    expect(angles.every((point, index) => index === 0 || point.x > angles[index - 1]!.x && point.x - angles[index - 1]!.x <= period / 48 * (1 + 1e-10))).toBe(true);
    for (const index of [0, 12, 48, 1317, angles.length - 1]) {
      const point = angles[index]!;
      expect(point.y).toBeCloseTo(calculatePendulum(parameters, point.x).angleDegrees, 8);
    }
  });
  it("rejects unsupported slack-string angles and non-finite or zero dimensions", () => {
    expect(() => calculatePendulum({ ...p, amplitudeDegrees: 90 }, 1)).toThrow(RangeError);
    expect(() => calculatePendulum({ ...p, length: 0 }, 1)).toThrow(RangeError);
    expect(() => calculatePendulum({ ...p, mass: NaN }, 1)).toThrow(RangeError);
  });
});

describe("emf and internal resistance", () => {
  it("distinguishes loaded terminal voltage from emf and balances source power", () => {
    const state = calculateEmfInternalResistance({ emf: 3, internalResistance: 1, loadResistance: 5 });
    expect(state.current).toBe(0.5);
    expect(state.terminalVoltage).toBe(2.5);
    expect(state.internalVoltage).toBe(0.5);
    expect(state.loadPower).toBe(1.25);
    expect(state.internalPower).toBe(0.25);
    expect(state.loadPower + state.internalPower).toBe(state.sourcePower);
  });
  it("recovers the ideal source and zero-current open-circuit limits", () => {
    expect(calculateEmfInternalResistance({ emf: 3, internalResistance: 0, loadResistance: 5 }).terminalVoltage).toBe(3);
    const open = calculateEmfInternalResistance({ emf: 3, internalResistance: 2, loadResistance: 1e12 });
    expect(open.current).toBeLessThan(1e-10);
    expect(open.terminalVoltage).toBeCloseTo(3, 10);
  });
  it("maximizes load power at matched resistance and preserves the physical short-circuit distinction", () => {
    const power = (loadResistance: number) => calculateEmfInternalResistance({ emf: 6, internalResistance: 2, loadResistance }).loadPower;
    expect(power(2)).toBeGreaterThan(power(1));
    expect(power(2)).toBeGreaterThan(power(4));
    const short = calculateEmfInternalResistance({ emf: 3, internalResistance: 1, loadResistance: 0 });
    expect(short.terminalVoltage).toBe(0);
    expect(short.current).toBe(3);
    expect(() => calculateEmfInternalResistance({ emf: 3, internalResistance: 0, loadResistance: 0 })).toThrow(RangeError);
  });
  it("rejects negative resistance and avoids a zero-emf efficiency division", () => {
    expect(() => calculateEmfInternalResistance({ emf: 3, internalResistance: -1, loadResistance: 5 })).toThrow(RangeError);
    expect(calculateEmfInternalResistance({ emf: 0, internalResistance: 1, loadResistance: 5 }).efficiency).toBe(0);
  });
  it("plots the exact low-resistance power maximum and current load without undersampling the peak", () => {
    const result = simulateHighSchoolExperiment("emf-internal-resistance", { emf: 3, internalResistance: 0.2, loadResistance: 7.35 });
    const points = result.series.find((graph) => graph.key === "loadPower")!.points;
    const peak = points.reduce((best, point) => point.y > best.y ? point : best);
    expect(peak.x).toBe(0.2);
    expect(peak.y).toBeCloseTo(11.25, 12);
    expect(points.find((point) => point.x === 7.35)?.y).toBe(result.state.loadPower);
    expect(points.filter((point) => point.x >= 0.15 && point.x <= 0.3).length).toBeGreaterThan(10);
    expect(points.every((point, index) => index === 0 || point.x > points[index - 1]!.x)).toBe(true);
    expect(result.series.find((graph) => graph.key === "terminalVoltage")!.points).toContainEqual({ x: result.state.current, y: result.state.terminalVoltage });
  });
  it.each([0, 0.05, 0.1])("keeps valid unique load samples when r=%s is zero, below range or on the boundary", (internalResistance) => {
    const result = simulateHighSchoolExperiment("emf-internal-resistance", { emf: 3, internalResistance, loadResistance: 0.1 });
    const points = result.series.find((graph) => graph.key === "loadPower")!.points;
    expect(points[0]!.x).toBe(0.1);
    expect(points.at(-1)!.x).toBe(50);
    expect(points.every((point, index) => Number.isFinite(point.y) && (index === 0 || point.x > points[index - 1]!.x))).toBe(true);
    expect(points.reduce((best, point) => point.y > best.y ? point : best).x).toBe(0.1);
    expect(points[0]!.y).toBeCloseTo(9 * 0.1 / (0.1 + internalResistance) ** 2, 12);
  });
});

describe("double-slit optical path geometry", () => {
  const p = { wavelengthNm: 500, slitSeparationMm: 0.25, screenDistance: 1, screenPositionMm: 0 };
  it("has a central maximum, symmetric intensity and opposite path difference", () => {
    expect(calculateDoubleSlit(p)).toMatchObject({ intensity: 1, pathDifference: 0 });
    const positive = calculateDoubleSlit({ ...p, screenPositionMm: 7.3 });
    const negative = calculateDoubleSlit({ ...p, screenPositionMm: -7.3 });
    expect(positive.intensity).toBeCloseTo(negative.intensity, 12);
    expect(positive.pathDifference).toBeCloseTo(-negative.pathDifference, 15);
    expect(positive.fringeSpacing).toBeCloseTo(0.002, 14);
  });
  it("locates bright fringes by actual path difference instead of assuming equal spacing", () => {
    for (const order of [-4, -1, 0, 1, 4]) {
      const y = calculateDoubleSlitBrightPosition(p, order)!;
      const state = calculateDoubleSlit({ ...p, screenPositionMm: y * 1000 });
      expect(state.pathDifference / state.wavelength).toBeCloseTo(order, 10);
      expect(state.intensity).toBeCloseTo(1, 12);
      const directDifference = Math.hypot(1, y + 0.000125) - Math.hypot(1, y - 0.000125);
      expect(directDifference).toBeCloseTo(order * 500e-9, 14);
    }
    expect(calculateDoubleSlit({ ...p, screenPositionMm: 1 }).intensity).toBeLessThan(1e-10);
  });
  it("exposes the far-off-axis error of the small-angle spacing instead of using it for intensity", () => {
    const wide = { ...p, slitSeparationMm: 0.001, screenDistance: 0.1 };
    const exactY = calculateDoubleSlitBrightPosition(wide, 1)!;
    expect(exactY).toBeGreaterThan(0.057);
    expect(calculateDoubleSlit(wide).fringeSpacing).toBeCloseTo(0.05, 12);
    expect(calculateDoubleSlit({ ...wide, screenPositionMm: exactY * 1000 }).intensity).toBeCloseTo(1, 12);
    expect(calculateDoubleSlitBrightPosition(wide, 2)).toBeNull();
  });
  it("rejects zero slit spacing, invalid distances and fractional bright-fringe orders", () => {
    expect(() => calculateDoubleSlit({ ...p, slitSeparationMm: 0 })).toThrow(RangeError);
    expect(() => calculateDoubleSlit({ ...p, screenDistance: Infinity })).toThrow(RangeError);
    expect(() => calculateDoubleSlitBrightPosition(p, 0.5)).toThrow(RangeError);
  });
});

describe("frontend model contract", () => {
  it.each(HIGH_SCHOOL_EXPERIMENTS.map((item) => [item.id]))("provides finite scene state, measurements and axis-labelled curves for %s", (id) => {
    const p = defaultHighSchoolParameters(id);
    const history = id === "capacitor-charge" ? createCapacitorHistory("contract-loop") : undefined;
    const start = simulateHighSchoolExperiment(id, p, 0, history);
    const middle = simulateHighSchoolExperiment(id, p, start.durationSeconds / 2, history);
    expect(Object.values(middle.state).every(Number.isFinite)).toBe(true);
    expect(middle.metrics.every((metric) => Number.isFinite(metric.value))).toBe(true);
    expect(middle.series.length).toBeGreaterThan(0);
    for (const graph of middle.series) {
      expect(graph.xLabel).not.toBe("");
      expect(Number.isFinite(middle.state[graph.xKey])).toBe(true);
      expect(Number.isFinite(middle.state[graph.key])).toBe(true);
      expect(graph.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    }
  });
  it("supplies the exact current point in chart units between animation samples", () => {
    const pendulum = simulateHighSchoolExperiment("pendulum", { amplitudeDegrees: 60 }, 1 / 60);
    expect(pendulum.state.angleDegrees).toBeCloseTo(pendulum.state.angleRadians! * 180 / Math.PI, 12);
    expect(pendulum.state.angleDegrees).toBeLessThan(60);
    expect(pendulum.state.time).toBe(1 / 60);
    const slit = simulateHighSchoolExperiment("double-slit", { screenPositionMm: 1.234 });
    expect(slit.state.screenPositionMm).toBe(1.234);
    expect(slit.state.screenPosition).toBeCloseTo(0.001234, 15);
  });
  it("rejects forged keys, out-of-range values and non-finite time instead of silently changing the experiment", () => {
    expect(() => simulateHighSchoolExperiment("pendulum", { amplitudeDegrees: 180 })).toThrow(RangeError);
    expect(() => simulateHighSchoolExperiment("pendulum", { fakeLength: 1 })).toThrow(RangeError);
    expect(() => simulateHighSchoolExperiment("double-slit", { wavelengthNm: NaN })).toThrow(RangeError);
    expect(() => simulateHighSchoolExperiment("uniform-acceleration", {}, NaN)).toThrow(RangeError);
  });
});
