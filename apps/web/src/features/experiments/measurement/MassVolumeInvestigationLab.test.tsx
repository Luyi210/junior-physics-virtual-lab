import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { HarnessApparatusSnapshot } from '@physics-lab/harness';
import { MassVolumeInvestigationLab } from './MassVolumeInvestigationLab';

type Slot = { value?: unknown; deps?: readonly unknown[] };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn(), publish: vi.fn() }));
// Calls the actual component's controls and snapshot effects with production physics.
// Hooks are simulated in memory; this does not assert DOM layout or browser behavior.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (old: readonly unknown[] | undefined, next: readonly unknown[] | undefined) => !old || !next || old.length !== next.length || next.some((value, i) => !Object.is(value, old[i]));
  return { ...actual,
    useState: (initial: unknown) => {
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useMemo: (create: () => unknown, deps?: readonly unknown[]) => {
      const item = slot(); if (changed(item.deps, deps)) { item.value = create(); item.deps = deps; } return item.value;
    },
    useEffect: (effect: () => void, deps?: readonly unknown[]) => {
      const item = slot(); if (changed(item.deps, deps)) { item.deps = deps; hooks.frame!.effects.push(effect); }
    },
  };
});
vi.mock('../../assistant/harnessStore', () => ({ useHarnessStore: (select: (state: { record: typeof hooks.record }) => unknown) => select({ record: hooks.record }) }));
vi.mock('../../assistant/tutorialBridge', () => ({ publishApparatusSnapshot: (value: HarnessApparatusSnapshot) => hooks.publish(value) }));
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
function mount() {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = {
    tree: null as ReactNode,
    render() { frame.cursor = 0; hooks.frame = frame; try { app.tree = MassVolumeInvestigationLab(); } finally { hooks.frame = null; } frame.effects.splice(0).forEach(effect => effect()); },
    button(label: string) { const button = walk(app.tree).find(node => node.type === 'button' && text(node) === label); expect(button, label).toBeDefined(); return button!; },
    click(label: string) { const button = app.button(label); expect(button.props.disabled, label).not.toBe(true); (button.props.onClick as () => void)(); app.render(); },
    next() { const lab = app.tree as Element; expect(lab.props.actionDisabled).toBe(false); (lab.props.onToggle as () => void)(); app.render(); },
    get snapshot(): HarnessApparatusSnapshot { return hooks.publish.mock.calls.at(-1)![0]; },
    reading(id: string) { return app.snapshot.readings.find(entry => entry.id === id)?.value; },
    apparatus(id: string) { return app.snapshot.apparatus.find(entry => entry.id === id)?.value; },
    get display() { const balance = walk(app.tree).find(node => node.props.className === 'mv-digital-balance'); return text(walk(balance).find(node => node.type === 'strong')); },
    get history() { const ledger = walk(app.tree).find(node => node.props.className === 'mv-evidence-ledger'); return walk(ledger).filter(node => node.type === 'div' && node !== ledger).map(row => (row.props.children as ReactNode[]).map(text)); },
  };
  app.render(); return app;
}
function firstMeasurement(app: ReturnType<typeof mount>) { app.click('第一次清零'); app.click('切取样品'); app.click('第一次称量'); }
function completeWeighing(app: ReturnType<typeof mount>) { firstMeasurement(app); app.click('取下样品'); app.click('再次清零'); app.click('独立复称'); }
beforeEach(() => { hooks.record.mockReset(); hooks.publish.mockReset(); });

