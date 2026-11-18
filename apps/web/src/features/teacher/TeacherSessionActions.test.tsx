import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { PlatformUser, TeachingClass, TeachingLesson, TeachingTask } from "@physics-lab/contracts";
import { TeacherAccountCenter } from "./TeacherAccountCenter";
import { TeacherRealClasses } from "./TeacherRealClasses";
import { TeacherTeachingFlow } from "./TeacherTeachingFlow";
import { TeacherGuangguang } from "./TeacherGuangguang";
import { createDefaultTeacherWorkspace } from "./teacherWorkspace";
import { subscribeTeacherSessionScope } from "../../data/teacherSessionScope";

// Real component callbacks + real session guard/scope. Only React's scheduling,
// authentication metadata and transport are controlled; this is not a browser.
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; writes: number };
const harness = vi.hoisted(() => ({ frame: null as Frame | null }));
const auth = vi.hoisted(() => ({ generation: 0, namespace: "https://school-a.test/api", token: "", demo: false }));
const api = vi.hoisted(() => ({
  createAccount: vi.fn(), addClassMember: vi.fn(), removeClassMember: vi.fn(), resetAccountPassword: vi.fn(), updateAccountStatus: vi.fn(),
  createClass: vi.fn(), createLesson: vi.fn(), createTask: vi.fn(), updateTaskStatus: vi.fn(), hasSession: vi.fn(), askGuangguang: vi.fn(),
}));
vi.mock("../../data/teacherApi", () => ({
  teacherApi: api, TeacherApiError: class extends Error {}, PLATFORM_AUTH_EVENT: "test-teacher-auth",
  getTeacherAuthMetadata: () => ({ apiNamespace: auth.namespace, demoOnly: auth.demo, storageAvailable: true, teacherToken: auth.token, generation: auth.generation }),
  readTeacherTokenClaims: (token: string) => token ? JSON.parse(token) : null,
  isTeacherAuthStorageKey: () => true,
}));
vi.mock("react-router-dom", () => ({ Link: "a" }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (item: Slot, deps?: readonly unknown[]) => !deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]));
  return { ...actual,
    useState: (initial: unknown) => {
      const frame = harness.frame!, item = slot();
      if (!Object.hasOwn(item, "value")) item.value = typeof initial === "function" ? initial() : initial;
      return [item.value, (next: unknown) => { frame.writes++; item.value = typeof next === "function" ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => { const item = slot(); if (!Object.hasOwn(item, "value")) item.value = { current: initial }; return item.value; },
    useMemo: (factory: () => unknown, deps?: readonly unknown[]) => { const item = slot(); if (changed(item, deps)) { item.value = factory(); item.deps = deps; } return item.value; },
    useCallback: (callback: unknown, deps?: readonly unknown[]) => { const item = slot(); if (changed(item, deps)) { item.value = callback; item.deps = deps; } return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const item = slot(); if (changed(item, deps)) { item.deps = deps; harness.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});

type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : "";
}
function button(tree: ReactNode, label: string) { const result = walk(tree).find((item) => item.type === "button" && text(item).includes(label)); expect(result, label).toBeDefined(); return result!; }
function click(element: Element, event: unknown = {}) { return (element.props.onClick as (event: unknown) => unknown)(event); }
const cleanups: Array<() => void> = [];
function mount(component: () => ReactNode) {
  const frame: Frame = { slots: [], cursor: 0, effects: [], writes: 0 };
  const app = { tree: null as ReactNode, frame,
    render() { frame.cursor = 0; harness.frame = frame; try { app.tree = component(); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function drain() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function submit(form: Element, values: Record<string, string>) {
  vi.stubGlobal("FormData", class { get(key: string) { return values[key] ?? null; } });
  const reset = vi.fn();
  const promise = (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {}, currentTarget: { reset } });
  return { promise, reset };
}
function form(tree: ReactNode) { return walk(tree).find((item) => item.type === "form")!; }
function changeIdentity(kind = "teacher") {
  const claims = JSON.parse(auth.token);
  if (kind === "teacher") claims.id = "teacher-b";
  if (kind === "school") claims.schoolId = "school-b";
  if (kind === "namespace") auth.namespace = "https://school-b.test/api";
  if (kind === "expired") claims.expiresAt = Date.now() - 1;
  auth.token = kind === "logout" ? "" : JSON.stringify(claims); auth.generation++;
  window.dispatchEvent(new Event("test-teacher-auth"));
}
const teacher: PlatformUser = { id: "teacher-a", schoolId: "school-a", name: "教师甲", email: "teacher-a@test", role: "teacher", status: "active", lastLoginAt: null, classIds: [], classNames: [], createdAt: "2026-11-01T00:00:00Z" };
const student: PlatformUser = { ...teacher, id: "student-a", name: "私有学生姓名", email: "student@test", role: "student" };
const classroom: TeachingClass = { id: "class-a", schoolId: "school-a", name: "私有班级甲", grade: "高一", joinCode: "SECRET-A", studentCount: 1, createdBy: teacher.id, createdAt: teacher.createdAt };
const lesson = { id: "lesson-a", title: "私有课例甲", experimentId: "spring-force", durationMinutes: 40, status: "ready", inquiryQuestion: "探究" } as TeachingLesson;
const task = { id: "task-a", title: "私有任务甲", lessonTitle: lesson.title, className: classroom.name, mode: "in-class", status: "published", dueAt: null } as TeachingTask;
const refresh = vi.fn();
function accounts() { return mount(() => TeacherAccountCenter({ currentUser: teacher, students: [student], teachers: [], classes: [classroom], onRefresh: refresh })); }
function classes() { return mount(() => TeacherRealClasses({ classes: [classroom], students: [student], onRefresh: refresh })); }
function flow() { return mount(() => TeacherTeachingFlow({ classes: [classroom], lessons: [lesson], tasks: [task], onRefresh: refresh })); }
function accountForm(app: ReturnType<typeof accounts>) { click(button(app.tree, "创建学生账号")); app.render(); return form(app.tree); }
const accountValues = { name: "新学生", email: "new@test", password: "Student123!", classId: "class-a" };

beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("window", new EventTarget());
  auth.generation++; auth.namespace = "https://school-a.test/api"; auth.demo = false;
  auth.token = JSON.stringify({ id: teacher.id, schoolId: teacher.schoolId, role: "teacher", name: teacher.name, expiresAt: Date.now() + 60_000 });
  refresh.mockResolvedValue(undefined); api.createAccount.mockResolvedValue({ ...student, id: "new", email: "new@test" });
  api.addClassMember.mockResolvedValue(undefined); api.createClass.mockResolvedValue(classroom); api.createLesson.mockResolvedValue(lesson); api.createTask.mockResolvedValue(task);
  api.hasSession.mockImplementation(() => !!auth.token); api.askGuangguang.mockResolvedValue({ text: "当前教师的答复", citations: [] });
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe("teacher child actions retain their mounted teacher identity", () => {
  it("keeps account creation, membership and refresh available for the same teacher", async () => {
    const app = accounts(); const result = submit(accountForm(app), accountValues); await result.promise;
    expect(api.createAccount).toHaveBeenCalledOnce(); expect(api.addClassMember).toHaveBeenCalledWith("class-a", "new@test");
    expect(refresh).toHaveBeenCalledOnce(); expect(result.reset).toHaveBeenCalledOnce(); expect(text(app.render())).toContain("学生账号已创建并写入后台");
  });

  it("retains a created account after membership failure and retries only the assignment", async () => {
    api.addClassMember.mockRejectedValueOnce(new Error("assignment unavailable"));
    const app = accounts(), oldForm = accountForm(app), result = submit(oldForm, accountValues);
    await result.promise;
    expect(refresh).toHaveBeenCalledOnce(); expect(result.reset).toHaveBeenCalledOnce();
    expect(text(app.render())).toContain("账号已创建");
    expect(text(app.tree)).toContain("结果尚未确认");
    expect(walk(app.tree).filter((item) => item.type === "form")).toHaveLength(0);
    await submit(oldForm, accountValues).promise;
    click(button(app.tree, "重试加入班级")); await drain();
    expect(api.createAccount).toHaveBeenCalledOnce();
    expect(api.addClassMember).toHaveBeenNthCalledWith(2, "class-a", "new@test");
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(text(app.render())).toContain("学生账号已创建并写入后台");
    expect(text(app.tree)).not.toContain("重试加入班级");
  });

  it("retains the confirmed membership when refreshing fails and retries no mutation", async () => {
    refresh.mockRejectedValueOnce(new Error("refresh unavailable"));
    const app = accounts(); await submit(accountForm(app), accountValues).promise;
    expect(text(app.render())).toContain("分班操作已完成");
    click(button(app.tree, "重试刷新账号列表")); await drain();
    expect(api.createAccount).toHaveBeenCalledOnce(); expect(api.addClassMember).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(2); expect(text(app.render())).toContain("学生账号已创建并写入后台");
  });

  it("keeps repeated assignment failures recoverable and lets the teacher explicitly defer", async () => {
    api.addClassMember.mockRejectedValue(new Error("assignment unavailable"));
    const app = accounts(); await submit(accountForm(app), accountValues).promise; app.render();
    const oldRetry = button(app.tree, "重试加入班级"); click(oldRetry); await drain();
    expect(text(app.render())).toContain("结果尚未确认"); expect(refresh).toHaveBeenCalledTimes(2);
    click(button(app.tree, "稍后在账号管理中处理")); app.render();
    expect(text(app.tree)).toContain("账号 new@test 已保留");
    click(oldRetry); await drain(); expect(api.addClassMember).toHaveBeenCalledTimes(2);
    expect(button(app.tree, "创建学生账号").props.disabled).toBe(false);
    click(button(app.tree, "创建学生账号")); app.render(); expect(form(app.tree)).toBeDefined();
  });

  it("does not duplicate account creation when form callbacks run before React repaints", async () => {
    const pending = deferred<PlatformUser>(); api.createAccount.mockReturnValue(pending.promise);
    const app = accounts(), oldForm = accountForm(app), first = submit(oldForm, accountValues);
    await submit(oldForm, accountValues).promise; expect(api.createAccount).toHaveBeenCalledOnce();
    pending.resolve({ ...student, id: "new", email: "new@test" }); await first.promise;
    expect(api.addClassMember).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
  });

  it("guards a pending recovery action before and after teacher identity changes", async () => {
    api.addClassMember.mockRejectedValueOnce(new Error("assignment unavailable"));
    const app = accounts(); await submit(accountForm(app), accountValues).promise; app.render();
    const pending = deferred<unknown>(); api.addClassMember.mockReturnValue(pending.promise);
    const oldRetry = button(app.tree, "重试加入班级"); click(oldRetry); await drain();
    changeIdentity(); const writes = app.frame.writes;
    pending.resolve({}); await drain(); click(oldRetry); await drain();
    expect(api.createAccount).toHaveBeenCalledOnce(); expect(api.addClassMember).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledOnce(); expect(app.frame.writes).toBe(writes);
    expect(text(app.render())).not.toContain("new@test");
  });

  it.each(["teacher", "school", "namespace", "renewal", "expired", "logout"])("rejects a saved form callback after %s changes without borrowing the new token", async (kind) => {
    const app = accounts(), savedForm = accountForm(app); changeIdentity(kind); const writes = app.frame.writes;
    await submit(savedForm, accountValues).promise;
    expect(api.createAccount).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
    expect(text(app.render())).not.toContain(student.name);
  });

  it("stops create-account → add-member after an identity event while preserving the already sent request", async () => {
    const notifications = vi.fn(); cleanups.push(subscribeTeacherSessionScope(notifications));
    const pending = deferred<PlatformUser>(); api.createAccount.mockReturnValue(pending.promise);
    const app = accounts(), result = submit(accountForm(app), accountValues);
    expect(api.createAccount).toHaveBeenCalledOnce(); changeIdentity(); expect(notifications).toHaveBeenCalled(); const writes = app.frame.writes;
    pending.resolve({ ...student, email: "new@test" }); await result.promise;
    expect(api.addClassMember).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(result.reset).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
  });

  it.each(["resolve", "reject"])("does not refresh or fill success/error after a late membership %s", async (outcome) => {
    const pending = deferred<unknown>(); api.addClassMember.mockReturnValue(pending.promise);
    const app = accounts(), result = submit(accountForm(app), accountValues); await drain(); expect(api.addClassMember).toHaveBeenCalledOnce();
    changeIdentity(); const writes = app.frame.writes; if (outcome === "resolve") pending.resolve({}); else pending.reject(new Error("old error")); await result.promise;
    expect(refresh).not.toHaveBeenCalled(); expect(result.reset).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
  });

  it("does not update feedback after an in-flight refresh changes identity", async () => {
    const pending = deferred<void>(); refresh.mockReturnValue(pending.promise);
    const app = accounts(); click(button(app.tree, "刷新")); await drain(); expect(refresh).toHaveBeenCalledOnce();
    changeIdentity(); const writes = app.frame.writes; pending.resolve(); await drain(); expect(app.frame.writes).toBe(writes);
  });

  it("rejects old status, password, membership, refresh and local controls", async () => {
    const app = accounts(); click(button(app.tree, "管理")); app.render(); const oldTree = app.tree; changeIdentity(); const writes = app.frame.writes;
    click(button(oldTree, "停用账号")); click(button(oldTree, "加入班级")); click(button(oldTree, "刷新")); click(button(oldTree, "创建学生账号"));
    await submit(form(oldTree), { password: "replacement" }).promise;
    expect(api.updateAccountStatus).not.toHaveBeenCalled(); expect(api.addClassMember).not.toHaveBeenCalled(); expect(api.resetAccountPassword).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
  });

  it("uses actual effect cleanup to block late account completion and old callbacks after unmount", async () => {
    const pending = deferred<PlatformUser>(); api.createAccount.mockReturnValue(pending.promise);
    const app = accounts(), oldForm = accountForm(app), result = submit(oldForm, accountValues); app.unmount(); const writes = app.frame.writes;
    pending.resolve(student); await result.promise; await submit(oldForm, accountValues).promise;
    expect(api.createAccount).toHaveBeenCalledOnce(); expect(api.addClassMember).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
  });

  it("does not refresh or reveal a newly created class after identity change", async () => {
    const pending = deferred<TeachingClass>(); api.createClass.mockReturnValue(pending.promise);
    const app = classes(); click(button(app.tree, "创建教学班")); app.render(); const result = submit(form(app.tree), { name: "新班级", grade: "高一" });
    changeIdentity(); const writes = app.frame.writes; pending.resolve(classroom); await result.promise;
    expect(refresh).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes); expect(text(app.render())).not.toContain(classroom.joinCode);
  });

  it("guards clipboard completion, old clipboard callbacks and route navigation", async () => {
    const pending = deferred<void>(), writeText = vi.fn().mockReturnValue(pending.promise); vi.stubGlobal("navigator", { clipboard: { writeText } });
    const app = classes(), oldCopy = button(app.tree, "复制"), oldLink = walk(app.tree).find((item) => item.type === "a")!;
    click(oldCopy); changeIdentity(); const writes = app.frame.writes; pending.resolve(); await drain(); click(oldCopy);
    const preventDefault = vi.fn(); click(oldLink, { preventDefault });
    expect(writeText).toHaveBeenCalledExactlyOnceWith("SECRET-A"); expect(app.frame.writes).toBe(writes); expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("does not claim clipboard success when the browser cannot copy", async () => {
    vi.stubGlobal("navigator", {}); const app = classes(); click(button(app.tree, "复制")); await drain();
    expect(text(app.render())).toContain("无法复制"); expect(text(app.tree)).not.toContain("已复制");
  });

  it.each(["创建课例", "发布任务"])("does not refresh or fill stale %s results", async (label) => {
    const pending = deferred<unknown>(); (label === "创建课例" ? api.createLesson : api.createTask).mockReturnValue(pending.promise);
    const app = flow(); click(button(app.tree, label)); app.render();
    const result = submit(form(app.tree), { title: "新任务", lessonId: lesson.id, classId: classroom.id, durationMinutes: "40", mode: "in-class" });
    changeIdentity(); const writes = app.frame.writes; pending.resolve(label === "创建课例" ? lesson : task); await result.promise;
    expect(refresh).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes); expect(text(app.render())).not.toContain(lesson.title);
  });

  it("rejects old publish, task status and experiment navigation callbacks", async () => {
    const app = flow(); click(button(app.tree, "发布任务")); app.render(); const oldTree = app.tree, oldForm = form(oldTree); changeIdentity(); const writes = app.frame.writes;
    await submit(oldForm, { title: "旧请求" }).promise; click(button(oldTree, "关闭"));
    const preventDefault = vi.fn(); click(walk(oldTree).find((item) => item.type === "a")!, { preventDefault });
    expect(api.createTask).not.toHaveBeenCalled(); expect(api.updateTaskStatus).not.toHaveBeenCalled(); expect(preventDefault).toHaveBeenCalledOnce(); expect(app.frame.writes).toBe(writes);
  });

  it.each(["resolve", "reject"])("does not append a stale Guangguang %s or a local fallback after switching", async (outcome) => {
    const pending = deferred<unknown>(); api.askGuangguang.mockReturnValue(pending.promise);
    const app = mount(() => TeacherGuangguang({ workspace: createDefaultTeacherWorkspace(), pathname: "/teacher/lessons", onBroadcast: vi.fn() }));
    const oldAsk = button(app.tree, "现在最值得关注什么"); click(oldAsk); expect(api.askGuangguang).toHaveBeenCalledOnce();
    changeIdentity(); const writes = app.frame.writes; if (outcome === "resolve") pending.resolve({ text: "旧教师私有回答" }); else pending.reject(new Error("old failure")); await drain(); click(oldAsk); await drain();
    expect(api.askGuangguang).toHaveBeenCalledOnce(); expect(app.frame.writes).toBe(writes); expect(app.render()).toBeNull();
  });

  it("retains same-session remote replies and local demo guidance", async () => {
    const app = mount(() => TeacherGuangguang({ workspace: createDefaultTeacherWorkspace(), pathname: "/teacher/lessons", onBroadcast: vi.fn() }));
    click(button(app.tree, "现在最值得关注什么")); await drain(); expect(text(app.render())).toContain("当前教师的答复");
    app.unmount(); auth.demo = true; auth.token = ""; auth.generation++; api.askGuangguang.mockClear();
    const local = mount(() => TeacherGuangguang({ workspace: createDefaultTeacherWorkspace(), pathname: "/teacher/lessons", onBroadcast: vi.fn() }));
    click(button(local.tree, "现在最值得关注什么")); await drain(); local.render();
    expect(walk(local.tree).some((item) => item.props.className === "role-assistant")).toBe(true); expect(api.askGuangguang).not.toHaveBeenCalled();
  });

  it("does not publish an old classroom prompt after teacher renewal", () => {
    const workspace = createDefaultTeacherWorkspace(); workspace.liveSession = { lessonId: workspace.lessons[0]!.id, learners: [], prompts: [] } as unknown as NonNullable<typeof workspace.liveSession>;
    const broadcast = vi.fn().mockReturnValue(true); const app = mount(() => TeacherGuangguang({ workspace, pathname: "/teacher/live", onBroadcast: broadcast }));
    const oldButton = button(app.tree, "教师确认并发布"); changeIdentity("renewal"); const writes = app.frame.writes; click(oldButton);
    expect(broadcast).not.toHaveBeenCalled(); expect(app.frame.writes).toBe(writes);
  });
});
