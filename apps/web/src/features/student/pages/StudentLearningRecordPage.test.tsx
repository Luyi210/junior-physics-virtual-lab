import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { LearningRecordContent, SaveLearningRecordRequest, SessionLearningRecord } from '@physics-lab/contracts';
import { getStudentRecordScope } from '../../../data/studentRecordScope';
import { getUnsavedLearningRecords, clearSavedUnsavedLearningRecords } from '../../../data/unsavedLearningRecord';
import { OtherLearningRecordDrafts } from '../components/OtherLearningRecordDrafts';
import type { LearningRecordDraft } from '../../../data/learningRecordRepository';
import { UnsavedLearningRecordPanel } from '../components/UnsavedLearningRecordPanel';
import type { StudentRecordScope } from '../../../data/studentRecordScope';
import { TeacherApiError } from '../../../data/teacherApi';
import { StudentLearningRecordPage } from './StudentLearningRecordPage';
import { StudentLearningFeedback } from '../components/StudentLearningFeedback';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({
  frame: null as Frame | null,
  userId: 'student-a', token: 'token-a', namespace: 'https://school.example.test/api', schoolId: 'school-a', expired: false,
  read: vi.fn(), scope: null as StudentRecordScope | null, scopeFingerprint: '',
  server: null as SessionLearningRecord | null, pending: null as SaveLearningRecordRequest | null,
  otherDrafts: [] as LearningRecordDraft[], restoreDraft: vi.fn(),
  me: vi.fn(), learningRecord: vi.fn(), feedback: vi.fn(), remember: vi.fn(), queue: vi.fn(), useServer: vi.fn(), sync: vi.fn(),
}));

// Exercises actual component handlers and cleanup in memory, without claiming
// browser DOM, event scheduling or real network coverage.
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
      const item = slot();
      if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!harness.frame) return actual.useRef(initial);
      const item = slot();
      if (!Object.hasOwn(item, 'value')) item.value = { current: initial };
      return item.value;
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) => {
      const item = slot();
      if (changed(item.deps, deps)) { item.value = callback; item.deps = deps; }
      return item.value;
    },
    useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!harness.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (changed(item.deps, deps)) {
        item.deps = deps;
        harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});
vi.mock('../../../data/teacherApi', () => ({
  STUDENT_AUTH_EVENT: 'physics-student-auth-changed',
  TeacherApiError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  getPlatformAuthMetadata: () => ({ studentToken: harness.token, apiNamespace: harness.namespace }),
  studentApi: { hasSession: () => Boolean(harness.token), currentUserId: () => harness.userId,
    me: (...args: unknown[]) => harness.me(...args), learningRecord: (...args: unknown[]) => harness.learningRecord(...args), feedback: (...args: unknown[]) => harness.feedback(...args) },
}));
vi.mock('../../../data/studentRecordScope', () => {
  const get = () => {
    const fingerprint = JSON.stringify([harness.userId, harness.token, harness.namespace, harness.schoolId, harness.expired]);
    if (fingerprint !== harness.scopeFingerprint || !harness.scope) {
      harness.scopeFingerprint = fingerprint;
      harness.scope = { key: harness.token ? `${harness.namespace}:${harness.schoolId}:${harness.userId}` : null,
        apiNamespace: harness.namespace, studentId: harness.token ? harness.userId : null,
        schoolId: harness.token ? harness.schoolId : null, mode: harness.token ? 'account' : 'signed-out',
        canWrite: Boolean(harness.token) && !harness.expired, label: '学生身份', revision: (harness.scope?.revision ?? 0) + 1 };
    }
    return harness.scope;
  };
  return { getStudentRecordScope: get, subscribeStudentRecordScope: () => () => {},
    isCurrentStudentRecordScope: (scope: StudentRecordScope, write = false) => {
      const current = get(); return !!scope.key && current.key === scope.key && current.revision === scope.revision && (!write || current.canWrite);
    } };
});
vi.mock('../../../data/learningRecordRepository', () => ({
  recordContent: (record: LearningRecordContent | null) => ({ prediction: record?.prediction ?? '', measurements: record?.measurements ?? '', conclusion: record?.conclusion ?? '', question: record?.question ?? '' }),
  learningRecordRepository: () => ({ read: (...args: unknown[]) => harness.read(...args),
    remember: (...args: unknown[]) => harness.remember(...args), queue: (...args: unknown[]) => harness.queue(...args),
    useServer: (...args: unknown[]) => harness.useServer(...args), sync: (...args: unknown[]) => harness.sync(...args),
    restoreDraft: (...args: unknown[]) => harness.restoreDraft(...args), listDrafts: () => harness.otherDrafts, readServerCopy: () => ({ raw: null, valid: true }) }),
}));
vi.mock('react-router-dom', () => ({ Link: 'a', useParams: () => ({ sessionId: 'session-a' }) }));
vi.mock('../components/LegacyLearningRecordPanel', () => ({ LegacyLearningRecordPanel: () => null }));
vi.mock('../../high-school/components/ClassroomEvidencePicker', () => ({ ClassroomEvidencePicker: () => null }));

