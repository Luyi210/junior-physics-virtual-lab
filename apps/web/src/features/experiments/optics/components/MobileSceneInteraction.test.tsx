import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { BlackHoleLightExtension } from "./BlackHoleLightExtension";
import { ReflectionScene3D } from "./OpticsLawScene3D";
import { StraightPropagationModule } from "../StraightPropagationModule";

type Frame = { slots: unknown[]; cursor: number };
const state = vi.hoisted(() => ({ frame: null as Frame | null, mobile: true, record: vi.fn() }));
// Exercise the real handlers; this does not emulate a browser gesture recognizer.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useState: (initial: unknown) => {
      const frame = state.frame!; const index = frame.cursor++;
      if (!(index in frame.slots)) frame.slots[index] = typeof initial === "function" ? initial() : initial;
      return [frame.slots[index], (next: unknown) => { frame.slots[index] = typeof next === "function" ? next(frame.slots[index]) : next; }];
    },
    useRef: (initial: unknown) => { const frame = state.frame!; const index = frame.cursor++; return frame.slots[index] ?? (frame.slots[index] = { current: initial }); },
    useMemo: (factory: () => unknown) => factory(), useEffect: () => {},
  };
});
vi.mock("../../../../shared/hooks/useElementActivity", () => ({ useElementActivity: () => false }));
vi.mock("../../../../shared/hooks/useMobileSceneMode", () => ({ useMobileSceneMode: () => state.mobile }));
vi.mock("../../../assistant/harnessStore", () => ({ useHarnessStore: (select: (store: unknown) => unknown) => select({ record: state.record }) }));
vi.mock("@react-three/fiber", () => ({ Canvas: "scene-canvas", useFrame: vi.fn(), useThree: vi.fn() }));
vi.mock("@react-three/drei", () => ({ Grid: "scene-grid", Line: "scene-line", OrbitControls: "orbit-controls" }));

type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(all) : isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : []; }
function mount(component: () => ReactNode) {
  const frame: Frame = { slots: [], cursor: 0 };
  const app = { tree: null as ReactNode,
    render() { frame.cursor = 0; state.frame = frame; try { app.tree = component(); } finally { state.frame = null; } },
    find(predicate: (node: Element) => boolean) { const node = all(app.tree).find(predicate); expect(node).toBeDefined(); return node!; },
    button() { return app.find((node) => node.type === "button" && typeof node.props["aria-pressed"] === "boolean"); },
    toggle() { (app.button().props.onClick as () => void)(); app.render(); },
  };
  app.render(); return app;
}
function svgPointer() {
  let captured = false;
  const matrix = { inverse: () => ({}) };
  const svg = {
    setPointerCapture: vi.fn(() => { captured = true; }), releasePointerCapture: vi.fn(() => { captured = false; }), hasPointerCapture: () => captured,
    getScreenCTM: () => matrix,
    // For a 320px wide, centered/letterboxed viewBox, the true local Y is 100.
    createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 54, y: 100 }) }),
  };
  return { svg, event: { currentTarget: svg, pointerId: 1, pointerType: "touch", clientX: 17, clientY: 122 } };
}
beforeEach(() => { state.mobile = true; state.frame = null; state.record.mockReset(); });

describe("junior 3D touch mode", () => {
  function scene() {
    const element = ReflectionScene3D({ angle: 30, roughness: 0, interacted: false }) as ReactElement;
    return mount(() => (element.type as (props: unknown) => ReactNode)(element.props));
  }
  it("lets the phone scroll until rotation is enabled, then releases it again", () => {
    const app = scene();
    const controls = () => app.find((node) => node.type === "orbit-controls");
    expect(controls().props.enabled).toBe(false);
    expect((app.tree as Element).props.className).toContain("is-scrollable");
    app.toggle();
    expect(controls().props.enabled).toBe(true);
    expect(app.button().props["aria-pressed"]).toBe(true);
    app.toggle();
    expect(controls().props.enabled).toBe(false);
  });
  it("keeps mouse navigation enabled for a desktop viewport", () => {
    state.mobile = false;
    const app = scene();
    expect(app.find((node) => node.type === "orbit-controls").props.enabled).toBe(true);
    expect(all(app.tree).some((node) => node.props.className === "optics-touch-mode")).toBe(false);
  });
});

