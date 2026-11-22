import { useSimulationClock } from "../../../shared/hooks/useSimulationClock";

/** Playback rate changes wall-clock pacing; time and single-step remain physical seconds. */
export function useExperimentClock(durationSeconds: number, playbackRate = 1, stepSeconds = 1 / 60) {
  return useSimulationClock(durationSeconds, playbackRate, stepSeconds);
}
