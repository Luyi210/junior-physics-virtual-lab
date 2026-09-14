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
import { syncHarnessEvent, syncHarnessObservation } from "../../services/studentSessionSync";
import { studentApi } from "../../services/teacherApi";
import { getApparatusContext } from "./tutorialBridge";

const assistant = new RuleBasedLearningAssistant();
const dialogueAssistant = new RuleBasedDialogueAssistant();
let entryVersion = 0;
const saveTimers = new Map<string, number>();
const pendingSessions = new Map<string, HarnessSession>();
const controlRecordTimes = new Map<string, number>();
const controlRecordTimers = new Map<string, number>();
const CONTROL_RECORD_INTERVAL = 140;

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
  dialogueProvider: "rules" | "deepseek-harness";
  panelOpen: boolean;
  enterArea: (area: HarnessArea, module: string) => Promise<void>;
  record: (type: HarnessEventType, payload?: Record<string, HarnessValue>) => void;
  saveObservation: (text: string) => boolean;
  askQuestion: (text: string) => Promise<boolean>;
  readInsight: (id: string) => void;
  setPanelOpen: (open: boolean) => void;
}

export const useHarnessStore = create<HarnessUiState>((set, get) => ({
  loading: false,
  asking: false,
  dialogueProvider: "rules",
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
    if (type === "control.changed") {
      const module = get().activeModule ?? "unknown";
      const sessionId = current.id;
      const controlKey = `${sessionId}:${module}:${String(payload.experiment ?? "")}:${String(payload.control ?? "control")}`;
      const elapsed = performance.now() - (controlRecordTimes.get(controlKey) ?? -Infinity);
      if (elapsed < CONTROL_RECORD_INTERVAL) {
        const previousTimer = controlRecordTimers.get(controlKey);
        if (previousTimer) window.clearTimeout(previousTimer);
        const timer = window.setTimeout(() => {
          controlRecordTimers.delete(controlKey);
          if (get().session?.id !== sessionId || (get().activeModule ?? "unknown") !== module) return;
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
    if (!current || !module || !text.trim() || get().asking) return false;
    const question = text.trim();
    const apparatus = getApparatusContext(module);
    const localReply = dialogueAssistant.respondToQuestion(current, module, question, apparatus);
    let reply = localReply;
    let dialogueProvider: HarnessUiState["dialogueProvider"] = "rules";
    set({ asking: true });
    try {
      if (studentApi.hasSession()) {
        const aiReply = await studentApi.askGuangguang({
          conversationId: current.id,
          question,
          context: {
            area: current.area,
            module,
            apparatus,
            recentEvents: current.events.slice(-18),
            observations: current.observations.slice(-8),
            recentDialogue: (current.dialogue ?? []).filter((message) => message.module === module).slice(-8)
          }
        });
        reply = { ...localReply, text: aiReply.text };
        dialogueProvider = "deepseek-harness";
      }
    } catch {
      dialogueProvider = "rules";
    }
    const latest = get().session;
    if (!latest || latest.id !== current.id || get().activeModule !== module) {
      set({ asking: false, dialogueProvider });
      return false;
    }
    const session = appendDialogueExchange(latest, module, question, reply);
    set({ session });
    scheduleSave(session);
    set({ asking: false, dialogueProvider });
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
