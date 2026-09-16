import { createHash } from "node:crypto";
import { listHarnessConceptNodes } from "../../../packages/harness/src/conceptGraph.ts";
import {
  physicsGraphDomains,
  physicsKnowledgeGraph,
  physicsKnowledgeRelations
} from "../../web/src/features/student/physicsKnowledgeGraph.ts";
import { textbookChapters } from "../../web/src/features/student/textbookKnowledge.ts";

const RAG_VERSION = "kg-rag-v2";
const RETRIEVAL_MODE = "hybrid-context-kg-v2";
const AREA_TO_DOMAIN = {
  optics: "light",
  lens: "light",
  sound: "sound",
  mechanics: "mechanics",
  circuit: "circuit",
  thermal: "thermal",
  measurement: "measurement"
};

const TYPE_LABELS = {
  overview: "核心概念",
  inquiry: "探究问题",
  method: "实验方法",
  evidence: "证据标准",
  misconception: "常见误区",
  hint: "分层提示",
  application: "知识迁移",
  textbook: "教材映射"
};

const INTENT_PATTERNS = {
  misconception: /错误|误区|混淆|是不是|对不对|为什么不对|总是|一定/iu,
  method: /怎么做|如何做|步骤|操作|连接|接线|从哪|开始|先做|排查|故障|不亮|没反应|没现象/iu,
  hint: /提示|引导|不会|卡住|下一步|观察哪里|看哪里/iu,
  evidence: /证据|数据|读数|记录|现象|变量|比较|误差|结论|报告/iu,
  application: /生活|应用|联系|迁移|为什么会|解释/iu,
  textbook: /教材|课本|章节|八年级|九年级|八上|八下|九上|九下/iu
};

const QUERY_INTENT_PATTERNS = {
  safety: /安全|危险|触电|市电|短路|短接|冒烟|发热|烫伤|酒精灯|火焰|激光|强光|玻璃破|爆炸|直接接电源|导线.{0,8}电池.{0,8}两端|电池.{0,8}两端.{0,8}导线/iu,
  troubleshooting: /故障|排查|不亮|没反应|没现象|没有|不清晰|模糊|不工作|不成立|未完成|还不|接不到|测不到|读数为零|异常|怎么回事|哪里错|为什么不/iu,
  procedure: /怎么做|怎么办|如何做|步骤|操作|连接|接线|从哪|开始|先做|下一步|调哪里|放哪里/iu,
  evidence: /证据|数据|读数|记录|现象|变量|比较|误差|结论|报告|支持|说明了什么/iu,
  calculation: /计算|怎么算|公式|代入|单位|结果是多少|求出|斜率/iu,
  misconception: /错误|误区|混淆|是不是|对不对|一定|总是|能不能/iu,
  application: /生活|应用|联系|迁移|现实|例子|为什么会/iu,
  textbook: /教材|课本|章节|八年级|九年级|八上|八下|九上|九下/iu,
  hint: /提示|引导|不会|卡住|观察哪里|看哪里|别告诉答案/iu
};

const INTENT_CONTENT_TYPES = {
  safety: ["method", "hint", "evidence", "overview"],
  troubleshooting: ["method", "hint", "misconception", "evidence"],
  procedure: ["method", "hint", "inquiry", "evidence"],
  evidence: ["evidence", "method", "overview", "inquiry"],
  calculation: ["evidence", "overview", "method"],
  misconception: ["misconception", "overview", "evidence"],
  application: ["application", "overview", "evidence"],
  textbook: ["textbook", "overview", "inquiry"],
  hint: ["hint", "method", "inquiry"],
  concept: ["overview", "inquiry", "evidence"]
};

const CONTEXT_DEPENDENT_QUESTION = /^(这个|这样|现在|然后|接着)?(怎么办|怎么做|怎么回事|为什么|对吗|可以吗|行吗|下一步|呢|咋办)[？?。!！]*$/iu;

