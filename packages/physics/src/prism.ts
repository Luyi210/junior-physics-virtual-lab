export interface PrismPoint {
  x: number;
  y: number;
}

export interface TriangularPrismRayInput {
  prismAngleDegrees: number;
  refractiveIndex: number;
  screenX: number;
  sourceX?: number;
  sourceY?: number;
}

export interface TriangularPrismRayPath {
  vertices: [PrismPoint, PrismPoint, PrismPoint];
  entry: PrismPoint;
  exit: PrismPoint;
  insideDirection: PrismPoint;
  outgoingDirection: PrismPoint;
  landing: PrismPoint;
  entryEdgeIndex: number;
  exitEdgeIndex: number;
}

const BASE_VERTICES: [PrismPoint, PrismPoint, PrismPoint] = [
  { x: 410, y: 115 },
  { x: 460, y: 305 },
  { x: 360, y: 305 }
];
const ROTATION_CENTER = { x: 410, y: 225 };
const EPSILON = 1e-7;

const add = (a: PrismPoint, b: PrismPoint): PrismPoint => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: PrismPoint, b: PrismPoint): PrismPoint => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (point: PrismPoint, factor: number): PrismPoint => ({ x: point.x * factor, y: point.y * factor });
const dot = (a: PrismPoint, b: PrismPoint) => a.x * b.x + a.y * b.y;
const cross = (a: PrismPoint, b: PrismPoint) => a.x * b.y - a.y * b.x;
const magnitude = (point: PrismPoint) => Math.hypot(point.x, point.y);
const normalize = (point: PrismPoint): PrismPoint => {
  const length = magnitude(point);
  if (length <= EPSILON) throw new RangeError("光线方向不能为零向量");
  return scale(point, 1 / length);
};

function rotate(point: PrismPoint, angleRadians: number): PrismPoint {
  const relative = subtract(point, ROTATION_CENTER);
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  return {
    x: ROTATION_CENTER.x + relative.x * cosine - relative.y * sine,
    y: ROTATION_CENTER.y + relative.x * sine + relative.y * cosine
  };
}

function raySegmentIntersection(origin: PrismPoint, direction: PrismPoint, start: PrismPoint, end: PrismPoint) {
  const edge = subtract(end, start);
  const denominator = cross(direction, edge);
  if (Math.abs(denominator) <= EPSILON) return null;
  const fromOrigin = subtract(start, origin);
  const distance = cross(fromOrigin, edge) / denominator;
  const edgeRatio = cross(fromOrigin, direction) / denominator;
  if (distance <= EPSILON || edgeRatio < -EPSILON || edgeRatio > 1 + EPSILON) return null;
  return { distance, point: add(origin, scale(direction, distance)) };
}

function firstPolygonIntersection(origin: PrismPoint, direction: PrismPoint, vertices: PrismPoint[], excludedEdgeIndex = -1) {
  return vertices
    .map((start, edgeIndex) => ({ edgeIndex, intersection: edgeIndex === excludedEdgeIndex ? null : raySegmentIntersection(origin, direction, start, vertices[(edgeIndex + 1) % vertices.length]!) }))
    .filter((candidate): candidate is { edgeIndex: number; intersection: NonNullable<ReturnType<typeof raySegmentIntersection>> } => candidate.intersection !== null)
    .sort((a, b) => a.intersection.distance - b.intersection.distance)[0];
}

function outwardNormal(vertices: PrismPoint[], edgeIndex: number): PrismPoint {
  const start = vertices[edgeIndex]!;
  const end = vertices[(edgeIndex + 1) % vertices.length]!;
  const edge = subtract(end, start);
  let candidate = normalize({ x: edge.y, y: -edge.x });
  const midpoint = scale(add(start, end), .5);
  const centroid = scale(vertices.reduce((sum, point) => add(sum, point), { x: 0, y: 0 }), 1 / vertices.length);
  if (dot(candidate, subtract(centroid, midpoint)) > 0) candidate = scale(candidate, -1);
  return candidate;
}

function refract(incidentDirection: PrismPoint, normalTowardIncidentMedium: PrismPoint, incidentIndex: number, transmittedIndex: number) {
  const incident = normalize(incidentDirection);
  let normal = normalize(normalTowardIncidentMedium);
  if (dot(normal, incident) > 0) normal = scale(normal, -1);
  const indexRatio = incidentIndex / transmittedIndex;
  const cosineOfIncidence = -dot(normal, incident);
  const discriminant = 1 - indexRatio * indexRatio * (1 - cosineOfIncidence * cosineOfIncidence);
  if (discriminant < 0) throw new RangeError("当前棱镜姿态发生全反射，无法到达光屏");
  return normalize(add(scale(incident, indexRatio), scale(normal, indexRatio * cosineOfIncidence - Math.sqrt(discriminant))));
}

export function calculateTriangularPrismRayPath({
  prismAngleDegrees,
  refractiveIndex,
  screenX,
  sourceX = 128,
  sourceY = 225
}: TriangularPrismRayInput): TriangularPrismRayPath {
  if (![prismAngleDegrees, refractiveIndex, screenX, sourceX, sourceY].every(Number.isFinite)) throw new RangeError("棱镜光路参数必须为有限数值");
  if (Math.abs(prismAngleDegrees) > 30) throw new RangeError("三棱镜转角应在-30°到30°之间");
  if (refractiveIndex <= 1 || refractiveIndex >= 3) throw new RangeError("棱镜折射率应在1到3之间");
  if (screenX <= ROTATION_CENTER.x + 100 || sourceX >= ROTATION_CENTER.x - 100) throw new RangeError("光源应位于棱镜左侧，光屏应位于棱镜右侧");

  const angleRadians = prismAngleDegrees * Math.PI / 180;
  const vertices = BASE_VERTICES.map((point) => rotate(point, angleRadians)) as [PrismPoint, PrismPoint, PrismPoint];
  const incidentDirection = { x: 1, y: 0 };
  const entryHit = firstPolygonIntersection({ x: sourceX, y: sourceY }, incidentDirection, vertices);
  if (!entryHit) throw new RangeError("入射光没有照到三棱镜");

  const entryNormal = outwardNormal(vertices, entryHit.edgeIndex);
  const insideDirection = refract(incidentDirection, entryNormal, 1, refractiveIndex);
  const insideOrigin = add(entryHit.intersection.point, scale(insideDirection, 1e-4));
  const exitHit = firstPolygonIntersection(insideOrigin, insideDirection, vertices, entryHit.edgeIndex);
  if (!exitHit) throw new RangeError("棱镜内光线没有找到出射面");

  const exitInwardNormal = scale(outwardNormal(vertices, exitHit.edgeIndex), -1);
  const outgoingDirection = refract(insideDirection, exitInwardNormal, refractiveIndex, 1);
  const distanceToScreen = (screenX - exitHit.intersection.point.x) / outgoingDirection.x;
  if (!Number.isFinite(distanceToScreen) || distanceToScreen <= 0) throw new RangeError("出射光无法到达右侧光屏");

  return {
    vertices,
    entry: entryHit.intersection.point,
    exit: exitHit.intersection.point,
    insideDirection,
    outgoingDirection,
    landing: add(exitHit.intersection.point, scale(outgoingDirection, distanceToScreen)),
    entryEdgeIndex: entryHit.edgeIndex,
    exitEdgeIndex: exitHit.edgeIndex
  };
}
