import { boundedTime, finiteNumber, HIGH_SCHOOL_GRAVITY } from "@physics-lab/physics/high-school/types";

export interface MechanicalEnergyParameters { mass: number; dropHeight: number; resistanceRatio: number }
/** Synchronized ideal release and tape timer, in seconds; not a user-adjustable parameter. */
export const MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS = 0.02;
export interface MechanicalEnergyTapePoint { index: number; timeSeconds: number; positionMm: number }

/** SI units. Downwards is positive; a constant upward resistance is a teaching
 * model, not an air-drag law. The endpoint is the instant before impact. */
export function calculateMechanicalEnergy(parameters: MechanicalEnergyParameters, timeSeconds = 0) {
  const mass = finiteNumber(parameters.mass, "质量", 0.05, 1);
  const dropHeight = finiteNumber(parameters.dropHeight, "释放高度", 0.5, 2);
  const resistanceRatio = finiteNumber(parameters.resistanceRatio, "恒定阻力与重力之比", 0, 0.4);
  const acceleration = HIGH_SCHOOL_GRAVITY * (1 - resistanceRatio);
  const durationSeconds = Math.sqrt(2 * dropHeight / acceleration);
  const time = boundedTime(timeSeconds, durationSeconds);
  const position = Math.min(dropHeight, 0.5 * acceleration * time ** 2);
  const height = Math.max(0, dropHeight - position);
  const velocity = acceleration * time;
  const resistanceForce = resistanceRatio * mass * HIGH_SCHOOL_GRAVITY;
  const kineticEnergy = 0.5 * mass * velocity ** 2;
  const potentialEnergy = mass * HIGH_SCHOOL_GRAVITY * height;
  const potentialEnergyLoss = mass * HIGH_SCHOOL_GRAVITY * position;
  const dissipatedEnergy = resistanceForce * position;
  return { mass, dropHeight, resistanceRatio, time, durationSeconds, position, height, velocity, acceleration,
    resistanceForce, kineticEnergy, potentialEnergy, potentialEnergyLoss, dissipatedEnergy,
    totalMechanicalEnergy: kineticEnergy + potentialEnergy };
}

/** Only equal-time points that have actually appeared. Never append a clamped,
 * non-grid landing frame as if it were another 0.02 s tape interval. */
export function mechanicalEnergyTapePoints(parameters: MechanicalEnergyParameters | Record<string, number>, timeSeconds?: number): MechanicalEnergyTapePoint[] {
  const input = { mass: parameters.mass!, dropHeight: parameters.dropHeight!, resistanceRatio: parameters.resistanceRatio! };
  const initial = calculateMechanicalEnergy(input);
  const end = boundedTime(timeSeconds === undefined ? initial.durationSeconds : timeSeconds, initial.durationSeconds);
  const points: MechanicalEnergyTapePoint[] = [];
  for (let index = 0; ; index += 1) {
    const time = Number((index * MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS).toFixed(2));
    if (time > end) break;
    points.push({ index, timeSeconds: time, positionMm: calculateMechanicalEnergy(input, time).position * 1000 });
  }
  return points;
}
