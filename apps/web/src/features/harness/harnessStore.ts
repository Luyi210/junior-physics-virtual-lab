import {
  createHarnessObservation,
  createHarnessSession,
  appendDialogueExchange,
  markInsightRead,
  processHarnessEvent,
  RuleBasedDialogueAssistant,
  RuleBasedLearningAssistant
} from "@physics-lab/harness";
import type { HarnessArea, HarnessEventType, HarnessSession, HarnessValue } from "@physics-lab/harness";
import { create } from "zustand";
import { localHarnessSessionRepository } from "../../services/harnessSessionRepository";

const assistant = new RuleBasedLearningAssistant();
const dialogueAssistant = new RuleBasedDialogueAssistant();
let entryVersion = 0;
const saveTimers = new Map<string, number>();
const pendingSessions = new Map<string, HarnessSession>();

function scheduleSave(session: HarnessSession) {
  pendingSessions.set(session.id, session);
  const previousTimer = saveTimers.get(session.id);
  if (previousTimer) window.clearTimeout(previousTimer);
  const timer = window.setTimeout(() => {
    const pending = pendingSessions.get(session.id);
    if (pending) void localHarnessSessionRepository.save(pending);
    pendingSessions.delete(session.id);
    saveTimers.delete(session.id);
  }, 140);
  saveTimers.set(session.id, timer);
}

interface HarnessUiState {
  activeArea?: HarnessArea;
  activeModule?: string;
  session?: HarnessSession;
  loading: boolean;
  panelOpen: boolean;
  enterArea: (area: HarnessArea, module: string) => Promise<void>;
  record: (type: HarnessEventType, payload?: Record<string, HarnessValue>) => void;
  saveObservation: (text: string) => boolean;
  askQuestion: (text: string) => boolean;
  readInsight: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useHarnessStore = create<HarnessUiState>((set, get) => ({
  loading: false,
  panelOpen: false,

  async enterArea(area, module) {
    if (get().activeArea === area && get().activeModule === module && get().session) return;
    const version = ++entryVersion;
    set({ activeArea: area, activeModule: module, loading: true });
    const sessionId = `harness-local-learner-${area}`;
    const stored = await localHarnessSessionRepository.find(sessionId).catch(() => undefined);
    if (version !== entryVersion) return;
    const base = stored ?? createHarnessSession(area);
    const session = processHarnessEvent(base, {
      type: "module.entered",
      payload: { module }
    }, assistant);
    set({ session, loading: false });
    scheduleSave(session);
  },

  record(type, payload = {}) {
    const current = get().session;
    if (!current) return;
    const session = processHarnessEvent(current, { type, payload }, assistant);
    set({ session });
    scheduleSave(session);
  },

  saveObservation(text) {
    const current = get().session;
    if (!current || !text.trim()) return false;
    const session = createHarnessObservation(current, text, assistant);
    set({ session });
    scheduleSave(session);
    return true;
  },

  askQuestion(text) {
    const current = get().session;
    const module = get().activeModule;
    if (!current || !module || !text.trim()) return false;
    const reply = dialogueAssistant.respondToQuestion(current, module, text);
    const session = appendDialogueExchange(current, module, text, reply);
    set({ session });
    scheduleSave(session);
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
