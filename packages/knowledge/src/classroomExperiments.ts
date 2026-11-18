import { highSchoolExperiments } from '@physics-lab/knowledge/high-school';

export interface ClassroomExperiment {
  id: string;
  stage: 'junior' | 'high-school';
  /** Experiment route only; callers attach their verified task/session identifiers. */
  path: string;
  title: string;
}

const juniorExperiments: readonly Omit<ClassroomExperiment, 'stage'>[] = [
  { id: 'light', path: '/student/explore/light', title: '光的反射与折射' },
  { id: 'lens', path: '/lab/lens', title: '凸透镜成像' },
  { id: 'mechanics', path: '/student/explore/mechanics', title: '力与运动' },
  { id: 'circuit', path: '/student/explore/circuit', title: '串并联电路' },
  { id: 'sound', path: '/student/explore/sound', title: '声音的特性' },
  { id: 'thermal', path: '/student/explore/thermal', title: '物态变化' },
  { id: 'measurement', path: '/student/explore/measurement', title: '质量与密度' },
  { id: 'reflection', path: '/student/explore/light?mode=reflection', title: '光的反射定律' },
  { id: 'sound-medium', path: '/student/explore/sound?module=sound-medium', title: '声音的产生与传播' },
  { id: 'sound-features', path: '/student/explore/sound?module=sound-features', title: '响度、音调与音色' },
  { id: 'mechanics-speed', path: '/student/explore/mechanics?module=mechanics-speed', title: '运动与速度' },
  { id: 'mechanics-friction', path: '/student/explore/mechanics?module=mechanics-friction', title: '滑动摩擦力' },
  { id: 'mechanics-lever', path: '/student/explore/mechanics?module=mechanics-lever', title: '杠杆平衡' },
  { id: 'mechanics-buoyancy', path: '/student/explore/mechanics?module=mechanics-buoyancy', title: '浮力与浮沉' },
  { id: 'circuit-basic', path: '/student/explore/circuit?module=circuit-basic', title: '串联与并联电路' },
  { id: 'circuit-ohm', path: '/student/explore/circuit?module=circuit-ohm', title: '欧姆定律' },
  { id: 'circuit-power', path: '/student/explore/circuit?module=circuit-power', title: '电功率与电能' },
  { id: 'circuit-magnet', path: '/student/explore/circuit?module=circuit-magnet', title: '电磁铁' },
  { id: 'thermal-boiling', path: '/student/explore/thermal?module=thermal-boiling', title: '水的沸腾' },
  { id: 'thermal-evaporation', path: '/student/explore/thermal?module=thermal-evaporation', title: '蒸发与蒸发降温' },
  { id: 'measurement-density', path: '/student/explore/measurement?module=measurement-density', title: '不规则固体密度' },
];

/** One route whitelist for both browser entry points and server-side lesson creation. */
export const classroomExperiments: readonly ClassroomExperiment[] = Object.freeze([
  ...juniorExperiments.map((entry) => Object.freeze({ ...entry, stage: 'junior' as const })),
  ...highSchoolExperiments.filter((entry) => entry.status === 'ready').map((entry) => Object.freeze({
    id: entry.id, stage: 'high-school' as const, path: `/high-school/experiments/${entry.id}`, title: entry.name,
  })),
]);

export function getClassroomExperiment(id: string): ClassroomExperiment | undefined {
  return classroomExperiments.find((entry) => entry.id === id);
}
