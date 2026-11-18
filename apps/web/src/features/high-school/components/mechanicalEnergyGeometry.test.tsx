import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment, mechanicalEnergyTapePoints } from '@physics-lab/physics/high-school';
import { mechanicalEnergyGeometry, MECHANICAL_ENERGY_GEOMETRY as G, tapeRulerGeometry } from './mechanicalEnergyGeometry';
import { MechanicalEnergyDiagram } from './MechanicalEnergyDiagram';
import { MechanicalEnergyApparatus3D } from './MechanicalEnergyApparatus3D';
import { MechanicalEnergyTapeOverview, MechanicalEnergyTapeRuler } from './MechanicalEnergyMeasurementPanel';
function nodes(node: ReactNode): Array<{ type: unknown; props: Record<string, unknown> }> { return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : []; }

describe('mechanical-energy display coordinates', () => {
  it.each([.5, 1.2, 2])('uses one fixed scale and lands at the sphere surface for %s m drops', (height) => {
    const start = mechanicalEnergyGeometry(height, 0), middle = mechanicalEnergyGeometry(height, height / 2), end = mechanicalEnergyGeometry(height, height);
    expect(end.svgY + G.svgBallRadius).toBe(G.svgFloorY); expect(end.worldY - G.worldBallRadius).toBeCloseTo(G.worldFloorY, 12);
    expect(middle.svgY - start.svgY).toBeCloseTo(height / 2 * G.svgUnitsPerMetre, 12);
    expect(start.worldY - middle.worldY).toBeCloseTo(height / 2 * G.worldUnitsPerMetre, 12);
    expect(end.ticks[0].svgY).toBe(start.svgY); expect(end.ticks[0].worldY).toBe(start.worldY);
    expect(mechanicalEnergyGeometry(height, height + 1)).toMatchObject({ svgY: end.svgY, worldY: end.worldY });
  });
  it('keeps the ruler at the same coordinates as motion changes, with fixed 0.1 m spacing', () => {
    const first = mechanicalEnergyGeometry(2, 0), last = mechanicalEnergyGeometry(2, 1.9);
    expect(last.ticks).toEqual(first.ticks); expect(first.ticks[1].svgY - first.ticks[0].svgY).toBeCloseTo(11, 12);
    expect(first.ticks[0].worldY - first.ticks[1].worldY).toBeCloseTo(.165, 12);
  });
  it.each([0, 1.96, 69.7, 1999.9])('uses one point/tick transform on the magnified ruler at %s mm', (position) => {
    const ruler = tapeRulerGeometry(position); expect(ruler.pointX).toBeCloseTo(24 + (position - ruler.low) * 52, 10);
    expect(ruler.ticks).toHaveLength(61); expect(ruler.ticks[1].x - ruler.ticks[0].x).toBeCloseTo(5.2, 10); expect(ruler.pointX).toBeGreaterThanOrEqual(24); expect(ruler.pointX).toBeLessThanOrEqual(336);
  });
  it('renders the actual pre-impact endpoint in both SVG and Three meshes without adding another animation loop', () => {
    const parameters = defaultHighSchoolParameters('mechanical-energy'); const initial = simulateHighSchoolExperiment('mechanical-energy', parameters, 0); const simulation = simulateHighSchoolExperiment('mechanical-energy', parameters, initial.durationSeconds);
    const html = renderToStaticMarkup(<svg><MechanicalEnergyDiagram parameters={parameters} simulation={simulation} /></svg>);
    expect(html).toContain('data-mechanical-ball="true"'); expect(html).toContain('cy="318"'); expect(html).toContain('接触前读数');
    const tree = MechanicalEnergyApparatus3D({ parameters, simulation }); const ball = nodes(tree).find((node) => node.type === 'mesh' && nodes(node.props.children as ReactNode).some((child) => child.type === 'sphereGeometry'))!;
    expect((ball.props.position as number[])[1] - G.worldBallRadius).toBeCloseTo(G.worldFloorY, 12);
  });
  it('draws only generated equal-time tape points; the non-grid collision endpoint is not appended', () => {
    const parameters = defaultHighSchoolParameters('mechanical-energy'); const end = simulateHighSchoolExperiment('mechanical-energy', parameters, 0).durationSeconds;
    const points = mechanicalEnergyTapePoints(parameters, end); const html = renderToStaticMarkup(<MechanicalEnergyTapeOverview points={points} indexA={1} indexB={3} />);
    expect(html.match(/data-tape-point=/g)).toHaveLength(points.length); expect(points.at(-1)!.timeSeconds).toBeLessThan(end);
    expect(points.at(-1)!.positionMm).toBeLessThan(parameters.dropHeight * 1000);
    const early = renderToStaticMarkup(<MechanicalEnergyTapeOverview points={mechanicalEnergyTapePoints(parameters, .039)} indexA={null} indexB={null} />); expect(early.match(/data-tape-point=/g)).toHaveLength(2);
  });
  it('gives a readable ruler scale without printing or filling the exact model position', () => {
    const html = renderToStaticMarkup(<MechanicalEnergyTapeRuler point={{ index: 3, timeSeconds: .06, positionMm: 17.64 }} label="A 中心点" />);
    expect(html).toContain('每小格0.1毫米'); expect(html).toContain('3号点'); expect(html).not.toContain('17.64'); expect(html).not.toContain('<input');
  });
});
