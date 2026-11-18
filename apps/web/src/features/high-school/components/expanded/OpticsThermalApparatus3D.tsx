import { RefractionApparatus3D } from '../flagship/RefractionApparatus3D';
import { Arrow3D, Bead, Bench, Block, Disc, Gauge3D, Label, Rod, SceneAction, TransparentBox, Wire } from './ApparatusPrimitives3D';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { formatMeasurement } from '../../experiments/workbench';

export function OpticsThermalApparatus3D({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'refractive-index') return <RefractionApparatus3D experimentId={id} parameters={p} simulation={simulation} onChange={onChange} />;
  if (id === 'oil-film') return <Bench>
    <Disc position={[-.8, -.85, 0]} radius={2.15} color="#789773" thickness={.3} /><Disc position={[-.8, -.68, 0]} radius={2.03} color="#cedfcb" thickness={.03} />
    {Array.from({ length: 13 }, (_, i) => i - 6).map(i => <group key={i}><Rod start={[-.8 + i * .22, -.65, -1.5]} end={[-.8 + i * .22, -.65, 1.5]} radius={.006} color="#9fb491" /><Rod start={[-2.3, -.65, i * .22]} end={[.7, -.65, i * .22]} radius={.006} color="#9fb491" /></group>)}
    <Disc position={[-.8, -.625, 0]} radius={Math.sqrt(s.filmAreaCm2 / Math.PI) * .18} color="#c4a16d" thickness={.015} />
    <Rod start={[1.5, 2.2, -.5]} end={[.5, .8, -.1]} radius={.09} color="#8ba18d" /><Bead position={[.45, .5, -.08]} radius={.08} color="#bf8a4d" />
    <Label position={[-.8, .3, 0]}>膜面积 {formatMeasurement(s.filmAreaCm2)} cm²</Label><Label position={[1.5, 2.5, -.5]}>稀释溶液滴管</Label><Gauge3D position={[2.5, -.6, 1.2]} label="估计膜厚" value={s.thicknessNm} unit="nm" /><Label position={[0, 1.4, 1.4]}>圆膜造型示意 · 图示厚度非纳米比例</Label>
  </Bench>;
  if (id === 'gas-pressure-volume') {
    const piston = -2.2 + p.volumeMl / 100 * 4.4;
    return <Bench><mesh position={[0, -.45, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.5, .5, 4.4, 48]} /><meshStandardMaterial color="#bbd4ba" transparent opacity={.22} depthWrite={false} /></mesh><mesh position={[-2.24, -.45, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.51, .51, .12, 40]} /><meshStandardMaterial color="#768b6a" /></mesh>
      <mesh position={[piston, -.45, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.49, .49, .13, 40]} /><meshStandardMaterial color="#94a880" /></mesh><Rod start={[piston, -.45, 0]} end={[3.7, -.45, 0]} radius={.06} /><Block position={[3.7, -.45, 0]} size={[.13, 1.1, .75]} color="#839a76" />
      {Array.from({ length: 11 }, (_, i) => <Rod key={i} start={[-2.2 + i * .44, .075, -.45]} end={[-2.2 + i * .44, .075, i % 2 ? -.3 : -.2]} radius={.012} color="#496a43" />)}
      <Wire points={[[-2.3, -.45, 0], [-3, -.45, 0], [-3, -.45, 1.5]]} color="#6a8864" /><Gauge3D position={[-2.6, -.45, 1.5]} label="绝对压强" value={s.pressureKPa} unit="kPa" /><Label position={[0, 1, 0]}>密封气体 · {p.volumeMl} mL · {formatMeasurement(s.temperatureKelvin)} K</Label>
      <SceneAction position={[2, -.8, 1.65]} label="压入5 mL" onClick={onChange && (() => onChange({ volumeMl: Math.max(10, p.volumeMl - 5) }))} />
    </Bench>;
  }
  return <Bench><mesh position={[.2, .25, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.85, .85, 3.8, 48]} /><meshStandardMaterial color="#d1e1cc" transparent opacity={.16} depthWrite={false} /></mesh>
    <Block position={[-1.1, .25, 0]} size={[.08, 1.1, 1.1]} color="#657d5e" /><Block position={[1.55, .25, 0]} size={[.08, .8, .8]} color="#af9566" /><Block position={[-3, .4, -1.3]} size={[.8, .6, .65]} color="#456e4d" />
    {p.opticalPowerMilliwatts > 0 && <Arrow3D start={[-2.7, .4, -1.2]} end={[-1.15, .25, 0]} color="#c6954b" />}
    {Boolean(s.emitting) && [0, 1, 2, 3].map(i => <Bead key={i} position={[s.current > 0 ? -.85 + i * .65 : -.85 + i * .12, .25, (i % 2) * .18 - .09]} radius={.045} />)}
    <Wire points={[[-1.1, -.3, 0], [-1.1, -.8, 1.5], [1.55, -.8, 1.5], [1.55, -.15, 0]]} /><Gauge3D position={[.2, -.45, 1.5]} label="收集电流" value={s.current * 1e6} unit="μA" /><Label position={[-1.1, 1.1, 0]}>光阴极</Label><Label position={[1.55, 1.1, 0]}>收集极</Label>
    <Label position={[.2, 1.8, 0]}>{s.emitting ? '电子点仅示发射与收集状态' : '当前无电子发射'} · 收集电压 {formatMeasurement(p.collectorVoltage)} V</Label>
  </Bench>;
}
