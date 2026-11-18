import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { PendulumDiagram } from './PendulumDiagram';
import { PendulumApparatus3D } from './PendulumApparatus3D';
import { PendulumControlBar, type PendulumInstrumentProps } from './PendulumControls';
import { PENDULUM_SVG, PENDULUM_WORLD, pendulumClientPoint, pendulumDragAmplitude, pendulumGeometry, pendulumReleasePoint } from './PendulumGeometry';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; index: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, id: 0 }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.index++] ?? (frame.slots[frame.index - 1] = {}); };
  return { ...actual,
    useRef: (value: unknown) => { if (!hooks.frame) return actual.useRef(value); const item = slot(); item.value ??= { current: value }; return item.value; },
    useId: () => { if (!hooks.frame) return actual.useId(); const item = slot(); item.value ??= `pendulum-${++hooks.id}`; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!hooks.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.deps = deps; hooks.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Element[] { return Array.isArray(tree) ? tree.flatMap(nodes) : isValidElement<Record<string, unknown>>(tree) ? [tree, ...nodes(tree.props.children as ReactNode)] : []; }
function content(tree: ReactNode): string { return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(content).join('') : isValidElement<Record<string, unknown>>(tree) ? content(tree.props.children as ReactNode) : ''; }
function fire(element: Element, event: string, value: unknown = {}) { (element.props[event] as (event: unknown) => void)(value); }
function props(patch: Record<string, number> = {}, time = 0): PendulumInstrumentProps {
  const parameters = { ...defaultHighSchoolParameters('pendulum'), ...patch };
  return { parameters, simulation: simulateHighSchoolExperiment('pendulum', parameters, time), onChange: vi.fn() };
}
const cleanups: Array<() => void> = [];
function mount(component: typeof PendulumDiagram | typeof PendulumApparatus3D, initial: PendulumInstrumentProps) {
  let current = initial; const frame: Frame = { slots: [], index: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render(next: Partial<PendulumInstrumentProps> = {}) { current = { ...current, ...next }; frame.index = 0; hooks.frame = frame; try { app.tree = component(current); } finally { hooks.frame = null; } frame.effects.splice(0).forEach(effect => effect()); },
    unmount() { frame.slots.forEach(item => { item.cleanup?.(); item.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
function handle(tree: ReactNode) { return nodes(tree).find(item => item.props['data-pendulum-release'])!; }
function buttons(tree: ReactNode) { const node = nodes(tree).find(item => item.type === PendulumControlBar)!; return nodes(PendulumControlBar(node.props as unknown as Parameters<typeof PendulumControlBar>[0])).filter(item => item.type === 'button'); }
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe('pendulum fixed-scale observation geometry', () => {
  it.each([.3, 1, 2])('maps model positions with a fixed scale for length %s m in both views', length => {
    for (const amplitudeDegrees of [2, 10, 75]) for (const time of [0, .4, 60]) {
      const input = props({ length, amplitudeDegrees }, time), state = input.simulation.state, scene = pendulumGeometry(input.parameters, state);
      expect(Math.hypot(scene.bob.x - PENDULUM_SVG.pivot.x, scene.bob.y - PENDULUM_SVG.pivot.y)).toBeCloseTo(length * PENDULUM_SVG.unitsPerMetre, 8);
      expect(Math.hypot(scene.worldBob[0], scene.worldBob[1] - PENDULUM_WORLD.pivot[1])).toBeCloseTo(length * PENDULUM_WORLD.unitsPerMetre, 8);
      expect(scene.bob.x - PENDULUM_SVG.pivot.x).toBeCloseTo(state.x * PENDULUM_SVG.unitsPerMetre);
      expect(scene.worldBob[1] - PENDULUM_WORLD.bobRadius).toBeGreaterThan(-1.15);
      expect(scene.bob.x - PENDULUM_SVG.bobRadius).toBeGreaterThan(75);
      expect(scene.bob.x + PENDULUM_SVG.bobRadius).toBeLessThan(625);
    }
  });

  it('gets current direction from angular velocity and never invents a direction at release', () => {
    const release = props(), initial = pendulumGeometry(release.parameters, release.simulation.state);
    expect(initial.direction).toBe(0); expect(initial.arrow).toBeNull(); expect(initial.worldArrow).toBeNull();
    const first = props({}, .2), state = first.simulation.state, scene = pendulumGeometry(first.parameters, state);
    expect(scene.directionLabel).toBe('向左摆动'); expect(scene.arrow!.to.x).toBeLessThan(scene.arrow!.from.x);
    const before = simulateHighSchoolExperiment('pendulum', first.parameters, .2 - .0001).state;
    const after = simulateHighSchoolExperiment('pendulum', first.parameters, .2 + .0001).state;
    expect(Math.sign(scene.worldArrow!.end[0] - scene.worldArrow!.start[0])).toBe(Math.sign(after.x - before.x));
    expect(Math.sign(scene.worldArrow!.end[1] - scene.worldArrow!.start[1])).toBe(Math.sign(after.y - before.y));
  });

  it('maps responsive letterboxing to the same release angle rather than stretching the pointer', () => {
    const point = pendulumReleasePoint(1, 45).svg;
    expect(pendulumDragAmplitude(point)).toBe(45);
    for (const rect of [{ left: 10, top: 20, width: 350, height: 390 }, { left: 50, top: 70, width: 1000, height: 390 }]) {
      const scale = Math.min(rect.width / 700, rect.height / 390);
      const x = rect.left + (rect.width - 700 * scale) / 2 + point.x * scale, y = rect.top + (rect.height - 390 * scale) / 2 + point.y * scale;
      const mapped = pendulumClientPoint(x, y, rect)!;
      expect(mapped.x).toBeCloseTo(point.x); expect(mapped.y).toBeCloseTo(point.y); expect(pendulumDragAmplitude(mapped)).toBe(45);
    }
    expect(pendulumDragAmplitude(PENDULUM_SVG.pivot)).toBeNull();
    expect(pendulumDragAmplitude({ x: 10000, y: 61 })).toBe(75);
    expect(pendulumDragAmplitude({ x: 0, y: 329 })).toBe(2);
    expect(pendulumClientPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });

  it('shows readable units, control purpose and manual timing boundaries without an automatically filled period', () => {
    for (const patch of [{ length: .3, amplitudeDegrees: 2 }, { length: 2, amplitudeDegrees: 75 }]) {
      const html = renderToStaticMarkup(<PendulumDiagram {...props(patch, .4)} />);
      expect(html).toContain('class="hs-diagram"'); expect(html).toContain('role="slider"'); expect(html).toContain('悬点至球心');
      expect(html).toContain('正在进行的手动计时需重做'); expect(html).toContain('平衡位置 · 起止要同一方向经过'); expect(html).not.toMatch(/NaN|Infinity|aria-live/);
      expect(html).not.toContain('周期数 N=');
    }
  });
});

describe('actual SVG and Three component callbacks with controlled hooks, not browser/GPU verification', () => {
  it('captures one pointer and applies a single angle-only patch without filling time, count or records', () => {
    vi.stubGlobal('DOMPoint', undefined);
    const change = vi.fn(), app = mount(PendulumDiagram, { ...props(), onChange: change }), node = handle(app.tree);
    let captured: number | null = null;
    const target = { ownerSVGElement: { getScreenCTM: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 700, height: 390 }) }, setPointerCapture: (id: number) => { captured = id; }, hasPointerCapture: (id: number) => captured === id, releasePointerCapture: () => { captured = null; } };
    const event = (angle: number, pointerId = 4) => ({ ...pendulumReleasePoint(1, angle).svg, clientX: pendulumReleasePoint(1, angle).svg.x, clientY: pendulumReleasePoint(1, angle).svg.y, pointerId, pointerType: 'touch', button: 0, currentTarget: target, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    fire(node, 'onPointerDown', event(30)); expect(captured).toBe(4); expect(change.mock.calls).toEqual([[{ amplitudeDegrees: 30 }]]);
    fire(node, 'onPointerMove', event(50, 8)); expect(change).toHaveBeenCalledOnce();
    fire(node, 'onPointerMove', event(45)); expect(change).toHaveBeenLastCalledWith({ amplitudeDegrees: 45 });
    fire(node, 'onPointerUp', event(45)); expect(captured).toBeNull();
    fire(node, 'onPointerMove', event(60)); expect(change).toHaveBeenCalledTimes(2);
    fire(node, 'onPointerDown', { ...event(60), pointerType: 'mouse', button: 2 }); expect(change).toHaveBeenCalledTimes(2);
  });

  it('supports keyboard increments and limits with the same callbacks as presets', () => {
    const change = vi.fn(), app = mount(PendulumDiagram, { ...props(), onChange: change });
    const node = handle(app.tree), key = (value: string, shiftKey = false) => ({ key: value, shiftKey, preventDefault: vi.fn() });
    fire(node, 'onKeyDown', key('ArrowRight')); expect(change).toHaveBeenLastCalledWith({ amplitudeDegrees: 11 });
    fire(node, 'onKeyDown', key('ArrowLeft', true)); expect(change).toHaveBeenLastCalledWith({ amplitudeDegrees: 5 });
    fire(node, 'onKeyDown', key('Home')); expect(change).toHaveBeenLastCalledWith({ amplitudeDegrees: 2 });
    fire(node, 'onKeyDown', key('End')); expect(change).toHaveBeenLastCalledWith({ amplitudeDegrees: 75 });
    fire(node, 'onKeyDown', key('a')); expect(change).toHaveBeenCalledTimes(4);
    fire(buttons(app.tree).find(button => content(button).includes('45°'))!, 'onClick'); expect(change).toHaveBeenLastCalledWith({ amplitudeDegrees: 45 });
    app.render({ ...props({ amplitudeDegrees: 75 }), onChange: change }); fire(handle(app.tree), 'onKeyDown', key('ArrowRight')); expect(change).toHaveBeenCalledTimes(5);
  });

  it('releases capture and rejects old controls after callback removal or unmount', () => {
    const change = vi.fn(), app = mount(PendulumDiagram, { ...props(), onChange: change });
    const node = handle(app.tree), oldButton = buttons(app.tree).find(button => content(button).includes('45°'))!;
    const release = vi.fn(), target = { ownerSVGElement: { getScreenCTM: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 700, height: 390 }) }, setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: release };
    const point = pendulumReleasePoint(1, 30).svg;
    fire(node, 'onPointerDown', { clientX: point.x, clientY: point.y, pointerId: 3, pointerType: 'touch', currentTarget: target, preventDefault() {}, stopPropagation() {} }); expect(change).toHaveBeenCalledOnce();
    app.render({ onChange: undefined }); expect(release).toHaveBeenCalledWith(3);
    fire(oldButton, 'onClick'); fire(node, 'onKeyDown', { key: 'End', preventDefault() {} }); expect(change).toHaveBeenCalledOnce();
    app.render({ onChange: change }); app.unmount(); fire(oldButton, 'onClick'); expect(change).toHaveBeenCalledOnce();
  });

  it('keeps Three sphere centre and directional geometry on the same model, with guarded native controls', () => {
    const initial = props({ length: 2, amplitudeDegrees: 45 }, .3), change = vi.fn(), app = mount(PendulumApparatus3D, { ...initial, onChange: change });
    const bob = nodes(app.tree).find(node => (node.props.userData as { pendulumBob?: boolean } | undefined)?.pendulumBob)!;
    expect(bob.props.position).toEqual(pendulumGeometry(initial.parameters, initial.simulation.state).worldBob);
    const small = buttons(app.tree).find(button => content(button).includes('5° 小角'))!;
    fire(small, 'onClick'); expect(change.mock.calls).toEqual([[{ amplitudeDegrees: 5 }]]);
    app.unmount(); fire(small, 'onClick'); expect(change).toHaveBeenCalledOnce();
    expect(initial.simulation.state.time).toBe(.3); expect(initial.parameters.amplitudeDegrees).toBe(45);
  });
});
