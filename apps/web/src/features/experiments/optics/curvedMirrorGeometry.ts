import { calculateSphericalMirror } from "@physics-lab/physics";

export type MirrorKind = "concave" | "convex";
export type MirrorPoint = [number, number, number];

// World coordinates: vertex at (0,0,0), light arrives from x<0, y points up.
// The image equation is paraxial; the two displayed rays use the actual spherical
// surface normal. They need not meet exactly at the paraxial image (aberration).
export const MIRROR_FOCAL_LENGTH = 120;
export const MIRROR_RADIUS = 2 * MIRROR_FOCAL_LENGTH;
export const MIRROR_OBJECT_HEIGHT = 18;

export function sphericalMirrorSurfaceX(kind: MirrorKind, y: number, z = 0) {
  if (![y, z].every(Number.isFinite) || y * y + z * z >= MIRROR_RADIUS ** 2) {
    throw new RangeError("镜面截面必须位于球面口径内");
  }
  const sag = MIRROR_RADIUS - Math.sqrt(MIRROR_RADIUS ** 2 - y * y - z * z);
  return kind === "concave" ? -sag : sag;
}

function normalized(point: MirrorPoint): MirrorPoint {
  const length = Math.hypot(...point);
  if (!Number.isFinite(length) || length === 0) throw new RangeError("光线方向无效");
  return point.map(value => value / length) as MirrorPoint;
}

export function traceSphericalMirrorRay(kind: MirrorKind, object: MirrorPoint, hit: MirrorPoint) {
  const centerX = kind === "concave" ? -MIRROR_RADIUS : MIRROR_RADIUS;
  const incident = normalized(hit.map((value, index) => value - object[index]!) as MirrorPoint);
  const normal = normalized([hit[0] - centerX, hit[1], hit[2]]);
  const dot = incident.reduce((sum, value, index) => sum + value * normal[index]!, 0);
  const reflected = incident.map((value, index) => value - 2 * dot * normal[index]!) as MirrorPoint;
  const pointAtX = (x: number): MirrorPoint => {
    const distance = (x - hit[0]) / reflected[0];
    return [x, hit[1] + distance * reflected[1], hit[2] + distance * reflected[2]];
  };
  return { hit, incident, normal, reflected, end: pointAtX(-600), backwardEnd: pointAtX(205) };
}

export function curvedMirrorGeometry(kind: MirrorKind, objectDistance: number) {
  const result = calculateSphericalMirror(kind, objectDistance, MIRROR_FOCAL_LENGTH);
  const object: MirrorPoint = [-objectDistance, MIRROR_OBJECT_HEIGHT, 0];
  const image: MirrorPoint | null = result.atFocus ? null : [-result.imageDistance, result.magnification * MIRROR_OBJECT_HEIGHT, 0];
  const rayHits: MirrorPoint[] = [[sphericalMirrorSurfaceX(kind, MIRROR_OBJECT_HEIGHT), MIRROR_OBJECT_HEIGHT, 0], [0, 0, 0]];
  const surface = Array.from({ length: 101 }, (_, index): MirrorPoint => {
    const y = -167 + index * 334 / 100;
    return [sphericalMirrorSurfaceX(kind, y), y, 0];
  });
  return {
    result, object, image, surface,
    focus: [kind === "concave" ? -MIRROR_FOCAL_LENGTH : MIRROR_FOCAL_LENGTH, 0, 0] as MirrorPoint,
    center: [kind === "concave" ? -MIRROR_RADIUS : MIRROR_RADIUS, 0, 0] as MirrorPoint,
    imageVisible: Boolean(image && image[0] >= -596 && image[0] <= 164 && Math.abs(image[1]) <= 110),
    rays: rayHits.map(hit => traceSphericalMirrorRay(kind, object, hit)),
  };
}

export const mirrorPoint2D = ([x, y]: MirrorPoint) => ({ x: 650 + x, y: 225 - y });
export const mirrorPoint3D = ([x, y, z]: MirrorPoint): MirrorPoint => [2.75 + x * .0125, 1.45 + y * .0125, z * .0125];

export function mirrorPath2D(points: MirrorPoint[]) {
  return points.map((point, index) => {
    const { x, y } = mirrorPoint2D(point);
    return `${index === 0 ? "M" : "L"}${x} ${y}`;
  }).join(" ");
}
