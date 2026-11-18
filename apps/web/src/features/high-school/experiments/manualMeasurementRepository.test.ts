import { describe, expect, it } from 'vitest';
import { calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement, defaultHighSchoolParameters } from '@physics-lab/physics/high-school';
import { createMeasurementStore, getScopedMeasurementStore } from './measurementStorage';
import { createManualMeasurementRepository, exportManualMeasurementsWhenCurrent, getScopedManualMeasurementRepository, guardManualMeasurementWrites, manualMeasurementsToCsv, manualRecoveryMeasurementsToCsv, manualRecoveryBackup, readLegacyManualMeasurements } from './manualMeasurementRepository';

function memoryStorage(entries = new Map<string, string>()) {
  return {
    entries, failWrites: false, failReads: false,
    get length() { return entries.size; },
    key(index: number) { return [...entries.keys()][index] ?? null; },
    getItem(key: string) { if (this.failReads) throw new Error('Storage unavailable'); return entries.get(key) ?? null; },
    setItem(key: string, value: string) { if (this.failWrites) throw new Error('Storage full'); entries.set(key, value); },
    removeItem(key: string) { entries.delete(key); }
  };
}
const pendulumParameters = (angle = 5) => ({ ...defaultHighSchoolParameters('pendulum'), length: 1, amplitudeDegrees: angle });
const timing = (angle = 5) => calculatePendulumTimingMeasurement({ startTimeSeconds: 1.23, endTimeSeconds: 11.25, periodCount: 5, length: 1, amplitudeDegrees: angle });

