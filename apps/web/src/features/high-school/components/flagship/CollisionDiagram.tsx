import { Arrow, DiagramFrame, RailCart } from '../expanded/DiagramPrimitives';
import type { ExpandedSceneProps } from '../expanded/expandedSceneTypes';
import { collisionComparison, collisionScene } from './CollisionModelView';
import { formatMeasurement } from '../../experiments/workbench';
import './CollisionRefraction.css';

export function CollisionDiagram({ parameters: p, simulation }: ExpandedSceneProps) {
  const s = simulation.state, scene = collisionScene(p, simulation), comparison = collisionComparison(p, s);
  const phase = comparison.phase === 'after' ? '碰后' : comparison.phase === 'separating' ? '不会相遇' : comparison.phase === 'outside' ? '窗内不相碰' : '碰前';
  return <DiagramFrame title="双小车一维碰撞导轨" description="相向接触端为位置参考；车体尺寸示意；速度箭长按同一比例，虚线为初始位置">
    <g className="hs-collision-heading"><text x="60" y="57">一维系统 / 正方向向右 →</text><text x="640" y="57" textAnchor="end">{phase} · t = {formatMeasurement(s.time)} s</text></g>
    <g className="hs-collision-readings"><text x="70" y="91">小车1 · {formatMeasurement(p.mass1)} kg</text><text x="70" y="116" className="hs-expanded-number">v₁ = {formatMeasurement(s.velocity1)} m/s</text><text x="630" y="91" textAnchor="end">小车2 · {formatMeasurement(p.mass2)} kg</text><text x="630" y="116" textAnchor="end" className="hs-expanded-number">v₂ = {formatMeasurement(s.velocity2)} m/s</text></g>
    <path d="M52 245H648M95 245V276M605 245V276" stroke="#839375" strokeWidth="5" fill="none" />
    {s.time > 0 && <g data-collision-initial-positions="true" fill="none" stroke="#a2ad93" strokeDasharray="4 4"><rect x={scene.svgPosition(scene.initialX1) - 56} y="199" width="56" height="28" rx="5" /><rect x={scene.svgPosition(scene.initialX2)} y="199" width="56" height="28" rx="5" /></g>}
    <RailCart x={scene.svgCart1} y={227} color="#4d7453" label="1" /><RailCart x={scene.svgCart2} y={227} color="#b87949" label="2" />
    {[{ key: '1', x: scene.svgCart1, y: 164, velocity: s.velocity1, color: '#4d7453' }, { key: '2', x: scene.svgCart2, y: 142, velocity: s.velocity2, color: '#ad663c' }].map((cart) => Math.abs(cart.velocity) > 1e-10 && <Arrow key={cart.key} from={{ x: cart.x, y: cart.y }} to={{ x: cart.x + cart.velocity * 8, y: cart.y }} color={cart.color} label={`v${cart.key}`} />)}
    <path d="M58 268H638" stroke="#839375" />{[-1, -.5, 0, .5, 1].map(f => <g key={f}><path d={`M${350 + f * 235} 263v10`} stroke="#839375" /><text x={350 + f * 235} y="290" textAnchor="middle">{formatMeasurement(scene.extent * f, 2)}</text></g>)}
    <text x="635" y="307" textAnchor="end">位置 x / m</text><text x="65" y="307">e = {formatMeasurement(p.restitution)} · {s.collisionTimeDefined ? `模型相碰时刻 ${formatMeasurement(s.collisionTime)} s` : '初速度不满足追近条件'}</text>
    <text x="350" y="345" textAnchor="middle" className="hs-expanded-number">p系统 = {formatMeasurement(s.totalMomentum)} kg·m/s　 K系统 = {formatMeasurement(s.kineticEnergy)} J</text>
  </DiagramFrame>;
}
