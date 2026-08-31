import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { calculateLens, calculateTriangularPrismRayPath } from "@physics-lab/physics";
import type { LabTrial, TaskId } from "./researchModel";

interface LabProps {
  trials: LabTrial[];
  onRecord: (trial: Omit<LabTrial, "id" | "createdAt">) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function svgPoint(event: ReactPointerEvent<SVGSVGElement>, width: number, height: number) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) / bounds.width * width,
    y: (event.clientY - bounds.top) / bounds.height * height
  };
}

function TrialStrip({ trials }: { trials: LabTrial[] }) {
  return (
    <section className="evidence-film" aria-label="已记录的实验数据">
      <header><span>EVIDENCE FILM / 证据胶片</span><b>{String(trials.length).padStart(2, "0")} FRAME</b></header>
      <div className="trial-strip">
        {trials.length === 0 ? <p><i>＋</i>拖动装置形成对照，再把关键状态保存为证据帧</p> : trials.map((trial, index) => (
          <article key={trial.id}><span>R{String(index + 1).padStart(2, "0")}</span><p>{trial.summary}</p><i>●</i></article>
        ))}
      </div>
    </section>
  );
}

function RecordButton({ onClick }: { onClick: () => void }) {
  return <button className="record-button" onClick={onClick}><span>◉</span><b>捕获当前证据帧</b><i>CAPTURE</i></button>;
}

function LabFrame({ children, trials, title, mission, status }: { children: React.ReactNode; trials: LabTrial[]; title: string; mission: string; status: string }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await shellRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }
  return <div className="lab-shell immersive-lab" ref={shellRef}>
    <header className="lab-command-bar">
      <div><i className="live-pulse"/><span>LIVE OPTICAL ENGINE</span><strong>{title}</strong></div>
      <div className="mission-chip"><span>本轮挑战</span><b>{mission}</b></div>
      <div className="lab-command-actions"><span>{status}</span><button onClick={toggleFullscreen}>{isFullscreen ? "退出全屏" : "沉浸全屏"} <b>⛶</b></button></div>
    </header>
    {children}
    <TrialStrip trials={trials}/>
  </div>;
}

