import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CreateLearningFeedbackRequest, LearningFeedback, SessionLearningRecord } from "@physics-lab/contracts";
import { TeacherFeedbackPanel, TeacherFeedbackReportPreview } from "./TeacherFeedbackPanel";
import { TeacherApiError } from "../../data/teacherApi";
import { LearningFeedbackList } from "../learning-feedback/LearningFeedbackList";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; writes: number };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, id: 0 }));
const auth = vi.hoisted(() => ({ generation: 0, userId: "teacher", schoolId: "school", namespace: "https://school.test/api", expiresAt: 4_102_444_800_000 }));
const api = vi.hoisted(() => ({ feedback: vi.fn(), createFeedback: vi.fn(), taskRecords: vi.fn() }));
vi.mock("../../data/teacherApi", () => ({
  teacherApi: api, TeacherApiError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }, PLATFORM_AUTH_EVENT: "feedback-auth",
  getTeacherAuthMetadata: () => ({ apiNamespace: auth.namespace, demoOnly: false, storageAvailable: true, generation: auth.generation,
    teacherToken: JSON.stringify({ id: auth.userId, schoolId: auth.schoolId, role: "teacher", name: auth.userId, expiresAt: auth.expiresAt }) }),
  readTeacherTokenClaims: (token: string) => JSON.parse(token), isTeacherAuthStorageKey: () => true,
}));
// Executes the production callbacks/cleanup with a deterministic hook adapter;
// network and React scheduling are test doubles, not a browser interaction test.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (item: Slot, deps?: readonly unknown[]) => !deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]));
  return { ...actual,
    useState: (initial: unknown) => { if (!harness.frame) return actual.useState(initial); const frame = harness.frame, item = slot(); if (!("value" in item)) item.value = typeof initial === "function" ? initial() : initial; return [item.value, (next: unknown) => { frame.writes++; item.value = typeof next === "function" ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { if (!harness.frame) return actual.useRef(initial); const item = slot(); if (!("value" in item)) item.value = { current: initial }; return item.value; },
    useId: () => { if (!harness.frame) return actual.useId(); const item = slot(); if (!item.value) item.value = `feedback-test-${++harness.id}`; return item.value; },
    useCallback: (callback: unknown, deps?: readonly unknown[]) => { if (!harness.frame) return actual.useCallback(callback as () => void, deps ?? []); const item = slot(); if (changed(item, deps)) { item.value = callback; item.deps = deps; } return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (!harness.frame) return actual.useEffect(effect, deps); const item = slot(); if (changed(item, deps)) { item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(text).join("") : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ""; }
function button(tree: ReactNode, label: string) { const value = walk(tree).find((node) => node.type === "button" && text(node).includes(label)); expect(value, label).toBeDefined(); return value!; }
function click(node: Element) { (node.props.onClick as () => void)(); }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function drain() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
const cleanups: Array<() => void> = [];
function mount(item: SessionLearningRecord) {
  let currentItem = item;
  const frame: Frame = { slots: [], cursor: 0, effects: [], writes: 0 };
  const app = { tree: null as ReactNode, frame, render(next?: SessionLearningRecord) { if (next) currentItem = next; frame.cursor = 0; harness.frame = frame; try { app.tree = TeacherFeedbackPanel({ item: currentItem }); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; }, unmount() { frame.slots.forEach((slot) => { slot.cleanup?.(); slot.cleanup = undefined; }); } };
  app.render(); cleanups.push(app.unmount); return app;
}
const textarea = (app: ReturnType<typeof mount>) => walk(app.tree).find((node) => node.type === "textarea")!;
function edit(app: ReturnType<typeof mount>, body: string) { (textarea(app).props.onChange as (event: unknown) => void)({ target: { value: body } }); app.render(); }
async function open(app: ReturnType<typeof mount>) { click(button(app.tree, "查看与编写")); await drain(); app.render(); }
let sequence = 0;
let item: SessionLearningRecord;
function result(request: CreateLearningFeedbackRequest, overrides: Partial<LearningFeedback> = {}): LearningFeedback {
  return { id: `saved-${request.mutationId}`, schoolId: item.session.schoolId, classId: item.session.classId, taskId: item.session.taskId, sessionId: item.session.id, learnerId: item.session.learnerId,
    authorId: auth.userId, authorName: "任课教师", authorRole: "teacher", body: request.body, reportRevision: request.expectedRevision, reportUpdatedAt: item.record!.updatedAt,
    reportSnapshot: { prediction: item.record!.prediction, measurements: item.record!.measurements, conclusion: item.record!.conclusion, question: item.record!.question }, mutationId: request.mutationId, createdAt: "2026-11-11T10:00:00Z", ...overrides };
}
function changeIdentity(id = "teacher-other") { auth.userId = id; auth.generation++; window.dispatchEvent(new Event("feedback-auth")); }
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("window", new EventTarget()); auth.generation++; auth.userId = "teacher"; auth.schoolId = "school"; auth.namespace = "https://school.test/api"; auth.expiresAt = 4_102_444_800_000;
  const id = `session-${++sequence}`;
  item = { session: { id, schoolId: "school", classId: "class", taskId: "task", learnerId: "student", experimentId: "spring-force", status: "active", startedAt: "2026-11-11T09:00:00Z", updatedAt: "2026-11-11T09:30:00Z", completedAt: null }, learnerName: "学生", taskTitle: "探究", className: "高一", lessonTitle: "弹簧", record: { sessionId: id, learnerId: "student", revision: 2, lastMutationId: "student-save", prediction: "原预测", measurements: "模型读数", conclusion: "原结论", question: "原疑问", updatedAt: "2026-11-11T09:30:00Z" } };
  api.feedback.mockResolvedValue([]); api.taskRecords.mockImplementation(async () => [item]); api.createFeedback.mockImplementation(async (_id, request) => result(request));
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe("teacher feedback explicit reading and submission", () => {
  it("does not fetch every collapsed card; only an explicit open reads feedback", async () => {
    const app = mount(item); expect(api.feedback).not.toHaveBeenCalled(); expect(text(app.tree)).toContain("查看与编写教师反馈");
    await open(app); expect(api.feedback).toHaveBeenCalledExactlyOnceWith(item.session.id); expect(text(app.tree)).toContain("还没有已保存");
    click(button(app.tree, "收起教师反馈")); app.render(); await open(app); expect(api.feedback).toHaveBeenCalledTimes(1);
  });
  it("only the explicit submit sends exact body/revision and stores returned history without changing the report", async () => {
    const before = structuredClone(item); const app = mount(item); await open(app); edit(app, "  请用两组读数解释结论。\n");
    expect(api.createFeedback).not.toHaveBeenCalled(); click(button(app.tree, "提交这条反馈")); await drain(); app.render();
    expect(api.createFeedback).toHaveBeenCalledExactlyOnceWith(item.session.id, expect.objectContaining({ body: "  请用两组读数解释结论。\n", expectedRevision: 2 }));
    expect(textarea(app).props.value).toBe(""); expect(text(app.tree)).toContain("反馈已保存"); expect(item).toEqual(before);
    const history = walk(app.tree).find((node) => node.type === LearningFeedbackList)!; expect((history.props.feedback as LearningFeedback[])[0].reportRevision).toBe(2);
  });
  it("permits feedback on completed reports but never offers a report unlock", async () => {
    item.session.status = "completed"; item.session.completedAt = "2026-11-11T10:00:00Z"; const app = mount(item); await open(app);
    expect(text(app.tree)).toContain("已完成，反馈不会解锁"); edit(app, "解释保持不变的变量。"); click(button(app.tree, "提交这条反馈")); await drain(); expect(api.createFeedback).toHaveBeenCalledOnce(); expect(item.session.status).toBe("completed");
  });
  it("blocks missing, whitespace-only and oversized report feedback even through direct callbacks", async () => {
    const app = mount(item); await open(app); edit(app, " \n "); click(button(app.tree, "提交这条反馈")); await drain(); expect(api.createFeedback).not.toHaveBeenCalled();
    edit(app, "字".repeat(4001)); click(button(app.tree, "提交这条反馈")); expect(api.createFeedback).not.toHaveBeenCalled();
    const missing = mount({ ...item, session: { ...item.session, id: "no-report" }, record: null }); await open(missing); expect(textarea(missing).props.disabled).toBe(true); click(button(missing.tree, "提交这条反馈")); expect(api.createFeedback).not.toHaveBeenCalled();
  });
  it("preserves an immutable operation across unknown network failure and retries the same mutation exactly", async () => {
    api.createFeedback.mockRejectedValueOnce(new Error("连接中断")); const app = mount(item); await open(app); edit(app, "请补充控变量。"); click(button(app.tree, "提交这条反馈")); await drain(); app.render();
    const original = structuredClone(api.createFeedback.mock.calls[0][1]); expect(textarea(app).props.readOnly).toBe(true); edit(app, "偷偷换一条"); expect(textarea(app).props.value).toBe(original.body);
    click(button(app.tree, "重试确认原提交")); await drain(); app.render(); expect(api.createFeedback.mock.calls[1][1]).toEqual(original); expect(textarea(app).props.value).toBe("");
  });
  it("keeps the draft and explains the failure if no secure random operation id is available", async () => {
    const app = mount(item); await open(app); edit(app, "浏览器异常也保留的草稿"); vi.stubGlobal("crypto", undefined);
    click(button(app.tree, "提交这条反馈")); await drain(); app.render(); expect(api.createFeedback).not.toHaveBeenCalled();
    expect(textarea(app).props.value).toBe("浏览器异常也保留的草稿"); expect(text(app.tree)).toContain("本次没有发送"); expect(textarea(app).props.readOnly).toBe(false);
  });
  it("uses secure random bytes when randomUUID is unavailable, without a timestamp operation id", async () => {
    const app = mount(item); await open(app); edit(app, "安全随机回退"); const getRandomValues = vi.fn((values: Uint8Array) => { values.fill(173); return values; }); vi.stubGlobal("crypto", { getRandomValues });
    click(button(app.tree, "提交这条反馈")); await drain(); expect(getRandomValues).toHaveBeenCalledOnce(); expect(api.createFeedback.mock.calls[0][1].mutationId).toBe(`feedback-${"ad".repeat(16)}`);
  });
  it("labels history using the latest read report while retaining the older draft basis until explicit review", async () => {
    api.feedback.mockResolvedValue([result({ body: "历史反馈", expectedRevision: 1, mutationId: "history" })]); const app = mount(item); await open(app); edit(app, "仍依据第二版的草稿");
    api.taskRecords.mockResolvedValue([{ ...item, record: { ...item.record!, revision: 3, prediction: "第三版" } }]); click(button(app.tree, "刷新报告，重新核对")); await drain(); app.render();
    const history = walk(app.tree).find((node) => node.type === LearningFeedbackList)!; expect(history.props.currentRevision).toBe(3); expect(text(app.tree)).toContain("本条反馈依据：报告第 2 版");
    expect(api.createFeedback).not.toHaveBeenCalled();
  });
  it("blocks double-click submissions before React rerenders", async () => {
    const pending = deferred<LearningFeedback>(); api.createFeedback.mockReturnValueOnce(pending.promise); const app = mount(item); await open(app); edit(app, "请说明依据。"); const submit = button(app.tree, "提交这条反馈"); click(submit); click(submit); expect(api.createFeedback).toHaveBeenCalledTimes(1); pending.resolve(result(api.createFeedback.mock.calls[0][1])); await drain();
  });
  it.each(["RECORD_CONFLICT", "FEEDBACK_CONFLICT"])("keeps the draft on %s; refresh only previews and explicit rechecking is required before a new submission", async (code) => {
    api.createFeedback.mockRejectedValueOnce(new TeacherApiError(409, code, "冲突")); const app = mount(item); await open(app); edit(app, "请结合新读数解释。"); click(button(app.tree, "提交这条反馈")); await drain(); app.render();
    const first = structuredClone(api.createFeedback.mock.calls[0][1]); expect(textarea(app).props.value).toBe(first.body); expect(button(app.tree, "提交这条反馈").props.disabled).toBe(true);
    const latest = { ...item, record: { ...item.record!, revision: 3, prediction: "新的预测" } }; api.taskRecords.mockResolvedValue([latest]); click(button(app.tree, "刷新报告，重新核对")); await drain(); app.render();
    expect(api.createFeedback).toHaveBeenCalledTimes(1); expect(text(app.tree)).toContain("刚读取的报告第 3 版"); click(button(app.tree, "提交这条反馈")); expect(api.createFeedback).toHaveBeenCalledTimes(1);
    click(button(app.tree, "已重新核对")); app.render(); expect(api.createFeedback).toHaveBeenCalledTimes(1); click(button(app.tree, "提交这条反馈")); await drain();
    expect(api.createFeedback.mock.calls[1][1]).toMatchObject({ body: first.body, expectedRevision: 3 }); expect(api.createFeedback.mock.calls[1][1].mutationId).not.toBe(first.mutationId);
  });
  it("rejects refresh results from another student/class/school even if the session id matches", async () => {
    const app = mount(item); await open(app); edit(app, "保留原稿"); api.taskRecords.mockResolvedValue([{ ...item, session: { ...item.session, learnerId: "other" }, record: { ...item.record!, revision: 8 } }]);
    click(button(app.tree, "刷新报告，重新核对")); await drain(); app.render(); expect(text(app.tree)).toContain("没有找到归属一致"); expect(text(app.tree)).not.toContain("已重新核对，改用此版本"); expect(textarea(app).props.value).toBe("保留原稿");
  });
  it("does not let a delayed initial GET erase a feedback receipt returned by POST", async () => {
    const initial = deferred<LearningFeedback[]>(); api.feedback.mockReturnValueOnce(initial.promise); const app = mount(item); click(button(app.tree, "查看与编写")); app.render(); edit(app, "请说明为什么。"); click(button(app.tree, "提交这条反馈")); await drain();
    const older = result({ body: "较早的反馈", expectedRevision: 1, mutationId: "older" }); initial.resolve([older]); await drain(); app.render();
    const history = walk(app.tree).find((node) => node.type === LearningFeedbackList)!; expect((history.props.feedback as LearningFeedback[]).map((value) => value.body)).toEqual(["请说明为什么。", "较早的反馈"]);
  });
});

describe("feedback page-memory drafts and teacher lifetime", () => {
  it("keeps an unsent draft across close/remount, warns before unload and does not use browser storage", async () => {
    const app = mount(item); await open(app); edit(app, "未提交私有反馈"); click(button(app.tree, "收起教师反馈")); app.render(); expect(text(app.tree)).toContain("有未提交或待确认反馈"); app.unmount();
    const reload = mount(item); await open(reload); expect(textarea(reload).props.value).toBe("未提交私有反馈");
    const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(text(reload.tree)).toContain("刷新、关闭标签会丢失");
  });
  it("a new teacher cannot see or submit another teacher's draft; the original teacher can return after renewal", async () => {
    const app = mount(item); await open(app); edit(app, "甲的私有草稿"); const oldSubmit = button(app.tree, "提交这条反馈"); changeIdentity(); click(oldSubmit); expect(api.createFeedback).not.toHaveBeenCalled(); expect(app.render()).toBeNull();
    const other = mount(item); await open(other); expect(textarea(other).props.value).toBe(""); changeIdentity("teacher"); const original = mount(item); await open(original); expect(textarea(original).props.value).toBe("甲的私有草稿");
  });
  it.each(["success", "error"])("ignores late %s after renewal and keeps the original pending mutation for the original account", async (outcome) => {
    const pending = deferred<LearningFeedback>(); api.createFeedback.mockReturnValueOnce(pending.promise); const app = mount(item); await open(app); edit(app, "发送中的反馈"); click(button(app.tree, "提交这条反馈")); const request = structuredClone(api.createFeedback.mock.calls[0][1]);
    changeIdentity("teacher"); const writes = app.frame.writes;
    if (outcome === "success") pending.resolve(result(request)); else pending.reject(new Error("迟到的错误")); await drain(); expect(app.frame.writes).toBe(writes);
    const renewed = mount(item); await open(renewed); expect(textarea(renewed).props.value).toBe(request.body); expect(textarea(renewed).props.readOnly).toBe(true); click(button(renewed.tree, "重试确认原提交")); await drain(); expect(api.createFeedback.mock.calls[1][1]).toEqual(request);
  });
  it("keeps a pending attempt across route unmount and discards late GET contents after logout", async () => {
    const pending = deferred<LearningFeedback[]>(); api.feedback.mockReturnValueOnce(pending.promise); const app = mount(item); click(button(app.tree, "查看与编写")); app.render(); app.unmount(); const writes = app.frame.writes;
    pending.resolve([result({ body: "不得回填", expectedRevision: 2, mutationId: "old" })]); await drain(); expect(app.frame.writes).toBe(writes);
  });
  it("rejects a mismatched feedback batch without exposing the unrelated report snapshot", async () => {
    api.feedback.mockResolvedValue([result({ body: "他人反馈", expectedRevision: 2, mutationId: "other" }, { learnerId: "other-student" })]); const app = mount(item); await open(app);
    expect(text(app.tree)).toContain("归属不一致"); expect(walk(app.tree).some((node) => node.type === LearningFeedbackList)).toBe(false);
  });
  it("rejects old callbacks and a late GET when the same mounted session id receives a different owner tuple", async () => {
    const pending = deferred<LearningFeedback[]>(); api.feedback.mockReturnValueOnce(pending.promise); const app = mount(item); click(button(app.tree, "查看与编写")); app.render(); edit(app, "原学生的草稿");
    const oldSubmit = button(app.tree, "提交这条反馈"), oldRefresh = button(app.tree, "刷新报告，重新核对");
    app.render({ ...item, session: { ...item.session, learnerId: "different-learner" } }); expect(app.tree).toBeNull(); const writes = app.frame.writes;
    click(oldSubmit); click(oldRefresh); pending.resolve([result({ body: "旧原文", expectedRevision: 2, mutationId: "old-owner" })]); await drain();
    expect(api.createFeedback).not.toHaveBeenCalled(); expect(api.taskRecords).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
  });
  it("SSR escapes the reviewed four-part report and hides it when the current reveal guard fails", () => {
    const malicious = { ...item.record!, prediction: "<script>alert(1)</script>", question: "<img src=x onerror=alert(1)>" };
    const html = renderToStaticMarkup(<TeacherFeedbackReportPreview record={malicious} title="原文" canReveal={() => true} />);
    expect(html).toContain("&lt;script&gt;"); expect(html).toContain("&lt;img"); expect(html).not.toContain("<script>"); expect(html).not.toContain("<img src");
    const hidden = renderToStaticMarkup(<TeacherFeedbackReportPreview record={malicious} title="原文" canReveal={() => false} />);
    expect(hidden).not.toContain("alert(1)");
  });
  it("SSR keeps a closed panel readable without fetching or rendering report/feedback content", () => {
    const html = renderToStaticMarkup(<TeacherFeedbackPanel item={item} />); expect(html).toContain("查看与编写教师反馈"); expect(html).not.toContain("原预测"); expect(api.feedback).not.toHaveBeenCalled();
  });
});
