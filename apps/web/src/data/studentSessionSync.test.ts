import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExperimentSession } from "@physics-lab/contracts";
import type { HarnessEvent } from "@physics-lab/harness";
import { classroomExperiments } from "@physics-lab/knowledge/classroom";
import type { StudentRecordScope } from "./studentRecordScope";

const api = vi.hoisted(() => ({ isConfigured: vi.fn(), hasSession: vi.fn(), appendSessionEvents: vi.fn(), addObservation: vi.fn() }));
const identity = vi.hoisted(() => ({ current: null as StudentRecordScope | null }));
vi.mock("./teacherApi", () => ({ studentApi: api }));
vi.mock("./studentRecordScope", () => ({
  getStudentRecordScope: () => identity.current!,
  isCurrentStudentRecordScope: (scope: StudentRecordScope, requireWrite = false) => {
    const current = identity.current;
    return !!current && current.key !== null && current.mode === 'account' && scope.mode === 'account' &&
      current.key === scope.key && current.revision === scope.revision && current.studentId === scope.studentId &&
      current.schoolId === scope.schoolId && current.apiNamespace === scope.apiNamespace && (!requireWrite || (current.canWrite && scope.canWrite));
  },
}));
import { activeStudentSession, clearActiveStudentSession, flushStudentEventQueue, setActiveStudentSession, syncHarnessEvent, syncHarnessObservation } from "./studentSessionSync";

const OLD_QUEUE = "physics-lab-v2-api-event-queue";
const OLD_ACTIVE = "physics-lab-v2-active-api-session";
function scope(changes: Partial<StudentRecordScope> = {}): StudentRecordScope {
  const value = { key: '', apiNamespace: 'https://school.example.test/api', schoolId: 'school-a', studentId: 'student-a', mode: 'account' as const, label: '学生甲', canWrite: true, revision: 1, ...changes };
  return { ...value, key: changes.key === undefined ? `student:${encodeURIComponent(value.apiNamespace)}:${encodeURIComponent(value.schoolId!)}:${encodeURIComponent(value.studentId!)}` : changes.key };
}
const queueKey = (value = identity.current!) => `physics-student-event-queue-v3:${encodeURIComponent(value.key!)}`;
const activeKey = (value = identity.current!) => `physics-active-student-session-v3:${encodeURIComponent(value.key!)}`;
let QUEUE: string;
let ACTIVE: string;
let values: Map<string, string>;
let location: { hash: string; pathname: string; search: string };
let storage: { getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>; setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>; removeItem: ReturnType<typeof vi.fn<(key: string) => void>> };
const event: HarnessEvent = { id: "event-current", sessionId: "harness-local-learner-circuit", area: "circuit", type: "control.changed", occurredAt: "2026-11-11T00:00:00Z", payload: { experiment: "circuit-ohm", control: "resistance", value: 5 } };
const queued = (id = "queued", sessionId = "session-a") => ({ sessionId, event: { id, type: event.type, area: event.area, occurredAt: event.occurredAt, payload: event.payload } });
function session(experimentId = "circuit-ohm", id = "session-a"): ExperimentSession {
  return { id, taskId: "task-a", classId: "class-a", experimentId, learnerId: "student-a", schoolId: "school-a", status: "active", startedAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z", completedAt: null };
}
function route(value = "/student/explore/circuit?module=circuit-ohm&taskId=task-a&sessionId=session-a") { location.hash = `#${value}`; }
beforeEach(() => {
  vi.resetAllMocks();
  identity.current = scope(); QUEUE = queueKey(); ACTIVE = activeKey();
  values = new Map();
  location = { hash: "", pathname: "/hosted-product/index.html", search: "" };
  storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) };
  vi.stubGlobal("window", { location, localStorage: storage });
  api.isConfigured.mockReturnValue(true); api.hasSession.mockReturnValue(true);
  api.appendSessionEvents.mockResolvedValue({ accepted: 1 }); api.addObservation.mockResolvedValue({});
  setActiveStudentSession(session()); route();
});
afterEach(() => vi.unstubAllGlobals());

