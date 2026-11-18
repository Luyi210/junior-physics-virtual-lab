import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SessionLearningRecord } from '@physics-lab/contracts';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import type { HighSchoolRecordScope } from '../../../data/highSchoolRecordScope';
import type { MeasurementSnapshot } from '../experiments/measurementStorage';
import { ClassroomEvidencePicker } from './ClassroomEvidencePicker';
import { HighSchoolClassroomPanel } from './HighSchoolClassroomPanel';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({
  frame: null as Frame | null,
  scope: null as HighSchoolRecordScope | null,
  automatic: null as MeasurementSnapshot | null,
  load: vi.fn(), search: '',
}));

// Runs the production component callbacks and effect cleanups in memory. It
// deliberately does not claim DOM, browser, or React scheduling coverage.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => {
    const frame = harness.frame!;
    return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {});
  };
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
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!harness.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.deps = deps;
        harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
  };
});
vi.mock('../../../data/highSchoolRecordScope', () => ({
  getHighSchoolRecordScope: () => harness.scope,
  subscribeHighSchoolRecordScope: () => () => {},
}));
vi.mock('../../../data/highSchoolClassroom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../data/highSchoolClassroom')>()),
  canUseHighSchoolClassroomScope: (scope: HighSchoolRecordScope, owner: { learnerId: string; schoolId: string }) => scope === harness.scope && scope.canWrite && scope.authChannel === 'student' && scope.key === 'account:test:school-a:student:learner-a' && owner.learnerId === 'learner-a' && owner.schoolId === 'school-a',
  loadHighSchoolClassroom: (...args: unknown[]) => harness.load(...args),
}));
vi.mock('../experiments/measurementStorage', () => ({ getScopedMeasurementStore: () => ({ read: () => harness.automatic!, matchesKey: (key: string | null) => key === 'automatic-store' }) }));
vi.mock('../experiments/manualMeasurementRepository', () => ({ getScopedManualMeasurementRepository: () => ({ read: () => ({ records: [], failed: false, excludedCount: 0 }), matchesKey: () => false }) }));
vi.mock('./HighSchoolRecordScopePanel', () => ({ HighSchoolRecordScopePanel: () => <span>选择学生档案</span> }));
vi.mock('react-router-dom', () => ({ Link: 'a', useLocation: () => ({ pathname: '/high-school/experiments/spring-force', search: harness.search }) }));

