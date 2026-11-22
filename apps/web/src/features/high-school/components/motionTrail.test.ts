import { describe, expect, it } from "vitest";
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import { createTrajectory } from "../experiments/workbench";
import { observedMotionTrail, observedTimeMarkers } from "./motionTrail";

describe("physics-time motion traces", () => {
  it("reveals only model positions already reached by a projectile", () => {
    const parameters = defaultHighSchoolParameters("projectile-motion");
    const initial = simulateHighSchoolExperiment("projectile-motion", parameters, 0);
    const duration = initial.durationSeconds;
    const samples = createTrajectory("projectile-motion", parameters, duration);
    const atQuarter = simulateHighSchoolExperiment("projectile-motion", parameters, duration / 4).state;
    const trail = observedMotionTrail(samples, { x: atQuarter.x, y: atQuarter.y }, atQuarter.time, duration);
    const marks = observedTimeMarkers(samples, atQuarter.time, duration);
    expect(trail).toHaveLength(18);
    expect(trail.at(-1)).toEqual({ x: atQuarter.x, y: atQuarter.y });
    expect(marks).toHaveLength(5);
    for (const marker of marks) {
      const state = simulateHighSchoolExperiment("projectile-motion", parameters, marker.timeSeconds).state;
      expect(marker.point.x).toBeCloseTo(state.x, 12);
      expect(marker.point.y).toBeCloseTo(state.y, 12);
    }
    expect(observedMotionTrail(samples, samples[0]!, 0, duration)).toEqual([]);
    expect(observedTimeMarkers(samples, 0, duration)).toHaveLength(1);
    expect(observedTimeMarkers(samples, duration, duration)).toHaveLength(17);
  });
});
