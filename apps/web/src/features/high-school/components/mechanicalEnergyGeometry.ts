/** Display coordinates only. Motion and energy values are supplied by physics. */
export const MECHANICAL_ENERGY_GEOMETRY = {
  svgFloorY: 330, svgBallRadius: 12, svgUnitsPerMetre: 110, svgBallX: 240,
  worldFloorY: -1.2, worldBallRadius: .16, worldUnitsPerMetre: 1.65, worldBallX: -.25,
} as const;

export function mechanicalEnergyGeometry(dropHeight: number, position: number) {
  const p = Math.max(0, Math.min(dropHeight, position));
  const svgY = (distance: number) => MECHANICAL_ENERGY_GEOMETRY.svgFloorY - MECHANICAL_ENERGY_GEOMETRY.svgBallRadius - (dropHeight - distance) * MECHANICAL_ENERGY_GEOMETRY.svgUnitsPerMetre;
  const worldY = (distance: number) => MECHANICAL_ENERGY_GEOMETRY.worldFloorY + MECHANICAL_ENERGY_GEOMETRY.worldBallRadius + (dropHeight - distance) * MECHANICAL_ENERGY_GEOMETRY.worldUnitsPerMetre;
  const ticks = Array.from({ length: Math.floor(dropHeight * 10 + 1e-8) + 1 }, (_, index) => ({ distance: index / 10, major: index % 5 === 0, svgY: svgY(index / 10), worldY: worldY(index / 10) }));
  return { position: p, svgY: svgY(p), svgReleaseY: svgY(0), svgEndY: svgY(dropHeight), worldY: worldY(p), worldReleaseY: worldY(0), worldEndY: worldY(dropHeight), ticks };
}

/** Ruler magnification gives each tick one shared coordinate transform. No reading is returned or filled. */
export function tapeRulerGeometry(positionMm: number) {
  const low = Math.max(0, Math.floor(positionMm) - 2);
  const span = 6;
  const x = (value: number) => 24 + (value - low) / span * 312;
  return { low, high: low + span, pointX: x(positionMm), ticks: Array.from({ length: 61 }, (_, index) => ({ positionMm: low + index / 10, x: x(low + index / 10), major: index % 10 === 0, half: index % 5 === 0 })) };
}
