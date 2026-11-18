import { LearnerState, TeacherWorkspace, TeacherLesson, TeacherLiveSession, teacherExperimentCatalog } from "../teacherWorkspace";
import { useState, FormEvent } from "react";
import { Radio, CirclePlay, ArrowRight, CirclePause, Sparkles, Square, UserRoundCheck, Gauge, MessageSquareText, Send, AlertTriangle, Check, Users, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { PanelHeader } from "../components/TeacherPrimitives";

const learnerStateText: Record<LearnerState, string> = { exploring: "正在实验", recording: "记录现象", thinking: "形成解释", offline: "未连接" };

export function TeacherLiveClassroom({ workspace, activeLesson, onLaunch, onUpdate, onEnd }: { workspace: TeacherWorkspace; activeLesson?: TeacherLesson; onLaunch: (lessonId: string) => void; onUpdate: (session: TeacherLiveSession | null) => void; onEnd: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | LearnerState>("all");
  const session = workspace.liveSession;
  const classItem = workspace.classes.find((item) => item.id === session?.classId);
  const experiment = teacherExperimentCatalog.find((item) => item.id === activeLesson?.experimentId);
  const online = session?.learners.filter((learner) => learner.state !== "offline").length ?? 0;
  const observations = session?.learners.reduce((sum, learner) => sum + learner.observations, 0) ?? 0;
  const average = session ? Math.round(session.learners.reduce((sum, learner) => sum + learner.progress, 0) / session.learners.length) : 0;
  const attentionLearners = session?.learners.filter((learner) => learner.state !== "offline" && (learner.progress < 55 || learner.observations === 0)) ?? [];
  const visibleLearners = session?.learners.filter((learner) => stateFilter === "all" || learner.state === stateFilter) ?? [];

  function publishPrompt(event: FormEvent) {
    event.preventDefault();
    if (!session || !prompt.trim()) return;
    onUpdate({ ...session, prompts: [{ id: `prompt-${Date.now()}`, text: prompt.trim(), createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }, ...session.prompts] });
    setPrompt("");
  }

  function advanceDemo() {
    if (!session) return;
    const states: LearnerState[] = ["exploring", "recording", "thinking"];
    onUpdate({
      ...session,
      learners: session.learners.map((learner, index) => learner.state === "offline" ? learner : {
        ...learner,
        progress: Math.min(100, learner.progress + 8 + (index % 3)),
        observations: learner.observations + (index % 2),
        state: states[(states.indexOf(learner.state) + 1) % states.length],
        stage: learner.progress > 72 ? "形成解释" : learner.progress > 50 ? "记录现象" : "调整变量"
      })
    });
  }

  if (!session || !activeLesson) {
    const available = workspace.lessons.filter((lesson) => lesson.status !== "completed");
    return (
      <div className="teacher-view teacher-live-empty-view">
        <section className="teacher-live-standby">
          <div className="teacher-radar-stage"><i /><i /><i /><span><Radio size={34} /></span></div>
          <span>CHANNEL STANDBY / 等待课堂信号</span><h2>选择一份课例，启动课堂观测</h2><p>启动后可查看学生所处的探究阶段、发布全班追问并生成课堂证据。当前为本地演示，不连接真实学生设备。</p>
          <div className="teacher-standby-lessons">
            {available.map((lesson) => <button key={lesson.id} type="button" onClick={() => onLaunch(lesson.id)}><span><small>{lesson.scheduledAt}</small><b>{lesson.title}</b></span><CirclePlay size={19} /></button>)}
          </div>
          {!available.length && <Link className="teacher-button primary" to="/teacher/lessons">创建新的实验课例 <ArrowRight size={16} /></Link>}
        </section>
      </div>
    );
  }

  return (
    <div className="teacher-view teacher-live-view">
      <section className="teacher-live-banner">
        <div><span><i />LIVE · LOCAL DEMO</span><h2>{activeLesson.title}</h2><p>{classItem?.name} · {experiment?.field} · {activeLesson.duration} 分钟</p></div>
        <div className="teacher-live-controls">
          <button type="button" onClick={() => onUpdate({ ...session, status: session.status === "paused" ? "running" : "paused" })}>{session.status === "paused" ? <CirclePlay size={17} /> : <CirclePause size={17} />}{session.status === "paused" ? "继续观测" : "暂停观测"}</button>
          <button type="button" onClick={advanceDemo}><Sparkles size={17} />推进演示数据</button>
          <button className="danger" type="button" onClick={onEnd}><Square size={15} />结束并生成报告</button>
        </div>
      </section>

      <section className="teacher-live-metrics">
        <article><UserRoundCheck size={18} /><span><small>ONLINE</small><b>{online} / {session.learners.length}</b></span></article>
        <article><Gauge size={18} /><span><small>AVG PROGRESS</small><b>{average}%</b></span></article>
        <article><MessageSquareText size={18} /><span><small>OBSERVATIONS</small><b>{observations}</b></span></article>
        <article><Send size={18} /><span><small>PROMPTS</small><b>{session.prompts.length}</b></span></article>
      </section>

      <section className={`teacher-live-attention ${attentionLearners.length ? "has-attention" : "is-clear"}`}>
        <i>{attentionLearners.length ? <AlertTriangle size={17} /> : <Check size={17} />}</i>
        <div><span>INTERVENTION RADAR</span><b>{attentionLearners.length ? `${attentionLearners.length} 名学生可能需要教师关注` : "当前没有明显停滞信号"}</b><p>{attentionLearners.length ? `${attentionLearners.slice(0, 4).map((learner) => learner.name).join("、")}${attentionLearners.length > 4 ? "等" : ""}：进程偏低或尚未留下观察记录。` : "建议继续观察，不必为了活跃课堂而频繁介入。"}</p></div>
        {attentionLearners.length > 0 && <button type="button" onClick={() => setStateFilter("exploring")}>聚焦实验中学生 <ArrowRight size={14} /></button>}
      </section>

      <div className="teacher-live-layout">
        <section className="teacher-panel teacher-learner-matrix">
          <PanelHeader eyebrow="LEARNER SIGNAL MATRIX" title="学生探究进程" icon={Users} />
          <div className="teacher-state-legend"><button className={stateFilter === "all" ? "active" : ""} type="button" onClick={() => setStateFilter("all")}>全部 {session.learners.length}</button>{(["exploring", "recording", "thinking", "offline"] as LearnerState[]).map((state) => <button key={state} className={`${state} ${stateFilter === state ? "active" : ""}`} type="button" onClick={() => setStateFilter(state)}>{learnerStateText[state]} {session.learners.filter((learner) => learner.state === state).length}</button>)}</div>
          <div className="teacher-learner-grid">
            {visibleLearners.map((learner) => <article key={learner.id} className={`state-${learner.state} ${attentionLearners.some((item) => item.id === learner.id) ? "needs-attention" : ""}`}><header><i /><small>{learnerStateText[learner.state]}</small>{attentionLearners.some((item) => item.id === learner.id) && <em>关注</em>}</header><strong>{learner.name}</strong><span>{learner.stage}</span><div><i style={{ width: `${learner.progress}%` }} /></div><footer><small>进程 {learner.progress}%</small><small>记录 {learner.observations}</small></footer></article>)}
          </div>
        </section>

        <aside className="teacher-live-side">
          <section className="teacher-panel teacher-question-panel">
            <PanelHeader eyebrow="BROADCAST QUESTION" title="发布课堂追问" icon={Send} />
            <blockquote>{activeLesson.inquiryQuestion}</blockquote>
            <form onSubmit={publishPrompt}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="输入要发送给全班的提示，例如：先不要下结论，比较第 2 与第 3 组数据。" /><button className="teacher-button primary wide" type="submit"><Send size={16} />发送给全班</button></form>
          </section>
          <section className="teacher-panel teacher-prompt-log">
            <PanelHeader eyebrow="CLASS SIGNAL LOG" title="课堂消息" icon={Activity} />
            {session.prompts.length ? <ol>{session.prompts.map((item) => <li key={item.id}><span>{item.createdAt}</span><p>{item.text}</p></li>)}</ol> : <p className="teacher-log-empty">还没有发布追问。观察学生进程，在真正需要时再介入。</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