type Element = ReactElement<Record<string, unknown>>;
const cleanups: Array<() => void> = [];
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
  frame.cursor = 0; harness.frame = frame;
  let tree: ReactNode;
  try { tree = render(); } finally { harness.frame = null; }
  frame.effects.splice(0).forEach((effect) => effect());
  return tree;
}
function dispose(frame: Frame) { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); }
function mountPage() {
  const outer: Frame = { slots: [], cursor: 0, effects: [] };
  let child: ReactElement;
  let inner: Frame = { slots: [], cursor: 0, effects: [] };
  let childKey: string | null | undefined;
  const app = { tree: null as ReactNode,
    render() {
      child = run(outer, () => StudentLearningRecordPage()) as ReactElement;
      if (child.key !== childKey) { dispose(inner); inner = { slots: [], cursor: 0, effects: [] }; childKey = child.key; }
      const component = child.type as (props: unknown) => ReactNode;
      app.tree = run(inner, () => component(child.props)); return app.tree;
    },
    unmount() { dispose(inner); dispose(outer); },
    click(label: string) {
      const button = walk(app.tree).find((item) => item.type === 'button' && text(item) === label);
      expect(button, label).toBeDefined();
      (button!.props.onClick as () => void)();
    },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function server(): SessionLearningRecord {
  return { session: { id: 'session-a', taskId: 'task-a', schoolId: 'school-a', classId: 'class-a', learnerId: 'student-a', experimentId: 'spring-force', status: 'active',
    startedAt: '2026-11-11T00:00:00.000Z', updatedAt: '2026-11-11T00:00:00.000Z', completedAt: null },
    learnerName: '学生甲', taskTitle: '弹簧探究', className: '高一一班', lessonTitle: '弹力与伸长量',
    record: { sessionId: 'session-a', learnerId: 'student-a', revision: 2, lastMutationId: 'other-tab', updatedAt: '2026-11-11T00:00:00.000Z',
      prediction: '账号预测', measurements: '账号读数', conclusion: '账号结论', question: '账号问题' } };
}
async function conflictPage() {
  const app = mountPage(); await settle(); app.render();
  expect(text(app.tree)).toContain('需要核对版本');
  harness.remember.mockClear(); harness.queue.mockClear(); harness.useServer.mockClear(); harness.sync.mockClear();
  return app;
}
beforeEach(() => {
  vi.useFakeTimers(); harness.frame = null;
  harness.otherDrafts = [];
  harness.restoreDraft.mockReset().mockImplementation((_scope: StudentRecordScope, _sessionId: string, content: LearningRecordContent, expectedRevision: number) => {
    harness.pending = { ...content, expectedRevision, mutationId: "restored" }; return { server: harness.server, pending: harness.pending };
  });
  harness.userId = 'student-a'; harness.token = 'token-a'; harness.namespace = 'https://school.example.test/api';
  harness.schoolId = 'school-a'; harness.expired = false; harness.scope = null; harness.scopeFingerprint = '';
  harness.read.mockReset().mockImplementation(() => ({ server: harness.server, pending: harness.pending }));
  harness.server = server(); harness.pending = { prediction: '本机预测', measurements: '尚未同步的本机读数', conclusion: '本机结论', question: '本机问题', expectedRevision: 1, mutationId: 'pending-a' };
  harness.me.mockReset().mockImplementation(async () => ({ id: harness.userId, schoolId: harness.schoolId, role: 'student' }));
  harness.learningRecord.mockReset().mockImplementation(async () => harness.server);
  harness.feedback.mockReset().mockResolvedValue([]);
  harness.remember.mockReset().mockImplementation((_scope: StudentRecordScope, detail: SessionLearningRecord) => { harness.server = detail; return { server: detail, pending: harness.pending }; });
  harness.queue.mockReset().mockImplementation((_scope: StudentRecordScope, _sessionId: string, content: LearningRecordContent) => {
    harness.pending = { ...content, expectedRevision: harness.server!.record!.revision, mutationId: 'new-pending' };
    return { server: harness.server, pending: harness.pending };
  });
  harness.useServer.mockReset().mockImplementation(() => { harness.pending = null; });
  harness.sync.mockReset().mockImplementation(async () => {
    harness.server = { ...harness.server!, record: { ...harness.server!.record!, ...harness.pending!, revision: 3 } };
    harness.pending = null; return harness.server;
  });
  const browser = new EventTarget(); Object.assign(browser, { setTimeout, clearTimeout }); vi.stubGlobal('window', browser);
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  harness.expired = false; harness.userId = 'student-a'; harness.schoolId = 'school-a'; harness.token = 'token-a'; harness.namespace = 'https://school.example.test/api';
  const scope = getStudentRecordScope();
  getUnsavedLearningRecords(scope, 'session-a').forEach((copy) => clearSavedUnsavedLearningRecords(scope, 'session-a', copy.content));
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('student report conflict resolution keeps asynchronous ownership', () => {
  it.each(['采用已保存版本', '保留我的内容并保存'])('does not mutate the old account draft after switching students: %s', async (label) => {
    const app = await conflictPage(); const pending = structuredClone(harness.pending);
    const response = deferred<SessionLearningRecord>(); harness.learningRecord.mockReturnValueOnce(response.promise);
    app.click(label); harness.userId = 'student-b'; harness.token = 'token-b';
    response.resolve(server()); await settle();
    expect(harness.remember).not.toHaveBeenCalled(); expect(harness.useServer).not.toHaveBeenCalled(); expect(harness.queue).not.toHaveBeenCalled();
    expect(harness.sync).not.toHaveBeenCalled(); expect(harness.pending).toEqual(pending);
  });

  it.each(['unmount', 'renew', 'namespace', 'logout'] as const)('does not apply a delayed response after %s', async (change) => {
    const app = await conflictPage(); const pending = structuredClone(harness.pending);
    const response = deferred<SessionLearningRecord>(); harness.learningRecord.mockReturnValueOnce(response.promise);
    app.click('采用已保存版本');
    if (change === 'unmount') app.unmount();
    if (change === 'renew') harness.token = 'new-token-for-same-student';
    if (change === 'namespace') harness.namespace = 'https://other.example.test/api';
    if (change === 'logout') { harness.token = ''; harness.userId = ''; }
    response.resolve(server()); await settle();
    expect(harness.remember).not.toHaveBeenCalled(); expect(harness.useServer).not.toHaveBeenCalled(); expect(harness.queue).not.toHaveBeenCalled();
    expect(harness.pending).toEqual(pending);
  });

  it('does not start a new conflict request from a stale account button', async () => {
    const app = await conflictPage(); harness.learningRecord.mockClear();
    harness.userId = 'student-b'; harness.token = 'token-b'; app.click('采用已保存版本'); await settle();
    expect(harness.learningRecord).not.toHaveBeenCalled(); expect(harness.useServer).not.toHaveBeenCalled();
  });

  it('still lets the same student adopt the server version', async () => {
    const app = await conflictPage(); app.click('采用已保存版本'); await settle(); app.render();
    expect(harness.remember).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ studentId: 'student-a', schoolId: 'school-a' }), expect.objectContaining({ session: expect.objectContaining({ id: 'session-a' }) }));
    expect(harness.useServer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ studentId: 'student-a', schoolId: 'school-a' }), 'session-a');
    expect(harness.queue).not.toHaveBeenCalled(); expect(harness.pending).toBeNull();
    expect(walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')?.props.value).toBe('账号读数');
    expect(text(app.tree)).toContain('已保存到账号');
  });

  it('still lets the same student keep and synchronize the local draft', async () => {
    const app = await conflictPage(); app.click('保留我的内容并保存'); await settle(); app.render();
    expect(harness.queue).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ studentId: 'student-a', schoolId: 'school-a' }), 'session-a', expect.objectContaining({ measurements: '尚未同步的本机读数' }), true);
    expect(harness.sync).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ studentId: 'student-a', schoolId: 'school-a' }), 'session-a');
    expect(harness.useServer).not.toHaveBeenCalled(); expect(harness.pending).toBeNull();
    expect(walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')?.props.value).toBe('尚未同步的本机读数');
  });

  it('preserves the draft when the currently owned conflict request fails', async () => {
    const app = await conflictPage(); const pending = structuredClone(harness.pending);
    harness.learningRecord.mockRejectedValueOnce(new Error('当前请求暂时离线'));
    app.click('采用已保存版本'); await settle(); app.render();
    expect(harness.remember).not.toHaveBeenCalled(); expect(harness.useServer).not.toHaveBeenCalled(); expect(harness.queue).not.toHaveBeenCalled();
    expect(harness.pending).toEqual(pending); expect(text(app.tree)).toContain('当前请求暂时离线');
  });
});


