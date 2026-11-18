import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Arrow } from '../expanded/DiagramPrimitives';
import { formatMeasurement } from '../../experiments/workbench';
import { PendulumControlBar, usePendulumControls, type PendulumInstrumentProps } from './PendulumControls';
import { PENDULUM_ANGLE, PENDULUM_SVG, pendulumClientPoint, pendulumDragAmplitude, pendulumGeometry, pendulumSvgPoint } from './PendulumGeometry';
import './PendulumInstrument.css';

export function PendulumDiagram(props: PendulumInstrumentProps) {
  const { parameters, simulation, onChange } = props, state = simulation.state;
  const titleId = useId(), helpId = useId();
  const controls = usePendulumControls(props);
  const latest = useRef(controls); latest.current = controls;
  const drag = useRef<{ pointerId: number; element: SVGGElement } | null>(null);
  const geometry = pendulumGeometry(parameters, state), pivot = PENDULUM_SVG.pivot;
  function release() {
    const active = drag.current; drag.current = null;
    try { if (active?.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId); } catch { /* Removed SVG during view change. */ }
  }
  useEffect(() => () => release(), []);
  useEffect(() => { if (!onChange) release(); }, [onChange]);
  function locate(event: PointerEvent<SVGGElement>) {
    if (!latest.current.canChange()) return;
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return;
    let point = null;
    try {
      const matrix = svg.getScreenCTM();
      if (matrix && typeof DOMPoint !== 'undefined') { const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); point = { x: p.x, y: p.y }; }
    } catch { /* Equivalent viewBox mapping below handles non-transformed SVG. */ }
    point ??= pendulumClientPoint(event.clientX, event.clientY, svg.getBoundingClientRect());
    if (!point) return; const angle = pendulumDragAmplitude(point); if (angle !== null) latest.current.setAngle(angle);
  }
  function begin(event: PointerEvent<SVGGElement>) {
    if (!latest.current.canChange() || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); event.stopPropagation(); drag.current = { pointerId: event.pointerId, element: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Keyboard and buttons stay available. */ }
    locate(event);
  }
  function key(event: KeyboardEvent<SVGGElement>) {
    if (!latest.current.canChange()) return;
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); latest.current.setAngle(event.key === 'Home' ? PENDULUM_ANGLE.min : PENDULUM_ANGLE.max); }
    else if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) { event.preventDefault(); latest.current.stepAngle((['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) * (event.shiftKey ? 5 : 1)); }
  }
  const equilibrium = pendulumSvgPoint(0, -parameters.length);
  return <div className="hs-pendulum-instrument">
    <div className="hs-pendulum-readouts"><div><span>当前摆角</span><strong>{formatMeasurement(state.angleDegrees, 1)}<small>°</small></strong></div><div><span>运动方向</span><strong className="hs-pendulum-direction">{geometry.directionLabel}</strong></div><div><span>悬点至球心</span><strong>{formatMeasurement(parameters.length, 2)}<small>m</small></strong></div></div>
    <svg className="hs-diagram" data-pendulum-instrument="true" viewBox={`0 0 ${PENDULUM_SVG.width} ${PENDULUM_SVG.height}`} preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby={titleId}>
      <title id={titleId}>可调释放角的单摆。摆长按固定米比例绘制，虚线表示平衡位置与摆动范围。</title>
      <path d="M75 350V40H625V350M49 350H651" fill="none" stroke="#87957c" strokeWidth="8" strokeLinejoin="round" />
      <path d="M350 40V61" stroke="#4a644a" strokeWidth="5" /><circle cx={pivot.x} cy={pivot.y} r="5" fill="#284833" />
      <path d={`M${pivot.x} ${pivot.y}V${equilibrium.y}`} stroke="#9aa98c" strokeWidth="1.5" strokeDasharray="5 5" />
      <polyline data-pendulum-arc="true" points={geometry.arc.map(point => `${point.svg.x},${point.svg.y}`).join(' ')} fill="none" stroke="#a8b697" strokeWidth="1.5" strokeDasharray="4 5" />
      <path d="M116 61V329" stroke="#97a387" />{[0, .5, 1, 1.5, 2].map(length => <g key={length}><path d={`M110 ${pendulumSvgPoint(0, -length).y}h12`} stroke="#819474" /><text x="101" y={pendulumSvgPoint(0, -length).y + 5} textAnchor="end">{length}</text></g>)}
      <text x="116" y="378" textAnchor="middle">竖直距离 / m</text><text x="369" y="53">悬点 O</text>
      <path d={`M${pivot.x} ${pivot.y}L${geometry.release.svg.x} ${geometry.release.svg.y}`} stroke="#bf8a5d" strokeWidth="1.4" strokeDasharray="4 5" />
      <circle cx={geometry.mirror.svg.x} cy={geometry.mirror.svg.y} r="6" fill="#e3e7d8" stroke="#a4b291" />
      <path data-pendulum-string="true" d={`M${pivot.x} ${pivot.y}L${geometry.bob.x} ${geometry.bob.y}`} stroke="#35543c" strokeWidth="2.4" />
      <circle data-pendulum-bob="true" cx={geometry.bob.x} cy={geometry.bob.y} r={PENDULUM_SVG.bobRadius} fill="#b57542" stroke="#805334" strokeWidth="2" /><circle cx={geometry.bob.x - 4} cy={geometry.bob.y - 4} r="3" fill="#e1b88c" /><circle cx={geometry.bob.x} cy={geometry.bob.y} r="2" fill="#3d4d37" />
      {geometry.arrow && <Arrow {...geometry.arrow} color="#3e7150" />}
      <path d={`M337 ${equilibrium.y + 20}H363`} stroke="#a97b4f" strokeWidth="2" /><text x="350" y="378" textAnchor="middle">平衡位置 · 起止要同一方向经过</text>
      <g data-pendulum-release="true" className="hs-pendulum-release" role="slider" tabIndex={onChange ? 0 : -1} aria-label="设置释放摆角" aria-valuemin={PENDULUM_ANGLE.min} aria-valuemax={PENDULUM_ANGLE.max} aria-valuenow={parameters.amplitudeDegrees} aria-valuetext={`${parameters.amplitudeDegrees}度；改变后回到释放点并暂停`} aria-disabled={!onChange || undefined} aria-describedby={helpId}
        onKeyDown={key} onPointerDown={begin} onPointerMove={event => { if (drag.current?.pointerId === event.pointerId) { event.preventDefault(); locate(event); } }} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) release(); }} onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) release(); }} onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}>
        <circle cx={geometry.release.svg.x} cy={geometry.release.svg.y} r="1" fill="transparent" stroke="transparent" strokeWidth="44" vectorEffect="non-scaling-stroke" pointerEvents="all" />
        <circle className="hs-pendulum-release-ring" cx={geometry.release.svg.x} cy={geometry.release.svg.y} r="19" fill="none" stroke="#b4723e" strokeWidth="1.8" strokeDasharray="4 3" />
        <text x={geometry.release.svg.x + (geometry.release.svg.x > 550 ? -25 : 25)} y={geometry.release.svg.y - 16} textAnchor={geometry.release.svg.x > 550 ? "end" : "start"}>释放 {parameters.amplitudeDegrees}°</text>
      </g>
    </svg>
    <PendulumControlBar angle={parameters.amplitudeDegrees} setAngle={controls.setAngle} stepAngle={controls.stepAngle} disabled={!onChange} />
    <p id={helpId} className="hs-pendulum-help">{onChange ? '拖动铜色释放标记；方向键微调 1°，Shift 调 5°。改变释放角会暂停并回到释放点，正在进行的手动计时需重做。' : '铜色虚线标记释放位置；实心球表示当前摆球。'}摆长从悬点量至球心；球体大小为示意。</p>
  </div>;
}
