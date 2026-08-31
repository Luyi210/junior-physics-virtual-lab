import type { HarnessApparatusContext, HarnessArea, HarnessSession } from "./types";
import { diagnoseHarnessExperiment, getHarnessLearnerModel } from "./dialogue";
import { findHarnessMisconception } from "./conceptGraph";
import { reviewHarnessConclusionText, reviewHarnessEvidenceText, reviewHarnessHypothesisText, reviewHarnessReasoningText, understandHarnessQuestion } from "./understanding";

export type HarnessCoachTarget = "controls" | "visual" | "explanation";
export type HarnessCoachSeverity = "notice" | "warning" | "ready";

export interface HarnessCoachAlert {
  id: string;
  severity: HarnessCoachSeverity;
  eyebrow: string;
  title: string;
  message: string;
  prompt: string;
  actionLabel: string;
  target: HarnessCoachTarget;
  evidence: string;
}

export interface HarnessConceptMemory {
  visits: number;
  questions: number;
  misconceptionChecks: number;
  line: string;
}

export type HarnessMasteryBand = "new" | "forming" | "stable" | "transfer";

export interface HarnessMisconceptionMemory {
  id: string;
  claim: string;
  count: number;
  correction: string;
  probe: string;
}

export interface HarnessKnowledgeMastery {
  score: number;
  band: HarnessMasteryBand;
  bandLabel: string;
  confidence: number;
  evidenceCount: number;
  visits: number;
  operations: number;
  comparisons: number;
  observations: number;
  reasoningTurns: number;
  strength: string;
  nextReview: string;
  misconception?: HarnessMisconceptionMemory;
}

export interface HarnessReviewSchedule {
  status: "not-ready" | "upcoming" | "due";
  intervalDays: number;
  elapsedDays: number;
  dueAt?: string;
  label: string;
  reason: string;
  prompt: string;
}

export interface HarnessDraftFeedback {
  mode: "question" | "observation" | "hypothesis" | "reasoning" | "conclusion" | "out-of-scope";
  label: string;
  confidence: number;
  message: string;
  signals: string[];
  observationQuality?: number;
  checklist?: Array<{ id: string; label: string; passed: boolean }>;
}

const intentLabels = {
  capabilities: "能力范围", purpose: "实验目的", procedure: "操作步骤", observation: "观察重点",
  variables: "变量控制", evidence: "证据记录", comparison: "公平比较", prediction: "实验预测",
  principle: "原理解释", calculation: "公式计算", troubleshooting: "装置排查", safety: "实验安全",
  application: "生活迁移", misconception: "概念辨析", summary: "实验小结", "direct-answer": "答案请求", unknown: "自由表达"
} as const;

function currentModuleReasoningTurns(session: HarnessSession, module: string) {
  return (session.dialogue ?? []).filter((message) => message.module === module && message.role === "assistant" && (message.intent === "explain" || message.intent === "predict" || message.intent === "reflect")).length;
}

function historicalModuleEvents(session: HarnessSession, module: string) {
  let activeModule: string | undefined;
  return session.events.filter((event) => {
    if (event.type === "module.entered" && typeof event.payload.module === "string") activeModule = event.payload.module;
    return activeModule === module;
  });
}

function misconceptionMemory(session: HarnessSession, module: string): HarnessMisconceptionMemory | undefined {
  const counts = new Map<string, HarnessMisconceptionMemory>();
  for (const message of session.dialogue ?? []) {
    if (message.module !== module || message.role !== "learner") continue;
    const match = findHarnessMisconception(module, message.text);
    if (!match) continue;
    const previous = counts.get(match.id);
    counts.set(match.id, { id: match.id, claim: match.claim, count: (previous?.count ?? 0) + 1, correction: match.correction, probe: match.probe });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0];
}

