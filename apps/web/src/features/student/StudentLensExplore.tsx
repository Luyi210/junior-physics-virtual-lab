import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { calculateLens, calculateReflection, calculateRefraction, calculateSphericalMirror } from "@physics-lab/physics";
import { Atom, Beaker, Camera, CircuitBoard, Eye, Flame, Focus, Glasses, Home, Info, Microscope, NotebookPen, Pause, Play, Repeat2, RotateCcw, Ruler, ScanLine, Search, ShieldCheck, Sparkles, Sun, Telescope, ThermometerSun, WandSparkles, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { ExperimentFullscreenButton } from "../../components/ExperimentFullscreenButton";
import { useHarnessStore } from "../harness/harnessStore";
import { LensCanvas } from "../lens/LensCanvas";
import { initialLensScene, useLensStore } from "../lens/lensStore";
import { BlackHoleLightExtension } from "./BlackHoleLightExtension";

const ReflectionScene3D = lazy(async () => {
  const module = await import("./OpticsLawScene3D");
  return { default: module.ReflectionScene3D };
});

const RefractionScene3D = lazy(async () => {
  const module = await import("./OpticsLawScene3D");
  return { default: module.RefractionScene3D };
});

const PlaneMirrorScene3D = lazy(async () => {
  const module = await import("./OpticsLawScene3D");
  return { default: module.PlaneMirrorScene3D };
});

const CurvedMirrorScene3D = lazy(async () => {
  const module = await import("./OpticsLawScene3D");
  return { default: module.CurvedMirrorScene3D };
});

const LensSystemScene3D = lazy(async () => {
  const module = await import("./OpticsLawScene3D");
  return { default: module.LensSystemScene3D };
});

type ExploreMode = "overview" | "dispersion" | "straight" | "reflection" | "refraction" | "color-mix" | "celestial" | "plane-mirror" | "curved-mirror" | "invisible-light" | "magnifier" | "bench" | "camera" | "eye" | "correction" | "instruments";

interface ExploreModule { key: ExploreMode; title: string; note: string; icon: LucideIcon; }

const modules: ExploreModule[] = [
  { key: "overview", title: "探索总览", note: "课本知识体系", icon: Sparkles },
  { key: "dispersion", title: "光的色散", note: "三棱镜分解白光", icon: WandSparkles },
  { key: "straight", title: "直线传播", note: "小孔成像", icon: Sun },
  { key: "reflection", title: "光的反射", note: "平面镜与光路", icon: Repeat2 },
  { key: "refraction", title: "光的折射", note: "空气与水", icon: Waves },
  { key: "color-mix", title: "色光混合", note: "红绿蓝三原色", icon: Sun },
  { key: "celestial", title: "日食与月食", note: "天体阴影", icon: Telescope },
  { key: "plane-mirror", title: "平面镜成像", note: "对称的虚像", icon: Eye },
  { key: "curved-mirror", title: "曲面镜成像", note: "凹面镜与凸面镜", icon: Repeat2 },
  { key: "invisible-light", title: "红外与紫外", note: "看不见的光", icon: ScanLine },
  { key: "magnifier", title: "放大镜", note: "近处的虚像", icon: Search },
  { key: "bench", title: "自由光具座", note: "任意调节", icon: Focus },
  { key: "camera", title: "照相机", note: "镜头与对焦", icon: Camera },
  { key: "eye", title: "人的眼睛", note: "晶状体调节", icon: Eye },
  { key: "correction", title: "视力矫正", note: "选择合适镜片", icon: Glasses },
  { key: "instruments", title: "组合透镜", note: "望远镜与显微镜", icon: Telescope }
];

const lensDimensionModes = new Set<ExploreMode>(["magnifier", "bench", "camera", "eye", "correction", "instruments"]);

function isMode(value: string | null): value is ExploreMode {
  return modules.some((module) => module.key === value);
}

export function StudentLensExplore() {
  const [params, setParams] = useSearchParams();
  const requestedMode = params.get("mode");
  const mode: ExploreMode = isMode(requestedMode) ? requestedMode : "overview";
  const scene = useLensStore((state) => state.scene);
  const update = useLensStore((state) => state.update);
  const replace = useLensStore((state) => state.replace);
  const result = useMemo(() => calculateLens(scene), [scene]);
  const current = modules.find((item) => item.key === mode)!;

  useEffect(() => {
    if (mode === "magnifier") replace({ ...initialLensScene, objectX: -10, screenX: 38 });
    if (mode === "bench") replace(initialLensScene);
  }, [mode, replace]);

  const selectMode = (next: ExploreMode) => setParams(next === "overview" ? {} : { mode: next });
  return (
    <div className="student-explore-page science-explore-page science-structure-v2 optics-structure-v2" style={{ "--science-accent": "#53d8c0" } as React.CSSProperties}>
      <header className="science-header">
        <Link to="/student"><BrandMark compact /></Link>
        <div><Focus size={19} /><span><small>FIELD / 当前领域</small><strong>光现象</strong></span></div>
        <p>{current.note} · {current.title}</p>
        <Link to="/student"><Home size={16} />六领域首页</Link>
      </header>

      <div className="science-layout optics-structure-layout">
        <aside className="science-nav optics-field-nav">
          <span>01—06 · 物理领域</span>
          <Link className="active" to="/student/explore/light"><Focus size={18} /><span><strong>光现象</strong><small>传播、反射、折射与透镜</small></span></Link>
          <Link to="/student/explore/sound"><Waves size={18} /><span><strong>声现象</strong><small>产生、传播与声音特性</small></span></Link>
          <Link to="/student/explore/mechanics"><Ruler size={18} /><span><strong>运动与力</strong><small>速度、杠杆、压强与浮力</small></span></Link>
          <Link to="/student/explore/circuit"><CircuitBoard size={18} /><span><strong>电与磁</strong><small>电路、功率与电磁转换</small></span></Link>
          <Link to="/student/explore/thermal"><Flame size={18} /><span><strong>热与物态</strong><small>温度与物态变化</small></span></Link>
          <Link to="/student/explore/measurement"><Beaker size={18} /><span><strong>质量与密度</strong><small>质量、体积与材料</small></span></Link>
          <Link className="optics-precision-link" to="/lab/lens"><Atom size={17} /><span><strong>精密实验台</strong><small>独立高级工具</small></span></Link>
        </aside>

        <section className="science-stage optics-structure-stage">
          <div className="science-module-bar optics-module-switcher">
            <div><span>EXPERIMENTS / 光学实验</span><strong>{current.title}</strong></div>
            <nav aria-label="光现象实验目录">
              {modules.map((module, index) => { const ModuleIcon = module.icon; return <button className={mode === module.key ? "active" : ""} onClick={() => selectMode(module.key)} title={module.note} key={module.key}><b>{module.key === "overview" ? "" : String(index).padStart(2, "0")}</b><ModuleIcon size={15} /><span>{module.title}</span></button>; })}
            </nav>
          </div>
          <main className="explore-module-content">
          {mode !== "overview" && !lensDimensionModes.has(mode) && <ExperimentFullscreenButton targetSelector=".open-experience" experiment={mode} />}
          {mode === "overview" && <ExploreOverview onSelect={selectMode} />}
          {mode === "dispersion" && <DispersionModule />}
          {mode === "straight" && <StraightPropagationModule />}
          {mode === "reflection" && <ReflectionModule />}
          {mode === "refraction" && <RefractionModule />}
          {mode === "color-mix" && <ColorMixModule />}
          {mode === "celestial" && <CelestialModule />}
          {mode === "plane-mirror" && <PlaneMirrorModule />}
          {mode === "curved-mirror" && <CurvedMirrorModule />}
          {mode === "invisible-light" && <InvisibleLightModule />}
          {mode === "magnifier" && <MagnifierModule scene={scene} result={result} update={update} />}
          {mode === "bench" && <FreeBenchModule scene={scene} result={result} update={update} replace={replace} />}
          {mode === "camera" && <CameraModule />}
          {mode === "eye" && <EyeModule />}
          {mode === "correction" && <CorrectionModule />}
          {mode === "instruments" && <InstrumentsModule />}
          </main>
        </section>
      </div>
    </div>
  );
}

function ExploreOverview({ onSelect }: { onSelect: (mode: ExploreMode) => void }) {
  const groups: Array<{ number: string; title: string; subtitle: string; keys: ExploreMode[]; tone: string }> = [
    { number: "01", title: "基础光现象", subtitle: "四个核心实验对应四条基本规律", keys: ["dispersion", "straight", "reflection", "refraction"], tone: "amber" },
    { number: "02", title: "自然与生活应用", subtitle: "从可见光走向红外线、紫外线与真实生活", keys: ["color-mix", "celestial", "plane-mirror", "curved-mirror", "invisible-light"], tone: "coral" },
    { number: "03", title: "透镜与视觉", subtitle: "第三章单独展开凸透镜、眼睛和光学仪器", keys: ["magnifier", "bench", "camera", "eye", "correction", "instruments"], tone: "cyan" }
  ];
  return <div className="island-overview">
    <section className="island-intro light-phenomena-intro"><div><span>TEXTBOOK-BOUND LIGHT SYSTEM</span><h1>从课本实验，<br />走向真实世界。</h1><p>先通过色散、直线传播、反射和折射四个实验建立规律，再用动态光路解释色光混合、日月食、镜面成像以及红外线和紫外线的生活应用，最后进入透镜与视觉。</p></div><div className="light-journey-art" aria-hidden="true"><span className="journey-source" /><span className="journey-ray ray-direct" /><span className="journey-mirror" /><span className="journey-ray ray-reflected" /><span className="journey-water" /><span className="journey-ray ray-refracted" /><b>基础实验</b><b>光路解释</b><b>生活应用</b></div></section>
    <section className="open-question textbook-chain"><Sparkles size={20} /><div><span>本页学习逻辑</span><h2>实验看到现象，光路解释原因，应用连接生活。</h2><p>模块可以自由进入，但每一个应用都会标明它对应哪一个基础规律。</p></div></section>
    <div className="optics-strands">{groups.map((group) => <section className={`optics-strand strand-${group.tone}`} key={group.number}><header><span>{group.number}</span><div><h2>{group.title}</h2><p>{group.subtitle}</p></div></header><div className="strand-module-grid">{group.keys.map((key) => { const module = modules.find((item) => item.key === key)!; const Icon = module.icon; return <button onClick={() => onSelect(module.key)} key={module.key}><Icon size={24} /><span><strong>{module.title}</strong><small>{module.note}</small></span><i>进入实验</i></button>; })}</div></section>)}</div>
  </div>;
}

type DispersionLightMode = "white" | "red" | "green" | "blue" | "rgb";

const dispersionColors = ["#ff5d56", "#ff9d45", "#f2d44c", "#69d56e", "#4bb9f1", "#5578e8", "#9b62d2"];
const dispersionLightOptions: Array<{ key: DispersionLightMode; label: string; note: string; color: string; beam: string; components: Array<{ color: string; factor: number }> }> = [
  { key: "white", label: "白光", note: "连续七色光谱", color: "#fff7c5", beam: "#fffde9", components: dispersionColors.map((color, index) => ({ color, factor: index - 3 })) },
  { key: "red", label: "红光", note: "单色光，只偏折", color: "#ff5d56", beam: "#ff5d56", components: [{ color: "#ff5d56", factor: -3 }] },
  { key: "green", label: "绿光", note: "单色光，只偏折", color: "#69d56e", beam: "#69d56e", components: [{ color: "#69d56e", factor: 0 }] },
  { key: "blue", label: "蓝光", note: "单色光，只偏折", color: "#4bb9f1", beam: "#4bb9f1", components: [{ color: "#4bb9f1", factor: 2 }] },
  { key: "rgb", label: "RGB混合光", note: "分离为三条色光", color: "#f8f8ef", beam: "#fffde9", components: [{ color: "#ff5d56", factor: -3 }, { color: "#69d56e", factor: 0 }, { color: "#4bb9f1", factor: 2 }] }
];

function DispersionModule() {
  const [prismAngle, setPrismAngle] = useState(0);
  const [screenDistance, setScreenDistance] = useState(250);
  const [slitWidth, setSlitWidth] = useState(3);
  const [lightMode, setLightMode] = useState<DispersionLightMode>("white");
  const [sourceOn, setSourceOn] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const recordHarness = useHarnessStore((state) => state.record);
  const distanceRatio = (screenDistance - 120) / 260;
  const screenX = 610 + distanceRatio * 190;
  const spread = 24 + distanceRatio * 36;
  const spectrumCenterY = 255 + prismAngle * 2;
  const spectrumTop = spectrumCenterY - spread;
  const spectrumHeight = spread * 2;
  const angleRadians = prismAngle * Math.PI / 180;
  const rotatePoint = (x: number, y: number) => ({
    x: 410 + (x - 410) * Math.cos(angleRadians) - (y - 225) * Math.sin(angleRadians),
    y: 225 + (x - 410) * Math.sin(angleRadians) + (y - 225) * Math.cos(angleRadians)
  });
  const prismEntry = rotatePoint(358, 225);
  const prismExit = rotatePoint(462, 225);
  const selectedLight = dispersionLightOptions.find((option) => option.key === lightMode)!;
  const bandThickness = 5 + slitWidth * 1.15;
  const landingY = (factor: number) => spectrumCenterY + factor * spread / 3;
  const landingPoints = selectedLight.components.map((component) => landingY(component.factor));
  const screenBandTop = lightMode === "white" ? spectrumTop : Math.min(...landingPoints) - bandThickness / 2;
  const screenBandBottom = lightMode === "white" ? spectrumTop + spectrumHeight : Math.max(...landingPoints) + bandThickness / 2;
  const active = interacted && sourceOn;
  const interact = () => { setInteracted(true); setSourceOn(true); };
  const toggleSource = () => {
    setInteracted(true);
    setSourceOn((value) => {
      recordHarness("simulation.toggled", { running: !value, action: `${selectedLight.label}光源` });
      return !value;
    });
  };
  const selectLight = (next: DispersionLightMode) => {
    setLightMode(next);
    setSourceOn(true);
    setInteracted(true);
    recordHarness("configuration.changed", { experiment: "dispersion", light: next });
  };
  const reset = () => {
    setPrismAngle(0);
    setScreenDistance(250);
    setSlitWidth(3);
    setLightMode("white");
    setSourceOn(false);
    setInteracted(false);
    recordHarness("configuration.changed", { experiment: "dispersion", action: "reset" });
  };
  const resultTitle = lightMode === "white" ? "白光展开成连续的七色光谱" : lightMode === "rgb" ? "RGB混合光分离成三条色光" : `${selectedLight.label}发生折射，但没有分解出新颜色`;
  const resultDetail = lightMode === "white" ? "不同色光的偏折程度不同，红光偏折较小，紫光偏折较大" : lightMode === "rgb" ? "混合光中原本包含的红、绿、蓝重新分开" : "单色光只有一种主要波长，因此光屏上只出现一条同色光带";

  return <div className="open-experience">
    <ModuleIntro eyebrow="活动 2.1 / 三棱镜色散" title="让白光和彩色光，穿过同一块三棱镜" text="色散实验不一定只能使用白光。切换白光、单色光或 RGB 混合光，再比较它们经过三棱镜后的光路和光屏结果：复色光会分开，单色光只发生偏折。" />
    <div className="dispersion-toolbar" aria-label="色散实验快捷操作">
      <button className={sourceOn ? "source-active" : ""} onClick={toggleSource}><Sun size={16} />{sourceOn ? "关闭光源" : "打开光源"}</button>
      <span><i className={sourceOn ? "on" : ""} />{sourceOn ? `${selectedLight.label}已开启，观察光屏` : `${selectedLight.label}已选择，光源关闭`}</span>
      <button onClick={reset}><RotateCcw size={15} />恢复初始位置</button>
    </div>
    <section className="dispersion-light-picker" aria-label="选择入射光颜色">
      <div><small>LIGHT SOURCE / 选择入射光</small><strong>光的色散一定要用白光吗？</strong><p>不一定。任何颜色的光都能发生折射；但只有包含多种颜色的复色光，经过三棱镜后才会分离出多条色光。</p></div>
      <nav>{dispersionLightOptions.map((option) => <button className={lightMode === option.key ? "active" : ""} onClick={() => selectLight(option.key)} key={option.key}><i className={`light-swatch swatch-${option.key}`} style={{ "--swatch": option.color } as React.CSSProperties} /><span><b>{option.label}</b><small>{option.note}</small></span></button>)}</nav>
    </section>
    <div className="ray-law-lab dispersion-lab">
      <svg viewBox="0 0 900 430" preserveAspectRatio="xMidYMid meet" aria-label="三棱镜色散动态实验">
        <defs><linearGradient id="spectrumScreen" x1="0" y1="0" x2="0" y2="1">{dispersionColors.map((color, index) => <stop offset={`${index / 6 * 100}%`} stopColor={color} key={color} />)}</linearGradient><linearGradient id="rgbSourceFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff5d56" /><stop offset="50%" stopColor="#69d56e" /><stop offset="100%" stopColor="#4bb9f1" /></linearGradient><filter id="spectrumGlow"><feGaussianBlur stdDeviation={Math.max(.35, slitWidth * .17)} result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="ray-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="390" key={`dv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={40 + index * 50} y2={40 + index * 50} key={`dh-${index}`} />)}</g>
        <g className={`white-light-source ${sourceOn ? "source-on" : "source-off"}`}><rect x="65" y="155" width="82" height="140" rx="4" /><circle cx="105" cy="225" r="23" style={{ fill: sourceOn ? lightMode === "rgb" ? "url(#rgbSourceFill)" : selectedLight.color : "#596b6d", filter: sourceOn ? `drop-shadow(0 0 13px ${selectedLight.color})` : "none" }} /><path d={`M128 225 L${prismEntry.x} ${prismEntry.y}`} style={{ stroke: selectedLight.beam, strokeWidth: Math.max(2.4, 2.4 + slitWidth * .32), filter: sourceOn ? `drop-shadow(0 0 5px ${selectedLight.color})` : "none" }} /><text x="64" y="320">{selectedLight.label}光源 + 狭缝</text><text className="device-state" x="82" y="341">{sourceOn ? "ON" : "OFF"}</text></g>
        <g className="prism-optic" transform={`rotate(${prismAngle} 410 225)`}><path d="M410 115 L500 305 L320 305 Z" /><text x="383" y="285">三棱镜</text></g>
        {active && <path className="in-prism-ray" d={`M${prismEntry.x} ${prismEntry.y} L${prismExit.x} ${prismExit.y}`} style={{ stroke: selectedLight.beam }} />}
        <g className="spectrum-screen"><rect x={screenX} y="62" width="26" height="326" rx="2" /><line className="screen-ruler" x1={screenX + 31} x2={screenX + 31} y1={screenBandTop} y2={screenBandBottom} /><text x={screenX - 2} y="411">光屏</text>{active && <>{lightMode === "white" ? <rect className="spectrum-patch" x={screenX + 3} y={spectrumTop} width="17" height={spectrumHeight} rx="3" fill="url(#spectrumScreen)" style={{ opacity: .66 + slitWidth * .025, filter: `blur(${Math.max(0, slitWidth - 3) * .12}px)` }} /> : selectedLight.components.map((component, index) => <rect className="spectrum-patch spectrum-line" x={screenX + 3} y={landingY(component.factor) - bandThickness / 2} width="17" height={bandThickness} rx="2" fill={component.color} style={{ filter: `blur(${Math.max(0, slitWidth - 3) * .1}px)` }} key={`${component.color}-${index}`} />)}<text className="screen-hit-label" x={screenX - 104} y={screenBandTop - 13}>{lightMode === "white" ? "连续七色光谱" : lightMode === "rgb" ? "三条色光落在这里" : `${selectedLight.label}落在这里`}</text><path className="screen-hit-arrow" d={`M${screenX - 18} ${screenBandTop - 16} L${screenX + 2} ${screenBandTop + 2}`} /></>}</g>
        {active && <g className="spectrum-rays" filter="url(#spectrumGlow)">{selectedLight.components.map((component, index) => { const y = landingY(component.factor); return <g key={`${component.color}-${index}`}><path d={`M${prismExit.x} ${prismExit.y} L${screenX + 3} ${y}`} stroke={component.color} style={{ opacity: .58 + slitWidth * .035 }} /><circle className="spectrum-impact" cx={screenX + 3} cy={y} r={2.5 + slitWidth * .08} fill={component.color} /></g>; })}</g>}
        <g className="distance-measure"><line x1="500" x2={screenX} y1="374" y2="374" /><line x1="500" x2="500" y1="367" y2="381" /><line x1={screenX} x2={screenX} y1="367" y2="381" /><text x={(500 + screenX) / 2 - 35} y="365">棱镜—光屏 {screenDistance} mm</text></g>
      </svg>
      {!interacted && <OpticsInteractionCue text="选择一种入射光，开始比较光屏结果" />}
      <div className={`law-readout ${active ? "" : "awaiting-reading"}`}><span>{active ? lightMode === "white" ? "CONTINUOUS SPECTRUM" : lightMode === "rgb" ? "THREE-COLOR SPECTRUM" : "MONOCHROMATIC LIGHT" : "LIGHT SOURCE STANDBY"}</span><strong>{active ? resultTitle : `等待开启${selectedLight.label}`}</strong><small>{active ? resultDetail : "先选择一种光源，再沿光路观察最终落点"}</small></div>
    </div>
    <div className="open-control-deck dispersion-controls"><RangeControl label="三棱镜转角" value={prismAngle} min={-16} max={16} step={1} unit="°" onChange={setPrismAngle} onInteract={interact} /><RangeControl label="棱镜到光屏距离" value={screenDistance} min={120} max={380} step={10} unit="mm" onChange={setScreenDistance} onInteract={interact} /><RangeControl label="狭缝宽度" value={slitWidth} min={1} max={10} step={1} unit="mm" onChange={setSlitWidth} onInteract={interact} /><div className={`observation-output ${active ? "" : "awaiting-reading"}`}><span>{active ? `当前光源 · ${selectedLight.label}` : "实验尚未开始"}</span><strong>{active ? lightMode === "white" ? "复色光形成连续光谱" : lightMode === "rgb" ? "三种成分光重新分离" : "单色光不会产生新的颜色" : "选择一种光源开始比较"}</strong><p>{active ? "保持其他条件不变，只切换入射光，比较光屏上色带的数量和位置。" : "实验结果会在你的操作之后出现。"}</p></div></div>
    <section className="dispersion-guide" aria-label="三棱镜色散实验说明">
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>这是什么实验？应该怎样操作？</h2><p>这是一套可更换光源的三棱镜色散实验。它用白光、单色光和 RGB 混合光进行对照，把“复色光会分离、单色光只偏折”变成可以直接观察的光屏现象。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>色散的关键是“复色光”</strong><p>白光含有多种颜色，所以能展开成连续光谱；红、绿、蓝单色光只有一种主要波长，通过三棱镜后会改变方向，却不会凭空产生其他颜色。</p></span></article>
        <article><i><WandSparkles size={19} /></i><span><small>02 · 怎么操作</small><strong>固定装置，只切换入射光</strong><p>依次选择白光、红光、绿光、蓝光和 RGB 混合光，比较光屏结果；然后再移动光屏或改变狭缝宽度，研究同一种光在不同条件下的变化。</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>比较色带数量与偏折位置</strong><p>白光形成连续光谱，RGB 混合光分成三条，单色光只留下一条。再比较落点：红光偏折较小，蓝光偏折更大。</p></span></article>
      </div>
      <footer><b>建议比较：</b>先固定三棱镜、光屏和狭缝，只改变光源颜色；再固定光源，只改变光屏距离。一次只改变一个条件，才能判断现象究竟由什么引起。</footer>
    </section>
    <RainbowLifeSection />
  </div>;
}

function RainbowLifeSection() {
  const scenes = [
    {
      number: "01",
      title: "雨后彩虹",
      tag: "最典型的自然色散",
      image: "/images/rainbow/rainbow-after-rain.webp",
      alt: "雨后乌云和阳光之间出现完整的主虹",
      text: "太阳光进入雨滴时先折射并发生色散，在水滴内部反射一次，离开水滴时再次折射。不同颜色以不同方向进入眼睛，于是我们看见外红内紫的圆弧。"
    },
    {
      number: "02",
      title: "喷泉与水雾彩虹",
      tag: "生活中可以主动寻找",
      image: "/images/rainbow/fountain-rainbow.webp",
      alt: "阳光照射公园喷泉水雾形成近距离彩虹",
      text: "喷泉、瀑布和洒水器产生的大量小水滴，也能像雨滴一样分解阳光。背对太阳、面向水雾并改变观察位置，常能找到一段近距离彩虹。"
    },
    {
      number: "03",
      title: "双彩虹",
      tag: "一次反射与两次反射",
      image: "/images/rainbow/double-rainbow.webp",
      alt: "山脉上方同时出现明亮主虹和较暗副虹",
      text: "较亮的主虹来自水滴内一次反射；较暗的副虹来自两次反射，损失的光更多，而且颜色顺序与主虹相反。两道虹之间通常还会显得更暗。"
    }
  ];
  return <section className="rainbow-life-section" aria-labelledby="rainbow-life-title">
    <header>
      <div><span>NATURE &amp; DAILY LIFE / 自然与生活</span><h2 id="rainbow-life-title">天空把每一颗雨滴，<br />都变成了一枚小棱镜。</h2></div>
      <div><Sparkles size={21} /><p><strong>彩虹不只是“白光被分成七色”。</strong>一束阳光还要在水滴中经历折射、色散和内部反射，并以合适的角度进入观察者眼睛，彩虹才会出现。</p></div>
    </header>
    <div className="rainbow-life-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="rainbow-mechanism-strip">
      <span><b>阳光进入水滴</b><small>第一次折射并发生色散</small></span><i>→</i>
      <span><b>水滴内部反射</b><small>光线改变传播方向</small></span><i>→</i>
      <span><b>离开水滴</b><small>再次折射，颜色继续分开</small></span><i>→</i>
      <span><b>进入观察者眼睛</b><small>太阳应在观察者身后</small></span>
    </div>
    <aside><Sun size={19} /><p><b>观察小提示：</b>雨后或喷泉旁，背对太阳、面向水滴，再缓慢改变站立位置。不要为了寻找彩虹而直视太阳。</p></aside>
  </section>;
}

function ShadowlessLampLife() {
  const scenes = [
    {
      number: "01",
      title: "一只灯头，里面有许多发光单元",
      tag: "多个位置同时发光",
      image: "/images/shadowless-lamp/lamp-closeup.jpg",
      alt: "由多个反光面和发光区域组成的手术无影灯灯头",
      text: "无影灯不是只从一个小点发光。灯头里的多个灯珠或反光面，让光从不同位置同时射向同一片区域。"
    },
    {
      number: "02",
      title: "多个灯头，从不同方向照明",
      tag: "让光线绕开遮挡",
      image: "/images/shadowless-lamp/cardiac-operating-room.jpg",
      alt: "手术室内悬挂在手术台上方的多个圆形无影灯",
      text: "手术台上方常有两个或更多灯头。医生的头或手挡住一个方向的光时，其他方向的光仍能到达手术区域。"
    },
    {
      number: "03",
      title: "灯头对准同一个工作区域",
      tag: "阴影被其他光束补亮",
      image: "/images/shadowless-lamp/laparoscopic-operating-room.jpg",
      alt: "无影灯安装在手术台上方的现代手术室",
      text: "不同方向形成的影子位置并不完全重合。某束光留下的暗处，会被其他光束照亮，因此看起来影子很淡。"
    }
  ];

  return <section className="rainbow-life-section shadowless-life-section" aria-labelledby="shadowless-life-title">
    <header>
      <div><span>PHYSICS IN DAILY LIFE / 物理走进生活</span><h2 id="shadowless-life-title">医生的手挡住了光，<br />为什么手术区仍然明亮？</h2></div>
      <div><Sun size={22} /><p><strong>无影灯并不是“完全没有影子”。</strong>它利用多个方向的光共同照明，让一束光被遮挡时，其他光线仍能沿直线到达目标区域，把明显的暗影补亮。</p></div>
    </header>
    <div className="rainbow-life-grid shadowless-photo-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="rainbow-mechanism-strip shadowless-mechanism-strip">
      <span><b>多个位置发光</b><small>每个灯珠都能发出一组光线</small></span><i>→</i>
      <span><b>光沿直线传播</b><small>不同方向的光同时照向手术区</small></span><i>→</i>
      <span><b>遮住部分光线</b><small>手或器械只能挡住其中一些方向</small></span><i>→</i>
      <span><b>其余光线补亮</b><small>阴影变浅，观察区域仍然清楚</small></span>
    </div>
    <aside><Info size={19} /><p><b>一句话理解：</b>无影灯没有让光“拐弯”，每一束光仍然沿直线传播；它只是让更多束光从不同方向到达同一个地方。</p></aside>
    <small className="photo-credit">图片来源：Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:Lampada_scialitica.jpg" target="_blank" rel="noreferrer">Glaucolongoni（CC BY-SA 4.0）</a>、<a href="https://commons.wikimedia.org/wiki/File:Cardiac_operating_room.jpg" target="_blank" rel="noreferrer">Ruhrfisch（CC BY-SA 2.0）</a>、<a href="https://commons.wikimedia.org/wiki/File:Laparoscopic_operating_theatre.jpg" target="_blank" rel="noreferrer">Dr.jayesh amin（CC BY-SA 3.0）</a></small>
  </section>;
}

function EuvMirrorLife() {
  const [mirrorCount, setMirrorCount] = useState(3);
  const mirrorPoints = [
    { x: 160, y: 112 },
    { x: 276, y: 232 },
    { x: 392, y: 112 },
    { x: 508, y: 232 },
    { x: 624, y: 112 },
    { x: 740, y: 232 }
  ];
  const source = { x: 52, y: 218 };
  const activePoints = [source, ...mirrorPoints.slice(0, mirrorCount)];
  const remaining = Math.pow(0.7, mirrorCount) * 100;
  const scenes = [
    {
      number: "01",
      title: "先进入几乎没有尘埃的制造环境",
      tag: "半导体洁净室",
      image: "/images/euv-mirror/semiconductor-cleanroom.jpg",
      alt: "研究人员在黄色照明的半导体洁净室中操作设备",
      text: "芯片上的结构非常微小，灰尘也可能破坏图案。EUV光路还必须在真空中工作，因为空气会强烈吸收这种极短波长的光。"
    },
    {
      number: "02",
      title: "普通玻璃透镜在这里帮不上忙",
      tag: "早期EUV实验设备",
      image: "/images/euv-mirror/euv-tool.jpg",
      alt: "研究人员站在早期极紫外光刻实验设备旁",
      text: "13.5纳米的极紫外光会被普通玻璃吸收，因此设备不能像照相机那样主要依靠透镜，只能让光在多面超精密反射镜之间接力传播。"
    },
    {
      number: "03",
      title: "最后把微小图案投向硅晶圆",
      tag: "晶圆与芯片阵列",
      image: "/images/euv-mirror/silicon-wafer.jpg",
      alt: "表面排列着大量方形芯片图案的硅晶圆",
      text: "反射镜不仅改变光的方向，还要把光准确整形和聚焦，最终将掩模上的图案缩小投射到涂有感光材料的晶圆上。"
    }
  ];

  return <section className="rainbow-life-section euv-life-section" aria-labelledby="euv-life-title">
    <header>
      <div><span>PHYSICS AT THE FRONTIER / 物理走进科技</span><h2 id="euv-life-title">制造先进芯片，<br />为什么要用“超级反射镜”？</h2></div>
      <div><Atom size={22} /><p><strong>因为EUV光几乎会被所有普通材料吸收。</strong>光刻机要在真空中，用一组表面极其精密、覆盖多层薄膜的反射镜，把13.5纳米的极紫外光一步步送到晶圆。</p></div>
    </header>
    <div className="rainbow-life-grid euv-photo-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="euv-path-lab">
      <div className="euv-path-copy">
        <span>INTERACTIVE OPTICAL PATH / 动态光路</span>
        <h3>让极紫外光经过几面反射镜？</h3>
        <p>拖动滑杆，观察光怎样在镜面之间一次次改变方向。每一次碰到镜面，入射角与反射角仍然相等；“超级”来自镜面精度和多层薄膜，而不是违反反射定律。</p>
        <label htmlFor="euv-mirror-count"><b>参与反射的镜面数</b><output>{mirrorCount} 面</output></label>
        <input id="euv-mirror-count" type="range" min="1" max="6" step="1" value={mirrorCount} onChange={(event) => setMirrorCount(Number(event.target.value))} />
        <div className="euv-energy-meter"><span style={{ width: `${remaining}%` }} /><b>示意剩余光强约 {remaining.toFixed(1)}%</b></div>
        <small>简化估算：假设每面镜保留约70%的入射光，经过 {mirrorCount} 面后约为 70%<sup>{mirrorCount}</sup>。真实设备还包含其他光学环节。</small>
      </div>
      <div className="euv-path-visual">
        <svg viewBox="0 0 820 320" role="img" aria-label={`极紫外光经过${mirrorCount}面反射镜的动态示意图`}>
          <defs>
            <filter id="euvGlow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <linearGradient id="euvMirror" x1="0" x2="1"><stop offset="0" stopColor="#6c7c91" /><stop offset="0.5" stopColor="#edf6ff" /><stop offset="1" stopColor="#4f6278" /></linearGradient>
          </defs>
          <g className="euv-grid">{Array.from({ length: 13 }, (_, index) => <line x1={45 + index * 60} x2={45 + index * 60} y1="36" y2="274" key={`euv-v-${index}`} />)}{Array.from({ length: 5 }, (_, index) => <line x1="38" x2="782" y1={50 + index * 52} y2={50 + index * 52} key={`euv-h-${index}`} />)}</g>
          <polyline className="euv-path-ghost" points={[source, ...mirrorPoints].map((point) => `${point.x},${point.y}`).join(" ")} />
          <polyline className="euv-path-active" points={activePoints.map((point) => `${point.x},${point.y}`).join(" ")} filter="url(#euvGlow)" />
          <g className="euv-source" transform={`translate(${source.x} ${source.y})`}><circle r="21" /><circle r="8" /><text x="-24" y="45">EUV光源</text></g>
          {mirrorPoints.map((point, index) => <g className={`euv-mirror ${index < mirrorCount ? "is-active" : ""}`} transform={`translate(${point.x} ${point.y}) rotate(${index % 2 === 0 ? -36 : 36})`} key={index}><ellipse rx="30" ry="9" fill="url(#euvMirror)" /><line x1="-27" x2="27" y1="0" y2="0" /><text transform={`rotate(${index % 2 === 0 ? 36 : -36})`} x="-15" y={index % 2 === 0 ? -23 : 34}>M{index + 1}</text></g>)}
          <g className="euv-wafer"><ellipse cx="780" cy="282" rx="31" ry="9" /><path d="M749 282 v10 c0 7 62 7 62 0 v-10" /><text x="755" y="318">晶圆</text></g>
        </svg>
        <div className="euv-visual-caption"><b>{mirrorCount < 6 ? `光正在第 ${mirrorCount} 面镜处等待继续传递` : "六面投影反射镜完成光束整形与投射"}</b><span>镜面上的每一次转折，都遵守初中物理中的光的反射定律。</span></div>
      </div>
    </div>
    <div className="rainbow-mechanism-strip euv-mechanism-strip">
      <span><b>产生EUV光</b><small>工作波长约13.5纳米，肉眼不可见</small></span><i>→</i>
      <span><b>进入真空光路</b><small>避免空气把极紫外光吸收</small></span><i>→</i>
      <span><b>多面镜接力反射</b><small>多层薄膜提高反射能力并整形光束</small></span><i>→</i>
      <span><b>图案投向晶圆</b><small>把掩模图案缩小成芯片上的微小结构</small></span>
    </div>
    <aside><Info size={19} /><p><b>一句话理解：</b>普通镜子主要反射可见光；EUV“超级反射镜”要反射肉眼看不见的极紫外光。它并非100%反射，所以每增加一次反射都会损失一部分光。</p></aside>
    <small className="photo-credit">图片来源：Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:Clean_room.jpg" target="_blank" rel="noreferrer">NASA（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Extreme_ultraviolet_lithography_tool.jpg" target="_blank" rel="noreferrer">Lawrence Livermore National Laboratory（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Silicon_wafer.jpg" target="_blank" rel="noreferrer">Inductiveload（公共领域）</a>；知识参考：<a href="https://www.asml.com/en/technology/lithography-principles/lenses-and-mirrors" target="_blank" rel="noreferrer">ASML</a>、<a href="https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/euv-lithography.html" target="_blank" rel="noreferrer">ZEISS</a>。</small>
  </section>;
}

type FrontierRefractionMode = "ordinary" | "negative" | "cloak";

function NegativeRefractionLife() {
  const [mode, setMode] = useState<FrontierRefractionMode>("ordinary");
  const [controlValue, setControlValue] = useState(36);
  const center = { x: 410, y: 178 };
  const incidenceRadians = controlValue * Math.PI / 180;
  const refractedRadians = controlValue * 0.62 * Math.PI / 180;
  const incidentStart = { x: center.x - Math.tan(incidenceRadians) * 142, y: 36 };
  const refractedEnd = { x: center.x + (mode === "negative" ? -1 : 1) * Math.tan(refractedRadians) * 142, y: 320 };
  const cloakSpread = 34 + controlValue * 0.75;
  const scenes = [
    {
      number: "01",
      title: "关键不只在材料成分，更在微小结构",
      tag: "NASA超材料阵列",
      image: "/images/negative-refraction/split-ring-array.jpg",
      alt: "由许多铜制开口环和导线单元排列成的超材料阵列",
      text: "超材料常由大量比工作波长更小的人工单元按规律排列。电磁波感受到的是整体结构产生的效果，因此它可能表现出普通天然材料没有的性质。"
    },
    {
      number: "02",
      title: "折射光跑到了法线的“反常”一侧",
      tag: "正折射与负折射",
      image: "/images/negative-refraction/negative-index-focusing.png",
      alt: "正折射、负折射和负折射材料聚焦光线的对比示意图",
      text: "普通材料中，折射光与入射光分居法线两侧；在负折射示意中，折射光会落在法线的另一种位置，看起来像向通常相反的方向偏折。"
    },
    {
      number: "03",
      title: "让电磁波像水流绕过石头",
      tag: "实验性电磁隐身样品",
      image: "/images/negative-refraction/electromagnetic-cloak.jpg",
      alt: "由多层金属圆片组成的宽带电磁隐身实验样品",
      text: "某些隐身设计尝试让电磁波在物体周围分流，经过后再重新汇合，减少反射和阴影。已有代表性实验主要针对微波等特定波段，并非肉眼可见的万能隐身衣。"
    }
  ];

  return <section className="rainbow-life-section negative-life-section" aria-labelledby="negative-life-title">
    <header>
      <div><span>PHYSICS AT THE FRONTIER / 物理走进科技</span><h2 id="negative-life-title">负折射与隐身材料：<br />让光向“反常方向”偏折</h2></div>
      <div><Waves size={22} /><p><strong>“反常”并不代表违反物理规律。</strong>科学家通过设计微小结构，改变材料与电磁波的整体作用方式，让折射方向或传播路径呈现普通水和玻璃中看不到的现象。</p></div>
    </header>
    <div className="rainbow-life-grid negative-photo-grid">{scenes.map((scene) => <article key={scene.number}>
      <figure><img src={scene.image} alt={scene.alt} loading="lazy" /><figcaption><b>{scene.number}</b><span>{scene.tag}</span></figcaption></figure>
      <div><h3>{scene.title}</h3><p>{scene.text}</p></div>
    </article>)}</div>
    <div className="negative-path-lab">
      <div className="negative-path-copy">
        <span>INTERACTIVE FRONTIER LAB / 前沿光路体验</span>
        <h3>同一束光，材料怎样安排它的路线？</h3>
        <p>先在普通折射和负折射之间切换，再开启隐身光路。这里使用的是帮助理解的简化模型，不表示所有超材料都具有负折射或隐身能力。</p>
        <div className="negative-mode-tabs" role="group" aria-label="选择前沿折射演示模式">
          <button className={mode === "ordinary" ? "active" : ""} onClick={() => setMode("ordinary")}>普通折射</button>
          <button className={mode === "negative" ? "active" : ""} onClick={() => setMode("negative")}>负折射</button>
          <button className={mode === "cloak" ? "active" : ""} onClick={() => setMode("cloak")}>绕流隐身</button>
        </div>
        <label htmlFor="frontier-refraction-control"><b>{mode === "cloak" ? "电磁波绕行幅度" : "入射角"}</b><output>{controlValue}{mode === "cloak" ? "%" : "°"}</output></label>
        <input id="frontier-refraction-control" type="range" min="15" max="65" step="1" value={controlValue} onChange={(event) => setControlValue(Number(event.target.value))} />
        <div className={`negative-status mode-${mode}`}><i /><span><small>当前观察</small><strong>{mode === "ordinary" ? "折射光进入法线右侧" : mode === "negative" ? "折射光进入法线左侧" : "波在障碍物两侧分开并重新汇合"}</strong></span></div>
      </div>
      <div className="negative-path-visual">
        <svg viewBox="0 0 820 360" role="img" aria-label={mode === "cloak" ? "电磁波绕过物体并重新汇合的隐身原理示意" : `${mode === "negative" ? "负" : "普通"}折射动态光路示意`}>
          <defs>
            <filter id="negativeGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="cloakCore"><stop offset="0" stopColor="#25313a" /><stop offset="1" stopColor="#090e12" /></radialGradient>
          </defs>
          <g className="frontier-grid">{Array.from({ length: 13 }, (_, index) => <line x1={48 + index * 60} x2={48 + index * 60} y1="30" y2="330" key={`frontier-v-${index}`} />)}{Array.from({ length: 6 }, (_, index) => <line x1="35" x2="785" y1={40 + index * 55} y2={40 + index * 55} key={`frontier-h-${index}`} />)}</g>
          {mode !== "cloak" ? <>
            <rect className={`frontier-medium ${mode}`} x="35" y={center.y} width="750" height={160} />
            <line className="frontier-interface" x1="35" x2="785" y1={center.y} y2={center.y} />
            <line className="frontier-normal" x1={center.x} x2={center.x} y1="25" y2="337" />
            <path className="frontier-incident" d={`M${incidentStart.x} ${incidentStart.y} L${center.x} ${center.y}`} filter="url(#negativeGlow)" />
            <path className={`frontier-refracted ${mode}`} d={`M${center.x} ${center.y} L${refractedEnd.x} ${refractedEnd.y}`} filter="url(#negativeGlow)" />
            <circle className="frontier-point" cx={center.x} cy={center.y} r="5" />
            <path className="frontier-angle" d={`M${center.x} 120 A58 58 0 0 0 ${center.x - Math.sin(incidenceRadians) * 58} ${center.y - Math.cos(incidenceRadians) * 58}`} />
            <text className="frontier-label" x="57" y="69">空气 · 正折射率</text>
            <text className="frontier-label lower" x="57" y="310">{mode === "ordinary" ? "普通材料 · 正折射率" : "超材料示意 · 负折射率"}</text>
            <text className="frontier-normal-label" x={center.x + 10} y="50">法线</text>
          </> : <>
            <g className="cloak-field" filter="url(#negativeGlow)">{[-70, -35, 0, 35, 70].map((offset, index) => {
              const y = 180 + offset;
              const bend = Math.max(28, cloakSpread - Math.abs(offset) * .32);
              const direction = offset === 0 ? (index % 2 === 0 ? -1 : 1) : Math.sign(offset);
              const controlY = y + direction * bend;
              return <path d={`M40 ${y} C220 ${y},255 ${controlY},330 ${controlY} C375 ${controlY},445 ${controlY},490 ${controlY} C565 ${controlY},600 ${y},780 ${y}`} key={offset} />;
            })}</g>
            <circle className="cloak-shell" cx="410" cy="180" r="94" />
            <circle className="cloak-object" cx="410" cy="180" r="48" fill="url(#cloakCore)" />
            <text className="cloak-object-label" x="385" y="185">隐藏区</text>
            <text className="frontier-label" x="55" y="55">入射波</text><text className="frontier-label" x="702" y="55">重新汇合</text>
          </>}
        </svg>
        <div className="negative-visual-caption"><b>{mode === "ordinary" ? "课本范围：光从空气进入普通介质" : mode === "negative" ? "拓展范围：折射率取负值时，折射方向发生反转" : "研究设想：减少物体对特定电磁波的反射与遮挡"}</b><span>{mode === "cloak" ? "隐身光路与负折射都可借助超材料研究，但隐身并不等同于负折射。" : "改变滑杆，比较入射角变化时折射光的方向。"}</span></div>
      </div>
    </div>
    <div className="rainbow-mechanism-strip negative-mechanism-strip">
      <span><b>设计微小单元</b><small>形状、尺寸和排列共同决定整体响应</small></span><i>→</i>
      <span><b>组合成超材料</b><small>材料性质更多来自结构而非单一成分</small></span><i>→</i>
      <span><b>重新安排传播方向</b><small>可以研究负折射、聚焦和波前调控</small></span><i>→</i>
      <span><b>探索隐身与成像</b><small>目前通常受波段、方向、损耗等条件限制</small></span>
    </div>
    <aside><Info size={19} /><p><b>科学边界：</b>2006年的代表性隐身实验让微波绕过小型物体，并不是让物体在可见光下消失。真正面向所有颜色、所有方向和大型物体的“万能隐身衣”仍未实现。</p></aside>
    <small className="photo-credit">图片来源：Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:Split-ring_resonator_array_10K_sq_nm.jpg" target="_blank" rel="noreferrer">NASA（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Negative_refraction_index_focusing.png" target="_blank" rel="noreferrer">Pyjeon（公共领域）</a>、<a href="https://commons.wikimedia.org/wiki/File:Broadband_electromagnetic_cloak_of_cylindrical_objects.jpg" target="_blank" rel="noreferrer">Picassonok（CC BY-SA 4.0）</a>；研究参考：<a href="https://www.science.org/doi/10.1126/science.1058847" target="_blank" rel="noreferrer">负折射实验</a>、<a href="https://today.duke.edu/2006/10/cloakdemo.html" target="_blank" rel="noreferrer">Duke微波隐身实验</a>。</small>
  </section>;
}

function StraightPropagationModule() {
  const [objectDistance, setObjectDistance] = useState(250);
  const [aperture, setAperture] = useState(7);
  const [screenX, setScreenX] = useState(790);
  const [dragging, setDragging] = useState<"object" | "screen" | null>(null);
  const [interacted, setInteracted] = useState(false);
  const recordHarness = useHarnessStore((state) => state.record);
  const holeX = 430;
  const objectX = holeX - objectDistance;
  const holeY = 225;
  const objectTop = 115;
  const objectBottom = 285;
  const ratio = (screenX - holeX) / (holeX - objectX);
  const imageFromTop = holeY + (holeY - objectTop) * ratio;
  const imageFromBottom = holeY + (holeY - objectBottom) * ratio;
  const imageHeight = Math.abs(imageFromTop - imageFromBottom);
  const brightness = Math.min(100, 20 + aperture * 4);
  const imageFitsScreen = imageFromBottom >= 72 && imageFromTop <= 378;
  const interact = () => setInteracted(true);
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const startDrag = (kind: "object" | "screen") => (event: React.PointerEvent<SVGGElement>) => {
    event.preventDefault();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    setDragging(kind);
    setInteracted(true);
  };
  const moveDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const pointer = event.currentTarget.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(matrix.inverse());
    if (dragging === "object") {
      const nextDistance = Math.round(clamp(holeX - local.x, 180, 330) / 5) * 5;
      setObjectDistance(nextDistance);
    } else {
      setScreenX(Math.round(clamp(local.x, 600, 830) / 5) * 5);
    }
  };
  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    recordHarness("control.changed", { control: dragging === "object" ? "画面拖动烛焰" : "画面拖动光屏", value: dragging === "object" ? objectDistance : screenX - holeX, unit: "cm" });
    setDragging(null);
  };
  const nudgeObject = (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setObjectDistance((value) => clamp(value + (event.key === "ArrowLeft" ? 5 : -5), 180, 330));
    interact();
  };
  const nudgeScreen = (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setScreenX((value) => clamp(value + (event.key === "ArrowLeft" ? -5 : 5), 600, 830));
    interact();
  };

  return <div className="open-experience">
    <ModuleIntro eyebrow="CHAPTER 2 / 光的直线传播" title="拖动烛焰和光屏，让小孔自己画出倒像" text="可以直接在实验图中左右拖动烛焰和光屏，也可以使用下方滑杆精确调节。追踪烛焰顶部和底部发出的光，观察它们穿过同一个小孔后怎样交换上下位置。" />
    <div className={`ray-law-lab straight-lab ${dragging ? "is-dragging" : ""}`}>
      <svg viewBox="0 0 900 430" preserveAspectRatio="xMidYMid meet" aria-label="可拖动烛焰和光屏的小孔成像动态实验" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{ touchAction: "none" }}>
        <defs><filter id="straightGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="ray-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="390" key={`v-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={40 + index * 50} y2={40 + index * 50} key={`h-${index}`} />)}</g>
        <line className="optic-axis-line" x1="45" x2="855" y1={holeY} y2={holeY} />
        <g className={`candle-object draggable-optic ${dragging === "object" ? "dragging" : ""}`} transform={`translate(${objectX} 0)`} role="button" tabIndex={0} aria-label="拖动烛焰改变物距" onPointerDown={startDrag("object")} onKeyDown={nudgeObject}><line x1="0" x2="0" y1={objectBottom} y2={objectTop} /><path d={`M-9 ${objectTop + 16} L0 ${objectTop} L9 ${objectTop + 16}`} /><text x="-30" y="320">烛焰</text><circle className="drag-dot" cx="0" cy="343" r="13" /><path className="drag-arrows" d="M-8 343 L-2 338 M-8 343 L-2 348 M8 343 L2 338 M8 343 L2 348" /><text className="drag-instruction" x="-32" y="373">左右拖动</text></g>
        <g className="pinhole-board"><rect x={holeX - 9} y="48" width="18" height={holeY - aperture / 2 - 48} /><rect x={holeX - 9} y={holeY + aperture / 2} width="18" height={388 - holeY - aperture / 2} /><circle cx={holeX} cy={holeY} r={Math.max(3, aperture / 2)} /><text x={holeX - 35} y="415">带孔遮光板</text></g>
        <g className={`projection-screen draggable-optic ${dragging === "screen" ? "dragging" : ""}`} role="button" tabIndex={0} aria-label="拖动光屏改变屏距" onPointerDown={startDrag("screen")} onKeyDown={nudgeScreen}><rect x={screenX} y="62" width="22" height="326" /><circle className="drag-dot" cx={screenX + 11} cy="39" r="13" /><path className="drag-arrows" d={`M${screenX + 3} 39 L${screenX + 9} 34 M${screenX + 3} 39 L${screenX + 9} 44 M${screenX + 19} 39 L${screenX + 13} 34 M${screenX + 19} 39 L${screenX + 13} 44`} /><text className="drag-instruction" x={screenX - 21} y="415">拖动光屏</text></g>
        {interacted && <g className="straight-rays" filter="url(#straightGlow)"><path d={`M${objectX} ${objectTop} L${holeX} ${holeY} L${screenX} ${imageFromTop}`} /><path d={`M${objectX} ${objectBottom} L${holeX} ${holeY} L${screenX} ${imageFromBottom}`} /></g>}
        {interacted && <g className="pinhole-image" style={{ opacity: brightness / 100, filter: `blur(${Math.max(0, aperture - 3) / 8}px)` }}><line x1={screenX + 11} x2={screenX + 11} y1={Math.max(75, imageFromBottom)} y2={Math.min(380, imageFromTop)} /><path d={`M${screenX + 3} ${Math.min(365, imageFromTop - 14)} L${screenX + 11} ${Math.min(380, imageFromTop)} L${screenX + 19} ${Math.min(365, imageFromTop - 14)}`} /></g>}
      </svg>
      {!interacted && <OpticsInteractionCue text="直接拖动烛焰或光屏，开始实验" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? imageFitsScreen ? "SCREEN OBSERVATION" : "IMAGE EXCEEDS SCREEN" : "OPTICAL PATH STANDBY"}</span><strong>{interacted ? imageFitsScreen ? "光屏上出现完整的倒立实像" : "像的一部分超出了光屏" : "等待第一次拖动"}</strong><small>{interacted ? `像高约 ${imageHeight.toFixed(0)} 个示意单位 · 小孔越大，像越亮但边缘更模糊` : "画面中的烛焰和光屏都可以左右拖动"}</small></div>
    </div>
    <div className="open-control-deck straight-controls"><RangeControl label="物体到小孔距离" value={objectDistance} min={180} max={330} step={5} unit="cm" onChange={setObjectDistance} onInteract={interact} /><RangeControl label="小孔到光屏距离" value={screenX - holeX} min={170} max={400} step={5} unit="cm" onChange={(distance) => setScreenX(holeX + distance)} onInteract={interact} /><RangeControl label="小孔直径" value={aperture} min={2} max={20} step={1} unit="mm" onChange={setAperture} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "来自你的直接操作" : "现象尚未生成"}</span><strong>{interacted ? imageFitsScreen ? "小孔也能形成清晰的实像" : "移动光屏，让完整像回到屏内" : "拖动一个器材开始实验"}</strong><p>{interacted ? "分别改变物距和屏距比较像的大小，再改变孔径比较亮度与清晰度。" : "拖动与滑杆会同步更新。"}</p></div></div>
    <section className="dispersion-guide straight-guide" aria-label="小孔成像实验说明">
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>这是什么实验？应该怎样操作？</h2><p>这是小孔成像实验。装置不使用透镜，只让烛焰各点发出的部分光线穿过同一个小孔，在另一侧光屏上重新排列成像，用来验证光在均匀介质中沿直线传播。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>一个小孔，也能让物体成像</strong><p>烛焰顶部发出的代表性光线穿孔后到达光屏下方，底部光线到达上方，因此光屏得到上下颠倒的实像。这不是小孔把光翻转，而是光线直线传播后交叉。</p></span></article>
        <article><i><WandSparkles size={19} /></i><span><small>02 · 怎么操作</small><strong>直接拖动，再用滑杆精确比较</strong><p>在实验图中左右拖动烛焰或光屏；也可以用方向键微调。保持其他条件不变，分别改变物距、屏距和孔径，观察像的大小、亮度与清晰程度。</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>像的方向、大小、亮度和清晰度</strong><p>光屏离小孔越远，像通常越大；小孔变宽会让更多光进入，像更亮，但不同物点形成的光斑重叠更多，边缘也更模糊。</p></span></article>
      </div>
      <footer><b>建议比较：</b>先固定小孔直径，只拖动烛焰或光屏；再固定两侧距离，只改变孔径。一次只改变一个条件，才能判断是哪一个因素影响了成像。</footer>
    </section>
    <ShadowlessLampLife />
  </div>;
}

function ReflectionModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [angle, setAngle] = useState(35);
  const [roughness, setRoughness] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const result = calculateReflection(angle);
  const interact = () => setInteracted(true);
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "reflection", action, angle, reflectionAngle: result.reflectionAngle, roughness });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "reflection", view, angle, reflectionAngle: result.reflectionAngle, roughness });
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setAngle((value) => value >= 72 ? 8 : value + 1), 55); return () => window.clearInterval(timer); }, [playing]);

  return <div className="open-experience">
    <ModuleIntro eyebrow="CHAPTER 2 / 光的反射" title="转动入射光，测量镜面两侧的角" text="角度一律从法线量起。先改变入射角，再比较入射光和反射光；也可以逐渐增加表面粗糙度，观察规则反射怎样变成向不同方向散开的反射。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="连续扫描入射角" onInteract={interact} />} />
    <div className="ray-law-lab reflection-lab optics-3d-lab">
      <Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在装配三维反射实验台</strong><span>加载镜面、光线与空间测量工具…</span></div>}><ReflectionScene3D angle={angle} roughness={roughness} interacted={interacted} onInteract={interact} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense>
      {!interacted && <OpticsInteractionCue text="改变入射角，开始测量反射光" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? roughness < 12 ? "SPECULAR REFLECTION" : "SURFACE COMPARISON" : "PROTRACTOR STANDBY"}</span><strong>{interacted ? `入射角 ${angle.toFixed(0)}°　反射角 ${result.reflectionAngle.toFixed(0)}°` : "量角器等待操作"}</strong><small>{interacted ? roughness < 12 ? "两条光线分居法线两侧，反射角等于入射角" : "粗糙表面各处法线不同，反射光向多个方向散开" : "注意：角度是光线与法线的夹角"}</small></div>
    </div>
    <div className="open-control-deck"><RangeControl label="入射角 α" value={angle} min={0} max={78} step={1} unit="°" onChange={(value) => { setPlaying(false); setAngle(value); }} onInteract={interact} /><RangeControl label="表面粗糙度" value={roughness} min={0} max={100} step={5} unit="%" onChange={setRoughness} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "测量结果" : "尚未测量"}</span><strong>{interacted ? roughness < 12 ? "镜面反射：方向集中" : "漫反射：仍遵守反射定律" : "先转动入射光"}</strong><p>{interacted ? "把入射角调到 0°，看看反射光和入射光是否重合。" : "操作前不预先呈现结论。"}</p></div></div>
    <section className="dispersion-guide law-experiment-guide reflection-guide" aria-label="光的反射实验说明">
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>怎样用这张光路图研究反射？</h2><p>这是一套光的反射规律实验。黄色光线表示入射光，绿色光线表示反射光，中间的虚线是法线。所有角度都要从法线开始测量，而不是从镜面开始测量。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>让一束光照向镜面，再寻找反射光</strong><p>光遇到镜面会改变传播方向。入射光、反射光分居法线两侧，实验要比较入射角和反射角之间的关系。</p></span></article>
        <article><i><WandSparkles size={19} /></i><span><small>02 · 怎么操作</small><strong>改变入射角，再逐渐增加表面粗糙度</strong><p>先保持表面光滑，把入射角调到不同数值并读出两侧角度；再提高粗糙度，观察反射光是否仍集中在一个方向。</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>角度关系与反射光的方向</strong><p>光滑表面上，反射角等于入射角；表面变粗糙后，反射光分散到多个方向，但每一小束光在局部仍遵守反射定律。</p></span></article>
      </div>
      <footer><b>建议记录：</b>分别选择 0°、20°、40° 和 60°，记录入射角与反射角。最后只改变粗糙度，比较“镜面反射”和“漫反射”的区别。</footer>
    </section>
    <EuvMirrorLife />
  </div>;
}

type RefractionRoute = "air-water" | "air-glass" | "water-air";

function RefractionModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [route, setRoute] = useState<RefractionRoute>("air-water");
  const [angle, setAngle] = useState(38);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const media = route === "air-water" ? { top: "空气", bottom: "水", n1: 1, n2: 1.33 } : route === "air-glass" ? { top: "空气", bottom: "玻璃", n1: 1, n2: 1.52 } : { top: "水", bottom: "空气", n1: 1.33, n2: 1 };
  const result = calculateRefraction(angle, media.n1, media.n2);
  const interact = () => setInteracted(true);
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "refraction", action, route, angle, refractionAngle: result.refractionAngle ?? null, totalInternalReflection: result.totalInternalReflection });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "refraction", view, route, angle, refractionAngle: result.refractionAngle ?? null, totalInternalReflection: result.totalInternalReflection });
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setAngle((value) => value >= 72 ? 5 : value + 1), 60); return () => window.clearInterval(timer); }, [playing]);
  const changeRoute = (next: RefractionRoute) => { setRoute(next); setInteracted(true); recordHarness("configuration.changed", { control: "传播介质", value: next }); };

  return <div className="open-experience">
    <ModuleIntro eyebrow="CHAPTER 3 / 光的折射" title="让光跨过空气、水和玻璃的边界" text="改变入射角或交换传播方向，比较折射光相对法线是靠近还是远离。水射向空气时继续增大角度，还能找到折射光消失的临界现象。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="连续扫描入射角" onInteract={interact} />} />
    <div className="medium-tabs"><button className={route === "air-water" ? "active" : ""} onClick={() => changeRoute("air-water")}>空气 → 水</button><button className={route === "air-glass" ? "active" : ""} onClick={() => changeRoute("air-glass")}>空气 → 玻璃</button><button className={route === "water-air" ? "active" : ""} onClick={() => changeRoute("water-air")}>水 → 空气</button></div>
    <div className={`ray-law-lab refraction-lab optics-3d-lab medium-${route}`}>
      <Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在装配三维折射实验台</strong><span>加载介质、分界面与空间光线…</span></div>}><RefractionScene3D angle={angle} refractionAngle={result.refractionAngle} totalInternalReflection={result.totalInternalReflection} topMedium={media.top} bottomMedium={media.bottom} interacted={interacted} onInteract={interact} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense>
      {!interacted && <OpticsInteractionCue text="选择介质或改变入射角，让折射光出现" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? result.totalInternalReflection ? "TOTAL INTERNAL REFLECTION" : "SNELL PATH READING" : "INTERFACE STANDBY"}</span><strong>{interacted ? result.totalInternalReflection ? "折射光消失，发生全反射" : `入射角 ${angle.toFixed(0)}°　折射角 ${result.refractionAngle!.toFixed(1)}°` : "等待光进入第二种介质"}</strong><small>{interacted ? result.totalInternalReflection ? "继续减小入射角，寻找折射光重新出现的位置" : result.refractionAngle! < angle ? "折射光向法线偏折" : "折射光远离法线偏折" : "垂直入射时，传播方向是否改变？"}</small></div>
    </div>
    <div className="open-control-deck refraction-controls"><RangeControl label="入射角 α" value={angle} min={0} max={78} step={1} unit="°" onChange={(value) => { setPlaying(false); setAngle(value); }} onInteract={interact} /><div className="index-comparison"><span>当前介质</span><strong>{media.top} n={media.n1} → {media.bottom} n={media.n2}</strong><p>折射率越大，光在该介质中的传播速度越小。</p></div><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "比较建议" : "尚未开始"}</span><strong>{interacted ? "保持角度不变，再换一种介质" : "先选择一条传播路线"}</strong><p>{interacted ? "比较水和玻璃中的折射角，寻找介质差异。" : "结果将在操作后出现。"}</p></div></div>
    <section className="dispersion-guide law-experiment-guide refraction-guide" aria-label="光的折射实验说明">
      <header><span>EXPERIMENT GUIDE / 实验说明</span><h2>光进入另一种介质后，为什么会偏折？</h2><p>这是光的折射规律实验。光从空气进入水或玻璃时，传播速度发生变化，斜着进入时传播方向通常也会改变。图中的角度仍然从法线量起。</p></header>
      <div>
        <article><i><Info size={19} /></i><span><small>01 · 这是什么</small><strong>观察光跨过两种介质的分界面</strong><p>黄色光线是入射光，蓝色光线是折射光。两种介质交界处的竖直虚线是法线，用来判断光向法线靠近还是远离。</p></span></article>
        <article><i><WandSparkles size={19} /></i><span><small>02 · 怎么操作</small><strong>固定一个条件，只比较另一个条件</strong><p>先选择“空气→水”，改变入射角；再保持角度不变，切换到“空气→玻璃”。最后选择“水→空气”，逐渐增大入射角。</p></span></article>
        <article><i><Eye size={19} /></i><span><small>03 · 观察什么</small><strong>偏折方向、折射角与特殊情况</strong><p>空气进入水或玻璃时，折射光通常靠近法线；反向传播时通常远离法线。垂直入射不偏折，水到空气角度足够大时还会发生全反射。</p></span></article>
      </div>
      <footer><b>建议比较：</b>把入射角固定在 40°，依次选择“空气→水”和“空气→玻璃”，比较折射角；再选择“水→空气”慢慢增大角度，寻找折射光刚好消失的位置。</footer>
    </section>
    <NegativeRefractionLife />
  </div>;
}

function ColorMixModule() {
  const [red, setRed] = useState(0);
  const [green, setGreen] = useState(0);
  const [blue, setBlue] = useState(0);
  const interacted = red + green + blue > 0;
  const mixedColor = `rgb(${Math.round(red * 2.55)}, ${Math.round(green * 2.55)}, ${Math.round(blue * 2.55)})`;
  const colorName = red > 75 && green > 75 && blue > 75 ? "接近白光" : red > 55 && green > 55 && blue < 25 ? "黄色光" : red > 55 && blue > 55 && green < 25 ? "品红色光" : green > 55 && blue > 55 && red < 25 ? "青色光" : "混合色光";

  return <div className="open-experience">
    <ModuleIntro eyebrow="活动 2.2 / 色光的混合" title="把红、绿、蓝三束光投到同一张白纸上" text="分别改变三束色光的强度，观察重叠区域。红、绿、蓝是光的三原色，色光采用加法混合：叠加的光越多，重叠区域通常越亮；电视和显示器正是用微小的 RGB 发光单元产生彩色画面。" />
    <div className="color-mix-lab">
      <div className="rgb-projectors"><span style={{ opacity: red / 100 }}>R</span><span style={{ opacity: green / 100 }}>G</span><span style={{ opacity: blue / 100 }}>B</span></div>
      <svg viewBox="0 0 900 430" aria-label="红绿蓝三原色色光混合实验">
        <defs><filter id="rgbBlur"><feGaussianBlur stdDeviation="8" /></filter></defs>
        <g className="rgb-beams"><path d="M115 90 L420 215 L115 215 Z" fill={`rgba(255,45,45,${red / 180})`} /><path d="M115 340 L420 215 L115 215 Z" fill={`rgba(35,255,80,${green / 180})`} /><path d="M785 215 L420 215 L785 85 Z" fill={`rgba(55,105,255,${blue / 180})`} /></g>
        <g className="rgb-overlap" filter="url(#rgbBlur)"><circle cx="382" cy="190" r="105" fill="#ff2929" opacity={red / 100} /><circle cx="458" cy="190" r="105" fill="#2dff62" opacity={green / 100} /><circle cx="420" cy="258" r="105" fill="#3f67ff" opacity={blue / 100} /></g>
        <circle className="mixed-sample" cx="420" cy="216" r="42" fill={interacted ? mixedColor : "#18313a"} />
        <text className="diagram-label" x="355" y="396">白色光屏上的重叠区域</text>
      </svg>
      {!interacted && <OpticsInteractionCue text="打开任意一束色光，开始混合" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "ADDITIVE RGB MIXING" : "RGB PROJECTORS OFF"}</span><strong>{interacted ? colorName : "三束色光尚未开启"}</strong><small>{interacted ? `屏幕模拟色值：${mixedColor}` : "先增加红、绿或蓝光强度"}</small></div>
    </div>
    <div className="rgb-controls"><RangeControl label="红光 R" value={red} min={0} max={100} step={5} unit="%" onChange={setRed} /><RangeControl label="绿光 G" value={green} min={0} max={100} step={5} unit="%" onChange={setGreen} /><RangeControl label="蓝光 B" value={blue} min={0} max={100} step={5} unit="%" onChange={setBlue} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>与颜料混合的区别</span><strong>{interacted ? "色光越叠加，重叠区越亮" : "等待打开色光"}</strong><p>色光是加法混合，RGB 常用于屏幕；颜料主要吸收部分色光，属于减法混合，规律不能直接照搬。</p></div></div>
    <MicroDisplayTechnology red={red} green={green} blue={blue} mixedColor={mixedColor} onRedChange={setRed} onGreenChange={setGreen} onBlueChange={setBlue} />
  </div>;
}

type MicroDisplayMode = "micro-led" | "micro-rgb";
type MicroDisplayView = "pixel" | "picture";

function MicroDisplayTechnology({ red, green, blue, mixedColor, onRedChange, onGreenChange, onBlueChange }: { red: number; green: number; blue: number; mixedColor: string; onRedChange: (value: number) => void; onGreenChange: (value: number) => void; onBlueChange: (value: number) => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mode, setMode] = useState<MicroDisplayMode>("micro-led");
  const [view, setView] = useState<MicroDisplayView>("pixel");
  const [magnification, setMagnification] = useState(3);
  const active = red + green + blue > 0;
  const dominant = red === green && green === blue ? "三色均衡" : red >= green && red >= blue ? "红色分量较强" : green >= red && green >= blue ? "绿色分量较强" : "蓝色分量较强";
  const pixelSize = 11 + magnification * 3;
  const selectMode = (next: MicroDisplayMode) => { setMode(next); recordHarness("configuration.changed", { experiment: "micro-display", control: "显示技术", value: next }); };
  const selectView = (next: MicroDisplayView) => { setView(next); recordHarness("view.changed", { experiment: "micro-display", view: next, technology: mode }); };
  const applyPreset = (name: string, values: [number, number, number]) => { onRedChange(values[0]); onGreenChange(values[1]); onBlueChange(values[2]); recordHarness("configuration.changed", { experiment: "micro-display", control: "RGB颜色预设", value: name, red: values[0], green: values[1], blue: values[2] }); };
  const activePreset = red === 0 && green === 0 && blue === 0 ? "关闭" : red === 100 && green === 100 && blue === 100 ? "白色" : red === 100 && green === 100 && blue === 0 ? "黄色" : red === 0 && green === 100 && blue === 100 ? "青色" : red === 100 && green === 0 && blue === 100 ? "品红" : "自定义";

  return <section className={`micro-display-technology technology-${mode}`} aria-label="Micro LED与Micro RGB显示科技案例">
    <header><div><span>PHYSICS INTO TECHNOLOGY / 物理走进科技</span><h2>Micro LED 与 Micro RGB：下一代高端显示</h2><p>上面的三束光被缩小到屏幕像素中，仍然遵守红、绿、蓝色光的加法混合。切换两种技术并放大像素，看看它们都使用 RGB，却为什么不是同一种显示结构。</p></div><div className="micro-tech-badge"><Atom size={24} /><strong>RGB × 微米制造</strong><small>从初中光学走向显示工程</small></div></header>
    <div className="micro-operation-guide" aria-label="科技案例操作步骤"><span><b>01</b><strong>调节RGB</strong><small>滑动下面三条彩色控制杆</small></span><i>→</i><span><b>02</b><strong>选择技术</strong><small>比较Micro LED与Micro RGB</small></span><i>→</i><span><b>03</b><strong>观察像素</strong><small>切换视图并调整放大倍数</small></span></div>
    <section className="micro-local-controller" aria-label="Micro显示本地控制台">
      <header><div><span>LOCAL CONTROL / 本地控制</span><strong>不用返回上方，在这里直接调节像素</strong></div><nav aria-label="RGB颜色预设"><button className={activePreset === "关闭" ? "active" : ""} onClick={() => applyPreset("关闭", [0,0,0])}>关闭</button><button className={activePreset === "白色" ? "active" : ""} onClick={() => applyPreset("白色", [100,100,100])}>白色</button><button className={activePreset === "黄色" ? "active" : ""} onClick={() => applyPreset("黄色", [100,100,0])}>黄色</button><button className={activePreset === "青色" ? "active" : ""} onClick={() => applyPreset("青色", [0,100,100])}>青色</button><button className={activePreset === "品红" ? "active" : ""} onClick={() => applyPreset("品红", [100,0,100])}>品红</button></nav></header>
      <div><RangeControl label="红子像素 R" value={red} min={0} max={100} step={5} unit="%" onChange={onRedChange} /><RangeControl label="绿子像素 G" value={green} min={0} max={100} step={5} unit="%" onChange={onGreenChange} /><RangeControl label="蓝子像素 B" value={blue} min={0} max={100} step={5} unit="%" onChange={onBlueChange} /><RangeControl label="像素放大" value={magnification} min={1} max={6} step={1} unit="×" onChange={setMagnification} /></div>
    </section>
    <div className="micro-tech-switch" aria-label="切换显示技术">
      <button className={mode === "micro-led" ? "active" : ""} onClick={() => selectMode("micro-led")}><b>01</b><span><strong>Micro LED</strong><small>RGB微型芯片直接作为自发光子像素</small></span></button>
      <button className={mode === "micro-rgb" ? "active" : ""} onClick={() => selectMode("micro-rgb")}><b>02</b><span><strong>Micro RGB</strong><small>微米级RGB LED在液晶面板后方提供精细背光</small></span></button>
    </div>
    <div className="micro-display-workbench">
      <div className="micro-screen-observer">
        <div className="micro-observer-toolbar"><span>PIXEL MICROSCOPE / 像素显微镜</span><div><button className={view === "pixel" ? "active" : ""} onClick={() => selectView("pixel")}>单像素结构</button><button className={view === "picture" ? "active" : ""} onClick={() => selectView("picture")}>整屏成像</button></div></div>
        <div className={`micro-pixel-field view-${view}`} style={{ gridTemplateColumns: `repeat(12, ${pixelSize}px)`, gridAutoRows: `${pixelSize}px` }}>
          {Array.from({ length: 84 }, (_, index) => {
            const pictureFactor = view === "picture" ? .28 + ((index * 17 + Math.floor(index / 12) * 13) % 70) / 100 : 1;
            return <i className="micro-rgb-pixel" key={index}><b className="subpixel-red" style={{ opacity: active ? red / 100 * pictureFactor : .05 }} /><b className="subpixel-green" style={{ opacity: active ? green / 100 * pictureFactor : .05 }} /><b className="subpixel-blue" style={{ opacity: active ? blue / 100 * pictureFactor : .05 }} />{mode === "micro-rgb" && <em />}</i>;
          })}
        </div>
        {!active && <div className="micro-screen-standby"><Focus size={19} /><span><strong>先调节上方RGB光强</strong><small>这里直接使用三原色实验的数据</small></span></div>}
        <div className="micro-color-sample"><i style={{ background: active ? mixedColor : "#142731" }} /><span><small>当前模拟合成色</small><strong>{active ? dominant : "像素尚未点亮"}</strong></span></div>
      </div>
      <div className="micro-layer-inspector">
        <span>DISPLAY CROSS SECTION / 显示剖面</span><h3>{mode === "micro-led" ? "RGB子像素直接发光" : "RGB微型背光位于液晶层后方"}</h3>
        {mode === "micro-led" ? <div className="display-layer-stack micro-led-stack"><i className="eye-side">观察者</i><i className="emission-arrows"><b /><b /><b /></i><i className="rgb-emitter-layer"><b>R</b><b>G</b><b>B</b></i><i className="driver-layer">驱动背板</i></div> : <div className="display-layer-stack micro-rgb-stack"><i className="eye-side">观察者</i><i className="lcd-layer">液晶成像层</i><i className="optical-layer">光学控制层</i><i className="rgb-backlight-layer"><b>R</b><b>G</b><b>B</b></i><i className="driver-layer">微型RGB背光驱动</i></div>}
        <p>{mode === "micro-led" ? "每个红、绿、蓝微型LED都能独立发光，子像素本身直接组成画面，不需要传统背光源。" : "红、绿、蓝微型LED被精细排列并独立控制，但它们在当前Micro RGB电视结构中承担的是背光角色，前方仍有液晶成像层。"}</p>
        <div className="micro-inspector-hint"><Focus size={18} /><span><strong>放大控制已移到上方本地控制台</strong><small>调节后，这里的像素矩阵和剖面会同步更新。</small></span></div>
      </div>
    </div>
    <div className="micro-rgb-live-meter"><div><span>红子像素</span><strong>{red}%</strong><i style={{ transform: `scaleX(${red / 100})` }} /></div><div><span>绿子像素</span><strong>{green}%</strong><i style={{ transform: `scaleX(${green / 100})` }} /></div><div><span>蓝子像素</span><strong>{blue}%</strong><i style={{ transform: `scaleX(${blue / 100})` }} /></div><div><span>物理规律</span><strong>色光加法混合</strong><small>改变RGB比例，就能产生不同颜色</small></div></div>
    <div className="micro-tech-comparison">
      <article><span>共同基础</span><strong>都用红、绿、蓝控制颜色</strong><p>无论芯片位于像素表面还是面板背后，最终都要调节三种色光的相对强度来合成画面颜色。</p></article>
      <article><span>关键区别</span><strong>RGB微光源承担的角色不同</strong><p>Micro LED中它们直接构成自发光子像素；Micro RGB中它们组成更精细的RGB背光系统，不能只看名称就判断结构相同。</p></article>
      <article><span>工程挑战</span><strong>微小、数量巨大，还要几乎没有坏点</strong><p>4K屏幕包含约八百万像素；若每个像素包含RGB子像素，就涉及约两千四百万个发光单元的制造、转移、检测与修复。</p></article>
    </div>
    <aside className="micro-tech-note"><Info size={19} /><div><strong>一句话连接上面的实验</strong><p>三原色实验研究的是“RGB怎样混成颜色”；显示工程研究的是“怎样把数以千万计的RGB发光单元做得足够小、控制得足够准”。</p></div></aside>
    <footer><span>资料依据</span><a href="https://www.nature.com/articles/s41928-022-00828-5" target="_blank" rel="noreferrer">Nature Electronics · Micro light-emitting diodes</a><a href="https://news.samsung.com/global/samsung-launches-world-first-micro-rgb-setting-new-standard-for-premium-tv-technology" target="_blank" rel="noreferrer">Samsung Global Newsroom · Micro RGB</a></footer>
  </section>;
}

type CelestialMode = "solar" | "lunar" | "transit";
type CelestialView = "perspective" | "side" | "top";

function CelestialModule() {
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
  const status = alignment < 16 ? mode === "solar" ? "日全食条件" : mode === "lunar" ? "月全食条件" : "行星凌日进行中" : alignment < 52 ? mode === "solar" ? "日偏食条件" : mode === "lunar" ? "月偏食条件" : "行星擦过日面" : "三个天体未形成有效遮挡";
  const blockerName = mode === "lunar" ? "地球" : mode === "solar" ? "月球" : "内行星";
  const targetName = mode === "solar" ? "地球" : mode === "lunar" ? "月球" : "地球观测端";
  const changeMode = (next: CelestialMode) => { setMode(next); setOffset(62); setInteracted(false); recordHarness("configuration.changed", { control: "天体现象", value: next }); };
  const changeView = (next: CelestialView) => { setView(next); recordHarness("view.changed", { experiment: "celestial", view: next }); };

  return <div className="open-experience">
    <ModuleIntro eyebrow="生活·物理·社会 / 日食和月食" title="沿着太阳光，搭建一次三维天体遮挡" text="画面先突出一束束彼此平行的太阳光：每一束都沿直线传播。移动中间天体靠近光轴，观察它怎样截断部分直线光，并在后方形成具有空间深度的本影与半影。" />
    <div className="medium-tabs celestial-tabs"><button className={mode === "solar" ? "active" : ""} onClick={() => changeMode("solar")}>日食</button><button className={mode === "lunar" ? "active" : ""} onClick={() => changeMode("lunar")}>月食</button><button className={mode === "transit" ? "active" : ""} onClick={() => changeMode("transit")}>水星/金星凌日</button></div>
    <div className={`celestial-lab celestial-space-view view-${view}`}>
      <div className="celestial-view-toolbar"><span><b>3D VIEW</b>切换观察方向</span><div><button className={view === "perspective" ? "active" : ""} onClick={() => changeView("perspective")}>空间透视</button><button className={view === "side" ? "active" : ""} onClick={() => changeView("side")}>光路侧视</button><button className={view === "top" ? "active" : ""} onClick={() => changeView("top")}>轨道俯视</button></div></div>
      <CelestialSpaceDiagram mode={mode} view={view} offset={offset} interacted={interacted} blockerX={blockerX} blockerY={blockerY} blockerRadius={blockerRadius} blockerName={blockerName} targetX={targetX} targetRadius={targetRadius} targetName={targetName} centerY={centerY} alignment={alignment} />
      <div className="celestial-light-legend"><span><i className="legend-ray" />平行直线光</span><span><i className="legend-penumbra" />半影空间</span><span><i className="legend-umbra" />本影空间</span></div>
      {!interacted && <OpticsInteractionCue text="移动中间天体，让它逐渐进入平行光束中心" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "SHADOW GEOMETRY" : "STRAIGHT LIGHT PATH READY"}</span><strong>{interacted ? status : "先沿着七束直线光观察传播方向"}</strong><small>{interacted ? "光不会绕过天体；被挡住的直线光在后方留下本影和半影" : "再移动中间天体，观察哪些直线光被截断"}</small></div>
    </div>
    <div className="open-control-deck celestial-controls"><RangeControl label="中间天体偏离光轴" value={offset} min={-110} max={110} step={2} unit="格" onChange={setOffset} onInteract={() => setInteracted(true)} /><div className="index-comparison"><span>当前空间顺序</span><strong>太阳 → {blockerName} → {targetName}</strong><p>遮挡天体进入太阳和目标天体之间，才可能形成对应天象。</p></div><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>对应基础规律 · 光的直线传播</span><strong>{interacted ? status : "移动中间天体开始实验"}</strong><p>保持太阳和目标天体不动，只改变中间天体的位置，观察阴影落点。</p></div></div>
    <section className="celestial-principle-strip"><article><b>01</b><span><strong>为什么要画多束直线光？</strong><p>太阳不是只发出一条光线。画出多束平行光，才能看清哪些光被天体挡住、哪些仍能到达目标。</p></span></article><article><b>02</b><span><strong>本影和半影从哪里来？</strong><p>直射太阳光全部被挡住的区域是本影；只挡住一部分太阳光的区域是半影。</p></span></article><article><b>03</b><span><strong>日食和月食差在哪里？</strong><p>日食由月球挡住到达地球的太阳光；月食由地球挡住原本能够到达月球的太阳光。</p></span></article></section>
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
    <g className="sun-straight-rays">{Array.from({ length: 7 }, (_, index) => { const y = 140 + index * 39; return <line x1="170" y1={y} x2="965" y2={y} markerEnd="url(#sunRayArrow)" style={{ animationDelay: `${index * -.16}s` }} key={index} />; })}<text x="215" y="108">太阳光近似平行传播 · 每一束都是直线</text></g>
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

type InvisibleSpectrum = "infrared" | "ultraviolet";
type InvisibleApplication = "remote" | "thermal" | "night" | "banknote" | "surface" | "protection";

const invisibleApplications: Record<InvisibleSpectrum, Array<{ key: InvisibleApplication; title: string; note: string; result: string }>> = {
  infrared: [
    { key: "remote", title: "电视遥控", note: "遥控器发出编码红外信号，接收器把它转换成控制指令。", result: "红外接收器收到控制信号" },
    { key: "thermal", title: "热成像", note: "温度不同的物体向外辐射红外线，探测器据此形成温度分布图。", result: "热成像仪识别出温度差异" },
    { key: "night", title: "夜间感应", note: "人体与环境的红外辐射存在差异，感应器可用它发现夜间活动。", result: "感应器发现移动的热目标" }
  ],
  ultraviolet: [
    { key: "banknote", title: "紫外验钞", note: "特定材料吸收紫外线后会发出可见荧光，可帮助识别防伪标记。", result: "防伪图案发出可见荧光" },
    { key: "surface", title: "表面处理", note: "适量紫外线可用于特定环境的表面处理，但效果取决于波段、强度和时间。", result: "到达目标表面的紫外强度增加" },
    { key: "protection", title: "防晒防护", note: "遮阳材料和防晒用品可以吸收或反射部分紫外线，降低到达皮肤的强度。", result: "防护层削弱了到达目标的紫外线" }
  ]
};

type InfraredBarrier = "none" | "paper" | "glass" | "wood";
type ThermalPalette = "iron" | "gray" | "rainbow";
type FluorescentSample = "banknote" | "fabric" | "mineral";
type UvShield = "none" | "glass" | "sunglasses" | "cloth";

const infraredBarrierTransmission: Record<InfraredBarrier, number> = { none: 1, paper: .52, glass: .68, wood: .04 };
const fluorescentResponse: Record<FluorescentSample, number> = { banknote: .95, fabric: .62, mineral: .78 };
const uvShieldTransmission: Record<UvShield, number> = { none: 1, glass: .64, sunglasses: .24, cloth: .08 };

function InvisibleLightModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [spectrum, setSpectrum] = useState<InvisibleSpectrum>("infrared");
  const [application, setApplication] = useState<InvisibleApplication>("remote");
  const [power, setPower] = useState(0);
  const [distance, setDistance] = useState(3);
  const [barrier, setBarrier] = useState<InfraredBarrier>("none");
  const [targetTemperature, setTargetTemperature] = useState(36);
  const [ambientTemperature, setAmbientTemperature] = useState(22);
  const [sensitivity, setSensitivity] = useState(55);
  const [palette, setPalette] = useState<ThermalPalette>("iron");
  const [sample, setSample] = useState<FluorescentSample>("banknote");
  const [exposureTime, setExposureTime] = useState(20);
  const [shield, setShield] = useState<UvShield>("none");
  const [interacted, setInteracted] = useState(false);
  const applications = invisibleApplications[spectrum];
  const current = applications.find((item) => item.key === application) ?? applications[0]!;

  const measurement = useMemo(() => {
    const distanceFactor = Math.max(.18, 1 - (distance - 1) * .105);
    if (application === "remote") {
      const received = Math.round(power * distanceFactor * infraredBarrierTransmission[barrier]);
      return { active: interacted && power > 0, response: received, observable: received >= 18, emitted: `${power}%`, middleLabel: "接收信号", middleValue: `${received}%`, lastLabel: "指令状态", lastValue: received >= 18 ? "已识别" : "未识别", status: received >= 18 ? "遥控指令被接收器识别" : "信号未达到稳定识别范围" };
    }
    if (application === "thermal") {
      const contrast = Math.abs(targetTemperature - ambientTemperature);
      const response = Math.min(100, Math.round(contrast * (0.7 + sensitivity / 100) * 4.2));
      return { active: interacted, response, observable: response >= 15, emitted: `${targetTemperature.toFixed(1)}℃`, middleLabel: "目标与背景温差", middleValue: `${contrast.toFixed(1)}℃`, lastLabel: "图像对比度", lastValue: `${response}%`, status: response >= 15 ? "热成像中已经能区分目标轮廓" : "目标温度接近背景，轮廓不明显" };
    }
    if (application === "night") {
      const contrast = Math.abs(36.5 - ambientTemperature);
      const response = Math.min(100, Math.round(contrast * (sensitivity / 100) * distanceFactor * 8));
      return { active: interacted, response, observable: response >= 20, emitted: "36.5℃", middleLabel: "人体与环境温差", middleValue: `${contrast.toFixed(1)}℃`, lastLabel: "感应响应", lastValue: `${response}%`, status: response >= 20 ? "红外感应器发现热目标变化" : "温差或灵敏度不足，暂未触发" };
    }
    if (application === "banknote") {
      const response = Math.round(power * fluorescentResponse[sample]);
      return { active: interacted && power > 0, response, observable: response >= 16, emitted: `${power}%`, middleLabel: "荧光响应", middleValue: `${response}%`, lastLabel: "可见结果", lastValue: response >= 16 ? "已显现" : "不明显", status: response >= 16 ? "样品把紫外响应转成了可见荧光" : "荧光太弱，肉眼暂时难以分辨" };
    }
    if (application === "surface") {
      const dose = Math.round(power * exposureTime / 60);
      return { active: interacted && power > 0 && exposureTime > 0, response: Math.min(100, dose), observable: dose >= 20, emitted: `${power}%`, middleLabel: "照射时间", middleValue: `${exposureTime}s`, lastLabel: "相对剂量", lastValue: `${dose}`, status: dose >= 20 ? "相对剂量正在累积，目标表面响应增强" : "当前相对剂量较低，继续比较强度与时间" };
    }
    const transmitted = Math.round(power * uvShieldTransmission[shield]);
    return { active: interacted && power > 0, response: transmitted, observable: shield !== "none" && transmitted < power * .7, emitted: `${power}%`, middleLabel: "透过强度", middleValue: `${transmitted}%`, lastLabel: "削弱比例", lastValue: `${power === 0 ? 0 : Math.round((1 - transmitted / power) * 100)}%`, status: shield === "none" ? "没有防护材料，紫外线直接到达目标" : transmitted < power * .7 ? "防护材料明显削弱了紫外线" : "材料只削弱了部分紫外线" };
  }, [ambientTemperature, application, barrier, distance, exposureTime, interacted, power, sample, sensitivity, shield, targetTemperature]);

  const active = measurement.active;
  const targetOpacity = active ? Math.max(.1, measurement.response / 100) : .07;
  const beamStrength = application === "thermal" || application === "night" ? measurement.response : power;
  const paletteColors: Record<ThermalPalette, [string, string, string]> = { iron: ["#fff3a7", "#ff7655", "#45235d"], gray: ["#ffffff", "#9da9ad", "#26343b"], rainbow: ["#ffef55", "#4ee6ac", "#533ec5"] };
  const thermalColors = paletteColors[palette];

  const chooseSpectrum = (next: InvisibleSpectrum) => {
    const nextApplication = invisibleApplications[next][0]!.key;
    setSpectrum(next);
    setApplication(nextApplication);
    setPower(0);
    setInteracted(false);
    recordHarness("configuration.changed", { experiment: "invisible-light", control: "光的类型", value: next });
  };
  const chooseApplication = (next: InvisibleApplication) => {
    setApplication(next);
    setPower(0);
    setInteracted(false);
    recordHarness("configuration.changed", { experiment: "invisible-light", control: "生活应用", value: next, spectrum });
  };
  const reset = () => {
    setPower(0); setDistance(3); setBarrier("none"); setTargetTemperature(36); setAmbientTemperature(22); setSensitivity(55); setPalette("iron"); setSample("banknote"); setExposureTime(20); setShield("none"); setInteracted(false);
    recordHarness("simulation.toggled", { experiment: "invisible-light", running: false, action: "重置双频观察站" });
  };
  const interact = () => setInteracted(true);

  return <div className="open-experience invisible-light-experience">
    <ModuleIntro eyebrow="第三章 · 人眼看不见的光" title="打开一座红外线与紫外线生活观察站" text="这不再是一张不可见光示意图，而是六套具有不同变量的生活实验。学生需要选择仪器、样品或材料，再调节温度、距离、强度与时间，让设备把不可见信号转换成读数和画面。" action={<button onClick={reset}><RotateCcw size={15} />重置观察站</button>} />
    <section className="electromagnetic-map" aria-label="红外线可见光紫外线波段关系">
      <header><span>SPECTRUM MAP / 波段关系</span><strong>人眼只能看见电磁波谱中的一小段</strong><small>示意比例并非按真实波长等比例绘制</small></header>
      <div><button className={spectrum === "ultraviolet" ? "active" : ""} onClick={() => chooseSpectrum("ultraviolet")}><b>紫外线</b><span>约 10–400 nm</span><small>荧光 · 检测 · 防护</small></button><i className="visible-band"><span>可见光</span></i><button className={spectrum === "infrared" ? "active" : ""} onClick={() => chooseSpectrum("infrared")}><b>红外线</b><span>约 780 nm–1 mm</span><small>热辐射 · 通信 · 感应</small></button></div>
    </section>
    <div className="medium-tabs invisible-spectrum-tabs" aria-label="选择不可见光类型">
      <button className={spectrum === "infrared" ? "active infrared" : ""} onClick={() => chooseSpectrum("infrared")}><ThermometerSun size={18} />红外实验室 · 信号与温度</button>
      <button className={spectrum === "ultraviolet" ? "active ultraviolet" : ""} onClick={() => chooseSpectrum("ultraviolet")}><ScanLine size={18} />紫外实验室 · 荧光与防护</button>
    </div>
    <div className="invisible-application-picker" aria-label="选择生活应用">
      {applications.map((item, index) => <button className={application === item.key ? "active" : ""} onClick={() => chooseApplication(item.key)} key={item.key}><b>0{index + 1}</b><strong>{item.title}</strong><small>{item.note}</small></button>)}
    </div>
    <div className={`invisible-light-lab spectrum-${spectrum} scene-${application}`}>
      <div className="invisible-spectrum-ruler" aria-hidden="true"><span>{spectrum === "infrared" ? "长于可见红光" : "短于可见紫光"}</span><i /><strong>{current.title}</strong><i /><span>{active ? "仪器正在读数" : "等待操作"}</span></div>
      <svg viewBox="0 0 900 470" role="img" aria-label={`${current.title}中的${spectrum === "infrared" ? "红外线" : "紫外线"}动态实验`}>
        <defs>
          <linearGradient id="infraredBeam" x1="0" x2="1"><stop stopColor="#ffcc70" /><stop offset=".5" stopColor="#ff694e" /><stop offset="1" stopColor="#a92d63" /></linearGradient>
          <linearGradient id="ultravioletBeam" x1="0" x2="1"><stop stopColor="#75d7ff" /><stop offset=".5" stopColor="#8c66ff" /><stop offset="1" stopColor="#e782ff" /></linearGradient>
          <radialGradient id="thermalTarget"><stop stopColor={thermalColors[0]} /><stop offset=".45" stopColor={thermalColors[1]} /><stop offset="1" stopColor={thermalColors[2]} /></radialGradient>
          <filter id="invisibleGlow"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <g className="invisible-grid">{Array.from({ length: 16 }, (_, index) => <line x1={35 + index * 56} x2={35 + index * 56} y1="70" y2="430" key={`iv-${index}`} />)}{Array.from({ length: 7 }, (_, index) => <line x1="35" x2="865" y1={90 + index * 55} y2={90 + index * 55} key={`ih-${index}`} />)}</g>
        {application === "remote" && <g className="invisible-source" transform="translate(135 245)"><circle r="61" /><circle r="34" /><path d="M-18 -10 L22 0 L-18 10 Z" /><text x="-49" y="92">遥控器红外发射端</text></g>}
        {(application === "thermal" || application === "night") && <g className="heat-body-source" transform="translate(125 120)"><circle cx="65" cy="55" r="38" style={{ fill: thermalColors[0] }} /><path d="M20 285 Q23 108 65 105 Q108 108 112 285 Z" style={{ fill: "url(#thermalTarget)" }} /><text x="12" y="322">发出红外辐射的目标</text></g>}
        {spectrum === "ultraviolet" && <g className="uv-lamp-source" transform="translate(88 145)"><rect width="105" height="190" rx="12" /><rect x="22" y="35" width="61" height="106" rx="28" /><path d="M25 161 H80" /><text x="14" y="220">封闭式紫外光源</text></g>}
        <path className="invisible-beam-halo" d="M190 205 L650 150 L650 340 L190 285 Z" style={{ opacity: active ? beamStrength / 180 : 0, fill: spectrum === "infrared" ? "url(#infraredBeam)" : "url(#ultravioletBeam)" }} />
        <path className="invisible-beam-core" d="M190 245 L650 245" style={{ opacity: active ? .25 + measurement.response / 150 : 0, stroke: spectrum === "infrared" ? "#ff7655" : "#a989ff" }} />
        {active && Array.from({ length: 7 }, (_, index) => <circle className="invisible-photon" cx={230 + index * 58} cy="245" r={3.5 + Math.min(3, beamStrength / 38)} style={{ animationDelay: `${index * -.22}s`, fill: spectrum === "infrared" ? "#ffad63" : "#c19aff" }} key={index} />)}
        {application === "remote" && barrier !== "none" && <g className={`beam-barrier barrier-${barrier}`} transform="translate(505 130)"><rect width="25" height="230" rx="4" /><text x="-20" y="258">{barrier === "paper" ? "纸板" : barrier === "glass" ? "普通玻璃" : "木板"}</text></g>}
        {application === "remote" && <g className="invisible-target remote-target" transform="translate(675 135)"><rect width="150" height="205" rx="8" /><rect x="15" y="18" width="120" height="130" rx="3" /><circle cx="75" cy="175" r="9" style={{ opacity: targetOpacity }} /><text x="28" y="232">电视红外接收器</text></g>}
        {application === "thermal" && <g className="invisible-target thermal-target" transform="translate(670 120)"><rect width="165" height="240" rx="5" /><circle cx="82" cy="72" r="29" fill="url(#thermalTarget)" opacity={targetOpacity} /><path d="M45 192 Q50 110 82 108 Q115 110 120 192 Z" fill="url(#thermalTarget)" opacity={targetOpacity} /><path className="scan-line" d="M15 92 H150" /><text x="31" y="266">热成像探测器</text></g>}
        {application === "night" && <g className="invisible-target night-target" transform="translate(665 135)"><path d="M10 105 L85 35 L160 105 V210 H10 Z" /><circle cx="85" cy="132" r="30" style={{ opacity: targetOpacity }} /><path d="M70 132 Q85 116 100 132 Q85 148 70 132 Z" /><text x="24" y="238">被动红外感应器</text></g>}
        {application === "banknote" && <g className={`invisible-target banknote-target sample-${sample}`} transform="translate(645 155)"><rect width="195" height="135" rx="8" /><circle cx="97" cy="67" r="33" style={{ opacity: targetOpacity }} /><path d="M28 34 H66 M128 100 H168 M26 102 L58 70" style={{ opacity: targetOpacity }} /><text x="35" y="167">{sample === "banknote" ? "钞票防伪标记" : sample === "fabric" ? "白色织物样品" : "荧光矿物样品"}</text></g>}
        {application === "surface" && <g className="invisible-target surface-target" transform="translate(655 145)"><rect x="5" y="120" width="185" height="30" rx="4" /><path d="M32 118 Q36 45 58 30 Q80 58 82 118 M105 118 Q112 58 136 43 Q158 69 160 118" style={{ opacity: Math.max(.08, 1 - measurement.response / 105) }} /><circle cx="58" cy="77" r="9" style={{ opacity: Math.max(.08, 1 - measurement.response / 100) }} /><circle cx="136" cy="83" r="8" style={{ opacity: Math.max(.08, 1 - measurement.response / 100) }} /><text x="37" y="184">相对剂量模拟区</text></g>}
        {application === "protection" && <g className="invisible-target protection-target" transform="translate(660 115)"><path d="M83 20 L155 48 V115 Q155 190 83 224 Q11 190 11 115 V48 Z" style={{ opacity: shield === "none" ? .1 : .45 + (1 - uvShieldTransmission[shield]) / 2 }} /><circle cx="83" cy="93" r="27" style={{ opacity: targetOpacity }} /><path d="M50 180 Q55 125 83 125 Q112 125 117 180 Z" style={{ opacity: targetOpacity }} /><text x="15" y="254">材料后的紫外探测器</text></g>}
      </svg>
      {!interacted && <OpticsInteractionCue text="选择器材或改变一个实验变量" />}
      <div className={`law-readout invisible-readout ${active ? "" : "awaiting-reading"}`}><span>{active ? spectrum === "infrared" ? "INFRARED INSTRUMENT READING" : "ULTRAVIOLET INSTRUMENT READING" : "INVISIBLE SPECTRUM STANDBY"}</span><strong>{active ? measurement.status : "实验装置等待第一次操作"}</strong><small>{active ? current.note : "不能用眼睛直接判断不可见光，应观察仪器或材料响应"}</small></div>
    </div>
    <div className={`invisible-meter-rack meter-${spectrum}`} aria-label="实时仪器读数">
      <div><span>{application === "thermal" ? "目标温度" : application === "night" ? "人体温度" : "发射端"}</span><strong>{active ? measurement.emitted : "— —"}</strong><small>INPUT / 输入</small></div>
      <div><span>{measurement.middleLabel}</span><strong>{active ? measurement.middleValue : "— —"}</strong><small>MEASURE / 测量</small></div>
      <div className={measurement.observable && active ? "detected" : ""}><span>{measurement.lastLabel}</span><strong>{active ? measurement.lastValue : "— —"}</strong><small>RESPONSE / 响应</small></div>
    </div>
    <div className={`open-control-deck invisible-controls controls-${application}`}>
      {application === "remote" && <><RangeControl label="红外发射强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><RangeControl label="遥控距离" value={distance} min={1} max={8} step={.5} unit="m" onChange={setDistance} onInteract={interact} /><InvisibleChoiceControl label="光路中的遮挡物" value={barrier} options={[{ key: "none", label: "无遮挡" }, { key: "paper", label: "纸板" }, { key: "glass", label: "玻璃" }, { key: "wood", label: "木板" }]} onChange={(value) => { setBarrier(value as InfraredBarrier); interact(); }} /></>}
      {application === "thermal" && <><RangeControl label="目标温度" value={targetTemperature} min={15} max={55} step={.5} unit="℃" onChange={setTargetTemperature} onInteract={interact} /><RangeControl label="背景温度" value={ambientTemperature} min={5} max={40} step={.5} unit="℃" onChange={setAmbientTemperature} onInteract={interact} /><InvisibleChoiceControl label="热成像配色" value={palette} options={[{ key: "iron", label: "铁红" }, { key: "gray", label: "灰度" }, { key: "rainbow", label: "彩虹" }]} onChange={(value) => { setPalette(value as ThermalPalette); interact(); }} /></>}
      {application === "night" && <><RangeControl label="环境温度" value={ambientTemperature} min={5} max={38} step={.5} unit="℃" onChange={setAmbientTemperature} onInteract={interact} /><RangeControl label="目标距离" value={distance} min={1} max={8} step={.5} unit="m" onChange={setDistance} onInteract={interact} /><RangeControl label="传感器灵敏度" value={sensitivity} min={10} max={100} step={5} unit="%" onChange={setSensitivity} onInteract={interact} /></>}
      {application === "banknote" && <><RangeControl label="紫外发射强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><InvisibleChoiceControl label="观察样品" value={sample} options={[{ key: "banknote", label: "钞票" }, { key: "fabric", label: "白织物" }, { key: "mineral", label: "荧光矿物" }]} onChange={(value) => { setSample(value as FluorescentSample); interact(); }} /><div className="invisible-method-card"><span>观察方法</span><strong>比较开灯前后，而不是直接看光源</strong><p>紫外线本身不可见，看到的是样品发出的可见荧光。</p></div></>}
      {application === "surface" && <><RangeControl label="紫外发射强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><RangeControl label="照射时间" value={exposureTime} min={0} max={60} step={2} unit="s" onChange={setExposureTime} onInteract={interact} /><div className="invisible-method-card"><span>简化模型</span><strong>相对剂量 = 强度 × 时间</strong><p>这里只比较变量关系，不代表真实消毒效果或操作标准。</p></div></>}
      {application === "protection" && <><RangeControl label="入射紫外强度" value={power} min={0} max={100} step={5} unit="%" onChange={setPower} onInteract={interact} /><InvisibleChoiceControl label="防护材料" value={shield} options={[{ key: "none", label: "无材料" }, { key: "glass", label: "普通玻璃" }, { key: "sunglasses", label: "防护镜片" }, { key: "cloth", label: "致密织物" }]} onChange={(value) => { setShield(value as UvShield); interact(); }} /><div className="invisible-method-card"><span>比较原则</span><strong>保持入射强度不变，只替换材料</strong><p>模拟值用于趋势比较，实际防护能力以产品检测标识为准。</p></div></>}
      <div className={`observation-output ${active ? "" : "awaiting-reading"}`}><span>生活应用 · {current.title}</span><strong>{active ? measurement.status : "等待操作后生成观察"}</strong><p>{current.note}</p></div>
    </div>
    <section className="invisible-inquiry-strip"><div><span>可以继续追问</span><strong>遥控器的光为什么用手机摄像头有时能看见？</strong><p>摄像头传感器对部分近红外线有响应，再由屏幕把电信号显示成可见亮点；不同设备的红外截止滤镜效果不同。</p></div><div><span>容易混淆</span><strong>热成像不是“看见温度颜色”</strong><p>探测器接收红外辐射后计算并着色。画面颜色是人为选定的调色板，不是物体真正发出的可见颜色。</p></div><div><span>实验安全</span><strong>紫外线实验必须观察响应，不直视光源</strong><p>真实课堂应使用封闭式装置或传感器。模拟平台用于理解规律，不能替代安全规范。</p></div></section>
    <section className="dispersion-guide invisible-light-guide" aria-label="红外线与紫外线生活应用说明">
      <header><span>LIFE APPLICATION GUIDE / 生活应用说明</span><h2>看不见，不等于不存在</h2><p>红外线和紫外线都位于可见光之外。六个实验分别利用了信号接收、温度对比、材料荧光、剂量累积和透过率变化，让不可见光留下能够比较的证据。</p></header>
      <div>
        <article><i><ThermometerSun size={19} /></i><span><small>01 · 红外线</small><strong>既能传递信号，也能反映热辐射差异</strong><p>遥控器使用红外线传递编码；热成像和感应器则接收物体发出的红外辐射。两类应用都属于红外技术，但工作目的并不相同。</p></span></article>
        <article><i><ScanLine size={19} /></i><span><small>02 · 紫外线</small><strong>通过材料响应间接观察</strong><p>荧光材料能把紫外响应转成可见光；防护材料会改变透过强度；表面处理还与照射时间有关，不能只看是否“打开光源”。</p></span></article>
        <article><i><ShieldCheck size={19} /></i><span><small>03 · 科学方法</small><strong>一次只改变一个变量</strong><p>固定发射强度再改变距离或材料，固定材料再改变强度，才能判断究竟是哪一个条件影响了探测结果。</p></span></article>
      </div>
      <footer><b>建议路线：</b>先做红外遥控，认识“发射—传播—接收”；再做热成像，理解“不可见信号—传感器—伪彩色图”；最后用紫外防护比较材料透过率。</footer>
    </section>
  </div>;
}

function InvisibleChoiceControl({ label, value, options, onChange }: { label: string; value: string; options: Array<{ key: string; label: string }>; onChange: (value: string) => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const change = (next: string) => { onChange(next); recordHarness("configuration.changed", { experiment: "invisible-light", control: label, value: next }); };
  return <div className="invisible-choice-control"><span>{label}</span><div>{options.map((option) => <button className={value === option.key ? "active" : ""} onClick={() => change(option.key)} key={option.key}>{option.label}</button>)}</div></div>;
}

type MirrorLifeMode = "ar" | "infinity";

function PlaneMirrorLifeTechnology() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mode, setMode] = useState<MirrorLifeMode>("ar");
  const [reflectivity, setReflectivity] = useState(55);
  const [screenDistance, setScreenDistance] = useState(55);
  const [mirrorGap, setMirrorGap] = useState(42);
  const [reflectionRounds, setReflectionRounds] = useState(7);
  const transmission = 100 - reflectivity;
  const retainedLight = Math.pow(reflectivity / 100, reflectionRounds) * 100;
  const frameStep = 11 + mirrorGap * .13;
  const changeMode = (next: MirrorLifeMode) => {
    setMode(next);
    recordHarness("view.changed", { experiment: "plane-mirror-life", view: next });
  };
  const changeValue = (control: string, value: number, setter: (next: number) => void) => {
    setter(value);
    recordHarness("configuration.changed", { experiment: "plane-mirror-life", mode, control, value });
  };

  return <section className={`mirror-life-technology mirror-life-${mode}`} aria-labelledby="mirror-life-title">
    <header>
      <div><span>PHYSICS INTO LIFE &amp; TECHNOLOGY / 物理走进生活与科技</span><h2 id="mirror-life-title">一块“能看穿”的镜子，<br />怎样连接 AR 与“无底洞”？</h2><p>它们都使用半透半反表面，却把光送上了两条不同的道路：AR 把显示画面叠加到真实世界；“无底洞”让光在两面镜子之间反复往返，形成越来越深、越来越暗的重复虚像。</p></div>
      <div className="mirror-life-badge"><Eye size={27} /><strong>真实世界 + 虚像</strong><small>看见的空间，未必是光真正到达的位置</small></div>
    </header>

    <div className="mirror-life-route" aria-label="选择生活科技案例">
      <button className={mode === "ar" ? "active" : ""} onClick={() => changeMode("ar")}><b>01</b><span><strong>简单 AR 显示</strong><small>半透半反 · 虚实叠加</small></span></button>
      <button className={mode === "infinity" ? "active" : ""} onClick={() => changeMode("infinity")}><b>02</b><span><strong>无限镜“无底洞”</strong><small>两镜平行 · 多次反射</small></span></button>
    </div>

    <div className="mirror-life-workbench">
      <div className="mirror-life-visual">
        {mode === "ar" ? <svg viewBox="0 0 900 470" role="img" aria-label="简单AR半透半反动态光路">
          <defs>
            <linearGradient id="arNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#092b3a" /><stop offset="1" stopColor="#07141c" /></linearGradient>
            <linearGradient id="arGlass" x1="0" x2="1"><stop offset="0" stopColor="#7ce2e8" stopOpacity=".08" /><stop offset=".52" stopColor="#d8ffff" stopOpacity=".42" /><stop offset="1" stopColor="#5ac4d2" stopOpacity=".08" /></linearGradient>
            <filter id="arGlow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width="900" height="470" fill="url(#arNight)" />
          <g className="ar-real-world" opacity={Math.max(.28, transmission / 100)}>
            <path d="M0 318 L390 218 L900 315 L900 470 L0 470 Z" fill="#16333d" />
            <path d="M360 470 L435 220 L515 220 L620 470 Z" fill="#263d43" />
            <path d="M435 470 L468 222" stroke="#e6c975" strokeWidth="4" strokeDasharray="24 20" />
            <path d="M545 470 L493 222" stroke="#e6c975" strokeWidth="4" strokeDasharray="24 20" />
            <path d="M30 318 v-150 h115 v122 M170 280 v-190 h138 v160 M690 268 v-145 h160 v178" fill="none" stroke="#315764" strokeWidth="8" />
            <g fill="#e9bd61">{[[62,204],[110,204],[202,130],[250,130],[724,165],[790,165]].map(([x,y], index) => <rect x={x} y={y} width="18" height="28" opacity={.55} key={index} />)}</g>
            <text x="35" y="443">真实街景 · 透过半透镜进入眼睛</text>
          </g>
          <g className="ar-combiner">
            <polygon points="425,70 632,348 588,372 381,94" fill="url(#arGlass)" stroke="#90e8e8" strokeWidth="3" />
            <line x1="413" y1="81" x2="620" y2="359" stroke="#e8ffff" strokeWidth="1" strokeDasharray="8 7" />
            <text x="555" y="95">半透半反镜</text>
          </g>
          <g className="ar-display-source" transform={`translate(${210 - screenDistance * .35} 374)`}>
            <rect x="-60" y="-37" width="120" height="74" rx="5" />
            <path d="M-40 -14 h80 M-40 0 h52 M-40 14 h72" />
            <text x="-47" y="60">微型显示屏</text>
          </g>
          <g className="ar-light-path" filter="url(#arGlow)">
            <path d={`M${210 - screenDistance * .35} 340 L505 207 L748 160`} />
            <path className="virtual" d={`M505 207 L${350 - screenDistance * .32} ${91 - screenDistance * .12}`} />
          </g>
          <g className="ar-floating-card" transform={`translate(${335 - screenDistance * .24} ${112 - screenDistance * .08})`} opacity={.35 + reflectivity / 145}>
            <rect x="-93" y="-48" width="186" height="96" rx="5" />
            <path d="M-64 10 h45 v-24 h45 l-12 -13 m12 13 l-12 13" />
            <text x="-65" y="31">前方 200 m 右转</text>
            <text className="ar-virtual-label" x="-74" y="-61">导航虚像 · 镜后</text>
          </g>
          <g className="ar-eye" transform="translate(762 160)"><path d="M-29 0 Q0 -23 29 0 Q0 23 -29 0 Z" /><circle r="8" /><text x="-17" y="42">眼睛</text></g>
          <g className="ar-legend" transform="translate(608 407)"><line x1="0" x2="45" /><text x="55" y="4">真实光路</text><line className="virtual" x1="145" x2="190" /><text x="200" y="4">反向延长线</text></g>
        </svg> : <svg viewBox="0 0 900 470" role="img" aria-label="无限镜无底洞多次反射动态示意">
          <defs>
            <radialGradient id="infinityVoid"><stop offset="0" stopColor="#061015" /><stop offset=".72" stopColor="#071820" /><stop offset="1" stopColor="#102a34" /></radialGradient>
            <filter id="infinityGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect width="900" height="470" fill="#07161d" />
          <rect x="102" y="34" width="696" height="402" rx="12" fill="url(#infinityVoid)" stroke="#a5d5d7" strokeWidth="8" />
          <g className="infinity-frames" filter="url(#infinityGlow)">{Array.from({ length: reflectionRounds }, (_, index) => {
            const inset = 24 + index * frameStep;
            const opacity = Math.max(.08, Math.pow(reflectivity / 100, index) * .94);
            const width = Math.max(80, 696 - inset * 2);
            const height = Math.max(52, 402 - inset * 1.12);
            return <g opacity={opacity} key={index}>
              <rect x={102 + inset} y={34 + inset * .56} width={width} height={height} rx="8" />
              <circle cx={102 + inset} cy={34 + inset * .56} r="5" /><circle cx={798 - inset} cy={34 + inset * .56} r="5" />
              <circle cx={102 + inset} cy={436 - inset * .56} r="5" /><circle cx={798 - inset} cy={436 - inset * .56} r="5" />
            </g>;
          })}</g>
          <g className="infinity-front-glass"><path d="M102 34 h696 v402 H102 Z" /><text x="126" y="68">前层：半透半反镜</text></g>
          <g className="infinity-back-label"><path d="M752 112 l33 -22" /><text x="592" y="91">后层：普通全反射镜</text></g>
          <g className="infinity-depth-readout"><text x="450" y="217" textAnchor="middle">{reflectionRounds} 层重复虚像</text><text x="450" y="242" textAnchor="middle">每一轮往返光程约增加 2d</text></g>
          <g className="infinity-side-path" transform="translate(28 366)"><path d="M0 0 h45 l36 -45 l38 45 l38 -45 l38 45" /><text x="0" y="28">光在两镜间反复往返，并逐次透出</text></g>
        </svg>}
        <div className="mirror-life-live-label"><b>{mode === "ar" ? "AR COMBINER" : "INFINITY MIRROR"}</b><span>{mode === "ar" ? `约 ${transmission}% 真实环境光透过 · ${reflectivity}% 显示光参与反射` : `第 ${reflectionRounds} 轮示意剩余光强约 ${retainedLight.toFixed(1)}%`}</span></div>
      </div>

      <aside className="mirror-life-controller">
        <span>LIVE OPTICS CONTROL / 动态光学控制</span>
        <h3>{mode === "ar" ? "把导航信息“放”到真实道路上" : "把有限镜距“延伸”成无限深处"}</h3>
        <p>{mode === "ar" ? "显示屏发出的光被半透镜反射进眼睛，人眼沿直线反向追踪，在镜后看见导航虚像；真实街景的光同时穿过镜片。" : "后镜把灯光反射回来，前面的半透镜再把一部分送回去、另一部分送进眼睛。每次循环都会产生一层更深、更暗的虚像。"}</p>
        <label><b>半透镜反射率</b><output>{reflectivity}%</output><input type="range" min="20" max="85" step="5" value={reflectivity} onChange={(event) => changeValue("半透镜反射率", Number(event.target.value), setReflectivity)} /></label>
        {mode === "ar" ? <label><b>显示屏到半透镜距离</b><output>{screenDistance} cm</output><input type="range" min="20" max="100" step="5" value={screenDistance} onChange={(event) => changeValue("显示屏距离", Number(event.target.value), setScreenDistance)} /></label> : <>
          <label><b>两面镜之间距离 d</b><output>{mirrorGap} cm</output><input type="range" min="12" max="72" step="3" value={mirrorGap} onChange={(event) => changeValue("两镜距离", Number(event.target.value), setMirrorGap)} /></label>
          <label><b>追踪反射轮次</b><output>{reflectionRounds} 次</output><input type="range" min="3" max="10" step="1" value={reflectionRounds} onChange={(event) => changeValue("反射轮次", Number(event.target.value), setReflectionRounds)} /></label>
        </>}
        <div className="mirror-life-result"><small>当前观察</small><strong>{mode === "ar" ? `虚像位于镜后约 ${screenDistance} cm（对称简化模型）` : `往返 ${reflectionRounds} 轮，累计增加约 ${2 * mirrorGap * reflectionRounds} cm 光程`}</strong><p>{mode === "ar" ? "提高反射率会让显示像更亮，但真实环境可能相对变暗。" : "真实装置还会受到镜面吸收、散射和LED位置影响，所以深处会逐渐消失。"}</p></div>
      </aside>
    </div>

    <div className="mirror-life-comparison">
      <article><b>共同元件</b><strong>都需要半透半反表面</strong><p>它既让一部分光穿过，又让另一部分光发生反射，因此观察者能够同时接收到两条不同来源的光。</p></article>
      <article><b>AR 的目标</b><strong>把一幅虚像叠加到现实中</strong><p>简单装置只需要一次主要反射；现代 AR 眼镜还可能使用光波导、全反射和衍射结构，让设备更轻薄。</p></article>
      <article><b>无底洞的目标</b><strong>用重复虚像制造空间纵深</strong><p>它依靠两面近似平行的镜子多次反射。镜距改变纵深间隔，反射率影响能够看清多少层。</p></article>
    </div>
    <aside className="mirror-life-note"><Info size={20} /><div><strong>把它与上面的平面镜实验连接起来</strong><p>每一层仍然只是虚像，光并没有真的进入“镜子深处”。实线表示实际传播的光，虚线只表示人眼判断虚像位置时使用的反向延长线。</p></div></aside>
  </section>;
}

function PlaneMirrorModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [objectDistance, setObjectDistance] = useState(175);
  const [observerPosition, setObserverPosition] = useState(0);
  const [screenPlaced, setScreenPlaced] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const interact = () => setInteracted(true);
  const toggleScreen = () => {
    const next = !screenPlaced;
    setScreenPlaced(next);
    interact();
    recordHarness("configuration.changed", { experiment: "plane-mirror", control: "像位置光屏", value: next ? "placed" : "removed" });
  };
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "plane-mirror", action, objectDistance, observerPosition, screenPlaced });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "plane-mirror", view, objectDistance, observerPosition, screenPlaced });

  return <div className="open-experience">
    <ModuleIntro eyebrow="活动 2.4 / 三维平面镜成像" title="走进镜面两侧，追踪虚像在空间中怎样形成" text="拖动实验台可从侧面、正面或上方观察。黄色实线表示物体射向镜面的光，绿色实线表示进入眼睛的反射光；镜后的蓝色虚线只是反射光的反向延长线。移动物体和观察者，再放置光屏验证这个像能否被承接。" action={<button onClick={toggleScreen}>{screenPlaced ? "移开验证光屏" : "在像的位置放光屏"}</button>} />
    <div className="ray-law-lab plane-mirror-lab optics-3d-lab">
      <Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在搭建三维镜面实验台</strong><span>准备镜面、观察者与空间光路…</span></div>}>
        <PlaneMirrorScene3D objectDistance={objectDistance} observerPosition={observerPosition} screenPlaced={screenPlaced} interacted={interacted} onInteract={interact} onNavigate={record3DNavigation} onViewChange={record3DView} />
      </Suspense>
      {!interacted && <OpticsInteractionCue text="移动物体、观察者，或拖动三维实验台" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "3D VIRTUAL IMAGE PATH" : "MIRROR LAB STANDBY"}</span><strong>{interacted ? screenPlaced ? "验证光屏上没有清晰实像" : "像与物关于镜面对称" : "等待第一次操作"}</strong><small>{interacted ? `物距 ${objectDistance} 格 = 像距 ${objectDistance} 格；改变视角不会改变成像规律` : "黄色、绿色为真实光路，蓝色虚线为反向延长线"}</small></div>
    </div>
    <div className="open-control-deck plane-mirror-controls"><RangeControl label="物体到镜面距离" value={objectDistance} min={90} max={260} step={5} unit="格" onChange={setObjectDistance} onInteract={interact} /><RangeControl label="观察者左右位置" value={observerPosition} min={-100} max={100} step={5} unit="%" onChange={setObserverPosition} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>对应基础规律 · 光的反射</span><strong>{interacted ? "虚像由反射光的反向延长线相交形成" : "先移动物体或观察者"}</strong><p>{interacted ? screenPlaced ? "光屏没有接到真实会聚的光，因此不能呈现清晰的像。" : "左右移动观察者会改变反射点和可见光路，但像的位置、大小不变。" : "操作后会同步显示光路、虚像和实验结论。"}</p></div></div>
    <PlaneMirrorLifeTechnology />
  </div>;
}

type CurvedMirrorType = "concave" | "convex";
type CurvedMirrorView = "3d" | "2d";

function CurvedMirrorModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mirror, setMirror] = useState<CurvedMirrorType>("concave");
  const [viewMode, setViewMode] = useState<CurvedMirrorView>("3d");
  const [objectDistance, setObjectDistance] = useState(250);
  const [interacted, setInteracted] = useState(false);
  const mirrorX = 650;
  const axisY = 225;
  const objectX = mirrorX - objectDistance;
  const objectTop = 125;
  const mirrorResult = calculateSphericalMirror(mirror, objectDistance, 120);
  const { atFocus, imageDistance, magnification, real, nature } = mirrorResult;
  const imageX = Number.isFinite(imageDistance) ? mirrorX - imageDistance : 55;
  const imageTop = Number.isFinite(magnification) ? axisY - magnification * (axisY - objectTop) : axisY;
  const mirrorPoint1 = { x: mirrorX, y: objectTop };
  const mirrorPoint2 = { x: mirrorX, y: axisY };
  const virtualEnd = (point: { x: number; y: number }) => ({ x: 85, y: point.y + (point.y - imageTop) * (mirrorX - 85) / Math.max(45, imageX - mirrorX) });
  const end1 = virtualEnd(mirrorPoint1);
  const end2 = virtualEnd(mirrorPoint2);
  const changeMirror = (next: CurvedMirrorType) => { setMirror(next); setObjectDistance(250); setInteracted(true); recordHarness("configuration.changed", { experiment: "curved-mirror", control: "曲面镜类型", value: next }); };
  const changeViewMode = (next: CurvedMirrorView) => { setViewMode(next); setInteracted(true); recordHarness("view.changed", { experiment: "curved-mirror", view: next, mirror, objectDistance }); };
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "curved-mirror", action, mirror, objectDistance, nature });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "curved-mirror", view: `3d-${view}`, mirror, objectDistance, nature });

  return <div className="open-experience">
    <ModuleIntro eyebrow="生活·物理·社会 / 凹面镜和凸面镜" title="在二维光路与三维空间之间，看懂曲面镜成像" text="三维模式用于观察弯曲镜面、空间主轴和立体光束；二维模式用于准确辨认物体、焦点 F、曲率中心 C、实像和虚像。两种视图使用同一组物距数据，切换视图不会改变实验结果。" />
    <div className="medium-tabs curved-tabs"><button className={mirror === "concave" ? "active" : ""} onClick={() => changeMirror("concave")}>凹面镜 · 会聚</button><button className={mirror === "convex" ? "active" : ""} onClick={() => changeMirror("convex")}>凸面镜 · 发散</button></div>
    <div className="curved-view-switch" aria-label="选择二维或三维光路视图"><div><span>VIEW MODE / 观察方式</span><strong>{viewMode === "3d" ? "空间实验台" : "课本光路图"}</strong><small>{viewMode === "3d" ? "适合观察镜面曲率与空间光束" : "适合读取 F、C 和成像交点"}</small></div><nav><button className={viewMode === "3d" ? "active" : ""} onClick={() => changeViewMode("3d")}><b>3D</b><span>立体观察</span></button><button className={viewMode === "2d" ? "active" : ""} onClick={() => changeViewMode("2d")}><b>2D</b><span>课本光路</span></button></nav></div>
    <div className={`curved-mirror-lab ${mirror} view-${viewMode} ${viewMode === "3d" ? "ray-law-lab optics-3d-lab" : ""}`}>
      {viewMode === "3d" ? <>
        <Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在搭建三维曲面镜实验台</strong><span>生成弯曲镜面、焦点与空间光束…</span></div>}><CurvedMirrorScene3D mirror={mirror} objectDistance={objectDistance} imageDistance={imageDistance} magnification={magnification} real={real} atFocus={atFocus} nature={nature} interacted={interacted} onInteract={() => setInteracted(true)} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense>
        <div className="curved-3d-legend"><span><i className="incident" />入射光</span><span><i className="reflected" />反射光</span><span><i className="virtual" />反向延长线</span><span><i className="focus" />F 焦点</span></div>
      </> : <>
        <svg viewBox="0 0 900 430" aria-label="凹面镜和凸面镜二维成像光路图">
          <g className="mirror-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="390" key={`cv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={40 + index * 50} y2={40 + index * 50} key={`ch-${index}`} />)}</g>
          <line className="curved-axis" x1="45" y1={axisY} x2="855" y2={axisY} /><text className="curved-axis-label" x="54" y={axisY - 12}>主光轴</text>
          <path className="curved-mirror-surface" d={mirror === "concave" ? "M650 58 Q730 225 650 392" : "M650 58 Q575 225 650 392"} />
          <circle className="focus-mark" cx={mirror === "concave" ? 530 : 770} cy={axisY} r="5" /><text className="curved-point-label" x={mirror === "concave" ? 514 : 754} y="255">F 焦点</text>
          <circle className="center-mark" cx={mirror === "concave" ? 410 : 890} cy={axisY} r="4" /><text className="curved-point-label center-label" x={mirror === "concave" ? 392 : 846} y="205">C 曲率中心</text>
          <g className="curved-object"><line x1={objectX} y1={axisY} x2={objectX} y2={objectTop} /><path d={`M${objectX - 10} ${objectTop + 17} L${objectX} ${objectTop} L${objectX + 10} ${objectTop + 17}`} /><text x={objectX - 18} y="262">物体</text></g>
          {interacted && !atFocus && <g className={`curved-image ${real ? "real" : "virtual"}`}><line x1={imageX} y1={axisY} x2={imageX} y2={imageTop} /><path d={`M${imageX - 9} ${imageTop + (imageTop < axisY ? 15 : -15)} L${imageX} ${imageTop} L${imageX + 9} ${imageTop + (imageTop < axisY ? 15 : -15)}`} /><text x={imageX - 16} y={imageTop < axisY ? imageTop - 15 : imageTop + 29}>{real ? "实像" : "虚像"}</text></g>}
          {interacted && <g className="curved-rays"><path className="incident" d={`M${objectX} ${objectTop} L${mirrorPoint1.x} ${mirrorPoint1.y}`} /><path className="incident second" d={`M${objectX} ${objectTop} L${mirrorPoint2.x} ${mirrorPoint2.y}`} />{atFocus ? <><path className="reflected" d={`M${mirrorPoint1.x} ${mirrorPoint1.y} L80 330`} /><path className="reflected second" d={`M${mirrorPoint2.x} ${mirrorPoint2.y} L80 430`} /></> : real ? <><path className="reflected" d={`M${mirrorPoint1.x} ${mirrorPoint1.y} L${imageX} ${imageTop}`} /><path className="reflected second" d={`M${mirrorPoint2.x} ${mirrorPoint2.y} L${imageX} ${imageTop}`} /></> : <><path className="reflected" d={`M${mirrorPoint1.x} ${mirrorPoint1.y} L${end1.x} ${end1.y}`} /><path className="reflected second" d={`M${mirrorPoint2.x} ${mirrorPoint2.y} L${end2.x} ${end2.y}`} /><path className="virtual-extension" d={`M${mirrorPoint1.x} ${mirrorPoint1.y} L${imageX} ${imageTop}`} /><path className="virtual-extension" d={`M${mirrorPoint2.x} ${mirrorPoint2.y} L${imageX} ${imageTop}`} /></>}</g>}
        </svg>
        <div className="curved-2d-legend"><span><i className="incident" />入射光</span><span><i className="reflected" />反射光</span><span><i className="virtual" />虚线延长线</span></div>
      </>}
      {!interacted && <OpticsInteractionCue text="选择凹面镜或凸面镜，或移动物体" />}
      <div className={`law-readout curved-law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? mirror === "concave" ? "CONCAVE MIRROR READING" : "CONVEX MIRROR READING" : "CURVED MIRROR STANDBY"}</span><strong>{interacted ? nature : "等待选择并调节曲面镜"}</strong><small>{interacted ? atFocus ? "物体位于焦点：反射光近似平行，有限距离内难以成清晰像" : `${real ? "实像可尝试用光屏承接" : "虚像不能用光屏承接"}；当前为 ${viewMode.toUpperCase()} 观察模式` : "黄色为入射光，绿色为反射光，蓝色虚线为反向延长线"}</small></div>
    </div>
    <div className="open-control-deck curved-controls"><RangeControl label="物体到镜面距离" value={objectDistance} min={80} max={360} step={10} unit="格" onChange={setObjectDistance} onInteract={() => setInteracted(true)} /><div className="index-comparison"><span>对应基础规律</span><strong>每一条光线都遵守反射定律</strong><p>曲面各点的法线方向不同，整体表现为会聚或发散。</p></div><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>当前成像特点</span><strong>{interacted ? nature : "先选择镜面并移动物体"}</strong><p>{interacted ? mirror === "convex" ? "继续移动物体，观察虚像是否始终缩小。" : "让物体跨过焦点 F，比较实像与虚像。" : "结果会在操作后出现。"}</p></div></div>
    <section className="dispersion-guide law-experiment-guide curved-mirror-guide" aria-label="凹面镜和凸面镜实验说明"><header><span>EXPERIMENT GUIDE / 实验说明</span><h2>同一组成像数据，为什么要用两种视图观察？</h2><p>二维光路图把空间压缩到主截面，便于判断焦点与成像位置；三维实验台恢复镜面的宽度和光束深度，帮助理解真实光线可以从不同位置照到曲面。</p></header><div><article><i><Focus size={19} /></i><span><small>01 · 先看二维</small><strong>认清主轴、焦点 F 和曲率中心 C</strong><p>切换凹面镜与凸面镜，再让物体跨过焦点。观察实线在哪里真正相交，以及虚线在哪里反向相交。</p></span></article><article><i><ScanLine size={19} /></i><span><small>02 · 再看三维</small><strong>旋转实验台，观察不同深度的代表光线</strong><p>拖动场景或切换正视、俯视视角。无论视角怎样改变，镜面性质和成像结论都不改变。</p></span></article><article><i><NotebookPen size={19} /></i><span><small>03 · 做出比较</small><strong>记录像的正倒、大小、虚实和位置</strong><p>凹面镜的结果会随物距改变；凸面镜始终得到正立、缩小的虚像，并具有扩大视野的特点。</p></span></article></div><footer><b>建议路线：</b>凹面镜先从 360 格逐渐靠近 120 格焦点，再移动到焦点以内；随后切换凸面镜，用相同物距逐项比较。</footer></section>
  </div>;
}

type LensViewMode = "3d" | "2d";
type LensApparatus = "magnifier" | "bench" | "camera" | "eye" | "correction" | "telescope" | "microscope";

function LensDimensionSwitch({ mode, apparatus, onChange }: { mode: LensViewMode; apparatus: string; onChange: (mode: LensViewMode) => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const change = (next: LensViewMode) => { onChange(next); recordHarness("view.changed", { experiment: apparatus, view: next }); };
  return <div className="lens-dimension-switch"><div><span>VIEW MODE / 观察方式</span><strong>{mode === "3d" ? "三维空间光路" : "二维课本光路"}</strong><small>{mode === "3d" ? "旋转、缩放并观察器材之间的空间关系" : "读取焦点、像点和代表光线"}</small></div><div className="lens-dimension-actions"><nav><button className={mode === "3d" ? "active" : ""} onClick={() => change("3d")}><b>3D</b><span>立体实验台</span></button><button className={mode === "2d" ? "active" : ""} onClick={() => change("2d")}><b>2D</b><span>课本示意图</span></button></nav><ExperimentFullscreenButton targetSelector=".open-experience" experiment={apparatus} className="lens-fullscreen-inline" label="全屏展示" hint="边操作边观察" title="全屏展示当前透镜实验" /></div></div>;
}

function LensSystem3DView({ apparatus, objectDistance, focalLength, imageDistance, magnification, real, nature, interacted, screenDistance, secondFocalLength, correctionLens, correctionEffective, onInteract }: { apparatus: LensApparatus; objectDistance: number; focalLength: number; imageDistance: number; magnification: number; real: boolean; nature: string; interacted: boolean; screenDistance?: number; secondFocalLength?: number; correctionLens?: "none" | "convex" | "concave"; correctionEffective?: boolean; onInteract: () => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const recordNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: apparatus, action, objectDistance, focalLength });
  const recordView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: apparatus, view: `3d-${view}`, objectDistance, focalLength });
  return <div className={`lens-system-3d-lab optics-3d-lab apparatus-${apparatus}`}>
    <Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在搭建三维透镜实验台</strong><span>准备透镜、像面与空间光束…</span></div>}><LensSystemScene3D apparatus={apparatus} objectDistance={objectDistance} focalLength={focalLength} imageDistance={imageDistance} magnification={magnification} real={real} nature={nature} interacted={interacted} screenDistance={screenDistance} secondFocalLength={secondFocalLength} correctionLens={correctionLens} correctionEffective={correctionEffective} onInteract={onInteract} onNavigate={recordNavigation} onViewChange={recordView} /></Suspense>
    <PhysicsStageHud apparatus={apparatus} focalLength={focalLength} />
    {!interacted && <OpticsInteractionCue text="调节一个参数，让三维光路开始传播" />}
    <div className="lens-3d-legend"><span><i className="incident" />入射光</span><span><i className="refracted" />折射光</span><span><i className="virtual" />反向延长线</span><span><i className="focus" />焦点 F</span></div>
  </div>;
}

function PhysicsStageHud({ apparatus, focalLength }: { apparatus: LensApparatus; focalLength: number }) {
  const law = apparatus === "telescope" || apparatus === "microscope" ? "物镜成像 → 目镜放大" : apparatus === "correction" ? "矫正镜片 → 改变入射光路" : "1/f = 1/u + 1/v";
  return <div className="physics-stage-hud" aria-hidden="true">
    <div className="physics-law-plate"><small>OPTICAL MODEL</small><strong>{law}</strong><span>f = {focalLength.toFixed(1)}</span></div>
    <div className="physics-axis-ruler"><span>-2F</span><i /><span>-F</span><i className="lens-tick" /><b>主光轴</b><i /><span>F</span><i /><span>2F</span></div>
    <div className="physics-reticle"><i /><i /><span>XY</span></div>
  </div>;
}

const lensGuideCopy: Record<Exclude<LensApparatus, "telescope" | "microscope"> | "instruments", { title: string; intro: string; steps: [string, string, string] }> = {
  magnifier: { title: "从焦点内外，判断放大镜得到什么像", intro: "先用二维视图找到焦点，再旋转三维实验台观察虚像的反向延长线。", steps: ["移动物体跨过焦点 F", "比较像的正倒、大小与虚实", "尝试用光屏验证实像和虚像"] },
  bench: { title: "让物体、透镜和光屏共同决定实验结果", intro: "自由光具座不预设答案，同一组坐标同时驱动二维与三维光路。", steps: ["先固定焦距，只移动物体", "根据像距移动光屏寻找清晰像", "再改变焦距，重复比较"] },
  camera: { title: "镜头成像与感光器对焦，是同一个问题", intro: "相机需要把倒立实像准确落在固定感光器上，自动对焦就是主动减小像面偏差。", steps: ["改变景物距离制造失焦", "手动调节镜头焦距", "启动自动对焦并观察像面移动"] },
  eye: { title: "视网膜固定不动，晶状体主动改变焦距", intro: "眼睛通过调节晶状体，把远近目标的实像重新送到视网膜。", steps: ["先切换远处和近处目标", "比较清晰时所需焦距", "用三维视图观察视网膜位置不变"] },
  correction: { title: "矫正镜片不是替代眼睛，而是提前改变光路", intro: "近视和远视的像点位于视网膜不同位置，需要不同镜片先发散或会聚光线。", steps: ["判断未矫正像点在视网膜哪侧", "分别尝试凹透镜和凸透镜", "观察像点是否重新落在视网膜"] },
  instruments: { title: "两块透镜分工协作，把观察尺度向两端延伸", intro: "望远镜观察远处，显微镜观察近处；两者都依靠物镜先成像，再由目镜继续放大视角。", steps: ["切换望远镜与显微镜", "分别改变物镜和目镜焦距", "比较中间像与最终观察视角"] }
};

function LensModuleGuide({ apparatus }: { apparatus: keyof typeof lensGuideCopy }) {
  const copy = lensGuideCopy[apparatus];
  return <section className="dispersion-guide law-experiment-guide lens-unified-guide"><header><span>EXPERIMENT GUIDE / 实验说明</span><h2>{copy.title}</h2><p>{copy.intro}</p></header><div>{copy.steps.map((step, index) => <article key={step}><i>{String(index + 1).padStart(2, "0")}</i><span><small>观察步骤</small><strong>{step}</strong><p>{index === 0 ? "先确定一个自变量，避免同时改变多个条件。" : index === 1 ? "记录光线真正相交还是只有延长线相交。" : "最后用光屏、感光器或视网膜位置验证判断。"}</p></span></article>)}</div><footer><b>二维与三维共用同一数据：</b>切换视图只改变观察方式，不会改变物距、焦距和成像结论。</footer></section>;
}

function LensReadingStrip({ active, entries }: { active: boolean; entries: Array<{ label: string; value: string; note: string; tone?: "accent" | "warning" }> }) {
  return <section className={`lens-reading-strip ${active ? "is-active" : "is-standby"}`} aria-label="透镜实验实时读数" aria-live="polite">{entries.map((entry, index) => <div className={entry.tone ? `tone-${entry.tone}` : ""} key={`${entry.label}-${index}`}><span>{entry.label}</span><strong>{active ? entry.value : "— —"}</strong><small>{active ? entry.note : index === 0 ? "操作后显示读数" : "等待实验启动"}</small></div>)}</section>;
}

interface SceneProps { scene: typeof initialLensScene; result: ReturnType<typeof calculateLens>; update: (patch: Partial<typeof initialLensScene>, remember?: boolean) => void; }

function MagnifierModule({ scene, result, update }: SceneProps) {
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("3d");
  const interact = () => setInteracted(true);
  const distance = Math.abs(scene.objectX);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const animate = (now: number) => {
      if (now - last > 48) {
        const nextDistance = 16 + Math.sin(now / 1450) * 11.5;
        update({ objectX: -Math.round(nextDistance * 10) / 10 }, false);
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, update]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="MAGNIFIER / 生活观察" title="移动放大镜，看看像什么时候不再“放大”" text="装置不会预先告诉你焦点两侧的答案。移动物体跨过黄色焦点，比较画面方向、大小和光屏状态。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="自动跨越焦点" onInteract={interact} />} />
    <LensDimensionSwitch mode={viewMode} apparatus="magnifier" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView apparatus="magnifier" objectDistance={distance} focalLength={scene.focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={result.nature} interacted={interacted} screenDistance={scene.screenX} onInteract={interact} /> : <div className="experience-canvas"><LensCanvas scene={scene} result={result} onInteract={interact} revealResult={interacted} />{!interacted && <OpticsInteractionCue text="拖动物体，或调节下方距离" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "物距 u", value: `${distance.toFixed(1)} cm`, note: distance < scene.focalLength ? "物体位于焦点以内" : "物体位于焦点以外" }, { label: "焦距 f", value: `${scene.focalLength.toFixed(1)} cm`, note: "黄色标记为焦点 F" }, { label: "像距 v", value: Number.isFinite(result.imageDistance) ? `${result.imageDistance.toFixed(1)} cm` : "∞", note: result.real ? "像在透镜另一侧" : "像与物体同侧" }, { label: "成像结果", value: result.nature, note: `放大率约 ${Math.abs(result.magnification).toFixed(2)}×`, tone: "accent" }]} />
    <div className="open-control-deck"><RangeControl label="物体离透镜" value={distance} min={4} max={28} step={0.5} unit="cm" onChange={(value) => { setPlaying(false); update({ objectX: -value }); }} onInteract={interact} /><RangeControl label="放大镜焦距" value={scene.focalLength} min={8} max={22} step={0.5} unit="cm" onChange={(focalLength) => { setPlaying(false); update({ focalLength }); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "当前观察 · 来自你的操作" : "观察结果尚未生成"}</span><strong>{interacted ? result.nature : "先移动一个器材"}</strong><p>{interacted ? result.real ? "现在可以尝试用光屏承接，并继续改变距离。" : `当前像的大小约为物体的 ${Math.abs(result.magnification).toFixed(1)} 倍。` : "改变物距或焦距后，这里才显示测量结果。"}</p></div></div>
    <LensModuleGuide apparatus="magnifier" />
  </div>;
}

function FreeBenchModule({ scene, result, update, replace }: SceneProps & { replace: (scene: typeof initialLensScene) => void }) {
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("3d");
  const interact = () => setInteracted(true);
  return <div className="open-experience">
    <ModuleIntro eyebrow="FREE OPTICAL BENCH / 自由实验" title="没有指定目标的光具座" text="实验读数初始关闭。拖动物体或光屏解除待机，再根据实际光路寻找清晰像和临界状态。" action={<button onClick={() => { replace(initialLensScene); setInteracted(false); }}><RotateCcw size={15} />重新布置器材</button>} />
    <LensDimensionSwitch mode={viewMode} apparatus="bench" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView apparatus="bench" objectDistance={Math.abs(scene.objectX)} focalLength={scene.focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={result.nature} interacted={interacted} screenDistance={scene.screenX} onInteract={interact} /> : <div className="experience-canvas"><LensCanvas scene={scene} result={result} onInteract={interact} revealResult={interacted} />{!interacted && <OpticsInteractionCue text="拖动物体或光屏，启动实时测量" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "物距 u", value: `${Math.abs(scene.objectX).toFixed(1)} cm`, note: `u / f = ${(Math.abs(scene.objectX) / scene.focalLength).toFixed(2)}` }, { label: "理论像距 v", value: Number.isFinite(result.imageDistance) ? `${result.imageDistance.toFixed(1)} cm` : "∞", note: result.real ? "可在像面附近寻找实像" : "当前为虚像" }, { label: "光屏位置", value: `${scene.screenX.toFixed(1)} cm`, note: `与像面相差 ${Number.isFinite(result.screenError) ? result.screenError.toFixed(1) : "∞"} cm` }, { label: "光屏状态", value: result.screenFocused ? "清晰成像" : result.real ? "尚未对焦" : "不能承接虚像", note: result.nature, tone: result.screenFocused ? "accent" : "warning" }]} />
    <div className="bench-control-grid"><RangeControl label="焦距 f" value={scene.focalLength} min={8} max={30} step={0.5} unit="cm" onChange={(focalLength) => update({ focalLength })} onInteract={interact} /><RangeControl label="物体位置" value={scene.objectX} min={-75} max={-6} step={0.5} unit="cm" onChange={(objectX) => update({ objectX })} onInteract={interact} /><RangeControl label="光屏位置" value={scene.screenX} min={4} max={95} step={0.5} unit="cm" onChange={(screenX) => update({ screenX })} onInteract={interact} /><div className={`bench-live ${interacted && result.screenFocused ? "focused" : ""} ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? result.screenFocused ? "光屏清晰" : result.real ? "光屏尚未对焦" : "当前无法在光屏承接" : "仪器等待操作"}</span><strong>{interacted ? result.nature : "— —"}</strong></div></div>
    <LensModuleGuide apparatus="bench" />
  </div>;
}