const QUERY_ALIASES = new Map([
  ["不亮", ["灯泡不亮", "没反应", "断路", "短路", "闭合回路"]],
  ["没反应", ["不工作", "没现象", "故障", "装置状态"]],
  ["角度", ["入射角", "反射角", "折射角", "法线"]],
  ["声音大小", ["响度", "振幅", "声级"]],
  ["声音高低", ["音调", "频率"]],
  ["真空", ["真空不能传声", "声音传播", "介质"]],
  ["拉木块", ["匀速拉木块", "滑动摩擦", "测力计"]],
  ["通风", ["空气流动", "风吹干得快", "蒸发", "晾衣服"]],
  ["水烧开", ["沸腾", "沸点", "温度平台"]],
  ["称重", ["质量", "托盘天平", "砝码", "游码"]],
  ["浮起来", ["浮力", "上浮", "漂浮", "密度"]],
  ["费电", ["电功率", "电能", "用电时间"]]
]);

function normalize(value) {
  return String(value ?? "")
    .toLocaleLowerCase("zh-CN")
    .replaceAll("ρ", "密度")
    .replaceAll("∠", "角")
    .replace(/[\s，。！？、,.!?：:；;“”'"（）()《》\[\]【】=＋+\-—_/\\]/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hashId(prefix, value) {
  return `${prefix}-${createHash("sha256").update(String(value)).digest("hex").slice(0, 16)}`;
}

function ngrams(value, size = 2) {
  const normalized = normalize(value);
  if (normalized.length <= size) return normalized ? new Set([normalized]) : new Set();
  return new Set(Array.from({ length: normalized.length - size + 1 }, (_, index) => normalized.slice(index, index + size)));
}

function diceSimilarity(left, right) {
  const a = ngrams(left);
  const b = ngrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function expandQuestion(question) {
  const expanded = [String(question ?? "")];
  for (const [term, aliases] of QUERY_ALIASES) {
    if (question.includes(term) || aliases.some((alias) => question.includes(alias))) expanded.push(term, ...aliases);
  }
  return unique(expanded).join(" ");
}

function chapterFor(module) {
  return textbookChapters.find((chapter) => chapter.nodeIds.includes(module));
}

function buildCatalog() {
  const discoveryByModule = new Map(physicsKnowledgeGraph.map((node) => [node.id, node]));
  return listHarnessConceptNodes().map((concept) => {
    const discovery = discoveryByModule.get(concept.module);
    const chapter = chapterFor(concept.module);
    const domain = discovery?.domain ?? AREA_TO_DOMAIN[concept.area] ?? concept.area;
    return {
      id: concept.id,
      module: concept.module,
      area: concept.area,
      domain,
      domainLabel: physicsGraphDomains[domain]?.label ?? concept.area,
      title: concept.title,
      route: discovery?.route,
      inquiryQuestion: concept.inquiryQuestion,
      prerequisites: concept.prerequisites,
      evidenceCriteria: concept.evidenceCriteria,
      misconceptions: concept.misconceptions,
      hintLadder: concept.hintLadder,
      connections: concept.connections,
      concepts: discovery?.concepts ?? [],
      signals: discovery?.signals ?? [],
      relatedModules: discovery?.related ?? [],
      chapter: chapter ? {
        id: chapter.id,
        volume: chapter.volume,
        number: chapter.chapterNumber,
        title: chapter.title,
        locator: chapter.locator,
        summary: chapter.summary,
        law: chapter.law
      } : undefined
    };
  });
}

const catalog = buildCatalog();
const catalogByModule = new Map(catalog.map((node) => [node.module, node]));
const relationsBySourceModule = new Map(catalog.map((node) => [
  node.module,
  physicsKnowledgeRelations.filter((relation) => relation.sourceId === node.module)
]));

function addGraphVertex(vertices, id, kind, label, metadata = {}) {
  if (!vertices.has(id)) vertices.set(id, { id, kind, label, ...metadata });
}

function buildGraph() {
  const vertices = new Map();
  const edges = [];
  const edgeKeys = new Set();
  const addEdge = (sourceId, targetId, type, weight) => {
    const key = `${sourceId}|${targetId}|${type}`;
    if (sourceId === targetId || edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ sourceId, targetId, type, weight });
  };

  for (const node of catalog) {
    addGraphVertex(vertices, node.id, "experiment", node.title, { module: node.module, domain: node.domain });
    for (const concept of node.concepts) {
      const conceptId = `concept:${normalize(concept)}`;
      addGraphVertex(vertices, conceptId, "concept", concept);
      addEdge(node.id, conceptId, "teaches", 0.86);
    }
    for (const prerequisite of node.prerequisites) {
      const prerequisiteId = `concept:${normalize(prerequisite)}`;
      addGraphVertex(vertices, prerequisiteId, "concept", prerequisite);
      addEdge(node.id, prerequisiteId, "requires", 0.92);
    }
    for (const misconception of node.misconceptions) {
      const misconceptionId = `misconception:${node.module}:${misconception.id}`;
      addGraphVertex(vertices, misconceptionId, "misconception", misconception.claim, { module: node.module });
      addEdge(node.id, misconceptionId, "corrects", 0.9);
    }
    for (const application of node.connections) {
      const applicationId = `application:${normalize(application)}`;
      addGraphVertex(vertices, applicationId, "application", application);
      addEdge(node.id, applicationId, "applies-to", 0.72);
    }
    if (node.chapter) {
      const chapterId = `chapter:${node.chapter.id}`;
      addGraphVertex(vertices, chapterId, "chapter", `${node.chapter.volume} ${node.chapter.title}`, { volume: node.chapter.volume });
      addEdge(node.id, chapterId, "belongs-to", 1);
    }
  }

  for (const relation of physicsKnowledgeRelations) {
    const source = catalogByModule.get(relation.sourceId);
    const target = catalogByModule.get(relation.targetId);
    if (source && target) addEdge(source.id, target.id, relation.type, relation.weight);
  }

  return { vertices: [...vertices.values()], edges };
}

const graph = buildGraph();

function chunk(node, type, key, content, keywords, options = {}) {
  return {
    id: `${node.id}:${type}:${key}`,
    nodeId: node.id,
    module: node.module,
    area: node.area,
    domain: node.domain,
    title: node.title,
    section: options.section ?? TYPE_LABELS[type],
    contentType: type,
    audience: options.audience ?? "both",
    difficulty: options.difficulty ?? 2,
    content,
    keywords: unique([node.title, node.domainLabel, ...node.concepts, ...node.signals, ...keywords]),
    route: node.route,
    source: node.chapter?.locator ?? "格物实验室原创教学知识库",
    sourceVersion: RAG_VERSION
  };
}

function buildChunks() {
  return catalog.flatMap((node) => {
    const chunks = [
      chunk(node, "overview", "core", `${node.title}涉及${node.concepts.join("、") || node.domainLabel}。核心探究是：${node.inquiryQuestion}`, node.prerequisites),
      chunk(node, "inquiry", "question", `探究问题：${node.inquiryQuestion}。开始前需要理解：${node.prerequisites.join("、")}。`, node.prerequisites),
      chunk(node, "evidence", "criteria", `判断本实验是否形成有效证据，需要检查：${node.evidenceCriteria.join("；")}。`, ["证据", "观察", "记录", "控制变量"], { difficulty: 2 }),
      chunk(node, "method", "scaffold", `实验应逐步推进：${node.hintLadder.join("；")}。`, ["步骤", "操作", "变量", "下一步"]),
      chunk(node, "application", "connections", `${node.title}可以联系：${node.connections.join("、")}。迁移时应先确认当前实验的证据和适用条件。`, node.connections, { difficulty: 3 })
    ];

    node.hintLadder.forEach((hint, index) => chunks.push(chunk(
      node,
      "hint",
      `level-${index + 1}`,
      `${index + 1}级提示：${hint}`,
      ["提示", "引导", `第${index + 1}级`],
      { difficulty: index + 1, audience: "student", section: `${index + 1}级实验提示` }
    )));

    node.misconceptions.forEach((item) => chunks.push(chunk(
      node,
      "misconception",
      item.id,
      `常见误区：“${item.claim}”。纠正：${item.correction}检验方法：${item.probe}`,
      [item.claim, ...item.triggers, "误区", "错误概念"],
      { difficulty: 2, section: "常见误区与诊断" }
    )));

    if (node.chapter) chunks.push(chunk(
      node,
      "textbook",
      node.chapter.id,
      `${node.chapter.locator}。${node.chapter.summary}相关规律：${node.chapter.law}`,
      [node.chapter.volume, node.chapter.title, node.chapter.law],
      { section: "教材章节映射" }
    ));
    return chunks;
  });
}

const chunks = buildChunks();
const chunksByModule = new Map(catalog.map((node) => [node.module, chunks.filter((item) => item.module === node.module)]));

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "未记录";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value).replace(/\s+/g, " ").trim().slice(0, 120);
}

