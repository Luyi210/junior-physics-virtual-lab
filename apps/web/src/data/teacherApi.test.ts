import { afterEach, describe, expect, it, vi } from "vitest";

function teacherToken(id = "teacher", overrides = {}) {
  return `${btoa(JSON.stringify({ sub: id, schoolId: "school", role: "teacher", exp: 4_102_444_800, ...overrides })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}.testsignature`;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("learning feedback API channels", () => {
  function setup() {
    const values = new Map([["physics-lab-v2-api-teacher-token", teacherToken()], ["physics-lab-v2-api-student-token", "student-token"]]);
    vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    const browser = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => values.get(key) ?? null } });
    vi.stubGlobal("window", browser);
    return values;
  }
  it("keeps feedback readers on their own channel and preserves the teacher's exact submitted text/version", async () => {
    setup();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { teacherApi, studentApi } = await import("./teacherApi");
    const sessionId = "session/一";
    const input = { body: "  请保留原始读数。\n", expectedRevision: 2, mutationId: "feedback-retry-1" };
    await teacherApi.feedback(sessionId); await studentApi.feedback(sessionId); await teacherApi.createFeedback(sessionId, input);
    const calls = fetch.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([url]) => url)).toEqual(Array(3).fill("https://backend.example.test/api/sessions/session%2F%E4%B8%80/feedback"));
    expect(calls.map(([, options]) => (options.headers as Record<string, string>).authorization)).toEqual([`Bearer ${teacherToken()}`, "Bearer student-token", `Bearer ${teacherToken()}`]);
    expect(calls[2]![1].method).toBe("POST"); expect(JSON.parse(calls[2]![1].body as string)).toEqual(input);
  });
  it("does not release a late feedback POST result to a different teacher", async () => {
    const values = setup();
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((yes) => { resolve = yes; })));
    const { teacherApi } = await import("./teacherApi");
    const pending = teacherApi.createFeedback("session", { body: "核对读数", expectedRevision: 1, mutationId: "feedback-a" });
    values.set("physics-lab-v2-api-teacher-token", teacherToken("another-teacher"));
    resolve(new Response(JSON.stringify({ data: { id: "saved-by-original-teacher" } }), { status: 201 }));
    await expect(pending).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect(values.get("physics-lab-v2-api-teacher-token")).toBe(teacherToken("another-teacher"));
  });
});

describe("demo API isolation", () => {
  it("ignores stored login tokens and blocks requests even when a backend URL exists", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "true");
    vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    vi.stubGlobal("window", { localStorage: { getItem: () => "old-login-token" } });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { studentApi, teacherApi } = await import("./teacherApi");

    expect(studentApi.hasSession()).toBe(false);
    expect(teacherApi.hasSession()).toBe(false);
    expect(studentApi.isConfigured()).toBe(false);
    await expect(studentApi.health()).rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
    await expect(teacherApi.me()).rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores a classroom session left by an earlier authenticated visit", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "true");
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ id: "old-session", status: "active" }) } });
    const { activeStudentSession } = await import("./studentSessionSync");
    expect(activeStudentSession()).toBeNull();
  });

  it("keeps authenticated requests available in the explicitly configured full version", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "false");
    vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    vi.stubGlobal("window", { localStorage: { getItem: () => teacherToken() } });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "teacher" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { teacherApi } = await import("./teacherApi");

    expect(teacherApi.hasSession()).toBe(true);
    await expect(teacherApi.me()).resolves.toEqual({ id: "teacher" });
    expect(fetch).toHaveBeenCalledWith("https://backend.example.test/api/auth/me", expect.objectContaining({
      headers: expect.objectContaining({ authorization: `Bearer ${teacherToken()}` })
    }));
  });
});