function Presets({ items, active, onSelect }: { items: Array<{ id: string; label: string; note: string }>; active?: string; onSelect: (id: string) => void }) {
  return <nav className="apparatus-presets" aria-label="实验情境预设">{items.map((item, index) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => onSelect(item.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{item.label}</b><small>{item.note}</small></span></button>)}</nav>;
}

function ReflectionLab({ trials, onRecord }: LabProps) {
  const [angle, setAngle] = useState(35);
  const [dragging, setDragging] = useState(false);
  const [protractor, setProtractor] = useState(true);
  const radians = angle * Math.PI / 180;
  const xOffset = Math.sin(radians) * 190;
  const yOffset = Math.cos(radians) * 190;
  const origin = { x: 350 - xOffset, y: 250 - yOffset };
  const target = { x: 350 + xOffset, y: 250 - yOffset };
  function moveRay(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    const point = svgPoint(event, 700, 360);
    const next = Math.atan2(Math.abs(point.x - 350), Math.max(10, 250 - point.y)) * 180 / Math.PI;
    setAngle(Math.round(clamp(next, 10, 75)));
  }
  return <LabFrame trials={trials} title="数字反射测角仪" mission="至少改变两次入射角，寻找不变量" status={`角度同步 · Δ 0°`}>
    <div className="lab-theatre reflection-theatre">
      <div className="scene-help"><span>DRAG</span><strong>拖动黄色光源</strong><small>光线与量角器会实时联动</small></div>
      <div className="visual-readout"><span>LAW / REFLECTION</span><strong>∠i = ∠r = {angle}°</strong><i>镜面法线已校准</i></div>
      <svg viewBox="0 0 700 360" role="img" aria-label="可拖动的光的反射实验光路" onPointerMove={moveRay} onPointerUp={() => setDragging(false)} onPointerLeave={() => setDragging(false)}>
        <defs><marker id="ray-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker><linearGradient id="mirror" x1="0" x2="1"><stop stopColor="#57d9f5"/><stop offset=".5" stopColor="#efffff"/><stop offset="1" stopColor="#57d9f5"/></linearGradient><radialGradient id="dial"><stop stopColor="#6ee7f2" stopOpacity=".14"/><stop offset="1" stopColor="#6ee7f2" stopOpacity="0"/></radialGradient></defs>
        <g className="lab-grid"><path d="M0 70H700M0 130H700M0 190H700M0 250H700M100 0V360M220 0V360M350 0V360M480 0V360M600 0V360"/></g>
        {protractor && <g className="protractor-overlay"><circle cx="350" cy="250" r="115"/><path d="M235 250A115 115 0 0 1 465 250"/>{Array.from({ length: 13 }, (_, i) => { const a = Math.PI * i / 12; const x1 = 350 - Math.cos(a) * 106; const y1 = 250 - Math.sin(a) * 106; const x2 = 350 - Math.cos(a) * 115; const y2 = 250 - Math.sin(a) * 115; return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}/>; })}</g>}
        <line className="normal-line" x1="350" y1="24" x2="350" y2="316"/><text className="svg-label" x="360" y="45">法线 NORMAL</text>
        <line className="mirror-line" x1="72" y1="250" x2="628" y2="250"/><g className="mirror-hatch">{Array.from({ length: 23 }, (_, i) => <line key={i} x1={82 + i * 24} y1="252" x2={68 + i * 24} y2="270"/>)}</g>
        <line className="light-ray incident" x1={origin.x} y1={origin.y} x2="350" y2="250" markerEnd="url(#ray-arrow)"/><line className="light-ray reflected" x1="350" y1="250" x2={target.x} y2={target.y} markerEnd="url(#ray-arrow)"/>
        <circle className="impact" cx="350" cy="250" r="6"/><path className="angle-arc" d={`M350 190 A60 60 0 0 0 ${350 - Math.sin(radians) * 60} ${250 - Math.cos(radians) * 60}`}/><path className="angle-arc" d={`M350 190 A60 60 0 0 1 ${350 + Math.sin(radians) * 60} ${250 - Math.cos(radians) * 60}`}/>
        <text className="angle-text" x="304" y="182">i {angle}°</text><text className="angle-text" x="374" y="182">r {angle}°</text><text className="svg-label" x="285" y="294">平面镜 MIRROR</text>
        <g className={`drag-handle source-handle ${dragging ? "dragging" : ""}`} transform={`translate(${origin.x} ${origin.y})`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}><circle r="22"/><circle r="8"/><path d="M-31 0H-19M19 0H31M0-31V-19M0 19V31"/><text x="-25" y="39">拖动光源</text></g>
      </svg>
    </div>
    <div className="interaction-deck"><Presets active={String(angle)} items={[{ id:"20",label:"小角度",note:"20°"},{id:"45",label:"标准对照",note:"45°"},{id:"70",label:"掠射观察",note:"70°"}]} onSelect={(id) => setAngle(Number(id))}/><div className="precision-control"><label><span><b>精密微调 · 入射角</b><i>也可以直接拖动场景中的光源</i></span><output>{angle}°</output></label><input type="range" min="10" max="75" step="1" value={angle} onChange={(event) => setAngle(Number(event.target.value))}/><button className={protractor ? "toggle active" : "toggle"} onClick={() => setProtractor(!protractor)}>量角器叠层 <b>{protractor ? "ON" : "OFF"}</b></button></div><div className="instrument-readings"><span>入射角<b>{angle}°</b></span><span>反射角<b>{angle}°</b></span><span>误差值<b>0.0°</b></span></div><RecordButton onClick={() => onRecord({ taskId:"reflection", summary:`入射角 ${angle}°，反射角 ${angle}°，差值 0°`, values:{ incidentAngle:angle, reflectionAngle:angle, difference:0 } })}/></div>
  </LabFrame>;
}