describe('student report loading and edits stay within the captured v3 scope', () => {
  it('shows a terminal login state instead of waiting forever without an account', async () => {
    harness.token = ''; harness.userId = '';
    const app = mountPage(); await settle(); app.render();
    expect(text(app.tree)).toContain('读取失败'); expect(text(app.tree)).not.toContain('正在读取你的实验档案');
    expect(harness.me).not.toHaveBeenCalled(); expect(harness.read).not.toHaveBeenCalled();
  });

  it.each(['renew', 'student', 'school', 'backend', 'logout', 'unmount'] as const)('ignores an initial GET that finishes after %s', async (change) => {
    const response = deferred<SessionLearningRecord>(); harness.learningRecord.mockReturnValueOnce(response.promise);
    const app = mountPage(); await settle(); expect(harness.learningRecord).toHaveBeenCalledOnce();
    if (change === 'renew') harness.token = 'renewed-token';
    if (change === 'student') harness.userId = 'student-b';
    if (change === 'school') harness.schoolId = 'school-b';
    if (change === 'backend') harness.namespace = 'https://different.school.test/api';
    if (change === 'logout') harness.token = '';
    if (change === 'unmount') app.unmount();
    response.resolve(server()); await settle();
    expect(harness.remember).not.toHaveBeenCalled(); expect(harness.queue).not.toHaveBeenCalled(); expect(harness.sync).not.toHaveBeenCalled();
  });

  it('checks identity after me before starting the record GET', async () => {
    const response = deferred<{ id: string; schoolId: string; role: string }>(); harness.me.mockReturnValueOnce(response.promise);
    mountPage(); harness.token = 'renewed-token';
    response.resolve({ id: 'student-a', schoolId: 'school-a', role: 'student' }); await settle();
    expect(harness.learningRecord).not.toHaveBeenCalled(); expect(harness.remember).not.toHaveBeenCalled();
  });

  it('reads an expired account cache without GET, edits, conflict resolution or auto sync', async () => {
    harness.expired = true;
    const app = mountPage(); await settle(); app.render();
    expect(text(app.tree)).toContain('登录已过期 · 本机只读');
    const field = walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!;
    expect(field.props.value).toBe('尚未同步的本机读数'); expect(field.props.readOnly).toBe(true);
    (field.props.onChange as (event: unknown) => void)({ target: { value: '过期写入' } });
    app.click('采用已保存版本'); app.click('保留我的内容并保存');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(harness.me).not.toHaveBeenCalled(); expect(harness.learningRecord).not.toHaveBeenCalled(); expect(harness.queue).not.toHaveBeenCalled();
    expect(harness.sync).not.toHaveBeenCalled(); expect(harness.useServer).not.toHaveBeenCalled();
    expect(harness.read).toHaveBeenCalledWith(expect.objectContaining({ canWrite: false, studentId: 'student-a', schoolId: 'school-a' }), 'session-a');
  });

  it('uses only the captured account cache when offline and does not hide a broken cache as missing', async () => {
    harness.me.mockRejectedValue(new Error('offline'));
    const app = mountPage(); await settle(); app.render();
    expect(text(app.tree)).toContain('本机草稿');
    expect(harness.read).toHaveBeenCalledWith(expect.objectContaining({ key: expect.stringContaining('school-a:student-a') }), 'session-a');
    app.unmount(); harness.read.mockImplementation(() => { throw new Error('本机档案无法读取，请保留备份'); });
    const broken = mountPage(); await settle(); broken.render();
    expect(text(broken.tree)).toContain('本机档案无法读取，请保留备份'); expect(harness.remember).not.toHaveBeenCalled();
  });

  it('rejects a stale textarea callback before React remounts on renewal', async () => {
    const app = await conflictPage();
    const field = walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!;
    harness.token = 'renewed-token';
    (field.props.onChange as (event: unknown) => void)({ target: { value: '不应写入旧草稿' } });
    expect(harness.queue).not.toHaveBeenCalled();
    app.render(); await settle(); app.render();
    expect(harness.me).toHaveBeenCalledTimes(2);
  });

  it('does not remember a conflict refresh after identity changes in flight', async () => {
    harness.pending!.expectedRevision = 2;
    const app = mountPage(); await settle(); app.render(); harness.remember.mockClear();
    const response = deferred<SessionLearningRecord>(); harness.learningRecord.mockReturnValueOnce(response.promise);
    harness.sync.mockRejectedValueOnce(new TeacherApiError(409, 'RECORD_CONFLICT', '有更新'));
    app.click('保存到账号'); await settle();
    expect(harness.learningRecord).toHaveBeenCalledTimes(2);
    harness.token = 'renewed-token'; response.resolve(server()); await settle();
    expect(harness.remember).not.toHaveBeenCalled(); expect(harness.pending).not.toBeNull();
  });
});


