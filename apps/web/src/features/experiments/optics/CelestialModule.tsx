import { useHarnessStore } from "../../assistant/harnessStore";
import { useState } from "react";
import { BlackHoleLightExtension } from "./components/BlackHoleLightExtension";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

type CelestialMode = "solar" | "lunar" | "transit";

type CelestialView = "perspective" | "side" | "top";

export function CelestialModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mode, setMode] = useState<CelestialMode>("solar");
  const [offset, setOffset] = useState(62);
  const [view, setView] = useState<CelestialView>("perspective");
  const [interacted, setInteracted] = useState(false);
  const blockerRadius = mode === "lunar" ? 58 : mode === "solar" ? 34 : 14;
  const targetRadius = mode === "solar" ? 61 : mode === "lunar" ? 32 : 55;
  const blockerX = mode === "transit" ? 545 : 470;
  const targetX = 850;
  const centerY = 258;
  const perspectiveFactor = view === "perspective" ? .58 : view === "top" ? .82 : 1;
  const blockerY = centerY + offset * perspectiveFactor;
  const alignment = Math.abs(offset);
  const status = alignment < 16 ? mode === "solar" ? "地球上出现日全食带（示意）" : mode === "lunar" ? "月全食条件（示意）" : "行星凌日进行中" : alignment < 52 ? mode === "solar" ? "地球上部分地区可见日偏食" : mode === "lunar" ? "月偏食条件（示意）" : "行星擦过日面" : "三个天体未形成有效遮挡";
  const blockerName = mode === "lunar" ? "地球" : mode === "solar" ? "月球" : "内行星";
  const targetName = mode === "solar" ? "地球" : mode === "lunar" ? "月球" : "地球观测端";
  const changeMode = (next: CelestialMode) => { setMode(next); setOffset(62); setInteracted(false); recordHarness("configuration.changed", { control: "天体现象", value: next }); };
  const changeView = (next: CelestialView) => { setView(next); recordHarness("view.changed", { experiment: "celestial", view: next }); };

  return <div className="open-experience">
    <ModuleIntro eyebrow="生活·物理·社会 / 日食和月食" title="沿着太阳光，搭建一次三维天体遮挡" text="每一束太阳光在均匀介质中沿直线传播；但太阳具有一定大小，从太阳表面不同位置出发的边界光线方向略有不同，因此遮挡天体后方会形成本影和半影。图中距离与大小均为示意。" />
    <div className="medium-tabs celestial-tabs"><button className={mode === "solar" ? "active" : ""} onClick={() => changeMode("solar")}>日食</button><button className={mode === "lunar" ? "active" : ""} onClick={() => changeMode("lunar")}>月食</button><button className={mode === "transit" ? "active" : ""} onClick={() => changeMode("transit")}>水星/金星凌日</button></div>
    <div className={`celestial-lab celestial-space-view view-${view}`}>
      <div className="celestial-view-toolbar"><span><b>3D VIEW</b>切换观察方向</span><div><button className={view === "perspective" ? "active" : ""} onClick={() => changeView("perspective")}>空间透视</button><button className={view === "side" ? "active" : ""} onClick={() => changeView("side")}>光路侧视</button><button className={view === "top" ? "active" : ""} onClick={() => changeView("top")}>轨道俯视</button></div></div>
      <CelestialSpaceDiagram mode={mode} view={view} offset={offset} interacted={interacted} blockerX={blockerX} blockerY={blockerY} blockerRadius={blockerRadius} blockerName={blockerName} targetX={targetX} targetRadius={targetRadius} targetName={targetName} centerY={centerY} alignment={alignment} />
      <div className="celestial-light-legend"><span><i className="legend-ray" />代表性直线光</span><span><i className="legend-penumbra" />半影空间</span><span><i className="legend-umbra" />本影空间</span></div>
      {!interacted && <OpticsInteractionCue text="移动中间天体，让它逐渐进入太阳与目标天体的连线附近" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "SHADOW GEOMETRY" : "STRAIGHT LIGHT PATH READY"}</span><strong>{interacted ? status : "先沿着代表光线观察传播方向"}</strong><small>{interacted ? "在几何光学尺度下，边界光线被遮挡后划分出本影与半影" : "再移动中间天体，观察哪些直线光被截断"}</small></div>
    </div>
    <div className="open-control-deck celestial-controls"><RangeControl label="中间天体偏离光轴" value={offset} min={-110} max={110} step={2} unit="格" onChange={setOffset} onInteract={() => setInteracted(true)} /><div className="index-comparison"><span>当前空间顺序</span><strong>太阳 → {blockerName} → {targetName}</strong><p>遮挡天体进入太阳和目标天体之间，才可能形成对应天象。</p></div><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>对应基础规律 · 光的直线传播</span><strong>{interacted ? status : "移动中间天体开始实验"}</strong><p>保持太阳和目标天体不动，只改变中间天体的位置，观察阴影落点。</p></div></div>
    <section className="celestial-principle-strip"><article><b>01</b><span><strong>为什么要画多束直线光？</strong><p>太阳不是点光源。每一束光都沿直线传播，但太阳表面不同位置发出的边界光线方向并不完全相同。</p></span></article><article><b>02</b><span><strong>本影和半影从哪里来？</strong><p>太阳各处的直射光全部被挡住的区域是本影；只有部分太阳表面发出的光被挡住的区域是半影。</p></span></article><article><b>03</b><span><strong>日食和月食差在哪里？</strong><p>日食由月球挡住到达地球的太阳光；月食由地球挡住原本能够到达月球的太阳光。</p></span></article></section>
    <BlackHoleLightExtension />
  </div>;
}

