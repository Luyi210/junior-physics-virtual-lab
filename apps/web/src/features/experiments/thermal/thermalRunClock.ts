export interface ThermalRunClockState {
  elapsedSeconds: number;
  running: boolean;
  revision: number;
}

export type ThermalRunClockAction =
  | { type: "toggle"; limitSeconds: number }
  | { type: "tick"; limitSeconds: number; stepSeconds: number; revision: number }
  | { type: "reset" };

export function createThermalRunClock(): ThermalRunClockState {
  return { elapsedSeconds: 0, running: false, revision: 0 };
}

/** Completion and stopping happen together; an old timer cannot advance a reset or resumed run. */
export function thermalRunClockReducer(state: ThermalRunClockState, action: ThermalRunClockAction): ThermalRunClockState {
  if (action.type === "reset") return { ...createThermalRunClock(), revision: state.revision + 1 };
  if (!Number.isFinite(action.limitSeconds) || action.limitSeconds <= 0) return state;
  if (action.type === "toggle") {
    if (state.elapsedSeconds >= action.limitSeconds) return state;
    return { ...state, running: !state.running, revision: state.revision + 1 };
  }
  if (!state.running || action.revision !== state.revision || !Number.isFinite(action.stepSeconds) || action.stepSeconds <= 0) return state;
  const elapsedSeconds = Math.min(action.limitSeconds, state.elapsedSeconds + action.stepSeconds);
  return { ...state, elapsedSeconds, running: elapsedSeconds < action.limitSeconds };
}
