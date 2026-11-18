import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { ForceCompositionDiagram, type ForceCompositionDiagramProps } from './ForceCompositionDiagram';
import { ForceCompositionControl } from './ForceCompositionControl';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, nextId: 0 }));

// Runs the production callbacks and effect cleanup with an in-memory hook frame.
// The SVG and pointer targets below are explicit test doubles, not a browser test.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => {
    const frame = harness.frame!;
    return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {});
  };
  return { ...actual,
    useState: (initial: unknown) => {
      if (!harness.frame) return actual.useState(initial);
      const item = slot();
      if (!Object.hasOwn(item, 'value')) item.value = typeof initial === 'function' ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!harness.frame) return actual.useRef(initial);
      const item = slot();
      if (!Object.hasOwn(item, 'value')) item.value = { current: initial };
      return item.value;
    },
    useId: () => {
      if (!harness.frame) return actual.useId();
      const item = slot();
      if (!item.value) item.value = `force-test-${++harness.nextId}`;
      return item.value;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!harness.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.deps = deps;
        harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});

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
function handler(element: Element, name: string, event: unknown) { (element.props[name] as (event: unknown) => void)(event); }
function handle(tree: ReactNode, name: string) { return walk(tree).find((item) => item.props['data-force-handle'] === name)!; }
function button(tree: ReactNode, label: string) { return walk(tree).find((item) => item.type === 'button' && text(item).includes(label))!; }
const cleanups: Array<() => void> = [];
function mountDiagram(overrides: Partial<ForceCompositionDiagramProps> = {}) {
  let parameters = defaultHighSchoolParameters('force-composition');
  let props: ForceCompositionDiagramProps = { parameters, simulation: simulateHighSchoolExperiment('force-composition', parameters), onChange: vi.fn(), ...overrides };
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render(next: Partial<ForceCompositionDiagramProps> = {}) {
      props = { ...props, ...next }; parameters = props.parameters;
      if (next.parameters && !next.simulation) props.simulation = simulateHighSchoolExperiment('force-composition', parameters);
      frame.cursor = 0; harness.frame = frame;
      try { app.tree = ForceCompositionDiagram(props); } finally { harness.frame = null; }
      frame.effects.splice(0).forEach((effect) => effect()); return app.tree;
    },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
    get props() { return props; },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
function target(rect = { left: 20, top: 30, width: 700, height: 380 }) {
  const captured = new Set<number>();
  return { ownerSVGElement: { getBoundingClientRect: () => rect },
    setPointerCapture: vi.fn((id: number) => { captured.add(id); }),
    hasPointerCapture: vi.fn((id: number) => captured.has(id)),
    releasePointerCapture: vi.fn((id: number) => { captured.delete(id); }) };
}
function pointer(element: ReturnType<typeof target>, clientX: number, clientY: number, overrides: Record<string, unknown> = {}) {
  return { currentTarget: element, clientX, clientY, pointerId: 7, pointerType: 'mouse', button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...overrides };
}
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('force board actual component event callbacks', () => {
  it('captures a pointer and atomically drags one force on a narrow letterboxed SVG', () => {
    const change = vi.fn(); const app = mountDiagram({ onChange: change });
    const element = target({ left: 12, top: 90, width: 350, height: 280 });
    const first = handle(app.tree, 'force1');
    // 350 × 280 has scale 0.5 and 45 px vertical letterboxing.
    handler(first, 'onPointerDown', pointer(element, 12 + 392 / 2, 90 + 45 + 190 / 2));
    expect(element.setPointerCapture).toHaveBeenCalledExactlyOnceWith(7);
    expect(change).toHaveBeenLastCalledWith({ force1N: 3, angle1Degrees: 0 });
    handler(first, 'onPointerMove', pointer(element, 12 + 350 / 2, 90 + 45 + 120 / 2));
    expect(change).toHaveBeenLastCalledWith({ force1N: 5, angle1Degrees: 90 });
    expect(change.mock.calls.every(([patch]) => Object.keys(patch).length === 2 && !('trialForceN' in patch))).toBe(true);
    expect(app.props.parameters).toEqual(defaultHighSchoolParameters('force-composition'));
    handler(first, 'onPointerUp', pointer(element, 0, 0));
    expect(element.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7);
    const count = change.mock.calls.length;
    handler(first, 'onPointerMove', pointer(element, 400, 400));
    expect(change).toHaveBeenCalledTimes(count);
  });

  it('uses the SVG screen matrix when CSS transformation makes its bounding box insufficient', () => {
    const change = vi.fn(); const app = mountDiagram({ onChange: change });
    const inverse = vi.fn(() => ({ mappedX: 308, mappedY: 134 }));
    const transform = vi.fn((matrix: { mappedX: number; mappedY: number }) => ({ x: matrix.mappedX, y: matrix.mappedY }));
    vi.stubGlobal('DOMPoint', class { matrixTransform = transform; });
    const element = { ...target(), ownerSVGElement: { getScreenCTM: () => ({ inverse }), getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 0, height: 0 })) } };
    handler(handle(app.tree, 'force2'), 'onPointerDown', pointer(element, 910, 620));
    expect(inverse).toHaveBeenCalledOnce();
    expect(transform).toHaveBeenCalledOnce();
    expect(element.ownerSVGElement.getBoundingClientRect).not.toHaveBeenCalled();
    expect(change).toHaveBeenCalledExactlyOnceWith({ force2N: 5, angle2Degrees: 126.9 });
  });

  it('ignores secondary mouse buttons and a second pointer while preserving the captured drag', () => {
    const change = vi.fn(); const app = mountDiagram({ onChange: change }); const element = target();
    const first = handle(app.tree, 'force1'), second = handle(app.tree, 'force2');
    handler(first, 'onPointerDown', pointer(element, 412, 220, { button: 2 }));
    expect(change).not.toHaveBeenCalled();
    handler(first, 'onPointerDown', pointer(element, 412, 220));
    handler(second, 'onPointerDown', pointer(element, 370, 164, { pointerId: 8, pointerType: 'touch' }));
    handler(first, 'onPointerMove', pointer(element, 370, 164, { pointerId: 8 }));
    handler(second, 'onPointerMove', pointer(element, 370, 164));
    handler(first, 'onPointerUp', pointer(element, 0, 0, { pointerId: 8 }));
    expect(change).toHaveBeenCalledTimes(1);
    expect(element.releasePointerCapture).not.toHaveBeenCalled();
    handler(first, 'onPointerMove', pointer(element, 370, 164));
    expect(change).toHaveBeenLastCalledWith({ force1N: 4, angle1Degrees: 90 });
  });

  it.each(['onPointerCancel', 'onLostPointerCapture'])('stops updates after %s', (eventName) => {
    const change = vi.fn(); const app = mountDiagram({ onChange: change }); const element = target();
    const first = handle(app.tree, 'force1');
    handler(first, 'onPointerDown', pointer(element, 412, 220));
    handler(first, eventName, pointer(element, 0, 0));
    handler(first, 'onPointerMove', pointer(element, 370, 164));
    expect(change).toHaveBeenCalledTimes(1);
    if (eventName === 'onPointerCancel') expect(element.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('releases capture when switching away or removing edit permission and rejects old handlers', () => {
    const change = vi.fn(); const app = mountDiagram({ onChange: change }); const element = target();
    const old = handle(app.tree, 'trial');
    handler(old, 'onPointerDown', pointer(element, 440, 220));
    app.render({ onChange: undefined });
    expect(element.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7);
    handler(old, 'onPointerMove', pointer(element, 510, 220));
    handler(old, 'onKeyDown', { key: 'End', preventDefault: vi.fn() });
    expect(change).toHaveBeenCalledTimes(1);
    app.render({ onChange: change });
    handler(handle(app.tree, 'trial'), 'onPointerDown', pointer(element, 440, 220));
    app.unmount();
    expect(element.releasePointerCapture).toHaveBeenCalledTimes(2);
    handler(old, 'onPointerMove', pointer(element, 510, 220));
    expect(change).toHaveBeenCalledTimes(2);
  });

  it('keeps current zero-force direction from the latest parameters when an old drag callback fires', () => {
    const change = vi.fn(); const app = mountDiagram({ onChange: change }); const element = target();
    const old = handle(app.tree, 'force1');
    handler(old, 'onPointerDown', pointer(element, 412, 220));
    app.render({ parameters: { ...app.props.parameters, angle1Degrees: 73 } });
    handler(old, 'onPointerMove', pointer(element, 370, 220));
    expect(change).toHaveBeenLastCalledWith({ force1N: 0, angle1Degrees: 73 });
  });

  it('allows choosing a zero-force handle and adjusting it with a keyboard without changing the trial', () => {
    const change = vi.fn(); const parameters = { ...defaultHighSchoolParameters('force-composition'), force1N: 0, force2N: 0, trialForceN: 0 };
    const app = mountDiagram({ parameters, simulation: simulateHighSchoolExperiment('force-composition', parameters), onChange: change });
    const selector = button(app.tree, '分力 F₁');
    handler(selector, 'onClick', undefined); app.render();
    const ordered = walk(app.tree).filter((item) => item.props['data-force-handle']);
    expect(ordered.at(-1)!.props['data-force-handle']).toBe('force1');
    expect(change).not.toHaveBeenCalled();
    const press = { key: 'ArrowUp', shiftKey: true, preventDefault: vi.fn() };
    handler(button(app.tree, '分力 F₁'), 'onKeyDown', press);
    expect(change).toHaveBeenCalledExactlyOnceWith({ force1N: 1, angle1Degrees: 0 });
    expect(press.preventDefault).toHaveBeenCalledOnce();
    app.render({ parameters: { ...parameters, force1N: 1 } });
    handler(handle(app.tree, 'force1'), 'onKeyDown', { key: 'ArrowLeft', shiftKey: false, preventDefault: vi.fn() });
    expect(change).toHaveBeenLastCalledWith({ force1N: 1, angle1Degrees: 1 });
    const tab = { key: 'Tab', shiftKey: false, preventDefault: vi.fn() };
    handler(handle(app.tree, 'force1'), 'onKeyDown', tab);
    expect(tab.preventDefault).not.toHaveBeenCalled(); expect(change).toHaveBeenCalledTimes(2);
  });

  it('executes each preset as one patch and records only after the explicit enabled record click', () => {
    const parameters = { ...defaultHighSchoolParameters('force-composition'), trialForceN: 2.7, trialAngleDegrees: -37 };
    const change = vi.fn(), record = vi.fn();
    const props = { parameters, simulation: simulateHighSchoolExperiment('force-composition', parameters), onChange: change, onRecord: record };
    const tree = ForceCompositionControl(props);
    for (const [label, expected] of [
      ['同向', { force1N: 3, force2N: 4, angle1Degrees: 0, angle2Degrees: 0 }],
      ['垂直', { force1N: 3, force2N: 4, angle1Degrees: 0, angle2Degrees: 90 }],
      ['反向', { force1N: 3, force2N: 4, angle1Degrees: 0, angle2Degrees: 180 }],
      ['相抵', { force1N: 3, force2N: 3, angle1Degrees: 0, angle2Degrees: 180 }],
    ] as const) {
      handler(button(tree, label), 'onClick', undefined); expect(change).toHaveBeenLastCalledWith(expected);
    }
    expect(change).toHaveBeenCalledTimes(4); expect(record).not.toHaveBeenCalled();
    expect(parameters.trialForceN).toBe(2.7); expect(parameters.trialAngleDegrees).toBe(-37);
    handler(button(tree, '记录这一组'), 'onClick', undefined); expect(record).toHaveBeenCalledOnce();
    const disabled = ForceCompositionControl({ ...props, recordDisabled: true });
    expect(button(disabled, '记录这一组').props.disabled).toBe(true);
    handler(button(disabled, '记录这一组'), 'onClick', undefined); expect(record).toHaveBeenCalledOnce();
    const readOnly = ForceCompositionControl({ ...props, onChange: undefined });
    expect(button(readOnly, '同向').props.disabled).toBe(true);
    handler(button(readOnly, '同向'), 'onClick', undefined); expect(change).toHaveBeenCalledTimes(4);
  });
});