describe("shared authentication metadata", () => {
  function browserStorage() {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); })
    };
    const browser = new EventTarget();
    Object.assign(browser, { localStorage: storage, location: { origin: "https://school.example.test" } });
    vi.stubGlobal("window", browser);
    vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    return { values, storage, browser };
  }
  function loginReply(id: string, role: "student" | "teacher") {
    return new Response(JSON.stringify({ data: { accessToken: role === "teacher" ? teacherToken(id) : `token-${id}`, user: { id, schoolId: "school", role, name: id } } }), { status: 200 });
  }

  it("explicitly selects the last logged-in channel and notifies both new and legacy student consumers", async () => {
    const { browser } = browserStorage();
    const fetch = vi.fn().mockResolvedValueOnce(loginReply("student-a", "student")).mockResolvedValueOnce(loginReply("teacher-a", "teacher"));
    vi.stubGlobal("fetch", fetch);
    const api = await import("./teacherApi");
    const shared = vi.fn(); const student = vi.fn();
    browser.addEventListener(api.PLATFORM_AUTH_EVENT, shared); browser.addEventListener(api.STUDENT_AUTH_EVENT, student);
    await api.studentApi.login("student@example.test", "test-password");
    expect(api.getPlatformAuthMetadata()).toMatchObject({ studentToken: "token-student-a", selection: "student", storageAvailable: true });
    await api.teacherApi.login("teacher@example.test", "test-password");
    expect(api.getPlatformAuthMetadata()).toMatchObject({ studentToken: "token-student-a", teacherToken: teacherToken("teacher-a"), selection: "teacher" });
    expect(shared).toHaveBeenCalledTimes(2); expect(student).toHaveBeenCalledTimes(1);
  });

  it("logging out the chosen account explicitly selects guest without deleting another account", async () => {
    const { values } = browserStorage();
    values.set("physics-lab-v2-api-student-token", "student-token");
    values.set("physics-lab-v2-api-teacher-token", "teacher-token");
    const api = await import("./teacherApi"); api.setHighSchoolAuthSelection("teacher"); api.teacherApi.logout();
    expect(api.getPlatformAuthMetadata()).toMatchObject({ selection: "guest", teacherToken: "", studentToken: "student-token" });
    expect(values.get("physics-lab-v2-api-student-token")).toBe("student-token");
  });

  it("logging out an unselected channel does not change the selected account", async () => {
    const { values } = browserStorage();
    values.set("physics-lab-v2-api-student-token", "student-token"); values.set("physics-lab-v2-api-teacher-token", "teacher-token");
    const api = await import("./teacherApi"); api.setHighSchoolAuthSelection("teacher"); api.studentApi.logout();
    expect(api.getPlatformAuthMetadata()).toMatchObject({ selection: "teacher", teacherToken: "teacher-token", studentToken: "" });
  });

  it("student login/logout preserves legacy classroom pointer and queue bytes while updating credentials normally", async () => {
    const { values, storage } = browserStorage();
    const pointerKey = "physics-lab-v2-active-api-session";
    const queueKey = "physics-lab-v2-api-event-queue";
    const pointer = '{ "id": "legacy-session", "status": "active", "unknownOrigin": true }';
    const queue = '[ { "sessionId": "legacy-session", "event": { "id": "unsent-event" } } ]';
    values.set(pointerKey, pointer); values.set(queueKey, queue);
    values.set("physics-lab-v2-api-student-token", "old-student-token");
    values.set("physics-lab-v2-api-student-id", "previous-student");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(loginReply("student-a", "student")));
    const api = await import("./teacherApi");
    await api.studentApi.login("student@example.test", "test-password");
    expect(api.studentApi.hasSession()).toBe(true);
    expect(api.studentApi.currentUserId()).toBe("student-a");
    expect(api.getStudentAuthMetadata().studentToken).toBe("token-student-a");
    expect(values.get(pointerKey)).toBe(pointer); expect(values.get(queueKey)).toBe(queue);
    api.studentApi.logout();
    expect(api.studentApi.hasSession()).toBe(false);
    expect(api.studentApi.currentUserId()).toBe("");
    expect(api.getStudentAuthMetadata().studentToken).toBe("");
    expect(values.has("physics-lab-v2-api-student-token")).toBe(false);
    expect(values.has("physics-lab-v2-api-student-id")).toBe(false);
    expect(values.get(pointerKey)).toBe(pointer); expect(values.get(queueKey)).toBe(queue);
    for (const operation of [storage.getItem, storage.setItem, storage.removeItem]) {
      expect(operation.mock.calls.some(([key]) => key === pointerKey || key === queueKey)).toBe(false);
    }
  });

  it("reports partial login persistence failure instead of pretending a complete identity switch succeeded", async () => {
    const { storage, browser } = browserStorage();
    storage.setItem.mockImplementation((key) => { if (key.startsWith("physics-high-school-auth-selection-v1:")) throw new Error("Quota exceeded"); });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(loginReply("student-a", "student")));
    const api = await import("./teacherApi"); const changed = vi.fn(); browser.addEventListener(api.PLATFORM_AUTH_EVENT, changed);
    await expect(api.studentApi.login("student@example.test", "test-password")).rejects.toMatchObject({ code: "AUTH_STORAGE_UNAVAILABLE" });
    expect(api.getPlatformAuthMetadata().storageAvailable).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate or notify the previous identity when only an atomic selection write fails", async () => {
    const { values, storage, browser } = browserStorage();
    values.set("physics-lab-v2-api-student-token", "student-token");
    const api = await import("./teacherApi");
    expect(api.setHighSchoolAuthSelection("student")).toBe(true);
    const before = api.getPlatformAuthMetadata(); const storedBefore = [...values];
    const changed = vi.fn(); browser.addEventListener(api.PLATFORM_AUTH_EVENT, changed);
    storage.setItem.mockImplementation(() => { throw new Error("Quota exceeded"); });
    expect(api.setHighSchoolAuthSelection("guest")).toBe(false);
    expect(api.getPlatformAuthMetadata()).toEqual(before);
    expect([...values]).toEqual(storedBefore);
    expect(changed).not.toHaveBeenCalled();
  });

  it("safe token reads and metadata survive unavailable localStorage", async () => {
    const { storage } = browserStorage(); storage.getItem.mockImplementation(() => { throw new Error("SecurityError"); });
    const api = await import("./teacherApi");
    expect(api.studentApi.hasSession()).toBe(false); expect(api.teacherApi.hasSession()).toBe(false);
    expect(api.studentApi.currentUserId()).toBe("");
    expect(api.getPlatformAuthMetadata()).toMatchObject({ storageAvailable: false, studentToken: "", teacherToken: "" });
    expect(api.getStudentAuthMetadata()).toMatchObject({ storageAvailable: false, studentToken: "" });
  });

  it("reads only the student token for classroom metadata and ignores a teacher persistence failure", async () => {
    const { values, storage } = browserStorage();
    values.set("physics-lab-v2-api-student-token", "student-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(loginReply("teacher-a", "teacher")));
    storage.setItem.mockImplementation(() => { throw new Error("Quota exceeded"); });
    const api = await import("./teacherApi");
    await expect(api.teacherApi.login("teacher@example.test", "test-password")).rejects.toMatchObject({ code: "AUTH_STORAGE_UNAVAILABLE" });
    expect(api.getPlatformAuthMetadata().storageAvailable).toBe(false);
    storage.getItem.mockClear();
    expect(api.getStudentAuthMetadata()).toEqual({ demoOnly: false, apiNamespace: "https://backend.example.test/api", storageAvailable: true, studentToken: "student-token" });
    expect(storage.getItem.mock.calls).toEqual([["physics-lab-v2-api-student-token"]]);
  });

  it("student metadata in demo mode never reads leftover account tokens", async () => {
    const { storage } = browserStorage(); vi.stubEnv("VITE_DEMO_ONLY", "true");
    const api = await import("./teacherApi");
    expect(api.getStudentAuthMetadata()).toMatchObject({ demoOnly: true, studentToken: "", storageAvailable: false });
    expect(storage.getItem).not.toHaveBeenCalled();
  });
});

