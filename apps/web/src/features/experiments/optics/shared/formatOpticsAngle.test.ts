import { describe, expect, it } from "vitest";
import { formatOpticsAngle } from "./formatOpticsAngle";

describe("optics angle display preserves the underlying angle", () => {
  it.each([0, 25, 40, 60, 78])("keeps the integer label %s unchanged", (angle) => {
    expect(formatOpticsAngle(angle)).toBe(String(angle));
  });

  it("marks the rounded critical angle without presenting 48.8 as the same input", () => {
    const critical = Math.asin(1 / 1.33) * 180 / Math.PI;
    expect(formatOpticsAngle(critical)).toBe("≈48.7535");
    expect(formatOpticsAngle(48.8)).toBe("48.8");
    expect(critical).toBe(Math.asin(1 / 1.33) * 180 / Math.PI);
  });

  it("retains one decimal in existing result readouts and marks meaningful rounding", () => {
    expect(formatOpticsAngle(0, 1, true)).toBe("0.0");
    expect(formatOpticsAngle(90, 1, true)).toBe("90.0");
    expect(formatOpticsAngle(28.712, 1, true)).toBe("≈28.7");
    expect(formatOpticsAngle(40 - Number.EPSILON * 40, 1, true)).toBe("40.0");
  });
});
