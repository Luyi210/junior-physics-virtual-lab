import type { LiliExperimentContext } from "@physics-lab/contracts";
import { getLiliCoachState } from "@physics-lab/harness/lili";
import type { LiliReflectionKind } from "@physics-lab/harness/lili";
import { ArrowRight, ClipboardCheck, FlaskConical, ScanSearch } from "lucide-react";

export function LiliReviewPanel({ context, busy, onAsk, onPrepare }: { context: LiliExperimentContext | null; busy: boolean; onAsk: (question: string) => void; onPrepare: (kind: LiliReflectionKind) => void }) {
  const coach = getLiliCoachState(context);
  return <section className={`lili-review stage-${coach.stage}`} aria-label="力力的现场判断">
    <header><span><ScanSearch size={15} aria-hidden="true" />现场判断 / LIVE CHECK</span><strong>{coach.label}</strong></header>
    <p className="lili-review-summary">{coach.summary}</p>
    {context && <dl className="lili-review-evidence"><div><dt>当前模型时刻</dt><dd>{Number(coach.timeSeconds.toFixed(3))} s</dd></div><div><dt>自动模型采样</dt><dd>{coach.modelSamples} / {coach.modelRecordCount} 条</dd></div><div><dt>手动虚拟读数</dt><dd>{coach.manualSamples} / {coach.manualRecordCount} 条</dd></div></dl>}
    <div className="lili-review-next"><span><FlaskConical size={15} aria-hidden="true" />下一步只做这件事</span><p>{coach.next}</p></div>
    {coach.evidence.length > 0 && <div className="lili-review-prompts"><span>本实验可以保留的证据</span><ul>{coach.evidence.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul></div>}
    <div className="lili-review-actions"><button type="button" disabled={busy || !context} onClick={() => onAsk("帮我检查当前实验")}><ClipboardCheck size={15} aria-hidden="true" />核对当前条件</button><button type="button" disabled={busy || !context} onClick={() => onAsk(coach.question)}>{coach.stage === "check" ? "继续分步提示" : coach.stage === "review" ? "检查已有记录" : coach.stage === "record" ? "记录哪些证据" : "获取一级提示"}<ArrowRight size={15} aria-hidden="true" /></button></div>
    <div className="lili-review-reflection"><span>检查我的想法</span><p>写下自己的观察、假设或结论。力力会检查表述是否交代条件和证据，不会替你编造读数。</p><div>{(["观察", "假设", "推理", "结论"] as const).map(kind => <button key={kind} type="button" disabled={busy || !context} onClick={() => onPrepare(kind)}>{kind}</button>)}</div></div>
    <small>只根据当前虚拟条件和已提供的记录给建议；未看到屏幕外的操作，也不据此判断实验完成或掌握程度。</small>
  </section>;
}
