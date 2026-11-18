import type { LiliExperimentContext } from "@physics-lab/contracts";
import type { liliAnalysisReference } from "./lili";
import type { LiliManualReference } from "./liliManual";

const compact = (question: string) => question.normalize("NFKC").trim().replace(/[\s。！？?!…]/gu, "");

/** Match a complete request, so a new specific question always retains its meaning. */
export function isLiliEvidenceCoachRequest(question: string): boolean {
  return /^(?:下一步(?:应该|该|要)?做什么|(?:请)?帮我规划下一步|(?:请)?(?:帮我)?检查(?:一下)?我的记录)$/u.test(compact(question));
}

interface EvidenceCoachInput {
  context: LiliExperimentContext;
  name: string;
  constraint: string | null;
  analysis: ReturnType<typeof liliAnalysisReference>;
  manual: LiliManualReference | null;
  profile: { next: string; variables: string; graph: string };
  evidence: readonly string[];
}

const firstSentence = (text: string) => `${text.split("。")[0]}。`;
const scope = (included: number, total: number, source: string) => `收到 ${included} 条${source}${total > included ? `（页面显示共 ${total} 条，其余 ${total - included} 条未提供，未参与本次检查）` : ""}。`;
const disclaimer = "这是根据本次收到的记录给出的下一步建议，不代表实验完成或已经掌握；模型采样与手动虚拟读数都不是真实器材实测。";