describe('quota-failed classroom text survives identity and route remounts in this tab', () => {
  async function failedEdit(app: ReturnType<typeof mountPage>, value: string) {
    harness.queue.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    const field = walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!;
    (field.props.onChange as (event: unknown) => void)({ target: { value } });
    app.render(); await settle();
    expect(text(app.tree)).toContain('浏览器无法保存草稿');
  }
  function mountMemoryPanel() {
    const frame: Frame = { slots: [], cursor: 0, effects: [] };
    const app = { tree: null as ReactNode,
      render() { app.tree = run(frame, () => UnsavedLearningRecordPanel({ scope: getStudentRecordScope(), sessionId: 'session-a' })); return app.tree; },
      click(label: string) { const button = walk(app.tree).find((item) => item.type === 'button' && text(item) === label)!; expect(button).toBeDefined(); (button.props.onClick as () => void)(); },
    };
    app.render(); cleanups.push(() => dispose(frame)); return app;
  }

  it('preserves all four fields and original version after expiry, then explicitly exports the readonly copy', async () => {
    const app = await conflictPage(); const prior = { ...harness.pending! }; const latest = 'quota失败的最新四次读数 <script>不会执行</script>';
    await failedEdit(app, latest);
    const savedCopy = getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')[0];
    expect(savedCopy.content).toEqual({ prediction: prior.prediction, measurements: latest, conclusion: prior.conclusion, question: prior.question });
    expect(savedCopy.baseRevision).toBe(prior.expectedRevision); expect(Number.isFinite(Date.parse(savedCopy.createdAt))).toBe(true);
    harness.expired = true; app.render(); await settle(); app.render();
    const panel = mountMemoryPanel(); expect(text(panel.tree)).not.toContain(latest);
    panel.click('查看未落盘正文'); panel.render(); expect(text(panel.tree)).toContain(latest);
    const blobs: Blob[] = []; const click = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ click }) });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { blobs.push(blob as Blob); return 'blob:memory'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    panel.click('导出未落盘正文');
    expect(click).toHaveBeenCalledOnce();
    const backup = JSON.parse(await blobs[0].text());
    expect(backup.records[0]).toEqual(savedCopy); expect(backup.source).toBe('current-tab-memory-only');
    expect(harness.sync).not.toHaveBeenCalled(); expect(harness.pending).toEqual(prior);
    vi.restoreAllMocks();
  });

  it('hides the former owner copy on account change and restores access on returning, without replacing report text', async () => {
    const app = await conflictPage(); await failedEdit(app, '只属于学生甲的内存正文');
    const original = getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')[0];
    harness.userId = 'student-b'; harness.token = 'token-b'; app.render();
    expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')).toEqual([]);
    expect(mountMemoryPanel().tree).toBeNull();
    harness.userId = 'student-a'; harness.token = 'renewed-a'; app.render(); await settle(); app.render();
    expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')).toEqual([original]);
    const field = walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!;
    expect(field.props.value).toBe('尚未同步的本机读数');
  });

  it('keeps the memory copy and global unload warning after leaving the report route', async () => {
    const app = await conflictPage(); await failedEdit(app, '离开路由也应保留'); app.unmount();
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const reopened = await conflictPage();
    expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')[0].content.measurements).toBe('离开路由也应保留');
    expect(walk(reopened.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!.props.value).toBe('尚未同步的本机读数');
  });

  it('does not clear newer failed text when an older save ACK arrives later', async () => {
    harness.pending!.expectedRevision = 2;
    const app = mountPage(); await settle(); app.render(); const response = deferred<SessionLearningRecord>(); harness.sync.mockReturnValueOnce(response.promise);
    app.click('保存到账号'); await failedEdit(app, '晚于请求的未落盘正文');
    response.resolve(server()); await settle(); app.render();
    expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')[0].content.measurements).toBe('晚于请求的未落盘正文');
    expect(walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!.props.value).toBe('晚于请求的未落盘正文');
  });

  it('clears only an exact successfully queued copy and blocks an old export callback after renewal', async () => {
    const app = await conflictPage(); await failedEdit(app, '待恢复原文');
    const panel = mountMemoryPanel(); panel.click('查看未落盘正文'); panel.render();
    const staleExport = walk(panel.tree).find((item) => item.type === 'button' && text(item) === '导出未落盘正文')!.props.onClick as () => void;
    const create = vi.spyOn(URL, 'createObjectURL'); harness.token = 'renewed-token'; staleExport(); expect(create).not.toHaveBeenCalled(); create.mockRestore();
    app.render(); await settle(); app.render();
    const edit = (value: string) => (walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!.props.onChange as (event: unknown) => void)({ target: { value } });
    edit('新的不同草稿'); app.render(); expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')[0].content.measurements).toBe('待恢复原文');
    edit('待恢复原文'); app.render(); expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')).toEqual([]);
    app.unmount(); const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
  });
});


