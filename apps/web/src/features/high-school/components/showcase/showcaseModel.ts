import { calculatePendulum } from '@physics-lab/physics/high-school/pendulum';
import { calculateProjectileMotion } from '@physics-lab/physics/high-school/kinematics';
import { calculateMomentumConservation } from '@physics-lab/physics/high-school/expandedModels';

export type ShowcaseKind = 'pendulum' | 'projectile' | 'collision';
export type ShowcasePoint = { x: number; y: number; time: number };
export const SHOWCASE_EXHIBITS = {
  pendulum: { label: '单摆', number: '01', title: '改变摆长，观察节奏。', question: '同样的释放角，长摆与短摆谁更快？', variable: '摆长', options: ['0.5 m', '1.0 m', '1.5 m'], values: [.5, 1, 1.5], defaultIndex: 1, route: 'pendulum', rate: 1, note: '理想无阻尼单摆 · 释放角30° · 固定米比例' },
  projectile: { label: '抛体', number: '02', title: '给初速度一个新方向。', question: '初速相同，改变角度会怎样落地？', variable: '抛射角', options: ['15°', '35°', '55°'], values: [15, 35, 55], defaultIndex: 1, route: 'projectile-motion', rate: .5, note: '忽略空气阻力 · 初速6 m/s · 初始高度0.5 m' },
  collision: { label: '碰撞', number: '03', title: '相碰之后，哪些量没变？', question: '只改恢复系数，比较系统动量与动能。', variable: '恢复系数 e', options: ['0 · 非弹性', '0.5 · 对照', '1 · 弹性'], values: [0, .5, 1], defaultIndex: 2, route: 'momentum-conservation', rate: 1, note: '理想一维碰撞 · 两车各0.5 kg · 向右为正' },
} as const;

/** Builds only a lightweight state reader and a small visual path once per setting.
 * Every animated value still comes directly from the shared pure physics model.
 * This preview never calls simulateHighSchoolExperiment or constructs analysis series.
 */
export function createShowcaseModel(kind: ShowcaseKind, choiceIndex: number) {
  const exhibit = SHOWCASE_EXHIBITS[kind];
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= exhibit.values.length) throw new RangeError('未知展台选项。');
  const value = exhibit.values[choiceIndex];
  let durationSeconds: number;
  let stateAt: (time: number) => Record<string, number>;
  let path: ShowcasePoint[] = [];
  if (kind === 'pendulum') {
    const parameters = { length: value, amplitudeDegrees: 30, mass: .2 };
    const initial = calculatePendulum(parameters, 0);
    durationSeconds = 8; // Preview observation window, not an inferred period count.
    stateAt = time => calculatePendulum(parameters, Math.min(durationSeconds, Math.max(0, time)));
    path = Array.from({ length: 49 }, (_, index) => {
      const state = calculatePendulum(parameters, initial.period * index / 96);
      return { x: state.x, y: state.y, time: state.time };
    });
  } else if (kind === 'projectile') {
    const parameters = { initialSpeed: 6, angleDegrees: value, initialHeight: .5 };
    durationSeconds = calculateProjectileMotion(parameters, 0).flightTime;
    stateAt = time => calculateProjectileMotion(parameters, time);
    path = Array.from({ length: 49 }, (_, index) => {
      const state = stateAt(durationSeconds * index / 48);
      return { x: state.x, y: state.y, time: state.time };
    });
  } else {
    const parameters = { mass1: .5, mass2: .5, velocity1: .75, velocity2: -.25, separation: 1.8, restitution: value };
    durationSeconds = 6;
    stateAt = time => calculateMomentumConservation(parameters, time);
  }
  return { kind, choiceIndex, durationSeconds, stateAt, path, initial: stateAt(0), rate: exhibit.rate };
}
export type ShowcaseModel = ReturnType<typeof createShowcaseModel>;

/** Fixed mappings retain comparable lengths and distances across presets. */
export const showcasePosition = {
  pendulum: (x: number, y: number) => ({ x: 320 + x * 130, y: 85 - y * 130 }),
  projectile: (x: number, y: number) => ({ x: 95 + x * 95, y: 316 - y * 95 }),
  collision: (x: number) => 230 + x * 73,
};

export function showcaseReadings(kind: ShowcaseKind, state: Record<string, number>) {
  if (kind === 'pendulum') return [
    { label: '当前摆角', value: state.angleDegrees.toFixed(1), unit: '°' },
    { label: '模型周期', value: state.period.toFixed(2), unit: 's' },
  ];
  if (kind === 'projectile') return [
    { label: '水平位移', value: state.x.toFixed(2), unit: 'm' },
    { label: '离地高度', value: state.y.toFixed(2), unit: 'm' },
  ];
  return [
    { label: '系统总动量', value: state.totalMomentum.toFixed(3), unit: 'kg·m/s' },
    { label: '系统总动能', value: state.kineticEnergy.toFixed(3), unit: 'J' },
  ];
}
