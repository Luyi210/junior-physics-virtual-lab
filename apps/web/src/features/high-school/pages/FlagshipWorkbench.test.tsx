import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { defaultHighSchoolParameters, highSchoolExperiment, simulateHighSchoolExperiment, type HighSchoolSimulation } from '@physics-lab/physics/high-school';
import type { LiliExperimentContext } from '@physics-lab/contracts';
import type { HighSchoolRecordScope } from '../../../data/highSchoolRecordScope';
import { HighSchoolWorkbench } from './HighSchoolExperimentPage';
import { CollisionLearningPanel } from '../components/flagship/CollisionLearningPanel';
import { RefractionLearningPanel } from '../components/flagship/RefractionLearningPanel';
import { MultimeterControlPanel } from '../components/flagship/MultimeterControlPanel';
import { PendulumDiagram } from '../components/flagship/PendulumDiagram';
import { ExperimentViewport } from '../components/ExperimentViewport';
import { ExperimentPlot } from '../components/ExperimentPlot';
import { ExperimentDiagram2D } from '../components/ExperimentDiagram2D';
import { ManualMeasurementPanel } from '../components/ManualMeasurementPanel';
import { ExperimentParameterControl } from '../components/ExperimentParameterControl';
import { LiliAssistant } from '../assistant/LiliAssistant';
import { LiliQuestionContext } from '../assistant/LiliQuestionContext';
import { getScopedMeasurementStore } from '../experiments/measurementStorage';
import { getScopedManualMeasurementRepository } from '../experiments/manualMeasurementRepository';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, time: 0, running: false, id: 0, resets: 0, context: null as LiliExperimentContext | null, scope: null as HighSchoolRecordScope | null, visit: 0, contextListeners: new Set<() => void>(), request: vi.fn() }));
// Execute actual workbench, child callbacks, model and isolated in-memory storage.
// Hook scheduling and the virtual clock are controlled doubles, not browser,
// WebGL, React reconciliation, real pointer capture or touchscreen acceptance.
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (item: Slot, deps?: readonly unknown[]) => !deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]));
  const memo = (factory: () => unknown, deps?: readonly unknown[]) => { const item = slot(); if (changed(item, deps)) { item.value = factory(); item.deps = deps; } return item.value; };
  return { ...actual,
    useState: (initial: unknown) => { if (!harness.frame) return actual.useState(initial); const item = slot(); if (!('value' in item)) item.value = typeof initial === 'function' ? initial() : initial; return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { if (!harness.frame) return actual.useRef(initial); const item = slot(); item.value ??= { current: initial }; return item.value; },
    useId: () => { if (!harness.frame) return actual.useId(); const item = slot(); item.value ??= `flagship-${++harness.id}`; return item.value; },
    useMemo: (factory: () => unknown, deps?: readonly unknown[]) => harness.frame ? memo(factory, deps) : actual.useMemo(factory, deps ?? []),
    useCallback: (callback: (...args: never[]) => unknown, deps?: readonly unknown[]) => harness.frame ? memo(() => callback, deps) : actual.useCallback(callback, deps ?? []),
    useSyncExternalStore: (subscribe: (listener: () => void) => () => void, snapshot: () => unknown, server?: () => unknown) => harness.frame ? snapshot() : actual.useSyncExternalStore(subscribe, snapshot, server),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (!harness.frame) return actual.useEffect(effect, deps); const item = slot(); if (changed(item, deps)) { item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
  };
});
vi.mock('../experiments/useExperimentClock', () => ({ useExperimentClock: (duration: number) => ({
  time: harness.time, running: harness.running,
  reset() { harness.time = 0; harness.running = false; harness.resets++; },
  toggle() { if (!harness.running && harness.time >= duration) harness.time = 0; harness.running = !harness.running; },
  step() { harness.running = false; harness.time = Math.min(duration, harness.time + 1 / 60); },
}) }));
vi.mock('../../../data/highSchoolContext', () => ({
  publishHighSchoolContext: (context: LiliExperimentContext | null) => { if (context?.experimentId !== harness.context?.experimentId) harness.visit++; harness.context = context; harness.contextListeners.forEach(listener => listener()); return true; },
  getHighSchoolContext: () => harness.context,
  getHighSchoolExperimentVisit: () => harness.visit,
  subscribeHighSchoolContext: (listener: () => void) => { harness.contextListeners.add(listener); return () => { harness.contextListeners.delete(listener); }; },
}));
vi.mock('../../../data/highSchoolRecordScope', async original => ({ ...await original<typeof import('../../../data/highSchoolRecordScope')>(), getHighSchoolRecordScope: () => harness.scope, subscribeHighSchoolRecordScope: () => () => {}, isCurrentHighSchoolRecordScope: () => true }));
vi.mock('../assistant/liliRequest', () => ({ canRequestLiliNetwork: () => false, requestLiliForScope: harness.request }));
vi.mock('../assistant/useCorgiAvatarRotation', () => ({ useCorgiAvatarRotation: () => ({ index: 0, setInteracting() {} }) }));

