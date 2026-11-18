import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment, type ManualMeasurementResult } from '@physics-lab/physics/high-school';
import type { ManualMeasurementRecord } from '../experiments/useManualMeasurements';
import { MechanicalEnergyMeasurementPanel, type MechanicalEnergyMeasurementPanelProps } from './MechanicalEnergyMeasurementPanel';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const harness = vi.hoisted(() => ({ frame: null as Frame | null, nextId: 0 }));
const archive = vi.hoisted(() => ({ records: [] as ManualMeasurementRecord[], recovery: undefined as undefined | { records: ManualMeasurementRecord[]; excludedCount: number; reviewToken: string | null }, storageError: false, excludedCount: 0, actionError: '', save: vi.fn(), clear: vi.fn(), retryPending: vi.fn(), recoverPending: vi.fn(), exportCsv: vi.fn(), exportRecoveryCsv: vi.fn(), exportRecoveryBackup: vi.fn() }));
vi.mock('../experiments/useManualMeasurements', () => ({ useManualMeasurements: () => archive }));
// Production instrument callbacks and physics; React lifecycle/storage are explicit
// test doubles. Browser focus, SVG appearance and pointer behavior are not claimed.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  const slot = () => { const frame = harness.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  const changed = (item: Slot, deps?: readonly unknown[]) => !deps || !item.deps || deps.length !== item.deps.length || deps.some((value, index) => !Object.is(value, item.deps![index]));
  return { ...actual,
    useState: (initial: unknown) => { if (!harness.frame) return actual.useState(initial); const item = slot(); if (!('value' in item)) item.value = typeof initial === 'function' ? initial() : initial; return [item.value, (next: unknown) => { item.value = typeof next === 'function' ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { if (!harness.frame) return actual.useRef(initial); const item = slot(); if (!('value' in item)) item.value = { current: initial }; return item.value; },
    useMemo: (factory: () => unknown, deps?: readonly unknown[]) => { if (!harness.frame) return actual.useMemo(factory, deps ?? []); const item = slot(); if (changed(item, deps)) { item.value = factory(); item.deps = deps; } return item.value; },
    useId: () => { if (!harness.frame) return actual.useId(); const item = slot(); if (!item.value) item.value = `tape-${++harness.nextId}`; return item.value; },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (!harness.frame) return actual.useEffect(effect, deps); const item = slot(); if (changed(item, deps)) { item.deps = deps; harness.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ''; }
function button(tree: ReactNode, label: string) { const found = walk(tree).find((node) => node.type === 'button' && (text(node).includes(label) || node.props['aria-label'] === label)); expect(found, label).toBeDefined(); return found!; }
function click(node: Element) { (node.props.onClick as () => void)(); }
const fields = ['aBeforeMm', 'aCenterMm', 'aAfterMm', 'bBeforeMm', 'bCenterMm', 'bAfterMm'];
function input(tree: ReactNode, suffix: string) { return walk(tree).find((node) => node.type === 'input' && String(node.props.id).endsWith(`-${suffix}`))!; }
function change(node: Element, value: string) { (node.props.onChange as (event: unknown) => void)({ target: { value } }); }
let currentOwner = 'owner-a'; let writable = true;
const cleanups: Array<() => void> = [];
function baseProps(): MechanicalEnergyMeasurementPanelProps {
  const owner = currentOwner; const parameters = defaultHighSchoolParameters('mechanical-energy');
  return { parameters, timeSeconds: .24, simulation: simulateHighSchoolExperiment('mechanical-energy', parameters, .24), clockRunning: false, onClockToggle: vi.fn(), onClockStep: vi.fn(), resetToken: 0, scopeKey: owner, recordWritable: true, canWrite: () => currentOwner === owner && writable, canRead: () => currentOwner === owner, onRecordsChange: vi.fn() };
}
function mount(overrides: Partial<MechanicalEnergyMeasurementPanelProps> = {}) {
  let props = { ...baseProps(), ...overrides }; const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = { tree: null as ReactNode, get props() { return props; }, render(next: Partial<MechanicalEnergyMeasurementPanelProps> = {}) { props = { ...props, ...next }; props.simulation = simulateHighSchoolExperiment('mechanical-energy', props.parameters, props.timeSeconds); frame.cursor = 0; harness.frame = frame; try { app.tree = MechanicalEnergyMeasurementPanel(props); } finally { harness.frame = null; } frame.effects.splice(0).forEach((effect) => effect()); return app.tree; }, unmount() { frame.slots.forEach((slot) => { slot.cleanup?.(); slot.cleanup = undefined; }); } };
  app.render(); cleanups.push(app.unmount); return app;
}
function fill(app: ReturnType<typeof mount>) {
  change(input(app.tree, 'a-index'), '3'); app.render(); change(input(app.tree, 'b-index'), '9'); app.render();
  ['7.8', '17.6', '31.4', '125.4', '158.8', '196.0'].forEach((value, index) => { change(input(app.tree, fields[index]), value); app.render(); });
}
function makeRecord(result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number): ManualMeasurementRecord {
  const { metrics, ...manual } = result; return { id: `record-${archive.save.mock.calls.length}`, createdAt: '2026-11-11T00:00:00.000Z', timeSeconds, parameters: { ...parameters }, metrics, manual };
}
beforeEach(() => {
  vi.resetAllMocks(); archive.records = []; archive.recovery = undefined; archive.storageError = false; archive.excludedCount = 0; archive.actionError = ''; currentOwner = 'owner-a'; writable = true;
  archive.save.mockImplementation((result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number) => { archive.records = [...archive.records, makeRecord(result, parameters, timeSeconds)]; return { saved: true, failed: false }; });
  archive.clear.mockImplementation(() => { archive.records = []; return true; }); archive.retryPending.mockReturnValue({ failed: false }); archive.recoverPending.mockReturnValue({ recoveredCount: 0, failed: false });
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe('mechanical-energy paper tape manual workflow', () => {
  it('starts six raw readings empty, never autofills after choosing points, and requires explicit save', () => {
    const app = mount(); expect(fields.map((key) => input(app.tree, key).props.value)).toEqual(Array(6).fill(''));
    change(input(app.tree, 'a-index'), '3'); app.render(); change(input(app.tree, 'b-index'), '9'); app.render(); expect(fields.map((key) => input(app.tree, key).props.value)).toEqual(Array(6).fill('')); expect(archive.save).not.toHaveBeenCalled();
    fill(app); expect(text(app.tree)).toContain('只按这六个手动读数计算'); expect(archive.save).not.toHaveBeenCalled(); click(button(app.tree, '保存这次纸带读数')); app.render();
    expect(archive.save).toHaveBeenCalledOnce(); expect(archive.save.mock.calls[0][0].readings).toMatchObject({ indexA: 3, indexB: 9, aBeforeMm: 7.8, aCenterMm: 17.6, aAfterMm: 31.4, bBeforeMm: 125.4, bCenterMm: 158.8, bAfterMm: 196 });
    expect(archive.save.mock.calls[0][2]).toBe(.24); expect(text(app.tree)).toContain('本次读数已记录');
  });
  it('deduplicates repeated callbacks in the same render and permits a deliberate new observation', () => {
    const app = mount(); fill(app); const save = button(app.tree, '保存这次纸带读数'); click(save); click(save); expect(archive.save).toHaveBeenCalledTimes(1); app.render();
    click(button(app.tree, '本次读数已记录')); expect(archive.save).toHaveBeenCalledTimes(1);
    click(button(app.tree, '开始下一次纸带读数')); app.render(); fill(app); click(button(app.tree, '保存这次纸带读数')); expect(archive.save).toHaveBeenCalledTimes(2);
  });
  it('allows changed raw readings, but returning to the already saved reading in the same observation stays deduplicated', () => {
    const app = mount(); fill(app); click(button(app.tree, '保存这次纸带读数')); app.render(); change(input(app.tree, 'bAfterMm'), '196.1'); app.render(); click(button(app.tree, '保存这次纸带读数')); app.render();
    expect(archive.save).toHaveBeenCalledTimes(2); change(input(app.tree, 'bAfterMm'), '196.0'); app.render(); expect(text(app.tree)).toContain('本次读数已记录'); click(button(app.tree, '本次读数已记录')); expect(archive.save).toHaveBeenCalledTimes(2);
  });
  it('clears the changed triplet on selecting a different center and does not reuse the old save callback', () => {
    const app = mount(); fill(app); const oldSave = button(app.tree, '保存这次纸带读数'); change(input(app.tree, 'a-index'), '4'); click(oldSave); expect(archive.save).not.toHaveBeenCalled(); app.render();
    expect(fields.slice(0, 3).map((key) => input(app.tree, key).props.value)).toEqual(['', '', '']); expect(input(app.tree, 'bCenterMm').props.value).toBe('158.8');
  });
  it('does not save stale calculated values if an input changes before React rerenders', () => {
    const app = mount(); fill(app); const save = button(app.tree, '保存这次纸带读数'); change(input(app.tree, 'bAfterMm'), '196.1'); click(save); expect(archive.save).not.toHaveBeenCalled();
  });
  it('disallows future centers and requires both neighbors to have appeared', () => {
    const app = mount({ timeSeconds: .059 }); expect(input(app.tree, 'a-index').props.disabled).toBe(true); expect(text(app.tree)).toContain('至少 3 号点');
    app.render({ timeSeconds: .18 }); fill(app); expect(text(app.tree)).toContain('两点前后都要有等时点'); expect(walk(app.tree).some((node) => node.type === 'button' && text(node).includes('保存这次纸带'))).toBe(false);
    expect(archive.save).not.toHaveBeenCalled();
  });
  it.each(['reset', 'parameter', 'time-back'])('invalidates unfinished readings on %s and preserves archived history', (kind) => {
    const app = mount(); fill(app); click(button(app.tree, '保存这次纸带读数')); app.render(); const oldSave = button(app.tree, '本次读数已记录'); const saved = archive.records[0];
    if (kind === 'reset') app.render({ resetToken: 1 }); else if (kind === 'parameter') app.render({ parameters: { ...app.props.parameters, mass: .4 } }); else app.render({ timeSeconds: .1 });
    click(oldSave); expect(archive.save).toHaveBeenCalledTimes(1); expect(archive.records[0]).toBe(saved); app.render(); expect(fields.map((key) => input(app.tree, key).props.value)).toEqual(Array(6).fill(''));
  });
  it('reset at an unchanged timestamp also discards unfinished selections and raw values', () => {
    const app = mount(); fill(app); app.render({ resetToken: 1 }); expect(input(app.tree, 'a-index').props.value).toBe(''); expect(input(app.tree, 'aCenterMm').props.value).toBe(''); expect(archive.save).not.toHaveBeenCalled();
  });
  it('blocks old save/export/clock/clear callbacks after switching identity or unmounting', () => {
    const app = mount(); fill(app); click(button(app.tree, '保存这次纸带读数')); app.render(); const oldSave = button(app.tree, '本次读数已记录'), oldExport = button(app.tree, '导出手动读数 CSV'), oldClock = button(app.tree, '播放下落'), oldClear = button(app.tree, '清空纸带手动读数');
    currentOwner = 'owner-b'; click(oldSave); click(oldExport); click(oldClock); click(oldClear);
    expect(archive.save).toHaveBeenCalledTimes(1); expect(archive.exportCsv).not.toHaveBeenCalled(); expect(app.props.onClockToggle).not.toHaveBeenCalled(); expect(archive.clear).not.toHaveBeenCalled();
    app.unmount(); currentOwner = 'owner-a'; click(oldExport); expect(archive.exportCsv).not.toHaveBeenCalled();
  });
  it('expired read-only access keeps history readable while blocking save and clear', () => {
    const app = mount(); fill(app); const oldSave = button(app.tree, '保存这次纸带读数'); writable = false; click(oldSave); expect(archive.save).not.toHaveBeenCalled(); app.render({ recordWritable: false });
    expect(button(app.tree, '保存这次纸带读数').props.disabled).toBe(true); expect(text(app.tree)).toContain('当前档案只读');
  });
  it('shows storage failure and explicit retry, without adding a second observation or claiming saved to disk', () => {
    archive.save.mockImplementation((result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number) => { archive.records = [makeRecord(result, parameters, timeSeconds)]; archive.storageError = true; return { saved: true, failed: true }; });
    const app = mount(); fill(app); click(button(app.tree, '保存这次纸带读数')); app.render(); expect(text(app.tree)).toContain('本机保存异常'); click(button(app.tree, '重试本机保存')); app.render();
    expect(archive.retryPending).toHaveBeenCalledOnce(); expect(archive.save).toHaveBeenCalledOnce(); expect(text(app.tree)).toContain('当前未检测到存储错误');
  });
  it('keeps pending recovery separate from ordinary records and blocks duplicate saves of that observation', () => {
    archive.save.mockImplementation((result: ManualMeasurementResult, parameters: Record<string, number>, timeSeconds: number) => { archive.recovery = { records: [makeRecord(result, parameters, timeSeconds)], reviewToken: 'review', excludedCount: 0 }; archive.storageError = true; return { saved: true, failed: true, pendingRecovery: true }; });
    const app = mount(); fill(app); click(button(app.tree, '保存这次纸带读数')); app.render(); expect(text(app.tree)).toContain('本次读数待恢复'); expect(archive.records).toHaveLength(0);
    expect(app.props.onRecordsChange).toHaveBeenLastCalledWith([]); click(button(app.tree, '本次读数待恢复')); expect(archive.save).toHaveBeenCalledOnce();
  });
  it('allows the same observation again after an explicit successful clear, while leaving history untouched on cancelled clear', () => {
    const app = mount(); fill(app); click(button(app.tree, '保存这次纸带读数')); app.render(); click(button(app.tree, '清空纸带手动读数')); app.render(); click(button(app.tree, '保留记录')); app.render(); expect(archive.clear).not.toHaveBeenCalled();
    click(button(app.tree, '清空纸带手动读数')); app.render(); click(button(app.tree, '确认清空')); app.render(); click(button(app.tree, '保存这次纸带读数')); expect(archive.save).toHaveBeenCalledTimes(2);
  });
  it('accepts the rounded scale endpoint in the native field bounds instead of rejecting a valid 0.1 mm readout', () => {
    const parameters = { ...defaultHighSchoolParameters('mechanical-energy'), dropHeight: .687568 };
    const app = mount({ parameters });
    expect(input(app.tree, 'aBeforeMm').props.max).toBe(687.6);
    expect(input(app.tree, 'bAfterMm').props.max).toBe(687.6);
  });
  it('SSR explains virtual manual provenance, fixed timer interval and blank instrument inputs', () => {
    const html = renderToStaticMarkup(<MechanicalEnergyMeasurementPanel {...baseProps()} />); expect(html).toContain('50 Hz'); expect(html).toContain('不是真实器材实测'); expect(html).toContain('0.1 mm');
    expect(html.match(/placeholder="由你读尺填写"/g)).toHaveLength(6); expect(html).not.toContain('value="17.6"'); expect(archive.save).not.toHaveBeenCalled();
  });
});
