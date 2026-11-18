import { useEffect, useRef } from 'react';
import type { CapacitorMode } from '@physics-lab/contracts';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { formatMeasurement } from '../experiments/workbench';
import { CAPACITOR_MODES } from './capacitorGeometry';
import './CapacitorSwitchControl.css';

export interface CapacitorSwitchProps { mode: CapacitorMode; onModeChange?: (mode: CapacitorMode) => void; switchDisabled?: boolean }
export interface CapacitorSceneProps extends CapacitorSwitchProps { parameters: Record<string, number>; simulation: HighSchoolSimulation }
export function signedCapacitorReading(value: number, multiplier = 1) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${formatMeasurement(Math.abs(value) * multiplier)}`;
}
export function useCapacitorModeRequest(props: CapacitorSwitchProps) {
  const latest = useRef(props); latest.current = props;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return (mode: CapacitorMode) => {
    const current = latest.current;
    if (!mounted.current || current.switchDisabled || !current.onModeChange || mode === current.mode) return;
    current.onModeChange(mode);
  };
}
export function CapacitorModeButtons(props: CapacitorSwitchProps) {
  const requestMode = useCapacitorModeRequest(props);
  return <div className="hs-capacitor-modes" role="group" aria-label="电容器转换开关">{CAPACITOR_MODES.map(({ mode, label, detail }) => <button type="button" key={mode} aria-pressed={props.mode === mode} disabled={props.switchDisabled || !props.onModeChange} onClick={() => requestMode(mode)}><strong>{label}</strong><small>{detail}</small></button>)}</div>;
}
export function CapacitorSwitchControl(props: CapacitorSceneProps) {
  const s = props.simulation.state;
  return <section className="hs-capacitor-control" aria-label="电容器回路切换台">
    <header><div><span className="hs-kicker">回路与电荷</span><h3>切换回路，保留此刻的电压。</h3></div><span className="hs-capacitor-tau">时间常量 τ <b>{formatMeasurement(s.timeConstant)} s</b></span></header>
    <p>开关改变后从当前电容电压继续演化；开路会保持电荷，不等于放空。调整电阻、电容或电源参数会开始新一轮，已保存记录保留。</p>
    <CapacitorModeButtons {...props} />
    <div className="hs-capacitor-readings">
      <div><span>U = V(P) − V(N)</span><output>{signedCapacitorReading(s.voltage)} <small>V</small></output></div>
      <div><span>I · 流入 P 为正</span><output>{signedCapacitorReading(s.current, 1000)} <small>mA</small></output></div>
      <div><span>P 极板电荷 Q</span><output>{signedCapacitorReading(s.charge, 1e6)} <small>μC</small></output></div>
      <div><span>电容储能</span><output>{formatMeasurement(s.storedEnergy * 1000)} <small>mJ</small></output></div>
    </div>
    <p className="hs-capacitor-mode-note" role="status">{props.mode === 'open' ? '开路保持：I = 0；理想电表不取电流，忽略漏电，U、Q 与储能保持。' : props.mode === 'discharge' ? '经电阻放电：电源不在闭合回路中。正电压电容放电时 I 为负，箭头与固定正方向相反。' : '接电源：观察电压逐渐靠近电源电压，电流逐渐减小；有限时间内不把近似稳态强制改成完全充满。'}</p>
    <footer>数值来自理想 RC 模型；两块极板分别带 Q、−Q，不是整个电容器带净电荷 Q。电阻耗散与电容储能分别核算。切换本身不会自动保存读数。</footer>
  </section>;
}
