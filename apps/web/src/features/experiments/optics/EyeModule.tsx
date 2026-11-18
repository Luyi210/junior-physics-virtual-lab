import { useHarnessStore } from "../../assistant/harnessStore";
import { useState, useEffect } from "react";
import { calculateLens } from "@physics-lab/physics";
import { Eye } from "lucide-react";
import { type LensViewMode, LensDimensionSwitch, LensSystem3DView, LensReadingStrip, LensModuleGuide } from "./shared/LensControls";
import { ModuleIntro, MotionButton, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

export function EyeModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [target, setTarget] = useState<"near" | "far">("far");
  const [focalLength, setFocalLength] = useState(16.9);
  const objectDistance = target === "far" ? 3000 : 300;
  const retinaDistance = 17;
  const result = calculateLens({ objectX: -objectDistance, lensX: 0, objectHeight: 8, focalLength, screenX: retinaDistance });
  const clarity = Math.abs(result.imageDistance - retinaDistance);
  const [accommodating, setAccommodating] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("2d");
  const interact = () => setInteracted(true);
  const changeTarget = (next: "near" | "far") => { setTarget(next); setAccommodating(false); interact(); recordHarness("configuration.changed", { experiment: "eye", control: "观察目标", value: next }); };
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
        return current + delta * 0.2;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, [accommodating, targetFocalLength]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="EYE LAB / 人体中的物理" title="视网膜不能移动，眼睛怎样看清远近？" text="先切换观察目标，再尝试改变晶状体。只有操作以后，平台才显示像距与清晰状态。" action={<MotionButton running={accommodating} onClick={() => setAccommodating((value) => !value)} label="模拟晶状体调节" auto onInteract={interact} />} />
    <div className="medium-tabs lens-context-tabs eye-target-tabs"><button className={target === "far" ? "active" : ""} onClick={() => changeTarget("far")}>看远处 · 山</button><button className={target === "near" ? "active" : ""} onClick={() => changeTarget("near")}>看近处 · 书</button></div>
    <LensDimensionSwitch mode={viewMode} apparatus="eye" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView onUse2D={() => setViewMode("2d")} apparatus="eye" objectDistance={objectDistance} focalLength={focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={clarity < .15 ? "视网膜成像清晰" : "像点尚未落在视网膜"} interacted={interacted} screenDistance={retinaDistance} onInteract={interact} /> : <div className="eye-lab"><div className={`eyeball ${accommodating ? "accommodating" : ""} ${interacted ? "" : "optics-dormant"}`}><div className="crystalline-lens" style={{ transform: `scaleX(${.75 + (17.2 - focalLength) * .18})` }} /><div className="retina"><span style={{ filter: `blur(${interacted ? Math.min(9, clarity * 7) : 8}px)` }}>A</span></div><i className="eye-ray one" /><i className="eye-ray two" /><b className="eye-photon one" /><b className="eye-photon two" /></div><div className={`eye-status ${interacted && clarity < .15 ? "clear" : ""} ${interacted ? "" : "awaiting-reading"}`}><Eye size={21} /><strong>{interacted ? accommodating ? "晶状体正在调节" : clarity < .15 ? "视网膜成像清晰" : "晶状体还需调节" : "视网膜读数待测"}</strong><span>{interacted ? `像距 ${result.imageDistance.toFixed(2)} mm / 视网膜 17 mm` : "先切换远近目标或调节焦距"}</span></div>{!interacted && <OpticsInteractionCue text="选择看远处或看近处" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "观察目标", value: target === "far" ? "远处的山" : "手中的书", note: `等效物距 ${objectDistance} mm` }, { label: "晶状体焦距", value: `${focalLength.toFixed(2)} mm`, note: accommodating ? "晶状体正在连续调节" : "当前等效焦距" }, { label: "像距", value: `${result.imageDistance.toFixed(2)} mm`, note: "视网膜固定在 17.00 mm" }, { label: "清晰状态", value: clarity < .15 ? "清晰" : "仍需调节", note: `像面偏差 ${clarity.toFixed(2)} mm`, tone: clarity < .15 ? "accent" : "warning" }]} />
    <div className="open-control-deck eye-control"><RangeControl label="晶状体等效焦距" value={focalLength} min={15.5} max={17.2} step={0.01} unit="mm" onChange={(value) => { setAccommodating(false); setFocalLength(value); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "比较实验" : "等待第一次调节"}</span><strong>{interacted ? "切换远近目标，再比较所需焦距" : "先让眼睛看向不同距离"}</strong><p>你看到的变化比预先给出的结论更重要。</p></div></div>
    <LensModuleGuide apparatus="eye" />
  </div>;
}
