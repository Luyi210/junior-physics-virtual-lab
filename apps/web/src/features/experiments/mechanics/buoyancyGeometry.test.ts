import { describe, expect, it } from "vitest";
import { buoyancyGeometry } from "./buoyancyGeometry";

const insideLiquidHeight = (shape: ReturnType<typeof buoyancyGeometry>) => Math.max(0, Math.min(shape.object.bottom, shape.vessel.bottom) - Math.max(shape.object.top, shape.surfaceY));

describe("suspended buoyancy apparatus geometry", () => {
  it.each([60, 100, 120])("keeps a %s cm³ specimen inside the same vessel coordinates at every immersion step", (volume) => {
    for (const depth of [0, 25, 50, 75, 100]) {
      const shape = buoyancyGeometry({ objectVolumeCm3: volume, immersionPercent: depth, touchingBottom: false });
      expect(shape.object.left).toBeGreaterThan(shape.vessel.left);
      expect(shape.object.left + shape.object.width).toBeLessThan(shape.vessel.right);
      expect(shape.object.bottom).toBeLessThan(shape.vessel.bottom);
      expect(shape.surfaceY).toBeGreaterThan(shape.vessel.top);
      expect(insideLiquidHeight(shape) / shape.object.height).toBeCloseTo(depth / 100, 12);
      expect(shape.displacedVolumeCm3).toBeCloseTo(volume * depth / 100, 12);
      expect(shape.suspension.bottom).toBe(shape.object.top);
      expect(shape.suspension.top).toBeLessThan(shape.suspension.bottom);
      if (depth === 0) expect(shape.object.bottom).toBeLessThan(shape.surfaceY);
    }
  });

  it("raises the liquid as more volume is displaced without reversing the lowering motion", () => {
    const steps = [0, 25, 50, 75, 100].map((depth) => buoyancyGeometry({ objectVolumeCm3: 100, immersionPercent: depth, touchingBottom: false }));
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index].surfaceY).toBeLessThan(steps[index - 1].surfaceY);
      expect(steps[index].object.top).toBeGreaterThan(steps[index - 1].object.top);
    }
    expect(steps[1].displacedVolumeCm3).toBe(25);
    // 100 cm³ aluminum in water at 25% immersion: F浮=.25 N, F′=2.45 N.
    expect(steps[1].displacedVolumeCm3 / 100).toBe(0.25);
    expect(2.7 - steps[1].displacedVolumeCm3 / 100).toBe(2.45);
  });

  it.each([60, 100, 120])("places a %s cm³ specimen on the inner floor without changing displacement", (volume) => {
    const suspended = buoyancyGeometry({ objectVolumeCm3: volume, immersionPercent: 100, touchingBottom: false });
    const bottom = buoyancyGeometry({ objectVolumeCm3: volume, immersionPercent: 100, touchingBottom: true });
    expect(bottom.object.bottom).toBe(bottom.vessel.bottom);
    expect(bottom.object.top).toBeGreaterThan(bottom.surfaceY);
    expect(bottom.displacedVolumeCm3).toBe(suspended.displacedVolumeCm3);
    expect(bottom.surfaceY).toBe(suspended.surfaceY);
    expect(insideLiquidHeight(bottom)).toBe(bottom.object.height);
  });

  it("rejects nonphysical input instead of creating invalid SVG coordinates", () => {
    for (const volume of [0, -1, 151, NaN, Infinity]) expect(() => buoyancyGeometry({ objectVolumeCm3: volume, immersionPercent: 25, touchingBottom: false })).toThrow(RangeError);
    for (const depth of [-1, 101, NaN]) expect(() => buoyancyGeometry({ objectVolumeCm3: 100, immersionPercent: depth, touchingBottom: false })).toThrow(RangeError);
    expect(() => buoyancyGeometry({ objectVolumeCm3: 100, immersionPercent: 25, touchingBottom: true })).toThrow(RangeError);
  });
});
