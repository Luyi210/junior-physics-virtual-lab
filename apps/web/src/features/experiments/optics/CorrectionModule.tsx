import { type LucideIcon, Glasses, Eye, Focus, CircuitBoard, ScanLine, Sparkles, ShieldCheck, Ruler } from "lucide-react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { publishApparatusSnapshot } from "../../assistant/tutorialBridge";
import { type LensViewMode, LensDimensionSwitch, LensSystem3DView, LensModuleGuide } from "./shared/LensControls";
import { ModuleIntro, MotionButton } from "./shared/OpticsControls";

type VisionCondition = "myopia" | "hyperopia";

type CorrectionLens = "none" | "convex" | "concave";

type VisionTechnologyKey = "smart-glasses" | "myopia-control" | "wavefront" | "xr-focus" | "correcting-display" | "retina-ai";

interface VisionTechnology {
  key: VisionTechnologyKey;
  code: string;
  title: string;
  english: string;
  status: string;
  icon: LucideIcon;
  summary: string;
  principle: string;
  application: string;
  physicsLink: string;
  steps: [string, string, string];
}

const visionTechnologies: VisionTechnology[] = [
  { key: "smart-glasses", code: "01", title: "智能变焦眼镜", english: "ADAPTIVE EYEWEAR", status: "产品化探索", icon: Glasses, summary: "传感器先判断注视距离，可调焦镜片再改变屈光力，让远近目标都尽量落在清晰焦平面。", principle: "距离感知 + 可调焦透镜", application: "老花辅助、远近快速切换、低视力增强", physicsLink: "改变焦距 f，使固定视网膜重新满足成像条件。", steps: ["识别注视目标", "计算所需屈光力", "驱动镜片改变焦距"] },
  { key: "myopia-control", code: "02", title: "近视管理镜片", english: "MYOPIA CONTROL", status: "临床应用", icon: Eye, summary: "镜片中心区域负责看清目标，周边特殊光学区域同时改变视网膜周边的离焦状态。", principle: "多区域光学 + 周边离焦", application: "儿童青少年近视管理与日常视力矫正", physicsLink: "同一镜片的不同区域可以形成不同会聚能力。", steps: ["中心光区矫正", "周边光区调制", "长期记录眼轴变化"] },
  { key: "wavefront", code: "03", title: "波前个性化矫正", english: "WAVEFRONT OPTICS", status: "临床成熟", icon: Focus, summary: "系统测量整只眼睛对光波造成的细微畸变，再生成更贴合个体眼球的矫正方案。", principle: "波前测量 + 高阶像差补偿", application: "个性化镜片、角膜激光与精密验光", physicsLink: "不仅修正焦点前后，还分析光波到达像面的相位误差。", steps: ["采集眼球波前", "分解像差类型", "生成个性化补偿"] },
  { key: "xr-focus", code: "04", title: "AR / VR 动态焦平面", english: "XR FOCAL SYSTEM", status: "前沿研发", icon: CircuitBoard, summary: "近眼显示需要协调双眼会聚与晶状体调焦，让虚拟物体的视觉深度和光学焦点尽量一致。", principle: "眼动追踪 + 光场 / 可变焦显示", application: "空间计算、沉浸教学与医疗训练", physicsLink: "屏幕虽在固定位置，出射光场却可以模拟不同物距。", steps: ["追踪双眼视线", "估计虚拟深度", "更新显示焦平面"] },
  { key: "correcting-display", code: "05", title: "裸眼矫正显示", english: "CORRECTING DISPLAY", status: "实验验证", icon: ScanLine, summary: "屏幕根据观看者的视力参数预先改变图像与出射光场，使光线经过有像差的眼睛后重新形成较清晰图像。", principle: "计算预补偿 + 光场显示", application: "车载屏幕、公共终端与无障碍显示", physicsLink: "不改变眼睛，而是反向设计进入眼睛之前的光。", steps: ["输入视力参数", "反算模糊过程", "输出预补偿光场"] },
  { key: "retina-ai", code: "06", title: "自适应光学与 AI", english: "RETINAL INTELLIGENCE", status: "科研转化", icon: Sparkles, summary: "可变形光学元件实时抵消眼球像差，获得更清晰的视网膜影像，再由 AI 辅助识别细微异常。", principle: "像差闭环校正 + 智能图像分析", application: "眼底精密成像、早期筛查与科研观察", physicsLink: "先测量光路误差，再用相反形变把畸变抵消。", steps: ["测量返回波前", "实时抵消像差", "分析视网膜细节"] }
];

