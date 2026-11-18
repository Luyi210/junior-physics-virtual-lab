import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode, type ReactElement } from "react";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null }));
// Production components, API and scope store; only React scheduling/router are
// replaced by an explicit in-memory adapter. This is not browser validation.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const differs = (a?: readonly unknown[], b?: readonly unknown[]) => !a || !b || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  return { ...actual,
    useState: (initial: unknown) => { if (!harness.frame) return actual.useState(initial); const item = slot(); if (!("value" in item)) item.value = typeof initial === "function" ? initial() : initial; return [item.value, (next: unknown) => { item.value = typeof next === "function" ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { if (!harness.frame) return actual.useRef(initial); const item = slot(); if (!("value" in item)) item.value = { current: initial }; return item.value; },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => { if (!harness.frame) return actual.useMemo(factory, deps); const item = slot(); if (differs(item.deps, deps)) { item.value = factory(); item.deps = deps; } return item.value; },
    useCallback: (callback: unknown, deps: readonly unknown[]) => { if (!harness.frame) return actual.useCallback(callback as () => void, deps); const item = slot(); if (differs(item.deps, deps)) { item.value = callback; item.deps = deps; } return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (!harness.frame) return actual.useEffect(effect, deps); const item = slot(); if (differs(item.deps, deps)) { item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot()
  };
});
vi.mock("react-router-dom", async (importOriginal) => ({ ...await importOriginal<typeof import("react-router-dom")>(), useLocation: () => ({ pathname: "/teacher/reports" }), useNavigate: () => vi.fn() }));
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode), ...walk(node.props.element as ReactNode)] : [];
}
function mount(render: () => ReactNode) {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode, render() { frame.cursor = 0; harness.frame = frame; try { app.tree = render(); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; }, unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); }, frame };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
const TOKEN_KEY = "physics-lab-v2-api-teacher-token";
const token = (id: string, exp = 4_102_444_800) => `${btoa(JSON.stringify({ sub: id, schoolId: "school", role: "teacher", exp })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}.signature`;
function setup() {
  const values = new Map<string, string>([[TOKEN_KEY, token("a")]]);
  const browser = Object.assign(new EventTarget(), { sessionStorage: { getItem: () => null, setItem: () => {} }, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } }, location: { origin: "https://school.test" } });
  vi.stubGlobal("window", browser); vi.stubGlobal("document", new EventTarget()); vi.stubEnv("VITE_DEMO_ONLY", "false"); vi.stubEnv("VITE_API_URL", "https://api.test/api");
  return { values, change(value: string, key = TOKEN_KEY) { const oldValue = values.get(key) ?? null; values.set(key, value); browser.dispatchEvent(Object.assign(new Event("storage"), { key, oldValue, newValue: value })); } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const settle = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve(); };
const user = { id: "a", schoolId: "school", role: "teacher" as const, name: "Teacher A", email: "a@test", status: "active" as const, createdAt: "2026-01-01", lastLoginAt: null, classIds: [], classNames: [] };
const task = { id: "task", schoolId: "school", classId: "class", lessonId: "lesson", title: "Private task", status: "published" as const, mode: "in-class" as const, allowRetry: true, createdBy: "a", createdAt: "2026-01-01", updatedAt: "2026-01-01", opensAt: null, dueAt: null };
const record = { session: { id: "session", learnerId: "student", status: "active", startedAt: "2026-01-01" }, learnerName: "Private student", record: { prediction: "Private old prediction" } };

