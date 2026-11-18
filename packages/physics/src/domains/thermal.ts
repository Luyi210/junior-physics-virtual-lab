

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
