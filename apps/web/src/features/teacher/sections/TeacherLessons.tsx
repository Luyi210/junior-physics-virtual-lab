import { TeacherWorkspace, TeacherLesson, ExperimentCatalogItem, teacherExperimentCatalog, createTeacherLesson, teacherLessonDefaults, teacherStageLabels } from "../teacherWorkspace";
import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ExternalLink, FlaskConical, Target, Lightbulb, BrainCircuit, GitCompareArrows, ClipboardCheck, RotateCcw, Clock3, Check, BookOpen, CirclePlay } from "lucide-react";
import { PanelHeader } from "../components/TeacherPrimitives";

export function TeacherLessons({ workspace, onAdd, onLaunch }: { workspace: TeacherWorkspace; onAdd: (item: TeacherLesson) => void; onLaunch: (lessonId: string) => void }) {
  const [selected, setSelected] = useState<ExperimentCatalogItem>(teacherExperimentCatalog[0]);
  const [created, setCreated] = useState("");
  const [detailLessonId, setDetailLessonId] = useState(workspace.lessons[0]?.id ?? "");
  const navigate = useNavigate();
  const defaults = teacherLessonDefaults(selected);
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
      <section className="teacher-view-toolbar"><div><span>初中 / 高中 · 已开放实验</span><h2>从现象开始备一节课</h2><p>选择实验只是起点；真正的课堂由探究问题、观察证据和讨论节奏组成。</p></div><Link className="teacher-button ghost" to={selected.path} target="_blank">预览学生实验 <ExternalLink size={16} /></Link></section>
      <div className="teacher-lesson-builder">
        <section className="teacher-experiment-library">
          <header><span>01</span><div><b>选择实验场</b><small>SELECT EXPERIMENT FIELD</small></div></header>
          <div>
            {teacherExperimentCatalog.map((item) => (
              <button key={item.id} className={selected.id === item.id ? "active" : ""} type="button" onClick={() => setSelected(item)} style={{ "--experiment-accent": item.accent } as React.CSSProperties}>
                <i><FlaskConical size={18} /></i><span><small>{teacherStageLabels[item.stage]} · {item.field}</small><b>{item.title}</b><em>{item.subtitle}</em></span><strong>{item.formula}</strong>
              </button>
            ))}
          </div>
        </section>

        <form className="teacher-lesson-form" onSubmit={submit}>
          <header><span>02</span><div><b>编排探究任务</b><small>DESIGN INQUIRY SEQUENCE</small></div></header>
          <div className="teacher-selected-experiment"><i style={{ background: selected.accent }} /><span><small>{teacherStageLabels[selected.stage]} · {selected.field}实验</small><strong>{selected.title}</strong></span><em>{selected.formula}</em></div>
          <label><span>课例标题</span><input name="title" defaultValue={defaults.title} key={`${selected.id}-title`} required /></label>
          <div className="teacher-form-columns">
            <label><span>教学班</span><select name="classId" required>{workspace.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>课堂时长</span><select name="duration" defaultValue="40"><option value="20">20 分钟</option><option value="35">35 分钟</option><option value="40">40 分钟</option><option value="45">45 分钟</option></select></label>
          </div>
          <label><span><Target size={14} />学习目标</span><textarea name="objective" defaultValue={defaults.objective} key={`${selected.id}-objective`} required /></label>
          <label><span><Lightbulb size={14} />核心探究问题</span><textarea name="inquiryQuestion" defaultValue={defaults.inquiryQuestion} key={`${selected.id}-question`} required /></label>
          <div className="teacher-inquiry-protocol">
            <header><span>03</span><div><b>建立探究证据链</b><small>PREDICT · CONTROL · EVIDENCE · REFLECT</small></div></header>
            <label><span><BrainCircuit size={14} />作出预测</span><textarea name="predictionPrompt" defaultValue={defaults.predictionPrompt} key={`${selected.id}-predictionPrompt`} required /></label>
            <label><span><GitCompareArrows size={14} />变量控制</span><textarea name="controlledVariable" defaultValue={defaults.controlledVariable} key={`${selected.id}-controlledVariable`} required /></label>
            <label><span><ClipboardCheck size={14} />证据要求</span><textarea name="evidenceRequirement" defaultValue={defaults.evidenceRequirement} key={`${selected.id}-evidenceRequirement`} required /></label>
            <label><span><RotateCcw size={14} />迁移反思</span><textarea name="reflectionPrompt" defaultValue={defaults.reflectionPrompt} key={`${selected.id}-reflectionPrompt`} required /></label>
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
            return <article key={lesson.id} className={detailLessonId === lesson.id ? "is-selected" : ""}><i style={{ background: item?.accent }} /><span><small>{item ? `${teacherStageLabels[item.stage]} · ${item.field}` : lesson.experimentId} · {classItem?.name}</small><b>{lesson.title}</b><em>{lesson.scheduledAt} · {lesson.duration} MIN</em></span><strong className={`status-${lesson.status}`}>{lesson.status === "ready" ? "待上课" : lesson.status === "completed" ? "已完成" : "草稿"}</strong><div className="teacher-lesson-row-actions"><button type="button" onClick={() => setDetailLessonId(lesson.id)}>详情</button><button type="button" disabled={lesson.status === "completed"} onClick={() => launch(lesson.id)}><CirclePlay size={16} />启动</button></div></article>;
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
