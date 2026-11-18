type Point3 = [number, number, number];

/** The board uses one fixed scale. Physics +y points toward world -z. */
export const FORCE_BOARD_SCALE = .32;
export const FORCE_BOARD_HALF_SIZE = 3.7;

export function forceBoardPoint(x: number, y: number, elevation = .08): Point3 {
  return [x * FORCE_BOARD_SCALE, elevation, -y * FORCE_BOARD_SCALE];
}

export function forceBoardArrow(x: number, y: number, elevation = .08) {
  if (![x, y, elevation].every(Number.isFinite)) return null;
  const length = Math.hypot(x, y) * FORCE_BOARD_SCALE;
  // A zero force has neither a direction nor an arrowhead.
  if (length < 1e-10) return null;
  const start: Point3 = [0, elevation, 0];
  const end = forceBoardPoint(x, y, elevation);
  const direction: Point3 = [end[0] / length, 0, end[2] / length];
  const headLength = Math.min(.2, length * .3);
  const beforeTip = (distance: number): Point3 => [end[0] - direction[0] * distance, elevation, end[2] - direction[2] * distance];
  return { start, end, direction, shaftEnd: beforeTip(headLength), headCenter: beforeTip(headLength / 2), headLength, headRadius: Math.min(.07, headLength * .35), length };
}
