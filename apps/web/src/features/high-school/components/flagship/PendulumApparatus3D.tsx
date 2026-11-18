import { Html, Line } from '@react-three/drei';
import { Block, Label, Rod } from '../ScenePrimitives3D';
import { Arrow3D } from '../expanded/ApparatusPrimitives3D';
import { formatMeasurement } from '../../experiments/workbench';
import { PendulumControlBar, usePendulumControls, type PendulumInstrumentProps } from './PendulumControls';
import { PENDULUM_WORLD, pendulumGeometry, pendulumWorldPoint } from './PendulumGeometry';
import './PendulumInstrument.css';

export function PendulumApparatus3D(props: PendulumInstrumentProps & { compact?: boolean }) {
  const { parameters, simulation, onChange } = props;
  const geometry = pendulumGeometry(parameters, simulation.state), controls = usePendulumControls(props);
  const pivot = PENDULUM_WORLD.pivot, equilibrium = pendulumWorldPoint(0, -parameters.length);
  return <group>
    <Block position={[0, -1.25, 0]} size={[7.5, .2, 2.5]} color="#c0c8b2" />
    {[-3.4, 3.4].map(x => <group key={x}><Block position={[x, -1.08, -.45]} size={[.5, .18, 1.7]} color="#647e60" /><Rod start={[x, -1, -.45]} end={[x, 2.95, -.45]} radius={.07} color="#75886c" /></group>)}
    <Rod start={[-3.4, 2.95, -.45]} end={[3.4, 2.95, -.45]} radius={.07} color="#75886c" />
    <Block position={[0, 2.95, -.45]} size={[.4, .2, .3]} color="#385a42" /><Rod start={[0, 2.95, -.45]} end={pivot} radius={.04} color="#7f8e73" />
    <mesh position={pivot}><sphereGeometry args={[.055, 16, 12]} /><meshStandardMaterial color="#294833" metalness={.35} /></mesh>
    <Rod start={pivot} end={geometry.worldBob} radius={.012} color="#314b36" />
    <Line points={[pivot, equilibrium]} color="#a3b192" dashed dashSize={.065} gapSize={.06} lineWidth={1} />
    <Line points={geometry.arc.map(point => point.world)} color="#a3b192" dashed dashSize={.055} gapSize={.065} lineWidth={1} />
    <Line points={[pivot, geometry.release.world]} color="#b98d63" dashed dashSize={.055} gapSize={.065} lineWidth={1} />
    <mesh position={geometry.release.world}><torusGeometry args={[.23, .014, 8, 40]} /><meshStandardMaterial color="#bd8b5b" transparent opacity={.75} /></mesh>
    <mesh position={geometry.worldBob} castShadow userData={{ pendulumBob: true }}><sphereGeometry args={[PENDULUM_WORLD.bobRadius, 32, 24]} /><meshStandardMaterial color="#b67845" metalness={.62} roughness={.3} /></mesh>
    {geometry.worldArrow && <Arrow3D {...geometry.worldArrow} color="#4b7b52" />}
    <Rod start={[-2.9, pivot[1], -.4]} end={[-2.9, pendulumWorldPoint(0, -2)[1], -.4]} radius={.015} color="#8a9d7c" />
    {[0, .5, 1, 1.5, 2].map(length => { const y = pendulumWorldPoint(0, -length)[1]; return <group key={length}><Rod start={[-3, y, -.4]} end={[-2.8, y, -.4]} radius={.012} color="#6c825e" />{(!props.compact || Number.isInteger(length)) && <Label position={[-3.25, y, -.4]}>{length} m</Label>}</group>; })}
    <Label position={[0, 3.45, 0]}>摆长 {formatMeasurement(parameters.length, 2)} m · 悬点至球心</Label>
    <Label position={[2.5, 2.15, 0]}>{geometry.directionLabel}</Label>
    <Label position={[0, -1, .7]}>平衡线 · 计时起止须同向经过</Label>
    {!props.compact && <Html position={[0, -.96, 1.7]} center><div className="hs-pendulum-three-controls"><PendulumControlBar angle={parameters.amplitudeDegrees} setAngle={controls.setAngle} stepAngle={controls.stepAngle} disabled={!onChange} /><p>改角度回到释放点并暂停 · 周期数由你计数</p></div></Html>}
    <Label position={[0, -1.48, 1.5]}>固定米比例 · 球体与支架尺寸示意</Label>
  </group>;
}
