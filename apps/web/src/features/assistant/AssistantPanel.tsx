import { useHarnessStore } from "./harnessStore";
import { useState, useRef, useMemo, useEffect } from "react";
import { useOrangeCatAvatarLabel, OrangeCatAvatar } from "./OrangeCatAvatar";
import { diagnoseHarnessExperiment, getHarnessLearnerModel, getHarnessKnowledgeMastery, getHarnessReviewSchedule, createHarnessExperimentSummary, getHarnessConceptNode, getHarnessLearningBranch, getHarnessCoachAlert, getHarnessConceptMemory, getHarnessAdaptiveQuestions, getHarnessQuickQuestions, analyzeHarnessDraft } from "@physics-lab/harness";
import { getApparatusContext } from "./tutorialBridge";
import { X, MessageCircle, GraduationCap, BookMarked, Activity, Sparkles, ArrowRight, ChevronDown, BrainCircuit, ShieldCheck, RotateCcw, Lightbulb, Crosshair, Network, CircleCheck, Save, UserRound, Check, SendHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { DEMO_ONLY, studentApi } from "../../data/teacherApi";
import { type PanelView, areaNames, eventNames } from "./labels";
import { type SpotlightTarget, TutorialSpotlight } from "./tutorials/TutorialSpotlight";
import { TutorialExperience } from "./tutorials/TutorialExperience";
import { TutorHintLadder } from "../../shared/components/TutorHintLadder";
import { QuestionEvidence } from "./QuestionEvidence";
import { useVisualViewportPanel } from "../../shared/hooks/useVisualViewportPanel";

export function HarnessPanel() {
  const activeArea = useHarnessStore((state) => state.activeArea);
  const activeModule = useHarnessStore((state) => state.activeModule);
  const loading = useHarnessStore((state) => state.loading);
  const panelOpen = useHarnessStore((state) => state.panelOpen);
  const session = useHarnessStore((state) => state.session);
  const asking = useHarnessStore((state) => state.asking);
  const hintLevel = useHarnessStore((state) => state.guidedHintLevel);
  const questionNotice = useHarnessStore((state) => state.questionNotice);
  const cancelQuestion = useHarnessStore((state) => state.cancelQuestion);
  const dialogueProvider = useHarnessStore((state) => state.dialogueProvider);
  const dialogueFallbackReason = useHarnessStore((state) => state.dialogueFallbackReason);
  const unread = useHarnessStore((state) => state.session?.insights.filter((item) => !item.read).length ?? 0);
  const setPanelOpen = useHarnessStore((state) => state.setPanelOpen);
  const askQuestion = useHarnessStore((state) => state.askQuestion);
  const saveObservation = useHarnessStore((state) => state.saveObservation);
  const readInsight = useHarnessStore((state) => state.readInsight);
  const [panelView, setPanelView] = useState<PanelView>("dialogue");
  const [tutorialCompact, setTutorialCompact] = useState(false);
  const [tutorialMiniSide, setTutorialMiniSide] = useState<"left" | "right">("right");
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarySaved, setSummarySaved] = useState(false);
  const [coachTarget, setCoachTarget] = useState<SpotlightTarget>();
  const streamEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const viewportStyle = useVisualViewportPanel(panelOpen);
  const avatarLabel = useOrangeCatAvatarLabel();

  const analysis = useMemo(() => {
    if (!panelOpen || !session || !activeArea || !activeModule) return {
      latestInsight: undefined,
      recentEvents: [],
      dialogue: [],
      diagnosis: undefined,
      learnerModel: undefined,
      knowledgeMastery: undefined,
      reviewSchedule: undefined,
      experimentSummary: undefined,
      conceptNode: undefined,
      learningBranch: undefined,
      coachAlert: undefined,
      conceptMemory: undefined,
      quickQuestions: [],
      questionLibrary: []
    };
    return {
      latestInsight: session.insights.at(-1),
      recentEvents: session.events.slice(-5).reverse(),
      dialogue: (session.dialogue ?? []).filter((message) => message.module === activeModule).slice(-14),
      diagnosis: diagnoseHarnessExperiment(session, activeModule),
      learnerModel: getHarnessLearnerModel(session, activeModule),
      knowledgeMastery: getHarnessKnowledgeMastery(session, activeModule),
      reviewSchedule: getHarnessReviewSchedule(session, activeModule),
      experimentSummary: createHarnessExperimentSummary(session, activeModule),
      conceptNode: getHarnessConceptNode(activeModule),
      learningBranch: getHarnessLearningBranch(session, activeModule),
      coachAlert: getHarnessCoachAlert(session, activeModule, getApparatusContext(activeModule)),
      conceptMemory: getHarnessConceptMemory(session, activeModule),
      quickQuestions: getHarnessAdaptiveQuestions(session, activeModule),
      questionLibrary: getHarnessQuickQuestions(activeModule, activeArea)
    };
  }, [activeArea, activeModule, panelOpen, session]);
  const latestInsight = analysis.latestInsight;
  const recentEvents = analysis.recentEvents ?? [];
  const dialogue = analysis.dialogue ?? [];
  const diagnosis = analysis.diagnosis;
  const learnerModel = analysis.learnerModel;
  const knowledgeMastery = analysis.knowledgeMastery;
  const reviewSchedule = analysis.reviewSchedule;
  const experimentSummary = analysis.experimentSummary;
  const conceptNode = analysis.conceptNode;
  const learningBranch = analysis.learningBranch;
  const coachAlert = analysis.coachAlert;
  const conceptMemory = analysis.conceptMemory;
  const evidencedDimensions = learnerModel?.dimensions.filter((dimension) => dimension.score >= 50).length ?? 0;
  const quickQuestions = analysis.quickQuestions ?? [];
  const questionLibrary = analysis.questionLibrary ?? [];
  const lastFollowUps = [...dialogue].reverse().find((message) => message.role === "assistant")?.followUps;
  const suggestions = lastFollowUps?.length ? lastFollowUps : quickQuestions;
  const visibleDialogue = historyExpanded ? dialogue : dialogue.slice(-3);
  const hiddenDialogueCount = Math.max(0, dialogue.length - visibleDialogue.length);
  const draftFeedback = activeArea && activeModule ? analyzeHarnessDraft(activeArea, activeModule, draft) : undefined;
  const dockCoachAlert = !panelOpen && session && activeModule ? getHarnessCoachAlert(session, activeModule, getApparatusContext(activeModule)) : undefined;

  useEffect(() => {
    if (!panelOpen || panelView !== "dialogue" || (!dialogue.length && !asking && !questionNotice)) return;
    streamEndRef.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [dialogue.length, panelOpen, panelView, activeModule, asking, questionNotice]);

  useEffect(() => {
    // Opening the companion must not summon a phone's keyboard or move the experiment.
    if (panelOpen) panelRef.current?.focus({ preventScroll: true });
  }, [panelOpen]);

  const dismiss = () => {
    window.speechSynthesis?.cancel();
    setTutorialCompact(false);
    setPanelOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    setHistoryExpanded(false);
    setSupportOpen(false);
    setSummaryOpen(false);
    setSummarySaved(false);
    setCoachTarget(undefined);
  }, [activeModule]);

  useEffect(() => {
    const openTutorial = () => {
      setTutorialCompact(false);
      setPanelView("tutorial");
      setPanelOpen(true);
    };
    window.addEventListener("physics-harness:open-tutorial", openTutorial);
    return () => window.removeEventListener("physics-harness:open-tutorial", openTutorial);
  }, [setPanelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dismiss();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [panelOpen, setPanelOpen]);

  const send = async (text = draft, preserveDraft = false) => {
    const question = text.trim();
    if (!question || asking || !await askQuestion(question)) return;
    if (!preserveDraft) setDraft("");
  };

  const askFromReview = (text: string) => {
    send(text);
    setPanelView("dialogue");
  };

  const sendFromSupport = (text: string) => {
    send(text);
    setSupportOpen(false);
  };

  const save = () => {
    if (!saveObservation(draft)) return;
    setDraft("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const saveSummary = () => {
    if (!experimentSummary?.ready || experimentSummary.alreadySaved || !saveObservation(experimentSummary.recordText)) return;
    setSummarySaved(true);
    window.setTimeout(() => setSummarySaved(false), 1800);
  };

  return (
    <>
      <button ref={launcherRef} className={`harness-dock-trigger harness-dialogue-trigger cat-dock-trigger dock-${dockCoachAlert?.severity ?? "idle"}`} onClick={() => setPanelOpen(true)} aria-expanded={panelOpen} aria-controls="guangguang-panel" aria-label={`打开橘猫实验员${dockCoachAlert ? `：${dockCoachAlert.title}` : ""}`}>
        <OrangeCatAvatar mood={unread > 0 ? "listening" : "idle"} />
        <span><small>{dockCoachAlert?.severity === "warning" ? "光光发现一个卡点" : dockCoachAlert?.severity === "ready" ? "本轮可以继续挑战" : "光光正在观察实验"}</small><strong>{dockCoachAlert?.title ?? "打开智能实验教练"}</strong></span>
        {unread > 0 && <b>{unread}</b>}
      </button>

      {panelOpen && (
        <>{coachTarget && <TutorialSpotlight target={coachTarget} label="智能定位" />}
        <aside id="guangguang-panel" ref={panelRef} tabIndex={-1} style={viewportStyle} className={`harness-panel harness-dialogue-panel cat-partner-panel ${panelView === "tutorial" && tutorialCompact ? `tutorial-compact mini-side-${tutorialMiniSide}` : ""}`} role="dialog" aria-label="橘猫实验员交流与动态教程">
          <header>
            <div className="harness-panel-mark cat-panel-mark"><OrangeCatAvatar compact /></div>
            <div><span>GUANGGUANG / 实验伙伴</span><strong>光光</strong><small>{avatarLabel} · 依据当前实验提供提示</small></div>
            <div className="cat-panel-actions">
              <button onClick={dismiss} aria-label="收起探究伙伴"><X size={17} /></button>
            </div>
          </header>

          <nav className="cat-panel-tabs" aria-label="橘猫实验员功能">
            <button className={panelView === "dialogue" ? "active" : ""} onClick={() => { setTutorialCompact(false); setPanelView("dialogue"); }}><MessageCircle size={16} /><span>问光光</span></button>
            <button className={panelView === "tutorial" ? "active" : ""} onClick={() => setPanelView("tutorial")}><GraduationCap size={17} /><span>带我做</span></button>
            <button className={panelView === "review" ? "active" : ""} onClick={() => { setTutorialCompact(false); setPanelView("review"); }}><BookMarked size={16} /><span>实验回顾</span></button>
          </nav>

          {loading || !session || !activeArea || !activeModule ? (
            <div className="harness-loading"><span /><p>正在恢复本地探究记录…</p></div>
          ) : panelView !== "tutorial" ? (
            <div className={`harness-panel-body harness-dialogue-body panel-view-${panelView}`}>
              <section className="harness-dialogue-context">
                <div><span>当前讨论</span><strong>{areaNames[activeArea]} · {activeModule.replaceAll("-", " ")}</strong></div>
                {panelView === "review" && <div className="harness-dialogue-metrics"><span><Activity size={13} />{diagnosis?.operationCount ?? 0} 次当前操作</span><span><BookMarked size={13} />{diagnosis?.observationCount ?? 0} 条当前发现</span></div>}
              </section>

              {panelView === "review" && <section className="cat-review-intro"><BookMarked size={18} /><span><small>EXPERIMENT REVIEW / 本次实验分析</small><strong>只根据真实操作和你亲自保存的观察进行分析</strong><p>这不是分数，也不会自动补写学生没有观察到的实验结果。</p></span></section>}

              {panelView === "review" && diagnosis && <section className={`harness-inquiry-state stage-${diagnosis.stage}`} aria-label="光光的实验状态诊断">
                <header><span><Sparkles size={14} />光光的现场判断</span><strong>{diagnosis.stageLabel}</strong></header>
                <div className="harness-inquiry-progress" aria-label={`探究进度 ${diagnosis.progress} / 4`}>{[1, 2, 3, 4].map((step) => <i className={step <= diagnosis.progress ? "active" : ""} key={step} />)}<small>{diagnosis.progress} / 4</small></div>
                <p>{diagnosis.summary}</p>
                <aside><ArrowRight size={14} /><span><small>建议下一步</small><strong>{diagnosis.nextMove}</strong></span></aside>
              </section>}

              {panelView === "review" && learnerModel && <details className={`harness-learner-model level-${learnerModel.level}`}>
                <summary><span><GraduationCap size={15} /><small>本轮练习线索 · 不是成绩</small><strong>{learnerModel.levelLabel}</strong></span><b>{evidencedDimensions}<small>/4 项有记录线索</small></b><ChevronDown size={14} /></summary>
                <div className="harness-mastery-grid">{learnerModel.dimensions.map((dimension) => { const status = dimension.score >= 70 ? "已有多条线索" : dimension.score > 0 ? "已有线索" : "等待观察"; return <article key={dimension.id}><header><span>{dimension.label}</span><b>{status}</b></header><i><b style={{ width: `${dimension.score}%` }} /></i><p>{dimension.note}</p></article>; })}</div>
                <footer><p><Sparkles size={13} />这些状态只来自当前实验的操作和记录，不评价学生能力。{learnerModel.strength}；{learnerModel.memoryLine}。</p><aside><strong>下一项小挑战</strong><span>{learnerModel.nextChallenge}</span><button type="button" onClick={(event) => { event.preventDefault(); askFromReview("根据我的记录给我一个小挑战"); }}>让光光出题 <ArrowRight size={13} /></button></aside></footer>
              </details>}

              {panelView === "review" && knowledgeMastery && <details className={`harness-long-memory band-${knowledgeMastery.band}`} aria-label="光光的本机练习记录线索">
                <summary><span><BrainCircuit size={15} /><small>跨多次实验记忆</small><strong>{knowledgeMastery.bandLabel}</strong></span><b>{knowledgeMastery.evidenceCount}<small>/5 类证据</small></b><ChevronDown size={14} /></summary>
                <div className="harness-long-memory-body">
                  <div className="harness-long-memory-meter"><i><b style={{ width: `${knowledgeMastery.score}%` }} /></i><small>练习线索覆盖 {knowledgeMastery.score}% · 仅用于安排练习</small></div>
                  <div className="harness-long-memory-signals"><span><b>{knowledgeMastery.visits}</b>次进入</span><span><b>{knowledgeMastery.operations}</b>次操作</span><span><b>{knowledgeMastery.comparisons}</b>项对照线索</span><span><b>{knowledgeMastery.observations}</b>条记录</span><span><b>{knowledgeMastery.reasoningTurns}</b>条本人解释线索</span></div>
                  <p><ShieldCheck size={13} /><span><strong>当前证据：</strong>{knowledgeMastery.strength}。<strong>复习建议：</strong>{knowledgeMastery.nextReview}。</span></p>
                  {reviewSchedule && <div className={`harness-review-schedule status-${reviewSchedule.status}`}><RotateCcw size={14} /><span><small>主动回忆计划</small><strong>{reviewSchedule.label}</strong><p>{reviewSchedule.reason}</p></span>{reviewSchedule.status !== "not-ready" && <button type="button" onClick={() => askFromReview(reviewSchedule.prompt)}>{reviewSchedule.status === "due" ? "现在回忆" : "提前练习"}<ArrowRight size={12} /></button>}</div>}
                  {knowledgeMastery.misconception && <aside className={knowledgeMastery.misconception.count >= 2 ? "repeated" : ""}><Lightbulb size={14} /><span><small>概念核验记忆 · 出现 {knowledgeMastery.misconception.count} 次</small><strong>{knowledgeMastery.misconception.claim}</strong></span><button type="button" onClick={() => askFromReview(knowledgeMastery.misconception!.probe)}>用反例再验证 <ArrowRight size={13} /></button></aside>}
                  <footer>这不是成绩或能力预测；它只汇总本机保存的操作、记录和对话证据。</footer>
                </div>
              </details>}

              {panelView === "dialogue" && coachAlert && <section className={`harness-smart-coach severity-${coachAlert.severity}`} aria-live="polite">
                <BrainCircuit className="harness-smart-coach-mark" size={17} />
                <span className="harness-smart-coach-copy"><small>{coachAlert.severity === "warning" ? "先解决这个卡点" : coachAlert.severity === "ready" ? "可以继续挑战" : "光光建议"}</small><strong>{coachAlert.message}</strong></span>
                <button className="harness-smart-coach-action" type="button" onClick={() => send(coachAlert.prompt)}><span>{coachAlert.actionLabel}</span><ArrowRight size={13} /></button>
                <button className="harness-smart-coach-locate" type="button" onClick={() => setCoachTarget((current) => current ? undefined : coachAlert.target)} aria-label={coachTarget ? "取消实验定位" : "在实验中定位"} title={coachTarget ? "取消实验定位" : "在实验中定位"}><Crosshair size={14} /></button>
              </section>}

              {panelView === "dialogue" && <details className="harness-support-tools" open={supportOpen} onToggle={(event) => setSupportOpen(event.currentTarget.open)}>
                <summary><Lightbulb size={15} /><span><strong>需要更多帮助？</strong><small>提示、探究支线与提问示例</small></span><b>按需展开</b><ChevronDown size={14} /></summary>
                <div className="harness-support-tools-body">
                  {learningBranch && <section className={`harness-learning-branch branch-${learningBranch.id}`} aria-label="光光的可选探究支线">
                    <div className="harness-learning-branch-mark"><span /><span /><span /></div>
                    <div><small>{learningBranch.eyebrow}</small><strong>{learningBranch.title}</strong><p>{learningBranch.reason}</p></div>
                    <button type="button" onClick={() => sendFromSupport(learningBranch.prompt)}>试试看 <ArrowRight size={13} /></button>
                  </section>}
                  {conceptMemory && <div className="harness-memory-line"><BrainCircuit size={13} /><span><small>本地学习记忆</small>{conceptMemory.line}</span></div>}
                  <details className="harness-question-library">
                    <summary><MessageCircle size={14} /><span><small>不知道怎样提问？</small><strong>查看提问示例</strong></span><b>{questionLibrary.length}<small>类</small></b><ChevronDown size={13} /></summary>
                    <div>{questionLibrary.map((question, index) => <button type="button" onClick={(event) => { event.preventDefault(); sendFromSupport(question); }} key={question}><b>{String(index + 1).padStart(2, "0")}</b><span>{question}</span><ArrowRight size={12} /></button>)}</div>
                  </details>
                </div>
              </details>}

              {panelView === "review" && conceptNode && <details className="harness-concept-map">
                <summary>
                  <Network size={15} />
                  <span><small>来自课本关系与实验证据</small><strong>{conceptNode.title}</strong></span>
                  <b>{conceptNode.evidenceCriteria.length}<small>条证据标准</small></b>
                  <ChevronDown size={14} />
                </summary>
                <div className="harness-concept-map-body">
                  <header><small>本轮探究问题</small><strong>{conceptNode.inquiryQuestion}</strong></header>
                  <section><span>前置概念</span><div>{conceptNode.prerequisites.map((item) => <b key={item}>{item}</b>)}</div></section>
                  <section><span>证据检查</span><ol>{conceptNode.evidenceCriteria.map((criterion) => <li key={criterion}><i />{criterion}</li>)}</ol></section>
                  {conceptNode.misconceptions[0] && <aside>
                    <span><Lightbulb size={13} />常见混淆</span>
                    <p>{conceptNode.misconceptions[0].claim}</p>
                    <button type="button" onClick={(event) => { event.preventDefault(); askFromReview(`这个说法对吗：${conceptNode.misconceptions[0]!.claim}`); }}>让光光带我验证 <ArrowRight size={13} /></button>
                  </aside>}
                  <footer><small>可以继续自由探索，不要求按图谱顺序完成。</small><div>{conceptNode.connections.map((item) => <span key={item}>{item}</span>)}</div></footer>
                </div>
              </details>}

              {panelView === "review" && experimentSummary && <section className={`harness-session-summary ${summaryOpen ? "open" : ""}`} aria-label="本次探究小结">
                <header>
                  <button type="button" onClick={() => setSummaryOpen((open) => !open)} aria-expanded={summaryOpen}>
                    <BookMarked size={16} />
                    <span><small>光光只整理真实操作与观察</small><strong>本次探究小结</strong></span>
                    <b>{experimentSummary.changedConditions.length}<small>项条件</small></b>
                    <b>{experimentSummary.evidence.length}<small>条证据</small></b>
                    <ChevronDown size={14} />
                  </button>
                </header>
                {summaryOpen && <div className="harness-session-summary-sheet">
                  <dl>
                    <div><dt>研究问题</dt><dd>{experimentSummary.question}</dd></div>
                    <div><dt>改变条件</dt><dd>{experimentSummary.changedConditions.length ? experimentSummary.changedConditions.join("；") : "尚未记录有效的条件变化"}</dd></div>
                    <div className={experimentSummary.evidence.length ? "has-evidence" : "missing-evidence"}><dt>观察证据</dt><dd>{experimentSummary.evidence.length ? experimentSummary.evidence.join("；") : "学生尚未保存观察证据，光光不会替你补写。"}</dd></div>
                    <div><dt>暂时解释</dt><dd>{experimentSummary.interpretation}</dd></div>
                    <div><dt>还需补充</dt><dd>{experimentSummary.missingEvidence}</dd></div>
                  </dl>
                  <footer>
                    <small><ShieldCheck size={12} />依据当前实验会话自动整理，可继续修改和补充。</small>
                    <button type="button" onClick={saveSummary} disabled={!experimentSummary.ready || experimentSummary.alreadySaved || summarySaved}>
                      {experimentSummary.alreadySaved || summarySaved ? <CircleCheck size={14} /> : <Save size={14} />}
                      {experimentSummary.alreadySaved || summarySaved ? "已存入记录" : experimentSummary.ready ? "存入实验记录" : "操作后可保存"}
                    </button>
                  </footer>
                </div>}
              </section>}

              {panelView === "review" && <Link className="harness-notebook-link" to="/student/notebook" onClick={() => setPanelOpen(false)}><BookMarked size={18} /><span><small>实验结束后</small><strong>把本次操作和发现整理进实验记录本</strong></span><ArrowRight size={15} /></Link>}

              {panelView === "dialogue" && <section className="harness-chat" aria-live="polite">
                <div className="harness-chat-stream">
                  <div className="harness-apparatus-check"><span>结合当前装置和本轮记录，找一个可以动手的小步骤。</span><div className="harness-coach-actions"><button type="button" disabled={asking} onClick={() => { void send("帮我规划下一步", true); }}>下一步做什么</button><button type="button" disabled={asking} onClick={() => { void send("帮我检查当前实验", true); }}>检查当前实验</button>{dialogue.length > 0 && <button type="button" disabled={asking} onClick={() => { void send("换个说法", true); }}>换个说法</button>}</div></div>
                  <TutorHintLadder currentLevel={hintLevel} disabled={asking} onSelect={(level) => { void send(`给我${["一", "二", "三"][level - 1]}级提示`, true); }} />
                  {hiddenDialogueCount > 0 && <button className="harness-history-toggle" type="button" onClick={() => setHistoryExpanded(true)}>查看更早的 {hiddenDialogueCount} 条消息</button>}
                  {historyExpanded && dialogue.length > 3 && <button className="harness-history-toggle" type="button" onClick={() => setHistoryExpanded(false)}>收起早期对话</button>}
                  {dialogue.length === 0 && (
                    <article className="harness-message assistant welcome">
                      <i><OrangeCatAvatar compact /></i>
                      <div><small>橘猫实验员 · 光光</small><p>我已连接当前实验。告诉我你观察到了什么，或者问下一步该看哪里。</p></div>
                    </article>
                  )}
                  {visibleDialogue.map((message) => (
                    <article className={`harness-message ${message.role}`} key={message.id}>
                      <i>{message.role === "assistant" ? <OrangeCatAvatar compact /> : <UserRound size={16} />}</i>
                      <div><small>{message.role === "assistant" ? <>橘猫实验员 · 光光 <b className={`harness-source-tag ${message.provider ?? "unknown"}`}>{message.provider === "deepseek-harness" ? "DeepSeek 回答" : message.provider === "rules" ? "本地规则回答" : "旧对话 · 来源未记录"}</b></> : "我的问题"}</small><p>{message.text}</p>{message.citations?.length ? <span className="harness-message-sources"><Network size={10} />知识依据：{message.citations.slice(0, 2).map((citation) => `${citation.title}·${citation.section}`).join("；")}</span> : null}{message.intent && <em><BrainCircuit size={10} />{message.contextSnapshot ? "依据提问时的实验信息" : "历史回答 · 当时装置快照未保存"}</em>}
                        {message.contextSnapshot && <QuestionEvidence snapshot={message.contextSnapshot} disabled={asking} onAskAgain={(() => {
                          const index = dialogue.findIndex((item) => item.id === message.id);
                          const question = dialogue[index - 1];
                          return question?.role === "learner" ? () => void send(question.text, true) : undefined;
                        })()} />}
                      </div>
                    </article>
                  ))}
                  {(asking || questionNotice) && <div className="harness-question-status" role="status"><span>{asking ? "光光正在根据提问时的实验信息思考…" : questionNotice}</span>{asking && <button type="button" onClick={cancelQuestion}>停止等待</button>}</div>}
                  <div ref={streamEndRef} />
                </div>

                <div className="harness-quick-questions" aria-label="快捷提问">
                  <span>接着问</span>
                  <div>{suggestions.slice(0, 2).map((question) => <button onClick={() => void send(question)} disabled={asking} key={question}>{question}</button>)}</div>
                </div>

                <div className="harness-composer">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={asking}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="问现象、下一步，或写下你的猜想……"
                    aria-label="向探究伙伴提问"
                  />
                  {draftFeedback && <div className={`harness-draft-intelligence mode-${draftFeedback.mode}`}><BrainCircuit size={13} /><span><strong>{draftFeedback.label}</strong><small>{draftFeedback.message}</small>{draftFeedback.checklist && <i>{draftFeedback.checklist.map((item) => <b className={item.passed ? "passed" : ""} key={item.id}>{item.passed ? <Check size={9} /> : <span />}{item.label}</b>)}</i>}</span><b>{Math.round(draftFeedback.confidence * 100)}%</b></div>}
                  {draftFeedback?.mode === "observation" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}保持____不变，把____从____调到____；我观察到____从____变为____。`)}><Sparkles size={13} />补入证据框架</button>}
                  {draftFeedback?.mode === "hypothesis" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template hypothesis" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}如果只把____从____调到____，并保持____不变，那么我预测____会____；我将通过比较____来检验。`)}><Sparkles size={13} />补成可检验假设</button>}
                  {draftFeedback?.mode === "reasoning" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template reasoning" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}在保持____不变时，我观察到____；因为____会导致____，所以这组证据支持____。`)}><Sparkles size={13} />补上因果桥梁</button>}
                  {draftFeedback?.mode === "conclusion" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template conclusion" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}在保持____不变、只改变____的条件下，根据两组观察，我发现____；在本次实验范围内，这说明____。`)}><Sparkles size={13} />补入结论边界</button>}
                  <button className={`harness-send ${draftFeedback?.mode === "question" ? "suggested" : ""}`} onClick={() => { void (draftFeedback?.mode === "observation" ? send(`检查这条观察：${draft}`, true) : draftFeedback?.mode === "hypothesis" ? send(`检查这条假设：${draft}`, true) : draftFeedback?.mode === "reasoning" ? send(`检查这条因果推理链：${draft}`, true) : draftFeedback?.mode === "conclusion" ? send(`检查这条结论：${draft}`, true) : send()); }} disabled={!draft.trim() || asking}><SendHorizontal size={16} /><span>{asking ? "光光思考中…" : draftFeedback?.mode === "observation" ? "审查证据" : draftFeedback?.mode === "hypothesis" ? "审查假设" : draftFeedback?.mode === "reasoning" ? "审查因果链" : draftFeedback?.mode === "conclusion" ? "审查结论" : "发送问题"}</span></button>
                  {draft.trim() && <button className={`harness-save-observation ${draftFeedback?.mode === "observation" ? "suggested" : ""}`} onClick={save}>{saved ? <Check size={15} /> : <Save size={15} />}{saved ? "已保存" : "保存为观察"}</button>}
                  <small>Enter 发送 · Shift + Enter 换行</small>
                </div>
              </section>}

              {panelView === "review" && latestInsight && (
                <button className={`harness-live-insight ${latestInsight.read ? "read" : ""}`} onClick={() => readInsight(latestInsight.id)}>
                  <Lightbulb size={17} /><span><small>规则引擎刚刚注意到</small><strong>{latestInsight.title}</strong><p>{latestInsight.message}</p></span>{!latestInsight.read && <b>新</b>}
                </button>
              )}

              {panelView === "review" && <details className="harness-trace harness-dialogue-trace">
                <summary><span>探究档案与最近事件</span><ChevronDown size={14} /></summary>
                <ol>{recentEvents.map((event) => <li key={event.id}><i /><span>{eventNames[event.type]}</span><time>{new Date(event.occurredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
              </details>}
            </div>
          ) : (
            <TutorialExperience activeArea={activeArea} activeModule={activeModule} compact={tutorialCompact} side={tutorialMiniSide} onCompactChange={setTutorialCompact} onSideChange={setTutorialMiniSide} />
          )}

          <footer className="cat-panel-status"><span><ShieldCheck size={12} />{panelView === "tutorial" ? "操作教程为预设脚本，不调用 DeepSeek" : dialogueFallbackReason === "guided-hint" ? "本次为本地分级提示 · 按需逐步引导，不调用在线 AI" : dialogueFallbackReason === "guided-check" ? "本次为本地装置核对 · 依据页面状态，不代替测量" : dialogueFallbackReason === "guided-next-step" ? "本次为本地行动建议 · 结合当前装置与本轮记录" : dialogueFallbackReason === "guided-follow-up" ? "本次为本地追问辅导 · 承接当前页面内的讨论" : DEMO_ONLY ? "演示模式 · 光光使用本地物理知识与操作教程" : dialogueProvider === "deepseek-harness" ? "上条回复来自 DeepSeek · 仅发送问题与提问时的实验上下文" : dialogueFallbackReason === "request-failed" ? "上条 DeepSeek 请求失败或超时，已由本地规则回答" : dialogueFallbackReason === "login-required" ? "本次使用本地规则 · 在线问答需要有效学生登录" : !studentApi.hasSession() ? "当前未登录学生账号 · 问答使用本地规则" : "已登录学生账号 · 联网能力待验证，不可用时提供本地引导"}</span></footer>
        </aside></>
      )}
    </>
  );
}
