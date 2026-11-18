import { boundedTime, finiteNumber, HIGH_SCHOOL_GRAVITY, positiveNumber } from "@physics-lab/physics/high-school/types";

/** SI length m (pivot to bob centre), mass kg; release at rest from amplitudeDegrees. */
export interface PendulumParameters { length: number; amplitudeDegrees: number; mass: number }

/** Display/observation setting only; this does not count or identify oscillations. */
export const PENDULUM_OBSERVATION_SECONDS = 60;

function parametersOf(parameters: PendulumParameters) {
  const length = positiveNumber(parameters.length, "摆长");
  const mass = positiveNumber(parameters.mass, "摆球质量");
  // Below 90° the released light string remains taut; zero amplitude has a limiting period.
  const amplitude = finiteNumber(parameters.amplitudeDegrees, "摆角", 0, 75) * Math.PI / 180;
  return { length, mass, amplitude };
}

export function calculatePendulumPeriod(parameters: PendulumParameters) {
  const { length, amplitude } = parametersOf(parameters);
  const smallAnglePeriod = 2 * Math.PI * Math.sqrt(length / HIGH_SCHOOL_GRAVITY);
  // Smooth complete-elliptic-integral substitution; composite Simpson quadrature.
  const kSquared = Math.sin(amplitude / 2) ** 2;
  const count = 256;
  const step = Math.PI / (2 * count);
  let sum = 0;
  for (let i = 0; i <= count; i += 1) {
    const weight = i === 0 || i === count ? 1 : i % 2 === 0 ? 2 : 4;
    sum += weight / Math.sqrt(1 - kSquared * Math.sin(i * step) ** 2);
  }
  const period = 4 * Math.sqrt(length / HIGH_SCHOOL_GRAVITY) * step * sum / 3;
  return { period, smallAnglePeriod, periodIncreasePercent: (period / smallAnglePeriod - 1) * 100 };
}

export function calculatePendulum(parameters: PendulumParameters, timeSeconds: number) {
  const { length, mass, amplitude } = parametersOf(parameters);
  const periodInfo = calculatePendulumPeriod(parameters);
  const durationSeconds = PENDULUM_OBSERVATION_SECONDS;
  const time = boundedTime(timeSeconds, durationSeconds);
  // Integrate the nonlinear equation θ''=−g sinθ/L with fourth-order Runge–Kutta.
  // Reducing by the numerically integrated period bounds both work and accumulated drift.
  const elapsed = time % periodInfo.period;
  const steps = Math.ceil(elapsed / (periodInfo.smallAnglePeriod / 1200));
  const h = steps ? elapsed / steps : 0;
  const acceleration = (angle: number) => -HIGH_SCHOOL_GRAVITY / length * Math.sin(angle);
  let angleRadians = amplitude;
  let angularVelocity = 0;
  for (let i = 0; i < steps; i += 1) {
    const k1a = angularVelocity; const k1w = acceleration(angleRadians);
    const k2a = angularVelocity + h * k1w / 2; const k2w = acceleration(angleRadians + h * k1a / 2);
    const k3a = angularVelocity + h * k2w / 2; const k3w = acceleration(angleRadians + h * k2a / 2);
    const k4a = angularVelocity + h * k3w; const k4w = acceleration(angleRadians + h * k3a);
    angleRadians += h * (k1a + 2 * k2a + 2 * k3a + k4a) / 6;
    angularVelocity += h * (k1w + 2 * k2w + 2 * k3w + k4w) / 6;
  }
  const kineticEnergy = mass * (length * angularVelocity) ** 2 / 2;
  const potentialEnergy = mass * HIGH_SCHOOL_GRAVITY * length * (1 - Math.cos(angleRadians));
  return { time, angleRadians, angleDegrees: angleRadians * 180 / Math.PI, angularVelocity, x: length * Math.sin(angleRadians), y: -length * Math.cos(angleRadians), length,
    kineticEnergy, potentialEnergy, totalEnergy: kineticEnergy + potentialEnergy, durationSeconds, ...periodInfo };
}
