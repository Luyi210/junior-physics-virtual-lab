import { Arrow3D, Bench, Block, Label, Rod } from '../expanded/ApparatusPrimitives3D';
import type { ExpandedSceneProps } from '../expanded/expandedSceneTypes';
import { collisionScene } from './CollisionModelView';
import { formatMeasurement } from '../../experiments/workbench';

function Cart({ x, color }: { x: number; color: string }) {
  return <group><Block position={[x, -.42, 0]} size={[.7, .35, .55]} color={color} />{[-.22, .22].flatMap(dx => [-.29, .29].map(z => <mesh key={`${dx}:${z}`} position={[x + dx, -.64, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.12, .12, .08, 16]} /><meshStandardMaterial color="#334c37" /></mesh>))}</group>;
}
export function CollisionApparatus3D({ parameters: p, simulation }: ExpandedSceneProps) {
  const s = simulation.state, scene = collisionScene(p, simulation);
  return <Bench><Block position={[0, -.88, 0]} size={[8, .18, 1]} color="#b5c1a5" /><Rod start={[-4, -.75, -.2]} end={[4, -.75, -.2]} /><Rod start={[-4, -.75, .2]} end={[4, -.75, .2]} />
    <Cart x={scene.worldCart1} color="#486d50" /><Cart x={scene.worldCart2} color="#b47543" />
    <Label position={[scene.worldCart1, .05, 0]}>1 · {formatMeasurement(p.mass1)} kg</Label><Label position={[scene.worldCart2, .05, 0]}>2 · {formatMeasurement(p.mass2)} kg</Label>
    {Math.abs(s.velocity1) > 1e-10 && <Arrow3D start={[scene.worldCart1, .35, 0]} end={[scene.worldCart1 + s.velocity1 * .12, .35, 0]} color="#486d50" />}
    {Math.abs(s.velocity2) > 1e-10 && <Arrow3D start={[scene.worldCart2, .7, 0]} end={[scene.worldCart2 + s.velocity2 * .12, .7, 0]} color="#b47543" />}
    {[-1, -.5, 0, .5, 1].map(f => <group key={f}><Rod start={[f * 3.1, -.77, .55]} end={[f * 3.1, -.77, .7]} radius={.01} color="#627959" /><Label position={[f * 3.1, -.74, 1.05]}>{formatMeasurement(f * scene.extent, 2)} m</Label></group>)}
    <Label position={[0, 1.35, 0]}>接触端为位置参考 · 正方向向右</Label><Label position={[0, 1.95, 0]}>{s.collided ? '碰后对照' : s.collisionWithinWindow ? '碰前 · 先预测' : '本观察窗内不相碰'} · e={formatMeasurement(p.restitution)}</Label>
    <Label position={[0, -.5, 1.7]}>v₁ {formatMeasurement(s.velocity1)} m/s　v₂ {formatMeasurement(s.velocity2)} m/s</Label>
  </Bench>;
}
