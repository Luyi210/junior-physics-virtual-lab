import { useMemo } from "react";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import { getLiliCoachState, liliAnalysisReference } from "@physics-lab/harness/lili";
import { liliManualReference } from "@physics-lab/harness/lili-manual";
import type { LiliReflectionKind } from "@physics-lab/harness/lili";
import { ArrowRight, ClipboardCheck, FlaskConical, ScanSearch } from "lucide-react";

export function LiliReviewPanel({ context, busy, onAsk, onPrepare }: { context: LiliExperimentContext | null; busy: boolean; onAsk: (question: string) => void; onPrepare: (kind: LiliReflectionKind, cue?: string) => void }) {
  const coach = getLiliCoachState(context);
  return <section className={`lili-review stage-${coach.stage}`} aria-label="力力的现场判断">
    <header><span><ScanSearch size={15} aria-hidden="true" />现场判断 / LIVE CHECK</span><strong>{coach.label}</strong></header>
    <p className="lili-review-summary">{coach.summary}</p>
    {context && <dl className="lili-review-evidence"><div><dt>当前模型时刻</dt><dd>{Number(coach.timeSeconds.toFixed(3))} s</dd></div><div><dt>自动模型采样</dt><dd>{coach.modelSamples} / {coach.modelRecordCount} 条</dd></div><div><dt>手动虚拟读数</dt><dd>{coach.manualSamples} / {coach.manualRecordCount} 条</dd></div></dl>}
    <div className="lili-review-next"><span><FlaskConical size={15} aria-hidden="true" />下一步只做这件事</span><p>{coach.next}</p></div>
    {coach.variables && <dl className="lili-review-variables"><div><dt>改变什么</dt><dd>{coach.variables.independent}</dd></div><div><dt>看什么</dt><dd>{coach.variables.dependent}</dd></div><div><dt>保持什么</dt><dd>{coach.variables.controlled}</dd></div></dl>}
    {coach.challenge && <div className="lili-review-challenge"><span>本轮小挑战 · {coach.challenge.title}</span><p>{coach.challenge.prompt}</p><button type="button" disabled={busy} onClick={() => onPrepare(coach.challenge!.kind, coach.challenge!.prompt)}>写下我的{coach.challenge.kind}<ArrowRight size={14} aria-hidden="true" /></button><small>表述检查只核对条件与证据结构，不评判答案或物理掌握程度。</small></div>}
    <LiliEvidenceReview context={context} busy={busy} onAsk={onAsk} />
    {coach.evidence.length > 0 && <div className="lili-review-prompts"><span>本实验可以保留的证据</span><ul>{coach.evidence.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul></div>}
    <div className="lili-review-actions"><button type="button" disabled={busy || !context} onClick={() => onAsk("帮我检查当前实验")}><ClipboardCheck size={15} aria-hidden="true" />核对当前条件</button><button type="button" disabled={busy || !context} onClick={() => onAsk(coach.question)}>{coach.stage === "check" ? "继续分步提示" : coach.stage === "review" ? "检查已有记录" : coach.stage === "record" ? "记录哪些证据" : "获取一级提示"}<ArrowRight size={15} aria-hidden="true" /></button></div>
    <div className="lili-review-reflection"><span>检查我的想法</span><p>写下自己的观察、假设或结论。力力会检查表述是否交代条件和证据，不会替你编造读数。</p><div>{(["观察", "假设", "推理", "结论"] as const).map(kind => <button key={kind} type="button" disabled={busy || !context} onClick={() => onPrepare(kind)}>{kind}</button>)}</div></div>
    <small>只根据当前虚拟条件和已提供的记录给建议；未看到屏幕外的操作，也不据此判断实验完成或掌握程度。</small>
  </section>;
}

function LiliEvidenceReview({ context, busy, onAsk }: { context: LiliExperimentContext | null; busy: boolean; onAsk: (question: string) => void }) {
  const model = useMemo(() => liliAnalysisReference(context), [context?.experimentId, context?.samples, context?.recordCount]);
  const manual = useMemo(() => liliManualReference(context), [context?.experimentId, context?.manualSamples, context?.manualRecordCount]);
  if (!model?.includedCount && !manual?.includedCount) return null;
  const group = model?.groups[0];
  const lastManual = manual?.records.at(-1);
  return <section className="lili-review-analysis" aria-label="力力的记录复盘">
    <header><strong>记录复盘</strong><small>只分析本次收到的具体记录；两类来源分别核对</small></header>
    {model?.includedCount ? <article><span>自动模型采样 · {model.includedCount} 条参与分析</span>{group ? <><strong>{group.title}</strong><p>本组有 {group.sampleCount} 个分析点、{group.distinctXCount} 个不同横坐标。{group.status === "ready" ? "可以核对图像斜率与模型关系；拟合状态不代表实测准确。" : `暂不适合拟合：${group.reasons.join("；") || "还需补充可比较的数据"}。`}</p><small>{group.conditions.length ? `同组条件：${group.conditions.join("；")}` : "不同控制条件的记录须分开比较。"}</small></> : <p>具体采样已收到，但还没有可引用的关系分组。先核对保存时的条件和时间。</p>}<button type="button" disabled={busy} onClick={() => onAsk("分析自动模型采样")}>逐项分析模型记录<ArrowRight size={14} aria-hidden="true" /></button></article> : null}
    {manual?.includedCount ? <article><span>手动虚拟读数 · {manual.includedCount} 条可核对</span><p>最后一条保留你输入的原始读数；力力只重算派生量，不用理论值回填。{lastManual?.warnings.length ? `这条记录提醒：${lastManual.warnings[0]}` : "计数与定位仍需要你自己检查。"}</p><button type="button" disabled={busy} onClick={() => onAsk("看看我的手动读数")}>逐项核对手动读数<ArrowRight size={14} aria-hidden="true" /></button></article> : null}
  </section>;
}
