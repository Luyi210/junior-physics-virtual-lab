import { useHarnessStore } from "../../../assistant/harnessStore";
import { Pause, WandSparkles, Play, Focus } from "lucide-react";

type PhysicsMotifKind = "dispersion" | "propagation" | "reflection" | "refraction" | "color" | "celestial" | "spectrum" | "mirror" | "lens" | "camera" | "eye" | "instrument";

function resolvePhysicsMotif(eyebrow: string, title: string): PhysicsMotifKind {
  const copy = `${eyebrow} ${title}`;
  if (copy.includes("色散") || copy.includes("三棱镜")) return "dispersion";
  if (copy.includes("色光") || copy.includes("RGB")) return "color";
  if (copy.includes("日食") || copy.includes("月食") || copy.includes("天体")) return "celestial";
  if (copy.includes("红外") || copy.includes("紫外")) return "spectrum";
  if (copy.includes("直线传播") || copy.includes("小孔")) return "propagation";
  if (copy.includes("折射")) return "refraction";
  if (copy.includes("反射") || copy.includes("平面镜") || copy.includes("曲面镜") || copy.includes("凹面镜")) return copy.includes("平面镜") || copy.includes("曲面镜") || copy.includes("凹面镜") ? "mirror" : "reflection";
  if (copy.includes("CAMERA") || copy.includes("照相机")) return "camera";
  if (copy.includes("EYE") || copy.includes("VISION") || copy.includes("眼睛") || copy.includes("视力")) return "eye";
  if (copy.includes("TWO-LENS") || copy.includes("组合") || copy.includes("望远镜") || copy.includes("显微镜")) return "instrument";
  return "lens";
}

function PhysicsHeaderMotif({ kind }: { kind: PhysicsMotifKind }) {
  return <div className={`physics-header-motif motif-${kind}`} aria-hidden="true"><svg viewBox="0 0 360 140">
    <defs>
      <linearGradient id={`motif-spectrum-${kind}`} x1="0" x2="1"><stop stopColor="#ef655f" /><stop offset=".2" stopColor="#f2bd5f" /><stop offset=".4" stopColor="#68d78a" /><stop offset=".62" stopColor="#56c8df" /><stop offset=".82" stopColor="#647ee8" /><stop offset="1" stopColor="#a46add" /></linearGradient>
      <linearGradient id={`motif-glass-${kind}`} x1="0" x2="1"><stop stopColor="#88f0dc" stopOpacity=".08" /><stop offset=".5" stopColor="#67d8df" stopOpacity=".5" /><stop offset="1" stopColor="#88f0dc" stopOpacity=".08" /></linearGradient>
    </defs>
    <g className="motif-grid">{[20, 60, 100, 140, 180, 220, 260, 300, 340].map((x) => <line x1={x} x2={x} y1="8" y2="132" key={`gx-${x}`} />)}{[20, 50, 80, 110].map((y) => <line x1="8" x2="352" y1={y} y2={y} key={`gy-${y}`} />)}</g>
    {kind === "dispersion" && <g><path className="motif-glass" d="M170 24 L222 112 L118 112 Z" /><path className="motif-ray white" d="M12 62 L151 62" /><path className="motif-ray red" d="M190 72 L344 27" /><path className="motif-ray amber" d="M190 75 L344 48" /><path className="motif-ray green" d="M190 78 L344 70" /><path className="motif-ray cyan" d="M190 80 L344 91" /><path className="motif-ray violet" d="M190 82 L344 116" /><text x="116" y="128">PRISM / 光谱</text></g>}
    {kind === "propagation" && <g><path className="motif-object" d="M35 108 V45 L27 58 M35 45 L43 58" /><rect className="motif-screen" x="168" y="15" width="9" height="110" /><circle className="motif-hole" cx="172.5" cy="70" r="4" /><path className="motif-ray amber" d="M35 45 L172 70 L322 108" /><path className="motif-ray cyan" d="M35 108 L172 70 L322 44" /><path className="motif-object image" d="M322 44 V108 L314 95 M322 108 L330 95" /><text x="183" y="27">PINHOLE</text></g>}
    {kind === "reflection" && <g><path className="motif-mirror" d="M68 113 L300 113" /><path className="motif-normal" d="M184 15 V125" /><path className="motif-ray amber" d="M60 24 L184 113" /><path className="motif-ray cyan" d="M184 113 L309 24" /><path className="motif-angle" d="M158 94 A38 38 0 0 1 184 76 M184 76 A38 38 0 0 1 211 94" /><text x="145" y="68">i</text><text x="211" y="68">r</text></g>}
    {kind === "refraction" && <g><path className="motif-water" d="M8 75 H352 V132 H8 Z" /><path className="motif-interface" d="M8 75 H352" /><path className="motif-normal" d="M185 11 V130" /><path className="motif-ray amber" d="M82 15 L185 75" /><path className="motif-ray cyan" d="M185 75 L241 132" /><text x="20" y="66">n₁</text><text x="20" y="95">n₂</text></g>}
    {kind === "color" && <g><circle className="motif-color red-fill" cx="150" cy="60" r="48" /><circle className="motif-color green-fill" cx="210" cy="60" r="48" /><circle className="motif-color blue-fill" cx="180" cy="96" r="48" /><text className="motif-rgb-label" x="67" y="75">R</text><text className="motif-rgb-label" x="280" y="75">G</text><text className="motif-rgb-label" x="176" y="132">B</text></g>}
    {kind === "celestial" && <g><circle className="motif-sun" cx="52" cy="70" r="29" /><circle className="motif-earth" cx="205" cy="70" r="22" /><circle className="motif-moon" cx="292" cy="70" r="11" /><path className="motif-shadow" d="M205 48 L350 62 L350 78 L205 92 Z" /><path className="motif-ray amber" d="M82 41 L350 41 M82 99 L350 99" /><text x="180" y="124">UMBRA / 本影</text></g>}
    {kind === "spectrum" && <g><rect className="motif-spectrum-bar" x="24" y="55" width="312" height="29" rx="3" fill={`url(#motif-spectrum-${kind})`} /><path className="motif-wave" d="M25 101 Q45 78 65 101 T105 101 T145 101 T185 101 T225 101 T265 101 T305 101 T345 101" /><text x="22" y="43">IR</text><text x="169" y="43">VISIBLE</text><text x="316" y="43">UV</text></g>}
    {kind === "mirror" && <g><path className="motif-object" d="M72 112 V40 L62 56 M72 40 L82 56" /><path className="motif-mirror vertical" d="M180 14 V126" /><path className="motif-object virtual" d="M288 112 V40 L278 56 M288 40 L298 56" /><path className="motif-ray amber" d="M72 40 L180 63 L326 22" /><path className="motif-ray cyan" d="M180 63 L115 22" /><path className="motif-ray virtual" d="M180 63 L288 40" /><text x="150" y="134">d = d′</text></g>}
    {(kind === "lens" || kind === "camera" || kind === "eye" || kind === "instrument") && <g><path className="motif-axis" d="M12 76 H348" /><path className="motif-lens" fill={`url(#motif-glass-${kind})`} d="M180 17 C145 42 145 110 180 127 C215 110 215 42 180 17 Z" /><circle className="motif-focus" cx="116" cy="76" r="4" /><circle className="motif-focus" cx="244" cy="76" r="4" /><path className="motif-ray amber" d="M42 40 L180 40 L291 107" /><path className="motif-ray cyan" d="M42 40 L180 76 L292 108" />{kind === "camera" && <path className="motif-device" d="M285 35 H342 V116 H285 Z M305 35 L313 22 H331 L339 35" />}{kind === "eye" && <path className="motif-eye" d="M269 76 Q304 30 344 76 Q304 122 269 76 Z" />}{kind === "instrument" && <><path className="motif-lens second" d="M278 33 C261 48 261 101 278 116 C295 101 295 48 278 33 Z" /><text x="204" y="128">fₒ / fₑ</text></>}<text x="15" y="129">1/f = 1/u + 1/v</text></g>}
  </svg></div>;
}

