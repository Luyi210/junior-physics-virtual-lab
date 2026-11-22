import { renderToStaticMarkup } from 'react-dom/server';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOL_EXPERIMENTS, defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { ExperimentDiagram2D } from '../ExperimentDiagram2D';
import { ElectricApparatus3D } from './ElectricApparatus3D';
import { MagnetismApparatus3D } from './MagnetismApparatus3D';
import { MechanicsApparatus3D } from './MechanicsApparatus3D';
import { OpticsThermalApparatus3D } from './OpticsThermalApparatus3D';
import { CollisionApparatus3D } from '../flagship/CollisionApparatus3D';
import { RefractionApparatus3D } from '../flagship/RefractionApparatus3D';
import { EXPANDED_EXPERIMENT_IDS, collisionExtent, radialScene, trajectoryGeometry, verticalDropPoint, type ExpandedExperimentId } from './expandedGeometry';
import type { ExpandedSceneProps } from './expandedSceneTypes';

function model(id: ExpandedExperimentId, patch: Record<string, number> = {}, time = 0) {
  const parameters = { ...defaultHighSchoolParameters(id), ...patch };
  return { experimentId: id, parameters, simulation: simulateHighSchoolExperiment(id, parameters, time) };
}
function svg(props: ExpandedSceneProps) { return renderToStaticMarkup(<ExperimentDiagram2D {...props} trajectory={[]} />); }
type Node = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(tree)) return [];
  // Expand the extracted pure scenes, retaining the actual mesh/geometry checks below.
  if (tree.type === CollisionApparatus3D || tree.type === RefractionApparatus3D) {
    return [tree, ...nodes((tree.type as (props: ExpandedSceneProps) => ReactNode)(tree.props as unknown as ExpandedSceneProps))];
  }
  return [tree, ...nodes(tree.props.children as ReactNode)];
}
const domain = (id: ExpandedExperimentId) => ['centripetal-force', 'free-fall', 'momentum-conservation'].includes(id) ? MechanicsApparatus3D : ['precision-length', 'resistivity', 'multimeter', 'sensor-control'].includes(id) ? ElectricApparatus3D : ['induced-current', 'transformer-ratio', 'charged-particle-field'].includes(id) ? MagnetismApparatus3D : OpticsThermalApparatus3D;
function checkNumbers(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (Array.isArray(value)) value.forEach(checkNumbers);
  else if (value && typeof value === 'object' && !isValidElement(value)) Object.values(value).forEach(checkNumbers);
}

