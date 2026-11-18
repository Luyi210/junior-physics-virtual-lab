import { scrollToStudentSection } from "./scrollToStudentSection";
import { experimentTaskPath } from "../../experiments/catalog/taskRoutes";
import { getUnsavedLearningRecords } from "../../../data/unsavedLearningRecord";
import { learningRecordRepository } from "../../../data/learningRecordRepository";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PlatformUser, StudentExperimentSession, TeachingClass, TeachingTask } from "@physics-lab/contracts";
import { Activity, ArrowRight, BookOpenText, Check, CircleCheck, CirclePlay, Clock3, Compass, Database, FlaskConical, History, LoaderCircle, LogOut, Radio, RefreshCw, RotateCcw, Sparkles, Telescope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { getStudentRecordScope, subscribeStudentRecordScope, isCurrentStudentRecordScope, type StudentRecordScope } from "../../../data/studentRecordScope";
import { studentApi } from "../../../data/teacherApi";
import { activeStudentSession, clearActiveStudentSession, flushStudentEventQueue, setActiveStudentSession } from "../../../data/studentSessionSync";

const modeNames = { "before-class": "课前探究", "in-class": "课堂实验", "after-class": "课后反思" } as const;


function compactDate(value: string | null) {
  if (!value) return "长期开放";
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function taskTiming(task: TeachingTask) {
  const now = Date.now();
  if (task.opensAt && new Date(task.opensAt).getTime() > now) return { state: "upcoming" as const, disabled: true, text: `${compactDate(task.opensAt)} 开放` };
  if (task.dueAt && new Date(task.dueAt).getTime() < now) return { state: "expired" as const, disabled: true, text: "已截止" };
  return { state: "open" as const, disabled: false, text: task.dueAt ? `${compactDate(task.dueAt)} 截止` : "现在可进入" };
}

export function StudentTaskCenter({ user, onLogout }: { user: PlatformUser; onLogout: () => void }) {
  const scope = useSyncExternalStore(subscribeStudentRecordScope, getStudentRecordScope, getStudentRecordScope);
  return <ScopedStudentTaskCenter key={`${scope.key}:${scope.revision}:${user.schoolId}:${user.id}`} user={user} onLogout={onLogout} scope={scope} />;
}

function ScopedStudentTaskCenter({ user, onLogout, scope }: { user: PlatformUser; onLogout: () => void; scope: StudentRecordScope }) {
  const [tasks, setTasks] = useState<TeachingTask[]>([]);
  const [classes, setClasses] = useState<TeachingClass[]>([]);
  const [sessions, setSessions] = useState<StudentExperimentSession[]>([]);
  const [active, setActive] = useState<ReturnType<typeof activeStudentSession>>(null);
  const [view, setView] = useState<"missions" | "history">("missions");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [completionReview, setCompletionReview] = useState<{ sessionId: string; fingerprint: string; count: number } | null>(null);
  const navigate = useNavigate();

  const mounted = useRef(true);
  const operation = useRef(false);
  const loadSequence = useRef(0);
  const ownsScope = scope.mode === "account" && scope.studentId === user.id && scope.schoolId === user.schoolId && user.role === "student";
  const writable = ownsScope && scope.canWrite;
  const isCurrent = (write = false) => mounted.current && ownsScope && isCurrentStudentRecordScope(scope, write);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function load({ quiet = false }: { quiet?: boolean } = {}) {
    if (!isCurrent(true)) {
      if (mounted.current) { setLoading(false); setMessage(ownsScope ? "登录已过期，请用原学生账号重新登录后同步任务。已缓存的课堂记录仍可在原档案链接只读查看。" : "学生身份已改变，请返回学生首页重新登录。"); }
      return;
    }
    const sequence = ++loadSequence.current;
    const current = () => isCurrent(true) && sequence === loadSequence.current;
    if (!quiet) setLoading(true);
    setMessage("");
    try {
      const [nextTasks, nextClasses, nextSessions] = await Promise.all([studentApi.tasks(), studentApi.classes(), studentApi.sessions()]);
      if (!current()) return;
      if (nextSessions.some((session) => session.learnerId !== scope.studentId || session.schoolId !== scope.schoolId)) throw new Error("任务会话归属不一致，请重新登录后读取。");
      setTasks(nextTasks); setClasses(nextClasses); setSessions(nextSessions);
      const localActive = activeStudentSession(scope);
      const cloudActive = nextSessions.find((session) => session.status === "active" && session.id === localActive?.id)
        ?? nextSessions.find((session) => session.status === "active");
      if (cloudActive) {
        setActiveStudentSession(cloudActive, scope);
        setActive(activeStudentSession(scope));
      } else {
        clearActiveStudentSession(undefined, scope); setActive(null);
      }
      await flushStudentEventQueue(scope);
    } catch (error) {
      if (current()) setMessage(error instanceof Error ? error.message : "无法读取你的实验空间");
    } finally { if (current()) setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const completedTaskIds = useMemo(() => new Set(sessions.filter((session) => session.status === "completed").map((session) => session.taskId)), [sessions]);
  const activeCloudSession = sessions.find((session) => session.status === "active" && session.id === active?.id) ?? sessions.find((session) => session.status === "active");
  const currentTask = tasks.find((task) => task.id === activeCloudSession?.taskId);
  const availableTasks = tasks.filter((task) => !taskTiming(task).disabled && !completedTaskIds.has(task.id));
  const focusTask = currentTask ?? availableTasks[0] ?? tasks.find((task) => !completedTaskIds.has(task.id)) ?? tasks[0];
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const evidenceCount = sessions.reduce((sum, session) => sum + session.eventCount + session.observationCount, 0);
  const classLabel = classes.map((item) => item.name).join(" · ") || "等待加入班级";

  function enterSession(session: StudentExperimentSession, task?: TeachingTask) {
    if (!isCurrent(true) || session.learnerId !== scope.studentId || session.schoolId !== scope.schoolId) return;
    try {
      if (session.status === "active") {
        setActiveStudentSession(session, scope); setActive(activeStudentSession(scope));
      }
      navigate(experimentTaskPath(task?.experimentId ?? session.experimentId, session.taskId, session.id));
    } catch (error) {
      if (isCurrent(true)) setMessage(error instanceof Error ? error.message : "无法保存当前实验会话，请检查本机存储后重试。");
    }
  }

  async function start(task: TeachingTask) {
    if (!isCurrent(true) || operation.current) return;
    const matchingActive = sessions.find((session) => session.taskId === task.id && session.status === "active");
    if (matchingActive) return enterSession(matchingActive, task);
    operation.current = true; setBusy(task.id); setMessage("");
    try {
      const session = await studentApi.startSession(task.id);
      if (!isCurrent(true)) return;
      if (session.learnerId !== scope.studentId || session.schoolId !== scope.schoolId || session.taskId !== task.id) throw new Error("实验会话归属不一致，未进入实验。");
      setActiveStudentSession(session, scope); setActive(activeStudentSession(scope));
      navigate(experimentTaskPath(task.experimentId ?? session.experimentId, task.id, session.id));
    } catch (error) {
      if (isCurrent(true)) setMessage(error instanceof Error ? error.message : "无法启动实验任务");
    } finally { operation.current = false; if (isCurrent(true)) setBusy(""); }
  }

  async function complete(confirmSavedVersion = false) {
    if (!activeCloudSession || !isCurrent(true) || operation.current) return;
    const sessionId = activeCloudSession.id;
    operation.current = true; setBusy(sessionId); setMessage("");
    try {
      const assertNoUnsavedText = () => {
        if (getUnsavedLearningRecords(scope, sessionId).length) throw new Error("这份课堂报告还有尚未写入本机的正文副本。请先在课堂记录页查看、导出并将核对后的同份正文成功保存，再完成归档。");
      };
      assertNoUnsavedText();
      const repository = learningRecordRepository();
      const inspectDrafts = () => {
        const drafts = repository.listDrafts(scope, sessionId);
        if (drafts.some((draft) => !draft.valid)) throw new Error("本机有无法读取的课堂草稿，请先在课堂记录页核对并导出备份；暂不能完成归档。");
        return { count: drafts.filter((draft) => !draft.isCurrentTab).length, currentPending: drafts.some((draft) => draft.isCurrentTab),
          fingerprint: JSON.stringify(drafts.map(({ clientId, raw }) => ({ clientId, raw })).sort((left, right) => left.clientId.localeCompare(right.clientId))) };
      };
      const before = inspectDrafts();
      if (confirmSavedVersion && (!completionReview || completionReview.sessionId !== sessionId || completionReview.fingerprint !== before.fingerprint)) {
        setCompletionReview(null); throw new Error("本机草稿已发生变化，刚才的确认已失效。请重新检查后再完成。");
      }
      const cached = repository.read(scope, sessionId);
      if (before.currentPending && !cached?.pending) throw new Error("当前标签页仍有未同步草稿，但本机账号记录不完整。请先打开课堂记录重新读取并保存，暂不能完成归档。");
      if (cached?.pending) {
        await repository.sync(scope, sessionId);
        if (!isCurrent(true)) return;
      }
      if (repository.read(scope, sessionId)?.pending) throw new Error("当前课堂记录仍有未同步内容，请先保存后再完成归档。");
      await flushStudentEventQueue(scope, activeCloudSession);
      if (!isCurrent(true)) return;
      const latest = inspectDrafts();
      if (latest.currentPending || repository.read(scope, sessionId)?.pending) throw new Error("课堂记录在同步期间又有修改，请先保存最新内容。");
      if (confirmSavedVersion && completionReview?.fingerprint !== latest.fingerprint) {
        setCompletionReview(null); throw new Error("同步期间其他页面的草稿已发生变化，刚才的确认已失效。请重新检查后再完成。");
      }
      if (latest.count && !confirmSavedVersion) {
        setCompletionReview({ sessionId, ...latest });
        setMessage(`发现其他标签页的 ${latest.count} 份未同步草稿。可回原标签页保存，或在课堂记录页核对并导出备份。`);
        return;
      }
      assertNoUnsavedText();
      await studentApi.completeSession(sessionId);
      if (!isCurrent(true)) return;
      clearActiveStudentSession(sessionId, scope); setActive(null); setCompletionReview(null);
      await load({ quiet: true });
      if (isCurrent(true)) setMessage("本次实验已完成，已保存的课堂记录可在实验档案中查看。本机自由探究读数不会自动加入课堂报告。");
    } catch (error) {
      if (isCurrent(true)) setMessage(error instanceof Error ? error.message : "暂时无法完成任务");
    } finally { operation.current = false; if (isCurrent(true)) setBusy(""); }
  }

  return <section className="student-flight-deck" id="my-tasks">
    <header className="student-flight-header">
      <div className="student-flight-identity"><i>{user.name.slice(-1)}</i><span><small>AUTHENTICATED STUDENT / 已连接学生身份</small><h2>{user.name}的个人实验航行台</h2><p><Radio size={11} />{classLabel}<b>课堂保存状态同步</b></p></span></div>
      <div className="student-flight-tools"><button type="button" onClick={() => void load()} disabled={loading || !writable}><RefreshCw size={14} className={loading ? "is-spinning" : ""} />同步数据</button><button type="button" onClick={onLogout}><LogOut size={14} />退出账号</button></div>
    </header>

    <div className="student-flight-summary">
      <article className="student-focus-mission">
        <span><Sparkles size={14} />{activeCloudSession ? "CURRENT EXPERIMENT / 正在进行" : "NEXT MISSION / 下一项探究"}</span>
        {loading ? <div className="student-focus-loading"><LoaderCircle size={24} className="is-spinning" />正在校准你的任务坐标…</div> : activeCloudSession || focusTask ? <>
          <small>{activeCloudSession ? `${activeCloudSession.className} · 实验会话` : `${focusTask?.className} · ${focusTask ? modeNames[focusTask.mode] : "班级探究"}`}</small>
          <h3>{activeCloudSession?.taskTitle ?? focusTask?.title}</h3>
          <p>{activeCloudSession?.lessonTitle ?? focusTask?.lessonTitle}</p>
          <div><Clock3 size={14} /><b>{activeCloudSession ? `开始于 ${compactDate(activeCloudSession.startedAt)}` : taskTiming(focusTask).text}</b></div>
          <button type="button" disabled={!writable || Boolean(busy) || (!activeCloudSession && Boolean(focusTask && taskTiming(focusTask).disabled))} onClick={() => activeCloudSession ? enterSession(activeCloudSession, currentTask) : focusTask && void start(focusTask)}>{busy === (activeCloudSession?.id ?? focusTask?.id) ? <LoaderCircle size={17} className="is-spinning" /> : activeCloudSession ? <CirclePlay size={17} /> : <Telescope size={17} />}{activeCloudSession ? "继续当前实验" : focusTask && completedTaskIds.has(focusTask.id) ? "再次探究" : "开始这项实验"}<ArrowRight size={16} /></button>
        </> : <div className="student-focus-loading"><Compass size={25} />老师暂未发布任务，先从自己的问题自由探索。</div>}
        <i className="student-focus-orbit" aria-hidden="true"><b /><b /><em /></i>
      </article>

      <aside className="student-learning-snapshot" aria-label="我的实验概览">
        <header><span>LEARNING SNAPSHOT</span><b>我的实验信号</b></header>
        <div><article><BookOpenText size={17} /><strong>{tasks.length}</strong><span>班级任务<small>{availableTasks.length} 项待探究</small></span></article><article><CircleCheck size={17} /><strong>{completedSessions.length}</strong><span>完成会话<small>保留真实过程</small></span></article><article><Activity size={17} /><strong>{evidenceCount}</strong><span>证据片段<small>操作与观察</small></span></article><article><Database size={17} /><strong>{classes.length}</strong><span>所属班级<small>身份已同步</small></span></article></div>
        <footer><Link to="/student/notebook"><BookOpenText size={14} />整理实验记录<ArrowRight size={13} /></Link><a href="#fields" onClick={(event) => scrollToStudentSection(event, "fields")}><Compass size={14} />自由探索</a></footer>
      </aside>
    </div>

    {activeCloudSession && <div className="student-live-ribbon"><i><Radio size={17} /></i><span><small>课堂会话 · 查看已保存状态</small><b>{activeCloudSession.taskTitle}</b><em>{activeCloudSession.eventCount} 次操作 · {activeCloudSession.observationCount} 条观察</em></span><button type="button" disabled={!writable} onClick={() => enterSession(activeCloudSession, currentTask)}><CirclePlay size={15} />返回实验</button><button className="complete" type="button" disabled={!writable || Boolean(busy)} onClick={() => void complete()}>{busy === activeCloudSession.id ? <LoaderCircle size={15} className="is-spinning" /> : <Check size={15} />}完成并归档</button></div>}
    {message && <p className="student-flight-message" role="status">{message}{activeCloudSession && <> <Link to={`/student/records/${encodeURIComponent(activeCloudSession.id)}`}>查看课堂记录</Link></>}</p>}

    {completionReview && completionReview.sessionId === activeCloudSession?.id && <aside className="student-flight-message" aria-label="确认完成已保存版本">
      <p>另有 {completionReview.count} 份未同步草稿仍留本机。完成后，这些内容不能再写入这次实验。请先查看课堂记录中的其他页面草稿并按需导出。</p>
      <Link to={`/student/records/${encodeURIComponent(completionReview.sessionId)}`}>查看课堂记录</Link>{" "}
      <button type="button" disabled={!writable || Boolean(busy)} onClick={() => void complete(true)}>我理解并完成已保存版本</button>{" "}
      <button type="button" disabled={Boolean(busy)} onClick={() => setCompletionReview(null)}>暂不完成</button>
    </aside>}

    <nav className="student-flight-tabs" aria-label="任务与实验档案">
      <button className={view === "missions" ? "active" : ""} type="button" onClick={() => setView("missions")}><FlaskConical size={15} />班级任务 <b>{tasks.length}</b></button>
      <button className={view === "history" ? "active" : ""} type="button" onClick={() => setView("history")}><History size={15} />实验档案 <b>{sessions.length}</b></button>
      <span>{view === "missions" ? "选择一项任务进入对应虚拟实验" : "这里展示已同步到学校后台的真实实验会话"}</span>
    </nav>

    {view === "missions" ? <div className="student-mission-grid">{loading ? <div className="student-flight-empty"><LoaderCircle size={22} className="is-spinning" />正在读取班级任务</div> : tasks.map((task, index) => {
      const timing = taskTiming(task);
      const taskSessions = sessions.filter((session) => session.taskId === task.id);
      const session = taskSessions.find((item) => item.status === "active");
      const completed = taskSessions.filter((item) => item.status === "completed");
      const isLockedByOther = Boolean(activeCloudSession && activeCloudSession.taskId !== task.id);
      const finishedWithoutRetry = completed.length > 0 && !task.allowRetry;
      const disabled = !writable || timing.disabled || finishedWithoutRetry || isLockedByOther || Boolean(busy);
      const label = session ? "继续实验" : finishedWithoutRetry ? "任务已完成" : completed.length ? "再次探究" : timing.state === "upcoming" ? "等待开放" : timing.state === "expired" ? "任务已截止" : "启动实验";
      return <article key={task.id} className={`${session ? "is-active" : ""} ${completed.length ? "is-completed" : ""}`}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><em>{modeNames[task.mode]}</em>{session ? <b><Radio size={11} />进行中</b> : completed.length ? <b><CircleCheck size={11} />已完成 {completed.length} 次</b> : null}</header>
        <small>{task.className}</small><h3>{task.title}</h3><p>{task.lessonTitle}</p>
        <div className="student-mission-evidence"><span><Clock3 size={13} />{timing.text}</span><span><Activity size={13} />{taskSessions.reduce((sum, item) => sum + item.eventCount + item.observationCount, 0)} 条证据</span></div>
        <button type="button" disabled={disabled} onClick={() => void start(task)}>{busy === task.id ? <LoaderCircle size={15} className="is-spinning" /> : session ? <CirclePlay size={15} /> : completed.length ? <RotateCcw size={15} /> : <Telescope size={15} />}{isLockedByOther ? "先完成当前实验" : label}<ArrowRight size={14} /></button>
      </article>;
    })}{!loading && !tasks.length && <div className="student-flight-empty"><Compass size={27} /><b>暂时没有班级任务</b><p>六个领域和实验记录本仍然全部开放。</p><a href="#fields" onClick={(event) => scrollToStudentSection(event, "fields")}>去自由探索 <ArrowRight size={14} /></a></div>}</div> : <div className="student-session-history">{loading ? <div className="student-flight-empty"><LoaderCircle size={22} className="is-spinning" />正在读取实验档案</div> : sessions.map((session, index) => <article key={session.id} className={session.status === "active" ? "is-active" : ""}><i>{session.status === "active" ? <Radio size={17} /> : <CircleCheck size={17} />}</i><span><small>{session.className} · {session.status === "active" ? "正在进行" : `完成于 ${compactDate(session.completedAt)}`}</small><b>{session.taskTitle}</b><em>{session.lessonTitle}</em><Link to={`/student/records/${encodeURIComponent(session.id)}`}>查看实验记录</Link></span><div><strong>{session.eventCount}</strong><small>操作</small></div><div><strong>{session.observationCount}</strong><small>观察</small></div>{session.status === "active" && <button type="button" disabled={!writable} onClick={() => enterSession(session, tasks.find((task) => task.id === session.taskId))}>继续实验 <ArrowRight size={14} /></button>}<label>{String(sessions.length - index).padStart(2, "0")}</label></article>)}{!loading && !sessions.length && <div className="student-flight-empty"><History size={27} /><b>还没有云端实验档案</b><p>从班级任务启动实验后，可在这里查看会话和已保存的课堂记录。</p></div>}</div>}
  </section>;
}
