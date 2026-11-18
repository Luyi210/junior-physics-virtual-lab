import { useSimulationClock } from "../../../shared/hooks/useSimulationClock";

/** The display clock may slow an AC cycle; all consumers still receive physical seconds. */
export function useExperimentClock(durationSeconds: number, playbackRate = 1) {
  if (!(playbackRate > 0) || !Number.isFinite(playbackRate)) throw new RangeError('播放倍率必须为有限正数。');
  const clock = useSimulationClock(durationSeconds / playbackRate);
  return { ...clock, time: Math.min(durationSeconds, clock.time * playbackRate) };
}