describe('mass–volume live pan readings and retained independent measurements', () => {
  it('shows an empty zeroed pan during preparation while preserving the original operation gates', () => {
    const app = mount();
    expect(app.display).toBe('0.0 g'); expect(app.reading('current-balance')).toBe(0); expect(app.apparatus('sample-on-pan')).toBe(false);
    expect(app.reading('first-mass')).toBeNull(); expect(app.reading('second-mass')).toBeNull();
    for (const label of ['切取样品', '第一次称量', '取下样品', '再次清零', '独立复称', '保存正式描点']) expect(app.button(label).props.disabled).toBe(true);
    app.click('第一次清零'); expect(app.display).toBe('0.0 g');
    app.click('切取样品'); expect(app.display).toBe('0.0 g'); expect(app.apparatus('sample-on-pan')).toBe(false);
    expect(app.button('第一次称量').props.disabled).toBe(false); expect(app.button('独立复称').props.disabled).toBe(true);
  });

  it('unloads and re-zeroes to 0.0 g without erasing the 54.0 g first observation or changing the 54.05 g average', () => {
    const app = mount(); firstMeasurement(app);
    expect(app.display).toBe('54.0 g'); expect(app.reading('current-balance')).toBe(54); expect(app.apparatus('sample-on-pan')).toBe(true);
    app.click('取下样品'); expect(app.display).toBe('0.0 g'); expect(app.reading('current-balance')).toBe(0); expect(app.apparatus('sample-on-pan')).toBe(false);
    expect(app.reading('first-mass')).toBe(54); expect(app.reading('second-mass')).toBeNull(); expect(app.reading('average-mass')).toBeNull();
    expect(app.button('独立复称').props.disabled).toBe(true); expect(app.button('保存正式描点').props.disabled).toBe(true);
    app.click('再次清零'); expect(app.display).toBe('0.0 g'); expect(app.reading('first-mass')).toBe(54);
    app.click('独立复称'); expect(app.display).toBe('54.1 g'); expect(app.apparatus('sample-on-pan')).toBe(true);
    expect(app.reading('first-mass')).toBe(54); expect(app.reading('second-mass')).toBeCloseTo(54.1);
    expect(app.reading('average-mass')).toBeCloseTo(54.05); expect(app.reading('ratio')).toBeCloseTo(2.7025);
    app.click('保存正式描点'); expect(app.history).toEqual([['20', '54.0', '54.1', '54.05', '2.702']]);
  });

  it('applies the same pan lifecycle through the main next-step control', () => {
    const app = mount();
    const displays: string[] = [];
    for (let step = 0; step < 6; step++) { app.next(); displays.push(app.display); }
    expect(displays).toEqual(['0.0 g', '0.0 g', '54.0 g', '0.0 g', '0.0 g', '54.1 g']);
    expect((app.tree as Element).props.actionDisabled).toBe(true);
    app.click('保存正式描点'); expect(app.reading('average-mass')).toBeCloseTo(54.05); expect(app.history).toHaveLength(1);
  });

  it.each([['硬木', 10, 8, 8.1, 8.05, .805], ['塑料', 80, 96, 96.1, 96.05, 1.200625]] as const)('preserves quantized repeat readings for %s at %s cm³', (name, volume, first, second, average, ratio) => {
    const app = mount(); app.click(`${name}0点`); app.click(String(volume)); completeWeighing(app);
    expect(app.display).toBe(`${second.toFixed(1)} g`); expect(app.reading('first-mass')).toBeCloseTo(first); expect(app.reading('second-mass')).toBeCloseTo(second);
    expect(app.reading('average-mass')).toBeCloseTo(average); expect(app.reading('ratio')).toBeCloseTo(ratio);
    app.click('保存正式描点'); expect(app.history).toEqual([[String(volume), first.toFixed(1), second.toFixed(1), average.toFixed(2), ratio.toFixed(3)]]);
    app.click('重做当前体积'); expect(app.display).toBe('0.0 g'); expect(app.apparatus('sample-on-pan')).toBe(false);
    expect(app.reading('first-mass')).toBeNull(); expect(app.reading('second-mass')).toBeNull(); expect(app.history).toHaveLength(1);
  });

  it('shows the deliberately offset load without overwriting captured readings or the saved formal point', () => {
    const app = mount(); completeWeighing(app); app.click('保存正式描点'); const history = app.history;
    app.click('制造未清零异常点'); expect(app.display).toBe('54.5 g'); expect(app.reading('current-balance')).toBe(54.5);
    expect(app.reading('first-mass')).toBe(54); expect(app.reading('second-mass')).toBeCloseTo(54.1); expect(app.reading('average-mass')).toBeCloseTo(54.05);
    expect(app.button('先恢复规范零点').props.disabled).toBe(true);
    // Even a direct invocation of the disabled action cannot record the anomaly.
    (app.button('先恢复规范零点').props.onClick as () => void)(); app.render(); expect(app.history).toEqual(history);
    expect(hooks.record.mock.calls.filter(([, event]) => event.control === '保存复称描点')).toHaveLength(1);
    app.click('恢复规范零点'); expect(app.display).toBe('54.1 g'); expect(app.reading('current-balance')).toBeCloseTo(54.1); expect(app.history).toEqual(history);
    app.click('更新正式描点'); expect(app.history).toEqual(history);
  });

  it('still completes a three-volume comparison after zero-offset diagnosis and preserves the dataset across resets and material changes', () => {
    const app = mount();
    for (const volume of [20, 40, 60]) {
      app.click(String(volume)); completeWeighing(app);
      if (volume === 20) { app.click('制造未清零异常点'); app.click('恢复规范零点'); }
      app.click('保存正式描点'); expect(app.snapshot.validity.ready).toBe(volume === 60);
    }
    const history = app.history;
    expect(history.map(row => row.slice(0, 4))).toEqual([['20', '54.0', '54.1', '54.05'], ['40', '108.0', '108.1', '108.05'], ['60', '162.0', '162.1', '162.05']]);
    app.click('重做当前体积'); expect(app.display).toBe('0.0 g'); expect(app.reading('average-mass')).toBeNull(); expect(app.history).toEqual(history);
    app.click('塑料0点'); expect(app.history).toEqual([]); expect(app.snapshot.validity.ready).toBe(false); expect(app.display).toBe('0.0 g');
    app.click('铝3点'); expect(app.history).toEqual(history); expect(app.display).toBe('0.0 g'); expect(app.apparatus('sample-on-pan')).toBe(false);
  });
});
