export type HarnessArea = "optics" | "lens" | "sound" | "mechanics" | "circuit" | "thermal" | "measurement";

export type HarnessEventType =
  | "module.entered"
  | "control.changed"
  | "simulation.toggled"
  | "configuration.changed"
  | "scene.navigated"
  | "view.changed"
  | "observation.created"
  | "insight.read"
  | "dialogue.asked";

export type HarnessValue = string | number | boolean | null;

export type HarnessApparatusValue = HarnessValue;

export interface HarnessApparatusDatum {
  id: string;
  label: string;
  value: HarnessApparatusValue;
  unit?: string;
  source: "control" | "apparatus" | "reading" | "model";
}

export interface HarnessApparatusSnapshot {
  module: string;
  capturedAt: string;
  origin: "learner" | "tutorial" | "system";
  controls: HarnessApparatusDatum[];
  apparatus: HarnessApparatusDatum[];
  readings: HarnessApparatusDatum[];
  derived: HarnessApparatusDatum[];
  validity: {
    ready: boolean;
    issues: string[];
  };
}

export interface HarnessApparatusContext {
  previous?: HarnessApparatusSnapshot;
  current: HarnessApparatusSnapshot;
}

export interface HarnessEvent {
  id: string;
  sessionId: string;
  area: HarnessArea;
  type: HarnessEventType;
  occurredAt: string;
  payload: Record<string, HarnessValue>;
}

export interface HarnessObservation {
  id: string;
  text: string;
  createdAt: string;
  area: HarnessArea;
  relatedEventId?: string;
}

export type HarnessInsightKind = "orientation" | "question" | "method" | "connection";

export interface HarnessInsight {
  id: string;
  ruleId: string;
  kind: HarnessInsightKind;
  title: string;
  message: string;
  createdAt: string;
  relatedEventId: string;
  read: boolean;
}

export type HarnessDialogueRole = "learner" | "assistant";

export type HarnessDialogueIntent = "orientation" | "method" | "explain" | "compare" | "predict" | "reflect";

export interface HarnessDialogueMessage {
  id: string;
  role: HarnessDialogueRole;
  text: string;
  createdAt: string;
  module: string;
  intent?: HarnessDialogueIntent;
  followUps?: string[];
}

export interface HarnessDialogueReply {
  intent: HarnessDialogueIntent;
  text: string;
  followUps: string[];
}

export interface HarnessSession {
  id: string;
  schemaVersion: 1;
  learnerId: string;
  area: HarnessArea;
  startedAt: string;
  updatedAt: string;
  events: HarnessEvent[];
  observations: HarnessObservation[];
  insights: HarnessInsight[];
  dialogue?: HarnessDialogueMessage[];
}

export interface HarnessEventInput {
  type: HarnessEventType;
  payload?: Record<string, HarnessValue>;
  occurredAt?: string;
}

export interface HarnessRuleContext {
  session: HarnessSession;
  event: HarnessEvent;
  eventCount: (type: HarnessEventType) => number;
  hasInsight: (ruleId: string) => boolean;
}

export interface HarnessRule {
  id: string;
  areas?: HarnessArea[];
  priority: number;
  when: (context: HarnessRuleContext) => boolean;
  create: (context: HarnessRuleContext) => Pick<HarnessInsight, "kind" | "title" | "message">;
}

export interface LearningAssistant {
  readonly provider: "rules" | "llm";
  respond(session: HarnessSession, event: HarnessEvent): HarnessInsight[];
}

export interface DialogueAssistant {
  readonly provider: "rules" | "llm";
  respondToQuestion(session: HarnessSession, module: string, question: string, apparatus?: HarnessApparatusContext): HarnessDialogueReply;
}
