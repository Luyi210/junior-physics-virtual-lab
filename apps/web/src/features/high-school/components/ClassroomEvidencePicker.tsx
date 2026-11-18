import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LEARNING_RECORD_FIELD_LIMITS, type SessionLearningRecord } from '@physics-lab/contracts';
import { HIGH_SCHOOL_EXPERIMENTS, type HighSchoolExperimentDefinition } from '@physics-lab/physics/high-school';
import { getClassroomExperiment } from '@physics-lab/knowledge/classroom';
import { ClipboardPlus, RefreshCw } from 'lucide-react';
import { canUseHighSchoolClassroomScope, loadHighSchoolClassroom } from '../../../data/highSchoolClassroom';
import { getHighSchoolRecordScope, subscribeHighSchoolRecordScope, type HighSchoolRecordScope } from '../../../data/highSchoolRecordScope';
import { getScopedMeasurementStore } from '../experiments/measurementStorage';
import { getScopedManualMeasurementRepository } from '../experiments/manualMeasurementRepository';
import { appendClassroomEvidence, createClassroomEvidencePreview, type ClassroomEvidencePreview, type ClassroomEvidenceSelection } from '../experiments/classroomEvidence';
import { assertClassroomEvidenceSourcesReadable, readClassroomEvidenceSources, type ClassroomEvidenceSources } from '../experiments/classroomEvidenceSources';
import { HighSchoolRecordScopePanel } from './HighSchoolRecordScopePanel';
import type { HighSchoolMeasurement } from '../experiments/workbench';
import './ClassroomEvidencePicker.css';

interface Props {
  detail: SessionLearningRecord;
  measurements: string;
  disabled: boolean;
  onAppend: (text: string) => void;
}
type Review = ClassroomEvidencePreview & { original: string; selection: ClassroomEvidenceSelection };
const emptySelection = (): ClassroomEvidenceSelection => ({ automaticIds: [], manualIds: [] });

export function ClassroomEvidencePicker(props: Props) {
  const scope = useSyncExternalStore(subscribeHighSchoolRecordScope, getHighSchoolRecordScope, getHighSchoolRecordScope);
  const definition = HIGH_SCHOOL_EXPERIMENTS.find((item) => item.id === props.detail.session.experimentId);
  if (!definition || getClassroomExperiment(definition.id)?.stage !== 'high-school') return null;
  return <EvidencePicker key={`${props.detail.session.id}:${scope.key}:${scope.revision}`} {...props} definition={definition} scope={scope} />;
}

