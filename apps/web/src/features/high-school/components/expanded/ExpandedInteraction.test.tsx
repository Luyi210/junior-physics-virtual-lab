import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Vector3 } from 'three';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { ExpandedDiagram2D } from './ExpandedDiagram2D';
import { ExpandedApparatus3D } from './ExpandedApparatus3D';
import { Action } from './DiagramPrimitives';
import { Arrow3D, SceneAction } from './ApparatusPrimitives3D';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import type { ExpandedExperimentId, Point2 } from './expandedGeometry';
import { multimeterWiring } from './multimeterGeometry';

type Slot = { value?: unknown; cleanup?: () => void; deps?: readonly unknown[] };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useRef: (value: unknown) => { if (!hooks.frame) return actual.useRef(value); const item = slot(); if (!item.value) item.value = { current: value }; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!hooks.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.deps = deps; hooks.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});
type Node = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Node[] { return Array.isArray(tree) ? tree.flatMap(nodes) : isValidElement<Record<string, unknown>>(tree) ? [tree, ...nodes(tree.props.children as ReactNode)] : []; }
function expand(node: Node): ReactNode { return (node.type as (props: Record<string, unknown>) => ReactNode)(node.props); }
function fire(node: Node, name = 'onClick', event: unknown = {}) { (node.props[name] as (event: unknown) => void)(event); }
function scene(id: ExpandedExperimentId, patch: Record<string, number> = {}): ExpandedSceneProps {
  const parameters = { ...defaultHighSchoolParameters(id), ...patch };
  return { experimentId: id, parameters, simulation: simulateHighSchoolExperiment(id, parameters, .3), onChange: vi.fn() };
}
const cleanup: Array<() => void> = [];
function mount(component: typeof ExpandedDiagram2D | typeof ExpandedApparatus3D, initial: ExpandedSceneProps) {
  let props = initial; const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render(next: Partial<ExpandedSceneProps> = {}) { props = { ...props, ...next }; frame.cursor = 0; hooks.frame = frame; let domain: ReactNode; try { domain = component(props); } finally { hooks.frame = null; } app.tree = expand(domain as Node); frame.effects.splice(0).forEach(effect => effect()); },
    unmount() { frame.slots.forEach(slot => { slot.cleanup?.(); slot.cleanup = undefined; }); },
  };
  app.render(); cleanup.push(() => app.unmount()); return app;
}
function action(tree: ReactNode, label: string) {
  const node = nodes(tree).find(item => (item.type === Action || item.type === SceneAction) && item.props.label === label)!;
  expect(node, label).toBeDefined(); return expand(node);
}
afterEach(() => cleanup.splice(0).forEach(fn => fn()));

