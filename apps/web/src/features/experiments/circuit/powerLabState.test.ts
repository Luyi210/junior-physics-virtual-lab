import { describe, expect, it } from "vitest";
import { createPowerLabState, powerLabInstrumentSnapshot, powerLabLiveState, powerLabReducer, savablePowerMeasurement, type PowerLabAction, type PowerLabState } from "./powerLabState";

function wiredState(duration = 10) {
  let state = powerLabReducer(createPowerLabState(), { type: "duration", value: duration });
  for (const instrument of ["ammeter", "voltmeter", "energy"] as const) state = powerLabReducer(state, { type: "connection", instrument });
  return state;
}
function runFor(seconds: number, duration = 10) {
  return powerLabReducer(powerLabReducer(wiredState(duration), { type: "toggle" }), { type: "tick", seconds });
}
function field(snapshot: ReturnType<typeof powerLabInstrumentSnapshot>, id: string) {
  return [...snapshot.readings, ...snapshot.derived].find((entry) => entry.id === id)?.value;
}

describe("electric-power live meters and completed measurement latch", () => {
  it("shows zero load readings before closing the switch despite a nonzero source and predicted power", () => {
    const state = wiredState();
    const live = powerLabLiveState(state);
    expect(state.configuration.voltage).toBe(6);
    expect(live.prediction.actualPower).toBe(3);
    expect(live).toMatchObject({ conducting: false, ammeter: 0, voltmeter: 0, wattmeter: 0, energyMeter: 0 });
    expect(savablePowerMeasurement(state)).toBeNull();
  });

  it("uses missing readings only for disconnected meters and refuses to run an incomplete setup", () => {
    const empty = createPowerLabState();
    expect(powerLabLiveState(empty)).toMatchObject({ ammeter: null, voltmeter: null, wattmeter: null, energyMeter: null });
    const withAmmeter = powerLabReducer(empty, { type: "connection", instrument: "ammeter" });
    expect(powerLabLiveState(withAmmeter)).toMatchObject({ ammeter: 0, voltmeter: null, wattmeter: null });
    expect(powerLabReducer(withAmmeter, { type: "toggle" })).toBe(withAmmeter);
  });

  it("accumulates 12 J over 4 s, then freezes energy and zeros live I/P when manually disconnected", () => {
    const running = runFor(4);
    expect(powerLabLiveState(running)).toMatchObject({ current: .5, power: 3, loadVoltage: 6 });
    expect(running).toMatchObject({ phase: "running", elapsed: 4, energyJoules: 12 });
    const paused = powerLabReducer(running, { type: "toggle" });
    expect(powerLabLiveState(paused)).toMatchObject({ current: 0, power: 0, loadVoltage: 0 });
    expect(paused).toMatchObject({ phase: "paused", elapsed: 4, energyJoules: 12 });
    expect(powerLabReducer(paused, { type: "tick", seconds: 20 })).toBe(paused);
    expect(savablePowerMeasurement(paused)).toBeNull();
  });

  it("resumes the same interrupted run without losing its accumulated energy", () => {
    const paused = powerLabReducer(runFor(4), { type: "toggle" });
    const resumed = powerLabReducer(paused, { type: "toggle" });
    const next = powerLabReducer(resumed, { type: "tick", seconds: 2 });
    expect(next).toMatchObject({ phase: "running", elapsed: 6, energyJoules: 18 });
    expect(next.energyKilowattHours).toBeCloseTo(18 / 3_600_000, 12);
    expect(powerLabLiveState(next)).toMatchObject({ current: .5, power: 3 });
  });

  it("automatically opens at 10 s while latching the independent 6 V/.5 A/3 W/30 J measurement", () => {
    const completed = runFor(10);
    expect(completed.phase).toBe("completed");
    expect(powerLabLiveState(completed)).toMatchObject({ conducting: false, current: 0, power: 0, loadVoltage: 0, energyMeter: 30 });
    expect(savablePowerMeasurement(completed)).toMatchObject({ appliance: "小灯泡", voltage: 6, current: .5, power: 3, seconds: 10, energy: 30 });
    expect(powerLabReducer(completed, { type: "tick", seconds: 2 })).toBe(completed);
  });

  it("clamps the final integration interval instead of charging energy past the selected duration", () => {
    const state = powerLabReducer(runFor(9), { type: "tick", seconds: 2 });
    expect(state).toMatchObject({ elapsed: 10, energyJoules: 30 });
    expect(savablePowerMeasurement(state)?.seconds).toBe(10);
  });

  it("locks out 7.5 V and never creates a working reading or completed snapshot", () => {
    const unsafe = powerLabReducer(wiredState(), { type: "voltage", value: 7.5 });
    expect(powerLabLiveState(unsafe)).toMatchObject({ unsafe: true, current: 0, power: 0, loadVoltage: 0 });
    expect(powerLabReducer(unsafe, { type: "toggle" })).toBe(unsafe);
    expect(powerLabReducer(unsafe, { type: "tick", seconds: 10 })).toBe(unsafe);
    expect(savablePowerMeasurement(unsafe)).toBeNull();
  });

  const changes: PowerLabAction[] = [
    { type: "voltage", value: 3 }, { type: "appliance", key: "motor" },
    { type: "duration", value: 30 }, { type: "connection", instrument: "voltmeter" }
  ];
  for (const action of changes) {
    it(`invalidates an old completion after ${action.type} changes without mutating the captured old measurement`, () => {
      const completed = runFor(10);
      const oldMeasurement = savablePowerMeasurement(completed)!;
      const changed = powerLabReducer(completed, action);
      expect(changed).toMatchObject({ phase: "idle", elapsed: 0, energyJoules: 0, completedMeasurement: null });
      expect(savablePowerMeasurement(changed)).toBeNull();
      expect(oldMeasurement).toMatchObject({ voltage: 6, current: .5, power: 3, seconds: 10, energy: 30, configuration: { applianceKey: "lamp", voltage: 6, duration: 10, connected: ["ammeter", "voltmeter", "energy"] } });
    });
  }

  it("clears the completion latch and energy immediately when starting another run", () => {
    const restarted = powerLabReducer(runFor(10), { type: "toggle" });
    expect(restarted).toMatchObject({ phase: "running", elapsed: 0, energyJoules: 0, completedMeasurement: null });
    expect(savablePowerMeasurement(restarted)).toBeNull();
    expect(powerLabLiveState(restarted)).toMatchObject({ current: .5, power: 3 });
  });

  it("defensively refuses a mismatched completion even if a caller bypassed the reducer", () => {
    const completed = runFor(10);
    const stale: PowerLabState = { ...completed, configuration: { ...completed.configuration, voltage: 3 } };
    expect(savablePowerMeasurement(stale)).toBeNull();
  });
});