function VisionTechnologyDiagram({ technology }: { technology: VisionTechnologyKey }) {
  const isRetina = technology === "retina-ai";
  return <div className={`vision-tech-diagram diagram-${technology}`} aria-hidden="true">
    <svg viewBox="0 0 520 280">
      <defs><linearGradient id="futureRay" x1="0" x2="1"><stop stopColor="#ffd878"/><stop offset=".52" stopColor="#7de5ff"/><stop offset="1" stopColor="#5ee4c1"/></linearGradient><radialGradient id="futureEye"><stop stopColor="#17475b"/><stop offset="1" stopColor="#071d2a"/></radialGradient></defs>
      <g className="future-grid">{[40,100,160,220,280,340,400,460].map((x) => <path d={`M${x} 18V262`} key={`x-${x}`}/>)}{[40,90,140,190,240].map((y) => <path d={`M18 ${y}H502`} key={`y-${y}`}/>)}</g>
      {!isRetina && <g className="future-eye"><path d="M371 45 C450 24 493 74 493 140 C493 206 450 256 371 235 C404 189 404 91 371 45Z"/><path className="future-eye-lens" d="M391 69 Q358 140 391 211 Q424 140 391 69Z"/><path className="future-retina" d="M465 64 Q500 140 465 216"/><circle cx="465" cy="140" r="5"/></g>}
      {technology === "smart-glasses" && <g><path className="future-device" d="M176 54 Q140 140 176 226 Q212 140 176 54Z"/><path className="future-sensor" d="M121 72H211V105H121Z"/><path className="future-signal" d="M166 105V54"/><path className="future-ray" d="M28 76H176L391 108L465 140"/><path className="future-ray" d="M28 204H176L391 172L465 140"/></g>}
      {technology === "myopia-control" && <g><path className="future-device zone" d="M174 48 Q137 140 174 232 Q211 140 174 48Z"/><circle className="future-zone" cx="174" cy="140" r="48"/><circle className="future-zone outer" cx="174" cy="140" r="70"/><path className="future-ray" d="M28 92L174 105L391 122L465 140"/><path className="future-ray secondary" d="M28 46L174 80L391 112L452 126"/><path className="future-ray secondary" d="M28 234L174 200L391 168L452 154"/></g>}
      {technology === "wavefront" && <g><path className="future-wave" d="M34 54Q70 76 106 54T178 54M34 103Q70 125 106 103T178 103M34 152Q70 174 106 152T178 152M34 201Q70 223 106 201T178 201"/><path className="future-device corrector" d="M210 42Q183 140 210 238Q237 140 210 42Z"/><path className="future-ray" d="M210 67L391 108L465 140M210 213L391 172L465 140M210 140H465"/></g>}
      {technology === "xr-focus" && <g><path className="future-screen" d="M50 42H78V238H50Z"/><path className="future-plane far" d="M238 58V222"/><path className="future-plane near" d="M304 78V202"/><path className="future-ray" d="M78 68L304 100L391 118L465 140M78 212L304 180L391 162L465 140"/><path className="future-ray secondary" d="M78 102L238 117L391 127L465 140M78 178L238 163L391 153L465 140"/></g>}
      {technology === "correcting-display" && <g><path className="future-screen pixels" d="M38 50H104V230H38Z"/>{[68,104,140,176,212].map((y) => <path className="future-pixel" d={`M49 ${y}H93`} key={y}/>)}<path className="future-ray" d="M104 68L391 108L465 140M104 212L391 172L465 140M104 140H465"/><path className="future-code" d="M138 78h44m-28 18h62m-79 18h39m-21 18h65"/></g>}
      {technology === "retina-ai" && <g><circle className="retina-scan-field" cx="288" cy="140" r="102"/><circle className="retina-scan-field inner" cx="288" cy="140" r="71"/><path className="retina-scan-line" d="M288 38A102 102 0 0 1 390 140L288 140Z"/>{[[237,103],[281,82],[331,111],[250,163],[306,151],[347,185],[286,207]].map(([x,y],i) => <g className="retina-cell" key={i}><circle cx={x} cy={y} r={i === 4 ? 8 : 5}/><path d={`M${x-11} ${y}H${x+11}M${x} ${y-11}V${y+11}`}/></g>)}<path className="future-ai-link" d="M390 140H454"/><path className="future-ai-core" d="M454 102h46v76h-46zM466 118h22v10h-22zM466 138h22v10h-22z"/></g>}
    </svg>
    <span>OPTICAL SIMULATION / 概念光路</span>
  </div>;
}

