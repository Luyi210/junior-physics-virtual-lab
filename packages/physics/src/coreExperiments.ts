export type CircuitTopology = "series" | "parallel";

export interface TwoLoadCircuitState {
  totalCurrent: number;
  equivalentResistance: number;
  branchCurrents: [number, number];
  loadVoltages: [number, number];
  loadPowers: [number, number];
  energized: boolean;
}

export function calculateTwoLoadCircuit(
  topology: CircuitTopology,
  voltage: number,
  r1: number,
  r2: number,
  closed = true,
  load1Connected = true,
  load2Connected = true
): TwoLoadCircuitState {
  if (voltage < 0 || r1 <= 0 || r2 <= 0) throw new RangeError("电压不能为负，电阻必须大于零");

  if (!closed) {
    return {
      totalCurrent: 0,
      equivalentResistance: Infinity,
      branchCurrents: [0, 0],
      loadVoltages: [0, 0],
      loadPowers: [0, 0],
      energized: false
    };
  }

  if (topology === "series") {
    const current = load1Connected && load2Connected ? voltage / (r1 + r2) : 0;
    return {
      totalCurrent: current,
      equivalentResistance: current > 0 ? r1 + r2 : Infinity,
      branchCurrents: [current, current],
      loadVoltages: [current * r1, current * r2],
      loadPowers: [current * current * r1, current * current * r2],
      energized: current > 0
    };
  }

  const current1 = load1Connected ? voltage / r1 : 0;
  const current2 = load2Connected ? voltage / r2 : 0;
  const totalCurrent = current1 + current2;
  return {
    totalCurrent,
    equivalentResistance: totalCurrent > 0 ? voltage / totalCurrent : Infinity,
    branchCurrents: [current1, current2],
    loadVoltages: [load1Connected ? voltage : 0, load2Connected ? voltage : 0],
    loadPowers: [current1 * current1 * r1, current2 * current2 * r2],
    energized: totalCurrent > 0
  };
}

export function calculateCircuit(topology: CircuitTopology, voltage: number, r1: number, r2: number, closed = true) {
  if (voltage < 0 || r1 <= 0 || r2 <= 0) throw new RangeError("电压不能为负，电阻必须大于零");
  const totalResistance = topology === "series" ? r1 + r2 : 1 / (1 / r1 + 1 / r2);
  const totalCurrent = closed ? voltage / totalResistance : 0;
  return { totalResistance, totalCurrent, totalPower: voltage * totalCurrent };
}

export function calculateProtectedShortCircuit(
  sourceVoltage: number,
  sourceInternalResistance = .8,
  fuseRatingAmps = 5
) {
  if (sourceVoltage <= 0 || sourceInternalResistance <= 0 || fuseRatingAmps <= 0) throw new RangeError("电源电压、内阻和熔断额定电流必须大于零");
  const prospectiveCurrent = sourceVoltage / sourceInternalResistance;
  const fuseTrips = prospectiveCurrent > fuseRatingAmps;
  const overloadMultiple = prospectiveCurrent / fuseRatingAmps;
  return { prospectiveCurrent, fuseTrips, overloadMultiple };
}

export function calculateLever(leftForce: number, leftArm: number, rightForce: number, rightArm: number) {
  const leftMoment = leftForce * leftArm;
  const rightMoment = rightForce * rightArm;
  const difference = rightMoment - leftMoment;
  return { leftMoment, rightMoment, difference, balanced: Math.abs(difference) < 0.05 };
}

/**
 * Turning effect of an oblique force. The lever arm is the perpendicular
 * distance from the pivot to the force's line of action, not the rod length.
 */
export function calculateLeverForceLine(force: number, pivotDistance: number, forceAngleDegrees: number) {
  if (force < 0 || pivotDistance <= 0 || forceAngleDegrees < 0 || forceAngleDegrees > 180) {
    throw new RangeError("力不能为负，悬点距离必须大于零，夹角应在0～180°之间");
  }
  const angleRadians = forceAngleDegrees * Math.PI / 180;
  const perpendicularArm = pivotDistance * Math.abs(Math.sin(angleRadians));
  return { perpendicularArm, moment: force * perpendicularArm };
}

