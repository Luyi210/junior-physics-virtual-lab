import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { LearningFeedback, SessionLearningRecord } from "@physics-lab/contracts";
import { getStudentRecordScope, subscribeStudentRecordScope, type StudentRecordScope } from "../../../data/studentRecordScope";
import { StudentLearningFeedback } from "./StudentLearningFeedback";
import { LearningFeedbackList } from "../../learning-feedback/LearningFeedbackList";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; writes: number };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, token: "", namespace: "https://school-a.test/api", feedback: vi.fn() }));
vi.mock("../../../data/teacherApi", () => ({
  studentApi: { feedback: (...args: unknown[]) => harness.feedback(...args) },
  PLATFORM_AUTH_EVENT: "platform-auth", STUDENT_AUTH_EVENT: "student-auth",
  getStudentAuthMetadata: () => ({ studentToken: harness.token, apiNamespace: harness.namespace, demoOnly: false, storageAvailable: true }),
}));
// Runs production handlers, the actual student scope and effect cleanup. It
// deliberately does not simulate browser scheduling or make network requests.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => { const frame = harness.frame!, item = slot(); if (!Object.hasOwn(item, "value")) item.value = typeof initial === "function" ? initial() : initial;
      return [item.value, (next: unknown) => { frame.writes++; item.value = typeof next === "function" ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { const item = slot(); if (!Object.hasOwn(item, "value")) item.value = { current: initial }; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.deps = deps; harness.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});

type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ""; }
function button(tree: ReactNode, name = "读取") { const found = walk(tree).find((item) => item.type === "button" && text(item).includes(name)); expect(found).toBeDefined(); return found!; }
function click(element: Element) { (element.props.onClick as () => void)(); }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { for (let index = 0; index < 8; index++) await Promise.resolve(); }
function token(extra: Record<string, unknown> = {}) { return `${btoa(JSON.stringify({ sub: "student-a", schoolId: "school-a", role: "student", name: "Student A", exp: Math.floor(Date.now() / 1000) + 60, ...extra })).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_")}.signature`; }
function detail(): SessionLearningRecord { return {
  session: { id: "session-a", taskId: "task-a", schoolId: "school-a", classId: "class-a", learnerId: "student-a", experimentId: "spring-force", status: "active", startedAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z", completedAt: null },
  taskTitle: "弹簧探究", className: "高一一班", lessonTitle: "弹力与伸长", learnerName: "学生甲",
  record: { sessionId: "session-a", learnerId: "student-a", revision: 3, lastMutationId: "record-3", updatedAt: "2026-11-11T00:00:00Z", prediction: "当前预测", measurements: "当前读数", conclusion: "当前结论", question: "当前问题" },
}; }
function feedback(): LearningFeedback { return {
  id: "feedback-a", schoolId: "school-a", classId: "class-a", taskId: "task-a", sessionId: "session-a", learnerId: "student-a", authorId: "teacher-a", authorName: "任课老师", authorRole: "teacher",
  body: "  请补充控制变量。\n第二行保留。  ", reportRevision: 2, reportUpdatedAt: "2026-11-10T23:00:00Z",
  reportSnapshot: { prediction: "旧预测", measurements: "旧读数\n第二行", conclusion: "旧结论", question: "旧问题" }, mutationId: "mutation-feedback-a", createdAt: "2026-11-11T00:00:00Z",
}; }
const cleanups: Array<() => void> = [];
function mount(initial: { scope?: StudentRecordScope; detail?: SessionLearningRecord; hasLocalChanges?: boolean } = {}) {
  let props = { scope: getStudentRecordScope(), detail: detail(), hasLocalChanges: false, ...initial };
  const frame: Frame = { slots: [], cursor: 0, effects: [], writes: 0 };
  const app = { tree: null as ReactNode, frame,
    render(next: Partial<typeof props> = {}) { props = { ...props, ...next }; frame.cursor = 0; harness.frame = frame;
      try { app.tree = StudentLearningFeedback(props); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
    get props() { return props; },
  }; app.render(); cleanups.push(() => app.unmount()); return app;
}
function change(kind: string) {
  if (kind === "student") harness.token = token({ sub: "student-b" });
  if (kind === "school") harness.token = token({ schoolId: "school-b" });
  if (kind === "namespace") harness.namespace = "https://school-b.test/api";
  if (kind === "renewal") harness.token = token({ nonce: "renewed" });
  if (kind === "expired") vi.advanceTimersByTime(61_000);
  if (kind === "logout") harness.token = "";
  window.dispatchEvent(new Event("student-auth"));
}
function list(tree: ReactNode) { return walk(tree).find((item) => item.type === LearningFeedbackList); }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:00:00Z")); harness.feedback.mockReset().mockResolvedValue([feedback()]);
  harness.namespace = "https://school-a.test/api"; harness.token = token(); vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("student explicitly reads version-bound teacher feedback", () => {
  it("does not load on mount and preserves the report while reading full snapshots on demand", async () => {
    const report = detail(), before = structuredClone(report); const app = mount({ detail: report, hasLocalChanges: true });
    expect(harness.feedback).not.toHaveBeenCalled(); expect(text(app.tree)).toContain("尚未读取");
    click(button(app.tree)); await settle(); app.render();
    expect(harness.feedback).toHaveBeenCalledExactlyOnceWith("session-a"); expect(report).toEqual(before);
    expect(list(app.tree)?.props.feedback).toEqual([feedback()]); expect(list(app.tree)?.props.currentRevision).toBe(3);
    expect(text(app.tree)).toContain("当前已读取的账号报告：版本 3"); expect(text(app.tree)).toContain("本机文字");
    expect((list(app.tree)!.props.canReveal as () => boolean)()).toBe(true);
  });

  it.each(["active", "completed"] as const)("keeps %s report content, revision and session status unchanged", async (status) => {
    const report = detail(); report.session.status = status; const before = JSON.stringify(report); const app = mount({ detail: report });
    click(button(app.tree)); await settle(); app.render(); expect(JSON.stringify(report)).toBe(before);
    expect(walk(app.tree).filter((item) => item.type === "button")).toHaveLength(1);
    expect(text(app.tree)).toContain(status === "completed" ? "原报告保持只读" : "自行修改上方原报告并保存");
    if (status === "completed") expect(text(app.tree)).toContain("暂不支持已完成报告修订或关联反馈的重做");
  });

  it("shows empty only after a successful empty response and allows reloading new feedback", async () => {
    harness.feedback.mockResolvedValueOnce([]); const app = mount(); click(button(app.tree)); await settle(); app.render();
    expect(text(app.tree)).toContain("本次读取未发现教师反馈"); expect(text(app.tree)).not.toContain("已看完");
    click(button(app.tree)); await settle(); app.render(); expect(list(app.tree)?.props.feedback).toEqual([feedback()]);
  });

  it("keeps a failed/offline read distinct from empty and retries without caching private data", async () => {
    const storage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() }; vi.stubGlobal("localStorage", storage); vi.stubGlobal("sessionStorage", storage);
    harness.feedback.mockRejectedValueOnce(new Error("网络暂不可用")); const app = mount(); click(button(app.tree)); await settle(); app.render();
    expect(text(app.tree)).toContain("当前不能判断是否有新反馈"); expect(text(app.tree)).not.toContain("未发现教师反馈"); expect(list(app.tree)).toBeUndefined();
    click(button(app.tree, "重试")); await settle(); app.render(); expect(list(app.tree)).toBeDefined();
    expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled(); expect(storage.getItem).not.toHaveBeenCalled();
  });

  it.each(["student", "school", "namespace", "renewal", "expired", "logout"])("invalidates old reads and buttons after %s", async (kind) => {
    const notify = vi.fn(); cleanups.push(subscribeStudentRecordScope(notify));
    const pending = deferred<LearningFeedback[]>(); harness.feedback.mockReturnValue(pending.promise); const app = mount(), oldButton = button(app.tree);
    click(oldButton); change(kind); const writes = app.frame.writes; pending.resolve([feedback()]); await settle(); click(oldButton); await settle();
    expect(harness.feedback).toHaveBeenCalledOnce(); expect(app.frame.writes).toBe(writes); expect(list(app.render())).toBeUndefined();
    expect(text(app.tree)).toContain("登录已过期或身份已变化"); expect(notify).toHaveBeenCalled();
  });

  it("does not apply a late error or start a request from an unmounted component", async () => {
    const pending = deferred<LearningFeedback[]>(); harness.feedback.mockReturnValue(pending.promise); const app = mount(), oldButton = button(app.tree); click(oldButton);
    app.unmount(); const writes = app.frame.writes; pending.reject(new Error("old private error")); await settle(); click(oldButton);
    expect(app.frame.writes).toBe(writes); expect(harness.feedback).toHaveBeenCalledOnce();
  });

  it("invalidates an already displayed snapshot's disclosure guard on renewal", async () => {
    const app = mount(); click(button(app.tree)); await settle(); app.render(); const reveal = list(app.tree)!.props.canReveal as () => boolean;
    expect(reveal()).toBe(true); change("renewal"); expect(reveal()).toBe(false); expect(list(app.render())).toBeUndefined();
  });

  it("requires an explicit read again after a session route changes and ignores the old response", async () => {
    const pending = deferred<LearningFeedback[]>(); harness.feedback.mockReturnValueOnce(pending.promise);
    const app = mount(), oldButton = button(app.tree); click(oldButton); const next = detail(); next.session.id = "session-b";
    app.render({ detail: next }); expect(text(app.tree)).toContain("尚未读取"); pending.resolve([feedback()]); await settle(); click(oldButton); expect(harness.feedback).toHaveBeenCalledOnce();
    harness.feedback.mockResolvedValueOnce([{ ...feedback(), sessionId: "session-b" }]); click(button(app.tree)); await settle(); app.render();
    expect(harness.feedback).toHaveBeenLastCalledWith("session-b"); expect(list(app.tree)).toBeDefined();
  });

  it("does not send duplicate reads from the same saved callback while pending", async () => {
    const pending = deferred<LearningFeedback[]>(); harness.feedback.mockReturnValue(pending.promise); const app = mount(), oldButton = button(app.tree);
    click(oldButton); click(oldButton); expect(harness.feedback).toHaveBeenCalledOnce(); pending.resolve([]); await settle();
  });

  it("allows fresh authenticated scope to read again while rejecting expired or mismatched report owners", async () => {
    change("expired"); const expired = mount(); expect(walk(expired.tree).some((item) => item.type === "button")).toBe(false);
    harness.token = token({ nonce: "new-login" }); const current = mount(); click(button(current.tree)); await settle(); expect(harness.feedback).toHaveBeenCalledOnce();
    const wrong = detail(); wrong.session.learnerId = "student-b"; const denied = mount({ detail: wrong }); expect(walk(denied.tree).some((item) => item.type === "button")).toBe(false);
  });

  it.each(["schoolId", "classId", "taskId", "sessionId", "learnerId"] as const)("rejects the whole response with a mismatched %s instead of filtering it into an empty list", async (field) => {
    harness.feedback.mockResolvedValue([feedback(), { ...feedback(), id: "foreign", [field]: "other" }]); const app = mount(); click(button(app.tree)); await settle(); app.render();
    expect(text(app.tree)).toContain("归属与当前实验不一致"); expect(list(app.tree)).toBeUndefined(); expect(text(app.tree)).not.toContain("未发现教师反馈");
  });

  it.each([
    { reportRevision: 0 }, { reportRevision: 1.5 }, { body: " " }, { body: "字".repeat(4001) },
    { reportSnapshot: { prediction: "only one field" } }, { reportUpdatedAt: "not-a-time" }, { authorRole: "student" },
  ])("rejects incomplete or invalid feedback payload %j", async (patch) => {
    harness.feedback.mockResolvedValue([{ ...feedback(), ...patch }]); const app = mount(); click(button(app.tree)); await settle(); app.render();
    expect(text(app.tree)).toContain("未能读取反馈"); expect(list(app.tree)).toBeUndefined();
  });

  it("does not treat feedback against a newer server revision as feedback on an older local report", async () => {
    const newest = { ...feedback(), reportRevision: 4 }; harness.feedback.mockResolvedValue([newest]); const app = mount(); click(button(app.tree)); await settle(); app.render();
    expect(list(app.tree)?.props.currentRevision).toBe(3); expect(list(app.tree)?.props.feedback).toEqual([newest]);
    const updated = detail(); updated.record!.revision = 5; app.render({ detail: updated }); expect(list(app.tree)?.props.currentRevision).toBe(5); expect(harness.feedback).toHaveBeenCalledOnce();
  });
});
