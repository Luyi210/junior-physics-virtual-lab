import { describe, expect, it } from "vitest";
import type { CapacitorHistory, CapacitorMode } from "@physics-lab/contracts";
import { analyzeHighSchoolMeasurements, calculateCapacitorState, capacitorDurationSeconds, createCapacitorHistory, defaultHighSchoolParameters, simulateHighSchoolExperiment, switchCapacitorMode, validateCapacitorHistory } from "./index";

const parameters = { resistanceKOhm: 10, capacitanceMicrofarads: 470, emf: 6 };
const tau = 4.7;
const initial = () => createCapacitorHistory("run-a");
const simulate = (history = initial(), time = 0) => simulateHighSchoolExperiment("capacitor-charge", parameters, time, history);
function sample(timeSeconds: number, capacitorHistory = initial(), p = parameters, id = `${capacitorHistory.runId}:${capacitorHistory.segments.length}:${timeSeconds}`) {
  return { id, timeSeconds, capacitorHistory, parameters: p, metrics: simulateHighSchoolExperiment("capacitor-charge", p, timeSeconds, capacitorHistory).metrics.map((metric) => ({ ...metric })) };
}

describe("piecewise ideal RC model", () => {
  it("exposes the agreed units, default parameters and a 20RC display window", () => {
    expect(defaultHighSchoolParameters("capacitor-charge")).toEqual(parameters);
    expect(capacitorDurationSeconds(parameters)).toBeCloseTo(94, 12);
    const state = simulate().state;
    expect(state.timeConstant).toBeCloseTo(tau, 12);
    expect(state.voltage).toBe(0); expect(state.current).toBeCloseTo(0.0006, 12);
    expect(simulate().capacitor).toEqual({ mode: "charge", segmentIndex: 0 });
  });
  it("matches one-time-constant charging and preserves the 5tau and 20tau tails", () => {
    const one = simulate(initial(), tau).state;
    expect(one.voltage).toBeCloseTo(6 * (1 - Math.exp(-1)), 12);
    expect(one.current).toBeCloseTo(0.0006 / Math.E, 12);
    expect(one.charge).toBeCloseTo(one.voltage! * .00047, 12);
    for (const multiples of [5, 20]) {
      const state = simulate(initial(), tau * multiples).state;
      expect(state.voltage).toBeLessThan(parameters.emf);
      expect(state.current).toBeGreaterThan(0);
      expect(6 - state.voltage!).toBeCloseTo(6 * Math.exp(-multiples), 12);
    }
  });
  it("keeps U/Q/W continuous while charge, open, discharge and charge currents jump", () => {
    let history = initial(); let previousMode: CapacitorMode = "charge";
    for (const [time, next] of [[2, "open"], [4, "discharge"], [6, "charge"]] as const) {
      const before = simulate(history, time).state;
      history = switchCapacitorMode(parameters, history, time, next);
      const after = simulate(history, time).state;
      for (const key of ["voltage", "charge", "storedEnergy", "sourceWork", "dissipatedEnergy"]) expect(after[key]).toBeCloseTo(before[key]!, 14);
      expect(after.current).not.toBe(before.current);
      if (next === "open") expect(after.current).toBe(0);
      if (next === "discharge") expect(after.current).toBeLessThan(0);
      if (next === "charge") expect(after.current).toBeGreaterThan(0);
      expect(simulate(history, time).capacitor!.mode).not.toBe(previousMode);
      previousMode = next;
    }
  });
  it("open keeps voltage and stored energy, discharge decays the inherited U0", () => {
    const open = switchCapacitorMode(parameters, initial(), 2, "open");
    const opening = simulate(open, 2).state; const held = simulate(open, 12).state;
    for (const key of ["voltage", "charge", "storedEnergy", "dissipatedEnergy", "sourceWork"]) expect(held[key]).toBe(opening[key]);
    expect(held.resistorPower).toBe(0);
    const discharge = switchCapacitorMode(parameters, open, 12, "discharge");
    const state = simulate(discharge, 12 + tau).state;
    expect(state.voltage).toBeCloseTo(held.voltage! / Math.E, 12);
    expect(state.current).toBeCloseTo(-state.voltage! / 10000, 12);
    expect(state.segmentInitialVoltage).toBe(held.voltage);
    expect(state.sourceWork).toBe(held.sourceWork);
  });
  it("conserves the complete energy ledger through repeated switches and parameter corners", () => {
    for (const resistanceKOhm of [1, 10]) for (const capacitanceMicrofarads of [100, 1000]) for (const emf of [1, 12]) {
      const p = { resistanceKOhm, capacitanceMicrofarads, emf }; const localTau = capacitorDurationSeconds(p) / 20;
      let history = createCapacitorHistory("corners");
      for (const [n, next] of [[1, "open"], [2, "discharge"], [4, "charge"], [7, "discharge"]] as const) history = switchCapacitorMode(p, history, n * localTau, next);
      const state = calculateCapacitorState(p, history, 9 * localTau);
      expect(state.sourceWork).toBeCloseTo(state.storedEnergy + state.dissipatedEnergy, 13);
      expect(state.dissipatedEnergy).toBeGreaterThanOrEqual(0);
      expect(state.voltage).toBeGreaterThanOrEqual(0); expect(state.voltage).toBeLessThan(emf);
    }
  });
  it("accounts for half of zero-initial asymptotic source work in storage and half in heat", () => {
    const state = simulate(initial(), capacitorDurationSeconds(parameters)).state;
    const limit = .00047 * 6 ** 2;
    expect(state.sourceWork).toBeCloseTo(limit, 9);
    expect(state.storedEnergy).toBeCloseTo(limit / 2, 9);
    expect(state.dissipatedEnergy).toBeCloseTo(limit / 2, 9);
    expect(state.sourceWork).toBeCloseTo(state.storedEnergy! + state.dissipatedEnergy!, 14);
  });
  it("resolves very small elapsed times without cancellation or fictitious initial energy", () => {
    const state = calculateCapacitorState(parameters, initial(), 1e-12);
    expect(state.voltage).toBeGreaterThan(0);
    expect(state.voltage).toBeCloseTo(6e-12 / tau, 20);
    expect(state.sourceWork).toBeCloseTo(state.storedEnergy + state.dissipatedEnergy, 25);
  });
  it("replays histories independently rather than using the numeric-parameter-only cache", () => {
    const charge = simulate(initial(), 4);
    const discharge = simulate(switchCapacitorMode(parameters, initial(), 2, "discharge"), 4);
    expect(charge.state.voltage).toBeGreaterThan(discharge.state.voltage!);
    expect(charge.state.current).toBeGreaterThan(0); expect(discharge.state.current).toBeLessThan(0);
    expect(simulate(initial(), 4)).toEqual(charge);
  });
  it("draws only elapsed history, retaining both switch current limits at identical times", () => {
    const history = switchCapacitorMode(parameters, initial(), 2, "discharge");
    const simulation = simulate(history, 3);
    const currents = simulation.series.find((series) => series.key === "current")!.points.filter((point) => point.x === 2);
    expect(currents).toHaveLength(2); expect(currents[0]!.y).toBeGreaterThan(0); expect(currents[1]!.y).toBeLessThan(0);
    const voltages = simulation.series.find((series) => series.key === "voltage")!.points.filter((point) => point.x === 2);
    expect(voltages[0]!.y).toBe(voltages[1]!.y);
    for (const series of simulation.series) { expect(series.points.at(-1)!.x).toBe(3); expect(series.points.every((point) => point.x <= 3)).toBe(true); }
  });
  it("draws a right-limit point even when switching exactly at the observed endpoint", () => {
    const result = simulate(switchCapacitorMode(parameters, initial(), 2, "open"), 2);
    expect(result.series.find((series) => series.key === "current")!.points.filter((point) => point.x === 2).map((point) => point.y)).toEqual([simulate(initial(), 2).state.current, 0]);
  });
});

