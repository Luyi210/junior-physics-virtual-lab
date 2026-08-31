import { describe, expect, it } from "vitest";
import { analyzeBottomContactBuoyancyError, analyzeControlledComparison, analyzeInvariantEvidence, analyzeLongitudinalParticleSnapshot, analyzeMeasurementError, analyzeProportionalEvidence, analyzeTargetVariableComparison, analyzeTimedPlateauEvidence } from "./evidenceAnalysis";

describe("experiment evidence analysis", () => {
  it("只改变一个实验条件时判定为公平比较", () => {
    const result = analyzeControlledComparison([100, 20, "同一泡沫"], [200, 20, "同一泡沫"], 50_000, 100_000);
    expect(result.valid).toBe(true);
    expect(result.changedIndexes).toEqual([0]);
    expect(result.outcomeDirection).toBe("increase");
  });

  it("同时改变两个条件时拒绝作为控制变量证据", () => {
    const result = analyzeControlledComparison([25, 100, 0], [40, 200, 2], .1, .8);
    expect(result.valid).toBe(false);
    expect(result.changedIndexes).toEqual([0, 1, 2]);
  });

  it("至少三个不同横坐标且比值稳定时支持正比关系", () => {
    const result = analyzeProportionalEvidence([{ x: 10, y: 27 }, { x: 20, y: 54 }, { x: 60, y: 162 }]);
    expect(result.enoughPoints).toBe(true);
    expect(result.proportional).toBe(true);
    expect(result.meanRatio).toBeCloseTo(2.7);
  });

  it("点数不足或比值漂移时不能支持正比结论", () => {
    expect(analyzeProportionalEvidence([{ x: 10, y: 20 }, { x: 20, y: 40 }]).proportional).toBe(false);
    expect(analyzeProportionalEvidence([{ x: 10, y: 20 }, { x: 20, y: 60 }, { x: 30, y: 70 }]).proportional).toBe(false);
  });

  it("至少三组不变量近似相等时支持规律", () => {
    const result = analyzeInvariantEvidence([5.98, 6.02, 6]);
    expect(result.enoughPoints).toBe(true);
    expect(result.stable).toBe(true);
    expect(result.meanValue).toBeCloseTo(6);
  });

  it("不变量证据不足或波动过大时拒绝下结论", () => {
    expect(analyzeInvariantEvidence([6, 6]).stable).toBe(false);
    expect(analyzeInvariantEvidence([6, 8, 4]).stable).toBe(false);
  });

  it("给出测量结果的误差方向和百分比", () => {
    const high = analyzeMeasurementError(2.84, 2.7);
    expect(high.direction).toBe("high");
    expect(high.percentError).toBeCloseTo(5.185, 2);
    expect(high.withinTolerance).toBe(false);
  });

  it("容差内的测量结果视为一致", () => {
    const result = analyzeMeasurementError(0.998, 1, .005);
    expect(result.direction).toBe("same");
    expect(result.withinTolerance).toBe(true);
  });

  it("指定变量变化足够大且结果同向时形成强对照", () => {
    const result = analyzeTargetVariableComparison([100, 4], [40, 4], 25, 10, 0, 40);
    expect(result.targetVariableChanged).toBe(true);
    expect(result.minimumChangeMet).toBe(true);
    expect(result.directionConsistent).toBe(true);
    expect(result.validTargetComparison).toBe(true);
  });

  it("改变错误变量或变化量不足时拒绝强对照", () => {
    expect(analyzeTargetVariableComparison([100, 4], [100, 8], 25, 12, 0, 40).validTargetComparison).toBe(false);
    expect(analyzeTargetVariableComparison([100, 4], [80, 4], 25, 20, 0, 40).validTargetComparison).toBe(false);
  });

  it("速度实验只接受固定路程、改变足够高度且速度同向变化的证据", () => {
    const heightEvidence = analyzeTargetVariableComparison([1.2, .1], [1.2, .2], .73, 1.03, 1, .1, "same-direction", .0001);
    expect(heightEvidence.validTargetComparison).toBe(true);
    expect(analyzeTargetVariableComparison([.8, .1], [1.2, .1], .73, .89, 1, .1, "same-direction", .0001).validTargetComparison).toBe(false);
  });

  it("平台证据要求读数稳定且跨越足够时间", () => {
    expect(analyzeTimedPlateauEvidence([{ time: 80, value: 100 }, { time: 92, value: 99.9 }], 10, .3).plateau).toBe(true);
    expect(analyzeTimedPlateauEvidence([{ time: 80, value: 100 }, { time: 82, value: 100 }], 10, .3).plateau).toBe(false);
    expect(analyzeTimedPlateauEvidence([{ time: 80, value: 100 }, { time: 92, value: 99.2 }], 10, .3).plateau).toBe(false);
  });

  it("浮力称重时物体碰底会让测力计示数偏小、计算浮力偏大", () => {
    const result = analyzeBottomContactBuoyancyError(2.7, 1.7, .6);
    expect(result.correctBuoyancy).toBeCloseTo(1);
    expect(result.supportForce).toBeCloseTo(1.1);
    expect(result.erroneousBuoyancy).toBeCloseTo(2.1);
    expect(result.direction).toBe("high");
  });

  it("拒绝不符合受力关系的碰底示数", () => {
    expect(() => analyzeBottomContactBuoyancyError(2.7, 1.7, 2)).toThrow(RangeError);
  });

  it("用相邻粒子间距识别纵波的密部与疏部", () => {
    const result = analyzeLongitudinalParticleSnapshot([0, 10, 20, 30], [0, 3, -3, 0]);
    expect(result.compressionGapIndex).toBe(1);
    expect(result.rarefactionGapIndex).toBe(0);
    expect(result.minimumSpacing).toBe(4);
    expect(result.maximumSpacing).toBe(13);
  });

  it("拒绝数量不等或非递增的粒子平衡位置", () => {
    expect(() => analyzeLongitudinalParticleSnapshot([0, 10], [0])).toThrow(RangeError);
    expect(() => analyzeLongitudinalParticleSnapshot([0, 0], [1, 2])).toThrow(RangeError);
  });
});
