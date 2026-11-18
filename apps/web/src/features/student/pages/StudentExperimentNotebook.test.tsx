import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { HarnessSession } from "@physics-lab/harness";
import type { StudentRecordScope } from "../../../data/studentRecordScope";
import { experimentNotebookRepository, type ExperimentNotebookEntry } from "../../../data/experimentNotebookRepository";
import { clearNotebookDraft } from "./notebookDrafts";
import { StudentExperimentNotebook, deriveActivities } from "./StudentExperimentNotebook";
import { StudentIdentityPortal } from "../components/StudentIdentityPortal";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, writes: 0, findAll: vi.fn(), sessions: vi.fn(), scope: null as StudentRecordScope | null }));
// Exercises actual TSX callbacks with real notebook storage helpers in memory.
// This is not a browser DOM, mobile keyboard or IndexedDB acceptance test.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (a?: readonly unknown[], b?: readonly unknown[]) => !a || !b || a.length !== b.length || b.some((value, i) => !Object.is(value, a[i]));
  return { ...actual,
    useState: (initial: unknown) => { const item = slot(); if (!Object.hasOwn(item, "value")) item.value = typeof initial === "function" ? initial() : initial; return [item.value, (next: unknown) => { harness.writes++; item.value = typeof next === "function" ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { const item = slot(); if (!Object.hasOwn(item, "value")) item.value = { current: initial }; return item.value; },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => { const item = slot(); if (changed(item.deps, deps)) { item.value = factory(); item.deps = deps; } return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { const item = slot(); if (changed(item.deps, deps)) { item.deps = deps; harness.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
  };
});
vi.mock("react-router-dom", () => ({ Link: "route-link" }));
vi.mock("../../../shared/components/BrandMark", () => ({ BrandMark: "brand-mark" }));
vi.mock("../../../data/harnessSessionRepository", () => ({ localHarnessSessionRepository: { findAll: () => harness.findAll() } }));
vi.mock("../../../data/teacherApi", () => ({ studentApi: { sessions: () => harness.sessions() } }));
vi.mock("../../../data/studentRecordScope", () => ({ getStudentRecordScope: () => harness.scope, subscribeStudentRecordScope: () => () => {}, isCurrentStudentRecordScope: (scope: StudentRecordScope) => scope === harness.scope }));

type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] { if (Array.isArray(node)) return node.flatMap(all); return isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { if (typeof node === "string" || typeof node === "number") return String(node); if (Array.isArray(node)) return node.map(text).join(""); return isValidElement<{ children?: ReactNode }>(node) ? text(node.props.children) : ""; }
const cleanups: Array<() => void> = [];
function mount(component: () => ReactNode) {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render() { for (let n = 0; n < 10; n++) { const before = harness.writes; frame.cursor = 0; harness.frame = frame; try { app.tree = component(); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); if (harness.writes === before) break; } return app.tree; },
    elements(type: string) { return all(app.tree).filter((node) => node.type === type); },
    button(label: string) { const result = app.elements("button").find((node) => text(node).includes(label)); expect(result, label).toBeDefined(); return result!; },
    click(label: string) { (app.button(label).props.onClick as () => void)(); app.render(); },
    edit(index: number, value: string) { (app.elements("textarea")[index].props.onChange as (event: unknown) => void)({ target: { value } }); app.render(); },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
  }; app.render(); cleanups.push(app.unmount); return app;
}
function memoryStorage() { const values = new Map<string, string>(); return { values, getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }), removeItem: vi.fn((key: string) => { values.delete(key); }) }; }
let local: ReturnType<typeof memoryStorage>;
let session: ReturnType<typeof memoryStorage>;
const time = (n: number) => `2026-11-12T00:${String(n).padStart(2, "0")}:00.000Z`;
function trace(id: string, events: Array<[number, string]>, observations: Array<[number, string]> = []): HarnessSession {
  return { id, schemaVersion: 1, learnerId: "local-learner", area: "optics", startedAt: time(0), updatedAt: time(59), insights: [],
    events: events.map(([n, module]) => ({ id: `${id}-${n}`, sessionId: id, area: "optics", type: "module.entered", occurredAt: time(n), payload: { module } })),
    observations: observations.map(([n, value]) => ({ id: `obs-${id}-${n}`, area: "optics", createdAt: time(n), text: value })) };
}
const entry: ExperimentNotebookEntry = { id: "optics:reflection", area: "optics", module: "reflection", experimentTitle: "光的反射", whatIDid: "转动镜面", whatIObserved: "反射角随入射角改变", whatILearned: "两角相等", question: "换种镜面呢？", createdAt: time(0), updatedAt: time(1) };
const key = "physics-lab-v2-experiment-notebook";
async function settle() { for (let n = 0; n < 10; n++) await Promise.resolve(); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }

beforeEach(() => {
  harness.frame = null; harness.writes = 0; local = memoryStorage(); session = memoryStorage();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: session, setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(), dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: vi.fn(() => true) });
  for (const id of ["optics:reflection", "optics:refraction"]) clearNotebookDraft(id);
  harness.scope = { key: null, apiNamespace: "synthetic", schoolId: null, studentId: null, mode: "signed-out", label: "游客", canWrite: false, revision: 1 };
  harness.findAll.mockReset().mockResolvedValue([trace("session", [[1, "reflection"], [3, "refraction"]])]); harness.sessions.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

async function notebook() { const app = mount(StudentExperimentNotebook); await settle(); app.render(); return app; }
describe("junior notebook save and reopen flow", () => {
  it("opens existing local records and keeps their original text on a later save", async () => {
    local.values.set(key, JSON.stringify([entry])); const app = await notebook(); app.click("光的反射");
    expect(app.elements("textarea").map((node) => node.props.value)).toEqual([entry.whatIDid, entry.whatIObserved, entry.whatILearned, entry.question]);
    app.edit(2, "我测得入射角30°，反射角30°"); app.click("更新学习记录");
    expect(text(app.tree)).toContain("已经保存"); app.unmount(); session.values.clear();
    const reopened = await notebook(); reopened.click("光的反射");
    expect(reopened.elements("textarea")[2].props.value).toBe("我测得入射角30°，反射角30°");
    expect(experimentNotebookRepository.findAll()[0].createdAt).toBe(entry.createdAt);
  });
  it("keeps unsaved words while switching experiments and remounting the page", async () => {
    const app = await notebook(); app.click("光的反射"); app.edit(2, "我的未完成解释"); app.click("光的折射"); app.edit(3, "我的折射问题"); app.click("光的反射");
    expect(app.elements("textarea")[2].props.value).toBe("我的未完成解释"); app.unmount();
    const reopened = await notebook(); reopened.click("光的反射"); expect(reopened.elements("textarea")[2].props.value).toBe("我的未完成解释");
    reopened.click("光的折射"); expect(reopened.elements("textarea")[3].props.value).toBe("我的折射问题");
    expect(local.values.has(key)).toBe(false);
  });
  it("reports quota failure without claiming a save or replacing the previous record", async () => {
    local.values.set(key, JSON.stringify([entry])); const app = await notebook(); app.click("光的反射"); app.edit(2, "新结论需要保留");
    local.setItem.mockImplementation(() => { throw new Error("quota exceeded"); }); app.click("更新学习记录");
    expect(text(app.tree)).toContain("未能保存学习记录"); expect(text(app.tree)).not.toContain("已经保存");
    expect(app.elements("textarea")[2].props.value).toBe("新结论需要保留"); expect(JSON.parse(local.values.get(key)!)[0]).toEqual(entry);
    local.setItem.mockImplementation((key, value) => { local.values.set(key, value); }); app.click("更新学习记录");
    expect(experimentNotebookRepository.findAll()[0].whatILearned).toBe("新结论需要保留");
  });
  it.each(["not-json", '[{"updatedAt":3}]', JSON.stringify([{ ...entry, area: "unknown" }])])("keeps damaged raw records untouched and displays a recovery message: %s", async (raw) => {
    local.values.set(key, raw); const app = await notebook();
    expect(text(app.tree)).toContain("原始内容仍保留"); app.edit(2, "不能覆盖旧数据"); app.click("保存学习记录");
    expect(text(app.tree)).toContain("未能保存学习记录"); expect(local.values.get(key)).toBe(raw); expect(local.setItem).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation before replacing manual words with automatic trace", async () => {
    const app = await notebook(); app.edit(2, "保留我的解释"); vi.mocked(window.confirm).mockReturnValue(false); app.click("重新读取自动轨迹");
    expect(app.elements("textarea")[2].props.value).toBe("保留我的解释"); vi.mocked(window.confirm).mockReturnValue(true); app.click("重新读取自动轨迹");
    expect(app.elements("textarea")[2].props.value).toBe("");
  });
  it("keeps failed tab drafts in memory across navigation and warns before reload", async () => {
    session.setItem.mockImplementation(() => { throw new Error("blocked"); }); const app = await notebook(); app.click("光的反射"); app.edit(2, "存储失败也要保留");
    expect(text(app.tree)).toContain("浏览器未能暂存草稿"); expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    app.unmount(); const reopened = await notebook(); reopened.click("光的反射");
    expect(reopened.elements("textarea")[2].props.value).toBe("存储失败也要保留"); expect(text(reopened.tree)).toContain("尚未写入浏览器");
    reopened.click("保存学习记录"); expect(experimentNotebookRepository.findAll()[0].whatILearned).toBe("存储失败也要保留");
  });
  it("ignores late cloud and local results after leaving the notebook", async () => {
    harness.scope = { ...harness.scope!, key: "school:a", mode: "account", canWrite: true }; const cloud = deferred<[]>(); const localRead = deferred<HarnessSession[]>();
    harness.sessions.mockReturnValue(cloud.promise); harness.findAll.mockReturnValue(localRead.promise); const app = mount(StudentExperimentNotebook); app.unmount(); const count = harness.writes;
    cloud.resolve([]); localRead.resolve([]); await settle(); expect(harness.writes).toBe(count);
  });
});

describe("notebook evidence belongs to its actual experiment", () => {
  it("assigns an unlinked observation to the active module before a later revisit", () => {
    const activities = deriveActivities([trace("s", [[1, "reflection"], [3, "refraction"], [5, "reflection"]], [[4, "折射入水偏向法线"]])]);
    expect(activities.find((item) => item.module === "refraction")?.observations).toEqual(["折射入水偏向法线"]);
    expect(activities.find((item) => item.module === "reflection")?.observations).toEqual([]);
  });
  it("does not borrow an event from another session, or make recent activity older", () => {
    const activities = deriveActivities([trace("new", [[10, "reflection"]]), trace("old", [[1, "reflection"], [2, "refraction"]], [[0, "未开始实验时写下的想法"]])]);
    expect(activities[0].lastAt).toBe(time(10)); expect(activities.flatMap((item) => item.observations)).toEqual([]);
  });
  it("uses an explicit related event before the observation timestamp fallback", () => {
    const session = trace("s", [[1, "reflection"], [3, "refraction"]], [[4, "补记反射现象"]]); session.observations[0].relatedEventId = "s-1";
    expect(deriveActivities([session]).find((item) => item.module === "reflection")?.observations).toEqual(["补记反射现象"]);
  });
});

describe("mobile student identity submission", () => {
  it("locks duplicate submit and guest switching until the active login finishes", async () => {
    const response = deferred<void>(); const login = vi.fn(() => response.promise); const guest = vi.fn();
    const app = mount(() => StudentIdentityPortal({ connection: "online", onLogin: login, onGuest: guest, onRetry: async () => {} }));
    const submit = app.elements("form")[0].props.onSubmit as (event: unknown) => Promise<void>;
    const first = submit({ preventDefault() {} }); const second = submit({ preventDefault() {} }); app.render(); app.click("游客自由探索");
    expect(login).toHaveBeenCalledTimes(1); expect(guest).not.toHaveBeenCalled(); expect(app.elements("input").every((node) => node.props.disabled)).toBe(true);
    response.reject(new Error("密码有误")); await Promise.all([first, second]); app.render(); expect(text(app.tree)).toContain("密码有误");
    app.click("游客自由探索"); expect(guest).toHaveBeenCalledTimes(1);
  });
  it("does not start login while checking or update a closed portal from an old request", async () => {
    const response = deferred<void>(); const login = vi.fn(() => response.promise); const guest = vi.fn();
    let connection: "checking" | "online" = "checking";
    const app = mount(() => StudentIdentityPortal({ connection, onLogin: login, onGuest: guest, onRetry: async () => {} }));
    await (app.elements("form")[0].props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} }); expect(login).not.toHaveBeenCalled();
    connection = "online"; app.render(); const pending = (app.elements("form")[0].props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
    app.unmount(); const count = harness.writes; response.reject(new Error("late")); await pending; expect(harness.writes).toBe(count);
  });
});
