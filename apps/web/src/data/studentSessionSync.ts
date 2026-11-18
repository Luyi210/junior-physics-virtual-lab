import type { ExperimentSession } from "@physics-lab/contracts";
import type { HarnessEvent } from "@physics-lab/harness";
import { getClassroomExperiment } from "@physics-lab/knowledge/classroom";
import { studentApi } from "./teacherApi";
import { getStudentRecordScope, isCurrentStudentRecordScope, type StudentRecordScope } from "./studentRecordScope";

export type ActiveStudentSession = Pick<ExperimentSession, "id" | "schoolId" | "learnerId" | "taskId" | "classId" | "experimentId" | "status" | "startedAt">;
type QueuedEvent = { sessionId: string; event: { id: string; type: string; area: string; occurredAt: string; payload: Record<string, unknown> } };
const activeKey = (scope: StudentRecordScope) => `physics-active-student-session-v3:${encodeURIComponent(scope.key!)}`;
const queueKey = (scope: StudentRecordScope) => `physics-student-event-queue-v3:${encodeURIComponent(scope.key!)}`;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const canonicalJson = (value: unknown) => JSON.stringify(value, (_key, entry: unknown) => object(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
const sameJson = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function validQueuedEvent(value: unknown): value is QueuedEvent {
  if (!object(value) || !text(value.sessionId) || !object(value.event)) return false;
  const event = value.event;
  return ["id", "type", "area", "occurredAt"].every((key) => text(event[key]))
    && Number.isFinite(Date.parse(String(event.occurredAt))) && object(event.payload);
}

function current(scope: StudentRecordScope, write = false) {
  return typeof window !== "undefined" && studentApi.isConfigured() && isCurrentStudentRecordScope(scope, write);
}
function requireCurrent(scope: StudentRecordScope) {
  if (!current(scope, true) || !studentApi.hasSession()) throw new Error("学生身份已变化或登录已过期，未继续同步这次课堂记录。");
}
function belongs(value: unknown, scope: StudentRecordScope): value is ActiveStudentSession {
  return object(value) && value.schoolId === scope.schoolId && value.learnerId === scope.studentId
    && ["id", "taskId", "classId", "experimentId", "startedAt"].every((key) => text(value[key]))
    && Number.isFinite(Date.parse(String(value.startedAt))) && value.status === "active";
}

/** Global v2 pointers/queues are left untouched: they have no backend or owner proof. */
export function activeStudentSession(scope = getStudentRecordScope()): ActiveStudentSession | null {
  if (!current(scope)) return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(activeKey(scope)) ?? "null");
    return current(scope) && belongs(value, scope) ? value : null;
  } catch { return null; }
}
export function setActiveStudentSession(session: ExperimentSession, scope = getStudentRecordScope()) {
  requireCurrent(scope);
  if (!belongs(session, scope)) throw new Error("这份活动会话不属于当前学生和学校，未改变当前课堂任务。");
  window.localStorage.setItem(activeKey(scope), JSON.stringify({ id: session.id, schoolId: session.schoolId, learnerId: session.learnerId,
    taskId: session.taskId, classId: session.classId, experimentId: session.experimentId, status: session.status, startedAt: session.startedAt } satisfies ActiveStudentSession));
}
export function clearActiveStudentSession(sessionId?: string, scope = getStudentRecordScope()) {
  if (!current(scope, true)) return;
  const active = activeStudentSession(scope);
  if (!sessionId || active?.id === sessionId) window.localStorage.removeItem(activeKey(scope));
}

