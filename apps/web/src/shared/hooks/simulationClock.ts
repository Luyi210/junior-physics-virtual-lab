export const FIXED_TIME_STEP = 1 / 60;

export function advanceExperimentClock(tick: number, remainder: number, elapsedSeconds: number, duration: number, stepSeconds = FIXED_TIME_STEP) {
  const available = remainder + Math.max(0, elapsedSeconds);
  const steps = Math.floor((available + 1e-10) / stepSeconds);
  const maximum = Math.ceil(duration / stepSeconds);
  return { tick: Math.min(maximum, tick + steps), remainder: Math.max(0, available - steps * stepSeconds), finished: tick + steps >= maximum };
}
