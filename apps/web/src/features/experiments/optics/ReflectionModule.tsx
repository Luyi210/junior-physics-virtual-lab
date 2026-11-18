import { lazy, useState, useEffect, Suspense } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { calculateReflection } from "@physics-lab/physics";
import { ReflectionDiagram2D } from "./components/OpticsLawDiagram2D";
import { OpticsSceneErrorBoundary } from "./components/OpticsSceneErrorBoundary";
import { Info, WandSparkles, Eye } from "lucide-react";
import { type LawViewMode, LawDimensionSwitch, LawPresets } from "./shared/LawControls";
import { ModuleIntro, MotionButton, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";
import { EuvMirrorLife } from "./applications/EuvMirrorLife";

const ReflectionScene3D = lazy(async () => {
  const module = await import("./components/OpticsLawScene3D");
  return { default: module.ReflectionScene3D };
});

export function ReflectionModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [angle, setAngle] = useState(35);
  const [roughness, setRoughness] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LawViewMode>("2d");
  const result = calculateReflection(angle);
  const interact = () => setInteracted(true);
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "reflection", action, angle, reflectionAngle: result.reflectionAngle, roughness });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "reflection", view, angle, reflectionAngle: result.reflectionAngle, roughness });
  const changeViewMode = (next: LawViewMode) => { setViewMode(next); recordHarness("view.changed", { experiment: "reflection", view: next, angle, roughness }); };
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setAngle((value) => value >= 72 ? 8 : value + 1), 55); return () => window.clearInterval(timer); }, [playing]);

  return <div className="open-experience">
    <ModuleIntro eyebrow="CHAPTER 2 / 光的反射" title="转动入射光，测量镜面两侧的角" text="角度一律从法线量起。先改变入射角，再比较入射光和反射光；也可以逐渐增加表面粗糙度，观察规则反射怎样变成向不同方向散开的反射。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="连续扫描入射角" onInteract={interact} />} />
    <LawDimensionSwitch mode={viewMode} apparatus="reflection" onChange={changeViewMode} />
    <LawPresets label="用四组课本角度快速验证反射定律" activeValue={angle} options={[{ label: "垂直入射", value: 0, note: "i = 0°" }, { label: "小角度", value: 20, note: "i = 20°" }, { label: "标准测量", value: 40, note: "i = 40°" }, { label: "大角度", value: 60, note: "i = 60°" }]} onSelect={(value) => { setPlaying(false); setAngle(value); interact(); recordHarness("configuration.changed", { experiment: "reflection", control: "快捷入射角", value }); }} />
    <div className={`ray-law-lab reflection-lab view-${viewMode} ${viewMode === "3d" ? "optics-3d-lab" : "optics-2d-lab"}`}>
      {viewMode === "2d"
        ? <ReflectionDiagram2D angle={angle} roughness={roughness} interacted={interacted} />
        : <OpticsSceneErrorBoundary onUse2D={() => changeViewMode("2d")} label="三维反射实验台"><Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在装配三维反射实验台</strong><span>加载镜面、光线与空间测量工具…</span></div>}><ReflectionScene3D angle={angle} roughness={roughness} interacted={interacted} onInteract={interact} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense></OpticsSceneErrorBoundary>}
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