function CelestialSpaceDiagram({ mode, view, offset, interacted, blockerX, blockerY, blockerRadius, blockerName, targetX, targetRadius, targetName, centerY, alignment }: { mode: CelestialMode; view: CelestialView; offset: number; interacted: boolean; blockerX: number; blockerY: number; blockerRadius: number; blockerName: string; targetX: number; targetRadius: number; targetName: string; centerY: number; alignment: number }) {
  return <svg viewBox="0 0 1000 520" aria-label="具有空间透视感的日食月食和直线光路动态实验">
    <defs>
      <radialGradient id="sunGlow3d" cx="35%" cy="30%"><stop offset="0" stopColor="#fffbd0" /><stop offset=".48" stopColor="#ffd55f" /><stop offset=".8" stopColor="#f3993f" /><stop offset="1" stopColor="#b8442f" /></radialGradient>
      <radialGradient id="earthGlow3d" cx="30%" cy="25%"><stop offset="0" stopColor="#9ee8ff" /><stop offset=".42" stopColor="#438fc0" /><stop offset=".72" stopColor="#245879" /><stop offset="1" stopColor="#071a2a" /></radialGradient>
      <radialGradient id="moonGlow3d" cx="30%" cy="25%"><stop offset="0" stopColor="#e5e2d6" /><stop offset=".55" stopColor="#979b9d" /><stop offset="1" stopColor="#282d33" /></radialGradient>
      <radialGradient id="planetGlow3d" cx="30%" cy="25%"><stop offset="0" stopColor="#d7aa79" /><stop offset=".6" stopColor="#8c674b" /><stop offset="1" stopColor="#30231d" /></radialGradient>
      <linearGradient id="penumbra3d" x1="0" x2="1"><stop stopColor="#8b668e" stopOpacity=".13" /><stop offset="1" stopColor="#8b668e" stopOpacity=".32" /></linearGradient>
      <linearGradient id="umbra3d" x1="0" x2="1"><stop stopColor="#05090e" stopOpacity=".5" /><stop offset="1" stopColor="#020407" stopOpacity=".88" /></linearGradient>
      <marker id="sunRayArrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0 0 L8 3 L0 6 Z" fill="#ffe69a" /></marker>
      <filter id="celestialSphereShadow"><feDropShadow dx="12" dy="13" stdDeviation="8" floodColor="#000" floodOpacity=".58" /></filter>
    </defs>
    <g className="space-stars">{Array.from({ length: 44 }, (_, index) => <circle cx={25 + (index * 149) % 950} cy={34 + (index * 83) % 440} r={index % 4 === 0 ? 1.8 : .9} key={index} />)}</g>
    <g className="celestial-depth-grid"><path d="M220 405 L945 405 L820 500 L70 500 Z" />{Array.from({ length: 8 }, (_, index) => <line x1={180 + index * 93} y1="405" x2={40 + index * 115} y2="500" key={`depth-v-${index}`} />)}{Array.from({ length: 4 }, (_, index) => <line x1={180 - index * 31} y1={425 + index * 22} x2={920 + index * 7} y2={425 + index * 22} key={`depth-h-${index}`} />)}</g>
    <g className="celestial-orbits"><ellipse cx={targetX} cy={centerY} rx="118" ry={view === "top" ? 72 : 34} /><ellipse cx={blockerX} cy={centerY} rx="92" ry={view === "top" ? 58 : 26} /></g>
    <g className="sun-straight-rays">{Array.from({ length: 7 }, (_, index) => { const y = 140 + index * 39; return <line x1="170" y1={y} x2="965" y2={y} markerEnd="url(#sunRayArrow)" style={{ animationDelay: `${index * -.16}s` }} key={index} />; })}<text x="215" y="108">中央代表光近似平行 · 本影半影由太阳边缘光线确定</text></g>
    <g className="shadow-volume">
      <path className="penumbra-volume" d={`M${blockerX} ${blockerY - blockerRadius} L975 ${blockerY - blockerRadius - 88} L975 ${blockerY + blockerRadius + 88} L${blockerX} ${blockerY + blockerRadius} Z`} />
      <path className="umbra-volume" d={`M${blockerX} ${blockerY - blockerRadius} L930 ${blockerY - 12} L930 ${blockerY + 12} L${blockerX} ${blockerY + blockerRadius} Z`} />
      <path className="shadow-boundary upper" d={`M160 ${centerY - 76} L${blockerX} ${blockerY + blockerRadius} L975 ${blockerY + blockerRadius + 88}`} />
      <path className="shadow-boundary lower" d={`M160 ${centerY + 76} L${blockerX} ${blockerY - blockerRadius} L975 ${blockerY - blockerRadius - 88}`} />
      <text className="penumbra-label" x={blockerX + 165} y={blockerY - blockerRadius - 37}>半影：部分太阳光被挡住</text>
      <text className="umbra-label" x={blockerX + 165} y={blockerY + 5}>本影：直射太阳光完全被挡住</text>
    </g>
    <g className="celestial-sun-3d"><circle cx="105" cy={centerY} r="81" fill="url(#sunGlow3d)" /><circle className="sun-corona" cx="105" cy={centerY} r="94" /><text x="71" y={centerY + 118}>太阳 · 光源</text></g>
    <g className={`celestial-body-3d blocker ${mode}`} filter="url(#celestialSphereShadow)"><circle cx={blockerX} cy={blockerY} r={blockerRadius} fill={mode === "lunar" ? "url(#earthGlow3d)" : mode === "solar" ? "url(#moonGlow3d)" : "url(#planetGlow3d)"} /><ellipse cx={blockerX - blockerRadius * .23} cy={blockerY - blockerRadius * .29} rx={blockerRadius * .2} ry={blockerRadius * .12} /><text x={blockerX - 34} y={blockerY + blockerRadius + 31}>{blockerName} · 遮挡者</text></g>
    <g className={`celestial-body-3d target ${mode}`} filter="url(#celestialSphereShadow)"><circle cx={targetX} cy={centerY} r={targetRadius} fill={mode === "solar" || mode === "transit" ? "url(#earthGlow3d)" : "url(#moonGlow3d)"} /><ellipse cx={targetX - targetRadius * .2} cy={centerY - targetRadius * .25} rx={targetRadius * .21} ry={targetRadius * .12} /><text x={targetX - 43} y={centerY + targetRadius + 32}>{targetName} · 接收端</text></g>
    {interacted && mode === "lunar" && <circle className="shadow-impact lunar-impact" cx={targetX} cy={centerY} r={targetRadius - 2} style={{ opacity: alignment < 16 ? .8 : alignment < 52 ? .42 : .08 }} />}
    {interacted && mode === "solar" && <circle className="shadow-impact solar-impact" cx={targetX - 48} cy={centerY + offset * .23} r={alignment < 16 ? 13 : alignment < 52 ? 8 : 3} style={{ opacity: alignment < 52 ? .88 : .18 }} />}
    {interacted && mode === "transit" && <circle className="shadow-impact transit-impact" cx={targetX - 35} cy={centerY + offset * .22} r="7" style={{ opacity: alignment < 52 ? .9 : .18 }} />}
    <line className="celestial-axis" x1="24" y1={centerY} x2="975" y2={centerY} />
  </svg>;
}
