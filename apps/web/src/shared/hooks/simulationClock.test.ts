import { describe, expect, it } from "vitest";
import { calculateInclinedCartRun, calculateInclinedCartState } from "@physics-lab/physics";
import { advanceExperimentClock, FIXED_TIME_STEP } from "./simulationClock";

describe("inclined-cart physics and simulation clock integration", () => {
  it.each([30, 60, 144])("reaches each track endpoint exactly once at %i fps", (framesPerSecond) => {
    for (const length of [.8, 1.2, 1.6]) {
      for (const height of [.1, .2, .3]) {
        const scenario = `L=${length} m, h=${height} m, ${framesPerSecond} fps`;
        const run = calculateInclinedCartRun(length, height);
        let clock = { tick: 0, remainder: 0, finished: false };
        let cart = calculateInclinedCartState(length, height, 0);
        let previouslyFinished = cart.finished;
        let finishTransitions = 0;

        expect(cart.finished, scenario).toBe(false);
        expect(cart.progress, scenario).toBe(0);

        // Include frames after arrival to verify that the endpoint remains stable.
        const frameCount = Math.ceil((run.timeSeconds + 1) * framesPerSecond);
        for (let frame = 0; frame < frameCount; frame += 1) {
          clock = advanceExperimentClock(clock.tick, clock.remainder, 1 / framesPerSecond, run.timeSeconds);
          const displayedTime = Math.min(run.timeSeconds, clock.tick * FIXED_TIME_STEP);
          cart = calculateInclinedCartState(length, height, displayedTime);

          expect(cart.timeSeconds, scenario).toBe(displayedTime);
          expect(cart.progress, scenario).toBeGreaterThanOrEqual(0);
          expect(cart.progress, scenario).toBeLessThanOrEqual(1);
          expect(cart.distanceMeters, scenario).toBeGreaterThanOrEqual(0);
          expect(cart.distanceMeters, scenario).toBeLessThanOrEqual(length);
          expect(cart.finished, scenario).toBe(clock.finished);

          if (!previouslyFinished && cart.finished) finishTransitions += 1;
          if (previouslyFinished) expect(cart.finished, scenario).toBe(true);
          previouslyFinished = cart.finished;

          if (cart.finished) {
            expect(cart.timeSeconds, scenario).toBe(run.timeSeconds);
            expect(cart.distanceMeters, scenario).toBe(length);
            expect(cart.progress, scenario).toBe(1);
          }
        }

        expect(cart.finished, scenario).toBe(true);
        expect(cart.timeSeconds, scenario).toBe(run.timeSeconds);
        expect(cart.distanceMeters, scenario).toBe(length);
        expect(finishTransitions, scenario).toBe(1);
      }
    }
  });
});