describe("classroom ownership of automatic junior harness synchronization", () => {
  it.each([...classroomExperiments.filter((item) => item.stage === "high-school").map((item) => item.id), "mechanical-energy", "unknown-experiment"])("does not send new or queued junior evidence to %s", async (id) => {
    setActiveStudentSession(session(id));
    const original = JSON.stringify([queued(), queued("other", "other-session")]); values.set(QUEUE, original);
    await syncHarnessEvent(event); await syncHarnessObservation("保留本机观察"); await flushStudentEventQueue();
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(api.addObservation).not.toHaveBeenCalled();
    expect(values.get(QUEUE)).toBe(original);
  });

  it.each([
    "/student/explore/circuit?module=circuit-ohm",
    "/student/explore/circuit?module=circuit-ohm&taskId=other&sessionId=session-a",
    "/student/explore/circuit?module=circuit-ohm&taskId=task-a&sessionId=other",
    "/student/explore/circuit?module=circuit-basic&taskId=task-a&sessionId=session-a",
    "/student/explore/circuit?taskId=task-a&sessionId=session-a",
    "/student/explore/mechanics?module=circuit-ohm&taskId=task-a&sessionId=session-a",
    "/student?taskId=task-a&sessionId=session-a",
  ])("keeps operations without a matching teaching route local: %s", async (path) => {
    route(path); values.set(QUEUE, JSON.stringify([queued()]));
    await syncHarnessEvent(event); await syncHarnessObservation("自由探究");
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(api.addObservation).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([queued()]);
  });

  it("sends matching classroom events and observations with the API attempt id, not the local harness id", async () => {
    await syncHarnessEvent(event); await syncHarnessObservation("  电阻改变后电流变化  ");
    expect(api.appendSessionEvents).toHaveBeenCalledWith("session-a", [{ id: event.id, type: event.type, area: event.area, occurredAt: event.occurredAt, payload: event.payload }]);
    expect(api.addObservation).toHaveBeenCalledWith("session-a", "电阻改变后电流变化");
  });

  it("also checks optics mode and supports non-hash development URLs", async () => {
    setActiveStudentSession(session("reflection"));
    route("/student/explore/light?mode=refraction&taskId=task-a&sessionId=session-a");
    await syncHarnessObservation("不是反射课堂"); expect(api.addObservation).not.toHaveBeenCalled();
    location.hash = ""; location.pathname = "/student/explore/light"; location.search = "?mode=reflection&taskId=task-a&sessionId=session-a";
    await syncHarnessObservation("反射课堂"); expect(api.addObservation).toHaveBeenCalledWith("session-a", "反射课堂");
  });

  it("keeps a failed matching event for retry and permits an existing junior queue to flush from the task centre", async () => {
    api.appendSessionEvents.mockRejectedValueOnce(new Error("offline"));
    await syncHarnessEvent(event);
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([{ sessionId: "session-a", event: expect.objectContaining({ id: event.id }) }]);
    route("/student"); await flushStudentEventQueue();
    expect(api.appendSessionEvents).toHaveBeenCalledTimes(2); expect(JSON.parse(values.get(QUEUE)!)).toEqual([]);
  });

  it("retains newly queued and other-session items and reports the unfinished older flush", async () => {
    values.set(QUEUE, JSON.stringify([queued()]));
    api.appendSessionEvents.mockImplementationOnce(async () => { values.set(QUEUE, JSON.stringify([queued(), queued("new"), queued("other", "other-session")])); });
    await expect(flushStudentEventQueue()).rejects.toThrow('又有课堂操作待上传');
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([queued("new"), queued("other", "other-session")]);
  });

  it("preserves more than 500 offline events and flushes bounded batches without dropping older evidence", async () => {
    const existing = Array.from({ length: 500 }, (_, index) => queued(`old-${index}`));
    values.set(QUEUE, JSON.stringify(existing));
    api.appendSessionEvents.mockRejectedValueOnce(new Error("offline"));
    await syncHarnessEvent(event);
    const backlog = JSON.parse(values.get(QUEUE)!);
    expect(backlog).toHaveLength(501); expect(backlog.slice(0, 500)).toEqual(existing);
    api.appendSessionEvents.mockClear(); await flushStudentEventQueue();
    expect(api.appendSessionEvents.mock.calls.map((call) => call[1].length)).toEqual([500, 1]);
    expect(values.get(QUEUE)).toBe("[]");
  });

  it("does not replace an unreadable queue with a new event", async () => {
    for (const original of ["broken json", "null", '{"old":"unrecognized queue"}']) {
      values.set(QUEUE, original);
      await syncHarnessEvent(event);
      expect(values.get(QUEUE)).toBe(original);
      await expect(flushStudentEventQueue()).rejects.toThrow();
      expect(values.get(QUEUE)).toBe(original);
    }
    expect(api.appendSessionEvents).not.toHaveBeenCalled();
  });

  it("rechecks the classroom after an awaited flush before posting a new event", async () => {
    values.set(QUEUE, JSON.stringify([queued()]));
    api.appendSessionEvents.mockImplementationOnce(async () => { setActiveStudentSession(session("pendulum", "high-school-session")); });
    await syncHarnessEvent(event);
    expect(api.appendSessionEvents).toHaveBeenCalledTimes(1);
    expect(api.appendSessionEvents.mock.calls[0]?.[0]).toBe("session-a");
    expect(values.get(QUEUE)).toBe("[]");
  });

  it("does not queue an old request under a replacement session after a failed flush", async () => {
    const original = JSON.stringify([queued()]); values.set(QUEUE, original);
    api.appendSessionEvents.mockImplementationOnce(async () => { setActiveStudentSession(session("pendulum", "replacement")); throw new Error("changed identity"); });
    await syncHarnessEvent(event);
    expect(values.get(QUEUE)).toBe(original);
  });

  it("does not synchronize after logout, completion, malformed active data or without a browser", async () => {
    for (const stored of ["invalid-json", "null", JSON.stringify({ ...session(), status: "completed" })]) {
      values.set(ACTIVE, stored); await syncHarnessEvent(event); await syncHarnessObservation("观察"); await flushStudentEventQueue();
    }
    setActiveStudentSession(session()); identity.current = scope({ mode: 'signed-out', key: null, canWrite: false, studentId: null, schoolId: null, revision: 2 });
    await syncHarnessEvent(event); await syncHarnessObservation("观察"); await flushStudentEventQueue();
    vi.stubGlobal("window", undefined); await syncHarnessEvent(event); await flushStudentEventQueue();
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(api.addObservation).not.toHaveBeenCalled();
  });
});

