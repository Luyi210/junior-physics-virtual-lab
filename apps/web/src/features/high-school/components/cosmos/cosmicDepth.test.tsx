import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CosmicStaticArt } from './CosmicStaticArt';
import {
  COSMIC_GLOBE_RADIUS, COSMIC_LIGHT, COSMIC_RINGS, DEFAULT_COSMIC_VIEW,
  cosmicDiffuseLight, cosmicOrbitRibbon, cosmicReferenceGrid, cosmicSphereShadow,
  cosmicWaveAmplitude, cosmicWaveMesh,
} from './cosmicGeometry';

describe('observatory depth cues share their geometric source', () => {
  it('puts the terminator perpendicular to the same key light that illuminates the sphere', () => {
    expect(cosmicDiffuseLight(COSMIC_LIGHT)).toBeCloseTo(1);
    expect(cosmicDiffuseLight({ x: -COSMIC_LIGHT.x, y: -COSMIC_LIGHT.y, z: -COSMIC_LIGHT.z })).toBe(0);
    const { terminator, polygon } = cosmicSphereShadow();
    for (const point of terminator) {
      const x = (point.x - 325) / COSMIC_GLOBE_RADIUS;
      const y = -(point.y - 209) / COSMIC_GLOBE_RADIUS;
      const z = -Math.sqrt(Math.max(0, 1 - x * x - y * y));
      expect(x * COSMIC_LIGHT.x + y * COSMIC_LIGHT.y + z * COSMIC_LIGHT.z).toBeCloseTo(0, 7);
    }
    expect(polygon.every(point => Math.hypot(point.x - 325, point.y - 209) <= COSMIC_GLOBE_RADIUS + 1e-8)).toBe(true);
  });

  it('uses finite-width projected strips on the correct side of the sphere at the camera limits', () => {
    for (const view of [DEFAULT_COSMIC_VIEW, { yaw: -1.25, pitch: .62 }, { yaw: 1.25, pitch: -.62 }]) {
      for (const ring of COSMIC_RINGS) for (const front of [false, true]) {
        const pieces = cosmicOrbitRibbon(view, ring, front);
        expect(pieces.length).toBeGreaterThan(0);
        expect(pieces.every(piece => (piece.depth < 0) === front)).toBe(true);
        for (const piece of pieces) {
          expect(piece.points.flatMap(point => [point.x, point.y, point.depth]).every(Number.isFinite)).toBe(true);
        }
        // A strip can approach zero projected width when viewed edge-on.
        const widths = pieces.map(piece => Math.hypot(piece.points[0].x - piece.points[1].x, piece.points[0].y - piece.points[1].y));
        expect(Math.max(...widths)).toBeGreaterThan(2);
        expect(Math.min(...widths)).toBeLessThan(Math.max(...widths));
      }
    }
    const html = renderToStaticMarkup(<CosmicStaticArt mode="orbit" id="depth"/>);
    expect(html.indexOf('data-cosmic-depth-layer="rear-rings"')).toBeLessThan(html.indexOf('data-cosmic-depth-layer="globe"'));
    expect(html.indexOf('data-cosmic-depth-layer="globe"')).toBeLessThan(html.indexOf('data-cosmic-depth-layer="front-rings"'));
  });

  it('builds the raised wave surface from the existing two-source sum and paints far faces first', () => {
    for (const time of [0, 2.3, 12345]) {
      const mesh = cosmicWaveMesh(DEFAULT_COSMIC_VIEW, time);
      expect(mesh.faces).toHaveLength(28 * 44);
      for (const vertex of mesh.rows.flat()) {
        expect(vertex.amplitude).toBeCloseTo(cosmicWaveAmplitude(vertex.world.x, vertex.world.z, time));
        expect(vertex.world.y).toBeCloseTo(vertex.amplitude * .23);
      }
      expect(mesh.faces.every((face, index, faces) => index === 0 || faces[index - 1].depth >= face.depth)).toBe(true);
      expect(mesh.faces.every(face => Number.isFinite(face.light) && face.light >= 0 && face.light <= 1)).toBe(true);
    }
  });

  it('shows a receding reference plane while the quantum fallback remains a density cloud without orbit bands', () => {
    const horizontal = cosmicReferenceGrid({ yaw: 0, pitch: -.3 }).slice(13);
    const width = (line: typeof horizontal[number]) => Math.abs(line.points[1].x - line.points[0].x);
    expect(width(horizontal[0])).toBeGreaterThan(width(horizontal.at(-1)!));
    const html = renderToStaticMarkup(<CosmicStaticArt mode="quantum" id="density"/>);
    expect(html).not.toContain('data-cosmic-depth-layer=');
    expect(html).not.toContain('<ellipse');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
