import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StudentRecordScope } from '../../../data/studentRecordScope';
import { createLearningRecordRepository } from '../../../data/learningRecordRepository';
import { LegacyLearningRecordPanel } from './LegacyLearningRecordPanel';
import { OtherLearningRecordDrafts } from './OtherLearningRecordDrafts';
import { downloadRecordCopy } from './recordCopyDownload';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, scope: null as StudentRecordScope | null,
  repository: null as ReturnType<typeof import('../../../data/learningRecordRepository').createLearningRecordRepository> | null,
  save: vi.fn(),
}));
// Actual TSX callbacks and effects, with in-memory hooks. No browser layout or React scheduling claim.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => {
      if (!harness.frame) return actual.useState(initial);
      const item = slot();
      if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!harness.frame) return actual.useRef(initial);
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = { current: initial }; return item.value;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!harness.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});
vi.mock('../../../data/studentRecordScope', () => ({
  isCurrentStudentRecordScope: (scope: StudentRecordScope, write = false) => !!scope.key && harness.scope?.key === scope.key &&
    harness.scope.revision === scope.revision && harness.scope.mode === 'account' && (!write || (scope.canWrite && harness.scope.canWrite)),
}));
vi.mock('../../../data/teacherApi', () => ({
  TeacherApiError: class extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  studentApi: { saveLearningRecord: (...args: unknown[]) => harness.save(...args) },
}));
vi.mock('../../../data/learningRecordRepository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data/learningRecordRepository')>()),
  learningRecordRepository: () => harness.repository!,
}));

