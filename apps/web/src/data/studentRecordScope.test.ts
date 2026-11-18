import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STUDENT = "physics-lab-v2-api-student-token";
const TEACHER = "physics-lab-v2-api-teacher-token";
const NOW = 1_800_000_000_000;
const callbacks: Array<() => void> = [];
let values: Map<string, string>;
let browser: EventTarget;
let read: ReturnType<typeof vi.fn<(key: string) => string | null>>;
function token(changes: Record<string, unknown> = {}, signature = "testsignature") {
  const payload = { sub: "student-a", schoolId: "school-a", role: "student", name: "学生甲", exp: NOW / 1000 + 3600, ...changes };
  const binary = Array.from(new TextEncoder().encode(JSON.stringify(payload)), (byte) => String.fromCharCode(byte)).join("");
  return `${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}.${signature}`;
}
function storageEvent(key: string | null) {
  const event = new Event("storage"); Object.defineProperty(event, "key", { value: key }); browser.dispatchEvent(event);
}
const load = () => import("./studentRecordScope");
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", "https://school-a.example.test/api");
  values = new Map(); browser = new EventTarget(); read = vi.fn((key: string) => values.get(key) ?? null);
  Object.assign(browser, { location: { origin: "https://frontend.example.test" }, localStorage: {
    getItem: read, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }
  } });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", new EventTarget());
});
afterEach(() => {
  callbacks.splice(0).forEach((callback) => callback()); vi.useRealTimers();
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules();
});

