import { finiteNumber, HIGH_SCHOOL_GRAVITY, positiveNumber } from "@physics-lab/physics/high-school/types";

/** Preset teaching-model domain in metres, not a measured limit for a real spring. */
export const SPRING_LINEAR_EXTENSION_LIMIT = 0.25;

/** stiffness N/m, naturalLength m, loadMassGrams g (total suspended mass, including a pan/hook). */
export interface SpringForceParameters { stiffness: number; naturalLength: number; loadMassGrams: number }

/** Quasistatic equilibrium of an ideal massless spring. Force is its upward magnitude,
 * equal to the total suspended weight only in this static model. No oscillation or yield law.
 */
export function calculateSpringForce(parameters: SpringForceParameters) {
  const stiffness = positiveNumber(parameters.stiffness, "劲度系数");
  const naturalLength = positiveNumber(parameters.naturalLength, "弹簧原长");
  const loadMassGrams = finiteNumber(parameters.loadMassGrams, "悬挂总质量（含托盘）", 0);
  const loadMassKg = loadMassGrams / 1000;
  const force = finiteNumber(loadMassKg * HIGH_SCHOOL_GRAVITY, "弹力大小", 0);
  const extension = finiteNumber(force / stiffness, "本模型线性范围内的伸长量", 0, SPRING_LINEAR_EXTENSION_LIMIT);
  const length = finiteNumber(naturalLength + extension, "弹簧总长", naturalLength);
  return { time: 0, force, extension, length, naturalLength, stiffness, loadMassKg };
}
