import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOL_EXPERIMENTS, createCapacitorHistory, defaultHighSchoolParameters, simulateHighSchoolExperiment, type HighSchoolExperimentId, type HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { ExperimentReadings } from './ExperimentReadings';

type Element = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Element[] { return Array.isArray(tree) ? tree.flatMap(nodes) : isValidElement<Record<string, unknown>>(tree) ? [tree, ...nodes(tree.props.children as ReactNode)] : []; }
function content(tree: ReactNode): string { return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(content).join('') : isValidElement<Record<string, unknown>>(tree) ? content(tree.props.children as ReactNode) : ''; }
function model(id: HighSchoolExperimentId, patch: Record<string, number> = {}) {
  const parameters = { ...defaultHighSchoolParameters(id), ...patch };
  return simulateHighSchoolExperiment(id, parameters, 0, id === 'capacitor-charge' ? createCapacitorHistory('readings-test') : undefined);
}
function presented(simulation: HighSchoolSimulation) {
  const tree = ExperimentReadings({ simulation });
  const rows = nodes(tree).filter(node => node.type === 'div' && Array.isArray(node.props.children) && ['span', 'dt'].includes((node.props.children[0] as Element | undefined)?.type as string));
  return { tree, rows, value: (key: string) => { const label = simulation.metrics.find(metric => metric.key === key)!.label; const row = rows.find(item => content((item.props.children as ReactNode[])[0]) === label)!; expect(row, label).toBeDefined(); return content((row.props.children as ReactNode[])[1]); } };
}

describe('current readings preserve the complete model metric set', () => {
  it.each(HIGH_SCHOOL_EXPERIMENTS.map(item => item.id))('%s exposes every value or explicit validity marker, including the disclosure rows', id => {
    const simulation = model(id), view = presented(simulation);
    expect(view.rows).toHaveLength(simulation.metrics.length);
    expect(view.rows.map(row => row.key).sort()).toEqual(simulation.metrics.map(metric => metric.key).sort());
    const html = renderToStaticMarkup(<ExperimentReadings simulation={simulation} />);
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
    for (const metric of simulation.metrics) expect(view.value(metric.key)).not.toBe('');
    const detail = nodes(view.tree).find(node => node.type === 'details');
    if (simulation.metrics.length > 6) { expect(detail).toBeDefined(); expect(nodes(detail).some(node => node.type === 'summary')).toBe(true); }
  });

  it.each([0, 1])('does not present untouched instrument %s main-scale or subdivision placeholders as measured zero', instrument => {
    const simulation = model('precision-length', { instrument, contactMode: 0 });
    expect(simulation.state.readingValid).toBe(0);
    const view = presented(simulation);
    for (const key of ['indicatedLengthMm', 'correctedLengthMm', 'mainScaleMm', instrument === 0 ? 'vernierDivision' : 'thimbleDivision']) expect(view.value(key)).toContain('无有效读数');
    expect(view.value('readingValid')).toBe('否 '); expect(view.value('objectReadingValid')).toBe('否 ');
    const valid = presented(model('precision-length', { instrument, contactMode: 1, zeroErrorMm: 0 }));
    expect(valid.value('mainScaleMm')).toBe('0mm'); expect(valid.value(instrument === 0 ? 'vernierDivision' : 'thimbleDivision')).toBe('0格');
  });

  it('keeps invalid connection and overrange distinct from a valid open-circuit zero', () => {
    const bad = presented(model('multimeter', { functionMode: 1, connection: 0 }));
    expect(bad.value('meterValue')).toContain('无有效读数'); expect(bad.value('configurationValid')).toBe('否 ');
    const over = presented(model('multimeter', { functionMode: 0, connection: 0, rangeIndex: 0 }));
    expect(over.value('meterValue')).toContain('无有效读数'); expect(over.value('overRange')).toBe('是 ');
    const open = presented(model('multimeter', { functionMode: 0, connection: 0, circuitClosed: 0 }));
    expect(open.value('meterValue')).toBe('0V'); expect(open.value('readingValid')).toBe('是 ');
  });

  it('labels total reflection, undefined periods and straight-line radii without false zero observations', () => {
    const tir = presented(model('refractive-index', { incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: 60 }));
    expect(tir.value('refractedAngleDegrees')).toContain('无折射光'); expect(tir.value('sinRefracted')).toContain('无折射光'); expect(tir.value('totalInternalReflection')).toBe('是 ');
    const still = presented(model('centripetal-force', { angularSpeed: 0 })); expect(still.value('period')).toContain('无周期');
    const straight = presented(model('charged-particle-field', { magneticFieldMicrotesla: 0 })); expect(straight.value('radius')).toContain('无回旋半径'); expect(straight.value('period')).toContain('无周期');
  });

  it('keeps DC transformer and zero excitation estimators explicitly outside their valid model', () => {
    const dc = presented(model('transformer-ratio', { inputMode: 1 }));
    for (const key of ['secondaryRmsVoltage', 'primaryCurrentRms', 'secondaryCurrentRms', 'primaryPower', 'secondaryPower']) expect(dc.value(key)).toContain('无有效读数');
    expect(presented(model('resistivity', { voltage: 0 })).value('estimatedResistivity')).toContain('尚不可估计');
    expect(presented(model('refractive-index', { incidentAngleDegrees: 0 })).value('indexRatioEstimate')).toContain('尚不可估计');
  });

  it('retains clear non-emission and no-collision states rather than implying a zero stopping voltage or immediate impact', () => {
    const noEmission = presented(model('photoelectric-effect', { frequencyTHz: 100 })); expect(noEmission.value('stoppingVoltage')).toContain('无出射电子');
    const noCollision = presented(model('momentum-conservation', { velocity1: -1, velocity2: 1 })); expect(noCollision.value('collisionTime')).toContain('不会相遇'); expect(noCollision.value('collided')).toBe('否 ');
  });

  it('renders labels as text and visibly marks non-finite input without discarding the rest of the readings', () => {
    const simulation = model('free-fall');
    simulation.metrics = [...simulation.metrics, { key: 'bad-test-value', label: '<script>alert(1)</script>', value: NaN, unit: 'm' }];
    const html = renderToStaticMarkup(<ExperimentReadings simulation={simulation} />);
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).toContain('—'); expect(presented(simulation).rows).toHaveLength(simulation.metrics.length);
  });
});
