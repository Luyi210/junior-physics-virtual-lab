import { describe, expect, it } from "vitest";
import {
  calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement,
  quantizeManualScreenPositionMm, quantizeManualTimeSeconds,
  MANUAL_SCREEN_RESOLUTION_MM, MANUAL_TIME_RESOLUTION_SECONDS,
  type ManualMeasurementResult
} from "./index";

const pendulum = { startTimeSeconds: 0, endTimeSeconds: 10, periodCount: 5, length: 1, amplitudeDegrees: 10 };
const slit = { leftPositionMm: -6.6, rightPositionMm: 6.6, intervalCount: 4, slitSeparationMm: 0.25, screenDistance: 1.5 };
function measured(result: ManualMeasurementResult, key: string) { return result.metrics.find((entry) => entry.key === key)!.value; }

describe("user-operated virtual pendulum timing", () => {
  it("divides the user-selected interval by complete oscillations and clearly identifies virtual manual readings", () => {
    const result = calculatePendulumTimingMeasurement(pendulum);
    expect(result.provenance).toBe("virtual-manual");
    expect(result.readings).toEqual(pendulum);
    expect(measured(result, "elapsedTime")).toBe(10);
    expect(measured(result, "period")).toBe(2);
    expect(measured(result, "gravity")).toBeCloseTo(Math.PI ** 2, 12);
    expect(result.metrics.find((entry) => entry.key === "gravity")!.unit).toBe("m/s²");
    expect(result.warnings.join(" ")).toContain("不是真实器材实测");
    expect(result.assumptions.join(" ")).toContain("运动方向相同");
    expect(result.assumptions.join(" ")).toContain("1/60 s 步进");
    expect(result.assumptions.join(" ")).toContain("不能把显示小数位称为实体秒表精度");
  });
  it("computes from separately quantized displayed start and stop readings instead of hidden high-resolution time", () => {
    const result = calculatePendulumTimingMeasurement({ ...pendulum, startTimeSeconds: 1.004, endTimeSeconds: 11.005 });
    expect(result.readings.startTimeSeconds).toBe(1);
    expect(result.readings.endTimeSeconds).toBe(11.01);
    expect(measured(result, "elapsedTime")).toBe(10.01);
    expect(measured(result, "period")).toBe(2.002);
    expect(result.resolution).toEqual({ value: 0.01, unit: "s" });
    expect(MANUAL_TIME_RESOLUTION_SECONDS).toBe(0.01);
    expect(quantizeManualTimeSeconds(1.005)).toBe(1.01);
  });
  it("retains the measured period at large angles but never applies the small-angle g formula", () => {
    const large = calculatePendulumTimingMeasurement({ ...pendulum, amplitudeDegrees: 60 });
    expect(measured(large, "period")).toBe(2);
    expect(large.metrics.some((entry) => entry.key === "gravity")).toBe(false);
    expect(large.warnings.join(" ")).toContain("不输出 g");
    expect(calculatePendulumTimingMeasurement({ ...pendulum, amplitudeDegrees: 10 }).metrics.some((entry) => entry.key === "gravity")).toBe(true);
    expect(calculatePendulumTimingMeasurement({ ...pendulum, amplitudeDegrees: 10.01 }).metrics.some((entry) => entry.key === "gravity")).toBe(false);
  });
  it("does not substitute the ideal period or infer the student's cycle count", () => {
    const first = calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds: 9 });
    const second = calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds: 11 });
    expect(measured(first, "period")).toBe(1.8);
    expect(measured(second, "period")).toBe(2.2);
    expect(measured(first, "gravity")).not.toBe(measured(second, "gravity"));
  });
  it("flags a one-frame timer with 100 cycles while preserving its arithmetic result and count", () => {
    const result = calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds: 1 / 60, periodCount: 100 });
    expect(result.readings).toEqual({ ...pendulum, endTimeSeconds: 0.02, periodCount: 100 });
    expect(measured(result, "elapsedTime")).toBe(0.02);
    expect(measured(result, "period")).toBe(0.0002);
    expect(measured(result, "gravity")).toBeCloseTo(4 * Math.PI ** 2 / 0.0002 ** 2, 4);
    expect(result.metrics.find((entry) => entry.key === "gravity")).toMatchObject({ label: "小角近似估计的 g", unit: "m/s²" });
    expect(result.warnings[0]).toContain("计时周期与同条件模型相差超过 25%");
    expect(result.warnings[0]).toContain("不应当作有效 g 估计");
    expect(result.warnings[0]).toContain("原始读数和算术结果保留");
    expect(result.warnings[0]).toContain("不是测量精度或自动操作判分");
  });
  it("leaves plausible complete timing unflagged and flags a wrong count without replacing it", () => {
    const normal = calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds: 10.05 });
    const wrongCount = calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds: 10.05, periodCount: 10 });
    expect(measured(normal, "period")).toBeCloseTo(2.01, 12);
    expect(normal.warnings.some((warning) => warning.startsWith("计时周期"))).toBe(false);
    expect(normal.metrics.find((entry) => entry.key === "gravity")!.label).toBe("小角近似估计的 g");
    expect(normal.assumptions.join(" ")).toContain("未触发提醒不等于计数或时机正确");
    expect(wrongCount.readings.periodCount).toBe(10);
    expect(measured(wrongCount, "period")).toBeCloseTo(1.005, 12);
    expect(measured(wrongCount, "gravity")).toBeCloseTo(measured(normal, "gravity") * 4, 10);
    expect(wrongCount.warnings[0]).toContain("计时周期与同条件模型相差超过 25%");
  });
  it("applies the review threshold to both overly short and overly long periods", () => {
    // The nonlinear period at L=1 m and 10 degrees is about 2.010 s.
    // These displayed intervals bracket 25% on both sides without relying on rounding at the boundary.
    for (const endTimeSeconds of [7.5, 12.6]) expect(calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds }).warnings[0]).toContain("计时周期与同条件模型相差超过 25%");
    for (const endTimeSeconds of [7.6, 12.5]) expect(calculatePendulumTimingMeasurement({ ...pendulum, endTimeSeconds }).warnings.some((warning) => warning.startsWith("计时周期"))).toBe(false);
  });
  it("rejects reversed, indistinguishable, non-finite, out-of-range and fractional-count inputs", () => {
    const invalid = [
      { startTimeSeconds: 11 }, { startTimeSeconds: 10 }, { startTimeSeconds: 1.001, endTimeSeconds: 1.004 },
      { startTimeSeconds: -0.01 }, { endTimeSeconds: Infinity }, { endTimeSeconds: 3600.01 },
      { periodCount: 0 }, { periodCount: 1.5 }, { periodCount: 101 }, { periodCount: NaN },
      { length: 0 }, { length: 2.1 }, { amplitudeDegrees: 76 }
    ];
    for (const overrides of invalid) expect(() => calculatePendulumTimingMeasurement({ ...pendulum, ...overrides })).toThrow(RangeError);
    expect(() => calculatePendulumTimingMeasurement(null!)).toThrow(RangeError);
  });
});

