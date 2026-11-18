import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STUDENT = "physics-lab-v2-api-student-token";
const TEACHER = "physics-lab-v2-api-teacher-token";
const LEGACY = "physics-lab-v2-api-access-token";
const NOW = 1_800_000_000_000;
class MemoryStorage {
  data = new Map<string, string>();
  failRead = false;
  failWrite = false;
  getItem(key: string) { if (this.failRead) throw new Error("Storage unavailable"); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error("Quota exceeded"); this.data.set(key, value); }
  removeItem(key: string) { if (this.failWrite) throw new Error("Storage unavailable"); this.data.delete(key); }
  clear() { this.data.clear(); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  get length() { return this.data.size; }
}
let storage: MemoryStorage;
let browser: EventTarget;
const unsubscribes: Array<() => void> = [];
function token(changes: Record<string, unknown> = {}, signature = "testsignature") {
  const payload = { sub: "student-a", schoolId: "school-a", role: "student", name: "同学甲", exp: NOW / 1000 + 3600, ...changes };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return `${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")}.${signature}`;
}
function storageEvent(key: string | null) {
  const event = new Event("storage"); Object.defineProperty(event, "key", { value: key }); browser.dispatchEvent(event);
}
const load = () => import("./highSchoolRecordScope");

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  vi.stubEnv("VITE_DEMO_ONLY", "false");
  vi.stubEnv("VITE_API_URL", "https://school.example.test/api");
  storage = new MemoryStorage(); browser = new EventTarget();
  Object.assign(browser, { localStorage: storage, location: { origin: "https://lab.example.test" } });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", new EventTarget());
});
afterEach(() => {
  for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules();
});

