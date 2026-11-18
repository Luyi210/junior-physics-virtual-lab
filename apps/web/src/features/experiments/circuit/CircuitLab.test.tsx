import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { HarnessApparatusSnapshot } from '@physics-lab/harness';
import { CircuitLab } from './CircuitLab';

type Slot = { value?: unknown; deps?: readonly unknown[] };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn(), publish: vi.fn() }));
// Execute the real wiring, observation, protection and recovery callbacks; no browser claim.
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
    render() { frame.cursor = 0; hooks.frame = frame; try { app.tree = CircuitLab(); } finally { hooks.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); },
    button(label: string) { const button = walk(app.tree).find((node) => node.type === 'button' && text(node).includes(label)); expect(button, label).toBeDefined(); return button!; },
    click(label: string) { const button = app.button(label); expect(button.props.disabled, label).not.toBe(true); (button.props.onClick as () => void)(); app.render(); },
    terminal(label: string) { return walk(app.tree).find((node) => node.props['aria-label'] === label)!; },
    connect(a: string, b: string) { for (const label of [a, b]) { (app.terminal(label).props.onClick as (event: unknown) => void)({ stopPropagation() {} }); app.render(); } },
    power() { const lab = app.tree as Element; expect(lab.props.actionDisabled).toBe(false); (lab.props.onToggle as () => void)(); app.render(); },
    lamp(action: '旋松' | '旋紧') { const lamp = app.terminal(`${action}灯泡 L1`); expect(lamp).toBeDefined(); (lamp.props.onClick as () => void)(); app.render(); },
    voltage(value: number) { const range = walk(app.tree).find((node) => node.props.label === '电源电压')!; (range.props.onChange as (value: number) => void)(value); app.render(); },
    get snapshot(): HarnessApparatusSnapshot { return hooks.publish.mock.calls.at(-1)![0]; },
    apparatus(id: string) { return app.snapshot.apparatus.find((entry) => entry.id === id)?.value; },
    reading(id: string) { return app.snapshot.readings.find((entry) => entry.id === id)?.value; },
    control(id: string) { return app.snapshot.controls.find((entry) => entry.id === id)?.value; },
    get compared() { return app.snapshot.derived.find((entry) => entry.id === 'topology-comparison')?.value; },
    get displayedVoltage() { return text(walk(app.tree).find((node) => node.props.className === 'battery-reading')); },
    get ledger() { return text(walk(app.tree).find((node) => node.props.className === 'circuit-comparison-ledger')); },
  };
  app.render(); return app;
}
function wire(app: ReturnType<typeof mount>, topology: 'series' | 'parallel') {
  const pairs = topology === 'series'
    ? [['电源正极', '开关左端'], ['开关右端', '灯泡 L₁ 左端'], ['灯泡 L₁ 右端', '灯泡 L₂ 左端'], ['灯泡 L₂ 右端', '电源负极']]
    : [['电源正极', '开关左端'], ['开关右端', '灯泡 L₁ 左端'], ['开关右端', '灯泡 L₂ 左端'], ['灯泡 L₁ 右端', '电源负极'], ['灯泡 L₂ 右端', '电源负极']];
  for (const [a, b] of pairs) app.connect(a!, b!);
}
function compare(app: ReturnType<typeof mount>, finalTopology: 'series' | 'parallel' = 'parallel') {
  for (const topology of finalTopology === 'parallel' ? ['series', 'parallel'] as const : ['parallel', 'series'] as const) {
    app.click(topology === 'series' ? '串联接线' : '并联接线'); wire(app, topology); app.power();
    app.click('保存当前正常读数'); app.lamp('旋松'); app.lamp('旋紧'); app.power();
  }
  expect(app.compared).toBe(true);
}
function terminalPoint(element: Element) {
  const circle = walk(element.props.children as ReactNode).find((node) => node.type === 'circle')!;
  return [circle.props.cx, circle.props.cy];
}
beforeEach(() => { hooks.record.mockReset(); hooks.publish.mockReset(); });

