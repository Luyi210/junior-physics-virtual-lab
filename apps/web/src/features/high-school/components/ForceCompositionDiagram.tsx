import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { formatMeasurement } from '../experiments/workbench';
import { FORCE_BOARD, FORCE_HANDLES, forceArrowGeometry, forceClientPoint, forceDragPatch, forceKeyboardPatch, forceVectorPoint, type ForceBoardPoint, type ForceHandle } from './forceCompositionGeometry';
import './ForceCompositionControl.css';

export interface ForceCompositionDiagramProps {
  parameters: Record<string, number>;
  simulation: HighSchoolSimulation;
  onChange?: (patch: Record<string, number>) => void;
}
const handles: ForceHandle[] = ['force1', 'force2', 'trial'];
function Arrow({ id, tip, color, reference = false, defined = true }: { id: string; tip: ForceBoardPoint; color: string; reference?: boolean; defined?: boolean }) {
  const arrow = defined ? forceArrowGeometry(tip) : null;
  if (!arrow) return null;
  return <g data-force-vector={id} className={reference ? 'hs-force-reference' : ''} pointerEvents="none">
    <path d={`M${FORCE_BOARD.origin.x} ${FORCE_BOARD.origin.y}L${arrow.shaftEnd.x} ${arrow.shaftEnd.y}`} fill="none" stroke={color} strokeWidth={reference ? 2 : 3} strokeDasharray={reference ? '5 3' : undefined} />
    <polygon data-force-arrowhead={id} points={arrow.head.map((point) => `${point.x},${point.y}`).join(' ')} fill={color} />
  </g>;
}
export function ForceCompositionDiagram({ parameters, simulation, onChange }: ForceCompositionDiagramProps) {
  const titleId = useId(), descriptionId = useId(), helpId = useId();
  const [selected, setSelected] = useState<ForceHandle>('trial');
  const drag = useRef<{ handle: ForceHandle; pointerId: number; element: SVGGElement } | null>(null);
  const latest = useRef({ parameters, onChange }); latest.current = { parameters, onChange };
  function release() {
    const active = drag.current; drag.current = null;
    try { if (active?.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId); } catch { /* The element may have been removed during view switching. */ }
  }
  useEffect(() => () => release(), []);
  useEffect(() => { if (!onChange) release(); }, [onChange]);
  const s = simulation.state;
  const points = { force1: forceVectorPoint(s.force1X, s.force1Y), force2: forceVectorPoint(s.force2X, s.force2Y), trial: forceVectorPoint(s.trialX, s.trialY) };
  const resultant = forceVectorPoint(s.resultantX, s.resultantY);
  function pointerPoint(event: PointerEvent<SVGGElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return null;
    try {
      const matrix = svg.getScreenCTM?.();
      if (matrix && typeof DOMPoint !== 'undefined') {
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        return { x: point.x, y: point.y };
      }
    } catch { /* Fall back to the equivalent untransformed viewBox mapping. */ }
    return forceClientPoint(event.clientX, event.clientY, svg.getBoundingClientRect());
  }
  function move(event: PointerEvent<SVGGElement>, handle: ForceHandle) {
    const point = pointerPoint(event);
    if (!point || !latest.current.onChange) return;
    const patch = forceDragPatch(handle, point, latest.current.parameters[FORCE_HANDLES[handle].angle]);
    if (patch) latest.current.onChange(patch);
  }
  function begin(event: PointerEvent<SVGGElement>, handle: ForceHandle) {
    if (!latest.current.onChange || (event.pointerType === 'mouse' && event.button !== 0) || drag.current) return;
    event.preventDefault(); event.stopPropagation(); setSelected(handle);
    drag.current = { handle, pointerId: event.pointerId, element: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Keyboard and numeric controls remain available. */ }
    move(event, handle);
  }
  function keyDown(event: KeyboardEvent<Element>, handle: ForceHandle) {
    if (!latest.current.onChange) return;
    const patch = forceKeyboardPatch(handle, latest.current.parameters, event.key, event.shiftKey);
    if (!patch) return;
    event.preventDefault(); setSelected(handle); latest.current.onChange(patch);
  }
  const order = [...handles.filter((handle) => handle !== selected), selected];
  return <div className="hs-force-board">
    <div className="hs-force-handle-select" role="group" aria-label="选择可调整的力">{handles.map((handle) => <button key={handle} type="button" style={{ '--force-ink': FORCE_HANDLES[handle].color } as CSSProperties} aria-pressed={selected === handle} onKeyDown={(event) => keyDown(event, handle)} onClick={() => { release(); setSelected(handle); }}>
      <i aria-hidden="true" />{FORCE_HANDLES[handle].label}<span>{formatMeasurement(parameters[FORCE_HANDLES[handle].magnitude])} N</span>
    </button>)}</div>
    <svg className="hs-diagram" viewBox={`0 0 ${FORCE_BOARD.width} ${FORCE_BOARD.height}`} preserveAspectRatio="xMidYMid meet" role="group" aria-labelledby={`${titleId} ${descriptionId}`}>
      <title id={titleId}>共点力二维矢量板</title><desc id={descriptionId}>分力F₁、F₂、合力参考F与学生单力F试使用同一原点O、同一长度比例。此板表示理想矢量，不是实体测力计读数。</desc>
      <g className="hs-force-grid" aria-hidden="true">{Array.from({ length: 11 }, (_, index) => { const value = (index - 5) * 2; const point = forceVectorPoint(value, value); return <g key={value}><path d={`M${point.x} 50V330M210 ${point.y}H490`} /><text x={point.x} y="349" textAnchor="middle">{value}</text>{value !== 0 && <text x="195" y={point.y + 4} textAnchor="end">{value}</text>}</g>; })}</g>
      <path d="M200 190H512M350 340V31" fill="none" stroke="#75836b" strokeWidth="1.2" />
      <path d="M506 186L512 190 506 194M346 37L350 31 354 37" fill="none" stroke="#75836b" strokeWidth="1.2" />
      <text x="525" y="195">x / N</text><text x="363" y="32">y / N</text><text x="213" y="29">一大格 2 N · 逆时针为正角</text>
      {parameters.force1N > 0 && parameters.force2N > 0 && <path data-force-parallelogram="true" d={`M${points.force1.x} ${points.force1.y}L${resultant.x} ${resultant.y}L${points.force2.x} ${points.force2.y}`} fill="none" stroke="#9b9f83" strokeWidth="1.5" strokeDasharray="4 4" pointerEvents="none" />}
      <Arrow id="resultant" tip={resultant} color="#263f32" reference defined={Boolean(s.resultantDirectionDefined)} />
      {s.resultantDirectionDefined ? <text className="hs-force-reference-label" x={resultant.x + (s.resultantX < 0 ? -10 : 10)} y={resultant.y - 12} textAnchor={s.resultantX < 0 ? 'end' : 'start'}>F参考</text> : <text className="hs-force-zero" x="367" y="213">F参考 = 0；方向未定义</text>}
      {handles.map((handle) => <Arrow key={handle} id={handle} tip={points[handle]} color={FORCE_HANDLES[handle].color} defined={parameters[FORCE_HANDLES[handle].magnitude] > 0} />)}
      <circle cx="350" cy="190" r="4" fill="#263f32" /><text x="335" y="208" textAnchor="end">O</text>
      {order.map((handle) => {
        const spec = FORCE_HANDLES[handle], point = points[handle], magnitude = parameters[spec.magnitude];
        const reading = `${spec.label}，${formatMeasurement(magnitude)} N，${magnitude === 0 ? '零力，方向未定义' : `${formatMeasurement(parameters[spec.angle], 1)}度`}`;
        return <g key={handle} data-force-handle={handle} className={`hs-force-handle${selected === handle ? ' is-selected' : ''}`} role="button" tabIndex={onChange ? 0 : -1} aria-disabled={!onChange || undefined} aria-label={reading} aria-describedby={helpId}
          onFocus={() => setSelected(handle)} onKeyDown={(event) => keyDown(event, handle)} onPointerDown={(event) => begin(event, handle)}
          onPointerMove={(event) => { if (drag.current?.pointerId === event.pointerId && drag.current.handle === handle) { event.preventDefault(); move(event, handle); } }}
          onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) release(); }} onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) release(); }} onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}>
          <circle cx={point.x} cy={point.y} r="1" fill="transparent" stroke="transparent" strokeWidth="44" vectorEffect="non-scaling-stroke" pointerEvents="all" />
          <circle className="hs-force-handle-ring" cx={point.x} cy={point.y} r={selected === handle ? 10 : 7} fill="#fbf8ee" fillOpacity=".82" stroke={spec.color} strokeWidth={selected === handle ? 2.5 : 1.7} />
          <circle cx={point.x} cy={point.y} r="2.5" fill={spec.color} pointerEvents="none" />
          <text x={point.x + (handle === 'force2' ? -13 : 13)} y={point.y + (handle === 'trial' ? 20 : -12)} textAnchor={handle === 'force2' ? 'end' : 'start'} style={{ fill: spec.color }}>{spec.symbol}{magnitude === 0 ? ' = 0' : ''}</text>
        </g>;
      })}
      <text x="350" y="374" textAnchor="middle">虚线作图连接两分力端点与合力端点；所有矢量都从 O 出发</text>
    </svg>
    <p id={helpId} className="hs-force-keyboard-help">{onChange ? '拖动端点调整；重合时先选上方手柄。聚焦选择按钮或端点后：←逆时针、→顺时针 1°；↑↓增减 0.1 N；Shift ×10；Home 归零。数值也可在参数区填写。' : '只读矢量示意；零力只标原点，不表示方向。'}</p>
  </div>;
}
