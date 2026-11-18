import { Action, DiagramFrame, Readout, Resistor } from './DiagramPrimitives';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { formatMeasurement } from '../../experiments/workbench';
import { multimeterDialDirection, multimeterPresentation, multimeterWiring } from './multimeterGeometry';

function PrecisionScale({ parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state, caliper = p.instrument === 0, origin = 105, scale = caliper ? 7 : 12;
  const zero = origin + s.indicatedLengthMm * scale;
  return <DiagramFrame title={caliper ? '50分格游标卡尺' : '螺旋测微器主尺与微分筒'} description="刻线示意放大；未接触不产生有效读数，零点检查不等于测量物体">
    {caliper ? <g data-precision-instrument="caliper"><rect x="82" y="93" width="535" height="40" fill="#d5decb" stroke="#6c8265" />
      {Array.from({ length: 73 }, (_, i) => i - 2).map(mm => <g key={mm}><path d={`M${origin + mm * scale} 132v${mm % 5 ? -12 : -24}`} stroke="#516a4c" />{mm % 5 === 0 && <text x={origin + mm * scale} y="88" textAnchor="middle">{mm}</text>}</g>)}
      <path d={`M${origin} 133v108h20v-55M${origin + (p.contactMode === 1 ? 0 : p.objectLengthMm + (p.contactMode === 0 ? 3 : 0)) * scale} 133v108h-20v-55`} fill="none" stroke="#6e8467" strokeWidth="8" />
      {p.contactMode !== 1 && <rect x={origin + 2} y="204" width={Math.max(1, p.objectLengthMm * scale - 4)} height="30" fill="#bd8051" />}
      {s.readingValid ? <g data-scale-zero={zero}><rect x={zero - 5} y="136" width="353" height="50" rx="3" fill="#eee8d6" stroke="#76886b" />{Array.from({ length: 51 }, (_, i) => <g key={i}><path data-vernier-index={i} d={`M${zero + i * .98 * scale} 138v${i % 10 ? 15 : 25}`} stroke={i === s.vernierDivision ? '#b46538' : '#65765b'} strokeWidth={i === s.vernierDivision ? 2 : 1} />{i % 10 === 0 && <text x={zero + i * .98 * scale} y="181" textAnchor="middle">{i}</text>}</g>)}</g> : <text x="350" y="165" textAnchor="middle">尚未接触，先合拢查零或夹住物体</text>}
    </g> : <g data-precision-instrument="micrometer">
      <path d="M120 202q-50 88 22 90h100q36-3 35-45" fill="none" stroke="#456b4f" strokeWidth="17" /><path d="M120 198v50" stroke="#879880" strokeWidth="10" />
      <path data-micrometer-spindle="true" d={`M${120 + (p.contactMode === 1 ? 0 : p.objectLengthMm * 4 + (p.contactMode === 0 ? 12 : 0))} 223H320`} stroke="#879880" strokeWidth="10" />
      {p.contactMode !== 1 && <rect x="121" y="213" width={Math.max(1, p.objectLengthMm * 4 - 1)} height="20" fill="#bd8051" />}
      <rect x="228" y="211" width="105" height="26" rx="3" fill="#d2d9c4" /><rect x="314" y="201" width="106" height="47" rx="7" fill="#b67c4f" /><path d="M420 224h40" stroke="#546c4b" strokeWidth="9" />
      <rect x="80" y="80" width="540" height="74" rx="4" fill="#eee9d8" stroke="#778b69" />
      <path d="M90 115H610" stroke="#5b7352" />
      {Array.from({ length: 53 }, (_, i) => i / 2 - 1).filter(mm => !s.readingValid || mm <= s.mainScaleMm).map(mm => <g key={mm}><path d={`M${origin + mm * scale} 115v${Number.isInteger(mm) ? -18 : 15}`} stroke="#536e4d" />{Number.isInteger(mm) && mm % 5 === 0 && <text x={origin + mm * scale} y="91" textAnchor="middle">{mm}</text>}</g>)}
      {s.readingValid && <g transform={`translate(${zero} 0)`}><rect x="0" y="70" width="90" height="95" rx="4" fill="#d7b68b" stroke="#8a704e" />{Array.from({ length: 7 }, (_, i) => i - 3).map(offset => { const division = (s.thimbleDivision + offset + 50) % 50; return <g key={offset}><path data-thimble-index={division} d={`M0 ${115 - offset * 12}h${offset ? 18 : 27}`} stroke={offset ? '#715a3e' : '#b3592d'} strokeWidth={offset ? 1 : 2} /><text x="37" y={119 - offset * 12}>{division}</text></g>; })}</g>}
      <text x="475" y="231">独立放大刻度</text>
    </g>}
    <text x="452" y="210">{s.objectReadingValid ? '已夹住物体' : s.readingValid ? '合拢检查零点' : '未接触：不读数'}</text>
    {s.readingValid && <Readout x={450} y={235} label={p.zeroCorrection ? '扣除零点后的值' : '当前指示值'} value={p.zeroCorrection ? s.correctedLengthMm : s.indicatedLengthMm} unit="mm" digits={2} />}
    <Action x={145} y={339} label="合拢检查零点" selected={p.contactMode === 1} onClick={onChange && (() => onChange({ contactMode: 1 }))} />
    <Action x={350} y={339} label="夹住物体" selected={p.contactMode === 2} onClick={onChange && (() => onChange({ contactMode: 2 }))} />
    <Action x={555} y={339} label={caliper ? '改用测微器' : '改用游标尺'} onClick={onChange && (() => onChange({ instrument: caliper ? 1 : 0, contactMode: 0 }))} />
  </DiagramFrame>;
}

export function ElectricDiagram(props: ExpandedSceneProps) {
  const { experimentId: id, parameters: p, simulation, onChange } = props, s = simulation.state;
  if (id === 'precision-length') return <PrecisionScale {...props} />;
  if (id === 'resistivity') return <DiagramFrame title="均匀金属丝伏安测量" description="A串联、V并联跨接有效丝长；直径放大示意，模型保持材料温度不变">
    <path d="M145 230V90H445m14 0h96v140H500M220 230H145M220 230v70H500V230" fill="none" stroke="#5c7958" strokeWidth="2.5" />
    <path d="M445 68v44m14-34v24" stroke="#b76d3f" strokeWidth="4" /><circle cx="270" cy="90" r="23" fill="#f7f5ea" stroke="#627b59" strokeWidth="2" /><text x="270" y="97" textAnchor="middle">A</text>
    <rect data-wire-sample="true" x="220" y={230 - Math.max(3, p.diameterMm * 12) / 2} width="280" height={Math.max(3, p.diameterMm * 12)} fill="#b87748" /><path d="M220 200H500m-280-6v12m280-12v12" stroke="#7a8f6c" /><text x="360" y="188" textAnchor="middle">有效长度 {formatMeasurement(p.length)} m</text>
    <circle cx="360" cy="300" r="23" fill="#f7f5ea" stroke="#627b59" strokeWidth="2" /><text x="360" y="307" textAnchor="middle">V</text>
    <text x="270" y="139" textAnchor="middle">{formatMeasurement(s.current)} A</text><text x="360" y="344" textAnchor="middle">{formatMeasurement(s.voltage)} V</text>
    <circle cx="95" cy="155" r="24" fill="#cfa57a" stroke="#8f6643" /><path d="M71 155h48" stroke="#6c5e43" /><text x="95" y="198" textAnchor="middle">d {formatMeasurement(p.diameterMm)} mm</text>
    <text x="555" y="280" textAnchor="end">R = {formatMeasurement(s.resistance)} Ω</text>
  </DiagramFrame>;
  if (id === 'multimeter') {
    const wiring = multimeterWiring(p), view = multimeterPresentation(p, s), pointer = multimeterDialDirection(p.functionMode);
    const contact = (key: string, value: number, label: string) => ({ role: 'button' as const, tabIndex: onChange ? 0 : -1, 'aria-label': label, 'aria-disabled': !onChange || undefined, onClick: () => onChange?.({ [key]: value }), onKeyDown: (event: { key: string; preventDefault: () => void }) => { if (onChange && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onChange({ [key]: value }); } } });
    return <DiagramFrame title="多用电表功能、量程与接法" description="理想数字表；无效配置不显示占位0，测电阻必须断电并隔离元件">
      <rect x="60" y="55" width="205" height="251" rx="15" fill="#48674d" /><rect x="80" y="78" width="165" height="55" rx="4" fill="#e4e9d2" /><text data-multimeter-display="true" x="163" y="113" textAnchor="middle" className="hs-expanded-number">{view.display}</text>
      <circle cx="163" cy="202" r="43" fill="#d8d8bf" stroke="#253d2e" strokeWidth="3" /><path data-multimeter-pointer={p.functionMode} d={`M163 202L${163 + pointer.x * 35} ${202 + pointer.y * 35}`} stroke="#a66035" strokeWidth="7" /><text x="116" y="153">V</text><text x="158" y="146">A</text><text x="207" y="153">Ω</text>
      <g className="hs-expanded-action" {...contact('rangeIndex', (p.rangeIndex + 1) % 3, `切换下一量程，当前${view.rangeLabel}`)}><rect x="82" y="251" width="162" height="33" rx="5" fill="#38573d" stroke="#c2caaa" /><text x="163" y="273" fill="#f2efdb" textAnchor="middle">量程 {view.rangeLabel} ↻</text></g>
      <g data-meter-connection={p.connection}>
        {wiring.wires.map((points, index) => <polyline key={index} points={points.map(point => `${point.x},${point.y}`).join(' ')} stroke="#63805c" strokeWidth="2" fill="none" />)}
        <path d="M490 62v36m20-28v20" stroke="#ae7044" strokeWidth="3" />
        <g className="hs-expanded-action" {...contact('powerOn', p.powerOn ? 0 : 1, p.powerOn ? '断开外部电源' : '接通外部电源')}><rect x="543" y="47" width="44" height="52" fill="transparent" /><polyline data-meter-power-switch={p.powerOn} points={wiring.powerSwitch.map(point => `${point.x},${point.y}`).join(' ')} stroke="#ae7044" strokeWidth="3" fill="none" /></g>
        <g className="hs-expanded-action" {...contact('circuitClosed', p.circuitClosed ? 0 : 1, p.circuitClosed ? '断开总开关' : '闭合总开关')}><rect x="600" y="132" width="51" height="50" fill="transparent" /><polyline data-meter-circuit-switch={p.circuitClosed} points={wiring.circuitSwitch.map(point => `${point.x},${point.y}`).join(' ')} stroke="#ae7044" strokeWidth="3" fill="none" /></g>
        <Resistor x={wiring.resistor.x} y={wiring.resistor.y} label={wiring.isolated ? '已隔离元件' : `${formatMeasurement(p.resistanceOhms)} Ω`} />
        <polyline data-meter-red-probe="true" points={wiring.redProbe.map(point => `${point.x},${point.y}`).join(' ')} stroke="#bd7347" fill="none" strokeWidth="2" />
        <polyline data-meter-black-probe="true" points={wiring.blackProbe.map(point => `${point.x},${point.y}`).join(' ')} stroke="#415645" fill="none" strokeWidth="2" />
        {[wiring.leftTerminal, wiring.rightTerminal].map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill="#4c6b46" />)}
      </g>
      <text x="520" y="110" textAnchor="middle">{view.status}</text>
      <text x="520" y="145" textAnchor="middle">{p.powerOn ? '外部电源接通' : '外部电源断开'}</text><text x="520" y="173" textAnchor="middle">{p.circuitClosed ? '总开关闭合' : '总开关断开'}</text>
      <Action x={106} y={345} label="直流电压" selected={p.functionMode === 0} onClick={onChange && (() => onChange({ functionMode: 0 }))} /><Action x={245} y={345} label="直流电流" selected={p.functionMode === 1} onClick={onChange && (() => onChange({ functionMode: 1 }))} /><Action x={384} y={345} label="电阻挡" selected={p.functionMode === 2} onClick={onChange && (() => onChange({ functionMode: 2 }))} /><Action x={559} y={345} label={p.powerOn ? '断开外部电源' : '接通外部电源'} onClick={onChange && (() => onChange({ powerOn: p.powerOn ? 0 : 1 }))} />
    </DiagramFrame>;
  }
  return <DiagramFrame title="线性温度传感器与阈值控制" description="温度阶跃→传感器响应→上下阈值→执行器；不是特定NTC器件模型">
    <rect x="53" y="75" width="140" height="200" rx="12" fill="#e6dac4" stroke="#9c896b" /><path d="M123 108v102" stroke="#8c9c7b" strokeWidth="14" /><path d={`M123 210V${210 - s.sensorTemperature / 80 * 100}`} stroke="#bb7041" strokeWidth="8" /><circle cx="123" cy="220" r="15" fill="#bb7041" /><text x="123" y="296" textAnchor="middle">线性温度传感器</text>
    <path d="M193 170H257m143 0h80" stroke="#607c59" strokeWidth="3" /><path d="M258 110v120l141-60z" fill="#dde3cb" stroke="#5c7854" strokeWidth="2" /><text x="315" y="166" textAnchor="middle">阈值</text><text x="315" y="188" textAnchor="middle">比较</text>
    <circle cx="545" cy="170" r="63" fill={s.relayOn ? '#d5e3c6' : '#e9eadb'} stroke="#57754e" strokeWidth="3" /><g transform={`rotate(${s.relayOn ? s.time * 160 : 0} 545 170)`}>{[0, 120, 240].map(angle => <path key={angle} transform={`rotate(${angle} 545 170)`} d="M545 170q-10-58 23-44q35 13-23 44" fill="#719266" />)}</g><circle cx="545" cy="170" r="9" fill="#34583c" />
    <Readout x={450} y={270} label={s.relayOn ? '执行器：开启' : '执行器：关闭'} value={s.outputVoltage} unit="V输出" />
    <text x="65" y="51">环境 {formatMeasurement(s.environmentTemperature)} ℃</text><text x="249" y="72">上限 {formatMeasurement(s.upperThreshold)} ℃</text><text x="249" y="274">下限 {formatMeasurement(s.lowerThreshold)} ℃</text><text x="350" y="344" textAnchor="middle">传感器 {formatMeasurement(s.sensorTemperature)} ℃ · 滞回区间内保持状态</text>
  </DiagramFrame>;
}
