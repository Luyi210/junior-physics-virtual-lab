import { FormEvent, useMemo, useState } from "react";
import type { TeachingClass, TeachingLesson, TeachingTask, TeachingTaskMode, TeachingTaskStatus } from "@physics-lab/contracts";
import { ArrowRight, BookOpen, Check, ChevronRight, CirclePlay, ClipboardCheck, Clock3, ExternalLink, FlaskConical, LoaderCircle, Radio, Send, X } from "lucide-react";
import { Link } from "react-router-dom";
import { teacherApi, TeacherApiError } from "../../services/teacherApi";
import { teacherExperimentCatalog } from "./teacherWorkspace";

const modeNames: Record<TeachingTaskMode, string> = { "before-class": "课前探究", "in-class": "课堂实验", "after-class": "课后反思" };
const statusNames: Record<TeachingTaskStatus, string> = { draft: "草稿", published: "已发布", closed: "已关闭", archived: "已归档" };

export function TeacherTeachingFlow({ classes, lessons, tasks, onRefresh }: {
  classes: TeachingClass[];
  lessons: TeachingLesson[];
  tasks: TeachingTask[];
  onRefresh: () => Promise<void>;
}) {
  const [selectedExperimentId, setSelectedExperimentId] = useState(teacherExperimentCatalog[0].id);
  const [showLesson, setShowLesson] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState(lessons[0]?.id ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const selectedExperiment = teacherExperimentCatalog.find((item) => item.id === selectedExperimentId) ?? teacherExperimentCatalog[0];
  const readyLessons = useMemo(() => lessons.filter((lesson) => lesson.status !== "archived"), [lessons]);

  async function perform(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key); setMessage("");
    try { await action(); await onRefresh(); setMessage(success); }
    catch (error) { setMessage(error instanceof TeacherApiError ? error.message : "后台操作失败"); }
    finally { setBusy(""); }
  }

  async function createLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await perform("lesson", async () => {
      const created = await teacherApi.createLesson({
        experimentId: selectedExperiment.id,
        title: String(data.get("title")),
        objective: String(data.get("objective")),
        inquiryQuestion: String(data.get("inquiryQuestion")),
        predictionPrompt: String(data.get("predictionPrompt")),
        controlledVariable: String(data.get("controlledVariable")),
        evidenceRequirement: String(data.get("evidenceRequirement")),
        reflectionPrompt: String(data.get("reflectionPrompt")),
        durationMinutes: Number(data.get("durationMinutes")),
        status: "ready"
      });
      setSelectedLessonId(created.id);
      setShowLesson(false);
    }, "真实课例已保存，可以发布为班级任务");
  }

  async function publishTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await perform("publish", async () => {
      await teacherApi.createTask({
        classId: String(data.get("classId")), lessonId: String(data.get("lessonId")), title: String(data.get("title")),
        mode: String(data.get("mode")) as TeachingTaskMode, status: "published", opensAt: String(data.get("opensAt")) || null, dueAt: String(data.get("dueAt")) || null, allowRetry: true
      });
      setShowPublish(false);
    }, "实验任务已发布，班级学生登录后即可看到");
  }

  function nextStatus(status: TeachingTaskStatus): TeachingTaskStatus {
    if (status === "draft") return "published";
    if (status === "published") return "closed";
    return "archived";
  }

  return <div className="teacher-view teacher-flow-view">
    <section className="teacher-view-toolbar teacher-flow-heading"><div><span>LESSON → TASK → STUDENT</span><h2>实验课发布轨道</h2><p>先建立可复用课例，再发布给真实班级。学生登录后只会看到已发布且属于自己的任务。</p></div><div><button className="teacher-button ghost" type="button" onClick={() => setShowLesson(true)}><BookOpen size={15} />创建课例</button><button className="teacher-button primary" type="button" onClick={() => setShowPublish(true)} disabled={!readyLessons.length || !classes.length}><Send size={15} />发布任务</button></div></section>
    <section className="teacher-flow-rail"><article className="is-complete"><i>01</i><span><small>EXPERIMENT SOURCE</small><b>选择实验</b><em>{teacherExperimentCatalog.length} 个领域模板</em></span><Check size={16} /></article><ChevronRight size={18} /><article className={lessons.length ? "is-complete" : ""}><i>02</i><span><small>LESSON BLUEPRINT</small><b>形成课例</b><em>{lessons.length} 份真实课例</em></span>{lessons.length ? <Check size={16} /> : <BookOpen size={16} />}</article><ChevronRight size={18} /><article className={tasks.some((task) => task.status === "published") ? "is-live" : ""}><i>03</i><span><small>CLASS DELIVERY</small><b>发布任务</b><em>{tasks.filter((task) => task.status === "published").length} 个正在开放</em></span><Radio size={16} /></article></section>
    {message && <p className="teacher-real-feedback"><Check size={14} />{message}</p>}
    <div className="teacher-flow-layout">
      <section className="teacher-flow-library"><header><span>EXPERIMENT SOURCE</span><h3>实验模板坐标</h3></header><div>{teacherExperimentCatalog.map((item) => <button key={item.id} className={selectedExperiment.id === item.id ? "active" : ""} type="button" onClick={() => setSelectedExperimentId(item.id)} style={{ "--flow-accent": item.accent } as React.CSSProperties}><i><FlaskConical size={17} /></i><span><small>{item.field}</small><b>{item.title}</b><em>{item.formula}</em></span></button>)}</div><Link to={selectedExperiment.path} target="_blank">预览学生实验 <ExternalLink size={14} /></Link></section>
      <section className="teacher-flow-lessons"><header><span>REAL LESSON LIBRARY</span><h3>后台课例库</h3><button type="button" onClick={() => setShowLesson(true)}>新增课例 <ArrowRight size={13} /></button></header><div>{lessons.map((lesson) => { const item = teacherExperimentCatalog.find((entry) => entry.id === lesson.experimentId); return <article key={lesson.id} className={selectedLessonId === lesson.id ? "is-selected" : ""} onClick={() => setSelectedLessonId(lesson.id)}><i style={{ background: item?.accent ?? "#78ddff" }} /><span><small>{item?.field ?? lesson.experimentId} · {lesson.durationMinutes} MIN</small><b>{lesson.title}</b><p>{lesson.inquiryQuestion}</p></span><em>{lesson.status === "ready" ? "READY" : lesson.status.toUpperCase()}</em></article>; })}{!lessons.length && <p className="teacher-flow-empty">还没有真实课例。先选择一个实验模板创建课例。</p>}</div></section>
    </div>
    <section className="teacher-task-board"><header><div><span>CLASS DELIVERY BOARD</span><h3>已发布教学任务</h3></div><button className="teacher-button primary" type="button" onClick={() => setShowPublish(true)} disabled={!readyLessons.length || !classes.length}><CirclePlay size={15} />发布新任务</button></header><div>{tasks.map((task) => <article key={task.id}><i className={`is-${task.status}`} /><span><small>{modeNames[task.mode]} · {task.className}</small><b>{task.title}</b><em>{task.lessonTitle}</em></span><div><strong className={`is-${task.status}`}>{statusNames[task.status]}</strong><small>{task.dueAt ? `截止 ${task.dueAt.replace("T", " ")}` : "不设截止时间"}</small></div>{task.status !== "archived" && <button type="button" disabled={Boolean(busy)} onClick={() => void perform(`task-${task.id}`, () => teacherApi.updateTaskStatus(task.id, nextStatus(task.status)), `任务状态已更新为${statusNames[nextStatus(task.status)]}`)}>{busy === `task-${task.id}` ? <LoaderCircle size={13} className="is-spinning" /> : null}{task.status === "draft" ? "发布" : task.status === "published" ? "关闭" : "归档"}</button>}</article>)}{!tasks.length && <p className="teacher-flow-empty">还没有班级任务。创建课例后即可发布。</p>}</div></section>

    {showLesson && <div className="teacher-backend-login-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setShowLesson(false)}><form className="teacher-backend-login teacher-real-lesson-form" onSubmit={createLesson}><header><div><span>NEW LESSON BLUEPRINT</span><h2>创建真实实验课例</h2><p>{selectedExperiment.field} · {selectedExperiment.title} · {selectedExperiment.formula}</p></div><button type="button" onClick={() => setShowLesson(false)}><X size={18} /></button></header><label><span>课例标题</span><input name="title" defaultValue={`${selectedExperiment.title}探究课`} required /></label><div className="teacher-real-form-columns"><label><span>课堂时长</span><select name="durationMinutes" defaultValue="40"><option value="20">20 分钟</option><option value="35">35 分钟</option><option value="40">40 分钟</option><option value="45">45 分钟</option></select></label><label><span>课例状态</span><input value="准备就绪" disabled /></label></div><label><span>学习目标</span><textarea name="objective" defaultValue="通过改变一个关键变量、记录多组现象，用自己的证据形成物理解释。" required /></label><label><span>核心探究问题</span><textarea name="inquiryQuestion" defaultValue={`改变实验条件时，${selectedExperiment.title}中的关键现象会怎样变化？`} required /></label><label><span>作出预测</span><input name="predictionPrompt" defaultValue="操作前写下预测，并说明判断依据。" /></label><label><span>变量控制</span><input name="controlledVariable" defaultValue="固定其他条件，每轮只改变一个关键变量。" /></label><label><span>证据要求</span><input name="evidenceRequirement" defaultValue="记录至少三组可比较的数据或现象。" /></label><label><span>迁移反思</span><input name="reflectionPrompt" defaultValue="换一个情境或设置反例，形成的解释仍然成立吗？" /></label><button className="teacher-button primary wide" type="submit" disabled={busy === "lesson"}>{busy === "lesson" ? <LoaderCircle size={15} className="is-spinning" /> : <ClipboardCheck size={15} />}保存到真实课例库</button></form></div>}

    {showPublish && <div className="teacher-backend-login-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setShowPublish(false)}><form className="teacher-backend-login teacher-publish-task-form" onSubmit={publishTask}><header><div><span>PUBLISH CLASS MISSION</span><h2>发布实验任务</h2><p>学生登录后，会在个人任务舱看到这项实验。</p></div><button type="button" onClick={() => setShowPublish(false)}><X size={18} /></button></header><label><span>选择课例</span><select name="lessonId" value={selectedLessonId || readyLessons[0]?.id || ""} onChange={(event) => setSelectedLessonId(event.target.value)} required>{readyLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label><label><span>发布班级</span><select name="classId" required>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>任务标题</span><input name="title" defaultValue={readyLessons.find((lesson) => lesson.id === selectedLessonId)?.title ?? readyLessons[0]?.title ?? "实验探究任务"} required /></label><label><span>教学阶段</span><select name="mode" defaultValue="in-class"><option value="before-class">课前探究</option><option value="in-class">课堂实验</option><option value="after-class">课后反思</option></select></label><div className="teacher-real-form-columns"><label><span><Clock3 size={13} />开放时间</span><input name="opensAt" type="datetime-local" /></label><label><span><Clock3 size={13} />截止时间</span><input name="dueAt" type="datetime-local" /></label></div><button className="teacher-button primary wide" type="submit" disabled={busy === "publish"}>{busy === "publish" ? <LoaderCircle size={15} className="is-spinning" /> : <Send size={15} />}发布给真实班级</button></form></div>}
  </div>;
}
