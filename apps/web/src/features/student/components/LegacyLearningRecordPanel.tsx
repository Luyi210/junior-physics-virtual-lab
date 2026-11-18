import { useEffect, useRef, useState } from 'react';
import { Archive, Download, RefreshCw } from 'lucide-react';
import { createLegacyLearningRecordsBackup, readLegacyLearningRecords, type LegacyLearningRecordSnapshot } from '../../../data/legacyLearningRecords';
import { isCurrentStudentRecordScope, type StudentRecordScope } from '../../../data/studentRecordScope';
import { downloadRecordCopy } from './recordCopyDownload';
import './LearningRecordCopies.css';

const fields = { prediction: '预测', measurements: '测量与观察', conclusion: '结论与依据', question: '问题' } as const;

export function LegacyLearningRecordPanel({ scope, sessionId }: { scope: StudentRecordScope; sessionId: string }) {
  const identity = JSON.stringify([scope.key, scope.revision, sessionId]);
  const [preview, setPreview] = useState<{ identity: string; snapshot: LegacyLearningRecordSnapshot } | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canRead = () => mounted.current && currentIdentity.current === identity && scope.mode === 'account' && Boolean(scope.studentId) && isCurrentStudentRecordScope(scope);
  const access = { learnerId: scope.studentId ?? '', sessionId, isCurrent: canRead };
  const snapshot = preview?.identity === identity ? preview.snapshot : null;
  if (scope.mode !== 'account' || !scope.studentId) return null;
  function open() {
    setMessage('');
    try { const result = readLegacyLearningRecords(access); setPreview({ identity, snapshot: result }); }
    catch (error) { setMessage(error instanceof Error ? error.message : '暂时无法读取旧副本。'); }
  }
  function exportCopy() {
    if (!snapshot) return;
    try {
      const json = createLegacyLearningRecordsBackup(snapshot, access);
      downloadRecordCopy(json, `旧课堂记录-${encodeURIComponent(sessionId)}.json`, canRead);
      setMessage('已发起导出，请检查浏览器下载。没有迁移或清除旧副本。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能导出，请保留当前页面后重试。'); }
  }
  return <section className="record-copy-panel is-legacy" aria-label="升级前的课堂记录副本">
    <div className="record-copy-title"><Archive size={18} aria-hidden="true" /><h2>升级前的本机副本</h2></div>
    <p>旧版本没有记下后台地址，不能确认这些副本属于当前学校与后台。可单独查看和导出；不会自动加入当前报告。</p>
    <button type="button" onClick={open}><RefreshCw size={14} />{snapshot ? '重新读取旧副本' : '查看此会话的旧副本'}</button>
    {snapshot && <>
      <p className="record-copy-note">读取于 {new Date(snapshot.capturedAt).toLocaleString('zh-CN')}，发现 {snapshot.entries.length} 个条目，包含旧账号记录及各页面草稿。它们不是当前账号的已保存报告。</p>
      {snapshot.failed && <p role="alert">部分旧内容损坏或未能读取。导出只包含本次读到的原文，无法读取的内容仍需保留在原浏览器中。</p>}
      {snapshot.entries.map((entry, index) => <details key={entry.key} className="record-copy-entry"><summary>{entry.kind === 'server' ? '旧账号记录的本机副本' : `旧页面草稿 ${index + 1}`}{entry.status === 'empty' ? ' · 空白' : entry.status !== 'valid' ? ' · 需核对' : ''}</summary>
        {entry.tabId && <small>原页面编号：{entry.tabId}</small>}
        {entry.content && <dl>{(Object.keys(fields) as Array<keyof typeof fields>).map((field) => <div key={field}><dt>{fields[field]}</dt><dd><pre>{entry.content![field] || '未填写'}</pre></dd></div>)}</dl>}
        {entry.issues.map((issue) => <p key={issue}>{issue}</p>)}
        <details><summary>原始备份内容</summary><pre>{entry.rawPayload ?? '原文未能读取'}</pre></details>
      </details>)}
      {!snapshot.entries.length && <p>{snapshot.partial ? '本次未能确认完整旧副本列表，请稍后重试。' : '此学生编号和会话下没有发现旧副本。'}</p>}
      {snapshot.issues.length > 0 && <details><summary>查看读取提示</summary><ul>{snapshot.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></details>}
      <button type="button" disabled={!snapshot.entries.length} onClick={exportCopy}><Download size={14} />导出本次读到的旧副本</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