export function calculateHeatingTemperature(
  timeSeconds: number,
  powerWatts: number,
  waterMassGrams: number,
  initialTemperature = 25,
  boilingPoint = 100,
  efficiency = 0.85
) {
  if (timeSeconds < 0 || powerWatts < 0) throw new RangeError("加热时间和功率不能为负");
  if (waterMassGrams <= 0) throw new RangeError("水的质量必须大于零");
  if (efficiency <= 0 || efficiency > 1) throw new RangeError("加热效率应大于 0 且不超过 1");
  // Q = ηPt = cmΔT.  Water's specific heat capacity is 4.2 J/(g·℃).
  const temperatureRise = efficiency * powerWatts * timeSeconds / (4.2 * waterMassGrams);
  return Math.min(boilingPoint, initialTemperature + temperatureRise);
}

/** Antoine-equation classroom approximation for water between 60 and 200 kPa. */
export function calculateWaterBoilingPoint(atmosphericPressureKilopascals: number) {
  if (atmosphericPressureKilopascals < 60 || atmosphericPressureKilopascals > 200) throw new RangeError("水的沸点模型适用于60～200 kPa");
  const pressureMillimetersMercury = atmosphericPressureKilopascals * 760 / 101.325;
  const constants = atmosphericPressureKilopascals <= 101.325
    ? { a: 8.07131, b: 1730.63, c: 233.426 }
    : { a: 8.14019, b: 1810.94, c: 244.485 };
  return constants.b / (constants.a - Math.log10(pressureMillimetersMercury)) - constants.c;
}

export function calculateElectromagnetExperiment(
  turns: number,
  currentAmps: number,
  hasIronCore: boolean,
  poweredSeconds: number
) {
  if (turns <= 0) throw new RangeError("线圈匝数必须大于零");
  if (currentAmps < 0 || poweredSeconds < 0) throw new RangeError("电流和通电时间不能为负");
  const coreFactor = hasIronCore ? 1 : 0.18;
  const strengthIndex = turns * currentAmps * coreFactor / 100;
  // Fixed classroom nail batch: pickup count is a reproducible teaching proxy, not magnetic flux density.
  const pickedNails = currentAmps > 0 ? Math.max(0, Math.min(12, Math.floor(strengthIndex * 4))) : 0;
  // Relative coil heating model based on the I²Rt trend under a fixed coil construction.
  const temperatureRise = currentAmps * currentAmps * poweredSeconds * 0.18;
  return { strengthIndex, pickedNails, temperatureRise, overheatRisk: temperatureRise >= 8 };
}

export type ElectromagnetCurrentDirection = "forward" | "reverse";

/** Fixed winding direction: reversing the power leads reverses the current and swaps both magnetic poles. */
export function calculateElectromagnetPolarity(currentDirection: ElectromagnetCurrentDirection) {
  if (currentDirection !== "forward" && currentDirection !== "reverse") throw new RangeError("电流方向必须为正接或反接");
  const rightPole = currentDirection === "forward" ? "N" : "S";
  const leftPole = rightPole === "N" ? "S" : "N";
  // The compass is placed just to the right of the solenoid. Its north end points away from N and toward S.
  const compassNorthDirection = rightPole === "N" ? "right" : "left";
  return { leftPole, rightPole, compassNorthDirection } as const;
}

export function calculateIceMeltingState(
  timeSeconds: number,
  powerWatts: number,
  iceMassGrams: number,
  initialTemperature = -10,
  efficiency = 0.65
) {
  if (timeSeconds < 0 || powerWatts < 0) throw new RangeError("加热时间和功率不能为负");
  if (iceMassGrams <= 0) throw new RangeError("冰的质量必须大于零");
  if (initialTemperature > 0) throw new RangeError("冰的初温不应高于熔点");
  if (efficiency <= 0 || efficiency > 1) throw new RangeError("加热效率应大于0且不超过1");
  const usefulHeat = efficiency * powerWatts * timeSeconds;
  const heatToMeltingPoint = iceMassGrams * 2.1 * Math.abs(initialTemperature);
  const meltingHeat = iceMassGrams * 334;
  if (usefulHeat < heatToMeltingPoint) {
    return { temperature: initialTemperature + usefulHeat / (iceMassGrams * 2.1), phase: "solid" as const, meltedFraction: 0 };
  }
  if (usefulHeat < heatToMeltingPoint + meltingHeat) {
    return { temperature: 0, phase: "melting" as const, meltedFraction: (usefulHeat - heatToMeltingPoint) / meltingHeat };
  }
  const waterTemperature = (usefulHeat - heatToMeltingPoint - meltingHeat) / (iceMassGrams * 4.2);
  return { temperature: waterTemperature, phase: "liquid" as const, meltedFraction: 1 };
}

