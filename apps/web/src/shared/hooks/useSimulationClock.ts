import { useEffect, useRef, useState } from "react";
import { advanceExperimentClock, clockTickAtTime, FIXED_TIME_STEP } from "./simulationClock";

export function useSimulationClock(duration: number, playbackRate = 1, stepSeconds = FIXED_TIME_STEP) {
  if (!(playbackRate > 0) || !Number.isFinite(playbackRate) || !(stepSeconds > 0) || !Number.isFinite(stepSeconds)) throw new RangeError("时钟播放速度与步长必须是有限正数。");
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const counter = useRef(0);
  const remainder = useRef(0);

  useEffect(() => {
    if (!running || duration <= 0) return;
    let frame = 0;
    let lastTime: number | null = null;
    const update = (now: number) => {
      if (lastTime !== null) {
        const next = advanceExperimentClock(counter.current, remainder.current, Math.min((now - lastTime) / 1000, .25) * playbackRate, duration, stepSeconds);
        counter.current = next.tick;
        remainder.current = next.remainder;
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
  }, [running, duration, playbackRate, stepSeconds]);

  function reset() { setRunning(false); counter.current = 0; remainder.current = 0; setTick(0); }
  function start() { counter.current = 0; remainder.current = 0; setTick(0); setRunning(duration > 0); }
  function toggle() {
    if (!running && counter.current * stepSeconds >= duration) { counter.current = 0; remainder.current = 0; setTick(0); }
    setRunning((value) => !value);
  }
  function step() {
    setRunning(false);
    remainder.current = 0;
    counter.current = Math.min(Math.ceil(duration / stepSeconds), counter.current + 1);
    setTick(counter.current);
  }
  function seek(time: number) {
    setRunning(false);
    remainder.current = 0;
    counter.current = clockTickAtTime(time, duration, stepSeconds);
    setTick(counter.current);
  }
  return { time: Math.min(duration, tick * stepSeconds), running, reset, start, toggle, step, seek };
}
