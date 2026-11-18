import { Action, Arrow, DiagramFrame, Meter, Readout, Resistor } from './DiagramPrimitives';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { trajectoryGeometry } from './expandedGeometry';
import { formatMeasurement } from '../../experiments/workbench';

export function MagnetismDiagram({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'induced-current') {
    const width = Math.max(1, Math.abs(Math.cos(s.angleRadians)) * 75);
    return <DiagramFrame title="匀强磁场中的旋转线圈" description="磁场+z垂直纸面向外；电流正向按线圈+n右手定则，Φ为每匝磁通量">
      <rect x="73" y="64" width="310" height="225" rx="8" fill="#e4ebda" />{p.fieldAmplitude > 0 && [100, 160, 220, 280, 340].flatMap(x => [93, 153, 213, 273].map(y => <circle key={`${x}:${y}`} cx={x} cy={y} r="2.3" fill="#8c9e7c" />))}
      <path d="M225 60V286" stroke="#778d6c" strokeDasharray="5 4" /><ellipse data-coil-angle={s.angleRadians} cx="225" cy="175" rx={width} ry="82" fill="none" stroke="#af7146" strokeWidth="5" />
      <Arrow from={{ x: 225, y: 175 }} to={{ x: 225 + Math.sin(s.angleRadians) * 65, y: 175 }} color="#426c4d" label="n投影" />
      {Math.abs(Math.cos(s.angleRadians)) > 1e-8 && <text x="225" y="184" textAnchor="middle">{Math.cos(s.angleRadians) >= 0 ? '⊙' : '⊗'}</text>}<text x="100" y="45">{p.fieldAmplitude > 0 ? 'B 沿+z' : 'B = 0'}</text>
      <path d="M225 257V314H475V241" stroke="#64805a" fill="none" strokeWidth="2" /><path d="M225 93V49H475V139" stroke="#64805a" fill="none" strokeWidth="2" />
      <Meter x={475} y={175} label="指针仅示正负方向" value={s.current} unit="A" fraction={.5 + Math.tanh(s.current) * .45} />
      <Readout x={540} y={62} label="每匝磁通" value={s.flux} unit="Wb" digits={5} /><text x="300" y="344" textAnchor="middle">ε = {formatMeasurement(s.emf)} V · 线圈法向角 {formatMeasurement(s.angleRadians * 180 / Math.PI, 1)}°</text>
      <rect x="320" y="308" width="42" height="12" fill="#f7f5ea" /><path d={p.closed ? 'M320 314h42' : 'M320 314l35-20'} stroke="#b66d3e" strokeWidth="3" />
      <Action x={562} y={316} label={p.closed ? '断开线圈' : '闭合线圈'} onClick={onChange && (() => onChange({ closed: p.closed ? 0 : 1 }))} />
    </DiagramFrame>;
  }
  if (id === 'transformer-ratio') return <DiagramFrame title="闭合铁芯上的原副线圈" description="交流有效值与瞬时值分开；理想无损模型，直流挡不适用该变压关系">
    <path d="M240 78h200v207H240zM282 118h116v126H282z" fill="#b5c1a7" stroke="#708663" strokeWidth="3" fillRule="evenodd" />
    {[0, 1].map(side => <g key={side}>{Array.from({ length: side ? 12 : 8 }, (_, i) => <path key={i} d={`M${side ? 382 : 222} ${130 + i * (side ? 9 : 14)}q40-14 68 0`} fill="none" stroke={side ? '#b16d3b' : '#4e7954'} strokeWidth="5" />)}</g>)}
    <path d="M222 130H140v130h82M450 130h115v130H450" stroke="#758a66" fill="none" strokeWidth="2" /><circle cx="140" cy="196" r="26" fill="#f7f5ea" stroke="#58764f" strokeWidth="2" /><text x="140" y="204" textAnchor="middle" fontSize="25">{p.inputMode ? '⎓' : '∿'}</text>
    <g transform="rotate(90 565 196)"><Resistor x={565} y={196} label="" /></g><text x="610" y="207" textAnchor="middle">R</text><text x="268" y="60" textAnchor="middle">N₁ {p.primaryTurns}</text><text x="422" y="60" textAnchor="middle">N₂ {p.secondaryTurns}</text>
    <Readout x={54} y={299} label="原线圈有效值" value={s.primaryRmsVoltage} unit="V" />
    {s.readingValid ? <Readout x={455} y={299} label="副线圈有效值" value={s.secondaryRmsVoltage} unit="V" /> : <text x="440" y="325" fill="#b46538">直流不适用：无有效副边读数</text>}
    <text x="340" y="192" textAnchor="middle">闭合铁芯</text><text x="340" y="213" textAnchor="middle">匝数造型示意</text>
  </DiagramFrame>;
  const points = simulation.series.find(line => line.key === 'y' && line.xKey === 'x')?.points ?? [];
  const scene = trajectoryGeometry(points, s);
  return <DiagramFrame title="匀强磁场中的带电粒子轨迹" description="同一平面等比例；B正向出纸面，正电荷向右入射时向下偏；轨迹为模型">
    <rect x="78" y="42" width="342" height="284" rx="8" fill="#e4ead8" stroke="#91a080" />
    {p.magneticFieldMicrotesla !== 0 && [105, 165, 225, 285, 345, 405].flatMap(x => [70, 130, 190, 250, 310].map(y => p.magneticFieldMicrotesla > 0 ? <circle key={`${x}:${y}`} cx={x} cy={y} r="2" fill="#849777" /> : <path key={`${x}:${y}`} d={`M${x - 3} ${y - 3}l6 6m-6 0 6-6`} stroke="#849777" />))}
    <path d="M95 185H405M250 55V315" stroke="#a2af95" strokeWidth="1" />
    <polyline data-particle-trajectory="true" points={scene.path.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#b5794d" strokeWidth="1.7" strokeDasharray="4 3" />
    <circle data-particle-x={s.x} data-particle-y={s.y} cx={scene.point.x} cy={scene.point.y} r="7" fill="#ac5e32" />
    <Readout x={455} y={90} label="速率" value={s.speed} unit="m/s" />{s.radiusDefined ? <Readout x={455} y={157} label="轨迹半径" value={s.radius} unit="m" /> : <text x="455" y="175">直线或半径无定义</text>}
    <text x="455" y="240">刻度半幅 {formatMeasurement(scene.extent)} m</text>
    <Action x={215} y={344} label="反转电荷符号" onClick={onChange && (() => onChange({ chargeToMassMillions: p.chargeToMassMillions === 0 ? 1 : -p.chargeToMassMillions }))} />
    <Action x={450} y={344} label="反转磁场" onClick={onChange && (() => onChange({ magneticFieldMicrotesla: p.magneticFieldMicrotesla === 0 ? 10 : -p.magneticFieldMicrotesla }))} />
  </DiagramFrame>;
}
