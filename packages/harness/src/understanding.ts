import type { HarnessArea, HarnessDialogueIntent } from "./types";
import { findHarnessMisconception, getHarnessConceptNode } from "./conceptGraph";
export { reviewHarnessEvidenceText, reviewHarnessConclusionText, reviewHarnessHypothesisText, reviewHarnessReasoningText } from "./textReviews";

export type HarnessQuestionIntent =
  | "capabilities"
  | "purpose"
  | "procedure"
  | "observation"
  | "variables"
  | "evidence"
  | "comparison"
  | "prediction"
  | "principle"
  | "calculation"
  | "troubleshooting"
  | "safety"
  | "application"
  | "misconception"
  | "summary"
  | "direct-answer"
  | "unknown";

export type HarnessQuestionEntityType = "quantity" | "apparatus" | "concept" | "change" | "unit";

export interface HarnessQuestionEntity {
  type: HarnessQuestionEntityType;
  value: string;
}

export interface HarnessQuestionUnderstanding {
  rawText: string;
  normalizedText: string;
  intent: HarnessQuestionIntent;
  dialogueIntent: HarnessDialogueIntent;
  confidence: number;
  inScope: boolean;
  entities: HarnessQuestionEntity[];
  matchedSignals: string[];
}

export interface HarnessEvidenceReviewItem {
  id: "condition" | "observation" | "comparison" | "precision";
  label: string;
  passed: boolean;
}

export interface HarnessEvidenceReview {
  score: number;
  items: HarnessEvidenceReviewItem[];
  missing: string[];
  feedback: string;
  template: string;
}

export interface HarnessConclusionReviewItem {
  id: "claim" | "evidence-link" | "boundary" | "caution";
  label: string;
  passed: boolean;
}

export interface HarnessConclusionReview {
  score: number;
  items: HarnessConclusionReviewItem[];
  risks: string[];
  feedback: string;
  template: string;
}

export interface HarnessReasoningReview {
  score: number;
  items: Array<{ id: "evidence" | "bridge" | "control" | "scope"; label: string; passed: boolean }>;
  gaps: string[];
  feedback: string;
  template: string;
}

export interface HarnessHypothesisReview {
  score: number;
  items: Array<{ id: "variable" | "direction" | "outcome" | "testable"; label: string; passed: boolean }>;
  missing: string[];
  feedback: string;
  template: string;
}

const normalizations: Array<[RegExp, string]> = [
  [/刚昂/g, "刚刚"], [/咋整/g, "怎么办"], [/咋/g, "怎么"], [/啥/g, "什么"],
  [/先干嘛/g, "先做什么"], [/看不着/g, "看不到"], [/没反应/g, "没现象"],
  [/弄不出来/g, "没有得到结果"], [/对不对劲/g, "是否正确"], [/为啥/g, "为什么"],
  [/咋回事/g, "为什么"], [/没动静/g, "没现象"], [/读不出来/g, "看不到读数"],
  [/下一不/g, "下一步"], [/介个/g, "这个"], [/肿么/g, "怎么"]
];

const quantities = [
  "入射角", "反射角", "折射角", "焦距", "物距", "像距", "光屏距离", "频率", "振幅", "响度", "音调", "音色", "声速", "距离", "路程", "时间", "速度",
  "摩擦力", "拉力", "压力", "受力面积", "压强", "浮力", "重力", "力臂", "力矩", "电流", "电压", "电阻", "功率", "电能", "匝数", "温度", "沸点", "熔点",
  "质量", "体积", "密度", "分度值", "量程", "游码示数"
];

const apparatus = [
  "光源", "光屏", "三棱镜", "平面镜", "凹面镜", "凸面镜", "凸透镜", "凹透镜", "小孔", "声源", "接收器", "测力计", "杠杆", "钩码", "电源", "开关",
  "电流表", "电压表", "灯泡", "线圈", "温度计", "烧杯", "量筒", "天平", "砝码", "游码"
];

