import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { getUnsavedLearningRecords, subscribeUnsavedLearningRecords, type UnsavedLearningRecord } from '../../../data/unsavedLearningRecord';
import { isCurrentStudentRecordScope, type StudentRecordScope } from '../../../data/studentRecordScope';
import { downloadRecordCopy } from './recordCopyDownload';
import './LearningRecordCopies.css';

const fields = { prediction: '预测', measurements: '测量与观察', conclusion: '结论与依据', question: '问题' } as const;
export function UnsavedLearningRecordPanel({ scope, sessionId, onRestore, getRestoreToken, restoreDisabled = false }: { scope: StudentRecordScope; sessionId: string; onRestore?: (copy: UnsavedLearningRecord, targetToken: string) => boolean; getRestoreToken?: () => string; restoreDisabled?: boolean }) {
  const identity = JSON.stringify([scope.key, scope.revision, sessionId]);
  const source = useSyncExternalStore(subscribeUnsavedLearningRecords, () => getUnsavedLearningRecords(scope, sessionId), () => getUnsavedLearningRecords(scope, sessionId));
  const [preview, setPreview] = useState<{ identity: string; source: readonly UnsavedLearningRecord[]; targetToken: string | null } | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canRead = () => mounted.current && currentIdentity.current === identity && isCurrentStudentRecordScope(scope);
  const visible = preview?.identity === identity && preview.source === source ? preview.source : null;
  if (!source.length) return null;
  function open() {
    if (!canRead()) return;
    const current = getUnsavedLearningRecords(scope, sessionId);
    let targetToken: string | null = null;
    try { targetToken = getRestoreToken?.() ?? null; } catch { /* Read/export remain available when restoring is not. */ }
    setPreview({ identity, source: current, targetToken }); setMessage('');
  }
  function restore(copy: UnsavedLearningRecord) {
    if (!canRead() || !scope.canWrite || restoreDisabled || !onRestore || !visible || !preview?.targetToken || getUnsavedLearningRecords(scope, sessionId) !== visible) return;
    const restored = onRestore(copy, preview.targetToken);
    if (!restored) setMessage('未能恢复为草稿，内存原文仍保留。请查看上方提示或先导出备份。');
  }
  function exportCopy() {
    if (!visible) return;
    const current = () => canRead() && getUnsavedLearningRecords(scope, sessionId) === visible;
    try {
      if (!current()) throw new Error('身份或未落盘副本已变化，请重新查看后导出。');
      const json = JSON.stringify({ format: 'physics-unsaved-classroom-memory-v1', source: 'current-tab-memory-only',
        apiNamespace: scope.apiNamespace, schoolId: scope.schoolId, studentId: scope.studentId, sessionId,
        boundary: '未成功写入本机存储的课堂正文副本；不是账号已保存报告。仅当前标签页内存保留，关闭或刷新可能丢失。未自动合并或上传。',
        exportedAt: new Date().toISOString(), records: visible }, null, 2);
      downloadRecordCopy(json, `未落盘课堂正文-${encodeURIComponent(sessionId)}.json`, current);
      setMessage('已发起导出，请检查浏览器下载。内存副本仍保留，没有写入或上传报告。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能导出，请保留当前标签页。'); }
  }
  return <section className="record-copy-panel" aria-label="本标签页未落盘正文">
    <h2>有 {source.length} 份正文尚未写入本机存储</h2>
    <p>保存失败时的文字仅保留在当前标签页内存中。登录到期、续期或返回这份档案后仍可核对；关闭或刷新标签页可能丢失。请先导出备份。这些文字不会自动替换当前报告，也不会自动上传。</p>
    <p>继续归档前，请展开并核对副本，再恢复为草稿。成功写入本机后对应内存副本才会移除；原版本有变化时需继续核对冲突。只导出不会清除副本。</p>
    <button type="button" onClick={open}>{visible ? '重新查看未落盘正文' : '查看未落盘正文'}</button>
    {visible && <>
      {visible.map((copy, index) => <details key={copy.id} className="record-copy-entry"><summary>正文副本 {index + 1} · 原账号版本 {copy.baseRevision}</summary>
        <p>首次保留：{new Date(copy.createdAt).toLocaleString('zh-CN')}；最近编辑：{new Date(copy.updatedAt).toLocaleString('zh-CN')}</p>
        <dl>{(Object.keys(fields) as Array<keyof typeof fields>).map((field) => <div key={field}><dt>{fields[field]}</dt><dd><pre>{copy.content[field] || '未填写'}</pre></dd></div>)}</dl>
        {onRestore && <><p>恢复会替换上方当前待同步草稿的四项正文。账号中的较新版本仍受版本核对保护；请先按需导出当前草稿。</p><button type="button" disabled={!scope.canWrite || restoreDisabled || !preview?.targetToken} onClick={() => restore(copy)}>恢复这份文字为草稿</button></>}
      </details>)}
      <button type="button" onClick={exportCopy}><Download size={14} />导出未落盘正文</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