describe("user-selected virtual double-slit positions", () => {
  it("recovers a 550 nm example with correct millimetre, metre and nanometre conversions", () => {
    const result = calculateDoubleSlitPositionMeasurement(slit);
    expect(result.provenance).toBe("virtual-manual");
    expect(measured(result, "spanMm")).toBe(13.2);
    expect(measured(result, "fringeSpacingMm")).toBe(3.3);
    expect(measured(result, "wavelengthNm")).toBeCloseTo(550, 12);
    expect(result.metrics.map((entry) => entry.unit)).toEqual(["mm", "mm", "nm"]);
    expect(result.resolution).toEqual({ value: 0.1, unit: "mm" });
    expect(result.assumptions.join(" ")).toContain("k−1 个间隔");
    expect(result.warnings.join(" ")).toContain("不是真实光学器材测量");
  });
  it("uses the measured span regardless of assumed fringe count and never silently forces a known wavelength", () => {
    expect(measured(calculateDoubleSlitPositionMeasurement({ ...slit, intervalCount: 5 }), "wavelengthNm")).toBeCloseTo(440, 12);
    const wrongCount = calculateDoubleSlitPositionMeasurement({ ...slit, intervalCount: 1 });
    expect(measured(wrongCount, "wavelengthNm")).toBeCloseTo(2200, 12);
    expect(wrongCount.warnings.join(" ")).toContain("检查坐标、单位和相邻间隔数");
  });
  it("quantizes both positions symmetrically before subtraction and handles translated fringe pairs", () => {
    const result = calculateDoubleSlitPositionMeasurement({ ...slit, leftPositionMm: -6.649, rightPositionMm: 6.649 });
    expect(result.readings.leftPositionMm).toBe(-6.6);
    expect(result.readings.rightPositionMm).toBe(6.6);
    expect(measured(result, "wavelengthNm")).toBeCloseTo(550, 12);
    expect(quantizeManualScreenPositionMm(-6.65)).toBe(-6.7);
    expect(quantizeManualScreenPositionMm(6.65)).toBe(6.7);
    expect(MANUAL_SCREEN_RESOLUTION_MM).toBe(0.1);
    expect(measured(calculateDoubleSlitPositionMeasurement({ ...slit, leftPositionMm: 1, rightPositionMm: 14.2 }), "wavelengthNm")).toBeCloseTo(550, 12);
  });
  it("rejects repeated, reversed, unresolved and out-of-screen readings and non-integer interval counts", () => {
    const invalid = [
      { rightPositionMm: -6.6 }, { leftPositionMm: 7 }, { leftPositionMm: 1.01, rightPositionMm: 1.04 },
      { leftPositionMm: -20.01 }, { rightPositionMm: 20.01 }, { leftPositionMm: NaN }, { rightPositionMm: Infinity },
      { intervalCount: 0 }, { intervalCount: 2.5 }, { intervalCount: 101 }, { intervalCount: Infinity },
      { slitSeparationMm: 0 }, { slitSeparationMm: 0.51 }, { screenDistance: 0 }, { screenDistance: 3.01 }
    ];
    for (const overrides of invalid) expect(() => calculateDoubleSlitPositionMeasurement({ ...slit, ...overrides })).toThrow(RangeError);
    expect(() => calculateDoubleSlitPositionMeasurement(null!)).toThrow(RangeError);
  });
});
