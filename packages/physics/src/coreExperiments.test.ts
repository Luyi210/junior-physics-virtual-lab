import { describe, expect, it } from "vitest";
import { calculateAppliancePower, calculateBalanceReading, calculateCircuit, calculateDensity, calculateElectromagnetExperiment, calculateElectromagnetPolarity, calculateEvaporationTrial, calculateFrictionRegime, calculateHeatingTemperature, calculateIceMeltingState, calculateInclinedCartRun, calculateLever, calculateLeverForceLine, calculateMassVolumeSample, calculateProtectedShortCircuit, calculateReflection, calculateRefraction, calculateSolidPressure, calculateSphericalMirror, calculateTwoLoadCircuit, calculateWaterBoilingPoint } from "./coreExperiments";

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
  it("电源短路时预期电流远大于正常工作电流并触发保护", () => {
    const fault = calculateProtectedShortCircuit(9,.8,5);
    expect(fault.prospectiveCurrent).toBeCloseTo(11.25);
    expect(fault.fuseTrips).toBe(true);
    expect(fault.overloadMultiple).toBeGreaterThan(2);
  });
  it("短路保护模型拒绝零内阻或零额定电流", () => expect(() => calculateProtectedShortCircuit(9,0,5)).toThrow(RangeError));
  it("判断杠杆力矩平衡", () => expect(calculateLever(3, 4, 2, 6).balanced).toBe(true));
  it("斜拉杠杆时按作用线的垂直距离计算力臂", () => {
    expect(calculateLeverForceLine(2,6,90).perpendicularArm).toBeCloseTo(6);
    expect(calculateLeverForceLine(2,6,30).perpendicularArm).toBeCloseTo(3);
    expect(calculateLeverForceLine(2,6,30).moment).toBeCloseTo(6);
  });
  it("斜拉力臂模型拒绝无效角度", () => expect(() => calculateLeverForceLine(2,6,181)).toThrow(RangeError));
  it("按 Q=ηPt=cmΔT 计算水温，并在沸点封顶", () => {
    expect(calculateHeatingTemperature(42, 1000, 200, 25, 100, 1)).toBeCloseTo(75);
    expect(calculateHeatingTemperature(100, 1000, 200, 25, 100, 1)).toBe(100);
  });
  it("水的沸点随外界气压升高而升高", () => {
    const highland = calculateWaterBoilingPoint(75);
    const standard = calculateWaterBoilingPoint(101.325);
    const pressurized = calculateWaterBoilingPoint(150);
    expect(highland).toBeLessThan(standard);
    expect(standard).toBeCloseTo(100,0);
    expect(pressurized).toBeGreaterThan(standard);
  });
  it("水沸点模型拒绝适用范围外的气压", () => expect(() => calculateWaterBoilingPoint(20)).toThrow(RangeError));
  it("电磁铁在其他条件相同时随匝数、电流和铁芯增强", () => {
    const base = calculateElectromagnetExperiment(100, .5, true, 5);
    expect(calculateElectromagnetExperiment(200, .5, true, 5).pickedNails).toBeGreaterThan(base.pickedNails);
    expect(calculateElectromagnetExperiment(100, 1, true, 5).strengthIndex).toBeGreaterThan(base.strengthIndex);
    expect(calculateElectromagnetExperiment(100, .5, false, 5).strengthIndex).toBeLessThan(base.strengthIndex);
  });
  it("电磁铁线圈温升风险遵循电流平方与通电时间趋势", () => {
    expect(calculateElectromagnetExperiment(200, .5, true, 10).overheatRisk).toBe(false);
    expect(calculateElectromagnetExperiment(200, 2, true, 12).overheatRisk).toBe(true);
  });
  it("反接电源会交换螺线管两端磁极和小磁针偏转方向", () => {
    const forward = calculateElectromagnetPolarity("forward");
    const reverse = calculateElectromagnetPolarity("reverse");
    expect(forward.leftPole).toBe(reverse.rightPole);
    expect(forward.rightPole).toBe(reverse.leftPole);
    expect(forward.compassNorthDirection).not.toBe(reverse.compassNorthDirection);
  });
  it("反接电源不改变同一匝数、电流和铁芯下的磁性强弱", () => {
    const strength = calculateElectromagnetExperiment(100, 1, true, 3).strengthIndex;
    expect(calculateElectromagnetPolarity("forward").rightPole).toBe("N");
    expect(calculateElectromagnetPolarity("reverse").rightPole).toBe("S");
    expect(calculateElectromagnetExperiment(100, 1, true, 3).strengthIndex).toBe(strength);
  });
  it("冰吸热先升温、在0℃熔化、熔尽后水继续升温", () => {
    expect(calculateIceMeltingState(0, 100, 20).phase).toBe("solid");
    const platform = calculateIceMeltingState(20, 100, 20);
    expect(platform.phase).toBe("melting");
    expect(platform.temperature).toBe(0);
    const liquid = calculateIceMeltingState(140, 100, 20);
    expect(liquid.phase).toBe("liquid");
    expect(liquid.temperature).toBeGreaterThan(0);
  });
  it("冰熔化模型拒绝负时间和非正质量", () => {
    expect(() => calculateIceMeltingState(-1, 100, 20)).toThrow(RangeError);
    expect(() => calculateIceMeltingState(10, 100, 0)).toThrow(RangeError);
  });
  it("斜轨小车由路程和计时得到平均速度，增大高度会缩短时间", () => {
    const low = calculateInclinedCartRun(1.2, .15);
    const high = calculateInclinedCartRun(1.2, .3);
    expect(low.averageSpeed).toBeCloseTo(1.2 / low.timeSeconds);
    expect(high.timeSeconds).toBeLessThan(low.timeSeconds);
    expect(high.averageSpeed).toBeGreaterThan(low.averageSpeed);
  });
  it("斜轨模型拒绝高度不小于轨道路程", () => expect(() => calculateInclinedCartRun(1, 1)).toThrow(RangeError));
  it("拉力未超过最大静摩擦力时木块保持静止且静摩擦与拉力平衡", () => {
    const result = calculateFrictionRegime(10, .25, 2, false);
    expect(result.startsSliding).toBe(false);
    expect(result.frictionForce).toBe(2);
    expect(result.maximumStaticFriction).toBeCloseTo(3.125);
    expect(result.accelerationTrend).toBe("stationary");
  });
  it("突破最大静摩擦后摩擦回落为滑动摩擦并可调到匀速", () => {
    const start = calculateFrictionRegime(10, .25, 3.2, false);
    expect(start.startsSliding).toBe(true);
    expect(start.frictionForce).toBeCloseTo(2.5);
    expect(start.accelerationTrend).toBe("accelerating");
    expect(calculateFrictionRegime(10, .25, 2.5, true).accelerationTrend).toBe("uniform");
  });
  it("固体压强随压力增大而增大、随受力面积增大而减小", () => {
    expect(calculateSolidPressure(100, 20).pressurePascals).toBe(50000);
    expect(calculateSolidPressure(200, 20).pressurePascals).toBeGreaterThan(calculateSolidPressure(100, 20).pressurePascals);
    expect(calculateSolidPressure(100, 40).pressurePascals).toBeLessThan(calculateSolidPressure(100, 20).pressurePascals);
  });
  it("固体压强模型拒绝非正受力面积", () => expect(() => calculateSolidPressure(100, 0)).toThrow(RangeError));
  it("由铭牌额定值建立等效电阻并计算实际功率和电能", () => {
    const result = calculateAppliancePower(6, 3, 6, 60);
    expect(result.resistance).toBe(12);
    expect(result.current).toBeCloseTo(.5);
    expect(result.actualPower).toBeCloseTo(3);
    expect(result.energyJoules).toBeCloseTo(180);
    expect(result.operatingState).toBe("normal");
  });
  it("电功率模型识别欠压与过压并拒绝非法铭牌", () => {
    expect(calculateAppliancePower(6, 3, 3, 60).operatingState).toBe("undervoltage");
    expect(calculateAppliancePower(6, 3, 8, 60).operatingState).toBe("overvoltage");
    expect(() => calculateAppliancePower(0, 3, 6, 60)).toThrow(RangeError);
  });
  it("蒸发质量损失随温度、液面面积和空气流速增大", () => {
    const base = calculateEvaporationTrial(50, 20, 100, 0, 60);
    expect(calculateEvaporationTrial(50, 40, 100, 0, 60).evaporatedMassGrams).toBeGreaterThan(base.evaporatedMassGrams);
    expect(calculateEvaporationTrial(50, 20, 200, 0, 60).evaporatedMassGrams).toBeGreaterThan(base.evaporatedMassGrams);
    expect(calculateEvaporationTrial(50, 20, 100, 2, 60).evaporatedMassGrams).toBeGreaterThan(base.evaporatedMassGrams);
  });
  it("蒸发模型质量守恒且拒绝非法水样", () => {
    const result = calculateEvaporationTrial(50, 25, 100, 1, 120);
    expect(result.remainingMassGrams + result.evaporatedMassGrams).toBeCloseTo(50);
    expect(() => calculateEvaporationTrial(0, 25, 100, 1, 60)).toThrow(RangeError);
  });
  it("同种物质质量与体积成正比且比值保持为密度", () => {
    const small = calculateMassVolumeSample(2.7, 20);
    const large = calculateMassVolumeSample(2.7, 60);
    expect(large.massGrams).toBeCloseTo(small.massGrams * 3);
    expect(small.ratio).toBeCloseTo(large.ratio);
    expect(small.ratio).toBeCloseTo(2.7);
  });
  it("质量体积样品模型拒绝非正密度和体积", () => expect(() => calculateMassVolumeSample(2.7, 0)).toThrow(RangeError));
  it("电子天平按分度值量化真实质量与零点偏移", () => {
    const formal = calculateBalanceReading(54, .04, .1);
    const offset = calculateBalanceReading(54, .46, .1);
    expect(formal.readingGrams).toBeCloseTo(54);
    expect(offset.readingGrams).toBeCloseTo(54.5);
    expect(offset.absoluteErrorGrams).toBeCloseTo(.5);
  });
  it("电子天平示数模型拒绝非法质量、分度值和过大负偏移", () => {
    expect(() => calculateBalanceReading(0)).toThrow(RangeError);
    expect(() => calculateBalanceReading(10, 0, 0)).toThrow(RangeError);
    expect(() => calculateBalanceReading(10, -11)).toThrow(RangeError);
  });
  it("根据质量和体积计算密度", () => expect(calculateDensity(54, 20)).toBeCloseTo(2.7));
  it("反射角等于入射角", () => expect(calculateReflection(37).reflectionAngle).toBe(37));
  it("垂直入射和大角度入射仍保持反射角等于入射角", () => {
    expect(calculateReflection(0).reflectionAngle).toBe(0);
    expect(calculateReflection(78).reflectionAngle).toBe(78);
  });
  it("反射模型拒绝超出物理范围或非有限的角度", () => {
    expect(() => calculateReflection(-1)).toThrow(RangeError);
    expect(() => calculateReflection(90)).toThrow(RangeError);
    expect(() => calculateReflection(Number.NaN)).toThrow(RangeError);
  });
  it("空气斜射入水时折射光偏向法线", () => {
    const result = calculateRefraction(45, 1, 1.33);
    expect(result.totalInternalReflection).toBe(false);
    expect(result.refractionAngle).not.toBeNull();
    expect(result.refractionAngle!).toBeLessThan(45);
  });
  it("水斜射入空气可能发生全反射", () => {
    expect(calculateRefraction(60, 1.33, 1).totalInternalReflection).toBe(true);
  });
  it("垂直入射不偏折，并满足斯涅尔定律", () => {
    expect(calculateRefraction(0, 1, 1.52).refractionAngle).toBeCloseTo(0);
    const result = calculateRefraction(40, 1, 1.52);
    const left = Math.sin(40 * Math.PI / 180);
    const right = 1.52 * Math.sin(result.refractionAngle! * Math.PI / 180);
    expect(left).toBeCloseTo(right, 10);
  });
  it("水到空气在临界角两侧正确切换折射与全反射", () => {
    expect(calculateRefraction(48, 1.33, 1).totalInternalReflection).toBe(false);
    expect(calculateRefraction(49, 1.33, 1).totalInternalReflection).toBe(true);
  });
  it("临界角处折射角稳定为90度而不会被浮点误差误判为全反射", () => {
    const criticalAngle = Math.asin(1 / 1.33) * 180 / Math.PI;
    const result = calculateRefraction(criticalAngle, 1.33, 1);
    expect(result.totalInternalReflection).toBe(false);
    expect(result.refractionAngle).toBeCloseTo(90, 8);
  });
  it("折射模型拒绝非法角度和折射率", () => {
    expect(() => calculateRefraction(Number.NaN, 1, 1.33)).toThrow(RangeError);
    expect(() => calculateRefraction(30, Number.NaN, 1.33)).toThrow(RangeError);
    expect(() => calculateRefraction(30, 1, 0)).toThrow(RangeError);
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
