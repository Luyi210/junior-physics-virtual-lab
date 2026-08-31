import { describe, expect, it } from "vitest";
import { calculateTriangularPrismRayPath } from "./prism";

describe("triangular prism ray tracing", () => {
  it("入射光保持水平并在三棱镜表面发生折射", () => {
    const ray = calculateTriangularPrismRayPath({ prismAngleDegrees: 0, refractiveIndex: 1.5, screenX: 700 });
    expect(ray.entry.y).toBeCloseTo(225);
    expect(ray.entry.x).toBeGreaterThan(320);
    expect(ray.entry.x).toBeLessThan(410);
    expect(ray.exit.x).toBeGreaterThan(ray.entry.x);
    expect(ray.insideDirection.y).not.toBeCloseTo(0);
    expect(ray.landing.x).toBeCloseTo(700);
  });

  it("折射率更大的紫光在光屏上的偏折大于红光", () => {
    const red = calculateTriangularPrismRayPath({ prismAngleDegrees: 0, refractiveIndex: 1.476, screenX: 760 });
    const violet = calculateTriangularPrismRayPath({ prismAngleDegrees: 0, refractiveIndex: 1.524, screenX: 760 });
    expect(violet.landing.y).toBeGreaterThan(red.landing.y);
    expect(violet.exit.y).toBeGreaterThan(red.exit.y);
  });

  it("转动棱镜时仍从旋转后的表面入射和出射", () => {
    for (const angle of [-16, -8, 8, 16]) {
      const ray = calculateTriangularPrismRayPath({ prismAngleDegrees: angle, refractiveIndex: 1.5, screenX: 760 });
      expect(ray.entry.y).toBeCloseTo(225);
      expect(ray.landing.x).toBeCloseTo(760);
      expect(Number.isFinite(ray.landing.y)).toBe(true);
      expect(ray.landing.y).toBeGreaterThan(62);
      expect(ray.landing.y).toBeLessThan(388);
      expect(ray.entryEdgeIndex).not.toBe(ray.exitEdgeIndex);
    }
  });

  it("拒绝超范围转角和无效折射率", () => {
    expect(() => calculateTriangularPrismRayPath({ prismAngleDegrees: 31, refractiveIndex: 1.5, screenX: 700 })).toThrow(RangeError);
    expect(() => calculateTriangularPrismRayPath({ prismAngleDegrees: 0, refractiveIndex: 1, screenX: 700 })).toThrow(RangeError);
  });
});