describe("black-hole touch navigation", () => {
  const drawing = (app: ReturnType<typeof mount>) => app.find((node) => node.type === "svg" && node.props.viewBox === "0 0 1000 520");
  it("does not move light or record an operation during ordinary page swipes", () => {
    const app = mount(BlackHoleLightExtension); const { svg, event } = svgPointer();
    (drawing(app).props.onPointerDown as (event: unknown) => void)(event);
    (drawing(app).props.onPointerUp as (event: unknown) => void)(event);
    expect(svg.setPointerCapture).not.toHaveBeenCalled();
    expect(state.record).not.toHaveBeenCalled();
    expect(drawing(app).props.style).toEqual({ touchAction: "pan-y pinch-zoom" });
  });
  it("uses SVG coordinates in a letterboxed view and records only a completed drag", () => {
    const app = mount(BlackHoleLightExtension); app.toggle();
    const { svg, event } = svgPointer();
    (drawing(app).props.onPointerDown as (event: unknown) => void)(event); app.render();
    (drawing(app).props.onPointerUp as (event: unknown) => void)(event); app.render();
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(state.record).toHaveBeenCalledWith("control.changed", expect.objectContaining({ value: 160, source: "直接拖动光线" }));
    app.toggle();
    expect(drawing(app).props.style).toEqual({ touchAction: "pan-y pinch-zoom" });
  });
  it("releases a cancelled gesture without fabricating a completed operation", () => {
    const app = mount(BlackHoleLightExtension); app.toggle();
    const { svg, event } = svgPointer();
    (drawing(app).props.onPointerDown as (event: unknown) => void)(event);
    (drawing(app).props.onPointerCancel as (event: unknown) => void)(event);
    expect(svg.releasePointerCapture).toHaveBeenCalledOnce(); expect(state.record).not.toHaveBeenCalled();
  });
});

describe("pinhole touch cancellation", () => {
  it("preserves vertical swipes and does not record a browser-cancelled drag", () => {
    const app = mount(StraightPropagationModule); const { svg, event } = svgPointer(); const preventDefault = vi.fn();
    const candle = app.find((node) => node.props["aria-label"] === "拖动烛焰改变物距");
    (candle.props.onPointerDown as (event: unknown) => void)({ ...event, currentTarget: { ownerSVGElement: svg }, preventDefault }); app.render();
    const drawing = app.find((node) => node.type === "svg" && node.props.viewBox === "0 0 900 430");
    expect(drawing.props.style).toEqual({ touchAction: "pan-y pinch-zoom" }); expect(preventDefault).not.toHaveBeenCalled();
    (drawing.props.onPointerCancel as (event: unknown) => void)(event);
    expect(state.record).not.toHaveBeenCalled(); expect(svg.releasePointerCapture).toHaveBeenCalledOnce();
    app.render();
    expect(all(app.tree).some((node) => node.props.className === "straight-rays")).toBe(false);
  });

  it("does not treat tapping an apparatus without movement as changed evidence", () => {
    const app = mount(StraightPropagationModule); const { svg, event } = svgPointer();
    const candle = app.find((node) => node.props["aria-label"] === "拖动烛焰改变物距");
    (candle.props.onPointerDown as (event: unknown) => void)({ ...event, currentTarget: { ownerSVGElement: svg }, preventDefault: vi.fn() }); app.render();
    const drawing = app.find((node) => node.type === "svg" && node.props.viewBox === "0 0 900 430");
    (drawing.props.onPointerUp as (event: unknown) => void)(event); app.render();
    expect(state.record).not.toHaveBeenCalled();
    expect(all(app.tree).some((node) => node.props.className === "straight-rays")).toBe(false);
  });
});
