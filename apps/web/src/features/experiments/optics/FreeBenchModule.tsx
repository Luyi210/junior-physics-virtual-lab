import { initialLensScene } from "./workbench/lensStore";
import { useState, Suspense } from "react";
import { RotateCcw } from "lucide-react";
import { type SceneProps, type LensViewMode, LensDimensionSwitch, LensSystem3DView, LensViewLoading, LensCanvas, LensReadingStrip, LensModuleGuide } from "./shared/LensControls";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

export function FreeBenchModule({ scene, result, update, replace }: SceneProps & { replace: (scene: typeof initialLensScene) => void }) {
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("2d");
  const interact = () => setInteracted(true);
  return <div className="open-experience">
    <ModuleIntro eyebrow="FREE OPTICAL BENCH / 自由实验" title="没有指定目标的光具座" text="实验读数初始关闭。拖动物体或光屏解除待机，再根据实际光路寻找清晰像和临界状态。" action={<button onClick={() => { replace(initialLensScene); setInteracted(false); }}><RotateCcw size={15} />重新布置器材</button>} />
    <LensDimensionSwitch mode={viewMode} apparatus="bench" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView onUse2D={() => setViewMode("2d")} apparatus="bench" objectDistance={Math.abs(scene.objectX)} focalLength={scene.focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={result.nature} interacted={interacted} screenDistance={scene.screenX} onInteract={interact} /> : <div className="experience-canvas"><Suspense fallback={<LensViewLoading />}><LensCanvas scene={scene} result={result} onInteract={interact} revealResult={interacted} /></Suspense>{!interacted && <OpticsInteractionCue text="拖动物体或光屏，启动实时测量" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "物距 u", value: `${Math.abs(scene.objectX).toFixed(1)} cm`, note: `u / f = ${(Math.abs(scene.objectX) / scene.focalLength).toFixed(2)}` }, { label: "理论像距 v", value: Number.isFinite(result.imageDistance) ? `${result.imageDistance.toFixed(1)} cm` : "∞", note: result.real ? "可在像面附近寻找实像" : "当前为虚像" }, { label: "光屏位置", value: `${scene.screenX.toFixed(1)} cm`, note: `与像面相差 ${Number.isFinite(result.screenError) ? result.screenError.toFixed(1) : "∞"} cm` }, { label: "光屏状态", value: result.screenFocused ? "清晰成像" : result.real ? "尚未对焦" : "不能承接虚像", note: result.nature, tone: result.screenFocused ? "accent" : "warning" }]} />
    <div className="bench-control-grid"><RangeControl label="焦距 f" value={scene.focalLength} min={8} max={30} step={0.5} unit="cm" onChange={(focalLength) => update({ focalLength })} onInteract={interact} /><RangeControl label="物体位置" value={scene.objectX} min={-75} max={-6} step={0.5} unit="cm" onChange={(objectX) => update({ objectX })} onInteract={interact} /><RangeControl label="光屏位置" value={scene.screenX} min={4} max={95} step={0.5} unit="cm" onChange={(screenX) => update({ screenX })} onInteract={interact} /><div className={`bench-live ${interacted && result.screenFocused ? "focused" : ""} ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? result.screenFocused ? "光屏清晰" : result.real ? "光屏尚未对焦" : "当前无法在光屏承接" : "仪器等待操作"}</span><strong>{interacted ? result.nature : "— —"}</strong></div></div>
    <LensModuleGuide apparatus="bench" />
  </div>;
}
