import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { HarnessApparatusSnapshot } from '@physics-lab/harness';
import { ThermometerLab } from './ThermometerLab';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; deferred: Array<() => void>; mounted: boolean; setters: number };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, deferUpdates: false, record: vi.fn(), publish: vi.fn() }));
// Actual component event callbacks/effects with fake time. This adapter runs effect
// cleanup and can suspend an already-enqueued functional updater until after a new
// interaction commits. It is not a DOM test or an emulation of React's scheduler.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => {
      const frame = hooks.frame!; const item = slot();
      if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => {
        frame.setters++;
        const apply = () => { if (frame.mounted) item.value = typeof next === 'function' ? next(item.value) : next; };
        if (hooks.deferUpdates && typeof next === 'function') frame.deferred.push(apply); else apply();
      }];
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const item = slot();
      if (!item.deps || !deps || item.deps.length !== deps.length || deps.some((value, i) => !Object.is(value, item.deps![i]))) {
        item.deps = deps;
        hooks.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});
vi.mock('../../assistant/harnessStore', () => ({ useHarnessStore: (select: (state: { record: typeof hooks.record }) => unknown) => select({ record: hooks.record }) }));
vi.mock('../../assistant/tutorialBridge', () => ({ publishApparatusSnapshot: (value: HarnessApparatusSnapshot) => hooks.publish(value) }));

