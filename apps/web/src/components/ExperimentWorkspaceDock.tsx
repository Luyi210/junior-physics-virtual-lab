import { Activity, BookMarked, FlaskConical, GraduationCap, RadioTower } from "lucide-react";
import { Link } from "react-router-dom";
import { diagnoseHarnessExperiment } from "@physics-lab/harness";
import { useHarnessStore } from "../features/harness/harnessStore";
import { ExperimentFullscreenButton } from "./ExperimentFullscreenButton";

interface ExperimentWorkspaceDockProps {
  experiment: string;
  title: string;
  context: string;
  targetSelector: string;
}

export function ExperimentWorkspaceDock({ experiment, title, context, targetSelector }: ExperimentWorkspaceDockProps) {
  const session = useHarnessStore((state) => state.session);
  const diagnosis = session ? diagnoseHarnessExperiment(session, experiment) : undefined;
  const hasOperation = (diagnosis?.operationCount ?? 0) > 0;
  const hasEvidence = (diagnosis?.observationCount ?? 0) > 0;

  return <section className={`experiment-workspace-dock stage-${diagnosis?.stage ?? "orientation"}`} aria-label={`${title}统一实验工具栏`}>
    <div className="workspace-dock-identity">
      <i><FlaskConical size={18} /></i>
      <span><small>EXPERIMENT WORKSPACE / 统一实验工作台</small><strong>{title}</strong><em>{context} · 自由探究，不规定操作顺序</em></span>
    </div>
    <div className="workspace-dock-status" aria-live="polite">
      <span className={hasOperation ? "active" : ""}><Activity size={14} /><b>{hasOperation ? `${diagnosis?.operationCount} 次操作` : "等待操作"}</b><small>装置状态实时记录</small></span>
      <span className={hasEvidence ? "active" : ""}><RadioTower size={14} /><b>{hasEvidence ? `${diagnosis?.observationCount} 条发现` : "等待证据"}</b><small>读数与现象分开保存</small></span>
    </div>
    <nav className="workspace-dock-actions" aria-label="实验公共功能">
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("physics-harness:open-tutorial"))}><GraduationCap size={17} /><span><strong>光光教程</strong><small>边操作边讲解</small></span></button>
      <Link to="/student/notebook"><BookMarked size={17} /><span><strong>实验记录</strong><small>整理操作与发现</small></span></Link>
      <ExperimentFullscreenButton targetSelector={targetSelector} experiment={experiment} className="workspace-dock-fullscreen" label="全屏实验" hint="控制与现象同时放大" />
    </nav>
  </section>;
}
