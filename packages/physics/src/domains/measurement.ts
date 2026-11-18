

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
