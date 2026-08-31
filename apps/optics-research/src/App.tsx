import { useEffect, useMemo, useState } from "react";
import {
  getHarnessConceptNode,
  reviewHarnessEvidenceText,
  reviewHarnessReasoningText
} from "@physics-lab/harness";
import { OpticsLab } from "./OpticsLabs";
import {
  TASKS,
  createResearchSession,
  taskById,
  type LabTrial,
  type ResearchSession,
  type TaskId,
  type TaskProgress
} from "./researchModel";
import {
  clearResearchSession,
  exportResearchCsv,
  exportResearchJson,
  loadResearchSession,
  saveResearchSession
} from "./researchStorage";
import { comparisonChecklist } from "./researchEvidence";

type WorkspaceView = "experiment" | "dashboard" | "protocol";

const stageLabels = [
  { id: "predict", code: "P", label: "预测" },
  { id: "observe", code: "O", label: "观察" },
  { id: "explain", code: "E", label: "解释" },
  { id: "transfer", code: "T", label: "迁移" }
] as const;

type TeachingTarget = "scene" | "controls" | "evidence" | "gate";

const TEACHING_FLOWS: Record<TaskId, Array<{ code: string; title: string; body: string; action: string; target: TeachingTarget }>> = {
  reflection: [
    { code: "01", title: "先认清测量基准", body: "镜面中央的虚线是法线，角度必须从法线开始测量。黄色是入射光，蓝色是反射光。", action: "在光路图中找到法线和入射点", target: "scene" },
    { code: "02", title: "亲手改变入射角", body: "拖动黄色光源，不要只看数值。观察入射光、反射光和量角器是否同时变化。", action: "尝试 20°、45° 或 70°", target: "controls" },
    { code: "03", title: "一次只改变一个条件", body: "保持镜面不变，至少选择三组不同入射角，分别捕获证据帧。", action: "形成三组角度对照", target: "evidence" },
    { code: "04", title: "用证据寻找不变量", body: "比较每一帧的入射角和反射角，不要凭单次结果直接下结论。", action: "检查证据门是否全部点亮", target: "gate" }
  ],
  bench: [
    { code: "01", title: "认识光具座坐标", body: "蜡烛、凸透镜和光屏位于同一主光轴。F 与 2F 是判断成像区间的关键位置。", action: "先在场景中找到 F 和 2F", target: "scene" },
    { code: "02", title: "拖动两个实验部件", body: "拖动蜡烛改变物距，再拖动光屏寻找清晰位置。上方清晰度仪表会实时反馈。", action: "让 FOCUS 进入锁定状态", target: "controls" },
    { code: "03", title: "跨越三个成像区域", body: "分别让物体处在焦内、F 与 2F 之间、2F 以外，记录像的虚实、大小与正倒。", action: "至少保存三个区域的证据", target: "evidence" },
    { code: "04", title: "从对照中概括规律", body: "重点比较物距跨过 F 和 2F 时，像的性质发生了什么变化。", action: "完成区域对照与一次清晰成像", target: "gate" }
  ],
  dispersion: [
    { code: "01", title: "识别光谱分析台", body: "左侧是光源，中间是三棱镜，右侧光屏负责接收不同波段的落点。", action: "沿光线方向读完整条光路", target: "scene" },
    { code: "02", title: "旋转棱镜并移动光屏", body: "拖动棱镜上方把手改变入射姿态，拖动光屏底座改变传播距离。", action: "观察光谱展宽实时变化", target: "controls" },
    { code: "03", title: "建立复色与单色对照", body: "先记录白光，再切换红色单光。RGB 合光可作为扩展比较，但不能代替关键对照。", action: "分别捕获白光和红光", target: "evidence" },
    { code: "04", title: "解释颜色来自哪里", body: "比较落点数量与色带宽度，判断三棱镜是产生了新颜色，还是把原有成分分开。", action: "点亮白光、红光和落点比较", target: "gate" }
  ],
  correction: [
    { code: "01", title: "先做焦点诊断", body: "红色竖线代表视网膜。先不加镜片，判断焦点位于视网膜前还是后。", action: "读取基线焦点偏差", target: "scene" },
    { code: "02", title: "像验光师一样试戴", body: "点击镜片，或把凹、凸透镜拖入试戴槽。观察光路和像面如何移动。", action: "让 RETINA LOCK 点亮", target: "controls" },
    { code: "03", title: "保留反例证据", body: "无镜片、正确镜片和错误镜片都要记录，错误结果同样是有价值的证据。", action: "保存三种处方状态", target: "evidence" },
    { code: "04", title: "从光路说明处方", body: "不要只背“近视戴凹透镜”。要说明镜片先怎样改变光线，以及焦点为何回到视网膜。", action: "完成基线、凹透镜和凸透镜对照", target: "gate" }
  ]
};

function nowId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function CatMark() {
  return (
    <svg className="cat-mark" viewBox="0 0 96 96" aria-hidden="true">
      <defs><linearGradient id="cat-fur" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#ffc75c"/><stop offset="1" stopColor="#f27b4f"/></linearGradient></defs>
      <path fill="url(#cat-fur)" d="M18 36L13 9l24 15a48 48 0 0 1 23 0L83 9l-5 28c7 7 10 16 9 27-1 20-17 29-39 29S10 84 9 64c-1-11 2-20 9-28Z"/>
      <path fill="#fff1d4" d="M26 64c7-9 15-13 22-7 8-6 16-2 23 7-1 15-11 22-23 22S27 79 26 64Z"/>
      <path fill="#173643" d="M26 45c0-5 7-5 7 0s-7 5-7 0Zm37 0c0-5 7-5 7 0s-7 5-7 0Z"/>
      <path fill="#c75447" d="M43 58h10l-5 6Z"/><path fill="none" stroke="#173643" strokeLinecap="round" strokeWidth="2" d="M48 64c-2 5-8 5-10 2m10-2c2 5 8 5 10 2M15 60H2m16 8H5m76-8h13m-16 8h13"/>
      <path fill="none" stroke="#fff1d4" strokeLinecap="round" strokeWidth="4" d="M23 29l-3-11m53 11 3-11"/>
    </svg>
  );
}