const changes = ["增大", "减小", "升高", "降低", "变大", "变小", "调高", "调低", "靠近", "远离", "增加", "减少", "固定", "保持不变"];
const units = ["Hz", "赫兹", "V", "伏", "A", "安", "Ω", "欧姆", "W", "瓦", "s", "秒", "m", "米", "cm", "厘米", "mm", "毫米", "g", "克", "kg", "千克", "℃", "度"];

const areaTerms: Record<HarnessArea, string[]> = {
  optics: ["光", "像", "反射", "折射", "色散", "光谱", "法线", "焦点", "虚像", "实像"],
  lens: ["透镜", "成像", "物距", "像距", "焦距", "虚像", "实像"],
  sound: ["声音", "振动", "波形", "频率", "振幅", "响度", "音调", "音色", "回声", "噪声", "真空"],
  mechanics: ["运动", "速度", "力", "摩擦", "杠杆", "压力", "压强", "浮力", "浮沉"],
  circuit: ["电", "电路", "电流", "电压", "电阻", "功率", "磁", "线圈", "短路", "断路"],
  thermal: ["温度", "加热", "沸腾", "熔化", "凝固", "蒸发", "汽化", "液化"],
  measurement: ["测量", "质量", "体积", "密度", "天平", "砝码", "游码", "量筒", "分度值", "量程"]
};

const unrelatedTerms = ["午饭", "吃什么", "天气", "股票", "新闻", "电影", "游戏", "旅游", "购物", "写作文"];
const experimentAnchors = /(实验|装置|器材|现象|观察|数据|读数|证据|结论|变量|步骤|规律|原理|公式|计算|单位|安全|注意事项|故障|记录|控制变量|自变量|因变量)/;
const contextualQuestions = /^(下一步|然后呢|先做什么|第一步|从哪里开始|怎么看|怎么比较|为什么会这样|这样对吗|怎么办)/;

interface IntentRule {
  intent: HarnessQuestionIntent;
  patterns: RegExp[];
  confidence: number;
}

const intentRules: IntentRule[] = [
  { intent: "capabilities", patterns: [/(你能|你会|光光能|可以).*(回答|做什么|帮什么|问什么)/, /怎么问|能问哪些/], confidence: .96 },
  { intent: "direct-answer", patterns: [/直接.*答案|告诉我.*答案|答案是什么|正确答案|结论是什么/], confidence: .95 },
  { intent: "summary", patterns: [/(本次|实验)?.*(小结|总结|记录报告)/, /把.*观察.*整理/], confidence: .93 },
  { intent: "safety", patterns: [/安全|注意事项|危险|会不会伤|保护|能不能直接碰/], confidence: .93 },
  { intent: "troubleshooting", patterns: [/失败|不对|没变化|没现象|看不到|不工作|不发光|不亮|不平衡|不清晰|模糊|出错|故障|检查什么|怎么办/], confidence: .9 },
  { intent: "calculation", patterns: [/公式|怎么算|如何计算|怎么计算|代入|单位换算/], confidence: .94 },
  { intent: "purpose", patterns: [/实验目的|研究什么|探究什么|主要.*什么|是干什么|能说明什么|学什么/], confidence: .91 },
  { intent: "procedure", patterns: [/从哪.*开始|从哪里入手|先做什么|第一步|操作步骤|操作顺序|怎么开始|如何开始|怎么操作/], confidence: .92 },
  { intent: "observation", patterns: [/观察什么|看哪里|重点看|关注什么|测量什么|读哪个|怎么看现象|出现什么/], confidence: .91 },
  { intent: "variables", patterns: [/自变量|因变量|控制变量|保持.*不变|固定什么|改变什么量|哪些量|哪个条件/], confidence: .94 },
  { intent: "evidence", patterns: [/记录什么|哪些证据|证据标准|数据表|表格|怎么记录|读数怎么写|现象怎么写/], confidence: .92 },
  { intent: "application", patterns: [/联系|应用|生活|科技|迁移/], confidence: .87 },
  { intent: "prediction", patterns: [/猜|预测|会不会|如果.*会|我觉得.*会/], confidence: .86 },
  { intent: "comparison", patterns: [/对比|比较|关系|影响|变化趋势|公平实验/], confidence: .82 },
  { intent: "principle", patterns: [/为什么|原理|规律|说明什么|怎么回事|原因/, /怎么.*(没|不).*(变|更|增|减|高|低|响|亮)/], confidence: .8 }
];

