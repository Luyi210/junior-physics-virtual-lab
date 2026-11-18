import { useId } from 'react';
import { formatMeasurement } from '../experiments/workbench';
import { CapacitorModeButtons, signedCapacitorReading, useCapacitorModeRequest, type CapacitorSceneProps } from './CapacitorSwitchControl';
import { CAPACITOR_BOARD as B, CAPACITOR_MODES, CAPACITOR_WIRES, capacitorCurrentArrow, capacitorPath, capacitorPlateSigns, capacitorSwitchEnd } from './capacitorGeometry';

export function CapacitorDiagram(props: CapacitorSceneProps) {
  const titleId = useId(), descId = useId(), markerId = useId().replace(/:/g, '');
  const requestMode = useCapacitorModeRequest(props);
  const s = props.simulation.state, signs = capacitorPlateSigns(s.charge), arrow = capacitorCurrentArrow(s.current);
  const bladeEnd = capacitorSwitchEnd(props.mode);
  const disabled = props.switchDisabled || !props.onModeChange;
  return <div className="hs-capacitor-board">
    <CapacitorModeButtons {...props} />
    <svg className="hs-diagram" viewBox={`0 0 ${B.width} ${B.height}`} role="group" aria-labelledby={titleId} aria-describedby={descId}>
      <title id={titleId}>电容器充放电交互电路板</title><desc id={descId}>单刀双掷转换开关，中位断开。电流表串联，电压表并联电容；正电流流入 P 极板。电荷不穿过绝缘介质。</desc>
      <defs><marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3 0 6" fill="#b6673d" /></marker></defs>
      <rect x="32" y="32" width="648" height="310" rx="14" fill="#f1f0e4" stroke="#d8dece" />
      {CAPACITOR_WIRES.map((wire) => <path key={wire.id} data-capacitor-wire={wire.id} d={capacitorPath(wire.points)} fill="none" stroke={wire.branch === 'voltmeter' ? '#8c9b7b' : '#53705a'} strokeWidth={wire.branch === 'voltmeter' ? 2 : 3} />)}
      <path d="M70 180H110M79 204H101" stroke="#b6673d" strokeWidth="4" />
      <text x="54" y="184" textAnchor="middle">＋</text><text x="54" y="209" textAnchor="middle">−</text>
      <text x="91" y="242" textAnchor="middle">E {formatMeasurement(props.parameters.emf)} V</text>
      <rect x="325" y="121" width="50" height="28" rx="3" fill="#d5bc92" stroke="#5d765e" strokeWidth="2" />
      <text x="350" y="172" textAnchor="middle">R {formatMeasurement(props.parameters.resistanceKOhm)} kΩ</text>
      <circle cx="440" cy="135" r="25" fill="#faf8ee" stroke="#53705a" strokeWidth="2" /><text x="440" y="141" className="hs-capacitor-meter-letter" textAnchor="middle">A</text>
      <text x="440" y="181" textAnchor="middle">I {signedCapacitorReading(s.current, 1000)} mA</text>
      <text x="400" y="64" textAnchor="middle">I 正方向 → 流入 P</text>
      {arrow && <path data-capacitor-current-direction={arrow.direction} d={capacitorPath([arrow.start, arrow.end])} stroke="#b6673d" strokeWidth="2.5" fill="none" markerEnd={`url(#${markerId})`} />}
      <rect data-capacitor-dielectric="true" x="535" y="196" width="50" height="23" fill="#e5dfc9" />
      <path data-capacitor-plate="P" d="M530 190H590" stroke="#b6673d" strokeWidth="5" /><path data-capacitor-plate="N" d="M530 225H590" stroke="#476c58" strokeWidth="5" />
      <text x="514" y="193" textAnchor="end">P</text><text x="514" y="229" textAnchor="end">N</text>
      {signs.p && <g data-capacitor-charge-signs="true" aria-label={`P极板${signs.p}，N极板${signs.n}`}>{[540, 560, 580].map((x) => <g key={x}><text x={x} y="181" textAnchor="middle" className="hs-capacitor-positive-charge">{signs.p}</text><text x={x} y="247" textAnchor="middle" className="hs-capacitor-negative-charge">{signs.n}</text></g>)}</g>}
      <text x="455" y="276" textAnchor="middle">C {formatMeasurement(props.parameters.capacitanceMicrofarads)} μF</text>
      <circle cx="650" cy="207" r="20" fill="#faf8ee" stroke="#839774" strokeWidth="2" /><text x="650" y="213" textAnchor="middle" className="hs-capacitor-meter-letter">V</text>
      <text x="650" y="271" textAnchor="middle">{signedCapacitorReading(s.voltage)} V</text>
      <path data-capacitor-switch-blade={props.mode} d={capacitorPath([B.common, bladeEnd])} stroke="#b6673d" strokeWidth="5" strokeLinecap="round" />
      <circle cx={B.common.x} cy={B.common.y} r="7" fill="#b6673d" stroke="#f8f4e9" strokeWidth="2" />
      {CAPACITOR_MODES.map(({ mode, label }) => { const point = B.contacts[mode]; return <g key={mode} className="hs-capacitor-contact" data-capacitor-switch={mode} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} aria-pressed={props.mode === mode} aria-label={`转换开关：${label}`} onClick={() => requestMode(mode)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); requestMode(mode); } }}>
        <circle cx={point.x} cy={point.y} r="22" fill="transparent" pointerEvents="all" />
        <circle className="hs-capacitor-contact-ring" cx={point.x} cy={point.y} r={mode === 'open' ? 10 : 7} fill={mode === 'open' ? '#f1f0e4' : '#6b846a'} stroke={props.mode === mode ? '#b6673d' : '#91a186'} strokeWidth="2" strokeDasharray={mode === 'open' ? '3 3' : undefined} />
        <text x={point.x - 18} y={point.y + (mode === 'charge' ? -16 : 31)} textAnchor="middle">{label}</text>
      </g>; })}
      <text x="350" y="365" textAnchor="middle">箭头只表示常规电流方向；两极板间为绝缘介质，无电荷跨越。</text>
    </svg>
    <p className="hs-capacitor-board-note">P 极板 Q = {signedCapacitorReading(s.charge, 1e6)} μC；N 极板为 −Q。符号数量与装置尺寸仅作示意。按钮、触点均可切换回路。</p>
  </div>;
}
