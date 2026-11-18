import { RefractionDiagram } from '../flagship/RefractionDiagram';
import { Action, Arrow, DiagramFrame, Readout } from './DiagramPrimitives';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { formatMeasurement } from '../../experiments/workbench';

export function OpticsThermalDiagram({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'refractive-index') return <RefractionDiagram experimentId={id} parameters={p} simulation={simulation} onChange={onChange} />;
  if (id === 'oil-film') {
    const radius = Math.sqrt(s.filmAreaCm2 / Math.PI) * 10;
    return <DiagramFrame title="网格水盘与油膜尺度估测" description="油膜画为圆形面积示意，面积来自输入；膜厚不能按图读取，不自动识别铺展">
      <circle cx="245" cy="185" r="137" fill="#e0eade" stroke="#789571" strokeWidth="5" />{Array.from({ length: 19 }, (_, i) => i - 9).map(i => <g key={i}><path d={`M${245 + i * 10} 90v190M150 ${185 + i * 10}h190`} stroke="#b5c4a9" strokeWidth=".6" /></g>)}
      <circle data-film-area={s.filmAreaCm2} cx="245" cy="185" r={radius} fill="#bd9764" fillOpacity=".45" stroke="#a87b46" strokeWidth="2" />
      <path d="M410 54l-38 60 13 9 40-58z" fill="#d9dfcd" stroke="#657d5c" /><path d="M376 133q-9 14 0 16q9-2 0-16" fill="#b87942" />
      <Readout x={462} y={89} label="膜面积" value={s.filmAreaCm2} unit="cm²" /><Readout x={462} y={161} label="估计膜厚" value={s.thicknessNm} unit="nm" /><Readout x={462} y={233} label="溶液平均滴体积" value={s.solutionDropVolumeMl} unit="mL" />
      <Action x={220} y={342} label="面积 −10 cm²" onClick={onChange && (() => onChange({ filmAreaCm2: Math.max(10, p.filmAreaCm2 - 10) }))} /><Action x={410} y={342} label="面积 +10 cm²" onClick={onChange && (() => onChange({ filmAreaCm2: Math.min(200, p.filmAreaCm2 + 10) }))} />
    </DiagramFrame>;
  }
  if (id === 'gas-pressure-volume') {
    const piston = 120 + p.volumeMl * 4;
    return <DiagramFrame title="密闭气体注射筒与绝压传感器" description="每个参数点是等温平衡态；密封气体量固定，表压与绝对压强分别显示">
      <rect x="120" y="150" width="400" height="95" rx="7" fill="#edf0e1" stroke="#6f8b65" strokeWidth="3" /><rect x="123" y="154" width={Math.max(0, piston - 123)} height="87" fill="#d6e5d3" />
      <path d={`M${piston} 148v99M${piston} 198H620m0-28v56`} stroke="#72836a" strokeWidth="10" />
      {Array.from({ length: 11 }, (_, i) => <g key={i}><path d={`M${120 + i * 40} 151v${i % 2 ? 10 : 17}`} stroke="#627e57" /><text x={120 + i * 40} y="138" textAnchor="middle">{i * 10}</text></g>)}<text x="548" y="139">mL</text>
      <path d="M120 198H77V80H177" stroke="#70896b" strokeWidth="4" fill="none" /><rect x="177" y="44" width="190" height="66" rx="7" fill="#e0e5cf" stroke="#728b64" /><text x="272" y="67" textAnchor="middle">绝对压强 / kPa</text><text x="272" y="94" textAnchor="middle" className="hs-expanded-number">{formatMeasurement(s.pressureKPa)}</text>
      <text x="420" y="67">温度 {formatMeasurement(s.temperatureKelvin)} K</text><text x="420" y="94">表压 {formatMeasurement(s.gaugePressureKPa)} kPa</text>
      <Action x={220} y={314} label="压入 5 mL" onClick={onChange && (() => onChange({ volumeMl: Math.max(10, p.volumeMl - 5) }))} /><Action x={440} y={314} label="拉出 5 mL" onClick={onChange && (() => onChange({ volumeMl: Math.min(100, p.volumeMl + 5) }))} />
    </DiagramFrame>;
  }
  return <DiagramFrame title="光电管与可调收集电压" description="电子点为发射/收集状态示意；遏止电压为理论值，电流曲线含额外分布假设">
    <rect x="205" y="91" width="315" height="167" rx="73" fill="#e2e9db" stroke="#789170" strokeWidth="2" /><path d="M260 126v96M462 136v76" stroke="#5d7957" strokeWidth="9" />
    <rect x="64" y="66" width="65" height="43" rx="7" fill="#4b6d4e" /><text x="97" y="133" textAnchor="middle">单色光源</text>
    {p.opticalPowerMilliwatts > 0 && <><Arrow from={{ x: 129, y: 81 }} to={{ x: 255, y: 145 }} label="光" /><Arrow from={{ x: 129, y: 99 }} to={{ x: 255, y: 177 }} /></>}
    {Boolean(s.emitting) && <g data-photoelectrons={s.current > 0 ? 'collected' : 'not-collected'}>{[0, 1, 2, 3].map(i => <circle key={i} cx={s.current > 0 ? 286 + i * 44 : 280 + i * 7} cy={163 + (i % 2) * 26} r="4" fill="#b96c3e" />)}</g>}
    <text x="259" y="242" textAnchor="middle">光阴极 K</text><text x="463" y="242" textAnchor="middle">收集极 A</text>
    <path d="M260 222v92h202V212" fill="none" stroke="#688260" strokeWidth="2" /><rect x="285" y="296" width="153" height="37" rx="5" fill="#eee7d4" stroke="#758b65" /><text x="362" y="321" textAnchor="middle">收集电压 {formatMeasurement(p.collectorVoltage)} V</text>
    <Readout x={548} y={110} label="收集电流" value={s.current * 1e6} unit="μA" />
    {s.emissionAllowed ? <Readout x={548} y={184} label="理论遏止电压" value={s.stoppingVoltage} unit="V" /> : <text x="535" y="212">未超过频率阈值</text>}
    <text x="350" y="355" textAnchor="middle">{formatMeasurement(p.frequencyTHz)} THz · {s.emitting ? s.current > 0 ? '有电子到达收集极' : '有发射，未被收集' : '当前无光电子发射'}</text>
  </DiagramFrame>;
}
