import { OpticsMobileViewNote } from "./OpticsMobileViewNote";

export type LawViewMode = "2d" | "3d";

export function LawDimensionSwitch({ mode, apparatus, onChange }: { mode: LawViewMode; apparatus: string; onChange: (mode: LawViewMode) => void }) {
  return <div className="law-dimension-switch"><div><span>MEASUREMENT VIEW / 观察方式</span><strong>{mode === "2d" ? "二维精确测量图" : "三维空间实验台"}</strong><small>{mode === "2d" ? "角度、法线和传播方向始终清晰可读" : "旋转场景，观察光线与器材的空间关系"}</small><OpticsMobileViewNote mode={mode} /></div><nav aria-label={`${apparatus}观察方式`}><button type="button" aria-pressed={mode === "2d"} className={mode === "2d" ? "active" : ""} onClick={() => onChange("2d")}><b>2D</b><span>测量光路</span></button><button type="button" aria-pressed={mode === "3d"} className={mode === "3d" ? "active" : ""} onClick={() => onChange("3d")}><b>3D</b><span>空间实验</span></button></nav></div>;
}

export function LawPresets({ label, options, activeValue, onSelect, activeTolerance = .06 }: { label: string; options: Array<{ label: string; value: number; note?: string }>; activeValue: number; onSelect: (value: number) => void; activeTolerance?: number }) {
  return <section className="law-presets" aria-label={label}><div><span>QUICK TRIALS / 快捷实验</span><strong>{label}</strong></div><nav>{options.map((option) => { const active = Math.abs(activeValue - option.value) < activeTolerance; return <button type="button" aria-pressed={active} className={active ? "active" : ""} onClick={() => onSelect(option.value)} title={option.note} key={`${option.label}-${option.value}`}><b>{option.label}</b>{option.note && <small>{option.note}</small>}</button>; })}</nav></section>;
}
