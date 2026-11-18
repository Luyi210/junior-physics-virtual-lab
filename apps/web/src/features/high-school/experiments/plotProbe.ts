export type PlotPoint = { x: number; y: number };

/** Select by distance on the displayed graph, so loops and vertical jumps keep
 * their distinct branches instead of collapsing to one x-coordinate. */
export function nearestPlotPoint(points: readonly PlotPoint[], x: number, y: number, xSpan: number, ySpan: number): PlotPoint | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(xSpan > 0) || !(ySpan > 0)) return null;
  let nearest: PlotPoint | null = null;
  let distance = Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const next = ((point.x - x) / xSpan * 612) ** 2 + ((point.y - y) / ySpan * 216) ** 2;
    if (next < distance) { nearest = point; distance = next; }
  }
  return nearest;
}
