import type { LiliExperimentContext } from "@physics-lab/contracts";
import { HIGH_SCHOOL_EXPERIMENTS } from "@physics-lab/physics/high-school";
import { liliContextChanged } from "./liliConversationContext";
import { ChevronDown } from "lucide-react";

const number = (value: number) => Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumSignificantDigits: 7 }) : "—";
const modeNames = { charge: "充电", discharge: "放电", open: "开路" };

export function LiliQuestionContext({ captured, current }: { captured: LiliExperimentContext | null; current: LiliExperimentContext | null }) {
  const definition = HIGH_SCHOOL_EXPERIMENTS.find(item => item.id === captured?.experimentId);
  return <div className="lili-question-context">
    {liliContextChanged(captured, current) && <p className="lili-context-changed">实验条件、时刻或所附记录已变化；这条回复仍基于提问时的快照。</p>}
    {captured ? <details><summary><span>提问时的实验条件 · {number(captured.timeSeconds)} s</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <p>{definition?.title ?? captured.experimentId}</p>
      <dl>{Object.entries(captured.parameters).map(([key, value]) => {
        const parameter = definition?.parameters.find(item => item.key === key);
        const choice = parameter?.choices?.find(item => item.value === value);
        return <div key={key}><dt>{parameter?.label ?? key}</dt><dd>{choice?.label ?? `${number(value)}${parameter?.unit ? ` ${parameter.unit}` : ""}`}</dd></div>;
      })}</dl>
      <p>附带自动模型采样 {captured.samples?.length ?? 0} 条；虚拟手动读数 {captured.manualSamples?.length ?? 0} 条。均不是真实器材测量。</p>
      {captured.capacitorHistory && <div className="lili-context-history"><strong>提问时的开关过程</strong><ol>{captured.capacitorHistory.segments.map((segment, index) => <li key={index}>{number(segment.startTimeSeconds)} s：{modeNames[segment.mode]}</li>)}</ol></div>}
    </details> : <p>提问时尚未选定实验；这条回复未附带实验读数。</p>}
  </div>;
}
