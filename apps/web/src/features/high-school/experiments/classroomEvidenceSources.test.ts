import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { getScopedMeasurementStore } from './measurementStorage';
import { assertClassroomEvidenceSourcesReadable, readClassroomEvidenceSources } from './classroomEvidenceSources';

function storageFixture() {
  const entries = new Map<string, string>();
  return { entries, failReads: false, failWrites: false,
    get length() { return entries.size; }, key(index: number) { return [...entries.keys()][index] ?? null; },
    getItem(key: string) { if (this.failReads) throw new Error('unavailable'); return entries.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.failWrites) throw new Error('full'); entries.set(key, value); },
    removeItem(key: string) { entries.delete(key); } };
}
const parameters = defaultHighSchoolParameters('spring-force');
const record = (id: string) => ({ id, createdAt: '2026-11-11T00:00:00.000Z', timeSeconds: 0, parameters: { ...parameters }, metrics: simulateHighSchoolExperiment('spring-force', parameters, 0).metrics });

describe('classroom evidence archive boundary', () => {
  it('reads only the requested scope and leaves guest, other accounts, experiments and legacy archives untouched', () => {
    const storage = storageFixture();
    storage.setItem('physics-high-school-measurements-v1:spring-force', JSON.stringify([record('legacy')]));
    getScopedMeasurementStore('spring-force', 'guest', storage).append(record('guest'));
    getScopedMeasurementStore('spring-force', 'other-account', storage).append(record('other'));
    getScopedMeasurementStore('pendulum', 'student', storage).append(record('other-experiment'));
    const own = getScopedMeasurementStore('spring-force', 'student', storage); own.append(record('own'));
    const before = [...storage.entries];
    const sources = readClassroomEvidenceSources(own);
    expect(sources.automatic.map((item) => item.id)).toEqual(['own']);
    expect(sources.manual).toEqual([]);
    expect([...storage.entries]).toEqual(before);
    expect(() => assertClassroomEvidenceSourcesReadable(sources)).not.toThrow();
  });
  it('does not apply the AI context limit to the normal archive', () => {
    const store = getScopedMeasurementStore('spring-force', 'student', storageFixture());
    for (let index = 0; index < 40; index++) store.append(record(String(index)));
    expect(readClassroomEvidenceSources(store).automatic).toHaveLength(40);
  });
  it('does not promote unknown-generation recovery copies or write them during selection', () => {
    const storage = storageFixture(); storage.failReads = true;
    const store = getScopedMeasurementStore('spring-force', 'student', storage);
    store.append(record('unknown-generation'));
    storage.failReads = false;
    const before = [...storage.entries];
    const sources = readClassroomEvidenceSources(store);
    expect(sources.automatic).toEqual([]); expect(sources.recoveryCount).toBe(1);
    expect(() => assertClassroomEvidenceSourcesReadable(sources)).toThrow('待恢复');
    expect([...storage.entries]).toEqual(before);
  });
  it('blocks stale last-readable snapshots when storage becomes unavailable', () => {
    const storage = storageFixture(); const store = getScopedMeasurementStore('spring-force', 'student', storage);
    store.append(record('old')); storage.failReads = true;
    const sources = readClassroomEvidenceSources(store);
    expect(sources.automatic).toHaveLength(1); expect(sources.failed).toBe(true);
    expect(() => assertClassroomEvidenceSourcesReadable(sources)).toThrow('未追加');
  });
  it('never retries a failed pending write as a side effect of reading for a report', () => {
    const storage = storageFixture(); const store = getScopedMeasurementStore('spring-force', 'student', storage);
    store.read(); storage.failWrites = true; store.append(record('pending')); storage.failWrites = false;
    const before = [...storage.entries];
    expect(() => assertClassroomEvidenceSourcesReadable(readClassroomEvidenceSources(store))).toThrow();
    expect([...storage.entries]).toEqual(before);
    store.retryPending(); expect(() => assertClassroomEvidenceSourcesReadable(readClassroomEvidenceSources(store))).not.toThrow();
  });
  it('separately counts invalid manual and all manual recovery records without presenting them as selectable', () => {
    const sources = readClassroomEvidenceSources({ read: () => ({ records: [], failed: false }) }, { read: () => ({ records: [], failed: false, excludedCount: 2, recovery: { records: [], reviewToken: null, excludedCount: 1 }, rawRecoveryRecords: [record('invalid-recovery')] }) });
    expect(sources).toMatchObject({ automatic: [], manual: [], recoveryCount: 1, excludedManualCount: 2, failed: true });
    expect(() => assertClassroomEvidenceSourcesReadable(sources)).toThrow();
  });
});