function CameraModule() {
  const [objectDistance, setObjectDistance] = useState(100);
  const [focalLength, setFocalLength] = useState(18);
  const sensorDistance = 22;
  const result = calculateLens({ objectX: -objectDistance, lensX: 0, objectHeight: 10, focalLength, screenX: sensorDistance });
  const blur = Math.min(12, result.screenError / 2);
  const [autoFocus, setAutoFocus] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("3d");
  const interact = () => setInteracted(true);
  const targetFocalLength = objectDistance * sensorDistance / (objectDistance + sensorDistance);
  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setInterval(() => {
      setFocalLength((current) => {
        const delta = targetFocalLength - current;
        if (Math.abs(delta) < 0.015) {
          setAutoFocus(false);
          return targetFocalLength;
        }
        return current + delta * 0.12;
      });
    }, 32);
    return () => window.clearInterval(timer);
  }, [autoFocus, targetFocalLength]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="CAMERA LAB / 生活中的透镜" title="拆开一台照相机，亲手完成对焦" text="取景器初始不显示对焦判断。先改变景物距离或镜头焦距，再观察感光器中的清晰程度。" action={<MotionButton running={autoFocus} onClick={() => setAutoFocus((value) => !value)} label="启动自动对焦" auto onInteract={interact} />} />
    <LensDimensionSwitch mode={viewMode} apparatus="camera" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView apparatus="camera" objectDistance={objectDistance} focalLength={focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={result.nature} interacted={interacted} screenDistance={sensorDistance} onInteract={interact} /> : <div className="camera-lab"><div className="camera-object"><i /><span>远处的树</span></div><div className={`camera-rays moving-beams ${interacted ? "" : "paused-beams"}`}><i /><i /><b className="beam-pulse p1" /><b className="beam-pulse p2" /></div><div className={`camera-body ${autoFocus ? "focusing" : ""}`}><div className="camera-lens" /><div className="camera-sensor"><span style={{ filter: `blur(${interacted ? blur : 8}px)`, opacity: interacted ? Math.max(.25, 1 - blur / 14) : .25 }}>🌲</span></div><b>感光器件</b></div><div className={`camera-status ${interacted && result.screenFocused ? "focused" : ""} ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? autoFocus ? "AUTO FOCUSING…" : result.screenFocused ? "FOCUS LOCKED" : "OUT OF FOCUS" : "METER STANDBY"}</span><strong>{interacted ? result.screenFocused ? "对焦成功" : `像面偏差 ${result.screenError.toFixed(1)} cm` : "改变一个参数开始测量"}</strong></div>{!interacted && <OpticsInteractionCue text="移动景物或启动自动对焦" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "景物距离", value: `${objectDistance.toFixed(0)} cm`, note: "改变景物会推动理论像面" }, { label: "镜头焦距", value: `${focalLength.toFixed(2)} cm`, note: autoFocus ? "自动对焦正在调节" : "当前镜头参数" }, { label: "理论像距", value: `${result.imageDistance.toFixed(2)} cm`, note: `感光器固定在 ${sensorDistance} cm` }, { label: "对焦状态", value: result.screenFocused ? "FOCUS LOCKED" : `偏差 ${result.screenError.toFixed(2)} cm`, note: result.screenFocused ? "清晰倒立实像落在感光器上" : "继续缩小像面偏差", tone: result.screenFocused ? "accent" : "warning" }]} />
    <div className="open-control-deck"><RangeControl label="景物距离" value={objectDistance} min={45} max={180} step={5} unit="cm" onChange={(value) => { setAutoFocus(false); setObjectDistance(value); }} onInteract={interact} /><RangeControl label="镜头焦距" value={focalLength} min={12} max={21} step={0.01} unit="cm" onChange={(value) => { setAutoFocus(false); setFocalLength(value); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "相机里的像 · 动态感光" : "还没有获得观察"}</span><strong>{interacted ? result.nature : "先完成一次对焦尝试"}</strong><p>{interacted ? "继续改变景物距离，看看清晰状态能否保持。" : "操作后再判断像的性质。"}</p></div></div>
    <LensModuleGuide apparatus="camera" />
  </div>;
}

function EyeModule() {
  const [target, setTarget] = useState<"near" | "far">("far");
  const [focalLength, setFocalLength] = useState(16.9);
  const objectDistance = target === "far" ? 3000 : 300;
  const retinaDistance = 17;
  const result = calculateLens({ objectX: -objectDistance, lensX: 0, objectHeight: 8, focalLength, screenX: retinaDistance });
  const clarity = Math.abs(result.imageDistance - retinaDistance);
  const [accommodating, setAccommodating] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("3d");
  const interact = () => setInteracted(true);
  const targetFocalLength = objectDistance * retinaDistance / (objectDistance + retinaDistance);
  useEffect(() => {
    if (!accommodating) return;
    const timer = window.setInterval(() => {
      setFocalLength((current) => {
        const delta = targetFocalLength - current;
        if (Math.abs(delta) < 0.002) {
          setAccommodating(false);
          return targetFocalLength;
        }
        return current + delta * 0.13;
      });
    }, 32);
    return () => window.clearInterval(timer);
  }, [accommodating, targetFocalLength]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="EYE LAB / 人体中的物理" title="视网膜不能移动，眼睛怎样看清远近？" text="先切换观察目标，再尝试改变晶状体。只有操作以后，平台才显示像距与清晰状态。" action={<MotionButton running={accommodating} onClick={() => setAccommodating((value) => !value)} label="模拟晶状体调节" auto onInteract={interact} />} />
    <div className="medium-tabs lens-context-tabs eye-target-tabs"><button className={target === "far" ? "active" : ""} onClick={() => { setTarget("far"); setAccommodating(false); interact(); }}>看远处 · 山</button><button className={target === "near" ? "active" : ""} onClick={() => { setTarget("near"); setAccommodating(false); interact(); }}>看近处 · 书</button></div>
    <LensDimensionSwitch mode={viewMode} apparatus="eye" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView apparatus="eye" objectDistance={objectDistance} focalLength={focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={clarity < .15 ? "视网膜成像清晰" : "像点尚未落在视网膜"} interacted={interacted} screenDistance={retinaDistance} onInteract={interact} /> : <div className="eye-lab"><div className={`eyeball ${accommodating ? "accommodating" : ""} ${interacted ? "" : "optics-dormant"}`}><div className="crystalline-lens" style={{ transform: `scaleX(${.75 + (17.2 - focalLength) * .18})` }} /><div className="retina"><span style={{ filter: `blur(${interacted ? Math.min(9, clarity * 7) : 8}px)` }}>A</span></div><i className="eye-ray one" /><i className="eye-ray two" /><b className="eye-photon one" /><b className="eye-photon two" /></div><div className={`eye-status ${interacted && clarity < .15 ? "clear" : ""} ${interacted ? "" : "awaiting-reading"}`}><Eye size={21} /><strong>{interacted ? accommodating ? "晶状体正在调节" : clarity < .15 ? "视网膜成像清晰" : "晶状体还需调节" : "视网膜读数待测"}</strong><span>{interacted ? `像距 ${result.imageDistance.toFixed(2)} mm / 视网膜 17 mm` : "先切换远近目标或调节焦距"}</span></div>{!interacted && <OpticsInteractionCue text="选择看远处或看近处" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "观察目标", value: target === "far" ? "远处的山" : "手中的书", note: `等效物距 ${objectDistance} mm` }, { label: "晶状体焦距", value: `${focalLength.toFixed(2)} mm`, note: accommodating ? "晶状体正在连续调节" : "当前等效焦距" }, { label: "像距", value: `${result.imageDistance.toFixed(2)} mm`, note: "视网膜固定在 17.00 mm" }, { label: "清晰状态", value: clarity < .15 ? "清晰" : "仍需调节", note: `像面偏差 ${clarity.toFixed(2)} mm`, tone: clarity < .15 ? "accent" : "warning" }]} />
    <div className="open-control-deck eye-control"><RangeControl label="晶状体等效焦距" value={focalLength} min={15.5} max={17.2} step={0.01} unit="mm" onChange={(value) => { setAccommodating(false); setFocalLength(value); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "比较实验" : "等待第一次调节"}</span><strong>{interacted ? "切换远近目标，再比较所需焦距" : "先让眼睛看向不同距离"}</strong><p>你看到的变化比预先给出的结论更重要。</p></div></div>
    <LensModuleGuide apparatus="eye" />
  </div>;
}

function CorrectionModule() {
  const [condition, setCondition] = useState<"myopia" | "hyperopia">("myopia");
  const [lens, setLens] = useState<"none" | "convex" | "concave">("none");
  const [playing, setPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("3d");
  const correct = (condition === "myopia" && lens === "concave") || (condition === "hyperopia" && lens === "convex");
  const tried = lens !== "none";
  const imageDistance = correct ? 17 : condition === "myopia" ? lens === "convex" ? 12.8 : 14.4 : lens === "concave" ? 22.2 : 20.4;
  useEffect(() => {
    if (!playing) return;
    const sequence: Array<"none" | "concave" | "convex"> = ["none", "concave", "convex"];
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % sequence.length;
      setLens(sequence[index]!);
      if (index === 0) setCondition((value) => value === "myopia" ? "hyperopia" : "myopia");
    }, 1700);
    return () => window.clearInterval(timer);
  }, [playing]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="VISION CORRECTION / 选择与验证" title="给这只眼睛选择一副合适的镜片" text="可以随意切换眼睛状态和镜片，不扣分。观察镜片怎样让像向前或向后移动。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="自动比较镜片" />} />
    <div className="medium-tabs lens-context-tabs correction-condition-tabs"><button className={condition === "myopia" ? "active" : ""} onClick={() => { setPlaying(false); setCondition("myopia"); setLens("none"); }}>近视眼 · 像在视网膜前</button><button className={condition === "hyperopia" ? "active" : ""} onClick={() => { setPlaying(false); setCondition("hyperopia"); setLens("none"); }}>远视眼 · 像在视网膜后</button></div>
    <LensDimensionSwitch mode={viewMode} apparatus="correction" onChange={setViewMode} />
    {viewMode === "3d" ? <LensSystem3DView apparatus="correction" objectDistance={3000} focalLength={16.9} imageDistance={imageDistance} magnification={-.18} real nature={condition === "myopia" ? "近视眼成像与矫正" : "远视眼成像与矫正"} interacted={tried} screenDistance={17} correctionLens={lens} correctionEffective={correct} onInteract={() => undefined} /> : <div className="correction-lab"><div className="correction-scene"><div className={`trial-lens ${lens}`}><span>{lens === "none" ? "未佩戴" : lens === "convex" ? ")(" : "()"}</span></div><div className={`correction-rays moving-beams ${tried ? "" : "paused-beams"}`}><i /><i /><b className="beam-pulse p1" /><b className="beam-pulse p2" /></div><div className="correction-eye"><b /><span className={`fault-image ${correct ? "correct" : condition}`} /></div><p>{tried ? correct ? "像已经回到视网膜" : "像的位置仍然不合适" : "选择一块镜片，再观察像怎样移动"}</p></div></div>}
    <LensReadingStrip active={tried} entries={[{ label: "眼睛状态", value: condition === "myopia" ? "近视眼" : "远视眼", note: condition === "myopia" ? "未矫正像在视网膜前" : "未矫正像在视网膜后" }, { label: "试戴镜片", value: lens === "concave" ? "凹透镜" : lens === "convex" ? "凸透镜" : "未佩戴", note: lens === "concave" ? "先使光线发散" : "先使光线会聚" }, { label: "简化像点", value: `${imageDistance.toFixed(1)} mm`, note: "视网膜位置为 17.0 mm" }, { label: "矫正判断", value: correct ? "像点回到视网膜" : "尚未完成矫正", note: correct ? "选择与眼睛状态匹配" : "换另一块镜片继续比较", tone: correct ? "accent" : "warning" }]} />
    <div className="correction-lens-deck"><span>选择矫正镜片</span><div className="lens-choices correction-lens-choices"><button className={lens === "none" ? "active" : ""} onClick={() => { setPlaying(false); setLens("none"); }}>不戴镜片</button><button className={lens === "concave" ? "active" : ""} onClick={() => { setPlaying(false); setLens("concave"); }}>凹透镜</button><button className={lens === "convex" ? "active" : ""} onClick={() => { setPlaying(false); setLens("convex"); }}>凸透镜</button></div></div>
    <div className={`correction-feedback correction-feedback-docked ${tried && correct ? "correct" : ""} ${tried ? "" : "awaiting-reading"}`}><Glasses size={22} /><div><strong>{tried ? correct ? "矫正有效" : "这块镜片没有完成矫正" : "等待你的镜片选择"}</strong><p>{tried ? correct ? condition === "myopia" ? "凹透镜先使光发散，让像点后移到视网膜。" : "凸透镜先使光会聚，让像点前移到视网膜。" : "比较像点相对视网膜的位置，再换另一块镜片。" : "平台不会提前标出正确选项。"}</p></div></div>
    <LensModuleGuide apparatus="correction" />
  </div>;
}

function InstrumentsModule() {
  const [instrument, setInstrument] = useState<"telescope" | "microscope">("telescope");
  const [objectiveF, setObjectiveF] = useState(60);
  const [eyepieceF, setEyepieceF] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("3d");
  const interact = () => setInteracted(true);
  const magnification = instrument === "telescope" ? objectiveF / eyepieceF : (160 / Math.max(8, objectiveF)) * (25 / eyepieceF);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = 0;
    const animate = (now: number) => {
      if (now - last > 55) {
        if (instrument === "telescope") {
          setObjectiveF(65 + Math.sin(now / 1100) * 25);
          setEyepieceF(11 + Math.cos(now / 1450) * 4);
        } else {
          setObjectiveF(17 + Math.sin(now / 1250) * 7);
          setEyepieceF(10 + Math.cos(now / 1500) * 4);
        }
        last = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [instrument, playing]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="TWO-LENS SYSTEM / 组合实验" title="把两块透镜组合，视野会延伸到哪里？" text="初始视野与放大读数保持关闭。选择仪器并改变两块透镜的焦距，结果才随操作显现。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="自动比较焦距" onInteract={interact} />} />
    <div className="instrument-switch"><button className={instrument === "telescope" ? "active" : ""} onClick={() => { setPlaying(false); setInstrument("telescope"); setObjectiveF(60); setEyepieceF(10); interact(); }}><Telescope size={23} /><span>望远镜</span></button><button className={instrument === "microscope" ? "active" : ""} onClick={() => { setPlaying(false); setInstrument("microscope"); setObjectiveF(16); setEyepieceF(8); interact(); }}><Microscope size={23} /><span>显微镜</span></button></div>
    <LensDimensionSwitch mode={viewMode} apparatus="instruments" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView apparatus={instrument} objectDistance={instrument === "telescope" ? 1200 : 28} focalLength={objectiveF} imageDistance={objectiveF * 1.25} magnification={-Math.min(2.2, magnification / 8)} real nature={instrument === "telescope" ? "物镜先成中间像，目镜放大视角" : "物镜先成放大实像，目镜再次放大"} interacted={interacted} secondFocalLength={eyepieceF} onInteract={interact} /> : <div className={`instrument-lab ${instrument}`}><div className="instrument-object">{instrument === "telescope" ? "🌙" : "🦠"}<span>{instrument === "telescope" ? "遥远的月球" : "微小的细胞"}</span></div><div className={`double-lens moving-beams ${interacted ? "" : "paused-beams"}`}><i /><b /><i /><b /><span className="instrument-photon first" /><span className="instrument-photon second" /></div><div className={`instrument-view ${interacted ? "" : "awaiting-reading"}`}><span style={{ transform: `scale(${interacted ? Math.min(2.4, .65 + magnification / 10) : .7})`, filter: interacted ? "none" : "blur(7px)" }}>{instrument === "telescope" ? "🌙" : "🦠"}</span></div><div className={`magnification-readout ${interacted ? "" : "awaiting-reading"}`}><small>{interacted ? playing ? "正在动态比较" : "本次简化读数" : "等待透镜调节"}</small><strong>{interacted ? `${magnification.toFixed(1)}×` : "— —"}</strong></div>{!interacted && <OpticsInteractionCue text="选择仪器或改变任一焦距" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "当前仪器", value: instrument === "telescope" ? "望远镜" : "显微镜", note: instrument === "telescope" ? "观察遥远目标" : "观察微小近物" }, { label: "物镜焦距", value: `${objectiveF.toFixed(1)} mm`, note: "物镜首先形成中间像" }, { label: "目镜焦距", value: `${eyepieceF.toFixed(1)} mm`, note: "目镜继续放大观察视角" }, { label: "简化放大率", value: `${magnification.toFixed(1)}×`, note: playing ? "正在连续比较焦距组合" : "调节两块透镜继续比较", tone: "accent" }]} />
    <div className="open-control-deck"><RangeControl label="物镜焦距" value={objectiveF} min={instrument === "telescope" ? 30 : 8} max={instrument === "telescope" ? 100 : 30} step={1} unit="mm" onChange={(value) => { setPlaying(false); setObjectiveF(value); }} onInteract={interact} /><RangeControl label="目镜焦距" value={eyepieceF} min={5} max={20} step={1} unit="mm" onChange={(value) => { setPlaying(false); setEyepieceF(value); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "自由比较 · 来自你的操作" : "还没有比较记录"}</span><strong>{interacted ? "继续改变两块透镜焦距" : "先选择并调节一套组合"}</strong><p>{interacted ? "哪种组合能得到更大的视角？" : "结果不会在操作之前显示。"}</p></div></div>
    <LensModuleGuide apparatus="instruments" />
  </div>;
}

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

function ModuleIntro({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <header className="open-module-intro"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div><PhysicsHeaderMotif kind={resolvePhysicsMotif(eyebrow, title)} />{action}</header>;
}

function MotionButton({ running, onClick, label, auto = false, onInteract }: { running: boolean; onClick: () => void; label: string; auto?: boolean; onInteract?: () => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const toggle = () => { onClick(); onInteract?.(); recordHarness("simulation.toggled", { running: !running, action: label }); };
  return <button className={`motion-button ${running ? "running" : ""}`} onClick={toggle}>{running ? <Pause size={15} /> : auto ? <WandSparkles size={15} /> : <Play size={15} />}{running ? "暂停动态" : label}</button>;
}

function RangeControl({ label, value, min, max, step, unit, onChange, onInteract }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; onInteract?: () => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const change = (next: number) => { onChange(next); onInteract?.(); recordHarness("control.changed", { control: label, value: next, unit }); };
  return <label className="open-range"><span><b>{label}</b><output>{value.toFixed(step < .1 ? 2 : 1)} {unit}</output></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => change(Number(event.target.value))} /></label>;
}

function OpticsInteractionCue({ text }: { text: string }) {
  return <div className="interaction-cue optics-cue"><Focus size={18} /><span><small>光学装置等待操作</small><strong>{text}</strong></span></div>;
}
