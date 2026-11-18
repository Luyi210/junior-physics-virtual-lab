import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { LiveMicrophoneLab } from './LiveMicrophoneLab';
import { LabFrame } from '../shared/ScienceLabPrimitives';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn(), publish: vi.fn() }));
// Drive the real component, LabFrame button and capture lifecycle with controlled
// hooks/device APIs. No microphone, audio output, browser or real storage is used.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => {
      const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => { const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = { current: initial }; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const item = slot(); const changed = !item.deps || !deps || deps.length !== item.deps.length || deps.some((value, i) => !Object.is(value, item.deps![i]));
      if (changed) { item.deps = deps; harness.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});
vi.mock('../../assistant/harnessStore', () => ({ useHarnessStore: (select: (state: { record: typeof harness.record }) => unknown) => select({ record: harness.record }) }));
vi.mock('../../assistant/tutorialBridge', () => ({ publishApparatusSnapshot: (...args: unknown[]) => harness.publish(...args) }));

type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(all);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : '';
}
const cleanups: Array<() => void> = [];
function mount() {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode, props: null as Parameters<typeof LabFrame>[0] | null,
    render() {
      frame.cursor = 0; harness.frame = frame;
      try { const child = LiveMicrophoneLab(); app.props = child.props; app.tree = LabFrame(child.props); }
      finally { harness.frame = null; }
      frame.effects.splice(0).forEach((effect) => effect()); return app.tree;
    },
    click(label: string) {
      const button = all(app.tree).find((item) => item.type === 'button' && text(item) === label);
      expect(button, label).toBeDefined(); (button!.props.onClick as () => void)();
    },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(app.unmount); return app;
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
const toggles = () => harness.record.mock.calls.filter(([type]) => type === 'simulation.toggled').map(([, payload]) => payload);
function devices(resume: () => Promise<void> = async () => {}) {
  const track = { stop: vi.fn() }; const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = { fftSize: 0, frequencyBinCount: 1024, smoothingTimeConstant: 0, disconnect: vi.fn() };
  const context = { sampleRate: 48000, resume: vi.fn(resume), close: vi.fn(async () => {}), createAnalyser: () => analyser, createMediaStreamSource: () => source };
  vi.stubGlobal('window', { AudioContext: function () { return context; }, setInterval: vi.fn(() => 7), clearInterval: vi.fn() });
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, track, source, context };
}
beforeEach(() => {
  harness.record.mockReset(); harness.publish.mockReset();
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 17)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('microphone events follow actual capture transitions', () => {
  it('does not log startup for a request or cancellation, including permission delivered after cancellation', async () => {
    const permission = deferred<MediaStream>(), media = devices();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => permission.promise } });
    const app = mount(); expect(app.props!.recordToggleEvent).toBe(false);
    app.click('启用本机麦克风'); app.render();
    expect(toggles()).toEqual([]); expect(app.props!.running).toBe(false);
    app.click('取消麦克风请求'); app.render(); permission.resolve(media.stream); await settle(); app.render();
    expect(toggles()).toEqual([]); expect(harness.record).not.toHaveBeenCalled();
    expect(media.track.stop).toHaveBeenCalledOnce(); expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(app.props!.running).toBe(false);
  });

  it('logs one successful startup and one actual stop, preserving the existing configuration event', async () => {
    const media = devices(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => media.stream } });
    const app = mount(); app.click('启用本机麦克风'); await settle(); app.render();
    expect(app.props!.running).toBe(true);
    expect(harness.record).toHaveBeenCalledWith('configuration.changed', { experiment: 'sound-microphone', control: '麦克风', value: 'enabled' });
    app.click('停止麦克风'); app.render(); app.unmount();
    expect(toggles()).toEqual([
      { experiment: 'sound-microphone', running: true, action: '麦克风采集已启动' },
      { experiment: 'sound-microphone', running: false, action: '麦克风采集已停止' },
    ]);
    expect(media.track.stop).toHaveBeenCalledOnce(); expect(media.context.close).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17); expect(app.props!.running).toBe(false);
  });

  it('releases active devices on unmount without writing to a potentially changed learning session', async () => {
    const media = devices(); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => media.stream } });
    const app = mount(); app.click('启用本机麦克风'); await settle(); app.render();
    expect(app.props!.running).toBe(true);
    harness.record.mockClear();
    app.unmount();
    expect(harness.record).not.toHaveBeenCalled();
    expect(media.track.stop).toHaveBeenCalledOnce(); expect(media.context.close).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
  });

  it.each(['permission', 'resume', 'unsupported'] as const)('never logs running for %s failure', async (failure) => {
    const media = devices(failure === 'resume' ? async () => { throw new Error('resume failed'); } : undefined);
    vi.stubGlobal('navigator', failure === 'unsupported' ? {} : { mediaDevices: { getUserMedia: failure === 'permission' ? async () => { throw new Error('denied'); } : async () => media.stream } });
    const app = mount(); app.click('启用本机麦克风'); await settle(); app.render();
    expect(toggles()).toEqual([]); expect(harness.record).not.toHaveBeenCalled(); expect(app.props!.running).toBe(false);
    expect(text(app.tree)).toContain(failure === 'unsupported' ? '当前浏览器不支持实时麦克风接口' : '没有获得麦克风权限');
  });

  it('does not enable or record a resumed stream after the component has unmounted', async () => {
    const resume = deferred<void>(), media = devices(() => resume.promise);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => media.stream } });
    const app = mount(); app.click('启用本机麦克风'); await settle(); app.unmount();
    resume.resolve(); await settle();
    expect(toggles()).toEqual([]); expect(harness.record).not.toHaveBeenCalled();
    expect(media.track.stop).toHaveBeenCalledOnce(); expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('identifies demo start and stop separately without inventing microphone activation', async () => {
    devices(); vi.stubGlobal('navigator', {});
    const app = mount(); app.click('启用本机麦克风'); app.render();
    app.click('使用模拟信号'); app.render(); expect(app.props!.running).toBe(true);
    app.click('停止模拟信号'); app.render();
    expect(toggles()).toEqual([
      { experiment: 'sound-microphone', running: true, action: '模拟信号已启动' },
      { experiment: 'sound-microphone', running: false, action: '模拟信号已停止' },
    ]);
    expect(harness.record).toHaveBeenCalledWith('configuration.changed', { experiment: 'sound-microphone', control: '信号模式', value: 'demo' });
    expect(harness.record.mock.calls.some(([, payload]) => payload.value === 'enabled')).toBe(false);
  });
});
