import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import type { HighSchoolSimulation } from "@physics-lab/physics/high-school";
import { Block, Label, Rod } from "./ScenePrimitives3D";
import { FORCE_BOARD_HALF_SIZE, forceBoardArrow, forceBoardPoint } from "./forceCompositionScene3D";
import { FORCE_HANDLES } from "./forceCompositionGeometry";
import { formatMeasurement } from "../experiments/workbench";

function VectorArrow({ x, y, elevation, color, dashed = false }: { x: number; y: number; elevation: number; color: string; dashed?: boolean }) {
  const arrow = forceBoardArrow(x, y, elevation);
  const rotation = useMemo(() => arrow ? new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...arrow.direction)) : undefined, [x, y]);
  if (!arrow) return null;
  return <group>{dashed ? <Line points={[arrow.start, arrow.shaftEnd]} color={color} lineWidth={3} dashed dashSize={.09} gapSize={.06} /> : <Rod start={arrow.start} end={arrow.shaftEnd} radius={Math.min(.025, arrow.headRadius * .4)} color={color} />}<mesh position={arrow.headCenter} quaternion={rotation}><coneGeometry args={[arrow.headRadius, arrow.headLength, 16]} /><meshStandardMaterial color={color} roughness={.6} /></mesh></group>;
}

/** A vector board, not a claimed spring-balance/rubber-band apparatus. */
export function ForceCompositionApparatus3D({ simulation }: { simulation: HighSchoolSimulation }) {
  const s = simulation.state;
  const tip1 = forceBoardPoint(s.force1X, s.force1Y);
  const tip2 = forceBoardPoint(s.force2X, s.force2Y);
  const result = forceBoardPoint(s.resultantX, s.resultantY);
  const trial = forceBoardPoint(s.trialX, s.trialY);
  const half = FORCE_BOARD_HALF_SIZE;
  return <group>
    <Block position={[0, -.15, 0]} size={[half * 2, .3, half * 2]} color="#e3e5d6" />
    {Array.from({ length: 21 }, (_, index) => index - 10).map((tick) => <group key={tick}><Line points={[forceBoardPoint(tick, -10, .012), forceBoardPoint(tick, 10, .012)]} color={tick === 0 ? "#7f917a" : "#c8cfbc"} lineWidth={tick === 0 ? 1.5 : .5} /><Line points={[forceBoardPoint(-10, tick, .014), forceBoardPoint(10, tick, .014)]} color={tick === 0 ? "#7f917a" : "#c8cfbc"} lineWidth={tick === 0 ? 1.5 : .5} /></group>)}
    {s.force1N > 0 && s.force2N > 0 && <><Line points={[tip1, result]} color="#ab7954" lineWidth={1.5} dashed dashSize={.06} gapSize={.05} /><Line points={[tip2, result]} color="#6e947c" lineWidth={1.5} dashed dashSize={.06} gapSize={.05} /></>}
    <VectorArrow x={s.force1X} y={s.force1Y} elevation={.08} color={FORCE_HANDLES.force1.color} />
    <VectorArrow x={s.force2X} y={s.force2Y} elevation={.1} color={FORCE_HANDLES.force2.color} />
    <VectorArrow x={s.resultantX} y={s.resultantY} elevation={.14} color="#263f32" dashed />
    <VectorArrow x={s.trialX} y={s.trialY} elevation={.18} color={FORCE_HANDLES.trial.color} />
    {s.residualMagnitude > 1e-8 && <Line points={[trial, result]} color="#986b88" lineWidth={1} dashed dashSize={.04} gapSize={.07} />}
    <mesh position={[0, .055, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.045, .065, 24]} /><meshStandardMaterial color="#293f37" /></mesh>
    <Label position={[3.5, .25, 0]}>+x / N</Label><Label position={[0, .25, -3.5]}>+y / N</Label>
    <Label position={[-2.5, .25, 3.5]}>深绿 F₁ · 橄榄绿 F₂</Label><Label position={[0, .25, 3.5]}>深虚线 F参考 · 铜橙 F试</Label><Label position={[2.7, .25, 3.5]}>每格 1 N</Label>
    <Label position={[0, 1.1, -3.5]}>矢量图示 · 不是实物测力计</Label>
    <Label position={[0, 1.8, 0]}>合力 {formatMeasurement(s.resultantMagnitude)} N{s.resultantDirectionDefined ? ` · ${formatMeasurement(s.resultantAngleDegrees, 1)}°` : " · 无方向"}</Label>
  </group>;
}