describe("teacher page identity lifecycle", () => {
  it("keys the full dashboard by teacher revision, independently of student changes", async () => {
    const env = setup(); const { TeacherDashboard } = await import("./TeacherDashboard"); const app = mount(() => TeacherDashboard());
    const initial = (app.tree as Element).key; env.change("new-student", "physics-lab-v2-api-student-token"); app.render(); expect((app.tree as Element).key).toBe(initial);
    env.change(token("a", 4_102_444_900)); app.render(); expect((app.tree as Element).key).not.toBe(initial);
    env.change(""); app.render(); expect((app.tree as Element).props.scope).toMatchObject({ mode: "signed-out", canAccess: false });
  });

  it("a late /me 401 cannot log out the teacher who signed in while it was pending", async () => {
    const env = setup(); const held = deferred<Response>(); const fetch = vi.fn((url: string) => url.endsWith("/health") ? Promise.resolve(response({})) : held.promise); vi.stubGlobal("fetch", fetch);
    const { getTeacherSessionScope } = await import("../../data/teacherSessionScope"); const { TeacherDashboardContent } = await import("./TeacherDashboard"); const scope = getTeacherSessionScope();
    const app = mount(() => TeacherDashboardContent({ scope })); await settle(); expect(fetch).toHaveBeenCalledTimes(2);
    env.change(token("b")); held.resolve(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 })); await settle(); app.render();
    expect(env.values.get(TOKEN_KEY)).toBe(token("b")); expect(walk(app.tree).some((node) => node.props.currentUser)).toBe(false);
    expect(JSON.stringify(app.frame.slots)).not.toContain("Teacher A");
  });

  it("old refresh and login callbacks cannot send a request with a newly switched credential", async () => {
    const env = setup(); const fetch = vi.fn((url: string) => Promise.resolve(response(url.endsWith("/health") ? {} : url.endsWith("/auth/me") ? user : []))); vi.stubGlobal("fetch", fetch);
    const { getTeacherSessionScope } = await import("../../data/teacherSessionScope"); const { TeacherDashboardContent } = await import("./TeacherDashboard"); const scope = getTeacherSessionScope();
    const app = mount(() => TeacherDashboardContent({ scope })); const oldLogin = (app.tree as Element).props.onLogin as (email: string, password: string) => Promise<void>;
    await settle(); app.render(); const refresh = walk(app.tree).find((node) => typeof node.props.onRefresh === "function")!.props.onRefresh as () => Promise<void>;
    expect(walk(app.tree).some((node) => (node.props.currentUser as typeof user)?.id === "a")).toBe(true);
    env.change(token("b")); const before = fetch.mock.calls.length; await refresh(); await oldLogin("a@test", "password"); expect(fetch).toHaveBeenCalledTimes(before);
    app.render(); expect(walk(app.tree).some((node) => node.props.currentUser)).toBe(false);
  });

  it("loaded report text disappears before unmount, and its old refresh callback cannot reload under another teacher", async () => {
    const env = setup(); const fetch = vi.fn().mockResolvedValue(response([record])); vi.stubGlobal("fetch", fetch);
    const { TaskLearningRecords } = await import("./TeacherLearningRecords"); const app = mount(() => TaskLearningRecords({ task })); await settle(); app.render();
    expect(walk(app.tree).some((node) => (node.props.item as typeof record)?.learnerName === "Private student")).toBe(true);
    const refresh = walk(app.tree).find((node) => node.type === "button")!.props.onClick as () => void;
    env.change(token("b")); refresh(); app.render();
    expect(fetch).toHaveBeenCalledTimes(1); expect(walk(app.tree).some((node) => node.props.item)).toBe(false);
  });

  it("an in-flight report result is not written into component state after renewal or unmount", async () => {
    const env = setup(); const held = deferred<Response>(); vi.stubGlobal("fetch", vi.fn(() => held.promise));
    const { TaskLearningRecords } = await import("./TeacherLearningRecords"); const app = mount(() => TaskLearningRecords({ task }));
    env.change(token("a", 4_102_444_900)); app.unmount(); held.resolve(response([record])); await settle();
    expect(JSON.stringify(app.frame.slots)).not.toContain("Private old prediction");
  });

  it("a mismatched currentUser cannot render or start report queries even if another teacher is authenticated", async () => {
    setup(); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const { TeacherLearningRecords } = await import("./TeacherLearningRecords");
    const app = mount(() => TeacherLearningRecords({ currentUser: { ...user, id: "b" } }));
    expect(walk(app.tree).some((node) => node.props.currentUser)).toBe(false); expect(fetch).not.toHaveBeenCalled();
  });
});