type Element = ReactElement<Record<string, unknown>>;
type FlagshipId = 'momentum-conservation' | 'refractive-index' | 'multimeter' | 'pendulum' | 'mechanical-energy' | 'force-composition' | 'emf-internal-resistance';
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ''; }
function button(tree: ReactNode, label: string) { const found = walk(tree).find(node => node.type === 'button' && (text(node).includes(label) || node.props['aria-label'] === label)); expect(found, label).toBeDefined(); return found!; }
function fire(node: Element, event = 'onClick', value: unknown = {}) { (node.props[event] as (value: unknown) => void)(value); }
function find(tree: ReactNode, component: unknown) { const node = walk(tree).find(item => item.type === component); expect(node).toBeDefined(); return node!; }
const cleanups: Array<() => void> = [];
beforeEach(() => {
  harness.time = 0; harness.running = false; harness.resets = 0; harness.context = null; harness.scope = null; harness.visit = 0; harness.contextListeners.clear(); harness.request.mockReset();
  const entries = new Map<string, string>();
  const storage: Storage = { get length() { return entries.size; }, key: i => [...entries.keys()][i] ?? null, getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: key => { entries.delete(key); }, clear: () => entries.clear() };
  vi.stubGlobal('window', { localStorage: storage, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

function mount(id: FlagshipId, scope: HighSchoolRecordScope = { key: crypto.randomUUID(), mode: 'guest', label: 'test', canWrite: true, authChannel: null, revision: 1 }) {
  harness.scope = scope;
  const frames = new Map<string, Frame>();
  function invoke(key: string, component: (props: never) => ReactNode, props: unknown) {
    let frame = frames.get(key); if (!frame) { frame = { slots: [], cursor: 0, effects: [] }; frames.set(key, frame); }
    frame.cursor = 0; harness.frame = frame; let result: ReactNode;
    try { result = component(props as never); } finally { harness.frame = null; }
    frame.effects.splice(0).forEach(effect => effect()); return result;
  }
  function expand(key: string, element: Element) { return invoke(key, element.type as (props: never) => ReactNode, element.props); }
  const app = {
    tree: null as ReactNode,
    scope,
    render(time = harness.time) { harness.time = time; app.tree = invoke('workbench', HighSchoolWorkbench, { definition: highSchoolExperiment(id), scope }); return app.tree; },
    viewport() { return find(app.tree, ExperimentViewport); },
    view() { expand('viewport', app.viewport()); return expand('viewport', app.viewport()); },
    parameter(key: string) { const node = walk(app.tree).find(node => node.type === ExperimentParameterControl && (node.props.parameter as { key: string }).key === key); expect(node).toBeDefined(); return expand(`parameter:${key}`, node!); },
    lili() { return expand('lili-conversation', invoke('lili-outer', LiliAssistant, {}) as Element); },
    ask(question: string) {
      let tree = app.lili();
      if (!walk(tree).some(node => node.type === 'textarea')) { fire(button(tree, '和力力讨论实验')); tree = app.lili(); }
      const input = walk(tree).find(node => node.type === 'textarea')!;
      fire(input, 'onChange', { target: { value: question } }); tree = app.lili();
      fire(find(tree, 'form'), 'onSubmit', { preventDefault() {} }); return app.lili();
    },
    plot() { return expand('plot', find(app.tree, ExperimentPlot)); },
    get parameters() { return app.viewport().props.parameters as Record<string, number>; },
    get state() { return (app.viewport().props.simulation as HighSchoolSimulation).state; },
    panel(component: typeof CollisionLearningPanel | typeof RefractionLearningPanel | typeof MultimeterControlPanel) { return expand('panel', find(app.tree, component)); },
    records() { return getScopedMeasurementStore(id, scope.key).read().records; },
    save() { const control = button(app.tree, '记录这组读数'); expect(control.props.disabled).toBe(false); fire(control); app.render(); },
    manualProps() { return find(app.tree, ManualMeasurementPanel).props; },
    manual() {
      const panel = expand('manual-panel', find(app.tree, ManualMeasurementPanel));
      const instrument = walk(panel).find(node => typeof node.type === 'function' && node.type.name === 'PendulumManualInstrument')!;
      expect(instrument).toBeDefined();
      // Observe state updates made by the real reset effect, with the same frame.
      expand('manual-instrument', instrument); return expand('manual-instrument', instrument);
    },
    releaseHandle() {
      const viewport = expand('viewport', app.viewport());
      const diagram = expand('diagram', find(viewport, ExperimentDiagram2D));
      const pendulum = expand('pendulum', find(diagram, PendulumDiagram));
      return walk(pendulum).find(node => node.props['data-pendulum-release'])!;
    },
    manualRecords() { return getScopedManualMeasurementRepository('pendulum', scope.key).read().records; },
    manualResult() { const result = walk(app.manual()).find(node => typeof node.type === 'function' && node.type.name === 'ManualResult'); expect(result).toBeDefined(); return expand('manual-result', result!); },
    unmount() { frames.forEach(frame => frame.slots.forEach(slot => { slot.cleanup?.(); slot.cleanup = undefined; })); frames.clear(); },
  };
  cleanups.push(app.unmount);
  app.render(); return app;
}
const cycleInput = (tree: ReactNode) => walk(tree).find(node => node.type === 'input' && node.props.placeholder === '由你计数后填写')!;

describe('mobile two-dimensional workbench journeys (controlled hooks and storage, not a browser)', () => {
  it.each(['pendulum', 'force-composition', 'emf-internal-resistance'] as const)('edits %s, asks Lili about the captured state, and reopens the saved archive', id => {
    const app = mount(id);
    expect(find(app.view(), 'section').props['data-mode']).toBe('2d');
    expect(find(app.view(), ExperimentDiagram2D).props.onParametersChange).toBe(app.viewport().props.onParametersChange);
    const parameter = highSchoolExperiment(id).parameters.find(parameter => !parameter.choices)!;
    const initial = app.parameters[parameter.key];
    const edited = initial + parameter.step <= parameter.max ? initial + parameter.step : initial - parameter.step;
    const numeric = () => walk(app.parameter(parameter.key)).find(node => node.props.className === 'hs-parameter-number')!;
    fire(numeric(), 'onChange', { target: { value: String(edited) } });
    expect(app.parameters[parameter.key]).toBe(initial);
    fire(numeric(), 'onBlur'); app.render();
    expect(app.parameters[parameter.key]).toBeCloseTo(edited);
    const duration = (app.viewport().props.simulation as HighSchoolSimulation).durationSeconds;
    if (duration > 0) {
      fire(button(app.tree, '播放实验')); app.render(); expect(harness.running).toBe(true);
      app.render(1.25); fire(button(app.tree, '暂停实验')); app.render();
      expect(harness.running).toBe(false);
      fire(button(app.tree, '单步')); app.render(); expect(harness.time).toBeCloseTo(1.25 + 1 / 60);
    } else expect(button(app.tree, '播放实验').props.disabled).toBe(true);
    app.save(); const saved = structuredClone(app.records());
    expect(saved).toHaveLength(1); expect(saved[0].parameters[parameter.key]).toBeCloseTo(edited);
    expect(saved[0].timeSeconds).toBe(harness.time);
    // A new storage handle proves persistence, not just the workbench's in-memory list.
    expect(getScopedMeasurementStore(id, app.scope.key, window.localStorage).read()).toMatchObject({ failed: false, records: saved });
    const discussion = app.ask('帮我检查当前实验');
    const question = find(discussion, LiliQuestionContext).props.captured as LiliExperimentContext;
    expect(question.parameters).toEqual(app.parameters); expect(question.timeSeconds).toBe(harness.time);
    expect(question.samples).toEqual(saved.map(({ id, timeSeconds, parameters }) => ({ id, timeSeconds, parameters })));
    expect(text(discussion)).toContain('力力 · 本地引导'); expect(harness.request).not.toHaveBeenCalled();
    app.unmount(); expect(harness.context).toBeNull();
    harness.time = 0; harness.running = false;
    const reopened = mount(id, app.scope);
    expect(reopened.records()).toEqual(saved);
    expect(reopened.parameters).toEqual(defaultHighSchoolParameters(id));
    expect(harness.context?.recordCount).toBe(1);
    const followUp = find(reopened.ask('检查我的记录'), LiliQuestionContext).props.captured as LiliExperimentContext;
    expect(followUp.parameters).toEqual(defaultHighSchoolParameters(id));
    expect(followUp.samples).toEqual(question.samples);
    expect(followUp.samples![0].parameters[parameter.key]).toBeCloseTo(edited);
    expect(harness.request).not.toHaveBeenCalled();
  });

  it('persists a student-operated pendulum stopwatch reading and restores it as manual evidence for Lili', () => {
    const app = mount('pendulum');
    expect(cycleInput(app.manual()).props.value).toBe('');
    fire(button(app.manual(), '开始计时'));
    fire(button(app.manual(), '播放摆动')); app.render(4.02);
    fire(button(app.manual(), '停止计时'));
    fire(cycleInput(app.manual()), 'onChange', { target: { value: '2' } });
    const save = button(app.manualResult(), '保存这次手动读数'); expect(save.props.disabled).toBe(false); fire(save);
    app.manual(); app.render();
    const saved = structuredClone(app.manualRecords());
    expect(saved).toHaveLength(1); expect(app.records()).toEqual([]);
    expect(harness.context?.manualRecordCount).toBe(1);
    const captured = find(app.ask('看看我的手动读数'), LiliQuestionContext).props.captured as LiliExperimentContext;
    expect(captured.manualRecordCount).toBe(1); expect(captured.manualSamples).toHaveLength(1);
    expect(captured.recordCount).toBe(0); expect(captured.manualSamples![0].readings).toMatchObject({ startTimeSeconds: 0, endTimeSeconds: 4.02, periodCount: 2 });
    app.unmount(); harness.time = 0; harness.running = false;
    const reopened = mount('pendulum', app.scope); reopened.manual(); reopened.render();
    expect(reopened.manualRecords()).toEqual(saved); expect(reopened.records()).toEqual([]);
    expect(cycleInput(reopened.manual()).props.value).toBe('');
    const restored = find(reopened.ask('看看我的手动读数'), LiliQuestionContext).props.captured as LiliExperimentContext;
    expect(restored.manualSamples).toEqual(captured.manualSamples); expect(harness.request).not.toHaveBeenCalled();
  });
});

describe('four flagship controls integrated with the actual workbench (controlled hooks, not a browser)', () => {
  it('returns a completed collision to its original pre-collision state when e changes, retaining the old evidence', () => {
    const app = mount('momentum-conservation'); app.render(app.state.collisionTime + .2);
    expect(app.state.collided).toBe(1); app.save(); const saved = structuredClone(app.records());
    const parameters = { ...app.parameters }; harness.running = true; app.render();
    fire(button(app.panel(CollisionLearningPanel), '0 · 完全非弹性')); app.render();
    expect(app.parameters).toEqual({ ...parameters, restitution: 0 }); expect(harness.time).toBe(0); expect(harness.running).toBe(false);
    expect(app.state.collided).toBe(0); expect(app.state.velocity1).toBe(parameters.velocity1); expect(app.state.velocity2).toBe(parameters.velocity2);
    expect(text(app.panel(CollisionLearningPanel))).toContain('当前仍在碰前'); expect(app.records()).toEqual(saved);
    expect(harness.context!.samples).toHaveLength(1); expect(harness.context!.samples![0]!.parameters).toEqual(saved[0]!.parameters);
  });

  it('applies a new collision starting scenario without changing e or automatically recording its predicted values', () => {
    const app = mount('momentum-conservation'); app.render(.2); app.save(); const saved = structuredClone(app.records()), e = app.parameters.restitution;
    fire(button(app.panel(CollisionLearningPanel), '相互远离')); app.render();
    expect(app.parameters).toMatchObject({ mass1: .5, mass2: .5, velocity1: -1, velocity2: 1, separation: 1, restitution: e });
    expect(harness.time).toBe(0); expect(app.state.collisionTimeDefined).toBe(0); expect(text(app.panel(CollisionLearningPanel))).toContain('当前两车不会相遇');
    app.render(6); app.panel(CollisionLearningPanel); expect(app.records()).toEqual(saved);
  });

  it('passes media exchange and unrounded critical-angle controls to the model while retaining the saved refracted snapshot', () => {
    const app = mount('refractive-index'); app.save(); const first = structuredClone(app.records()[0]!), p = { ...app.parameters };
    fire(button(app.panel(RefractionLearningPanel), '交换两侧介质')); app.render();
    expect(app.parameters).toEqual({ ...p, incidentIndex: p.transmittedIndex, transmittedIndex: p.incidentIndex });
    const critical = app.state.criticalAngleDegrees;
    fire(button(app.panel(RefractionLearningPanel), '恰好临界 C')); app.render();
    expect(app.parameters.incidentAngleDegrees).toBe(critical); expect(app.state.refractedAngleDegrees).toBeCloseTo(90, 8); expect(app.state.totalInternalReflection).toBe(0);
    expect(app.records()).toEqual([first]); app.save(); const atCritical = structuredClone(app.records());
    expect(atCritical).toHaveLength(2); expect(atCritical.find(record => record.id === first.id)).toEqual(first);
    expect(atCritical.find(record => record.id !== first.id)!.parameters.incidentAngleDegrees).toBe(critical);
    fire(button(app.panel(RefractionLearningPanel), '超过临界 0.5°')); app.render();
    expect(app.state.totalInternalReflection).toBe(1); expect(app.parameters.incidentAngleDegrees).toBe(critical + .5);
    const noRefraction = button(app.tree, '记录这组读数'); expect(noRefraction.props.disabled).toBe(true);
    fire(noRefraction); app.render(); expect(app.records()).toEqual(atCritical);
    expect(harness.resets).toBe(3);
  });

  it('rejects saving a V-to-A function mismatch until the student selects series wiring, preserving range and supply settings', () => {
    const app = mount('multimeter'); expect(app.state.readingValid).toBe(1); app.save(); const original = structuredClone(app.records()[0]!), p = { ...app.parameters };
    fire(button(app.panel(MultimeterControlPanel), '直流电流')); app.render();
    expect(app.parameters).toEqual({ ...p, functionMode: 1 }); expect(app.state.readingValid).toBe(0);
    const invalidSave = button(app.tree, '记录这组读数'); expect(invalidSave.props.disabled).toBe(true);
    fire(invalidSave); app.render(); expect(app.records()).toEqual([original]); expect(text(app.tree)).toContain('无法取得有效读数');
    fire(button(app.panel(MultimeterControlPanel), '串入电流回路')); app.render();
    expect(app.parameters).toEqual({ ...p, functionMode: 1, connection: 1 }); expect(app.state.readingValid).toBe(1);
    expect(button(app.tree, '记录这组读数').props.disabled).toBe(false); expect(app.records()).toEqual([original]);
    app.save(); const current = app.records().find(record => record.id !== original.id)!;
    expect(current.parameters.rangeIndex).toBe(p.rangeIndex); expect(current.parameters.powerOn).toBe(p.powerOn);
    expect(current.metrics.find(metric => metric.key === 'meterValue')!.unit).toBe('A'); expect(original.metrics.find(metric => metric.key === 'meterValue')!.unit).toBe('V');
  });

  it('routes a pendulum release-key action through the viewport and parent, resetting both motion and unfinished manual timing', () => {
    const app = mount('pendulum'); app.render(1.25); app.save(); const saved = structuredClone(app.records());
    const before = app.parameters.amplitudeDegrees, reset = app.manualProps().resetToken as number;
    let manual = app.manual(); expect(cycleInput(manual).props.value).toBe(''); fire(button(manual, '开始计时'));
    manual = app.manual(); fire(cycleInput(manual), 'onChange', { target: { value: '3' } });
    harness.running = true; app.render(2); expect(cycleInput(app.manual()).props.value).toBe('3');
    fire(app.releaseHandle(), 'onKeyDown', { key: 'ArrowRight', shiftKey: false, preventDefault: vi.fn() }); app.render();
    expect(app.parameters.amplitudeDegrees).toBe(before + 1); expect(harness.time).toBe(0); expect(harness.running).toBe(false);
    expect(app.manualProps().resetToken).toBe(reset + 1); manual = app.manual();
    expect(cycleInput(manual).props.value).toBe(''); expect(button(manual, '停止计时').props.disabled).toBe(true);
    expect(app.manualRecords()).toEqual([]); expect(app.records()).toEqual(saved); expect(harness.context?.manualSamples ?? []).toEqual([]);
  });

  it('invalidates a stopwatch started at t=0 even when resetting leaves time and release conditions numerically unchanged', () => {
    const app = mount('pendulum'), parameters = { ...app.parameters }, initialToken = app.manualProps().resetToken as number;
    fire(button(app.manual(), '开始计时')); expect(button(app.manual(), '停止计时').props.disabled).toBe(false);
    fire(button(app.tree, '重新计时')); app.render();
    expect(harness.time).toBe(0); expect(app.parameters).toEqual(parameters); expect(app.manualProps().resetToken).toBe(initialToken + 1);
    const manual = app.manual(); expect(button(manual, '停止计时').props.disabled).toBe(true); expect(cycleInput(manual).props.value).toBe('');
    expect(app.records()).toEqual([]); expect(app.manualRecords()).toEqual([]);
  });
});

describe('mechanical-energy graph selection through actual workbench callbacks', () => {
  it('recalculates an unsampled pendulum time from the nonlinear model for the graph probe', () => {
    const app = mount('pendulum');
    const plot = find(app.tree, ExperimentPlot);
    const probeAtX = plot.props.probeAtX as (time: number) => { x: number; y: number };
    const sampleTime = 0.137;
    const expected = simulateHighSchoolExperiment('pendulum', app.parameters, sampleTime).state;
    const actual = probeAtX(sampleTime);
    expect(actual.x).toBeCloseTo(sampleTime, 12);
    expect(actual.y).toBeCloseTo(expected.angleDegrees, 12);
    expect((plot.props.series as HighSchoolSimulation['series'][number]).points.some(point => point.x === sampleTime)).toBe(false);
    expect(actual.y).not.toBe(app.state.angleDegrees);
    expect(app.viewport().props.simulation).toMatchObject({ state: { time: 0 } });
  });
  it('selects the energy-to-energy graph independently from the time graph sharing its y field', () => {
    const app = mount('mechanical-energy'); app.render(.2); app.save();
    const parameters = { ...app.parameters }, saved = structuredClone(app.records()), time = harness.time;
    const tabs = () => walk(app.tree).find(node => node.props.className === 'hs-chart-tabs')!;
    const controls = () => walk(tabs()).filter(node => node.type === 'button');
    expect(controls().filter(node => node.props['aria-pressed'])).toHaveLength(1);
    expect(new Set(controls().map(node => node.key)).size).toBe(4);
    fire(button(tabs(), '自动模型：动能增加—势能减少')); app.render();
    const energyPlot = find(app.tree, ExperimentPlot);
    expect(energyPlot.props.series).toMatchObject({ key: 'kineticEnergy', xKey: 'potentialEnergyLoss', xUnit: 'J' });
    expect(energyPlot.props.currentPoint).toEqual({ x: app.state.potentialEnergyLoss, y: app.state.kineticEnergy });
    expect(text(app.plot())).toContain('自释放点起势能减少量 / J');
    expect(controls().filter(node => node.props['aria-pressed']).map(node => text(node))).toEqual(['自动模型：动能增加—势能减少']);
    expect(app.parameters).toEqual(parameters); expect(harness.time).toBe(time); expect(app.records()).toEqual(saved);
    fire(button(tabs(), '动能—时间')); app.render();
    expect(find(app.tree, ExperimentPlot).props.series).toMatchObject({ key: 'kineticEnergy', xKey: 'time', xUnit: 's' });
    expect(text(app.plot())).toContain('时间 / s');
    expect(controls().filter(node => node.props['aria-pressed']).map(node => text(node))).toEqual(['动能—时间']);
  });

  it('keeps the selected relationship through clock advancement and parameter changes without changing archived data', () => {
    const app = mount('mechanical-energy'); app.render(.2); app.save();
    const saved = structuredClone(app.records());
    fire(button(app.tree, '自动模型：动能增加—势能减少')); app.render(.3);
    expect(find(app.tree, ExperimentPlot).props.currentPoint).toEqual({ x: app.state.potentialEnergyLoss, y: app.state.kineticEnergy });
    (app.viewport().props.onParametersChange as (patch: Record<string, number>) => void)({ resistanceRatio: .2 }); app.render(.25);
    expect(find(app.tree, ExperimentPlot).props.series).toMatchObject({ key: 'kineticEnergy', xKey: 'potentialEnergyLoss' });
    expect(find(app.tree, ExperimentPlot).props.currentPoint).toEqual({ x: app.state.potentialEnergyLoss, y: app.state.kineticEnergy });
    expect(app.state.kineticEnergy / app.state.potentialEnergyLoss).toBeCloseTo(.8, 10);
    expect(app.records()).toEqual(saved);
  });
});
