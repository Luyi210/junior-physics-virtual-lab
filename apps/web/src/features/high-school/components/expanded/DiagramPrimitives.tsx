import { useId, type ReactNode } from 'react';
import { formatMeasurement } from '../../experiments/workbench';
import { meterNeedle, type Point2 } from './expandedGeometry';
import './ExpandedInstruments.css';

export function DiagramFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const id = useId();
  return <svg className="hs-diagram" data-expanded-instrument={title} viewBox="0 0 700 400" role="group" aria-labelledby={id}>
    <title id={id}>{`${title}；${description}`}</title>
    <rect x="24" y="24" width="652" height="332" rx="12" fill="#f7f5ea" stroke="#d7ddcb" />
    <path d="M42 322H658" stroke="#d7ddcb" strokeWidth="1" />
    {children}
    <text x="350" y="382" textAnchor="middle" className="hs-expanded-note">{description}</text>
  </svg>;
}
export function Readout({ x, y, label, value, unit = '', digits = 3 }: { x: number; y: number; label: string; value: number; unit?: string; digits?: number }) {
  return <g data-readout={label}><text x={x} y={y} className="hs-expanded-caption">{label}</text><text x={x} y={y + 24} className="hs-expanded-number">{formatMeasurement(value, digits)} {unit}</text></g>;
}
export function Meter({ x, y, label, value, unit, fraction = .5 }: { x: number; y: number; label: string; value: number; unit: string; fraction?: number }) {
  const tip = meterNeedle(fraction, { x, y: y + 20 });
  return <g data-meter={label}><rect x={x - 62} y={y - 36} width="124" height="102" rx="9" fill="#e9e6d4" stroke="#647a62" strokeWidth="2" />
    <path d={`M${x - 43} ${y + 15}Q${x} ${y - 47} ${x + 43} ${y + 15}`} stroke="#94a084" fill="none" />
    {[-40, -20, 0, 20, 40].map(dx => <path key={dx} d={`M${x + dx} ${y + Math.abs(dx) * .55 - 23}v5`} stroke="#73816a" />)}
    <path data-needle={label} d={`M${x} ${y + 20}L${tip.x} ${tip.y}`} stroke="#b7683b" strokeWidth="2" />
    <circle cx={x} cy={y + 20} r="3" fill="#385b42" /><text x={x} y={y + 45} textAnchor="middle" className="hs-expanded-number">{formatMeasurement(value)} {unit}</text><text x={x} y={y + 83} textAnchor="middle">{label}</text>
  </g>;
}
export function Arrow({ from, to, color = '#b7683b', label }: { from: Point2; to: Point2; color?: string; label?: string }) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < .001) return null;
  const ux = (to.x - from.x) / length, uy = (to.y - from.y) / length, size = Math.min(9, length * .35);
  return <g data-vector={label}><path d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke={color} strokeWidth="2.5" fill="none" /><path d={`M${to.x - ux * size - uy * size * .5} ${to.y - uy * size + ux * size * .5}L${to.x} ${to.y}L${to.x - ux * size + uy * size * .5} ${to.y - uy * size - ux * size * .5}`} stroke={color} strokeWidth="2.5" fill="none" />{label && <text x={to.x + 10} y={to.y - 10} fill={color}>{label}</text>}</g>;
}
export function Action({ x, y, label, onClick, selected = false, width = 116 }: { x: number; y: number; label: string; onClick?: () => void; selected?: boolean; width?: number }) {
  return <g className="hs-expanded-action" transform={`translate(${x} ${y})`} role="button" tabIndex={onClick ? 0 : -1} aria-label={label} aria-disabled={!onClick || undefined} aria-pressed={selected} onClick={() => onClick?.()} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && onClick) { event.preventDefault(); onClick(); } }}>
    <rect x={-width / 2} y="-18" width={width} height="36" rx="5" fill={selected ? '#355d44' : '#f4efdf'} stroke="#87997c" /><text x="0" y="5" textAnchor="middle" fill={selected ? '#fffbed' : '#355d44'}>{label}</text>
  </g>;
}
export function RailCart({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return <g transform={`translate(${x} ${y})`} data-cart={label}><rect x="-28" y="-23" width="56" height="28" rx="5" fill={color} /><circle cx="-17" cy="9" r="8" fill="#304b39" /><circle cx="17" cy="9" r="8" fill="#304b39" /><text x="0" y="-36" textAnchor="middle">{label}</text></g>;
}
export function Resistor({ x, y, label }: { x: number; y: number; label: string }) {
  return <g><rect x={x - 32} y={y - 11} width="64" height="22" fill="#decbaa" stroke="#6c7f61" strokeWidth="2" /><text x={x} y={y - 22} textAnchor="middle">{label}</text></g>;
}
