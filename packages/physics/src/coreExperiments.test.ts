import { describe, expect, it } from "vitest";
import { calculateCircuit, calculateDensity, calculateHeatingTemperature, calculateLever, calculateReflection, calculateRefraction, calculateSphericalMirror, calculateTwoLoadCircuit } from "./coreExperiments";

describe("core experiment calculations", () => {
  it("计算串并联等效电阻与电流", () => {
    expect(calculateCircuit("series", 9, 20, 10).totalCurrent).toBeCloseTo(0.3);
    expect(calculateCircuit("parallel", 9, 20, 10).totalResistance).toBeCloseTo(6.6667);
  });
  it("串联电路任一用电器断路时整条电路没有电流", () => {
    const result = calculateTwoLoadCircuit("series", 9, 20, 10, true, false, true);
    expect(result.totalCurrent).toBe(0);
    expect(result.energized).toBe(false);
  });
  it("并联电路一条支路断路时另一支路仍可工作", () => {
    const result = calculateTwoLoadCircuit("parallel", 9, 20, 10, true, false, true);
    expect(result.branchCurrents[0]).toBe(0);
    expect(result.branchCurrents[1]).toBeCloseTo(0.9);
    expect(result.totalCurrent).toBeCloseTo(0.9);
  });
  it("判断杠杆力矩平衡", () => expect(calculateLever(3, 4, 2, 6).balanced).toBe(true));
  it("按 Q=ηPt=cmΔT 计算水温，并在沸点封顶", () => {
    expect(calculateHeatingTemperature(42, 1000, 200, 25, 100, 1)).toBeCloseTo(75);
    expect(calculateHeatingTemperature(100, 1000, 200, 25, 100, 1)).toBe(100);
  });
  it("根据质量和体积计算密度", () => expect(calculateDensity(54, 20)).toBeCloseTo(2.7));
  it("反射角等于入射角", () => expect(calculateReflection(37).reflectionAngle).toBe(37));
  it("空气斜射入水时折射光偏向法线", () => {
    const result = calculateRefraction(45, 1, 1.33);
    expect(result.totalInternalReflection).toBe(false);
    expect(result.refractionAngle).not.toBeNull();
    expect(result.refractionAngle!).toBeLessThan(45);
  });
  it("水斜射入空气可能发生全反射", () => {
    expect(calculateRefraction(60, 1.33, 1).totalInternalReflection).toBe(true);
  });
  it("凹面镜物体在焦点外时可以形成实像", () => {
    const result = calculateSphericalMirror("concave", 240, 120);
    expect(result.real).toBe(true);
    expect(result.imageDistance).toBeCloseTo(240);
    expect(result.magnification).toBeCloseTo(-1);
  });
  it("凸面镜始终形成正立缩小的虚像", () => {
    const result = calculateSphericalMirror("convex", 240, 120);
    expect(result.real).toBe(false);
    expect(result.imageDistance).toBeLessThan(0);
    expect(result.magnification).toBeGreaterThan(0);
    expect(result.magnification).toBeLessThan(1);
  });
});
