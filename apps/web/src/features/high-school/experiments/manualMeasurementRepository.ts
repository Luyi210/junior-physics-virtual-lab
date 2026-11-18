import { calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement, highSchoolExperiment, MECHANICAL_ENERGY_TAPE_READING_KEYS, PENDULUM_OBSERVATION_SECONDS, quantizeManualTimeSeconds, validatedHighSchoolParameters, type ManualMeasurementResult } from '@physics-lab/physics/high-school';
import { createMeasurementStore, getScopedMeasurementStore, readLegacyMeasurements, type MeasurementSnapshot, type MeasurementStore, type MeasurementStorageAccess } from './measurementStorage';
import { csvCell, type HighSchoolMeasurement } from './workbench';
import { checkedMechanicalEnergyTape, mechanicalEnergyReadingLabels } from './mechanicalEnergyEvidence';

export type ManualExperimentId = 'pendulum' | 'double-slit' | 'mechanical-energy';
export interface ManualMeasurementRecord extends HighSchoolMeasurement { manual: Omit<ManualMeasurementResult, 'metrics'> }
export interface ManualMeasurementSnapshot {
  records: ManualMeasurementRecord[]; failed: boolean; excludedCount: number;
  recovery?: { records: ManualMeasurementRecord[]; reviewToken: string | null; excludedCount: number };
  rawRecoveryRecords?: HighSchoolMeasurement[];
}
export interface ManualMeasurementSave extends ManualMeasurementSnapshot { saved: boolean; pendingRecovery?: boolean; error?: string }
export interface ManualMeasurementClear extends ManualMeasurementSnapshot { cleared: boolean; error?: string }
export interface ManualMeasurementRetry extends ManualMeasurementSnapshot { error?: string }
export interface ManualMeasurementRecoveryResult extends ManualMeasurementSnapshot { recoveredCount: number; error?: string }
const expectedKind = { pendulum: 'pendulum-timing', 'double-slit': 'double-slit-positions', 'mechanical-energy': 'mechanical-energy-tape' } as const;
const readingKeys = { pendulum: ['startTimeSeconds', 'endTimeSeconds', 'periodCount', 'length', 'amplitudeDegrees'], 'double-slit': ['leftPositionMm', 'rightPositionMm', 'intervalCount', 'slitSeparationMm', 'screenDistance'], 'mechanical-energy': MECHANICAL_ENERGY_TAPE_READING_KEYS } as const;
const readingLabels: Record<string, { label: string; unit: string }> = {
  ...mechanicalEnergyReadingLabels,
  startTimeSeconds: { label: '起始秒表读数', unit: 's' }, endTimeSeconds: { label: '结束秒表读数', unit: 's' }, periodCount: { label: '完整周期数', unit: '次' },
  length: { label: '摆长', unit: 'm' }, amplitudeDegrees: { label: '释放摆角', unit: '°' },
  leftPositionMm: { label: '左侧屏坐标', unit: 'mm' }, rightPositionMm: { label: '右侧屏坐标', unit: 'mm' }, intervalCount: { label: '亮纹间隔数', unit: '个' },
  slitSeparationMm: { label: '双缝间距', unit: 'mm' }, screenDistance: { label: '双缝到屏距离', unit: 'm' }
};
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