class MemoryStorage {
  values = new Map<string, string>();
  getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  setItem = vi.fn((key: string, value: string) => { this.values.set(key, value); });
  key = vi.fn((index: number) => [...this.values.keys()][index] ?? null);
  get length() { return this.values.size; }
}
function scope(changes: Partial<StudentRecordScope> = {}): StudentRecordScope {
  const value = { key: '', apiNamespace: 'https://school.example.test/api', schoolId: 'school-a', studentId: 'student-a', mode: 'account' as const,
    canWrite: true, revision: 1, label: '学生甲', ...changes };
  return { ...value, key: changes.key === undefined ? `student:${encodeURIComponent(value.apiNamespace)}:${encodeURIComponent(value.schoolId!)}:${encodeURIComponent(value.studentId!)}` : changes.key };
}
const sessionId = 'session-a';
const legacyKey = (tab?: string, owner = 'student-a', session = sessionId) => `physics-learning-record-v2:${encodeURIComponent(owner)}:${encodeURIComponent(session)}${tab === undefined ? '' : `:draft:${encodeURIComponent(tab)}`}`;
const currentKey = (tab: string, value = harness.scope!, session = sessionId) => `physics-learning-record-v3:${value.key}:${encodeURIComponent(session)}:draft:${encodeURIComponent(tab)}`;
const currentServerKey = (value = harness.scope!, session = sessionId) => `physics-learning-record-v3:${value.key}:${encodeURIComponent(session)}`;
const content = { prediction: '预测', measurements: '<script>alert("仅文字")</script>\n原值 0.9800000000000001', conclusion: '结论', question: '追问' };
const pending = (label: string) => ({ ...content, prediction: label, expectedRevision: 1, mutationId: `mutation-${label}` });
function legacyServer() {
  return { session: { id: sessionId, learnerId: 'student-a', schoolId: 'unknown-old-school', taskId: 'task-a', classId: 'class-a', experimentId: 'pendulum', status: 'active', startedAt: '2026-11-11T00:00:00.000Z', updatedAt: '2026-11-11T00:00:00.000Z', completedAt: null },
    learnerName: '旧学生名字', taskTitle: '旧任务', className: '旧班级', lessonTitle: '旧课例', record: { ...content, sessionId, learnerId: 'student-a', revision: 1, lastMutationId: 'server-old', updatedAt: '2026-11-11T00:00:00.000Z' } };
}
let storage: MemoryStorage;
let blobs: Blob[];
let createUrl: ReturnType<typeof vi.fn<(blob: Blob | MediaSource) => string>>;
let revokeUrl: ReturnType<typeof vi.fn<(url: string) => void>>;
let createElement: ReturnType<typeof vi.fn<() => { href: string; download: string; click: ReturnType<typeof vi.fn> }>>;
let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
const cleanups: Array<() => void> = [];
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : '';
}
const panels = [
  { name: 'legacy', Component: LegacyLearningRecordPanel, open: '查看此会话的旧副本', export: '导出本次读到的旧副本' },
  { name: 'other-tabs', Component: OtherLearningRecordDrafts, open: '查看其他页面草稿', export: '导出本次读到的副本' },
] as const;
function mountPanel(panel: typeof panels[number], initial = { scope: harness.scope!, sessionId }) {
  let props = initial; const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render(next: Partial<typeof initial> = {}) {
      props = { ...props, ...next }; frame.cursor = 0; harness.frame = frame;
      try { app.tree = panel.Component(props); } finally { harness.frame = null; }
      frame.effects.splice(0).forEach((effect) => effect()); return app.tree;
    },
    handler(label: string) {
      const button = walk(app.tree).find((item) => item.type === 'button' && text(item) === label);
      expect(button, label).toBeDefined(); return button!.props.onClick as () => void;
    },
    open() { app.handler(panel.open)(); app.render(); },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime('2026-11-11T00:00:00.000Z'); harness.frame = null; harness.scope = scope(); harness.save.mockReset();
  storage = new MemoryStorage();
  storage.values.set(legacyKey(), JSON.stringify(legacyServer())); storage.values.set(legacyKey('old-a'), JSON.stringify(pending('旧页面A')));
  storage.values.set(legacyKey('old-b'), JSON.stringify(pending('旧页面B')));
  storage.values.set(currentKey('current-tab'), JSON.stringify(pending('当前页面不应出现')));
  storage.values.set(currentKey('other-tab'), JSON.stringify(pending('其他页面完整草稿')));
  const validServer = legacyServer(); validServer.session.schoolId = 'school-a'; storage.values.set(currentServerKey(), JSON.stringify(validServer));
  harness.repository = createLearningRecordRepository(storage, { saveLearningRecord: harness.save }, () => 'must-not-create-id', 'current-tab');
  vi.spyOn(harness.repository, 'queue'); vi.spyOn(harness.repository, 'remember'); vi.spyOn(harness.repository, 'useServer'); vi.spyOn(harness.repository, 'sync');
  const browser = new EventTarget(); Object.assign(browser, { localStorage: storage, setTimeout, clearTimeout }); vi.stubGlobal('window', browser);
  blobs = []; const ActualBlob = Blob;
  vi.stubGlobal('Blob', class extends ActualBlob { constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); blobs.push(this); } });
  createUrl = vi.fn(() => 'blob:controlled-download'); revokeUrl = vi.fn();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(createUrl); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeUrl);
  anchor = { href: '', download: '', click: vi.fn() }; createElement = vi.fn(() => anchor);
  vi.stubGlobal('document', { createElement });
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('explicit local report copy panels', () => {
  it.each(panels)('$name mounts without reading storage or creating a download', (panel) => {
    mountPanel(panel);
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.key).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
    expect(blobs).toHaveLength(0); expect(createElement).not.toHaveBeenCalled(); expect(harness.save).not.toHaveBeenCalled();
  });

  it('shows and exports every old tab separately with exact raw text and no migration, upload or merge', async () => {
    storage.values.set(legacyKey('other', 'another-student'), 'DO NOT READ ANOTHER STUDENT');
    storage.values.set(legacyKey('other', 'student-a', 'another-session'), 'DO NOT READ ANOTHER SESSION');
    const before = [...storage.values]; const app = mountPanel(panels[0]); app.open();
    expect(text(app.tree)).toContain('旧页面A'); expect(text(app.tree)).toContain('旧页面B');
    expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([legacyKey(), legacyKey('old-a'), legacyKey('old-b')]);
    app.handler(panels[0].export)(); const json = JSON.parse(await blobs[0]!.text());
    expect(json.boundary).toContain('未验证属于当前学校或后台'); expect(json.entries).toHaveLength(3);
    for (const entry of json.entries) expect(entry.rawPayload).toBe(storage.values.get(entry.key));
    expect(anchor.click).toHaveBeenCalledOnce(); expect([...storage.values]).toEqual(before); expect(storage.setItem).not.toHaveBeenCalled();
    expect(harness.repository!.queue).not.toHaveBeenCalled(); expect(harness.repository!.remember).not.toHaveBeenCalled();
    expect(harness.repository!.useServer).not.toHaveBeenCalled(); expect(harness.repository!.sync).not.toHaveBeenCalled(); expect(harness.save).not.toHaveBeenCalled();
  });

  it('reads only the current v3 scope/session and excludes the current tab from other-copy preview and export', async () => {
    storage.values.set(currentKey('other-session', harness.scope!, 'different-session'), JSON.stringify(pending('不属于本会话')));
    storage.values.set(currentKey('other-backend', scope({ apiNamespace: 'https://other.example.test/api' })), JSON.stringify(pending('其他后台')));
    const app = mountPanel(panels[1]); app.open();
    expect(text(app.tree)).toContain('其他页面完整草稿'); expect(text(app.tree)).not.toContain('当前页面不应出现');
    expect(storage.getItem.mock.calls.every(([key]) => [currentKey('current-tab'), currentKey('other-tab'), currentServerKey()].includes(key))).toBe(true);
    app.handler(panels[1].export)(); const json = JSON.parse(await blobs[0]!.text());
    expect(json).toMatchObject({ apiNamespace: harness.scope!.apiNamespace, studentId: 'student-a', schoolId: 'school-a', sessionId, capturedAt: '2026-11-11T00:00:00.000Z' });
    expect(json.drafts).toEqual([{ clientId: 'other-tab', isCurrentTab: false, raw: storage.values.get(currentKey('other-tab')), valid: true }]);
    expect(json.serverCopy).toBeNull();
    expect(harness.save).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(panels)('$name permits current expired-account read and export without any write', async (panel) => {
    harness.scope = scope({ canWrite: false, revision: 2 });
    const app = mountPanel(panel); app.open(); app.handler(panel.export)();
    expect(blobs).toHaveLength(1); expect(anchor.click).toHaveBeenCalledOnce(); expect(await blobs[0]!.text()).toContain('boundary');
    expect(storage.setItem).not.toHaveBeenCalled(); expect(harness.save).not.toHaveBeenCalled();
  });

  for (const panel of panels) {
    it.each(['renewal', 'school', 'backend', 'student', 'route', 'unmount'] as const)(`${panel.name} rejects a captured download callback after %s`, (change) => {
      const app = mountPanel(panel); app.open(); const oldDownload = app.handler(panel.export);
      if (change === 'renewal') harness.scope = scope({ revision: 2 });
      if (change === 'school') harness.scope = scope({ schoolId: 'different-school' });
      if (change === 'backend') harness.scope = scope({ apiNamespace: 'https://other.example.test/api' });
      if (change === 'student') harness.scope = scope({ studentId: 'other-student' });
      if (change === 'route') app.render({ sessionId: 'other-session' });
      if (change === 'unmount') app.unmount();
      oldDownload();
      expect(blobs).toHaveLength(0); expect(createUrl).not.toHaveBeenCalled(); expect(createElement).not.toHaveBeenCalled(); expect(anchor.click).not.toHaveBeenCalled();
    });
  }

  it.each(panels)('$name rejects an old open callback before reading storage after identity changes', (panel) => {
    const app = mountPanel(panel); const oldOpen = app.handler(panel.open); harness.scope = scope({ revision: 2 }); oldOpen();
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.key).not.toHaveBeenCalled(); expect(harness.save).not.toHaveBeenCalled();
  });

  it('shows partial legacy read warnings and exports raw damaged text without claiming a complete collection', async () => {
    const raw = '{broken payload <script>not executable</script>\n'; storage.values.set(legacyKey('old-a'), raw);
    storage.getItem.mockImplementation((key) => { if (key === legacyKey('old-b')) throw new Error('unreadable'); return storage.values.get(key) ?? null; });
    const app = mountPanel(panels[0]); app.open();
    expect(text(app.tree)).toContain('部分旧内容损坏或未能读取'); expect(text(app.tree)).toContain('原文未能读取');
    expect(text(app.tree)).not.toContain('完整备份');
    app.handler(panels[0].export)(); const json = JSON.parse(await blobs[0]!.text());
    expect(json).toMatchObject({ partial: true, failed: true, collectionReadComplete: false });
    expect(json.entries.find((entry: { tabId: string }) => entry.tabId === 'old-a').rawPayload).toBe(raw);
    expect(json.entries.find((entry: { tabId: string }) => entry.tabId === 'old-b')).toMatchObject({ rawPayload: null, status: 'unreadable' });
  });

  it('retains invalid other-tab drafts as raw backup data without pretending they are normal report text', async () => {
    const raw = '{损坏的跨页草稿'; storage.values.set(currentKey('broken-tab'), raw);
    const app = mountPanel(panels[1]); app.open(); expect(text(app.tree)).toContain('内容需核对'); expect(text(app.tree)).toContain(raw);
    app.handler(panels[1].export)(); const json = JSON.parse(await blobs[0]!.text());
    expect(json.drafts.find((entry: { clientId: string }) => entry.clientId === 'broken-tab')).toMatchObject({ raw, valid: false });
    expect(json.boundary).toContain('没有上传、合并或清除'); expect(storage.values.get(currentKey('broken-tab'))).toBe(raw);
  });

  it('includes a malformed current-tab draft so the blocked editor still offers its raw backup', async () => {
    const raw = '{当前页面损坏的原稿'; storage.values.set(currentKey('current-tab'), raw);
    const app = mountPanel(panels[1]); app.open();
    expect(text(app.tree)).toContain('本页异常草稿'); expect(text(app.tree)).toContain(raw);
    app.handler(panels[1].export)(); const json = JSON.parse(await blobs[0]!.text());
    expect(json.drafts.find((entry: { clientId: string }) => entry.clientId === 'current-tab')).toMatchObject({ raw, valid: false, isCurrentTab: true });
    expect(storage.values.get(currentKey('current-tab'))).toBe(raw); expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('backs up an invalid server cache even when there are no other draft copies', async () => {
    const raw = '{账号缓存的原始损坏内容<script>仅文字</script>'; storage.values.set(currentServerKey(), raw); storage.values.delete(currentKey('other-tab'));
    const app = mountPanel(panels[1]); app.open();
    expect(text(app.tree)).toContain('本机账号缓存 · 内容需核对'); expect(text(app.tree)).toContain(raw);
    const button = walk(app.tree).find((item) => item.type === 'button' && text(item) === panels[1].export)!;
    expect(button.props.disabled).toBe(false); app.handler(panels[1].export)();
    const json = JSON.parse(await blobs[0]!.text()); expect(json.serverCopy).toMatchObject({ raw, valid: false }); expect(json.drafts).toEqual([]);
    expect(json.boundary).toContain('异常内容不代表已验证的报告'); expect(storage.values.get(currentServerKey())).toBe(raw);
  });

  it.each(panels)('$name escapes report text and raw JSON when rendered to HTML', (panel) => {
    const app = mountPanel(panel); app.open(); const html = renderToStaticMarkup(app.tree);
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
    expect(html).toContain('0.9800000000000001');
  });
});

describe('actual record-copy download action guards', () => {
  it('creates neither a blob nor a link when the identity guard is already false', () => {
    expect(() => downloadRecordCopy('{"raw":"copy"}', 'copy.json', () => false)).toThrow('身份已变化');
    expect(blobs).toHaveLength(0); expect(createUrl).not.toHaveBeenCalled(); expect(createElement).not.toHaveBeenCalled();
  });

  it('revokes the prepared URL without creating or clicking a link when identity changes during preparation', () => {
    const guard = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    expect(() => downloadRecordCopy('{"raw":"copy"}', 'copy.json', guard)).toThrow('身份已变化');
    expect(blobs).toHaveLength(1); expect(createUrl).toHaveBeenCalledOnce(); expect(createElement).not.toHaveBeenCalled(); expect(anchor.click).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:controlled-download');
  });

  it('exports the exact JSON once while allowed and eventually releases its URL', async () => {
    const raw = '{"text":"原文\\n<script>只是文字</script>"}'; downloadRecordCopy(raw, '课堂副本.json', () => true);
    expect(await blobs[0]!.text()).toBe(raw); expect(blobs[0]!.type).toBe('application/json;charset=utf-8');
    expect(anchor).toMatchObject({ href: 'blob:controlled-download', download: '课堂副本.json' }); expect(anchor.click).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000); expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:controlled-download');
  });
});
