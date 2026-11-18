import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { HarnessApparatusSnapshot } from '@physics-lab/harness';
import { BalanceMeasurementLab } from './BalanceMeasurementLab';

type Slot = { value?: unknown; deps?: readonly unknown[] };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn(), publish: vi.fn() }));
// Actual component callbacks and snapshot effects; no browser rendering claim.
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
    render() { frame.cursor = 0; hooks.frame = frame; try { app.tree = BalanceMeasurementLab(); } finally { hooks.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); },
    button(label: string) { const button = walk(app.tree).find((node) => node.type === 'button' && text(node) === label); expect(button, label).toBeDefined(); return button!; },
    click(label: string) { const button = app.button(label); expect(button.props.disabled).not.toBe(true); (button.props.onClick as () => void)(); app.render(); },
    rider(value: number) { const input = walk(app.tree).find((node) => node.props['aria-label'] === '移动游码')!; (input.props.onChange as (event: unknown) => void)({ target: { value: String(value) } }); app.render(); },
    get snapshot(): HarnessApparatusSnapshot { return hooks.publish.mock.calls.at(-1)![0]; },
    get guidance() { return app.snapshot.derived.find((item) => item.id === 'guidance')?.value; },
    get stage() { return app.snapshot.derived.find((item) => item.id === 'stage')?.value; },
    get calibrated() { return app.snapshot.apparatus.find((item) => item.id === 'calibrated')?.value; },
  };
  app.render(); return app;
}
function level(app: ReturnType<typeof mount>, direction = '← 向左调', times = 8) { app.rider(0); for (let i = 0; i < times; i++) app.click(direction); }
function weigh(app: ReturnType<typeof mount>) {
  app.click('把金属块放入左盘'); app.click('拿起砝码镊子');
  for (const mass of [100, 20, 10, 5]) app.click(`${mass}g`);
  app.rider(2.5);
}
beforeEach(() => { hooks.record.mockReset(); hooks.publish.mockReset(); vi.stubGlobal('window', { sessionStorage: { getItem: () => '1', setItem: vi.fn() } }); });
afterEach(() => vi.unstubAllGlobals());

describe('balance calibration and weighing phases', () => {
  it('keeps empty-pan zeroing required before loading and invalidates it when an unloaded rider moves', () => {
    const app = mount(); expect(app.calibrated).toBe(false); expect(app.stage).toBe(1);
    expect(app.button('完成调平后解锁').props.disabled).toBe(true);
    for (let i = 0; i < 8; i++) app.click('← 向左调');
    expect(app.calibrated).toBe(false); app.rider(0); expect(app.stage).toBe(2);
    app.rider(.1); expect(app.calibrated).toBe(false); expect(app.guidance).toContain('先把游码');
  });

  it('retains completed calibration during loaded rider adjustment and reports the correct final mass', () => {
    const app = mount(); level(app); weigh(app);
    expect(app.calibrated).toBe(true); expect(app.stage).toBe(4);
    expect(app.guidance).toContain('砝码总质量加游码示数'); expect(app.guidance).not.toContain('先把游码');
    expect(app.snapshot.readings.find((item) => item.id === 'measured-mass')?.value).toBe(137.5);
    expect(app.button('← 向左调').props.disabled).toBe(true);
    app.click('保存本次读数'); expect(text(app.tree)).toContain('137.5 g');
    expect(app.snapshot.validity.ready).toBe(false);
  });

  it('continues weighing guidance on either side of balance without asking for re-zeroing', () => {
    const app = mount(); level(app); weigh(app); app.rider(1.5);
    expect(app.calibrated).toBe(true); expect(app.stage).toBe(3); expect(app.guidance).toContain('移动游码');
    app.rider(3.5); expect(app.stage).toBe(3); expect(app.guidance).toContain('右盘偏重');
    expect(app.button('保存本次读数').props.disabled).toBe(true);
  });

  it('requires independent re-zeroing on repetition and keeps the first saved observation', () => {
    const app = mount(); level(app); weigh(app); app.click('保存本次读数'); app.click('重新独立称量');
    expect(app.calibrated).toBe(false); expect(app.stage).toBe(1); expect(app.snapshot.validity.ready).toBe(false);
    expect(text(app.tree)).toContain('137.5 g'); level(app, '向右调 →', 7); weigh(app); app.click('保存本次读数');
    expect(app.snapshot.validity.ready).toBe(true);
    expect(hooks.record.mock.calls.filter(([, event]) => event.control === '保存独立称量').map(([, event]) => event.value)).toEqual([137.5, 137.5]);
    app.click('重新开始'); expect(app.calibrated).toBe(false); expect(app.stage).toBe(1); expect(app.snapshot.validity.ready).toBe(false);
  });
});