describe('student namespace ownership of event queues and active sessions', () => {
  it('never reads, migrates or deletes the old shared v2 active/queue keys', async () => {
    values.delete(ACTIVE); values.set(OLD_ACTIVE, JSON.stringify(session())); values.set(OLD_QUEUE, JSON.stringify([queued()]));
    const before = [...values]; storage.getItem.mockClear(); storage.setItem.mockClear(); storage.removeItem.mockClear();
    expect(activeStudentSession()).toBeNull();
    await syncHarnessEvent(event); await syncHarnessObservation('旧全局队列不能认领'); await flushStudentEventQueue();
    expect(storage.getItem.mock.calls.some(([key]) => key === OLD_ACTIVE || key === OLD_QUEUE)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled();
    expect([...values]).toEqual(before); expect(api.appendSessionEvents).not.toHaveBeenCalled();
  });

  it.each([{ studentId: 'student-b' }, { schoolId: 'school-b' }, { apiNamespace: 'https://other.example.test/api' }])('separates same session IDs across %j', async (change) => {
    const original = identity.current!; const originalActive = values.get(ACTIVE)!; const originalQueue = JSON.stringify([queued()]); values.set(QUEUE, originalQueue);
    identity.current = scope(change);
    expect(activeStudentSession()).toBeNull();
    await flushStudentEventQueue();
    expect(api.appendSessionEvents).not.toHaveBeenCalled();
    setActiveStudentSession({ ...session(), learnerId: identity.current.studentId!, schoolId: identity.current.schoolId! });
    values.set(queueKey(), JSON.stringify([queued('new-owner-event')]));
    await flushStudentEventQueue();
    expect(values.get(queueKey())).toBe('[]');
    clearActiveStudentSession('session-a');
    expect(values.has(activeKey())).toBe(false); expect(values.get(activeKey(original))).toBe(originalActive); expect(values.get(queueKey(original))).toBe(originalQueue);
  });

  it('rejects active-session writes for a different learner or school and preserves existing data', () => {
    const before = [...values];
    expect(() => setActiveStudentSession({ ...session(), learnerId: 'other' })).toThrow();
    expect(() => setActiveStudentSession({ ...session(), schoolId: 'other' })).toThrow();
    expect([...values]).toEqual(before);
  });

  it('rejects stale or read-only mutation handles without deleting the previous active session', async () => {
    const original = identity.current!; const before = values.get(ACTIVE);
    identity.current = scope({ revision: 2 });
    expect(activeStudentSession(original)).toBeNull();
    expect(() => setActiveStudentSession(session(), original)).toThrow();
    clearActiveStudentSession('session-a', original);
    expect(values.get(ACTIVE)).toBe(before);
    await expect(flushStudentEventQueue(original, session())).rejects.toThrow();
    identity.current = scope({ revision: 3, canWrite: false });
    expect(() => setActiveStudentSession(session(), identity.current!)).toThrow();
    clearActiveStudentSession('session-a', identity.current!);
    await expect(flushStudentEventQueue(identity.current!, session())).rejects.toThrow();
    expect(values.get(ACTIVE)).toBe(before); expect(api.appendSessionEvents).not.toHaveBeenCalled();
  });

  it('clears only the matching active session under the current scope', () => {
    clearActiveStudentSession('different-session'); expect(activeStudentSession()?.id).toBe('session-a');
    clearActiveStudentSession('session-a'); expect(activeStudentSession()).toBeNull();
    setActiveStudentSession(session()); clearActiveStudentSession(); expect(activeStudentSession()).toBeNull();
  });

  it.each(['student', 'school', 'backend', 'renewal', 'expired'] as const)('keeps an old ACK queue intact after %s changes', async (change) => {
    const original = identity.current!; const serialized = JSON.stringify([queued()]); values.set(QUEUE, serialized);
    api.appendSessionEvents.mockImplementationOnce(async () => {
      identity.current = scope(change === 'student' ? { studentId: 'other' } : change === 'school' ? { schoolId: 'other' }
        : change === 'backend' ? { apiNamespace: 'https://other.example.test/api' } : { revision: 2, canWrite: change !== 'expired' });
    });
    await expect(flushStudentEventQueue(original)).rejects.toThrow();
    expect(values.get(queueKey(original))).toBe(serialized); expect(api.appendSessionEvents).toHaveBeenCalledTimes(1);
    // A new scope revision can retry the same account's stable queue without changing its event ID.
    if (change === 'renewal') {
      api.appendSessionEvents.mockResolvedValue({ accepted: 0 }); await flushStudentEventQueue(identity.current!);
      expect(values.get(QUEUE)).toBe('[]'); expect(api.appendSessionEvents.mock.calls[1]?.[1][0].id).toBe('queued');
    }
  });

  it('stops a long backlog between batches after identity renewal', async () => {
    const original = identity.current!; const backlog = Array.from({ length: 501 }, (_, index) => queued(`queued-${index}`)); values.set(QUEUE, JSON.stringify(backlog));
    api.appendSessionEvents.mockImplementationOnce(async () => { identity.current = scope({ revision: 2 }); });
    await expect(flushStudentEventQueue(original)).rejects.toThrow();
    expect(api.appendSessionEvents).toHaveBeenCalledTimes(1); expect(api.appendSessionEvents.mock.calls[0]?.[1]).toHaveLength(500);
    expect(JSON.parse(values.get(QUEUE)!)).toEqual(backlog);
  });

  it('does not delete a same-ID event whose complete payload changed while awaiting acknowledgement', async () => {
    const before = queued(); const changed = { ...before, event: { ...before.event, payload: { ...before.event.payload, value: 9 } } };
    values.set(QUEUE, JSON.stringify([before]));
    api.appendSessionEvents.mockImplementationOnce(async () => { values.set(QUEUE, JSON.stringify([changed, queued('new')])); });
    await expect(flushStudentEventQueue()).rejects.toThrow('又有课堂操作待上传');
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([changed, queued('new')]);
  });

  it.each(['area', 'occurredAt', 'type'] as const)('keeps a same-ID event if its %s changed during a request', async (field) => {
    const before = queued(); const changed = { ...before, event: { ...before.event, [field]: field === 'occurredAt' ? '2026-11-11T00:00:01Z' : 'changed' } };
    values.set(QUEUE, JSON.stringify([before]));
    api.appendSessionEvents.mockImplementationOnce(async () => { values.set(QUEUE, JSON.stringify([changed])); });
    await expect(flushStudentEventQueue()).rejects.toThrow('又有课堂操作待上传'); expect(JSON.parse(values.get(QUEUE)!)).toEqual([changed]);
  });

  it('refuses completion when another same-session event arrives during the final batch, then permits a bounded retry', async () => {
    values.set(QUEUE, JSON.stringify([queued()]));
    api.appendSessionEvents.mockImplementationOnce(async () => { values.set(QUEUE, JSON.stringify([queued(), queued('new'), queued('other', 'other-session')])); });
    await expect(flushStudentEventQueue(identity.current!, session())).rejects.toThrow('又有课堂操作待上传');
    expect(api.appendSessionEvents).toHaveBeenCalledTimes(1);
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([queued('new'), queued('other', 'other-session')]);
    await flushStudentEventQueue(identity.current!, session());
    expect(api.appendSessionEvents).toHaveBeenCalledTimes(2);
    expect(api.appendSessionEvents.mock.calls[1]).toEqual(['session-a', [queued('new').event]]);
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([queued('other', 'other-session')]);
  });

  it('uses a verified expected session to flush its backlog even when no local active pointer exists', async () => {
    values.delete(ACTIVE); const original = JSON.stringify([queued(), queued('other', 'other-session')]); values.set(QUEUE, original);
    route('/student'); await flushStudentEventQueue(identity.current!, session());
    expect(api.appendSessionEvents).toHaveBeenCalledExactlyOnceWith('session-a', [queued().event]);
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([queued('other', 'other-session')]); expect(values.has(ACTIVE)).toBe(false);
  });

  it('flushes the specified cloud session without borrowing or replacing a different active pointer', async () => {
    setActiveStudentSession(session('circuit-basic', 'another-active')); const pointer = values.get(ACTIVE);
    values.set(QUEUE, JSON.stringify([queued(), queued('keep', 'another-active')]));
    await flushStudentEventQueue(identity.current!, session());
    expect(api.appendSessionEvents).toHaveBeenCalledExactlyOnceWith('session-a', [queued().event]);
    expect(JSON.parse(values.get(QUEUE)!)).toEqual([queued('keep', 'another-active')]); expect(values.get(ACTIVE)).toBe(pointer);
  });

  it.each([{ learnerId: 'other' }, { schoolId: 'other' }, { status: 'completed' as const }])('refuses invalid expected-session ownership or lifecycle: %j', async (change) => {
    const original = JSON.stringify([queued()]); values.set(QUEUE, original);
    await expect(flushStudentEventQueue(identity.current!, { ...session(), ...change })).rejects.toThrow();
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(values.get(QUEUE)).toBe(original);
  });

  it.each(['pendulum', 'mechanical-energy', 'unknown'])('never promotes a %s expected session to a junior event queue', async (id) => {
    const original = JSON.stringify([queued()]); values.set(QUEUE, original);
    await flushStudentEventQueue(identity.current!, session(id));
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(values.get(QUEUE)).toBe(original);
  });

  it('rejects an unreadable expected-session queue so a completion caller cannot mistake it for an empty queue', async () => {
    values.delete(ACTIVE); values.set(QUEUE, 'damaged data');
    await expect(flushStudentEventQueue(identity.current!, session())).rejects.toThrow();
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(values.get(QUEUE)).toBe('damaged data');
  });

  it('keeps an acknowledged batch when queue rereading fails and makes automatic entry failures non-throwing', async () => {
    const original = JSON.stringify([queued()]); values.set(QUEUE, original);
    api.appendSessionEvents.mockImplementationOnce(async () => { storage.getItem.mockImplementation((key) => { if (key === QUEUE) throw new Error('read blocked'); return values.get(key) ?? null; }); });
    await expect(flushStudentEventQueue()).rejects.toThrow();
    expect(values.get(QUEUE)).toBe(original);
    await expect(syncHarnessEvent(event)).resolves.toBeUndefined();
    expect(values.get(QUEUE)).toBe(original);
  });

  it('blocks conflicting same-ID payloads before posting and preserves their original queue text', async () => {
    const first = queued(); const other = { ...first, event: { ...first.event, payload: { ...first.event.payload, value: 8 } } };
    const original = JSON.stringify([first, other]); values.set(QUEUE, original);
    await expect(flushStudentEventQueue(identity.current!, session())).rejects.toThrow();
    await expect(syncHarnessEvent(event)).resolves.toBeUndefined();
    expect(api.appendSessionEvents).not.toHaveBeenCalled(); expect(values.get(QUEUE)).toBe(original);
  });

  it('retains acknowledged queue entries if saving the reduced queue fails', async () => {
    const original = JSON.stringify([queued()]); values.set(QUEUE, original);
    storage.setItem.mockImplementation((key, value) => { if (key === QUEUE) throw new Error('storage unavailable'); values.set(key, value); });
    await expect(flushStudentEventQueue(identity.current!, session())).rejects.toThrow('storage unavailable');
    expect(api.appendSessionEvents).toHaveBeenCalledTimes(1); expect(values.get(QUEUE)).toBe(original);
    await expect(syncHarnessEvent(event)).resolves.toBeUndefined(); expect(values.get(QUEUE)).toBe(original);
  });
});
