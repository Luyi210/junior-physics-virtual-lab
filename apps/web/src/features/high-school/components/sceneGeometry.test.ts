import { describe, expect, it } from "vitest";
import { BoxGeometry, ConeGeometry, Euler, Matrix4, PerspectiveCamera, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { calculateNewtonSecondLaw, calculateProjectileMotion } from "@physics-lab/physics/high-school";
import { NEWTON_SCENE, newtonSceneGeometry, PROJECTILE_SCENE, projectileSceneGeometry, uniformDirectionArrowGeometry, type ScenePoint3 } from "./sceneGeometry";

const vector = (point: ScenePoint3) => new Vector3(...point);
const distance = (a: ScenePoint3, b: ScenePoint3) => vector(a).distanceTo(vector(b));
const ropeLength = (points: ScenePoint3[]) => points.slice(1).reduce((length, point, index) => length + distance(points[index]!, point), 0);

describe("uniform-motion world direction arrow", () => {
  const arrow = uniformDirectionArrowGeometry();
  const headTransform = new Matrix4().makeRotationFromEuler(new Euler(...arrow.headRotation)).setPosition(...arrow.headCenter);
  const base = new Vector3(0, -arrow.headLength / 2, 0).applyMatrix4(headTransform);
  const tip = new Vector3(0, arrow.headLength / 2, 0).applyMatrix4(headTransform);

  it("connects the rod to the cone base and puts its apex at world +x", () => {
    const cone = new ConeGeometry(arrow.headRadius, arrow.headLength, 16);
    cone.applyMatrix4(headTransform);
    cone.computeBoundingBox();
    expect(base.distanceTo(vector(arrow.shaftEnd))).toBeLessThan(1e-12);
    expect(tip.distanceTo(vector(arrow.tip))).toBeLessThan(1e-12);
    expect(tip.clone().sub(base).normalize().distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12);
    expect(cone.boundingBox!.max.x).toBeCloseTo(arrow.tip[0], 6);
    expect(vector(arrow.start).x).toBeLessThan(base.x);
    cone.dispose();
  });

  it.each([
    { name: "front", cameraPosition: [7.4, 4.5, 8] as ScenePoint3, sign: 1 },
    { name: "back", cameraPosition: [-7.4, 4.5, -8] as ScenePoint3, sign: -1 },
  ])("projects the arrow in the same direction as +x motion from the $name", ({ cameraPosition, sign }) => {
    const camera = new PerspectiveCamera(42, 1.5, .1, 80);
    camera.position.set(...cameraPosition);
    camera.lookAt(0, .4, 0);
    camera.updateMatrixWorld();
    const arrowDelta = tip.clone().project(camera).x - vector(arrow.start).project(camera).x;
    const motionDelta = new Vector3(1, .26, 0).project(camera).x - new Vector3(0, .26, 0).project(camera).x;
    expect(Math.sign(arrowDelta)).toBe(sign);
    expect(Math.sign(arrowDelta)).toBe(Math.sign(motionDelta));
  });
});

describe("Newton apparatus geometry", () => {
  it("places the wheel and quarter-circle cord in the same plane with tangent entry and exit", () => {
    const scene = newtonSceneGeometry(0, 1);
    const center = vector(NEWTON_SCENE.pulleyCenter);
    const wheel = new TorusGeometry(NEWTON_SCENE.pulleyRadius, NEWTON_SCENE.pulleyTubeRadius, 10, 24);
    const rotation = new Matrix4().makeRotationFromEuler(new Euler(...NEWTON_SCENE.pulleyRotation));
    const normal = new Vector3(0, 0, 1).applyMatrix4(rotation);
    wheel.applyMatrix4(rotation);
    wheel.translate(...NEWTON_SCENE.pulleyCenter);
    wheel.computeBoundingBox();
    for (const point of scene.arc) {
      const radius = vector(point).sub(center);
      expect(radius.dot(normal)).toBeCloseTo(0, 12);
      expect(radius.length()).toBeCloseTo(scene.ropeRadius, 12);
    }
    const top = scene.arc[0]!;
    const right = scene.arc.at(-1)!;
    expect(top[1]).toBeCloseTo(wheel.boundingBox!.max.y, 6);
    expect(right[0]).toBeCloseTo(wheel.boundingBox!.max.x, 6);
    const incoming = vector(top).sub(vector(scene.cartAnchor)).normalize();
    const outgoing = vector(scene.weightAnchor).sub(vector(right)).normalize();
    expect(incoming.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-12);
    expect(outgoing.distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-12);
    expect(incoming.dot(vector(top).sub(center))).toBeCloseTo(0, 12);
    expect(outgoing.dot(vector(right).sub(center))).toBeCloseTo(0, 12);
    // The renderer's polyline is a sufficiently close sampling of the circular arc.
    expect(ropeLength(scene.arc)).toBeCloseTo(Math.PI * scene.ropeRadius / 2, 4);
    wheel.dispose();
  });

  it.each([.25, 1, 2])("keeps cord length and equal mass displacement across a %s m model run", (travelDistance) => {
    const parameters = { cartMass: .5, hangingMass: .05, resistance: .05, travelDistance };
    const duration = calculateNewtonSecondLaw(parameters, 0).durationSeconds;
    const initial = newtonSceneGeometry(0, travelDistance);
    for (const time of [0, duration / 4, duration / 2, duration, duration + 1]) {
      const state = calculateNewtonSecondLaw(parameters, time);
      const scene = newtonSceneGeometry(state.position, travelDistance);
      const cartDisplacement = scene.cartX - initial.cartX;
      const weightDisplacement = initial.weightCenter[1] - scene.weightCenter[1];
      expect(cartDisplacement).toBeCloseTo(weightDisplacement, 12);
      expect(ropeLength(scene.ropePoints)).toBeCloseTo(ropeLength(initial.ropePoints), 12);
      expect(scene.weightAnchor[1]).toBeCloseTo(scene.weightCenter[1] + NEWTON_SCENE.weightSize / 2, 12);
      expect(scene.cartAnchor[0]).toBeLessThan(scene.arc[0]![0]);
      expect(scene.weightAnchor[1]).toBeLessThan(scene.arc.at(-1)![1]);
      expect(scene.weightCenter[1] - NEWTON_SCENE.weightSize / 2).toBeGreaterThan(-1.49);
      expect(cartDisplacement).toBeGreaterThanOrEqual(0);
      expect(cartDisplacement).toBeLessThanOrEqual(NEWTON_SCENE.travel);
    }
  });

  it("leaves both masses in place when the model cannot overcome static friction", () => {
    const parameters = { cartMass: .5, hangingMass: .01, resistance: 2, travelDistance: .25 };
    const initial = newtonSceneGeometry(0, parameters.travelDistance);
    const state = calculateNewtonSecondLaw(parameters, 5);
    expect(state.acceleration).toBe(0);
    expect(newtonSceneGeometry(state.position, parameters.travelDistance)).toEqual(initial);
  });
});

describe("projectile apparatus geometry", () => {
  it.each([
    { initialSpeed: 8, angleDegrees: 0, initialHeight: 2 },
    { initialSpeed: 8, angleDegrees: 0, initialHeight: 0 },
    { initialSpeed: 0, angleDegrees: 0, initialHeight: 0 },
    { initialSpeed: 0, angleDegrees: 0, initialHeight: 10 },
    { initialSpeed: 25, angleDegrees: 90, initialHeight: 0 },
    { initialSpeed: 25, angleDegrees: 45, initialHeight: 10 },
  ])("keeps trajectory, ball and platform aligned for $initialSpeed m/s, $angleDegrees°, $initialHeight m", (parameters) => {
    const duration = calculateProjectileMotion(parameters, 0).flightTime;
    const trajectory = Array.from({ length: 65 }, (_, index) => calculateProjectileMotion(parameters, duration * index / 64));
    const finalState = calculateProjectileMotion(parameters, duration);
    const final = projectileSceneGeometry(trajectory, finalState, parameters.initialHeight);
    const platform = new BoxGeometry(...final.platformSize);
    platform.translate(...final.platformCenter);
    platform.computeBoundingBox();
    const ball = new SphereGeometry(PROJECTILE_SCENE.ballRadius, 24, 24);
    ball.translate(...final.ballCenter);
    ball.computeBoundingBox();
    expect(platform.boundingBox!.max.y).toBeCloseTo(PROJECTILE_SCENE.groundY, 6);
    expect(ball.boundingBox!.min.y).toBeCloseTo(platform.boundingBox!.max.y, 6);
    expect(final.trajectoryCenters.at(-1)).toEqual(final.ballCenter);
    for (const [index, state] of trajectory.entries()) {
      const scene = projectileSceneGeometry(trajectory, state, parameters.initialHeight);
      expect(scene.ballCenter).toEqual(final.trajectoryCenters[index]);
      expect(scene.ballCenter[1] - PROJECTILE_SCENE.ballRadius).toBeGreaterThanOrEqual(PROJECTILE_SCENE.groundY - 1e-12);
    }
    const launch = projectileSceneGeometry(trajectory, trajectory[0]!, parameters.initialHeight);
    expect(launch.heightPostStart[1]).toBe(PROJECTILE_SCENE.groundY);
    expect(launch.heightPostEnd[1]).toBeCloseTo(launch.ballCenter[1] - PROJECTILE_SCENE.ballRadius, 12);
    expect(final.ballCenter[0] + PROJECTILE_SCENE.ballRadius).toBeLessThan(platform.boundingBox!.max.x);
    expect(final.ballCenter[0] - PROJECTILE_SCENE.ballRadius).toBeGreaterThan(platform.boundingBox!.min.x);
    platform.dispose(); ball.dispose();
  });
});
