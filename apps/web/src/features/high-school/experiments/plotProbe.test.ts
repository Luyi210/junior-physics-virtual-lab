import { describe, expect, it } from 'vitest';
import { nearestPlotPoint } from './plotProbe';

describe('graph probe respects physical branches', () => {
  it('distinguishes a current jump at the same switch time by vertical position', () => {
    const before = { x: 2, y: 0.7 };
    const after = { x: 2, y: -0.4 };
    expect(nearestPlotPoint([before, after], 2, 0.65, 4, 2)).toBe(before);
    expect(nearestPlotPoint([before, after], 2, -0.35, 4, 2)).toBe(after);
  });

  it('ignores damaged coordinates instead of showing a fabricated reading', () => {
    const valid = { x: 1, y: 2 };
    expect(nearestPlotPoint([{ x: 1, y: NaN }, valid], 1, 2, 3, 4)).toBe(valid);
    expect(nearestPlotPoint([valid], Infinity, 2, 3, 4)).toBeNull();
  });
});
