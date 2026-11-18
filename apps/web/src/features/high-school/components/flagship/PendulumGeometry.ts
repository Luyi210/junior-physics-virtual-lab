import { HIGH_SCHOOL_EXPERIMENTS } from '@physics-lab/physics/high-school';

export type PendulumPoint = { x: number; y: number };
export type PendulumWorldPoint = [number, number, number];
const angleParameter = HIGH_SCHOOL_EXPERIMENTS.find(item => item.id === 'pendulum')!.parameters.find(item => item.key === 'amplitudeDegrees')!;
export const PENDULUM_ANGLE = { min: angleParameter.min, max: angleParameter.max, step: angleParameter.step };
export const PENDULUM_SVG = { width: 700, height: 390, pivot: { x: 350, y: 61 }, unitsPerMetre: 134, bobRadius: 13 };
export const PENDULUM_WORLD = { pivot: [0, 2.6, 0] as PendulumWorldPoint, unitsPerMetre: 1.6, bobRadius: .17 };

export function pendulumAmplitude(value: number) {
  return Math.min(PENDULUM_ANGLE.max, Math.max(PENDULUM_ANGLE.min, Math.round(value / PENDULUM_ANGLE.step) * PENDULUM_ANGLE.step));
}
export function pendulumSvgPoint(x: number, y: number): PendulumPoint {
  return { x: PENDULUM_SVG.pivot.x + x * PENDULUM_SVG.unitsPerMetre, y: PENDULUM_SVG.pivot.y - y * PENDULUM_SVG.unitsPerMetre };
}
export function pendulumWorldPoint(x: number, y: number): PendulumWorldPoint {
  return [x * PENDULUM_WORLD.unitsPerMetre, PENDULUM_WORLD.pivot[1] + y * PENDULUM_WORLD.unitsPerMetre, 0];
}
/** Geometry of a marked release position, not a second simulation. */
export function pendulumReleasePoint(length: number, degrees: number) {
  const angle = degrees * Math.PI / 180;
  const x = length * Math.sin(angle), y = -length * Math.cos(angle);
  return { svg: pendulumSvgPoint(x, y), world: pendulumWorldPoint(x, y) };
}
export function pendulumGeometry(parameters: Record<string, number>, state: Record<string, number>) {
  const bob = pendulumSvgPoint(state.x, state.y), worldBob = pendulumWorldPoint(state.x, state.y);
  const release = pendulumReleasePoint(parameters.length, parameters.amplitudeDegrees);
  const mirror = pendulumReleasePoint(parameters.length, -parameters.amplitudeDegrees);
  const direction = Math.abs(state.angularVelocity) < 1e-7 ? 0 : Math.sign(state.angularVelocity);
  const unitX = -state.y / parameters.length, unitY = state.x / parameters.length;
  const arrow = direction ? { from: bob, to: { x: bob.x + direction * unitX * 37, y: bob.y - direction * unitY * 37 } } : null;
  const worldArrow = direction ? { start: worldBob, end: [worldBob[0] + direction * unitX * .52, worldBob[1] + direction * unitY * .52, 0] as PendulumWorldPoint } : null;
  const arc = Array.from({ length: 61 }, (_, index) => pendulumReleasePoint(parameters.length, -parameters.amplitudeDegrees + 2 * parameters.amplitudeDegrees * index / 60));
  return { bob, worldBob, release, mirror, arrow, worldArrow, arc, direction,
    directionLabel: direction < 0 ? '向左摆动' : direction > 0 ? '向右摆动' : '转向点 · 瞬时静止' };
}
export function pendulumDragAmplitude(point: PendulumPoint): number | null {
  const dx = point.x - PENDULUM_SVG.pivot.x, dy = point.y - PENDULUM_SVG.pivot.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 6) return null;
  return pendulumAmplitude(Math.atan2(dx, dy) * 180 / Math.PI);
}
/** Accounts for letterboxing from preserveAspectRatio="xMidYMid meet". */
export function pendulumClientPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): PendulumPoint | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const scale = Math.min(rect.width / PENDULUM_SVG.width, rect.height / PENDULUM_SVG.height);
  return { x: (clientX - rect.left - (rect.width - PENDULUM_SVG.width * scale) / 2) / scale, y: (clientY - rect.top - (rect.height - PENDULUM_SVG.height * scale) / 2) / scale };
}
