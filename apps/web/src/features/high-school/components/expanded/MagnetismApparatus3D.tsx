import { Line } from '@react-three/drei';
import { Arrow3D, Bead, Bench, Block, Gauge3D, Label, Rod, SceneAction, TransparentBox, Wire } from './ApparatusPrimitives3D';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { trajectoryGeometry } from './expandedGeometry';
import { formatMeasurement } from '../../experiments/workbench';

export function MagnetismApparatus3D({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'induced-current') return <Bench>
    <TransparentBox position={[0, .4, -1.8]} size={[4.2, 2.4, .2]} color="#587854" /><TransparentBox position={[0, .4, 1.8]} size={[4.2, 2.4, .2]} color="#69825e" />
    <Rod start={[0, -1.06, 0]} end={[0, 2, 0]} radius={.035} color="#7b8e6d" /><group position={[0, .5, 0]} rotation={[0, s.angleRadians, 0]}>
      <mesh><torusGeometry args={[.95, .065, 12, 64]} /><meshStandardMaterial color="#b77d4a" /></mesh><Arrow3D start={[0, 0, 0]} end={[0, 0, 1.1]} color="#4f7853" /><Label position={[0, 1.25, 0]}>旋转线圈 · +n</Label>
    </group>
    {p.fieldAmplitude > 0 && [-1.5, 1.5].map(x => <Arrow3D key={x} start={[x, .5, -1.7]} end={[x, .5, 1.3]} color="#6c9568" />)}
    <Label position={[2.6, 2, 0]}>{p.fieldAmplitude > 0 ? 'B沿+z' : 'B=0'}</Label>
    <Wire points={[[0, 1.45, 0], [3.4, 1.45, 0], [3.4, -.8, 1.4], [2.9, -.8, 1.4]]} />
    <Wire points={[[0, -.45, 0], [0, -.8, 1.4], [.9, -.8, 1.4]]} />
    <Wire points={[[1.4, -.8, 1.4], [1.9, -.8, 1.4]]} />
    <Rod start={[.9, -.8, 1.4]} end={p.closed ? [1.4, -.8, 1.4] : [1.3, -.4, 1.4]} color="#b67543" radius={.035} />
    <Gauge3D position={[2.4, -.45, 1.4]} label="I" value={s.current} unit="A" />
    <SceneAction position={[-2, -.8, 1.7]} label={p.closed ? '断开回路' : '闭合回路'} onClick={onChange && (() => onChange({ closed: p.closed ? 0 : 1 }))} /><Label position={[0, 2.6, 0]}>正电流：从+n端看逆时针 · ε {formatMeasurement(s.emf)} V</Label>
  </Bench>;
  if (id === 'transformer-ratio') return <Bench>
    <Block position={[-1.3, .3, 0]} size={[.55, 2.5, .65]} color="#8b9a7d" /><Block position={[1.3, .3, 0]} size={[.55, 2.5, .65]} color="#8b9a7d" /><Block position={[0, 1.55, 0]} size={[3.15, .5, .65]} color="#8b9a7d" /><Block position={[0, -.95, 0]} size={[3.15, .2, .65]} color="#8b9a7d" />
    {[-1.3, 1.3].map((x, side) => <group key={x}>{Array.from({ length: side ? 12 : 8 }, (_, i) => <mesh key={i} position={[x, -.6 + i * (side ? .13 : .2), 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.48, .045, 10, 32]} /><meshStandardMaterial color={side ? '#b87c43' : '#517552'} /></mesh>)}<Label position={[x, 2.05, 0]}>N{side ? '₂' : '₁'} {side ? p.secondaryTurns : p.primaryTurns}</Label></group>)}
    <Gauge3D position={[-2.5, -.6, 1.55]} label="原边有效值" value={s.primaryRmsVoltage} unit="V" />
    {s.readingValid ? <Gauge3D position={[2.5, -.6, 1.55]} label="副边有效值" value={s.secondaryRmsVoltage} unit="V" /> : <Label position={[2.5, .3, 1.55]}>直流不适用</Label>}
    <Wire points={[[-1.3, .9, .5], [-3.1, .9, .5], [-3.1, -.7, .5], [-1.3, -.7, .5], [-1.3, -.6, .5]]} />
    <Block position={[-3.1, .1, .5]} size={[.55, .65, .55]} color="#466c4c" /><Label position={[-3.1, .8, .5]}>{p.inputMode ? '直流源' : '交流源'}</Label>
    <Wire points={[[1.3, .9, .5], [3.1, .9, .5], [3.1, -.7, .5], [1.3, -.7, .5], [1.3, -.6, .5]]} />
    <Block position={[3.1, .1, .5]} size={[.35, .65, .35]} color="#c2a06d" /><Label position={[3.1, .8, .5]}>R {formatMeasurement(p.loadResistance)} Ω</Label><Label position={[0, 2.65, 0]}>闭合铁芯 · 线圈匝数造型示意</Label>
  </Bench>;
  const points = simulation.series.find(line => line.key === 'y' && line.xKey === 'x')?.points ?? [];
  const scene = trajectoryGeometry(points, s);
  const fieldSign = Math.sign(p.magneticFieldMicrotesla);
  return <Bench>
    {[-.8, .8].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[3.1, .07, 12, 80]} /><meshStandardMaterial color="#748e65" transparent opacity={.55} /></mesh>)}
    {scene.worldPath.length > 1 && <Line points={scene.worldPath} color="#a66b3f" lineWidth={1.7} dashed dashSize={.07} gapSize={.05} />}
    <Bead position={scene.worldPoint} radius={.1} /><Arrow3D start={scene.worldPoint} end={[scene.worldPoint[0] + s.vx / s.speed * .6, -.5, scene.worldPoint[2] - s.vy / s.speed * .6]} />
    {fieldSign !== 0 && <Arrow3D start={[2.8, -.6, 2.2]} end={[2.8, -.6 + fieldSign * 1.2, 2.2]} color="#4e784e" />}
    <Label position={[0, 1.8, 0]}>平面轨迹 · B{fieldSign > 0 ? '正向' : fieldSign < 0 ? '反向' : '=0'}</Label><Label position={[0, 2.3, 0]}>速度 {formatMeasurement(s.speed)} m/s · 半幅 {formatMeasurement(scene.extent)} m</Label>
    <SceneAction position={[-2.5, -.8, 2.4]} label="反转电荷" onClick={onChange && (() => onChange({ chargeToMassMillions: p.chargeToMassMillions === 0 ? 1 : -p.chargeToMassMillions }))} />
  </Bench>;
}
