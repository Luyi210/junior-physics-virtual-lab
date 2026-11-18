import { useCallback, useEffect, useReducer } from "react";
import { createThermalRunClock, thermalRunClockReducer } from "./thermalRunClock";

export function useThermalRunClock(limitSeconds: number, stepSeconds: number, intervalMilliseconds: number) {
  const [state, dispatch] = useReducer(thermalRunClockReducer, undefined, createThermalRunClock);
  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(() => dispatch({ type: "tick", limitSeconds, stepSeconds, revision: state.revision }), intervalMilliseconds);
    return () => window.clearInterval(timer);
  }, [state.running, state.revision, limitSeconds, stepSeconds, intervalMilliseconds]);
  const toggle = useCallback(() => dispatch({ type: "toggle", limitSeconds }), [limitSeconds]);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  return { ...state, complete: state.elapsedSeconds >= limitSeconds, toggle, reset };
}
