/** Samples must be ordered at equal physical time intervals. No future point is revealed by the observed trail. */
export function observedMotionTrail<T>(samples: readonly T[], current: T, elapsed: number, duration: number): T[] {
  if (samples.length < 2 || !(duration > 0) || !(elapsed > 0)) return [];
  const fraction = Math.min(1, Math.max(0, elapsed / duration));
  const lastIndex = Math.floor(fraction * (samples.length - 1));
  return [...samples.slice(0, lastIndex + 1), current];
}

/** Positions already reached at equally spaced physical times, including the release point. */
export function observedTimeMarkers<T>(samples: readonly T[], elapsed: number, duration: number, intervals = 16) {
  if (samples.length < 2 || !(duration > 0) || !(intervals > 0)) return [];
  const fraction = Math.min(1, Math.max(0, elapsed / duration));
  const lastSlot = Math.floor(fraction * intervals + 1e-9);
  return Array.from({ length: lastSlot + 1 }, (_, slot) => ({
    point: samples[Math.round(slot * (samples.length - 1) / intervals)]!,
    timeSeconds: slot * duration / intervals,
  }));
}