export function getHarnessKnowledgeMastery(session: HarnessSession, module: string): HarnessKnowledgeMastery {
  const events = historicalModuleEvents(session, module);
  const visits = events.filter((event) => event.type === "module.entered").length;
  const operations = events.filter((event) => event.type === "control.changed" || event.type === "configuration.changed").length;
  const controlValues = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.type !== "control.changed" && event.type !== "configuration.changed") continue;
    const control = String(event.payload.control ?? event.payload.id ?? event.payload.name ?? "condition");
    const value = String(event.payload.value ?? event.payload.next ?? JSON.stringify(event.payload));
    const values = controlValues.get(control) ?? new Set<string>();
    values.add(value);
    controlValues.set(control, values);
  }
  const comparisons = [...controlValues.values()].filter((values) => values.size >= 2).length;
  const eventIds = new Set(events.map((event) => event.id));
  const observations = session.observations.filter((observation) => observation.relatedEventId && eventIds.has(observation.relatedEventId)).length;
  const reasoningTurns = currentModuleReasoningTurns(session, module);
  const misconception = misconceptionMemory(session, module);
  const recurrence = visits >= 2 && observations > 0 ? 1 : 0;
  const score = Math.round(
    Math.min(1, operations / 4) * 20
    + Math.min(1, comparisons) * 25
    + Math.min(1, observations / 2) * 25
    + Math.min(1, reasoningTurns / 2) * 20
    + recurrence * 10
  );
  const evidenceCount = Math.min(5, (operations > 0 ? 1 : 0) + (comparisons > 0 ? 1 : 0) + (observations > 0 ? 1 : 0) + (reasoningTurns > 0 ? 1 : 0) + recurrence);
  const band: HarnessMasteryBand = score >= 80 ? "transfer" : score >= 55 ? "stable" : score >= 25 ? "forming" : "new";
  const bandLabel = { new: "刚刚建立经验", forming: "证据正在形成", stable: "探究链较稳定", transfer: "可以尝试迁移" }[band];
  const signals = [
    { ready: operations > 0, label: "真实操作" },
    { ready: comparisons > 0, label: "公平对照" },
    { ready: observations > 0, label: "观察记录" },
    { ready: reasoningTurns > 0, label: "解释推理" },
    { ready: recurrence > 0, label: "再次验证" }
  ];
  const strength = signals.filter((signal) => signal.ready).map((signal) => signal.label).slice(-2).join("、") || "进入实验并开始探索";
  const missing = signals.find((signal) => !signal.ready)?.label;
  const nextReview = misconception && misconception.count >= 2
    ? `先重新核验“${misconception.claim}”这个反复出现的判断`
    : missing ? `下一次优先补充${missing}证据` : "换一个情境检验规律是否仍成立";
  const confidence = Math.min(.95, .3 + Math.min(10, operations + observations + reasoningTurns + visits) * .06);
  return { score, band, bandLabel, confidence, evidenceCount, visits, operations, comparisons, observations, reasoningTurns, strength, nextReview, misconception };
}

export function getHarnessReviewSchedule(session: HarnessSession, module: string, now = new Date()): HarnessReviewSchedule {
  const mastery = getHarnessKnowledgeMastery(session, module);
  const activityTimes = [
    ...historicalModuleEvents(session, module).filter((event) => event.type !== "module.entered").map((event) => event.occurredAt),
    ...(session.dialogue ?? []).filter((message) => message.module === module).map((message) => message.createdAt)
  ].map((value) => new Date(value).getTime()).filter(Number.isFinite);
  const lastActivity = activityTimes.length ? Math.max(...activityTimes) : undefined;
  if (!lastActivity || mastery.evidenceCount < 4) return {
    status: "not-ready", intervalDays: 0, elapsedDays: 0, label: "先完成本轮探究", reason: "形成操作与证据后，光光才会安排回访，不会用时间替代学习证据。", prompt: "我还缺少哪一种实验记录？"
  };
  const intervalDays = mastery.band === "transfer" ? 14 : mastery.band === "stable" ? 7 : 2;
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - lastActivity) / 86_400_000));
  const dueTime = lastActivity + intervalDays * 86_400_000;
  const status = elapsedDays >= intervalDays ? "due" : "upcoming";
  return {
    status,
    intervalDays,
    elapsedDays,
    dueAt: new Date(dueTime).toISOString(),
    label: status === "due" ? "建议现在做一次无提示回忆" : `${Math.max(1, intervalDays - elapsedDays)} 天后再回访`,
    reason: status === "due" ? `距离上次有效探究已约 ${elapsedDays} 天，先回忆证据再看提示。` : `依据当前证据阶段，暂定 ${intervalDays} 天回访一次。`,
    prompt: "先不要给提示，请让我回忆这个实验的变量、证据和结论，再逐项检查。"
  };
}

