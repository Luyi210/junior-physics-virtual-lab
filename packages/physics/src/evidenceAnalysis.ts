export type EvidenceCondition = string | number | boolean;

export interface ControlledComparison {
  valid: boolean;
  changedIndexes: number[];
  controlledIndexes: number[];
  outcomeDirection: "increase" | "decrease" | "same";
}

function sameCondition(a: EvidenceCondition, b: EvidenceCondition, tolerance: number) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= tolerance;
  return a === b;
}

export function analyzeControlledComparison(
  beforeConditions: EvidenceCondition[],
  afterConditions: EvidenceCondition[],
  beforeOutcome: number,
  afterOutcome: number,
  tolerance = 1e-9
): ControlledComparison {
  if (beforeConditions.length !== afterConditions.length || !beforeConditions.length) {
    throw new RangeError("两组实验条件数量必须相同且不能为空");
  }
  if (!Number.isFinite(beforeOutcome) || !Number.isFinite(afterOutcome) || tolerance < 0) {
    throw new RangeError("实验结果必须为有限数值，容差不能为负");
  }
  const changedIndexes = beforeConditions.flatMap((value, index) => sameCondition(value, afterConditions[index]!, tolerance) ? [] : [index]);
  const controlledIndexes = beforeConditions.map((_, index) => index).filter((index) => !changedIndexes.includes(index));
  const difference = afterOutcome - beforeOutcome;
  const outcomeDirection = Math.abs(difference) <= tolerance ? "same" : difference > 0 ? "increase" : "decrease";
  return { valid: changedIndexes.length === 1, changedIndexes, controlledIndexes, outcomeDirection };
}

export function analyzeTargetVariableComparison(
  beforeConditions: EvidenceCondition[],
  afterConditions: EvidenceCondition[],
  beforeOutcome: number,
  afterOutcome: number,
  targetIndex: number,
  minimumChange = 0,
  expectedRelation: "same-direction" | "opposite-direction" = "same-direction",
  tolerance = 1e-9
) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= beforeConditions.length || minimumChange < 0) {
    throw new RangeError("目标变量索引必须有效，最低变化量不能为负");
  }
  const beforeTarget = beforeConditions[targetIndex];
  const afterTarget = afterConditions[targetIndex];
  if (typeof beforeTarget !== "number" || typeof afterTarget !== "number") {
    throw new TypeError("指定变量强对照要求目标变量为数值");
  }
  const comparison = analyzeControlledComparison(beforeConditions, afterConditions, beforeOutcome, afterOutcome, tolerance);
  const targetChange = afterTarget - beforeTarget;
  const targetDirection = Math.abs(targetChange) <= tolerance ? "same" as const : targetChange > 0 ? "increase" as const : "decrease" as const;
  const targetVariableChanged = comparison.valid && comparison.changedIndexes[0] === targetIndex;
  const minimumChangeMet = Math.abs(targetChange) + tolerance >= minimumChange;
  const directionConsistent = targetDirection !== "same" && comparison.outcomeDirection !== "same" && (
    expectedRelation === "same-direction"
      ? targetDirection === comparison.outcomeDirection
      : targetDirection !== comparison.outcomeDirection
  );
  return {
    ...comparison,
    targetIndex,
    targetChange,
    targetDirection,
    targetVariableChanged,
    minimumChangeMet,
    directionConsistent,
    validTargetComparison: targetVariableChanged && minimumChangeMet && directionConsistent
  };
}

export interface ProportionalEvidencePoint { x: number; y: number; }

export interface TimedEvidencePoint { time: number; value: number; }

export function analyzeTimedPlateauEvidence(
  points: TimedEvidencePoint[],
  minimumTimeSpan: number,
  absoluteTolerance: number,
  minimumPoints = 2
) {
  if (minimumTimeSpan < 0 || absoluteTolerance < 0 || !Number.isInteger(minimumPoints) || minimumPoints < 2) {
    throw new RangeError("平台证据的时间跨度和容差不能为负，最低点数至少为2");
  }
  if (points.some((point) => !Number.isFinite(point.time) || !Number.isFinite(point.value))) {
    throw new RangeError("平台证据的时间和值必须为有限数值");
  }
  const distinctPoints = [...new Map(points.map((point) => [point.time, point])).values()].sort((a, b) => a.time - b.time);
  const timeSpan = distinctPoints.length > 1 ? distinctPoints.at(-1)!.time - distinctPoints[0]!.time : 0;
  const values = distinctPoints.map((point) => point.value);
  const valueSpan = values.length ? Math.max(...values) - Math.min(...values) : null;
  const enoughPoints = distinctPoints.length >= minimumPoints;
  const enoughTimeSpan = timeSpan >= minimumTimeSpan;
  const stable = valueSpan !== null && valueSpan <= absoluteTolerance;
  return { pointCount: distinctPoints.length, timeSpan, valueSpan, enoughPoints, enoughTimeSpan, stable, plateau: enoughPoints && enoughTimeSpan && stable };
}

