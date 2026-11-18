import { TeacherWorkspace, teacherExperimentCatalog } from "../teacherWorkspace";
import { type PlatformUser, type TeachingClass as ApiTeachingClass, type TeachingTask } from "@physics-lab/contracts";
import { useNavigate, Link } from "react-router-dom";
import { Users, BookOpen, FileBarChart, Radio, AlertTriangle, ArrowRight, Telescope, CirclePlay, Gauge, ChevronRight, TrendingUp, Activity, Check, CalendarDays } from "lucide-react";
import { MetricCard, PanelHeader, EmptyState } from "../components/TeacherPrimitives";

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
        <MetricCard icon={Users} code="CLASS NETWORK" value={classTotal.toString().padStart(2, "0")} label="个教学班" note={remote ? `${studentTotal} 名真实后台学生` : `${studentTotal} 名本地演示学生`} tone="cyan" />
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