function LensLab({ trials, onRecord }: LabProps) {
  const [objectDistance, setObjectDistance] = useState(28);
  const [screenDistance, setScreenDistance] = useState(18);
  const [dragging, setDragging] = useState<"object" | "screen" | null>(null);
  const result = calculateLens({ focalLength:10, lensX:0, objectX:-objectDistance, objectHeight:5, screenX:screenDistance });
  const axisY = 210, lensX = 390, scale = 9;
  const objectX = lensX - objectDistance * scale, screenX = lensX + screenDistance * scale;
  const imageX = result.finite ? lensX + clamp(result.imageDistance, -38, 38) * scale : 760;
  const imageHeight = clamp(result.imageHeight * 12, -100, 100);
  const blur = result.finite && result.real ? Math.abs(screenDistance - result.imageDistance) : 30;
  function dragBench(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragging) return;
    const point = svgPoint(event, 780, 360);
    if (dragging === "object") setObjectDistance(Math.round(clamp((lensX - point.x) / scale, 5, 35)));
    else setScreenDistance(Math.round(clamp((point.x - lensX) / scale, 5, 40)));
  }
  const preset = objectDistance === 30 ? "far" : objectDistance === 20 ? "2f" : objectDistance === 15 ? "between" : objectDistance === 7 ? "inside" : undefined;
  return <LabFrame trials={trials} title="可拖拽智能光具座" mission="跨越 2F 与 F，找到至少一种清晰实像" status={result.screenFocused ? "FOCUS LOCKED" : `离焦 ${blur.toFixed(1)} cm`}>
    <div className="lab-theatre lens-theatre">
      <div className="scene-help"><span>DUAL DRAG</span><strong>拖动蜡烛与光屏</strong><small>同一坐标驱动物距、像距和清晰度</small></div>
      <div className={`focus-meter ${result.screenFocused ? "locked" : ""}`}><span>FOCUS</span><i><b style={{ width:`${Math.max(5, 100 - blur * 7)}%` }}/></i><strong>{result.screenFocused ? "清晰成像" : "继续移动光屏"}</strong></div>
      <svg viewBox="0 0 780 360" role="img" aria-label="可拖动的凸透镜成像光具座" onPointerMove={dragBench} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}>
        <defs><marker id="lens-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker><filter id="image-blur"><feGaussianBlur stdDeviation={Math.min(8, blur / 2)}/></filter></defs>
        <g className="lab-grid"><path d="M0 90H780M0 150H780M0 210H780M0 270H780M100 0V360M220 0V360M340 0V360M460 0V360M580 0V360M700 0V360"/></g><line className="axis-line" x1="35" y1={axisY} x2="745" y2={axisY}/><line className="bench-line" x1="45" y1="302" x2="735" y2="302"/>
        {[lensX-180,lensX-90,lensX+90,lensX+180].map((x,i)=><g key={x}><line className="focus-tick" x1={x} y1="197" x2={x} y2="223"/><text className="svg-label" x={x-8} y="238">{i%2?"F":"2F"}</text></g>)}
        {result.finite && <><path className="light-ray ray-a" d={`M${objectX} ${axisY-62} L${lensX} ${axisY-62} L${imageX} ${axisY-imageHeight}`} markerEnd="url(#lens-arrow)"/><path className="light-ray ray-b" d={`M${objectX} ${axisY-62} L${lensX} ${axisY} L${imageX} ${axisY-imageHeight}`} markerEnd="url(#lens-arrow)"/></>}
        {result.finite && result.real && <g className="image-glyph" filter="url(#image-blur)"><line x1={imageX} y1={axisY} x2={imageX} y2={axisY-imageHeight}/><path d={`M${imageX} ${axisY-imageHeight+Math.sign(imageHeight||1)*14}l-9 ${-Math.sign(imageHeight||1)*14}h18z`}/></g>}
        <g className={`object-glyph drag-object ${dragging === "object" ? "dragging" : ""}`} onPointerDown={(event)=>{event.currentTarget.setPointerCapture(event.pointerId);setDragging("object");}}><circle className="drag-ring" cx={objectX} cy="286" r="20"/><line x1={objectX} y1={axisY} x2={objectX} y2={axisY-62}/><path d={`M${objectX} ${axisY-78}l-11 18h22z`}/><text x={objectX-18} y={axisY+28}>物 u</text></g>
        <g className="lens-glyph"><path d={`M${lensX} 84 C${lensX-27} 124 ${lensX-27} 276 ${lensX} 316 C${lensX+27} 276 ${lensX+27} 124 ${lensX} 84Z`}/><line x1={lensX} y1="75" x2={lensX} y2="326"/></g>
        <g className={`${result.screenFocused?"screen-glyph focused":"screen-glyph"} ${dragging === "screen" ? "dragging" : ""}`} onPointerDown={(event)=>{event.currentTarget.setPointerCapture(event.pointerId);setDragging("screen");}}><circle className="drag-ring" cx={screenX} cy="302" r="22"/><line x1={screenX} y1="102" x2={screenX} y2="292"/><path d={`M${screenX-17} 304h34M${screenX} 292v12`}/><text x={screenX-18} y="333">光屏 v</text></g>
      </svg>
    </div>
    <div className="interaction-deck"><Presets active={preset} items={[{id:"far",label:"物在 2F 外",note:"缩小实像"},{id:"2f",label:"物在 2F",note:"等大实像"},{id:"between",label:"F 与 2F",note:"放大实像"},{id:"inside",label:"物在 F 内",note:"虚像区"}]} onSelect={(id)=>{const u={far:30,"2f":20,between:15,inside:7}[id]??28;setObjectDistance(u);const expected=u>10?10*u/(u-10):18;setScreenDistance(Math.round(clamp(expected,5,40)));}}/><div className="precision-control dual"><label><span><b>物距 u</b><i>拖动蜡烛</i></span><output>{objectDistance} cm</output></label><input type="range" min="5" max="35" value={objectDistance} onChange={(e)=>setObjectDistance(Number(e.target.value))}/><label><span><b>光屏位置</b><i>寻找清晰像</i></span><output>{screenDistance} cm</output></label><input type="range" min="5" max="40" value={screenDistance} onChange={(e)=>setScreenDistance(Number(e.target.value))}/></div><div className="instrument-readings"><span>理论像距<b>{result.finite?`${result.imageDistance.toFixed(1)} cm`:"∞"}</b></span><span>成像性质<b>{result.nature}</b></span><span>清晰度<b>{result.screenFocused?"100%":`${Math.max(0,Math.round(100-blur*7))}%`}</b></span></div><RecordButton onClick={()=>onRecord({taskId:"bench",summary:`u=${objectDistance} cm，v=${result.finite?result.imageDistance.toFixed(1):"∞"} cm，${result.nature}，光屏${result.screenFocused?"清晰":"未清晰"}`,values:{objectDistance,screenDistance,imageDistance:result.finite?Number(result.imageDistance.toFixed(2)):"infinity",nature:result.nature,focused:result.screenFocused}})}/></div>
  </LabFrame>;
}