describe('actual apparatus callbacks with hook lifecycle and explicit Three events', () => {
  it('supports click, Enter and Space for the same bounded radius change, without changing model state itself', () => {
    const props = scene('centripetal-force'), change = vi.fn(), app = mount(ExpandedDiagram2D, { ...props, onChange: change });
    const node = action(app.tree, '半径 +0.1 m') as Node;
    fire(node); fire(node, 'onKeyDown', { key: 'Enter', preventDefault: vi.fn() }); fire(node, 'onKeyDown', { key: ' ', preventDefault: vi.fn() });
    expect(change.mock.calls).toEqual([[{ radius: .6 }], [{ radius: .6 }], [{ radius: .6 }]]);
    fire(node, 'onKeyDown', { key: 'ArrowRight', preventDefault: vi.fn() }); expect(change).toHaveBeenCalledTimes(3);
    expect(props.parameters.radius).toBe(.5); expect(props.simulation.state.time).toBe(.3);
    app.render(scene('centripetal-force', { radius: 1 }));
    const bounded = app.tree; const fn = vi.fn(); app.render({ onChange: fn }); fire(action(app.tree, '半径 +0.1 m') as Node); expect(fn).toHaveBeenLastCalledWith({ radius: 1 }); expect(bounded).toBeTruthy();
  });

  it('changes instrument and invalidates contact atomically, requiring a new contact before reading', () => {
    let props = scene('precision-length', { contactMode: 2 }), patch: Record<string, number> = {};
    const app = mount(ExpandedDiagram2D, { ...props, onChange: value => { patch = value; } });
    // The precision subcomponent owns the drawing but not the parameter state.
    app.tree = expand(app.tree as Node);
    fire(action(app.tree, '改用测微器') as Node); expect(patch).toEqual({ instrument: 1, contactMode: 0 });
    props = scene('precision-length', { ...props.parameters, ...patch });
    expect(props.simulation.state.readingValid).toBe(0);
    app.render({ ...props, onChange: value => { patch = value; } }); app.tree = expand(app.tree as Node);
    fire(action(app.tree, '夹住物体') as Node); expect(patch).toEqual({ contactMode: 2 });
    expect(scene('precision-length', { ...props.parameters, ...patch }).simulation.state.readingValid).toBe(1);
  });

  it('changes polarity and switch parameters only; open induction still retains its emf', () => {
    const change = vi.fn(), app = mount(ExpandedDiagram2D, { ...scene('charged-particle-field'), onChange: change });
    fire(action(app.tree, '反转电荷符号') as Node); expect(change).toHaveBeenLastCalledWith({ chargeToMassMillions: -1 });
    fire(action(app.tree, '反转磁场') as Node); expect(change).toHaveBeenLastCalledWith({ magneticFieldMicrotesla: -10 });
    const induction = mount(ExpandedDiagram2D, { ...scene('induced-current'), onChange: change });
    fire(action(induction.tree, '断开线圈') as Node); expect(change).toHaveBeenLastCalledWith({ closed: 0 });
    const state = scene('induced-current', { closed: 0 }).simulation.state;
    expect(state.current).toBe(0); expect(state.emf).not.toBe(0);
  });

  it('blocks stale SVG actions after route change, callback removal and effect cleanup', () => {
    const change = vi.fn(), app = mount(ExpandedDiagram2D, { ...scene('centripetal-force'), onChange: change });
    const old = action(app.tree, '半径 +0.1 m') as Node;
    app.render({ onChange: undefined }); fire(old); expect(change).not.toHaveBeenCalled();
    app.render({ ...scene('gas-pressure-volume'), onChange: change }); fire(old); expect(change).not.toHaveBeenCalled();
    const current = action(app.tree, '压入 5 mL') as Node;
    app.unmount(); fire(current); expect(change).not.toHaveBeenCalled();
  });

  it('ignores a camera drag/right click but permits an actual switch click and equivalent keyboard button', () => {
    const change = vi.fn(), app = mount(ExpandedApparatus3D, { ...scene('induced-current'), onChange: change });
    const tree = action(app.tree, '断开回路'), mesh = nodes(tree).find(node => node.type === 'mesh')!, button = nodes(tree).find(node => node.type === 'button')!;
    for (const input of [{ delta: 8, button: 0 }, { delta: 0, button: 2 }, { button: 0 }]) fire(mesh, 'onClick', { ...input, stopPropagation: vi.fn() });
    expect(change).not.toHaveBeenCalled();
    fire(mesh, 'onClick', { delta: 0, button: 0, stopPropagation: vi.fn() }); fire(button);
    expect(change.mock.calls).toEqual([[{ closed: 0 }], [{ closed: 0 }]]);
    app.unmount(); fire(mesh, 'onClick', { delta: 0, button: 0, stopPropagation: vi.fn() }); fire(button); expect(change).toHaveBeenCalledTimes(2);
  });

  it('swaps refractive media in one command and hides the impossible transmitted arrow in total reflection', () => {
    const change = vi.fn(), app = mount(ExpandedApparatus3D, { ...scene('refractive-index', { incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: 60 }), onChange: change });
    app.tree = expand(app.tree as Node);
    expect(nodes(app.tree).filter(node => node.type === Arrow3D)).toHaveLength(2);
    const button = nodes(action(app.tree, '交换两侧介质')).find(node => node.type === 'button')!; fire(button);
    expect(change).toHaveBeenCalledOnce(); expect(change).toHaveBeenLastCalledWith({ incidentIndex: 1, transmittedIndex: 1.5 });
    app.render(scene('refractive-index')); app.tree = expand(app.tree as Node);
    expect(nodes(app.tree).filter(node => node.type === Arrow3D)).toHaveLength(3);
  });

  it('aligns real Three cone axes to model-supplied arrow direction without a fixed screen arrow', () => {
    for (const end of [[1, 0, 0], [0, -2, 0], [0, 0, -1]] as [number, number, number][]) {
      const tree = Arrow3D({ start: [0, 0, 0], end }), mesh = nodes(tree).find(node => node.type === 'mesh')!;
      const direction = new Vector3(0, 1, 0).applyQuaternion(mesh.props.quaternion as import('three').Quaternion);
      expect(direction.distanceTo(new Vector3(...end).normalize())).toBeLessThan(1e-12);
    }
    expect(Arrow3D({ start: [0, 0, 0], end: [0, 0, 0] })).toBeNull();
  });
});

