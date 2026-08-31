import { FormEvent, useState } from "react";
import type { PlatformUser, TeachingClass as ApiTeachingClass, TeachingTask } from "@physics-lab/contracts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePause,
  CirclePlay,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileBarChart,
  Filter,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  Lightbulb,
  MessageSquareText,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Target,
  Telescope,
  TrendingUp,
  UserRoundCheck,
  Users,
  Waves,
  X
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  createTeacherClass,
  createTeacherLesson,
  ExperimentCatalogItem,
  LearnerState,
  TeacherClass,
  TeacherLesson,
  TeacherLiveSession,
  TeacherReport,
  TeacherWorkspace,
  teacherExperimentCatalog
} from "./teacherWorkspace";

type OverviewProps = {
  workspace: TeacherWorkspace;
  onLaunch: (lessonId: string) => void;
  remote?: { students: PlatformUser[]; classes: ApiTeachingClass[]; tasks: TeachingTask[] };
};

export function TeacherOverview({ workspace, onLaunch, remote }: OverviewProps) {
  const navigate = useNavigate();
  const studentTotal = remote?.students.length ?? workspace.classes.reduce((sum, item) => sum + item.studentCount, 0);
  const classTotal = remote?.classes.length ?? workspace.classes.length;
  const publishedTasks = remote?.tasks.filter((task) => task.status === "published").length ?? 0;
  const readyLessons = workspace.lessons.filter((lesson) => lesson.status === "ready");
  const nextLesson = readyLessons[0] ?? workspace.lessons[0];
  const nextClass = workspace.classes.find((item) => item.id === nextLesson?.classId);
  const experiment = teacherExperimentCatalog.find((item) => item.id === nextLesson?.experimentId);
  const latestReport = workspace.reports[0];
  const draftLessons = workspace.lessons.filter((lesson) => lesson.status === "draft");

  function launch() {
    if (!nextLesson) return;
    onLaunch(nextLesson.id);
    navigate("/teacher/live");
  }

  return (
    <div className="teacher-view teacher-overview-view">
      <section className="teacher-metric-grid" aria-label="教学关键数据">
        <MetricCard icon={Users} code="CLASS NETWORK" value={classTotal.toString().padStart(2, "0")} label="个教学班" note={`${studentTotal} 名真实后台学生`} tone="cyan" />
        <MetricCard icon={BookOpen} code="LESSON QUEUE" value={(remote ? publishedTasks : readyLessons.length).toString().padStart(2, "0")} label={remote ? "个已发布任务" : "节课待进行"} note={remote ? `${remote.tasks.length} 个后台教学任务` : `${workspace.lessons.length} 份实验课例`} tone="violet" />
        <MetricCard icon={FileBarChart} code="EVIDENCE BANK" value={workspace.reports.length.toString().padStart(2, "0")} label="份课堂报告" note="按过程证据生成" tone="green" />
        <MetricCard icon={Radio} code="LIVE CHANNEL" value={workspace.liveSession ? "ON" : "--"} label={workspace.liveSession ? "课堂进行中" : "当前无直播课堂"} note={workspace.liveSession ? "信号已连接" : "等待发起课程"} tone="amber" />
      </section>

      <section className={`teacher-attention-rail ${workspace.liveSession ? "is-live" : ""}`}>
        <i>{workspace.liveSession ? <Radio size={18} /> : <AlertTriangle size={18} />}</i>
        <div>
          <span>{workspace.liveSession ? "LIVE ATTENTION / 课堂进行中" : "TEACHING ATTENTION / 今日提醒"}</span>
          <b>{workspace.liveSession ? "当前课堂正在接收学生探究信号" : draftLessons.length ? `${draftLessons.length} 份课例仍是草稿状态，建议课前完成问题与变量检查` : "今天的待课课例已经准备就绪"}</b>
        </div>
        <Link to={workspace.liveSession ? "/teacher/live" : "/teacher/lessons"}>{workspace.liveSession ? "进入课堂" : "检查备课"}<ArrowRight size={15} /></Link>
      </section>

      <div className="teacher-overview-layout">
        <section className="teacher-panel teacher-next-lesson">
          <PanelHeader eyebrow="NEXT MISSION / 下一课堂" title="即将开始的实验课" icon={Telescope} />
          {nextLesson ? (
            <div className="teacher-lesson-brief">
              <div className="teacher-orbit-visual" aria-hidden="true">
                <i /><i /><i /><span>{experiment?.formula ?? "Δx / Δt"}</span>
              </div>
              <div className="teacher-lesson-brief-copy">
                <span>{nextLesson.scheduledAt} · {nextClass?.name ?? "未分配班级"}</span>
                <h2>{nextLesson.title}</h2>
                <p>{nextLesson.inquiryQuestion}</p>
                <dl>
                  <div><dt>实验领域</dt><dd>{experiment?.field}</dd></div>
                  <div><dt>课堂时长</dt><dd>{nextLesson.duration} MIN</dd></div>
                  <div><dt>准备状态</dt><dd className="is-ready">READY</dd></div>
                </dl>
                <div className="teacher-action-row">
                  <button className="teacher-button primary" type="button" onClick={launch}><CirclePlay size={17} />启动课堂</button>
                  <Link className="teacher-button ghost" to="/teacher/lessons">查看课例 <ArrowRight size={16} /></Link>
                </div>
              </div>
            </div>
          ) : <EmptyState title="还没有待进行的实验课" text="先从实验库中创建一份课例。" action="开始备课" to="/teacher/lessons" />}
        </section>

        <section className="teacher-panel teacher-readiness-panel">
          <PanelHeader eyebrow="CLASS READINESS" title="班级实验准备度" icon={Gauge} />
          <div className="teacher-readiness-list">
            {workspace.classes.map((item, index) => {
              const readiness = [88, 76, 93, 81][index % 4];
              return (
                <article key={item.id}>
                  <div><i style={{ background: item.color }} /><span><b>{item.name}</b><small>{item.studentCount} 人 · {item.joinCode}</small></span><strong>{readiness}%</strong></div>
                  <div className="teacher-progress"><i style={{ width: `${readiness}%`, background: item.color }} /></div>
                </article>
              );
            })}
          </div>
          <Link className="teacher-inline-link" to="/teacher/classes">管理全部班级 <ChevronRight size={15} /></Link>
        </section>

        <section className="teacher-panel teacher-evidence-snapshot">
          <PanelHeader eyebrow="LATEST EVIDENCE" title="最近课堂证据" icon={TrendingUp} />
          {latestReport ? (
            <>
              <div className="teacher-evidence-score"><strong>{latestReport.participationRate}<small>%</small></strong><span>实验参与率<br /><em>{latestReport.className}</em></span></div>
              <div className="teacher-mini-bars" aria-label="课堂证据指标">
                <div><span>参与</span><i><b style={{ width: `${latestReport.participationRate}%` }} /></i></div>
                <div><span>进程</span><i><b style={{ width: `${latestReport.averageProgress}%` }} /></i></div>
                <div><span>记录</span><i><b style={{ width: `${Math.min(latestReport.observationCount, 100)}%` }} /></i></div>
              </div>
              <p>{latestReport.followUp}</p>
              <Link className="teacher-inline-link" to="/teacher/reports">打开完整报告 <ChevronRight size={15} /></Link>
            </>
          ) : <EmptyState title="暂无课堂证据" text="结束一次课堂后，系统会生成本地报告。" />}
        </section>

        <section className="teacher-panel teacher-activity-feed">
          <PanelHeader eyebrow="WORKFLOW" title="教学工作流" icon={Activity} />
          <ol>
            <li className="done"><i><Check size={13} /></i><span><b>选择实验与探究目标</b><small>基于学生端现有实验模块</small></span></li>
            <li className={nextLesson ? "done" : "active"}><i>{nextLesson ? <Check size={13} /> : "2"}</i><span><b>发布课堂课例</b><small>设置问题、时长和教学班</small></span></li>
            <li className={workspace.liveSession ? "active" : ""}><i>3</i><span><b>观察课堂进程</b><small>识别停滞、记录与解释状态</small></span></li>
            <li><i>4</i><span><b>复盘学习证据</b><small>形成下一课的教学建议</small></span></li>
          </ol>
        </section>

        <section className="teacher-panel teacher-weekly-schedule">
          <PanelHeader eyebrow="TEACHING ORBIT / THIS WEEK" title="本周实验教学轨道" icon={CalendarDays} />
          <div>
            {workspace.lessons.slice(0, 4).map((lesson, index) => {
              const lessonExperiment = teacherExperimentCatalog.find((item) => item.id === lesson.experimentId);
              const lessonClass = workspace.classes.find((item) => item.id === lesson.classId);
              return <article key={lesson.id} style={{ "--schedule-accent": lessonExperiment?.accent ?? "#78ddff" } as React.CSSProperties}><header><span>{String(index + 1).padStart(2, "0")}</span><em>{lesson.status === "completed" ? "DONE" : lesson.status === "ready" ? "READY" : "DRAFT"}</em></header><i /><small>{lesson.scheduledAt} · {lessonClass?.name}</small><b>{lesson.title}</b><p>{lesson.inquiryQuestion}</p></article>;
            })}
            <Link to="/teacher/lessons"><i>+</i><b>继续编排课例</b><span>进入实验备课空间</span></Link>
          </div>
        </section>
      </div>
    </div>
  );
}

