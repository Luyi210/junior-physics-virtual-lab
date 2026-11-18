import { useState, useEffect } from "react";
import { calculateLens } from "@physics-lab/physics";
import { TreePine } from "lucide-react";
import { type LensViewMode, LensDimensionSwitch, LensSystem3DView, LensReadingStrip, LensModuleGuide } from "./shared/LensControls";
import { ModuleIntro, MotionButton, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";

export function CameraModule() {
  const [objectDistance, setObjectDistance] = useState(100);
  const [focalLength, setFocalLength] = useState(18);
  const sensorDistance = 22;
  const result = calculateLens({ objectX: -objectDistance, lensX: 0, objectHeight: 10, focalLength, screenX: sensorDistance });
  const blur = Math.min(12, result.screenError / 2);
  const [autoFocus, setAutoFocus] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [viewMode, setViewMode] = useState<LensViewMode>("2d");
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
        return current + delta * 0.18;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, [autoFocus, targetFocalLength]);
  return <div className="open-experience">
    <ModuleIntro eyebrow="CAMERA LAB / 生活中的透镜" title="拆开一台照相机，亲手完成对焦" text="取景器初始不显示对焦判断。先改变景物距离或镜头焦距，再观察感光器中的清晰程度。" action={<MotionButton running={autoFocus} onClick={() => setAutoFocus((value) => !value)} label="启动自动对焦" auto onInteract={interact} />} />
    <LensDimensionSwitch mode={viewMode} apparatus="camera" onChange={(next) => { setViewMode(next); interact(); }} />
    {viewMode === "3d" ? <LensSystem3DView onUse2D={() => setViewMode("2d")} apparatus="camera" objectDistance={objectDistance} focalLength={focalLength} imageDistance={result.imageDistance} magnification={result.magnification} real={result.real} nature={result.nature} interacted={interacted} screenDistance={sensorDistance} onInteract={interact} /> : <div className="camera-lab"><div className="camera-object"><i /><span>远处的树</span></div><div className={`camera-rays moving-beams ${interacted ? "" : "paused-beams"}`}><i /><i /><b className="beam-pulse p1" /><b className="beam-pulse p2" /></div><div className={`camera-body ${autoFocus ? "focusing" : ""}`}><div className="camera-lens" /><div className="camera-sensor"><TreePine aria-label="感光器件上的倒立树像" style={{ filter: `blur(${interacted ? blur : 8}px)`, opacity: interacted ? Math.max(.25, 1 - blur / 14) : .25 }} /></div><b>感光器件</b></div><div className={`camera-status ${interacted && result.screenFocused ? "focused" : ""} ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? autoFocus ? "AUTO FOCUSING…" : result.screenFocused ? "FOCUS LOCKED" : "OUT OF FOCUS" : "METER STANDBY"}</span><strong>{interacted ? result.screenFocused ? "对焦成功" : `像面偏差 ${result.screenError.toFixed(1)} cm` : "改变一个参数开始测量"}</strong></div>{!interacted && <OpticsInteractionCue text="移动景物或启动自动对焦" />}</div>}
    <LensReadingStrip active={interacted} entries={[{ label: "景物距离", value: `${objectDistance.toFixed(0)} cm`, note: "改变景物会推动理论像面" }, { label: "镜头焦距", value: `${focalLength.toFixed(2)} cm`, note: autoFocus ? "自动对焦正在调节" : "当前镜头参数" }, { label: "理论像距", value: `${result.imageDistance.toFixed(2)} cm`, note: `感光器固定在 ${sensorDistance} cm` }, { label: "对焦状态", value: result.screenFocused ? "FOCUS LOCKED" : `偏差 ${result.screenError.toFixed(2)} cm`, note: result.screenFocused ? "清晰倒立实像落在感光器上" : "继续缩小像面偏差", tone: result.screenFocused ? "accent" : "warning" }]} />
    <div className="open-control-deck"><RangeControl label="景物距离" value={objectDistance} min={45} max={180} step={5} unit="cm" onChange={(value) => { setAutoFocus(false); setObjectDistance(value); }} onInteract={interact} /><RangeControl label="镜头焦距" value={focalLength} min={12} max={21} step={0.01} unit="cm" onChange={(value) => { setAutoFocus(false); setFocalLength(value); }} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "相机里的像 · 动态感光" : "还没有获得观察"}</span><strong>{interacted ? result.nature : "先完成一次对焦尝试"}</strong><p>{interacted ? "继续改变景物距离，看看清晰状态能否保持。" : "操作后再判断像的性质。"}</p></div></div>
    <LensModuleGuide apparatus="camera" />
  </div>;
}
