import type { HighSchoolExperimentId } from "@physics-lab/physics";

export const PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 1, 2] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

/** Short physical events need longer observation time, without changing the model. */
export function defaultPlaybackSpeed(id: HighSchoolExperimentId, durationSeconds: number): PlaybackSpeed {
  if (durationSeconds <= 0) return 1;
  if (id === "transformer-ratio" || id === "pendulum") return 0.5;
  if (durationSeconds <= 1) return 0.1;
  if (durationSeconds <= 2) return 0.25;
  if (durationSeconds <= 10) return 0.5;
  return 1;
}

/** One transformer cycle per wall second at 1x; other experiments use physical real time at 1x. */
export function physicalPlaybackRate(id: HighSchoolExperimentId, speed: PlaybackSpeed, frequency?: number) {
  if (id !== "transformer-ratio") return speed;
  if (!(frequency && frequency > 0) || !Number.isFinite(frequency)) throw new RangeError("交流频率必须为有限正数。");
  return speed / frequency;
}
