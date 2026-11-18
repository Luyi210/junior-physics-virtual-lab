import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { FrictionLab } from "./FrictionLab";

type Slot = { value?: unknown; deps?: readonly unknown[] };
const hooks = vi.hoisted(() => ({ slots: [] as Slot[], cursor: 0, effects: [] as Array<() => void>, changed: false, snapshot: null as any }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const slot = hooks.slots[hooks.cursor++] ?? (hooks.slots[hooks.cursor - 1] = { value: initial });
    return [slot.value, (next: unknown) => { slot.value = typeof next === "function" ? next(slot.value) : next; hooks.changed = true; }];
  },
  useMemo: (read: () => unknown) => read(),
  useEffect: (effect: () => void, deps: readonly unknown[]) => {
    const slot = hooks.slots[hooks.cursor++] ?? (hooks.slots[hooks.cursor - 1] = {});
    if (!slot.deps || deps.some((value, index) => !Object.is(value, slot.deps![index]))) { slot.deps = deps; hooks.effects.push(effect); }
  }
}));
vi.mock("../../assistant/harnessStore", () => ({ useHarnessStore: (select: Function) => select({ record: () => {} }) }));
vi.mock("../../assistant/tutorialBridge", () => ({ publishApparatusSnapshot: (snapshot: unknown) => { hooks.snapshot = snapshot; } }));
type Element = ReactElement<Record<string, any>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, any>>(node) ? [node, ...walk(node.props.children)] : []; }
function text(node: ReactNode): string { return Array.isArray(node) ? node.map(text).join("") : isValidElement<Record<string, any>>(node) ? text(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : ""; }

// Actual callbacks and effects with a synchronous hook adapter, not a browser or
// a substitute implementation of the friction/threshold calculation.
function mount() {
  hooks.slots = []; hooks.cursor = 0; hooks.effects = []; hooks.snapshot = null;
  const app = {
    tree: null as ReactNode,
    render() { let turns = 0; do { hooks.cursor = 0; hooks.changed = false; app.tree = FrictionLab(); hooks.effects.splice(0).forEach(effect => effect()); expect(++turns).toBeLessThan(10); } while (hooks.changed); },
    click(label: string) {
      const node = walk(app.tree).find(node => node.type === "button" && (text(node) === label || walk(node.props.children).some(child => child.type === "strong" && text(child) === label)));
      expect(node, label).toBeDefined(); expect(node!.props.disabled).not.toBe(true); node!.props.onClick(); app.render();
    },
    toggle() { const node = app.tree as Element; expect(node.props.actionDisabled).toBe(false); node.props.onToggle(); app.render(); },
    reading(id: string) { return hooks.snapshot.readings.find((entry: any) => entry.id === id)?.value; },
    derived(id: string) { return hooks.snapshot.derived.find((entry: any) => entry.id === id)?.value; },
    get savedRows() { return walk(app.tree).filter(node => node.props.className === "friction-evidence-row").map(text); }
  };
  app.render(); return app;
}
function startGlass() {
  const app = mount(); app.click("玻璃板"); app.click("检查并校零"); app.toggle();
  for (let i = 0; i < 4; i++) app.click("＋0.5");
  expect(app.reading("breakaway")).toBe(1.5); return app;
}

describe("friction threshold belongs to its material and normal force", () => {
  it("clears the old threshold on a material change and captures the new one without rewriting saved uniform readings", () => {
    const app = startGlass(); app.click("−0.5"); for (let i = 0; i < 6; i++) app.click("−0.05");
    app.click("保存有效读数"); const saved = app.savedRows;
    app.click("毛巾");
    expect(app.reading("breakaway")).toBeNull(); expect(app.derived("static-kinetic")).toBe(false);
    expect(text(app.tree)).not.toContain("低 -2.70"); expect(app.savedRows).toEqual(saved);
    app.toggle(); for (let i = 0; i < 9; i++) app.click("＋0.5");
    expect(app.reading("breakaway")).toBeCloseTo(5.25); expect(app.savedRows).toEqual(saved);
  });

  it("invalidates the observed threshold after adding or removing a weight", () => {
    const app = startGlass(); app.click("5");
    expect(app.reading("breakaway")).toBeNull(); expect(app.derived("static-kinetic")).toBe(false);
    app.toggle(); app.click("＋0.5"); expect(app.reading("breakaway")).toBeCloseTo(2.25);
    app.click("5"); expect(app.reading("breakaway")).toBeNull();
  });

  it("does not erase the same-condition observation when the already-selected surface is clicked", () => {
    const app = startGlass(); app.click("玻璃板"); expect(app.reading("breakaway")).toBe(1.5);
  });
});