function VisionTechnologySection({ active, onSelect }: { active: VisionTechnologyKey; onSelect: (technology: VisionTechnologyKey) => void }) {
  const technology = visionTechnologies.find((item) => item.key === active)!;
  const TechnologyIcon = technology.icon;
  return <section className="vision-technology-section">
    <header className="vision-tech-heading"><div><span><CircuitBoard size={17}/>FUTURE VISION TECHNOLOGY / 未来视光科技</span><h2>同一个焦点问题，现代技术有六种解法</h2><p>镜片只是第一层。计算光学还可以改变波前、显示光场、眼球成像和诊断方式。</p></div><b>TECH EXTENSION · 06</b></header>
    <nav className="vision-tech-tabs" aria-label="选择未来视光技术">{visionTechnologies.map((item) => { const Icon = item.icon; return <button className={active === item.key ? "active" : ""} aria-pressed={active === item.key} onClick={() => onSelect(item.key)} key={item.key}><i><Icon size={18}/></i><span><small>{item.code} · {item.english}</small><strong>{item.title}</strong></span><b>{item.status}</b></button>; })}</nav>
    <div className={`vision-tech-stage technology-${technology.key}`}>
      <VisionTechnologyDiagram technology={technology.key}/>
      <article className="vision-tech-copy"><span className="vision-tech-status"><TechnologyIcon size={15}/>{technology.status}</span><small>{technology.code} / {technology.english}</small><h3>{technology.title}</h3><p>{technology.summary}</p><dl><div><dt>核心技术</dt><dd>{technology.principle}</dd></div><div><dt>现实应用</dt><dd>{technology.application}</dd></div><div><dt>物理连接</dt><dd>{technology.physicsLink}</dd></div></dl><ol>{technology.steps.map((step, index) => <li key={step}><b>{String(index + 1).padStart(2,"0")}</b><span>{step}</span></li>)}</ol></article>
    </div>
    <footer className="vision-tech-note"><ShieldCheck size={15}/><span><b>科学边界</b> 本区域用于光学原理科普；真实验光、近视管理或医疗矫正需要由专业机构完成。</span></footer>
  </section>;
}

