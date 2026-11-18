import { finiteNumber } from "@physics-lab/physics/high-school/types";

/** Magnitudes in N; direction angles in degrees counterclockwise from +x.
 * The trial is independently chosen by the learner, never filled from the resultant.
 */
export interface ForceCompositionParameters {
  force1N: number;
  angle1Degrees: number;
  force2N: number;
  angle2Degrees: number;
  trialForceN: number;
  trialAngleDegrees: number;
}

const unsignedZero = (value: number) => value === 0 ? 0 : value;
const normalizedDegrees = (degrees: number) => {
  const remainder = degrees % 360;
  return unsignedZero(remainder >= 180 ? remainder - 360 : remainder < -180 ? remainder + 360 : remainder);
};

function components(magnitude: number, angle: number) {
  // Exact cardinal components avoid treating sin(π)'s floating-point remainder
  // as a real vertical force. Other directions retain full floating precision.
  if (magnitude === 0) return { x: 0, y: 0 };
  if (angle === 0) return { x: magnitude, y: 0 };
  if (angle === 90) return { x: 0, y: magnitude };
  if (angle === -90) return { x: 0, y: -magnitude };
  if (Math.abs(angle) === 180) return { x: -magnitude, y: 0 };
  const radians = angle * Math.PI / 180;
  return { x: unsignedZero(magnitude * Math.cos(radians)), y: unsignedZero(magnitude * Math.sin(radians)) };
}

function vector(x: number, y: number, referenceMagnitude: number) {
  const magnitude = Math.hypot(x, y);
  // Relative machine-rounding tolerance only, not a measurement resolution or
  // a learner-success threshold. Small nonzero forces are not rounded to 0 N.
  if (magnitude <= 64 * Number.EPSILON * referenceMagnitude) return { x: 0, y: 0, magnitude: 0 };
  return { x: unsignedZero(x), y: unsignedZero(y), magnitude };
}

/** Two planar forces on the same point, with a separate candidate equivalent
 * force. No motion, apparatus noise, spring extension or measured accuracy.
 */
export function calculateForceComposition(parameters: ForceCompositionParameters) {
  const force1N = finiteNumber(parameters.force1N, "力 F₁", 0, 5);
  const force2N = finiteNumber(parameters.force2N, "力 F₂", 0, 5);
  const trialForceN = finiteNumber(parameters.trialForceN, "试配等效拉力", 0, 10);
  const angle1Degrees = finiteNumber(parameters.angle1Degrees, "力 F₁ 方向角", -180, 180);
  const angle2Degrees = finiteNumber(parameters.angle2Degrees, "力 F₂ 方向角", -180, 180);
  const trialAngleDegrees = finiteNumber(parameters.trialAngleDegrees, "试配力方向角", -180, 180);
  const first = components(force1N, angle1Degrees);
  const second = components(force2N, angle2Degrees);
  const trial = components(trialForceN, trialAngleDegrees);
  const resultant = vector(first.x + second.x, first.y + second.y, Math.max(force1N, force2N));
  const residual = vector(trial.x - resultant.x, trial.y - resultant.y, Math.max(trialForceN, resultant.magnitude));
  const resultantDirectionDefined = resultant.magnitude > 0 ? 1 : 0;
  const angleBetweenDefined = force1N > 0 && force2N > 0 ? 1 : 0;
  const angleBetweenDegrees = angleBetweenDefined ? Math.abs(normalizedDegrees(angle2Degrees - angle1Degrees)) : 0;
  const angleBetweenCosine = angleBetweenDefined ? components(1, angleBetweenDegrees).x : 0;
  return {
    time: 0, force1N, force2N, trialForceN,
    force1X: first.x, force1Y: first.y, force2X: second.x, force2Y: second.y,
    resultantX: resultant.x, resultantY: resultant.y,
    resultantMagnitude: resultant.magnitude, resultantSquared: resultant.magnitude ** 2,
    resultantAngleDegrees: resultantDirectionDefined ? normalizedDegrees(Math.atan2(resultant.y, resultant.x) * 180 / Math.PI) : 0,
    resultantDirectionDefined,
    trialX: trial.x, trialY: trial.y,
    residualX: residual.x, residualY: residual.y, residualMagnitude: residual.magnitude,
    angleBetweenDegrees, angleBetweenDefined, angleBetweenCosine
  };
}