function normalize(text: string): string {
  return normalizations.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text.trim()).replace(/\s+/g, " ");
}

function addEntity(entities: HarnessQuestionEntity[], type: HarnessQuestionEntityType, value: string) {
  if (!entities.some((entity) => entity.type === type && entity.value === value)) entities.push({ type, value });
}

function dialogueIntentFor(intent: HarnessQuestionIntent): HarnessDialogueIntent {
  if (intent === "prediction") return "predict";
  if (intent === "variables" || intent === "comparison") return "compare";
  if (intent === "principle" || intent === "calculation" || intent === "application" || intent === "misconception") return "explain";
  if (intent === "evidence" || intent === "summary") return "reflect";
  if (intent === "procedure" || intent === "observation" || intent === "troubleshooting" || intent === "safety" || intent === "direct-answer") return "method";
  return "orientation";
}

export function understandHarnessQuestion(area: HarnessArea, module: string, rawText: string): HarnessQuestionUnderstanding {
  const normalizedText = normalize(rawText);
  const concept = getHarnessConceptNode(module);
  const entities: HarnessQuestionEntity[] = [];
  quantities.filter((value) => normalizedText.toLowerCase().includes(value.toLowerCase())).forEach((value) => addEntity(entities, "quantity", value));
  apparatus.filter((value) => normalizedText.includes(value)).forEach((value) => addEntity(entities, "apparatus", value));
  changes.filter((value) => normalizedText.includes(value)).forEach((value) => addEntity(entities, "change", value));
  units.filter((value) => normalizedText.toLowerCase().includes(value.toLowerCase())).forEach((value) => addEntity(entities, "unit", value));

  const conceptTerms = concept ? [concept.title, ...concept.prerequisites, ...concept.connections] : [];
  conceptTerms.filter((value) => normalizedText.includes(value)).forEach((value) => addEntity(entities, "concept", value));
  const misconception = findHarnessMisconception(module, normalizedText);
  const matchedSignals: string[] = [];
  let intent: HarnessQuestionIntent = "unknown";
  let confidence = .32;

  if (misconception) {
    intent = "misconception";
    confidence = .98;
    matchedSignals.push(`misconception:${misconception.id}`);
  } else {
    const rule = intentRules.find((item) => item.patterns.some((pattern) => pattern.test(normalizedText)));
    if (rule) {
      intent = rule.intent;
      confidence = rule.confidence;
      matchedSignals.push(`intent:${rule.intent}`);
    }
  }

  const hasDomainTerm = areaTerms[area].some((term) => normalizedText.includes(term));
  const hasExperimentAnchor = experimentAnchors.test(normalizedText);
  const isContextualQuestion = contextualQuestions.test(normalizedText);
  const isCapabilityQuestion = intent === "capabilities";
  const explicitlyUnrelated = unrelatedTerms.some((term) => normalizedText.includes(term));
  const inScope = !explicitlyUnrelated && (Boolean(misconception) || hasDomainTerm || hasExperimentAnchor || entities.length > 0 || isContextualQuestion || isCapabilityQuestion);
  if (hasDomainTerm) matchedSignals.push(`area:${area}`);
  if (hasExperimentAnchor) matchedSignals.push("experiment-anchor");
  if (entities.length > 0) confidence = Math.min(.99, confidence + .03);
  if (!inScope) confidence = Math.min(confidence, .4);

  return { rawText, normalizedText, intent, dialogueIntent: dialogueIntentFor(intent), confidence, inScope, entities, matchedSignals };
}