const spectrum=[{name:"红",color:"#ff625e",index:1.476},{name:"橙",color:"#ffad4d",index:1.486},{name:"黄",color:"#ffe86b",index:1.494},{name:"绿",color:"#62f3ba",index:1.505},{name:"蓝",color:"#66c8ff",index:1.516},{name:"紫",color:"#b899ff",index:1.524}];

function DispersionLab({trials,onRecord}:LabProps){
  const [angle,setAngle]=useState(0),[screenX,setScreenX]=useState(760); const [dragging,setDragging]=useState<"prism"|"screen"|null>(null); const [source,setSource]=useState<"white"|"rgb"|"red">("white");
  const bands=source==="red"?spectrum.slice(0,1):source==="rgb"?[spectrum[0]!,spectrum[3]!,spectrum[4]!]:spectrum;
  const rays=useMemo(()=>bands.map(b=>({...b,path:calculateTriangularPrismRayPath({prismAngleDegrees:angle,refractiveIndex:b.index,screenX})})),[angle,screenX,source]);
  const spread=rays.length>1?Math.abs(rays.at(-1)!.path.landing.y-rays[0]!.path.landing.y):0,central=rays[Math.floor(rays.length/2)]!.path;
  function drag(event:ReactPointerEvent<SVGSVGElement>){if(!dragging)return;const p=svgPoint(event,900,450);if(dragging==="screen")setScreenX(Math.round(clamp(p.x,650,840)/5)*5);else setAngle(Math.round(clamp((p.x-410)/7,-16,16)));}
  return <LabFrame trials={trials} title="交互式光谱分析台" mission="比较复色光与单色光，再改变传播距离" status={`${rays.length} CHANNEL · ${spread.toFixed(1)} px`}>
    <div className="lab-theatre prism-theatre"><div className="scene-help"><span>2-AXIS DRAG</span><strong>旋转棱镜 · 拖动光屏</strong><small>观察色带宽度如何实时改变</small></div><div className="spectral-monitor">{rays.map((ray)=><i key={ray.name} style={{background:ray.color,height:`${34+ray.index*17}%`}}/>)}<span>SPECTRUM LIVE</span></div><svg viewBox="0 0 900 450" role="img" aria-label="可拖动的三棱镜色散实验" onPointerMove={drag} onPointerUp={()=>setDragging(null)} onPointerLeave={()=>setDragging(null)}>
      <g className="lab-grid"><path d="M0 70H900M0 130H900M0 190H900M0 250H900M0 310H900M0 370H900M100 0V450M220 0V450M340 0V450M460 0V450M580 0V450M700 0V450M820 0V450"/></g><line className="source-ray" x1="128" y1="225" x2={central.entry.x} y2={central.entry.y}/><g className="source-beacon"><circle cx="112" cy="225" r="20"/><circle cx="112" cy="225" r="6"/><text x="80" y="266">{source==="white"?"白光":source==="rgb"?"RGB 光":"红光"}</text></g><polygon className="prism-glass" points={central.vertices.map(p=>`${p.x},${p.y}`).join(" ")}/><line className="inside-prism" x1={central.entry.x} y1={central.entry.y} x2={central.exit.x} y2={central.exit.y}/>{rays.map(ray=><g key={ray.name}><line className="spectrum-ray" style={{stroke:ray.color}} x1={ray.path.exit.x} y1={ray.path.exit.y} x2={ray.path.landing.x} y2={ray.path.landing.y}/><circle className="spectrum-hit" style={{fill:ray.color}} cx={ray.path.landing.x} cy={ray.path.landing.y} r="6"/></g>)}<line className="prism-screen" x1={screenX} y1="62" x2={screenX} y2="388"/><text className="svg-label" x={screenX-20} y="414">光屏</text><g className={`drag-handle prism-handle ${dragging==="prism"?"dragging":""}`} transform={`translate(${central.vertices[0]!.x} ${central.vertices[0]!.y-18})`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDragging("prism");}}><circle r="18"/><path d="M-8 0A8 8 0 1 1 6 5M7 5l-1-7 6 4"/><text x="-27" y="34">转动棱镜</text></g><g className={`screen-drag-handle ${dragging==="screen"?"dragging":""}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setDragging("screen");}}><rect x={screenX-18} y="350" width="36" height="45" rx="5"/><path d={`M${screenX-8} 372h16M${screenX-8} 366l-6 6 6 6M${screenX+8} 366l6 6-6 6`}/></g>
    </svg></div><div className="interaction-deck"><div className="light-source-rack"><span>LIGHT SOURCE / 光源通道</span><button className={source==="white"?"active white":"white"} onClick={()=>setSource("white")}><i/>复色白光<small>连续光谱</small></button><button className={source==="rgb"?"active rgb":"rgb"} onClick={()=>setSource("rgb")}><i/>RGB 合光<small>三通道</small></button><button className={source==="red"?"active red":"red"} onClick={()=>setSource("red")}><i/>红色单光<small>单一波段</small></button></div><div className="precision-control dual"><label><span><b>棱镜转角</b><i>拖动旋转把手</i></span><output>{angle}°</output></label><input type="range" min="-16" max="16" value={angle} onChange={e=>setAngle(Number(e.target.value))}/><label><span><b>光屏位置</b><i>拖动光屏底座</i></span><output>{screenX}px</output></label><input type="range" min="650" max="840" value={screenX} onChange={e=>setScreenX(Number(e.target.value))}/></div><div className="instrument-readings"><span>光源类型<b>{source==="white"?"复色光":source==="rgb"?"三色合光":"单色光"}</b></span><span>有效通道<b>{rays.length}</b></span><span>光谱展宽<b>{spread.toFixed(1)} px</b></span></div><RecordButton onClick={()=>onRecord({taskId:"dispersion",summary:`${source==="white"?"白光":source==="rgb"?"RGB合光":"红色单光"}，棱镜 ${angle}°，光屏 ${screenX}px，落点 ${rays.length} 个，色带宽 ${spread.toFixed(1)}px`,values:{source,prismAngle:angle,screenX,landingCount:rays.length,spectrumSpread:Number(spread.toFixed(2))}})}/></div>
  </LabFrame>;
}

function CorrectionLab({trials,onRecord}:LabProps){
  const [condition,setCondition]=useState<"myopia"|"hyperopia">("myopia"),[lens,setLens]=useState<"none"|"concave"|"convex">("none"),[scanning,setScanning]=useState(false);
  const focusX=condition==="myopia"?(lens==="concave"?650:lens==="convex"?565:605):(lens==="convex"?650:lens==="concave"?725:690); const corrected=focusX===650;
  const status=corrected?"焦点锁定视网膜":focusX<650?"焦点位于视网膜前":"焦点位于视网膜后";
  function applyLens(next:"none"|"concave"|"convex"){setLens(next);setScanning(true);window.setTimeout(()=>setScanning(false),650);}
  return <LabFrame trials={trials} title="智能视光诊断舱" mission="先诊断焦点偏差，再匹配矫正镜片" status={corrected?"RETINA LOCK":"DIAGNOSIS ACTIVE"}>
    <div className={`lab-theatre eye-theatre ${scanning?"scanning":""}`}><div className="scene-help"><span>SMART SCAN</span><strong>选择眼睛模型 · 试戴镜片</strong><small>光路、像面与处方判断同步更新</small></div><div className="retina-lock"><span>FOCAL PLANE</span><strong>{((focusX-650)/20).toFixed(1)} mm</strong><i>{status}</i></div><div className="scan-line"/><svg viewBox="0 0 760 360" role="img" aria-label="智能视力矫正实时光路"><g className="lab-grid"><path d="M0 70H760M0 130H760M0 190H760M0 250H760M100 0V360M220 0V360M340 0V360M460 0V360M580 0V360M700 0V360"/></g><g className="parallel-rays"><line x1="45" y1="128" x2="250" y2="128"/><line x1="45" y1="180" x2="250" y2="180"/><line x1="45" y1="232" x2="250" y2="232"/></g>{lens!=="none"&&<g className={`prescription-lens ${lens}`}><path d={lens==="concave"?"M270 92Q250 180 270 268M290 92Q310 180 290 268":"M280 92Q245 180 280 268M280 92Q315 180 280 268"}/><text x="240" y="298">{lens==="concave"?"凹透镜":"凸透镜"}</text></g>}<path className="eye-outline" d="M390 180C430 72 625 60 685 180C625 300 430 288 390 180Z"/><path className="eye-lens" d="M435 105Q395 180 435 255Q475 180 435 105Z"/><line className="retina" x1="650" y1="105" x2="650" y2="255"/><text className="svg-label" x="622" y="284">视网膜</text><g className="eye-rays"><path d={`M45 128L${lens!=="none"?280:435} ${lens==="concave"?116:lens==="convex"?140:128}L435 128L${focusX} 180`}/><path d={`M45 180L435 180L${focusX} 180`}/><path d={`M45 232L${lens!=="none"?280:435} ${lens==="concave"?244:lens==="convex"?220:232}L435 232L${focusX} 180`}/></g><circle className={corrected?"focus-point corrected":"focus-point"} cx={focusX} cy="180" r="7"/><g className="retina-target"><circle cx="650" cy="180" r="20"/><circle cx="650" cy="180" r="31"/></g></svg></div>
    <div className="interaction-deck"><div className="vision-case-switch"><span>PATIENT MODEL</span><button className={condition==="myopia"?"active":""} onClick={()=>{setCondition("myopia");applyLens("none");}}><i>−</i><b>近视眼模型</b><small>焦点默认偏前</small></button><button className={condition==="hyperopia"?"active":""} onClick={()=>{setCondition("hyperopia");applyLens("none");}}><i>＋</i><b>远视眼模型</b><small>焦点默认偏后</small></button></div><div className="lens-dock" onDragOver={e=>e.preventDefault()} onDrop={e=>applyLens(e.dataTransfer.getData("lens") as "concave"|"convex")}><span>LENS DOCK / 镜片试戴槽</span><div className={`lens-slot ${lens}`}>{lens==="none"?<b>将镜片拖入此处</b>:<><i className={`lens-token ${lens}`}/><b>{lens==="concave"?"凹透镜已装载":"凸透镜已装载"}</b></>}</div><nav><button draggable onDragStart={e=>e.dataTransfer.setData("lens","concave")} onClick={()=>applyLens("concave")}><i className="lens-token concave"/><span>凹透镜<small>发散光线</small></span></button><button draggable onDragStart={e=>e.dataTransfer.setData("lens","convex")} onClick={()=>applyLens("convex")}><i className="lens-token convex"/><span>凸透镜<small>会聚光线</small></span></button><button onClick={()=>applyLens("none")}><i className="lens-token none"/><span>移除镜片<small>观察基线</small></span></button></nav></div><div className="instrument-readings"><span>眼睛状态<b>{condition==="myopia"?"近视":"远视"}</b></span><span>像面偏移<b>{Math.abs((focusX-650)/20).toFixed(1)} mm</b></span><span>处方验证<b>{corrected?"匹配":"待调整"}</b></span></div><RecordButton onClick={()=>onRecord({taskId:"correction",summary:`${condition==="myopia"?"近视":"远视"}状态，${lens==="none"?"无镜片":lens==="concave"?"加入凹透镜":"加入凸透镜"}：${status}`,values:{condition,lens,focusPosition:focusX,retinaPosition:650,corrected}})}/></div>
  </LabFrame>;
}

export function OpticsLab({taskId,...props}:LabProps&{taskId:TaskId}){if(taskId==="reflection")return <ReflectionLab {...props}/>;if(taskId==="bench")return <LensLab {...props}/>;if(taskId==="dispersion")return <DispersionLab {...props}/>;return <CorrectionLab {...props}/>;}
