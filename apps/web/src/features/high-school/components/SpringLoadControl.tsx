import { Minus, Plus, RotateCcw } from 'lucide-react';
import { formatMeasurement } from '../experiments/workbench';
import './SpringLoadControl.css';

const loads = [0, 50, 100, 150, 200, 250];

export function SpringLoadControl({ massGrams, onChange }: { massGrams: number; onChange: (value: number) => void }) {
  return <section className="hs-spring-load" aria-label="弹簧加载台">
    <div className="hs-spring-load-heading"><div><span className="hs-kicker">加载台</span><h3>先卸载，再逐级加码。</h3></div><output aria-label="当前悬挂总质量">{formatMeasurement(massGrams)}<small> g</small></output></div>
    <p>固定同一弹簧，先记录原长，再比较至少三种载荷。每次调整后，点击“记录这组读数”保留证据。</p>
    <div className="hs-spring-load-presets" role="group" aria-label="选择悬挂总质量">{loads.map((load) => <button key={load} type="button" aria-pressed={massGrams === load} onClick={() => onChange(load)}>{load === 0 ? '卸载 · 0 g' : `${load} g`}</button>)}</div>
    <div className="hs-spring-load-steps"><button type="button" disabled={massGrams <= 0} onClick={() => onChange(Math.max(0, massGrams - 10))}><Minus size={14} aria-hidden="true" />减 10 g</button><button type="button" disabled={massGrams >= 250} onClick={() => onChange(Math.min(250, massGrams + 10))}><Plus size={14} aria-hidden="true" />加 10 g</button><button type="button" disabled={massGrams === 0} onClick={() => onChange(0)}><RotateCcw size={14} aria-hidden="true" />全部卸载</button></div>
    <p className="hs-spring-load-note">质量包含托盘；0 g 表示没有悬挂物。这里立即显示理想静态平衡，不演示振荡，也不自动记录。</p>
  </section>;
}
