import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CorgiAvatar } from "./CorgiAvatar";
import { LegacyCorgiAvatar } from "./LegacyCorgiAvatar";
import { CorgiAvatarControls } from "./CorgiAvatarControls";
import { CORGI_ROTATION_INTERVAL_MS, corgiAvatarAsset, corgiSourceUrl } from "./corgiAvatars";
import { useCorgiAvatarRotation } from "./useCorgiAvatarRotation";
import { LiliAssistant } from "./LiliAssistant";
import type { HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void; effect?: boolean };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; updates: Array<() => void>; delay: boolean; dirty: boolean };
const testState = vi.hoisted(() => ({ frame: null as Frame | null, request: vi.fn(), scope: { key: "guest", mode: "guest", label: "本机访客", canWrite: true, authChannel: null, revision: 1 } as HighSchoolRecordScope }));
vi.mock("../../../data/highSchoolRecordScope", () => ({ getHighSchoolRecordScope: () => testState.scope, subscribeHighSchoolRecordScope: () => () => {}, isCurrentHighSchoolRecordScope: (scope: HighSchoolRecordScope) => scope === testState.scope }));
vi.mock("../../../data/highSchoolContext", () => ({ getHighSchoolContext: () => null, getHighSchoolExperimentVisit: () => 0, subscribeHighSchoolContext: () => () => {} }));
vi.mock("./liliRequest", () => ({ canRequestLiliNetwork: () => false, requestLiliForScope: testState.request }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  function slot() { const frame = testState.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); }
  return { ...actual,
    useState(initial: unknown) {
      if (!testState.frame) return actual.useState(initial);
      const frame = testState.frame, current = slot();
      if (!Object.hasOwn(current, "value")) current.value = typeof initial === "function" ? initial() : initial;
      return [current.value, (next: unknown) => {
        const apply = () => { const value = typeof next === "function" ? next(current.value) : next; if (!Object.is(value, current.value)) { current.value = value; frame.dirty = true; } };
        if (frame.delay && typeof next === "function") frame.updates.push(apply); else apply();
      }];
    },
    useRef(initial: unknown) { if (!testState.frame) return actual.useRef(initial); const current = slot(); if (!Object.hasOwn(current, "value")) current.value = { current: initial }; return current.value; },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      if (!testState.frame) return actual.useEffect(effect, deps);
      const current = slot(); current.effect = true;
      if (!current.deps || !deps || current.deps.length !== deps.length || current.deps.some((value, index) => !Object.is(value, deps[index]))) {
        current.deps = deps;
        testState.frame.effects.push(() => { current.cleanup?.(); current.cleanup = effect() || undefined; });
      }
    },
    useSyncExternalStore(subscribe: (fn: () => void) => () => void, getSnapshot: () => unknown, server?: () => unknown) {
      return testState.frame ? getSnapshot() : actual.useSyncExternalStore(subscribe, getSnapshot, server);
    },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : []; }
