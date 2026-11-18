import { Bead, Bench, Block, Gauge3D, Label, Rod, SceneAction, Wire } from './ApparatusPrimitives3D';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { formatMeasurement } from '../../experiments/workbench';
import { multimeterDialDirection, multimeterPresentation, multimeterWiring } from './multimeterGeometry';
import { mapDiagramToBoard, safeSceneClick } from './expandedGeometry';

export function ElectricApparatus3D({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'precision-length') {
    const opening = p.contactMode === 1 ? 0 : p.objectLengthMm / 25 * 2.7 + (p.contactMode === 0 ? .4 : 0);
    return <Bench>{p.instrument === 0 ? <group>
      <Block position={[0, -.5, -.4]} size={[6.5, .18, .75]} color="#c6cebb" /><Block position={[-2.6, -.3, .45]} size={[.16, .65, 1.7]} color="#7f927b" /><Block position={[-2.6 + opening, -.3, .45]} size={[.16, .65, 1.7]} color="#8d9e82" />
      <Block position={[-1.9 + opening, -.3, -.4]} size={[1.5, .25, .9]} color="#d6d1b9" />{Array.from({ length: 51 }, (_, i) => <Rod key={i} start={[-3 + i * .12, -.39, -.55]} end={[-3 + i * .12, -.39, i % 5 ? -.4 : -.25]} radius={.009} color="#486241" />)}
      {p.contactMode !== 1 && <Block position={[-2.6 + p.objectLengthMm / 25 * 1.35, -.35, .7]} size={[Math.max(.04, p.objectLengthMm / 25 * 2.7), .3, .7]} color="#b98452" />}
      <Label position={[0, .8, 0]}>50分格游标尺 · 分度值0.02 mm</Label>
    </group> : <group>
      <mesh position={[-2.33, -.4, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, .18, 16, 48, Math.PI * 1.5]} /><meshStandardMaterial color="#486c50" /></mesh>
      <Rod start={[-2.9, -.4, -.3]} end={[-2.5, -.4, -.3]} radius={.1} color="#bfc8b4" /><Rod start={[-2.5 + opening * .55, -.4, -.3]} end={[2.8, -.4, -.3]} radius={.12} color="#cbd0bd" />
      {p.contactMode !== 1 && <Block position={[-2.5 + p.objectLengthMm / 25 * .7425, -.4, -.3]} size={[Math.max(.01, p.objectLengthMm / 25 * 1.485), .3, .3]} color="#b98452" />}
      <Block position={[.25, -.4, -.3]} size={[2, .48, .55]} color="#a6b79a" /><mesh position={[1.9, -.4, -.3]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.4, .4, 1.1, 40]} /><meshStandardMaterial color="#b87c49" /></mesh>
      {Array.from({ length: 16 }, (_, i) => <Rod key={i} start={[-.7 + i * .11, -.14, -.55]} end={[-.7 + i * .11, -.14, i % 2 ? -.45 : -.32]} radius={.009} color="#46603f" />)}
      <Label position={[0, .8, 0]}>螺旋测微器 · 0.5 mm主尺 / 50分格微分筒</Label>
    </group>}
      <Label position={[0, 1.4, 0]}>{s.readingValid ? `${p.contactMode === 1 ? '合拢零点' : '物体指示值'} ${formatMeasurement(s.indicatedLengthMm, 2)} mm` : '未接触，不产生有效读数'}</Label>
      <SceneAction position={[-1.5, -.9, 1.6]} label="合拢查零" onClick={onChange && (() => onChange({ contactMode: 1 }))} /><SceneAction position={[1.5, -.9, 1.6]} label="夹住物体" onClick={onChange && (() => onChange({ contactMode: 2 }))} />
    </Bench>;
  }
  if (id === 'resistivity') return <Bench>
    <Block position={[0, -.85, 0]} size={[5.2, .12, .55]} color="#d9ccb0" /><Rod start={[-2.3, -.68, 0]} end={[2.3, -.68, 0]} radius={.015 + p.diameterMm * .045} color="#b27448" />
    {[-2.3, 2.3].map(x => <Block key={x} position={[x, -.58, 0]} size={[.18, .35, .65]} color="#56734f" />)}
    <Wire points={[[-2.3, -.68, 0], [-3, -.7, 0], [-3, -.7, -1.5], [2.3, -.7, -1.5], [2.3, -.68, 0]]} />
    <Block position={[.8, -.4, -1.5]} size={[1.2, .65, .8]} color="#44684c" /><Gauge3D position={[-1.5, -.4, -1.5]} label="串联A" value={s.current} unit="A" />
    <Wire points={[[-2.3, -.68, 0], [-2.3, -.7, 1.3], [2.3, -.7, 1.3], [2.3, -.68, 0]]} color="#587b4d" /><Gauge3D position={[0, -.4, 1.3]} label="并联V" value={s.voltage} unit="V" />
    <Label position={[0, .65, 0]}>均匀金属丝 · L {formatMeasurement(p.length)} m · d {formatMeasurement(p.diameterMm)} mm</Label><Label position={[.8, .3, -1.5]}>可调直流源</Label>
  </Bench>;
  if (id === 'multimeter') {
    const wiring = multimeterWiring(p), view = multimeterPresentation(p, s), pointer = multimeterDialDirection(p.functionMode);
    return <Bench><Block position={[-2.33, -.55, 0]} size={[2.1, .7, 2.6]} color="#42684d" /><Block position={[-2.33, -.18, -.65]} size={[1.7, .05, .65]} color="#e0e7cb" />
      <mesh position={[-2.33, -.08, .35]} userData={{ multimeterDial: true }} onClick={event => { if (onChange && safeSceneClick(event)) { event.stopPropagation(); onChange({ functionMode: (p.functionMode + 1) % 3 }); } }}><cylinderGeometry args={[.43, .43, .18, 32]} /><meshStandardMaterial color="#d9c59e" /></mesh>
      <group userData={{ multimeterPointer: p.functionMode }}><Rod start={[-2.33, .025, .35]} end={[-2.33 + pointer.x * .34, .025, .35 + pointer.y * .34]} radius={.035} color="#a66035" /></group>
      {(['V', 'mA', 'Ω'] as const).map((label, index) => { const direction = multimeterDialDirection(index); return <Label key={label} position={[-2.33 + direction.x * .66, .04, .35 + direction.y * .66]}>{label}</Label>; })}
      <Label position={[-2.33, .4, -.65]}>{view.display}</Label>
      <Label position={[-2.33, .05, 1.04]}>量程 {view.rangeLabel}</Label>
      {wiring.wires.map((points, index) => <Wire key={index} points={points.map(point => mapDiagramToBoard(point, -.65))} />)}
      <Wire points={wiring.powerSwitch.map(point => mapDiagramToBoard(point, -.65))} color="#b67543" /><Wire points={wiring.circuitSwitch.map(point => mapDiagramToBoard(point, -.65))} color="#b67543" />
      <Block position={mapDiagramToBoard({ x: 500, y: 80 }, -.45)} size={[.26, .45, .7]} color="#4f7052" />
      <Block position={mapDiagramToBoard(wiring.resistor, -.61)} size={[.8, .2, .3]} color="#c4a474" />
      <Wire points={wiring.redProbe.map(point => mapDiagramToBoard(point, -.65))} color="#bd7347" /><Wire points={wiring.blackProbe.map(point => mapDiagramToBoard(point, -.65))} color="#415645" />
      <Label position={mapDiagramToBoard({ x: 520, y: 200 }, .1)}>{p.connection === 0 ? '表笔并联' : p.connection === 1 ? '表笔串联' : '元件已隔离'} · {formatMeasurement(p.resistanceOhms)} Ω</Label>
      <Label position={mapDiagramToBoard({ x: 520, y: 80 }, .4)}>{p.powerOn ? '电源接通' : '电源断开'} / {p.circuitClosed ? '总开关闭合' : '总开关断开'}</Label>
      <Label position={[1.65, .85, -.3]}>{view.status}</Label>
      <SceneAction position={[-2.8, -.85, 1.85]} label="旋钮换挡" onClick={onChange && (() => onChange({ functionMode: (p.functionMode + 1) % 3 }))} /><SceneAction position={[-1.15, -.85, 1.85]} label="下一量程" onClick={onChange && (() => onChange({ rangeIndex: (p.rangeIndex + 1) % 3 }))} />
      <SceneAction position={[1.35, -.85, 1.85]} label={p.powerOn ? '断开电源' : '接通电源'} onClick={onChange && (() => onChange({ powerOn: p.powerOn ? 0 : 1 }))} /><SceneAction position={[3, -.85, 1.85]} label={p.circuitClosed ? '断开开关' : '闭合开关'} onClick={onChange && (() => onChange({ circuitClosed: p.circuitClosed ? 0 : 1 }))} />
    </Bench>;
  }
  return <Bench><TransparentSensor temperature={s.sensorTemperature} /><Wire points={[[-2.3, -.6, 0], [-.7, -.6, 0]]} color="#57744f" />
    <Block position={[0, -.5, 0]} size={[1.5, .6, 1.5]} color="#6b835d" /><Label position={[0, .3, 0]}>阈值比较器 · {formatMeasurement(s.outputVoltage)} V</Label><Wire points={[[.75, -.6, 0], [2.1, -.6, 0]]} />
    <Block position={[2.4, -.65, 0]} size={[1.1, .25, 1.1]} color="#8c9b79" /><Rod start={[2.4, -.65, 0]} end={[2.4, .7, 0]} radius={.07} />
    <group position={[2.4, .85, 0]} rotation={[0, 0, s.relayOn ? s.time * 4 : 0]}>{[0, 2.0944, 4.1888].map(angle => <group key={angle} rotation={[0, 0, angle]}><Block position={[0, .4, 0]} size={[.22, .75, .08]} color={s.relayOn ? '#729467' : '#abb79b'} /></group>)}<Bead position={[0, 0, 0]} radius={.15} color="#385c43" /></group>
    <Label position={[2.4, 1.8, 0]}>执行器{s.relayOn ? '开启' : '关闭'}</Label><Label position={[0, 1.5, 0]}>理想线性温度传感器 · 阈值与滞回</Label>
  </Bench>;
}
function TransparentSensor({ temperature }: { temperature: number }) {
  return <group><Block position={[-2.5, -.35, 0]} size={[.8, 1.35, .8]} color="#c7ac80" /><Rod start={[-2.5, .3, 0]} end={[-2.5, .85, 0]} radius={.05} color="#9dab91" /><Label position={[-2.5, 1.4, 0]}>传感器 {formatMeasurement(temperature)} ℃</Label></group>;
}