function StartScreen({ onStart }: { onStart: (participantId: string) => void }) {
  const [participantId, setParticipantId] = useState(`S-${String(Math.floor(Math.random() * 900) + 100)}`);
  const [consent, setConsent] = useState(false);
  return (
    <main className="start-screen">
      <div className="start-atmosphere"><i/><i/><i/></div>
      <section className="start-copy">
        <div className="eyebrow"><span>OPTICS · EVIDENCE · STUDIO</span><b>论文研究版 0.1</b></div>
        <h1>不先给答案，<br/><em>先让光成为证据。</em></h1>
        <p>“光光”智能学习助手支持的初中光学虚拟实验。以 POE 为学习路径，以证据中心设计记录每一次预测、操作、解释与迁移。</p>
        <div className="theory-ribbon"><span><b>P</b> Predict 预测</span><span><b>O</b> Observe 观察</span><span><b>E</b> Explain 解释</span><span><b>ECD</b> 证据中心评价</span></div>
      </section>
      <section className="start-card">
        <div className="start-cat"><CatMark/><div><span>LEARNING AGENT</span><strong>光光已就位</strong><p>我会读取实验状态，但不会替你完成思考。</p></div></div>
        <label className="participant-field"><span>匿名研究编号</span><input value={participantId} maxLength={20} onChange={(event) => setParticipantId(event.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}/><small>不填写姓名、学号、手机号等真实身份信息</small></label>
        <label className="consent-line"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/><span>我了解本研究版会在本机记录匿名答题与操作数据，用于学习分析。</span></label>
        <button className="primary-action" disabled={!consent || participantId.length < 2} onClick={() => onStart(participantId)}><span>进入光学证据舱</span><b>→</b></button>
        <small className="local-note">LOCAL FIRST · 数据默认仅保存在本机浏览器</small>
      </section>
    </main>
  );
}

function StageRail({ progress }: { progress: TaskProgress }) {
  const currentIndex = progress.stage === "complete"
    ? 4
    : progress.stage === "reconsider" || progress.stage === "explain"
      ? 2
      : stageLabels.findIndex((stage) => stage.id === progress.stage);
  return (
    <div className="stage-rail">
      {stageLabels.map((stage, index) => <div key={stage.id} className={index < currentIndex ? "done" : index === currentIndex ? "active" : ""}><b>{index < currentIndex ? "✓" : stage.code}</b><span>{stage.label}</span><i/></div>)}
    </div>
  );
}

function TaskNavigation({ session, onSelect }: { session: ResearchSession; onSelect: (id: TaskId) => void }) {
  return (
    <nav className="task-navigation" aria-label="光学研究任务">
      <header><span>RESEARCH TASKS</span><strong>光学任务组</strong></header>
      {TASKS.map((task) => {
        const progress = session.tasks[task.id];
        return <button key={task.id} className={`${task.id === session.activeTask ? "active" : ""} accent-${task.accent}`} onClick={() => onSelect(task.id)}><span>{task.index}</span><div><strong>{task.title}</strong><small>{progress.stage === "complete" ? "已形成完整证据链" : task.subtitle}</small></div><i>{progress.stage === "complete" ? "✓" : progress.stage === "predict" ? "○" : "·"}</i></button>;
      })}
      <footer><span>匿名编号</span><strong>{session.participantId}</strong><small>记录仅保存在当前设备</small></footer>
    </nav>
  );
}

function EcdTaskMap({ taskId }: { taskId: TaskId }) {
  const task = taskById(taskId);
  return (
    <details className="ecd-task-map">
      <summary><span>ECD · 本任务证据地图</span><strong>学习主张与可观察证据</strong><b>＋</b></summary>
      <div><article><span>CLAIM</span><p>{task.claim}</p></article><article><span>EVIDENCE</span><div>{task.evidenceIndicators.map((indicator, index) => <p key={indicator}><b>{String(index + 1).padStart(2, "0")}</b>{indicator}</p>)}</div></article><article><span>TASK</span><p>{task.observationGoal} 完成后还需通过迁移题检验，不能只依据一次正确选择作出能力判断。</p></article></div>
    </details>
  );
}

function GuangguangCoach({ taskId, progress, onUseHint }: { taskId: TaskId; progress: TaskProgress; onUseHint: () => void }) {
  const task = taskById(taskId);
  const concept = getHarnessConceptNode(task.module);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const evidenceReview = reviewHarnessEvidenceText(progress.explanation);
  const checks = comparisonChecklist(taskId, progress.trials);
  const comparisonReady = checks.every((check) => check.passed);
  const maxHintLevel = progress.stage === "observe"
    ? progress.trials.length === 0 ? 1 : comparisonReady ? 3 : 2
    : progress.stage === "reconsider" || progress.stage === "explain" ? 3 : 0;
  const activeHint = progress.hintsUsed > 0 && !["transfer", "complete"].includes(progress.stage)
    ? concept?.hintLadder[Math.min(progress.hintsUsed, 3) - 1]
    : undefined;
  const selected = task.predictionOptions.find((option) => option.id === progress.prediction);

  let message = "先独立完成预测。你的选择会被保存，但我暂时不会公布答案。";
  if (progress.stage === "observe") {
    const missing = checks.filter((check) => !check.passed).map((check) => check.label);
    message = comparisonReady
      ? "关键对照已经形成。现在请比较实验现象与最初预测是否一致。"
      : `我已读取 ${progress.trials.length} 组记录，但还缺：${missing.join("、")}。数量本身不能代替有效对照。`;
    if (progress.predictionCorrect === false && selected?.misconception) message += ` 你的初始选择可能包含“${selected.misconception}”，请用装置证据核验。`;
  }
  if (progress.stage === "reconsider") message = "先不要急着写最终结论。请明确实验现象与原预测是符合、冲突还是暂时不能判断，然后重新作答并说明哪一组证据改变了你的判断。";
  if (progress.stage === "explain") message = progress.explanation.trim() ? evidenceReview.feedback : "不要只写结论。请同时写出实验条件、读数或现象、组间比较和由此得到的判断。";
  if (progress.stage === "transfer") message = "现在不再显示原题提示。请把刚才建立的规律迁移到新情境。";
  if (progress.stage === "complete") message = progress.transferCorrect ? "这条证据链已经闭合：你完成了预测、实验、解释和迁移。" : "流程已经完成，但迁移题仍暴露出概念边界，可以回到实验重新核验。";

  function ask(prompt = question) {
    const input = prompt.trim();
    if (!input) return;
    if (progress.stage === "predict") setAnswer("这是未受提示的初始预测阶段。我暂不提供概念线索，请写下你现在的理由和信心程度；提交后再用实验检验。");
    else if (progress.stage === "transfer") setAnswer("迁移题用于形成独立评价证据，本阶段不提供答案或内容提示。请调用刚才形成的规律自行判断。");
    else if (/(答案|选哪个|直接告诉)/.test(input)) setAnswer(`我不会直接公布答案。${concept?.hintLadder[Math.max(0, Math.min(maxHintLevel, 3) - 1)] ?? "先从当前装置的直接现象开始。"}`);
    else if (/(读数|现在|当前|刚才|装置)/.test(input) && progress.trials.at(-1)) setAnswer(`我读取到最近一组装置记录：${progress.trials.at(-1)!.summary}。这是一组现象，还需要与另一组条件形成比较。`);
    else if (/(下一步|怎么做|操作)/.test(input)) setAnswer(progress.stage === "observe" ? task.observationGoal : `当前处于“${progress.stage}”阶段，请先完成页面中央的本阶段任务。`);
    else if (/(证据|怎么写|解释)/.test(input)) setAnswer("使用“保持……不变，把……从……调到……；观察到……；相比……；因此……”组织证据，不要只写背诵结论。");
    else setAnswer(`这个问题可以回到核心探究：“${concept?.inquiryQuestion ?? task.observationGoal}”先指出你准备改变的条件和要观察的量。`);
    setQuestion("");
  }

  return (
    <aside className="coach-panel">
      <header><div className="coach-avatar"><CatMark/><i/></div><div><span>GUANGGUANG · STATE AWARE</span><strong>光光实验教练</strong></div><b className="online-dot">在线</b></header>
      <div className="coach-scan"><i/><span><small>APPARATUS SCAN</small><b>已同步 {progress.trials.length} 组装置证据</b></span><strong>{progress.stage.toUpperCase()}</strong></div>
      <div className="coach-message" aria-live="polite"><span>当前判断</span><p>{message}</p></div>
      {activeHint && <div className="active-hint"><span>HINT L{Math.min(progress.hintsUsed, 3)}</span><p>{activeHint}</p></div>}
      <button className="hint-button" disabled={maxHintLevel === 0 || progress.hintsUsed >= maxHintLevel} onClick={onUseHint}><span>{maxHintLevel === 0 ? progress.stage === "predict" ? "预测阶段暂不提示" : "独立评价阶段" : progress.hintsUsed < maxHintLevel ? progress.hintsUsed === 0 ? "需要一点提示" : "再具体一点" : "先生成新的装置证据"}</span><b>{progress.hintsUsed}/{maxHintLevel}</b></button>
      <nav className="coach-quick-actions" aria-label="光光快捷提问"><button onClick={() => ask("下一步怎么操作")}>下一步怎么做</button><button onClick={() => ask("帮我检查证据")}>检查证据</button><button onClick={() => ask("如何组织解释")}>组织解释</button></nav>
      <div className="coach-chat">
        {answer && <p><b>光光</b>{answer}</p>}
        <div><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && ask()} placeholder="问装置、证据或下一步…"/><button onClick={() => ask()} aria-label="发送问题">↑</button></div>
      </div>
      <footer><span>本轮提示调用</span><strong>{progress.hintsUsed}</strong><small>提示使用将进入匿名研究记录</small></footer>
    </aside>
  );
}

