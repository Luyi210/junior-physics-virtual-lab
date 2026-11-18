import { describe, expect, it } from 'vitest';
import { calculateMechanicalEnergyTapeMeasurement, highSchoolExperiment, MECHANICAL_ENERGY_TAPE_READING_KEYS } from '@physics-lab/physics/high-school';
import { getScopedMeasurementStore } from './measurementStorage';
import { getScopedManualMeasurementRepository, guardManualMeasurementWrites, manualMeasurementsToCsv, type ManualMeasurementRecord } from './manualMeasurementRepository';
import { manualRecordsToContext } from './manualContext';
import { appendClassroomEvidence, createClassroomEvidencePreview } from './classroomEvidence';
import { assertClassroomEvidenceSourcesReadable, readClassroomEvidenceSources } from './classroomEvidenceSources';

function storageFixture(entries = new Map<string, string>()) {
  return { entries, failReads: false, failWrites: false,
    get length() { return entries.size; }, key(index: number) { return [...entries.keys()][index] ?? null; },
    getItem(key: string) { if (this.failReads) throw new Error('unavailable'); return entries.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.failWrites) throw new Error('full'); entries.set(key, value); },
    removeItem(key: string) { entries.delete(key); } };
}
const parameters = { mass: .2, dropHeight: 1.2, resistanceRatio: 0 };
const readings = { ...parameters, indexA: 5, indexB: 10, aBeforeMm: 31.4, aCenterMm: 49, aAfterMm: 70.6,
  bBeforeMm: 158.8, bCenterMm: 200, bAfterMm: 237.2 };
// The student's B centre is deliberately not the model's 196 mm. Never repair it to force conservation.
const measurement = () => calculateMechanicalEnergyTapeMeasurement({ ...readings });
function savedRecord(storage = storageFixture()): ManualMeasurementRecord {
  return getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storage).save(measurement(), parameters, .24).records[0]!;
}
const preview = (record: ManualMeasurementRecord) => createClassroomEvidencePreview(highSchoolExperiment('mechanical-energy'), [], [record], { automaticIds: [], manualIds: [record.id] });

