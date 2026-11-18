import { describe, expect, it } from "vitest";
import { calculateElectromagnetExperiment, calculateElectromagnetPolarity } from "@physics-lab/physics";
import { createElectromagnetRun, electromagnetRunReducer as reduce, electromagnetCompassOrientation, type ElectromagnetRunState } from "./electromagnetRun";

function start(current = .5) {
  let state = reduce(createElectromagnetRun(), { type: "current", value: current });
  state = reduce(state, { type: "assemble" }); return reduce(state, { type: "toggle" });
}
const tick = (state: ElectromagnetRunState, seconds = .2, revision = state.revision) => reduce(state, { type: "tick", seconds, revision });

describe("electromagnet observation lifecycle", () => {
  it("ends the low-current observation at exactly 60 s without falsely calling it overheating", () => {
    let state = start();
    for (let index = 0; index < 300; index++) state = tick(state);
    expect(state).toMatchObject({ powered: false, poweredSeconds: 60, stopReason: "observation-end" });
    expect(calculateElectromagnetExperiment(100, .5, true, state.poweredSeconds)).toMatchObject({ overheatRisk: false });
    expect(calculateElectromagnetExperiment(100, .5, true, state.poweredSeconds).temperatureRise).toBeCloseTo(2.7);
    expect(tick(state)).toBe(state); expect(reduce(state, { type: "toggle" })).toBe(state);
    expect(reduce(state, { type: "current", value: .5 })).toBe(state);
    expect(reduce(state, { type: "turns", value: 100 })).toBe(state);
    expect(reduce(state, { type: "core", value: true })).toBe(state);
    const reversed = reduce(state, { type: "direction", value: "reverse" });
    expect(reduce(reversed, { type: "toggle" })).toBe(reversed);
    const reset = reduce(reversed, { type: "reset" });
    expect(tick(reduce(reset, { type: "toggle" }))).toMatchObject({ powered: true, poweredSeconds: .2, stopReason: null });
  });

  it.each([[1, 44.6], [2, 11.2]])("protects %s A before the 60 s observation endpoint", (current, seconds) => {
    let state = start(current);
    for (let index = 0; index < 300; index++) state = tick(state);
    expect(state).toMatchObject({ powered: false, poweredSeconds: seconds, stopReason: "overheat" });
    expect(calculateElectromagnetExperiment(100, current, true, seconds).overheatRisk).toBe(true);
    expect(calculateElectromagnetExperiment(100, current, true, seconds - .2).overheatRisk).toBe(false);
  });

  it("retains accumulated on-time across pause and rejects old ticks after pause, resume and reset", () => {
    const running = tick(start(), 10), paused = reduce(running, { type: "pause" });
    expect(tick(paused, .2, running.revision)).toBe(paused);
    const resumed = reduce(paused, { type: "toggle" });
    expect(tick(resumed, .2, running.revision)).toBe(resumed);
    expect(tick(resumed)).toMatchObject({ poweredSeconds: 10.2 });
    const restarted = reduce(reduce(resumed, { type: "reset" }), { type: "toggle" });
    expect(tick(restarted, .2, resumed.revision)).toBe(restarted);
    expect(restarted.poweredSeconds).toBe(0);
  });

  it("stops after a pickup and preserves its result until a new run or explicit reset", () => {
    const measured = reduce(tick(start(), 3), { type: "pickup" });
    expect(measured).toMatchObject({ tested: true, powered: false, poweredSeconds: 3 });
    expect(tick(measured)).toBe(measured);
    expect(reduce(measured, { type: "pause" })).toBe(measured);
    expect(reduce(measured, { type: "toggle" })).toMatchObject({ tested: false, powered: true, poweredSeconds: 3 });
    expect(reduce(measured, { type: "reset" })).toMatchObject({ tested: false, poweredSeconds: 0 });
  });

  it("uses a fresh generation for condition changes and refuses live configuration callbacks", () => {
    const running = start();
    expect(reduce(running, { type: "current", value: 2 })).toBe(running);
    const changed = reduce(reduce(running, { type: "pause" }), { type: "turns", value: 200 });
    expect(changed).toMatchObject({ turns: 200, poweredSeconds: 0, assembled: false, powered: false });
    expect(tick(changed, 20, running.revision)).toBe(changed);
    for (const seconds of [NaN, Infinity, 0, -1]) expect(tick(running, seconds)).toBe(running);
  });
});

describe("electromagnet compass screen vectors", () => {
  it.each(["forward", "reverse"] as const)("aligns the red north tip with the model for %s wiring", (direction) => {
    const orientation = electromagnetCompassOrientation(direction);
    const radians = orientation.rotationDegrees * Math.PI / 180;
    // Starting CSS red arrow is (1,0), not (0,-1).
    expect(Math.cos(radians)).toBeCloseTo(orientation.north.x, 12);
    expect(Math.sin(radians)).toBeCloseTo(orientation.north.y, 12);
    expect(orientation.compassNorthDirection).toBe(calculateElectromagnetPolarity(direction).compassNorthDirection);
    expect(orientation.north.x).toBe(direction === "forward" ? 1 : -1);
  });
});
