import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Euler, Vector3 } from 'three';
import type { CapacitorMode } from '@physics-lab/contracts';
import { createCapacitorHistory, simulateHighSchoolExperiment, switchCapacitorMode } from '@physics-lab/physics/high-school';
import { CapacitorDiagram } from './CapacitorDiagram';
import { CapacitorApparatus3D } from './CapacitorApparatus3D';
import { CapacitorModeButtons, type CapacitorSceneProps, type CapacitorSwitchProps } from './CapacitorSwitchControl';
import { CAPACITOR_WIRES, capacitorWorldPoint } from './capacitorGeometry';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, id: 0 }));
// Actual component callbacks with controlled hooks. R3F event objects are explicit
// doubles; this does not test browser hit targets, OrbitControls or GPU rendering.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useRef: (initial: unknown) => { if (!hooks.frame) return actual.useRef(initial); const item = slot(); if (!Object.hasOwn(item, 'value')) item.value = { current: initial }; return item.value; },
    useId: () => { if (!hooks.frame) return actual.useId(); const item = slot(); if (!item.value) item.value = `capacitor-event-${++hooks.id}`; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!hooks.frame) return actual.useEffect(effect, deps);
      const item = slot();
      if (!deps || !item.deps || deps.length !== item.deps.length || deps.some((value, i) => !Object.is(value, item.deps![i]))) {
        item.deps = deps; hooks.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; });
      }
    },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ''; }
function invoke(element: Element, eventName: string, event: unknown = {}) { (element.props[eventName] as (event: unknown) => void)(event); }
const cleanups: Array<() => void> = [];
function mount<P extends object>(component: (props: P) => ReactNode, initial: P) {
  let props = initial; const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode,
    render(next: Partial<P> = {}) { props = { ...props, ...next }; frame.cursor = 0; hooks.frame = frame; try { app.tree = component(props); } finally { hooks.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); },
    get props() { return props; },
    unmount() { frame.slots.forEach((slot) => { slot.cleanup?.(); slot.cleanup = undefined; }); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
const parameters = { resistanceKOhm: 10, capacitanceMicrofarads: 470, emf: 6 };
function scene(mode: CapacitorMode = 'charge', time = 4.7): CapacitorSceneProps {
  let history = createCapacitorHistory('callback-fixture');
  if (mode !== 'charge') history = switchCapacitorMode(parameters, history, 4.7, mode);
  return { parameters, mode, simulation: simulateHighSchoolExperiment('capacitor-charge', parameters, time, history), onModeChange: vi.fn() };
}
function contact(tree: ReactNode, mode: CapacitorMode) { return nodes(tree).find((node) => node.props['data-capacitor-switch'] === mode)!; }
function switchMesh(tree: ReactNode, mode: CapacitorMode) { return nodes(tree).find((node) => (node.props.userData as { capacitorSwitch?: string } | undefined)?.capacitorSwitch === mode)!; }
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); });

