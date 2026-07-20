import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Focus, Info, RotateCcw, Sparkles, Telescope } from "lucide-react";
import { ExperimentFullscreenButton } from "../../components/ExperimentFullscreenButton";
import { useHarnessStore } from "../harness/harnessStore";

type SpaceModel = "flat" | "black-hole";
type RayOutcome = "straight" | "escaped" | "grazing" | "captured";

const CENTER_X = 610;
const CENTER_Y = 260;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rayOutcome(model: SpaceModel, offset: number, mass: number): RayOutcome {
  if (model === "flat") return "straight";
  const horizon = 28 + mass * 2.2;
  const shadow = horizon * 1.95;
  const distance = Math.abs(offset);
  if (distance < horizon * 1.12) return "captured";
  if (distance < shadow * 1.08) return "grazing";
  return "escaped";
}

function rayPath(offset: number, mass: number, model: SpaceModel) {
  const y = CENTER_Y + offset;
  const outcome = rayOutcome(model, offset, mass);
  if (outcome === "straight") return `M38 ${y} L965 ${y}`;

  const horizon = 28 + mass * 2.2;
  const shadow = horizon * 1.95;
  const direction = offset < 0 ? 1 : -1;
  if (outcome === "captured") {
    return `M38 ${y} C330 ${y} 492 ${CENTER_Y + offset * .62} ${CENTER_X - horizon * .58} ${CENTER_Y + offset * .12}`;
  }
  if (outcome === "grazing") {
    const nearY = CENTER_Y - direction * shadow * .78;
    const exitY = y + direction * (112 + mass * 4.5);
    return `M38 ${y} C330 ${y} 468 ${y} 530 ${nearY} C590 ${CENTER_Y - direction * shadow * 1.16} 680 ${nearY} 735 ${CENTER_Y + direction * 16} C820 ${CENTER_Y + direction * 58} 900 ${exitY} 965 ${exitY}`;
  }

  const bend = direction * clamp((mass * 1550) / Math.pow(Math.abs(offset) + 28, 1.25), 11, 82);
  const nearY = y + bend * .58;
  const exitY = y + bend * 1.48;
  return `M38 ${y} C310 ${y} 446 ${y} 528 ${nearY} C690 ${nearY} 760 ${exitY} 965 ${exitY}`;
}

function outcomeCopy(outcome: RayOutcome) {
  if (outcome === "straight") return { eyebrow: "FLAT SPACE / 平直空间", title: "光线保持直线传播", note: "这就是初中实验里常用的近似条件。" };
  if (outcome === "captured") return { eyebrow: "CROSSES THE HORIZON / 跨过视界", title: "这束光被黑洞捕获", note: "光线跨过事件视界后无法再把信息传到远处观察者。" };
  if (outcome === "grazing") return { eyebrow: "STRONG LENSING / 强引力透镜", title: "光线在阴影边缘强烈绕行", note: "它接近光子环区域，远方观察者可能看到被放大的明亮环。" };
  return { eyebrow: "GRAVITATIONAL LENSING / 引力透镜", title: "光线偏折后继续逃逸", note: "它没有撞上透镜，而是在弯曲时空中改变了远方观察到的方向。" };
}

