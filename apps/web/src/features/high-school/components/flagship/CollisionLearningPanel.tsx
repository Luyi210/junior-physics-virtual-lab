import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { collisionComparison, collisionExamples } from './CollisionModelView';
import { formatMeasurement } from '../../experiments/workbench';
import './CollisionRefraction.css';

export interface CollisionLearningPanelProps { parameters: Record<string, number>; simulation: HighSchoolSimulation; onChange?: (patch: Record<string, number>) => void }
export function CollisionLearningPanel({ parameters: p, simulation, onChange }: CollisionLearningPanelProps) {
  const s = simulation.state, view = collisionComparison(p, s), after = view.phase === 'after';
  const f = (value: number) => formatMeasurement(value, 4);
  return <section className="hs-flagship-learning hs-collision-learning" aria-label="碰撞前后模型对照">
    <header><span className="hs-flagship-eyebrow">先预测 · 再运行 · 对照变化</span><h3>动量守恒，动能也一定守恒吗？</h3><p>{after ? '已发生碰撞：现在可以对照碰前给定值与碰后当前值。' : view.phase === 'separating' ? '当前两车不会相遇。先比较带符号的初速度，再决定怎样调整。' : view.phase === 'outside' ? `预计${f(s.collisionTime)} s相碰，超出6 s观察窗。可缩短间距或提高接近速度，另开一轮。` : `预计${f(s.collisionTime)} s相碰；当前仍在碰前，不把这一帧当碰后证据。`}</p></header>
    <div className="hs-collision-comparison" tabIndex={0} aria-label="可横向滚动的碰撞模型对照表"><table><caption>全表为模型辅助比较，不会自动加入实验档案。</caption><thead><tr><th scope="col">比较量</th><th scope="col">初始给定 / t = 0</th><th scope="col">{after ? '碰后当前' : '碰前当前'} / {f(s.time)} s</th></tr></thead><tbody>
      <tr><th scope="row">小车1速度 / m/s</th><td>{f(view.initialVelocity1)}</td><td>{f(s.velocity1)}</td></tr>
      <tr><th scope="row">小车2速度 / m/s</th><td>{f(view.initialVelocity2)}</td><td>{f(s.velocity2)}</td></tr>
      <tr className="hs-collision-total"><th scope="row">系统总动量 / kg·m/s</th><td>{f(view.initialMomentum)}</td><td>{f(s.totalMomentum)}</td></tr>
      <tr><th scope="row">系统总动能 / J</th><td>{f(view.initialEnergy)}</td><td>{f(s.kineticEnergy)}</td></tr>
    </tbody></table></div>
    <p className="hs-flagship-comparison-note">{after ? <>总动量差 <strong>{f(view.momentumDifference)} kg·m/s</strong>；动能减少 <strong>{f(s.energyLoss)} J</strong>。{p.restitution === 0 ? 'e=0后两车同速，不一定静止。' : p.restitution === 1 ? 'e=1为理想弹性碰撞。' : '动能减少不表示总能量消失。'}</> : '需要播放到实际相碰后，再比较动能变化；不会提前填入碰后结果。'} 初始总动量为0时，不以它作相对误差的分母；极小差值可能来自浮点计算，不代表实体误差。</p>
    <fieldset className="hs-flagship-controls"><legend>只改变恢复系数 e，其他条件保留</legend><div className="hs-flagship-buttons">{[{ value: 0, label: '0 · 完全非弹性' }, { value: .5, label: '0.5 · 中间对照' }, { value: 1, label: '1 · 弹性' }].map(({ value, label }) => <button key={value} type="button" disabled={!onChange} aria-pressed={Math.abs(p.restitution - value) < 1e-9} onClick={() => onChange?.({ restitution: value })}>{label}</button>)}</div><small>每次点击都从头计时，已有档案保留。请自行在碰前、碰后暂停并点击“记录这组读数”。</small></fieldset>
    <details className="hs-flagship-examples"><summary>换一个起始情形，先预测是否碰撞</summary><p>以下示例会改质量、两初速度和间距，并从头计时；恢复系数保持当前值。</p>{collisionExamples.map((example) => <div key={example.label}><button type="button" disabled={!onChange} onClick={() => onChange?.({ ...example.patch })}>{example.label}</button><span>{example.description}</span></div>)}</details>
  </section>;
}