function queuedEvents(scope: StudentRecordScope): QueuedEvent[] {
  requireCurrent(scope);
  const raw = window.localStorage.getItem(queueKey(scope));
  let value: unknown;
  try { value = JSON.parse(raw ?? "[]"); } catch { throw new Error("本机课堂待同步内容无法解析，请先保留本机副本，暂不能完成归档。"); }
  if (!Array.isArray(value) || value.some((item) => !validQueuedEvent(item))) {
    throw new Error("本机课堂待同步内容格式异常，原文保留，暂不能完成归档。");
  }
  const known = new Map<string, QueuedEvent>();
  for (const item of value as QueuedEvent[]) {
    const id = JSON.stringify([item.sessionId, item.event.id]);
    if (known.has(id) && !sameJson(known.get(id), item)) throw new Error("本机待同步记录出现相同编号的不同内容，请先核对，原文保留。");
    known.set(id, item);
  }
  requireCurrent(scope);
  return value as QueuedEvent[];
}
function saveQueue(scope: StudentRecordScope, queue: QueuedEvent[]) {
  requireCurrent(scope);
  window.localStorage.setItem(queueKey(scope), JSON.stringify(queue));
}
function apiEvent(event: HarnessEvent): QueuedEvent["event"] {
  return { id: event.id, type: event.type, area: event.area, occurredAt: event.occurredAt, payload: event.payload };
}
function isJuniorSession(active: ActiveStudentSession | null): active is ActiveStudentSession {
  return !!active && getClassroomExperiment(active.experimentId)?.stage === "junior";
}
function isSameActiveJuniorSession(scope: StudentRecordScope, active: ActiveStudentSession): boolean {
  if (!current(scope, true) || !studentApi.hasSession()) return false;
  const latest = activeStudentSession(scope);
  return isJuniorSession(latest) && latest.id === active.id && latest.taskId === active.taskId && latest.experimentId === active.experimentId;
}
// A harness session id identifies a local assistant, not a classroom attempt.
function isCurrentJuniorClassroom(scope: StudentRecordScope, active: ActiveStudentSession): boolean {
  if (!isSameActiveJuniorSession(scope, active)) return false;
  try {
    const location = window.location;
    const route = location.hash.startsWith("#/") ? location.hash.slice(1) : `${location.pathname}${location.search}`;
    const actual = new URL(route, "https://classroom.invalid");
    const expected = new URL(getClassroomExperiment(active.experimentId)!.path, "https://classroom.invalid");
    const single = (key: string, value: string) => actual.searchParams.getAll(key).length === 1 && actual.searchParams.get(key) === value;
    return actual.pathname === expected.pathname && single("taskId", active.taskId) && single("sessionId", active.id)
      && [...expected.searchParams].every(([key, value]) => single(key, value));
  } catch { return false; }
}

export async function flushStudentEventQueue(scope?: StudentRecordScope, expectedSession?: ActiveStudentSession) {
  const explicitScope = scope !== undefined;
  scope ??= getStudentRecordScope();
  if (!current(scope, true) || !studentApi.hasSession()) {
    if (explicitScope || expectedSession) requireCurrent(scope);
    return;
  }
  if (expectedSession && !belongs(expectedSession, scope)) throw new Error("待完成的课堂会话与当前学生不一致，未补传或归档。");
  const active = expectedSession ?? activeStudentSession(scope);
  // High-school reports have their own explicit flow. Unsupported queues are not relabelled.
  if (!isJuniorSession(active)) return;
  const matching = queuedEvents(scope).filter((item) => item.sessionId === active.id);
  for (let offset = 0; offset < matching.length; offset += 500) {
    requireCurrent(scope);
    if (!expectedSession && !isSameActiveJuniorSession(scope, active)) return;
    const batch = matching.slice(offset, offset + 500);
    await studentApi.appendSessionEvents(active.id, batch.map((item) => item.event));
    // A successful old request cannot acknowledge another identity's local data.
    requireCurrent(scope);
    const latest = queuedEvents(scope);
    // Match the full sent payload, not just the ID; a changed same-ID copy stays available.
    saveQueue(scope, latest.filter((item) => !batch.some((sent) => sameJson(sent, item))));
  }
  // Another tab can enqueue while a batch is awaiting its ACK. Do not let a
  // completion caller mistake that surviving work for a fully drained queue.
  // A bounded pass avoids endlessly chasing an actively edited experiment.
  if (queuedEvents(scope).some((item) => item.sessionId === active.id)) {
    throw new Error("同步期间又有课堂操作待上传，请先停止其他页面的操作，再重试完成归档；本机记录仍保留。");
  }
}

export async function syncHarnessEvent(event: HarnessEvent) {
  const scope = getStudentRecordScope();
  const active = activeStudentSession(scope);
  if (!isJuniorSession(active) || !isCurrentJuniorClassroom(scope, active)) return;
  const item = { sessionId: active.id, event: apiEvent(event) };
  try {
    await flushStudentEventQueue(scope);
    if (!isCurrentJuniorClassroom(scope, active)) return;
    await studentApi.appendSessionEvents(active.id, [item.event]);
  } catch {
    if (!isCurrentJuniorClassroom(scope, active)) return;
    try { saveQueue(scope, [...queuedEvents(scope), item]); }
    catch { /* Preserve unreadable/full queues; the local harness keeps its own copy. */ }
  }
}
export async function syncHarnessObservation(text: string) {
  const scope = getStudentRecordScope();
  const active = activeStudentSession(scope);
  if (!isJuniorSession(active) || !isCurrentJuniorClassroom(scope, active) || !text.trim()) return;
  try { await studentApi.addObservation(active.id, text.trim()); }
  catch { /* Local notebook remains the offline source of truth. */ }
}
