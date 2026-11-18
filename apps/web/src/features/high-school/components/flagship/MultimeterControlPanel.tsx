import { useEffect, useRef } from 'react';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { MULTIMETER_CONNECTION_LABELS, MULTIMETER_FUNCTION_LABELS, MULTIMETER_RANGE_LABELS, multimeterPresentation } from '../expanded/multimeterGeometry';
import './MultimeterControlPanel.css';

export interface MultimeterControlPanelProps {
  parameters: Record<string, number>;
  simulation: HighSchoolSimulation;
  onChange?: (patch: Record<string, number>) => void;
}

/** Parent owns every setting. Selecting a function never silently changes leads or power. */
export function MultimeterControlPanel(props: MultimeterControlPanelProps) {
  const current = useRef(props); current.current = props;
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { parameters: p, simulation, onChange } = props, view = multimeterPresentation(p, simulation.state);
  const choose = (key: string, value: number) => {
    const active = current.current;
    if (!mounted.current || !active.onChange || active.parameters[key] === value) return;
    const allowed: Record<string, readonly number[]> = { functionMode: [0,1,2], rangeIndex: [0,1,2], connection: [0,1,2], powerOn: [0,1], circuitClosed: [0,1], probesReversed: [0,1] };
    if (!allowed[key]?.includes(value)) return;
    active.onChange({ [key]: value });
  };
  const toggle = (key: string) => choose(key, current.current.parameters[key] === 1 ? 0 : 1);
  return <section className="hs-multimeter-console" aria-label="万用表操作台">
    <header><div><span className="hs-multimeter-eyebrow">数字表操作台</span><h3>先选功能，再检查接线和量程</h3></div>
      <output className={`hs-multimeter-output${view.valid ? '' : ' is-invalid'}`} aria-label="当前万用表示数" aria-live="polite">{view.display}</output>
    </header>
    <div className="hs-multimeter-selectors">
      <fieldset disabled={!onChange}><legend>1 · 功能旋钮</legend><div className="hs-multimeter-options">{MULTIMETER_FUNCTION_LABELS.map((label,value)=><button key={label} type="button" aria-pressed={p.functionMode===value} onClick={()=>choose('functionMode',value)}>{label}</button>)}</div></fieldset>
      <label className="hs-multimeter-range"><span>2 · 实际量程</span><select aria-label="万用表实际量程" disabled={!onChange} value={p.rangeIndex} onChange={event=>choose('rangeIndex',Number(event.target.value))}>{MULTIMETER_RANGE_LABELS[p.functionMode]?.map((label,value)=><option key={value} value={value}>{label}</option>)}</select><small>显示分辨率 {view.resolutionLabel}</small></label>
      <fieldset disabled={!onChange}><legend>3 · 表笔接法</legend><div className="hs-multimeter-options hs-multimeter-connections">{MULTIMETER_CONNECTION_LABELS.map((label,value)=><button key={label} type="button" aria-pressed={p.connection===value} onClick={()=>choose('connection',value)}>{label}</button>)}</div></fieldset>
    </div>
    <div className="hs-multimeter-switches"><button type="button" disabled={!onChange} aria-pressed={p.powerOn===1} onClick={()=>toggle('powerOn')}>外部电源：{p.powerOn?'接通':'断开'}</button><button type="button" disabled={!onChange} aria-pressed={p.circuitClosed===1} onClick={()=>toggle('circuitClosed')}>总开关：{p.circuitClosed?'闭合':'断开'}</button><button type="button" disabled={!onChange} aria-pressed={p.probesReversed===1} onClick={()=>toggle('probesReversed')}>表笔极性：{p.probesReversed?'反接':'正常'}</button></div>
    <div className={`hs-multimeter-feedback${view.valid?'':' is-invalid'}`} role="status"><strong>{view.status} · {view.functionLabel} · {view.rangeLabel}</strong>{view.reasons.map(reason=><p key={reason}>{reason}</p>)}</div>
    <p className="hs-multimeter-boundary">切换功能不会自动改接法、换量程或关闭电源。这里是理想数字表，分辨率不代表真实仪表准确度；错误配置不模拟器材损坏。</p>
  </section>;
}
