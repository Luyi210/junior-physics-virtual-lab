import {
  createHarnessObservation,
  createHarnessSession,
  appendDialogueExchange,
  markInsightRead,
  processHarnessEvent,
  harnessShortFollowUp,
  isHarnessApparatusCheckQuestion,
  isHarnessNextStepQuestion,
  resolveHarnessFollowUp,
  RuleBasedDialogueAssistant,
  RuleBasedLearningAssistant
} from "@physics-lab/harness";
import type { HarnessArea, HarnessDialogueMessage, HarnessEventType, HarnessSession, HarnessValue } from "@physics-lab/harness";
import { create } from "zustand";
import { localHarnessSessionRepository } from "../../data/harnessSessionRepository";
import { syncHarnessEvent, syncHarnessObservation } from "../../data/studentSessionSync";
import { studentApi } from "../../data/teacherApi";
import { getApparatusContext, subscribeApparatusSnapshots } from "./tutorialBridge";
import { getStudentRecordScope, subscribeStudentRecordScope } from "../../data/studentRecordScope";
import { apparatusSignature, captureQuestionContext, explicitHintLevel } from "./questionContext";

const assistant = new RuleBasedLearningAssistant();
const dialogueAssistant = new RuleBasedDialogueAssistant();
let entryVersion = 0;
let questionVersion = 0;
let pendingQuestion: { version: number; controller: AbortController } | undefined;
let conversationWindow: { module: string; revision: number; dialogue: HarnessDialogueMessage[]; eventStart: number; observationStart: number } | undefined;
let unsubscribeConversationScope: (() => void) | undefined;

function currentConversation(session: HarnessSession, module: string, revision: number, includeEntry = false) {
  if (!conversationWindow || conversationWindow.module !== module || conversationWindow.revision !== revision) {
    conversationWindow = { module, revision, dialogue: [], eventStart: Math.max(0, session.events.length - (includeEntry ? 1 : 0)), observationStart: session.observations.length };
  }
  return conversationWindow;
}
const saveTimers = new Map<string, number>();
const pendingSessions = new Map<string, HarnessSession>();
const controlRecordTimes = new Map<string, number>();
const controlRecordTimers = new Map<string, number>();
const CONTROL_RECORD_INTERVAL = 140;
const QUESTION_TIMEOUT = 30_000;

function stopPendingQuestion() {
  const previous = pendingQuestion;
  pendingQuestion = undefined;
  questionVersion += 1;
  previous?.controller.abort();
}

function clearControlTimers() {
  for (const timer of controlRecordTimers.values()) window.clearTimeout(timer);
  controlRecordTimers.clear();
  controlRecordTimes.clear();
}

function scheduleSave(session: HarnessSession) {
  pendingSessions.set(session.id, session);
  const previousTimer = saveTimers.get(session.id);
  if (previousTimer) window.clearTimeout(previousTimer);
  const timer = window.setTimeout(() => {
    const pending = pendingSessions.get(session.id);
    if (pending) void localHarnessSessionRepository.save(pending);
    pendingSessions.delete(session.id);
    saveTimers.delete(session.id);
  }, 360);
  saveTimers.set(session.id, timer);
}