function EvidencePicker({ detail, measurements, disabled, onAppend, definition, scope }: Props & { definition: HighSchoolExperimentDefinition; scope: HighSchoolRecordScope }) {
  const [sources, setSources] = useState<ClassroomEvidenceSources | null>(null);
  const [selection, setSelection] = useState(emptySelection);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const operation = useRef(false);
  const current = useRef({ detail, measurements, disabled, onAppend });
  current.current = { detail, measurements, disabled, onAppend };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [automaticStore] = useState(() => getScopedMeasurementStore(definition.id, scope.key));
  const [manualStore] = useState(() => definition.id === 'pendulum' || definition.id === 'double-slit' || definition.id === 'mechanical-energy'
    ? getScopedManualMeasurementRepository(definition.id, scope.key) : undefined);
  const owner = { learnerId: detail.session.learnerId, schoolId: detail.session.schoolId };
  const allowed = canUseHighSchoolClassroomScope(scope, owner);
  const completed = detail.session.status === 'completed';

  function checkCurrent() {
    const latest = current.current;
    if (!mounted.current || latest.detail.session.id !== detail.session.id || !canUseHighSchoolClassroomScope(scope, owner)) throw new Error('学生档案或课堂会话已变化，未加入旧预览。请重新打开读数选择。');
    if (latest.disabled || latest.detail.session.status === 'completed') throw new Error('课堂记录目前只读或有版本差异，请先核对记录状态。');
    return latest;
  }
  async function verifySession() {
    checkCurrent();
    const result = await loadHighSchoolClassroom({ experimentId: definition.id, taskId: detail.session.taskId, sessionId: detail.session.id }, scope);
    const latest = checkCurrent();
    if (result.record.session.status === 'completed') throw new Error('这次课堂实验已完成，请重新读取课堂档案；原文字仍保留。');
    if ((result.record.record?.revision ?? 0) !== (latest.detail.record?.revision ?? 0)) throw new Error('账号中的报告版本已变化，请先核对报告的保存状态，再重新选择读数。');
  }
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (!automaticStore.matchesKey(event.key) && !manualStore?.matchesKey(event.key)) return;
      setReview(null);
      if (canUseHighSchoolClassroomScope(scope, owner)) {
        setSources((previous) => previous ? readClassroomEvidenceSources(automaticStore, manualStore) : null);
        setMessage('本机读数已变化，请重新核对选择并生成预览。');
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [automaticStore, manualStore, scope, detail.session.learnerId, detail.session.schoolId]);

  async function openSources() {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(''); setMessage(''); setReview(null);
    try {
      await verifySession();
      const next = readClassroomEvidenceSources(automaticStore, manualStore);
      checkCurrent(); setSources(next); setSelection(emptySelection());
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : '暂时无法读取课堂读数。'); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  function toggle(kind: keyof ClassroomEvidenceSelection, id: string) {
    setSelection((previous) => ({ ...previous, [kind]: previous[kind].includes(id) ? previous[kind].filter((value) => value !== id) : [...previous[kind], id] }));
    setReview(null); setError(''); setMessage('');
  }
  function preview() {
    setReview(null); setError(''); setMessage('');
    try {
      const latest = checkCurrent();
      const next = readClassroomEvidenceSources(automaticStore, manualStore);
      setSources(next); assertClassroomEvidenceSourcesReadable(next);
      const result = createClassroomEvidencePreview(definition, next.automatic, next.manual, selection);
      appendClassroomEvidence(latest.measurements, result.text);
      setReview({ ...result, original: latest.measurements, selection: { automaticIds: [...selection.automaticIds], manualIds: [...selection.manualIds] } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : '暂时无法生成预览。'); }
  }
  async function append() {
    if (!review || operation.current) return;
    operation.current = true; setBusy(true); setError('');
    try {
      await verifySession();
      const latest = checkCurrent();
      if (latest.measurements !== review.original) throw new Error('测量文字在预览后已修改，请重新生成预览；原文不会被覆盖。');
      const next = readClassroomEvidenceSources(automaticStore, manualStore);
      setSources(next); assertClassroomEvidenceSourcesReadable(next);
      const fresh = createClassroomEvidencePreview(definition, next.automatic, next.manual, review.selection);
      if (fresh.fingerprint !== review.fingerprint) throw new Error('选中的读数或条件已变化，请重新预览，未加入旧副本。');
      const text = appendClassroomEvidence(latest.measurements, fresh.text);
      checkCurrent().onAppend(text);
      setReview(null); setSelection(emptySelection());
      setMessage('已加入当前编辑内容。是否已存本机或同步到账号，请以上方保存状态为准。');
    } catch (reason) { if (mounted.current) { setReview(null); setError(reason instanceof Error ? reason.message : '未能加入当前草稿，请重新预览。'); } }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }
  function recordList(records: HighSchoolMeasurement[], kind: keyof ClassroomEvidenceSelection, title: string) {
    return <fieldset disabled={busy || disabled || completed || !allowed}><legend>{title} · {records.length} 条</legend>{records.length ? records.map((record) => <label className="classroom-evidence-choice" key={record.id}>
      <input type="checkbox" checked={selection[kind].includes(record.id)} onChange={() => toggle(kind, record.id)} />
      <span><strong>{new Date(record.createdAt).toLocaleString('zh-CN')} · 仿真 {String(record.timeSeconds)} s</strong><small>{record.metrics.map((metric) => `${metric.label} ${String(metric.value)} ${metric.unit}`).join('；')}</small><small>当时条件：{definition.parameters.map((parameter) => `${parameter.label} ${String(record.parameters[parameter.key])} ${parameter.unit}`).join('；')}</small><code>{record.id}</code></span>
    </label>) : <p>当前档案暂无此类读数。</p>}</fieldset>;
  }
  return <section className="classroom-evidence-picker" aria-label="从高中实验选择课堂证据">
    <header><ClipboardPlus size={20} aria-hidden="true" /><div><h2>把选中的读数带进课堂记录</h2><p>选择、核对全文，再加入上方“测量数据与观察”。同一实验以前的自由探究记录也可能在列表中，请按本次任务选择。</p></div></header>
    {completed ? <p>课堂会话已完成，报告只读；本机实验档案仍保留。</p> : <>
      {!allowed && <><p role="status">请使用这份报告所属学生的有效档案。游客、教师或旧公共档案不会转存到学生报告。</p><HighSchoolRecordScopePanel scope={scope} /></>}
      <button type="button" className="classroom-evidence-button" disabled={!allowed || disabled || busy} onClick={() => void openSources()}><RefreshCw size={15} />{busy ? '正在核对…' : sources ? '重新读取本机档案' : '选择本机实验读数'}</button>
      {sources && allowed && <><p className="classroom-evidence-note">{sources.recoveryCount} 条待恢复副本、{sources.excludedManualCount} 条无法校验的手动记录未列入；旧公共档案不会读取。{sources.failed && '本机档案尚有异常，请先回工作台处理，暂不能追加。'}</p>
        {recordList(sources.automatic, 'automaticIds', '自动模型采样')}
        {manualStore && recordList(sources.manual, 'manualIds', '手动虚拟仪器读数')}
        <button type="button" className="classroom-evidence-button" disabled={disabled || busy || sources.failed || !(selection.automaticIds.length + selection.manualIds.length)} onClick={preview}>生成全文预览（{selection.automaticIds.length + selection.manualIds.length} 条）</button>
      </>}
      {review && allowed && <div className="classroom-evidence-review"><h3>核对将追加的文字</h3><p>自动 {review.automaticCount} 条 · 手动 {review.manualCount} 条。追加后共 {review.original.length + (review.original.length ? 2 : 0) + review.text.length} / {LEARNING_RECORD_FIELD_LIMITS.measurements} 字。原文保留，数据不截断。</p><pre tabIndex={0} aria-label="完整课堂证据预览">{review.text}</pre><button type="button" className="classroom-evidence-button is-primary" disabled={disabled || busy || measurements !== review.original} onClick={() => void append()}>确认加入课堂草稿</button>{measurements !== review.original && <p>测量文字已修改，请重新生成预览。</p>}</div>}
    </>}
    {error && <p className="classroom-evidence-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <p className="classroom-evidence-note">加入的是可编辑文字副本。读数来自虚拟模型或虚拟仪器，不代表实物实测；本机原始档案不会自动上传或删除。</p>
  </section>;
}