describe("teacher credential request boundaries", () => {
  function setup() {
    const values = new Map<string, string>();
    const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) };
    const browser = Object.assign(new EventTarget(), { localStorage: storage, location: { origin: "https://school.example.test" } });
    vi.stubGlobal("window", browser); vi.stubGlobal("document", new EventTarget());
    vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    return { values, storage, browser, change(token: string, key = "physics-lab-v2-api-teacher-token") {
      const oldValue = values.get(key) ?? null; values.set(key, token);
      browser.dispatchEvent(Object.assign(new Event("storage"), { key, oldValue, newValue: token }));
    } };
  }
  function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
  const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
  const login = (id: string) => response({ accessToken: teacherToken(id), user: { id, schoolId: "school", role: "teacher" } });

  it("drops held successful GETs after an observed A-B-A transition even with original token restored", async () => {
    const env = setup(); env.change(teacherToken("a")); const pending = deferred<Response>(); vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const { teacherApi } = await import("./teacherApi"); const request = teacherApi.taskRecords("task");
    env.change(teacherToken("b")); env.change(teacherToken("a")); pending.resolve(response([{ learnerName: "old student" }]));
    await expect(request).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect(teacherApi.hasSession()).toBe(true);
  });

  it.each(["response", "body", "network"])("rejects late %s errors after same-user renewal without clearing the new token", async (kind) => {
    const env = setup(); env.change(teacherToken("a")); const pending = deferred<Response>(); const body = deferred<unknown>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise)); const { teacherApi } = await import("./teacherApi"); const request = teacherApi.me();
    if (kind === "body") { pending.resolve({ ok: false, status: 401, json: () => body.promise } as Response); await Promise.resolve(); }
    const renewed = teacherToken("a", { exp: 4_102_444_900 }); env.change(renewed);
    if (kind === "response") pending.resolve(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }));
    else if (kind === "network") pending.reject(new Error("offline"));
    else body.resolve({ error: { code: "UNAUTHORIZED" } });
    await expect(request).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect(env.values.get("physics-lab-v2-api-teacher-token")).toBe(renewed);
  });

  it("keeps teacher metadata and a pending request independent of student persistence failure and selection", async () => {
    const env = setup(); env.change(teacherToken("a")); const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response({ accessToken: "student-token", user: { id: "s" } })));
    const api = await import("./teacherApi"); const before = api.getTeacherAuthMetadata(); const request = api.teacherApi.classes();
    env.storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    await expect(api.studentApi.login("s@test", "password")).rejects.toMatchObject({ code: "AUTH_STORAGE_UNAVAILABLE" });
    expect(api.getTeacherAuthMetadata()).toEqual(before);
    pending.resolve(response([])); await expect(request).resolves.toEqual([]);
  });

  it("failed logout revokes locally, invalidates held login, and unrelated successful writes cannot restore it", async () => {
    const env = setup(); env.change(teacherToken("a")); const pending = deferred<Response>(); vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const api = await import("./teacherApi"); const attempt = api.teacherApi.login("b@test", "password");
    env.storage.removeItem.mockImplementation(() => { throw new Error("security"); }); api.teacherApi.logout();
    expect(env.values.get("physics-lab-v2-api-teacher-token")).toBe(teacherToken("a"));
    expect(api.teacherApi.hasSession()).toBe(false);
    api.setHighSchoolAuthSelection("student");
    expect(api.teacherApi.hasSession()).toBe(false); expect(api.getTeacherAuthMetadata().storageAvailable).toBe(false);
    pending.resolve(login("b")); await expect(attempt).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    env.storage.removeItem.mockImplementation((key) => { env.values.delete(key); });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(login("c")));
    await api.teacherApi.login("c@test", "password"); expect(api.teacherApi.hasSession()).toBe(true);
  });

  it("explicit logout with no credential invalidates an in-flight login", async () => {
    setup(); const pending = deferred<Response>(); vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const api = await import("./teacherApi"); const request = api.teacherApi.login("a@test", "password"); api.teacherApi.logout(); pending.resolve(login("a"));
    await expect(request).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" }); expect(api.teacherApi.hasSession()).toBe(false);
  });

  it("the latest login wins and an older successful response cannot overwrite it", async () => {
    const env = setup(); const a = deferred<Response>(); const b = deferred<Response>(); vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise));
    const api = await import("./teacherApi"); const first = api.teacherApi.login("a@test", "password"); const last = api.teacherApi.login("b@test", "password");
    b.resolve(login("b")); await last; a.resolve(login("a")); await expect(first).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    expect(env.values.get("physics-lab-v2-api-teacher-token")).toBe(teacherToken("b"));
  });

  it("expiry between request and body resolution invalidates the result and blocks new requests", async () => {
    const env = setup(); vi.useFakeTimers(); vi.setSystemTime(1_800_000_000_000);
    env.change(teacherToken("a", { exp: Date.now() / 1000 + 1 })); const pending = deferred<Response>(); const fetch = vi.fn(() => pending.promise); vi.stubGlobal("fetch", fetch);
    const api = await import("./teacherApi"); const request = api.teacherApi.me(); vi.advanceTimersByTime(1001); pending.resolve(response({ id: "a" }));
    await expect(request).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
    await expect(api.teacherApi.me()).rejects.toMatchObject({ code: "SESSION_EXPIRED" }); expect(fetch).toHaveBeenCalledTimes(1); vi.useRealTimers();
  });

  it.each(["bad-token", teacherToken("a", { role: "student" }), teacherToken("a", { exp: Infinity }), teacherToken("a", { schoolId: "" })])("fails closed for an invalid teacher claim before fetch", async (token) => {
    const env = setup(); env.change(token); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { teacherApi } = await import("./teacherApi");
    expect(teacherApi.hasSession()).toBe(false); await expect(teacherApi.tasks()).rejects.toMatchObject({ code: "INVALID_SESSION" }); expect(fetch).not.toHaveBeenCalled();
  });
});
