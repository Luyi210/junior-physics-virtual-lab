import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { HarnessApparatusSnapshot } from "@physics-lab/harness";
import { ElectromagnetLab } from "./ElectromagnetLab";
import { PressureLab } from "../mechanics/PressureLab";
import { EvidenceVerdict } from "../shared/ScienceLabPrimitives";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void; effect?: () => void | (() => void); dispatch?: (action: unknown) => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn(), publish: vi.fn() }));

// Execute actual component handlers, reducer and effect cleanup in an in-memory
// hook frame. This is not a browser/DOM or animation acceptance test.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const slot = () => {
    const frame = hooks.frame!;
    return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {});
  };
  const changed = (previous: readonly unknown[] | undefined, next: readonly unknown[] | undefined) =>
    !previous || !next || previous.length !== next.length || next.some((value, index) => !Object.is(value, previous[index]));
  return { ...actual,
    useState: (initial: unknown) => {
      if (!hooks.frame) return actual.useState(initial);
      const item = slot(); if (!Object.hasOwn(item, "value")) item.value = typeof initial === "function" ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === "function" ? next(item.value) : next; }];
    },
    useReducer: (reducer: (state: unknown, action: unknown) => unknown, initial: unknown, init?: (initial: unknown) => unknown) => {
      const item = slot();
      if (!Object.hasOwn(item, "value")) item.value = init ? init(initial) : initial;
      item.dispatch ??= (action: unknown) => { item.value = reducer(item.value, action); };
      return [item.value, item.dispatch];
    },
    useRef: (initial: unknown) => {
      if (!hooks.frame) return actual.useRef(initial);
      const item = slot(); if (!Object.hasOwn(item, "value")) item.value = { current: initial }; return item.value;
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      if (!hooks.frame) return actual.useMemo(factory, deps);
      const item = slot(); if (changed(item.deps, deps)) { item.value = factory(); item.deps = deps; } return item.value;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!hooks.frame) return actual.useEffect(effect, deps);
      const item = slot(); item.effect = effect;
      if (changed(item.deps, deps)) { item.deps = deps; hooks.frame.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); }
    },
  };
});
vi.mock("../../assistant/harnessStore", () => ({ useHarnessStore: (select: (state: { record: typeof hooks.record }) => unknown) => select({ record: hooks.record }) }));
vi.mock("../../assistant/tutorialBridge", () => ({ publishApparatusSnapshot: (value: HarnessApparatusSnapshot) => hooks.publish(value) }));

