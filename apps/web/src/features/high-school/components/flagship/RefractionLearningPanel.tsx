import { useId } from 'react';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { formatRefractionAngle, refractionStatus } from './RefractionGeometry';
import { formatMeasurement } from '../../experiments/workbench';
import './CollisionRefraction.css';

export interface RefractionLearningPanelProps { parameters: Record<string, number>; simulation: HighSchoolSimulation; onChange?: (patch: Record<string, number>) => void }
export function RefractionLearningPanel({ parameters: p, simulation, onChange }: RefractionLearningPanelProps) {
  const inputId = useId(), s = simulation.state, critical = s.criticalAngleDegrees;
  const atCritical = s.criticalDefined === 1 && Math.abs(p.incidentAngleDegrees - critical) < 1e-8;
  const changeAngle = (angle: number) => onChange?.({ incidentAngleDegrees: Math.max(0, Math.min(85, angle)) });
  return <section className="hs-flagship-learning hs-refraction-learning" aria-label="折射角与临界条件探究"><header><span className="hs-flagship-eyebrow">角度从法线量起</span><h3>光线为什么这样偏折？</h3><p>{refractionStatus(p, s)}</p></header>
    <div className="hs-refraction-readings"><div><span>入射角 i</span><strong>{formatRefractionAngle(s.incidentAngleDegrees)}</strong></div><div><span>折射角 r</span><strong>{s.transmissionValid ? formatRefractionAngle(s.refractedAngleDegrees) : '无折射光'}</strong></div><div><span>sin i / sin r</span><strong>{s.estimateDefined ? formatMeasurement(s.indexRatioEstimate, 4) : '不可单点估计'}</strong></div></div>
    <label className="hs-refraction-slider" htmlFor={inputId}><span>移动光源：入射角 <output>{formatRefractionAngle(p.incidentAngleDegrees)}</output></span><input id={inputId} type="range" min="0" max="85" step="0.1" value={p.incidentAngleDegrees} aria-valuetext={formatRefractionAngle(p.incidentAngleDegrees)} disabled={!onChange} onChange={event => changeAngle(Number(event.target.value))} /><span className="hs-refraction-bounds"><small>0° · 沿法线</small><small>85° · 接近界面</small></span></label>
    <div className="hs-flagship-buttons"><button type="button" disabled={!onChange || p.incidentAngleDegrees <= 0} onClick={() => changeAngle(p.incidentAngleDegrees - 1)}>−1°</button><button type="button" disabled={!onChange || p.incidentAngleDegrees >= 85} onClick={() => changeAngle(p.incidentAngleDegrees + 1)}>+1°</button><button type="button" disabled={!onChange} onClick={() => onChange?.({ incidentIndex: p.transmittedIndex, transmittedIndex: p.incidentIndex })}>交换两侧介质，保留入射角</button></div>
    <div className="hs-refraction-critical"><h4>临界前 · 恰好临界 · 超过临界</h4>{s.criticalDefined ? <><p>当前临界角 C = {formatRefractionAngle(critical)}。按钮使用未舍入的临界值；“≈”只表示显示取近似值。</p><div className="hs-flagship-buttons">{[{ offset: -.5, label: '临界前 0.5°' }, { offset: 0, label: '恰好临界 C' }, { offset: .5, label: '超过临界 0.5°' }].map(({ offset, label }) => <button key={offset} type="button" disabled={!onChange || critical + offset < 0 || critical + offset > 85} aria-pressed={offset === 0 ? atCritical : Math.abs(p.incidentAngleDegrees - critical - offset) < 1e-8} onClick={() => changeAngle(critical + offset)}>{label}</button>)}</div>{critical > 85 && <p>本页入射角上限为85°，当前临界点超出范围。可增大入射侧折射率与另一侧的差距，再作临界对照。</p>}</> : <p>只有从较高折射率一侧进入较低折射率一侧时才有临界角。可交换两侧介质后再比较；折射率相同时也没有全反射。</p>}</div>
    <p className="hs-flagship-comparison-note">量角器、角弧和数值来自同一模型，操作光源不是独立测角。固定两侧介质，选三个有折射光的不同角度，自行保存读数并比较 sin i—sin r；此面板不会自动存档。</p>
  </section>;
}
