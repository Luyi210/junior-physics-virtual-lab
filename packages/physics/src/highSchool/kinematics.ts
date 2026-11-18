import { boundedTime, finiteNumber, HIGH_SCHOOL_GRAVITY, positiveNumber } from "@physics-lab/physics/high-school/types";

/** SI: initialVelocity m/s, acceleration m/s², duration s; origin x(0)=0. */
export interface UniformAccelerationParameters { initialVelocity: number; acceleration: number; duration: number }

export function calculateUniformAcceleration(parameters: UniformAccelerationParameters, timeSeconds: number) {
  const initialVelocity = finiteNumber(parameters.initialVelocity, "初速度");
  const acceleration = finiteNumber(parameters.acceleration, "加速度");
  const duration = positiveNumber(parameters.duration, "观察时长");
  const time = boundedTime(timeSeconds, duration);
  return { time, position: initialVelocity * time + acceleration * time * time / 2, velocity: initialVelocity + acceleration * time, acceleration };
}

/** SI masses kg, resistance N, travelDistance m. Ideal light string/pulley; release from rest. */
export interface NewtonSecondLawParameters { cartMass: number; hangingMass: number; resistance: number; travelDistance: number }

export function calculateNewtonSecondLaw(parameters: NewtonSecondLawParameters, timeSeconds: number) {
  const cartMass = positiveNumber(parameters.cartMass, "小车质量");
  const hangingMass = positiveNumber(parameters.hangingMass, "挂码质量");
  const resistance = finiteNumber(parameters.resistance, "等效阻力", 0);
  const travelDistance = positiveNumber(parameters.travelDistance, "可用行程");
  const drivingForce = hangingMass * HIGH_SCHOOL_GRAVITY;
  // Simplified Coulomb model: static-friction maximum equals the kinetic force.
  const startsMoving = drivingForce - resistance > 1e-12 * Math.max(1, drivingForce, resistance);
  const appliedResistance = startsMoving ? resistance : drivingForce;
  const totalMass = cartMass + hangingMass;
  const acceleration = (drivingForce - appliedResistance) / totalMass;
  const durationSeconds = acceleration > 0 ? Math.sqrt(2 * travelDistance / acceleration) : 5;
  const time = boundedTime(timeSeconds, durationSeconds);
  const position = Math.min(travelDistance, acceleration * time * time / 2);
  const velocity = acceleration * time;
  const tension = hangingMass * (HIGH_SCHOOL_GRAVITY - acceleration);
  const kineticEnergy = totalMass * velocity * velocity / 2;
  const dissipatedEnergy = appliedResistance * position;
  return { time, position, velocity, acceleration, tension, cartMass, hangingMass, resistance: appliedResistance,
    totalMass, drivingForce, durationSeconds, kineticEnergy, dissipatedEnergy, lostPotentialEnergy: drivingForce * position };
}

/** SI initialSpeed m/s, initialHeight m; launch angle degrees above horizontal. */
export interface ProjectileMotionParameters { initialSpeed: number; angleDegrees: number; initialHeight: number }

export function calculateProjectileMotion(parameters: ProjectileMotionParameters, timeSeconds: number) {
  const initialSpeed = finiteNumber(parameters.initialSpeed, "初速度大小", 0);
  const angle = finiteNumber(parameters.angleDegrees, "抛射角", 0, 90) * Math.PI / 180;
  const initialHeight = finiteNumber(parameters.initialHeight, "初始高度", 0);
  const vx = initialSpeed * Math.cos(angle);
  const initialVy = initialSpeed * Math.sin(angle);
  const flightTime = (initialVy + Math.sqrt(initialVy ** 2 + 2 * HIGH_SCHOOL_GRAVITY * initialHeight)) / HIGH_SCHOOL_GRAVITY;
  const time = boundedTime(timeSeconds, flightTime);
  const vy = initialVy - HIGH_SCHOOL_GRAVITY * time;
  const x = vx * time;
  const y = Math.max(0, initialHeight + initialVy * time - HIGH_SCHOOL_GRAVITY * time * time / 2);
  const speed = Math.hypot(vx, vy);
  return { time, x, y, vx, vy, speed, flightTime, range: vx * flightTime,
    maximumHeight: initialHeight + initialVy ** 2 / (2 * HIGH_SCHOOL_GRAVITY),
    specificEnergy: speed * speed / 2 + HIGH_SCHOOL_GRAVITY * y };
}