function ConfidenceScale({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="confidence-scale">
      <div><span>{label}</span><strong>{value}/5</strong></div>
      <div>{[1, 2, 3, 4, 5].map((score) => <button key={score} className={value === score ? "active" : ""} onClick={() => onChange(score)}><b>{score}</b><span>{score === 1 ? "很不确定" : score === 5 ? "非常确定" : ""}</span></button>)}</div>
    </div>
  );
}

function PredictionStage({ taskId, progress, onSubmit }: { taskId: TaskId; progress: TaskProgress; onSubmit: (choice: string, reason: string, confidence: number) => void }) {
  const task = taskById(taskId);
  const [choice, setChoice] = useState(progress.prediction ?? "");
  const [reason, setReason] = useState(progress.predictionReason);
  const [confidence, setConfidence] = useState(progress.initialConfidence);
  const ready = Boolean(choice) && reason.trim().length >= 12;
  return (
    <section className="stage-card prediction-stage">
      <div className="stage-heading"><span>01 · PREDICT</span><h2>先暴露自己的真实想法</h2><p>{task.predictionContext}</p></div>
      <div className="question-card"><span>诊断题</span><h3>{task.predictionPrompt}</h3><div className="option-grid">{task.predictionOptions.map((option, index) => <button key={option.id} className={choice === option.id ? "selected" : ""} onClick={() => setChoice(option.id)}><b>{String.fromCharCode(65 + index)}</b><span>{option.label}</span><i>{choice === option.id ? "●" : "○"}</i></button>)}</div></div>
      <div className="prediction-reason"><label><span>预测理由</span><small>至少12个字 · 提交后保留原文</small></label><textarea value={reason} maxLength={240} onChange={(event) => setReason(event.target.value)} placeholder="我这样判断是因为……（不要只重复选项）"/></div>
      <ConfidenceScale value={confidence} onChange={setConfidence} label="对这个预测有多大把握？" />
      <button className="primary-action compact" disabled={!ready} onClick={() => onSubmit(choice, reason.trim(), confidence)}><span>封存预测并进入实验</span><b>→</b></button>
    </section>
  );
}

