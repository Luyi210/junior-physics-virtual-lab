export interface ForceBoardPoint { x: number; y: number }
export type ForceHandle = 'force1' | 'force2' | 'trial';
export const FORCE_BOARD = Object.freeze({ width: 700, height: 380, origin: Object.freeze({ x: 350, y: 190 }), pixelsPerNewton: 14 });
export const FORCE_HANDLES = {
  force1: { label: '分力 F₁', symbol: 'F₁', magnitude: 'force1N', angle: 'angle1Degrees', maximum: 5, color: '#315c45' },
  force2: { label: '分力 F₂', symbol: 'F₂', magnitude: 'force2N', angle: 'angle2Degrees', maximum: 5, color: '#7c8251' },
  trial: { label: '学生单力 F试', symbol: 'F试', magnitude: 'trialForceN', angle: 'trialAngleDegrees', maximum: 10, color: '#b85c35' },
} as const;
const round = (value: number, places: number) => Number(value.toFixed(places));
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export function forceVectorPoint(x: number, y: number): ForceBoardPoint {
  return { x: FORCE_BOARD.origin.x + x * FORCE_BOARD.pixelsPerNewton, y: FORCE_BOARD.origin.y - y * FORCE_BOARD.pixelsPerNewton };
}

/** SVG xMidYMid meet mapping, including letterboxing on narrow/tall containers. */
export function forceClientPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): ForceBoardPoint | null {
  if (![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return null;
  const scale = Math.min(rect.width / FORCE_BOARD.width, rect.height / FORCE_BOARD.height);
  return { x: (clientX - rect.left - (rect.width - FORCE_BOARD.width * scale) / 2) / scale,
    y: (clientY - rect.top - (rect.height - FORCE_BOARD.height * scale) / 2) / scale };
}

/** Pointer geometry only: the physics model remains the source of the resultant. */
export function forceDragPatch(handle: ForceHandle, point: ForceBoardPoint, previousAngle: number): Record<string, number> | null {
  if (![point.x, point.y, previousAngle].every(Number.isFinite)) return null;
  const x = (point.x - FORCE_BOARD.origin.x) / FORCE_BOARD.pixelsPerNewton;
  const y = (FORCE_BOARD.origin.y - point.y) / FORCE_BOARD.pixelsPerNewton;
  const magnitude = round(Math.min(FORCE_HANDLES[handle].maximum, Math.hypot(x, y)), 2);
  // Zero force has no direction. Keep its stored control angle for the next
  // non-zero adjustment, but never infer or draw a direction from this value.
  const angle = magnitude === 0 ? previousAngle : round(Math.atan2(y, x) * 180 / Math.PI, 1);
  return { [FORCE_HANDLES[handle].magnitude]: magnitude, [FORCE_HANDLES[handle].angle]: angle };
}
export function forceKeyboardPatch(handle: ForceHandle, parameters: Record<string, number>, key: string, shift = false): Record<string, number> | null {
  const specification = FORCE_HANDLES[handle];
  let magnitude = parameters[specification.magnitude]; let angle = parameters[specification.angle];
  if (![magnitude, angle].every(Number.isFinite)) return null;
  const step = shift ? 10 : 1;
  if (key === 'ArrowUp') magnitude += .1 * step;
  else if (key === 'ArrowDown') magnitude -= .1 * step;
  else if (key === 'ArrowLeft') angle += step;
  else if (key === 'ArrowRight') angle -= step;
  else if (key === 'Home') magnitude = 0;
  else if (key === 'End') magnitude = specification.maximum;
  else return null;
  if (angle > 180) angle -= 360;
  if (angle < -180) angle += 360;
  return { [specification.magnitude]: round(clamp(magnitude, 0, specification.maximum), 2), [specification.angle]: angle };
}
export function forceArrowGeometry(tip: ForceBoardPoint) {
  const { origin } = FORCE_BOARD;
  const dx = tip.x - origin.x, dy = tip.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const headLength = Math.min(8, length * .35);
  const ux = dx / length, uy = dy / length;
  const base = { x: tip.x - ux * headLength, y: tip.y - uy * headLength };
  const halfWidth = headLength * .55;
  return { shaftEnd: base, head: [tip, { x: base.x - uy * halfWidth, y: base.y + ux * halfWidth }, { x: base.x + uy * halfWidth, y: base.y - ux * halfWidth }] };
}

export const FORCE_PRESETS = [
  { id: 'same', label: '同向', note: '3 N 与 4 N 同向', patch: { force1N: 3, angle1Degrees: 0, force2N: 4, angle2Degrees: 0 } },
  { id: 'perpendicular', label: '垂直', note: '3 N 与 4 N 垂直', patch: { force1N: 3, angle1Degrees: 0, force2N: 4, angle2Degrees: 90 } },
  { id: 'opposite', label: '反向', note: '3 N 与 4 N 反向', patch: { force1N: 3, angle1Degrees: 0, force2N: 4, angle2Degrees: 180 } },
  { id: 'cancel', label: '相抵', note: '两个 3 N 大小相等、方向相反', patch: { force1N: 3, angle1Degrees: 0, force2N: 3, angle2Degrees: 180 } },
] as const;
