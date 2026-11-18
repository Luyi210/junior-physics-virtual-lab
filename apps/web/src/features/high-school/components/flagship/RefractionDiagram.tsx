import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Arrow, DiagramFrame } from '../expanded/DiagramPrimitives';
import type { ExpandedSceneProps } from '../expanded/expandedSceneTypes';
import { formatRefractionAngle, refractionAnglePoint, refractionArc, refractionPointerAngle, refractionRays } from './RefractionGeometry';
import './CollisionRefraction.css';

export function RefractionDiagram({ parameters: p, simulation, onChange }: ExpandedSceneProps) {
  const s = simulation.state, rays = refractionRays(s), o = rays.origin;
  const hasReflection = p.incidentIndex !== p.transmittedIndex;
  const latest = useRef({ p, onChange }); latest.current = { p, onChange };
  const mounted = useRef(false);
  const drag = useRef<{ pointerId: number; target: SVGGElement } | null>(null);
  function endDrag() { const active = drag.current; drag.current = null; if (active) try { if (active.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId); } catch { /* detached SVG */ } }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; endDrag(); }; }, []);
  function stop(event: PointerEvent<SVGGElement>) { if (drag.current?.pointerId === event.pointerId) endDrag(); }
  function move(event: PointerEvent<SVGGElement>) {
    if (!mounted.current || drag.current?.pointerId !== event.pointerId || !latest.current.onChange) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const angle = refractionPointerAngle(event.clientX, event.clientY, svg.getBoundingClientRect());
    if (angle !== null) latest.current.onChange({ incidentAngleDegrees: angle });
    event.preventDefault();
  }
  function start(event: PointerEvent<SVGGElement>) {
    if (!mounted.current || !latest.current.onChange || event.button !== 0 || drag.current) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
    drag.current = { pointerId: event.pointerId, target: event.currentTarget }; event.stopPropagation(); move(event);
  }
  function key(event: KeyboardEvent<SVGGElement>) {
    if (!mounted.current || !latest.current.onChange) return;
    const current = latest.current.p.incidentAngleDegrees;
    const values: Record<string, number> = { ArrowLeft: current - .1, ArrowDown: current - .1, ArrowRight: current + .1, ArrowUp: current + .1, PageDown: current - 5, PageUp: current + 5, Home: 0, End: 85 };
    if (!Object.hasOwn(values, event.key)) return;
    event.preventDefault(); latest.current.onChange({ incidentAngleDegrees: Math.round(Math.max(0, Math.min(85, values[event.key])) * 1000) / 1000 });
  }
  return <DiagramFrame title="折射界面、法线与量角盘" description="拖动入射端点或用方向键；量角器从法线起读，角弧与模型共用方向">
    <rect x="70" y={o.y} width="415" height="135" fill="#dce9db" /><path d={`M70 ${o.y}H485`} stroke="#8ca183" strokeWidth="2" /><path d={`M${o.x} 46V339`} stroke="#728c66" strokeDasharray="5 4" />
    <text x="82" y="53">入射侧 n₁ = {p.incidentIndex}</text><text x="82" y="322">折射侧 n₂ = {p.transmittedIndex}</text><text x="298" y="48">法线</text>
    {(['incident', 'transmitted'] as const).map(side => <g key={side}>{Array.from({ length: 19 }, (_, i) => i * 5).map(angle => { const a = refractionAnglePoint(angle, angle % 30 === 0 ? 115 : 121, side), b = refractionAnglePoint(angle, 129, side), label = refractionAnglePoint(angle, 105, side); return <g key={angle}><path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#99aa8b" />{angle % 30 === 0 && <text x={label.x} y={label.y + 4} textAnchor="middle" className="hs-refraction-tick">{angle}°</text>}</g>; })}</g>)}
    {s.incidentAngleDegrees > 0 && <path data-refraction-angle="incident" d={refractionArc(s.incidentAngleDegrees, 49, 'incident')} fill="none" stroke="#b7683b" strokeWidth="2" />}
    {Boolean(s.transmissionValid) && s.refractedAngleDegrees > 0 && <path data-refraction-angle="transmitted" d={refractionArc(s.refractedAngleDegrees, 60, 'transmitted')} fill="none" stroke="#3f7b6b" strokeWidth="2" />}
    <Arrow from={rays.incident} to={o} color="#b7683b" />{hasReflection && <Arrow from={o} to={rays.reflected} color="#8b9b69" />}{Boolean(s.transmissionValid) && <g data-transmitted-ray="true"><Arrow from={o} to={rays.transmitted} color="#3f7b6b" /></g>}
    <circle cx={o.x} cy={o.y} r="4" fill="#355d44" />
    <g data-refraction-source="true" role="slider" tabIndex={onChange ? 0 : -1} aria-label="拖动光源调节入射角" aria-valuemin={0} aria-valuemax={85} aria-valuenow={p.incidentAngleDegrees} aria-valuetext={formatRefractionAngle(p.incidentAngleDegrees)} aria-disabled={!onChange || undefined} className="hs-refraction-source" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onKeyDown={key}>
      <circle cx={rays.incident.x} cy={rays.incident.y} r="23" fill="transparent" /><circle cx={rays.incident.x} cy={rays.incident.y} r="10" fill="#b7683b" stroke="#f7f5ea" strokeWidth="3" /><path d={`M${rays.incident.x - 4} ${rays.incident.y}h8m-4-4v8`} stroke="#fff6de" />
    </g>
    <g className="hs-refraction-legend"><text x="511" y="88">入射角 i</text><text x="511" y="115" className="hs-expanded-number">{formatRefractionAngle(s.incidentAngleDegrees)}</text><text x="511" y="165">折射角 r</text><text x="511" y="192" className="hs-expanded-number">{s.transmissionValid ? formatRefractionAngle(s.refractedAngleDegrees) : '无折射光'}</text><text x="511" y="249">{s.totalInternalReflection ? '全反射' : Math.abs(s.refractedAngleDegrees - 90) < 1e-7 ? '临界掠射' : '相对法线量角'}</text><text x="511" y="272">{hasReflection ? '反射光：浅绿色' : '同折射率：无反射光'}</text></g>
    <text x="350" y="348" textAnchor="middle">铜色入射 · 深绿折射 · 介质不变时只调入射角</text>
  </DiagramFrame>;
}