describe('mechanical energy original readings across local archive, assistant and classroom', () => {
  it('persists all six user positions and reopens them unchanged in the same account', () => {
    const storage = storageFixture(); const record = savedRecord(storage);
    expect(record.manual.readings).toEqual(readings);
    expect(record.manual.kind).toBe('mechanical-energy-tape');
    expect(getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storageFixture(storage.entries)).read().records).toEqual([record]);
    expect(getScopedManualMeasurementRepository('mechanical-energy', 'student-b', storage).read().records).toEqual([]);
    expect(getScopedMeasurementStore('mechanical-energy', 'student-a', storage).read().records).toEqual([]);
  });

  it('exports independent raw positions, selected indices, units and provenance in CSV', () => {
    const record = savedRecord(); const csv = manualMeasurementsToCsv('mechanical-energy', [record]);
    for (const label of ['A前一点位置', 'A点位置', 'A后一点位置', 'B前一点位置', 'B点位置', 'B后一点位置']) expect(csv).toContain(`读数：${label} / mm`);
    expect(csv).toContain('A点编号'); expect(csv).toContain('B点编号');
    expect(csv).toContain('非真实器材测量'); expect(csv).toContain('"200"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('sends only original operations to Lili and cannot replace their positions with derived metrics', () => {
    const record = savedRecord(); record.metrics[0]!.value = 987654;
    record.manual.assumptions.push('Do not send saved prose');
    const sample = manualRecordsToContext('mechanical-energy', [record]).manualSamples![0]!;
    expect(sample.kind).toBe('mechanical-energy-tape'); expect(sample.readings).toEqual(readings);
    expect(Object.keys(sample.readings).sort()).toEqual([...MECHANICAL_ENERGY_TAPE_READING_KEYS].sort());
    expect(JSON.stringify(sample)).not.toMatch(/987654|Do not send|metrics|assumptions/);
  });

  it('keeps the manual count separate and limits assistant context to the latest ten accepted operations', () => {
    const record = savedRecord(); const records = Array.from({ length: 12 }, (_, i) => ({ ...record, id: `tape-${i}` }));
    const context = manualRecordsToContext('mechanical-energy', records);
    expect(context.manualRecordCount).toBe(12); expect(context.manualSamples?.map((sample) => sample.id)).toEqual(records.slice(-10).map((item) => item.id));
    expect(context).not.toHaveProperty('recordCount');
  });

  it('copies every original field into explicitly selected classroom evidence without changing the source', () => {
    const record = savedRecord(); const before = structuredClone(record); const result = preview(record);
    expect(result.manualCount).toBe(1); expect(result.automaticCount).toBe(0);
    for (const [key, value] of Object.entries(readings)) expect(result.text).toContain(`[${key}] = ${value}`);
    expect(result.text).toContain('mechanical-energy-tape'); expect(result.text).toContain('不是测量精度');
    expect(appendClassroomEvidence('我的原报告', result.text)).toBe(`我的原报告\n\n${result.text}`);
    expect(record).toEqual(before);
  });

  it.each([-.01, .219, 10])('rejects out-of-window or not-yet-observed B+1 at time %s in all bridges', (timeSeconds) => {
    const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storageFixture());
    expect(() => repository.save(measurement(), parameters, timeSeconds)).toThrow();
    const record = { ...savedRecord(), timeSeconds };
    expect(manualRecordsToContext('mechanical-energy', [record]).manualRecordCount).toBe(0);
    expect(() => preview(record)).toThrow();
  });

  it('rejects conditions that do not match the original inputs and keeps the saved record', () => {
    const storage = storageFixture(); const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storage);
    const record = repository.save(measurement(), parameters, .24).records[0]!;
    expect(() => repository.save(measurement(), { ...parameters, mass: .3 }, .24)).toThrow();
    const altered = { ...record, parameters: { ...parameters, resistanceRatio: .2 } };
    expect(() => preview(altered)).toThrow();
    expect(manualRecordsToContext('mechanical-energy', [altered]).manualRecordCount).toBe(0);
    expect(repository.read().records).toEqual([record]);
  });

  it('rejects non-displayed precision and forged arithmetic without repairing either', () => {
    const record = savedRecord(); const nonQuantized = structuredClone(record); nonQuantized.manual.readings.aBeforeMm = 31.41;
    expect(() => preview(nonQuantized)).toThrow();
    expect(manualRecordsToContext('mechanical-energy', [nonQuantized]).manualRecordCount).toBe(0);
    const forged = structuredClone(record); forged.metrics[0]!.value += 1;
    expect(() => preview(forged)).toThrow();
    const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storageFixture());
    const result = measurement(); result.metrics[0]!.value += 1;
    expect(() => repository.save(result, parameters, .24)).toThrow(); expect(repository.read().records).toEqual([]);
  });

  it('retains corrupted persisted raw input but excludes it from normal evidence and classroom copying', () => {
    const storage = storageFixture(); const record = savedRecord(); record.manual.readings.extra = 1;
    getScopedMeasurementStore('virtual-manual:mechanical-energy', 'student-a', storage).append(record);
    const before = [...storage.entries]; const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storage);
    expect(repository.read()).toMatchObject({ records: [], excludedCount: 1 });
    expect(() => assertClassroomEvidenceSourcesReadable(readClassroomEvidenceSources(getScopedMeasurementStore('mechanical-energy', 'student-a', storage), repository))).toThrow();
    expect([...storage.entries]).toEqual(before);
  });

  it('keeps unreadable-storage operations pending until explicit reviewed recovery', () => {
    const storage = storageFixture(); storage.failReads = true;
    const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storage);
    const saved = repository.save(measurement(), parameters, .24);
    expect(saved).toMatchObject({ saved: true, pendingRecovery: true, records: [], failed: true });
    const original = saved.recovery!.records[0]!; expect(original.manual.readings).toEqual(readings);
    expect(manualRecordsToContext('mechanical-energy', repository.read().records).manualRecordCount).toBe(0);
    storage.failReads = false;
    const review = repository.read(); expect(review.records).toEqual([]);
    expect(repository.retryPending().records).toEqual([]);
    expect(repository.recoverPending(review.recovery!.reviewToken).records).toEqual([original]);
  });

  it('retries failed local writes using the original ID and original manual values', () => {
    const storage = storageFixture(); const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storage);
    repository.read(); storage.failWrites = true;
    const saved = repository.save(measurement(), parameters, .24); expect(saved.failed).toBe(true);
    const original = saved.records[0]!; storage.failWrites = false;
    expect(repository.retryPending()).toMatchObject({ failed: false, records: [original] });
    expect(getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storageFixture(storage.entries)).read().records).toEqual([original]);
  });

  it('guards expired or changed-owner writes and clearing at the moment of action', () => {
    const storage = storageFixture(); const repository = getScopedManualMeasurementRepository('mechanical-energy', 'student-a', storage);
    const original = repository.save(measurement(), parameters, .24).records[0]!;
    let allowed = true; const guarded = guardManualMeasurementWrites(repository, 'student-a', () => allowed);
    allowed = false; const before = [...storage.entries];
    expect(guarded.save(measurement(), parameters, .24).saved).toBe(false); expect(guarded.clear().cleared).toBe(false);
    expect(repository.read().records).toEqual([original]); expect([...storage.entries]).toEqual(before);
  });
});