type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(walk);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : "";
}
const timers = new Map<number, () => void>();
let timerId = 0;
const cleanups: Array<() => void> = [];
function mount(Lab = ElectromagnetLab) {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const app = {
    tree: null as ReactNode,
    render() {
      frame.cursor = 0; hooks.frame = frame;
      try { app.tree = Lab(); } finally { hooks.frame = null; }
      frame.effects.splice(0).forEach((effect) => effect()); return app.tree;
    },
    replayEffects() { frame.slots.forEach((item) => { if (item.effect) { item.cleanup?.(); item.cleanup = item.effect() || undefined; } }); },
    unmount() { frame.slots.forEach((item) => { item.cleanup?.(); item.cleanup = undefined; }); },
    get frameProps() { return (app.tree as Element).props; },
    get snapshot(): HarnessApparatusSnapshot { return hooks.publish.mock.calls.at(-1)![0]; },
    button(label: string) { const button = walk(app.tree).find((node) => node.type === "button" && text(node) === label); expect(button, label).toBeDefined(); return button!; },
    click(label: string) { const button = app.button(label); expect(button.props.disabled, label).not.toBe(true); (button.props.onClick as () => void)(); app.render(); },
    toggle() { expect(app.frameProps.actionDisabled).not.toBe(true); (app.frameProps.onToggle as () => void)(); app.render(); },
    ticks(count: number) { for (let n = 0; n < count; n++) { [...timers.values()].forEach((callback) => callback()); app.render(); } },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
function apparatus(app: ReturnType<typeof mount>, id: string) { return app.snapshot.apparatus.find((item) => item.id === id)?.value; }
function compass(app: ReturnType<typeof mount>) { return walk(app.tree).find((node) => node.props["data-north-direction"] !== undefined)!; }
beforeEach(() => {
  hooks.record.mockReset(); hooks.publish.mockReset(); timers.clear(); timerId = 0;
  vi.stubGlobal("window", {
    setInterval: (callback: () => void, milliseconds: number) => { expect(milliseconds).toBe(200); timers.set(++timerId, callback); return timerId; },
    clearInterval: (id: number) => { timers.delete(id); },
  });
});
afterEach(() => { cleanups.splice(0).forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

describe("electromagnet actual operation callbacks", () => {
  it("renders and records north right/left consistently, and removes a live pole reading when off", () => {
    const app = mount(); app.click("装配"); app.toggle();
    expect(compass(app).props["data-north-direction"]).toBe("right");
    expect(walk(compass(app)).find((node) => node.type === "b")!.props.style).toEqual({ transform: "rotate(0deg)" });
    app.click("用小磁针记录当前磁极");
    expect(app.snapshot.readings.find((item) => item.id === "right-pole")?.value).toBe("断电无稳定磁极");
    expect(compass(app)).toBeUndefined();
    app.click("反接"); app.toggle();
    expect(compass(app).props["data-north-direction"]).toBe("left");
    expect(walk(compass(app)).find((node) => node.type === "b")!.props.style).toEqual({ transform: "rotate(180deg)" });
    app.click("用小磁针记录当前磁极");
    const observations = hooks.record.mock.calls.filter(([, value]) => value.control === "小磁针判定磁极");
    expect(observations.map(([, value]) => value.value)).toEqual(["正接/右端N极/北端向右", "反接/右端S极/北端向左"]);
    expect(app.snapshot.derived.find((item) => item.id === "polarity-rule")?.value).toBe(true);
    expect(app.frameProps.recordToggleEvent).toBe(false);
  });

  it("stops the actual 0.5 A clock at 60 s, preserves saved observations, and requires reset before restarting", () => {
    const app = mount(); app.click("装配"); app.toggle(); app.click("吸钉"); app.click("保存强弱证据");
    app.toggle(); app.click("用小磁针记录当前磁极"); app.toggle();
    const oldTick = [...timers.values()][0]!;
    app.ticks(300);
    expect(apparatus(app, "powered")).toBe(false); expect(apparatus(app, "powered-time")).toBe(60);
    expect(apparatus(app, "observation-ended")).toBe(true); expect(apparatus(app, "overheat")).toBe(false);
    expect(timers.size).toBe(0); expect(app.frameProps.actionDisabled).toBe(true);
    expect(app.frameProps.disabledLabel).toContain("观察已结束"); expect(text(app.tree)).toContain("60秒观察结束，已断电");
    expect(text(app.tree)).toContain("已保存 1 组"); expect(text(app.tree)).toContain("右端 N 极");
    expect(app.button("吸钉").props.disabled).toBe(true);
    expect(app.button("用小磁针记录当前磁极").props.disabled).toBe(true);
    (app.frameProps.onToggle as () => void)(); oldTick(); app.render();
    expect(apparatus(app, "powered-time")).toBe(60); expect(apparatus(app, "powered")).toBe(false);
    app.click("线圈冷却复位"); app.toggle(); oldTick(); app.render();
    expect(apparatus(app, "powered-time")).toBe(0); app.ticks(1);
    expect(apparatus(app, "powered-time")).toBe(.2);
    expect(text(app.tree)).toContain("已保存 1 组"); expect(text(app.tree)).toContain("右端 N 极");
    expect(hooks.record.mock.calls.filter(([type, value]) => type === "simulation.toggled" && value.action === "60秒观察结束已断电")).toHaveLength(1);
  });

  it("pauses and resumes accumulated time without accepting pre-pause or reset callbacks", () => {
    const app = mount(); app.click("装配"); app.toggle(); app.ticks(50);
    const oldTick = [...timers.values()][0]!;
    app.toggle(); oldTick(); app.render(); expect(apparatus(app, "powered-time")).toBe(10);
    app.toggle(); oldTick(); app.render(); expect(apparatus(app, "powered-time")).toBe(10);
    app.ticks(1); expect(apparatus(app, "powered-time")).toBe(10.2);
    const preResetTick = [...timers.values()][0]!;
    app.click("线圈冷却复位"); app.toggle(); preResetTick(); app.render();
    expect(apparatus(app, "powered-time")).toBe(0);
  });

  it.each([["1.0 A", 44.6], ["2.0 A", 11.2]] as const)("stops %s at the model heat threshold before the observation end", (label, time) => {
    const app = mount(); app.click(label); app.click("装配"); app.toggle(); app.ticks(300);
    expect(apparatus(app, "powered-time")).toBe(time); expect(apparatus(app, "powered")).toBe(false);
    expect(apparatus(app, "overheat")).toBe(true); expect(apparatus(app, "observation-ended")).toBe(false);
    expect(app.frameProps.disabledLabel).toContain("过热"); expect(timers.size).toBe(0);
  });

  it("does not double tick or emit extra transitions after StrictMode-style effect replay and unmount", () => {
    const app = mount(); app.click("装配"); app.toggle();
    const oldTick = [...timers.values()][0]!;
    app.replayEffects(); expect(timers.size).toBe(1);
    oldTick(); app.render(); expect(apparatus(app, "powered-time")).toBe(0);
    app.ticks(1); expect(apparatus(app, "powered-time")).toBe(.2);
    const currentTick = [...timers.values()][0]!;
    const before = hooks.publish.mock.calls.length;
    app.unmount(); oldTick(); currentTick();
    expect(timers.size).toBe(0); expect(hooks.publish).toHaveBeenCalledTimes(before);
    expect(hooks.record.mock.calls.filter(([type]) => type === "simulation.toggled")).toHaveLength(1);
  });
});

describe("pressure actual evidence callbacks", () => {
  function saveAt(app: ReturnType<typeof mount>, weights: number[], face: string) {
    if (app.frameProps.running) app.toggle();
    const faceButton = walk(app.tree).find((node) => node.type === "button" && text(node).includes(face))!;
    (faceButton.props.onClick as () => void)(); app.render();
    for (const weight of [25, 50, 100]) if ((app.button(`${weight} N`).props.className === "active") !== weights.includes(weight)) app.click(`${weight} N`);
    app.toggle(); app.click("测量压痕"); app.click("保存本组数据");
  }
  it("keeps both 18.0 mm readings but does not validate the area prediction or report completion", () => {
    const app = mount(PressureLab); app.click("放置泡沫垫"); app.click("更深");
    saveAt(app, [25, 50], "中面朝下"); saveAt(app, [100], "中面朝下"); saveAt(app, [100], "小面朝下");
    expect(app.snapshot.validity.ready).toBe(false);
    expect(app.snapshot.derived.find((item) => item.id === "force-evidence")?.value).toBe(true);
    expect(app.snapshot.derived.find((item) => item.id === "area-evidence")?.value).toBe(false);
    const verdict = walk(app.tree).find((node) => node.type === EvidenceVerdict)!;
    expect(verdict.props.valid).toBe(false); expect(verdict.props.detail).toContain("同为18.0 mm");
    expect(app.snapshot.validity.issues.join()).toContain("已饱和");
  });
  it("completes both factors after genuinely distinguishable controlled indentation observations", () => {
    const app = mount(PressureLab); app.click("放置泡沫垫"); app.click("更深");
    saveAt(app, [], "大面朝下"); saveAt(app, [25], "大面朝下"); saveAt(app, [25], "中面朝下");
    expect(app.snapshot.validity.ready).toBe(true);
    const verdict = walk(app.tree).find((node) => node.type === EvidenceVerdict)!;
    expect(verdict.props.valid).toBe(true); expect(verdict.props.detail).toContain("可辨压痕对照");
  });
});
