import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { createCapacitorHistory, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { ExperimentViewport } from './ExperimentViewport';
import { ExperimentDiagram2D, type ExperimentSceneProps } from './ExperimentDiagram2D';
import { PendulumDiagram } from './flagship/PendulumDiagram';
import { PendulumControlBar, PendulumTouchControls, type PendulumInstrumentProps } from './flagship/PendulumControls';
import { ExperimentParameterControl } from './ExperimentParameterControl';
import { MOBILE_SCENE_QUERY } from '../../../shared/hooks/useMobileSceneMode';

type Slot = { value?: unknown; initialized?: boolean; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; dirty: boolean };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, id: 0 }));
// The actual component callbacks/effect cleanups run against controlled state.
// WebGL, React reconciliation and browser pointer/GPU behaviour are not emulated.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => {
      if (!hooks.frame) return actual.useState(initial); const frame = hooks.frame, item = slot();
      if (!item.initialized) { item.value = typeof initial === 'function' ? (initial as () => unknown)() : initial; item.initialized = true; }
      return [item.value, (next: unknown) => { const value = typeof next === 'function' ? (next as (previous: unknown) => unknown)(item.value) : next; if (!Object.is(value, item.value)) { item.value = value; frame.dirty = true; } }];
    },
    useRef: (value: unknown) => { if (!hooks.frame) return actual.useRef(value); const item = slot(); item.value ??= { current: value }; return item.value; },
    useId: () => { if (!hooks.frame) return actual.useId(); const item = slot(); item.value ??= `viewport-${++hooks.id}`; return item.value; },
    useMemo: (factory: () => unknown, deps?: readonly unknown[]) => {
      if (!hooks.frame) return actual.useMemo(factory, deps!); const item = slot();
      if (!item.initialized || !deps || !item.deps || deps.some((value, index) => !Object.is(value, item.deps![index]))) { item.value = factory(); item.deps = deps; item.initialized = true; } return item.value;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!hooks.frame) return actual.useEffect(effect, deps); const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) { item.deps = deps; hooks.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Element[] { return Array.isArray(tree) ? tree.flatMap(nodes) : isValidElement<Record<string, unknown>>(tree) ? [tree, ...nodes(tree.props.children as ReactNode)] : []; }
function content(tree: ReactNode): string { return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(content).join('') : isValidElement<Record<string, unknown>>(tree) ? content(tree.props.children as ReactNode) : ''; }
function button(tree: ReactNode, label: string) { const found = nodes(tree).find(item => item.type === 'button' && content(item).includes(label)); expect(found, label).toBeDefined(); return found!; }
function labelledButton(tree: ReactNode, label: string) { const found = nodes(tree).find(item => item.type === 'button' && item.props['aria-label'] === label); expect(found, label).toBeDefined(); return found!; }
function fire(element: Element, event = 'onClick', value: unknown = {}) { (element.props[event] as (event: unknown) => void)(value); }
const cleanups: Array<() => void> = [];
function mount<P extends object>(component: (props: P) => ReactNode, initial: P) {
  let props = initial; const frame: Frame = { slots: [], cursor: 0, effects: [], dirty: false };
  const app = { tree: null as ReactNode,
    render(next: Partial<P> = {}) { props = { ...props, ...next }; let count = 0; do { frame.dirty = false; frame.cursor = 0; hooks.frame = frame; try { app.tree = component(props); } finally { hooks.frame = null; } frame.effects.splice(0).forEach(effect => effect()); if (++count > 20) throw new Error('hook render did not settle'); } while (frame.dirty); },
    unmount() { frame.slots.forEach(item => { item.cleanup?.(); item.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
function probe(kind: 'available' | 'missing' | 'throws') {
  const loseContext = vi.fn(), getExtension = vi.fn(() => ({ loseContext }));
  const getContext = vi.fn(() => { if (kind === 'throws') throw new Error('WebGL disabled'); return kind === 'available' ? { getExtension } : null; });
  vi.stubGlobal('document', { createElement: vi.fn(() => ({ getContext })) });
  return { getContext, getExtension, loseContext };
}
function screen(matches: boolean) {
  const media = Object.assign(new EventTarget(), { matches });
  const add = vi.spyOn(media, 'addEventListener'), remove = vi.spyOn(media, 'removeEventListener');
  const matchMedia = vi.fn(() => media);
  vi.stubGlobal('window', { matchMedia });
  return { media, add, remove, matchMedia, change(value: boolean) { media.matches = value; media.dispatchEvent(new Event('change')); } };
}
function scene(): ExperimentSceneProps {
  const parameters = defaultHighSchoolParameters('pendulum');
  return { experimentId: 'pendulum', parameters, simulation: simulateHighSchoolExperiment('pendulum', parameters, .3), trajectory: [], onParametersChange: vi.fn(), onCapacitorModeChange: vi.fn() };
}
function activeThree(tree: ReactNode) { return nodes(tree).find(node => typeof node.props.onContextLost === 'function')!; }
function fallbackDiagram(tree: ReactNode) { return nodes(tree).find(node => node.type === ExperimentDiagram2D)!; }
function operateActualFallback(tree: ReactNode) {
  const source = fallbackDiagram(tree); expect(source).toBeDefined();
  const dispatch = mount(ExperimentDiagram2D, source.props as unknown as ExperimentSceneProps);
  expect((dispatch.tree as Element).type).toBe(PendulumDiagram);
  const apparatus = mount(PendulumDiagram, (dispatch.tree as Element).props as unknown as PendulumInstrumentProps);
  const bar = nodes(apparatus.tree).find(node => node.type === PendulumControlBar)!;
  const rendered = PendulumControlBar(bar.props as unknown as Parameters<typeof PendulumControlBar>[0]);
  fire(button(rendered, '45° 大角对照'));
}
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });

describe('view-only controls and operable fallback', () => {
  it.each(HIGH_SCHOOL_EXPERIMENTS.map(definition => definition.id))('starts %s in the live 2D instrument on mobile without mounting the lazy 3D scene', experimentId => {
    probe('available'); screen(true);
    const parameters = defaultHighSchoolParameters(experimentId);
    const props: ExperimentSceneProps = { experimentId, parameters, simulation: simulateHighSchoolExperiment(experimentId, parameters, 0, experimentId === "capacitor-charge" ? createCapacitorHistory("mobile-default") : undefined), trajectory: [], onParametersChange: vi.fn(), onCapacitorModeChange: vi.fn() };
    const app = mount(ExperimentViewport, props);
    expect(activeThree(app.tree)).toBeUndefined();
    expect(content(app.tree)).toContain('手机端优先使用二维装置');
    expect(button(app.tree, experimentId === 'force-composition' ? '二维拖动' : '二维示意').props['aria-pressed']).toBe(true);
    const diagram = fallbackDiagram(app.tree);
    expect(diagram.props.parameters).toBe(parameters);
    expect(diagram.props.simulation).toBe(props.simulation);
    expect(diagram.props.onParametersChange).toBe(props.onParametersChange);
    expect(diagram.props.onCapacitorModeChange).toBe(props.onCapacitorModeChange);
    expect(props.onParametersChange).not.toHaveBeenCalled();
    expect(props.onCapacitorModeChange).not.toHaveBeenCalled();
  });

  it('keeps default mobile pendulum operations usable before requesting any 3D view', () => {
    probe('available'); screen(true); const props = scene(), app = mount(ExperimentViewport, props);
    operateActualFallback(app.tree);
    expect(props.onParametersChange).toHaveBeenCalledExactlyOnceWith({ amplitudeDegrees: 45 });
    expect(activeThree(app.tree)).toBeUndefined();
  });

  it('resizes the mobile 2D drawing independently of experiment conditions and readings', () => {
    probe('available'); screen(true); const props = scene(), app = mount(ExperimentViewport, props);
    const stage = () => nodes(app.tree).find(node => node.props['data-scene-size'] !== undefined)!;
    expect(stage().props['data-scene-size']).toBe(100);
    fire(labelledButton(app.tree, '缩小实验画面')); app.render();
    expect(stage().props['data-scene-size']).toBe(80);
    expect(labelledButton(app.tree, '缩小实验画面').props.disabled).toBe(true);
    fire(labelledButton(app.tree, '放大实验画面')); app.render();
    fire(labelledButton(app.tree, '放大实验画面')); app.render();
    expect(stage().props['data-scene-size']).toBe(125);
    expect(stage().props.role).toBe('region');
    fire(button(app.tree, '重置')); app.render();
    expect(stage().props['data-scene-size']).toBe(100);
    expect(fallbackDiagram(app.tree).props.simulation).toBe(props.simulation);
    expect(props.onParametersChange).not.toHaveBeenCalled();
    expect(props.onCapacitorModeChange).not.toHaveBeenCalled();
  });

  it('follows the display only until the user explicitly chooses a view, without resetting live experiment progress', () => {
    probe('available'); const display = screen(true), props = scene(), app = mount(ExperimentViewport, props);
    expect(activeThree(app.tree)).toBeUndefined();
    display.change(false); app.render();
    expect(activeThree(app.tree).props.simulation).toBe(props.simulation);
    display.change(true); app.render();
    expect(activeThree(app.tree)).toBeUndefined();
    // Even clicking the already-selected 2D button is an explicit preference.
    fire(button(app.tree, '二维示意')); app.render();
    display.change(false); app.render();
    expect(activeThree(app.tree)).toBeUndefined();
    expect(fallbackDiagram(app.tree).props.simulation).toBe(props.simulation);
    fire(button(app.tree, '三维装置')); app.render();
    display.change(true); app.render();
    expect(activeThree(app.tree).props.simulation).toBe(props.simulation);
    expect(activeThree(app.tree).props.parameters).toBe(props.parameters);
    expect(props.onParametersChange).not.toHaveBeenCalled();
    expect(props.onCapacitorModeChange).not.toHaveBeenCalled();
  });

  it('keeps mobile pendulum actions outside the projected canvas and uses the same angle-only callback', () => {
    probe('available'); screen(true); const props = scene(), app = mount(ExperimentViewport, props);
    fire(button(app.tree, '三维装置')); app.render();
    const controls = nodes(app.tree).find(node => node.type === PendulumTouchControls)!;
    expect(controls).toBeDefined();
    expect(nodes(activeThree(app.tree)).some(node => node.type === PendulumTouchControls)).toBe(false);
    const actual = mount(PendulumTouchControls, controls.props as unknown as PendulumInstrumentProps);
    const bar = nodes(actual.tree).find(node => node.type === PendulumControlBar)!;
    fire(button(PendulumControlBar(bar.props as unknown as Parameters<typeof PendulumControlBar>[0]), '45° 大角对照'));
    expect(props.onParametersChange).toHaveBeenCalledExactlyOnceWith({ amplitudeDegrees: 45 });
    fire(button(app.tree, '二维示意')); app.render();
    expect(nodes(app.tree).some(node => node.type === PendulumTouchControls)).toBe(false);
  });

  it('lets a phone scroll until rotation is explicitly enabled, then exits without changing experimental conditions', () => {
    probe('available'); const phone = screen(true), props = scene(), app = mount(ExperimentViewport, props);
    expect(phone.matchMedia).toHaveBeenCalledWith(MOBILE_SCENE_QUERY);
    expect(activeThree(app.tree)).toBeUndefined();
    fire(button(app.tree, '三维装置')); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(false);
    expect(activeThree(app.tree).props.mobileScene).toBe(true);
    expect(content(app.tree)).toContain('可直接上下滑动页面');
    fire(button(app.tree, '启用触摸旋转')); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(true);
    expect(button(app.tree, '退出旋转').props['aria-pressed']).toBe(true);
    fire(button(app.tree, '退出旋转')); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(false);
    expect(activeThree(app.tree).props.parameters).toBe(props.parameters);
    expect(activeThree(app.tree).props.simulation).toBe(props.simulation);
    expect(props.onParametersChange).not.toHaveBeenCalled();
    expect(props.onCapacitorModeChange).not.toHaveBeenCalled();
  });

  it('does not reactivate touch capture after switching view or changing experiment', () => {
    probe('available'); screen(true); const app = mount(ExperimentViewport, scene());
    fire(button(app.tree, '三维装置')); app.render();
    fire(button(app.tree, '启用触摸旋转')); app.render();
    fire(button(app.tree, '二维示意')); app.render();
    fire(button(app.tree, '三维装置')); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(false);
    fire(button(app.tree, '启用触摸旋转')); app.render();
    const parameters = defaultHighSchoolParameters('force-composition');
    app.render({ experimentId: 'force-composition', parameters, simulation: simulateHighSchoolExperiment('force-composition', parameters, 0) });
    expect(activeThree(app.tree).props.cameraInteractive).toBe(false);
  });

  it('adapts to pointer/width changes and removes the media listener when leaving the experiment', () => {
    probe('available'); const display = screen(false), app = mount(ExperimentViewport, scene());
    expect(activeThree(app.tree).props.cameraInteractive).toBe(true);
    expect(activeThree(app.tree).props.mobileScene).toBe(false);
    display.change(true); app.render();
    expect(activeThree(app.tree)).toBeUndefined();
    expect(button(app.tree, '二维示意').props['aria-pressed']).toBe(true);
    fire(button(app.tree, '三维装置')); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(false);
    fire(button(app.tree, '启用触摸旋转')); app.render();
    display.change(false); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(true);
    display.change(true); app.render();
    expect(activeThree(app.tree).props.cameraInteractive).toBe(false);
    app.unmount();
    expect(display.remove).toHaveBeenCalledWith('change', display.add.mock.calls[0]![1]);
  });

  it('provides a keyboard with a minus sign for signed parameters while preserving decimal entry for positive quantities', () => {
    const onChange = vi.fn();
    const app = mount(ExperimentParameterControl, { parameter: { key: 'speed', label: '速度', unit: 'm/s', defaultValue: 0, min: -10, max: 10, step: .1 }, value: -2, onChange });
    const input = () => nodes(app.tree).find(node => node.props.className === 'hs-parameter-number')!;
    expect(input().props.inputMode).toBe('text');
    fire(input(), 'onChange', { target: { value: '-3.5' } }); app.render(); fire(input(), 'onBlur');
    expect(onChange).toHaveBeenLastCalledWith(-3.5);
    app.render({ parameter: { key: 'length', label: '长度', unit: 'm', defaultValue: 1, min: .1, max: 10, step: .1 } });
    expect(input().props.inputMode).toBe('decimal');
  });

  it('changes view, camera and 2D magnification without changing parameters, physical time or any recording callback', () => {
    const gl = probe('available'), props = scene(), before = JSON.stringify({ parameters: props.parameters, simulation: props.simulation, trajectory: props.trajectory });
    const app = mount(ExperimentViewport, props);
    expect(gl.loseContext).toHaveBeenCalledOnce(); expect(button(app.tree, '三维装置').props['aria-pressed']).toBe(true);
    const first = activeThree(app.tree); expect(first.props.parameters).toBe(props.parameters); expect(first.props.simulation).toBe(props.simulation);
    const select = nodes(app.tree).find(node => node.type === 'select')!; fire(select, 'onChange', { target: { value: 'top' } }); app.render();
    expect(activeThree(app.tree).props.cameraView).toBe('top');
    const oldBoundary = nodes(app.tree).find(node => typeof node.props.onFailure === 'function')!;
    fire(button(app.tree, '复位视角')); app.render(); const newBoundary = nodes(app.tree).find(node => typeof node.props.onFailure === 'function')!; expect(newBoundary.key).not.toBe(oldBoundary.key);
    fire(button(app.tree, '二维示意')); app.render(); fire(button(app.tree, '放大读尺')); app.render();
    expect(button(app.tree, '完整示意').props['aria-pressed']).toBe(true); expect(nodes(app.tree).some(node => node.props.role === 'region' && node.props.tabIndex === 0)).toBe(true);
    expect(fallbackDiagram(app.tree).props.onParametersChange).toBe(props.onParametersChange);
    fire(button(app.tree, '三维装置')); app.render(); expect(activeThree(app.tree).props.cameraView).toBe('top');
    fire(button(app.tree, '二维示意')); app.render(); fire(button(app.tree, '完整示意')); app.render();
    expect(nodes(app.tree).some(node => node.props.role === 'region')).toBe(false);
    expect(props.onParametersChange).not.toHaveBeenCalled(); expect(props.onCapacitorModeChange).not.toHaveBeenCalled(); expect(JSON.stringify({ parameters: props.parameters, simulation: props.simulation, trajectory: props.trajectory })).toBe(before);
  });

  it.each(['missing', 'throws'] as const)('keeps the actual 2D instrument usable when the WebGL probe %s', kind => {
    probe(kind); const props = scene(), app = mount(ExperimentViewport, props);
    expect(button(app.tree, '三维装置').props.disabled).toBe(true); expect(button(app.tree, '二维示意').props['aria-pressed']).toBe(true);
    expect(content(app.tree)).toContain('实验控制、计算和记录仍可使用'); expect(props.onParametersChange).not.toHaveBeenCalled();
    operateActualFallback(app.tree); expect(props.onParametersChange).toHaveBeenLastCalledWith({ amplitudeDegrees: 45 });
  });

  it('switches to the same live 2D instrument after context loss and disables the failed 3D option', () => {
    probe('available'); const props = scene(), app = mount(ExperimentViewport, props);
    fire(activeThree(app.tree), 'onContextLost'); app.render();
    expect(button(app.tree, '三维装置').props.disabled).toBe(true); expect(content(app.tree)).toContain('三维渲染已中断');
    expect(fallbackDiagram(app.tree).props.simulation).toBe(props.simulation); expect(props.onParametersChange).not.toHaveBeenCalled();
    operateActualFallback(app.tree); expect(props.onParametersChange).toHaveBeenLastCalledWith({ amplitudeDegrees: 45 });
  });

  it('uses the error boundary fallback and then keeps the same physics props in an operable 2D view', () => {
    probe('available'); const props = scene(), app = mount(ExperimentViewport, props);
    const boundary = nodes(app.tree).find(node => typeof node.props.onFailure === 'function')!;
    const Boundary = boundary.type as unknown as { new(props: Record<string, unknown>): { state: unknown; render: () => ReactNode; componentDidCatch: () => void }; getDerivedStateFromError: () => unknown };
    const instance = new Boundary(boundary.props); instance.state = Boundary.getDerivedStateFromError();
    const fallback = instance.render(); expect(fallbackDiagram(fallback).props.parameters).toBe(props.parameters);
    instance.componentDidCatch(); app.render(); expect(content(app.tree)).toContain('已保留可操作的二维示意'); expect(props.onParametersChange).not.toHaveBeenCalled();
    operateActualFallback(app.tree); expect(props.onParametersChange).toHaveBeenLastCalledWith({ amplitudeDegrees: 45 });
  });
});
