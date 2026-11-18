import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { DataTexture, DoubleSide, LinearFilter, RGBAFormat } from "three";
import { sceneCameraPosition, type SceneCameraView } from "./sceneCamera";
import type { ExperimentSceneProps } from "./ExperimentDiagram2D";
import { formatMeasurement, positionExtent } from "../experiments/workbench";
import { NEWTON_SCENE, newtonSceneGeometry, PROJECTILE_SCENE, projectileSceneGeometry, uniformDirectionArrowGeometry } from "./sceneGeometry";

import { SceneEnvironment3D } from "./SceneEnvironment3D";
import { Block, Rod, Label } from "./ScenePrimitives3D";
import { CapacitorApparatus3D } from "./CapacitorApparatus3D";
import { MechanicalEnergyApparatus3D } from "./MechanicalEnergyApparatus3D";
import { SpringApparatus3D } from "./SpringApparatus3D";
import { ForceCompositionApparatus3D } from "./ForceCompositionApparatus3D";
import { PendulumApparatus3D } from './flagship/PendulumApparatus3D';
import { ExpandedApparatus3D } from './expanded/ExpandedApparatus3D';
import { isExpandedExperiment } from './expanded/expandedGeometry';

function ContextLossListener({ onContextLost }: { onContextLost: () => void }) {
  const gl = useThree((state) => state.gl);
  const callback = useRef(onContextLost);
  callback.current = onContextLost;
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLoss = () => callback.current();
    canvas.addEventListener("webglcontextlost", handleLoss);
    // R3F deliberately loses the context after unmounting a canvas. Removing
    // this listener first keeps normal view changes from triggering a fallback.
    return () => canvas.removeEventListener("webglcontextlost", handleLoss);
  }, [gl]);
  return null;
}

function Cart({ x }: { x: number }) {
  return <group position={[x, .26, 0]}><Block position={[0, .17, 0]} size={[.8, .26, .52]} color="#42644b" /><Block position={[0, .36, 0]} size={[.42, .12, .4]} color="#9fba8e" />{[-.26, .26].flatMap((wheelX) => [-.29, .29].map((wheelZ) => <mesh key={`${wheelX}:${wheelZ}`} position={[wheelX, -.04, wheelZ]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.13, .13, .07, 20]} /><meshStandardMaterial color="#273d2d" metalness={.3} roughness={.5} /></mesh>))}</group>;
}

function Rail() {
  return <group><Block position={[0, 0, 0]} size={[8.2, .14, .75]} color="#b7bea9" /><Rod start={[-4, .1, -.2]} end={[4, .1, -.2]} radius={.025} /><Rod start={[-4, .1, .2]} end={[4, .1, .2]} radius={.025} /><Block position={[-2.9, -.6, 0]} size={[.13, 1.1, .6]} /><Block position={[2.9, -.6, 0]} size={[.13, 1.1, .6]} />{Array.from({ length: 21 }, (_, index) => <Line key={index} points={[[-4 + index * .4, .081, .24], [-4 + index * .4, .081, .36]]} color="#546c50" lineWidth={1} />)}</group>;
}

function InterferenceScreen({ points }: { points: Array<{ x: number; y: number }> }) {
  const texture = useMemo(() => {
    const data = new Uint8Array(points.length * 4);
    points.forEach((point, index) => { const light = Math.max(0, Math.min(1, point.y)); data[index * 4] = 12 + Math.round(light * 243); data[index * 4 + 1] = 15 + Math.round(light * 174); data[index * 4 + 2] = 10 + Math.round(light * 107); data[index * 4 + 3] = 255; });
    const result = new DataTexture(data, points.length, 1, RGBAFormat);
    result.minFilter = LinearFilter;
    result.magFilter = LinearFilter;
    result.needsUpdate = true;
    return result;
  }, [points]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[3, .35, 0]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[3.6, 2.7]} /><meshBasicMaterial map={texture} side={DoubleSide} /></mesh>;
}

