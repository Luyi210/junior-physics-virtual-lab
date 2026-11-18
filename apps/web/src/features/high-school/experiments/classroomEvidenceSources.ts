import type { MeasurementSnapshot } from './measurementStorage';
import type { ManualMeasurementSnapshot } from './manualMeasurementRepository';

/** This bridge accepts only scoped normal stores. It never reads or migrates old public archives. */
export function readClassroomEvidenceSources(automaticStore: { read(): MeasurementSnapshot }, manualStore?: { read(): ManualMeasurementSnapshot }) {
  const automatic = automaticStore.read();
  const manual = manualStore?.read();
  return {
    automatic: automatic.records,
    manual: manual?.records ?? [],
    recoveryCount: (automatic.recovery?.records.length ?? 0) + (manual?.rawRecoveryRecords?.length ?? 0),
    excludedManualCount: manual?.excludedCount ?? 0,
    failed: automatic.failed || Boolean(manual?.failed) || Boolean(manual?.excludedCount),
  };
}
export type ClassroomEvidenceSources = ReturnType<typeof readClassroomEvidenceSources>;

export function assertClassroomEvidenceSourcesReadable(sources: ClassroomEvidenceSources) {
  if (sources.failed || sources.recoveryCount || sources.excludedManualCount) {
    throw new Error('本机档案还有读取、保存或待恢复问题，请先返回实验工作台核对与导出。当前文字和读数均保留，未追加可能过时的副本。');
  }
}