function VisionCorrectionDiagram({ condition, lens, imageDistance, correct, tried }: { condition: VisionCondition; lens: CorrectionLens; imageDistance: number; correct: boolean; tried: boolean }) {
  const retinaX = 836;
  const eyeLensX = 548;
  const centerY = 238;
  const focusX = Math.max(690, Math.min(960, retinaX + (imageDistance - 17) * 28));
  const correctionShift = lens === "concave" ? -28 : lens === "convex" ? 28 : 0;
  const topAtEye = 137 + correctionShift;
  const bottomAtEye = centerY * 2 - topAtEye;
  const rayEndX = 980;
  const topEndY = centerY + (rayEndX - focusX) * (centerY - topAtEye) / Math.max(90, focusX - eyeLensX);
  const bottomEndY = centerY * 2 - topEndY;
  const focusLabel = correct ? "FOCUS LOCK" : focusX < retinaX ? "焦点位于视网膜前" : "焦点位于视网膜后";
  return <div className={`vision-optical-stage condition-${condition} lens-${lens} ${correct ? "is-correct" : ""}`}>
    <div className="vision-stage-hud"><span><ScanLine size={14} />LIVE RAY TRACE / 实时光路追踪</span><b>{lens === "none" ? "BASELINE" : lens === "concave" ? "DIVERGING LENS" : "CONVERGING LENS"}</b></div>
    <svg viewBox="0 0 1000 476" role="img" aria-label={`${condition === "myopia" ? "近视" : "远视"}眼模型，${lens === "none" ? "未佩戴镜片" : `佩戴${lens === "concave" ? "凹" : "凸"}透镜`}，${focusLabel}`}>
      <defs>
        <linearGradient id="visionEyeShell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#173e51"/><stop offset=".52" stopColor="#0b2736"/><stop offset="1" stopColor="#071d2a"/></linearGradient>
        <linearGradient id="visionLensGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#84e9ff" stopOpacity=".1"/><stop offset=".5" stopColor="#baf6ff" stopOpacity=".65"/><stop offset="1" stopColor="#55c8eb" stopOpacity=".12"/></linearGradient>
        <linearGradient id="visionRetina" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff9d75"/><stop offset="1" stopColor="#ef5f72"/></linearGradient>
        <filter id="visionFocusGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <marker id="visionRayArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 9 5 1 9Z" fill="context-stroke"/></marker>
      </defs>
      <g className="vision-axis-grid"><path d="M28 238H974"/><path d="M250 42V434M548 42V434M836 42V434"/><text x="29" y="455">DISTANT OBJECT</text><text x="218" y="455">CORRECTION</text><text x="516" y="455">EYE LENS</text><text x="803" y="455">RETINA</text></g>
      <g className="vision-source-rays"><path d={`M34 112 L250 112 L${eyeLensX} ${topAtEye} L${focusX} ${centerY} L${rayEndX} ${topEndY}`} markerEnd="url(#visionRayArrow)"/><path d={`M34 364 L250 364 L${eyeLensX} ${bottomAtEye} L${focusX} ${centerY} L${rayEndX} ${bottomEndY}`} markerEnd="url(#visionRayArrow)"/><path className="chief" d={`M34 ${centerY} H${rayEndX}`} markerEnd="url(#visionRayArrow)"/></g>
      <g className={`vision-correction-lens lens-${lens}`}>
        {lens === "convex" && <path d="M250 72 Q214 238 250 404 Q286 238 250 72Z"/>}
        {lens === "concave" && <path d="M230 72 Q267 238 230 404 L270 404 Q233 238 270 72Z"/>}
        {lens === "none" && <path className="empty" d="M250 91V385"/>}
        <text x="250" y="54" textAnchor="middle">{lens === "none" ? "NO LENS" : lens === "concave" ? "凹透镜 · 发散" : "凸透镜 · 会聚"}</text>
      </g>
      <g className="vision-eye-model">
        <path className="eye-shell" d="M500 74 C655 20 850 55 902 238 C850 421 655 456 500 402 C548 326 548 150 500 74Z"/>
        <path className="cornea" d="M516 103 Q464 238 516 373"/>
        <path className="crystalline" d="M548 104 Q506 238 548 372 Q590 238 548 104Z"/>
        <path className="retina-plane" d="M836 88 Q896 238 836 388"/>
        <circle className="optic-disc" cx="861" cy="315" r="9"/>
        <path className="optic-nerve" d="M865 315 C915 330 942 356 972 390"/>
      </g>
      <g className={`vision-focus-marker ${correct ? "locked" : ""}`} transform={`translate(${focusX} ${centerY})`}>
        <circle r="17"/><circle r="5"/><path d="M-27 0H27M0-27V27"/><text x="0" y="-38" textAnchor="middle">{focusLabel}</text>
      </g>
      <g className="vision-retina-label"><path d="M836 76H913"/><text x="918" y="80">RETINA 17.0 mm</text></g>
      <g className="vision-image-glyph" transform={`translate(${focusX + 14} ${centerY + 48})`}><path d="M0 30V0M-7 8 0 0 7 8"/><text x="14" y="22">倒立实像</text></g>
    </svg>
    <div className={`vision-focus-console ${correct ? "locked" : tried ? "warning" : "baseline"}`}><Focus size={20}/><span><small>FOCAL PLANE / 像面位置</small><strong>{imageDistance.toFixed(1)} mm</strong><em>{correct ? "与视网膜重合" : imageDistance < 17 ? `位于视网膜前 ${(17 - imageDistance).toFixed(1)} mm` : `位于视网膜后 ${(imageDistance - 17).toFixed(1)} mm`}</em></span><b>{correct ? "LOCKED" : tried ? "ADJUST" : "OBSERVE"}</b></div>
  </div>;
}

