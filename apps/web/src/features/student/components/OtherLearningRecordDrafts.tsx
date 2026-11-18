import { useEffect, useRef, useState } from 'react';
import { Download, Files, RefreshCw } from 'lucide-react';
import { learningRecordRepository, type LearningRecordDraft } from '../../../data/learningRecordRepository';
import { isCurrentStudentRecordScope, type StudentRecordScope } from '../../../data/studentRecordScope';
import { downloadRecordCopy } from './recordCopyDownload';
import './LearningRecordCopies.css';

const fields = { prediction: '预测', measurements: '测量与观察', conclusion: '结论与依据', question: '问题' } as const;
export function OtherLearningRecordDrafts({ scope, sessionId, onRestore, getRestoreToken, restoreDisabled = false }: { scope: StudentRecordScope; sessionId: string; onRestore?: (draft: LearningRecordDraft, targetToken: string) => boolean; getRestoreToken?: () => string; restoreDisabled?: boolean }) {
  const identity = JSON.stringify([scope.key, scope.revision, sessionId]);
  const [preview, setPreview] = useState<{ identity: string; capturedAt: string; drafts: LearningRecordDraft[]; targetToken: string | null; serverCopy: { raw: string | null; valid: boolean; error?: string } } | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const canRead = () => mounted.current && currentIdentity.current === identity && scope.mode === 'account' && isCurrentStudentRecordScope(scope);
  const visible = preview?.identity === identity ? preview : null;
  if (scope.mode !== 'account' || !scope.studentId) return null;
  function open() {
    setMessage('');
    try {
      if (!canRead()) throw new Error('学生身份已变化，请从当前课堂记录重新打开。');
      const repository = learningRecordRepository();
      const drafts = repository.listDrafts(scope, sessionId).filter((draft) => !draft.isCurrentTab || !draft.valid);
      const serverCopy = repository.readServerCopy(scope, sessionId);
      if (!canRead()) throw new Error('学生身份已变化，未显示旧档案。');
      let targetToken: string | null = null;
      try { targetToken = getRestoreToken?.() ?? null; } catch { /* The readonly backup is still available. */ }
      setPreview({ identity, capturedAt: new Date().toISOString(), drafts, serverCopy, targetToken });
    } catch (error) { setMessage(error instanceof Error ? error.message : '暂时无法读取其他页面的草稿。'); }
  }
  function restore(draft: LearningRecordDraft) {
    if (!canRead() || !scope.canWrite || restoreDisabled || !draft.valid || !draft.pending || !visible?.targetToken || !onRestore) return;
    try {
      const current = learningRecordRepository().listDrafts(scope, sessionId).find((item) => item.clientId === draft.clientId && item.raw === draft.raw && !item.isCurrentTab && item.valid);
      if (!current || !canRead()) throw new Error('来源草稿已改变，请重新读取并核对后再恢复。');
      if (!onRestore(draft, visible.targetToken)) throw new Error('未能恢复；请查看上方提示，重新预览后再试。来源草稿仍保留。');
      setMessage('已将预览文字恢复为本页草稿。来源副本仍保留，可继续导出；完成实验时如仍有其他页面草稿，需要再次确认。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能恢复为草稿，来源副本仍保留。'); }
  }
  function exportCopy() {
    if (!visible) return;
    try {
      const json = JSON.stringify({ format: 'physics-classroom-other-drafts-v1', apiNamespace: scope.apiNamespace, schoolId: scope.schoolId,
        studentId: scope.studentId, sessionId, capturedAt: visible.capturedAt,
        boundary: '当前后台、学校和学生的其他页面草稿及异常本机副本；没有上传、合并或清除。原页面可能继续编辑，本文件仅保存预览时读到的原文，异常内容不代表已验证的报告。',
        serverCopy: visible.serverCopy.valid ? null : visible.serverCopy,
        drafts: visible.drafts.map(({ clientId, isCurrentTab, raw, valid, error }) => ({ clientId, isCurrentTab, raw, valid, ...(error ? { error } : {}) })) }, null, 2);
      downloadRecordCopy(json, `其他页面课堂草稿-${encodeURIComponent(sessionId)}.json`, canRead);
      setMessage('已发起导出，请检查浏览器下载。其他页面的草稿仍保留。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '未能导出，请保留当前页面后重试。'); }
  }
  return <section className="record-copy-panel" aria-label="其他页面草稿与异常本机副本">
    <div className="record-copy-title"><Files size={18} aria-hidden="true" /><h2>其他页面草稿与异常副本</h2></div>
    <p>同一学生在其他标签页写下的内容独立保留，可查看和导出。回到原页面保存后再完成实验；若原页面已关闭或刚刷新，可先备份并核对其中的文字，再显式恢复为本页草稿。无法正常打开的本机内容也会保留原文供备份。</p>
    <button type="button" onClick={open}><RefreshCw size={14} />{visible ? '重新读取其他页面草稿' : '查看其他页面草稿'}</button>
    {visible && <><p className="record-copy-note">读取于 {new Date(visible.capturedAt).toLocaleString('zh-CN')}，{visible.drafts.length} 份草稿{!visible.serverCopy.valid ? '及1份异常账号缓存' : ''}。预览不会覆盖当前编辑内容。</p>
      {!visible.serverCopy.valid && <details className="record-copy-entry"><summary>本机账号缓存 · 内容需核对</summary><p>{visible.serverCopy.error}</p><pre>{visible.serverCopy.raw ?? '原文未能读取'}</pre></details>}
      {visible.drafts.map((draft, index) => <details key={`${draft.clientId}:${index}`} className="record-copy-entry"><summary>{draft.isCurrentTab ? '本页异常草稿' : `页面草稿 ${index + 1}`}{!draft.valid ? ' · 内容需核对' : ''}</summary><small>页面编号：{draft.clientId}</small>
        {draft.pending && <dl>{(Object.keys(fields) as Array<keyof typeof fields>).map((field) => <div key={field}><dt>{fields[field]}</dt><dd><pre>{draft.pending![field] || '未填写'}</pre></dd></div>)}</dl>}
        {onRestore && draft.valid && draft.pending && !draft.isCurrentTab && <><p>恢复会替换上方当前待同步草稿的四项正文，按来源版本 {draft.pending.expectedRevision} 核对账号版本；原页面副本不会删除或自动合并。</p><button type="button" disabled={!scope.canWrite || restoreDisabled || !visible.targetToken} onClick={() => restore(draft)}>恢复这份页面草稿</button></>}
        {draft.error && <p role="alert">{draft.error}</p>}<details><summary>原始备份内容</summary><pre>{draft.raw}</pre></details>
      </details>)}
      <button type="button" disabled={!visible.drafts.length && visible.serverCopy.valid} onClick={exportCopy}><Download size={14} />导出本次读到的副本</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