/** References are produced by the existing validators/calculators, never by dialogue history. */
export function createLiliEvidenceCoach(input: EvidenceCoachInput): { text: string; suggestions: string[] } {
  const { context, name, constraint, analysis, manual, profile, evidence } = input;
  const modelCount = analysis?.includedCount ?? 0;
  const manualCount = manual?.includedCount ?? 0;
  const availability = [
    modelCount ? scope(modelCount, context.recordCount, "已重算的模型采样")
      : context.recordCount ? `页面显示有 ${context.recordCount} 条模型记录，但本次没有收到可校验的具体采样；条数不是证据。` : "本次没有收到模型采样，页面记录数为 0。",
    manualCount ? scope(manualCount, manual!.totalSavedCount, "手动虚拟读数")
      : context.manualRecordCount ? `页面显示有 ${context.manualRecordCount} 条手动记录，但本次没有收到可校验的原始读数；不会用模型值补齐。` : ""
  ].filter(Boolean).join("\n");
  const answer = (body: string, suggestions = ["检查我的记录", "怎样控制变量？", "帮我检查当前实验"]) => ({ text: `下一步实验辅导 · ${name}\n${body}\n${disclaimer}`, suggestions });

  // Current prerequisites precede any recommendation to collect another point. Saved records remain untouched.
  if (constraint) return answer(`先处理当前条件：${constraint}\n${availability}\n这次先做：按上面的条件提示修正或确认，再点击“检查当前实验”；旧记录仍保留原条件，不能因当前条件无效就判定旧记录无效。\n检查点：确认当前提示已解除，再决定是否开始新一组记录。`);

  if (modelCount && manualCount) return answer(`${availability}\n两类记录来源不同，不能混成一组拟合。\n这次先做：选择你要检查的来源——“分析自动模型采样”或“看看我的手动读数”。\n检查点：说明你要比较哪两个量；我会按那一类记录继续核对。`, ["分析自动模型采样", "看看我的手动读数"]);

  if (manualCount) {
    const record = manual!.records.at(-1)!;
    const r = record.readings;
    const warning = record.warnings.find(item => /^(?:计时周期与同条件模型|估计波长超出|本次读数算出|摆角超过)/u.test(item));
    const detail = record.kind === "pendulum-timing"
      ? `先看最后一条：起止 ${r.startTimeSeconds}→${r.endTimeSeconds} s，填了 ${r.periodCount} 个完整周期，保存时摆长 ${r.length} m、摆角 ${r.amplitudeDegrees}°。\n这次先做：核对起止是否同向通过同一位置，并确认计的是完整往返；保留这条记录，在相同保存条件下再计时一次。\n检查点：记录新的起止读数和周期数，再比较两次 Δt/N；数值接近不能证明计数正确。`
      : record.kind === "double-slit-positions"
        ? `先看最后一条：A=${r.leftPositionMm} mm、B=${r.rightPositionMm} mm，填了 ${r.intervalCount} 个间隔，保存时 d=${r.slitSeparationMm} mm、L=${r.screenDistance} m。\n这次先做：回到这条记录的条件，重新核对两个亮纹中心和中间间隔数，保留原坐标后独立再读一次。\n检查点：数的是相邻间隔，不是亮纹条数；不要按已知波长倒填坐标。`
        : `先看最后一条：选点 A=${r.indexA}、B=${r.indexB}，保存时质量 ${r.mass} kg、恒定阻力比 ${r.resistanceRatio}。\n这次先做：逐个核对 A/B 两组三个位置是否使用同一零点，共享点是否一致，保留原始六个位置。\n检查点：分别用两侧位置差求 vA、vB，再比较 A/B 间 ΔK 与 ΔEp；不能把 B 点动能当作 ΔK，也不用 gt 回填速度。`;
    return answer(`${availability}\n${warning ? `原记录提示：${warning}\n` : ""}${detail}\n这些检查使用记录保存时的条件，不拿当前滑块值替换它们；系统尚未确认计数、定位和操作是否正确。`, ["看看我的手动读数", "有哪些误差来源？"]);
  }

  if (modelCount && analysis) {
    const group = analysis.groups[0];
    if (!group) return answer(`${availability}\n这次先做：核对记录是否保留完整参数与时间，再选择要分析的关系。\n检查点：当前没有可引用的关系分组，不能从总条数推断可拟合。`);
    const groupCount = analysis.groups.length + analysis.omittedGroupCount;
    const groups = `按关系与控制条件分成 ${groupCount} 组${analysis.omittedGroupCount ? `，本次仅展示其中 ${analysis.groups.length} 组` : ""}；先看“${group.title}”。`;
    const source = group.pointSource === "position-interval" ? "分析点由相邻位置与时间换算为区间平均速度，横坐标对应区间中点时间。" : "分析点来自保存条件重算的模型值。";
    const count = `这一组有 ${group.sampleCount} 个分析点、${group.distinctXCount} 个不同横坐标；重复保存同一横坐标不会增加不同横坐标数。`;
    const condition = group.conditions.length ? `这组的比较条件：${group.conditions.join("；")}。` : "不同控制条件的记录须分开比较。";
    if (group.status === "ready") return answer(`${availability}\n${groups}\n${source}${count}\n${condition}\n这次先做：对照这组的横轴、纵轴和单位，用一句话说明拟合斜率对应什么物理量，再与模型关系比较。\n检查点：已有足够的不同横坐标供这组拟合，但拟合好只说明模型关系一致，不能证明实测准确；如要研究另一组，请明确说出关系。`, ["怎么分析图像？", "怎样控制变量？", "有哪些误差来源？"]);
    return answer(`${availability}\n${groups}\n${source}${count}\n还缺什么：${group.reasons.join("；") || "这一组尚不满足拟合条件"}。\n${condition}\n这次先做：${group.nextStep}\n检查点：补充后重新检查这一组的不同横坐标和条件，不只看总记录数。`);
  }

  if (context.recordCount || context.manualRecordCount) return answer(`${availability}\n这次先做：在当前实验的记录区确认具体记录已加载，再点击“检查我的记录”。\n检查点：需要收到保存时的完整条件、时间或手动原始读数；在收到之前，我只能给采集方案，不能说已经查看了那些记录。`, ["我应该记录哪些证据？", "帮我检查当前实验"]);

  return answer(`${availability}\n这次先做：${firstSentence(profile.next)}\n检查点：先保留这一步的预测与实际观察，并准备记录${evidence.slice(0, 2).join("、") || "实验条件、读数和单位"}；收到具体记录后再决定下一步，不凭点击次数认定完成。`, ["怎样控制变量？", "我应该记录哪些证据？", "检查我的记录"]);
}