describe("electric-power assistant telemetry", () => {
  it("publishes current zeros and frozen energy while a partial run is paused", () => {
    const snapshot = powerLabInstrumentSnapshot(powerLabReducer(runFor(4), { type: "toggle" }));
    expect(field(snapshot, "U")).toBe(0);
    expect(field(snapshot, "I")).toBe(0);
    expect(field(snapshot, "P")).toBe(0);
    expect(field(snapshot, "W")).toBe(12);
    expect(field(snapshot, "elapsed")).toBe(4);
    expect(field(snapshot, "measurement-ready")).toBe(false);
    expect(field(snapshot, "completed-P")).toBeNull();
  });

  it("keeps real-time and latched values distinct after automatic completion", () => {
    const snapshot = powerLabInstrumentSnapshot(runFor(10));
    expect(field(snapshot, "I")).toBe(0);
    expect(field(snapshot, "P")).toBe(0);
    expect(field(snapshot, "W")).toBe(30);
    expect(field(snapshot, "completed-U")).toBe(6);
    expect(field(snapshot, "completed-I")).toBe(.5);
    expect(field(snapshot, "completed-P")).toBe(3);
    expect(field(snapshot, "completed-t")).toBe(10);
    expect(field(snapshot, "completed-W")).toBe(30);
  });

  it("removes prior completed readings after changing conditions or tripping protection", () => {
    const snapshot = powerLabInstrumentSnapshot(powerLabReducer(runFor(10), { type: "voltage", value: 7.5 }));
    expect(field(snapshot, "I")).toBe(0);
    expect(field(snapshot, "P")).toBe(0);
    expect(field(snapshot, "completed-P")).toBeNull();
    expect(field(snapshot, "measurement-ready")).toBe(false);
    expect(field(snapshot, "state")).toContain("锁定");
  });
});