describe('manual readings awaiting explicit generation recovery', () => {
  it.each(['pendulum', 'double-slit'] as const)('keeps original %s readings separate through read/retry/clear until the reviewed recovery is explicit', (id) => {
    const storage = memoryStorage(); storage.failReads = true;
    const repository = getScopedManualMeasurementRepository(id, 'owner', storage);
    const parameters: Record<string, number> = id === 'pendulum' ? pendulumParameters() : defaultHighSchoolParameters(id);
    const result = id === 'pendulum' ? timing() : calculateDoubleSlitPositionMeasurement({ leftPositionMm: -3.3, rightPositionMm: 3.3, intervalCount: 2, slitSeparationMm: parameters.slitSeparationMm!, screenDistance: parameters.screenDistance! });
    const saved = repository.save(result, parameters, id === 'pendulum' ? 11.25 : 0);
    expect(saved).toMatchObject({ records: [], saved: true, pendingRecovery: true, failed: true, recovery: { reviewToken: null, excludedCount: 0 } });
    const original = saved.recovery!.records[0]!;
    expect(original.manual.readings).toEqual(result.readings);
    expect(original.parameters).toEqual(parameters);
    expect(repository.retryPending().records).toEqual([]);
    storage.failReads = false;
    const otherTab = getScopedManualMeasurementRepository(id, 'owner', memoryStorage(storage.entries));
    otherTab.clear();
    const preview = repository.read();
    expect(preview.recovery!.records).toEqual([original]);
    expect(preview.recovery!.reviewToken).toEqual(expect.any(String));
    expect(repository.retryPending().records).toEqual([]);
    expect([...storage.entries.keys()].some((key) => key.includes(':record:'))).toBe(false);
    const csv = manualRecoveryMeasurementsToCsv(id, preview.recovery!.records);
    expect(csv).toContain('待恢复的虚拟仪器手动读数');
    expect(csv).toContain('未加入当前档案');
    const backup = JSON.parse(manualRecoveryBackup(id, preview.rawRecoveryRecords!));
    expect(Object.keys(backup).sort()).toEqual(['experimentId', 'records', 'source']);
    expect(backup.records).toEqual([original]);
    expect(JSON.stringify(backup)).not.toContain(preview.recovery!.reviewToken);
    const recovered = repository.recoverPending(preview.recovery!.reviewToken);
    expect(recovered).toMatchObject({ recoveredCount: 1, records: [original], failed: false });
    expect(recovered.recovery).toBeUndefined();
    expect(otherTab.read().records).toEqual([original]);
  });

  it('includes recovery records in the new-reading limit without automatically importing them', () => {
    const storage = memoryStorage();
    const repository = getScopedManualMeasurementRepository('pendulum', 'limit-owner', storage);
    for (let index = 0; index < 119; index++) repository.save(timing(), pendulumParameters(), 11.25);
    storage.failReads = true;
    const last = repository.save(timing(), pendulumParameters(), 11.25);
    expect(last.records).toHaveLength(119);
    expect(last.recovery!.records).toHaveLength(1);
    storage.failReads = false;
    const blocked = repository.save(timing(), pendulumParameters(), 11.25);
    expect(blocked.saved).toBe(false);
    expect(blocked.records).toHaveLength(119);
    expect(blocked.recovery!.records).toEqual(last.recovery!.records);
    expect(repository.recoverPending(blocked.recovery!.reviewToken).records).toHaveLength(120);
  });

  it('never recovers hidden invalid entries and preserves the entire raw batch for backup', () => {
    const source = createManualMeasurementRepository('pendulum', memoryStorage());
    const original = source.save(timing(), pendulumParameters(), 11.25).records[0]!;
    const corrupt = { ...original, id: 'invalid-manual', manual: { ...original.manual, readings: { ...original.manual.readings, periodCount: 0 } } };
    const storage = memoryStorage(); storage.failReads = true;
    const rawStore = getScopedMeasurementStore('virtual-manual:pendulum', 'mixed-owner', storage);
    rawStore.append(original); rawStore.append(corrupt);
    const repository = getScopedManualMeasurementRepository('pendulum', 'mixed-owner', storage);
    storage.failReads = false;
    const preview = repository.read();
    expect(preview.records).toEqual([]);
    expect(preview.recovery).toMatchObject({ records: [original], excludedCount: 1 });
    expect(preview.rawRecoveryRecords).toHaveLength(2);
    const before = [...storage.entries];
    expect(repository.recoverPending(preview.recovery!.reviewToken)).toMatchObject({ recoveredCount: 0, error: expect.stringContaining('无法校验') });
    expect([...storage.entries]).toEqual(before);
    const backup = JSON.parse(manualRecoveryBackup('pendulum', repository.read().rawRecoveryRecords!));
    expect(backup.records).toContainEqual(corrupt);
    expect(backup.records).toContainEqual(original);
    expect(repository.read().rawRecoveryRecords).toHaveLength(2);
  });

  it('keeps the remaining original reading after partial failure and requires a fresh review token', () => {
    const storage = memoryStorage(); storage.failReads = true;
    const repository = getScopedManualMeasurementRepository('pendulum', 'partial-owner', storage);
    repository.save(timing(), pendulumParameters(), 11.25);
    repository.save(timing(30), pendulumParameters(30), 11.25);
    storage.failReads = false;
    const before = repository.read();
    const original = before.recovery!.records;
    const write = storage.setItem.bind(storage);
    let availableWrites = 1;
    storage.setItem = (key, value) => { if (key.includes(':record:') && availableWrites-- <= 0) throw new Error('quota'); write(key, value); };
    const partial = repository.recoverPending(before.recovery!.reviewToken);
    expect(partial.recoveredCount).toBe(1);
    expect(partial.records).toHaveLength(1);
    expect(partial.recovery!.records).toHaveLength(1);
    expect([...partial.records, ...partial.recovery!.records].sort((a, b) => a.id.localeCompare(b.id))).toEqual([...original].sort((a, b) => a.id.localeCompare(b.id)));
    expect(partial.recovery!.reviewToken).not.toBe(before.recovery!.reviewToken);
    availableWrites = 10;
    expect(repository.recoverPending(before.recovery!.reviewToken).recoveredCount).toBe(0);
    const current = repository.read();
    const completed = repository.recoverPending(current.recovery!.reviewToken);
    expect(completed.recoveredCount).toBe(1);
    expect(completed.recovery).toBeUndefined();
    expect(completed.records).toHaveLength(2);
  });

  it('guards recovery and both recovery exports against an owner change while allowing read-only backups', () => {
    const storage = memoryStorage(); storage.failReads = true;
    const repository = getScopedManualMeasurementRepository('pendulum', 'owner-a', storage);
    repository.save(timing(), pendulumParameters(), 11.25); storage.failReads = false;
    const preview = repository.read();
    let owner = 'owner-a'; let writable = true;
    const writes = guardManualMeasurementWrites(repository, 'owner-a', () => owner === 'owner-a' && writable);
    owner = 'owner-b';
    expect(writes.recoverPending(preview.recovery!.reviewToken)).toMatchObject({ recoveredCount: 0, error: expect.stringContaining('未执行') });
    let csv = ''; let backup = '';
    const exportCsv = () => exportManualMeasurementsWhenCurrent('owner-a', () => owner === 'owner-a', () => { csv = manualRecoveryMeasurementsToCsv('pendulum', preview.recovery!.records); });
    const exportBackup = () => exportManualMeasurementsWhenCurrent('owner-a', () => owner === 'owner-a', () => { backup = manualRecoveryBackup('pendulum', preview.rawRecoveryRecords!); });
    expect(exportCsv().exported).toBe(false); expect(exportBackup().exported).toBe(false);
    expect(csv).toBe(''); expect(backup).toBe(''); expect(storage.entries.size).toBe(0);
    owner = 'owner-a'; writable = false;
    expect(writes.recoverPending(preview.recovery!.reviewToken).recoveredCount).toBe(0);
    expect(exportCsv().exported).toBe(true); expect(exportBackup().exported).toBe(true);
    expect(JSON.parse(backup).records).toEqual(preview.rawRecoveryRecords);
    expect(repository.read().records).toEqual([]);
    writable = true;
    expect(writes.recoverPending(preview.recovery!.reviewToken).recoveredCount).toBe(1);
  });
});

