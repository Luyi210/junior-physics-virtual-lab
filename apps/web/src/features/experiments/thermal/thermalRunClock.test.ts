import { describe, expect, it } from "vitest";
import { createThermalRunClock, thermalRunClockReducer, type ThermalRunClockState } from "./thermalRunClock";

const toggle = (state: ThermalRunClockState, limitSeconds = 150) => thermalRunClockReducer(state, { type: "toggle", limitSeconds });
const tick = (state: ThermalRunClockState, seconds = 1, limitSeconds = 150, revision = state.revision) =>
  thermalRunClockReducer(state, { type: "tick", stepSeconds: seconds, limitSeconds, revision });

describe("thermal experiment run clock", () => {
  it.each([[360, 1.2], [150, 1], [30, 2]])("stops at %s seconds and cannot start a frozen completed run", (limit, step) => {
    let state = toggle(createThermalRunClock(), limit);
    for (let index = 0; index <= Math.ceil(limit / step); index++) state = tick(state, step, limit);
    expect(state).toMatchObject({ elapsedSeconds: limit, running: false });
    expect(toggle(state, limit)).toBe(state);
    expect(tick(state, step, limit)).toBe(state);
    const restarted = toggle(thermalRunClockReducer(state, { type: "reset" }), limit);
    expect(tick(restarted, step, limit)).toMatchObject({ elapsedSeconds: step, running: true });
  });

  it("pauses without advancing the readings and rejects a queued tick from before the pause", () => {
    const running = tick(toggle(createThermalRunClock()), 10);
    const paused = toggle(running);
    expect(tick(paused, 1, 150, running.revision)).toBe(paused);
    const resumed = toggle(paused);
    expect(tick(resumed, 1, 150, running.revision)).toBe(resumed);
    expect(tick(resumed)).toMatchObject({ elapsedSeconds: 11, running: true });
  });

  it("resets time and invalidates the old timer even after a new run has started", () => {
    const previous = tick(toggle(createThermalRunClock(), 120), 60, 120);
    const reset = thermalRunClockReducer(previous, { type: "reset" });
    expect(reset).toMatchObject({ elapsedSeconds: 0, running: false });
    const next = toggle(reset, 30);
    expect(tick(next, 2, 120, previous.revision)).toBe(next);
    expect(tick(next, 32, 30)).toMatchObject({ elapsedSeconds: 30, running: false });
  });

  it("clamps the last fractional step and rejects invalid time increments", () => {
    const state = tick(toggle(createThermalRunClock(), 360), 359.8, 360);
    expect(tick(state, 1.2, 360)).toMatchObject({ elapsedSeconds: 360, running: false });
    for (const seconds of [NaN, Infinity, 0, -1]) expect(tick(state, seconds, 360)).toBe(state);
  });
});
