import { calculateTwoLoadCircuit, type CircuitTopology } from "@physics-lab/physics";

export interface CircuitConditions {
  topology: CircuitTopology;
  voltage: number;
  r1: number;
  r2: number;
}

export interface CircuitOperatingSetup extends CircuitConditions {
  closed: boolean;
  fullyWired: boolean;
  lamp1Connected: boolean;
  lamp2Connected: boolean;
  shortInstalled: boolean;
  fuseTripped: boolean;
}

export interface CircuitObservationSnapshot extends Readonly<CircuitOperatingSetup> {
  readonly totalCurrent: number;
  readonly branchCurrents: readonly [number, number];
  readonly loadVoltages: readonly [number, number];
  readonly energized: boolean;
}

export interface CircuitFaultEvidence {
  readonly id: number;
  readonly disconnectedLamp: 1 | 2;
  readonly before: CircuitObservationSnapshot;
  readonly after: CircuitObservationSnapshot;
}

export function sameCircuitConditions(a: CircuitConditions, b: CircuitConditions) {
  return a.topology === b.topology && a.voltage === b.voltage && a.r1 === b.r1 && a.r2 === b.r2;
}

function snapshot(setup: CircuitOperatingSetup): CircuitObservationSnapshot {
  const model = calculateTwoLoadCircuit(setup.topology, setup.voltage, setup.r1, setup.r2,
    setup.closed && setup.fullyWired && !setup.shortInstalled && !setup.fuseTripped, setup.lamp1Connected, setup.lamp2Connected);
  return Object.freeze({ topology: setup.topology, voltage: setup.voltage, r1: setup.r1, r2: setup.r2,
    closed: setup.closed, fullyWired: setup.fullyWired, lamp1Connected: setup.lamp1Connected, lamp2Connected: setup.lamp2Connected,
    shortInstalled: setup.shortInstalled, fuseTripped: setup.fuseTripped, totalCurrent: model.totalCurrent,
    branchCurrents: Object.freeze([...model.branchCurrents]) as readonly [number, number],
    loadVoltages: Object.freeze([...model.loadVoltages]) as readonly [number, number], energized: model.energized });
}

/** Only a single-lamp disconnection from a normal two-lamp circuit can establish this observation. */
export function createCircuitFaultEvidence(id: number, beforeSetup: CircuitOperatingSetup, afterSetup: CircuitOperatingSetup, disconnectedLamp: 1 | 2): CircuitFaultEvidence | null {
  if (!Number.isFinite(id) || (disconnectedLamp !== 1 && disconnectedLamp !== 2)
    || !sameCircuitConditions(beforeSetup, afterSetup) || beforeSetup.voltage <= 0) return null;
  if ([beforeSetup, afterSetup].some((setup) => !setup.closed || !setup.fullyWired || setup.shortInstalled || setup.fuseTripped)) return null;
  if (!beforeSetup.lamp1Connected || !beforeSetup.lamp2Connected) return null;
  if (disconnectedLamp === 1 ? afterSetup.lamp1Connected || !afterSetup.lamp2Connected : !afterSetup.lamp1Connected || afterSetup.lamp2Connected) return null;
  try {
    const before = snapshot(beforeSetup); const after = snapshot(afterSetup);
    if (!before.energized || before.totalCurrent <= 0 || before.branchCurrents.some((current) => current <= 0)) return null;
    const removedIndex = disconnectedLamp - 1;
    const otherIndex = disconnectedLamp === 1 ? 1 : 0;
    const resultMatches = before.topology === "series"
      ? !after.energized && after.totalCurrent === 0 && after.branchCurrents.every((current) => current === 0)
      : after.energized && after.branchCurrents[removedIndex] === 0 && after.branchCurrents[otherIndex] > 0
        && Math.abs(after.branchCurrents[otherIndex] - before.branchCurrents[otherIndex]) <= 1e-12
        && Math.abs(after.totalCurrent - after.branchCurrents[otherIndex]) <= 1e-12;
    return resultMatches ? Object.freeze({ id, disconnectedLamp, before, after }) : null;
  } catch { return null; }
}

/** Parameter changes invalidate consumption of old evidence without rewriting its saved readings. */
export function circuitFaultMatchesConditions(evidence: CircuitFaultEvidence | undefined, conditions: CircuitConditions) {
  return Boolean(evidence && sameCircuitConditions(evidence.before, conditions) && sameCircuitConditions(evidence.after, conditions));
}

export function circuitFaultEvidenceText(evidence: CircuitFaultEvidence) {
  const { before, after, disconnectedLamp } = evidence;
  const current = (index: 0 | 1) => `${before.branchCurrents[index].toFixed(2)}→${after.branchCurrents[index].toFixed(2)} A`;
  const conclusion = before.topology === "series" ? "两灯均由亮变灭" : `L${disconnectedLamp === 1 ? 2 : 1} 的电流不变，继续发光`;
  return `已保存观察：${before.voltage.toFixed(1)} V，R₁=${before.r1} Ω、R₂=${before.r2} Ω；旋松 L${disconnectedLamp} 后，I₁ ${current(0)}、I₂ ${current(1)}；${conclusion}。`;
}