export function CorrectionModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [condition, setCondition] = useState<VisionCondition>("myopia");
  const [lens, setLens] = useState<CorrectionLens>("none");
  const [testedLenses, setTestedLenses] = useState<CorrectionLens[]>([]);
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("2d");
  const [technology, setTechnology] = useState<VisionTechnologyKey>("smart-glasses");
  const correct = (condition === "myopia" && lens === "concave") || (condition === "hyperopia" && lens === "convex");
  const tried = lens !== "none";
  const imageDistance = correct ? 17 : condition === "myopia" ? lens === "convex" ? 12.8 : 14.4 : lens === "concave" ? 22.2 : 20.4;
  const deviation = imageDistance - 17;
  const lensLabel = lens === "concave" ? "凹透镜" : lens === "convex" ? "凸透镜" : "未佩戴";
  const conditionLabel = condition === "myopia" ? "近视眼模型" : "远视眼模型";
  const changeCondition = (next: VisionCondition) => { setPlaying(false); setCondition(next); setLens("none"); setTestedLenses([]); recordHarness("configuration.changed", { experiment: "correction", control: "眼睛状态", value: next }); };
  const changeLens = (next: CorrectionLens) => { setPlaying(false); setLens(next); if (next !== "none") setTestedLenses((current) => Array.from(new Set([...current, next]))); recordHarness("configuration.changed", { experiment: "correction", control: "矫正镜片", value: next }); };
  useEffect(() => {
    publishApparatusSnapshot({
      module: "correction",
      capturedAt: new Date().toISOString(),
      origin: tried ? "learner" : "system",
      controls: [{ id: "condition", label: "眼睛状态", value: conditionLabel, source: "control" }, { id: "trial-lens", label: "试戴镜片", value: lensLabel, source: "control" }],
      apparatus: [{ id: "retina", label: "视网膜位置", value: 17, unit: "mm", source: "apparatus" }, { id: "comparison-count", label: "已比较镜片", value: testedLenses.length, unit: "/2", source: "apparatus" }],
      readings: [{ id: "image-plane", label: "简化像面", value: imageDistance, unit: "mm", source: "reading" }, { id: "retina-error", label: "像面偏差", value: deviation, unit: "mm", source: "reading" }],
      derived: [{ id: "correction-status", label: "矫正判断", value: correct ? "像面与视网膜重合" : tried ? "镜片尚未完成矫正" : "等待试戴镜片", source: "model" }],
      validity: { ready: correct, issues: correct ? [] : [tried ? "比较像点与视网膜的位置，再尝试另一种镜片。" : "先观察未矫正像点，再选择一块镜片试戴。"] }
    });
  }, [conditionLabel, correct, deviation, imageDistance, lensLabel, testedLenses.length, tried]);
  useEffect(() => {
    if (!playing) return;
    const sequence: CorrectionLens[] = ["none", "concave", "convex"];
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % sequence.length;
      const next = sequence[index]!;
      setLens(next);
      if (next !== "none") setTestedLenses((current) => Array.from(new Set([...current, next])));
      if (index === 0) { setCondition((value) => value === "myopia" ? "hyperopia" : "myopia"); setTestedLenses([]); }
    }, 1900);
    return () => window.clearInterval(timer);
  }, [playing]);
  const verdict = !tried ? "先定位未矫正像点" : correct ? "矫正光路已经锁定" : "当前镜片让偏差继续存在";
  const selectTechnology = (next: VisionTechnologyKey) => { setTechnology(next); recordHarness("configuration.changed", { experiment: "correction", control: "未来视光科技", value: next }); };
  return <div className="open-experience vision-correction-experience">
    <ModuleIntro eyebrow="VISION OPTICS CLINIC / 视光诊断台" title="追踪焦点，再为眼睛匹配矫正镜片" text="先把视网膜当作固定接收屏，观察未矫正像点落在哪一侧；随后试戴镜片，用焦点是否回到视网膜作为证据。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="自动扫描病例" />} />
    <section className="vision-case-selector" aria-label="选择眼睛状态">
      <header><span><Eye size={17}/>PATIENT MODEL / 选择眼睛模型</span><small>视网膜位置固定为 17.0 mm</small></header>
      <div>
        <button className={condition === "myopia" ? "active" : ""} aria-pressed={condition === "myopia"} onClick={() => changeCondition("myopia")}><i><Eye size={22}/></i><span><small>CASE 01 · MYOPIA</small><strong>近视眼模型</strong><em>未矫正焦点位于视网膜前</em></span><b>FOCUS −</b></button>
        <button className={condition === "hyperopia" ? "active" : ""} aria-pressed={condition === "hyperopia"} onClick={() => changeCondition("hyperopia")}><i><Eye size={22}/></i><span><small>CASE 02 · HYPEROPIA</small><strong>远视眼模型</strong><em>未矫正焦点位于视网膜后</em></span><b>FOCUS ＋</b></button>
      </div>
    </section>
    <div className="vision-mode-bar"><span><ScanLine size={15}/><b>OPTICAL VIEW</b><small>二维用于读焦点，三维用于观察空间光路</small></span><LensDimensionSwitch mode={viewMode} apparatus="correction" onChange={setViewMode} /></div>
    {viewMode === "3d" ? <div className="vision-3d-stage"><LensSystem3DView onUse2D={() => setViewMode("2d")} apparatus="correction" objectDistance={3000} focalLength={16.9} imageDistance={imageDistance} magnification={-.18} real nature={`${conditionLabel} · ${lensLabel}`} interacted={tried} screenDistance={17} correctionLens={lens} correctionEffective={correct} onInteract={() => undefined} /><div className={`vision-3d-readout ${correct ? "locked" : ""}`}><Focus size={18}/><span><small>3D FOCAL READOUT</small><strong>{imageDistance.toFixed(1)} mm</strong></span><b>{correct ? "视网膜锁定" : deviation < 0 ? "焦点偏前" : "焦点偏后"}</b></div></div> : <VisionCorrectionDiagram condition={condition} lens={lens} imageDistance={imageDistance} correct={correct} tried={tried} />}
    <section className="vision-prescription-console">
      <header><span><Glasses size={18}/><b>TRIAL LENS ARRAY / 试戴镜片组</b></span><small>先观察，再选择；模型不提供真实医学处方度数</small></header>
      <div>
        <button className={lens === "none" ? "active" : ""} aria-pressed={lens === "none"} onClick={() => changeLens("none")}><i className="vision-lens-glyph none"/><span><small>00 · BASELINE</small><strong>不戴镜片</strong><em>读取眼睛原始焦点</em></span></button>
        <button className={lens === "concave" ? "active" : testedLenses.includes("concave") ? "tested" : ""} aria-pressed={lens === "concave"} onClick={() => changeLens("concave")}><i className="vision-lens-glyph concave"/><span><small>01 · DIVERGING</small><strong>凹透镜</strong><em>先发散光线 · 焦点后移</em></span><b>{testedLenses.includes("concave") ? "已比较" : "待试戴"}</b></button>
        <button className={lens === "convex" ? "active" : testedLenses.includes("convex") ? "tested" : ""} aria-pressed={lens === "convex"} onClick={() => changeLens("convex")}><i className="vision-lens-glyph convex"/><span><small>02 · CONVERGING</small><strong>凸透镜</strong><em>先会聚光线 · 焦点前移</em></span><b>{testedLenses.includes("convex") ? "已比较" : "待试戴"}</b></button>
      </div>
    </section>
    <section className="vision-diagnostic-grid">
      <article><span><Eye size={15}/>眼睛状态</span><strong>{conditionLabel}</strong><small>{condition === "myopia" ? "原始焦点偏前" : "原始焦点偏后"}</small></article>
      <article><span><Glasses size={15}/>当前光学元件</span><strong>{lensLabel}</strong><small>{lens === "concave" ? "发散作用" : lens === "convex" ? "会聚作用" : "基准光路"}</small></article>
      <article className={Math.abs(deviation) < .1 ? "good" : "warn"}><span><Ruler size={15}/>像面偏差</span><strong>{deviation > 0 ? "+" : ""}{deviation.toFixed(1)} mm</strong><small>相对视网膜 17.0 mm</small></article>
      <article className={correct ? "good" : ""}><span><ShieldCheck size={15}/>证据进度</span><strong>{testedLenses.length}/2 镜片</strong><small>{testedLenses.length === 2 ? "已形成完整对照" : "继续完成试戴比较"}</small></article>
    </section>
    <section className={`vision-clinical-verdict ${correct ? "correct" : tried ? "warning" : "baseline"}`}><i>{correct ? <ShieldCheck size={26}/> : <Focus size={26}/>}</i><div><small>OPTICAL VERDICT / 光学判断</small><strong>{verdict}</strong><p>{!tried ? `当前${conditionLabel}的像点${condition === "myopia" ? "在视网膜前" : "在视网膜后"}，请选择镜片改变入眼光路。` : correct ? condition === "myopia" ? "凹透镜先使入眼光线发散，让眼内焦点后移并与视网膜重合。" : "凸透镜先使入眼光线会聚，让眼内焦点前移并与视网膜重合。" : `试戴${lensLabel}后像面位于 ${imageDistance.toFixed(1)} mm，仍未与 17.0 mm 的视网膜重合。`}</p></div><span><b>{correct ? "PASS" : tried ? "RETRY" : "STEP 01"}</b><em>{correct ? "光路证据成立" : tried ? "更换镜片" : "观察焦点"}</em></span></section>
    <VisionTechnologySection active={technology} onSelect={selectTechnology}/>
    <LensModuleGuide apparatus="correction" />
  </div>;
}