type MetricCardProps = { icon: typeof Users; code: string; value: string; label: string; note: string; tone: string };

function MetricCard({ icon: Icon, code, value, label, note, tone }: MetricCardProps) {
  return <article className={`teacher-metric-card tone-${tone}`}><header><span>{code}</span><Icon size={17} /></header><div><strong>{value}</strong><span>{label}</span></div><p>{note}</p></article>;
}

function PanelHeader({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: typeof Users }) {
  return <header className="teacher-panel-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><i><Icon size={18} /></i></header>;
}

function EmptyState({ title, text, action, to }: { title: string; text: string; action?: string; to?: string }) {
  return <div className="teacher-empty"><Waves size={30} /><strong>{title}</strong><p>{text}</p>{action && to && <Link to={to}>{action} <ArrowRight size={14} /></Link>}</div>;
}

export function TeacherClasses({ classes, onAdd }: { classes: TeacherClass[]; onAdd: (item: TeacherClass) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("全部年级");
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const visibleClasses = classes.filter((item) => (grade === "全部年级" || item.grade === grade) && `${item.name} ${item.joinCode}`.toLowerCase().includes(query.trim().toLowerCase()));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const grade = String(data.get("grade") ?? "八年级");
    const studentCount = Number(data.get("studentCount") ?? 0);
    if (!name || !studentCount) return;
    const classItem = createTeacherClass({ name, grade, studentCount });
    onAdd(classItem);
    setNotice(`${classItem.name} 已创建，入口码为 ${classItem.joinCode}`);
    setShowForm(false);
    event.currentTarget.reset();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`已复制班级入口码 ${code}`);
    } catch {
      setNotice(`班级入口码：${code}`);
    }
  }

  return (
    <div className="teacher-view teacher-classes-view">
      <section className="teacher-view-toolbar">
        <div><span>CLASS MATRIX / {classes.length.toString().padStart(2, "0")}</span><h2>教学班坐标</h2><p>入口码用于演示班级边界；真实学生加入能力需账号后端接入。</p></div>
        <button className="teacher-button primary" type="button" onClick={() => setShowForm((value) => !value)}><Plus size={17} />新建班级</button>
      </section>

      {notice && <div className="teacher-notice"><Check size={15} />{notice}<button type="button" onClick={() => setNotice("")}>关闭</button></div>}

      {showForm && (
        <form className="teacher-create-form" onSubmit={submit}>
          <header><div><span>NEW COORDINATE</span><h3>建立一个教学班</h3></div><button type="button" onClick={() => setShowForm(false)}>取消</button></header>
          <label><span>班级名称</span><input name="name" placeholder="例如：八年级（3）班" required /></label>
          <label><span>年级</span><select name="grade" defaultValue="八年级"><option>七年级</option><option>八年级</option><option>九年级</option></select></label>
          <label><span>学生人数</span><input name="studentCount" type="number" min="1" max="80" defaultValue="40" required /></label>
          <button className="teacher-button primary" type="submit"><Check size={16} />创建并生成入口码</button>
        </form>
      )}

      <section className="teacher-data-toolbar" aria-label="班级筛选">
        <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索班级名称或入口码" /></label>
        <label><Filter size={14} /><select value={grade} onChange={(event) => setGrade(event.target.value)}><option>全部年级</option><option>七年级</option><option>八年级</option><option>九年级</option></select></label>
        <span>显示 {visibleClasses.length} / {classes.length} 个班级</span>
      </section>

      <section className="teacher-class-grid">
        {visibleClasses.map((item, index) => (
          <article key={item.id} style={{ "--class-accent": item.color } as React.CSSProperties}>
            <header><span>CLASS / {String(index + 1).padStart(2, "0")}</span><i><Users size={20} /></i></header>
            <h3>{item.name}</h3><p>{item.grade} · {item.studentCount} 名学生</p>
            <div className="teacher-code-block"><span>课堂入口码</span><strong>{item.joinCode}</strong><button type="button" onClick={() => void copyCode(item.joinCode)}>复制</button></div>
            <dl><div><dt>本周课例</dt><dd>{index + 1} 节</dd></div><div><dt>实验准备度</dt><dd>{[88, 76, 93, 81][index % 4]}%</dd></div></dl>
            <div className="teacher-class-actions"><button type="button" onClick={() => setSelectedClass(item)}>查看班级详情</button><Link to="/teacher/lessons">为此班备课 <ArrowRight size={15} /></Link></div>
          </article>
        ))}
        {!visibleClasses.length && <div className="teacher-filter-empty"><Search size={25} /><b>没有匹配的教学班</b><p>调整关键词或年级筛选后再试。</p></div>}
      </section>

      {selectedClass && <div className="teacher-detail-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedClass(null)}>
        <aside className="teacher-class-detail" role="dialog" aria-modal="true" aria-label={`${selectedClass.name}详情`} style={{ "--class-accent": selectedClass.color } as React.CSSProperties}>
          <header><div><span>CLASS DETAIL / LOCAL DEMO</span><h2>{selectedClass.name}</h2><p>{selectedClass.grade} · {selectedClass.studentCount} 名学生</p></div><button type="button" onClick={() => setSelectedClass(null)} aria-label="关闭班级详情"><X size={18} /></button></header>
          <section className="teacher-class-detail-kpis"><div><strong>{[88, 76, 93, 81][classes.indexOf(selectedClass) % 4]}%</strong><span>实验准备度</span></div><div><strong>{classes.indexOf(selectedClass) + 1}</strong><span>本周课例</span></div><div><strong>{selectedClass.studentCount - 1}</strong><span>最近在线</span></div></section>
          <section className="teacher-class-detail-code"><span>CLASS ACCESS COORDINATE</span><b>{selectedClass.joinCode}</b><button type="button" onClick={() => void copyCode(selectedClass.joinCode)}>复制入口码</button><p>入口码目前只用于本地演示，不代表真实账号已经加入。</p></section>
          <section className="teacher-class-detail-groups"><header><span>LEARNING GROUPS</span><b>实验小组建议</b></header><div>{["A 组 · 变量控制", "B 组 · 现象记录", "C 组 · 证据比较", "D 组 · 解释表达"].map((item, index) => <article key={item}><i>{index + 1}</i><span><b>{item}</b><small>{Math.floor(selectedClass.studentCount / 4) + (index < selectedClass.studentCount % 4 ? 1 : 0)} 人</small></span></article>)}</div></section>
          <footer><Link className="teacher-button primary" to="/teacher/lessons" onClick={() => setSelectedClass(null)}><BookOpen size={16} />为这个班编排实验课</Link><button className="teacher-button ghost" type="button" onClick={() => setSelectedClass(null)}>关闭详情</button></footer>
        </aside>
      </div>}
    </div>
  );
}

