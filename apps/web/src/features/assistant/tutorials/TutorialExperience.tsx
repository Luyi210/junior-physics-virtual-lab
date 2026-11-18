import { type HarnessArea, getHarnessTutorialAction } from "@physics-lab/harness";
import { useState, useRef, useEffect } from "react";
import { type ExperimentSnapshot, getLatestExperimentSnapshot, subscribeExperimentSnapshots, dispatchTutorialCommand, type TutorialTarget, type TutorialCommand } from "../tutorialBridge";
import { type StudentTaskLessonContext } from "@physics-lab/contracts";
import { useHarnessStore } from "../harnessStore";
import { guidedOpticsTutorials } from "../opticsTutorials";
import { activeStudentSession } from "../../../data/studentSessionSync";
import { studentApi } from "../../../data/teacherApi";
import { OrangeCatAvatar } from "../OrangeCatAvatar";
import { CircleCheck, PlayCircle, MoveHorizontal, Maximize2, X, ChevronLeft, PauseCircle, ChevronRight, MousePointerClick, Sparkles, Lightbulb, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { createScienceTutorialProfile, type TutorialStep, dispersionTutorialSteps, requirementMet } from "./tutorialProfiles";
import { type SpotlightTarget, TutorialSpotlight } from "./TutorialSpotlight";
import { selectTeacherChineseVoice } from "./speech";
import { eventNames } from "../labels";

export function TutorialExperience({ activeArea, activeModule, compact, side, onCompactChange, onSideChange }: { activeArea: HarnessArea; activeModule: string; compact: boolean; side: "left" | "right"; onCompactChange: (compact: boolean) => void; onSideChange: (side: "left" | "right") => void }) {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [narratorVoice, setNarratorVoice] = useState<SpeechSynthesisVoice>();
  const [speaking, setSpeaking] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [snapshot, setSnapshot] = useState<ExperimentSnapshot | undefined>(() => getLatestExperimentSnapshot("dispersion"));
  const [runVersion, setRunVersion] = useState(0);
  const [interactionGate, setInteractionGate] = useState({ stepId: "", baseline: 0 });
  const [taskContext, setTaskContext] = useState<StudentTaskLessonContext | null>(null);
  const demoTimersRef = useRef<number[]>([]);
  const tutorialSession = useHarnessStore((state) => state.session);
  const generatedProfile = !activeModule.endsWith("-overview") && activeModule !== "overview" ? createScienceTutorialProfile(activeArea, activeModule) : undefined;
  const guidedProfile = guidedOpticsTutorials[activeModule] ?? generatedProfile;
  const tutorialSteps: TutorialStep[] = activeModule === "dispersion" ? dispersionTutorialSteps : guidedProfile?.steps ?? [];
  const step = tutorialSteps[stepIndex] ?? tutorialSteps[0];
  const speechAction = getHarnessTutorialAction(step?.actions, "speech");
  const spotlightAction = getHarnessTutorialAction(step?.actions, "spotlight");
  const waitAction = getHarnessTutorialAction(step?.actions, "wait-for-event");
  const baseStepNarration = speechAction?.text ?? step?.narration ?? "";
  const stepNarration = taskContext && stepIndex === 0
    ? `你现在正在完成班级实验任务。本节课要研究：${taskContext.inquiryQuestion}。先记住证据要求：${taskContext.evidenceRequirement ?? "保存可比较的数据和观察。"}。${baseStepNarration}`
    : baseStepNarration;
  const stepTarget = (spotlightAction?.target ?? step?.target ?? "module") as SpotlightTarget;
  const stepAcceptedEvents = waitAction?.eventTypes ?? step?.acceptedEvents ?? [];
  const waitsForInteraction = Boolean(waitAction || step?.requiresInteraction);
  const eventCount = tutorialSession?.events.length ?? 0;
  const interactionBaseline = interactionGate.stepId === step?.id ? interactionGate.baseline : eventCount;
  const interactionEvents = tutorialSession?.events.slice(interactionBaseline).filter((event) => stepAcceptedEvents.includes(event.type)) ?? [];
  const latestInteraction = interactionEvents.at(-1);
  const genericInteractionSatisfied = !waitsForInteraction || interactionEvents.length >= (waitAction?.minimumCount ?? 1);
  const satisfied = activeModule === "dispersion" ? requirementMet(step?.requirement, snapshot) : genericInteractionSatisfied;
  const requiresAction = Boolean(step?.requirement || waitsForInteraction);
  const selectedAnswer = step ? answers[step.id] : undefined;
  const questionSatisfied = !step?.question || selectedAnswer === step.question.answerIndex;
  const readyToAdvance = satisfied && questionSatisfied;
  const available = activeModule === "dispersion" || Boolean(guidedProfile);

  useEffect(() => {
    let active = true;
    const activeSession = activeStudentSession();
    const taskId = new URLSearchParams(window.location.search).get("taskId") ?? activeSession?.taskId;
    const areaByExperiment: Record<string, HarnessArea> = { light: "optics", lens: "lens", mechanics: "mechanics", circuit: "circuit", sound: "sound", thermal: "thermal", measurement: "measurement" };
    if (!taskId || !studentApi.hasSession() || (activeSession && areaByExperiment[activeSession.experimentId] !== activeArea)) { setTaskContext(null); return; }
    void studentApi.taskLesson(taskId).then((context) => { if (active) setTaskContext(context); }).catch(() => { if (active) setTaskContext(null); });
    return () => { active = false; };
  }, [activeModule]);

  useEffect(() => subscribeExperimentSnapshots((next) => {
    if (next.module === "dispersion") setSnapshot(next);
  }), []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setNarratorVoice(selectTeacherChineseVoice(window.speechSynthesis.getVoices()));
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    setStarted(false);
    setStepIndex(0);
    setAutoPlay(true);
    window.speechSynthesis?.cancel();
    onCompactChange(false);
    if (activeModule === "dispersion") dispatchTutorialCommand({ type: "widget_clearHighlight", module: "dispersion" });
  }, [activeModule, onCompactChange]);

  useEffect(() => {
    if (started && (step?.question || stepIndex === tutorialSteps.length - 1) && compact) onCompactChange(false);
  }, [compact, onCompactChange, started, step, stepIndex, tutorialSteps.length]);

  useEffect(() => {
    if (!started || !waitsForInteraction || !step) return;
    setInteractionGate({ stepId: step.id, baseline: tutorialSession?.events.length ?? 0 });
  }, [started, step?.id, waitsForInteraction]);

  useEffect(() => {
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
    setDemoRunning(false);
    return () => {
      demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      demoTimersRef.current = [];
    };
  }, [stepIndex]);

  useEffect(() => {
    if (!started || !available || !step) return;
    if (activeModule === "dispersion") {
      dispatchTutorialCommand({ type: "widget_highlight", module: "dispersion", target: stepTarget as TutorialTarget });
      if (step.state) dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: step.state });
    }

    window.speechSynthesis?.cancel();
    if (!voiceEnabled || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(stepNarration);
    utterance.lang = "zh-CN";
    if (narratorVoice) utterance.voice = narratorVoice;
    // 指导老师预设：语速略慢但不拖沓，保持自然音高，避免低沉失真。
    utterance.rate = .92;
    utterance.pitch = 1.02;
    utterance.volume = .95;
    let active = true;
    utterance.onstart = () => active && setSpeaking(true);
    utterance.onend = () => active && setSpeaking(false);
    utterance.onerror = () => active && setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
    return () => {
      active = false;
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [activeModule, available, narratorVoice, runVersion, started, step, stepNarration, stepTarget, voiceEnabled]);

  useEffect(() => {
    if (!started || !autoPlay || speaking || demoRunning || !readyToAdvance || stepIndex >= tutorialSteps.length - 1) return;
    const timer = window.setTimeout(() => setStepIndex((value) => value + 1), voiceEnabled ? 1700 : 5600);
    return () => window.clearTimeout(timer);
  }, [autoPlay, demoRunning, readyToAdvance, speaking, started, stepIndex, tutorialSteps.length, voiceEnabled]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    if (activeModule === "dispersion") dispatchTutorialCommand({ type: "widget_clearHighlight", module: "dispersion" });
  }, [activeModule]);

  const begin = () => {
    setStepIndex(0);
    setAnswers({});
    setInteractionGate({ stepId: "", baseline: tutorialSession?.events.length ?? 0 });
    setDemoRunning(false);
    setStarted(true);
    setAutoPlay(true);
    onCompactChange(true);
    setRunVersion((value) => value + 1);
  };

  const stop = () => {
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
    setStarted(false);
    onCompactChange(false);
    setAutoPlay(false);
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    if (activeModule === "dispersion") dispatchTutorialCommand({ type: "widget_clearHighlight", module: "dispersion" });
  };

  const togglePlayback = () => {
    setAutoPlay((value) => {
      const next = !value;
      if (next) window.speechSynthesis?.resume();
      else window.speechSynthesis?.pause();
      return next;
    });
  };

  const replay = () => {
    window.speechSynthesis?.cancel();
    setRunVersion((value) => value + 1);
  };

  const toggleVoice = () => {
    setVoiceEnabled((value) => !value);
    setRunVersion((value) => value + 1);
  };

  const runDemonstration = () => {
    if (activeModule !== "dispersion" || !step.requirement || demoRunning) return;
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
    setDemoRunning(true);
    dispatchTutorialCommand({ type: "widget_highlight", module: "dispersion", target: stepTarget as TutorialTarget });
    const later = (delay: number, state?: Extract<TutorialCommand, { type: "widget_setState" }>["state"], finish = false) => {
      const timer = window.setTimeout(() => {
        if (state) dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state });
        if (finish) setDemoRunning(false);
      }, delay);
      demoTimersRef.current.push(timer);
    };
    if (step.requirement === "white-source-on") {
      dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: { lightMode: "white", sourceOn: false } });
      later(500, { sourceOn: true });
      later(1900, { sourceOn: false });
      later(2500, undefined, true);
    } else if (step.requirement === "prism-rotated") {
      dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: { prismAngle: 0, sourceOn: true } });
      later(500, { prismAngle: -12 });
      later(1800, { prismAngle: 12 });
      later(3100, { prismAngle: 0 });
      later(3800, undefined, true);
    } else {
      dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: { screenDistance: 250, sourceOn: true } });
      later(500, { screenDistance: 360 });
      later(2100, { screenDistance: 250 });
      later(2800, undefined, true);
    }
  };

  if (!available) {
    return <div className="harness-panel-body cat-tutorial-unavailable"><OrangeCatAvatar mood="listening" /><span>当前页面</span><h2>请先选择一个具体实验</h2><p>回到领域总览，进入任一具体实验后再打开光光；动态教程会根据当前实验加载对应的操作、证据与解释镜头。</p></div>;
  }

  if (!started) {
    return <div className="harness-panel-body cat-tutorial-cover">
      <div className={`cat-tutorial-cover-art ${activeModule === "dispersion" ? "dispersion" : "guided"}`}><span className="cat-tutorial-cover-label">{activeModule === "dispersion" ? "LIGHT LAB / 光的色散" : "GUANGGUANG LAB / 实验探究"}</span><OrangeCatAvatar mood="celebrating" /><span className="cat-prism-beam" /><span className="cat-prism-spectrum" /></div>
      <span>{taskContext ? "CLASS MISSION TUTOR · 班级任务支架" : "DYNAMIC LAB STORY · 自由探索教程"} · {activeModule === "dispersion" ? "约 4 分钟" : guidedProfile.duration}</span>
      <h2>{taskContext ? taskContext.title : activeModule === "dispersion" ? "跟着橘猫，亲手发现白光里的颜色" : guidedProfile.title}</h2>
      <p>{taskContext ? `本次任务的核心问题是：“${taskContext.inquiryQuestion}”光光会用当前装置带你预测、控制变量和寻找证据，但不会替你完成操作。` : activeModule === "dispersion" ? "这不是一段只能观看的视频。光光会边讲边指出装置，在关键步骤停下来，等你亲手打开光源、旋转三棱镜和移动光屏。" : guidedProfile.summary}</p>
      <ul>{(taskContext ? [taskContext.predictionPrompt ?? "操作前先作出预测", taskContext.controlledVariable ?? "每轮只改变一个变量", taskContext.evidenceRequirement ?? "保存可比较的实验记录"] : activeModule === "dispersion" ? ["9 个动态镜头", "3 次学生操作", "白光、单色光与 RGB 对照"] : guidedProfile.highlights).map((item) => <li key={item}><CircleCheck size={15} />{item}</li>)}</ul>
      <button onClick={begin}><PlayCircle size={19} />{taskContext ? "按任务要求开始引导" : "开始动态教程"}</button>
      <small>{taskContext ? "教程退出后任务会话仍保持进行；请回任务舱完成并提交本次实验。" : "随时可以退出，原来的自由探索不会被关闭。"}</small>
    </div>;
  }

  const progress = ((stepIndex + 1) / tutorialSteps.length) * 100;
  const state = activeModule === "dispersion" ? snapshot?.state : undefined;
  const catMood = speaking ? "speaking" : satisfied && requiresAction ? "celebrating" : requiresAction ? "listening" : "idle";
  const finished = stepIndex === tutorialSteps.length - 1 && !speaking;

  if (compact) {
    return <div className="harness-panel-body cat-tutorial-mini-player">
      <TutorialSpotlight target={stepTarget} label={step.eyebrow} />
      <div className="cat-mini-avatar"><OrangeCatAvatar mood={catMood} /><i className={speaking ? "is-speaking" : ""}>{speaking ? "讲解中" : requiresAction && !satisfied ? "轮到你" : requiresAction ? "已检测" : "观察"}</i></div>
      <button className="cat-mini-copy" onClick={() => onCompactChange(false)} aria-label="展开完整讲解面板">
        <span>{step.eyebrow}</span><strong>{step.title}</strong><p>{requiresAction && !satisfied ? step.hint : stepNarration}</p>
      </button>
      <div className="cat-mini-window-tools">
        <button onClick={() => onSideChange(side === "right" ? "left" : "right")} title="把讲解条移到另一侧"><MoveHorizontal size={15} /><span>换边</span></button>
        <button onClick={() => onCompactChange(false)} title="展开完整教程"><Maximize2 size={15} /><span>展开</span></button>
        <button onClick={stop} title="退出教程"><X size={15} /><span>退出</span></button>
      </div>
      <div className="cat-mini-transport">
        <button onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ChevronLeft size={16} />上一步</button>
        <button className="primary" onClick={togglePlayback}>{autoPlay ? <PauseCircle size={17} /> : <PlayCircle size={17} />}{autoPlay ? "暂停" : "继续"}</button>
        <button onClick={() => setStepIndex((value) => Math.min(tutorialSteps.length - 1, value + 1))} disabled={stepIndex === tutorialSteps.length - 1 || !readyToAdvance}>下一步<ChevronRight size={16} /></button>
        {step.requirement && !satisfied && <button className="demo" onClick={runDemonstration} disabled={demoRunning}><MousePointerClick size={15} />{demoRunning ? "示范中…" : "看示范"}</button>}
      </div>
      <div className="cat-mini-progress"><span style={{ width: `${progress}%` }} /></div>
    </div>;
  }

  return <div className="harness-panel-body cat-tutorial-player">
    <TutorialSpotlight target={stepTarget} label={step.eyebrow} />
    <div className="cat-tutorial-progress"><span style={{ width: `${progress}%` }} /><b>{String(stepIndex + 1).padStart(2, "0")} / {String(tutorialSteps.length).padStart(2, "0")}</b></div>
    <section className="cat-tutorial-stage">
      <div className="cat-tutorial-avatar"><OrangeCatAvatar mood={catMood} /><i className={speaking ? "is-speaking" : ""}>{speaking ? "指导老师讲解中" : requiresAction && !satisfied ? "等你操作" : requiresAction ? "操作已记录" : "观察中"}</i></div>
      <div className="cat-speech-card" aria-live="polite"><span>{step.eyebrow}</span><h2>{step.title}</h2><p>{stepNarration}</p></div>
    </section>

    <div className={`cat-tutorial-task ${requiresAction ? satisfied ? "is-complete" : "is-waiting" : "is-observing"}`}>
      {requiresAction ? satisfied ? <CircleCheck size={18} /> : <Sparkles size={18} /> : <Lightbulb size={18} />}
      <span><small>{requiresAction ? satisfied ? "真实操作已检测" : "现在请你操作实验" : "本镜头观察提示"}</small><strong>{satisfied && requiresAction ? latestInteraction ? `已记录：${eventNames[latestInteraction.type]}。可以继续观察。` : "做得好，已经找到继续前进的证据。" : step.hint}</strong></span>
      {step.requirement && !satisfied && <button className="cat-tutorial-demo" onClick={runDemonstration} disabled={demoRunning}><MousePointerClick size={15} />{demoRunning ? "光光正在操作…" : "先看光光示范"}</button>}
    </div>

    {step.question && <section className="cat-tutorial-question" aria-label="预测问题">
      <span>PREDICT / 先预测再观察</span><h3>{step.question.prompt}</h3>
      <div>{step.question.choices.map((choice, index) => <button className={`${selectedAnswer === index ? "selected" : ""} ${selectedAnswer === index ? index === step.question!.answerIndex ? "correct" : "wrong" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [step.id]: index }))} key={choice}><b>{String.fromCharCode(65 + index)}</b>{choice}</button>)}</div>
      {selectedAnswer !== undefined && <p className={questionSatisfied ? "correct" : "wrong"}>{questionSatisfied ? step.question.explanation : activeModule === "dispersion" ? "这个判断和光屏证据不一致，再换一个答案试试看。" : "这个判断与当前实验规律不一致，再换一个答案试试看。"}</p>}
    </section>}

    {finished && <section className="cat-tutorial-finish" aria-label="动态教程完成">
      <CircleCheck size={23} />
      <div><small>TUTORIAL COMPLETE / 教程完成</small><strong>{taskContext ? "操作引导结束，请检查任务证据。" : "讲解结束，实验仍然保持开放。"}</strong><p>{taskContext ? `${taskContext.reflectionPrompt ?? "用一个新情境检验刚才形成的解释。"} 保存观察后，回到任务舱点击“完成本次实验”。` : "现在可以带着刚才的预测和证据继续自由改变条件，或者重新播放整个教程。"}</p></div>
      <button onClick={stop}>{taskContext ? "继续完成任务实验" : "回到自由实验"}</button><button className="restart" onClick={begin}><RotateCcw size={14} />重新播放</button>
    </section>}

    {state && <div className="cat-tutorial-live-state" aria-label="当前实验状态">
      <span><small>光源</small><b>{state.sourceOn ? state.lightMode.toUpperCase() : "OFF"}</b></span>
      <span><small>棱镜</small><b>{state.prismAngle}°</b></span>
      <span><small>光屏</small><b>{state.screenDistance} mm</b></span>
    </div>}

    <div className="cat-tutorial-transport">
      <button onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0} aria-label="上一步"><ChevronLeft size={18} /></button>
      <button className="transport-primary" onClick={togglePlayback}>{autoPlay ? <PauseCircle size={18} /> : <PlayCircle size={18} />}{autoPlay ? "暂停自动播放" : "继续自动播放"}</button>
      <button onClick={() => setStepIndex((value) => Math.min(tutorialSteps.length - 1, value + 1))} disabled={stepIndex === tutorialSteps.length - 1 || !readyToAdvance} aria-label="下一步"><ChevronRight size={18} /></button>
    </div>

    <div className="cat-tutorial-tools">
      <button onClick={replay}><RotateCcw size={15} />重播本步</button>
      <button onClick={toggleVoice}>{voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{voiceEnabled ? "关闭讲解" : "开启讲解"}</button>
      <button onClick={stop}>退出教程</button>
    </div>

    <nav className="cat-tutorial-dots" aria-label="教程镜头">
      {tutorialSteps.map((item, index) => <button className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "visited" : ""}`} onClick={() => setStepIndex(index)} aria-label={`进入${item.eyebrow}`} key={item.id}>{index + 1}</button>)}
    </nav>
  </div>;
}
