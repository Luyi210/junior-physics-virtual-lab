import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExpandedInstrumentIcon } from './ExpandedInstrumentIcon';
import { EXPANDED_EXPERIMENT_IDS, anglePoint, mapDiagramToBoard, meterNeedle, safeSceneClick, verticalDropPoint } from './expandedGeometry';

describe('expanded instrument coordinate conventions', () => {
  it('uses a mathematical anticlockwise angle with the SVG y axis inverted', () => {
    expect(anglePoint(0, 20, { x: 100, y: 100 })).toEqual({ x: 120, y: 100 });
    expect(anglePoint(90, 20, { x: 100, y: 100 })).toEqual({ x: 100, y: 80 });
    expect(anglePoint(-90, 20, { x: 100, y: 100 })).toEqual({ x: 100, y: 120 });
  });
  it('maps board coordinates to a common right-handed Three plane without changing left/right', () => {
    expect(mapDiagramToBoard({ x: 350, y: 190 })).toEqual([0, -.45, 0]);
    expect(mapDiagramToBoard({ x: 430, y: 270 })).toEqual([1, -.45, 1]);
    expect(mapDiagramToBoard({ x: 270, y: 110 })).toEqual([-1, -.45, -1]);
  });
  it('moves a falling centre down the fixed ruler and places its surface on the floor at the end', () => {
    for (const height of [.5, 1, 2, 5]) {
      const release = verticalDropPoint(0, height), halfway = verticalDropPoint(height / 2, height), end = verticalDropPoint(height, height);
      expect(release.y).toBe(70); expect(halfway.y).toBe(188); expect(end.y + 12).toBe(318);
      expect(end.world[1] - .16).toBeCloseTo(-1.06); expect(halfway.world[1]).toBeLessThan(release.world[1]);
      expect(verticalDropPoint(height * 2, height)).toEqual(end);
    }
  });
  it('keeps zero and full-scale needles on opposite ends, with centre zero pointing upward', () => {
    const zero = meterNeedle(0, { x: 0, y: 0 }), middle = meterNeedle(.5, { x: 0, y: 0 }), full = meterNeedle(1, { x: 0, y: 0 });
    expect(zero.x).toBeLessThan(0); expect(full.x).toBeGreaterThan(0); expect(middle.x).toBeCloseTo(0); expect(middle.y).toBe(-37);
  });
  it('does not mistake camera dragging or missing movement evidence for a switch click', () => {
    expect(safeSceneClick({ delta: .3, button: 0 })).toBe(true);
    for (const event of [{ delta: 8, button: 0 }, { delta: 0, button: 2 }, {}, { delta: NaN }, { delta: -1 }]) expect(safeSceneClick(event)).toBe(false);
  });
});

describe('distinct catalogue instrument drawings', () => {
  it.each(EXPANDED_EXPERIMENT_IDS)('provides an actual apparatus drawing for %s', kind => {
    const html = renderToStaticMarkup(<svg><ExpandedInstrumentIcon kind={kind} /></svg>);
    expect(html).toContain('<path'); expect(html).not.toMatch(/NaN|undefined/);
    const other = EXPANDED_EXPERIMENT_IDS.filter(id => id !== kind).map(id => renderToStaticMarkup(<svg><ExpandedInstrumentIcon kind={id} /></svg>));
    expect(other).not.toContain(html);
  });
});