function validManual(record: HighSchoolMeasurement, experimentId: ManualExperimentId): record is ManualMeasurementRecord {
  const manual = (record as Partial<ManualMeasurementRecord>).manual;
  if (!manual || manual.kind !== expectedKind[experimentId] || manual.provenance !== 'virtual-manual' || !object(manual.readings)) return false;
  if (!readingKeys[experimentId].every((key) => Number.isFinite(manual.readings[key]))) return false;
  if (!strings(manual.assumptions) || !strings(manual.warnings) || !object(manual.resolution) || !Number.isFinite(manual.resolution.value) || manual.resolution.value <= 0) return false;
  if (manual.resolution.unit !== (experimentId === 'pendulum' ? 's' : 'mm')) return false;
  try {
    if (highSchoolExperiment(experimentId).parameters.some((parameter) => !Object.hasOwn(record.parameters, parameter.key))) return false;
    validatedHighSchoolParameters(experimentId, record.parameters);
    const r = manual.readings;
    if (experimentId === 'pendulum') {
      if (record.timeSeconds < 0 || record.timeSeconds > PENDULUM_OBSERVATION_SECONDS || r.endTimeSeconds! > PENDULUM_OBSERVATION_SECONDS || quantizeManualTimeSeconds(record.timeSeconds) !== r.endTimeSeconds) return false;
    } else if (experimentId === 'double-slit' && record.timeSeconds !== 0) return false;
    const expected = experimentId === 'pendulum'
      ? calculatePendulumTimingMeasurement({ startTimeSeconds: r.startTimeSeconds!, endTimeSeconds: r.endTimeSeconds!, periodCount: r.periodCount!, length: r.length!, amplitudeDegrees: r.amplitudeDegrees! })
      : experimentId === 'mechanical-energy' ? checkedMechanicalEnergyTape(record.parameters, r, record.timeSeconds)
        : calculateDoubleSlitPositionMeasurement({ leftPositionMm: r.leftPositionMm!, rightPositionMm: r.rightPositionMm!, intervalCount: r.intervalCount!, slitSeparationMm: r.slitSeparationMm!, screenDistance: r.screenDistance! });
    const settings = experimentId === 'pendulum' ? ['length', 'amplitudeDegrees'] : experimentId === 'mechanical-energy' ? ['mass', 'dropHeight', 'resistanceRatio'] : ['slitSeparationMm', 'screenDistance'];
    if (!settings.every((key) => r[key] === record.parameters[key])) return false;
    if (experimentId === 'mechanical-energy' && Object.keys(r).length !== readingKeys[experimentId].length) return false;
    if (!readingKeys[experimentId].every((key) => r[key] === expected.readings[key])) return false;
    if (manual.resolution.value !== expected.resolution.value || record.metrics.length !== expected.metrics.length) return false;
    // Validate persisted calculations without silently replacing a student's saved readout.
    return expected.metrics.every((metric) => {
      const matches = record.metrics.filter((entry) => entry.key === metric.key);
      return matches.length === 1 && matches[0]!.unit === metric.unit
        && Math.abs(matches[0]!.value - metric.value) <= 1e-10 * Math.max(1, Math.abs(metric.value));
    });
  } catch { return false; }
}

function manualSnapshot(experimentId: ManualExperimentId, snapshot: MeasurementSnapshot): ManualMeasurementSnapshot {
  const records = snapshot.records.filter((record): record is ManualMeasurementRecord => validManual(record, experimentId));
  const recoveryRecords = snapshot.recovery?.records.filter((record): record is ManualMeasurementRecord => validManual(record, experimentId));
  return { records, failed: snapshot.failed, excludedCount: snapshot.records.length - records.length,
    ...(snapshot.recovery && recoveryRecords ? {
      recovery: { records: recoveryRecords, reviewToken: snapshot.recovery.reviewToken, excludedCount: snapshot.recovery.records.length - recoveryRecords.length },
      rawRecoveryRecords: snapshot.recovery.records,
    } : {}) };
}

function manualRepository(experimentId: ManualExperimentId, store: MeasurementStore) {
  function read(): ManualMeasurementSnapshot { return manualSnapshot(experimentId, store.read()); }
  function save(result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number): ManualMeasurementSave {
    const current = read();
    if (current.records.length + (current.rawRecoveryRecords?.length ?? 0) >= 120) return { ...current, saved: false };
    const { metrics, ...manual } = result;
    const record: ManualMeasurementRecord = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), timeSeconds, parameters: { ...parameters }, metrics: metrics.map((metric) => ({ ...metric })), manual: { ...manual, readings: { ...manual.readings }, assumptions: [...manual.assumptions], warnings: [...manual.warnings], resolution: { ...manual.resolution } } };
    if (!validManual(record, experimentId)) throw new RangeError('手动读数与当前实验不匹配，未保存。');
    store.append(record);
    const next = read();
    return { ...next, saved: true, ...(next.recovery?.records.some((entry) => entry.id === record.id) ? { pendingRecovery: true } : {}) };
  }
  function clear(): ManualMeasurementClear { const result = store.clear(); return { ...read(), cleared: result.cleared }; }
  function retryPending(): ManualMeasurementSnapshot { return manualSnapshot(experimentId, store.retryPending()); }
  function recoverPending(reviewToken: string | null): ManualMeasurementRecoveryResult {
    const current = read();
    if (current.recovery?.excludedCount) return { ...current, recoveredCount: 0, error: '待恢复记录含有无法校验的手动读数，本批次未恢复。请先导出完整原始备份，异常条目仍保留。' };
    const result = store.recoverPending(reviewToken);
    return { ...manualSnapshot(experimentId, result), recoveredCount: result.recoveredCount, ...(result.error ? { error: result.error } : {}) };
  }
  return { read, save, retryPending, recoverPending, clear, matchesKey: store.matchesKey };
}

