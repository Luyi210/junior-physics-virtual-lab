import { Focus, Save } from "lucide-react";
import { EvidenceVerdict } from "../shared/ScienceLabPrimitives";
import { useId } from "react";
import { hasLeverForceLineTrial, leverForceLineGeometry, type LeverForceLineComparison, type LeverForceLineTrial } from "./leverForceLineEvidence";

interface LeverForceLineDiagnosticProps {
  force: number;
  pivotDistance: number;
  angle: number;
  trials: readonly LeverForceLineTrial[];
  perpendicularArm: number;
  moment: number;
  comparison: LeverForceLineComparison;
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
  comparison,
  invariantReady,
  onAngleChange,
  onRecord
}: LeverForceLineDiagnosticProps) {
  const { origin, application, foot, lineStart, forceEnd, rightAngle } = leverForceLineGeometry(pivotDistance, angle);
  const markerId = `lever-force-arrow-${useId().replaceAll(":", "")}`;
  const evidenceReady = comparison.ready;
  const ninety = comparison.perpendicular;
  const thirty = comparison.oblique;
  const recorded = hasLeverForceLineTrial(trials, force, pivotDistance, angle);

  return <section className={`lever-force-line-lab ${evidenceReady ? "complete" : ""}`}>
    <header>
      <span><Focus size={17}/><b>FORCE LINE DIAGNOSTIC / 斜拉力臂诊断</b></span>
      <small>{evidenceReady ? "已保存同F、同r的作用线对照" : "保持F与悬点r不变，只改变角度"}</small>
    </header>
    <div className="lever-force-line-body">
      <svg viewBox="0 0 520 230" role="img" aria-label={`拉力与杠杆夹角${angle}度，有效力臂${perpendicularArm.toFixed(2)}格`}>
        <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#ef735d"/></marker></defs>
        <path className="force-line-grid" d="M35 42H492M35 82H492M35 122H492M35 162H492M35 202H492M74 25V215M154 25V215M234 25V215M314 25V215M394 25V215M474 25V215"/>
        <path className="force-line-rod" d="M74 132H474"/>
        <path className="force-line-pivot" d="M74 132L45 197H103Z"/>
        <circle className="force-line-point" cx={application.x} cy={application.y} r="7"/>
        <path className="force-line-vector" d={`M${application.x} ${application.y}L${forceEnd.x} ${forceEnd.y}`} markerEnd={`url(#${markerId})`}/>
        <path className="force-line-extension" d={`M${lineStart.x} ${lineStart.y}L${forceEnd.x} ${forceEnd.y}`}/>
        <path data-part="perpendicular-arm" d={`M${origin.x} ${origin.y}L${foot.x} ${foot.y}`} fill="none" stroke="#7ce0c4" strokeWidth="3" strokeDasharray="5 4"/>
        <polyline points={rightAngle.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#7ce0c4" strokeWidth="1.5"/>
        <circle cx={foot.x} cy={foot.y} r="3" fill="#7ce0c4"/>
        <text x={(origin.x + foot.x) / 2 - 5} y={(origin.y + foot.y) / 2 - 26}>l={perpendicularArm.toFixed(2)}格</text>
        <text x="45" y="218">支点 O</text>
        <text x={application.x + 8} y="117">悬点 r={pivotDistance.toFixed(1)}格</text>
        <text x={forceEnd.x - 5} y={Math.min(222, forceEnd.y + 17)}>F={force.toFixed(1)}N</text>
      </svg>
      <div className="lever-force-line-controls">
        <span>拉力与杆的夹角 θ</span>
        <div>{[90, 60, 30].map((candidate) => <button className={angle === candidate ? "active" : hasLeverForceLineTrial(trials, force, pivotDistance, candidate) ? "done" : ""} onClick={() => onAngleChange(candidate)} key={candidate}>{candidate}°</button>)}</div>
        <button className="record" onClick={onRecord} disabled={recorded}><Save size={14}/>{recorded ? "当前条件已记录" : "记录当前作用线"}</button>
      </div>
      <div className="lever-force-line-readings">
        <article><span>悬点距离 r</span><strong>{pivotDistance.toFixed(1)} 格</strong><small>沿杠杆量得，不一定是力臂</small></article>
        <article><span>垂直力臂 l=r·sinθ</span><strong>{perpendicularArm.toFixed(2)} 格</strong><small>支点到力的作用线的垂直距离</small></article>
        <article><span>转动效果 F·l</span><strong>{moment.toFixed(2)} N·格</strong><small>同F、同r时，角度越小力矩越小</small></article>
      </div>
    </div>
    {trials.length > 0 && <div className="lever-evidence-ledger"><header><span><b>已保存的作用线读数</b></span><small>改变当前设置不会改写历史读数</small></header><div className="lever-table"><b>序号</b><b>F/N</b><b>r/格</b><b>θ/°</b><b>l/格</b><b>F·l / N·格</b>{trials.map((trial, index) => <div className="lever-table-row" key={trial.id}><span>{trials.length - index}</span><span>{trial.force.toFixed(1)}</span><span>{trial.pivotDistance.toFixed(1)}</span><span>{trial.angle.toFixed(0)}</span><span>{trial.perpendicularArm.toFixed(2)}</span><strong>{trial.moment.toFixed(2)}</strong></div>)}</div></div>}
    {(trials.length > 0 || invariantReady) && <EvidenceVerdict
      valid={evidenceReady}
      title={evidenceReady ? "已保存的同条件对照显示力臂随角度变化" : "还需保存同F、同r的90°与30°对照"}
      detail={ninety && thirty ? `已保存对照：F=${ninety.force.toFixed(1)} N、r=${ninety.pivotDistance.toFixed(1)} 格；90°时 l=${ninety.perpendicularArm.toFixed(2)} 格、力矩=${ninety.moment.toFixed(2)} N·格；30°时 l=${thirty.perpendicularArm.toFixed(2)} 格、力矩=${thirty.moment.toFixed(2)} N·格。` : comparison.reason}
    />}
  </section>;
}
