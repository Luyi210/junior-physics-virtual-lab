export type ExperimentKind =
  | "lens"
  | "circuit"
  | "balance"
  | "density"
  | "lever"
  | "friction"
  | "boiling";

export interface ExperimentProject<TState = unknown> {
  id: string;
  title: string;
  kind: ExperimentKind;
  schemaVersion: 1;
  state: TState;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentRecord<TValues = Record<string, number | string>> {
  id: string;
  projectId: string;
  capturedAt: string;
  values: TValues;
}

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

export type PlatformRole = "admin" | "teacher" | "student";

export interface PlatformUser {
  id: string;
  schoolId: string;
  email: string;
  name: string;
  role: PlatformRole;
  status: "active" | "disabled";
  lastLoginAt: string | null;
  classIds: string[];
  classNames: string[];
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: PlatformUser;
}

export interface TeachingClass {
  id: string;
  schoolId: string;
  name: string;
  grade: string;
  joinCode: string;
  studentCount: number;
  createdBy: string;
  createdAt: string;
}

export interface TeachingClassMember {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  joinedAt: string;
}

export interface TeachingClassDetail extends TeachingClass {
  members: TeachingClassMember[];
}

export type TeachingLessonStatus = "draft" | "ready" | "archived";

export interface TeachingLesson {
  id: string;
  schoolId: string;
  createdBy: string;
  experimentId: string;
  title: string;
  objective: string;
  inquiryQuestion: string;
  predictionPrompt: string | null;
  controlledVariable: string | null;
  evidenceRequirement: string | null;
  reflectionPrompt: string | null;
  durationMinutes: number;
  status: TeachingLessonStatus;
  createdAt: string;
  updatedAt: string;
}

export type TeachingTaskMode = "before-class" | "in-class" | "after-class";
export type TeachingTaskStatus = "draft" | "published" | "closed" | "archived";

export interface TeachingTask {
  id: string;
  schoolId: string;
  classId: string;
  lessonId: string;
  title: string;
  mode: TeachingTaskMode;
  status: TeachingTaskStatus;
  opensAt: string | null;
  dueAt: string | null;
  allowRetry: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  className?: string;
  lessonTitle?: string;
  experimentId?: string;
}

export interface StudentTaskLessonContext {
  title: string;
  objective: string;
  inquiryQuestion: string;
  predictionPrompt: string | null;
  controlledVariable: string | null;
  evidenceRequirement: string | null;
  reflectionPrompt: string | null;
}

export interface ExperimentSession {
  id: string;
  schoolId: string;
  taskId: string;
  classId: string;
  learnerId: string;
  experimentId: string;
  status: "active" | "completed";
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StudentExperimentSession extends ExperimentSession {
  taskTitle: string;
  className: string;
  lessonTitle: string;
  eventCount: number;
  observationCount: number;
}

export const LEARNING_RECORD_FIELD_LIMITS = {
  prediction: 4000,
  measurements: 12000,
  conclusion: 8000,
  question: 4000
} as const;

export interface LearningRecordContent {
  prediction: string;
  measurements: string;
  conclusion: string;
  question: string;
}

export interface LearningRecord extends LearningRecordContent {
  sessionId: string;
  learnerId: string;
  revision: number;
  lastMutationId: string;
  updatedAt: string;
}

export interface SaveLearningRecordRequest extends LearningRecordContent {
  expectedRevision: number;
  mutationId: string;
}

export interface SessionLearningRecord {
  session: ExperimentSession;
  learnerName: string;
  taskTitle: string;
  className: string;
  lessonTitle: string;
  record: LearningRecord | null;
}

export const LEARNING_FEEDBACK_BODY_LIMIT = 4000;

export interface CreateLearningFeedbackRequest {
  body: string;
  expectedRevision: number;
  mutationId: string;
}

/** Append-only teacher feedback, including the report version actually read by the server. */
export interface LearningFeedback {
  id: string;
  schoolId: string;
  classId: string;
  taskId: string;
  sessionId: string;
  learnerId: string;
  authorId: string;
  authorName: string;
  authorRole: "teacher" | "admin";
  body: string;
  reportRevision: number;
  reportUpdatedAt: string;
  reportSnapshot: LearningRecordContent;
  mutationId: string;
  createdAt: string;
}

export interface ApiHealth {
  status: "ok";
  service: "physics-lab-api";
  version: string;
  compatibility: "desktop-managed-accounts-v1";
  capabilities: string[];
  database: "sqlite" | "postgresql";
  lili?: {
    enabled: boolean;
    persona?: "lili";
    fallback?: "guided";
    model?: string | null;
  };
  guangguang?: {
    enabled: boolean;
    provider: string;
    model: string;
    orchestration?: "adaptive-subagent-team-v2";
    specialistCount?: number;
    rag?: {
      enabled: boolean;
      version: string;
      mode: string;
      experiments: number;
      chunks: number;
      graphVertices: number;
      graphEdges: number;
    };
  };
  time: string;
}

export interface GuangguangChatRequest {
  conversationId: string;
  question: string;
  context?: Record<string, unknown>;
}

export interface GuangguangChatReply {
  text: string;
  provider: "deepseek-harness";
  model: string;
  citations?: GuangguangKnowledgeCitation[];
  retrieval?: {
    id: string;
    mode: string;
    confidence: number;
    intent?: string;
    strategy?: "clarify-context" | "guided-next-step" | "safety-first" | "answer-with-evidence";
    experimentStage?: "unknown" | "orientation" | "setup" | "operating" | "collecting" | "observing" | "ready" | "reflecting";
  };
}

export interface GuangguangKnowledgeCitation {
  sourceId: string;
  title: string;
  section: string;
  source: string;
  route?: string;
  score: number;
}

export type CapacitorMode = "charge" | "discharge" | "open";

/** One ideal RC run, with fixed R/C/E and a complete, ordered switch history.
 * Segment starting voltages are derived from this history, never supplied by a client.
 */
export interface CapacitorHistory {
  kind: "capacitor-rc-v1";
  runId: string;
  initialVoltage: 0;
  segments: { startTimeSeconds: number; mode: CapacitorMode }[];
}

/** Virtual apparatus settings, never evidence that a student performed a real experiment. */
export interface LiliSimulationSample {
  id: string;
  parameters: Record<string, number>;
  timeSeconds: number;
  capacitorHistory?: CapacitorHistory;
}

/** User-operated virtual instrument readings; never real-apparatus measurements. */
export interface LiliManualSample {
  id: string;
  kind: "pendulum-timing" | "double-slit-positions" | "mechanical-energy-tape";
  parameters: Record<string, number>;
  /** Original displayed readings and counted intervals; no client-derived metrics or prose. */
  readings: Record<string, number>;
  timeSeconds: number;
}

export interface LiliExperimentContext {
  experimentId: string;
  parameters: Record<string, number>;
  timeSeconds: number;
  recordCount: number;
  /** Required for capacitor-charge, including the current run and every saved sample. */
  capacitorHistory?: CapacitorHistory;
  /** At most the 30 latest local simulation settings; readings are recomputed by the service. */
  samples?: LiliSimulationSample[];
  /** Counted separately from automatic model samples; count is not evidence of mastery. */
  manualRecordCount?: number;
  /** At most the 10 latest saved virtual instrument operations, preserving original readings. */
  manualSamples?: LiliManualSample[];
}

/** Recent completed turns are conversational context, not verified observations. */
export interface LiliDialogueTurn {
  experimentId: string | null;
  question: string;
  answer: string;
}

export interface LiliChatRequest {
  conversationId: string;
  question: string;
  context: LiliExperimentContext | null;
  /** At most three completed turns from this experiment and current identity. */
  recentDialogue?: LiliDialogueTurn[];
}

export interface LiliChatReply {
  text: string;
  mode: "guided" | "ai";
  suggestions: string[];
  sources: { title: string; url: string }[];
}
