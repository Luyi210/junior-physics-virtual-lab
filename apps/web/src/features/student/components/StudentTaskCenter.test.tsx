import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { PlatformUser, StudentExperimentSession, TeachingTask } from '@physics-lab/contracts';
import type { StudentRecordScope } from '../../../data/studentRecordScope';
import { StudentTaskCenter } from './StudentTaskCenter';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({
  frame: null as Frame | null, scope: null as StudentRecordScope | null, active: null as StudentExperimentSession | null,
  unsaved: [] as object[], getUnsaved: vi.fn(),
  pending: null as object | null, drafts: [] as Array<{ clientId: string; isCurrentTab: boolean; raw: string; valid: boolean }>,
  tasks: vi.fn(), classes: vi.fn(), sessions: vi.fn(), startSession: vi.fn(), completeSession: vi.fn(),
  read: vi.fn(), sync: vi.fn(), listDrafts: vi.fn(), flush: vi.fn(), setActive: vi.fn(), clearActive: vi.fn(), navigate: vi.fn(),
}));

// Actual production handlers/effects with an in-memory hook adapter and mocked
// I/O. This exercises ownership ordering, not browser event scheduling or DOM.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => {
    const frame = harness.frame!;
    return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {});
  };
  const changed = (previous: readonly unknown[] | undefined, next: readonly unknown[] | undefined) =>
    !previous || !next || previous.length !== next.length || next.some((value, index) => !Object.is(value, previous[index]));
  return { ...actual,
    useState: (initial: unknown) => {
      if (!harness.frame) return actual.useState(initial);
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!harness.frame) return actual.useRef(initial);
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = { current: initial }; return item.value;
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      if (!harness.frame) return actual.useMemo(factory, deps);
      const item = slot(); if (changed(item.deps, deps)) { item.value = factory(); item.deps = deps; } return item.value;
    },
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!harness.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (changed(item.deps, deps)) { item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});
vi.mock('../../../data/studentRecordScope', () => ({
  getStudentRecordScope: () => harness.scope, subscribeStudentRecordScope: () => () => {},
  isCurrentStudentRecordScope: (scope: StudentRecordScope, write = false) => !!scope.key && scope.key === harness.scope?.key && scope.revision === harness.scope.revision && (!write || harness.scope.canWrite),
}));
vi.mock('../../../data/teacherApi', () => ({ studentApi: {
  tasks: () => harness.tasks(), classes: () => harness.classes(), sessions: () => harness.sessions(),
  startSession: (...args: unknown[]) => harness.startSession(...args), completeSession: (...args: unknown[]) => harness.completeSession(...args),
} }));
vi.mock('../../../data/unsavedLearningRecord', () => ({ getUnsavedLearningRecords: (...args: unknown[]) => harness.getUnsaved(...args) }));
vi.mock('../../../data/learningRecordRepository', () => ({ learningRecordRepository: () => ({
  read: (...args: unknown[]) => harness.read(...args), sync: (...args: unknown[]) => harness.sync(...args), listDrafts: (...args: unknown[]) => harness.listDrafts(...args),
}) }));
vi.mock('../../../data/studentSessionSync', () => ({
  activeStudentSession: () => harness.active,
  setActiveStudentSession: (...args: unknown[]) => harness.setActive(...args), clearActiveStudentSession: (...args: unknown[]) => harness.clearActive(...args),
  flushStudentEventQueue: (...args: unknown[]) => harness.flush(...args),
}));
vi.mock('react-router-dom', () => ({ Link: 'a', useNavigate: () => harness.navigate }));

