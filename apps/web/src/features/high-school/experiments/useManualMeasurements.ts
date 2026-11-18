import { useEffect, useMemo, useRef, useState } from 'react';
import { highSchoolExperiment, type ManualMeasurementResult } from '@physics-lab/physics/high-school';
import { exportManualMeasurementsWhenCurrent, getScopedManualMeasurementRepository, guardManualMeasurementWrites, manualMeasurementsToCsv, manualRecoveryMeasurementsToCsv, manualRecoveryBackup, type ManualExperimentId } from './manualMeasurementRepository';
export type { ManualMeasurementRecord, ManualExperimentId } from './manualMeasurementRepository';

export function useManualMeasurements(experimentId: ManualExperimentId, scopeKey: string | null, canWrite: () => boolean, canRead: () => boolean) {
  const repository = useMemo(() => getScopedManualMeasurementRepository(experimentId, scopeKey), [experimentId, scopeKey]);
  const initialSnapshot = useMemo(() => repository.read(), [repository]);
  const [state, setState] = useState(() => ({ repository, snapshot: initialSnapshot, actionError: '' }));
  // A newly selected owner never renders even one frame of the previous owner's archive.
  const snapshot = state.repository === repository ? state.snapshot : initialSnapshot;
  const actionError = state.repository === repository ? state.actionError : '';
  const active = useRef({ repository, scopeKey, canWrite, canRead });
  const mounted = useRef(true);
  active.current = { repository, scopeKey, canWrite, canRead };
  const writes = guardManualMeasurementWrites(repository, scopeKey, () => mounted.current && active.current.repository === repository && active.current.scopeKey === scopeKey && canWrite() && active.current.canWrite());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setState({ repository, snapshot: repository.read(), actionError: '' });
    const refresh = (event: StorageEvent) => {
      if (active.current.repository === repository && repository.matchesKey(event.key)) setState({ repository, snapshot: repository.read(), actionError: '' });
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [repository]);
  function save(result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number) {
    const next = writes.save(result, parameters, timeSeconds);
    if (mounted.current && active.current.repository === repository) setState({ repository, snapshot: next, actionError: next.error ?? '' });
    return { saved: next.saved, failed: next.failed, pendingRecovery: next.pendingRecovery, error: next.error };
  }
  function clear() {
    const next = writes.clear();
    if (mounted.current && active.current.repository === repository) setState({ repository, snapshot: next, actionError: next.error ?? '' });
    return next.cleared;
  }
  function retryPending() {
    const next = writes.retryPending();
    if (mounted.current && active.current.repository === repository) setState({ repository, snapshot: next, actionError: next.error ?? '' });
    return { failed: next.failed, error: next.error };
  }
  function recoverPending(reviewToken: string | null) {
    const next = writes.recoverPending(reviewToken);
    if (mounted.current && active.current.repository === repository) setState({ repository, snapshot: next, actionError: next.error ?? '' });
    return { recoveredCount: next.recoveredCount, failed: next.failed, error: next.error };
  }
  function exportArchive(kind: 'current' | 'recovery' | 'backup') {
    let outcome: { exported: boolean; error?: string };
    try {
      outcome = exportManualMeasurementsWhenCurrent(scopeKey, () => mounted.current && active.current.repository === repository && active.current.scopeKey === scopeKey && canRead() && active.current.canRead(), () => {
        const content = kind === 'backup' ? manualRecoveryBackup(experimentId, snapshot.rawRecoveryRecords ?? [])
          : kind === 'recovery' ? manualRecoveryMeasurementsToCsv(experimentId, snapshot.recovery?.records ?? []) : manualMeasurementsToCsv(experimentId, snapshot.records);
        const url = URL.createObjectURL(new Blob([content], { type: kind === 'backup' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url; link.download = `${highSchoolExperiment(experimentId).title}-${kind === 'current' ? '手动读数.csv' : kind === 'recovery' ? '待恢复手动读数.csv' : '待恢复手动读数原始备份.json'}`; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    } catch { outcome = { exported: false, error: '暂时无法导出手动记录，请保留当前页面并重试。' }; }
    if (mounted.current && active.current.repository === repository) setState((previous) => ({ ...previous, actionError: outcome.error ?? '' }));
    return outcome.exported;
  }
  return { records: snapshot.records, recovery: snapshot.recovery, storageError: snapshot.failed, excludedCount: snapshot.excludedCount, actionError, save, clear, retryPending, recoverPending,
    exportCsv: () => exportArchive('current'), exportRecoveryCsv: () => exportArchive('recovery'), exportRecoveryBackup: () => exportArchive('backup') };
}