function button(tree: ReactNode, label: string) { const result = nodes(tree).find(node => node.type === "button" && node.props["aria-label"] === label); if (!result) throw Error(`Missing button ${label}`); return result; }
function click(node: Element) { (node.props.onClick as () => void)(); }
const cleanups: Array<() => void> = [];
function mount<T>(render: () => T) {
  const frame: Frame = { slots: [], cursor: 0, effects: [], updates: [], delay: false, dirty: false };
  const app = { current: undefined as T, frame,
    render() {
      let turns = 0;
      do {
        frame.dirty = false; frame.cursor = 0; testState.frame = frame;
        try { app.current = render(); } finally { testState.frame = null; }
        for (const node of nodes(app.current as ReactNode)) if (node.props.ref && typeof node.props.ref === "object") (node.props.ref as { current: unknown }).current = { focus() {}, scrollIntoView() {} };
        frame.effects.splice(0).forEach(run => run());
        if (++turns > 30) throw Error("Render loop");
      } while (frame.dirty);
    },
    flushUpdates() { frame.updates.splice(0).forEach(run => run()); },
    unmount() { frame.slots.forEach(slot => { slot.cleanup?.(); slot.cleanup = undefined; }); },
    strictReplay() { app.unmount(); frame.slots.filter(slot => slot.effect).forEach(slot => slot.deps = undefined); app.render(); },
  };
  app.render(); cleanups.push(() => app.unmount()); return app;
}
function environment(reduced = false) {
  const visibility = new Set<() => void>(), motion = new Set<() => void>();
  const doc = { hidden: false, addEventListener: (_: string, cb: () => void) => visibility.add(cb), removeEventListener: (_: string, cb: () => void) => visibility.delete(cb) };
  const media = { matches: reduced, addEventListener: (_: string, cb: () => void) => motion.add(cb), removeEventListener: (_: string, cb: () => void) => motion.delete(cb) };
  vi.stubGlobal("document", doc); vi.stubGlobal("window", Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844, matchMedia: () => media }));
  return { visibility, motion, hide(hidden: boolean) { doc.hidden = hidden; [...visibility].forEach(fn => fn()); }, reduce(matches: boolean) { media.matches = matches; [...motion].forEach(fn => fn()); } };
}
function conversation() {
  const outer = mount(() => LiliAssistant());
  const element = outer.current;
  const app = mount(() => (element.type as (props: { scope: HighSchoolRecordScope }) => ReactNode)(element.props));
  return { outer, app, key: element.key };
}
beforeEach(() => { vi.useFakeTimers(); testState.scope = { key: "guest", mode: "guest", label: "本机访客", canWrite: true, authChannel: null, revision: 1 }; });
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); testState.request.mockClear(); });