describe('explicit copy restoration protects both source and current report', () => {
  function childPanel(app: ReturnType<typeof mountPage>, Component: typeof UnsavedLearningRecordPanel | typeof OtherLearningRecordDrafts) {
    const frame: Frame = { slots: [], cursor: 0, effects: [] };
    const child = { tree: null as ReactNode,
      render() { const node = walk(app.tree).find((item) => item.type === Component)!; expect(node).toBeDefined(); child.tree = run(frame, () => (Component as (props: unknown) => ReactNode)(node.props)); return child.tree; },
      click(label: string) { const button = walk(child.tree).find((item) => item.type === 'button' && text(item) === label)!; expect(button, label).toBeDefined(); (button.props.onClick as () => void)(); },
    };
    child.render(); cleanups.push(() => dispose(frame)); return child;
  }
  async function quotaCopy() {
    const app = await conflictPage(); harness.queue.mockImplementationOnce(() => { throw new Error('quota'); });
    const field = walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!;
    (field.props.onChange as (event: unknown) => void)({ target: { value: '待恢复内存正文' } }); app.render();
    const panel = childPanel(app, UnsavedLearningRecordPanel); panel.click('查看未落盘正文'); panel.render(); return { app, panel };
  }
  function otherCopy(): LearningRecordDraft {
    const pending = { prediction: '页面预测', measurements: '旧页面完整读数', conclusion: '页面结论', question: '页面疑问', expectedRevision: 1, mutationId: 'closed-page-mutation' };
    return { clientId: 'closed-page', isCurrentTab: false, raw: JSON.stringify(pending), valid: true, pending };
  }
  async function otherPreview() {
    const app = await conflictPage(); harness.otherDrafts = [otherCopy()];
    const panel = childPanel(app, OtherLearningRecordDrafts); panel.click('查看其他页面草稿'); panel.render(); return { app, panel };
  }

  it('restores the full memory text with its original CAS base and clears only after the atomic write', async () => {
    const { app, panel } = await quotaCopy();
    expect(harness.restoreDraft).not.toHaveBeenCalled(); expect(text(panel.tree)).toContain('恢复会替换');
    const copy = getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')[0]; panel.click('恢复这份文字为草稿'); app.render();
    expect(harness.restoreDraft).toHaveBeenCalledExactlyOnceWith(getStudentRecordScope(), 'session-a', copy.content, 1);
    expect(harness.pending!.expectedRevision).toBe(1); expect(harness.pending!.measurements).toBe('待恢复内存正文');
    expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')).toEqual([]);
    expect(text(app.tree)).toContain('原版本与账号当前版本不同'); expect(harness.sync).not.toHaveBeenCalled();
    expect(harness.useServer).not.toHaveBeenCalled();
  });

  it('keeps the original memory text and target draft when restoring hits quota again', async () => {
    const { app, panel } = await quotaCopy(); const pending = structuredClone(harness.pending); const copies = getUnsavedLearningRecords(getStudentRecordScope(), 'session-a');
    harness.restoreDraft.mockImplementationOnce(() => { throw new Error('仍然quota失败'); }); panel.click('恢复这份文字为草稿'); app.render(); panel.render();
    expect(getUnsavedLearningRecords(getStudentRecordScope(), 'session-a')).toEqual(copies); expect(harness.pending).toEqual(pending);
    expect(text(app.tree)).toContain('仍然quota失败');
  });

  it('rejects a restore after the target text changed since preview', async () => {
    const { app, panel } = await otherPreview();
    const field = walk(app.tree).find((item) => item.type === 'textarea' && item.props.id === 'learning-measurements')!;
    (field.props.onChange as (event: unknown) => void)({ target: { value: '预览后输入的新正文' } }); app.render(); panel.render();
    panel.click('恢复这份页面草稿'); app.render();
    expect(harness.restoreDraft).not.toHaveBeenCalled(); expect(harness.pending!.measurements).toBe('预览后输入的新正文');
    expect(text(app.tree)).toContain('上方草稿已变化');
  });

  it.each(['cached-completed', 'pending-version'] as const)('rejects restore when persisted target changes after preview: %s', async (change) => {
    const { app, panel } = await otherPreview();
    if (change === 'cached-completed') harness.server = { ...harness.server!, session: { ...harness.server!.session, status: 'completed' } };
    else harness.pending = { ...harness.pending!, expectedRevision: 12, mutationId: 'changed-but-same-text' };
    panel.click('恢复这份页面草稿'); app.render();
    expect(harness.restoreDraft).not.toHaveBeenCalled(); expect(harness.otherDrafts).toHaveLength(1);
  });

  it('rejects changed source raw even at the same client id and requires re-preview', async () => {
    const { panel } = await otherPreview(); harness.otherDrafts[0] = { ...otherCopy(), raw: 'updated source raw' };
    panel.click('恢复这份页面草稿'); panel.render();
    expect(harness.restoreDraft).not.toHaveBeenCalled(); expect(text(panel.tree)).toContain('来源草稿已改变');
  });

  it('restores an old page source without deleting it or replacing its original mutation', async () => {
    const { app, panel } = await otherPreview(); const original = structuredClone(harness.otherDrafts);
    panel.click('恢复这份页面草稿'); app.render(); panel.render();
    expect(harness.restoreDraft).toHaveBeenCalledExactlyOnceWith(getStudentRecordScope(), 'session-a', expect.objectContaining({ measurements: '旧页面完整读数', prediction: '页面预测', conclusion: '页面结论', question: '页面疑问' }), 1);
    expect(harness.otherDrafts).toEqual(original); expect(harness.pending!.mutationId).toBe('restored');
    expect(text(panel.tree)).toContain('来源副本仍保留'); expect(text(app.tree)).toContain('需要核对版本');
  });

  it.each(['renew', 'expired', 'completed'] as const)('does not restore a preview after %s', async (change) => {
    const { app, panel } = await otherPreview();
    if (change === 'renew') harness.token = 'renewed-token';
    if (change === 'expired') harness.expired = true;
    if (change === 'completed') { harness.server = { ...harness.server!, session: { ...harness.server!.session, status: 'completed' } }; app.click('重新读取账号记录'); app.render(); await settle(); app.render(); panel.render(); }
    if (change === 'completed') expect(walk(panel.tree).some((item) => item.type === 'button' && text(item) === '恢复这份页面草稿')).toBe(false);
    else panel.click('恢复这份页面草稿');
    expect(harness.restoreDraft).not.toHaveBeenCalled(); expect(harness.otherDrafts).toHaveLength(1);
  });
});


