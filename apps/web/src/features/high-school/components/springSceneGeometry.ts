import type { ScenePoint3 } from './sceneGeometry';

/** Fixed scales: changing the load or natural length never rescales the ruler. */
export const SPRING_SCENE = {
  svgTop: 55, svgPixelsPerMetre: 400, svgX: 290,
  worldTop: 2.8, worldUnitsPerMetre: 6,
  rulerMetres: .6, coilTurns: 10, coilRadius: .16,
  weightHeight: .28, baseTop: -1.2,
};

export function springSceneGeometry(naturalLength: number, length: number) {
  const svgY = (metres: number) => SPRING_SCENE.svgTop + metres * SPRING_SCENE.svgPixelsPerMetre;
  const worldY = (metres: number) => SPRING_SCENE.worldTop - metres * SPRING_SCENE.worldUnitsPerMetre;
  const points: ScenePoint3[] = Array.from({ length: 241 }, (_, index) => {
    const t = index / 240;
    const radius = SPRING_SCENE.coilRadius * Math.min(1, t * 20, (1 - t) * 20);
    const angle = t * SPRING_SCENE.coilTurns * Math.PI * 2;
    return [radius * Math.cos(angle), worldY(length * t), radius * Math.sin(angle)];
  });
  const ticks = Array.from({ length: 61 }, (_, index) => {
    const metres = index / 100;
    return { metres, centimetres: index, major: index % 5 === 0, svgY: svgY(metres), worldY: worldY(metres) };
  });
  return {
    svgTop: svgY(0), svgNaturalEnd: svgY(naturalLength), svgEnd: svgY(length),
    worldTop: worldY(0), worldNaturalEnd: worldY(naturalLength), worldEnd: worldY(length),
    coilPoints: points, ticks,
    svgCoilPath: points.map(([x, y], index) => `${index ? 'L' : 'M'}${SPRING_SCENE.svgX + x * 95},${svgY((SPRING_SCENE.worldTop - y) / SPRING_SCENE.worldUnitsPerMetre)}`).join(' '),
    weightCenter: [0, worldY(length) - .08 - SPRING_SCENE.weightHeight / 2, 0] as ScenePoint3,
  };
}