describe('expanded apparatus with actual model outputs (SSR, not GPU/browser validation)', () => {
  it.each(EXPANDED_EXPERIMENT_IDS)('%s remains renderable at default, parameter limits and physical end time', id => {
    const definition = HIGH_SCHOOL_EXPERIMENTS.find(item => item.id === id)!;
    const configurations = [{}, ...definition.parameters.flatMap(parameter => [{ [parameter.key]: parameter.min }, { [parameter.key]: parameter.max }])];
    for (const patch of configurations) {
      const initial = model(id, patch);
      for (const time of [0, initial.simulation.durationSeconds / 2, initial.simulation.durationSeconds]) {
        const props = model(id, patch, time), html = svg(props);
        expect(html).toContain('class="hs-diagram"'); expect(html).toContain('data-expanded-instrument=');
        expect(html).toContain('<title'); expect(html).not.toMatch(/NaN|Infinity|undefined/);
        const apparatus = domain(id)(props), elements = nodes(apparatus);
        expect(elements.length).toBeGreaterThan(5);
        for (const element of elements) {
          for (const key of ['position', 'size', 'rotation', 'start', 'end', 'points', 'radius', 'value', 'endX']) checkNumbers(element.props[key]);
        }
      }
    }
  });

  it('does not report placeholder zero for untouched rulers, invalid meters or DC transformers', () => {
    expect(svg(model('precision-length'))).toContain('未接触：不读数');
    expect(svg(model('precision-length'))).not.toContain('data-scale-zero');
    const invalid = svg(model('multimeter', { functionMode: 2, connection: 0, powerOn: 1 }));
    expect(invalid).toContain('接法无效'); expect(invalid).not.toContain('>0 Ω<');
    expect(svg(model('multimeter', { rangeIndex: 0 }))).toContain('超量程');
    const dc = svg(model('transformer-ratio', { inputMode: 1 }));
    expect(dc).toContain('直流不适用：无有效副边读数'); expect(dc).not.toContain('data-readout="副线圈有效值"');
  });

  it('aligns the indicated caliper vernier division to an actual main-scale line, including negative zero error', () => {
    for (const patch of ([{ contactMode: 2 }, { contactMode: 1, zeroErrorMm: -.1 }, { contactMode: 2, objectLengthMm: 25, zeroErrorMm: .1 }] as Record<string, number>[])) {
      const props = model('precision-length', patch), state = props.simulation.state;
      const html = svg(props), zero = Number(html.match(/data-scale-zero="([^"]+)"/)![1]);
      const aligned = state.indicatedLengthMm + state.vernierDivision * .98;
      expect(aligned).toBeCloseTo(Math.round(aligned), 10);
      expect(zero).toBeCloseTo(105 + state.indicatedLengthMm * 7);
      expect(html.match(/data-vernier-index=/g)).toHaveLength(51);
      expect(html).toContain(`M${zero + state.vernierDivision * .98 * 7} 138v`);
    }
  });

  it('shows the micro scale matching whole half-millimetres and the actual thimble division', () => {
    for (const zeroErrorMm of [-.1, .04, .1]) {
      const props = model('precision-length', { instrument: 1, contactMode: 1, zeroErrorMm });
      const state = props.simulation.state;
      expect(state.mainScaleMm + state.thimbleDivision * .01).toBeCloseTo(state.indicatedLengthMm, 10);
      expect(svg(props)).toContain(`data-thimble-index="${state.thimbleDivision}" d="M0 115h27"`);
    }
  });

  it('keeps every wire diameter connected at y230 without a bypass across the metal sample', () => {
    for (const diameterMm of [.1, .5, 1]) {
      const html = svg(model('resistivity', { diameterMm }));
      const match = html.match(/data-wire-sample="true" x="220" y="([^"]+)" width="280" height="([^"]+)"/)!;
      expect(Number(match[1]) + Number(match[2]) / 2).toBe(230);
      expect(html).toContain('v140H500M220 230H145M220 230v70H500V230');
      expect(html).not.toContain('v140H145');
    }
  });

  it('uses the inward vector and clockwise/anticlockwise particle positions from the same model', () => {
    for (const angularSpeed of [-2, 0, 2]) {
      const props = model('centripetal-force', { angularSpeed }, .4), s = props.simulation.state, geometry = radialScene(s);
      expect(geometry.point.y - 185).toBeCloseTo(-s.y * 125);
      expect(geometry.world[2]).toBeCloseTo(-s.y * 3);
      expect(s.x * s.forceX + s.y * s.forceY).toBeLessThanOrEqual(0);
      if (angularSpeed === 0) expect(svg(props)).not.toContain('data-vector="F向心"');
    }
  });

  it('keeps the full collision range fixed and contact ends coincident without overlapping car bodies', () => {
    const initial = model('momentum-conservation'), time = initial.simulation.state.collisionTime;
    const at = model('momentum-conservation', {}, time), end = model('momentum-conservation', {}, 6);
    expect(collisionExtent(initial.simulation.series)).toBe(collisionExtent(end.simulation.series));
    expect(at.simulation.state.x1).toBeCloseTo(at.simulation.state.x2);
    const extent = collisionExtent(at.simulation.series), contact = 350 + at.simulation.state.x1 / extent * 235;
    const html = svg(at);
    const carts = [...html.matchAll(/<g transform="translate\(([^ ]+) ([^)]+)\)" data-cart="([12])">([\s\S]*?)<\/g>/g)];
    expect(carts).toHaveLength(2);
    const bodyEdges = carts.map(cart => {
      const body = cart[4].match(/<rect x="([^"]+)" y="[^"]+" width="([^"]+)"/)!, wheel = cart[4].match(/<circle cx="[^"]+" cy="([^"]+)" r="([^"]+)"/)!;
      return { left: Number(cart[1]) + Number(body[1]), right: Number(cart[1]) + Number(body[1]) + Number(body[2]), wheelBottom: Number(cart[2]) + Number(wheel[1]) + Number(wheel[2]) };
    });
    expect(bodyEdges[0].right).toBeCloseTo(contact); expect(bodyEdges[1].left).toBeCloseTo(contact);
    expect(Number(carts[0][2])).toBe(Number(carts[1][2]));
    const rail = html.match(/<path d="M52 ([^H]+)H648[^\"]*" stroke="[^"]+" stroke-width="([^"]+)"/)!;
    for (const cart of bodyEdges) expect(Math.abs(cart.wheelBottom - Number(rail[1]))).toBeLessThanOrEqual(Number(rail[2]) / 2);
    expect(svg(model('momentum-conservation', { velocity1: -1, velocity2: 1 }, 6))).toContain('不会相遇');
  });

  it('maps all free-fall heights to the same floor at the physical terminal time', () => {
    for (const dropHeight of [.1, 5, 20]) {
      const initial = model('free-fall', { dropHeight }), end = model('free-fall', { dropHeight }, initial.simulation.durationSeconds);
      const point = verticalDropPoint(end.simulation.state.position, dropHeight);
      expect(point.y + 12).toBeCloseTo(318); expect(point.world[1] - .16).toBeCloseTo(-1.06);
      expect(svg(end)).toContain('cy="306" r="12"');
      const beginning = svg(initial), halfway = svg(model('free-fall', { dropHeight }, initial.simulation.durationSeconds / 2)), complete = svg(end);
      expect((beginning.match(/data-fall-time-marker=/g) ?? [])).toHaveLength(1);
      expect((halfway.match(/data-fall-time-marker=/g) ?? [])).toHaveLength(9);
      const markerHeights = [...complete.matchAll(/data-fall-time-marker="[^"]+" cx="350" cy="([^"]+)"/g)].map(match => Number(match[1]));
      expect(markerHeights).toHaveLength(17);
      const gaps = markerHeights.slice(1).map((height, index) => height - markerHeights[index]!);
      expect(gaps.every((gap, index) => index === 0 || gap > gaps[index - 1]!)).toBe(true);
      const markers3d = nodes(MechanicsApparatus3D(end)).filter(node => node.props.userData && typeof node.props.userData === 'object' && 'fallSampleTimeSeconds' in node.props.userData);
      expect(markers3d).toHaveLength(17);
    }
  });

  it('reflects particle bending direction, and labels straight-line radius undefined', () => {
    for (const sign of [-1, 1]) {
      const props = model('charged-particle-field', { magneticFieldMicrotesla: sign * 10 }, .02);
      const curve = props.simulation.series.find(line => line.key === 'y')!;
      const geometry = trajectoryGeometry(curve.points, props.simulation.state);
      expect(Math.sign(geometry.point.y - 185)).toBe(sign);
      expect(Math.sign(geometry.worldPoint[2])).toBe(sign);
    }
    expect(svg(model('charged-particle-field', { magneticFieldMicrotesla: 0 }, .5))).toContain('直线或半径无定义');
  });

  it('hides impossible optical and magnetic observations rather than rendering zero placeholders as measurements', () => {
    expect(svg(model('refractive-index', { incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: 60 }))).toContain('全反射');
    const induction = svg(model('induced-current', { fieldAmplitude: 0 }, .25));
    expect(induction).toContain('B = 0'); expect(induction).not.toContain('r="2.3"');
    expect(svg(model('photoelectric-effect', { frequencyTHz: 100 }))).toContain('无光电子发射');
  });
});
