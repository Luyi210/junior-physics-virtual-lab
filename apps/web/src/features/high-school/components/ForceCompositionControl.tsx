import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { Save } from 'lucide-react';
import { formatMeasurement } from '../experiments/workbench';
import { FORCE_PRESETS } from './forceCompositionGeometry';
import './ForceCompositionControl.css';

export const FORCE_COMPARISON_TOLERANCE_N = .05;
export interface ForceCompositionControlProps {
  parameters: Record<string, number>;
  simulation: HighSchoolSimulation;
  onChange?: (patch: Record<string, number>) => void;
  onRecord?: () => void;
  recordDisabled?: boolean;
}
export function ForceCompositionControl({ parameters, simulation, onChange, onRecord, recordDisabled = false }: ForceCompositionControlProps) {
  const residual = simulation.state.residualMagnitude;
  const withinTolerance = Number.isFinite(residual) && residual <= FORCE_COMPARISON_TOLERANCE_N;
  return <section className="hs-force-control" aria-label="共点力等效对照台">
    <header><div><span className="hs-kicker">等效对照</span><h3>用一支力，匹配两支力。</h3></div><div className="hs-force-residual"><span>单力与合力参考之差</span><output aria-label="当前矢量残差">{formatMeasurement(residual, 3)}<small> N</small></output></div></header>
    <p>先设定 F₁、F₂，再独立调整铜橙色 F试 的大小和方向。预设只改变两分力，不替你填写单力，也不会自动记录。</p>
    <div className="hs-force-presets" role="group" aria-label="选择两分力关系">{FORCE_PRESETS.map((preset) => <button key={preset.id} type="button" disabled={!onChange} aria-pressed={Object.entries(preset.patch).every(([key, value]) => parameters[key] === value)} onClick={() => onChange?.({ ...preset.patch })}><strong>{preset.label}</strong><span>{preset.note}</span></button>)}</div>
    <div className={`hs-force-comparison${withinTolerance ? ' is-close' : ''}`} role="status"><span aria-hidden="true">{withinTolerance ? '≈' : '↔'}</span><p>{withinTolerance ? '当前单力与合力参考接近。请记录条件，再换一组比较。' : '继续调整 F试：不仅比较长度，也要比较方向。'}<small>0.05 N 是教学对照阈值，不是测量精度。这是二维理想模型的矢量比较，不是实体器材测量。</small></p></div>
    <footer><span>记录同时保留两分力与独立试力的当前条件。</span><button type="button" disabled={recordDisabled || !onRecord} onClick={() => { if (!recordDisabled) onRecord?.(); }}><Save size={15} aria-hidden="true" />记录这一组</button></footer>
  </section>;
}