/** Original archive compatibility only. New UI uses the scoped repository below. */
export function createManualMeasurementRepository(experimentId: ManualExperimentId, storage?: MeasurementStorageAccess) {
  return manualRepository(experimentId, createMeasurementStore(`virtual-manual:${experimentId}`, storage));
}

export function getScopedManualMeasurementRepository(experimentId: ManualExperimentId, scopeKey: string | null, storage?: MeasurementStorageAccess) {
  // The automatic/manual split is nested inside the same opaque owner scope.
  return manualRepository(experimentId, getScopedMeasurementStore(`virtual-manual:${experimentId}`, scopeKey, storage));
}

export function readLegacyManualMeasurements(experimentId: ManualExperimentId, storage?: MeasurementStorageAccess): ManualMeasurementSnapshot {
  return manualSnapshot(experimentId, readLegacyMeasurements(`virtual-manual:${experimentId}`, storage));
}

/** Write permission is checked at the actual action, never inferred from when a button rendered. */
export function guardManualMeasurementWrites(repository: ReturnType<typeof getScopedManualMeasurementRepository>, scopeKey: string | null, canWrite: () => boolean) {
  const error = '档案身份已变化、登录已过期或尚未选择归属，本次操作未执行。请确认当前档案后重试。';
  function allowed() { try { return scopeKey !== null && scopeKey.length > 0 && canWrite(); } catch { return false; } }
  return {
    save(result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number): ManualMeasurementSave {
      if (!allowed()) return { ...repository.read(), saved: false, error };
      return repository.save(result, parameters, timeSeconds);
    },
    clear(): ManualMeasurementClear {
      if (!allowed()) return { ...repository.read(), cleared: false, error };
      return repository.clear();
    },
    retryPending(): ManualMeasurementRetry {
      if (!allowed()) return { ...repository.read(), error };
      return repository.retryPending();
    },
    recoverPending(reviewToken: string | null): ManualMeasurementRecoveryResult {
      if (!allowed()) return { ...repository.read(), recoveredCount: 0, error };
      return repository.recoverPending(reviewToken);
    }
  };
}

/** A read-only/expired owner can export; a callback from a different owner cannot. */
export function exportManualMeasurementsWhenCurrent(scopeKey: string | null, canRead: () => boolean, exportSnapshot: () => void): { exported: boolean; error?: string } {
  let allowed = false;
  try { allowed = scopeKey !== null && scopeKey.length > 0 && canRead(); } catch { /* Fail closed before creating any download data. */ }
  if (!allowed) return { exported: false, error: '档案身份已变化或尚未选择归属，未导出旧档案。请确认当前档案后重试。' };
  exportSnapshot();
  return { exported: true };
}

function manualCsv(experimentId: ManualExperimentId, records: ManualMeasurementRecord[], source: string) {
  const definition = highSchoolExperiment(experimentId);
  const metrics = [...new Map(records.flatMap((record) => record.metrics).map((metric) => [metric.key, metric])).values()];
  const keys = readingKeys[experimentId];
  const header = ['数据来源', '记录时间', '实验时刻 / s', ...definition.parameters.map((parameter) => `条件：${parameter.label} / ${parameter.unit || '无'}`), ...keys.map((key) => `读数：${readingLabels[key]!.label} / ${readingLabels[key]!.unit}`), ...metrics.map((metric) => `结果：${metric.label} / ${metric.unit || '无'}`), '适用条件', '提示'];
  const rows = records.map((record) => [source, record.createdAt, record.timeSeconds, ...definition.parameters.map((parameter) => record.parameters[parameter.key] ?? ''), ...keys.map((key) => record.manual.readings[key] ?? ''), ...metrics.map((metric) => record.metrics.find((entry) => entry.key === metric.key)?.value ?? ''), record.manual.assumptions.join('；'), record.manual.warnings.join('；')]);
  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function manualMeasurementsToCsv(experimentId: ManualExperimentId, records: ManualMeasurementRecord[]) {
  return manualCsv(experimentId, records, '虚拟仪器手动读数（非真实器材测量）');
}

export function manualRecoveryMeasurementsToCsv(experimentId: ManualExperimentId, records: ManualMeasurementRecord[]) {
  return manualCsv(experimentId, records, '待恢复的虚拟仪器手动读数（未加入当前档案，非真实器材测量）');
}

export function manualRecoveryBackup(experimentId: ManualExperimentId, records: HighSchoolMeasurement[]) {
  return JSON.stringify({ experimentId, source: 'virtual-manual-pending-recovery', records }, null, 2);
}
