import type { TeachingTask } from "@physics-lab/contracts";
import { BookOpenCheck, Check, ChevronDown, ChevronUp, ClipboardCheck, FlaskConical, Lightbulb, Radio, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { studentApi } from "../../../data/teacherApi";
import { activeStudentSession } from "../../../data/studentSessionSync";
import { experimentTaskPath } from "../catalog/taskRoutes";
import "./ExperimentTaskContextBar.css";

type LessonContext = {
  title: string;
  objective: string;
  inquiryQuestion: string;
  predictionPrompt: string | null;
  controlledVariable: string | null;
  evidenceRequirement: string | null;
  reflectionPrompt: string | null;
};

export function ExperimentTaskContextBar() {
  const location = useLocation();
  const [task, setTask] = useState<TeachingTask | null>(null);
  const [lesson, setLesson] = useState<LessonContext | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [recordSessionId, setRecordSessionId] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search);
    const activeSession = activeStudentSession();
    const taskId = params.get("taskId") ?? activeSession?.taskId;
    const sessionId = params.get("sessionId") ?? activeSession?.id;
    setTask(null); setLesson(null); setRecordSessionId("");
    if (!taskId || !sessionId || !studentApi.hasSession()) return;
    void Promise.all([studentApi.tasks(), studentApi.taskLesson(taskId), studentApi.learningRecord(sessionId)]).then(([tasks, context, detail]) => {
      if (!active) return;
      const expected = new URL(experimentTaskPath(detail.session.experimentId, taskId, sessionId), "http://local");
      if (detail.session.taskId !== taskId || location.pathname !== expected.pathname || ["mode", "module"].some((key) => expected.searchParams.has(key) && expected.searchParams.get(key) !== params.get(key))) return;
      setTask(tasks.find((item) => item.id === taskId) ?? null);
      setLesson(context);
      setRecordSessionId(sessionId);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [location.pathname, location.search]);

  if (!task || !lesson) return null;
  return <aside className={`experiment-task-context ${expanded ? "is-expanded" : ""}`} aria-label="当前班级实验任务">
    <header><i><Radio size={15} /></i><span><small>CLASS MISSION · {task.className}</small><b>{task.title}</b></span><Link className="experiment-record-link" to={`/student/records/${encodeURIComponent(recordSessionId)}`}>填写实验记录</Link><button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? "收起" : "查看任务"}</button></header>
    {expanded && <div><article><Target size={16} /><span><small>核心探究问题</small><b>{lesson.inquiryQuestion}</b></span></article><article><Lightbulb size={16} /><span><small>操作前先预测</small><b>{lesson.predictionPrompt ?? "先写下预测，并说明判断依据。"}</b></span></article><article><FlaskConical size={16} /><span><small>变量控制</small><b>{lesson.controlledVariable ?? "每轮只改变一个关键变量。"}</b></span></article><article><ClipboardCheck size={16} /><span><small>证据要求</small><b>{lesson.evidenceRequirement ?? "保存可比较的数据和观察。"}</b></span></article></div>}
    <footer><BookOpenCheck size={13} /><span>{lesson.objective}</span><em><Check size={12} />观察可在光光中保存</em></footer>
  </aside>;
}