type Element = ReactElement<Record<string, unknown>>;
const cleanups: Array<() => void> = [];
const user: PlatformUser = { id: 'student-a', schoolId: 'school-a', role: 'student', status: 'active', lastLoginAt: null, classIds: ['class-a'], classNames: ['高一一班'], name: '学生甲', email: 'a@test.local', createdAt: '2026-11-11T00:00:00.000Z' };
const session: StudentExperimentSession = {
  id: 'session-a', taskId: 'task-a', schoolId: 'school-a', classId: 'class-a', learnerId: 'student-a', experimentId: 'spring-force', status: 'active',
  startedAt: '2026-11-11T00:00:00.000Z', updatedAt: '2026-11-11T00:00:00.000Z', completedAt: null,
  taskTitle: '弹簧课堂任务', lessonTitle: '弹簧探究', className: '高一一班', eventCount: 0, observationCount: 0,
};
const task: TeachingTask = {
  id: 'task-a', schoolId: 'school-a', classId: 'class-a', lessonId: 'lesson-a', title: '弹簧课堂任务', mode: 'in-class', status: 'published', opensAt: null, dueAt: null,
  allowRetry: true, createdBy: 'teacher-a', createdAt: '2026-11-11T00:00:00.000Z', updatedAt: '2026-11-11T00:00:00.000Z', className: '高一一班', lessonTitle: '弹簧探究', experimentId: 'spring-force',
};
function walk(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : '';
}
function run(frame: Frame, render: () => ReactNode) {
  frame.cursor = 0; harness.frame = frame; let tree: ReactNode;
  try { tree = render(); } finally { harness.frame = null; }
  frame.effects.splice(0).forEach((effect) => effect()); return tree;
}
function dispose(frame: Frame) { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); }
function mount() {
  const outer: Frame = { slots: [], cursor: 0, effects: [] };
  let inner: Frame = { slots: [], cursor: 0, effects: [] }; let childKey: string | null | undefined;
  const app = { tree: null as ReactNode,
    render() {
      const child = run(outer, () => StudentTaskCenter({ user, onLogout: () => {} })) as ReactElement;
      if (child.key !== childKey) { dispose(inner); inner = { slots: [], cursor: 0, effects: [] }; childKey = child.key; }
      app.tree = run(inner, () => (child.type as (props: unknown) => ReactNode)(child.props)); return app.tree;
    },
    unmount() { dispose(inner); dispose(outer); },
    button(label: string) {
      const button = walk(app.tree).find((item) => item.type === 'button' && text(item) === label);
      expect(button, label).toBeDefined(); return button!;
    },
    click(label: string) { (app.button(label).props.onClick as () => void)(); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
async function settle() { for (let index = 0; index < 16; index++) await Promise.resolve(); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function renew(patch: Partial<StudentRecordScope> = {}) { harness.scope = { ...harness.scope!, ...patch, revision: harness.scope!.revision + 1 }; }
async function loaded() {
  const app = mount(); await settle(); app.render();
  harness.setActive.mockClear(); harness.clearActive.mockClear(); harness.flush.mockClear(); return app;
}
const otherDraft = () => ({ clientId: 'closed-tab', isCurrentTab: false, raw: '{"measurements":"旧标签的读数"}', valid: true });
beforeEach(() => {
  harness.frame = null; harness.scope = { key: 'backend-a:school-a:student-a', apiNamespace: 'https://a.test/api', schoolId: 'school-a', studentId: 'student-a', mode: 'account', label: '学生甲', canWrite: true, revision: 1 };
  harness.active = null; harness.pending = null; harness.drafts = []; harness.unsaved = [];
  harness.getUnsaved.mockReset().mockImplementation(() => harness.unsaved);
  harness.tasks.mockReset().mockResolvedValue([task]); harness.classes.mockReset().mockResolvedValue([]); harness.sessions.mockReset().mockResolvedValue([session]);
  harness.startSession.mockReset().mockResolvedValue(session); harness.completeSession.mockReset().mockResolvedValue({ ...session, status: 'completed' });
  harness.read.mockReset().mockImplementation(() => harness.pending ? { pending: harness.pending } : null);
  harness.sync.mockReset().mockImplementation(async () => { harness.pending = null; });
  harness.listDrafts.mockReset().mockImplementation(() => harness.drafts);
  harness.flush.mockReset().mockResolvedValue(undefined); harness.navigate.mockReset();
  harness.setActive.mockReset().mockImplementation((value: StudentExperimentSession) => { harness.active = value; });
  harness.clearActive.mockReset().mockImplementation(() => { harness.active = null; });
});
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe('student task actions use the captured classroom account', () => {
  it('scrolls both free-explore links without replacing the student hash route', async () => {
    harness.tasks.mockResolvedValue([]); harness.sessions.mockResolvedValue([]);
    const app = await loaded(); const scrollIntoView = vi.fn();
    const location = { hash: '#/student' };
    const getElementById = vi.fn(() => ({ scrollIntoView }));
    vi.stubGlobal('window', { location, matchMedia: () => ({ matches: true }) });
    vi.stubGlobal('document', { getElementById });
    try {
      const links = walk(app.tree).filter((item) => item.type === 'a' && item.props.href === '#fields');
      expect(links).toHaveLength(2);
      for (const link of links) {
        let prevented = false;
        (link.props.onClick as (event: unknown) => void)({ preventDefault() { prevented = true; } });
        if (!prevented) location.hash = String(link.props.href);
        expect(prevented).toBe(true);
      }
      expect(location.hash).toBe('#/student'); expect(getElementById).toHaveBeenCalledWith('fields');
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' });
    } finally { vi.unstubAllGlobals(); }
  });

  it.each(['renew', 'school', 'backend', 'unmount'] as const)('ignores a late task load after %s', async (change) => {
    const response = deferred<StudentExperimentSession[]>(); harness.sessions.mockReturnValueOnce(response.promise);
    const app = mount();
    if (change === 'renew') renew();
    if (change === 'school') renew({ schoolId: 'school-b', key: 'backend-a:school-b:student-a' });
    if (change === 'backend') renew({ apiNamespace: 'https://b.test/api', key: 'backend-b:school-a:student-a' });
    if (change === 'unmount') app.unmount();
    response.resolve([session]); await settle();
    expect(harness.setActive).not.toHaveBeenCalled(); expect(harness.clearActive).not.toHaveBeenCalled(); expect(harness.flush).not.toHaveBeenCalled();
  });

  it('does not navigate or install a session returned after account renewal', async () => {
    harness.sessions.mockResolvedValue([]); const app = await loaded(); const response = deferred<StudentExperimentSession>(); harness.startSession.mockReturnValueOnce(response.promise);
    app.click('开始这项实验'); renew(); response.resolve(session); await settle();
    expect(harness.navigate).not.toHaveBeenCalled(); expect(harness.setActive).not.toHaveBeenCalled();
  });

  it('has no network actions for expired accounts and rejects stale pre-render clicks', async () => {
    harness.scope = { ...harness.scope!, canWrite: false }; const expired = await loaded();
    expect(harness.tasks).not.toHaveBeenCalled(); expect(text(expired.tree)).toContain('登录已过期');
    expired.unmount(); harness.scope = { ...harness.scope!, canWrite: true }; const app = await loaded(); renew({ canWrite: false });
    app.click('完成并归档'); app.click('继续当前实验'); await settle();
    expect(harness.completeSession).not.toHaveBeenCalled(); expect(harness.navigate).not.toHaveBeenCalled(); expect(harness.sync).not.toHaveBeenCalled();
  });

  it('keeps the task visible and reports a local active-session write failure without navigating', async () => {
    const app = await loaded(); harness.setActive.mockImplementation(() => { throw new Error('会话存储不可写'); });
    app.click('继续当前实验'); app.render();
    expect(harness.navigate).not.toHaveBeenCalled(); expect(text(app.tree)).toContain('会话存储不可写');
  });

  it('synchronizes only this scope/session pending before events and completion', async () => {
    const app = await loaded(); harness.pending = { mutationId: 'mine' }; const scope = harness.scope;
    app.click('完成并归档'); await settle();
    expect(harness.sync).toHaveBeenCalledExactlyOnceWith(scope, 'session-a');
    expect(harness.flush).toHaveBeenCalledWith(scope, session);
    expect(harness.completeSession).toHaveBeenCalledExactlyOnceWith('session-a');
    expect(harness.sync.mock.invocationCallOrder[0]).toBeLessThan(harness.flush.mock.invocationCallOrder[0]);
    expect(harness.flush.mock.invocationCallOrder[0]).toBeLessThan(harness.completeSession.mock.invocationCallOrder[0]);
    expect(harness.clearActive).toHaveBeenCalledWith('session-a', scope);
    expect(harness.listDrafts.mock.calls.every(([owner, id]) => owner === scope && id === 'session-a')).toBe(true);
  });

  it.each(['sync-error', 'still-pending', 'orphan-current-draft', 'broken-cache', 'broken-drafts', 'broken-events'] as const)('does not complete after %s', async (failure) => {
    const app = await loaded();
    if (failure === 'sync-error') { harness.pending = {}; harness.sync.mockRejectedValue(new Error('同步失败')); }
    if (failure === 'still-pending') { harness.pending = {}; harness.sync.mockResolvedValue(undefined); }
    if (failure === 'orphan-current-draft') harness.drafts = [{ ...otherDraft(), clientId: 'current-tab', isCurrentTab: true }];
    if (failure === 'broken-cache') harness.read.mockImplementation(() => { throw new Error('缓存无法读取'); });
    if (failure === 'broken-drafts') harness.listDrafts.mockImplementation(() => { throw new Error('草稿目录无法读取'); });
    if (failure === 'broken-events') harness.flush.mockRejectedValue(new Error('操作队列无法读取'));
    app.click('完成并归档'); await settle(); app.render();
    expect(harness.completeSession).not.toHaveBeenCalled(); expect(harness.clearActive).not.toHaveBeenCalled();
    expect(text(app.tree)).toContain('查看课堂记录');
  });

  it.each(['sync', 'flush', 'complete'] as const)('stops old async side effects when renewed during %s', async (boundary) => {
    const app = await loaded(); const response = deferred<unknown>();
    if (boundary === 'sync') { harness.pending = {}; harness.sync.mockReturnValueOnce(response.promise); }
    if (boundary === 'flush') harness.flush.mockReturnValueOnce(response.promise);
    if (boundary === 'complete') harness.completeSession.mockReturnValueOnce(response.promise);
    app.click('完成并归档'); await settle(); renew(); response.resolve(undefined); await settle();
    if (boundary !== 'complete') expect(harness.completeSession).not.toHaveBeenCalled();
    if (boundary === 'sync') expect(harness.flush).not.toHaveBeenCalled();
    expect(harness.clearActive).not.toHaveBeenCalled(); expect(harness.sessions).toHaveBeenCalledTimes(1);
  });
});

describe('completion requires explicit, unchanged cross-tab draft review', () => {
  it('requires two clicks, preserves other drafts, and only completes saved server content', async () => {
    const app = await loaded(); harness.drafts = [otherDraft()]; const original = structuredClone(harness.drafts);
    app.click('完成并归档'); await settle(); app.render();
    expect(harness.completeSession).not.toHaveBeenCalled(); expect(text(app.tree)).toContain('1 份未同步草稿');
    expect(text(app.tree)).toContain('完成后，这些内容不能再写入这次实验');
    app.click('我理解并完成已保存版本'); await settle();
    expect(harness.completeSession).toHaveBeenCalledExactlyOnceWith('session-a'); expect(harness.drafts).toEqual(original);
  });

  it.each(['before-confirm', 'during-flush'] as const)('invalidates equal-count but changed raw drafts %s', async (boundary) => {
    const app = await loaded(); harness.drafts = [otherDraft()]; app.click('完成并归档'); await settle(); app.render();
    const response = deferred<unknown>();
    if (boundary === 'during-flush') { harness.flush.mockReturnValueOnce(response.promise); app.click('我理解并完成已保存版本'); await settle(); }
    harness.drafts[0].raw = '{"measurements":"同份数的新正文"}';
    if (boundary === 'before-confirm') app.click('我理解并完成已保存版本');
    else response.resolve(undefined);
    await settle(); app.render();
    expect(harness.completeSession).not.toHaveBeenCalled(); expect(text(app.tree)).toContain('确认已失效');
    expect(walk(app.tree).some((item) => item.type === 'button' && text(item) === '我理解并完成已保存版本')).toBe(false);
  });

  it('cannot override corrupt drafts or a new unsynchronized current-tab draft', async () => {
    const app = await loaded(); harness.drafts = [otherDraft()]; app.click('完成并归档'); await settle(); app.render();
    harness.drafts[0].valid = false; app.click('我理解并完成已保存版本'); await settle();
    expect(harness.completeSession).not.toHaveBeenCalled();
    harness.drafts[0].valid = true; harness.pending = {}; harness.sync.mockRejectedValueOnce(new Error('本页草稿未同步'));
    app.click('我理解并完成已保存版本'); await settle();
    expect(harness.sync).toHaveBeenCalledOnce(); expect(harness.completeSession).not.toHaveBeenCalled();
  });
});


describe('completion cannot silently exclude this tab unsaved memory text', () => {
  it('blocks before any sync and permits completion after the exact copy has been saved', async () => {
    const app = await loaded(); harness.unsaved = [{ id: 'memory-a' }];
    app.click('完成并归档'); await settle(); app.render();
    expect(harness.sync).not.toHaveBeenCalled(); expect(harness.flush).not.toHaveBeenCalled(); expect(harness.completeSession).not.toHaveBeenCalled();
    expect(text(app.tree)).toContain('尚未写入本机的正文副本'); expect(text(app.tree)).toContain('查看课堂记录');
    expect(harness.getUnsaved).toHaveBeenCalledWith(harness.scope, 'session-a');
    harness.unsaved = []; app.click('完成并归档'); await settle();
    expect(harness.completeSession).toHaveBeenCalledExactlyOnceWith('session-a');
  });

  it('checks again after an awaited flush before posting completion', async () => {
    const app = await loaded(); const response = deferred<unknown>(); harness.flush.mockReturnValueOnce(response.promise);
    app.click('完成并归档'); await settle(); harness.unsaved = [{ id: 'new-memory-during-flush' }]; response.resolve(undefined); await settle(); app.render();
    expect(harness.completeSession).not.toHaveBeenCalled(); expect(text(app.tree)).toContain('尚未写入本机的正文副本');
  });
});