describe('manual virtual instrument records', () => {
  it('keeps raw readings and condition snapshots independently from automatic samples', () => {
    const storage = memoryStorage();
    const model = createMeasurementStore('pendulum', storage);
    model.append({ id: 'automatic', createdAt: '2026-11-11T00:00:00.000Z', timeSeconds: 2, parameters: pendulumParameters(), metrics: [] });
    const manual = createManualMeasurementRepository('pendulum', storage);
    const parameters = pendulumParameters();
    const result = timing();
    expect(manual.save(result, parameters, 11.25)).toMatchObject({ saved: true, failed: false });
    parameters.length = 2;
    result.readings.periodCount = 99;
    const restored = createManualMeasurementRepository('pendulum', storage).read().records[0]!;
    expect(restored.parameters.length).toBe(1);
    expect(restored.manual.readings.periodCount).toBe(5);
    expect(restored.manual.provenance).toBe('virtual-manual');
    expect(manual.clear().cleared).toBe(true);
    expect(model.read().records.map((record) => record.id)).toEqual(['automatic']);
    expect(manual.matchesKey('physics-high-school-measurements-v2:pendulum:generation')).toBe(false);
  });

  it('preserves interleaved manual additions and does not revive cleared history', () => {
    const storage = memoryStorage();
    const a = createManualMeasurementRepository('pendulum', storage);
    const b = createManualMeasurementRepository('pendulum', storage);
    a.read(); b.read();
    a.save(timing(), pendulumParameters(), 11.25);
    b.save(timing(), pendulumParameters(), 11.25);
    expect(a.read().records).toHaveLength(2);
    b.clear();
    a.save(timing(), pendulumParameters(), 11.25);
    expect(b.read().records).toHaveLength(1);
  });

  it('retains failed writes in memory for export and retries on the next save', () => {
    const storage = memoryStorage();
    const repository = createManualMeasurementRepository('pendulum', storage);
    storage.failWrites = true;
    expect(repository.save(timing(), pendulumParameters(), 11.25)).toMatchObject({ saved: true, failed: true });
    expect(manualMeasurementsToCsv('pendulum', repository.read().records)).toContain('"5"');
    storage.failWrites = false;
    expect(repository.save(timing(), pendulumParameters(), 11.25).failed).toBe(false);
    expect(createManualMeasurementRepository('pendulum', storage).read().records).toHaveLength(2);
  });

  it('recovers the original 120th manual reading through retry even when a new save is blocked', () => {
    const storage = memoryStorage();
    const repository = getScopedManualMeasurementRepository('pendulum', 'owner', storage);
    for (let index = 0; index < 119; index++) repository.save(timing(), pendulumParameters(), 11.25);
    const savedIds = new Set(repository.read().records.map((entry) => entry.id));
    storage.failWrites = true;
    const failed = repository.save(timing(), pendulumParameters(), 11.25);
    const original = failed.records.find((entry) => !savedIds.has(entry.id))!;
    expect(failed).toMatchObject({ saved: true, failed: true });
    expect(failed.records).toHaveLength(120);
    storage.failWrites = false;
    expect(repository.save(timing(), pendulumParameters(), 11.25)).toMatchObject({ saved: false, failed: true });
    const recovered = repository.retryPending();
    expect(recovered).toMatchObject({ failed: false, excludedCount: 0 });
    expect(recovered.records).toHaveLength(120);
    expect(recovered.records.find((entry) => entry.id === original.id)).toEqual(original);
    const fresh = getScopedManualMeasurementRepository('pendulum', 'owner', memoryStorage(storage.entries));
    expect(fresh.read().records).toEqual(recovered.records);
    expect(repository.retryPending()).toEqual(recovered);
    expect([...storage.entries.keys()].filter((key) => key.includes(':record:'))).toHaveLength(120);
  });

  it('keeps manual readings exportable through retry failures and respects a later cross-tab clear', () => {
    const storage = memoryStorage();
    const a = getScopedManualMeasurementRepository('pendulum', 'owner', storage);
    storage.failWrites = true; a.save(timing(), pendulumParameters(), 11.25);
    const original = a.read().records;
    expect(a.retryPending()).toEqual({ records: original, failed: true, excludedCount: 0 });
    storage.failWrites = false; storage.failReads = true;
    expect(a.retryPending()).toEqual({ records: original, failed: true, excludedCount: 0 });
    expect(manualMeasurementsToCsv('pendulum', original)).toContain('"11.25"');
    storage.failReads = false;
    const b = getScopedManualMeasurementRepository('pendulum', 'owner', memoryStorage(storage.entries));
    expect(b.clear().cleared).toBe(true);
    expect(a.retryPending()).toEqual({ records: [], failed: false, excludedCount: 0 });
    expect(b.read().records).toEqual([]);
    expect([...storage.entries.keys()].filter((key) => key.includes(':record:'))).toEqual([]);
  });

  it('excludes corrupt readings without deleting the recovery copy', () => {
    const storage = memoryStorage();
    const repository = createManualMeasurementRepository('pendulum', storage);
    repository.save(timing(), pendulumParameters(), 11.25);
    const key = [...storage.entries.keys()].find((key) => key.includes(':record:'))!;
    const record = JSON.parse(storage.getItem(key)!);
    record.manual.readings.periodCount = 0;
    const corrupt = JSON.stringify(record);
    storage.setItem(key, corrupt);
    expect(repository.read()).toMatchObject({ records: [], excludedCount: 1 });
    expect(storage.getItem(key)).toBe(corrupt);
  });

  it('rejects a result from another instrument or changed experimental conditions', () => {
    const repository = createManualMeasurementRepository('pendulum', memoryStorage());
    const slit = calculateDoubleSlitPositionMeasurement({ leftPositionMm: -2.2, rightPositionMm: 2.2, intervalCount: 4, slitSeparationMm: .5, screenDistance: 1 });
    expect(() => repository.save(slit, pendulumParameters(), 0)).toThrow(/不匹配/);
    expect(() => repository.save(timing(), { ...pendulumParameters(), length: 2 }, 11.25)).toThrow(/不匹配/);
    expect(() => repository.save(timing(), pendulumParameters(), 12)).toThrow(/不匹配/);
    expect(repository.read().records).toHaveLength(0);
  });

  it('exports the union of derived values when an earlier large-angle trial has no g', () => {
    const repository = createManualMeasurementRepository('pendulum', memoryStorage());
    repository.save(timing(30), pendulumParameters(30), 11.25);
    repository.save(timing(5), pendulumParameters(5), 11.25);
    const records = repository.read().records.sort((a, b) => b.parameters.amplitudeDegrees! - a.parameters.amplitudeDegrees!);
    const rows = manualMeasurementsToCsv('pendulum', records).split('\r\n');
    expect(rows[0]).toContain('小角近似估计的 g');
    expect(rows[1]).toContain('虚拟仪器手动读数（非真实器材测量）');
    expect(rows[1]).toContain('"","完整周期');
    expect(rows[2]).toContain(String(timing(5).metrics.find((metric) => metric.key === 'gravity')!.value));
    expect(rows[0]).toContain('读数：完整周期数');
  });

  it('preserves signed screen coordinates and clearly labels their provenance in CSV', () => {
    const repository = createManualMeasurementRepository('double-slit', memoryStorage());
    const parameters = { ...defaultHighSchoolParameters('double-slit'), slitSeparationMm: .5, screenDistance: 1 };
    const result = calculateDoubleSlitPositionMeasurement({ leftPositionMm: -2.2, rightPositionMm: 2.2, intervalCount: 4, slitSeparationMm: .5, screenDistance: 1 });
    repository.save(result, parameters, 0);
    const csv = manualMeasurementsToCsv('double-slit', repository.read().records);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"-2.2"');
    expect(csv).not.toContain("'-2.2");
    expect(csv).toContain('读数：亮纹间隔数');
    expect(csv).toContain('"550"');
  });
});