function TeachingIntroModal({ taskId, onStart, onSkip }: { taskId: TaskId; onStart: () => void; onSkip: () => void }) {
  const task = taskById(taskId);
  const flow = TEACHING_FLOWS[taskId];
  return <div className="teaching-modal-backdrop" role="presentation">
    <section className={`teaching-modal accent-${task.accent}`} role="dialog" aria-modal="true" aria-labelledby="teaching-title">
      <div className="teaching-orbit" aria-hidden="true"><i/><i/><i/><div><CatMark/></div></div>
      <div className="teaching-modal-copy">
        <span>GUANGGUANG · GUIDED LAB</span>
        <h2 id="teaching-title">光光带你完成<br/><em>{task.title}</em></h2>
        <p>这不是播放式教程。光光会分四步带你认识装置、亲手操作、建立对照，并把关键现象保存成论文研究需要的证据。</p>
        <div className="teaching-route">{flow.map((item, index) => <article key={item.code}><b>{item.code}</b><span>{item.title}</span>{index < flow.length - 1 && <i>→</i>}</article>)}</div>
        <div className="teaching-modal-actions"><button onClick={onSkip}>先自由探索</button><button onClick={onStart}><span>开始四步教学</span><b>→</b></button></div>
        <small>教学只在观察阶段出现，不会影响实验前的独立预测。</small>
      </div>
      <button className="teaching-close" onClick={onSkip} aria-label="关闭教学弹窗">×</button>
    </section>
  </div>;
}

function TeachingDock({ taskId, step, onStep, onClose }: { taskId: TaskId; step: number; onStep: (step: number) => void; onClose: () => void }) {
  const flow = TEACHING_FLOWS[taskId];
  const current = flow[step]!;
  return <aside className="teaching-dock" aria-live="polite">
    <header><div className="teaching-mini-cat"><CatMark/><i/></div><div><span>光光教学过程 · {current.code}/04</span><strong>{current.title}</strong></div><button onClick={onClose} aria-label="退出教学">×</button></header>
    <div className="teaching-dock-body"><p>{current.body}</p><div><i>当前操作</i><strong>{current.action}</strong></div></div>
    <footer><nav>{flow.map((item, index) => <button key={item.code} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => onStep(index)} aria-label={`第${index + 1}步 ${item.title}`}><i>{index < step ? "✓" : index + 1}</i><span>{item.target === "scene" ? "认识" : item.target === "controls" ? "操作" : item.target === "evidence" ? "记录" : "归纳"}</span></button>)}</nav><div><button disabled={step === 0} onClick={() => onStep(step - 1)}>← 上一步</button><button onClick={() => step === flow.length - 1 ? onClose() : onStep(step + 1)}>{step === flow.length - 1 ? "完成教学 ✓" : "下一步 →"}</button></div></footer>
  </aside>;
}

