import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, RefreshCw } from 'lucide-react';
import { highSchoolClassroomRequest, loadHighSchoolClassroom, type HighSchoolClassroomDetail } from '../../../data/highSchoolClassroom';
import type { HighSchoolRecordScope } from '../../../data/highSchoolRecordScope';
import './HighSchoolClassroomPanel.css';

export function HighSchoolClassroomPanel({ experimentId, scope }: { experimentId: string; scope: HighSchoolRecordScope }) {
  const location = useLocation();
  const identity = `${experimentId}:${location.search}:${scope.key}:${scope.revision}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ identity: string; detail?: HighSchoolClassroomDetail; error?: string }>({ identity: '' });
  const hasTaskLink = new URLSearchParams(location.search).has('taskId') || new URLSearchParams(location.search).has('sessionId');
  useEffect(() => {
    let active = true;
    setState({ identity });
    void (async () => {
      const request = highSchoolClassroomRequest(experimentId, location.search);
      if (!request) return;
      const detail = await loadHighSchoolClassroom(request, scope);
      if (active) setState({ identity, detail });
    })().catch((error: unknown) => { if (active) setState({ identity, error: error instanceof Error ? error.message : '暂时无法读取课堂任务。' }); });
    return () => { active = false; };
  }, [identity, attempt, experimentId, location.search, scope]);
  if (!hasTaskLink) return null;
  const current = state.identity === identity ? state : { identity };
  const detail = current.detail;
  return <section className="hs-classroom-panel" aria-label="高中课堂任务">
    <header><div><span className="hs-kicker">课堂任务 · 学生账号</span><h2>{detail?.record.taskTitle ?? '连接这次课堂实验'}</h2>{detail && <p>{detail.record.className} · {detail.record.lessonTitle}</p>}</div><BookOpen size={24} aria-hidden="true" /></header>
    {current.error ? <div role="alert"><p>{current.error}</p><button className="hs-button" type="button" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={14} />重新核对</button></div> : !detail ? <p role="status">正在核对学生、任务与实验会话…</p> : <>
      {detail.lesson ? <dl><div><dt>探究问题</dt><dd>{detail.lesson.inquiryQuestion}</dd></div><div><dt>先作预测</dt><dd>{detail.lesson.predictionPrompt || '先写下预测，再用证据核对。'}</dd></div><div><dt>控制变量</dt><dd>{detail.lesson.controlledVariable || '比较前说明保持不变的条件。'}</dd></div><div><dt>证据要求</dt><dd>{detail.lesson.evidenceRequirement || '保留条件、数值、单位及来源。'}</dd></div></dl> : <p>当前任务的课例说明已不可读取；已核对属于你的课堂记录仍可查看。</p>}
      <p>{detail.record.session.status === 'completed' ? '这次课堂会话已完成，账号记录只读；本页仍可自由探究。' : '本页采样保存在本机。进入课堂记录后，选择要加入的读数、预览并保存到账号；不会自动上传以前的自由探究记录。'}</p>
      <Link className="hs-button hs-primary" to={`/student/records/${encodeURIComponent(detail.record.session.id)}`}>{detail.record.session.status === 'completed' ? '查看课堂记录' : '填写课堂记录与选择读数'}</Link>
    </>}
    <Link className="hs-classroom-back" to="/student#my-tasks">返回任务中心</Link>
  </section>;
}
