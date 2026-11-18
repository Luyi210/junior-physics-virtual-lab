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

  it.each([
    [29.5, "between", "放大"], [29.9, "between", "放大"],
    [30, "twice", "等大"], [30.1, "far", "缩小"], [30.5, "far", "缩小"]
  ] as const)("f=15、u=%s 时数值、性质和解释一致", (u, lensCase, size) => {
    const result = calculateLens({ ...base, focalLength: 15, objectX: -u });
    expect(result.case).toBe(lensCase);
    expect(result.nature).toContain(size);
    expect(result.conclusion).toContain(size);
    expect(Math.abs(result.magnification) - 1).toBeCloseTo((30 - u) / (u - 15));
  });

  it("焦点两侧的有限物距不能因显示分辨率而被改写成无穷远", () => {
    for (const u of [14.99, 15.01]) {
      const result = calculateLens({ ...base, focalLength: 15, objectX: -u });
      expect(result.finite).toBe(true);
      expect(result.real).toBe(u > 15);
      expect(1 / u + 1 / result.imageDistance).toBeCloseTo(1 / 15, 12);
    }
  });
});