describe("replayable history and switching boundaries", () => {
  it("normalizes zero-duration UI switches without mutating an existing snapshot", () => {
    const history = initial(); const copy = JSON.stringify(history);
    expect(switchCapacitorMode(parameters, history, 0, "open").segments).toEqual([{ startTimeSeconds: 0, mode: "open" }]);
    const switched = switchCapacitorMode(parameters, history, 1, "open");
    expect(switchCapacitorMode(parameters, switched, 1, "charge")).toEqual(history);
    expect(switchCapacitorMode(parameters, switched, 1, "discharge").segments).toEqual([{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 1, mode: "discharge" }]);
    expect(switchCapacitorMode(parameters, history, 2, "charge")).toEqual(history);
    expect(JSON.stringify(history)).toBe(copy);
  });
  it("does not truncate history on the segment limit and still permits same-time correction", () => {
    let history = initial();
    for (let i = 1; i < 32; i++) history = switchCapacitorMode(parameters, history, i, i % 2 ? "open" : "charge");
    const original = JSON.stringify(history);
    expect(() => switchCapacitorMode(parameters, history, 32, "charge")).toThrow(/32/);
    expect(JSON.stringify(history)).toBe(original);
    expect(switchCapacitorMode(parameters, history, 31, "charge").segments).toHaveLength(31);
  });
  it.each([
    undefined, null, [], { ...initial(), runId: "" }, { ...initial(), runId: "two words" }, { ...initial(), runId: "a".repeat(101) },
    { ...initial(), kind: "v2" }, { ...initial(), initialVoltage: 6 }, { ...initial(), extra: 1 }, { ...initial(), segments: [] },
    { ...initial(), segments: [{ startTimeSeconds: 0, mode: "invalid" }] },
    { ...initial(), segments: [{ startTimeSeconds: 0, mode: "charge", initialVoltage: 999 }] },
    { ...initial(), segments: [{ startTimeSeconds: .1, mode: "charge" }] },
    { ...initial(), segments: [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 0, mode: "open" }] },
    { ...initial(), segments: [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 1, mode: "charge" }] },
    { ...initial(), segments: [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: 3, mode: "open" }] },
    { ...initial(), segments: [{ startTimeSeconds: 0, mode: "charge" }, { startTimeSeconds: NaN, mode: "open" }] }
  ])("rejects incomplete, forged, future or noncanonical history %#", (history) => {
    expect(() => validateCapacitorHistory(history, 2, 94)).toThrow(RangeError);
    expect(() => simulateHighSchoolExperiment("capacitor-charge", parameters, 2, history as CapacitorHistory)).toThrow(RangeError);
  });
  it("rejects out-of-window times, invalid parameters and foreign histories", () => {
    for (const time of [-1, NaN, Infinity, 100]) expect(() => simulate(initial(), time)).toThrow(RangeError);
    for (const overrides of [{ resistanceKOhm: 0 }, { capacitanceMicrofarads: 0 }, { emf: 0 }, { time: 1 }]) expect(() => simulateHighSchoolExperiment("capacitor-charge", { ...parameters, ...overrides } as Record<string, number>, 0, initial())).toThrow(RangeError);
    expect(() => simulateHighSchoolExperiment("pendulum", {}, 0, initial())).toThrow(RangeError);
    expect(() => switchCapacitorMode(parameters, switchCapacitorMode(parameters, initial(), 2, "open"), 1, "charge")).toThrow(RangeError);
  });
  it("returns a detached validation snapshot and never mutates it during simulation", () => {
    const history = initial(); const result = validateCapacitorHistory(history, 2, 94); result.segments[0]!.mode = "open";
    expect(history.segments[0]!.mode).toBe("charge");
    const before = JSON.stringify(history); simulate(history, 2); expect(JSON.stringify(history)).toBe(before);
  });
});

