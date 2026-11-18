export const EXPANDED_EXPERIMENT_IDS = [
  'centripetal-force', 'free-fall', 'momentum-conservation', 'precision-length',
  'resistivity', 'multimeter', 'refractive-index', 'induced-current',
  'transformer-ratio', 'sensor-control', 'oil-film', 'gas-pressure-volume',
  'photoelectric-effect', 'charged-particle-field',
] as const;
export type ExpandedExperimentId = typeof EXPANDED_EXPERIMENT_IDS[number];
export function isExpandedExperiment(id: string): id is ExpandedExperimentId {
  return (EXPANDED_EXPERIMENT_IDS as readonly string[]).includes(id);
}
export type Point2 = { x: number; y: number };
export type Point3 = [number, number, number];
export function anglePoint(degrees: number, radius: number, origin: Point2 = { x: 0, y: 0 }): Point2 {
  const radians = degrees * Math.PI / 180;
  return { x: origin.x + radius * Math.cos(radians), y: origin.y - radius * Math.sin(radians) };
}
export function mapDiagramToBoard({ x, y }: Point2, elevation = -.45): Point3 {
  return [(x - 350) / 80, elevation, (y - 190) / 80];
}
export function meterNeedle(fraction: number, origin: Point2, radius = 37): Point2 {
  return anglePoint(150 - Math.max(0, Math.min(1, fraction)) * 120, radius, origin);
}
/** The same scene ruler is used at every time in a run, never a moving viewport. */
export function verticalDropPoint(position: number, dropHeight: number) {
  const fraction = Math.max(0, Math.min(1, position / dropHeight));
  return { x: 350, y: 70 + fraction * 236, fraction, world: [0, 2.2 - fraction * 3.1, 0] as Point3 };
}
export function safeSceneClick(event: { delta?: number; button?: number }) {
  return Number.isFinite(event.delta) && event.delta! >= 0 && event.delta! <= 4 && (event.button === undefined || event.button === 0);
}
export function radialScene(state: Record<string, number>) {
  const center = { x: 250, y: 185 };
  const point = { x: center.x + state.x * 125, y: center.y - state.y * 125 };
  return { center, point, world: [state.x * 3, -.5, -state.y * 3] as Point3 };
}
export function collisionExtent(series: readonly { key: string; points: readonly { x: number; y: number }[] }[]) {
  const positions = series.filter(line => line.key === 'x1' || line.key === 'x2').flatMap(line => line.points.map(point => Math.abs(point.y)));
  return Math.max(1.5, ...positions);
}
export function trajectoryGeometry(points: readonly Point2[], state: Record<string, number>) {
  const extent = Math.max(1, ...points.flatMap(point => [Math.abs(point.x), Math.abs(point.y)]));
  const svg = (point: Point2) => ({ x: 250 + point.x / extent * 126, y: 185 - point.y / extent * 126 });
  const world = (point: Point2): Point3 => [point.x / extent * 2.8, -.5, -point.y / extent * 2.8];
  return { extent, path: points.map(svg), point: svg({ x: state.x, y: state.y }), worldPath: points.map(world), worldPoint: world({ x: state.x, y: state.y }) };
}