export function ModuleIntro({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <header className="open-module-intro"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div><PhysicsHeaderMotif kind={resolvePhysicsMotif(eyebrow, title)} />{action}</header>;
}

export function MotionButton({ running, onClick, label, auto = false, onInteract }: { running: boolean; onClick: () => void; label: string; auto?: boolean; onInteract?: () => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const toggle = () => { onClick(); onInteract?.(); recordHarness("simulation.toggled", { running: !running, action: label }); };
  return <button className={`motion-button ${running ? "running" : ""}`} onClick={toggle}>{running ? <Pause size={15} /> : auto ? <WandSparkles size={15} /> : <Play size={15} />}{running ? "暂停动态" : label}</button>;
}

export function RangeControl({ label, value, min, max, step, unit, onChange, onInteract, tutorialTarget, highlighted = false, formatValue }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; onInteract?: () => void; tutorialTarget?: string; highlighted?: boolean; formatValue?: (value: number) => string }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const change = (next: number) => { onChange(next); onInteract?.(); recordHarness("control.changed", { control: label, value: next, unit }); };
  const digits = step < .1 ? 2 : step < 1 ? 1 : 0;
  const format = formatValue ?? ((number: number) => number.toFixed(digits));
  return <label className={`open-range ${highlighted ? "tutorial-target-active" : ""}`} data-tutorial-target={tutorialTarget} data-tutorial-spotlight={tutorialTarget}><span><b>{label}</b><output aria-live="polite">{format(value)} {unit}</output></span><input type="range" aria-label={label} aria-valuetext={`${format(value)} ${unit}`} value={value} min={min} max={max} step={step} onChange={(event) => change(Number(event.target.value))} /><small className="open-range-scale" aria-hidden="true"><span>{format(min)} {unit}</span><b>← 方向键可微调 →</b><span>{format(max)} {unit}</span></small></label>;
}

export function OpticsInteractionCue({ text }: { text: string }) {
  return <div className="interaction-cue optics-cue"><Focus size={18} /><span><small>光学装置等待操作</small><strong>{text}</strong></span></div>;
}
