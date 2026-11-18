import { describe, expect, it } from "vitest";
import { circuitFaultEvidenceText, circuitFaultMatchesConditions, createCircuitFaultEvidence, type CircuitOperatingSetup } from "./circuitFaultEvidence";

function setup(topology: "series" | "parallel" = "parallel", changes: Partial<CircuitOperatingSetup> = {}): CircuitOperatingSetup {
  return { topology, voltage: 9, r1: 20, r2: 10, closed: true, fullyWired: true, lamp1Connected: true, lamp2Connected: true, shortInstalled: false, fuseTripped: false, ...changes };
}
function disconnect(before: CircuitOperatingSetup, lamp: 1 | 2) {
  return { ...before, lamp1Connected: lamp === 1 ? false : before.lamp1Connected, lamp2Connected: lamp === 2 ? false : before.lamp2Connected };
}

describe("circuit lamp-disconnection evidence", () => {
  it.each([1, 2] as const)("captures a normal series circuit becoming fully dark when lamp %s opens", (lamp) => {
    const before = setup("series");
    const observation = createCircuitFaultEvidence(1, before, disconnect(before, lamp), lamp)!;
    expect(observation).not.toBeNull();
    expect(observation.before).toMatchObject({ topology: "series", voltage: 9, r1: 20, r2: 10, closed: true, fullyWired: true,
      lamp1Connected: true, lamp2Connected: true, totalCurrent: .3, branchCurrents: [.3, .3], loadVoltages: [6, 3], energized: true });
    expect(observation.after).toMatchObject({ topology: "series", totalCurrent: 0, branchCurrents: [0, 0], loadVoltages: [0, 0], energized: false });
    expect(observation.after.lamp1Connected).toBe(lamp !== 1);
    expect(observation.after.lamp2Connected).toBe(lamp !== 2);
    expect(circuitFaultEvidenceText(observation)).toContain("两灯均由亮变灭");
  });

  it.each([1, 2] as const)("captures the unchanged healthy parallel branch when lamp %s opens", (lamp) => {
    const before = setup();
    const observation = createCircuitFaultEvidence(1, before, disconnect(before, lamp), lamp)!;
    expect(observation.before.branchCurrents).toEqual([.45, .9]);
    expect(observation.before.totalCurrent).toBeCloseTo(1.35, 12);
    expect(observation.before.loadVoltages).toEqual([9, 9]);
    expect(observation.after.branchCurrents).toEqual(lamp === 1 ? [0, .9] : [.45, 0]);
    expect(observation.after.totalCurrent).toBe(lamp === 1 ? .9 : .45);
    expect(observation.after.energized).toBe(true);
    expect(circuitFaultEvidenceText(observation)).toContain(`L${lamp === 1 ? 2 : 1} 的电流不变，继续发光`);
  });

  it.each(["series", "parallel"] as const)("does not record a false observation when the other %s lamp was already disconnected", (topology) => {
    for (const lamp of [1, 2] as const) {
      const before = setup(topology, lamp === 1 ? { lamp2Connected: false } : { lamp1Connected: false });
      expect(createCircuitFaultEvidence(1, before, disconnect(before, lamp), lamp)).toBeNull();
    }
  });

  it("rejects an open main switch, missing wiring, zero voltage, and an active protection fault", () => {
    for (const topology of ["series", "parallel"] as const) {
      for (const changes of [{ closed: false }, { fullyWired: false }, { voltage: 0 }, { shortInstalled: true }, { fuseTripped: true }]) {
        const before = setup(topology, changes);
        expect(createCircuitFaultEvidence(1, before, disconnect(before, 1), 1)).toBeNull();
      }
    }
  });

  it("requires the lamp operation itself, with unchanged supply, components, wiring and switch", () => {
    const before = setup(); const after = disconnect(before, 1);
    for (const changes of [{ voltage: 6 }, { r1: 30 }, { r2: 20 }, { topology: "series" as const }, { closed: false }, { fullyWired: false }, { lamp2Connected: false }, { shortInstalled: true }]) {
      expect(createCircuitFaultEvidence(1, before, { ...after, ...changes }, 1)).toBeNull();
    }
    expect(createCircuitFaultEvidence(1, before, before, 1)).toBeNull();
    expect(createCircuitFaultEvidence(1, before, after, 2)).toBeNull();
    expect(createCircuitFaultEvidence(1, after, before, 1)).toBeNull();
  });

  it("invalidates old conditions and preserves immutable saved readings after controls or topology change", () => {
    const before = setup(); const after = disconnect(before, 1);
    const observation = createCircuitFaultEvidence(1, before, after, 1)!;
    const originalText = circuitFaultEvidenceText(observation);
    expect(circuitFaultMatchesConditions(observation, setup())).toBe(true);
    for (const changes of [{ voltage: 6 }, { r1: 30 }, { r2: 20 }, { topology: "series" as const }]) {
      expect(circuitFaultMatchesConditions(observation, setup("parallel", changes))).toBe(false);
    }
    before.voltage = 12; before.r1 = 5; after.voltage = 12; after.lamp2Connected = false;
    expect(circuitFaultEvidenceText(observation)).toBe(originalText);
    expect(originalText).toContain("9.0 V，R₁=20 Ω、R₂=10 Ω");
    expect(originalText).toContain("I₁ 0.45→0.00 A、I₂ 0.90→0.90 A");
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.before)).toBe(true);
    expect(Object.isFrozen(observation.after.branchCurrents)).toBe(true);
    expect(Object.isFrozen(observation.before.loadVoltages)).toBe(true);
    // Returning to the other topology may reuse its own unchanged historical observation.
    expect(circuitFaultMatchesConditions(observation, setup())).toBe(true);
    expect(circuitFaultMatchesConditions(undefined, setup())).toBe(false);
  });
});