describe('student feedback integration preserves the existing report editor', () => {
  it.each(['active', 'completed'] as const)('reads feedback without editing the %s report, local draft or session', async (status) => {
    harness.pending = null;
    harness.server!.session.status = status;
    const app = mountPage(); await settle(); app.render();
    const feedbackElement = walk(app.tree).find((item) => item.type === StudentLearningFeedback)!;
    expect(feedbackElement).toBeDefined();
    expect(feedbackElement.props.scope).toEqual(getStudentRecordScope());
    expect(feedbackElement.props.detail).toEqual(harness.server);
    expect(feedbackElement.props.hasLocalChanges).toBe(false);
    expect(walk(app.tree).filter((item) => item.type === 'textarea').every((item) => item.props.readOnly === (status === 'completed'))).toBe(true);
    expect(harness.feedback).not.toHaveBeenCalled();
    const before = structuredClone(harness.server);
    harness.remember.mockClear(); harness.queue.mockClear(); harness.sync.mockClear(); harness.useServer.mockClear(); harness.restoreDraft.mockClear();
    const frame: Frame = { slots: [], cursor: 0, effects: [] };
    cleanups.push(() => dispose(frame));
    const renderFeedback = () => run(frame, () => StudentLearningFeedback(feedbackElement.props as Parameters<typeof StudentLearningFeedback>[0]));
    let tree = renderFeedback();
    (walk(tree).find((item) => item.type === 'button')!.props.onClick as () => void)();
    await settle(); tree = renderFeedback();
    expect(harness.feedback).toHaveBeenCalledExactlyOnceWith('session-a');
    expect(text(tree)).toContain('本次读取未发现教师反馈');
    expect(harness.server).toEqual(before); expect(harness.pending).toBeNull();
    for (const mutation of [harness.remember, harness.queue, harness.sync, harness.useServer, harness.restoreDraft]) expect(mutation).not.toHaveBeenCalled();
    app.render();
    expect(walk(app.tree).filter((item) => item.type === 'textarea').every((item) => item.props.readOnly === (status === 'completed'))).toBe(true);
  });

  it('marks local unsynchronized text separately from the account revision shown with feedback', async () => {
    const app = await conflictPage();
    const feedbackElement = walk(app.tree).find((item) => item.type === StudentLearningFeedback)!;
    expect(feedbackElement.props.hasLocalChanges).toBe(true);
    expect((feedbackElement.props.detail as SessionLearningRecord).record?.revision).toBe(2);
    expect(harness.pending?.expectedRevision).toBe(1);
    expect(harness.feedback).not.toHaveBeenCalled();
  });
});
