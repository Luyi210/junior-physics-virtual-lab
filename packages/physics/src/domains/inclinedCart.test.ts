import { describe, expect, it } from 'vitest';
import { calculateInclinedCartRun, calculateInclinedCartState } from './mechanics';

describe('inclined cart timer and motion agree', () => {
  it('starts at rest and travels one quarter of the distance in half the total time', () => {
    const run = calculateInclinedCartRun(1.2, .2);
    expect(run.acceleration).toBeCloseTo(1.2, 12);
    expect(calculateInclinedCartState(1.2, .2, 0)).toEqual({ timeSeconds: 0, distanceMeters: 0, instantaneousSpeed: 0, progress: 0, finished: false });
    const halfway = calculateInclinedCartState(1.2, .2, run.timeSeconds / 2);
    expect(halfway.distanceMeters).toBeCloseTo(.3, 12);
    expect(halfway.progress).toBeCloseTo(.25, 12);
    expect(halfway.instantaneousSpeed).toBeCloseTo(run.finalSpeed / 2, 12);
  });

  it('ends exactly at the last gate even if an animation tick goes past the finish time', () => {
    const run = calculateInclinedCartRun(1.2, .2);
    const end = calculateInclinedCartState(1.2, .2, Math.ceil(run.timeSeconds * 60) / 60);
    expect(end.timeSeconds).toBe(run.timeSeconds);
    expect(end.distanceMeters).toBe(1.2);
    expect(end.progress).toBe(1);
    expect(end.instantaneousSpeed).toBe(run.finalSpeed);
    expect(end.finished).toBe(true);
    expect(calculateInclinedCartState(1.2, .2, run.timeSeconds)).toEqual(end);
  });

  it('keeps the average speed distinct from the instantaneous speed during the run', () => {
    const run = calculateInclinedCartRun(1.2, .2);
    expect(calculateInclinedCartState(1.2, .2, run.timeSeconds / 4).instantaneousSpeed).toBeCloseTo(run.averageSpeed / 2, 12);
    expect(run.finalSpeed).toBeCloseTo(2 * run.averageSpeed, 12);
  });

  it.each([-1, NaN, Infinity])('rejects invalid clock time %s', (time) => {
    expect(() => calculateInclinedCartState(1.2, .2, time)).toThrow(RangeError);
  });

  it('rejects nonfinite geometry and nonpositive gravity instead of displaying invalid motion', () => {
    expect(() => calculateInclinedCartRun(NaN, .2)).toThrow(RangeError);
    expect(() => calculateInclinedCartRun(1.2, Infinity)).toThrow(RangeError);
    expect(() => calculateInclinedCartRun(1.2, .2, .72, 0)).toThrow(RangeError);
    expect(() => calculateInclinedCartRun(1.2, .2, .72, -10)).toThrow(RangeError);
  });
});