function ObserveStage({ taskId, progress, onRecord, onContinue }: { taskId: TaskId; progress: TaskProgress; onRecord: (trial: Omit<LabTrial, "id" | "createdAt">) => void; onContinue: () => void }) {
  const task = taskById(taskId);
  const checks = comparisonChecklist(taskId, progress.trials);
  const enough = checks.every((check) => check.passed);
  const guideKey = `optics-research-teaching-${taskId}`;
  const [guideMode, setGuideMode] = useState<"intro" | "active" | "closed">(() => window.localStorage.getItem(guideKey) ? "closed" : "intro");
  const [guideStep, setGuideStep] = useState(0);
  useEffect(() => {
    setGuideStep(0);
    setGuideMode(window.localStorage.getItem(`optics-research-teaching-${taskId}`) ? "closed" : "intro");
  }, [taskId]);
  function closeGuide() {
    window.localStorage.setItem(guideKey, "seen");
    setGuideMode("closed");
  }
  const target = guideMode === "active" ? TEACHING_FLOWS[taskId][guideStep]!.target : undefined;
  return (
    <section className={`observe-stage ${target ? `guide-active guide-target-${target}` : ""}`}>
      {guideMode === "intro" && <TeachingIntroModal taskId={taskId} onStart={() => setGuideMode("active")} onSkip={closeGuide}/>}
      {guideMode === "active" && <TeachingDock taskId={taskId} step={guideStep} onStep={setGuideStep} onClose={closeGuide}/>}
      <div className="stage-heading inline"><div><span>02 · OBSERVE</span><h2>让装置生成可比较的证据</h2></div><p>{task.observationGoal}</p><button className="guide-launch" onClick={() => { setGuideStep(0); setGuideMode("intro"); }}><i>✦</i><span><b>光光教学</b><small>重新打开四步引导</small></span></button></div>
      <OpticsLab taskId={taskId} trials={progress.trials} onRecord={onRecord}/>
      <div className={`evidence-gate ${enough ? "ready" : ""}`}><div><span>{checks.filter((check) => check.passed).length}/{checks.length}</span><p><strong>{enough ? "关键对照已经形成" : "关键对照尚不完整"}</strong>{enough ? "可以比较现象与最初预测，不需要继续凑记录数量。" : "ECD关注证据是否支持学习主张，不把点击次数直接当成能力。"}</p></div><div className="comparison-checks">{checks.map((check) => <span key={check.id} className={check.passed ? "passed" : ""}><i>{check.passed ? "✓" : "·"}</i>{check.label}</span>)}</div><button disabled={!enough} onClick={onContinue}>比较预测与现象 <b>→</b></button></div>
    </section>
  );
}

function ReconsiderStage({ taskId, progress, onSubmit }: { taskId: TaskId; progress: TaskProgress; onSubmit: (input: { conflict: "match" | "conflict" | "uncertain"; choice: string; confidence: number; reason: string }) => void }) {
  const task = taskById(taskId);
  const initialOption = task.predictionOptions.find((option) => option.id === progress.prediction);
  const [conflict, setConflict] = useState<"match" | "conflict" | "uncertain" | "">(progress.observationConflict ?? "");
  const [choice, setChoice] = useState(progress.revisedPrediction ?? progress.prediction ?? "");
  const [confidence, setConfidence] = useState(progress.revisedConfidence ?? progress.initialConfidence);
  const [reason, setReason] = useState(progress.revisionReason);
  const ready = Boolean(conflict && choice && reason.trim().length >= 18);
  return (
    <section className="stage-card reconsider-stage">
      <div className="stage-heading"><span>03A · RECONSIDER</span><h2>让预测与现象正面相遇</h2><p>原预测保持封存。现在根据刚才形成的关键对照重新判断，并指出是哪一组装置证据支持你。</p></div>
      <div className="sealed-prediction"><span>实验前预测</span><strong>{initialOption?.label ?? "未记录"}</strong><p>“{progress.predictionReason}”</p><i>初始信心 {progress.initialConfidence}/5</i></div>
      <div className="conflict-check"><label>实验现象与原预测的关系</label><div><button className={conflict === "match" ? "active" : ""} onClick={() => setConflict("match")}><b>≈</b><span>基本符合</span></button><button className={conflict === "conflict" ? "active" : ""} onClick={() => setConflict("conflict")}><b>≠</b><span>出现冲突</span></button><button className={conflict === "uncertain" ? "active" : ""} onClick={() => setConflict("uncertain")}><b>?</b><span>仍不能判断</span></button></div></div>
      <div className="question-card revision-card"><span>观察后重新作答</span><h3>{task.predictionPrompt}</h3><div className="option-grid">{task.predictionOptions.map((option, index) => <button key={option.id} className={choice === option.id ? "selected" : ""} onClick={() => setChoice(option.id)}><b>{String.fromCharCode(65 + index)}</b><span>{option.label}</span><i>{choice === option.id ? "●" : "○"}</i></button>)}</div></div>
      <div className="prediction-reason"><label><span>哪一组现象支持你现在的判断？</span><small>至少18个字 · 必须引用实验记录</small></label><textarea value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="在R__中，我把____调到____，观察到____；这与原预测____，所以我现在认为……"/></div>
      <ConfidenceScale value={confidence} onChange={setConfidence} label="观察之后，你现在有多大把握？" />
      <button className="primary-action compact" disabled={!ready} onClick={() => onSubmit({ conflict: conflict as "match" | "conflict" | "uncertain", choice, confidence, reason: reason.trim() })}><span>保存修正并组织解释</span><b>→</b></button>
    </section>
  );
}

