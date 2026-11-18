import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { HarnessApparatusSnapshot } from '@physics-lab/harness';
import { LiquidDensityLab } from './LiquidDensityLab';

type Slot = { value?: unknown; deps?: readonly unknown[] };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn(), publish: vi.fn() }));
// Production component handlers and effects, with in-memory hooks; this is not a DOM test.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => {
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useEffect: (effect: () => void, deps?: readonly unknown[]) => {
      const item = slot();
      if (!item.deps || !deps || deps.some((value, i) => !Object.is(value, item.deps![i]))) { item.deps = deps; hooks.frame!.effects.push(effect); }
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
    render() { frame.cursor = 0; hooks.frame = frame; try { app.tree = LiquidDensityLab(); } finally { hooks.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); },
    button(label: string) { const button = walk(app.tree).find((node) => node.type === 'button' && text(node).includes(label)); expect(button, label).toBeDefined(); return button!; },
    click(label: string) { const button = app.button(label); expect(button.props.disabled, label).not.toBe(true); (button.props.onClick as () => void)(); app.render(); },
    transfer() { const frame = app.tree as Element; expect(frame.props.actionDisabled).toBe(false); (frame.props.onToggle as () => void)(); app.render(); },
    get snapshot(): HarnessApparatusSnapshot { return hooks.publish.mock.calls.at(-1)![0]; },
    reading(id: string) { return app.snapshot.readings.find((entry) => entry.id === id)?.value; },
    apparatus(id: string) { return app.snapshot.apparatus.find((entry) => entry.id === id)?.value; },
    get output() { return text(walk(app.tree).find((node) => node.type === 'output')); },
    get cupFilled() { return walk(app.tree).some((node) => node.props.className === 'liquid-beaker-on-scale filled'); },
    get history() { return walk(app.tree).filter((node) => node.props.className === 'liquid-density-row').map((row) => (row.props.children as ReactNode[]).map(text)); },
  };
  app.render(); return app;
}
function prepare(app: ReturnType<typeof mount>, liquid = '清水样品', volume = 100) {
  app.click(liquid); app.click(`${volume} mL`); app.click('称量空烧杯 m₁'); app.click('向烧杯加入液体'); app.click('称量总质量 m₂');
}
function readAndSave(app: ReturnType<typeof mount>) {
  app.transfer(); app.click('平视'); app.click('记录液体体积 V'); app.click('代入差量公式');
  app.click('烧杯残留 5% 液体'); app.click('俯视使体积多读 2 mL'); app.click('保存本次结果');
}
beforeEach(() => { hooks.record.mockReset(); hooks.publish.mockReset(); });

describe('liquid transfer and retained measurement readings', () => {
  it('starts with both cup illustrations empty and keeps transfer unavailable before weighing', () => {
    const app = mount();
    expect(app.cupFilled).toBe(false); expect(app.apparatus('filled')).toBe(false);
    const transfer = walk(app.tree).find((node) => String(node.props.className ?? '').startsWith('transfer-beaker'))!;
    expect((transfer.props.children as Element).props.style).toEqual({ height: '0%' });
    expect((app.tree as Element).props.actionDisabled).toBe(true);
    expect(app.output).toBe('— — g'); expect(app.reading('m1')).toBeNull(); expect(app.reading('m2')).toBeNull();
  });

  it.each([['酒精样品', .8], ['清水样品', 1], ['盐水样品', 1.2]] as const)('transfers %s completely while retaining the two original weighing readings', (name, density) => {
    const app = mount(); prepare(app, name);
    const total = 50 + 100 * density;
    expect(app.output).toBe(`${total.toFixed(1)} g`); expect(app.cupFilled).toBe(true);
    app.transfer();
    expect(app.cupFilled).toBe(false); expect(app.apparatus('filled')).toBe(false); expect(app.apparatus('transferred')).toBe(true);
    expect(app.output).toBe('50.0 g'); expect(app.reading('current-balance')).toBe(50);
    expect(app.reading('m1')).toBe(50); expect(app.reading('m2')).toBe(total);
    app.click('平视'); app.click('记录液体体积 V'); app.click('代入差量公式');
    expect(app.reading('density')).toBe(density);
    app.click('烧杯残留 5% 液体'); app.click('俯视使体积多读 2 mL'); app.click('保存本次结果');
    expect(app.history).toEqual([[name, '50.0', total.toFixed(1), (100 * density).toFixed(1), '100', density.toFixed(2)]]);
    // Returning the same sample restores the live load, not a new mass measurement.
    app.transfer(); expect(app.cupFilled).toBe(true); expect(app.output).toBe(`${total.toFixed(1)} g`);
    expect(app.reading('m2')).toBe(total); expect(app.reading('volume')).toBeNull(); expect(app.reading('density')).toBeNull();
    expect(app.history).toHaveLength(1);
  });

  it('preserves saved mass differences when a second volume is independently measured', () => {
    const app = mount(); prepare(app, '清水样品', 80); readAndSave(app);
    expect(app.snapshot.validity.ready).toBe(false); expect(app.history[0]).toEqual(['清水样品', '50.0', '130.0', '80.0', '80', '1.00']);
    app.click('清水样品'); app.click('120 mL');
    expect(app.reading('m1')).toBeNull(); expect(app.reading('m2')).toBeNull(); expect(app.history).toHaveLength(1);
    app.click('称量空烧杯 m₁'); app.click('向烧杯加入液体'); app.click('称量总质量 m₂'); readAndSave(app);
    expect(app.snapshot.validity.ready).toBe(true); expect(app.output).toBe('50.0 g');
    expect(app.history).toEqual([
      ['清水样品', '50.0', '170.0', '120.0', '120', '1.00'],
      ['清水样品', '50.0', '130.0', '80.0', '80', '1.00'],
    ]);
    app.click('盐水样品'); expect(app.snapshot.validity.ready).toBe(false); expect(app.history).toHaveLength(2);
  });

  it('keeps the original weighing until a reset and requires both error diagnoses before saving', () => {
    const app = mount(); prepare(app); expect(app.button('80 mL').props.disabled).toBe(true);
    app.transfer(); app.click('平视'); app.click('记录液体体积 V'); app.click('代入差量公式');
    expect(app.button('保存本次结果').props.disabled).toBe(true);
    app.click('烧杯残留 5% 液体'); expect(app.button('保存本次结果').props.disabled).toBe(true);
    app.click('俯视使体积多读 2 mL'); app.click('保存本次结果');
    expect(app.button('保存本次结果').props.disabled).toBe(true); expect(app.history).toHaveLength(1);
    app.transfer(); app.transfer(); app.click('记录液体体积 V'); app.click('代入差量公式');
    expect(app.reading('m2')).toBe(150); expect(app.reading('density')).toBe(1);
    expect(app.button('保存本次结果').props.disabled).toBe(true);
  });
});