function reachable(lines: Point2[][], start: Point2, end: Point2) {
  const key = (point: Point2) => `${point.x},${point.y}`, graph = new Map<string, Set<string>>();
  for (const line of lines) for (let i = 1; i < line.length; i++) {
    const a = key(line[i - 1]), b = key(line[i]); if (!graph.has(a)) graph.set(a, new Set()); if (!graph.has(b)) graph.set(b, new Set()); graph.get(a)!.add(b); graph.get(b)!.add(a);
  }
  const pending = [key(start)], seen = new Set<string>();
  while (pending.length) { const node = pending.pop()!; if (node === key(end)) return true; if (seen.has(node)) continue; seen.add(node); pending.push(...(graph.get(node) ?? [])); } return false;
}
describe('multimeter shared topology agrees with operational model', () => {
  const source = [{ x: 490, y: 80 }, { x: 510, y: 80 }], instrument = [{ x: 105, y: 291 }, { x: 221, y: 291 }];
  it.each([0, 1])('needs both external switches closed, and only series connection %s needs the meter to complete the load loop', connection => {
    for (const powerOn of [0, 1]) for (const circuitClosed of [0, 1]) {
      const props = scene('multimeter', { connection, functionMode: connection, powerOn, circuitClosed });
      const wire = multimeterWiring(props.parameters), left = { x: 488, y: 245 }, right = { x: 552, y: 245 };
      const withoutMeter = [...wire.wires, wire.powerSwitch, wire.circuitSwitch, source];
      const withMeter = [...withoutMeter, wire.redProbe, wire.blackProbe, ...(connection === 1 ? [instrument] : [])];
      expect(reachable(withMeter, left, right)).toBe(Boolean(powerOn && circuitClosed));
      expect(reachable(withoutMeter, left, right)).toBe(Boolean(powerOn && circuitClosed && connection === 0));
      expect(props.simulation.state.physicalCurrent > 0).toBe(Boolean(powerOn && circuitClosed));
    }
  });
  it('keeps isolated resistance detached from the external source, and reversing probes swaps only their real terminals', () => {
    const base = scene('multimeter', { connection: 2, functionMode: 2, powerOn: 0 });
    const wire = multimeterWiring(base.parameters);
    expect(wire.redProbe.at(-1)).toEqual({ x: wire.resistor.x - 32, y: wire.resistor.y });
    expect(wire.blackProbe.at(-1)).toEqual({ x: wire.resistor.x + 32, y: wire.resistor.y });
    const lines = [...wire.wires, wire.redProbe, wire.blackProbe, instrument, wire.powerSwitch, wire.circuitSwitch, source];
    expect(reachable(lines, wire.leftTerminal, source[0])).toBe(false);
    expect(base.simulation.state.readingValid).toBe(1);
    const reversed = multimeterWiring({ ...base.parameters, probesReversed: 1 });
    expect(reversed.redProbe.at(-1)).toEqual(wire.blackProbe.at(-1)); expect(reversed.blackProbe.at(-1)).toEqual(wire.redProbe.at(-1));
  });
});
