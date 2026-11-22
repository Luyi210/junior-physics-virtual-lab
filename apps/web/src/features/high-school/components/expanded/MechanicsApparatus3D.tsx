import { CollisionApparatus3D } from '../flagship/CollisionApparatus3D';
import { Line } from '@react-three/drei';
import { Arrow3D, Bead, Bench, Block, Disc, Gauge3D, Label, Rod, SceneAction } from './ApparatusPrimitives3D';
import { radialScene, verticalDropPoint, type Point3 } from './expandedGeometry';
import type { ExpandedSceneProps } from './expandedSceneTypes';
import { formatMeasurement } from '../../experiments/workbench';
import { calculateFreeFall } from '@physics-lab/physics/high-school';
import { observedTimeMarkers } from '../motionTrail';

export function MechanicsApparatus3D({ experimentId: id, parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state;
  if (id === 'centripetal-force') {
    const point = radialScene(s).world;
    const inward: Point3 = [point[0] + (s.force ? s.forceX / s.force * .8 : 0), point[1], point[2] - (s.force ? s.forceY / s.force * .8 : 0)];
    return <Bench><Disc position={[0, -.79, 0]} radius={3.15} color="#b1bfa1" /><Disc position={[0, -.65, 0]} radius={.18} color="#385c44" />
      <Line points={Array.from({ length: 97 }, (_, i): Point3 => [p.radius * 3 * Math.cos(i / 96 * 2 * Math.PI), -.7, p.radius * 3 * Math.sin(i / 96 * 2 * Math.PI)])} color="#708767" dashed dashSize={.12} gapSize={.1} />
      <Rod start={[0, -.5, 0]} end={point} color="#496e50" radius={.018} /><Bead position={point} />{s.force > 0 && <Arrow3D start={point} end={inward} />}
      <Label position={[0, 1.1, 0]}>F向心 {formatMeasurement(s.force)} N · 箭头示方向</Label>
      <SceneAction position={[-2.5, -.8, 2.5]} label="减小半径" onClick={onChange && (() => onChange({ radius: Math.max(.1, p.radius - .1) }))} />
      <SceneAction position={[2.5, -.8, 2.5]} label="增大半径" onClick={onChange && (() => onChange({ radius: Math.min(1, p.radius + .1) }))} />
    </Bench>;
  }
  if (id === 'free-fall') {
    const point = verticalDropPoint(s.position, p.dropHeight);
    const samples = Array.from({ length: 17 }, (_, index) => verticalDropPoint(calculateFreeFall(p, simulation.durationSeconds * index / 16).position, p.dropHeight).world);
    const marks = observedTimeMarkers(samples, s.time, simulation.durationSeconds);
    return <Bench><Rod start={[-1.2, -1.06, 0]} end={[-1.2, 2.65, 0]} radius={.07} /><Rod start={[-1.2, 2.65, 0]} end={[0, 2.65, 0]} radius={.07} /><Block position={[0, 2.5, 0]} size={[.45, .22, .45]} color="#395e44" />
      <Rod start={[1, -.9, 0]} end={[1, 2.2, 0]} radius={.035} />{Array.from({ length: 6 }, (_, i) => <group key={i}><Rod start={[1, 2.2 - i / 5 * 3.1, 0]} end={[1.18, 2.2 - i / 5 * 3.1, 0]} radius={.012} /><Label position={[1.55, 2.2 - i / 5 * 3.1, 0]}>{formatMeasurement(p.dropHeight * i / 5, 1)} m</Label></group>)}
      {s.time > 0 && <Line points={[[0, 2.2, 0] as Point3, point.world]} color="#57c7d1" lineWidth={2.5} />}{marks.map((mark, index) => <mesh key={index} position={mark.point} userData={{ fallSampleTimeSeconds: mark.timeSeconds }}><sphereGeometry args={[.052, 8, 6]} /><meshBasicMaterial color="#b8f4f5" transparent opacity={.4 + .5 * index / Math.max(1, marks.length - 1)} /></mesh>)}<Bead position={point.world} radius={.16} /><Gauge3D position={[-2.4, -.7, 1.2]} label="下落时间" value={s.time} unit="s" /><Label position={[0, 3.1, 0]}>从静止释放 · 接地前读数</Label>
    </Bench>;
  }
  return <CollisionApparatus3D experimentId={id} parameters={p} simulation={simulation} onChange={onChange} />;
}