export function analyzeBottomContactBuoyancyError(
  gravity: number,
  suspendedApparentWeight: number,
  bottomContactApparentWeight: number
) {
  if (![gravity, suspendedApparentWeight, bottomContactApparentWeight].every(Number.isFinite) || gravity <= 0) {
    throw new RangeError("重力和测力计示数必须为有效数值，重力必须大于零");
  }
  if (suspendedApparentWeight < 0 || bottomContactApparentWeight < 0 || suspendedApparentWeight > gravity || bottomContactApparentWeight > suspendedApparentWeight) {
    throw new RangeError("碰底示数应不大于悬空示数，且两种示数应在0到重力之间");
  }
  const correctBuoyancy = gravity - suspendedApparentWeight;
  const erroneousBuoyancy = gravity - bottomContactApparentWeight;
  const supportForce = suspendedApparentWeight - bottomContactApparentWeight;
  const absoluteError = erroneousBuoyancy - correctBuoyancy;
  const percentError = correctBuoyancy > 0 ? absoluteError / correctBuoyancy * 100 : null;
  return { correctBuoyancy, erroneousBuoyancy, supportForce, absoluteError, percentError, direction: absoluteError > 0 ? "high" as const : "same" as const };
}

export function analyzeProportionalEvidence(points: ProportionalEvidencePoint[], relativeTolerance = .05) {
  if (relativeTolerance < 0) throw new RangeError("相对容差不能为负");
  if (points.some((point) => point.x <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new RangeError("证据点横坐标必须为正，横纵坐标必须为有限数值");
  }
  const ratios = points.map((point) => point.y / point.x);
  const meanRatio = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : null;
  const maxRelativeDeviation = meanRatio && ratios.length
    ? Math.max(...ratios.map((ratio) => Math.abs(ratio - meanRatio) / Math.abs(meanRatio)))
    : null;
  const distinctXCount = new Set(points.map((point) => point.x)).size;
  const enoughPoints = distinctXCount >= 3;
  return {
    enoughPoints,
    distinctXCount,
    ratios,
    meanRatio,
    maxRelativeDeviation,
    proportional: enoughPoints && maxRelativeDeviation !== null && maxRelativeDeviation <= relativeTolerance
  };
}

export function analyzeInvariantEvidence(values: number[], relativeTolerance = .05, minimumPoints = 3) {
  if (relativeTolerance < 0 || !Number.isInteger(minimumPoints) || minimumPoints < 1) {
    throw new RangeError("相对容差不能为负，最低证据点数必须为正整数");
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("不变量证据必须全部为有限数值");
  }
  const meanValue = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const scale = meanValue === null ? null : Math.max(Math.abs(meanValue), 1e-12);
  const maxRelativeDeviation = meanValue !== null && scale !== null && values.length
    ? Math.max(...values.map((value) => Math.abs(value - meanValue) / scale))
    : null;
  const enoughPoints = values.length >= minimumPoints;
  return {
    enoughPoints,
    pointCount: values.length,
    values,
    meanValue,
    maxRelativeDeviation,
    stable: enoughPoints && maxRelativeDeviation !== null && maxRelativeDeviation <= relativeTolerance
  };
}

export function analyzeMeasurementError(measuredValue: number, referenceValue: number, relativeTolerance = .01) {
  if (!Number.isFinite(measuredValue) || !Number.isFinite(referenceValue) || relativeTolerance < 0) {
    throw new RangeError("测量值和参考值必须为有限数值，相对容差不能为负");
  }
  const absoluteError = measuredValue - referenceValue;
  const scale = Math.max(Math.abs(referenceValue), 1e-12);
  const relativeError = absoluteError / scale;
  const withinTolerance = Math.abs(relativeError) <= relativeTolerance;
  return {
    measuredValue,
    referenceValue,
    absoluteError,
    relativeError,
    percentError: relativeError * 100,
    withinTolerance,
    direction: withinTolerance ? "same" as const : absoluteError > 0 ? "high" as const : "low" as const
  };
}

export function analyzeLongitudinalParticleSnapshot(equilibriumPositions: number[], displacements: number[]) {
  if (equilibriumPositions.length !== displacements.length || equilibriumPositions.length < 2) {
    throw new RangeError("平衡位置与位移数量必须相同，且至少包含两个粒子");
  }
  if (equilibriumPositions.some((value) => !Number.isFinite(value)) || displacements.some((value) => !Number.isFinite(value))) {
    throw new RangeError("粒子位置与位移必须为有限数值");
  }
  if (equilibriumPositions.some((value, index) => index > 0 && value <= equilibriumPositions[index - 1]!)) {
    throw new RangeError("粒子平衡位置必须严格递增");
  }
  const positions = equilibriumPositions.map((value, index) => value + displacements[index]!);
  const spacings = positions.slice(1).map((value, index) => value - positions[index]!);
  const compressionGapIndex = spacings.indexOf(Math.min(...spacings));
  const rarefactionGapIndex = spacings.indexOf(Math.max(...spacings));
  const gapCenter = (index: number) => (positions[index]! + positions[index + 1]!) / 2;
  return {
    positions,
    spacings,
    compressionGapIndex,
    rarefactionGapIndex,
    compressionCenter: gapCenter(compressionGapIndex),
    rarefactionCenter: gapCenter(rarefactionGapIndex),
    minimumSpacing: spacings[compressionGapIndex]!,
    maximumSpacing: spacings[rarefactionGapIndex]!
  };
}
