import { useEffect, useReducer } from "react";
import { createElectromagnetRun, electromagnetRunReducer } from "./electromagnetRun";

export function useElectromagnetRun() {
  const [state, dispatch] = useReducer(electromagnetRunReducer, undefined, createElectromagnetRun);
  useEffect(() => {
    if (!state.powered) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (active) dispatch({ type: "tick", seconds: .2, revision: state.revision });
    }, 200);
    // StrictMode cleanup/replay and unmount can leave an already queued callback.
    return () => { active = false; window.clearInterval(timer); };
  }, [state.powered, state.revision]);
  return { ...state, dispatch };
}