function safeArray(value, limit = 24) {
  return Array.isArray(value) ? value.slice(-limit) : [];
}

function snapshotFacts(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  return ["controls", "apparatus", "readings", "derived"].flatMap((group) => safeArray(snapshot[group], 16).flatMap((datum) => {
    if (!datum || typeof datum !== "object") return [];
    const label = String(datum.label ?? datum.id ?? "实验状态").replace(/\s+/g, " ").trim().slice(0, 64);
    if (!label) return [];
    const value = displayValue(datum.value);
    const unit = datum.unit ? String(datum.unit).slice(0, 16) : "";
    return [`${label}:${value}${unit}`];
  }));
}

function snapshotChanges(previous, current) {
  if (!previous || !current || typeof previous !== "object" || typeof current !== "object") return [];
  const rows = (snapshot) => new Map(["controls", "apparatus", "readings", "derived"].flatMap((group) => safeArray(snapshot[group], 16).flatMap((datum) => {
    if (!datum || typeof datum !== "object") return [];
    const id = `${group}:${String(datum.id ?? datum.label ?? "")}`;
    return id.endsWith(":") ? [] : [[id, datum]];
  })));
  const before = rows(previous);
  const after = rows(current);
  const changes = [];
  for (const [id, datum] of after) {
    const old = before.get(id);
    if (!old || displayValue(old.value) === displayValue(datum.value)) continue;
    changes.push(`${String(datum.label ?? datum.id).slice(0, 48)}:${displayValue(old.value)}→${displayValue(datum.value)}${datum.unit ? String(datum.unit).slice(0, 16) : ""}`);
  }
  return changes.slice(0, 12);
}

