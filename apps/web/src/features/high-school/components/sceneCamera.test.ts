import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { OrbitControls } from '@react-three/drei';
import { HIGH_SCHOOL_EXPERIMENTS, createCapacitorHistory, defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import ExperimentScene3D from './ExperimentScene3D';
import { sceneCameraPosition, type SceneCameraView } from './sceneCamera';

type Element = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Element[] { return Array.isArray(tree) ? tree.flatMap(nodes) : isValidElement<Record<string, unknown>>(tree) ? [tree, ...nodes(tree.props.children as ReactNode)] : []; }

describe('scene camera finite geometry; no GPU rendering is asserted', () => {
  it.each(HIGH_SCHOOL_EXPERIMENTS.map(item => item.id))('%s has three usable camera poses aimed at its actual OrbitControls target', id => {
    const parameters = defaultHighSchoolParameters(id), simulation = simulateHighSchoolExperiment(id, parameters, 0, id === 'capacitor-charge' ? createCapacitorHistory('camera-test') : undefined);
    const snapshot = JSON.stringify({ parameters, simulation });
    const positions: number[][] = [];
    for (const cameraView of ['perspective', 'front', 'top'] as SceneCameraView[]) {
      const tree = ExperimentScene3D({ experimentId: id, parameters, simulation, trajectory: [], cameraView, onContextLost() {} }) as Element;
      const settings = tree.props.camera as { position: [number, number, number]; fov: number; near: number; far: number };
      const orbit = nodes(tree).find(node => node.type === OrbitControls)!;
      const target = new Vector3(...orbit.props.target as [number, number, number]), position = new Vector3(...settings.position);
      expect(settings.position).toEqual(sceneCameraPosition(id, cameraView)); expect(settings.position.every(Number.isFinite)).toBe(true);
      const direction = target.clone().sub(position); expect(direction.length()).toBeGreaterThan(settings.near); expect(direction.length()).toBeLessThan(settings.far);
      expect(direction.length()).toBeGreaterThanOrEqual(orbit.props.minDistance as number); expect(direction.length()).toBeLessThanOrEqual(orbit.props.maxDistance as number);
      expect(direction.clone().normalize().cross(new Vector3(0, 1, 0)).length()).toBeGreaterThan(1e-5);
      const camera = new PerspectiveCamera(settings.fov, 1.5, settings.near, settings.far); camera.position.copy(position); camera.lookAt(target); camera.updateMatrixWorld();
      const centre = target.clone().project(camera); expect(centre.x).toBeCloseTo(0, 10); expect(centre.y).toBeCloseTo(0, 10); expect(centre.z).toBeGreaterThan(-1); expect(centre.z).toBeLessThan(1);
      expect([...camera.projectionMatrix.elements, ...camera.matrixWorldInverse.elements].every(Number.isFinite)).toBe(true);
      positions.push(settings.position);
    }
    expect(new Set(positions.map(position => position.join(','))).size).toBe(3);
    expect(JSON.stringify({ parameters, simulation })).toBe(snapshot);
  });

  it('keeps front-view horizontal and vertical world directions readable and preserves the double-slit screen-facing default', () => {
    const camera = new PerspectiveCamera(42, 1.5, .1, 80); camera.position.set(...sceneCameraPosition('pendulum', 'front')); camera.lookAt(0, .4, 0); camera.updateMatrixWorld();
    expect(new Vector3(1, .4, 0).project(camera).x).toBeGreaterThan(0); expect(new Vector3(0, 1.4, 0).project(camera).y).toBeGreaterThan(0);
    expect(sceneCameraPosition('double-slit', 'perspective')[0]).toBeLessThan(3);
  });
});
