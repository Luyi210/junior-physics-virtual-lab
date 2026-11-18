import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCapacitorHistory, defaultHighSchoolParameters, highSchoolExperiment, simulateHighSchoolExperiment, switchCapacitorMode } from '@physics-lab/physics/high-school';
import { getScopedMeasurementStore } from './measurementStorage';
import { measurementsToCsv, type HighSchoolMeasurement } from './workbench';
import { createClassroomEvidencePreview } from './classroomEvidence';
import { CapacitorHistoryDetails } from '../components/CapacitorHistoryDetails';
import { MeasurementRecoveryPanel } from '../components/MeasurementRecoveryPanel';

const p = { resistanceKOhm: 10, capacitanceMicrofarads: 470, emf: 6 };
const definition = highSchoolExperiment('capacitor-charge');
function record(): HighSchoolMeasurement {
  let history = createCapacitorHistory('run-evidence');
  history = switchCapacitorMode(p, history, 2, 'open');
  history = switchCapacitorMode(p, history, 4, 'discharge');
  return { id: 'cap-1', createdAt: '2026-11-11T02:00:00.000Z', parameters: { ...p }, timeSeconds: 5,
    capacitorHistory: history, metrics: simulateHighSchoolExperiment('capacitor-charge', p, 5, history).metrics };
}
function memoryStorage() {
  const entries = new Map<string, string>();
  return { entries, failReads: false, failWrites: false, get length() { return entries.size; },
    key(i: number) { return [...entries.keys()][i] ?? null; },
    getItem(key: string) { if (this.failReads) throw new Error('blocked'); return entries.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.failWrites) throw new Error('full'); entries.set(key, value); },
    removeItem(key: string) { entries.delete(key); },
  };
}
describe('capacitor history across saved evidence boundaries', () => {
  it('round-trips a complete independent copy and keeps it isolated from another owner', () => {
    const storage = memoryStorage(); const store = getScopedMeasurementStore('capacitor-charge', 'student-a', storage);
    const original = record(); store.append(original); const expected = structuredClone(original);
    original.capacitorHistory!.segments[1]!.mode = 'discharge'; original.metrics[0]!.value = 999;
    expect(store.read()).toEqual({ records: [expected], failed: false });
    expect(getScopedMeasurementStore('capacitor-charge', 'student-b', storage).read().records).toEqual([]);
    expect(getScopedMeasurementStore('capacitor-charge', 'student-a', storage).read().records[0]).toEqual(expected);
  });
  it('rejects missing, future and forged starting-voltage history without writing', () => {
    const storage = memoryStorage(); const store = getScopedMeasurementStore('capacitor-charge', 'a', storage);
    const missing = record(); delete missing.capacitorHistory;
    const future = record(); future.capacitorHistory!.segments[2]!.startTimeSeconds = 6;
    const injected = record(); Object.assign(injected.capacitorHistory!.segments[1]!, { initialVoltage: 5 });
    for (const invalid of [missing, future, injected]) expect(() => store.append(invalid)).toThrow();
    expect(storage.entries.size).toBe(0);
    const other = getScopedMeasurementStore('spring-force', 'a', storage);
    expect(() => other.append(record())).toThrow();
  });
  it('leaves malformed saved bytes in place and reports an unreadable record', () => {
    const storage = memoryStorage(); const store = getScopedMeasurementStore('capacitor-charge', 'a', storage);
    store.append(record()); const key = [...storage.entries.keys()][0]!;
    const invalid = record(); delete invalid.capacitorHistory; const bytes = JSON.stringify(invalid); storage.entries.set(key, bytes);
    expect(store.read()).toEqual({ records: [], failed: true }); expect(storage.entries.get(key)).toBe(bytes);
  });
  it('retains the same full process through pending writes and explicit unknown-generation recovery', () => {
    const storage = memoryStorage(); const store = getScopedMeasurementStore('capacitor-charge', 'a', storage);
    const saved = record(); storage.failWrites = true;
    expect(store.append(saved)).toMatchObject({ failed: true, records: [saved] });
    storage.failWrites = false; expect(store.retryPending()).toEqual({ failed: false, records: [saved] });
    const next = { ...record(), id: 'cap-2' }; storage.failReads = true;
    expect(store.append(next).recovery?.records).toEqual([next]);
    storage.failReads = false; const snapshot = store.read();
    expect(snapshot.records).toEqual([saved]); expect(snapshot.recovery?.records).toEqual([next]);
    const recovered = store.recoverPending(snapshot.recovery!.reviewToken);
    expect(recovered.recoveredCount).toBe(1); expect(recovered.records).toEqual([saved, next]);
  });
  it('exports exact switch JSON and retains original saved values in classroom copies', () => {
    const saved = record(); saved.metrics.find((entry) => entry.key === 'voltage')!.value = 1.23456789;
    const historyBytes = JSON.stringify(saved.capacitorHistory);
    expect(measurementsToCsv([saved], definition)).toContain(historyBytes.replaceAll('"', '""'));
    const preview = createClassroomEvidencePreview(definition, [saved], [], { automaticIds: [saved.id], manualIds: [] });
    expect(preview.text).toContain(historyBytes); expect(preview.text).toContain('1.23456789 V');
    expect(preview.text).toContain('段内历时 1 s'); expect(preview.text).toContain('不是实物实测');
    const invalid = { ...saved }; delete invalid.capacitorHistory;
    expect(() => createClassroomEvidencePreview(definition, [invalid], [], { automaticIds: [invalid.id], manualIds: [] })).toThrow(/完整开关/);
  });
  it('shows the saved process in normal and pending-recovery reviews', () => {
    const saved = record();
    const html = renderToStaticMarkup(<CapacitorHistoryDetails history={saved.capacitorHistory!} timeSeconds={saved.timeSeconds} />);
    expect(html).toContain('run-evidence'); expect(html).toContain('断路保持'); expect(html).toContain('经电阻放电'); expect(html).toContain('记录所在段');
    const pending = renderToStaticMarkup(<MeasurementRecoveryPanel records={[saved]} definition={definition} reviewToken="token" writable onExport={() => {}} onRecover={() => {}} />);
    expect(pending).toContain('run-evidence'); expect(pending).toContain('查看保存的开关过程');
  });
  it('does not add capacitor columns to existing experiments', () => {
    const parameters = defaultHighSchoolParameters('spring-force');
    const csv = measurementsToCsv([{ id: 'spring', createdAt: record().createdAt, timeSeconds: 0, parameters, metrics: simulateHighSchoolExperiment('spring-force', parameters).metrics }], highSchoolExperiment('spring-force'));
    expect(csv).not.toContain('开关过程');
  });
});