describe('capacitor switch actual callbacks', () => {
  it('makes mode changes explicit through native buttons, without inventing parameters, time or history', () => {
    const change = vi.fn(); const app = mount<CapacitorSwitchProps>(CapacitorModeButtons, { mode: 'charge', onModeChange: change });
    const buttons = nodes(app.tree).filter((node) => node.type === 'button');
    invoke(buttons.find((node) => text(node).startsWith('接电源'))!, 'onClick'); expect(change).not.toHaveBeenCalled();
    invoke(buttons.find((node) => text(node).startsWith('开路保持'))!, 'onClick');
    expect(change.mock.calls).toEqual([['open']]); expect(app.props.mode).toBe('charge');
    app.render({ mode: 'open' });
    invoke(nodes(app.tree).find((node) => node.type === 'button' && text(node).startsWith('经电阻放电'))!, 'onClick');
    expect(change.mock.calls).toEqual([['open'], ['discharge']]);
  });

  it('supports SVG Enter/Space and clicks with the same single mode-only command', () => {
    const props = scene(), change = vi.fn(); const app = mount(CapacitorDiagram, { ...props, onModeChange: change });
    const original = JSON.stringify(props.simulation);
    const ignored = { key: 'ArrowRight', preventDefault: vi.fn() };
    invoke(contact(app.tree, 'open'), 'onKeyDown', ignored); expect(ignored.preventDefault).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
    const enter = { key: 'Enter', preventDefault: vi.fn() };
    invoke(contact(app.tree, 'open'), 'onKeyDown', enter); expect(enter.preventDefault).toHaveBeenCalledOnce(); expect(change).toHaveBeenLastCalledWith('open');
    app.render({ mode: 'open' });
    const space = { key: ' ', preventDefault: vi.fn() };
    invoke(contact(app.tree, 'discharge'), 'onKeyDown', space); expect(change).toHaveBeenLastCalledWith('discharge');
    app.render({ mode: 'discharge' }); invoke(contact(app.tree, 'charge'), 'onClick'); expect(change).toHaveBeenLastCalledWith('charge');
    expect(JSON.stringify(props.simulation)).toBe(original); expect(Object.keys(props.parameters)).toHaveLength(3);
  });

  it('refuses old SVG and button handlers after disabling, removing the callback or unmounting', () => {
    const change = vi.fn(); const diagram = mount(CapacitorDiagram, { ...scene(), onModeChange: change });
    const old = contact(diagram.tree, 'open'); diagram.render({ switchDisabled: true }); invoke(old, 'onClick'); expect(change).not.toHaveBeenCalled();
    diagram.render({ switchDisabled: false, onModeChange: undefined }); invoke(old, 'onClick'); expect(change).not.toHaveBeenCalled();
    diagram.render({ onModeChange: change }); diagram.unmount(); invoke(old, 'onClick'); expect(change).not.toHaveBeenCalled();
    const buttons = mount<CapacitorSwitchProps>(CapacitorModeButtons, { mode: 'charge', onModeChange: change });
    const oldButton = nodes(buttons.tree).find((node) => node.type === 'button' && text(node).startsWith('开路保持'))!;
    buttons.render({ switchDisabled: true }); invoke(oldButton, 'onClick'); expect(change).not.toHaveBeenCalled();
    buttons.render({ switchDisabled: false }); buttons.unmount(); invoke(oldButton, 'onClick'); expect(change).not.toHaveBeenCalled();
  });

  it('uses Three click movement evidence to reject camera drags and right clicks, and guards old mesh handlers', () => {
    const change = vi.fn(); const app = mount(CapacitorApparatus3D, { ...scene(), onModeChange: change });
    const open = switchMesh(app.tree, 'open');
    for (const event of [{ delta: 15, button: 0 }, { delta: 0, button: 2 }, { button: 0 }]) invoke(open, 'onClick', { ...event, stopPropagation: vi.fn() });
    expect(change).not.toHaveBeenCalled();
    invoke(open, 'onClick', { delta: .5, button: 0, stopPropagation: vi.fn() }); expect(change.mock.calls).toEqual([['open']]);
    app.render({ switchDisabled: true }); invoke(open, 'onClick', { delta: 0, button: 0, stopPropagation: vi.fn() }); expect(change).toHaveBeenCalledOnce();
    app.render({ switchDisabled: false }); app.unmount(); invoke(open, 'onClick', { delta: 0, button: 0, stopPropagation: vi.fn() }); expect(change).toHaveBeenCalledOnce();
  });

  it('lets parent-owned history maintain voltage across charge/open/discharge and a view remount', () => {
    let history = createCapacitorHistory('parent-run'), time = 4.7;
    const sent: CapacitorMode[] = [];
    const props = (): CapacitorSceneProps => {
      const simulation = simulateHighSchoolExperiment('capacitor-charge', parameters, time, history);
      return { parameters, simulation, mode: simulation.capacitor!.mode, onModeChange: (mode) => { sent.push(mode); history = switchCapacitorMode(parameters, history, time, mode); } };
    };
    const diagram = mount(CapacitorDiagram, props()); const before = diagram.props.simulation.state;
    invoke(contact(diagram.tree, 'open'), 'onClick'); diagram.render(props());
    expect(diagram.props.simulation.state.voltage).toBe(before.voltage); expect(diagram.props.simulation.state.charge).toBe(before.charge);
    time = 9.4; diagram.render(props()); expect(diagram.props.simulation.state.voltage).toBe(before.voltage);
    const retainedHistory = JSON.stringify(history); diagram.unmount(); const three = mount(CapacitorApparatus3D, props());
    expect(JSON.stringify(history)).toBe(retainedHistory); expect(sent).toEqual(['open']);
    invoke(switchMesh(three.tree, 'discharge'), 'onClick', { delta: 0, button: 0, stopPropagation() {} }); three.render(props());
    expect(three.props.simulation.state.voltage).toBe(before.voltage); expect(three.props.simulation.state.current).toBeLessThan(0);
    time = 14.1; three.render(props()); expect(three.props.simulation.state.voltage).toBeLessThan(before.voltage);
    const beforeReconnect = three.props.simulation.state.voltage;
    invoke(switchMesh(three.tree, 'charge'), 'onClick', { delta: 0, button: 0, stopPropagation() {} }); three.render(props());
    expect(three.props.simulation.state.voltage).toBe(beforeReconnect); expect(three.props.simulation.state.current).toBeGreaterThan(0);
    expect(history.segments.map((segment) => segment.mode)).toEqual(['charge', 'open', 'discharge', 'charge']);
    expect(sent).toEqual(['open', 'discharge', 'charge']);
  });

  it('renders every shared wire in Three, with the current cone aligned to its real world direction', () => {
    const app = mount(CapacitorApparatus3D, scene('discharge', 9.4));
    const wires = nodes(app.tree).filter((node) => (node.props.userData as { capacitorWire?: string } | undefined)?.capacitorWire);
    expect(wires).toHaveLength(CAPACITOR_WIRES.length);
    for (const wire of CAPACITOR_WIRES) {
      expect(wires.find((node) => (node.props.userData as { capacitorWire: string }).capacitorWire === wire.id)!.props.points).toEqual(wire.points.map((point) => capacitorWorldPoint(point)));
    }
    const arrow = nodes(app.tree).find((node) => (node.props.userData as { capacitorCurrentDirection?: number } | undefined)?.capacitorCurrentDirection === -1)!;
    const arrowElement = arrow.props.children as Element;
    const renderedArrow = (arrowElement.type as (props: Record<string, unknown>) => ReactNode)(arrowElement.props);
    const cone = nodes(renderedArrow).find((node) => node.type === 'mesh')!;
    const [x, y, z] = cone.props.rotation as [number, number, number];
    const axis = new Vector3(0, 1, 0).applyEuler(new Euler(x, y, z));
    const start = arrowElement.props.start as number[], end = arrowElement.props.end as number[];
    expect(axis.x).toBeCloseTo(-1, 12); expect(end[0]).toBeLessThan(start[0]!);
    app.render(scene('open', 9.4)); expect(nodes(app.tree).some((node) => (node.props.userData as { capacitorCurrentDirection?: number } | undefined)?.capacitorCurrentDirection)).toBe(false);
  });
});