export function getHarnessCoachAlert(session: HarnessSession, module: string, apparatus?: HarnessApparatusContext): HarnessCoachAlert {
  const diagnosis = diagnoseHarnessExperiment(session, module);
  const apparatusIssue = apparatus?.current.module === module ? apparatus.current.validity.issues.find(Boolean) : undefined;
  if (apparatusIssue) return {
    id: `apparatus-${module}-${apparatusIssue}`,
    severity: "warning",
    eyebrow: "LIVE DIAGNOSIS / 装置实时诊断",
    title: "当前装置还不具备有效读数条件",
    message: apparatusIssue,
    prompt: "结合当前装置告诉我哪里还没准备好？",
    actionLabel: "请光光逐项排查",
    target: "controls",
    evidence: "依据当前装置快照中的有效性检查"
  };
  const mastery = getHarnessKnowledgeMastery(session, module);
  if (mastery.misconception && mastery.misconception.count >= 2) return {
    id: `misconception-${module}-${mastery.misconception.id}-${mastery.misconception.count}`,
    severity: "warning",
    eyebrow: "MEMORY CHECK / 重复误区核验",
    title: "光光发现一个反复出现的判断",
    message: `“${mastery.misconception.claim}”已出现 ${mastery.misconception.count} 次。这次先不背结论，用反例实验重新核验。`,
    prompt: mastery.misconception.probe,
    actionLabel: "开始反例核验",
    target: "visual",
    evidence: "依据本地保存的多次实验对话记录"
  };
  const review = getHarnessReviewSchedule(session, module);
  if (review.status === "due") return {
    id: `retrieval-${module}-${review.elapsedDays}`,
    severity: "notice",
    eyebrow: "RETRIEVAL PRACTICE / 主动回忆",
    title: "先不看提示，试着把证据链从记忆中找回来",
    message: review.reason,
    prompt: review.prompt,
    actionLabel: "开始无提示回忆",
    target: "explanation",
    evidence: `依据本地最后活动时间与 ${review.intervalDays} 天回访间隔`
  };
  if (diagnosis.operationCount === 0) return {
    id: `start-${module}`,
    severity: "notice",
    eyebrow: "SMART NEXT MOVE / 光光主动建议",
    title: "先让一个主要变量真正动起来",
    message: diagnosis.nextMove,
    prompt: "根据当前实验告诉我第一步操作什么？",
    actionLabel: "生成第一步",
    target: "controls",
    evidence: "当前实验尚未检测到有效操作"
  };
  if (!diagnosis.comparisonReady) return {
    id: `compare-${module}-${diagnosis.operationCount}`,
    severity: diagnosis.activeControls.length > 1 ? "warning" : "notice",
    eyebrow: "CONTROL CHECK / 控制变量诊断",
    title: diagnosis.activeControls.length > 1 ? "操作过多个条件，但还没形成公平对照" : "已经有第一组，还缺少可比较的第二组",
    message: diagnosis.nextMove,
    prompt: "怎样用我刚才的操作补一组公平对照？",
    actionLabel: "设计第二组",
    target: "controls",
    evidence: `依据 ${diagnosis.operationCount} 次操作和当前变量轨迹`
  };
  if (diagnosis.observationCount === 0) return {
    id: `evidence-${module}-${diagnosis.operationCount}`,
    severity: "notice",
    eyebrow: "EVIDENCE GATE / 证据缺口",
    title: "两组条件已经形成，现在要把差异写具体",
    message: "不要只写“变了”或“成功了”；记录两组条件以及对应的数值、方向、状态或曲线差异。",
    prompt: "根据当前实验告诉我应该记录哪些直接证据？",
    actionLabel: "检查证据项",
    target: "visual",
    evidence: "已形成对比，但当前实验还没有学生观察记录"
  };
  if (currentModuleReasoningTurns(session, module) === 0) return {
    id: `reason-${module}-${diagnosis.observationCount}`,
    severity: "notice",
    eyebrow: "REASONING LINK / 推理连接",
    title: "你已经留下证据，还差“证据为什么支持规律”",
    message: "把直接观察和物理解释分开，再用“因为……所以……”连接；光光会检查中间是否跳步。",
    prompt: "帮我检查我的观察为什么可能支持当前规律？",
    actionLabel: "检查推理链",
    target: "explanation",
    evidence: `依据 ${diagnosis.observationCount} 条观察记录`
  };
  return {
    id: `ready-${module}-${diagnosis.observationCount}`,
    severity: "ready",
    eyebrow: "TRANSFER READY / 可继续挑战",
    title: "本轮已具备操作、对比、证据与解释",
    message: "可以复现实验、寻找反例，或把规律迁移到一个生活科技情境中。",
    prompt: "根据我的记录给我一个迁移挑战，不要直接给答案。",
    actionLabel: "生成迁移挑战",
    target: "visual",
    evidence: "依据当前完整探究链判断"
  };
}

