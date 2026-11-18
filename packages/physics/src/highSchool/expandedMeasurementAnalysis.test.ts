import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters } from './catalog';
import { simulateHighSchoolExperiment } from './simulation';
import { analyzeHighSchoolMeasurements, type HighSchoolAnalysisMeasurement as Reading } from './measurementAnalysis';
import type { HighSchoolExperimentId } from './types';

function sample(id: HighSchoolExperimentId, changes: Record<string, number> = {}, timeSeconds = 0, key = JSON.stringify([changes, timeSeconds])): Reading {
  const parameters = { ...defaultHighSchoolParameters(id), ...changes };
  return { id: key, timeSeconds, parameters, metrics: simulateHighSchoolExperiment(id, parameters, timeSeconds).metrics };
}
function ready(id: HighSchoolExperimentId, records: Reading[], relationshipId: string) {
  const analysis = analyzeHighSchoolMeasurements(id, records);
  expect(analysis.excluded).toEqual([]);
  const group = analysis.groups.find(g => g.relationshipId === relationshipId && g.status === 'ready');
  expect(group, `${id}/${relationshipId}`).toBeDefined(); return group!;
}

describe('fourteen new experiments analyze captured readings with their own controlled conditions', () => {
  it('separates the three centripetal relationships and does not count opposite rotation as a new squared speed', () => {
    const id = 'centripetal-force';
    expect(ready(id, [.1, .2, .3].map(mass => sample(id, {mass})), 'centripetal-force-mass').fit!.slope).toBeCloseTo(2);
    expect(ready(id, [.2, .4, .6].map(radius => sample(id, {radius})), 'centripetal-force-radius').fit!.slope).toBeCloseTo(.8);
    expect(ready(id, [1, 2, 3].map(angularSpeed => sample(id, {angularSpeed})), 'centripetal-force-omega-squared').fit!.slope).toBeCloseTo(.1);
    const group = analyzeHighSchoolMeasurements(id, [-2, 2, 0].map(angularSpeed => sample(id, {angularSpeed}))).groups.find(g => g.relationshipId === 'centripetal-force-omega-squared')!;
    expect(group.distinctXCount).toBe(2); expect(group.fit).toBeNull();
  });
  it('uses actual saved positions in free-fall and rejects post-landing times', () => {
    const id = 'free-fall', rows = [0, .2, .4].map(t => sample(id, {}, t));
    expect(ready(id, rows, 'free-fall-distance-time-squared').estimates[0]!.value).toBeCloseTo(9.8);
    rows[2]!.metrics.find(m => m.key === 'position')!.value += .1;
    expect(ready(id, rows, 'free-fall-distance-time-squared').estimates[0]!.value).not.toBeCloseTo(9.8);
    const wrong = sample(id); wrong.timeSeconds = 2;
    expect(analyzeHighSchoolMeasurements(id, [wrong]).excluded[0]!.reason).toContain('观察窗口');
  });
  it('keeps before-collision snapshots out of after-collision fits and retains center-of-mass kinetic energy', () => {
    const id = 'momentum-conservation';
    expect(ready(id, [.5, 1, 2].map(velocity1 => sample(id, {velocity1}, 2)), 'momentum-after-before').fit!.slope).toBeCloseTo(1);
    const group = ready(id, [0, .5, 1].map(restitution => sample(id, {restitution, velocity1: 2, velocity2: 0}, 2)), 'collision-energy-restitution-squared');
    expect(group.fit!.intercept).toBeCloseTo(.5); expect(group.fit!.slope).toBeCloseTo(.5);
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {}, 0)]).excluded[0]!.reason).toContain('尚未发生碰撞');
  });
  it('requires object contact and zero correction for the precision length comparison', () => {
    const id = 'precision-length';
    const group = ready(id, [2, 5, 8].map(objectLengthMm => sample(id, {objectLengthMm, contactMode: 2, zeroCorrection: 1})), 'precision-corrected-length');
    expect(group.fit!.slope).toBeCloseTo(1); expect(group.fit!.intercept).toBeCloseTo(0);
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {contactMode: 1})]).excluded[0]!.reason).toContain('零点检查');
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {contactMode: 2, zeroCorrection: 0})]).groups[0]!.status).toBe('unsupported');
  });
  it('estimates resistivity with squared diameter conversion and separates voltage changes from length changes', () => {
    const id = 'resistivity';
    const group = ready(id, [.5, 1, 1.5].map(length => sample(id, {length})), 'resistivity-resistance-length');
    expect(group.estimates[0]!.value).toBeCloseTo(1.1e-6, 13);
    const electric = ready(id, [0, 1, 2].map(voltage => sample(id, {voltage})), 'resistivity-voltage-current');
    expect(electric.fit!.slope).toBeCloseTo(1.1e-6 / (Math.PI * .0005 ** 2 / 4));
  });
  it('fits each multimeter function only with compatible connection, range and units', () => {
    const id = 'multimeter';
    const voltage = ready(id, [1, 2, 3].map(supplyVoltage => sample(id, {supplyVoltage})), 'multimeter-reading-reference');
    expect(voltage.fit!.slope).toBeCloseTo(1);
    const current = ready(id, [1, 2, 3].map(supplyVoltage => sample(id, {supplyVoltage, functionMode: 1, connection: 1})), 'multimeter-reading-reference');
    expect(current.fit!.slope).toBeCloseTo(1);
    const ohms = ready(id, [100, 500, 1000].map(resistanceOhms => sample(id, {resistanceOhms, functionMode: 2, connection: 2, powerOn: 0})), 'multimeter-reading-reference');
    expect(ohms.fit!.slope).toBeCloseTo(1);
    const bad = [sample(id, {connection: 1}), sample(id, {rangeIndex: 0})];
    expect(analyzeHighSchoolMeasurements(id, bad).acceptedCount).toBe(0);
    const wrongUnit = sample(id); wrongUnit.metrics.find(m => m.key === 'meterValue')!.unit = 'A';
    expect(analyzeHighSchoolMeasurements(id, [wrongUnit]).excluded[0]!.reason).toContain('单位');
  });
  it('uses saved sines for refraction, permits the origin and excludes total reflection', () => {
    const id = 'refractive-index';
    expect(ready(id, [0, 20, 40].map(incidentAngleDegrees => sample(id, {incidentAngleDegrees})), 'refraction-sines').estimates[0]!.value).toBeCloseTo(1.5);
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: 60})]).acceptedCount).toBe(0);
  });
  it('recovers turns from negative flux rate even when the circuit is open', () => {
    const id = 'induced-current';
    const group = ready(id, [0, .25, .5].map(t => sample(id, {closed: 0}, t)), 'induced-emf-flux-rate');
    expect(group.estimates[0]!.value).toBeCloseTo(100);
    const rows = [0, .25, .5].map(t => sample(id, {}, t)); rows[1]!.metrics.find(m => m.key === 'emf')!.value *= 2;
    expect(ready(id, rows, 'induced-emf-flux-rate').fit!.rSquared).toBeLessThan(1);
  });
  it('uses transformer RMS voltage, not sampled instantaneous voltage, and rejects DC', () => {
    const id = 'transformer-ratio';
    const group = ready(id, [3, 6, 9].map(primaryRmsVoltage => sample(id, {primaryRmsVoltage}, .005)), 'transformer-secondary-primary');
    expect(group.fit!.slope).toBeCloseTo(2);
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {inputMode: 1})]).acceptedCount).toBe(0);
  });
  it('fits sensor response time and preserves a distinct steady zero-difference group', () => {
    const id = 'sensor-control', rows = [0, .5, 1].map(t => sample(id, {responseTime: 2}, t));
    expect(ready(id, rows, 'sensor-log-response-time').estimates[0]!.value).toBeCloseTo(2);
    expect(ready(id, rows, 'sensor-voltage-temperature').fit!.slope).toBeCloseTo(.025);
    const analysis = analyzeHighSchoolMeasurements(id, [sample(id, {temperatureEnd: 20})]);
    expect(analysis.excluded).toEqual([]); expect(analysis.groups.find(g => g.relationshipId === 'sensor-log-response-time')?.status).toBe('unsupported');
  });
  it('keeps nanometre-scale oil thickness and returns the pure oil volume from the slope', () => {
    const id = 'oil-film';
    expect(ready(id, [50, 100, 150].map(filmAreaCm2 => sample(id, {filmAreaCm2})), 'oil-thickness-inverse-area').estimates[0]!.value).toBeCloseTo(2e-11, 20);
  });
  it('uses absolute pressure for gas even when gauge pressure is negative', () => {
    const id = 'gas-pressure-volume';
    const rows = [30, 60, 90].map(volumeMl => sample(id, {volumeMl}));
    expect(rows[2]!.metrics.find(m => m.key === 'gaugePressureKPa')!.value).toBeLessThan(0);
    expect(ready(id, rows, 'gas-pressure-inverse-volume').estimates[0]!.value).toBeCloseTo(.001 * 8.31446261815324 * 293.15);
  });
  it('fits the photoelectric slope only above threshold with nonzero illumination', () => {
    const id = 'photoelectric-effect';
    const group = ready(id, [600, 800, 1000].map(frequencyTHz => sample(id, {frequencyTHz})), 'photo-stopping-frequency');
    expect(group.estimates[0]!.value).toBeCloseTo(6.62607015e-34 / 1.602176634e-19, 25);
    expect(group.estimates[1]!.value).toBeCloseTo(2);
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {frequencyTHz: 100}), sample(id, {opticalPowerMilliwatts: 0})]).acceptedCount).toBe(0);
  });
  it('fits magnetic radius against speed while excluding straight-line placeholders', () => {
    const id = 'charged-particle-field';
    expect(ready(id, [1, 2, 3].map(speedKmPerSecond => sample(id, {speedKmPerSecond})), 'particle-radius-speed').estimates[0]!.value).toBeCloseTo(10);
    expect(analyzeHighSchoolMeasurements(id, [sample(id, {magneticFieldMicrotesla: 0}), sample(id, {chargeToMassMillions: 0})]).acceptedCount).toBe(0);
  });
  it('never supplements a missing saved value, changes units, merges differing controls, or counts repeated clicks as new settings', () => {
    const id = 'gas-pressure-volume', rows = [20, 40, 60].map(volumeMl => sample(id, {volumeMl}));
    rows[1]!.metrics = rows[1]!.metrics.filter(m => m.key !== 'pressure');
    expect(analyzeHighSchoolMeasurements(id, rows).excluded).toHaveLength(1);
    const mixed = [sample(id, {volumeMl: 20}), sample(id, {volumeMl: 40, temperatureCelsius: 30}), sample(id, {volumeMl: 60})];
    expect(analyzeHighSchoolMeasurements(id, mixed).groups.every(g => g.fit === null)).toBe(true);
    expect(analyzeHighSchoolMeasurements(id, [0, 1, 2].map(i => sample(id, {}, 0, String(i)))).groups[0]!.distinctXCount).toBe(1);
  });
});
