import { useSearchParams, Link } from "react-router-dom";
import { useLensStore, initialLensScene } from "./workbench/lensStore";
import { useMemo, useEffect } from "react";
import { calculateLens } from "@physics-lab/physics";
import { getOpticsInquiryProfile, PhysicsInquiryRibbon } from "../../../shared/components/PhysicsInquiryRibbon";
import { useApparatusDomSync } from "../../assistant/useApparatusDomSync";
import { PageIntroduction } from "../../../shared/components/PageIntroduction";
import { BrandMark } from "../../../shared/components/BrandMark";
import { Focus, Home, Waves, Ruler, CircuitBoard, Flame, Beaker, Atom, Sparkles } from "lucide-react";
import { ExperimentWorkspaceDock } from "../shared/ExperimentWorkspaceDock";
import { type ExploreMode, isMode, modules, opticsIntroCopy } from "./catalog";
import { DispersionModule } from "./DispersionModule";
import { StraightPropagationModule } from "./StraightPropagationModule";
import { ReflectionModule } from "./ReflectionModule";
import { RefractionModule } from "./RefractionModule";
import { ColorMixModule } from "./ColorMixModule";
import { CelestialModule } from "./CelestialModule";
import { PlaneMirrorModule } from "./PlaneMirrorModule";
import { CurvedMirrorModule } from "./CurvedMirrorModule";
import { InvisibleLightModule } from "./InvisibleLightModule";
import { MagnifierModule } from "./MagnifierModule";
import { FreeBenchModule } from "./FreeBenchModule";
import { CameraModule } from "./CameraModule";
import { EyeModule } from "./EyeModule";
import { CorrectionModule } from "./CorrectionModule";
import { InstrumentsModule } from "./InstrumentsModule";

export function StudentLensExplore() {
  const [params, setParams] = useSearchParams();
  const requestedMode = params.get("mode");
  const mode: ExploreMode = isMode(requestedMode) ? requestedMode : "overview";
  const scene = useLensStore((state) => state.scene);
  const update = useLensStore((state) => state.update);
  const replace = useLensStore((state) => state.replace);
  const result = useMemo(() => calculateLens(scene), [scene]);
  const current = modules.find((item) => item.key === mode)!;
  const inquiryProfile = getOpticsInquiryProfile(mode);
  const pageIntro = opticsIntroCopy[mode];

  useEffect(() => {
    if (mode === "magnifier") replace({ ...initialLensScene, objectX: -10, screenX: 38 });
    if (mode === "bench") replace(initialLensScene);
  }, [mode, replace]);

  useApparatusDomSync(mode === "overview" ? undefined : mode, ".explore-module-content > .open-experience");

  const selectMode = (next: ExploreMode) => setParams(next === "overview" ? {} : { mode: next });
  const moduleContent: Record<ExploreMode, React.ReactNode> = {
    overview: <ExploreOverview onSelect={selectMode} />,
    dispersion: <DispersionModule />,
    straight: <StraightPropagationModule />,
    reflection: <ReflectionModule />,
    refraction: <RefractionModule />,
    "color-mix": <ColorMixModule />,
    celestial: <CelestialModule />,
    "plane-mirror": <PlaneMirrorModule />,
    "curved-mirror": <CurvedMirrorModule />,
    "invisible-light": <InvisibleLightModule />,
    magnifier: <MagnifierModule scene={scene} result={result} update={update} />,
    bench: <FreeBenchModule scene={scene} result={result} update={update} replace={replace} />,
    camera: <CameraModule />,
    eye: <EyeModule />,
    correction: <CorrectionModule />,
    instruments: <InstrumentsModule />
  };
  return (
    <div className="student-explore-page science-explore-page science-structure-v2 optics-structure-v2" style={{ "--science-accent": "#53d8c0" } as React.CSSProperties}>
      <OpticsArrowRegistry />
      {pageIntro && <PageIntroduction
        key={mode}
        pageKey={`optics-${mode}`}
        {...pageIntro}
        icon={current.icon}
        accent="#53d8c0"
        variant="optics"
        persistence="local"
        triggerLabel="领域向导"
      />}
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
          {mode !== "overview" && inquiryProfile && <PhysicsInquiryRibbon title={current.title} {...inquiryProfile} />}
          {mode !== "overview" && <ExperimentWorkspaceDock experiment={mode} title={current.title} context={`光现象 · ${current.note}`} targetSelector=".explore-module-content > .open-experience" />}
          <main className="explore-module-content">
            {moduleContent[mode]}
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

function OpticsArrowRegistry() {
  return <svg className="optics-arrow-registry" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <marker id="optics-ray-arrow" viewBox="0 0 10 10" refX="8.2" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M1 1 L9 5 L1 9 Z" fill="context-stroke" /></marker>
      <marker id="optics-ray-arrow-small" viewBox="0 0 10 10" refX="8.2" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M1 1 L9 5 L1 9 Z" fill="context-stroke" /></marker>
      <marker id="optics-virtual-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M1 1 L8 5 L1 9" fill="none" stroke="context-stroke" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker>
    </defs>
  </svg>;
}
