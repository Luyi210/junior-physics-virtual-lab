export const FIXED_TIME_STEP = 1 / 60;

/** Convert a requested physical time to the same fixed grid used by playback. */
export function clockTickAtTime(time: number, duration: number, stepSeconds = FIXED_TIME_STEP) {
  if (!(duration > 0) || !Number.isFinite(duration) || !Number.isFinite(time)) return 0;
  const maximum = Math.ceil(duration / stepSeconds);
  if (time >= duration) return maximum;
  return Math.min(maximum, Math.max(0, Math.round(time / stepSeconds)));
}

export function advanceExperimentClock(tick: number, remainder: number, elapsedSeconds: number, duration: number, stepSeconds = FIXED_TIME_STEP) {
  const available = remainder + Math.max(0, elapsedSeconds);
  const steps = Math.floor((available + 1e-10) / stepSeconds);
  const maximum = Math.ceil(duration / stepSeconds);
  return { tick: Math.min(maximum, tick + steps), remainder: Math.max(0, available - steps * stepSeconds), finished: tick + steps >= maximum };
}