describe("saved RC model analysis", () => {
  it("estimates tau from saved charging and discharging voltages in separate groups", () => {
    const history = switchCapacitorMode(parameters, initial(), 2, "discharge");
    const result = analyzeHighSchoolMeasurements("capacitor-charge", [0, .5, 1].map((time) => sample(time)).concat([3, 4, 5].map((time) => sample(time, history))));
    expect(result.acceptedCount).toBe(6); expect(result.groups).toHaveLength(2);
    for (const group of result.groups) { expect(group.status).toBe("ready"); expect(group.estimates.find((estimate) => estimate.key === "timeConstant")!.value).toBeCloseTo(tau, 10); expect(group.fit!.slope).toBeCloseTo(-1 / tau, 12); }
    expect(result.groups[1]!.points.map((point) => point.x)).toEqual([1, 2, 3]);
  });
  it("keeps run IDs, full switching prefixes, parameters and unsupported states separate", () => {
    const open = switchCapacitorMode(parameters, initial(), 2, "open");
    const firstPath = switchCapacitorMode(parameters, initial(), 3, "discharge");
    const secondPath = switchCapacitorMode(parameters, open, 3, "discharge");
    const records = [sample(0), sample(1, createCapacitorHistory("run-b")), sample(1, initial(), { ...parameters, emf: 5 }), sample(4, firstPath), sample(4, secondPath, parameters, "other-prefix")];
    const result = analyzeHighSchoolMeasurements("capacitor-charge", records);
    expect(result.groups).toHaveLength(5); expect(result.groups.every((group) => group.fit === null)).toBe(true);
  });
  it("uses saved voltages rather than replacing them with the nominal model", () => {
    const records = [0, 1, 2].map((time) => { const record = sample(time); record.metrics.find((metric) => metric.key === "voltage")!.value = 6 * (1 - Math.exp(-time / 2)); return record; });
    const group = analyzeHighSchoolMeasurements("capacitor-charge", records).groups[0]!;
    expect(group.status).toBe("ready"); expect(group.estimates[0]!.value).toBeCloseTo(2, 12);
  });
  it("does not turn open or equilibrium data into a false time constant", () => {
    for (const history of [createCapacitorHistory("open", "open"), createCapacitorHistory("empty-discharge", "discharge")]) {
      const group = analyzeHighSchoolMeasurements("capacitor-charge", [0, 1, 2].map((time) => sample(time, history))).groups[0]!;
      expect(group.status).toBe("unsupported"); expect(group.fit).toBeNull(); expect(group.points).toEqual([]); expect(group.estimates).toEqual([]);
    }
  });
  it("requires three distinct times and rejects an increasing log difference", () => {
    const repeated = [sample(0), sample(1), sample(1, initial(), parameters, "repeat")];
    expect(analyzeHighSchoolMeasurements("capacitor-charge", repeated).groups[0]!.fit).toBeNull();
    const increasing = [0, 1, 2].map((time) => { const record = sample(time); record.metrics.find((metric) => metric.key === "voltage")!.value = 6 - Math.exp(time / 2); return record; });
    const group = analyzeHighSchoolMeasurements("capacitor-charge", increasing).groups[0]!;
    expect(group.fit).toBeNull(); expect(group.reasons.join()).toContain("斜率须为负");
  });
  it("excludes missing history, future history, missing units and nonfinite voltage", () => {
    const missing = { ...sample(1), capacitorHistory: undefined };
    const future = { ...sample(1), id: "future", capacitorHistory: switchCapacitorMode(parameters, initial(), 2, "open") };
    const unit = sample(1, initial(), parameters, "unit"); unit.metrics.find((metric) => metric.key === "voltage")!.unit = "mV";
    const bad = sample(1, initial(), parameters, "nan"); bad.metrics.find((metric) => metric.key === "voltage")!.value = NaN;
    const result = analyzeHighSchoolMeasurements("capacitor-charge", [missing, future, unit, bad]);
    expect(result.acceptedCount).toBe(0); expect(result.excluded).toHaveLength(4);
  });
});