export function calculateInclinedCartRun(
  trackLengthMeters: number,
  verticalHeightMeters: number,
  rollingFactor = 0.72,
  gravity = 10
) {
  if (trackLengthMeters <= 0) throw new RangeError("轨道路程必须大于零");
  if (verticalHeightMeters <= 0 || verticalHeightMeters >= trackLengthMeters) throw new RangeError("轨道高度应大于零且小于轨道路程");
  if (rollingFactor <= 0 || rollingFactor > 1) throw new RangeError("滚动修正系数应大于0且不超过1");
  const acceleration = gravity * verticalHeightMeters / trackLengthMeters * rollingFactor;
  const timeSeconds = Math.sqrt(2 * trackLengthMeters / acceleration);
  const averageSpeed = trackLengthMeters / timeSeconds;
  const finalSpeed = acceleration * timeSeconds;
  return { acceleration, timeSeconds, averageSpeed, finalSpeed };
}

export function calculateFrictionRegime(
  normalForceNewtons: number,
  kineticCoefficient: number,
  pullForceNewtons: number,
  alreadySliding: boolean,
  staticToKineticRatio = 1.25
) {
  if (normalForceNewtons <= 0) throw new RangeError("压力必须大于零");
  if (kineticCoefficient < 0 || pullForceNewtons < 0) throw new RangeError("摩擦系数和拉力不能为负");
  if (staticToKineticRatio < 1) throw new RangeError("最大静摩擦力不应小于滑动摩擦力");
  const kineticFriction = normalForceNewtons * kineticCoefficient;
  const maximumStaticFriction = kineticFriction * staticToKineticRatio;
  const startsSliding = alreadySliding || pullForceNewtons > maximumStaticFriction;
  const frictionForce = startsSliding ? kineticFriction : Math.min(pullForceNewtons, maximumStaticFriction);
  const accelerationTrend = !startsSliding ? "stationary" as const : Math.abs(pullForceNewtons - kineticFriction) <= .11 ? "uniform" as const : pullForceNewtons > kineticFriction ? "accelerating" as const : "slowing" as const;
  return { kineticFriction, maximumStaticFriction, frictionForce, startsSliding, accelerationTrend };
}

export function calculateSolidPressure(forceNewtons: number, areaSquareCentimeters: number) {
  if (forceNewtons < 0) throw new RangeError("压力不能为负");
  if (areaSquareCentimeters <= 0) throw new RangeError("受力面积必须大于零");
  const areaSquareMeters = areaSquareCentimeters / 10000;
  const pressurePascals = forceNewtons / areaSquareMeters;
  // Relative indentation for one fixed foam pad; used only as a comparison cue.
  const indentationMillimeters = Math.min(18, pressurePascals / 2500);
  return { areaSquareMeters, pressurePascals, indentationMillimeters };
}

export function calculateAppliancePower(
  ratedVoltage: number,
  ratedPower: number,
  actualVoltage: number,
  operatingSeconds: number
) {
  if (ratedVoltage <= 0 || ratedPower <= 0) throw new RangeError("额定电压和额定功率必须大于零");
  if (actualVoltage < 0 || operatingSeconds < 0) throw new RangeError("实际电压和工作时间不能为负");
  // Treat the appliance as a fixed resistance derived from its nameplate for this junior-high teaching model.
  const resistance = ratedVoltage * ratedVoltage / ratedPower;
  const current = actualVoltage / resistance;
  const actualPower = actualVoltage * current;
  const energyJoules = actualPower * operatingSeconds;
  const energyKilowattHours = energyJoules / 3_600_000;
  const voltageRatio = actualVoltage / ratedVoltage;
  const operatingState = voltageRatio > 1.1 ? "overvoltage" as const : voltageRatio < .9 ? "undervoltage" as const : "normal" as const;
  return { resistance, current, actualPower, energyJoules, energyKilowattHours, voltageRatio, operatingState };
}

export function calculateEvaporationTrial(
  initialWaterMassGrams: number,
  temperatureCelsius: number,
  exposedAreaSquareCentimeters: number,
  airflowMetersPerSecond: number,
  durationSeconds: number
) {
  if (initialWaterMassGrams <= 0) throw new RangeError("水样初始质量必须大于零");
  if (temperatureCelsius < 0 || temperatureCelsius >= 100) throw new RangeError("蒸发实验温度应在0℃到100℃之间");
  if (exposedAreaSquareCentimeters <= 0 || airflowMetersPerSecond < 0 || durationSeconds < 0) throw new RangeError("表面积必须大于零，风速和时间不能为负");
  // Controlled classroom microbalance proxy: calibrated for comparisons of one water sample and one environment.
  const temperatureFactor = .45 + temperatureCelsius / 50;
  const airflowFactor = 1 + .65 * airflowMetersPerSecond;
  const evaporationRateGramsPerMinute = .08 * exposedAreaSquareCentimeters / 100 * temperatureFactor * airflowFactor;
  const evaporatedMassGrams = Math.min(initialWaterMassGrams, evaporationRateGramsPerMinute * durationSeconds / 60);
  const remainingMassGrams = initialWaterMassGrams - evaporatedMassGrams;
  return { temperatureFactor, airflowFactor, evaporationRateGramsPerMinute, evaporatedMassGrams, remainingMassGrams };
}

