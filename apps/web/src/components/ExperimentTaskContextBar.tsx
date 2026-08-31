import type { TeachingTask } from "@physics-lab/contracts";
import { BookOpenCheck, Check, ChevronDown, ChevronUp, ClipboardCheck, FlaskConical, Lightbulb, Radio, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { studentApi } from "../services/teacherApi";
import { activeStudentSession } from "../services/studentSessionSync";
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

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search);
    const activeSession = activeStudentSession();
    const taskId = params.get("taskId") ?? activeSession?.taskId;
    const pathByExperiment: Record<string, string> = { light: "/student/explore/light", lens: "/lab/lens", mechanics: "/student/explore/mechanics", circuit: "/student/explore/circuit", sound: "/student/explore/sound", thermal: "/student/explore/thermal", measurement: "/student/explore/measurement" };
    const expectedPath = activeSession ? pathByExperiment[activeSession.experimentId] : undefined;
    if (!taskId || !studentApi.hasSession() || (expectedPath && location.pathname !== expectedPath)) { setTask(null); setLesson(null); return; }
    void Promise.all([studentApi.tasks(), studentApi.taskLesson(taskId)]).then(([tasks, context]) => {
      if (!active) return;
      setTask(tasks.find((item) => item.id === taskId) ?? null);
      setLesson(context);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [location.pathname, location.search]);

  if (!task || !lesson) return null;
  return <aside className={`experiment-task-context ${expanded ? "is-expanded" : ""}`} aria-label="当前班级实验任务">
    <header><i><Radio size={15} /></i><span><small>CLASS MISSION · {task.className}</small><b>{task.title}</b></span><em>过程正在保存</em><button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? "收起" : "查看任务"}</button></header>
    {expanded && <div><article><Target size={16} /><span><small>核心探究问题</small><b>{lesson.inquiryQuestion}</b></span></article><article><Lightbulb size={16} /><span><small>操作前先预测</small><b>{lesson.predictionPrompt ?? "先写下预测，并说明判断依据。"}</b></span></article><article><FlaskConical size={16} /><span><small>变量控制</small><b>{lesson.controlledVariable ?? "每轮只改变一个关键变量。"}</b></span></article><article><ClipboardCheck size={16} /><span><small>证据要求</small><b>{lesson.evidenceRequirement ?? "保存可比较的数据和观察。"}</b></span></article></div>}
    <footer><BookOpenCheck size={13} /><span>{lesson.objective}</span><em><Check size={12} />观察可在光光中保存</em></footer>
  </aside>;
}
