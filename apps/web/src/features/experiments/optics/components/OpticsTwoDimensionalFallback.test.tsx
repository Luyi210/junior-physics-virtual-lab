import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateLens } from "@physics-lab/physics";
import { ReflectionModule } from "../ReflectionModule";
import { RefractionModule } from "../RefractionModule";
import { PlaneMirrorModule } from "../PlaneMirrorModule";
import { CurvedMirrorModule } from "../CurvedMirrorModule";
import { CameraModule } from "../CameraModule";
import { EyeModule } from "../EyeModule";
import { CorrectionModule } from "../CorrectionModule";
import { InstrumentsModule } from "../InstrumentsModule";
import { FreeBenchModule } from "../FreeBenchModule";
import { MagnifierModule } from "../MagnifierModule";
import { LawDimensionSwitch } from "../shared/LawControls";
import { LensDimensionSwitch, LensSystem3DView } from "../shared/LensControls";
import { OpticsMobileViewNote } from "../shared/OpticsMobileViewNote";
import { RangeControl } from "../shared/OpticsControls";
import { initialLensScene } from "../workbench/lensStore";
import { OpticsSceneErrorBoundary } from "./OpticsSceneErrorBoundary";

type Frame = { slots: unknown[]; cursor: number };
const state = vi.hoisted(() => ({ frame: null as Frame | null, record: vi.fn() }));
// Real module callbacks and shared recovery component; no GPU/browser claim.
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => { const frame = state.frame!; const index = frame.cursor++; if (!(index in frame.slots)) frame.slots[index] = typeof initial === "function" ? initial() : initial; return [frame.slots[index], (next: unknown) => { frame.slots[index] = typeof next === "function" ? next(frame.slots[index]) : next; }]; },
  useMemo: (factory: () => unknown) => factory(), useEffect: () => {},
}));
vi.mock("../../../assistant/harnessStore", () => ({ useHarnessStore: (select: (store: unknown) => unknown) => select({ record: state.record }) }));
type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(all) : isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return Array.isArray(node) ? node.map(text).join("") : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : typeof node === "string" || typeof node === "number" ? String(node) : ""; }
let scene = { ...initialLensScene };
const sceneProps = () => ({ scene, result: calculateLens(scene), update: (patch: Partial<typeof scene>) => { scene = { ...scene, ...patch }; }, replace: (next: typeof scene) => { scene = { ...next }; } });
const modules = [
  ["reflection", ReflectionModule], ["refraction", RefractionModule], ["plane mirror", PlaneMirrorModule], ["curved mirror", CurvedMirrorModule],
  ["camera", CameraModule], ["eye", EyeModule], ["correction", CorrectionModule], ["instruments", InstrumentsModule],
  ["free bench", () => FreeBenchModule(sceneProps())], ["magnifier", () => MagnifierModule(sceneProps())],
] as const;
function mount(component: () => ReactNode) {
  const frame: Frame = { slots: [], cursor: 0 };
  const app = { tree: null as ReactNode,
    render() { frame.cursor = 0; state.frame = frame; try { app.tree = component(); } finally { state.frame = null; } },
    switch(mode: "2d" | "3d") {
      const shared = all(app.tree).find((node) => node.type === LawDimensionSwitch || node.type === LensDimensionSwitch);
      if (shared) (shared.props.onChange as (mode: "2d" | "3d") => void)(mode);
      else { const curved = all(app.tree).find((node) => node.props.className === "curved-view-switch")!; const button = all(curved).find((node) => node.type === "button" && text(node).includes(mode.toUpperCase()))!; (button.props.onClick as () => void)(); }
      app.render();
    },
    mode() {
      const shared = all(app.tree).find((node) => node.type === LawDimensionSwitch || node.type === LensDimensionSwitch);
      if (shared) return shared.props.mode;
      const curved = all(app.tree).find((node) => node.props.className === "curved-view-switch")!;
      return text(all(curved).find((node) => node.type === "button" && node.props["aria-pressed"] === true)).includes("2D") ? "2d" : "3d";
    },
    boundary() {
      let nodes = all(app.tree);
      const lens = nodes.find((node) => node.type === LensSystem3DView);
      if (lens) nodes = all(LensSystem3DView(lens.props as unknown as Parameters<typeof LensSystem3DView>[0]));
      return nodes.find((node) => node.type === OpticsSceneErrorBoundary);
    },
    physical3D() {
      const lens = all(app.tree).find((node) => node.type === LensSystem3DView);
      const node = lens ?? all(app.boundary()).find((entry) => Object.hasOwn(entry.props, "interacted"));
      expect(node).toBeDefined();
      return Object.fromEntries(Object.entries(node!.props).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)));
    },
  };
  app.render(); return app;
}
beforeEach(() => { state.frame = null; state.record.mockReset(); scene = { ...initialLensScene }; });

describe("junior optics default 2D and recovery", () => {
  it.each(modules)("%s starts in 2D without mounting its 3D scene", (_name, component) => {
    const app = mount(component); expect(app.mode()).toBe("2d"); expect(app.boundary()).toBeUndefined();
    expect(state.record).not.toHaveBeenCalled();
  });

  it.each(modules)("%s returns from a failed 3D scene without resetting experiment conditions", (_name, component) => {
    const app = mount(component);
    const range = all(app.tree).find((node) => node.type === RangeControl);
    if (range) { (range.props.onChange as (value: number) => void)(Number(range.props.min) + Number(range.props.step) * 2); (range.props.onInteract as (() => void) | undefined)?.(); }
    else { const condition = all(app.tree).find((node) => node.type === "button" && text(node).includes("远视眼模型"))!; (condition.props.onClick as () => void)(); }
    app.render(); app.switch("3d");
    const before = app.physical3D();
    const boundary = app.boundary()!;
    const instance = new OpticsSceneErrorBoundary(boundary.props as unknown as ConstructorParameters<typeof OpticsSceneErrorBoundary>[0]);
    instance.state = { failed: true };
    const fallback = instance.render();
    const use2D = all(fallback).find((node) => node.type === "button" && text(node) === "使用二维继续实验")!;
    expect(use2D).toBeDefined();
    (use2D.props.onClick as () => void)(); app.render();
    expect(app.mode()).toBe("2d"); expect(app.boundary()).toBeUndefined();
    app.switch("3d"); expect(app.physical3D()).toEqual(before);
  });

  it("offers a clear fallback without changing the view until the learner chooses", () => {
    const onUse2D = vi.fn();
    const boundary = new OpticsSceneErrorBoundary({ label: "测试场景", children: <div>scene</div>, onUse2D });
    expect(text(boundary.render())).toBe("scene");
    boundary.state = OpticsSceneErrorBoundary.getDerivedStateFromError();
    const fallback = boundary.render();
    expect(text(fallback)).toContain("当前参数会保留"); expect(text(fallback)).toContain("使用二维继续实验"); expect(text(fallback)).toContain("重试三维");
    expect(onUse2D).not.toHaveBeenCalled();
  });

  it("explains the current choice without claiming 2D is reduced functionality", () => {
    expect(renderToStaticMarkup(<OpticsMobileViewNote mode="2d" />)).toContain("照常调参、观察和读取结果");
    expect(renderToStaticMarkup(<OpticsMobileViewNote mode="3d" />)).toContain("已选择三维");
  });
});