describe("controlled corgi image", () => {
  it("resolves exactly five assets and credits under a Pages base path", () => {
    const urls = Array.from({ length: 5 }, (_, index) => corgiAvatarAsset(index, "/physics-lab/").src);
    expect(new Set(urls).size).toBe(5);
    expect(urls[0]).toBe("/physics-lab/assets/lili/corgi-01.webp");
    expect(urls[4]).toBe("/physics-lab/assets/lili/corgi-05.webp");
    expect(corgiAvatarAsset(-1, "/physics-lab").src).toBe(urls[4]);
    expect(corgiAvatarAsset(5).id).toBe("corgi-01");
    expect(corgiSourceUrl("/physics-lab/")).toBe("/physics-lab/assets/lili/SOURCES.html");
  });
  it.each([32, 72, 96] as const)("renders %ipx decorative photos with the original vector while loading", size => {
    const html = renderToStaticMarkup(<CorgiAvatar avatarIndex={3} size={size} />);
    expect(html).toContain(`--corgi-size:${size}px`);
    expect(html).toContain("corgi-04.webp"); expect(html).toContain("lili-corgi-vector");
    expect(html).toContain('alt="开心守候：三色柯基坐姿"'); expect(html).toContain('aria-hidden="true"'); expect(html).not.toContain("aria-live");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("switches to the photo only on load and keeps the SVG on error, independently of later keyed images", () => {
    const photoElement = (index: number) => nodes(CorgiAvatar({ avatarIndex: index })).find(node => typeof node.type === "function")!;
    const original = photoElement(0), next = photoElement(1);
    expect(original.key).not.toBe(next.key);
    const mountPhoto = (element: Element) => mount(() => (element.type as (props: Record<string, unknown>) => ReactNode)(element.props));
    const first = mountPhoto(original);
    (nodes(first.current).find(node => node.type === "img")!.props.onError as () => void)(); first.render();
    expect(nodes(first.current).some(node => node.type === LegacyCorgiAvatar)).toBe(true);
    expect(nodes(first.current).some(node => node.type === "img")).toBe(false);
    first.unmount();
    const second = mountPhoto(next);
    (nodes(second.current).find(node => node.type === "img")!.props.onLoad as () => void)(); second.render();
    expect(nodes(second.current).some(node => node.type === LegacyCorgiAvatar)).toBe(false);
    expect(nodes(second.current).find(node => node.type === "img")!.props.className).toContain("is-ready");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("one assistant rotation lifecycle", () => {
  it("advances once per 15 seconds through five images, with one timer and no hidden-time catchup", () => {
    const env = environment(), app = mount(() => useCorgiAvatarRotation({ open: false, busy: false }));
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(CORGI_ROTATION_INTERVAL_MS - 1); app.render(); expect(app.current.index).toBe(0);
    vi.advanceTimersByTime(1); app.render(); expect(app.current.index).toBe(1);
    env.hide(true); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(90_000); app.render(); expect(app.current.index).toBe(1);
    env.hide(false); app.render(); vi.advanceTimersByTime(14_999); app.render(); expect(app.current.index).toBe(1);
    vi.advanceTimersByTime(1 + 3 * CORGI_ROTATION_INTERVAL_MS); app.render(); expect(app.current.index).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
  });
  it("pauses for chat, busy replies, pointer and keyboard focus without losing manual selection", () => {
    environment(); let open = false, busy = false;
    const app = mount(() => useCorgiAvatarRotation({ open, busy }));
    app.current.next(); app.render(); expect(app.current.index).toBe(1); expect(app.current.automatic).toBe(false);
    vi.advanceTimersByTime(60_000); app.render(); expect(app.current.index).toBe(1);
    app.current.toggleAutomatic(); app.render(); open = true; app.render(); expect(vi.getTimerCount()).toBe(0);
    expect(app.current.status).toContain("聊天中暂停");
    open = false; busy = true; app.render(); expect(vi.getTimerCount()).toBe(0);
    busy = false; app.render(); expect(vi.getTimerCount()).toBe(1);
    app.current.setInteracting(true); app.current.setInteracting(true, "focus"); app.render(); expect(vi.getTimerCount()).toBe(0);
    app.current.setInteracting(false); app.render(); expect(vi.getTimerCount()).toBe(0);
    app.current.setInteracting(false, "focus"); app.render(); expect(vi.getTimerCount()).toBe(1);
    app.current.previous(); app.render(); expect(app.current.index).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it("defaults reduced motion to off, permits explicit play, and pauses again when system preference changes", () => {
    const env = environment(true), app = mount(() => useCorgiAvatarRotation({ open: false, busy: false }));
    expect(app.current.automatic).toBe(false); expect(app.current.status).toContain("减少动态"); expect(vi.getTimerCount()).toBe(0);
    app.current.toggleAutomatic(); app.render(); vi.advanceTimersByTime(CORGI_ROTATION_INTERVAL_MS); app.render(); expect(app.current.index).toBe(1);
    env.reduce(false); app.render(); env.reduce(true); app.render(); expect(app.current.automatic).toBe(false); expect(vi.getTimerCount()).toBe(0);
    app.current.next(); app.render(); expect(app.current.index).toBe(2); expect(app.current.automatic).toBe(false);
    app.unmount(); expect(env.visibility.size + env.motion.size).toBe(0);
  });
  it("rejects stale ticks and queued updaters after effect cleanup and disposes a StrictMode replay", () => {
    const env = environment(), timer = vi.spyOn(globalThis, "setTimeout");
    const app = mount(() => useCorgiAvatarRotation({ open: false, busy: false }));
    const oldTick = timer.mock.calls.at(-1)![0] as () => void;
    app.frame.delay = true; vi.advanceTimersByTime(CORGI_ROTATION_INTERVAL_MS); expect(app.frame.updates).toHaveLength(1);
    app.strictReplay(); app.flushUpdates(); app.render(); expect(app.current.index).toBe(0);
    oldTick(); app.flushUpdates(); app.render(); expect(app.current.index).toBe(0);
    expect(vi.getTimerCount()).toBe(1); expect(env.visibility.size).toBe(1); expect(env.motion.size).toBe(1);
    const next = app.current.next; app.unmount(); next(); oldTick(); app.flushUpdates();
    expect(vi.getTimerCount()).toBe(0); expect(env.visibility.size + env.motion.size).toBe(0);
  });
  it("keeps an explicitly chosen portrait fixed through a reduce-motion on/off cycle", () => {
    const env = environment(), app = mount(() => useCorgiAvatarRotation({ open: false, busy: false }));
    app.current.next(); app.render(); expect(app.current.index).toBe(1);
    env.reduce(true); app.render(); env.reduce(false); app.render();
    vi.advanceTimersByTime(60_000); app.render();
    expect(app.current.automatic).toBe(false); expect(app.current.index).toBe(1); expect(vi.getTimerCount()).toBe(0);
    app.current.toggleAutomatic(); app.render(); vi.advanceTimersByTime(CORGI_ROTATION_INTERVAL_MS); app.render(); expect(app.current.index).toBe(2);
  });
  it("offers native buttons plus left/right shortcuts without hijacking modified keys", () => {
    environment(); const app = mount(() => useCorgiAvatarRotation({ open: true, busy: false }));
    let tree = CorgiAvatarControls({ rotation: app.current });
    click(button(tree, "上一张力力形象")); app.render(); expect(app.current.index).toBe(4); expect(app.current.automatic).toBe(false);
    tree = CorgiAvatarControls({ rotation: app.current });
    const group = nodes(tree).find(node => node.props.role === "group")!, preventDefault = vi.fn();
    (group.props.onKeyDown as (event: unknown) => void)({ key: "ArrowRight", preventDefault }); app.render(); expect(app.current.index).toBe(0); expect(preventDefault).toHaveBeenCalledOnce();
    (group.props.onKeyDown as (event: unknown) => void)({ key: "ArrowRight", ctrlKey: true, preventDefault }); app.render(); expect(app.current.index).toBe(0);
    expect(button(tree, "开启形象自动轮换").props.type).toBe("button");
    const source = nodes(tree).find(node => node.type === "a")!;
    expect(source.props.href).toBe(corgiSourceUrl()); expect(source.props.rel).toBe("noreferrer");
  });
  it("shares one selection between actual launcher and panel and preserves it across close/open without requesting assistance", () => {
    environment(); const { app } = conversation();
    vi.advanceTimersByTime(CORGI_ROTATION_INTERVAL_MS); app.render();
    expect(nodes(app.current).filter(node => node.type === CorgiAvatar).map(node => node.props.avatarIndex)).toEqual([1]);
    click(button(app.current, "和力力讨论实验")); app.render();
    expect(nodes(app.current).filter(node => node.type === CorgiAvatar).map(node => node.props.avatarIndex)).toEqual([1, 1]); expect(vi.getTimerCount()).toBe(0);
    const control = nodes(app.current).find(node => node.type === CorgiAvatarControls)!;
    click(button(CorgiAvatarControls(control.props as Parameters<typeof CorgiAvatarControls>[0]), "下一张力力形象")); app.render();
    expect(nodes(app.current).filter(node => node.type === CorgiAvatar).map(node => node.props.avatarIndex)).toEqual([2, 2]);
    click(button(app.current, "收起力力")); app.render(); vi.advanceTimersByTime(60_000); app.render();
    click(button(app.current, "和力力讨论实验")); app.render();
    expect(nodes(app.current).filter(node => node.type === CorgiAvatar).map(node => node.props.avatarIndex)).toEqual([2, 2]); expect(testState.request).not.toHaveBeenCalled();
  });
  it("resets with the existing identity key and prevents an unmounted owner's callbacks changing the next owner", () => {
    const env = environment(), first = conversation();
    vi.advanceTimersByTime(CORGI_ROTATION_INTERVAL_MS); first.app.render(); click(button(first.app.current, "和力力讨论实验")); first.app.render();
    const stale = nodes(first.app.current).find(node => node.type === CorgiAvatarControls)!.props.rotation as ReturnType<typeof useCorgiAvatarRotation>;
    first.app.unmount(); first.outer.unmount();
    testState.scope = { ...testState.scope, key: "account:student-b", revision: 2 };
    const second = conversation(); expect(second.key).not.toBe(first.key); stale.next(); stale.toggleAutomatic(); second.app.render();
    expect(nodes(second.app.current).filter(node => node.type === CorgiAvatar).map(node => node.props.avatarIndex)).toEqual([0]);
    expect(env.visibility.size).toBe(1); expect(env.motion.size).toBe(1); expect(vi.getTimerCount()).toBe(1); expect(testState.request).not.toHaveBeenCalled();
  });
});
