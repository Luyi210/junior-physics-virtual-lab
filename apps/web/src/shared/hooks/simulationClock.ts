export const FIXED_TIME_STEP = 1 / 60;

export function advanceExperimentClock(tick: number, remainder: number, elapsedSeconds: number, duration: number) {
  const available = remainder + Math.max(0, elapsedSeconds);
  const steps = Math.floor((available + 1e-10) / FIXED_TIME_STEP);
  const maximum = Math.ceil(duration / FIXED_TIME_STEP);
  return { tick: Math.min(maximum, tick + steps), remainder: Math.max(0, available - steps * FIXED_TIME_STEP), finished: tick + steps >= maximum };
}
