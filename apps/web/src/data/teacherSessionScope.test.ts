import { afterEach, describe, expect, it, vi } from "vitest";
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
const TOKEN_KEY = "physics-lab-v2-api-teacher-token";
function token(overrides = {}) { return `${btoa(JSON.stringify({ sub: "t", schoolId: "school", role: "teacher", name: "Teacher", exp: 4_102_444_800, ...overrides })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}.signature`; }
function setup() {
  const values = new Map<string, string>(); const browser = Object.assign(new EventTarget(), { location: { origin: "https://school.test" }, localStorage: { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) } });
  const document = new EventTarget(); vi.stubGlobal("window", browser); vi.stubGlobal("document", document); vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", "https://api.test/api");
  return { values, browser, document, change(value: string, key = TOKEN_KEY) { const oldValue = values.get(key) ?? null; values.set(key, value); browser.dispatchEvent(Object.assign(new Event("storage"), { key, oldValue, newValue: value })); } };

}

describe("fixed teacher session scope", () => {
  it("binds namespace, school, user and role; renewals keep key but invalidate callbacks", async () => {
    const env = setup(); env.change(token()); const scope = await import("./teacherSessionScope"); const first = scope.getTeacherSessionScope();
    expect(first).toMatchObject({ userId: "t", schoolId: "school", role: "teacher", mode: "account", canAccess: true });
    env.change(token({ exp: 4_102_444_900 })); const renewed = scope.getTeacherSessionScope();
    expect(renewed.key).toBe(first.key); expect(renewed.revision).toBeGreaterThan(first.revision); expect(scope.isCurrentTeacherSessionScope(first)).toBe(false);
    env.change(token({ schoolId: "other" })); expect(scope.getTeacherSessionScope().key).not.toBe(first.key);
    env.change(token({ role: "admin" })); expect(scope.getTeacherSessionScope().key).not.toBe(first.key);
  });

  it("ignores student token and high-school selection events without notification or remount", async () => {
    const env = setup(); env.change(token()); const api = await import("./teacherApi"); const scope = await import("./teacherSessionScope"); const first = scope.getTeacherSessionScope(); const listener = vi.fn(); cleanups.push(scope.subscribeTeacherSessionScope(listener));
    env.change("student-token", "physics-lab-v2-api-student-token"); api.setHighSchoolAuthSelection("guest"); env.browser.dispatchEvent(new Event(api.STUDENT_AUTH_EVENT));
    expect(scope.getTeacherSessionScope()).toBe(first); expect(listener).not.toHaveBeenCalled();
  });

  it("expires without a user action and removes its timer after unsubscribe", async () => {
    const env = setup(); vi.useFakeTimers(); vi.setSystemTime(1_800_000_000_000); env.change(token({ exp: Date.now() / 1000 + 2 }));
    const scope = await import("./teacherSessionScope"); const first = scope.getTeacherSessionScope(); const listener = vi.fn(); const unsubscribe = scope.subscribeTeacherSessionScope(listener); cleanups.push(unsubscribe);
    vi.advanceTimersByTime(2001); expect(scope.getTeacherSessionScope()).toMatchObject({ mode: "expired", canAccess: false }); expect(scope.isCurrentTeacherSessionScope(first)).toBe(false); expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["focus", "visibilitychange"])("rechecks credentials on %s after background changes", async (event) => {
    const env = setup(); env.change(token()); const scope = await import("./teacherSessionScope"); const before = scope.getTeacherSessionScope(); const listener = vi.fn(); cleanups.push(scope.subscribeTeacherSessionScope(listener));
    env.values.set(TOKEN_KEY, token({ sub: "new-teacher" })); (event === "focus" ? env.browser : env.document).dispatchEvent(new Event(event));
    expect(scope.getTeacherSessionScope().userId).toBe("new-teacher"); expect(scope.isCurrentTeacherSessionScope(before)).toBe(false); expect(listener).toHaveBeenCalledTimes(1);
  });

  it("detects ABA storage transitions and never treats a student token as teacher access", async () => {
    const env = setup(); env.change(token()); const scope = await import("./teacherSessionScope"); const first = scope.getTeacherSessionScope(); const listener = vi.fn(); cleanups.push(scope.subscribeTeacherSessionScope(listener));
    env.change(token({ sub: "b" })); env.change(token()); expect(scope.isCurrentTeacherSessionScope(first)).toBe(false); expect(listener).toHaveBeenCalledTimes(2);
    env.change(token({ role: "student" })); expect(scope.getTeacherSessionScope()).toMatchObject({ mode: "blocked", canAccess: false, key: null });
  });

  it("supports legacy teacher credentials, while failed logout stays blocked after focus and student events", async () => {
    const env = setup(); env.values.set("physics-lab-v2-api-access-token", token()); const scope = await import("./teacherSessionScope"); const api = await import("./teacherApi");
    expect(scope.getTeacherSessionScope().canAccess).toBe(true); const listener = vi.fn(); cleanups.push(scope.subscribeTeacherSessionScope(listener));
    env.browser.localStorage.removeItem.mockImplementation(() => { throw new Error("denied"); }); api.teacherApi.logout(); env.browser.dispatchEvent(new Event("focus")); api.setHighSchoolAuthSelection("student");
    expect(scope.getTeacherSessionScope()).toMatchObject({ mode: "blocked", canAccess: false }); expect(env.values.get("physics-lab-v2-api-access-token")).toBe(token());
  });

  it("demo never reads teacher credentials and signed-out state cannot access remote data", async () => {
    const env = setup(); vi.stubEnv("VITE_DEMO_ONLY", "true"); const scope = await import("./teacherSessionScope");
    expect(scope.getTeacherSessionScope()).toMatchObject({ mode: "demo", canAccess: false }); expect(env.browser.localStorage.getItem).not.toHaveBeenCalled();
  });
});
