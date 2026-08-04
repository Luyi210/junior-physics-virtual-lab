import type { LensResult } from "@physics-lab/physics";
import { Crosshair, Eye, Grid3X3, ScanLine } from "lucide-react";
import type { LensSceneState } from "./lensStore";
import { useLensStore } from "./lensStore";

interface LensInspectorProps {
  scene: LensSceneState;
  result: LensResult;
  revealed?: boolean;
  onInteract?: () => void;
}

function RangeField({ label, symbol, value, min, max, step, unit, onChange, onInteract }: {
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  onInteract?: () => void;
}) {
  const progress = (value - min) / (max - min) * 100;
  return (
    <label className="instrument-control">
      <span><b>{label}</b><i>{symbol}</i></span>
      <div className="range-line">
        <input type="range" min={min} max={max} step={step} value={value} style={{ "--progress": `${progress}%` } as React.CSSProperties} onChange={(event) => { onChange(Number(event.target.value)); onInteract?.(); }} />
        <output>{value.toFixed(1)} <small>{unit}</small></output>
      </div>
    </label>
  );
}

export function LensInspector({ scene, result, revealed = true, onInteract }: LensInspectorProps) {
  const update = useLensStore((state) => state.update);
  return (
    <aside className="lens-inspector">
      <div className="inspector-heading">
        <div><span>PARAMETERS</span><h2>实验参数</h2></div>
        <Crosshair size={21} />
      </div>

      <section className="inspector-section">
        <RangeField label="焦距" symbol="f" value={scene.focalLength} min={8} max={30} step={0.5} unit="cm" onChange={(focalLength) => update({ focalLength })} onInteract={onInteract} />
        <RangeField label="物体位置" symbol="xₒ" value={scene.objectX} min={-75} max={-6} step={0.5} unit="cm" onChange={(objectX) => update({ objectX })} onInteract={onInteract} />
        <RangeField label="物体高度" symbol="h" value={scene.objectHeight} min={4} max={16} step={0.5} unit="cm" onChange={(objectHeight) => update({ objectHeight })} onInteract={onInteract} />
        <RangeField label="光屏位置" symbol="xₛ" value={scene.screenX} min={4} max={95} step={0.5} unit="cm" onChange={(screenX) => update({ screenX })} onInteract={onInteract} />
      </section>

      <section className="inspector-section display-options">
        <button className={scene.showRays ? "selected" : ""} onClick={() => { update({ showRays: !scene.showRays }); onInteract?.(); }}><ScanLine size={17} />光路</button>
        <button className={scene.showGrid ? "selected" : ""} onClick={() => { update({ showGrid: !scene.showGrid }); onInteract?.(); }}><Grid3X3 size={17} />网格</button>
        <button className={scene.showLabels ? "selected" : ""} onClick={() => { update({ showLabels: !scene.showLabels }); onInteract?.(); }}><Eye size={17} />标签</button>
      </section>

      <section className={`result-console ${revealed ? "" : "result-standby"}`}>
        <div className="console-head"><span>{revealed ? "LIVE RESULT" : "MEASUREMENT STANDBY"}</span><i className={revealed ? result.case === "focus" ? "" : result.real ? "real" : "virtual" : ""}>{revealed ? result.case === "focus" ? "PARALLEL" : result.real ? "REAL" : "VIRTUAL" : "WAIT"}</i></div>
        <div className="result-equation">1/f = 1/u + 1/v</div>
        <dl>
          <div><dt>物距 u</dt><dd>{revealed ? `${result.objectDistance.toFixed(1)} cm` : "— —"}</dd></div>
          <div><dt>像距 v</dt><dd>{revealed ? result.finite ? `${result.imageDistance.toFixed(1)} cm` : "∞" : "— —"}</dd></div>
          <div><dt>放大率 m</dt><dd>{revealed ? result.finite ? result.magnification.toFixed(2) : "∞" : "— —"}</dd></div>
          <div><dt>成像性质</dt><dd>{revealed ? result.nature : "等待操作"}</dd></div>
        </dl>
        <p>{revealed ? result.conclusion : "移动任一器材或调节参数后，实时测量结果才会显示。"}</p>
        <div className={`focus-meter ${revealed && result.screenFocused ? "focused" : ""}`}>
          <span>{revealed ? result.screenFocused ? "光屏已对焦" : result.real ? `距清晰像 ${result.screenError.toFixed(1)} cm` : "当前无法在光屏承接" : "等待第一次实验操作"}</span>
          <i><b style={{ width: revealed ? result.screenFocused ? "100%" : result.real ? `${Math.max(8, 100 - Math.min(result.screenError * 5, 92))}%` : "8%" : "0%" }} /></i>
        </div>
      </section>
    </aside>
  );
}