describe('scoped manual archive ownership', () => {
  it('separates manual, automatic, guest, demo and account archives while preserving all raw values', () => {
    const storage = memoryStorage();
    const scopes = ['guest', 'demo', 'backend-a:school-a:student-1', 'backend-a:school-b:student-1', 'backend-b:school-a:student-1'];
    for (const scope of scopes) {
      const repository = getScopedManualMeasurementRepository('pendulum', scope, storage);
      expect(repository.read().records).toHaveLength(0);
      repository.save(timing(), pendulumParameters(), 11.25);
    }
    const automatic = getScopedMeasurementStore('pendulum', scopes[2]!, storage);
    expect(automatic.read().records).toHaveLength(0);
    automatic.append({ id: 'automatic', createdAt: '2026-11-11T00:00:00.000Z', timeSeconds: 1, parameters: pendulumParameters(), metrics: [] });
    const account = getScopedManualMeasurementRepository('pendulum', scopes[2]!, storage);
    expect(account.read().records[0]?.manual.readings).toEqual(timing().readings);
    expect(account.clear().cleared).toBe(true);
    expect(automatic.read().records).toHaveLength(1);
    for (const scope of scopes.filter((scope) => scope !== scopes[2])) expect(getScopedManualMeasurementRepository('pendulum', scope, storage).read().records).toHaveLength(1);
  });

  it('restores only the original owner’s failed in-memory manual record after switching away and back', () => {
    const storage = memoryStorage();
    storage.failWrites = true;
    const a = getScopedManualMeasurementRepository('pendulum', 'a', storage);
    a.save(timing(), pendulumParameters(), 11.25);
    const b = getScopedManualMeasurementRepository('pendulum', 'b', storage);
    expect(b.read().records).toEqual([]);
    b.save(timing(30), pendulumParameters(30), 11.25);
    const returning = getScopedManualMeasurementRepository('pendulum', 'a', storage);
    expect(returning.read()).toMatchObject({ failed: true, records: [{ parameters: { amplitudeDegrees: 5 } }] });
    storage.failWrites = false;
    returning.save(timing(), pendulumParameters(), 11.25);
    expect(returning.read()).toMatchObject({ failed: false });
    expect(returning.read().records).toHaveLength(2);
    expect(b.read()).toMatchObject({ failed: true, records: [{ parameters: { amplitudeDegrees: 30 } }] });
    expect(manualMeasurementsToCsv('pendulum', b.read().records)).toContain('"30"');
  });

  it('keeps legacy manual records read-only and does not assign them to a new account', () => {
    const storage = memoryStorage();
    const old = createManualMeasurementRepository('pendulum', storage);
    old.save(timing(), pendulumParameters(), 11.25);
    const key = [...storage.entries.keys()].find((key) => key.includes(':record:'))!;
    const value = JSON.parse(storage.getItem(key)!);
    value.id = 'corrupt'; value.manual.readings.periodCount = 0;
    storage.setItem(`${key}-corrupt`, JSON.stringify(value));
    const original = [...storage.entries];
    storage.failWrites = true;
    const legacy = readLegacyManualMeasurements('pendulum', storage);
    expect(legacy.records).toHaveLength(1);
    expect(legacy.excludedCount).toBe(1);
    expect([...storage.entries]).toEqual(original);
    expect(getScopedManualMeasurementRepository('pendulum', 'account-a', storage).read().records).toEqual([]);
    storage.failWrites = false;
    getScopedManualMeasurementRepository('pendulum', 'account-a', storage).clear();
    for (const [entryKey, entryValue] of original) expect(storage.getItem(entryKey)).toBe(entryValue);
  });

  it('rejects stale save and clear callbacks after owner change or expiry without moving the archive', () => {
    const storage = memoryStorage();
    let active = 'owner-a';
    let writable = true;
    const a = getScopedManualMeasurementRepository('pendulum', 'owner-a', storage);
    const writes = guardManualMeasurementWrites(a, 'owner-a', () => active === 'owner-a' && writable);
    expect(writes.save(timing(), pendulumParameters(), 11.25).saved).toBe(true);
    const before = [...storage.entries];
    active = 'owner-b';
    expect(writes.save(timing(), pendulumParameters(), 11.25)).toMatchObject({ saved: false, error: expect.stringContaining('身份已变化') });
    expect(writes.clear()).toMatchObject({ cleared: false, error: expect.stringContaining('未执行') });
    expect([...storage.entries]).toEqual(before);
    expect(getScopedManualMeasurementRepository('pendulum', 'owner-b', storage).read().records).toEqual([]);
    active = 'owner-a'; writable = false;
    expect(writes.clear().cleared).toBe(false);
    expect(a.read().records).toHaveLength(1);
    writable = true;
    expect(writes.clear().cleared).toBe(true);
  });

  it('fails closed when no owner exists or the live permission check itself is unavailable', () => {
    const storage = memoryStorage();
    const empty = getScopedManualMeasurementRepository('pendulum', null, storage);
    const blocked = guardManualMeasurementWrites(empty, null, () => true);
    expect(blocked.save(timing(), pendulumParameters(), 11.25).saved).toBe(false);
    expect(blocked.clear().cleared).toBe(false);
    expect(blocked.retryPending()).toMatchObject({ records: [], error: expect.stringContaining('未执行') });
    expect(empty.retryPending()).toEqual({ records: [], failed: true, excludedCount: 0 });
    expect(empty.read().records).toEqual([]);
    const unavailable = guardManualMeasurementWrites(getScopedManualMeasurementRepository('pendulum', 'a', storage), 'a', () => { throw new Error('expired'); });
    expect(unavailable.save(timing(), pendulumParameters(), 11.25).saved).toBe(false);
    expect(unavailable.clear().cleared).toBe(false);
    expect(unavailable.retryPending()).toMatchObject({ error: expect.stringContaining('未执行') });
    expect(storage.entries.size).toBe(0);
  });

  it('rechecks live owner and write permission before retrying the original manual archive', () => {
    const storage = memoryStorage();
    const repository = getScopedManualMeasurementRepository('pendulum', 'a', storage);
    let activeOwner = 'a'; let writable = true;
    const writes = guardManualMeasurementWrites(repository, 'a', () => activeOwner === 'a' && writable);
    storage.failWrites = true; writes.save(timing(), pendulumParameters(), 11.25); storage.failWrites = false;
    const original = repository.read().records;
    activeOwner = 'b';
    expect(writes.retryPending()).toMatchObject({ records: original, failed: true, error: expect.stringContaining('身份已变化') });
    expect(storage.entries.size).toBe(0);
    activeOwner = 'a'; writable = false;
    expect(writes.retryPending()).toMatchObject({ records: original, failed: true, error: expect.stringContaining('未执行') });
    expect(storage.entries.size).toBe(0);
    writable = true;
    expect(writes.retryPending()).toEqual({ records: original, failed: false, excludedCount: 0 });
    expect(getScopedManualMeasurementRepository('pendulum', 'b', storage).read().records).toEqual([]);
    expect(getScopedManualMeasurementRepository('pendulum', 'a', memoryStorage(storage.entries)).read().records).toEqual(original);
  });

  it('permits read-only owner export while blocking stale callbacks before download data is created', () => {
    const storage = memoryStorage();
    const a = getScopedManualMeasurementRepository('pendulum', 'a', storage);
    a.save(timing(), pendulumParameters(), 11.25);
    const capturedRecords = a.read().records;
    let activeOwner = 'a';
    let generated = '';
    let downloads = 0;
    const exportCaptured = () => { generated = manualMeasurementsToCsv('pendulum', capturedRecords); downloads += 1; };
    const canRead = () => activeOwner === 'a';
    // Expiry disables writes but retains read/export access for the same selected identity.
    expect(guardManualMeasurementWrites(a, 'a', () => false).save(timing(), pendulumParameters(), 11.25).saved).toBe(false);
    expect(exportManualMeasurementsWhenCurrent('a', canRead, exportCaptured).exported).toBe(true);
    expect(downloads).toBe(1);
    expect(generated).toContain('"11.25"');
    activeOwner = 'b'; generated = '';
    expect(exportManualMeasurementsWhenCurrent('a', canRead, exportCaptured)).toMatchObject({ exported: false, error: expect.stringContaining('未导出旧档案') });
    expect(downloads).toBe(1);
    expect(generated).toBe('');
    expect(exportManualMeasurementsWhenCurrent(null, () => true, exportCaptured).exported).toBe(false);
    expect(exportManualMeasurementsWhenCurrent('a', () => { throw new Error('blocked'); }, exportCaptured).exported).toBe(false);
    expect(downloads).toBe(1);
  });
});
