import { lazy, useState, useEffect, Suspense } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { calculateRefraction } from "@physics-lab/physics";
import { RefractionDiagram2D } from "./components/OpticsLawDiagram2D";
import { OpticsSceneErrorBoundary } from "./components/OpticsSceneErrorBoundary";
import { Info, WandSparkles, Eye } from "lucide-react";
import { type LawViewMode, LawDimensionSwitch, LawPresets } from "./shared/LawControls";
import { ModuleIntro, MotionButton, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";
import { NegativeRefractionLife } from "./applications/NegativeRefractionLife";
import { formatOpticsAngle } from "./shared/formatOpticsAngle";

const RefractionScene3D = lazy(async () => {
  const module = await import("./components/OpticsLawScene3D");
  return { default: module.RefractionScene3D };
});

type RefractionRoute = "air-water" | "air-glass" | "water-air";

export function RefractionReadout({ result, interacted }: { result: ReturnType<typeof calculateRefraction>; interacted: boolean }) {
  const { incidenceAngle, refractionAngle, totalInternalReflection } = result;
  const observation = totalInternalReflection
    ? "继续减小入射角，寻找折射光重新出现的位置"
    : incidenceAngle === 0
      ? "垂直入射，传播方向不偏折"
      : Math.abs(refractionAngle! - 90) < 1e-7
        ? "临界状态：折射方向沿分界面，折射角为90°"
        : Math.abs(refractionAngle! - incidenceAngle) < 1e-9
          ? "传播方向不偏折"
          : refractionAngle! < incidenceAngle ? "折射光向法线偏折" : "折射光远离法线偏折";
  return <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}>
    <span>{interacted ? totalInternalReflection ? "TOTAL INTERNAL REFLECTION" : "SNELL PATH READING" : "INTERFACE STANDBY"}</span>
    <strong>{interacted ? totalInternalReflection ? "折射光消失，发生全反射" : `入射角 ${formatOpticsAngle(incidenceAngle)}°　折射角 ${formatOpticsAngle(refractionAngle!, 1, true)}°` : "等待光进入第二种介质"}</strong>
    <small>{interacted ? observation : "垂直入射时，传播方向是否改变？"}</small>
  </div>;
}

export function RefractionModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [route, setRoute] = useState<RefractionRoute>("air-water");
  const [angle, setAngle] = useState(38);
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LawViewMode>("2d");
  const media = route === "air-water" ? { top: "空气", bottom: "水", n1: 1, n2: 1.33 } : route === "air-glass" ? { top: "空气", bottom: "玻璃", n1: 1, n2: 1.52 } : { top: "水", bottom: "空气", n1: 1.33, n2: 1 };
  const result = calculateRefraction(angle, media.n1, media.n2);
  const criticalAngle = media.n1 > media.n2 ? Math.asin(media.n2 / media.n1) * 180 / Math.PI : null;
  const interact = () => setInteracted(true);
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "refraction", action, route, angle, refractionAngle: result.refractionAngle ?? null, totalInternalReflection: result.totalInternalReflection });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "refraction", view, route, angle, refractionAngle: result.refractionAngle ?? null, totalInternalReflection: result.totalInternalReflection });
  const changeViewMode = (next: LawViewMode) => { setViewMode(next); recordHarness("view.changed", { experiment: "refraction", view: next, route, angle }); };
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => setAngle((value) => value >= 72 ? 5 : value + 1), 60); return () => window.clearInterval(timer); }, [playing]);
  const changeRoute = (next: RefractionRoute) => { setRoute(next); setInteracted(true); recordHarness("configuration.changed", { control: "传播介质", value: next }); };

  return <div className="open-experience">
    <ModuleIntro eyebrow="CHAPTER 3 / 光的折射" title="让光跨过空气、水和玻璃的边界" text="改变入射角或交换传播方向，比较折射光相对法线是靠近还是远离。水射向空气时继续增大角度，还能找到折射光消失的临界现象。" action={<MotionButton running={playing} onClick={() => setPlaying((value) => !value)} label="连续扫描入射角" onInteract={interact} />} />
    <div className="medium-tabs"><button className={route === "air-water" ? "active" : ""} onClick={() => changeRoute("air-water")}>空气 → 水</button><button className={route === "air-glass" ? "active" : ""} onClick={() => changeRoute("air-glass")}>空气 → 玻璃</button><button className={route === "water-air" ? "active" : ""} onClick={() => changeRoute("water-air")}>水 → 空气</button></div>
    <LawDimensionSwitch mode={viewMode} apparatus="refraction" onChange={changeViewMode} />
    <LawPresets label={criticalAngle == null ? "比较不同入射角的折射方向" : `寻找临界角（C ${formatOpticsAngle(criticalAngle)}°）`} activeValue={angle} activeTolerance={1e-9} options={criticalAngle == null ? [{ label: "垂直入射", value: 0, note: "方向不偏折" }, { label: "小角度", value: 25, note: "观察轻微偏折" }, { label: "标准测量", value: 40, note: "比较介质差异" }, { label: "大角度", value: 60, note: "偏折更明显" }] : [{ label: "垂直入射", value: 0, note: "方向不偏折" }, { label: "临界角前", value: 48, note: "仍有折射光" }, { label: "临界状态", value: criticalAngle, note: "使用精确临界角 · r = 90°" }, { label: "全反射", value: 60, note: "折射光消失" }]} onSelect={(value) => { setPlaying(false); setAngle(value); interact(); recordHarness("configuration.changed", { experiment: "refraction", control: "快捷入射角", value, route }); }} />
    <div className={`ray-law-lab refraction-lab view-${viewMode} ${viewMode === "3d" ? "optics-3d-lab" : "optics-2d-lab"} medium-${route}`}>
      {viewMode === "2d"
        ? <RefractionDiagram2D angle={angle} refractionAngle={result.refractionAngle} totalInternalReflection={result.totalInternalReflection} topMedium={media.top} bottomMedium={media.bottom} interacted={interacted} />
        : <OpticsSceneErrorBoundary onUse2D={() => changeViewMode("2d")} label="三维折射实验台"><Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在装配三维折射实验台</strong><span>加载介质、分界面与空间光线…</span></div>}><RefractionScene3D angle={angle} refractionAngle={result.refractionAngle} totalInternalReflection={result.totalInternalReflection} topMedium={media.top} bottomMedium={media.bottom} interacted={interacted} onInteract={interact} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense></OpticsSceneErrorBoundary>}
      {!interacted && <OpticsInteractionCue text="选择介质或改变入射角，让折射光出现" />}
      <RefractionReadout result={result} interacted={interacted} />
    </div>
    <div className="open-control-deck refraction-controls"><RangeControl label="入射角 α" value={angle} min={0} max={78} step={1} unit="°" formatValue={formatOpticsAngle} onChange={(value) => { setPlaying(false); setAngle(value); }} onInteract={interact} /><div className="index-comparison"><span>当前介质</span><strong>{media.top} n={media.n1} → {media.bottom} n={media.n2}</strong><p>折射率越大，光在该介质中的传播速度越小。</p>{criticalAngle != null && <p>临界预设保留精确角度；≈ 仅表示显示近似，不会回写模型。</p>}</div><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "比较建议" : "尚未开始"}</span><strong>{interacted ? "保持角度不变，再换一种介质" : "先选择一条传播路线"}</strong><p>{interacted ? "比较水和玻璃中的折射角，寻找介质差异。" : "结果将在操作后出现。"}</p></div></div>
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
