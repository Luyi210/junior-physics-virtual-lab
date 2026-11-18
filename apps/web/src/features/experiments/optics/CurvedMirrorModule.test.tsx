import { describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { CurvedMirrorModule } from "./CurvedMirrorModule";
import { CurvedMirrorScene3D } from "./components/OpticsLawScene3D";
import { curvedMirrorGeometry, mirrorPath2D, mirrorPoint3D } from "./curvedMirrorGeometry";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useMemo: (read: () => unknown) => read(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next; }];
  }
}));
vi.mock("../../assistant/harnessStore", () => ({ useHarnessStore: (select: Function) => select({ record: () => {} }) }));
vi.mock("@react-three/drei", () => ({ Grid: () => null, Line: () => null, OrbitControls: () => null }));
vi.mock("@react-three/fiber", () => ({ Canvas: () => null, useFrame: () => {}, useThree: () => ({}) }));
type Element = ReactElement<Record<string, any>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, any>>(node) ? [node, ...walk(node.props.children)] : []; }
function text(node: ReactNode): string { return Array.isArray(node) ? node.map(text).join("") : isValidElement<Record<string, any>>(node) ? text(node.props.children) : typeof node === "string" || typeof node === "number" ? String(node) : ""; }
function atDistance(distance: number) {
  hooks.values = []; hooks.cursor = 0;
  let tree = CurvedMirrorModule();
  const presets = walk(tree).find(node => node.props.options && typeof node.props.onSelect === "function")!;
  presets.props.onSelect(distance); hooks.cursor = 0; tree = CurvedMirrorModule(); return tree;
}

describe("curved mirror actual 2D / 3D consumers", () => {
  it("the focal preset uses the shared spherical surface and physical reflected directions", () => {
    const tree = atDistance(120); const nodes = walk(tree); const geometry = curvedMirrorGeometry("concave", 120);
    expect(nodes.find(node => node.props.className === "curved-mirror-surface")!.props.d).toBe(mirrorPath2D(geometry.surface));
    const reflected = nodes.filter(node => node.type === "path" && String(node.props.className).startsWith("reflected"));
    expect(reflected.map(node => node.props.d)).toEqual(geometry.rays.map(ray => mirrorPath2D([ray.hit, ray.end])));
    expect(text(tree)).toContain("因球差不一定严格交于近轴像点");
    expect(nodes.some(node => String(node.props.className).startsWith("curved-image "))).toBe(false);
  });

  it("does not draw a remote paraxial image at a false clamped location", () => {
    const tree = atDistance(130);
    expect(text(tree)).toContain("近轴像在当前视野外，未移动或缩放像点");
    expect(walk(tree).some(node => String(node.props.className).startsWith("curved-image "))).toBe(false);
  });

  it.each(["concave", "convex"] as const)("%s 3D surface and rays retain the 2D physical signs and scale", mirror => {
    const geometry = curvedMirrorGeometry(mirror, 240);
    const tree = CurvedMirrorScene3D({ mirror, objectDistance: 240, ...geometry.result, interacted: true });
    const nodes = walk(tree);
    const beamNodes = nodes.filter(node => typeof node.type === "function" && node.type.name === "PhotonBeam");
    const reflected = beamNodes.filter(node => node.props.color === "#61e5c9");
    expect(reflected.map(node => [node.props.start, node.props.end])).toEqual(geometry.rays.map(ray => [mirrorPoint3D(ray.hit), mirrorPoint3D(ray.end)]));
    const surface = nodes.find(node => typeof node.type === "function" && node.type.name === "CurvedMirrorSurface")!;
    const renderedSurface = (surface.type as Function)(surface.props);
    const mesh = walk(renderedSurface).find(node => node.props.geometry)!;
    const vertices = mesh.props.geometry.getAttribute("position");
    for (let index = 0; index < vertices.count; index++) {
      const x = vertices.getX(index); const y = vertices.getY(index); const z = vertices.getZ(index);
      const center = mirror === "concave" ? -3 : 3;
      expect((x - center) ** 2 + y ** 2 + z ** 2).toBeCloseTo(9, 5);
    }
    mesh.props.geometry.dispose();
  });
});
