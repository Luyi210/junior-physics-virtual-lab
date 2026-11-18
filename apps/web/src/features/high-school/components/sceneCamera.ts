import type { HighSchoolExperimentId } from '@physics-lab/physics/high-school';
export type SceneCameraView = 'perspective' | 'front' | 'top';
export function sceneCameraPosition(id: HighSchoolExperimentId, view: SceneCameraView): [number, number, number] {
  if (view === 'front') return [0, .4, 11];
  // A small z offset prevents the camera-up vector from becoming parallel to its direction.
  if (view === 'top') return [0, 12, .025];
  return id === 'force-composition' ? [7.5, 8.5, 10] : [id === 'double-slit' ? -7.4 : 7.4, 4.5, 8];
}
