import { Focus, Save } from "lucide-react";
import { EvidenceVerdict } from "./ScienceLabPrimitives";

interface LeverForceLineDiagnosticProps {
  force: number;
  pivotDistance: number;
  angle: number;
  trials: number[];
  perpendicularArm: number;
  moment: number;
  evidenceReady: boolean;
  invariantReady: boolean;
  onAngleChange: (angle: number) => void;
  onRecord: () => void;
}

export function LeverForceLineDiagnostic({
  force,
  pivotDistance,
  angle,
  trials,
  perpendicularArm,
  moment,
  evidenceReady,
  invariantReady,
  onAngleChange,
  onRecord
}: LeverForceLineDiagnosticProps) {
  const radians = angle * Math.PI / 180;
  const forceLineStartX = 114 + pivotDistance / 9 * 270;
  const forceLineEndX = forceLineStartX + Math.cos(radians) * 104;
  const forceLineEndY = 132 + Math.sin(radians) * 104;

  return <section className={`lever-force-line-lab ${evidenceReady ? "complete" : ""}`}>
    <header>
      <span><Focus size={17}/><b>FORCE LINE DIAGNOSTIC / 斜拉力臂诊断</b></span>
      <small>{evidenceReady ? "作用线对照证据已完成" : "保持F与悬点r不变，只改变角度"}</small>
    </header>
    <div className="lever-force-line-body">
      <svg viewBox="0 0 520 230" role="img" aria-label={`拉力与杠杆夹角${angle}度，有效力臂${perpendicularArm.toFixed(2)}格`}>
        <defs><marker id="lever-force-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker></defs>
        <path className="force-line-grid" d="M35 42H492M35 82H492M35 122H492M35 162H492M35 202H492M74 25V215M154 25V215M234 25V215M314 25V215M394 25V215M474 25V215"/>
        <path className="force-line-rod" d="M74 132H474"/>
        <path className="force-line-pivot" d="M74 132L45 197H103Z"/>
        <circle className="force-line-point" cx={forceLineStartX} cy="132" r="7"/>
        <path className="force-line-vector" d={`M${forceLineStartX} 132L${forceLineEndX} ${forceLineEndY}`} markerEnd="url(#lever-force-arrow)"/>
        <path className="force-line-extension" d={`M${forceLineStartX - Math.cos(radians) * 115} ${132 - Math.sin(radians) * 115}L${forceLineEndX} ${forceLineEndY}`}/>
        <text x="45" y="218">支点 O</text>
        <text x={forceLineStartX + 8} y="117">悬点 r={pivotDistance.toFixed(1)}格</text>
        <text x={forceLineEndX - 5} y={Math.min(220, forceLineEndY + 17)}>F={force.toFixed(1)}N</text>
      </svg>
      <div className="lever-force-line-controls">
        <span>拉力与杆的夹角 θ</span>
        <div>{[90, 60, 30].map((candidate) => <button className={angle === candidate ? "active" : trials.includes(candidate) ? "done" : ""} onClick={() => onAngleChange(candidate)} key={candidate}>{candidate}°</button>)}</div>
        <button className="record" onClick={onRecord}><Save size={14}/>记录当前作用线</button>
      </div>
      <div className="lever-force-line-readings">
        <article><span>悬点距离 r</span><strong>{pivotDistance.toFixed(1)} 格</strong><small>沿杠杆量得，不一定是力臂</small></article>
        <article><span>垂直力臂 l=r·sinθ</span><strong>{perpendicularArm.toFixed(2)} 格</strong><small>支点到力的作用线的垂直距离</small></article>
        <article><span>转动效果 F·l</span><strong>{moment.toFixed(2)} N·格</strong><small>同F、同r时，角度越小力矩越小</small></article>
      </div>
    </div>
    {(trials.length > 0 || invariantReady) && <EvidenceVerdict
      valid={evidenceReady}
      title={evidenceReady ? "作用线证据推翻了“杆长就是力臂”" : "还需记录90°与30°两种角度"}
      detail={evidenceReady ? `同样 F=${force.toFixed(1)} N、r=${pivotDistance.toFixed(1)} 格，90°时 l=${pivotDistance.toFixed(1)} 格，而30°时 l=${(pivotDistance * .5).toFixed(1)} 格，转动效果减半。` : "不要改变拉力与悬点位置，只改变测力计拉力方向，比较有效力臂。"}
    />}
  </section>;
}
