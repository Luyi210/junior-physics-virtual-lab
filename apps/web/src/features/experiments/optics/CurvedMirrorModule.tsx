import { lazy, useState, Suspense } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { curvedMirrorGeometry, mirrorPath2D, mirrorPoint2D } from "./curvedMirrorGeometry";
import { OpticsSceneErrorBoundary } from "./components/OpticsSceneErrorBoundary";
import { Focus, ScanLine, NotebookPen } from "lucide-react";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";
import { LawPresets } from "./shared/LawControls";
import { OpticsMobileViewNote } from "./shared/OpticsMobileViewNote";

const CurvedMirrorScene3D = lazy(async () => {
  const module = await import("./components/OpticsLawScene3D");
  return { default: module.CurvedMirrorScene3D };
});

type CurvedMirrorType = "concave" | "convex";

type CurvedMirrorView = "3d" | "2d";

export function CurvedMirrorModule() {
  const recordHarness = useHarnessStore((state) => state.record);
  const [mirror, setMirror] = useState<CurvedMirrorType>("concave");
  const [viewMode, setViewMode] = useState<CurvedMirrorView>("2d");
  const [objectDistance, setObjectDistance] = useState(250);
  const [interacted, setInteracted] = useState(false);
  const axisY = 225;
  const geometry = curvedMirrorGeometry(mirror, objectDistance);
  const { result: mirrorResult } = geometry;
  const { atFocus, imageDistance, magnification, real, nature } = mirrorResult;
  const { x: objectX, y: objectTop } = mirrorPoint2D(geometry.object);
  const image = geometry.image ? mirrorPoint2D(geometry.image) : null;
  const imageX = image?.x ?? 0;
  const imageTop = image?.y ?? axisY;
  const changeMirror = (next: CurvedMirrorType) => { setMirror(next); setObjectDistance(250); setInteracted(true); recordHarness("configuration.changed", { experiment: "curved-mirror", control: "曲面镜类型", value: next }); };
  const changeViewMode = (next: CurvedMirrorView) => { setViewMode(next); setInteracted(true); recordHarness("view.changed", { experiment: "curved-mirror", view: next, mirror, objectDistance }); };
  const record3DNavigation = (action: "rotate" | "zoom") => recordHarness("scene.navigated", { experiment: "curved-mirror", action, mirror, objectDistance, nature });
  const record3DView = (view: "perspective" | "front" | "top") => recordHarness("view.changed", { experiment: "curved-mirror", view: `3d-${view}`, mirror, objectDistance, nature });

  return <div className="open-experience">
    <ModuleIntro eyebrow="生活·物理·社会 / 凹面镜和凸面镜" title="在二维光路与三维空间之间，看懂曲面镜成像" text="三维模式用于观察弯曲镜面、空间主轴和立体光束；二维模式用于准确辨认物体、焦点 F、曲率中心 C、实像和虚像。两种视图使用同一组物距数据，切换视图不会改变实验结果。" />
    <div className="medium-tabs curved-tabs"><button className={mirror === "concave" ? "active" : ""} onClick={() => changeMirror("concave")}>凹面镜 · 会聚</button><button className={mirror === "convex" ? "active" : ""} onClick={() => changeMirror("convex")}>凸面镜 · 发散</button></div>
    <div className="curved-view-switch" aria-label="选择二维或三维光路视图"><div><span>VIEW MODE / 观察方式</span><strong>{viewMode === "3d" ? "空间实验台" : "课本光路图"}</strong><small>{viewMode === "3d" ? "适合观察镜面曲率与空间光束" : "适合读取 F、C 和成像交点"}</small><OpticsMobileViewNote mode={viewMode} /></div><nav><button type="button" aria-pressed={viewMode === "2d"} className={viewMode === "2d" ? "active" : ""} onClick={() => changeViewMode("2d")}><b>2D</b><span>课本光路</span></button><button type="button" aria-pressed={viewMode === "3d"} className={viewMode === "3d" ? "active" : ""} onClick={() => changeViewMode("3d")}><b>3D</b><span>立体观察</span></button></nav></div>
    <LawPresets label={mirror === "concave" ? "让物体跨过凹面镜焦点与二倍焦距" : "用相同物距比较凸面镜虚像"} activeValue={objectDistance} options={[{ label: "焦点以内", value: 80, note: "u < F" }, { label: "焦点处", value: 120, note: "u = F" }, { label: "F 与 2F 间", value: 180, note: "F < u < 2F" }, { label: "二倍焦距", value: 240, note: "u = 2F" }]} onSelect={(value) => { setObjectDistance(value); setInteracted(true); recordHarness("configuration.changed", { experiment: "curved-mirror", control: "典型物距", value, mirror }); }} />
    <div className={`curved-mirror-lab ${mirror} view-${viewMode} ${viewMode === "3d" ? "ray-law-lab optics-3d-lab" : ""}`}>
      {viewMode === "3d" ? <>
        <OpticsSceneErrorBoundary onUse2D={() => { setViewMode("2d"); recordHarness("view.changed", { experiment: "curved-mirror", view: "2d", reason: "3d-unavailable", mirror, objectDistance }); }} label="三维曲面镜实验台"><Suspense fallback={<div className="optics-3d-loading"><i /><strong>正在搭建三维曲面镜实验台</strong><span>生成弯曲镜面、焦点与空间光束…</span></div>}><CurvedMirrorScene3D mirror={mirror} objectDistance={objectDistance} imageDistance={imageDistance} magnification={magnification} real={real} atFocus={atFocus} nature={nature} interacted={interacted} onInteract={() => setInteracted(true)} onNavigate={record3DNavigation} onViewChange={record3DView} /></Suspense></OpticsSceneErrorBoundary>
        <div className="curved-3d-legend"><span><i className="incident" />入射光</span><span><i className="reflected" />反射光</span><span><i className="virtual" />反向延长线</span><span><i className="focus" />F 焦点</span></div>
      </> : <>
        <svg viewBox="0 0 900 430" aria-label="凹面镜和凸面镜二维成像光路图">
          <g className="mirror-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="390" key={`cv-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={40 + index * 50} y2={40 + index * 50} key={`ch-${index}`} />)}</g>
          <line className="curved-axis" x1="45" y1={axisY} x2="855" y2={axisY} /><text className="curved-axis-label" x="54" y={axisY - 12}>主光轴</text>
          <path className="curved-mirror-surface" d={mirrorPath2D(geometry.surface)} />
          <circle className="focus-mark" cx={mirror === "concave" ? 530 : 770} cy={axisY} r="5" /><text className="curved-point-label" x={mirror === "concave" ? 514 : 754} y="255">F 焦点</text>
          <circle className="center-mark" cx={mirror === "concave" ? 410 : 890} cy={axisY} r="4" /><text className="curved-point-label center-label" x={mirror === "concave" ? 392 : 846} y="205">C 曲率中心</text>
          <g className="curved-object"><line x1={objectX} y1={axisY} x2={objectX} y2={objectTop} /><path d={`M${objectX - 10} ${objectTop + 17} L${objectX} ${objectTop} L${objectX + 10} ${objectTop + 17}`} /><text x={objectX - 18} y="262">物体</text></g>
          {interacted && geometry.imageVisible && <g className={`curved-image ${real ? "real" : "virtual"}`}><line x1={imageX} y1={axisY} x2={imageX} y2={imageTop} /><path d={`M${imageX - 9} ${imageTop + (imageTop < axisY ? 15 : -15)} L${imageX} ${imageTop} L${imageX + 9} ${imageTop + (imageTop < axisY ? 15 : -15)}`} /><text x={imageX - 16} y={imageTop < axisY ? imageTop - 15 : imageTop + 29}>{real ? "实像" : "虚像"}</text></g>}
          {interacted && <g className="curved-rays">{geometry.rays.map((ray, index) => <g key={index}>
            <path className={`incident${index ? " second" : ""}`} d={mirrorPath2D([geometry.object, ray.hit])} />
            <path className={`reflected${index ? " second" : ""}`} d={mirrorPath2D([ray.hit, ray.end])} />
            {!real && !atFocus && <path className="virtual-extension" d={mirrorPath2D([ray.hit, ray.backwardEnd])} />}
          </g>)}</g>}
        </svg>
        <div className="curved-2d-legend"><span><i className="incident" />入射光</span><span><i className="reflected" />反射光</span><span><i className="virtual" />虚线延长线</span></div>
      </>}
      {!interacted && <OpticsInteractionCue text="选择凹面镜或凸面镜，或移动物体" />}
      <div className={`law-readout curved-law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? mirror === "concave" ? "CONCAVE MIRROR READING" : "CONVEX MIRROR READING" : "CURVED MIRROR STANDBY"}</span><strong>{interacted ? nature : "等待选择并调节曲面镜"}</strong><small>{interacted ? atFocus ? "物体位于近轴焦平面：反射光近似平行，不能得到有限的近轴像" : `${real ? "实像可尝试用光屏承接" : "虚像不能用光屏承接"}；${geometry.imageVisible ? "像标记按近轴公式定位" : "近轴像在当前视野外，未移动或缩放像点"}` : "黄色为入射光，绿色为反射光，蓝色虚线为反向延长线"}</small></div>
    </div>
    <div className="open-control-deck curved-controls"><RangeControl label="物体到镜面距离" value={objectDistance} min={80} max={360} step={10} unit="格" onChange={setObjectDistance} onInteract={() => setInteracted(true)} /><div className="index-comparison"><span>对应基础规律</span><strong>每一条光线都遵守反射定律</strong><p>镜顶与曲率中心确定法线；图中代表光线按真实球面法线反射。</p></div><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>当前成像特点</span><strong>{interacted ? nature : "先选择镜面并移动物体"}</strong><p>{interacted ? mirror === "convex" ? "继续移动物体，观察虚像是否始终缩小。" : "让物体跨过焦点 F，比较实像与虚像。" : "结果会在操作后出现。"}</p></div></div>
    <p className="curved-model-note">近轴球面镜模型：f=R/2，像的位置和大小按近轴成像公式计算。代表光线在真实球面上反射，因球差不一定严格交于近轴像点；焦平面处仅近似平行。两种视图保持同一比例和光路，视野外的像不强行移回画面。</p>
    <section className="dispersion-guide law-experiment-guide curved-mirror-guide" aria-label="凹面镜和凸面镜实验说明"><header><span>EXPERIMENT GUIDE / 实验说明</span><h2>同一组成像数据，为什么要用两种视图观察？</h2><p>二维光路图把空间压缩到主截面，便于判断焦点与成像位置；三维实验台恢复镜面的宽度和光束深度，帮助理解真实光线可以从不同位置照到曲面。</p></header><div><article><i><Focus size={19} /></i><span><small>01 · 先看二维</small><strong>认清主轴、焦点 F 和曲率中心 C</strong><p>切换凹面镜与凸面镜，再让物体跨过焦点。观察实线在哪里真正相交，以及虚线在哪里反向相交。</p></span></article><article><i><ScanLine size={19} /></i><span><small>02 · 再看三维</small><strong>旋转实验台，观察不同深度的代表光线</strong><p>拖动场景或切换正视、俯视视角。无论视角怎样改变，镜面性质和成像结论都不改变。</p></span></article><article><i><NotebookPen size={19} /></i><span><small>03 · 做出比较</small><strong>记录像的正倒、大小、虚实和位置</strong><p>凹面镜的结果会随物距改变；凸面镜始终得到正立、缩小的虚像，并具有扩大视野的特点。</p></span></article></div><footer><b>建议路线：</b>凹面镜先从 360 格逐渐靠近 120 格焦点，再移动到焦点以内；随后切换凸面镜，用相同物距逐项比较。</footer></section>
  </div>;
}
