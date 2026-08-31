import { useEffect, useMemo, useState } from "react";
import type { PlatformUser, StudentExperimentSession, TeachingClass, TeachingTask } from "@physics-lab/contracts";
import { Activity, ArrowRight, BookOpenText, Check, CircleCheck, CirclePlay, Clock3, Compass, Database, FlaskConical, History, LoaderCircle, LogOut, Radio, RefreshCw, RotateCcw, Sparkles, Telescope } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { studentApi, TeacherApiError } from "../../services/teacherApi";
import { activeStudentSession, clearActiveStudentSession, flushStudentEventQueue, setActiveStudentSession } from "../../services/studentSessionSync";

const experimentPaths: Record<string, string> = {
  light: "/student/explore/light", lens: "/lab/lens", mechanics: "/student/explore/mechanics", circuit: "/student/explore/circuit", sound: "/student/explore/sound", thermal: "/student/explore/thermal", measurement: "/student/explore/measurement",
  reflection: "/student/explore/light?mode=reflection",
  "sound-medium": "/student/explore/sound?module=sound-medium",
  "sound-features": "/student/explore/sound?module=sound-features",
  "mechanics-speed": "/student/explore/mechanics?module=mechanics-speed",
  "mechanics-friction": "/student/explore/mechanics?module=mechanics-friction",
  "mechanics-lever": "/student/explore/mechanics?module=mechanics-lever",
  "mechanics-buoyancy": "/student/explore/mechanics?module=mechanics-buoyancy",
  "circuit-basic": "/student/explore/circuit?module=circuit-basic",
  "circuit-ohm": "/student/explore/circuit?module=circuit-ohm",
  "circuit-power": "/student/explore/circuit?module=circuit-power",
  "circuit-magnet": "/student/explore/circuit?module=circuit-magnet",
  "thermal-boiling": "/student/explore/thermal?module=thermal-boiling",
  "thermal-evaporation": "/student/explore/thermal?module=thermal-evaporation",
  "measurement-density": "/student/explore/measurement?module=measurement-density"
};
const modeNames = { "before-class": "课前探究", "in-class": "课堂实验", "after-class": "课后反思" } as const;