export function calculateMassVolumeSample(densityGramsPerCubicCentimeter: number, volumeCubicCentimeters: number) {
  if (densityGramsPerCubicCentimeter <= 0 || volumeCubicCentimeters <= 0) throw new RangeError("密度和体积必须大于零");
  const massGrams = densityGramsPerCubicCentimeter * volumeCubicCentimeters;
  return { massGrams, ratio: massGrams / volumeCubicCentimeters };
}

export function calculateBalanceReading(actualMassGrams: number, zeroOffsetGrams = 0, divisionGrams = .1) {
  if (!Number.isFinite(actualMassGrams) || actualMassGrams <= 0) throw new RangeError("待测质量必须是大于零的有限数值");
  if (!Number.isFinite(zeroOffsetGrams) || !Number.isFinite(divisionGrams) || divisionGrams <= 0) throw new RangeError("零点偏移必须有限，分度值必须大于零");
  const unroundedReading = actualMassGrams + zeroOffsetGrams;
  if (unroundedReading < 0) throw new RangeError("零点偏移不能使天平示数小于零");
  const readingGrams = Math.round(unroundedReading / divisionGrams) * divisionGrams;
  const absoluteErrorGrams = readingGrams - actualMassGrams;
  return { readingGrams, actualMassGrams, zeroOffsetGrams, divisionGrams, absoluteErrorGrams };
}

export function calculateDensity(mass: number, volume: number) {
  if (volume <= 0) throw new RangeError("体积必须大于零");
  return mass / volume;
}

export function calculateReflection(incidenceAngle: number) {
  if (!Number.isFinite(incidenceAngle) || incidenceAngle < 0 || incidenceAngle >= 90) throw new RangeError("入射角应在 0° 到 90° 之间");
  return { incidenceAngle, reflectionAngle: incidenceAngle };
}

export function calculateRefraction(incidenceAngle: number, incidentIndex: number, refractedIndex: number) {
  if (!Number.isFinite(incidenceAngle) || incidenceAngle < 0 || incidenceAngle >= 90) throw new RangeError("入射角应在 0° 到 90° 之间");
  if (!Number.isFinite(incidentIndex) || !Number.isFinite(refractedIndex) || incidentIndex <= 0 || refractedIndex <= 0) throw new RangeError("介质折射率必须大于零");

  const incidenceRadians = incidenceAngle * Math.PI / 180;
  const sineOfRefraction = incidentIndex * Math.sin(incidenceRadians) / refractedIndex;
  if (sineOfRefraction > 1 + 1e-12) {
    return { incidenceAngle, refractionAngle: null, totalInternalReflection: true };
  }

  return {
    incidenceAngle,
    refractionAngle: Math.asin(Math.max(-1, Math.min(1, sineOfRefraction))) * 180 / Math.PI,
    totalInternalReflection: false
  };
}

export type SphericalMirrorType = "concave" | "convex";

export function calculateSphericalMirror(type: SphericalMirrorType, objectDistance: number, focalLength = 120) {
  if (objectDistance <= 0 || focalLength <= 0) throw new RangeError("物距和焦距必须大于零");
  const signedFocalLength = type === "concave" ? focalLength : -focalLength;
  const atFocus = type === "concave" && Math.abs(objectDistance - focalLength) < 1e-9;
  if (atFocus) {
    return { atFocus: true, imageDistance: Infinity, magnification: Infinity, real: false, nature: "反射光近似平行，像在无穷远" };
  }

  const imageDistance = signedFocalLength * objectDistance / (objectDistance - signedFocalLength);
  const magnification = -imageDistance / objectDistance;
  const real = imageDistance > 0;
  const nature = type === "convex"
    ? "正立、缩小的虚像，视野更大"
    : real
      ? Math.abs(magnification) > 1.05
        ? "倒立、放大的实像"
        : Math.abs(magnification) < .95
          ? "倒立、缩小的实像"
          : "倒立、等大的实像"
      : "正立、放大的虚像";

  return { atFocus: false, imageDistance, magnification, real, nature };
}
