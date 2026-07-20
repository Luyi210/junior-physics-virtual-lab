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

export function calculateLever(leftForce: number, leftArm: number, rightForce: number, rightArm: number) {
  const leftMoment = leftForce * leftArm;
  const rightMoment = rightForce * rightArm;
  const difference = rightMoment - leftMoment;
  return { leftMoment, rightMoment, difference, balanced: Math.abs(difference) < 0.05 };
}

export function calculateHeatingTemperature(time: number, power: number, waterMass: number, initialTemperature = 25, boilingPoint = 100) {
  if (waterMass <= 0) throw new RangeError("水的质量必须大于零");
  return Math.min(boilingPoint, initialTemperature + time * power * 160 / waterMass);
}

export function calculateDensity(mass: number, volume: number) {
  if (volume <= 0) throw new RangeError("体积必须大于零");
  return mass / volume;
}

export function calculateReflection(incidenceAngle: number) {
  if (incidenceAngle < 0 || incidenceAngle >= 90) throw new RangeError("入射角应在 0° 到 90° 之间");
  return { incidenceAngle, reflectionAngle: incidenceAngle };
}

export function calculateRefraction(incidenceAngle: number, incidentIndex: number, refractedIndex: number) {
  if (incidenceAngle < 0 || incidenceAngle >= 90) throw new RangeError("入射角应在 0° 到 90° 之间");
  if (incidentIndex <= 0 || refractedIndex <= 0) throw new RangeError("介质折射率必须大于零");

  const incidenceRadians = incidenceAngle * Math.PI / 180;
  const sineOfRefraction = incidentIndex * Math.sin(incidenceRadians) / refractedIndex;
  if (sineOfRefraction > 1) {
    return { incidenceAngle, refractionAngle: null, totalInternalReflection: true };
  }

  return {
    incidenceAngle,
    refractionAngle: Math.asin(sineOfRefraction) * 180 / Math.PI,
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
