import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { collisionExtent } from '../expanded/expandedGeometry';

export function collisionComparison(parameters: Record<string, number>, state: Record<string, number>) {
  const initialMomentum = parameters.mass1 * parameters.velocity1 + parameters.mass2 * parameters.velocity2;
  const initialEnergy = .5 * parameters.mass1 * parameters.velocity1 ** 2 + .5 * parameters.mass2 * parameters.velocity2 ** 2;
  const phase = state.collided === 1 ? 'after' : state.collisionPredicted === 0 ? 'separating' : state.collisionWithinWindow === 0 ? 'outside' : 'before';
  return { phase, initialMomentum, initialEnergy, momentumDifference: state.totalMomentum - initialMomentum,
    initialVelocity1: parameters.velocity1, initialVelocity2: parameters.velocity2 };
}

export function collisionScene(parameters: Record<string, number>, simulation: HighSchoolSimulation) {
  const extent = collisionExtent(simulation.series);
  const svgPosition = (x: number) => 350 + x / extent * 235;
  const worldPosition = (x: number) => x / extent * 3.1;
  return { extent, svgPosition, worldPosition, initialX1: -parameters.separation / 2, initialX2: parameters.separation / 2,
    // Both cart-facing ends meet at the same model position; bodies never overlap.
    svgCart1: svgPosition(simulation.state.x1) - 28, svgCart2: svgPosition(simulation.state.x2) + 28,
    worldCart1: worldPosition(simulation.state.x1) - .35, worldCart2: worldPosition(simulation.state.x2) + .35 };
}

export const collisionExamples = [
  { label: '等质量相向', description: '两质量0.5 kg，初速+1/−1 m/s，间距1 m；保留e。', patch: { mass1: .5, mass2: .5, velocity1: 1, velocity2: -1, separation: 1 } },
  { label: '同向追碰', description: '两质量0.5 kg，初速+2/+0.5 m/s，间距1 m；保留e。', patch: { mass1: .5, mass2: .5, velocity1: 2, velocity2: .5, separation: 1 } },
  { label: '相互远离', description: '两质量0.5 kg，初速−1/+1 m/s，间距1 m；保留e。', patch: { mass1: .5, mass2: .5, velocity1: -1, velocity2: 1, separation: 1 } },
] as const;
