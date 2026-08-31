import { FormEvent, useMemo, useState } from "react";
import { Activity, BookOpenCheck, Bot, Check, ChevronDown, Lightbulb, MessageSquareText, Radio, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { OrangeCatAvatar } from "../harness/OrangeCatAvatar";
import { TeacherWorkspace, teacherExperimentCatalog } from "./teacherWorkspace";

type TeacherGuangguangProps = {
  workspace: TeacherWorkspace;
  pathname: string;
  onBroadcast: (text: string) => boolean;
};

type CopilotInsight = {
  mode: "overview" | "lesson" | "live" | "report" | "class";
  eyebrow: string;
  title: string;
  summary: string;
  evidence: string[];
  suggestion: string;
  prompt?: string;
};

type CopilotMessage = {
  id: string;
  role: "teacher" | "assistant";
  text: string;
};

const quickQuestions = ["现在最值得关注什么？", "给我一条课堂追问", "这些数据能说明什么？"];

function currentLesson(workspace: TeacherWorkspace) {
  return workspace.lessons.find((lesson) => lesson.id === workspace.liveSession?.lessonId)
    ?? workspace.lessons.find((lesson) => lesson.status === "ready")
    ?? workspace.lessons[0];
}

function buildInsight(workspace: TeacherWorkspace, pathname: string): CopilotInsight {
  const lesson = currentLesson(workspace);
  const experiment = teacherExperimentCatalog.find((item) => item.id === lesson?.experimentId);
  const classItem = workspace.classes.find((item) => item.id === lesson?.classId);

  if (pathname.includes("/live")) {
    const session = workspace.liveSession;
    if (!session || !lesson) {
      return {
        mode: "live",
        eyebrow: "LIVE COPILOT / STANDBY",
        title: "课堂信号尚未接入",
        summary: "先启动一份待课课例，我会根据学生的操作进程、记录数量和解释阶段提供介入建议。",
        evidence: [`当前有 ${workspace.lessons.filter((item) => item.status === "ready").length} 份待课课例`, "当前没有学生过程信号"],
        suggestion: "建议先确认核心探究问题，再进入课堂控制台。"
      };
    }
    const online = session.learners.filter((learner) => learner.state !== "offline");
    const recording = online.filter((learner) => learner.state === "recording").length;
    const thinking = online.filter((learner) => learner.state === "thinking").length;
    const observations = online.reduce((sum, learner) => sum + learner.observations, 0);
    const average = Math.round(online.reduce((sum, learner) => sum + learner.progress, 0) / Math.max(online.length, 1));
    let suggestion = "让学生先比较两组条件，只描述现象差异，不急着说出规律。";
    let prompt = "先不要急着下结论：请选择两组只有一个条件不同的数据，说出你观察到的差异。";
    if (online.length < session.learners.length - 2) {
      suggestion = "当前未连接人数较多，先确认设备与入口码，再推进全班任务。";
      prompt = "已经进入实验的同学先检查装置是否就绪，暂时不要改变第二个变量。";
    } else if (observations < Math.ceil(online.length / 2)) {
      suggestion = "操作已经发生，但观察记录偏少；此时最需要把现象转成证据。";
      prompt = "暂停调整参数：请把当前条件和看到的现象记录下来，再改变一个变量。";
    } else if (thinking > recording) {
      suggestion = "已有一批学生进入解释阶段，可以要求他们用具体证据支撑观点。";
      prompt = "你的解释依据是哪两组数据？请指出相同条件、不同条件和对应现象。";
    }
    return {
      mode: "live",
      eyebrow: "LIVE COPILOT / 课堂观察",
      title: `${classItem?.name ?? "当前班级"}正在探究`,
      summary: `我看到 ${online.length} 名学生在线，平均进程 ${average}%，共留下 ${observations} 条观察记录。`,
      evidence: [`${recording} 人正在记录现象`, `${thinking} 人正在形成解释`, `${session.prompts.length} 条提示已经由教师发布`],
      suggestion,
      prompt
    };
  }

  if (pathname.includes("/lessons")) {
    return {
      mode: "lesson",
      eyebrow: "LESSON COPILOT / 备课助手",
      title: lesson ? `正在关注：${lesson.title}` : "先选择一个实验场",
      summary: lesson ? `这节课的核心不是得到“${experiment?.formula ?? "公式"}”，而是让学生用可比较的现象形成解释。` : "选择实验后，我会检查问题是否可观察、变量是否可控制。",
      evidence: lesson ? [`目标班级：${classItem?.name ?? "未分配"}`, `计划时长：${lesson.duration} 分钟`, `核心问题：${lesson.inquiryQuestion}`] : ["暂无可分析课例"],
      suggestion: lesson ? "把核心问题改成能够通过两组实验条件回答的问题，并预留一次反例验证。" : "先从学生最容易观察到的变化开始，不要从公式讲解开始。"
    };
  }

  if (pathname.includes("/reports")) {
    const report = workspace.reports[0];
    return {
      mode: "report",
      eyebrow: "EVIDENCE COPILOT / 报告解读",
      title: report ? `${report.className}的课堂线索` : "等待第一份课堂报告",
      summary: report ? `参与率 ${report.participationRate}%，平均探究进程 ${report.averageProgress}%。这些指标只能描述课堂过程，不能直接代表学生能力。` : "结束一次演示课堂后，我会帮助区分事实、推测和后续教学动作。",
      evidence: report?.evidence ?? ["当前没有可读取的课堂证据"],
      suggestion: report?.followUp ?? "先完成一次课堂，再依据操作和观察记录复盘。"
    };
  }

  if (pathname.includes("/classes")) {
    const total = workspace.classes.reduce((sum, item) => sum + item.studentCount, 0);
    return {
      mode: "class",
      eyebrow: "CLASS COPILOT / 班级助手",
      title: `${workspace.classes.length} 个教学班已就绪`,
      summary: `当前演示工作区共登记 ${total} 名学生。入口码只是本地班级标识，尚未连接真实账号。`,
      evidence: workspace.classes.slice(0, 3).map((item) => `${item.name} · ${item.studentCount} 人 · ${item.joinCode}`),
      suggestion: "真实部署时应由学校组织和账号系统生成班级关系，不要长期依赖公开入口码。"
    };
  }

  const ready = workspace.lessons.filter((item) => item.status === "ready").length;
  return {
    mode: "overview",
    eyebrow: "TEACHING COPILOT / 今日观察",
    title: lesson ? `下一节：${lesson.title}` : "今天还没有待课课例",
    summary: lesson ? `${classItem?.name ?? "未分配班级"}将在${lesson.scheduledAt}进入${experiment?.field ?? "物理"}探究。` : "可以先创建一份实验课例，再由我检查探究问题。",
    evidence: [`${workspace.classes.length} 个教学班`, `${ready} 节课待进行`, `${workspace.reports.length} 份课堂报告`],
    suggestion: lesson?.inquiryQuestion ?? "从一个学生可以通过操作回答的问题开始备课。"
  };
}

function answerQuestion(question: string, workspace: TeacherWorkspace, insight: CopilotInsight): string {
  const normalized = question.trim();
  if (/追问|提示|怎么问/.test(normalized)) {
    return insight.prompt
      ? `建议追问：“${insight.prompt}” 这是基于当前课堂进程的介入建议，发布前请确认是否符合你的课堂节奏。`
      : `可以这样问：“${currentLesson(workspace)?.inquiryQuestion ?? "改变一个条件后，你观察到什么变化？"}” 再要求学生指出支持回答的两组证据。`;
  }
  if (/数据|说明|证据|报告/.test(normalized)) {
    return `${insight.summary} 目前能够确认的页面证据是：${insight.evidence.join("；")}。这些数据描述过程，不足以单独评价学生能力。`;
  }
  if (/卡住|关注|现在|进度|介入/.test(normalized)) {
    return `${insight.suggestion} 我的判断来自当前页面可见的操作进程和观察记录，不是对学生思维的直接测量。`;
  }
  if (/备课|目标|问题/.test(normalized)) {
    const lesson = currentLesson(workspace);
    return lesson
      ? `这份课例的目标是“${lesson.objective}”。建议检查三个条件：问题能否通过装置回答、是否只改变一个变量、学生是否需要留下可比较的记录。`
      : "先选择实验、班级和一个可观察的问题。光光会帮助检查变量与证据链，但不会替教师自动生成物理结论。";
  }
  return `结合当前页面，我最建议的是：${insight.suggestion} 如果你告诉我是想调整问题、课堂节奏还是报告解读，我可以进一步给出具体建议。`;
}

export function TeacherGuangguang({ workspace, pathname, onBroadcast }: TeacherGuangguangProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState("");
  const insight = useMemo(() => buildInsight(workspace, pathname), [workspace, pathname]);

  function ask(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const reply = answerQuestion(clean, workspace, insight);
    setMessages((current) => [
      ...current,
      { id: `teacher-${Date.now()}`, role: "teacher", text: clean },
      { id: `assistant-${Date.now()}-${current.length}`, role: "assistant", text: reply }
    ]);
    setQuestion("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(question);
  }

  function broadcast() {
    if (!insight.prompt) return;
    const sent = onBroadcast(insight.prompt);
    setBroadcastStatus(sent ? "已由教师确认并发布到当前课堂" : "请先启动课堂，再发布这条追问");
  }

  return (
    <>
      <button className={`teacher-guangguang-trigger ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "收起光光教学副驾" : "打开光光教学副驾"}>
        <OrangeCatAvatar mood={open ? "listening" : "idle"} compact />
        <span><small>TEACHING COPILOT</small><b>问问光光</b></span>
        <i>{open ? <X size={17} /> : <Sparkles size={17} />}</i>
      </button>

      <aside className={`teacher-guangguang-panel ${open ? "is-open" : ""}`} aria-hidden={!open} inert={!open} role="dialog" aria-modal="true" aria-label="光光教学副驾">
        <header className="teacher-guangguang-header">
          <div className="teacher-guangguang-avatar"><OrangeCatAvatar mood="listening" /></div>
          <div><span>GUANGGUANG / T-COPILOT</span><h2>光光教学副驾</h2><p><i />规则诊断在线 · 本地模式</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="关闭光光教学副驾"><X size={19} /></button>
        </header>

        <div className="teacher-guangguang-boundary"><ShieldCheck size={15} /><p><strong>辅助边界</strong> 光光引用当前页面证据提出建议，不代替教师评价，也不改变物理模型结果。</p></div>

        <section className={`teacher-guangguang-insight mode-${insight.mode}`}>
          <button className="teacher-guangguang-insight-head" type="button" onClick={() => setExpanded((value) => !value)}>
            <span><small>{insight.eyebrow}</small><b>{insight.title}</b></span><ChevronDown size={17} className={expanded ? "is-rotated" : ""} />
          </button>
          {expanded && <div className="teacher-guangguang-insight-body">
            <p>{insight.summary}</p>
            <div>{insight.evidence.map((item) => <span key={item}><i />{item}</span>)}</div>
            <blockquote><Lightbulb size={16} /><span><small>光光建议</small>{insight.suggestion}</span></blockquote>
            {insight.prompt && <div className="teacher-guangguang-broadcast"><span><Radio size={14} />推荐课堂追问</span><p>{insight.prompt}</p><button type="button" onClick={broadcast}><Send size={14} />教师确认并发布</button>{broadcastStatus && <small><Check size={12} />{broadcastStatus}</small>}</div>}
          </div>}
        </section>

        <section className="teacher-guangguang-dialogue">
          <header><MessageSquareText size={15} /><span><b>和光光讨论</b><small>只基于当前本地工作区回答</small></span></header>
          <div className="teacher-guangguang-chips">{quickQuestions.map((item) => <button key={item} type="button" onClick={() => ask(item)}>{item}</button>)}</div>
          <div className="teacher-guangguang-messages">
            {!messages.length && <div className="teacher-guangguang-welcome"><Bot size={19} /><p>老师好，我已经读取当前页面的教学信息。你可以问我现在该关注什么，或让我给一条课堂追问。</p></div>}
            {messages.map((message) => <article key={message.id} className={`role-${message.role}`}>{message.role === "assistant" && <OrangeCatAvatar mood="speaking" compact />}<div><span>{message.role === "teacher" ? "我" : "光光"}</span><p>{message.text}</p></div></article>)}
          </div>
          <form onSubmit={submit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="问光光：这节课什么时候适合介入？" /><button type="submit" aria-label="发送问题"><Send size={17} /></button></form>
        </section>

        <footer><Activity size={13} /><span>依据：课例、课堂进程、观察记录与报告数据</span><em>RULE-BASED</em></footer>
      </aside>
      {open && <button className="teacher-guangguang-scrim" type="button" onClick={() => setOpen(false)} aria-label="关闭光光教学副驾" />}
    </>
  );
}
