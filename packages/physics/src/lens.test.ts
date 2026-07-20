import { describe, expect, it } from "vitest";
import { calculateLens } from "./lens";

const base = { focalLength: 10, lensX: 0, objectHeight: 5, screenX: 20 };

describe("calculateLens", () => {
  it("物距等于二倍焦距时形成等大实像", () => {
    const result = calculateLens({ ...base, objectX: -20 });
    expect(result.imageDistance).toBeCloseTo(20);
    expect(result.magnification).toBeCloseTo(-1);
    expect(result.case).toBe("twice");
    expect(result.screenFocused).toBe(true);
  });

  it("物体位于焦点内时形成正立虚像", () => {
    const result = calculateLens({ ...base, objectX: -5 });
    expect(result.real).toBe(false);
    expect(result.magnification).toBeGreaterThan(0);
    expect(result.case).toBe("virtual");
  });

  it("物体位于焦点时不形成有限像", () => {
    const result = calculateLens({ ...base, objectX: -10 });
    expect(result.finite).toBe(false);
    expect(result.imageDistance).toBe(Number.POSITIVE_INFINITY);
  });
});
