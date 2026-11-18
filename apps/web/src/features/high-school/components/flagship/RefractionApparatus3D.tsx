import { Line } from '@react-three/drei';
import { Arrow3D, Bench, Label, Rod, SceneAction, TransparentBox, Wire } from '../expanded/ApparatusPrimitives3D';
import type { ExpandedSceneProps } from '../expanded/expandedSceneTypes';
import { formatRefractionAngle, refractionAnglePoint, refractionBoardPoint, refractionRays } from './RefractionGeometry';

export function RefractionApparatus3D({ parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state, rays = refractionRays(s), o = refractionBoardPoint(rays.origin);
  return <Bench><TransparentBox position={[0, -.78, 1.1]} size={[6, .5, 2.2]} /><Rod start={[-3, -.46, 0]} end={[3, -.46, 0]} radius={.018} /><Wire points={[[0, -.45, -2.5], [0, -.45, 2.5]]} color="#99aa88" />
    {(['incident', 'transmitted'] as const).map(side => <group key={side}>{[0, 30, 60, 90].map(angle => { const a = refractionBoardPoint(refractionAnglePoint(angle, 115, side)), b = refractionBoardPoint(refractionAnglePoint(angle, 129, side)); return <Rod key={angle} start={a} end={b} radius={.012} color="#8a9f7a" />; })}</group>)}
    <Arrow3D start={refractionBoardPoint(rays.incident)} end={o} />{p.incidentIndex !== p.transmittedIndex && <Arrow3D start={o} end={refractionBoardPoint(rays.reflected)} color="#849565" />}
    {Boolean(s.transmissionValid) && <Arrow3D start={o} end={refractionBoardPoint(rays.transmitted)} color="#3c8772" />}
    {s.incidentAngleDegrees > 0 && <Line points={Array.from({ length: 25 }, (_, i) => refractionBoardPoint(refractionAnglePoint(s.incidentAngleDegrees * i / 24, 49, 'incident')))} color="#b7683b" lineWidth={2} />}
    {Boolean(s.transmissionValid) && s.refractedAngleDegrees > 0 && <Line points={Array.from({ length: 25 }, (_, i) => refractionBoardPoint(refractionAnglePoint(s.refractedAngleDegrees * i / 24, 60, 'transmitted')))} color="#3c8772" lineWidth={2} />}
    <Label position={[-2.5, .2, -1.3]}>n₁ {p.incidentIndex}</Label><Label position={[-2.5, .2, 1.3]}>n₂ {p.transmittedIndex}</Label><Label position={[0, .15, -2.7]}>法线 · 0°</Label>
    <Label position={[0, 1.4, 0]}>i {formatRefractionAngle(s.incidentAngleDegrees)}　r {s.transmissionValid ? formatRefractionAngle(s.refractedAngleDegrees) : '无折射光'}</Label>
    <Label position={[0, 1.95, 0]}>{s.totalInternalReflection ? '超过临界 · 全反射' : Math.abs(s.refractedAngleDegrees - 90) < 1e-7 ? '临界掠射 · 沿界面' : '光路在台面展开 · 角度从法线量起'}</Label>
    <SceneAction position={[2.8, -.8, 1.8]} label="交换两侧介质" onClick={onChange && (() => onChange({ incidentIndex: p.transmittedIndex, transmittedIndex: p.incidentIndex }))} />
  </Bench>;
}