function Apparatus({ experimentId: id, parameters: p, simulation, trajectory, capacitorMode, onCapacitorModeChange, capacitorSwitchDisabled, onParametersChange, mobileScene }: ExperimentSceneProps & { mobileScene?: boolean }) {
  const s = simulation.state;
  if (isExpandedExperiment(id)) return <ExpandedApparatus3D experimentId={id} parameters={p} simulation={simulation} onChange={onParametersChange} />;
  if (id === "capacitor-charge") return <CapacitorApparatus3D parameters={p} simulation={simulation} mode={capacitorMode ?? simulation.capacitor?.mode ?? "open"} onModeChange={onCapacitorModeChange} switchDisabled={capacitorSwitchDisabled} />;
  if (id === "mechanical-energy") return <MechanicalEnergyApparatus3D parameters={p} simulation={simulation} />;
  if (id === "force-composition") return <ForceCompositionApparatus3D simulation={simulation} />;
  if (id === "spring-force") return <SpringApparatus3D naturalLength={s.naturalLength} length={s.length} loadMassGrams={p.loadMassGrams} />;
  if (id === "uniform-acceleration") {
    const extent = positionExtent(simulation);
    const x = -3.5 + (s.position - extent.low) / (extent.high - extent.low) * 7;
    const arrow = uniformDirectionArrowGeometry();
    return <group><Rail /><Cart x={x} /><Label position={[0, 1.6, 0]}>x = {formatMeasurement(s.position)} m · v = {formatMeasurement(s.velocity)} m/s</Label><Rod start={arrow.start} end={arrow.shaftEnd} radius={.028} color="#bb6236" /><mesh position={arrow.headCenter} rotation={arrow.headRotation}><coneGeometry args={[arrow.headRadius, arrow.headLength, 16]} /><meshStandardMaterial color="#bb6236" roughness={.5} /></mesh><Label position={arrow.labelPosition}>+x 正方向</Label></group>;
  }
  if (id === "newton-second-law") {
    const scene = newtonSceneGeometry(s.position, p.travelDistance);
    return <group><group scale={[.65, 1, 1]}><Rail /></group><Cart x={scene.cartX} /><mesh position={NEWTON_SCENE.pulleyCenter} rotation={NEWTON_SCENE.pulleyRotation}><torusGeometry args={[NEWTON_SCENE.pulleyRadius, NEWTON_SCENE.pulleyTubeRadius, 10, 24]} /><meshStandardMaterial color="#98744d" metalness={.5} /></mesh><Line points={scene.ropePoints} color="#aa673c" lineWidth={2} /><Block position={scene.weightCenter} size={[NEWTON_SCENE.weightSize, NEWTON_SCENE.weightSize, NEWTON_SCENE.weightSize]} color="#b67042" /><Label position={[0, 1.5, 0]}>a = {formatMeasurement(s.acceleration)} m/s²</Label><Label position={scene.weightLabel}>挂码 {formatMeasurement(p.hangingMass)} kg</Label></group>;
  }
  if (id === "projectile-motion") {
    const scene = projectileSceneGeometry(trajectory, { x: s.x, y: s.y }, p.initialHeight);
    return <group><Block position={scene.platformCenter} size={scene.platformSize} color="#c7cbb6" /><Line points={scene.trajectoryCenters} color="#9aaa85" lineWidth={1.5} dashed dashSize={.08} gapSize={.08} />{p.initialHeight > 0 && <Rod start={scene.heightPostStart} end={scene.heightPostEnd} radius={.05} color="#6c7c5a" />}<mesh position={scene.ballCenter} castShadow><sphereGeometry args={[PROJECTILE_SCENE.ballRadius, 24, 24]} /><meshStandardMaterial color="#bd6738" metalness={.4} roughness={.3} /></mesh><Label position={[0, 3.1, 0]}>x = {formatMeasurement(s.x)} m · y = {formatMeasurement(s.y)} m</Label></group>;
  }
  if (id === "pendulum") return <PendulumApparatus3D parameters={p} simulation={simulation} onChange={onParametersChange} compact={mobileScene} />;
  if (id === "emf-internal-resistance") return <group><Block position={[0, -.7, 0]} size={[7.5, .2, 4.8]} color="#b8c1a6" /><Line points={[[-2.5, -.54, -1.4], [2.5, -.54, -1.4], [2.5, -.54, 1.4], [-2.5, -.54, 1.4], [-2.5, -.54, -1.4]]} color="#ad683d" lineWidth={4} /><Block position={[-1.5, -.15, -1.4]} size={[1.35, .75, .8]} color="#355c43" /><Block position={[1, -.32, -1.4]} size={[.8, .43, .48]} color="#c79866" /><Block position={[.3, -.24, 1.4]} size={[1.7, .6, .8]} color="#556d4d" /><Rod start={[-.3, .2, 1.4]} end={[.9, .2, 1.4]} radius={.04} color="#bd7948" /><Block position={[.35, .3, 1.4]} size={[.16, .18, .4]} color="#d6b383" /><Block position={[-2.5, -.08, 0]} size={[.7, .9, 1]} color="#dddcc9" /><Block position={[0, -.08, 0]} size={[.7, .9, .65]} color="#dddcc9" /><Line points={[[-2.5, -.53, -1.4], [-2.5, -.53, -.6], [-.35, -.53, -.6], [-.35, -.53, 0]]} color="#6b8b53" lineWidth={3} /><Line points={[[2.5, -.53, -1.4], [2.5, -.53, -.6], [.35, -.53, -.6], [.35, -.53, 0]]} color="#6b8b53" lineWidth={3} /><Label position={[-1.5, .65, -1.4]}>电源 E = {formatMeasurement(s.emf)} V</Label><Label position={[1, .3, -1.4]}>内阻 r</Label><Label position={[-2.5, .65, 0]}>I {formatMeasurement(s.current)} A</Label><Label position={[0, .65, 0]}>并联电压表 · {formatMeasurement(s.terminalVoltage)} V</Label><Label position={[.3, .8, 1.4]}>外电阻 {formatMeasurement(p.loadResistance)} Ω</Label></group>;
  const points = simulation.series.find((series) => series.key === "intensity")?.points ?? [];
  const screenZ = p.screenPositionMm / 20 * 1.8;
  return <group><Block position={[0, -1.2, 0]} size={[8, .15, 4.2]} color="#c0c7ae" /><Block position={[-3.3, -.05, 0]} size={[1, .55, .5]} color="#3b5d42" /><Block position={[0, .35, -.95]} size={[.12, 2.65, 1.55]} color="#859475" /><Block position={[0, .35, .95]} size={[.12, 2.65, 1.55]} color="#859475" /><Block position={[0, .35, 0]} size={[.12, 2.65, .24]} color="#859475" /><Line points={[[-2.8, .2, 0], [0, .2, -.16], [3, .2, screenZ]]} color="#c08842" lineWidth={1.5} /><Line points={[[-2.8, .2, 0], [0, .2, .16], [3, .2, screenZ]]} color="#c08842" lineWidth={1.5} /><Block position={[3.05, .35, 0]} size={[.08, 2.8, 3.75]} color="#1d2e20" /><InterferenceScreen points={points} /><Line points={[[2.98, -1, screenZ], [2.98, 1.7, screenZ]]} color="#dde6bf" lineWidth={1} /><Label position={[-3.3, .8, 0]}>相干光源</Label><Label position={[0, 2, 0]}>双缝 · 示意放大</Label><Label position={[3.1, 2.1, 0]}>屏上条纹 · ±20 mm</Label></group>;
}

export default function ExperimentScene3D(props: ExperimentSceneProps & { onContextLost: () => void; cameraView?: SceneCameraView; cameraInteractive?: boolean; mobileScene?: boolean }) {
  const cameraPosition = sceneCameraPosition(props.experimentId, props.cameraView ?? "perspective");
  return <Canvas className="hs-three-canvas" shadows={!props.mobileScene} frameloop="demand" dpr={props.mobileScene ? [1, 1.25] : [1, 1.5]} camera={{ position: cameraPosition, fov: 42, near: .1, far: 80 }} gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}><ContextLossListener onContextLost={props.onContextLost} /><SceneEnvironment3D /><Apparatus {...props} /><OrbitControls makeDefault enabled={props.cameraInteractive ?? true} target={[0, .4, 0]} enableDamping minDistance={5} maxDistance={22} maxPolarAngle={Math.PI / 2} /></Canvas>;
}
