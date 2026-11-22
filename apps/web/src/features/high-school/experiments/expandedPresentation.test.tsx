import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { calculateTransformerRatio, defaultHighSchoolParameters, highSchoolExperiment, simulateHighSchoolExperiment } from '@physics-lab/physics';
import { formatMetric, metricState } from './measurementPresentation';
import { measurementsToCsv } from './workbench';
import { createClassroomEvidencePreview } from './classroomEvidence';
import { ExperimentParameterControl } from '../components/ExperimentParameterControl';
import { useExperimentClock } from './useExperimentClock';
import { defaultPlaybackSpeed, physicalPlaybackRate } from './playbackSpeed';

const clock = vi.hoisted(() => ({ time: 0, use: vi.fn(), toggle: vi.fn(), reset: vi.fn(), step: vi.fn() }));
vi.mock('../../../shared/hooks/useSimulationClock', () => ({ useSimulationClock: (duration: number, rate: number, step: number) => { clock.use(duration, rate, step); return {time: clock.time, running: true, toggle: clock.toggle, reset: clock.reset, step: clock.step}; } }));

describe('new instrument presentation preserves validity and physical time', () => {
  it.each([1, 50, 100])('keeps transformer clock and calculations in physical seconds at %s Hz', frequency => {
    clock.time = 1 / (4 * frequency);
    const result = useExperimentClock(3 / frequency, physicalPlaybackRate('transformer-ratio', 1, frequency), 1 / (60 * frequency));
    expect(clock.use).toHaveBeenLastCalledWith(3 / frequency, 1 / frequency, 1 / (60 * frequency));
    expect(result.time).toBeCloseTo(1 / (4 * frequency));
    expect(result.step).toBe(clock.step);
    const state = calculateTransformerRatio({...defaultHighSchoolParameters('transformer-ratio'), frequency}, result.time);
    expect(state.secondaryVoltage).toBeCloseTo(12 * Math.SQRT2);
    clock.time = 3 / frequency;
    expect(useExperimentClock(3 / frequency, 1 / frequency).time).toBe(3 / frequency);
  });
  it('keeps ordinary experiment seconds unchanged and slows short observations', () => {
    clock.time = 2.5; expect(useExperimentClock(5).time).toBe(2.5);
    expect(defaultPlaybackSpeed('projectile-motion', .7)).toBe(.1);
    expect(defaultPlaybackSpeed('projectile-motion', 1.5)).toBe(.25);
    expect(defaultPlaybackSpeed('uniform-acceleration', 5)).toBe(.5);
    expect(defaultPlaybackSpeed('refractive-index', 0)).toBe(1);
    expect(physicalPlaybackRate('projectile-motion', .25)).toBe(.25);
    expect(() => physicalPlaybackRate('transformer-ratio', 1, 0)).toThrow();
  });
  it.each([
    ['period', 'periodDefined', '无周期'], ['radius', 'radiusDefined', '无回旋半径'],
    ['criticalAngleDegrees', 'criticalDefined', '无临界角'], ['refractedAngleDegrees', 'transmissionValid', '无折射光'],
    ['estimatedResistivity', 'estimateDefined', '尚不可估计'], ['collisionTime', 'collisionPredicted', '不会相遇'],
    ['stoppingVoltage', 'emissionAllowed', '无出射电子'], ['meterValue', 'readingValid', '无有效读数'],
  ])('does not present the %s finite placeholder as a real zero', (key, flag, message) => {
    expect(formatMetric({key, value: 0}, {[flag]: 0})).toBe(message);
    expect(formatMetric({key, value: 0}, {[flag]: 1})).toBe('0');
  });
  it('preserves zero as a valid voltage/current and boolean flags as human-readable states', () => {
    const metrics = [{key: 'meterValue', value: 0}, {key: 'readingValid', value: 1}];
    expect(formatMetric(metrics[0], metricState(metrics))).toBe('0');
    expect(formatMetric(metrics[1], metricState(metrics))).toBe('是');
    expect(formatMetric({key: 'relayOn', value: 0}, {})).toBe('关闭');
  });
  it('uses named function choices and exports their original meaning with the record', () => {
    const definition = highSchoolExperiment('multimeter'); const parameter = definition.parameters.find(p => p.key === 'functionMode')!;
    const html = renderToStaticMarkup(<ExperimentParameterControl parameter={parameter} value={2} onChange={() => {}} />);
    expect(html).toContain('<select'); expect(html).toContain('电阻'); expect(html).not.toContain('type="range"');
    const parameters = {...defaultHighSchoolParameters('multimeter'), functionMode: 2, powerOn: 0, connection: 2};
    const record = {id: 'ohm', createdAt: '2026-11-11T03:00:00.000Z', timeSeconds: 0, parameters, metrics: simulateHighSchoolExperiment('multimeter', parameters).metrics};
    expect(measurementsToCsv([record], definition)).toContain('电阻');
    const preview = createClassroomEvidencePreview(definition, [record], [], {automaticIds: ['ohm'], manualIds: []});
    expect(JSON.stringify(preview)).toContain('电阻');
    record.parameters.powerOn = 1;
    expect(() => createClassroomEvidencePreview(definition, [record], [], {automaticIds: ['ohm'], manualIds: []})).toThrow('无效');
  });
});

it('keeps V, A and ohm history in separate display and CSV columns', async () => {
  const { measurementColumns, savedMetric } = await import('./workbench');
  const definition = highSchoolExperiment('multimeter');
  const records = [
    {functionMode: 0, connection: 0, powerOn: 1},
    {functionMode: 1, connection: 1, powerOn: 1},
    {functionMode: 2, connection: 2, powerOn: 0},
  ].map((patch, i) => { const parameters = {...defaultHighSchoolParameters('multimeter'), ...patch}; return {id: `mode-${i}`, createdAt: '2026-11-11T03:00:00.000Z', timeSeconds: 0, parameters, metrics: simulateHighSchoolExperiment('multimeter', parameters).metrics}; });
  const columns = measurementColumns(records).filter(m => m.key === 'meterValue');
  expect(columns.map(m => m.unit)).toEqual(['V', 'A', 'Ω']);
  expect(records.map(r => columns.map(c => savedMetric(r, c)?.value))).toEqual([[6, undefined, undefined], [undefined, .006, undefined], [undefined, undefined, 1000]]);
  const lines = measurementsToCsv(records, definition).split('\r\n').map(line => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match => match[1]));
  const indexes = columns.map(c => lines[0].indexOf(`${c.label} / ${c.unit}`));
  expect(indexes.every(i => i >= 0)).toBe(true);
  expect(lines.slice(1).map(row => indexes.map(i => row[i]))).toEqual([['6', '', ''], ['', '0.006', ''], ['', '', '1000']]);
  expect(formatMetric({key: 'readingValid', value: NaN}, {})).toBe('—');
});