function normalizeRetrievalContext(context) {
  const raw = context && typeof context === "object" ? context : {};
  const apparatus = raw.apparatus && typeof raw.apparatus === "object" ? raw.apparatus : {};
  const current = apparatus.current && typeof apparatus.current === "object" ? apparatus.current : undefined;
  const previous = apparatus.previous && typeof apparatus.previous === "object" ? apparatus.previous : undefined;
  const module = [raw.module, current?.module, raw.experimentId, raw.lesson?.experimentId]
    .find((value) => typeof value === "string" && catalogByModule.has(value));
  const area = typeof raw.area === "string" ? raw.area : catalogByModule.get(module)?.area;
  const issues = safeArray(current?.validity?.issues, 8)
    .map((item) => String(item ?? "").replace(/\s+/g, " ").trim().slice(0, 180))
    .filter(Boolean);
  const facts = snapshotFacts(current).slice(0, 36);
  const changes = snapshotChanges(previous, current);
  const observations = safeArray(raw.observations, 8).flatMap((item) => {
    const value = typeof item === "string" ? item : item && typeof item === "object" ? item.text : "";
    const clean = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    return clean ? [clean] : [];
  });
  const recentEvents = safeArray(raw.recentEvents, 18).filter((item) => item && typeof item === "object");
  const eventSignals = recentEvents.flatMap((event) => {
    const type = typeof event.type === "string" ? event.type : "";
    const payload = event.payload && typeof event.payload === "object"
      ? Object.entries(event.payload).slice(0, 10).map(([key, value]) => `${key}:${displayValue(value)}`)
      : [];
    return [type, ...payload].filter(Boolean);
  }).slice(-36);
  const lessonSignals = raw.lesson && typeof raw.lesson === "object"
    ? [raw.lesson.title, raw.lesson.objective, raw.lesson.inquiryQuestion].map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  const recentDialogue = safeArray(raw.recentDialogue, 6).flatMap((message) => {
    if (!message || typeof message !== "object" || message.role !== "learner") return [];
    const clean = String(message.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    return clean ? [clean] : [];
  });
  const apparatusReady = typeof current?.validity?.ready === "boolean" ? current.validity.ready : undefined;
  const hasReadings = safeArray(current?.readings, 16).some((datum) => datum && typeof datum === "object" && datum.value !== null && datum.value !== undefined && datum.value !== "");
  const hasInteractions = recentEvents.some((event) => ["control.changed", "configuration.changed", "simulation.toggled"].includes(event.type)) || current?.origin === "learner";
  let stage = "unknown";
  if (current) {
    if (apparatusReady) stage = "ready";
    else if (issues.length) stage = hasReadings || hasInteractions ? "collecting" : "setup";
    else if (hasReadings) stage = "observing";
    else stage = hasInteractions ? "operating" : "orientation";
  } else if (observations.length) stage = "reflecting";
  else if (recentEvents.length) stage = "operating";

  const signals = unique([...issues, ...changes, ...facts, ...observations, ...eventSignals, ...lessonSignals, ...recentDialogue])
    .map((item) => String(item).slice(0, 240))
    .slice(0, 80);
  return {
    module,
    area,
    stage,
    apparatusReady,
    evidenceStatus: apparatusReady === true ? "ready" : apparatusReady === false || issues.length ? "incomplete" : "unknown",
    issues,
    facts,
    changes,
    observations,
    recentEventTypes: unique(recentEvents.map((event) => event.type).filter((type) => typeof type === "string")).slice(0, 10),
    signals,
    searchText: signals.join(" ").slice(0, 6000)
  };
}

function inferRetrievalPlan(question, audience, context) {
  const intents = [];
  for (const [intent, pattern] of Object.entries(QUERY_INTENT_PATTERNS)) if (pattern.test(question)) intents.push(intent);
  if (QUERY_INTENT_PATTERNS.safety.test(context.issues.join(" "))) intents.unshift("safety");
  if (!intents.length) intents.push("concept");
  if (QUERY_INTENT_PATTERNS.troubleshooting.test(context.issues.join(" ")) && (CONTEXT_DEPENDENT_QUESTION.test(question.trim()) || question.trim().length <= 8)) intents.unshift("troubleshooting");
  const uniqueIntents = unique(intents);
  const preferredTypes = unique(uniqueIntents.flatMap((intent) => INTENT_CONTENT_TYPES[intent] ?? [])).slice(0, 6);
  const dependsOnContext = CONTEXT_DEPENDENT_QUESTION.test(question.trim()) || /当前|现在|这个|这样|它|刚才|接下来/iu.test(question);
  const hasUsefulContext = Boolean(context.module || context.signals.length);
  const clarificationRequired = dependsOnContext && !hasUsefulContext;
  const primaryIntent = uniqueIntents[0] ?? "concept";
  return {
    primaryIntent,
    intents: uniqueIntents,
    preferredTypes: preferredTypes.length ? preferredTypes : ["overview", "inquiry"],
    dependsOnContext,
    clarificationRequired,
    safetyRelevant: uniqueIntents.includes("safety"),
    audience,
    answerStrategy: clarificationRequired
      ? "clarify-context"
      : uniqueIntents.includes("safety")
        ? "safety-first"
        : context.evidenceStatus === "incomplete" && ["troubleshooting", "procedure", "hint"].some((intent) => uniqueIntents.includes(intent))
          ? "guided-next-step"
          : "answer-with-evidence"
  };
}

function inferContentTypes(question) {
  const selected = [];
  for (const [type, pattern] of Object.entries(INTENT_PATTERNS)) if (pattern.test(question)) selected.push(type);
  return selected.length ? selected : ["overview", "inquiry"];
}

function scoreChunk(item, question, expandedQuestion, context, plan) {
  const normalizedQuestion = normalize(expandedQuestion);
  let score = 0;
  let relevance = 0;
  const reasons = [];
  const scoreBreakdown = { question: 0, context: 0, intent: 0, graph: 0 };

  if (context.module && item.module === context.module) {
    score += 48;
    relevance += 48;
    scoreBreakdown.context += 48;
    reasons.push("当前实验");
  }
  if (context.area && item.area === context.area) {
    score += 9;
    relevance += 9;
    scoreBreakdown.context += 9;
    reasons.push("当前领域");
  }

  const normalizedTitle = normalize(item.title);
  if (normalizedTitle && normalizedQuestion.includes(normalizedTitle)) {
    score += 42;
    relevance += 42;
    scoreBreakdown.question += 42;
    reasons.push("标题命中");
  }

  let termScore = 0;
  const matchedTerms = [];
  for (const term of item.keywords) {
    const normalizedTerm = normalize(term);
    if (normalizedTerm.length < 2) continue;
    if (normalizedQuestion.includes(normalizedTerm)) {
      termScore += Math.min(16, 5 + normalizedTerm.length * 1.4);
      matchedTerms.push(term);
    } else if (normalize(question).length >= 3 && normalizedTerm.includes(normalize(question))) {
      termScore += 4;
      matchedTerms.push(term);
    }
  }
  score += Math.min(56, termScore);
  relevance += Math.min(56, termScore);
  scoreBreakdown.question += Math.min(56, termScore);
  if (matchedTerms.length) reasons.push(`关键词:${matchedTerms.slice(0, 3).join("、")}`);

  const semanticApproximation = diceSimilarity(question, `${item.title}${item.content}`);
  if (semanticApproximation >= 0.14) {
    score += semanticApproximation * 28;
    relevance += semanticApproximation * 28;
    scoreBreakdown.question += semanticApproximation * 28;
    reasons.push("语义近似");
  }

  const normalizedContext = normalize(context.searchText);
  const contextMatchedTerms = item.keywords.filter((term) => {
    const normalizedTerm = normalize(term);
    return normalizedTerm.length >= 2 && normalizedContext.includes(normalizedTerm);
  });
  if (contextMatchedTerms.length) {
    const contextScore = Math.min(18, contextMatchedTerms.length * 4);
    score += contextScore;
    relevance += contextScore;
    scoreBreakdown.context += contextScore;
    reasons.push(`实验状态:${contextMatchedTerms.slice(0, 3).join("、")}`);
  }

  const intentIndex = plan.preferredTypes.indexOf(item.contentType);
  if (relevance > 0 && intentIndex >= 0) {
    const intentScore = Math.max(5, 18 - intentIndex * 4);
    score += intentScore;
    scoreBreakdown.intent += intentScore;
    reasons.push(`意图:${TYPE_LABELS[item.contentType]}`);
  }

  const stageTypes = context.stage === "setup" || context.stage === "collecting"
    ? ["method", "hint", "evidence"]
    : context.stage === "ready" || context.stage === "reflecting"
      ? ["evidence", "overview", "application"]
      : [];
  const stageIndex = stageTypes.indexOf(item.contentType);
  if (relevance > 0 && stageIndex >= 0) {
    const stageScore = Math.max(4, 12 - stageIndex * 3);
    score += stageScore;
    scoreBreakdown.context += stageScore;
    reasons.push(`实验阶段:${context.stage}`);
  }

  return { item, score, relevance, reasons, matchedTerms, semanticApproximation, scoreBreakdown };
}

function allowedModules(context) {
  const module = context.module && catalogByModule.has(context.module) ? context.module : undefined;
  if (!module) return undefined;
  const node = catalogByModule.get(module);
  return new Set([module, ...(node?.relatedModules ?? [])]);
}

function diversify(scored, limit) {
  const selected = [];
  const perNode = new Map();
  for (const candidate of scored) {
    const count = perNode.get(candidate.item.nodeId) ?? 0;
    if (count >= 4) continue;
    selected.push(candidate);
    perNode.set(candidate.item.nodeId, count + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function retrievePhysicsKnowledge({ question, audience = "student", context = {}, limit = 6 }) {
  const cleanQuestion = String(question ?? "").trim().slice(0, 1600);
  const safeLimit = Math.max(1, Math.min(8, Math.trunc(Number(limit)) || 6));
  const normalizedContext = normalizeRetrievalContext(context);
  const plan = inferRetrievalPlan(cleanQuestion, audience, normalizedContext);
  const preferredTypes = unique([...plan.preferredTypes, ...inferContentTypes(cleanQuestion)]).slice(0, 7);
  plan.preferredTypes = preferredTypes;
  const expandedQuestion = expandQuestion(cleanQuestion);

  const initial = chunks
    .filter((item) => item.audience === "both" || item.audience === audience)
    .map((item) => scoreChunk(item, cleanQuestion, expandedQuestion, normalizedContext, plan))
    .filter((candidate) => candidate.relevance > 0)
    .sort((left, right) => right.score - left.score);

  const moduleScope = allowedModules(normalizedContext);
  const scoped = moduleScope
    ? initial.filter((candidate) => moduleScope.has(candidate.item.module) || candidate.score >= 54)
    : initial;

  const graphSeeds = unique([
    normalizedContext.module,
    ...scoped.slice(0, 2).map((candidate) => candidate.item.module)
  ]).filter((module) => catalogByModule.has(module));
  const graphBonuses = new Map();
  const graphCandidates = [];
  const graphPaths = [];
  for (const module of graphSeeds) {
    const seedScore = scoped.find((candidate) => candidate.item.module === module)?.score ?? (module === normalizedContext.module ? 48 : 24);
    for (const relation of relationsBySourceModule.get(module) ?? []) {
      const neighbor = relation.targetId;
      if (!catalogByModule.has(neighbor)) continue;
      graphBonuses.set(neighbor, Math.max(graphBonuses.get(neighbor) ?? 0, 8 * relation.weight));
      graphPaths.push({ from: module, to: neighbor, relation: relation.type });
      if (!scoped.some((candidate) => candidate.item.module === neighbor)) {
        const neighborChunks = chunksByModule.get(neighbor) ?? [];
        const graphChunk = neighborChunks.find((item) => preferredTypes.includes(item.contentType))
          ?? neighborChunks.find((item) => item.contentType === "overview");
        if (graphChunk) graphCandidates.push({
          item: graphChunk,
          score: Math.max(6, Math.min(18, seedScore * relation.weight * .24)),
          relevance: 0,
          reasons: [`知识图谱:${relation.type}`],
          matchedTerms: [],
          semanticApproximation: 0,
          scoreBreakdown: { question: 0, context: 0, intent: 0, graph: Math.max(6, Math.min(18, seedScore * relation.weight * .24)) }
        });
      }
    }
  }

  const directlyReranked = scoped.map((candidate) => {
    const graphBonus = graphBonuses.get(candidate.item.module) ?? 0;
    return graphBonus
      ? {
          ...candidate,
          score: candidate.score + graphBonus,
          reasons: [...candidate.reasons, "知识图谱邻居"],
          scoreBreakdown: { ...candidate.scoreBreakdown, graph: candidate.scoreBreakdown.graph + graphBonus }
        }
      : candidate;
  });
  const bestByChunk = new Map();
  for (const candidate of [...directlyReranked, ...graphCandidates]) {
    const previous = bestByChunk.get(candidate.item.id);
    if (!previous || previous.score < candidate.score) bestByChunk.set(candidate.item.id, candidate);
  }
  const reranked = [...bestByChunk.values()].sort((left, right) => right.score - left.score);

  let selected = diversify(reranked, safeLimit);
  if (!selected.length && normalizedContext.module) {
    selected = (chunksByModule.get(normalizedContext.module) ?? []).slice(0, safeLimit).map((item) => ({
      item,
      score: 24,
      reasons: ["当前实验兜底"],
      matchedTerms: [],
      relevance: 24,
      semanticApproximation: 0,
      scoreBreakdown: { question: 0, context: 24, intent: 0, graph: 0 }
    }));
  }

  const topScore = selected[0]?.score ?? 0;
  const secondScore = selected[1]?.score ?? 0;
  const rawConfidence = Math.max(0, Math.min(0.98, (topScore / 140) * 0.78 + Math.max(0, topScore - secondScore) / 140));
  const confidence = Number((plan.clarificationRequired ? Math.min(0.35, rawConfidence) : rawConfidence).toFixed(2));
  const retrievalId = hashId("rag", `${cleanQuestion}|${normalizedContext.module ?? ""}|${normalizedContext.stage}|${selected.map((candidate) => candidate.item.id).join("|")}`);

  return {
    id: retrievalId,
    mode: RETRIEVAL_MODE,
    confidence,
    query: cleanQuestion,
    preferredTypes,
    plan,
    contextSummary: {
      module: normalizedContext.module,
      area: normalizedContext.area,
      stage: normalizedContext.stage,
      apparatusReady: normalizedContext.apparatusReady,
      evidenceStatus: normalizedContext.evidenceStatus,
      issues: normalizedContext.issues.slice(0, 5),
      changes: normalizedContext.changes.slice(0, 6),
      facts: normalizedContext.facts.slice(0, 18),
      observations: normalizedContext.observations.slice(-4),
      recentEventTypes: normalizedContext.recentEventTypes
    },
    graphPaths: graphPaths.slice(0, 12),
    results: selected.map(({ item, score, reasons, matchedTerms, scoreBreakdown }) => ({
      sourceId: item.id,
      nodeId: item.nodeId,
      module: item.module,
      title: item.title,
      section: item.section,
      contentType: item.contentType,
      content: item.content,
      source: item.source,
      route: item.route,
      score: Number(score.toFixed(2)),
      reasons,
      matchedTerms: matchedTerms.slice(0, 6),
      scoreBreakdown: Object.fromEntries(Object.entries(scoreBreakdown).map(([key, value]) => [key, Number(value.toFixed(2))]))
    }))
  };
}

export function getPhysicsKnowledgeStats() {
  const verticesByKind = Object.groupBy(graph.vertices, (vertex) => vertex.kind);
  const edgesByType = Object.groupBy(graph.edges, (edge) => edge.type);
  return {
    version: RAG_VERSION,
    retrievalMode: RETRIEVAL_MODE,
    experiments: catalog.length,
    chunks: chunks.length,
    graphVertices: graph.vertices.length,
    graphEdges: graph.edges.length,
    verticesByKind: Object.fromEntries(Object.entries(verticesByKind).map(([key, values]) => [key, values.length])),
    edgesByType: Object.fromEntries(Object.entries(edgesByType).map(([key, values]) => [key, values.length])),
    sourceScopes: unique(chunks.map((item) => item.source)).length
  };
}

export function createKnowledgeCitations(retrieval, limit = 3) {
  const citations = [];
  for (const result of retrieval.results) {
    if (citations.some((citation) => citation.sourceId === result.sourceId)) continue;
    citations.push({
      sourceId: result.sourceId,
      title: result.title,
      section: result.section,
      source: result.source,
      route: result.route,
      score: result.score
    });
    if (citations.length >= limit) break;
  }
  return citations;
}

export function listPhysicsKnowledgeChunks() {
  return chunks.map((item) => ({
    ...item,
    keywords: [...item.keywords]
  }));
}