type Element = ReactElement<Record<string, unknown>>;
type PickerProps = Parameters<typeof ClassroomEvidencePicker>[0];
const cleanups: Array<() => void> = [];
function walk(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...walk(node.props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : '';
}
function findButton(tree: ReactNode, label: string) { return walk(tree).find((item) => item.type === 'button' && text(item).includes(label)); }
function click(element: Element) { (element.props.onClick as () => void)(); }
function run(frame: Frame, render: () => ReactNode) {
  frame.cursor = 0; harness.frame = frame;
  let result: ReactNode;
  try { result = render(); } finally { harness.frame = null; }
  frame.effects.splice(0).forEach((effect) => effect());
  return result;
}
function dispose(frame: Frame) { frame.slots.forEach((slot) => slot.cleanup?.()); }
function mountPicker(initial: PickerProps) {
  let props = initial;
  let frame: Frame | undefined;
  let key: string | null | undefined;
  const app = {
    tree: null as ReactNode,
    render(next: Partial<PickerProps> = {}) {
      props = { ...props, ...next };
      const child = ClassroomEvidencePicker(props);
      if (!child) { if (frame) dispose(frame); frame = undefined; app.tree = null; return app.tree; }
      if (!frame || child.key !== key) { if (frame) dispose(frame); frame = { slots: [], cursor: 0, effects: [] }; key = child.key; }
      app.tree = run(frame, () => (child.type as (props: unknown) => ReactNode)(child.props));
      return app.tree;
    },
    unmount() { if (frame) dispose(frame); frame = undefined; },
  };
  cleanups.push(() => app.unmount()); app.render(); return app;
}
function detail(): SessionLearningRecord {
  return { session: { id: 'session-a', schoolId: 'school-a', learnerId: 'learner-a', classId: 'class-a', taskId: 'task-a', experimentId: 'spring-force', status: 'active', startedAt: '2026-11-11T01:00:00.000Z', updatedAt: '2026-11-11T01:00:00.000Z', completedAt: null },
    learnerName: '学生甲', taskTitle: '本周弹簧课堂', className: '高一一班', lessonTitle: '弹簧探究',
    record: { sessionId: 'session-a', learnerId: 'learner-a', revision: 1, lastMutationId: 'mutation-a', updatedAt: '2026-11-11T01:00:00.000Z', prediction: '', measurements: '已有学生文字', conclusion: '', question: '' } };
}
function server(record = detail()) {
  return { record, lesson: { title: '弹簧探究', objective: '比较证据', inquiryQuestion: '弹力与伸长量有什么关系？', predictionPrompt: '先预测', controlledVariable: '固定原长和劲度系数', evidenceRequirement: '记录三组', reflectionPrompt: '解释模型边界' } };
}
function props(): PickerProps { return { detail: detail(), measurements: '已有学生文字', disabled: false, onAppend: vi.fn() }; }
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
async function open(app: ReturnType<typeof mountPicker>) { click(findButton(app.tree, '选择本机实验读数')!); await settle(); app.render(); }
async function preview(app: ReturnType<typeof mountPicker>) {
  await open(app);
  const checkbox = walk(app.tree).find((item) => item.type === 'input' && item.props.type === 'checkbox')!;
  (checkbox.props.onChange as () => void)(); app.render();
  click(findButton(app.tree, '生成全文预览')!); app.render();
}

beforeEach(() => {
  harness.frame = null; harness.search = '?taskId=task-a&sessionId=session-a';
  harness.scope = { key: 'account:test:school-a:student:learner-a', mode: 'account', label: '学生甲', canWrite: true, authChannel: 'student', revision: 1 };
  const parameters = defaultHighSchoolParameters('spring-force');
  harness.automatic = { records: [{ id: 'automatic-a', createdAt: '2026-11-11T01:00:00.000Z', timeSeconds: 0, parameters, metrics: simulateHighSchoolExperiment('spring-force', parameters).metrics }], failed: false };
  harness.load.mockReset().mockResolvedValue(server());
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('classroom evidence explicit selection and confirmation', () => {
  it('loads without selecting records and never appends while opening or previewing', async () => {
    const input = props(); const app = mountPicker(input);
    expect(harness.load).not.toHaveBeenCalled();
    await open(app);
    const checkboxes = walk(app.tree).filter((item) => item.type === 'input' && item.props.type === 'checkbox');
    expect(checkboxes).toHaveLength(1);
    expect(checkboxes.every((item) => item.props.checked === false)).toBe(true);
    expect(findButton(app.tree, '生成全文预览')!.props.disabled).toBe(true);
    (checkboxes[0]!.props.onChange as () => void)(); app.render();
    click(findButton(app.tree, '生成全文预览')!); app.render();
    expect(input.onAppend).not.toHaveBeenCalled();
    expect(text(app.tree)).toContain('原记录ID："automatic-a"');
    expect(text(app.tree)).toContain('不是实物实测');
    expect(findButton(app.tree, '确认加入课堂草稿')).toBeDefined();
  });

  it('appends exactly the reviewed copy after explicit confirmation and preserves existing text', async () => {
    const input = props(); const app = mountPicker(input); await preview(app);
    const previewText = walk(app.tree).find((item) => item.type === 'pre')!.props.children;
    click(findButton(app.tree, '确认加入课堂草稿')!); await settle(); app.render();
    expect(input.onAppend).toHaveBeenCalledExactlyOnceWith(`${input.measurements}\n\n${previewText}`);
    expect(findButton(app.tree, '确认加入课堂草稿')).toBeUndefined();
    expect(walk(app.tree).find((item) => item.type === 'input')!.props.checked).toBe(false);
    expect(harness.automatic!.records).toHaveLength(1);
    expect(text(app.tree)).toContain('以上方保存状态为准');
  });

  it('does not overwrite text edited while the confirmation request is awaiting the server', async () => {
    const input = props(); const app = mountPicker(input); await preview(app);
    const pending = deferred<ReturnType<typeof server>>(); harness.load.mockReturnValueOnce(pending.promise);
    click(findButton(app.tree, '确认加入课堂草稿')!);
    app.render({ measurements: '学生刚刚补写的新文字' });
    pending.resolve(server()); await settle(); app.render();
    expect(input.onAppend).not.toHaveBeenCalled();
    expect(text(app.tree)).toContain('测量文字在预览后已修改');
  });

  it('rejects an old confirmation after the selected identity changes, even before a rerender', async () => {
    const input = props(); const app = mountPicker(input); await preview(app);
    const pending = deferred<ReturnType<typeof server>>(); harness.load.mockReturnValueOnce(pending.promise);
    click(findButton(app.tree, '确认加入课堂草稿')!);
    harness.scope = { ...harness.scope!, key: 'account:test:school-a:student:learner-b', revision: 2 };
    pending.resolve(server()); await settle();
    expect(input.onAppend).not.toHaveBeenCalled();
    app.render();
    expect(findButton(app.tree, '确认加入课堂草稿')).toBeUndefined();
    expect(text(app.tree)).toContain('请使用这份报告所属学生的有效档案');
  });

  it.each(['disabled', 'completed', 'revision'] as const)('rejects confirmation if %s changes while checking the report', async (change) => {
    const input = props(); const app = mountPicker(input); await preview(app);
    const pending = deferred<ReturnType<typeof server>>(); harness.load.mockReturnValueOnce(pending.promise);
    click(findButton(app.tree, '确认加入课堂草稿')!);
    const next = detail();
    if (change === 'disabled') app.render({ disabled: true });
    else if (change === 'completed') next.session.status = 'completed';
    else next.record!.revision += 1;
    pending.resolve(server(next)); await settle(); app.render();
    expect(input.onAppend).not.toHaveBeenCalled();
    expect(findButton(app.tree, '确认加入课堂草稿')).toBeUndefined();
    expect(walk(app.tree).some((item) => item.props.role === 'alert')).toBe(true);
  });

  it.each(['failed', 'recovery', 'changed-record'] as const)('rechecks %s sources at confirmation instead of trusting a stale preview', async (change) => {
    const input = props(); const app = mountPicker(input); await preview(app);
    if (change === 'failed') harness.automatic = { ...harness.automatic!, failed: true };
    else if (change === 'recovery') harness.automatic = { ...harness.automatic!, failed: true, recovery: { records: [{ ...harness.automatic!.records[0]!, id: 'recovery-a' }], reviewToken: 'review-a' } };
    else harness.automatic!.records[0]!.metrics[0]!.value = 1.23;
    click(findButton(app.tree, '确认加入课堂草稿')!); await settle(); app.render();
    expect(input.onAppend).not.toHaveBeenCalled();
    expect(text(app.tree)).toMatch(change === 'changed-record' ? /读数或条件已变化/ : /本机档案还有/);
    expect(findButton(app.tree, '确认加入课堂草稿')).toBeUndefined();
  });

  it('does not list recovery records or allow a failed source to produce a preview', async () => {
    harness.automatic = { ...harness.automatic!, failed: true, recovery: { records: [{ ...harness.automatic!.records[0]!, id: 'recovery-hidden' }], reviewToken: 'review-hidden' } };
    const input = props(); const app = mountPicker(input); await open(app);
    expect(text(app.tree)).not.toContain('recovery-hidden');
    expect(text(app.tree)).toContain('1 条待恢复副本');
    const checkbox = walk(app.tree).find((item) => item.type === 'input')!;
    (checkbox.props.onChange as () => void)(); app.render();
    const action = findButton(app.tree, '生成全文预览')!;
    expect(action.props.disabled).toBe(true);
    click(action); app.render(); // A stale callback must enforce the guard too.
    expect(findButton(app.tree, '确认加入课堂草稿')).toBeUndefined();
    expect(input.onAppend).not.toHaveBeenCalled();
  });

  it('does not append after the component unmounts during the server check', async () => {
    const input = props(); const app = mountPicker(input); await preview(app);
    const pending = deferred<ReturnType<typeof server>>(); harness.load.mockReturnValueOnce(pending.promise);
    click(findButton(app.tree, '确认加入课堂草稿')!); app.unmount();
    pending.resolve(server()); await settle();
    expect(input.onAppend).not.toHaveBeenCalled();
  });

  it('renders a completed report as read-only without loading or showing an append action', () => {
    const input = props(); input.detail.session.status = 'completed';
    const html = renderToStaticMarkup(<ClassroomEvidencePicker {...input} />);
    expect(html).toContain('课堂会话已完成，报告只读');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('确认加入课堂草稿');
    expect(harness.load).not.toHaveBeenCalled();
    expect(input.onAppend).not.toHaveBeenCalled();
  });
});

describe('high-school classroom panel lifecycle', () => {
  it('does not load a classroom task on a free-exploration URL', async () => {
    harness.search = '';
    const frame: Frame = { slots: [], cursor: 0, effects: [] };
    cleanups.push(() => dispose(frame));
    const tree = run(frame, () => HighSchoolClassroomPanel({ experimentId: 'spring-force', scope: harness.scope! }));
    await settle();
    expect(tree).toBeNull();
    expect(harness.load).not.toHaveBeenCalled();
  });

  it('ignores an old task response after identity changes and renders the current completed task as read-only', async () => {
    const pending = deferred<ReturnType<typeof server>>(); harness.load.mockReturnValueOnce(pending.promise);
    const frame: Frame = { slots: [], cursor: 0, effects: [] };
    cleanups.push(() => dispose(frame));
    const render = () => run(frame, () => HighSchoolClassroomPanel({ experimentId: 'spring-force', scope: harness.scope! }));
    render();
    harness.scope = { ...harness.scope!, revision: 2 };
    const complete = detail(); complete.session.status = 'completed'; complete.taskTitle = '当前任务';
    harness.load.mockResolvedValueOnce(server(complete));
    expect(text(render())).not.toContain('本周弹簧课堂');
    await settle();
    pending.resolve(server()); await settle();
    const tree = render();
    expect(text(tree)).toContain('当前任务');
    expect(text(tree)).toContain('账号记录只读');
    expect(text(tree)).not.toContain('本周弹簧课堂');
    expect(walk(tree).find((item) => item.props.to === '/student/records/session-a')).toBeDefined();
  });
});