function ExplainStage({ taskId, progress, onChange, onSubmit }: { taskId: TaskId; progress: TaskProgress; onChange: (value: string) => void; onSubmit: () => void }) {
  const task = taskById(taskId);
  const evidence = reviewHarnessEvidenceText(progress.explanation);
  const reasoning = reviewHarnessReasoningText(progress.explanation);
  const ready = progress.explanation.trim().length >= 28 && evidence.score >= 2;
  return (
    <section className="stage-card explain-stage">
      <div className="stage-heading"><span>03 · EXPLAIN</span><h2>把现象组织成证据链</h2><p>{task.evidencePrompt}</p></div>
      <div className="explain-layout">
        <div className="evidence-editor"><label>我的证据解释 <span>{progress.explanation.length}/500</span></label><textarea maxLength={500} value={progress.explanation} onChange={(event) => onChange(event.target.value)} placeholder="保持____不变，把____从____调到____；我观察到____。与另一组相比____，因此这组证据支持____。"/><div className="record-reference">{progress.trials.map((trial, index) => <p key={trial.id}><b>R{String(index + 1).padStart(2, "0")}</b>{trial.summary}</p>)}</div></div>
        <div className="evidence-rubric"><header><span>EVIDENCE RUBRIC</span><strong>{evidence.score + reasoning.score}/8</strong></header><p>{evidence.feedback}</p><div>{evidence.items.map((item) => <span key={item.id} className={item.passed ? "passed" : ""}><i>{item.passed ? "✓" : "·"}</i>{item.label}</span>)}</div><div>{reasoning.items.map((item) => <span key={item.id} className={item.passed ? "passed" : ""}><i>{item.passed ? "✓" : "·"}</i>{item.label}</span>)}</div></div>
      </div>
      <button className="primary-action compact" disabled={!ready} onClick={onSubmit}><span>提交解释并进入迁移</span><b>→</b></button>
    </section>
  );
}

function TransferStage({ taskId, onSubmit }: { taskId: TaskId; onSubmit: (choice: string) => void }) {
  const task = taskById(taskId);
  const [choice, setChoice] = useState("");
  return (
    <section className="stage-card transfer-stage">
      <div className="stage-heading"><span>04 · TRANSFER</span><h2>把规律带到新情境</h2><p>本题不重复原实验表述，用来判断概念能否迁移。</p></div>
      <div className="transfer-question"><div className="transfer-orbit"><i/><i/><b>?</b></div><div><span>迁移任务</span><h3>{task.transferPrompt}</h3><div className="option-grid compact-options">{task.transferOptions.map((option, index) => <button key={option.id} className={choice === option.id ? "selected" : ""} onClick={() => setChoice(option.id)}><b>{String.fromCharCode(65 + index)}</b><span>{option.label}</span><i>{choice === option.id ? "●" : "○"}</i></button>)}</div></div></div>
      <button className="primary-action compact" disabled={!choice} onClick={() => onSubmit(choice)}><span>提交迁移判断</span><b>→</b></button>
    </section>
  );
}

function CompletionStage({ taskId, progress, onNext }: { taskId: TaskId; progress: TaskProgress; onNext: () => void }) {
  const task = taskById(taskId);
  return (
    <section className="stage-card completion-stage">
      <div className="completion-signal"><i/><i/><strong>✓</strong></div><span>EVIDENCE CHAIN CLOSED</span><h2>{task.title} · 证据链已归档</h2><p>{progress.transferCorrect ? "迁移判断正确，说明本轮概念能够用于新的物理情境。" : "迁移判断尚未通过，但完整学习路径已经保存，可以稍后重新实验。"}</p>
      <div className="completion-stats"><article><span>实验记录</span><strong>{progress.trials.length}</strong><small>组装置证据</small></article><article><span>提示调用</span><strong>{progress.hintsUsed}</strong><small>次分层支架</small></article><article><span>证据结构</span><strong>{progress.evidenceScore}/4</strong><small>观察完整度</small></article><article><span>迁移结果</span><strong>{progress.transferCorrect ? "通过" : "待复核"}</strong><small>新情境判断</small></article></div>
      <button className="primary-action compact" onClick={onNext}><span>进入下一个研究任务</span><b>→</b></button>
    </section>
  );
}

function ResearchDashboard({ session }: { session: ResearchSession }) {
  const progresses = Object.values(session.tasks);
  const completed = progresses.filter((item) => item.stage === "complete").length;
  const trials = progresses.reduce((sum, item) => sum + item.trials.length, 0);
  const hints = progresses.reduce((sum, item) => sum + item.hintsUsed, 0);
  const scored = progresses.filter((item) => item.evidenceScore > 0);
  const evidenceMean = scored.length ? scored.reduce((sum, item) => sum + item.evidenceScore, 0) / scored.length : 0;
  const initialAnswers = progresses.filter((item) => item.prediction !== undefined);
  const initialAccuracy = initialAnswers.length ? initialAnswers.filter((item) => item.predictionCorrect).length / initialAnswers.length * 100 : 0;
  const revisedAnswers = progresses.filter((item) => item.revisedPrediction !== undefined);
  const revisedAccuracy = revisedAnswers.length ? revisedAnswers.filter((item) => item.revisedCorrect).length / revisedAnswers.length * 100 : 0;
  const correctedConcepts = progresses.filter((item) => item.predictionCorrect === false && item.revisedCorrect === true).length;
  const transfers = progresses.filter((item) => item.transfer !== undefined);
  const transferAccuracy = transfers.length ? transfers.filter((item) => item.transferCorrect).length / transfers.length * 100 : 0;
  return (
    <section className="research-dashboard">
      <div className="page-title"><span>LEARNING ANALYTICS</span><h1>个人光学证据档案</h1><p>这些指标来自真实答题和装置操作，不使用姓名等身份信息。</p></div>
      <div className="metric-grid"><article><span>任务完成</span><strong>{completed}<i>/4</i></strong><p>完整 POE 证据链</p></article><article><span>关键记录</span><strong>{trials}</strong><p>已保存装置证据</p></article><article><span>初始正确率</span><strong>{initialAccuracy.toFixed(0)}<i>%</i></strong><p>未经提示的预测</p></article><article><span>观察后正确率</span><strong>{revisedAccuracy.toFixed(0)}<i>%</i></strong><p>完成关键对照后修正</p></article><article><span>误概念修正</span><strong>{correctedConcepts}</strong><p>错误预测转为正确判断</p></article><article><span>迁移正确率</span><strong>{transferAccuracy.toFixed(0)}<i>%</i></strong><p>独立新情境表现</p></article><article><span>证据完整度</span><strong>{evidenceMean.toFixed(1)}<i>/4</i></strong><p>条件、现象、比较、精度</p></article><article><span>支架使用</span><strong>{hints}</strong><p>光光提示调用次数</p></article></div>
      <div className="task-evidence-table"><header><span>任务</span><span>初始→修正</span><span>认知冲突</span><span>关键记录</span><span>提示</span><span>证据/迁移</span></header>{TASKS.map((task) => { const progress = session.tasks[task.id]; return <div key={task.id}><span><b>{task.index}</b>{task.title}</span><span className={progress.revisedCorrect ? "good" : progress.prediction ? "warn" : ""}>{progress.prediction === undefined ? "未作答" : `${progress.predictionCorrect ? "对" : "错"} → ${progress.revisedPrediction === undefined ? "—" : progress.revisedCorrect ? "对" : "错"}`}</span><span>{progress.observationConflict === "conflict" ? "出现冲突" : progress.observationConflict === "match" ? "基本符合" : progress.observationConflict === "uncertain" ? "仍不确定" : "—"}</span><span>{progress.trials.length} 组</span><span>{progress.hintsUsed} 次</span><span className={progress.transferCorrect ? "good" : progress.transfer ? "warn" : ""}>{progress.evidenceScore}/4 · {progress.transfer === undefined ? "未迁移" : progress.transferCorrect ? "通过" : "待复核"}</span></div>; })}</div>
      <div className="export-panel"><div><span>RESEARCH EXPORT</span><strong>导出匿名研究记录</strong><p>JSON 保留完整操作结构；CSV 适合导入 Excel、SPSS 或其他统计软件。</p></div><button onClick={() => exportResearchJson(session)}>导出 JSON</button><button onClick={() => exportResearchCsv(session)}>导出 CSV</button></div>
    </section>
  );
}

