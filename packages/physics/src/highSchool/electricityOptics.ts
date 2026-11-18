import { finiteNumber, positiveNumber } from "@physics-lab/physics/high-school/types";

/** SI emf V, internal/load resistance Ω. A steady DC source with a series internal resistor. */
export interface EmfInternalResistanceParameters { emf: number; internalResistance: number; loadResistance: number }

export function calculateEmfInternalResistance(parameters: EmfInternalResistanceParameters) {
  const emf = finiteNumber(parameters.emf, "电动势", 0);
  const internalResistance = finiteNumber(parameters.internalResistance, "内阻", 0);
  const loadResistance = finiteNumber(parameters.loadResistance, "负载电阻", 0);
  const totalResistance = internalResistance + loadResistance;
  if (totalResistance <= 0) throw new RangeError("理想电源不可接零总电阻，短路电流没有有限解");
  const current = emf / totalResistance;
  const terminalVoltage = current * loadResistance;
  const internalVoltage = current * internalResistance;
  const loadPower = current * terminalVoltage;
  const internalPower = current * internalVoltage;
  return { emf, current, terminalVoltage, internalVoltage, loadPower, internalPower,
    sourcePower: emf * current, efficiency: emf > 0 ? terminalVoltage / emf : 0, loadResistance, internalResistance };
}

/** Inputs: wavelength nm; slit separation mm; screen distance m; transverse screen position mm. */
export interface DoubleSlitParameters { wavelengthNm: number; slitSeparationMm: number; screenDistance: number; screenPositionMm: number }

export interface DoubleSlitScreenAssessment {
  screenHalfWidthMm: number;
  visibleBrightFringeCount: number;
  canMeasureFringeSpacing: boolean;
}

function slitPathDifference(screenPosition: number, slitSeparation: number, screenDistance: number) {
  const upperPath = Math.hypot(screenDistance, screenPosition - slitSeparation / 2);
  const lowerPath = Math.hypot(screenDistance, screenPosition + slitSeparation / 2);
  // Rationalized difference avoids subtracting nearly equal metre-scale lengths.
  return 2 * screenPosition * slitSeparation / (lowerPath + upperPath);
}

/** Exact geometry at the screen edge; does not select or supply manual readings. */
export function assessDoubleSlitScreen(parameters: Pick<DoubleSlitParameters, "wavelengthNm" | "slitSeparationMm" | "screenDistance">): DoubleSlitScreenAssessment {
  const wavelength = positiveNumber(parameters.wavelengthNm, "波长") * 1e-9;
  const slitSeparation = positiveNumber(parameters.slitSeparationMm, "缝间距") * 1e-3;
  const screenDistance = positiveNumber(parameters.screenDistance, "屏幕距离");
  const screenHalfWidthMm = 20;
  // Bright fringes satisfy Δ = nλ. Δ(y) increases monotonically on the positive
  // half-screen, so the largest visible order is set by its exact edge value.
  const edgeOrder = slitPathDifference(screenHalfWidthMm * 1e-3, slitSeparation, screenDistance) / wavelength;
  finiteNumber(edgeOrder, "屏内亮纹级次", 0, (Number.MAX_SAFE_INTEGER - 1) / 2);
  // Include a fringe exactly on the boundary despite SI conversion roundoff;
  // this tolerance is at floating-point precision, not a small-angle estimate.
  const highestOrder = Math.floor(edgeOrder + 16 * Number.EPSILON * Math.max(1, edgeOrder));
  const visibleBrightFringeCount = 2 * highestOrder + 1;
  return { screenHalfWidthMm, visibleBrightFringeCount, canMeasureFringeSpacing: visibleBrightFringeCount >= 2 };
}

export function calculateDoubleSlit(parameters: DoubleSlitParameters) {
  const wavelength = positiveNumber(parameters.wavelengthNm, "波长") * 1e-9;
  const slitSeparation = positiveNumber(parameters.slitSeparationMm, "缝间距") * 1e-3;
  const screenDistance = positiveNumber(parameters.screenDistance, "屏幕距离");
  const screenPositionMm = finiteNumber(parameters.screenPositionMm, "屏幕位置");
  const screenPosition = screenPositionMm * 1e-3;
  const pathDifference = slitPathDifference(screenPosition, slitSeparation, screenDistance);
  const phaseDifference = 2 * Math.PI * pathDifference / wavelength;
  const intensity = Math.cos(phaseDifference / 2) ** 2;
  return { wavelength, slitSeparation, screenDistance, screenPosition, screenPositionMm, pathDifference, phaseDifference, intensity,
    fringeSpacing: wavelength * screenDistance / slitSeparation,
    smallAngleRatio: Math.abs(screenPosition) / screenDistance };
}

/** Exact two-point-source geometry for a chosen integral bright-fringe order. Null means no finite point. */
export function calculateDoubleSlitBrightPosition(parameters: DoubleSlitParameters, order: number): number | null {
  const { wavelength, slitSeparation: d, screenDistance: distance } = calculateDoubleSlit(parameters);
  if (!Number.isSafeInteger(order)) throw new RangeError("亮纹级次必须是整数");
  const delta = order * wavelength;
  if (Math.abs(delta) >= d) return null;
  return delta * Math.sqrt(distance * distance / (d * d - delta * delta) + 0.25);
}
