export type LearnerMemoryKind = "misconception" | "goal" | "strength" | "preference";
export type LearnerMemoryScope = "junior" | "high-school";

export interface LearnerMemoryItem {
  id: string;
  scope: LearnerMemoryScope;
  experimentId: string | null;
  kind: LearnerMemoryKind;
  topic: string;
  summary: string;
  evidenceCount: number;
  updatedAt: string;
}

export interface LearnerMemoryDraft {
  scope: LearnerMemoryScope;
  experimentId: string | null;
  kind: LearnerMemoryKind;
  topic: string;
  summary: string;
}

const MISCONCEPTION_PATTERNS: Array<{ pattern: RegExp; topic: string; summary: string }> = [
  { pattern: /重.*落得快|质量越大.*周期|摆球越重.*越快/iu, topic: "质量与运动周期", summary: "曾混淆质量对单摆周期或落体快慢的影响，需要通过只改质量的对照实验复核。" },
  { pattern: /越深.*浮力越大|浸没后.*浮力变大/iu, topic: "浮力与浸没深度", summary: "曾认为完全浸没后深度增加会增大浮力，适合用称重法测不同深度拉力对比。" },
  { pattern: /电阻.*电流变大|电压不变.*电阻越大电流越大/iu, topic: "欧姆定律反比关系", summary: "曾混淆定电压下电流与电阻的反比关系，建议在欧姆定律实验中画 I-R 对照。" },
  { pattern: /串联.*一个灭.*另一个亮|并联.*互相影响/iu, topic: "串并联支路独立性", summary: "曾混淆串并联断路对另一支路的影响，建议对比串联与并联断开单灯的现象。" },
  { pattern: /焦点.*成像|光屏.*虚像/iu, topic: "凸透镜虚像与光屏", summary: "曾尝试在光屏上接收虚像或焦点处成像，建议在光具座对比 u>f 与 u<f。" },
  { pattern: /光强.*打不出|增大光强.*光电效应/iu, topic: "光电效应截止频率", summary: "曾认为增大光照强度可以突破截止频率，建议在光电效应实验中固定频率调光强验证。" },
  { pattern: /沸腾.*继续升温|熔化.*温度升高/iu, topic: "相变吸热温度平台", summary: "曾混淆持续加热与相变恒温平台，适合复看沸腾或熔化温度曲线的水平段。" },
  { pattern: /力臂.*就是杠杆长|斜拉.*力臂不变/iu, topic: "斜拉时的力臂定义", summary: "曾把斜拉时的杠杆长度直接当成力臂，需要用 90° 与 30° 对照核对垂距。" }
];

const PREFERENCE_PATTERNS: Array<{ pattern: RegExp; topic: string; summary: string }> = [
  { pattern: /换个说法|听不懂|简单点|通俗|举个生活例子/iu, topic: "讲解偏好", summary: "偏好结合生活实例与通俗类比逐步拆解物理概念。" },
  { pattern: /公式|推导|为什么.*斜率|定量/iu, topic: "定量推理偏好", summary: "关注图像斜率、定量公式推导与误差来源分析。" }
];

export function memoryKeyOf(item: Pick<LearnerMemoryDraft, "scope" | "kind" | "topic">): string {
  return `${item.scope}:${item.kind}:${item.topic.trim().toLowerCase()}`;
}

export function extractMemoryDraftsFromTurn(input: {
  scope: LearnerMemoryScope;
  experimentId: string | null;
  question: string;
}): LearnerMemoryDraft[] {
  const text = input.question.trim();
  if (!text) return [];
  const drafts: LearnerMemoryDraft[] = [];

  for (const rule of MISCONCEPTION_PATTERNS) {
    if (rule.pattern.test(text)) {
      drafts.push({
        scope: input.scope,
        experimentId: input.experimentId,
        kind: "misconception",
        topic: rule.topic,
        summary: rule.summary
      });
    }
  }

  for (const rule of PREFERENCE_PATTERNS) {
    if (rule.pattern.test(text)) {
      drafts.push({
        scope: input.scope,
        experimentId: null,
        kind: "preference",
        topic: rule.topic,
        summary: rule.summary
      });
    }
  }

  if (/(?:我想弄明白|怎么验证|探究|研究).{2,30}/iu.test(text) && drafts.length === 0 && input.experimentId) {
    const snippet = text.replace(/\s+/g, " ").slice(0, 36);
    drafts.push({
      scope: input.scope,
      experimentId: input.experimentId,
      kind: "goal",
      topic: `探究关注点(${input.experimentId})`,
      summary: `近期主动追问过：“${snippet}${text.length > 36 ? "…" : ""}”`
    });
  }

  return drafts.slice(0, 3);
}

export function mergeLearnerMemories(
  existing: readonly LearnerMemoryItem[],
  drafts: readonly LearnerMemoryDraft[],
  now = new Date().toISOString(),
  maxItems = 24
): LearnerMemoryItem[] {
  const byKey = new Map<string, LearnerMemoryItem>();
  for (const item of existing) {
    byKey.set(memoryKeyOf(item), { ...item });
  }
  for (const draft of drafts) {
    const key = memoryKeyOf(draft);
    const prev = byKey.get(key);
    if (prev) {
      byKey.set(key, {
        ...prev,
        experimentId: draft.experimentId ?? prev.experimentId,
        summary: draft.summary,
        evidenceCount: prev.evidenceCount + 1,
        updatedAt: now
      });
    } else {
      byKey.set(key, {
        id: `mem-${key.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/giu, "-")}`,
        scope: draft.scope,
        experimentId: draft.experimentId,
        kind: draft.kind,
        topic: draft.topic,
        summary: draft.summary,
        evidenceCount: 1,
        updatedAt: now
      });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, maxItems);
}

export function selectRelevantMemories(
  memories: readonly LearnerMemoryItem[],
  scope: LearnerMemoryScope,
  experimentId: string | null,
  limit = 3
): LearnerMemoryItem[] {
  return [...memories]
    .filter((item) => item.scope === scope)
    .sort((a, b) => {
      const aMatch = experimentId && a.experimentId === experimentId ? 2 : a.kind === "misconception" ? 1 : 0;
      const bMatch = experimentId && b.experimentId === experimentId ? 2 : b.kind === "misconception" ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, limit);
}

export function formatMemoryPromptContext(memories: readonly LearnerMemoryItem[]): string {
  if (!memories.length) return "";
  return memories
    .map((m) => `[${m.kind === "misconception" ? "历史易混点" : m.kind === "preference" ? "学习偏好" : m.kind === "strength" ? "已有突破" : "探究目标"}] ${m.topic}：${m.summary}（累计 ${m.evidenceCount} 次）`)
    .join("\n");
}