type Element = ReactElement<Record<string, unknown>>;
const intervalCallbacks: Array<() => void> = [];
const mountedApps: Array<{ unmount: () => void }> = [];
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
  const frame: Frame = { slots: [], cursor: 0, effects: [], deferred: [], mounted: true, setters: 0 };
  const app = {
    tree: null as ReactNode,
    render() {
      expect(frame.mounted).toBe(true); frame.cursor = 0; hooks.frame = frame;
      try { app.tree = ThermometerLab(); } finally { hooks.frame = null; }
      frame.effects.splice(0).forEach(effect => effect());
    },
    button(label: string) {
      const button = walk(app.tree).find(node => node.type === 'button' && (text(node) === label || walk(node.props.children as ReactNode).some(child => (child.type === 'strong' || child.type === 'b') && text(child) === label)));
      expect(button, label).toBeDefined(); return button!;
    },
    invoke(label: string) { (app.button(label).props.onClick as () => void)(); app.render(); },
    click(label: string) { expect(app.button(label).props.disabled, label).not.toBe(true); app.invoke(label); },
    toggle() { const lab = app.tree as Element; expect(lab.props.actionDisabled).toBe(false); (lab.props.onToggle as () => void)(); app.render(); },
    tick(count = 1) { for (let i = 0; i < count; i++) { vi.advanceTimersByTime(100); app.render(); } },
    deferTick() { hooks.deferUpdates = true; try { vi.advanceTimersByTime(100); } finally { hooks.deferUpdates = false; } expect(frame.deferred).toHaveLength(1); },
    flushDeferred() { frame.deferred.splice(0).forEach(apply => apply()); app.render(); },
    unmount() { if (!frame.mounted) return; frame.mounted = false; frame.slots.forEach(item => item.cleanup?.()); },
    get setterCount() { return frame.setters; },
    get snapshot(): HarnessApparatusSnapshot { return hooks.publish.mock.calls.at(-1)![0]; },
    reading(id: string) { return app.snapshot.readings.find(entry => entry.id === id)?.value; },
    apparatus(id: string) { return app.snapshot.apparatus.find(entry => entry.id === id)?.value; },
    derived(id: string) { return app.snapshot.derived.find(entry => entry.id === id)?.value; },
    get progress() { return app.apparatus('stable-progress'); },
    get column() { return app.derived('column-temperature'); },
    get stemStyle() { const stem = walk(app.tree).find(node => node.props.className === 'thermometer-stem')!; return (stem.props.children as Element[])[0].props.style as { height: string; transition: string }; },
    get readout() { const eye = walk(app.tree).find(node => String(node.props.className ?? '').startsWith('thermometer-eye-console')); return text(walk(eye).find(node => node.type === 'strong')); },
    get history() { return walk(app.tree).filter(node => node.props.className === 'thermometer-evidence-row').map(row => (row.props.children as ReactNode[]).map(text)); },
  };
  mountedApps.push(app); app.render(); return app;
}
type App = ReturnType<typeof mount>;
function prepare(sample = '温水') { const app = mount(); app.click('实验室温度计'); app.click(sample); app.click('正确浸入'); return app; }
function saveCurrent(app: App) { app.click('平视液柱末端'); app.click('俯视液柱末端'); app.click('仰视液柱末端'); app.click('保存本次测量'); }
function assertLabColumnAgrees(app: App) {
  // Decode the drawn column against the displayed lab instrument's -20..110℃ scale.
  const drawnTemperature = (Number.parseFloat(app.stemStyle.height) - 8) / 84 * 130 - 20;
  expect(drawnTemperature).toBeCloseTo(Number(app.column), 10);
  expect(app.stemStyle.transition).toBe('none');
}
beforeEach(() => {
  hooks.record.mockReset(); hooks.publish.mockReset(); hooks.deferUpdates = false;
  intervalCallbacks.length = 0; vi.useFakeTimers();
  vi.stubGlobal('window', {
    setInterval: (callback: () => void, delay: number) => { intervalCallbacks.push(callback); return globalThis.setInterval(callback, delay); },
    clearInterval: (timer: ReturnType<typeof setInterval>) => globalThis.clearInterval(timer),
  });
});
afterEach(() => { mountedApps.splice(0).forEach(app => app.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('thermometer response, valid readings and retained evidence', () => {
  it('does not move the column or expose the sample target when changing room water to warm water before immersion', () => {
    const app = mount(); app.click('实验室温度计'); app.click('室温水');
    const height = app.stemStyle.height; expect(app.column).toBe(24); expect(app.reading('visible')).toBeNull();
    app.click('温水'); app.tick(20);
    expect(app.stemStyle.height).toBe(height); expect(app.column).toBe(24); expect(app.progress).toBe(0);
    expect(app.reading('visible')).toBeNull(); expect(app.readout).toContain('等待正确浸入');
    expect(app.button('读取并记录温度').props.disabled).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });

  it.each([['温水', 57, 68], ['冰水混合物', 6, 0]] as const)('moves continuously from 24℃ toward %s with one source for the column, temporary readout and snapshot', (sample, halfway, target) => {
    const app = prepare(sample); app.click('平视');
    expect(app.column).toBe(24); expect(app.reading('visible')).toBe(24); assertLabColumnAgrees(app);
    app.tick(10); expect(app.progress).toBe(50); expect(app.column).toBeCloseTo(halfway);
    expect(app.reading('visible')).toBe(halfway); expect(app.readout).toBe(`示意约 ${halfway}℃（未稳定）`); assertLabColumnAgrees(app);
    app.tick(10); expect(app.progress).toBe(100); expect(app.column).toBe(target); expect(app.apparatus('stable')).toBe(true);
    expect(app.readout).toBe(`可见约 ${target}℃`); expect(app.reading('visible')).toBe(target); assertLabColumnAgrees(app);
    expect(vi.getTimerCount()).toBe(0); expect((app.tree as Element).props.running).toBe(false);
  });

  it('rejects formal capture even when the unstable rounded display already equals the final temperature', () => {
    const app = prepare(); app.click('平视'); app.tick(18);
    expect(app.progress).toBe(90); expect(Number(app.column)).toBeLessThan(68); expect(app.reading('visible')).toBe(68);
    for (const label of ['读取并记录温度', '平视液柱末端', '保存本次测量']) { expect(app.button(label).props.disabled).toBe(true); app.invoke(label); }
    expect(app.reading('recorded')).toBeNull(); expect(app.history).toEqual([]); expect(hooks.record).not.toHaveBeenCalled();
    app.tick(2); app.click('读取并记录温度'); expect(app.reading('recorded')).toBe(68);
  });

  it('pauses and resumes without a jump and rejects both an old cleaned-up callback and its already-queued updater', () => {
    const app = prepare(); app.tick(6); const progress = app.progress; const column = app.column; const height = app.stemStyle.height;
    const oldTick = intervalCallbacks.at(-1)!; app.deferTick(); app.toggle();
    expect(app.apparatus('response-running')).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(app.snapshot.validity.issues.join('')).toContain('继续'); app.tick(10);
    expect(app.progress).toBe(progress); expect(app.column).toBe(column); expect(app.stemStyle.height).toBe(height);
    app.toggle(); expect(app.column).toBe(column); expect(app.progress).toBe(progress);
    const setters = app.setterCount; oldTick(); expect(app.setterCount).toBe(setters);
    app.flushDeferred(); expect(app.progress).toBe(progress); expect(app.column).toBe(column);
    app.tick(); expect(app.progress).toBe(35); expect(Number(app.column)).toBeGreaterThan(Number(column));
  });

  it('rejects an old pending updater after a different sample starts a new response', () => {
    const app = prepare(); app.tick(10); const heldColumn = app.column;
    const oldTick = intervalCallbacks.at(-1)!; app.deferTick(); app.click('冰水混合物');
    expect(app.column).toBe(heldColumn); expect(app.progress).toBe(0); expect(app.reading('visible')).toBeNull();
    app.click('正确浸入'); const setters = app.setterCount; oldTick(); expect(app.setterCount).toBe(setters);
    app.flushDeferred(); expect(app.progress).toBe(0); expect(app.column).toBe(heldColumn);
    app.tick(); expect(app.progress).toBe(5); expect(Number(app.column)).toBeLessThan(Number(heldColumn));
  });

  it('releases the timer on unmount and makes its retained callback inert', () => {
    const app = prepare(); const oldTick = intervalCallbacks.at(-1)!; const setters = app.setterCount; const publications = hooks.publish.mock.calls.length;
    app.unmount(); expect(vi.getTimerCount()).toBe(0); oldTick(); vi.advanceTimersByTime(2000);
    expect(app.setterCount).toBe(setters); expect(hooks.publish).toHaveBeenCalledTimes(publications);
  });

  it.each(['未浸入', '碰杯底', '碰杯壁'])('holds the column at %s, invalidates the current measurement and requires fresh stabilization without deleting history', position => {
    const app = prepare(); app.tick(20); saveCurrent(app); const history = app.history; const height = app.stemStyle.height;
    expect(app.snapshot.validity.ready).toBe(true); app.click(position);
    expect(app.column).toBe(68); expect(app.stemStyle.height).toBe(height); expect(app.progress).toBe(0); expect(app.reading('visible')).toBeNull();
    expect(app.reading('recorded')).toBeNull(); expect(app.derived('parallax')).toBe(false); expect(app.snapshot.validity.ready).toBe(false);
    expect(app.snapshot.validity.issues.length).toBeGreaterThan(0); expect(app.history).toEqual(history); expect(vi.getTimerCount()).toBe(0);
    app.invoke('保存本次测量'); expect(app.history).toEqual(history);
    app.click('正确浸入'); expect(app.column).toBe(68); expect(app.progress).toBe(0); expect(app.button('读取并记录温度').props.disabled).toBe(true);
    app.tick(19); expect(app.apparatus('stable')).toBe(false); expect(app.history).toEqual(history);
    app.tick(); expect(app.apparatus('stable')).toBe(true); expect(app.reading('recorded')).toBeNull();
  });

  it('never runs or records an out-of-range instrument even when disabled callbacks are invoked directly', () => {
    const app = prepare(); app.tick(20); saveCurrent(app); const history = app.history;
    app.click('低温温度计'); app.click('正确浸入');
    expect(app.apparatus('range-suitable')).toBe(false); expect(app.reading('visible')).toBeNull(); expect(app.snapshot.validity.issues.join('')).toContain('不适合');
    expect((app.tree as Element).props.actionDisabled).toBe(true); (app.tree as Element).props.onToggle && ((app.tree as Element).props.onToggle as () => void)(); app.render();
    const events = hooks.record.mock.calls.length;
    for (const label of ['读取并记录温度', '平视液柱末端', '俯视液柱末端', '仰视液柱末端', '保存本次测量']) { expect(app.button(label).props.disabled).toBe(true); app.invoke(label); }
    app.tick(20); expect(vi.getTimerCount()).toBe(0); expect(app.progress).toBe(0); expect(app.reading('recorded')).toBeNull();
    expect(hooks.record).toHaveBeenCalledTimes(events); expect(app.history).toEqual(history); expect(app.snapshot.validity.ready).toBe(false);
  });

  it('requires a level formal reading and both parallax directions, which never overwrite that formal reading', () => {
    const app = prepare(); app.tick(20);
    expect(app.reading('visible')).toBe(69); expect(app.button('读取并记录温度').props.disabled).toBe(true);
    app.invoke('读取并记录温度'); expect(app.reading('recorded')).toBeNull();
    app.click('平视'); app.click('读取并记录温度'); expect(app.reading('recorded')).toBe(68);
    expect(app.button('保存本次测量').props.disabled).toBe(true);
    app.click('俯视液柱末端'); expect(app.reading('visible')).toBe(69); expect(app.reading('recorded')).toBe(68); expect(app.button('保存本次测量').props.disabled).toBe(true);
    app.click('仰视液柱末端'); expect(app.reading('visible')).toBe(67); expect(app.reading('recorded')).toBe(68); expect(app.snapshot.validity.ready).toBe(false);
    app.click('保存本次测量'); expect(app.snapshot.validity.ready).toBe(true); expect(app.history).toEqual([['温水', '实验室温度计', '1', '68']]);
  });

  it('keeps all three sample histories across sample/instrument changes while reporting the current setup problem', () => {
    const app = prepare('室温水'); app.tick(20); saveCurrent(app);
    for (const sample of ['温水', '冰水混合物']) {
      app.click(sample); expect(app.snapshot.validity.ready).toBe(false); expect(app.snapshot.validity.issues.join('')).toContain('浸入');
      app.click('正确浸入'); app.tick(20); saveCurrent(app);
    }
    expect(app.history.map(row => [row[0], row[3]])).toEqual([['冰水混合物', '0'], ['温水', '68'], ['室温水', '24']]);
    const history = app.history; app.click('低温温度计'); expect(app.history).toEqual(history); expect(app.column).toBe(24); expect(app.reading('visible')).toBeNull();
    expect(app.snapshot.validity.ready).toBe(false); app.click('体温计'); expect(app.history).toEqual(history); expect(app.snapshot.validity.issues.join('')).toContain('不适合');
    expect(app.derived('saved-count')).toBe(3);
  });

  it('does not restart the response or discard a completed reading when the current position is clicked again', () => {
    const app = prepare(); app.tick(10); const column = app.column; const timersCreated = intervalCallbacks.length;
    app.click('正确浸入'); expect(app.progress).toBe(50); expect(app.column).toBe(column); expect(intervalCallbacks).toHaveLength(timersCreated);
    app.tick(10); saveCurrent(app); const history = app.history; app.click('正确浸入');
    expect(app.progress).toBe(100); expect(app.reading('recorded')).toBe(68); expect(app.derived('parallax')).toBe(true);
    expect(app.snapshot.validity.ready).toBe(true); expect(app.history).toEqual(history); expect(vi.getTimerCount()).toBe(0);
  });
});