function ProtocolPage() {
  return (
    <section className="protocol-page">
      <div className="page-title"><span>RESEARCH PROTOCOL</span><h1>POE × 证据中心设计</h1><p>产品不是先展示知识，而是设计能够暴露思维、生成证据并支持概念转变的任务。</p></div>
      <div className="protocol-flow"><article><b>P</b><span>Predict</span><h3>作出预测</h3><p>记录学生实验前的真实判断和可能误概念。</p></article><i>→</i><article><b>O</b><span>Observe</span><h3>形成观察</h3><p>通过改变参数、建立对照生成直接装置证据。</p></article><i>→</i><article><b>E</b><span>Explain</span><h3>证据解释</h3><p>把条件、现象、比较和物理规律连接起来。</p></article><i>→</i><article><b>T</b><span>Transfer</span><h3>完成迁移</h3><p>在新情境中检验概念是否真正形成。</p></article></div>
      <div className="ecd-grid"><article><span>01 · CLAIM</span><h3>学习主张</h3><p>学生能以法线为基准理解反射角，能依据物距与焦距判断成像，能解释色散与视力矫正。</p></article><article><span>02 · EVIDENCE</span><h3>可观察证据</h3><p>预测选择、参数操作、对照记录、解释文字、提示层级和迁移判断。</p></article><article><span>03 · TASK</span><h3>证据任务</h3><p>设计能够诱发典型误概念、又能借助装置反例进行核验的光学问题。</p></article><article><span>04 · FEEDBACK</span><h3>光光支架</h3><p>读取当前阶段和最近装置记录，按三级提示逐步支持，不直接代答。</p></article></div>
      <div className="literature-heading"><span>DESIGN EVIDENCE</span><h2>这些交互为什么这样设计</h2></div>
      <div className="literature-grid"><a href="https://doi.org/10.1080/02635143.2023.2296458" target="_blank" rel="noreferrer"><span>POE × SIMULATION</span><strong>预测必须先于观察，解释要回看预测</strong><p>因此保存预测理由和初始信心，并在观察后设置重新判断。</p><b>01 ↗</b></a><a href="https://files.eric.ed.gov/fulltext/ED483399.pdf" target="_blank" rel="noreferrer"><span>EVIDENCE-CENTERED DESIGN</span><strong>先定义学习主张，再寻找可观察证据</strong><p>因此每个任务都有主张、证据指标和关键对照，不只统计点击次数。</p><b>02 ↗</b></a><a href="https://doi.org/10.1207/s15516709cog1302_1" target="_blank" rel="noreferrer"><span>SELF-EXPLANATION</span><strong>要求学生把操作与物理原理连接起来</strong><p>因此修正答案和最终解释都必须引用装置记录。</p><b>03 ↗</b></a><a href="https://doi.org/10.1119/1.15254" target="_blank" rel="noreferrer"><span>GEOMETRICAL OPTICS</span><strong>检验能否连接光线图与真实光学系统</strong><p>因此透镜任务强调光线会聚、像面和光屏作用，而不只背口诀。</p><b>04 ↗</b></a></div>
      <div className="privacy-note"><b>研究边界</b><p>当前版本使用透明的规则和量规生成反馈，不把启发式掌握度冒充为标准化测量结果。正式论文需要由物理教师校验任务内容，并对诊断一致性进行验证。</p></div>
    </section>
  );
}

