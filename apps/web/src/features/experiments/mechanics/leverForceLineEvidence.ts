import { calculateLeverForceLine } from "@physics-lab/physics";

export interface LeverForceLineTrial {
  readonly id: string;
  readonly force: number;
  readonly pivotDistance: number;
  readonly angle: number;
  readonly perpendicularArm: number;
  readonly moment: number;
}
export interface LeverForceLineComparison {
  ready: boolean;
  perpendicular: LeverForceLineTrial | null;
  oblique: LeverForceLineTrial | null;
  reason: string;
}
const close = (first: number, second: number) => Math.abs(first - second) <= 1e-9 * Math.max(1, Math.abs(first), Math.abs(second));

export function createLeverForceLineTrial(id: string, force: number, pivotDistance: number, angle: number): LeverForceLineTrial {
  if (!id || ![force, pivotDistance, angle].every(Number.isFinite) || force <= 0 || pivotDistance <= 0 || angle < 0 || angle > 180) throw new RangeError("作用线记录需要编号、正的有限拉力与悬点距离，以及0°至180°的有限夹角。");
  return Object.freeze({ id, force, pivotDistance, angle, ...calculateLeverForceLine(force, pivotDistance, angle) });
}

function validTrial(trial: LeverForceLineTrial) {
  try {
    const expected = createLeverForceLineTrial(trial.id, trial.force, trial.pivotDistance, trial.angle);
    return Number.isFinite(trial.perpendicularArm) && Number.isFinite(trial.moment) && close(trial.perpendicularArm, expected.perpendicularArm) && close(trial.moment, expected.moment);
  } catch { return false; }
}

export function hasLeverForceLineTrial(trials: readonly LeverForceLineTrial[], force: number, pivotDistance: number, angle: number) {
  return trials.some((trial) => validTrial(trial) && close(trial.force, force) && close(trial.pivotDistance, pivotDistance) && close(trial.angle, angle));
}

export function appendLeverForceLineTrial(trials: readonly LeverForceLineTrial[], trial: LeverForceLineTrial) {
  if (!validTrial(trial)) throw new RangeError("作用线记录的力、力臂和力矩不一致。");
  if (hasLeverForceLineTrial(trials, trial.force, trial.pivotDistance, trial.angle)) return trials;
  return [trial, ...trials].slice(0, 12);
}

/** Selects a fair comparison from saved snapshots; never uses current controls. */
export function compareLeverForceLineTrials(trials: readonly LeverForceLineTrial[]): LeverForceLineComparison {
  const valid = trials.filter(validTrial);
  for (const perpendicular of valid.filter((trial) => close(trial.angle, 90))) {
    const oblique = valid.find((trial) => close(trial.angle, 30) && close(trial.force, perpendicular.force) && close(trial.pivotDistance, perpendicular.pivotDistance));
    if (oblique) return { ready: true, perpendicular, oblique, reason: "已保存同一拉力、同一悬点距离下的90°与30°对照。" };
  }
  return { ready: false, perpendicular: null, oblique: null, reason: valid.some((trial) => close(trial.angle, 90)) && valid.some((trial) => close(trial.angle, 30)) ? "已有90°与30°记录，但拉力或悬点距离不同，不能作为只改变角度的对照；请补记同F、同r的一组。" : "保持拉力F与悬点距离r不变，分别保存90°和30°的作用线读数。" };
}

/** SVG coordinates share one origin and one scale with the displayed r and l. */
export function leverForceLineGeometry(pivotDistance: number, angle: number) {
  if (!Number.isFinite(pivotDistance) || pivotDistance < 1 || pivotDistance > 9 || !Number.isFinite(angle) || angle < 30 || angle > 90) throw new RangeError("诊断图仅支持1至9格悬点距离与30°至90°夹角。");
  const pixelsPerUnit = 30;
  const origin = { x: 74, y: 132 };
  const application = { x: origin.x + pivotDistance * pixelsPerUnit, y: origin.y };
  const radians = angle * Math.PI / 180;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  const projection = (origin.x - application.x) * direction.x;
  const foot = { x: application.x + projection * direction.x, y: application.y + projection * direction.y };
  const normal = { x: -direction.y, y: direction.x };
  const lineStart = { x: foot.x - direction.x * 8, y: foot.y - direction.y * 8 };
  const forceEnd = { x: application.x + direction.x * 80, y: application.y + direction.y * 80 };
  const rightAngle = [
    { x: foot.x + direction.x * 8, y: foot.y + direction.y * 8 },
    { x: foot.x + (direction.x + normal.x) * 8, y: foot.y + (direction.y + normal.y) * 8 },
    { x: foot.x + normal.x * 8, y: foot.y + normal.y * 8 }
  ];
  return { pixelsPerUnit, origin, application, direction, foot, lineStart, forceEnd, rightAngle };
}
