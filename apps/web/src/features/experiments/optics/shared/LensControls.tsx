import { lazy, Suspense } from "react";
import { useHarnessStore } from "../../../assistant/harnessStore";
import { OpticsSceneErrorBoundary } from "../components/OpticsSceneErrorBoundary";
import { initialLensScene } from "../workbench/lensStore";
import { calculateLens } from "@physics-lab/physics";
import { OpticsInteractionCue } from "./OpticsControls";
import { OpticsMobileViewNote } from "./OpticsMobileViewNote";

export const LensCanvas = lazy(async () => {
  const module = await import("../workbench/LensCanvas");
  return { default: module.LensCanvas };
});

const LensSystemScene3D = lazy(async () => {
  const module = await import("../components/OpticsLawScene3D");
  return { default: module.LensSystemScene3D };
});

export type LensViewMode = "3d" | "2d";

type LensApparatus = "magnifier" | "bench" | "camera" | "eye" | "correction" | "telescope" | "microscope";

export function LensDimensionSwitch({ mode, apparatus, onChange }: { mode: LensViewMode; apparatus: string; onChange: (mode: LensViewMode) => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const change = (next: LensViewMode) => { onChange(next); recordHarness("view.changed", { experiment: apparatus, view: next }); };
  return <div className="lens-dimension-switch"><div><span>VIEW MODE / 观察方式</span><strong>{mode === "3d" ? "三维空间光路" : "二维课本光路"}</strong><small>{mode === "3d" ? "旋转、缩放并观察器材之间的空间关系" : "读取焦点、像点和代表光线"}</small><OpticsMobileViewNote mode={mode} /></div><div className="lens-dimension-actions"><nav><button type="button" aria-pressed={mode === "2d"} className={mode === "2d" ? "active" : ""} onClick={() => change("2d")}><b>2D</b><span>课本示意图</span></button><button type="button" aria-pressed={mode === "3d"} className={mode === "3d" ? "active" : ""} onClick={() => change("3d")}><b>3D</b><span>立体实验台</span></button></nav></div></div>;
}

export function LensSystem3DView({ apparatus, objectDistance, focalLength, imageDistance, magnification, real, nature, interacted, screenDistance, secondFocalLength, correctionLens, correctionEffective, onInteract, onUse2D }: { apparatus: LensApparatus; objectDistance: number; focalLength: number; imageDistance: number; magnification: number; real: boolean; nature: string; interacted: boolean; screenDistance?: number; secondFocalLength?: number; correctionLens?: "none" | "convex" | "concave"; correctionEffective?: boolean; onInteract: () => void; onUse2D: () => void }) {
  const recordHarness = useHarnessStore((state) => state.record);
  const recordNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: apparatus, action, objectDistance, focalLength });
  const recordView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: apparatus, view: `3d-${view}`, objectDistance, focalLength });
  return <div className={`lens-system-3d-lab optics-3d-lab apparatus-${apparatus}`}>
    <OpticsSceneErrorBoundary label="三维透镜实验台" onUse2D={() => { onUse2D(); recordHarness("view.changed", { experiment: apparatus, view: "2d", reason: "3d-unavailable" }); }}><Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在搭建三维透镜实验台</strong><span>准备透镜、像面与空间光束…</span></div>}><LensSystemScene3D apparatus={apparatus} objectDistance={objectDistance} focalLength={focalLength} imageDistance={imageDistance} magnification={magnification} real={real} nature={nature} interacted={interacted} screenDistance={screenDistance} secondFocalLength={secondFocalLength} correctionLens={correctionLens} correctionEffective={correctionEffective} onInteract={onInteract} onNavigate={recordNavigation} onViewChange={recordView} /></Suspense></OpticsSceneErrorBoundary>
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

export function LensModuleGuide({ apparatus }: { apparatus: keyof typeof lensGuideCopy }) {
  const copy = lensGuideCopy[apparatus];
  return <section className="dispersion-guide law-experiment-guide lens-unified-guide"><header><span>EXPERIMENT GUIDE / 实验说明</span><h2>{copy.title}</h2><p>{copy.intro}</p></header><div>{copy.steps.map((step, index) => <article key={step}><i>{String(index + 1).padStart(2, "0")}</i><span><small>观察步骤</small><strong>{step}</strong><p>{index === 0 ? "先确定一个自变量，避免同时改变多个条件。" : index === 1 ? "记录光线真正相交还是只有延长线相交。" : "最后用光屏、感光器或视网膜位置验证判断。"}</p></span></article>)}</div><footer><b>二维与三维共用同一数据：</b>切换视图只改变观察方式，不会改变物距、焦距和成像结论。</footer></section>;
}

export function LensReadingStrip({ active, entries }: { active: boolean; entries: Array<{ label: string; value: string; note: string; tone?: "accent" | "warning" }> }) {
  return <section className={`lens-reading-strip ${active ? "is-active" : "is-standby"}`} aria-label="透镜实验实时读数" aria-live="polite">{entries.map((entry, index) => <div className={entry.tone ? `tone-${entry.tone}` : ""} key={`${entry.label}-${index}`}><span>{entry.label}</span><strong>{active ? entry.value : "— —"}</strong><small>{active ? entry.note : index === 0 ? "操作后显示读数" : "等待实验启动"}</small></div>)}</section>;
}

export function LensViewLoading() {
  return <div className="lens-view-loading" role="status"><span /><strong>正在装配二维光路</strong><small>LOADING OPTICAL BENCH</small></div>;
}

export interface SceneProps { scene: typeof initialLensScene; result: ReturnType<typeof calculateLens>; update: (patch: Partial<typeof initialLensScene>, remember?: boolean) => void; }
