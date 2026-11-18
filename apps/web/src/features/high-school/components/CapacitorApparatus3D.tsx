import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { Block, Label, Rod } from './ScenePrimitives3D';
import { formatMeasurement } from '../experiments/workbench';
import { signedCapacitorReading, useCapacitorModeRequest, type CapacitorSceneProps } from './CapacitorSwitchControl';
import { CAPACITOR_BOARD as B, CAPACITOR_MODES, CAPACITOR_WIRES, capacitorCurrentArrow, capacitorPlateSigns, capacitorSwitchEnd, capacitorWorldPoint, isCapacitorSwitchClick, type CapacitorPoint3 } from './capacitorGeometry';

function DirectionArrow({ start, end, direction, color }: { start: CapacitorPoint3; end: CapacitorPoint3; direction: number; color: string }) {
  return <group><Rod start={start} end={end} radius={.018} color={color} /><mesh position={end} rotation={[0, 0, direction > 0 ? -Math.PI / 2 : Math.PI / 2]}><coneGeometry args={[.065, .18, 16]} /><meshStandardMaterial color={color} /></mesh></group>;
}
function PlateCharge({ z, sign }: { z: number; sign: '+' | '−' | null }) {
  if (!sign) return null;
  return <group userData={{ capacitorChargeSign: sign }}>{[2.33, 2.625, 2.92].map((x) => <group key={x}><Rod start={[x - .07, -.15, z]} end={[x + .07, -.15, z]} radius={.012} color="#fff7e1" />{sign === '+' && <Rod start={[x, -.22, z]} end={[x, -.08, z]} radius={.012} color="#fff7e1" />}</group>)}</group>;
}
export function CapacitorApparatus3D(props: CapacitorSceneProps) {
  const requestMode = useCapacitorModeRequest(props);
  const s = props.simulation.state, arrow = capacitorCurrentArrow(s.current), signs = capacitorPlateSigns(s.charge);
  const disabled = props.switchDisabled || !props.onModeChange;
  return <group>
    <Block position={[0, -.74, 0]} size={[8.4, .26, 4.2]} color="#c5cbb7" />
    {CAPACITOR_WIRES.map((wire) => <Line key={wire.id} userData={{ capacitorWire: wire.id }} points={wire.points.map((point) => capacitorWorldPoint(point))} color={wire.branch === 'voltmeter' ? '#879a70' : '#566f50'} lineWidth={wire.branch === 'voltmeter' ? 2 : 3} />)}
    <Block position={[-3.25, -.2, .025]} size={[.8, .7, .3]} color="#3c624b" />
    <Label position={[-3.25, .52, .025]}>电源 {formatMeasurement(props.parameters.emf)} V</Label>
    <Label position={[-3.75, -.1, -.18]}>＋</Label><Label position={[-3.75, -.1, .25]}>−</Label>
    <Block position={[0, -.36, -.6875]} size={[.625, .38, .42]} color="#ba966b" />
    <Label position={[0, .22, -.6875]}>R {formatMeasurement(props.parameters.resistanceKOhm)} kΩ</Label>
    <Block position={[1.125, -.3, -.6875]} size={[.625, .5, .58]} color="#e2dfcb" />
    <Label position={[1.125, .35, -.6875]}>A · {signedCapacitorReading(s.current, 1000)} mA</Label>
    <Block position={[3.75, -.3, .2125]} size={[.6, .5, .5]} color="#e2dfcb" />
    <Label position={[3.75, .4, .2125]}>V · {signedCapacitorReading(s.voltage)} V</Label>
    <group userData={{ capacitorPlate: 'P' }}><Block position={[2.625, -.225, 0]} size={[.9, .65, .045]} color="#b77548" /></group>
    <group userData={{ capacitorPlate: 'N' }}><Block position={[2.625, -.225, .4375]} size={[.9, .65, .045]} color="#557d62" /></group>
    <PlateCharge z={-.026} sign={signs.p} /><PlateCharge z={.026} sign={signs.p} />
    <PlateCharge z={.4115} sign={signs.n} /><PlateCharge z={.4635} sign={signs.n} />
    <Label position={[2.04, .35, -.05]}>P · Q</Label><Label position={[2.04, .35, .49]}>N · −Q</Label>
    <Label position={[2.625, -.1, 1.05]}>C {formatMeasurement(props.parameters.capacitanceMicrofarads)} μF</Label>
    <Label position={[2.625, -.1, 1.55]}>极板间绝缘，无导线跨接</Label>
    <Rod start={capacitorWorldPoint(B.common, -.43)} end={capacitorWorldPoint(capacitorSwitchEnd(props.mode), -.43)} radius={.045} color="#b46a3e" />
    <mesh position={capacitorWorldPoint(B.common, -.44)}><cylinderGeometry args={[.09, .09, .18, 20]} /><meshStandardMaterial color="#b46a3e" /></mesh>
    {CAPACITOR_MODES.map(({ mode, label }) => { const point = B.contacts[mode]; return <group key={mode}>
      <mesh position={capacitorWorldPoint(point, -.48)} userData={{ capacitorSwitch: mode }} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (!disabled && isCapacitorSwitchClick(event)) requestMode(mode); }}>
        <cylinderGeometry args={[.2, .2, .16, 24]} /><meshStandardMaterial color={props.mode === mode ? '#b46a3e' : mode === 'open' ? '#b8c3ad' : '#55785a'} roughness={.5} />
      </mesh>
      <Label position={capacitorWorldPoint({ x: point.x - 8, y: point.y + (mode === 'charge' ? -28 : 29) }, -.05)}>{label}</Label>
    </group>; })}
    <DirectionArrow start={[-.5, -.45, -1.7]} end={[.5, -.45, -1.7]} direction={1} color="#667f58" />
    <Label position={[0, -.05, -1.9]}>I 正方向 · 流入 P</Label>
    {arrow && <group userData={{ capacitorCurrentDirection: arrow.direction }}><DirectionArrow start={capacitorWorldPoint(arrow.start, -.43)} end={capacitorWorldPoint(arrow.end, -.43)} direction={arrow.direction} color="#b46a3e" /></group>}
    <Label position={[-.45, -.1, 1.9]}>点击触点切换 · 极板电荷符号仅作示意</Label>
  </group>;
}
