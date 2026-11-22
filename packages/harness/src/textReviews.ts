import type { HarnessEvidenceReview, HarnessEvidenceReviewItem, HarnessConclusionReview, HarnessConclusionReviewItem, HarnessHypothesisReview, HarnessReasoningReview } from "./understanding";

export function reviewHarnessEvidenceText(text: string): HarnessEvidenceReview {
  const trimmed = text.trim();
  const items: HarnessEvidenceReviewItem[] = [
    { id: "condition", label: "实验条件", passed: /(当|保持|固定|改变|调到|从.+到|换成|在.*时)/.test(trimmed) },
    { id: "observation", label: "直接现象", passed: /\d|更|变|读数|显示|观察到|出现|不变|上升|下降|亮|暗|高|低|清晰|模糊|平衡|沸腾|熔化/.test(trimmed) },
    { id: "comparison", label: "对比关系", passed: /(相比|比|从.+到|两组|第一组|第二组|分别|而|相同|不同)/.test(trimmed) },
    { id: "precision", label: "数值或状态", passed: /(\d+(?:\.\d+)?\s*(?:Hz|赫兹|V|伏|A|安|Ω|欧姆|W|瓦|N|牛|J|焦|Pa|帕|T|特斯拉|μF|mA|m\/s(?:²|2)?|mm|nm|rad|kg|s|秒|cm|厘米|mL|毫升|m|米|g|克|℃|度|%))|实像|虚像|闭合|断开|浸没|平衡|沸腾|熔化/i.test(trimmed) }
  ];
  const score = items.filter((item) => item.passed).length;
  const missing = items.filter((item) => !item.passed).map((item) => item.label);
  const feedback = score >= 4
    ? "条件、现象、对比和精确信息齐全，这是一条证据结构完整的观察。"
    : score === 3
      ? `证据已经比较完整，再补上${missing.join("、")}会更严谨。`
      : score === 2
        ? `已经有有效线索，还缺${missing.join("、")}。`
        : `目前更像简短判断，至少补上实验条件和直接现象。`;
  return { score, items, missing, feedback, template: "保持____不变，把____从____调到____；我观察到____从____变为____（写数值、单位或明确状态）。" };
}

/**
 * Reviews the reasoning structure of a learner conclusion. It deliberately does
 * not judge whether the physics claim is true: that requires the actual data.
 */
export function reviewHarnessConclusionText(text: string): HarnessConclusionReview {
  const trimmed = text.trim();
  const absoluteLanguage = /(总是|一定|任何|全部|完全|永远|必然|无论|只要.+就)/.test(trimmed);
  const items: HarnessConclusionReviewItem[] = [
    { id: "claim", label: "明确结论", passed: /(说明|表明|可得|因此|所以|结论|影响|关系|规律|随.+而|变高|变低|变大|变小|增加|减少|不变)/.test(trimmed) },
    { id: "evidence-link", label: "连接证据", passed: /(根据|由.+可见|因为|观察到|数据显示|两组|相比|实验中)/.test(trimmed) },
    { id: "boundary", label: "适用条件", passed: /(在.+条件下|当.+时|本实验|本次|保持.+不变|在.+范围内|近似|可能|当前)/.test(trimmed) },
    { id: "caution", label: "避免绝对化", passed: !absoluteLanguage }
  ];
  const score = items.filter((item) => item.passed).length;
  const risks: string[] = [];
  if (!items.find((item) => item.id === "claim")?.passed) risks.push("还没有写出可检验的关系或判断");
  if (!items.find((item) => item.id === "evidence-link")?.passed) risks.push("结论没有明确连接到观察或数据");
  if (!items.find((item) => item.id === "boundary")?.passed) risks.push("缺少本次实验的条件和适用范围");
  if (absoluteLanguage) risks.push("使用了“总是、一定、任何”等超出当前证据范围的词");
  const feedback = score === 4
    ? "推理结构完整：有结论、有证据连接，也说明了适用条件并避免过度概括。"
    : score === 3
      ? `结论已经比较严谨，再处理“${risks[0]}”即可。`
      : score === 2
        ? `结论方向已经出现，但仍需处理：${risks.join("；")}。`
        : "这句话目前更像未经限定的判断，需要先连接真实证据，再说明成立条件。";
  return {
    score,
    items,
    risks,
    feedback,
    template: "在保持____不变、只改变____的条件下，根据____与____两组观察，我发现____；在本次实验范围内，这说明____。"
  };
}

export function reviewHarnessHypothesisText(text: string): HarnessHypothesisReview {
  const trimmed = text.trim();
  const items: HarnessHypothesisReview["items"] = [
    { id: "variable", label: "改变的条件", passed: /(改变|增加|减少|调高|调低|靠近|远离|换成|如果.+(?:变|调|增|减|靠|远))/.test(trimmed) },
    { id: "direction", label: "变化方向", passed: /(增大|减小|升高|降低|变大|变小|变亮|变暗|更高|更低|更快|更慢|靠近|远离|不变)/.test(trimmed) },
    { id: "outcome", label: "预测的结果", passed: /(那么|会|可能|应该|预测|我猜|我认为).*(变|增|减|高|低|亮|暗|快|慢|不变|出现|消失|偏折|成像)/.test(trimmed) },
    { id: "testable", label: "可以检验", passed: /(如果.+(?:那么|就|会)|当.+时|保持.+不变|只改变|比较|两组)/.test(trimmed) }
  ];
  const score = items.filter((item) => item.passed).length;
  const missing = items.filter((item) => !item.passed).map((item) => item.label);
  const feedback = score === 4
    ? "这是一个可检验的实验假设：变量、方向、结果和检验结构都已明确。"
    : score >= 2 ? `假设已经有雏形，还要补清楚：${missing.join("、")}。` : "目前更像直觉判断，需要写清改变什么、预期什么变化，以及怎样比较。";
  return { score, items, missing, feedback, template: "如果只把____从____调到____，并保持____不变，那么我预测____会____；我将通过比较____来检验。" };
}

export function reviewHarnessReasoningText(text: string): HarnessReasoningReview {
  const trimmed = text.trim();
  const items: HarnessReasoningReview["items"] = [
    { id: "evidence", label: "引用证据", passed: /(根据|观察到|数据显示|读数|两组|相比|实验中|现象)/.test(trimmed) },
    { id: "bridge", label: "因果桥梁", passed: /(因为.+所以|这是由于|原因是|导致|使得|从而|表明)/.test(trimmed) },
    { id: "control", label: "排除干扰", passed: /(保持.+不变|只改变|其他条件相同|控制|排除|对照)/.test(trimmed) },
    { id: "scope", label: "推理边界", passed: /(本次|本实验|在.+条件下|在.+范围内|可能|支持|还需|不能说明)/.test(trimmed) }
  ];
  const score = items.filter((item) => item.passed).length;
  const gaps = items.filter((item) => !item.passed).map((item) => item.label);
  const feedback = score === 4
    ? "因果链完整：证据、解释桥梁、控制条件和推理边界都能找到。"
    : score === 3 ? `推理链基本连贯，再补上${gaps.join("、")}会更可靠。` : `当前推理存在跳步，还缺${gaps.join("、")}。`;
  return { score, items, gaps, feedback, template: "在保持____不变时，我观察到____；因为____会导致____，所以这组证据支持____。但目前只能说明____条件下的结果，还需要____来排除其他解释。" };
}