export function App() {
  const [session, setSession] = useState<ResearchSession | null>(() => loadResearchSession());
  const [view, setView] = useState<WorkspaceView>("experiment");
  const activeTask = session ? taskById(session.activeTask) : null;
  const progress = session && activeTask ? session.tasks[activeTask.id] : null;

  useEffect(() => { if (session) saveResearchSession(session); }, [session]);

  function updateProgress(taskId: TaskId, updater: (current: TaskProgress) => TaskProgress) {
    setSession((current) => current ? { ...current, updatedAt: new Date().toISOString(), tasks: { ...current.tasks, [taskId]: updater(current.tasks[taskId]) } } : current);
  }

  function selectTask(taskId: TaskId) {
    setSession((current) => current ? { ...current, activeTask: taskId, updatedAt: new Date().toISOString() } : current);
    setView("experiment");
  }

  function recordTrial(taskId: TaskId, input: Omit<LabTrial, "id" | "createdAt">) {
    if (!session) return;
    const current = session.tasks[taskId];
    const signature = JSON.stringify(input.values);
    if (current.trials.some((trial) => JSON.stringify(trial.values) === signature)) {
      window.alert("这一装置状态已经记录过。请至少改变一个实验条件，再形成新的对照证据。");
      return;
    }
    updateProgress(taskId, (progress) => ({
      ...progress,
      trials: [...progress.trials, { ...input, id: nowId("trial"), createdAt: new Date().toISOString() }]
    }));
  }

  const nextTaskId = useMemo(() => {
    if (!session) return "reflection" as TaskId;
    const index = TASKS.findIndex((task) => task.id === session.activeTask);
    return TASKS[(index + 1) % TASKS.length]!.id;
  }, [session]);

  if (!session) return <StartScreen onStart={(participantId) => setSession(createResearchSession(participantId))}/>;

  function restart() {
    if (!window.confirm("确定结束当前匿名研究会话并清除本机记录吗？导出后的文件不会被删除。")) return;
    clearResearchSession();
    setSession(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar"><div className="brand-lockup"><div className="brand-prism"><i/><i/><i/></div><div><span>OPTICS EVIDENCE STUDIO</span><strong>光学证据舱</strong></div></div><nav><button className={view === "experiment" ? "active" : ""} onClick={() => setView("experiment")}>实验工作台</button><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>研究数据</button><button className={view === "protocol" ? "active" : ""} onClick={() => setView("protocol")}>理论与方案</button></nav><div className="top-actions"><span><i/>本地记录中</span><button onClick={restart}>结束会话</button></div></header>
      <div className="workspace-grid">
        <TaskNavigation session={session} onSelect={selectTask}/>
        <main className="workspace-main">
          {view === "dashboard" ? <ResearchDashboard session={session}/> : view === "protocol" ? <ProtocolPage/> : activeTask && progress ? <>
            <header className={`experiment-header accent-${activeTask.accent}`}><div><span>EXPERIMENT {activeTask.index} / OPTICS</span><h1>{activeTask.title}</h1><p>{activeTask.subtitle}</p></div><StageRail progress={progress}/></header>
            <div className="experiment-grid"><div className="stage-workspace"><EcdTaskMap taskId={activeTask.id}/>
              {progress.stage === "predict" && <PredictionStage taskId={activeTask.id} progress={progress} onSubmit={(choice, reason, confidence) => updateProgress(activeTask.id, (current) => ({ ...current, prediction: choice, predictionCorrect: choice === activeTask.correctPrediction, predictionReason: reason, initialConfidence: confidence, stage: "observe", startedAt: current.startedAt ?? new Date().toISOString() }))}/>}
              {progress.stage === "observe" && <ObserveStage taskId={activeTask.id} progress={progress} onRecord={(input) => recordTrial(activeTask.id, input)} onContinue={() => updateProgress(activeTask.id, (current) => ({ ...current, stage: "reconsider" }))}/>}
              {progress.stage === "reconsider" && <ReconsiderStage taskId={activeTask.id} progress={progress} onSubmit={({ conflict, choice, confidence, reason }) => updateProgress(activeTask.id, (current) => ({ ...current, stage: "explain", observationConflict: conflict, revisedPrediction: choice, revisedCorrect: choice === activeTask.correctPrediction, revisedConfidence: confidence, revisionReason: reason, predictionRevised: choice !== current.prediction }))}/>}
              {progress.stage === "explain" && <ExplainStage taskId={activeTask.id} progress={progress} onChange={(value) => updateProgress(activeTask.id, (current) => ({ ...current, explanation: value }))} onSubmit={() => updateProgress(activeTask.id, (current) => ({ ...current, stage: "transfer", evidenceScore: reviewHarnessEvidenceText(current.explanation).score, reasoningScore: reviewHarnessReasoningText(current.explanation).score }))}/>}
              {progress.stage === "transfer" && <TransferStage taskId={activeTask.id} onSubmit={(choice) => updateProgress(activeTask.id, (current) => ({ ...current, stage: "complete", transfer: choice, transferCorrect: choice === activeTask.correctTransfer, completedAt: new Date().toISOString() }))}/>}
              {progress.stage === "complete" && <CompletionStage taskId={activeTask.id} progress={progress} onNext={() => selectTask(nextTaskId)}/>}
            </div><GuangguangCoach taskId={activeTask.id} progress={progress} onUseHint={() => updateProgress(activeTask.id, (current) => ({ ...current, hintsUsed: Math.min(3, current.hintsUsed + 1) }))}/></div>
          </> : null}
        </main>
      </div>
    </div>
  );
}
