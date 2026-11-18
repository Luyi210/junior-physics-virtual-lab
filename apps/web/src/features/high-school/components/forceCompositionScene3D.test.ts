import { describe, expect, it } from "vitest";
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import { FORCE_BOARD_HALF_SIZE, FORCE_BOARD_SCALE, forceBoardArrow, forceBoardPoint } from "./forceCompositionScene3D";

describe("force composition board geometry", () => {
  it("preserves the model vector directions and one common scale in all quadrants", () => {
    for (const [x, y] of [[3, 4], [-3, 4], [-3, -4], [3, -4], [0, 5], [-5, 0]]) {
      const arrow = forceBoardArrow(x, y, .12)!;
      expect(arrow.end[0] / FORCE_BOARD_SCALE).toBeCloseTo(x);
      expect(-arrow.end[2] / FORCE_BOARD_SCALE).toBeCloseTo(y);
      expect(arrow.start).toEqual([0, .12, 0]);
      expect(arrow.length).toBeCloseTo(5 * FORCE_BOARD_SCALE);
      // The tip of the rendered cone must be exactly the physical endpoint.
      arrow.end.forEach((coordinate, index) => expect(arrow.headCenter[index] + arrow.direction[index] * arrow.headLength / 2).toBeCloseTo(coordinate));
    }
  });

  it("does not fabricate zero-force arrows and keeps tiny nonzero heads behind their endpoints", () => {
    expect(forceBoardArrow(0, 0)).toBeNull();
    expect(forceBoardArrow(NaN, 1)).toBeNull();
    expect(forceBoardArrow(1, Infinity)).toBeNull();
    const small = forceBoardArrow(.001, 0)!;
    expect(small.shaftEnd[0]).toBeGreaterThan(0);
    expect(small.headLength).toBeLessThan(small.length);
  });

  it("fits the maximum 10 N resultant/trial and preserves the parallelogram under rotation", () => {
    for (const angle of [-180, -90, 0, 45, 90, 179]) {
      const p = { ...defaultHighSchoolParameters("force-composition"), force1N: 5, force2N: 5, angle1Degrees: angle, angle2Degrees: angle, trialForceN: 10, trialAngleDegrees: angle };
      const s = simulateHighSchoolExperiment("force-composition", p, 0).state;
      const first = forceBoardPoint(s.force1X, s.force1Y);
      const second = forceBoardPoint(s.force2X, s.force2Y);
      const result = forceBoardPoint(s.resultantX, s.resultantY);
      for (const axis of [0, 2]) {
        expect(result[axis]).toBeCloseTo(first[axis] + second[axis]);
        expect(Math.abs(result[axis])).toBeLessThan(FORCE_BOARD_HALF_SIZE);
      }
      expect(forceBoardArrow(s.trialX, s.trialY)!.length).toBeCloseTo(3.2);
      expect(s.residualMagnitude).toBeCloseTo(0);
    }
  });
});
