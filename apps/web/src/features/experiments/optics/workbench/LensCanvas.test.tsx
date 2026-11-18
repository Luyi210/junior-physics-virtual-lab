import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { calculateLens } from "@physics-lab/physics";
import { LensCanvas } from "./LensCanvas";
import type { LensSceneState } from "./lensStore";

const state = vi.hoisted(() => ({ size: { width: 320, height: 460 }, preview: vi.fn(), remember: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useEffect: () => {}, useRef: (value: unknown) => ({ current: value }), useState: (value: unknown) => [value, vi.fn()] }));
vi.mock("react-konva", () => Object.fromEntries(["Arrow", "Circle", "Group", "Layer", "Line", "Rect", "Stage", "Text"].map((name) => [name, name])));
vi.mock("./useElementSize", () => ({ useElementSize: () => ({ ref: { current: null }, size: state.size }) }));
vi.mock("../../../../shared/hooks/useElementActivity", () => ({ useElementActivity: () => false }));
vi.mock("./lensStore", () => ({ useLensStore: (select: (store: unknown) => unknown) => select(state) }));

type Element = ReactElement<Record<string, unknown>>;
function all(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(all);
  return isValidElement<Record<string, unknown>>(node) ? [node, ...all(node.props.children as ReactNode)] : [];
}
const scene: LensSceneState = { lensX: 0, focalLength: 20, objectX: -40, objectHeight: 10, screenX: 40, showRays: true, showGrid: true, showLabels: true };
function bench() { return all(LensCanvas({ scene, result: calculateLens(scene) })); }
beforeEach(() => { state.preview.mockReset(); state.remember.mockReset(); });

describe("responsive convex-lens canvas", () => {
  it.each([280, 320, 390, 760, 1280])("keeps the complete apparatus within a %spx container", (width) => {
    state.size = { width, height: 460 };
    const nodes = bench();
    const stage = nodes.find((node) => node.type === "Stage")!;
    expect(stage.props.width).toBe(width);
    const groups = nodes.filter((node) => node.type === "Group" && node.props.draggable);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const bound = group.props.dragBoundFunc as (p: { x: number; y: number }) => { x: number; y: number };
      expect(bound({ x: -10000, y: 20 }).x).toBeGreaterThan(0);
      expect(bound({ x: 10000, y: 20 }).x).toBeLessThan(width);
      expect(group.props.preventDefault).toBe(false);
      expect(all(group).some((node) => node.type === "Rect" && node.props.width === 44 && node.props.preventDefault === false)).toBe(true);
    }
    expect(stage.props.style).toEqual({ touchAction: "pan-y pinch-zoom" });
  });

  it("preserves lens coordinates and undo history when dragging on a phone", () => {
    state.size = { width: 320, height: 460 };
    const nodes = bench();
    const object = nodes.find((node) => node.type === "Group" && node.props.draggable)!;
    (object.props.onDragStart as () => void)();
    (object.props.onDragMove as (event: unknown) => void)({ target: { x: () => object.props.x } });
    (object.props.onDragEnd as () => void)();
    expect(state.preview).toHaveBeenCalledWith({ objectX: -40 });
    expect(state.remember).toHaveBeenCalledOnce();
    expect(state.remember).toHaveBeenCalledWith(scene);
  });
});
