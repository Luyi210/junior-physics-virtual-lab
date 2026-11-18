import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { RefractionDiagram } from './RefractionDiagram';
import { refractionAnglePoint } from './RefractionGeometry';
import type { ExpandedSceneProps } from '../expanded/expandedSceneTypes';

type Slot = { value?: unknown; deps?: readonly unknown[]; effect?: () => void | (() => void); cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: (() => void)[] };
const testHooks = vi.hoisted(() => ({ frame: null as Frame | null }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  function slot() { const frame = testHooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); }
  return { ...actual,
    useRef: (initial: unknown) => { if (!testHooks.frame) return actual.useRef(initial); const item = slot(); item.value ??= { current: initial }; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!testHooks.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!item.deps || !deps || deps.some((value, i) => !Object.is(value, item.deps![i]))) { item.deps = deps; item.effect = effect; testHooks.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function source(node: ReactNode) { return walk(node).find(e => e.props['data-refraction-source'])!; }
function run(element: Element, handler: string, event: unknown) { (element.props[handler] as (event: unknown) => void)(event); }
function mount(overrides: Partial<ExpandedSceneProps> = {}) {
  const parameters = defaultHighSchoolParameters('refractive-index');
  let props: ExpandedSceneProps = { experimentId: 'refractive-index', parameters, simulation: simulateHighSchoolExperiment('refractive-index', parameters), onChange: vi.fn(), ...overrides };
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render(next: Partial<ExpandedSceneProps> = {}) { props = { ...props, ...next }; frame.cursor = 0; testHooks.frame = frame; try { app.tree = RefractionDiagram(props); } finally { testHooks.frame = null; } frame.effects.splice(0).forEach(e => e()); return app.tree; },
    unmount() { frame.slots.forEach(s => { s.cleanup?.(); s.cleanup = undefined; }); },
    strictReplay() { frame.slots.forEach(s => { s.cleanup?.(); s.cleanup = s.effect?.() || undefined; }); },
  }; app.render(); return app;
}
function target() { const captured = new Set<number>(); return { ownerSVGElement: { getBoundingClientRect: () => ({ left: 12, top: 90, width: 350, height: 280 }) }, setPointerCapture: vi.fn((id: number) => captured.add(id)), hasPointerCapture: (id: number) => captured.has(id), releasePointerCapture: vi.fn((id: number) => captured.delete(id)) }; }
function pointer(targetElement: ReturnType<typeof target>, angle: number, overrides: Record<string, unknown> = {}) { const p = refractionAnglePoint(angle, 141, 'incident'); return { currentTarget: targetElement, pointerId: 7, button: 0, clientX: 12 + p.x / 2, clientY: 130 + p.y / 2, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...overrides }; }

describe('refraction source actual component callbacks (in-memory SVG targets, not a browser)', () => {
  it('captures touch dragging and respects letterboxing, active pointer and cancellation', () => {
    const change = vi.fn(), app = mount({ onChange: change }), handle = source(app.tree), svg = target();
    run(handle, 'onPointerDown', pointer(svg, 40, { pointerType: 'touch' }));
    expect(svg.setPointerCapture).toHaveBeenCalledWith(7); expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: 40 });
    run(handle, 'onPointerMove', pointer(svg, 60, { pointerId: 8 })); expect(change).toHaveBeenCalledTimes(1);
    run(handle, 'onPointerUp', pointer(svg, 60, { pointerId: 8 }));
    run(handle, 'onPointerMove', pointer(svg, 60)); expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: 60 });
    run(handle, 'onPointerCancel', pointer(svg, 60)); expect(svg.releasePointerCapture).toHaveBeenCalledWith(7);
    run(handle, 'onPointerMove', pointer(svg, 20)); expect(change).toHaveBeenCalledTimes(2); app.unmount();
  });
  it('keyboard supports fine steps, larger steps and boundaries without mouse input', () => {
    const change = vi.fn(), app = mount({ onChange: change }), handle = source(app.tree), preventDefault = vi.fn();
    for (const [key, expected] of [['ArrowUp', 40.1], ['ArrowDown', 39.9], ['PageUp', 45], ['PageDown', 35], ['Home', 0], ['End', 85]] as const) {
      run(handle, 'onKeyDown', { key, preventDefault }); expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: expected });
    }
    expect(preventDefault).toHaveBeenCalledTimes(6); app.unmount();
  });
  it('does not let stale handlers write after read-only transition or unmount, and StrictMode remount remains interactive', () => {
    const change = vi.fn(), app = mount({ onChange: change }), first = source(app.tree), svg = target();
    app.strictReplay(); run(first, 'onKeyDown', { key: 'ArrowUp', preventDefault: vi.fn() }); expect(change).toHaveBeenCalledTimes(1);
    run(first, 'onPointerDown', pointer(svg, 40)); expect(change).toHaveBeenCalledTimes(2);
    app.render({ onChange: undefined }); run(first, 'onPointerMove', pointer(svg, 60)); expect(change).toHaveBeenCalledTimes(2);
    app.unmount(); expect(svg.releasePointerCapture).toHaveBeenCalledWith(7);
    run(first, 'onKeyDown', { key: 'End', preventDefault: vi.fn() }); expect(change).toHaveBeenCalledTimes(2);
  });
  it('renders exact grazing at the interface, hides transmission only after crossing the critical angle', () => {
    const parameters = { ...defaultHighSchoolParameters('refractive-index'), incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: Math.asin(1 / 1.5) * 180 / Math.PI };
    const exact = renderToStaticMarkup(<RefractionDiagram experimentId="refractive-index" parameters={parameters} simulation={simulateHighSchoolExperiment('refractive-index', parameters)} />);
    expect(exact).toContain('data-transmitted-ray'); expect(exact).toContain('临界掠射'); expect(exact).toContain('≈41.81°'); expect(exact).toContain('90°');
    parameters.incidentAngleDegrees += .5;
    const total = renderToStaticMarkup(<RefractionDiagram experimentId="refractive-index" parameters={parameters} simulation={simulateHighSchoolExperiment('refractive-index', parameters)} />);
    expect(total).not.toContain('data-transmitted-ray'); expect(total).toContain('无折射光'); expect(total).not.toMatch(/NaN|undefined/);
  });
});
