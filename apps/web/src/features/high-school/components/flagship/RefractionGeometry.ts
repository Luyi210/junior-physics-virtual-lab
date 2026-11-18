export const refractionOrigin = { x: 285, y: 198 };
export type RefractionPoint = { x: number; y: number };
const deg = Math.PI / 180;
export function formatRefractionAngle(value: number) {
  const rounded = Number(value.toFixed(2));
  return `${Math.abs(value - rounded) > 1e-9 ? '≈' : ''}${rounded}°`;
}
export function refractionRays(state: Record<string, number>) {
  const o = refractionOrigin, length = 141;
  return { origin: o,
    incident: { x: o.x - state.incidentDirectionX * length, y: o.y + state.incidentDirectionY * length },
    reflected: { x: o.x + state.reflectedDirectionX * length, y: o.y - state.reflectedDirectionY * length },
    transmitted: { x: o.x + state.transmittedDirectionX * length, y: o.y - state.transmittedDirectionY * length } };
}
/** i is between upward normal and the source ray; r is between downward normal and transmission. */
export function refractionAnglePoint(angle: number, radius: number, side: 'incident' | 'transmitted') {
  return side === 'incident'
    ? { x: refractionOrigin.x - radius * Math.sin(angle * deg), y: refractionOrigin.y - radius * Math.cos(angle * deg) }
    : { x: refractionOrigin.x + radius * Math.sin(angle * deg), y: refractionOrigin.y + radius * Math.cos(angle * deg) };
}
export function refractionArc(angle: number, radius: number, side: 'incident' | 'transmitted') {
  const from = refractionAnglePoint(0, radius, side), to = refractionAnglePoint(angle, radius, side);
  return `M${from.x} ${from.y}A${radius} ${radius} 0 0 0 ${to.x} ${to.y}`;
}
export function refractionBoardPoint(point: RefractionPoint): [number, number, number] {
  return [(point.x - refractionOrigin.x) / 61.3, -.45, (point.y - refractionOrigin.y) / 61.3];
}
export function refractionPointerAngle(clientX: number, clientY: number, bounds: { left: number; top: number; width: number; height: number }): number | null {
  const scale = Math.min(bounds.width / 700, bounds.height / 400);
  if (!(scale > 0) || ![clientX, clientY, bounds.left, bounds.top, scale].every(Number.isFinite)) return null;
  const x = (clientX - bounds.left - (bounds.width - 700 * scale) / 2) / scale;
  const y = (clientY - bounds.top - (bounds.height - 400 * scale) / 2) / scale;
  if (Math.hypot(x - refractionOrigin.x, y - refractionOrigin.y) < 8) return null;
  return Math.round(Math.max(0, Math.min(85, Math.atan2(refractionOrigin.x - x, refractionOrigin.y - y) / deg)) * 10) / 10;
}
export function refractionStatus(parameters: Record<string, number>, state: Record<string, number>) {
  if (state.totalInternalReflection) return '全反射：没有传播折射光，不把占位0当作折射角。';
  if (state.incidentAngleDegrees === 0) return '正入射：光线沿法线，不发生偏折；0/0不能单独估折射率比。';
  if (Math.abs(state.refractedAngleDegrees - 90) < 1e-7) return '临界掠射：折射角90°，沿界面传播；尚未超过临界角。';
  if (parameters.incidentIndex === parameters.transmittedIndex) return '两侧折射率相同，光线不偏折。';
  return parameters.transmittedIndex > parameters.incidentIndex ? '进入较高折射率介质：折射光偏向法线。' : '进入较低折射率介质：折射光偏离法线。';
}