export function getHarnessConceptMemory(session: HarnessSession, module: string): HarnessConceptMemory {
  const visits = session.events.filter((event) => event.type === "module.entered" && event.payload.module === module).length;
  const learnerMessages = (session.dialogue ?? []).filter((message) => message.module === module && message.role === "learner");
  const misconceptionChecks = learnerMessages.filter((message) => Boolean(findHarnessMisconception(module, message.text))).length;
  const questions = learnerMessages.length;
  const line = visits <= 1
    ? "这是光光记录到的本实验首次探究"
    : misconceptionChecks > 0
      ? `已进入 ${visits} 次；曾进行 ${misconceptionChecks} 次概念辨析，本轮会优先检查同类证据`
      : `已进入 ${visits} 次并提出 ${questions} 个问题，光光会沿用已有操作记忆`;
  return { visits, questions, misconceptionChecks, line };
}

export function getRecommendedHarnessHintLevel(session: HarnessSession, module: string): 1 | 2 | 3 {
  const diagnosis = diagnoseHarnessExperiment(session, module);
  if (diagnosis.operationCount === 0) return 1;
  if (!diagnosis.comparisonReady) return 2;
  return 3;
}

export function analyzeHarnessDraft(area: HarnessArea, module: string, text: string): HarnessDraftFeedback | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const understanding = understandHarnessQuestion(area, module, trimmed);
  const explicitQuestion = /[？?]$/.test(trimmed) || /^(为什么|怎么|怎样|如何|是否|能不能|可不可以|下一步|然后|请问|光光|帮我|告诉我)/.test(trimmed);
  const looksLikeHypothesis = !explicitQuestion && /(我猜|我预测|我认为|假设|如果.+(?:那么|就|会)|可能会|应该会)/.test(trimmed);
  const looksLikeReasoning = !explicitQuestion && /(因为.+所以|这是由于|原因是|导致|使得|从而)/.test(trimmed);
  const looksLikeConclusion = !explicitQuestion && /(因此|所以|说明|表明|由此可得|结论是|总是|一定|只要.+就)/.test(trimmed);
  const evidenceStatement = /(保持|固定|改变|调到|从.+到|观察到|显示|读数)/.test(trimmed) && /\d|更|变|不变|上升|下降|亮|暗|高|低|清晰|模糊|平衡|沸腾|熔化/.test(trimmed);
  const looksLikeQuestion = explicitQuestion || (!evidenceStatement && understanding.intent !== "unknown");
  const signals = understanding.entities.slice(0, 4).map((entity) => entity.value);
  if (looksLikeHypothesis) {
    const review = reviewHarnessHypothesisText(trimmed);
    return { mode: "hypothesis", label: `可检验假设 ${review.score}/4`, confidence: Math.min(.96, .5 + review.score * .11), message: review.feedback, signals, observationQuality: review.score, checklist: review.items };
  }
  if (looksLikeReasoning) {
    const review = reviewHarnessReasoningText(trimmed);
    return { mode: "reasoning", label: `因果链完整度 ${review.score}/4`, confidence: Math.min(.96, .5 + review.score * .11), message: review.feedback, signals, observationQuality: review.score, checklist: review.items };
  }
  if (looksLikeConclusion) {
    const review = reviewHarnessConclusionText(trimmed);
    return { mode: "conclusion", label: `结论严谨度 ${review.score}/4`, confidence: Math.min(.96, .5 + review.score * .11), message: review.feedback, signals, observationQuality: review.score, checklist: review.items };
  }
  if (looksLikeQuestion) {
    if (!understanding.inScope) return { mode: "out-of-scope", label: "当前实验范围外", confidence: understanding.confidence, message: "光光不会猜测无关答案；可以改成关于装置、变量、读数、现象或物理规律的问题。", signals };
    return {
      mode: "question",
      label: `识别为：${intentLabels[understanding.intent]}`,
      confidence: understanding.confidence,
      message: signals.length ? `已识别关键词：${signals.join("、")}；回答会结合当前装置和最近操作。` : "回答会结合当前装置、当前探究阶段和已有证据。",
      signals
    };
  }
  const review = reviewHarnessEvidenceText(trimmed);
  return { mode: "observation", label: `观察证据完整度 ${review.score}/4`, confidence: Math.min(.95, .45 + review.score * .12), message: review.feedback, signals, observationQuality: review.score, checklist: review.items };
}

export function getHarnessLearningEvidenceSummary(session: HarnessSession, module: string) {
  const model = getHarnessLearnerModel(session, module);
  return { overall: model.overall, strongest: model.strength, next: model.nextChallenge };
}
