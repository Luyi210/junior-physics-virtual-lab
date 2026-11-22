import { CollisionDiagram } from '../flagship/CollisionDiagram';
import { Action, Arrow, DiagramFrame, Readout } from './DiagramPrimitives';
import { radialScene, verticalDropPoint } from './expandedGeometry';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { formatMeasurement } from '../../experiments/workbench';
import { calculateFreeFall } from '@physics-lab/physics/high-school';
import { observedTimeMarkers } from '../motionTrail';

export function MechanicsDiagram({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'centripetal-force') {
    const { center, point } = radialScene(s);
    return <DiagramFrame title="转盘与径向合力" description="俯视；铜色箭头表示径向合力方向，箭长不表示大小">
      <circle cx={center.x} cy={center.y} r="139" fill="#e6ead9" stroke="#7f9272" strokeWidth="2" />
      <circle data-orbit-radius={p.radius} cx={center.x} cy={center.y} r={p.radius * 125} fill="none" stroke="#7a9170" strokeDasharray="5 4" />
      <path d={`M${center.x} ${center.y}L${point.x} ${point.y}`} stroke="#455f45" strokeWidth="2" />
      <circle cx={center.x} cy={center.y} r="5" fill="#355d44" /><circle data-particle="centripetal" cx={point.x} cy={point.y} r="11" fill="#b7683b" />
      {s.force > 0 && <Arrow from={point} to={{ x: point.x + s.forceX / s.force * 50, y: point.y - s.forceY / s.force * 50 }} label="F向心" />}
      {s.speed > 0 && <Arrow from={point} to={{ x: point.x + s.vx / s.speed * 50, y: point.y - s.vy / s.speed * 50 }} color="#416e52" label="v方向" />}
      <Readout x={450} y={80} label="径向合力" value={s.force} unit="N" /><Readout x={450} y={142} label="线速度大小" value={s.speed} unit="m/s" />
      <Readout x={450} y={204} label="旋转半径" value={p.radius} unit="m" />
      <Action x={235} y={340} label="半径 −0.1 m" onClick={onChange && (() => onChange({ radius: Math.max(.1, p.radius - .1) }))} />
      <Action x={380} y={340} label="半径 +0.1 m" onClick={onChange && (() => onChange({ radius: Math.min(1, p.radius + .1) }))} />
    </DiagramFrame>;
  }
  if (id === 'free-fall') {
    const point = verticalDropPoint(s.position, p.dropHeight);
    const samples = Array.from({ length: 17 }, (_, index) => calculateFreeFall(p, simulation.durationSeconds * index / 16).position);
    const marks = observedTimeMarkers(samples, s.time, simulation.durationSeconds);
    return <DiagramFrame title="自由落体释放器与竖直标尺" description="位置以球心计；终点为触地前瞬间，不模拟反弹；装置按释放高度缩放">
      <path d="M225 318V45H350M190 318H510" stroke="#6d8368" strokeWidth="7" fill="none" />
      <rect x="332" y="43" width="36" height="14" rx="4" fill="#385c45" /><path d="M350 70V306" stroke="#b3baa5" strokeDasharray="4 5" />
      <path d="M430 70V306" stroke="#708365" />{Array.from({ length: 6 }, (_, i) => <g key={i}><path d={`M430 ${70 + i * 47.2}h${i % 5 ? 8 : 14}`} stroke="#708365" /><text x="451" y={75 + i * 47.2}>{formatMeasurement(p.dropHeight * i / 5, 2)}</text></g>)}
      <text x="426" y="51">下落距离 / m</text><path data-fall-trace="true" d={`M${point.x} 70V${point.y}`} stroke="#188fa1" strokeWidth="3" strokeLinecap="round" fill="none" />{marks.map((mark, index) => <circle key={index} data-fall-time-marker={mark.timeSeconds} cx={point.x} cy={verticalDropPoint(mark.point, p.dropHeight).y} r="3.6" fill="#d6ffff" stroke="#15889a" strokeWidth="1.5" />)}<circle data-fall-center={s.position} cx={point.x} cy={point.y} r="12" fill="#b7683b" />
      <Readout x={69} y={91} label="已下落" value={s.position} unit="m" /><Readout x={69} y={153} label="向下速度" value={s.velocity} unit="m/s" /><Readout x={69} y={215} label="仿真时间" value={s.time} unit="s" />
      <text x="350" y="334" textAnchor="middle">蓝色轨迹与亮点只显示已经经过的位置；每 {formatMeasurement(simulation.durationSeconds / 16, 3)} s 采样一次</text><text x="350" y="350" textAnchor="middle">释放时初速度为零 · 重力加速度 {formatMeasurement(p.gravity)} m/s²</text>
    </DiagramFrame>;
  }
  return <CollisionDiagram experimentId={id} parameters={p} simulation={simulation} onChange={onChange} />;
}