export function BlackHoleLightExtension() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [model, setModel] = useState<SpaceModel>("black-hole");
  const [mass, setMass] = useState(6);
  const [rayOffset, setRayOffset] = useState(-128);
  const horizon = 28 + mass * 2.2;
  const shadow = horizon * 1.95;
  const outcome = rayOutcome(model, rayOffset, mass);
  const copy = outcomeCopy(outcome);
  const selectedPath = useMemo(() => rayPath(rayOffset, mass, model), [mass, model, rayOffset]);
  const backgroundOffsets = [-184, -146, -104, -68, -28, 28, 68, 104, 146, 184];

  const changeModel = (next: SpaceModel) => {
    setModel(next);
    recordHarness("configuration.changed", { experiment: "black-hole", control: "时空模型", value: next === "flat" ? "平直空间" : "黑洞附近" });
  };
  const changeMass = (next: number) => {
    setMass(next);
    recordHarness("control.changed", { experiment: "black-hole", control: "黑洞质量等级", value: next, unit: "级" });
  };
  const changeOffset = (next: number, source = "滑杆") => {
    setRayOffset(next);
    recordHarness("control.changed", { experiment: "black-hole", control: "光线与黑洞中心的距离", value: Math.abs(next), unit: "格", source });
  };
  const updateRayFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = clamp(((event.clientY - bounds.top) / bounds.height) * 520 - CENTER_Y, -190, 190);
    setRayOffset(Math.round(next));
    return Math.round(next);
  };
  const reset = () => {
    setModel("black-hole");
    setMass(6);
    setRayOffset(-128);
    recordHarness("simulation.toggled", { experiment: "black-hole", running: false, action: "重置深空观测台" });
  };

  return <section className="black-hole-extension" aria-labelledby="black-hole-title">
    <header>
      <div><span>FROM JUNIOR OPTICS TO THE UNIVERSE / 物理走进科技</span><h2 id="black-hole-title">从“光沿直线传播”，<br />走到黑洞的边缘</h2></div>
      <div><Telescope size={26} /><p><strong>我们看见的不是黑洞本身。</strong>观测画面中的亮环来自周围发光物质以及被强引力弯曲的光；中央暗区是黑洞阴影。</p></div>
    </header>

    <div className={`black-hole-lab model-${model}`}>
      <div className="black-hole-toolbar">
        <span><b>DEEP SPACE OBSERVATORY</b><strong>深空光路观测台</strong></span>
        <nav aria-label="切换时空模型"><button className={model === "flat" ? "active" : ""} onClick={() => changeModel("flat")}>平直空间</button><button className={model === "black-hole" ? "active" : ""} onClick={() => changeModel("black-hole")}>黑洞附近</button></nav>
        <ExperimentFullscreenButton targetSelector=".black-hole-lab" experiment="black-hole" className="black-hole-fullscreen" label="全屏观测" hint="画面与控制台同步放大" />
      </div>

      <div className="black-hole-stage">
        <svg viewBox="0 0 1000 520" role="img" aria-label="可拖动光线比较平直空间与黑洞附近光路" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateRayFromPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateRayFromPointer(event); }} onPointerUp={(event) => { const next = updateRayFromPointer(event); event.currentTarget.releasePointerCapture(event.pointerId); changeOffset(next, "直接拖动光线"); }}>
          <defs>
            <radialGradient id="blackHoleGlow"><stop offset="0" stopColor="#020307" /><stop offset=".62" stopColor="#000" /><stop offset="1" stopColor="#15101d" /></radialGradient>
            <linearGradient id="accretionDisk" x1="0" x2="1"><stop stopColor="#a83465" stopOpacity=".15" /><stop offset=".2" stopColor="#ff8658" /><stop offset=".48" stopColor="#fff1b1" /><stop offset=".7" stopColor="#f46d47" /><stop offset="1" stopColor="#843153" stopOpacity=".18" /></linearGradient>
            <filter id="blackHoleDiskGlow"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="selectedRayGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <marker id="rayArrowBlackHole" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6 Z" fill="#7cebd4" /></marker>
          </defs>
          <g className="black-hole-stars">{Array.from({ length: 70 }, (_, index) => <circle cx={18 + (index * 137) % 970} cy={18 + (index * 79) % 484} r={index % 9 === 0 ? 1.7 : index % 4 === 0 ? 1.1 : .65} key={index} />)}</g>
          <g className="spacetime-grid">{Array.from({ length: 11 }, (_, index) => { const y = 28 + index * 46; return <path d={model === "flat" ? `M20 ${y} L980 ${y}` : `M20 ${y} C350 ${y} 460 ${CENTER_Y + (index - 5) * 25} 610 ${CENTER_Y + (index - 5) * 11} C760 ${CENTER_Y + (index - 5) * 25} 850 ${y} 980 ${y}`} key={`h-${index}`} />; })}{Array.from({ length: 13 }, (_, index) => { const x = 35 + index * 78; return <path d={model === "flat" ? `M${x} 18 L${x} 502` : `M${x} 18 C${x} 155 ${CENTER_X + (index - 7) * 29} 190 ${CENTER_X + (index - 7) * 17} ${CENTER_Y} C${CENTER_X + (index - 7) * 29} 335 ${x} 382 ${x} 502`} key={`v-${index}`} />; })}</g>
          <g className="background-gravity-rays">{backgroundOffsets.map((offset) => <path d={rayPath(offset, mass, model)} key={offset} />)}</g>
          <g className="black-hole-system">
            <ellipse className="disk-halo" cx={CENTER_X} cy={CENTER_Y} rx={shadow * 2.85} ry={shadow * .65} />
            <ellipse className="accretion-disk back" cx={CENTER_X} cy={CENTER_Y} rx={shadow * 2.45} ry={shadow * .49} />
            <circle className="photon-ring" cx={CENTER_X} cy={CENTER_Y} r={shadow} />
            <circle className="event-horizon" cx={CENTER_X} cy={CENTER_Y} r={horizon} />
            <path className="accretion-front" d={`M${CENTER_X - shadow * 2.3} ${CENTER_Y} C${CENTER_X - shadow} ${CENTER_Y + shadow * .68} ${CENTER_X + shadow} ${CENTER_Y + shadow * .68} ${CENTER_X + shadow * 2.3} ${CENTER_Y}`} />
            <text className="horizon-label" x={CENTER_X + shadow + 13} y={CENTER_Y - 22}>黑洞阴影</text>
            <text className="horizon-label minor" x={CENTER_X + horizon + 10} y={CENTER_Y + 9}>事件视界</text>
          </g>
          <path className={`selected-gravity-ray outcome-${outcome}`} d={selectedPath} markerEnd={outcome === "captured" ? undefined : "url(#rayArrowBlackHole)"} />
          <g className="ray-drag-handle" transform={`translate(54 ${CENTER_Y + rayOffset})`}><circle r="13" /><path d="M-4 -4 L0 -8 L4 -4 M-4 4 L0 8 L4 4" /><text x="21" y="5">拖动这束光</text></g>
          <g className="observer-station" transform="translate(930 260)"><path d="M0 -28 L12 0 L0 28 L-12 0 Z" /><circle r="7" /><text x="-30" y="49">远方观察者</text></g>
          <text className="space-model-label" x="34" y="41">{model === "flat" ? "参照组：忽略强引力" : `弯曲时空：质量等级 ${mass}`}</text>
        </svg>
        <div className={`black-hole-readout outcome-${outcome}`}><span>{copy.eyebrow}</span><strong>{copy.title}</strong><p>{copy.note}</p></div>
        <div className="black-hole-legend"><span><i className="legend-selected" />可拖动光线</span><span><i className="legend-rays" />背景光线</span><span><i className="legend-horizon" />事件视界</span></div>
      </div>

      <div className="black-hole-controls">
        <label><span><b>黑洞质量等级</b><output>{mass} 级</output></span><input type="range" min="1" max="10" step="1" value={mass} onChange={(event) => changeMass(Number(event.target.value))} disabled={model === "flat"} /><small>数值越大，模型中的时空弯曲越强</small></label>
        <label><span><b>光线离中心的距离</b><output>{Math.abs(rayOffset)} 格</output></span><input type="range" min="-190" max="190" step="2" value={rayOffset} onChange={(event) => changeOffset(Number(event.target.value))} /><small>也可以直接在上方拖动发光点</small></label>
        <div className="black-hole-control-actions"><button onClick={() => changeOffset(outcome === "captured" ? -150 : -18)}><Focus size={17} />{outcome === "captured" ? "让光逃逸" : "对准视界"}</button><button onClick={reset}><RotateCcw size={17} />重置观测</button></div>
      </div>

    </div>

    <div className="black-hole-learning-chain">
      <article><b>01</b><span><strong>初中条件没有错</strong><p>在同种均匀介质、弱引力环境中，把空间近似看成平直，光沿直线传播。</p></span></article>
      <article><b>02</b><span><strong>黑洞改变了“空间”</strong><p>黑洞附近时空强烈弯曲，光沿时空中尽可能直的路线前进，远看却是曲线。</p></span></article>
      <article><b>03</b><span><strong>黑洞阴影不是普通影子</strong><p>日食是遮挡直线光；黑洞阴影同时涉及光被捕获和强引力透镜，所以外缘会出现亮环。</p></span></article>
    </div>
    <aside><Sparkles size={20} /><p><b>一句话连接本页：</b>日食、月食展示平直空间中的遮挡；黑洞则把“光走直线”推广为“光沿弯曲时空中最直的路径前进”。</p></aside>
    <footer><Info size={16} /><span>定性教学模型 · 图形与数值不按天文实际比例</span><a href="https://science.nasa.gov/universe/black-holes/anatomy/" target="_blank" rel="noreferrer">NASA · Anatomy of a Black Hole</a><a href="https://science.nasa.gov/universe/stories/quick-reads/how-gravity-warps-light/" target="_blank" rel="noreferrer">NASA · How Gravity Warps Light</a></footer>
  </section>;
}