describe('switch-controlled protected short-circuit drill', () => {
  it('still requires both normal measurements and real lamp disconnection observations', () => {
    const app = mount(); expect(app.button('安装保护短路线').props.disabled).toBe(true);
    wire(app, 'series'); app.power(); app.click('保存当前正常读数'); app.power();
    app.click('并联接线'); wire(app, 'parallel'); app.power(); app.click('保存当前正常读数'); app.power();
    expect(app.compared).toBe(false); expect(app.button('安装保护短路线').props.disabled).toBe(true);
  });

  it.each(['series', 'parallel'] as const)('puts the %s fault downstream of the switch and completes protection without changing the 6 V evidence', (topology) => {
    const app = mount(); app.voltage(6); compare(app, topology);
    const savedLedger = app.ledger;
    expect(savedLedger).toContain('I总 0.20 A'); expect(savedLedger).toContain('I总 0.90 A');
    expect(app.displayedVoltage).toBe('6.0 V');
    app.power(); expect(app.button('安装保护短路线').props.disabled).toBe(true); app.power();
    app.click('安装保护短路线');
    const short = walk(app.tree).find((node) => node.props.className === 'bench-short-wire')!;
    const path = walk(short.props.children as ReactNode).find((node) => node.type === 'path')!;
    const coordinates = String(path.props.d).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const start = coordinates.slice(0, 2);
    const end = [coordinates.at(-1), coordinates.at(-2)]; // final vertical/horizontal segments
    expect(start).toEqual(terminalPoint(app.terminal('开关右端')));
    expect(start).not.toEqual(terminalPoint(app.terminal('电源正极')));
    expect(end).toEqual(terminalPoint(app.terminal('电源负极')));
    expect(app.displayedVoltage).toBe('9.0 V'); expect(text(app.tree)).toContain('9V保护训练源');
    expect(app.control('voltage')).toBe(6); expect(app.control('active-supply-voltage')).toBe(9);
    expect(app.apparatus('switch-closed')).toBe(false); expect(app.apparatus('fuse')).toBe(false);
    expect(app.reading('total-current')).toBe(0); expect(app.snapshot.validity.ready).toBe(false);
    app.power();
    expect(app.apparatus('fuse')).toBe(true); expect(app.apparatus('switch-closed')).toBe(false);
    expect(app.reading('short-prospective')).toBe(11.25);
    expect(app.reading('total-current')).toBe(0); expect(app.reading('current1')).toBe(0); expect(app.reading('current2')).toBe(0);
    expect((app.tree as Element).props.actionDisabled).toBe(true);
    expect(app.button('更换保险并复位').props.disabled).toBe(true);
    app.click('拆除短路线');
    expect(app.button('安装保护短路线').props.disabled).toBe(true); expect(app.displayedVoltage).toBe('9.0 V');
    app.click('更换保险并复位');
    expect(app.displayedVoltage).toBe('6.0 V'); expect(app.control('active-supply-voltage')).toBe(6);
    expect(app.apparatus('training-source')).toBe(false); expect(app.ledger).toBe(savedLedger);
    expect(app.snapshot.validity.ready).toBe(true);
    app.power(); expect(app.reading('total-current')).toBeCloseTo(topology === 'series' ? .2 : .9, 12);
  });

  it('can remove an unenergized fault and return to the normal source without claiming a protection observation', () => {
    const app = mount(); app.voltage(6); compare(app); app.click('安装保护短路线'); app.click('拆除短路线');
    expect(app.displayedVoltage).toBe('6.0 V'); expect(app.apparatus('fuse')).toBe(false);
    expect(app.snapshot.validity.ready).toBe(false); expect(app.reading('short-prospective')).toBeNull();
    expect(text(app.tree)).not.toContain('现在可以更换保险并复位。');
    expect(app.button('更换保险并复位').props.disabled).toBe(true);
  });

  it.each([false, true])('allows safe dismantling after changed normal parameters clear the evidence (tripped=%s)', (tripped) => {
    const app = mount(); compare(app); app.click('安装保护短路线'); if (tripped) app.power();
    app.voltage(7); expect(app.compared).toBe(false); expect(app.displayedVoltage).toBe('9.0 V');
    expect(app.button('拆除短路线').props.disabled).toBe(false); app.click('拆除短路线');
    if (tripped) app.click('更换保险并复位');
    expect(app.displayedVoltage).toBe('7.0 V'); expect(app.button('安装保护短路线').props.disabled).toBe(true);
    compare(app); expect(app.button('安装保护短路线').props.disabled).toBe(false);
    expect(app.control('voltage')).toBe(7);
  });
});