function experimentTaskPath(experimentId: string | undefined, taskId: string, sessionId: string) {
  const path = experimentPaths[experimentId ?? ""] ?? "/student";
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}taskId=${encodeURIComponent(taskId)}&sessionId=${encodeURIComponent(sessionId)}`;
}

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
  const [tasks, setTasks] = useState<TeachingTask[]>([]);
  const [classes, setClasses] = useState<TeachingClass[]>([]);
  const [sessions, setSessions] = useState<StudentExperimentSession[]>([]);
  const [active, setActive] = useState(() => activeStudentSession());
  const [view, setView] = useState<"missions" | "history">("missions");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function load({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) setLoading(true);
    setMessage("");
    try {
      const [nextTasks, nextClasses, nextSessions] = await Promise.all([studentApi.tasks(), studentApi.classes(), studentApi.sessions()]);
      setTasks(nextTasks);
      setClasses(nextClasses);
      setSessions(nextSessions);
      const localActive = activeStudentSession();
      const cloudActive = nextSessions.find((session) => session.status === "active" && session.id === localActive?.id)
        ?? nextSessions.find((session) => session.status === "active");
      if (cloudActive) {
        setActiveStudentSession(cloudActive);
        setActive(activeStudentSession());
      } else {
        clearActiveStudentSession();
        setActive(null);
      }
      void flushStudentEventQueue();
    } catch (error) {
      setMessage(error instanceof TeacherApiError ? error.message : "无法读取你的实验空间");
    } finally {
      setLoading(false);
    }
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
    if (session.status === "active") {
      setActiveStudentSession(session);
      setActive(activeStudentSession());
    }
    navigate(experimentTaskPath(task?.experimentId ?? session.experimentId, session.taskId, session.id));
  }

  async function start(task: TeachingTask) {
    const matchingActive = sessions.find((session) => session.taskId === task.id && session.status === "active");
    if (matchingActive) return enterSession(matchingActive, task);
    setBusy(task.id);
    setMessage("");
    try {
      const session = await studentApi.startSession(task.id);
      setActiveStudentSession(session);
      setActive(activeStudentSession());
      navigate(experimentTaskPath(task.experimentId ?? session.experimentId, task.id, session.id));
    } catch (error) {
      setMessage(error instanceof TeacherApiError ? error.message : "无法启动实验任务");
    } finally {
      setBusy("");
    }
  }

  async function complete() {
    if (!activeCloudSession) return;
    setBusy(activeCloudSession.id);
    setMessage("");
    try {
      await flushStudentEventQueue();
      await studentApi.completeSession(activeCloudSession.id);
      clearActiveStudentSession(activeCloudSession.id);
      setActive(null);
      setMessage("本次实验已完成，操作与观察已经进入你的实验档案");
      await load({ quiet: true });
    } catch (error) {
      setMessage(error instanceof TeacherApiError ? error.message : "暂时无法完成任务");
    } finally {
      setBusy("");
    }
  }

  return <section className="student-flight-deck" id="my-tasks">
    <header className="student-flight-header">
      <div className="student-flight-identity"><i>{user.name.slice(-1)}</i><span><small>AUTHENTICATED STUDENT / 已连接学生身份</small><h2>{user.name}的个人实验航行台</h2><p><Radio size={11} />{classLabel}<b>实验数据实时回传</b></p></span></div>
      <div className="student-flight-tools"><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "is-spinning" : ""} />同步数据</button><button type="button" onClick={onLogout}><LogOut size={14} />退出账号</button></div>
    </header>

    <div className="student-flight-summary">
      <article className="student-focus-mission">
        <span><Sparkles size={14} />{activeCloudSession ? "CURRENT EXPERIMENT / 正在进行" : "NEXT MISSION / 下一项探究"}</span>
        {loading ? <div className="student-focus-loading"><LoaderCircle size={24} className="is-spinning" />正在校准你的任务坐标…</div> : activeCloudSession || focusTask ? <>
          <small>{activeCloudSession ? `${activeCloudSession.className} · 实验会话` : `${focusTask?.className} · ${focusTask ? modeNames[focusTask.mode] : "班级探究"}`}</small>
          <h3>{activeCloudSession?.taskTitle ?? focusTask?.title}</h3>
          <p>{activeCloudSession?.lessonTitle ?? focusTask?.lessonTitle}</p>
          <div><Clock3 size={14} /><b>{activeCloudSession ? `开始于 ${compactDate(activeCloudSession.startedAt)}` : taskTiming(focusTask).text}</b></div>
          <button type="button" disabled={Boolean(busy) || (!activeCloudSession && Boolean(focusTask && taskTiming(focusTask).disabled))} onClick={() => activeCloudSession ? enterSession(activeCloudSession, currentTask) : focusTask && void start(focusTask)}>{busy === (activeCloudSession?.id ?? focusTask?.id) ? <LoaderCircle size={17} className="is-spinning" /> : activeCloudSession ? <CirclePlay size={17} /> : <Telescope size={17} />}{activeCloudSession ? "继续当前实验" : focusTask && completedTaskIds.has(focusTask.id) ? "再次探究" : "开始这项实验"}<ArrowRight size={16} /></button>
        </> : <div className="student-focus-loading"><Compass size={25} />老师暂未发布任务，先从自己的问题自由探索。</div>}
        <i className="student-focus-orbit" aria-hidden="true"><b /><b /><em /></i>
      </article>

      <aside className="student-learning-snapshot" aria-label="我的实验概览">
        <header><span>LEARNING SNAPSHOT</span><b>我的实验信号</b></header>
        <div><article><BookOpenText size={17} /><strong>{tasks.length}</strong><span>班级任务<small>{availableTasks.length} 项待探究</small></span></article><article><CircleCheck size={17} /><strong>{completedSessions.length}</strong><span>完成会话<small>保留真实过程</small></span></article><article><Activity size={17} /><strong>{evidenceCount}</strong><span>证据片段<small>操作与观察</small></span></article><article><Database size={17} /><strong>{classes.length}</strong><span>所属班级<small>身份已同步</small></span></article></div>
        <footer><Link to="/student/notebook"><BookOpenText size={14} />整理实验记录<ArrowRight size={13} /></Link><a href="#fields"><Compass size={14} />自由探索</a></footer>
      </aside>
    </div>

    {activeCloudSession && <div className="student-live-ribbon"><i><Radio size={17} /></i><span><small>LIVE SESSION · 操作证据采集中</small><b>{activeCloudSession.taskTitle}</b><em>{activeCloudSession.eventCount} 次操作 · {activeCloudSession.observationCount} 条观察</em></span><button type="button" onClick={() => enterSession(activeCloudSession, currentTask)}><CirclePlay size={15} />返回实验</button><button className="complete" type="button" disabled={Boolean(busy)} onClick={() => void complete()}>{busy === activeCloudSession.id ? <LoaderCircle size={15} className="is-spinning" /> : <Check size={15} />}完成并归档</button></div>}
    {message && <p className="student-flight-message">{message}</p>}

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
      const disabled = timing.disabled || finishedWithoutRetry || isLockedByOther || Boolean(busy);
      const label = session ? "继续实验" : finishedWithoutRetry ? "任务已完成" : completed.length ? "再次探究" : timing.state === "upcoming" ? "等待开放" : timing.state === "expired" ? "任务已截止" : "启动实验";
      return <article key={task.id} className={`${session ? "is-active" : ""} ${completed.length ? "is-completed" : ""}`}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><em>{modeNames[task.mode]}</em>{session ? <b><Radio size={11} />进行中</b> : completed.length ? <b><CircleCheck size={11} />已完成 {completed.length} 次</b> : null}</header>
        <small>{task.className}</small><h3>{task.title}</h3><p>{task.lessonTitle}</p>
        <div className="student-mission-evidence"><span><Clock3 size={13} />{timing.text}</span><span><Activity size={13} />{taskSessions.reduce((sum, item) => sum + item.eventCount + item.observationCount, 0)} 条证据</span></div>
        <button type="button" disabled={disabled} onClick={() => void start(task)}>{busy === task.id ? <LoaderCircle size={15} className="is-spinning" /> : session ? <CirclePlay size={15} /> : completed.length ? <RotateCcw size={15} /> : <Telescope size={15} />}{isLockedByOther ? "先完成当前实验" : label}<ArrowRight size={14} /></button>
      </article>;
    })}{!loading && !tasks.length && <div className="student-flight-empty"><Compass size={27} /><b>暂时没有班级任务</b><p>六个领域和实验记录本仍然全部开放。</p><a href="#fields">去自由探索 <ArrowRight size={14} /></a></div>}</div> : <div className="student-session-history">{loading ? <div className="student-flight-empty"><LoaderCircle size={22} className="is-spinning" />正在读取实验档案</div> : sessions.map((session, index) => <article key={session.id} className={session.status === "active" ? "is-active" : ""}><i>{session.status === "active" ? <Radio size={17} /> : <CircleCheck size={17} />}</i><span><small>{session.className} · {session.status === "active" ? "正在进行" : `完成于 ${compactDate(session.completedAt)}`}</small><b>{session.taskTitle}</b><em>{session.lessonTitle}</em></span><div><strong>{session.eventCount}</strong><small>操作</small></div><div><strong>{session.observationCount}</strong><small>观察</small></div>{session.status === "active" && <button type="button" onClick={() => enterSession(session, tasks.find((task) => task.id === session.taskId))}>继续实验 <ArrowRight size={14} /></button>}<label>{String(sessions.length - index).padStart(2, "0")}</label></article>)}{!loading && !sessions.length && <div className="student-flight-empty"><History size={27} /><b>还没有云端实验档案</b><p>从班级任务启动实验后，操作与观察会自动积累在这里。</p></div>}</div>}
  </section>;
}