interface HarnessUiState {
  activeArea?: HarnessArea;
  activeModule?: string;
  session?: HarnessSession;
  loading: boolean;
  asking: boolean;
  guidedHintLevel: 0 | 1 | 2 | 3;
  questionNotice?: string;
  dialogueProvider: "rules" | "deepseek-harness";
  dialogueFallbackReason?: "login-required" | "request-failed" | "guided-hint" | "guided-check" | "guided-follow-up" | "guided-next-step";
  panelOpen: boolean;
  enterArea: (area: HarnessArea, module: string) => Promise<void>;
  leaveArea: () => void;
  record: (type: HarnessEventType, payload?: Record<string, HarnessValue>) => void;
  saveObservation: (text: string) => boolean;
  askQuestion: (text: string) => Promise<boolean>;
  cancelQuestion: () => void;
  readInsight: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useHarnessStore = create<HarnessUiState>((set, get) => ({
  loading: false,
  asking: false,
  guidedHintLevel: 0,
  dialogueProvider: "rules",
  dialogueFallbackReason: undefined,
  panelOpen: false,

  async enterArea(area, module) {
    if (get().activeArea === area && get().activeModule === module && get().session) return;
    stopPendingQuestion();
    unsubscribeConversationScope?.();
    unsubscribeConversationScope = undefined;
    conversationWindow = undefined;
    clearControlTimers();
    const version = ++entryVersion;
    set({ activeArea: area, activeModule: module, session: undefined, loading: true, asking: false, guidedHintLevel: 0, questionNotice: undefined, dialogueProvider: "rules", dialogueFallbackReason: undefined });
    const sessionId = `harness-local-learner-${area}`;
    const stored = pendingSessions.get(sessionId) ?? await localHarnessSessionRepository.find(sessionId).catch(() => undefined);
    if (version !== entryVersion) return;
    const base = stored ?? createHarnessSession(area);
    const session = processHarnessEvent(base, {
      type: "module.entered",
      payload: { module }
    }, assistant);
    set({ session, loading: false });
    currentConversation(session, module, getStudentRecordScope().revision, true);
    unsubscribeConversationScope = subscribeStudentRecordScope(() => {
      const revision = getStudentRecordScope().revision;
      const latest = get().session;
      if (version !== entryVersion || !latest || conversationWindow?.revision === revision) return;
      conversationWindow = undefined;
      currentConversation(latest, module, revision);
      set({ guidedHintLevel: 0 });
    });
    scheduleSave(session);
  },

  leaveArea() {
    entryVersion += 1;
    stopPendingQuestion();
    unsubscribeConversationScope?.();
    unsubscribeConversationScope = undefined;
    conversationWindow = undefined;
    clearControlTimers();
    set({ activeArea: undefined, activeModule: undefined, session: undefined, loading: false, asking: false, guidedHintLevel: 0, questionNotice: undefined });
  },

  cancelQuestion() {
    stopPendingQuestion();
    set({ asking: false, questionNotice: "已停止本次提问，输入内容仍保留，可以修改后再问。" });
  },

  record(type, payload = {}) {
    const current = get().session;
    if (!current) return;
    if (type === "control.changed") {
      const module = get().activeModule ?? "unknown";
      const sessionId = current.id;
      const version = entryVersion;
      const controlKey = `${sessionId}:${module}:${String(payload.experiment ?? "")}:${String(payload.control ?? "control")}`;
      const elapsed = performance.now() - (controlRecordTimes.get(controlKey) ?? -Infinity);
      if (elapsed < CONTROL_RECORD_INTERVAL) {
        const previousTimer = controlRecordTimers.get(controlKey);
        if (previousTimer) window.clearTimeout(previousTimer);
        const timer = window.setTimeout(() => {
          controlRecordTimers.delete(controlKey);
          if (version !== entryVersion || get().session?.id !== sessionId || (get().activeModule ?? "unknown") !== module) return;
          get().record(type, payload);
        }, CONTROL_RECORD_INTERVAL - elapsed + 8);
        controlRecordTimers.set(controlKey, timer);
        return;
      }
      controlRecordTimes.set(controlKey, performance.now());
    }
    const session = processHarnessEvent(current, { type, payload }, assistant);
    set({ session });
    scheduleSave(session);
    const recordedEvent = session.events.at(-1);
    if (recordedEvent) void syncHarnessEvent(recordedEvent);
  },

  saveObservation(text) {
    const current = get().session;
    if (!current || !text.trim()) return false;
    const session = createHarnessObservation(current, text, assistant);
    set({ session });
    scheduleSave(session);
    void syncHarnessObservation(text);
    const observationEvent = session.events.at(-1);
    if (observationEvent?.type === "observation.created") void syncHarnessEvent(observationEvent);
    return true;
  },

  async askQuestion(text) {
    const current = get().session;
    const module = get().activeModule;
    if (!current || !module || !text.trim() || get().asking || get().loading) return false;
    const question = text.trim();
    const hintLevel = explicitHintLevel(question);
    const checkingApparatus = isHarnessApparatusCheckQuestion(question);
    const planningNextStep = isHarnessNextStepQuestion(question);
    const shortFollowUp = harnessShortFollowUp(question);
    const apparatus = structuredClone(getApparatusContext(module));
    const contextSnapshot = captureQuestionContext(apparatus);
    const capturedSignature = apparatusSignature(apparatus);
    const entered = entryVersion;
    const scope = getStudentRecordScope();
    const previousConversation = conversationWindow;
    const conversation = currentConversation(current, module, scope.revision);
    if (conversation !== previousConversation) set({ guidedHintLevel: 0 });
    const scopedSession: HarnessSession = { ...current, dialogue: conversation.dialogue,
      events: current.events.slice(conversation.eventStart), observations: current.observations.slice(conversation.observationStart), insights: [] };
    const version = ++questionVersion;
    const controller = new AbortController();
    pendingQuestion = { version, controller };
    const isCurrent = () => version === questionVersion && entered === entryVersion
      && get().session?.id === current.id && get().activeModule === module
      && getStudentRecordScope().revision === scope.revision;
    const localQuestion = hintLevel ? `给我${["一", "二", "三"][hintLevel - 1]}级提示` : question;
    const localReply = dialogueAssistant.respondToQuestion(scopedSession, module, localQuestion, apparatus);
    let reply = localReply;
    let dialogueProvider: HarnessUiState["dialogueProvider"] = "rules";
    let dialogueFallbackReason: HarnessUiState["dialogueFallbackReason"] = hintLevel ? "guided-hint" : checkingApparatus ? "guided-check" : planningNextStep ? "guided-next-step" : shortFollowUp ? "guided-follow-up" : "login-required";
    set({ asking: true, questionNotice: undefined });
    let apparatusChangedWhileWaiting = false;
    const unsubscribeApparatus = subscribeApparatusSnapshots((context) => {
      if (!apparatusChangedWhileWaiting && context.current.module === module) {
        apparatusChangedWhileWaiting = apparatusSignature(context) !== capturedSignature;
      }
    });
    const unsubscribe = subscribeStudentRecordScope(() => {
      if (version === questionVersion && getStudentRecordScope().revision !== scope.revision) {
        stopPendingQuestion();
        if (conversationWindow?.revision === scope.revision) conversationWindow = undefined;
        set({ asking: false, guidedHintLevel: 0, questionNotice: "登录身份已变化，本次回答未加入对话，请重新提问。" });
      }
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    try {
      if (!hintLevel && !checkingApparatus && !planningNextStep && !shortFollowUp && studentApi.hasSession() && scope.mode === "account" && scope.canWrite) {
        const interrupted = new Promise<never>((_, reject) => {
          const onAbort = () => reject(new Error("question-interrupted"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
          removeAbortListener = () => controller.signal.removeEventListener("abort", onAbort);
        });
        timeout = setTimeout(() => controller.abort(), QUESTION_TIMEOUT);
        const aiReply = await Promise.race([studentApi.askGuangguang({
          conversationId: current.id,
          question,
          context: {
            area: current.area,
            module,
            apparatus,
            recentEvents: scopedSession.events.slice(-18),
            observations: scopedSession.observations.slice(-8),
            recentDialogue: conversation.dialogue
          }
        }, controller.signal), interrupted]);
        if (!aiReply || typeof aiReply.text !== "string" || !aiReply.text.trim() || !Array.isArray(aiReply.citations)
          || aiReply.citations.some(citation => !citation || typeof citation.title !== "string" || typeof citation.section !== "string")) {
          throw new Error("Incomplete assistant reply");
        }
        reply = { ...localReply, text: aiReply.text, citations: aiReply.citations, provider: "deepseek-harness" };
        dialogueProvider = "deepseek-harness";
        dialogueFallbackReason = undefined;
      }
    } catch {
      dialogueProvider = "rules";
      dialogueFallbackReason = "request-failed";
    } finally {
      clearTimeout(timeout);
      removeAbortListener();
      unsubscribe();
      unsubscribeApparatus();
    }
    const latest = get().session;
    if (!latest || !isCurrent()) {
      if (version === questionVersion) {
        pendingQuestion = undefined;
        set({ asking: false, questionNotice: "提问所在的实验或登录状态已变化，请重新提问。" });
      }
      return false;
    }
    pendingQuestion = undefined;
    contextSnapshot.changedWhileWaiting = apparatusChangedWhileWaiting || capturedSignature !== apparatusSignature(getApparatusContext(module));
    const session = appendDialogueExchange(latest, module, question, { ...reply, contextSnapshot });
    const completed = session.dialogue!.slice(-2);
    const resolvedFollowUp = shortFollowUp ? resolveHarnessFollowUp(question, module, conversation.dialogue) : undefined;
    const relativeHint = resolvedFollowUp?.kind === "hint" ? resolvedFollowUp : undefined;
    const continuedTopic = resolvedFollowUp?.previous && (resolvedFollowUp.kind === "why" || resolvedFollowUp.kind === "simplify")
      ? resolvedFollowUp.anchor : undefined;
    // The visible history preserves the learner's words. Only the bounded memory
    // keeps the resolved topic or hint level across repeated short follow-ups.
    // A next-step check concerns the current apparatus, so it never carries an old topic forward.
    const memoryQuestion = relativeHint?.previous ? `给我${["一", "二", "三"][relativeHint.nextHintLevel - 1]}级提示` : continuedTopic ?? question;
    conversation.dialogue = [...conversation.dialogue, { ...completed[0]!, text: memoryQuestion }, completed[1]!].slice(-6);
    set({ session });
    scheduleSave(session);
    set({ asking: false, dialogueProvider, dialogueFallbackReason,
      guidedHintLevel: hintLevel || (relativeHint?.previous ? relativeHint.nextHintLevel : get().guidedHintLevel) });
    return true;
  },

  readInsight(id) {
    const current = get().session;
    if (!current) return;
    const session = markInsightRead(current, id);
    set({ session });
    scheduleSave(session);
  },

  setPanelOpen(panelOpen) { set({ panelOpen }); }
}));
