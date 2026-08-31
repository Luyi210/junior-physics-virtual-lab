import type { ExperimentSession } from "@physics-lab/contracts";
import type { HarnessEvent } from "@physics-lab/harness";
import { studentApi } from "./teacherApi";

const ACTIVE_SESSION_KEY = "physics-lab-v2-active-api-session";
const EVENT_QUEUE_KEY = "physics-lab-v2-api-event-queue";

export type ActiveStudentSession = Pick<ExperimentSession, "id" | "taskId" | "classId" | "experimentId" | "status" | "startedAt">;

export function activeStudentSession(): ActiveStudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTIVE_SESSION_KEY) ?? "null") as ActiveStudentSession | null;
    return value?.status === "active" ? value : null;
  } catch {
    return null;
  }
}

export function setActiveStudentSession(session: ExperimentSession) {
  window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
    id: session.id,
    taskId: session.taskId,
    classId: session.classId,
    experimentId: session.experimentId,
    status: session.status,
    startedAt: session.startedAt
  } satisfies ActiveStudentSession));
}

export function clearActiveStudentSession(sessionId?: string) {
  const active = activeStudentSession();
  if (!sessionId || active?.id === sessionId) window.localStorage.removeItem(ACTIVE_SESSION_KEY);
}

type QueuedEvent = { sessionId: string; event: { id: string; type: string; area: string; occurredAt: string; payload: Record<string, unknown> } };

function queuedEvents(): QueuedEvent[] {
  try { return JSON.parse(window.localStorage.getItem(EVENT_QUEUE_KEY) ?? "[]") as QueuedEvent[]; } catch { return []; }
}

function saveQueue(queue: QueuedEvent[]) {
  window.localStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(queue.slice(-500)));
}

function apiEvent(event: HarnessEvent): QueuedEvent["event"] {
  return { id: event.id, type: event.type, area: event.area, occurredAt: event.occurredAt, payload: event.payload };
}

export async function flushStudentEventQueue() {
  const active = activeStudentSession();
  if (!active || !studentApi.hasSession()) return;
  const queue = queuedEvents();
  const matching = queue.filter((item) => item.sessionId === active.id);
  if (!matching.length) return;
  await studentApi.appendSessionEvents(active.id, matching.map((item) => item.event));
  saveQueue(queue.filter((item) => item.sessionId !== active.id));
}

export async function syncHarnessEvent(event: HarnessEvent) {
  const active = activeStudentSession();
  if (!active || !studentApi.hasSession()) return;
  const item = { sessionId: active.id, event: apiEvent(event) };
  try {
    await flushStudentEventQueue();
    await studentApi.appendSessionEvents(active.id, [item.event]);
  } catch {
    saveQueue([...queuedEvents(), item]);
  }
}

export async function syncHarnessObservation(text: string) {
  const active = activeStudentSession();
  if (!active || !studentApi.hasSession() || !text.trim()) return;
  try { await studentApi.addObservation(active.id, text.trim()); } catch { /* Local notebook remains the offline source of truth. */ }
}
