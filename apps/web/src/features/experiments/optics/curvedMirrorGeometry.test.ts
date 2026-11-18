import { describe, expect, it } from "vitest";
import { curvedMirrorGeometry, mirrorPoint2D, mirrorPoint3D, sphericalMirrorSurfaceX, MIRROR_RADIUS } from "./curvedMirrorGeometry";

describe("spherical mirror surface, rays and paraxial image", () => {
  it.each(["concave", "convex"] as const)("%s puts the vertex, focus and ray hits on one physical coordinate system", kind => {
    const geometry = curvedMirrorGeometry(kind, 240);
    expect(sphericalMirrorSurfaceX(kind, 0)).toBeCloseTo(0);
    expect(mirrorPoint2D([0, 0, 0])).toEqual({ x: 650, y: 225 });
    for (const point of [...geometry.surface, ...geometry.rays.map(ray => ray.hit)]) {
      expect((point[0] - geometry.center[0]) ** 2 + point[1] ** 2 + point[2] ** 2).toBeCloseTo(MIRROR_RADIUS ** 2, 7);
    }
    expect(sphericalMirrorSurfaceX(kind, 100) < 0).toBe(kind === "concave");
    expect(Math.abs(geometry.focus[0])).toBe(MIRROR_RADIUS / 2);
  });

  it.each([80, 120, 180, 240, 360])("u=%s obeys reflection at every displayed hit for both mirror kinds", u => {
    for (const kind of ["concave", "convex"] as const) {
      const geometry = curvedMirrorGeometry(kind, u);
      for (const ray of geometry.rays) {
        const incomingNormal = ray.incident.reduce((sum, value, index) => sum + value * ray.normal[index]!, 0);
        const outgoingNormal = ray.reflected.reduce((sum, value, index) => sum + value * ray.normal[index]!, 0);
        expect(incomingNormal + outgoingNormal).toBeCloseTo(0, 12);
        expect(Math.hypot(...ray.reflected)).toBeCloseTo(1, 12);
        expect(ray.reflected[0]).toBeLessThan(0);
      }
      const vertexRay = geometry.rays[1]!;
      expect(vertexRay.reflected[1] / -vertexRay.reflected[0]).toBeCloseTo(-18 / u, 12);
    }
  });

  it("the focal preset is nearly parallel, not an arbitrary pair of screen endpoints", () => {
    const geometry = curvedMirrorGeometry("concave", 120);
    expect(geometry.image).toBeNull();
    const angles = geometry.rays.map(ray => Math.atan2(-ray.reflected[1], -ray.reflected[0]) * 180 / Math.PI);
    expect(angles[1]).toBeCloseTo(Math.atan(18 / 120) * 180 / Math.PI, 10);
    expect(Math.abs(angles[0]! - angles[1]!)).toBeLessThan(.08);
    expect(Math.abs(angles[0]! - angles[1]!)).toBeGreaterThan(0); // spherical aberration is not erased
  });

  it("keeps exact image scale and marks a remote image outside the viewport instead of clamping it", () => {
    const remote = curvedMirrorGeometry("concave", 130);
    expect(remote.image).toEqual([-1560, -216, 0]);
    expect(remote.imageVisible).toBe(false);
    const equal = curvedMirrorGeometry("concave", 240);
    expect(equal.image).toEqual([-240, -18, 0]);
    expect(equal.imageVisible).toBe(true);
    expect(mirrorPoint3D(equal.image!)[1] - 1.45).toBeCloseTo(-.225);
  });

  it("retains the paraxial formula and a small real spherical-ray discrepancy rather than moving the image to fit", () => {
    const geometry = curvedMirrorGeometry("concave", 180);
    expect(geometry.image).toEqual([-360, -36, 0]);
    for (const ray of geometry.rays) {
      const distance = (geometry.image![0] - ray.hit[0]) / ray.reflected[0];
      const height = ray.hit[1] + distance * ray.reflected[1];
      expect(Math.abs(height - geometry.image![1])).toBeLessThan(.4);
    }
  });
});
