export type ScenePoint3 = [number, number, number];
export interface PlanarPosition { x: number; y: number }

export const DOUBLE_SLIT_SCREEN_2D = { left: 490, top: 65, width: 130, height: 250, minMm: -20, maxMm: 20 };

export function doubleSlitScreenFraction(positionMm: number) {
  return (positionMm - DOUBLE_SLIT_SCREEN_2D.minMm) / (DOUBLE_SLIT_SCREEN_2D.maxMm - DOUBLE_SLIT_SCREEN_2D.minMm);
}

export function doubleSlitScreenY(positionMm: number) {
  return DOUBLE_SLIT_SCREEN_2D.top + doubleSlitScreenFraction(positionMm) * DOUBLE_SLIT_SCREEN_2D.height;
}

/** The arrow lives in world coordinates, so its apparent direction follows the orbit camera. */
export function uniformDirectionArrowGeometry() {
  const start: ScenePoint3 = [2, -.2, .85];
  const tip: ScenePoint3 = [3.7, -.2, .85];
  const headLength = .24;
  return {
    start, tip, headLength, headRadius: .1,
    shaftEnd: [tip[0] - headLength, tip[1], tip[2]] as ScenePoint3,
    headCenter: [tip[0] - headLength / 2, tip[1], tip[2]] as ScenePoint3,
    headRotation: [0, 0, -Math.PI / 2] as ScenePoint3,
    labelPosition: [2.85, -.6, .85] as ScenePoint3,
  };
}

export const NEWTON_SCENE = {
  pulleyCenter: [2.8, .35, 0] as ScenePoint3,
  pulleyRotation: [0, 0, 0] as ScenePoint3,
  pulleyRadius: .17,
  pulleyTubeRadius: .04,
  cartStartX: -1.4,
  cartHalfLength: .4,
  travel: 1.1,
  weightSize: .32,
};

/** Scene lengths are illustrative; both masses always use the same displacement scale. */
export function newtonSceneGeometry(position: number, travelDistance: number) {
  const progress = Math.max(0, Math.min(1, position / travelDistance));
  const cartX = NEWTON_SCENE.cartStartX + progress * NEWTON_SCENE.travel;
  const weightTopY = -progress * NEWTON_SCENE.travel;
  const [cx, cy, cz] = NEWTON_SCENE.pulleyCenter;
  // The cord follows the outside of the rim, in the wheel's XY plane.
  const ropeRadius = NEWTON_SCENE.pulleyRadius + NEWTON_SCENE.pulleyTubeRadius;
  const arc: ScenePoint3[] = Array.from({ length: 33 }, (_, index) => {
    const angle = Math.PI / 2 * (1 - index / 32);
    return [cx + ropeRadius * Math.cos(angle), cy + ropeRadius * Math.sin(angle), cz];
  });
  const cartAnchor: ScenePoint3 = [cartX + NEWTON_SCENE.cartHalfLength, cy + ropeRadius, cz];
  const weightAnchor: ScenePoint3 = [cx + ropeRadius, weightTopY, cz];
  return {
    cartX, ropeRadius, arc, cartAnchor, weightAnchor,
    ropePoints: [cartAnchor, ...arc, weightAnchor],
    weightCenter: [weightAnchor[0], weightTopY - NEWTON_SCENE.weightSize / 2, cz] as ScenePoint3,
    weightLabel: [weightAnchor[0], weightTopY - .55, cz] as ScenePoint3,
  };
}

export const PROJECTILE_SCENE = {
  groundY: -.675,
  platformThickness: .15,
  platformWidth: 8.5,
  platformDepth: 1.9,
  ballRadius: .14,
  originX: -3.5,
};

/** One mapping for the ball and its centre trajectory; y=0 rests on the platform. */
export function projectileSceneGeometry(trajectory: readonly PlanarPosition[], position: PlanarPosition, initialHeight: number) {
  const maxX = Math.max(1, ...trajectory.map((point) => point.x));
  const maxY = Math.max(1, ...trajectory.map((point) => point.y));
  const scale = Math.min(7 / maxX, 3.4 / maxY);
  const { groundY, ballRadius, originX, platformThickness, platformWidth, platformDepth } = PROJECTILE_SCENE;
  const centerAt = (point: PlanarPosition): ScenePoint3 => [originX + point.x * scale, groundY + ballRadius + point.y * scale, 0];
  return {
    scale,
    ballCenter: centerAt(position),
    trajectoryCenters: trajectory.map(centerAt),
    platformCenter: [0, groundY - platformThickness / 2, 0] as ScenePoint3,
    platformSize: [platformWidth, platformThickness, platformDepth] as ScenePoint3,
    heightPostStart: [originX, groundY, 0] as ScenePoint3,
    heightPostEnd: [originX, groundY + initialHeight * scale, 0] as ScenePoint3,
  };
}
