import { describe, expect, it } from "vitest";
import { assessDoubleSlitScreen, calculateDoubleSlit, calculateDoubleSlitBrightPosition, simulateHighSchoolExperiment } from "./index";

describe("double-slit screen measurement capability", () => {
  it("identifies a screen with only the central fringe and exposes an actionable warning", () => {
    const parameters = { wavelengthNm: 700, slitSeparationMm: 0.1, screenDistance: 3 };
    expect(assessDoubleSlitScreen(parameters)).toEqual({ screenHalfWidthMm: 20, visibleBrightFringeCount: 1, canMeasureFringeSpacing: false });
    const result = simulateHighSchoolExperiment("double-slit", parameters);
    expect(result.state.visibleBrightFringeCount).toBe(1);
    expect(result.state.canMeasureFringeSpacing).toBe(0);
    expect(result.metrics.find((metric) => metric.key === "visibleBrightFringeCount")).toMatchObject({ value: 1, unit: "条" });
    expect(result.warnings.join(" ")).toContain("缩短屏距或增大缝间距");
    expect(assessDoubleSlitScreen({ ...parameters, screenDistance: 1.5 }).canMeasureFringeSpacing).toBe(true);
  });

  it("counts symmetric visible bright orders using exact positions and includes the central maximum", () => {
    const parameters = { wavelengthNm: 550, slitSeparationMm: 0.25, screenDistance: 1.5 };
    const result = assessDoubleSlitScreen(parameters);
    expect(result.visibleBrightFringeCount).toBe(13);
    expect(result.canMeasureFringeSpacing).toBe(true);
    const highestOrder = (result.visibleBrightFringeCount - 1) / 2;
    const last = calculateDoubleSlitBrightPosition({ ...parameters, screenPositionMm: 0 }, highestOrder)!;
    const outside = calculateDoubleSlitBrightPosition({ ...parameters, screenPositionMm: 0 }, highestOrder + 1)!;
    expect(last).toBeLessThanOrEqual(0.02);
    expect(outside).toBeGreaterThan(0.02);
    expect(simulateHighSchoolExperiment("double-slit", parameters).state.canMeasureFringeSpacing).toBe(1);
  });

  it("does not include a fringe that a near-axis 20 mm spacing would incorrectly place on the boundary", () => {
    const parameters = { wavelengthNm: 2000 / 3, slitSeparationMm: 0.1, screenDistance: 3 };
    const model = calculateDoubleSlit({ ...parameters, screenPositionMm: 20 });
    expect(model.fringeSpacing).toBeCloseTo(0.02, 14);
    expect(model.pathDifference).toBeLessThan(model.wavelength);
    expect(assessDoubleSlitScreen(parameters).visibleBrightFringeCount).toBe(1);
  });

  it("includes an exact edge fringe but rejects it when it moves just outside, without a wide tolerance", () => {
    const geometry = { slitSeparationMm: 0.1, screenDistance: 3 };
    const edgeWavelengthNm = calculateDoubleSlit({ ...geometry, wavelengthNm: 550, screenPositionMm: 20 }).pathDifference * 1e9;
    expect(assessDoubleSlitScreen({ ...geometry, wavelengthNm: edgeWavelengthNm }).visibleBrightFringeCount).toBe(3);
    expect(assessDoubleSlitScreen({ ...geometry, wavelengthNm: edgeWavelengthNm - 1e-6 }).visibleBrightFringeCount).toBe(3);
    expect(assessDoubleSlitScreen({ ...geometry, wavelengthNm: edgeWavelengthNm + 1e-6 }).visibleBrightFringeCount).toBe(1);
  });

  it("rejects invalid optical dimensions instead of presenting a fabricated capability", () => {
    const parameters = { wavelengthNm: 550, slitSeparationMm: 0.25, screenDistance: 1.5 };
    for (const overrides of [{ wavelengthNm: NaN }, { wavelengthNm: 0 }, { slitSeparationMm: 0 }, { screenDistance: -1 }, { screenDistance: Infinity }]) {
      expect(() => assessDoubleSlitScreen({ ...parameters, ...overrides })).toThrow(RangeError);
    }
  });
});
