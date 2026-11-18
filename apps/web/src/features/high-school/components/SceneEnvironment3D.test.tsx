import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { Box3, BoxGeometry, DirectionalLight, Euler, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOL_EXPERIMENTS } from '@physics-lab/physics/high-school';
import { SceneEnvironment3D } from './SceneEnvironment3D';
import { sceneCameraPosition } from './sceneCamera';

type Element = ReactElement<Record<string, unknown>>;
type Point3 = [number, number, number];
function nodes(tree: ReactNode): Element[] {
  return Array.isArray(tree) ? tree.flatMap(nodes) : isValidElement<Record<string, unknown>>(tree) ? [tree, ...nodes(tree.props.children as ReactNode)] : [];
}

// Build real Three geometry from the actual environment component. This checks
// coordinates and ray/shadow projections, not a renderer or a GPU screenshot.
function environmentMeshes() {
  return nodes(SceneEnvironment3D()).filter(node => node.type === 'mesh').map(node => {
    const children = nodes(node.props.children as ReactNode);
    const geometry = children.find(child => child.type === 'boxGeometry' || child.type === 'planeGeometry')!;
    const args = geometry.props.args as number[];
    const mesh = new Mesh(geometry.type === 'boxGeometry' ? new BoxGeometry(...args) : new PlaneGeometry(...args), new MeshStandardMaterial());
    mesh.name = node.props.name as string || '';
    mesh.position.set(...node.props.position as Point3);
    if (node.props.rotation) mesh.rotation.copy(new Euler(...node.props.rotation as Point3));
    mesh.updateMatrixWorld();
    return mesh;
  });
}
function dispose(meshes: Mesh[]) { meshes.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); }); }

describe('static laboratory stage geometry, without WebGL', () => {
  it('preserves the original ground plane and puts every new opaque edge below it', () => {
    const meshes = environmentMeshes();
    try {
      const stage = meshes.find(mesh => mesh.name === 'instrument-stage')!;
      const bounds = new Box3().setFromObject(stage);
      expect(bounds.max.y).toBeCloseTo(-1.5, 7);
      expect(bounds.min.y).toBeLessThan(-1.5);
      for (const mesh of meshes) expect(new Box3().setFromObject(mesh).max.y).toBeLessThanOrEqual(-1.5 + 1e-7);
      const floor = meshes.find(mesh => mesh.name === 'laboratory-floor')!;
      expect(new Box3().setFromObject(floor).max.y).toBeLessThan(bounds.min.y);

      // The reference grid floats only a few thousandths over the sole top,
      // while staying inside it. There is no duplicate coplanar opaque plane.
      const grid = nodes(SceneEnvironment3D()).find(node => 'cellSize' in node.props)!;
      const gridY = (grid.props.position as Point3)[1], gridSize = grid.props.args as number[];
      expect(gridY - bounds.max.y).toBeGreaterThan(.001);
      expect(gridY - bounds.max.y).toBeLessThan(.01);
      expect(gridSize[0]).toBeLessThan(bounds.max.x - bounds.min.x);
      expect(gridSize[1]).toBeLessThan(bounds.max.z - bounds.min.z);
    } finally { dispose(meshes); }
  });

  it('leaves low apparatus points visible from every supported camera and an orbit behind the stage', () => {
    const meshes = environmentMeshes(), ray = new Raycaster();
    try {
      const positions = HIGH_SCHOOL_EXPERIMENTS.flatMap(definition => ['perspective', 'front', 'top'].map(view => sceneCameraPosition(definition.id, view as 'perspective' | 'front' | 'top')));
      positions.push([-8, 4, -8]);
      for (const position of positions) for (const x of [-5.5, 0, 5.5]) for (const z of [-4.5, 0, 4.5]) {
        const origin = new Vector3(...position), target = new Vector3(x, -1.49, z);
        ray.set(origin, target.clone().sub(origin).normalize()); ray.far = origin.distanceTo(target);
        expect(ray.intersectObjects(meshes, false), `camera ${position} to ${target.toArray()}`).toHaveLength(0);
      }
    } finally { dispose(meshes); }
  });

  it('covers the instrument volume and complete stage in one bounded shadow map', () => {
    const lights = nodes(SceneEnvironment3D()).filter(node => node.props.castShadow && String(node.type).endsWith('Light'));
    expect(lights).toHaveLength(1);
    const source = lights[0]!, mapSize = source.props['shadow-mapSize'] as number[];
    expect(mapSize[0] * mapSize[1]).toBeLessThanOrEqual(1024 * 1024);
    const light = new DirectionalLight();
    light.position.set(...source.props.position as Point3); light.updateMatrixWorld(); light.target.updateMatrixWorld();
    const camera = light.shadow.camera;
    for (const field of ['left', 'right', 'top', 'bottom', 'near', 'far'] as const) camera[field] = source.props[`shadow-camera-${field}`] as number;
    camera.updateProjectionMatrix(); light.shadow.updateMatrices(light);
    // The stage itself and a generous apparatus envelope including vector boards.
    for (const x of [-6.52, 6.52]) for (const y of [-1.97, 4.5]) for (const z of [-5.02, 5.02]) {
      const projected = new Vector3(x, y, z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
      expect(Math.abs(projected.z)).toBeLessThan(1);
    }
    light.dispose();
  });
});
