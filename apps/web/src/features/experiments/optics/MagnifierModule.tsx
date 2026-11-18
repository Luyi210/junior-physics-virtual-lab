import { useState, useEffect, Suspense } from "react";
import { type SceneProps, type LensViewMode, LensDimensionSwitch, LensSystem3DView, LensViewLoading, LensCanvas, LensReadingStrip, LensModuleGuide } from "./shared/LensControls";
import { ModuleIntro, MotionButton, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

export function MagnifierModule({ scene, result, update }: SceneProps) {
  const [playing, setPlaying] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("2d");
  const interact = () => setInteracted(true);
  const distance = Math.abs(scene.objectX);
  const atFocus = !Number.isFinite(result.imageDistance);
  const positionNote = atFocus ? "物体恰好位于焦点" : distance < scene.focalLength ? "物体位于焦点以内" : "物体位于焦点以外";
  const imageSideNote = atFocus ? "出射光近似平行，像在无穷远" : result.real ? "像在透镜另一侧" : "像与物体同侧";
  const magnificationNote = atFocus ? "有限距离内不能得到清晰像" : `放大率约 ${Math.abs(result.magnification).toFixed(2)}×`;
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
    {viewMode === "3d" ? <LensSystem3DView onUse2D={() => setViewMode("2d")} apparatus="magnifier" objectDistance={distance} focalLength={scene.focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={result.nature} interacted={interacted} screenDistance={scene.screenX} onInteract={interact} /> : <div className="experience-canvas"><Suspense fallback={<LensViewLoading />}><LensCanvas scene={scene} result={result} onInteract={interact} revealResult={interacted} /></Suspense>{!interacted && <OpticsInteractionCue text="拖动物体，或调节下方距离" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "物距 u", value: `${distance.toFixed(1)} cm`, note: positionNote }, { label: "焦距 f", value: `${scene.focalLength.toFixed(1)} cm`, note: "黄色标记为焦点 F" }, { label: "像距 v", value: Number.isFinite(result.imageDistance) ? `${result.imageDistance.toFixed(1)} cm` : "∞", note: imageSideNote }, { label: "成像结果", value: result.nature, note: magnificationNote, tone: "accent" }]} />
    <div className="open-control-deck"><RangeControl label="物体离透镜" value={distance} min={4} max={28} step={0.5} unit="cm" onChange={(value) => { setPlaying(false); update({ objectX: -value }); }} onInteract={interact} /><RangeControl label="放大镜焦距" value={scene.focalLength} min={8} max={22} step={0.5} unit="cm" onChange={(focalLength) => { setPlaying(false); update({ focalLength }); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "当前观察 · 来自你的操作" : "观察结果尚未生成"}</span><strong>{interacted ? result.nature : "先移动一个器材"}</strong><p>{interacted ? atFocus ? "物体恰好位于焦点，出射光近似平行，有限距离内不能承接清晰像。" : result.real ? "现在可以尝试用光屏承接，并继续改变距离。" : `当前像的大小约为物体的 ${Math.abs(result.magnification).toFixed(1)} 倍。` : "改变物距或焦距后，这里才显示测量结果。"}</p></div></div>
    <LensModuleGuide apparatus="magnifier" />
  </div>;
}
