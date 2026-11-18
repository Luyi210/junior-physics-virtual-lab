import { calculateElectromagnetExperiment, calculateElectromagnetPolarity } from "@physics-lab/physics";

export const ELECTROMAGNET_OBSERVATION_SECONDS = 60;
export interface ElectromagnetRunState {
  turns: number; current: number; hasIronCore: boolean; currentDirection: "forward" | "reverse";
  assembled: boolean; powered: boolean; poweredSeconds: number; tested: boolean;
  stopReason: "observation-end" | "overheat" | null;
  revision: number;
}
export type ElectromagnetRunAction =
  | { type: "toggle" } | { type: "pause" } | { type: "pickup" } | { type: "assemble" } | { type: "reset" }
  | { type: "turns"; value: number }
  | { type: "current"; value: number }
  | { type: "core"; value: boolean }
  | { type: "direction"; value: "forward" | "reverse" }
  | { type: "tick"; seconds: number; revision: number };

export function createElectromagnetRun(): ElectromagnetRunState {
  return { turns: 100, current: .5, hasIronCore: true, currentDirection: "forward", assembled: false,
    powered: false, poweredSeconds: 0, tested: false, stopReason: null, revision: 0 };
}

/** One reducer owns power and time. Pauses retain accumulated on-time; this
 * teaching model has no passive cooling. Saved observations live outside it. */
export function electromagnetRunReducer(state: ElectromagnetRunState, action: ElectromagnetRunAction): ElectromagnetRunState {
  const reset = (changes: Partial<ElectromagnetRunState> = {}): ElectromagnetRunState => ({ ...state, powered: false, poweredSeconds: 0, tested: false, stopReason: null, revision: state.revision + 1, ...changes });
  if (action.type === "reset") return reset();
  if (action.type === "assemble") return state.assembled ? state : { ...state, assembled: true };
  if (action.type === "turns" || action.type === "current" || action.type === "core" || action.type === "direction") {
    // Also reject a late control callback after a new run has started.
    if (state.powered) return state;
    if (action.type === "turns") return action.value !== state.turns && [50, 100, 200].includes(action.value) ? reset({ turns: action.value, assembled: false }) : state;
    if (action.type === "current") return action.value !== state.current && [.5, 1, 2].includes(action.value) ? reset({ current: action.value }) : state;
    if (action.type === "core") return action.value === state.hasIronCore ? state : reset({ hasIronCore: action.value, assembled: false });
    if (action.value === state.currentDirection) return state;
    return { ...state, currentDirection: action.value, tested: false, revision: state.revision + 1 };
  }
  if (action.type === "toggle") {
    if (!state.assembled || state.stopReason) return state;
    return { ...state, powered: !state.powered, tested: state.powered ? state.tested : false, revision: state.revision + 1 };
  }
  if (action.type === "pause" || action.type === "pickup") {
    if (!state.powered) return state;
    return { ...state, powered: false, tested: action.type === "pickup" || state.tested, revision: state.revision + 1 };
  }
  if (!state.powered || action.revision !== state.revision || !Number.isFinite(action.seconds) || action.seconds <= 0) return state;
  const poweredSeconds = Math.min(ELECTROMAGNET_OBSERVATION_SECONDS, Number((state.poweredSeconds + action.seconds).toFixed(10)));
  const result = calculateElectromagnetExperiment(state.turns, state.current, state.hasIronCore, poweredSeconds);
  const stopReason = result.overheatRisk ? "overheat" : poweredSeconds >= ELECTROMAGNET_OBSERVATION_SECONDS ? "observation-end" : null;
  return { ...state, poweredSeconds, powered: stopReason === null, stopReason, revision: state.revision + (stopReason ? 1 : 0) };
}

/** CSS needle's red north tip points right before rotation (screen +x). */
export function electromagnetCompassOrientation(direction: "forward" | "reverse") {
  const { compassNorthDirection } = calculateElectromagnetPolarity(direction);
  return { compassNorthDirection, rotationDegrees: compassNorthDirection === "right" ? 0 : 180,
    north: { x: compassNorthDirection === "right" ? 1 : -1, y: 0 } };
}