export function TeacherLessons({ workspace, onAdd, onLaunch }: { workspace: TeacherWorkspace; onAdd: (item: TeacherLesson) => void; onLaunch: (lessonId: string) => void }) {
  const [selected, setSelected] = useState<ExperimentCatalogItem>(teacherExperimentCatalog[0]);
  const [created, setCreated] = useState("");
  const [detailLessonId, setDetailLessonId] = useState(workspace.lessons[0]?.id ?? "");
  const navigate = useNavigate();
  const detailLesson = workspace.lessons.find((lesson) => lesson.id === detailLessonId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const lesson = createTeacherLesson({
      title: String(data.get("title")),
      experimentId: selected.id,
      classId: String(data.get("classId")),
      duration: Number(data.get("duration")),
      objective: String(data.get("objective")),
      inquiryQuestion: String(data.get("inquiryQuestion")),
      predictionPrompt: String(data.get("predictionPrompt")),
      controlledVariable: String(data.get("controlledVariable")),
      evidenceRequirement: String(data.get("evidenceRequirement")),
      reflectionPrompt: String(data.get("reflectionPrompt")),
      scheduledAt: String(data.get("scheduledAt"))
    });
    onAdd(lesson);
    setCreated("课例已保存到待课队列");
  }

  function launch(lessonId: string) {
    onLaunch(lessonId);
    navigate("/teacher/live");
  }

  return (
    <div className="teacher-view teacher-lessons-view">
      <section className="teacher-view-toolbar"><div><span>EXPERIMENT LIBRARY / 06 FIELDS</span><h2>从现象开始备一节课</h2><p>选择实验只是起点；真正的课堂由探究问题、观察证据和讨论节奏组成。</p></div><Link className="teacher-button ghost" to={selected.path} target="_blank">预览学生实验 <ExternalLink size={16} /></Link></section>
      <div className="teacher-lesson-builder">
        <section className="teacher-experiment-library">
          <header><span>01</span><div><b>选择实验场</b><small>SELECT EXPERIMENT FIELD</small></div></header>
          <div>
            {teacherExperimentCatalog.map((item) => (
              <button key={item.id} className={selected.id === item.id ? "active" : ""} type="button" onClick={() => setSelected(item)} style={{ "--experiment-accent": item.accent } as React.CSSProperties}>
                <i><FlaskConical size={18} /></i><span><small>{item.field}</small><b>{item.title}</b><em>{item.subtitle}</em></span><strong>{item.formula}</strong>
              </button>
            ))}
          </div>
        </section>

        <form className="teacher-lesson-form" onSubmit={submit}>
          <header><span>02</span><div><b>编排探究任务</b><small>DESIGN INQUIRY SEQUENCE</small></div></header>
          <div className="teacher-selected-experiment"><i style={{ background: selected.accent }} /><span><small>{selected.field}实验</small><strong>{selected.title}</strong></span><em>{selected.formula}</em></div>
          <label><span>课例标题</span><input name="title" defaultValue={`${selected.title}探究课`} key={`${selected.id}-title`} required /></label>
          <div className="teacher-form-columns">
            <label><span>教学班</span><select name="classId" required>{workspace.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>课堂时长</span><select name="duration" defaultValue="40"><option value="20">20 分钟</option><option value="35">35 分钟</option><option value="40">40 分钟</option><option value="45">45 分钟</option></select></label>
          </div>
          <label><span><Target size={14} />学习目标</span><textarea name="objective" defaultValue="让学生通过改变一个变量、记录多组现象，用自己的证据形成物理规律。" required /></label>
          <label><span><Lightbulb size={14} />核心探究问题</span><textarea name="inquiryQuestion" defaultValue={`改变实验条件时，${selected.title}中的关键现象会怎样变化？`} key={`${selected.id}-question`} required /></label>
          <div className="teacher-inquiry-protocol">
            <header><span>03</span><div><b>建立探究证据链</b><small>PREDICT · CONTROL · EVIDENCE · REFLECT</small></div></header>
            <label><span><BrainCircuit size={14} />作出预测</span><textarea name="predictionPrompt" defaultValue="操作前先写下你的预测，并说明判断依据。" required /></label>
            <label><span><GitCompareArrows size={14} />变量控制</span><textarea name="controlledVariable" defaultValue="固定其他条件，每轮只改变一个关键变量。" required /></label>
            <label><span><ClipboardCheck size={14} />证据要求</span><textarea name="evidenceRequirement" defaultValue="至少记录三组可比较的数据或现象，并注明实验条件。" required /></label>
            <label><span><RotateCcw size={14} />迁移反思</span><textarea name="reflectionPrompt" defaultValue="换一个情境或设置一个反例，刚才形成的解释仍然成立吗？" required /></label>
          </div>
          <label><span><Clock3 size={14} />计划时间</span><input name="scheduledAt" defaultValue="明天 10:10" required /></label>
          {created && <p className="teacher-form-success"><Check size={15} />{created}</p>}
          <button className="teacher-button primary wide" type="submit"><ClipboardCheck size={17} />保存为待课课例</button>
        </form>
      </div>

      <section className="teacher-lesson-queue">
        <PanelHeader eyebrow="LESSON QUEUE" title="我的实验课例" icon={BookOpen} />
        <div>
          {workspace.lessons.map((lesson) => {
            const item = teacherExperimentCatalog.find((entry) => entry.id === lesson.experimentId);
            const classItem = workspace.classes.find((entry) => entry.id === lesson.classId);
            return <article key={lesson.id} className={detailLessonId === lesson.id ? "is-selected" : ""}><i style={{ background: item?.accent }} /><span><small>{item?.field} · {classItem?.name}</small><b>{lesson.title}</b><em>{lesson.scheduledAt} · {lesson.duration} MIN</em></span><strong className={`status-${lesson.status}`}>{lesson.status === "ready" ? "待上课" : lesson.status === "completed" ? "已完成" : "草稿"}</strong><div className="teacher-lesson-row-actions"><button type="button" onClick={() => setDetailLessonId(lesson.id)}>详情</button><button type="button" disabled={lesson.status === "completed"} onClick={() => launch(lesson.id)}><CirclePlay size={16} />启动</button></div></article>;
          })}
        </div>
      </section>
      {detailLesson && <section className="teacher-lesson-blueprint">
        <header><div><span>INQUIRY BLUEPRINT</span><h2>{detailLesson.title}</h2><p>{detailLesson.objective}</p></div><strong>{detailLesson.duration}<small>MIN</small></strong></header>
        <div className="teacher-blueprint-flow">
          <article><i>01</i><span><small>PREDICT</small><b>作出预测</b><p>{detailLesson.predictionPrompt ?? "操作前写下预测，并说明判断依据。"}</p></span></article>
          <article><i>02</i><span><small>CONTROL</small><b>控制变量</b><p>{detailLesson.controlledVariable ?? "每轮只改变一个关键变量。"}</p></span></article>
          <article><i>03</i><span><small>EVIDENCE</small><b>收集证据</b><p>{detailLesson.evidenceRequirement ?? "记录三组以上可比较的数据或现象。"}</p></span></article>
          <article><i>04</i><span><small>REFLECT</small><b>迁移反思</b><p>{detailLesson.reflectionPrompt ?? "用新情境或反例检验形成的解释。"}</p></span></article>
        </div>
        <footer><blockquote><Lightbulb size={16} /><span><small>核心探究问题</small>{detailLesson.inquiryQuestion}</span></blockquote><button className="teacher-button primary" type="button" disabled={detailLesson.status === "completed"} onClick={() => launch(detailLesson.id)}><CirclePlay size={16} />从这份蓝图启动课堂</button></footer>
      </section>}
    </div>
  );
}

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

export function TeacherReports({ reports }: { reports: TeacherReport[] }) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("全部班级");
  const classNames = [...new Set(reports.map((report) => report.className))];
  const visibleReports = reports.filter((report) => (classFilter === "全部班级" || report.className === classFilter) && `${report.lessonTitle} ${report.className}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = visibleReports.find((report) => report.id === selectedId) ?? visibleReports[0] ?? reports[0];
  const averageParticipation = Math.round(reports.reduce((sum, report) => sum + report.participationRate, 0) / Math.max(reports.length, 1));
  const averageProgress = Math.round(reports.reduce((sum, report) => sum + report.averageProgress, 0) / Math.max(reports.length, 1));

  function exportReport() {
    if (!selected) return;
    const rows = [
      ["课堂", selected.lessonTitle],
      ["班级", selected.className],
      ["生成时间", selected.createdAt],
      ["参与率", `${selected.participationRate}%`],
      ["平均进程", `${selected.averageProgress}%`],
      ["观察记录", String(selected.observationCount)],
      ["后续建议", selected.followUp]
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.className}-${selected.lessonTitle}-课堂报告.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!selected) return <div className="teacher-view"><EmptyState title="还没有课堂报告" text="结束一节课堂后，这里会汇总学习过程证据。" action="进入课堂控制台" to="/teacher/live" /></div>;

  return (
    <div className="teacher-view teacher-reports-view">
      <section className="teacher-view-toolbar"><div><span>EVIDENCE ARCHIVE / {reports.length.toString().padStart(2, "0")}</span><h2>课堂学习证据</h2><p>只呈现操作、记录和进程线索，避免把单一指标当作学生能力排名。</p></div><button className="teacher-button ghost" type="button" onClick={exportReport}><Download size={16} />导出当前报告</button></section>
      <section className="teacher-data-toolbar teacher-report-filter"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课例或班级" /></label><label><Filter size={14} /><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>全部班级</option>{classNames.map((name) => <option key={name}>{name}</option>)}</select></label><span>显示 {visibleReports.length} / {reports.length} 份报告</span></section>
      <div className="teacher-report-layout">
        <aside className="teacher-report-index">
          <header><span>REPORT INDEX</span><b>报告档案</b></header>
          {visibleReports.map((report, index) => <button key={report.id} className={report.id === selected.id ? "active" : ""} type="button" onClick={() => setSelectedId(report.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><small>{report.createdAt} · {report.className}</small><b>{report.lessonTitle}</b></span><ChevronRight size={16} /></button>)}
          {!visibleReports.length && <div className="teacher-report-index-empty"><Search size={20} /><p>没有匹配的课堂报告</p></div>}
        </aside>
        <article className="teacher-report-sheet">
          <header><div><span>PHYSICS LEARNING EVIDENCE</span><h2>{selected.lessonTitle}</h2><p>{selected.className} · {selected.createdAt}</p></div><i><FileBarChart size={27} /></i></header>
          <section className="teacher-report-kpis">
            <div><strong>{selected.participationRate}<small>%</small></strong><span>实验参与率</span></div>
            <div><strong>{selected.averageProgress}<small>%</small></strong><span>平均探究进程</span></div>
            <div><strong>{selected.observationCount}</strong><span>观察记录条数</span></div>
          </section>
          <section className="teacher-report-diagnostic">
            <article><span>参与率对比</span><b className={selected.participationRate >= averageParticipation ? "positive" : "watch"}>{selected.participationRate >= averageParticipation ? "+" : ""}{selected.participationRate - averageParticipation}<small> pct</small></b><p>相对当前报告档案均值 {averageParticipation}%</p></article>
            <article><span>探究进程对比</span><b className={selected.averageProgress >= averageProgress ? "positive" : "watch"}>{selected.averageProgress >= averageProgress ? "+" : ""}{selected.averageProgress - averageProgress}<small> pct</small></b><p>相对当前报告档案均值 {averageProgress}%</p></article>
            <article><span>证据密度</span><b>{Math.round(selected.observationCount / Math.max(selected.averageProgress, 1) * 10) / 10}<small> 条/进程</small></b><p>用于观察记录充足度，不代表学习水平</p></article>
          </section>
          <section className="teacher-report-chart"><header><span>PROCESS SIGNAL</span><b>课堂进程信号</b></header><div className="teacher-signal-chart"><i style={{ height: "42%" }} /><i style={{ height: "58%" }} /><i style={{ height: "64%" }} /><i style={{ height: "73%" }} /><i style={{ height: `${selected.averageProgress}%` }} /><i style={{ height: `${Math.min(98, selected.participationRate)}%` }} /><span>进入实验</span><span>调整变量</span><span>记录现象</span><span>比较证据</span><span>形成解释</span><span>完成课堂</span></div></section>
          <section className="teacher-report-evidence"><header><span>OBSERVED EVIDENCE</span><b>本节课看见了什么</b></header><ol>{selected.evidence.map((item, index) => <li key={item}><i>{index + 1}</i><span>{item}</span></li>)}</ol></section>
          <section className="teacher-report-followup"><Lightbulb size={21} /><div><span>NEXT TEACHING MOVE</span><b>下一步教学建议</b><p>{selected.followUp}</p></div></section>
          <footer><span>本报告由当前设备上的演示课堂数据生成</span><span>不用于学生排名或自动评价</span></footer>
        </article>
      </div>
    </div>
  );
}