describe("high-school local record identity", () => {
  it("returns a stable guest snapshot without reading or migrating old archives", async () => {
    storage.setItem("physics-high-school-measurements-v1:pendulum", "old-v1");
    storage.setItem("physics-high-school-measurements-v2:pendulum:record:initial:a", "old-v2");
    const before = [...storage.data];
    const scope = await load();
    const guest = scope.getHighSchoolRecordScope();
    expect(guest).toMatchObject({ mode: "guest", canWrite: true, authChannel: null });
    expect(scope.getHighSchoolRecordScope()).toBe(guest);
    expect(scope.getHighSchoolRecordScopeOptions()).toEqual([{ channel: "guest", label: "游客档案 · 当前浏览器共享", expired: false, selected: true }]);
    expect([...storage.data]).toEqual(before);
  });

  it("classifies the two-part account token instead of trusting a stale cached student id", async () => {
    storage.setItem(STUDENT, token()); storage.setItem("physics-lab-v2-api-student-id", "another-person");
    const scope = await load(); const account = scope.getHighSchoolRecordScope();
    expect(account).toMatchObject({ mode: "account", canWrite: true, authChannel: "student" });
    expect(account.label).toContain("同学甲");
    expect(account.key).toContain(":school-a:student:student-a");
    expect(account.key).not.toContain("another-person");
    expect(account.key).not.toContain("testsignature");
    expect(scope.isCurrentHighSchoolRecordScope(account, true)).toBe(true);
  });

  it("requires explicit selection when student and teacher tokens coexist", async () => {
    storage.setItem(STUDENT, token()); storage.setItem(TEACHER, token({ sub: "teacher-a", role: "teacher", name: "老师甲" }));
    const scope = await load();
    const initial = scope.getHighSchoolRecordScope();
    expect(initial).toMatchObject({ mode: "blocked", key: null, canWrite: false });
    expect(scope.getHighSchoolRecordScopeOptions().map((option) => option.channel)).toEqual(["student", "teacher", "guest"]);
    const teacher = scope.selectHighSchoolRecordScope("teacher");
    expect(teacher).toMatchObject({ mode: "account", authChannel: "teacher", canWrite: true });
    expect(scope.getHighSchoolRecordScopeOptions().find((option) => option.selected)?.channel).toBe("teacher");
    expect(scope.isCurrentHighSchoolRecordScope(initial)).toBe(false);
    expect(scope.selectHighSchoolRecordScope("guest").key).not.toBe(teacher.key);
  });

  it("tracks same-tab student and teacher login/logout through the shared auth event", async () => {
    const scope = await load(); const initial = scope.getHighSchoolRecordScope();
    const changed = vi.fn(); unsubscribes.push(scope.subscribeHighSchoolRecordScope(changed));
    const api = await import("./teacherApi");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { accessToken: token(), user: { id: "student-a" } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { accessToken: token({ sub: "teacher-a", role: "teacher" }), user: { id: "teacher-a" } } }), { status: 200 })));
    await api.studentApi.login("student@example.test", "test-password");
    expect(scope.getHighSchoolRecordScope().authChannel).toBe("student");
    await api.teacherApi.login("teacher@example.test", "test-password");
    expect(scope.getHighSchoolRecordScope().authChannel).toBe("teacher");
    expect(scope.isCurrentHighSchoolRecordScope(initial)).toBe(false);
    api.teacherApi.logout();
    expect(scope.getHighSchoolRecordScope().mode).toBe("guest");
    expect(storage.getItem(STUDENT)).not.toBeNull();
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it("keeps the storage key across token renewal while invalidating stale callbacks", async () => {
    storage.setItem(STUDENT, token()); const scope = await load(); const before = scope.getHighSchoolRecordScope();
    storage.setItem(STUDENT, token({ exp: NOW / 1000 + 7200 }, "renewedSignature"));
    const after = scope.getHighSchoolRecordScope();
    expect(after.key).toBe(before.key);
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(scope.isCurrentHighSchoolRecordScope(before)).toBe(false);
    expect(scope.getHighSchoolRecordScope()).toBe(after);
  });

  it("keeps a selected student's archive key when an unrelated teacher token changes", async () => {
    storage.setItem(STUDENT, token());
    const scope = await load(); const before = scope.selectHighSchoolRecordScope("student");
    const changed = vi.fn(); unsubscribes.push(scope.subscribeHighSchoolRecordScope(changed));
    storage.setItem(TEACHER, token({ sub: "teacher-a", role: "teacher" })); storageEvent(TEACHER);
    const after = scope.getHighSchoolRecordScope();
    expect(after).toMatchObject({ key: before.key, mode: "account", authChannel: "student", canWrite: true });
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(scope.isCurrentHighSchoolRecordScope(before)).toBe(false);
    expect(scope.isCurrentHighSchoolRecordScope(after, true)).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("separates accounts by school, id, role and backend namespace", async () => {
    const scope = await load(); const keys = new Set<string | null>();
    for (const changes of [{}, { schoolId: "other-school" }, { sub: "other-student" }]) {
      storage.setItem(STUDENT, token(changes)); keys.add(scope.getHighSchoolRecordScope().key);
    }
    storage.clear(); storage.setItem(TEACHER, token({ role: "teacher" })); keys.add(scope.getHighSchoolRecordScope().key);
    storage.setItem(TEACHER, token({ role: "admin" })); keys.add(scope.getHighSchoolRecordScope().key);
    vi.stubEnv("VITE_API_URL", "https://different-backend.example.test/api"); vi.resetModules();
    keys.add((await load()).getHighSchoolRecordScope().key);
    expect(keys.size).toBe(6);
  });

  it("retains an expired account key read-only and never falls through to another account", async () => {
    storage.setItem(STUDENT, token({ exp: NOW / 1000 + 1 }));
    storage.setItem(TEACHER, token({ role: "teacher", sub: "teacher-a" }));
    const scope = await load(); const active = scope.selectHighSchoolRecordScope("student");
    const changed = vi.fn(); unsubscribes.push(scope.subscribeHighSchoolRecordScope(changed));
    await vi.advanceTimersByTimeAsync(1000);
    const expired = scope.getHighSchoolRecordScope();
    expect(expired).toMatchObject({ key: active.key, mode: "account", authChannel: "student", canWrite: false });
    expect(expired.label).toContain("已过期"); expect(changed).toHaveBeenCalled();
    expect(scope.isCurrentHighSchoolRecordScope(active)).toBe(false);
    expect(scope.isCurrentHighSchoolRecordScope(expired)).toBe(true);
    expect(scope.isCurrentHighSchoolRecordScope(expired, true)).toBe(false);
  });

  it("rechecks expiry before operations and on focus after a suspended clock", async () => {
    storage.setItem(STUDENT, token({ exp: NOW / 1000 + 1 }));
    const scope = await load(); const before = scope.getHighSchoolRecordScope();
    vi.setSystemTime(NOW + 2000);
    expect(scope.isCurrentHighSchoolRecordScope(before, true)).toBe(false);
    storage.setItem(STUDENT, token({ exp: NOW / 1000 + 5 }));
    const changed = vi.fn(); unsubscribes.push(scope.subscribeHighSchoolRecordScope(changed));
    scope.getHighSchoolRecordScope(); vi.setSystemTime(NOW + 6000); browser.dispatchEvent(new Event("focus"));
    expect(scope.getHighSchoolRecordScope().canWrite).toBe(false);
    expect(changed).toHaveBeenCalled();
  });

  it("rejects malformed payloads and channel-role mismatches without crashing or choosing another account", async () => {
    const scope = await load();
    const badTokens = ["not-a-token", "a.b.c", "e30.signature", token({ role: "teacher" }), token({ exp: "9999999999" }), token({ exp: null }), token({ sub: "" }), token({ schoolId: "\ud800" })];
    for (const value of badTokens) {
      storage.setItem(STUDENT, value);
      expect(scope.getHighSchoolRecordScope()).toMatchObject({ mode: "blocked", key: null, canWrite: false });
    }
    storage.setItem(TEACHER, token({ role: "teacher", sub: "teacher-a" }));
    expect(scope.getHighSchoolRecordScope().mode).toBe("blocked");
    expect(scope.selectHighSchoolRecordScope("guest").mode).toBe("guest");
  });

  it("blocks a missing or corrupted selected identity until an explicit new selection", async () => {
    storage.setItem(STUDENT, token()); const scope = await load(); scope.selectHighSchoolRecordScope("student");
    storage.removeItem(STUDENT); storage.setItem(TEACHER, token({ role: "teacher" }));
    expect(scope.getHighSchoolRecordScope().mode).toBe("blocked");
    const key = [...storage.data.keys()].find((entry) => entry.startsWith("physics-high-school-auth-selection-v1:"))!;
    storage.setItem(key, "unknown-choice"); expect(scope.getHighSchoolRecordScope().mode).toBe("blocked");
    expect(scope.selectHighSchoolRecordScope("teacher").authChannel).toBe("teacher");
  });

  it("refreshes cross-tab auth changes while ignoring unrelated records", async () => {
    storage.setItem(STUDENT, token()); const scope = await load(); const before = scope.getHighSchoolRecordScope();
    const changed = vi.fn(); unsubscribes.push(scope.subscribeHighSchoolRecordScope(changed));
    storageEvent("unrelated-key"); expect(changed).not.toHaveBeenCalled();
    storage.setItem(STUDENT, token({ sub: "student-b" })); storageEvent(STUDENT);
    expect(changed).toHaveBeenCalledTimes(1); expect(scope.getHighSchoolRecordScope().key).not.toBe(before.key);
    storage.clear(); storageEvent(null); expect(scope.getHighSchoolRecordScope().mode).toBe("guest");
  });

  it("cleans subscriptions and expiry timers when no consumers remain", async () => {
    storage.setItem(STUDENT, token()); const scope = await load(); scope.getHighSchoolRecordScope();
    const listener = vi.fn(); const unsubscribe = scope.subscribeHighSchoolRecordScope(listener);
    expect(vi.getTimerCount()).toBeGreaterThan(0); unsubscribe(); expect(vi.getTimerCount()).toBe(0);
    storage.setItem(STUDENT, token({ sub: "changed" })); storageEvent(STUDENT); browser.dispatchEvent(new Event("focus"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("fails closed when storage cannot be read and recovers once identity can be read again", async () => {
    storage.setItem(STUDENT, token()); const scope = await load(); const before = scope.getHighSchoolRecordScope();
    storage.failRead = true;
    expect(scope.getHighSchoolRecordScope()).toMatchObject({ mode: "blocked", key: null, canWrite: false });
    expect(scope.isCurrentHighSchoolRecordScope(before)).toBe(false);
    const { studentApi, teacherApi } = await import("./teacherApi");
    expect(studentApi.hasSession()).toBe(false); expect(teacherApi.hasSession()).toBe(false);
    storage.failRead = false;
    expect(scope.getHighSchoolRecordScope()).toMatchObject({ key: before.key, mode: "account", canWrite: true });
  });

  it("preserves the owner and export/write guards without notifying consumers when a selection write fails", async () => {
    storage.setItem(STUDENT, token());
    const scope = await load(); const before = scope.selectHighSchoolRecordScope("student");
    const storedBefore = [...storage.data];
    const changed = vi.fn(); unsubscribes.push(scope.subscribeHighSchoolRecordScope(changed));
    storage.failWrite = true;
    expect(() => scope.selectHighSchoolRecordScope("guest")).toThrow("当前档案保持不变");
    expect(scope.getHighSchoolRecordScope()).toBe(before);
    expect(scope.isCurrentHighSchoolRecordScope(before)).toBe(true);
    expect(scope.isCurrentHighSchoolRecordScope(before, true)).toBe(true);
    expect([...storage.data]).toEqual(storedBefore);
    await Promise.resolve();
    expect(changed).not.toHaveBeenCalled();
    storage.failWrite = false;
    expect(scope.selectHighSchoolRecordScope("guest").mode).toBe("guest");
    expect(scope.isCurrentHighSchoolRecordScope(before)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("uses a separate demo scope and ignores account and selection mutations", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "true"); storage.setItem(STUDENT, "malformed"); storage.setItem(TEACHER, token({ role: "teacher" }));
    const scope = await load(); const initial = scope.getHighSchoolRecordScope();
    expect(initial).toMatchObject({ mode: "demo", authChannel: null, canWrite: true });
    storage.setItem(STUDENT, token()); expect(scope.getHighSchoolRecordScope()).toBe(initial);
    expect(scope.selectHighSchoolRecordScope("student")).toBe(initial);
    expect(scope.getHighSchoolRecordScopeOptions()).toEqual([]);
  });

  it("recognizes legacy teacher authentication without migrating any experiment archive", async () => {
    storage.setItem(LEGACY, token({ sub: "old-admin", role: "admin" }));
    const scope = await load(); expect(scope.getHighSchoolRecordScope()).toMatchObject({ mode: "account", authChannel: "teacher" });
    expect(storage.getItem(LEGACY)).not.toBeNull();
    expect(storage.getItem(TEACHER)).toBeNull();
  });

  it("returns a stable blocked snapshot without browser storage", async () => {
    vi.stubGlobal("window", undefined); vi.stubGlobal("document", undefined);
    const scope = await load(); const unavailable = scope.getHighSchoolRecordScope();
    expect(unavailable).toMatchObject({ key: null, mode: "blocked", canWrite: false });
    expect(scope.getHighSchoolRecordScope()).toBe(unavailable);
    expect(scope.isCurrentHighSchoolRecordScope(unavailable)).toBe(false);
  });
});
