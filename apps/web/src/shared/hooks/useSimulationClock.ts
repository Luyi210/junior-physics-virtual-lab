import { useEffect, useRef, useState } from "react";
import { advanceExperimentClock, FIXED_TIME_STEP } from "./simulationClock";

export function useSimulationClock(duration: number) {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    if (!running || duration <= 0) return;
    let frame = 0;
    let lastTime: number | null = null;
    let remainder = 0;
    const update = (now: number) => {
      if (lastTime !== null) {
        const next = advanceExperimentClock(counter.current, remainder, Math.min((now - lastTime) / 1000, .25), duration);
        counter.current = next.tick;
        remainder = next.remainder;
        setTick(next.tick);
        if (next.finished) { setRunning(false); return; }
      }
      lastTime = now;
      frame = window.requestAnimationFrame(update);
    };
    const hide = () => { if (document.hidden) setRunning(false); };
    document.addEventListener("visibilitychange", hide);
    frame = window.requestAnimationFrame(update);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", hide); };
  }, [running, duration]);

  function reset() { setRunning(false); counter.current = 0; setTick(0); }
  function start() { counter.current = 0; setTick(0); setRunning(duration > 0); }
  function toggle() {
    if (!running && counter.current * FIXED_TIME_STEP >= duration) { counter.current = 0; setTick(0); }
    setRunning((value) => !value);
  }
  function step() {
    setRunning(false);
    counter.current = Math.min(Math.ceil(duration / FIXED_TIME_STEP), counter.current + 1);
    setTick(counter.current);
  }
  return { time: Math.min(duration, tick * FIXED_TIME_STEP), running, reset, start, toggle, step };
}
