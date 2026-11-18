import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { DashboardPhysicsCanvas } from "./DashboardPhysicsCanvas";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void> };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const slot = () => { const frame = hooks.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState: (initial: unknown) => { const item = slot(); if (!("value" in item)) item.value = initial; return [item.value, (next: unknown) => { item.value = typeof next === "function" ? next(item.value) : next; }]; },
    useRef: (initial: unknown) => { const item = slot(); if (!("value" in item)) item.value = { current: initial }; return item.value; },
    useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => { const item = slot(); if (!item.deps || deps.some((value, index) => !Object.is(value, item.deps![index]))) { item.deps = deps; hooks.frame!.effects.push(() => { item.cleanup?.(); item.cleanup = effect() || undefined; }); } },
  };
});
vi.mock("../../../shared/hooks/useElementActivity", () => ({ useElementActivity: () => true }));
type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(all) : isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : []; }
const listeners = new Set<() => void>();
const media = { matches: false, addEventListener: (_name: string, listener: () => void) => listeners.add(listener), removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener) };
const setInterval = vi.fn(() => 7), clearInterval = vi.fn(), requestAnimationFrame = vi.fn(() => 8);
let alphas: number[];
const cleanup: Array<() => void> = [];
function mount() {
  const frame: Frame = { slots: [], cursor: 0, effects: [] };
  const context = new Proxy({} as Record<string, unknown>, { get: (target, key) => target[String(key)] ?? (() => {}), set: (target, key, value) => { if (key === "globalAlpha") alphas.push(value); target[String(key)] = value; return true; } });
  const canvas = { getContext: () => context, getBoundingClientRect: () => ({ width: 320, height: 400 }) };
  const app = { tree: null as ReactNode,
    render() { frame.cursor = 0; hooks.frame = frame; try { app.tree = DashboardPhysicsCanvas(); } finally { hooks.frame = null; }
      const node = all(app.tree).find((item) => item.type === "canvas")!;
      (node.props.ref as { current: unknown }).current = canvas;
      frame.effects.splice(0).forEach((effect) => effect()); },
    pause() { const button = all(app.tree).find((item) => typeof item.props.className === "string" && item.props.className.startsWith("canvas-motion-toggle"))!; (button.props.onClick as () => void)(); app.render(); },
    unmount() { frame.slots.forEach((item) => item.cleanup?.()); },
  };
  app.render(); cleanup.push(app.unmount); return app;
}
beforeEach(() => {
  alphas = []; media.matches = false; listeners.clear(); setInterval.mockClear(); clearInterval.mockClear(); requestAnimationFrame.mockClear();
  vi.stubGlobal("window", { matchMedia: () => media, devicePixelRatio: 3, setInterval, clearInterval, requestAnimationFrame, cancelAnimationFrame: vi.fn() });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup.splice(0).forEach((fn) => fn()); vi.unstubAllGlobals(); });

describe("home animation reduced-motion and pause behavior", () => {
  it("renders a fully visible still preview and does not auto-cycle with reduced motion", () => {
    media.matches = true; mount();
    expect(alphas).toContain(1); expect(setInterval).not.toHaveBeenCalled(); expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
  it("shows the still scene immediately when the learner pauses animation", () => {
    const app = mount(); const frames = requestAnimationFrame.mock.calls.length;
    app.pause();
    expect(alphas.at(-1)).toBe(1); expect(clearInterval).toHaveBeenCalledWith(7);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(frames);
  });
  it("responds to changed motion preferences and cleans up listeners", () => {
    media.matches = true; const app = mount(); expect(listeners.size).toBe(2);
    media.matches = false; listeners.forEach((fn) => fn());
    expect(setInterval).toHaveBeenCalledOnce(); expect(requestAnimationFrame).toHaveBeenCalledOnce();
    app.unmount(); expect(listeners.size).toBe(0);
  });
});
