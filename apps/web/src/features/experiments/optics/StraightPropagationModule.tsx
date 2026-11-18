import { useRef, useState } from "react";
import { useHarnessStore } from "../../assistant/harnessStore";
import { Info, WandSparkles, Eye } from "lucide-react";
import { ModuleIntro, OpticsInteractionCue, RangeControl } from "./shared/OpticsControls";
import { ShadowlessLampLife } from "./applications/ShadowlessLampLife";

export function StraightPropagationModule() {
  const [objectDistance, setObjectDistance] = useState(250);
  const [aperture, setAperture] = useState(7);
  const [screenX, setScreenX] = useState(790);
  const [dragging, setDragging] = useState<"object" | "screen" | null>(null);
  const dragInitialValue = useRef<number | null>(null);
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
  const imageClarity = aperture <= 4 ? "边缘较清晰" : aperture <= 10 ? "边缘略显模糊" : "边缘明显模糊";
  const interact = () => setInteracted(true);
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const startDrag = (kind: "object" | "screen") => (event: React.PointerEvent<SVGGElement>) => {
    // Horizontal manipulation leaves vertical swipes and pinch zoom to the browser.
    if (event.pointerType !== "touch") event.preventDefault();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    dragInitialValue.current = kind === "object" ? objectDistance : screenX;
    setDragging(kind);
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
      if (nextDistance !== objectDistance) setInteracted(true);
      setObjectDistance(nextDistance);
    } else {
      const next = Math.round(clamp(local.x, 600, 830) / 5) * 5;
      if (next !== screenX) setInteracted(true);
      setScreenX(next);
    }
  };
  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragInitialValue.current !== (dragging === "object" ? objectDistance : screenX)) recordHarness("control.changed", { control: dragging === "object" ? "画面拖动烛焰" : "画面拖动光屏", value: dragging === "object" ? objectDistance : screenX - holeX, unit: "cm" });
    dragInitialValue.current = null;
    setDragging(null);
  };
  const cancelDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragInitialValue.current = null;
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
      <svg viewBox="0 0 900 430" preserveAspectRatio="xMidYMid meet" aria-label="可拖动烛焰和光屏的小孔成像动态实验" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} style={{ touchAction: "pan-y pinch-zoom" }}>
        <defs><filter id="straightGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g className="ray-grid">{Array.from({ length: 17 }, (_, index) => <line x1={50 + index * 50} x2={50 + index * 50} y1="35" y2="390" key={`v-${index}`} />)}{Array.from({ length: 8 }, (_, index) => <line x1="40" x2="860" y1={40 + index * 50} y2={40 + index * 50} key={`h-${index}`} />)}</g>
        <line className="optic-axis-line" x1="45" x2="855" y1={holeY} y2={holeY} />
        <g className={`candle-object draggable-optic ${dragging === "object" ? "dragging" : ""}`} transform={`translate(${objectX} 0)`} role="button" tabIndex={0} aria-label="拖动烛焰改变物距" onPointerDown={startDrag("object")} onKeyDown={nudgeObject}><line x1="0" x2="0" y1={objectBottom} y2={objectTop} /><path d={`M-9 ${objectTop + 16} L0 ${objectTop} L9 ${objectTop + 16}`} /><text x="-30" y="320">烛焰</text><circle className="drag-dot" cx="0" cy="343" r="13" /><path className="drag-arrows" d="M-8 343 L-2 338 M-8 343 L-2 348 M8 343 L2 338 M8 343 L2 348" /><text className="drag-instruction" x="-32" y="373">左右拖动</text></g>
        <g className="pinhole-board"><rect x={holeX - 9} y="48" width="18" height={holeY - aperture / 2 - 48} /><rect x={holeX - 9} y={holeY + aperture / 2} width="18" height={388 - holeY - aperture / 2} /><circle cx={holeX} cy={holeY} r={Math.max(3, aperture / 2)} /><text x={holeX - 35} y="415">带孔遮光板</text></g>
        <g className={`projection-screen draggable-optic ${dragging === "screen" ? "dragging" : ""}`} role="button" tabIndex={0} aria-label="拖动光屏改变屏距" onPointerDown={startDrag("screen")} onKeyDown={nudgeScreen}><rect x={screenX} y="62" width="22" height="326" /><circle className="drag-dot" cx={screenX + 11} cy="39" r="13" /><path className="drag-arrows" d={`M${screenX + 3} 39 L${screenX + 9} 34 M${screenX + 3} 39 L${screenX + 9} 44 M${screenX + 19} 39 L${screenX + 13} 34 M${screenX + 19} 39 L${screenX + 13} 44`} /><text className="drag-instruction" x={screenX - 21} y="415">拖动光屏</text></g>
        {interacted && <g className="straight-rays" filter="url(#straightGlow)"><path className="top-ray" d={`M${objectX} ${objectTop} L${holeX} ${holeY}`} /><path className="top-ray" d={`M${holeX} ${holeY} L${screenX} ${imageFromTop}`} /><path className="bottom-ray" d={`M${objectX} ${objectBottom} L${holeX} ${holeY}`} /><path className="bottom-ray" d={`M${holeX} ${holeY} L${screenX} ${imageFromBottom}`} /></g>}
        {interacted && <g className="pinhole-image" style={{ opacity: brightness / 100, filter: `blur(${Math.max(0, aperture - 3) / 8}px)` }}><line x1={screenX + 11} x2={screenX + 11} y1={Math.max(75, imageFromBottom)} y2={Math.min(380, imageFromTop)} /><path d={`M${screenX + 3} ${Math.min(365, imageFromTop - 14)} L${screenX + 11} ${Math.min(380, imageFromTop)} L${screenX + 19} ${Math.min(365, imageFromTop - 14)}`} /></g>}
      </svg>
      {!interacted && <OpticsInteractionCue text="直接拖动烛焰或光屏，开始实验" />}
      <div className={`law-readout ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? imageFitsScreen ? "SCREEN OBSERVATION" : "IMAGE EXCEEDS SCREEN" : "OPTICAL PATH STANDBY"}</span><strong>{interacted ? imageFitsScreen ? "光屏上出现完整的倒立实像" : "像的一部分超出了光屏" : "等待第一次拖动"}</strong><small>{interacted ? `像高约 ${imageHeight.toFixed(0)} 个示意单位 · 小孔越大，像越亮但边缘更模糊` : "画面中的烛焰和光屏都可以左右拖动"}</small></div>
    </div>
    <div className="open-control-deck straight-controls"><RangeControl label="物体到小孔距离" value={objectDistance} min={180} max={330} step={5} unit="cm" onChange={setObjectDistance} onInteract={interact} /><RangeControl label="小孔到光屏距离" value={screenX - holeX} min={170} max={400} step={5} unit="cm" onChange={(distance) => setScreenX(holeX + distance)} onInteract={interact} /><RangeControl label="小孔直径（示意）" value={aperture} min={2} max={20} step={1} unit="mm" onChange={setAperture} onInteract={interact} /><div className={`observation-output ${interacted ? "" : "awaiting-reading"}`}><span>{interacted ? "来自你的直接操作" : "现象尚未生成"}</span><strong>{interacted ? imageFitsScreen ? `光屏得到倒立实像 · ${imageClarity}` : "像的一部分超出光屏" : "拖动一个器材开始实验"}</strong><p>{interacted ? "孔径变大时通光量增多，但每个物点形成的光斑也变大，所以不能一概称为清晰成像。" : "拖动与滑杆会同步更新。"}</p></div></div>
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