describe("student classroom record identity", () => {
  it("has no writable guest scope and never reads or migrates v2 records", async () => {
    values.set("physics-learning-record-v2:student-a:session-a", "old report");
    const before = [...values]; const scope = await load(); const current = scope.getStudentRecordScope();
    expect(current).toMatchObject({ mode: "signed-out", key: null, studentId: null, canWrite: false });
    expect(scope.getStudentRecordScope()).toBe(current); expect(Object.isFrozen(current)).toBe(true);
    expect([...values]).toEqual(before); expect(read.mock.calls.every(([key]) => key === STUDENT)).toBe(true);
  });

  it("uses the student's token school/id and ignores cached ids, teacher tokens and archive selection", async () => {
    values.set(STUDENT, token()); values.set(TEACHER, token({ role: "teacher", sub: "teacher-a" }));
    values.set("physics-lab-v2-api-student-id", "obsolete-user");
    const scope = await load(); const before = scope.getStudentRecordScope();
    expect(before).toMatchObject({ mode: "account", studentId: "student-a", schoolId: "school-a", canWrite: true });
    expect(before.key).not.toContain("testsignature"); expect(before.key).not.toContain("obsolete-user");
    const api = await import("./teacherApi"); api.setHighSchoolAuthSelection("teacher");
    expect(scope.getStudentRecordScope()).toBe(before);
    api.setHighSchoolAuthSelection("guest"); expect(scope.getStudentRecordScope()).toBe(before);
    values.set(TEACHER, "invalid"); storageEvent(TEACHER); expect(scope.getStudentRecordScope()).toBe(before);
  });

  it("keeps keys through renewal but invalidates earlier callbacks", async () => {
    values.set(STUDENT, token()); const scope = await load(); const before = scope.getStudentRecordScope();
    values.set(STUDENT, token({ exp: NOW / 1000 + 7200 }, "renewed"));
    const renewed = scope.getStudentRecordScope();
    expect(renewed.key).toBe(before.key); expect(renewed.revision).toBeGreaterThan(before.revision);
    expect(scope.isCurrentStudentRecordScope(before)).toBe(false); expect(scope.isCurrentStudentRecordScope(renewed, true)).toBe(true);
  });

  it("separates equal ids across schools and backend namespaces", async () => {
    values.set(STUDENT, token()); let scope = await load(); const first = scope.getStudentRecordScope();
    values.set(STUDENT, token({ schoolId: "school-b" })); const schoolB = scope.getStudentRecordScope();
    expect(schoolB.key).not.toBe(first.key);
    values.set(STUDENT, token()); vi.stubEnv("VITE_API_URL", "https://school-b.example.test/api"); vi.resetModules();
    scope = await load(); expect(scope.getStudentRecordScope().key).not.toBe(first.key);
  });

  it("keeps an expired account readable with the same key, but no stale or expired writes", async () => {
    values.set(STUDENT, token({ exp: NOW / 1000 + 1 })); const scope = await load(); const before = scope.getStudentRecordScope();
    const changed = vi.fn(); callbacks.push(scope.subscribeStudentRecordScope(changed));
    await vi.advanceTimersByTimeAsync(1000); const expired = scope.getStudentRecordScope();
    expect(expired).toMatchObject({ key: before.key, mode: "account", canWrite: false });
    expect(scope.isCurrentStudentRecordScope(before)).toBe(false);
    expect(scope.isCurrentStudentRecordScope(expired)).toBe(true); expect(scope.isCurrentStudentRecordScope(expired, true)).toBe(false);
    expect(expired.label).toContain("只读"); expect(changed).toHaveBeenCalledTimes(1);
  });

  it("rechecks expiry on operations, focus and visibility after a suspended timer", async () => {
    values.set(STUDENT, token({ exp: NOW / 1000 + 1 })); const scope = await load(); const before = scope.getStudentRecordScope();
    vi.setSystemTime(NOW + 2000); expect(scope.isCurrentStudentRecordScope(before, true)).toBe(false);
    values.set(STUDENT, token({ exp: NOW / 1000 + 4 })); const renewed = scope.getStudentRecordScope();
    const changed = vi.fn(); callbacks.push(scope.subscribeStudentRecordScope(changed));
    vi.setSystemTime(NOW + 5000); browser.dispatchEvent(new Event("focus"));
    expect(scope.getStudentRecordScope().canWrite).toBe(false); expect(scope.isCurrentStudentRecordScope(renewed)).toBe(false);
    document.dispatchEvent(new Event("visibilitychange")); expect(changed).toHaveBeenCalledTimes(1);
  });

  it("notifies once for same-tab login/logout even though both auth events are emitted", async () => {
    const scope = await load(); scope.getStudentRecordScope(); const changed = vi.fn(); callbacks.push(scope.subscribeStudentRecordScope(changed));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { accessToken: token(), user: { id: "student-a" } } }), { status: 200 })));
    const api = await import("./teacherApi"); await api.studentApi.login("student@example.invalid", "test");
    expect(scope.getStudentRecordScope().studentId).toBe("student-a"); expect(changed).toHaveBeenCalledTimes(1);
    api.studentApi.logout(); expect(scope.getStudentRecordScope().mode).toBe("signed-out"); expect(changed).toHaveBeenCalledTimes(2);
  });

  it("responds to cross-tab student tokens and clear, but not unrelated archive writes", async () => {
    values.set(STUDENT, token()); const scope = await load(); const before = scope.getStudentRecordScope();
    const changed = vi.fn(); callbacks.push(scope.subscribeStudentRecordScope(changed));
    values.set(STUDENT, token({ sub: "student-b" })); storageEvent(STUDENT);
    expect(scope.getStudentRecordScope().studentId).toBe("student-b"); expect(scope.isCurrentStudentRecordScope(before)).toBe(false);
    storageEvent("physics-learning-record-v3:unrelated"); expect(changed).toHaveBeenCalledTimes(1);
    values.clear(); storageEvent(null); expect(scope.getStudentRecordScope().mode).toBe("signed-out"); expect(changed).toHaveBeenCalledTimes(2);
  });

  it("fails closed for malformed tokens or wrong roles without falling through to a teacher", async () => {
    const scope = await load(); values.set(TEACHER, token({ role: "teacher" }));
    for (const value of ["abc", "a.b.c", "e30.signature", token({ role: "teacher" }), token({ sub: "" }), token({ schoolId: "\ud800" }), token({ exp: "9999999999" }), token({ exp: null })]) {
      values.set(STUDENT, value); expect(scope.getStudentRecordScope()).toMatchObject({ mode: "blocked", key: null, canWrite: false });
    }
  });

  it("does not inspect accounts in demo mode or without a browser", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "true"); values.set(STUDENT, token()); const scope = await load();
    expect(scope.getStudentRecordScope()).toMatchObject({ mode: "demo", key: null, canWrite: false }); expect(read).not.toHaveBeenCalled();
    vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubGlobal("window", undefined); vi.resetModules();
    expect((await load()).getStudentRecordScope()).toMatchObject({ mode: "blocked", key: null });
  });

  it("blocks unreadable identity and invalidates old callbacks when storage recovers", async () => {
    values.set(STUDENT, token()); const scope = await load(); const before = scope.getStudentRecordScope();
    read.mockImplementation(() => { throw new Error("SecurityError"); });
    expect(scope.getStudentRecordScope()).toMatchObject({ mode: "blocked", key: null });
    read.mockImplementation((key) => values.get(key) ?? null); const recovered = scope.getStudentRecordScope();
    expect(recovered.key).toBe(before.key); expect(recovered.revision).toBeGreaterThan(before.revision); expect(scope.isCurrentStudentRecordScope(before)).toBe(false);
  });

  it("defers getter notifications and safely permits subscribers to read the snapshot", async () => {
    values.set(STUDENT, token()); const scope = await load(); scope.getStudentRecordScope();
    const observed: unknown[] = []; callbacks.push(scope.subscribeStudentRecordScope(() => observed.push(scope.getStudentRecordScope())));
    values.set(STUDENT, token({ sub: "student-b" })); const next = scope.getStudentRecordScope();
    expect(observed).toEqual([]); await vi.runAllTicks(); expect(observed).toEqual([next]);
  });

  it("cancels a queued notification when an immediate auth event already delivers the newer state", async () => {
    values.set(STUDENT, token()); const scope = await load(); scope.getStudentRecordScope();
    const changed = vi.fn(); callbacks.push(scope.subscribeStudentRecordScope(changed));
    values.set(STUDENT, token({ sub: "student-b" })); scope.getStudentRecordScope();
    values.set(STUDENT, token({ sub: "student-c" })); storageEvent(STUDENT);
    await vi.runAllTicks(); expect(changed).toHaveBeenCalledTimes(1); expect(scope.getStudentRecordScope().studentId).toBe("student-c");
  });

  it("releases all subscriptions and timers", async () => {
    values.set(STUDENT, token()); const scope = await load(); scope.getStudentRecordScope();
    const listener = vi.fn(); const stop = scope.subscribeStudentRecordScope(listener);
    expect(vi.getTimerCount()).toBeGreaterThan(0); stop(); expect(vi.getTimerCount()).toBe(0);
    values.set(STUDENT, token({ sub: "student-b" })); storageEvent(STUDENT); browser.dispatchEvent(new Event("focus"));
    expect(listener).not.toHaveBeenCalled();
  });
});
