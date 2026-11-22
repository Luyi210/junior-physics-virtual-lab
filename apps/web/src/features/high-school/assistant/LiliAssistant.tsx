import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUp, ChevronDown, FlaskConical, MessageCircle, Square, X } from "lucide-react";
import type { LiliChatReply, LiliExperimentContext } from "@physics-lab/contracts";
import { createLiliGuidance, isLiliCurrentCheck, isLiliEvidenceCoachRequest, isLiliLifeConnectionRequest, isLiliReflectionRequest, isLiliSimplificationRequest, liliHintLevel, resolveLiliFollowUp, type LiliHintLevel } from "@physics-lab/harness/lili";
import { getHighSchoolExperiment } from "@physics-lab/knowledge/high-school";
import { getHighSchoolContext, getHighSchoolExperimentVisit, subscribeHighSchoolContext } from "../../../data/highSchoolContext";
import { getHighSchoolRecordScope, isCurrentHighSchoolRecordScope, subscribeHighSchoolRecordScope, type HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { canRequestLiliNetwork, requestLiliForScope } from "./liliRequest";
import { CorgiAvatar } from "./CorgiAvatar";
import { CorgiAvatarControls } from "./CorgiAvatarControls";
import { useCorgiAvatarRotation } from "./useCorgiAvatarRotation";
import { captureLiliContext, collectLiliRecentDialogue, createLiliConversationId } from "./liliConversationContext";
import { LiliQuestionContext } from "./LiliQuestionContext";
import { LiliReviewPanel } from "./LiliReviewPanel";
import { TutorHintLadder } from "../../../shared/components/TutorHintLadder";
import { useVisualViewportPanel } from "../../../shared/hooks/useVisualViewportPanel";
import "./LiliAssistant.css";
import "./LiliCosmicTheme.css";
import "../styles/HighSchoolTypography.css";

type Message = { id: string; visit: number; role: "student" | "lili"; text: string; reply?: LiliChatReply; questionContext?: LiliExperimentContext | null; hintLevel?: LiliHintLevel | null; effectiveQuestion?: string };
const serverContext = () => null;

export function LiliManualContextNotice({ context, busy, onAsk }: { context: LiliExperimentContext | null; busy: boolean; onAsk: (question: string) => void }) {
  if (context?.experimentId !== "pendulum" && context?.experimentId !== "double-slit" && context?.experimentId !== "mechanical-energy") return null;
  const total = context.manualRecordCount ?? 0;
  const included = Math.min(10, total, context.manualSamples?.length ?? 0);
  return <div className="lili-manual-context"><div><strong>手动读数档案</strong><span>{total} 条 · 本次可引用 {included} 条</span></div><p>{included ? "仅在你提问时，附上最近最多 10 条虚拟手动读数与当时条件。" : "先在实验页保存一次手动读数，提问时力力才能参考它。"}这些记录与自动模型采样分开，不是真实器材测量。</p><button type="button" disabled={busy || included === 0} onClick={() => onAsk("看看我的手动读数")}>看看我的手动读数<ArrowUp size={13} aria-hidden="true" /></button></div>;
}

export function LiliAssistant() {
  const scope = useSyncExternalStore(subscribeHighSchoolRecordScope, getHighSchoolRecordScope, getHighSchoolRecordScope);
  return <LiliConversation key={`${scope.key ?? "blocked"}:${scope.revision}`} scope={scope} />;
}

function LiliConversation({ scope }: { scope: HighSchoolRecordScope }) {
  const context = useSyncExternalStore(subscribeHighSchoolContext, getHighSchoolContext, serverContext);
  const visit = useSyncExternalStore(subscribeHighSchoolContext, getHighSchoolExperimentVisit, getHighSchoolExperimentVisit);
  const experiment = context ? getHighSchoolExperiment(context.experimentId) : undefined;
  const [open, setOpen] = useState(false);
  const [panelView, setPanelView] = useState<"dialogue" | "review">("dialogue");
  const viewportStyle = useVisualViewportPanel(open);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const avatarRotation = useCorgiAvatarRotation({ open, busy });
  const [notice, setNotice] = useState("");
  const [conversationId] = useState(createLiliConversationId);
  const messageSequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const activeVisit = useRef(visit);
  const panelRef = useRef<HTMLElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const currentReplies = [...messages].reverse().filter((message) => message.visit === visit && message.reply && (message.questionContext?.experimentId ?? null) === (context?.experimentId ?? null));
  const latest = currentReplies[0]?.reply;
  const currentHintLevel = currentReplies.find((message) => message.hintLevel)?.hintLevel ?? 0;
  const suggestions = latest?.suggestions ?? (experiment ? ["怎样控制变量？"] : ["我应该先做哪一步？", "怎样控制变量？", "怎么分析图像？"]);
  const visibleSuggestions = [...new Set([...(experiment ? ["生活中有什么例子？", "帮我规划下一步", "检查我的记录", "帮我检查当前实验"] : []), ...suggestions, ...(currentReplies.length ? ["换个说法", "下一步呢？"] : [])])];

  function syncExperimentVisit() {
    const nextVisit = getHighSchoolExperimentVisit();
    if (activeVisit.current === nextVisit) return;
    activeVisit.current = nextVisit;
    pending.current?.abort(); pending.current = null;
    setBusy(false); setInput("");
    setNotice("已切换实验。旧回复保留原条件，本次从新的讨论开始。");
  }
  useEffect(() => {
    const unsubscribe = subscribeHighSchoolContext(syncExperimentVisit);
    syncExperimentVisit();
    return unsubscribe;
  }, []);
  useEffect(() => { syncExperimentVisit(); }, [visit]);

  useEffect(() => {
    const cancelOldOwner = () => {
      if (!isCurrentHighSchoolRecordScope(scope)) { pending.current?.abort(); pending.current = null; }
    };
    const unsubscribe = subscribeHighSchoolRecordScope(cancelOldOwner);
    return () => { pending.current?.abort(); pending.current = null; unsubscribe(); };
  }, [scope]);
  useEffect(() => { if (open) panelRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (open && panelView === "dialogue" && (messages.length > 0 || busy)) bottom.current?.scrollIntoView({ block: "nearest", behavior: "auto" }); }, [messages, busy, open, panelView]);

  function dismiss() { setOpen(false); launcher.current?.focus({ preventScroll: true }); }
  async function ask(raw: string) {
    syncExperimentVisit();
    const question = raw.trim();
    if (!question || pending.current) return;
    if (!isCurrentHighSchoolRecordScope(scope)) { setNotice("档案身份已变化，请在当前档案中重新提问。"); return; }
    const current = captureLiliContext(getHighSchoolContext());
    const questionVisit = getHighSchoolExperimentVisit();
    const recentDialogue = collectLiliRecentDialogue(messages.filter(message => message.visit === questionVisit), current);
    const resolved = resolveLiliFollowUp(question, current, recentDialogue);
    const fallback = createLiliGuidance(question, current, recentDialogue);
    const hintLevel = liliHintLevel(resolved.question);
    const localOnly = Boolean(hintLevel || isLiliCurrentCheck(resolved.question) || isLiliEvidenceCoachRequest(resolved.question) || isLiliLifeConnectionRequest(resolved.question) || isLiliReflectionRequest(resolved.question) || isLiliSimplificationRequest(question) || resolved.needsClarification);
    const controller = new AbortController();
    pending.current = controller;
    setInput(""); setBusy(true); setNotice("");
    const questionId = `question-${++messageSequence.current}`;
    const replyId = `${questionId}-reply`;
    setMessages((items) => [...items.slice(-18), { id: questionId, visit: questionVisit, role: "student", text: question, effectiveQuestion: resolved.question }]);
    const isCurrent = () => pending.current === controller && isCurrentHighSchoolRecordScope(scope) && getHighSchoolExperimentVisit() === questionVisit;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    try {
      // The teacher and guest archives never borrow a leftover student token.
      let reply = fallback;
      if (!localOnly && conversationId && canRequestLiliNetwork(scope)) {
        const interrupted = new Promise<never>((_, reject) => {
          const onAbort = () => reject(new Error("lili-question-interrupted"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
          removeAbortListener = () => controller.signal.removeEventListener("abort", onAbort);
        });
        timer = setTimeout(() => controller.abort(), 50_000);
        // Do not depend on the transport honouring abort to release the input.
        reply = await Promise.race([
          requestLiliForScope({ scope, request: { conversationId, question, context: current, recentDialogue }, signal: controller.signal, localReply: fallback }),
          interrupted,
        ]);
      }
      // Hints, verified checks and ambiguous follow-ups must work immediately offline.
      if (!isCurrent()) return;
      setMessages((items) => [...items, { id: replyId, visit: questionVisit, role: "lili", text: reply.text, reply, questionContext: current, hintLevel }]);
      if (!conversationId) setNotice("浏览器暂不能生成安全会话编号，已提供本地实验引导，未发送联网请求。");
      else if (reply.mode === "guided") setNotice("当前显示本地实验引导，依据提问时的条件生成。");
    } catch {
      if (!isCurrent()) return;
      setMessages((items) => [...items, { id: replyId, visit: questionVisit, role: "lili", text: fallback.text, reply: fallback, questionContext: current, hintLevel }]);
      setNotice("联网回复未接通，已改用本地实验引导。");
    } finally {
      if (timer) clearTimeout(timer);
      removeAbortListener();
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  function cancel() {
    pending.current?.abort(); pending.current = null; setBusy(false); setNotice("已停止等待联网回复。");
  }

  return <aside className={`lili-assistant${open ? " is-open" : ""}`} aria-label="力力高中实验助手">
    {open && <section id="lili-panel" className="lili-panel" style={viewportStyle} ref={panelRef} tabIndex={-1} role="region" aria-labelledby="lili-title" onKeyDown={(event) => { if (event.key === "Escape") dismiss(); }}>
      <header><div className="lili-portrait"><CorgiAvatar speaking={busy} avatarIndex={avatarRotation.index} /></div><div className="lili-heading"><span className="lili-eyebrow">高中实验伙伴</span><h2 id="lili-title">力力<span className="lili-capability">{latest?.mode === "ai" ? "上条为 AI 回复" : latest || !conversationId || !canRequestLiliNetwork(scope) ? "本地引导" : "联网待验证"}</span></h2><p>{experiment?.name ?? "从一个好问题开始"}</p></div><button type="button" aria-label="收起力力" onClick={dismiss}><X size={19} aria-hidden="true" /></button></header>
      <div className="lili-view-tabs" role="tablist" aria-label="力力辅导方式"><button id="lili-dialogue-tab" type="button" role="tab" aria-selected={panelView === "dialogue"} aria-controls="lili-dialogue-view" onClick={() => setPanelView("dialogue")}>问力力</button><button id="lili-review-tab" type="button" role="tab" aria-selected={panelView === "review"} aria-controls="lili-review-view" onClick={() => setPanelView("review")}>现场判断</button></div>
      <div className="lili-body">
      {panelView === "review" ? <div id="lili-review-view" role="tabpanel" aria-labelledby="lili-review-tab"><LiliReviewPanel context={context} busy={busy || scope.key === null} onAsk={(question) => { setPanelView("dialogue"); void ask(question); }} onPrepare={(kind) => { setInput(`检查这条${kind}：`); setPanelView("dialogue"); }} /></div> : <div id="lili-dialogue-view" role="tabpanel" aria-labelledby="lili-dialogue-tab">
      <CorgiAvatarControls rotation={avatarRotation} />
      <div className="lili-dialogue" role="log" aria-live="polite" aria-relevant="additions">
        {!messages.length && <div className="lili-welcome"><span><FlaskConical size={14} aria-hidden="true" />一起想明白</span><h3>带着问题动手，<br /><em>让证据回答。</em></h3><p>我是力力。卡在哪一步，就从哪里聊起。</p><ul aria-label="力力能帮助你"><li>梳理变量</li><li>读懂图像</li><li>检查推理</li></ul><small>提问时参考当前虚拟实验条件；真实测量仍由你完成。未登录或后台不可用时，提供本地引导。</small></div>}
        {messages.map((message) => <article key={message.id} className={`lili-message is-${message.role}`}><small>{message.role === "student" ? "你" : `力力 · ${message.reply?.mode === "ai" ? "AI 回复" : "本地引导"}`}</small>{message.role === "lili" && <LiliQuestionContext captured={message.questionContext ?? null} current={context} />}<p>{message.text}</p>{message.reply?.sources.length ? <details><summary>参考资料</summary>{message.reply.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</details> : null}</article>)}
        {busy && <p className="lili-thinking">力力正在整理思路…</p>}
        <LiliManualContextNotice context={context} busy={busy} onAsk={(question) => void ask(question)} />
        <div ref={bottom} />
      </div>
      {experiment && <TutorHintLadder tone="cosmic" currentLevel={currentHintLevel} disabled={busy || scope.key === null} onSelect={(level) => void ask(`给我${["一", "二", "三"][level - 1]}级提示`)} />}
      <div className="lili-suggestions" aria-label="可以这样问"><p>{messages.length ? "继续探究" : "从这里开始"}</p>{visibleSuggestions.map((question) => <button type="button" key={question} disabled={busy || scope.key === null} onClick={() => void ask(question)}><span>{question}</span><ArrowRight size={15} aria-hidden="true" /></button>)}</div>
      {notice && <p className="lili-notice" role="status">{notice}</p>}
      </div>}
      </div>
      {panelView === "dialogue" && <form onSubmit={(event) => { event.preventDefault(); void ask(input); }}><label className="lili-input-label" htmlFor="lili-question">向力力提问</label><textarea id="lili-question" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1600} rows={2} placeholder="这次实验，我想弄明白…" disabled={busy || scope.key === null} /><div><small>当前会话不作为实验记录保存</small>{busy ? <button type="button" onClick={cancel} aria-label="停止等待"><Square size={15} aria-hidden="true" /><span>停止</span></button> : <button type="submit" disabled={!input.trim() || scope.key === null} aria-label="发送问题"><span>发送</span><ArrowUp size={18} aria-hidden="true" /></button>}</div></form>}
      <footer><span>当前档案：{scope.label}</span>{scope.mode === "guest" || (scope.mode === "account" && !scope.canWrite) ? <Link to={scope.authChannel === "teacher" ? "/teacher" : "/student"}>{scope.mode === "account" ? "重新登录" : "账号登录"}<ArrowRight size={13} aria-hidden="true" /></Link> : null}</footer>
    </section>}
    <button className="lili-launcher" type="button" ref={launcher} onClick={() => open ? dismiss() : setOpen(true)} onMouseEnter={() => avatarRotation.setInteracting(true)} onMouseLeave={() => avatarRotation.setInteracting(false)} onFocus={() => avatarRotation.setInteracting(true, "focus")} onBlur={() => avatarRotation.setInteracting(false, "focus")} aria-expanded={open} aria-controls="lili-panel" aria-label={open ? "收起力力助手" : "和力力讨论实验"}><CorgiAvatar speaking={busy} avatarIndex={avatarRotation.index} /><span><b>力力</b><small>{open ? "一起找证据" : "需要一个提示吗？"}</small></span>{open ? <ChevronDown size={16} /> : <MessageCircle size={17} />}</button>
  </aside>;
}
