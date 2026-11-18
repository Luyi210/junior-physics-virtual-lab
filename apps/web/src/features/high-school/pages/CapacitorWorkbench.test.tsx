import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { highSchoolExperiment } from '@physics-lab/physics/high-school';
import type { LiliExperimentContext } from '@physics-lab/contracts';
import type { HighSchoolRecordScope } from '../../../data/highSchoolRecordScope';
import { HighSchoolWorkbench } from './HighSchoolExperimentPage';
import { CapacitorSwitchControl } from '../components/CapacitorSwitchControl';
import { ExperimentViewport } from '../components/ExperimentViewport';
import { getScopedMeasurementStore } from '../experiments/measurementStorage';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, time: 0, running: false, duration: 0, writable: true, context: null as LiliExperimentContext | null }));
// Actual workbench callbacks + model + storage; only React lifecycle and clock are
// explicit doubles. This does not claim browser/WebGL/gesture verification.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (item: Slot, deps?: readonly unknown[]) => !deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]));
  function memo(factory: () => unknown, deps?: readonly unknown[]) { const item = slot(); if (changed(item, deps)) { item.value = factory(); item.deps = deps; } return item.value; }
  return { ...actual,
    useState: (initial: unknown) => { if (!harness.frame) return actual.useState(initial); const item = slot(); if (!('value' in item)) item.value = typeof initial === 'function' ? initial() : initial; return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }]; },
    useMemo: (factory: () => unknown, deps?: readonly unknown[]) => harness.frame ? memo(factory, deps) : actual.useMemo(factory, deps ?? []),
    useCallback: (callback: (...args: never[]) => unknown, deps?: readonly unknown[]) => harness.frame ? memo(() => callback, deps) : actual.useCallback(callback, deps ?? []),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (!harness.frame) return actual.useEffect(effect, deps); const item = slot(); if (changed(item, deps)) { item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
  };
});
vi.mock('../experiments/useExperimentClock', () => ({ useExperimentClock: (duration: number) => {
  harness.duration = duration;
  return { time: harness.time, running: harness.running,
    reset() { harness.time = 0; harness.running = false; },
    toggle() { if (!harness.running && harness.time >= duration) harness.time = 0; harness.running = !harness.running; },
    step() { harness.running = false; harness.time = Math.min(duration, harness.time + 1 / 60); },
  };
} }));
vi.mock('../../../data/highSchoolContext', () => ({ publishHighSchoolContext: (context: LiliExperimentContext | null) => { harness.context = context; return true; } }));
vi.mock('../../../data/highSchoolRecordScope', async (original) => ({ ...await original<typeof import('../../../data/highSchoolRecordScope')>(), isCurrentHighSchoolRecordScope: () => harness.writable }));
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ''; }
function button(tree: ReactNode, label: string) { const found = walk(tree).find((node) => node.type === 'button' && (text(node).includes(label) || node.props['aria-label'] === label)); expect(found, label).toBeDefined(); return found!; }
function click(node: Element) { (node.props.onClick as () => void)(); }
let storage: Storage; const cleanups: Array<() => void> = [];
beforeEach(() => {
  harness.time = 0; harness.running = false; harness.writable = true; harness.context = null;
  const entries = new Map<string, string>();
  storage = { get length() { return entries.size; }, key: (i) => [...entries.keys()][i] ?? null, getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: (key) => { entries.delete(key); }, clear: () => entries.clear() };
  vi.stubGlobal('window', { localStorage: storage, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });
function mount() {
  const scope: HighSchoolRecordScope = { key: crypto.randomUUID(), mode: 'guest', label: 'test', canWrite: true, authChannel: null, revision: 1 };
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode, scope,
    render(time = harness.time) { harness.time = time; frame.cursor = 0; harness.frame = frame; try { app.tree = HighSchoolWorkbench({ definition: highSchoolExperiment('capacitor-charge'), scope }); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; },
    control() { return walk(app.tree).find((node) => node.type === CapacitorSwitchControl)!; },
    viewport() { return walk(app.tree).find((node) => node.type === ExperimentViewport)!; },
    switch(mode: string) { (app.control().props.onModeChange as (mode: string) => void)(mode); app.render(); },
    get state() { return (app.control().props.simulation as { state: Record<string, number> }).state; },
    records() { return getScopedMeasurementStore('capacitor-charge', scope.key).read().records; },
  };
  cleanups.push(() => frame.slots.forEach((slot) => slot.cleanup?.())); app.render(); return app;
}
describe('capacitor actual workbench operation chain', () => {
  it('continues charge → open → discharge without resetting time, U, Q or stored energy', () => {
    const app = mount(); app.render(2); const charged = { ...app.state }; app.switch('open');
    expect(harness.time).toBe(2); expect(app.state.voltage).toBe(charged.voltage); expect(app.state.charge).toBe(charged.charge);
    app.render(4); expect(app.state.current).toBe(0); expect(app.state.storedEnergy).toBe(charged.storedEnergy);
    app.switch('discharge'); expect(app.state.voltage).toBe(charged.voltage); expect(app.state.current).toBeLessThan(0);
    app.render(5); expect(app.state.voltage).toBeLessThan(charged.voltage);
    click(button(app.tree, '记录这组读数')); app.render();
    expect(app.records()[0]!.capacitorHistory?.segments).toEqual([{ startTimeSeconds: 0, mode: 'charge' }, { startTimeSeconds: 2, mode: 'open' }, { startTimeSeconds: 4, mode: 'discharge' }]);
    expect(harness.context?.samples?.[0]?.capacitorHistory).toEqual(app.records()[0]!.capacitorHistory);
    expect(harness.context?.capacitorHistory).toEqual(app.records()[0]!.capacitorHistory);
  });
  it('pause/resume leaves the switch history intact and viewport uses the same switch callback', () => {
    const app = mount(); app.render(1); click(button(app.tree, '播放实验')); app.render();
    const history = structuredClone(harness.context!.capacitorHistory); click(button(app.tree, '暂停实验')); app.render();
    expect(harness.running).toBe(false); expect(harness.context!.capacitorHistory).toEqual(history);
    (app.viewport().props.onCapacitorModeChange as (mode: string) => void)('open'); app.render();
    expect(app.control().props.mode).toBe('open'); expect(app.viewport().props.capacitorMode).toBe('open'); expect(app.state.current).toBe(0);
  });
  it('changing a parameter starts a new zero-voltage run and preserves the saved old run', () => {
    const app = mount(); app.render(2); app.switch('open'); click(button(app.tree, '记录这组读数')); app.render();
    const saved = structuredClone(app.records()[0]!); const oldRun = harness.context!.capacitorHistory!.runId;
    (app.viewport().props.onParametersChange as (patch: Record<string, number>) => void)({ resistanceKOhm: 5 }); app.render();
    expect(harness.time).toBe(0); expect(app.state.voltage).toBe(0); expect(app.control().props.mode).toBe('charge');
    expect(harness.context!.capacitorHistory!.runId).not.toBe(oldRun); expect(app.records()[0]).toEqual(saved);
    expect(harness.context!.samples![0]!.parameters.resistanceKOhm).toBe(10); expect(harness.context!.parameters.resistanceKOhm).toBe(5);
  });
  it.each(['重新计时', 'end-play'])('starts a fresh run on %s and never replays a future switch at t=0', (action) => {
    const app = mount(); app.render(2); app.switch('open'); const oldRun = harness.context!.capacitorHistory!.runId;
    if (action === 'end-play') { app.render(harness.duration); click(button(app.tree, '播放实验')); } else click(button(app.tree, action));
    app.render(); expect(harness.time).toBe(0); expect(app.state.voltage).toBe(0);
    expect(harness.context!.capacitorHistory!.runId).not.toBe(oldRun);
    expect(harness.context!.capacitorHistory!.segments).toEqual([{ startTimeSeconds: 0, mode: 'charge' }]);
  });
  it('does not save to the former archive after ownership becomes unwritable', () => {
    const app = mount(); app.render(2); const save = button(app.tree, '记录这组读数'); harness.writable = false; click(save); app.render();
    expect(app.records()).toEqual([]); expect(text(app.tree)).toContain('档案身份已变化');
  });
});
