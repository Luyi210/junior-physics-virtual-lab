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

export interface ApiHealth {
  status: "ok";
  service: "physics-lab-api";
  version: string;
  compatibility: "desktop-managed-accounts-v1";
  capabilities: string[];
  database: "sqlite" | "postgresql";
  time: string;
}
