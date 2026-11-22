import { reviewHarnessConclusionText, reviewHarnessEvidenceText, reviewHarnessHypothesisText, reviewHarnessReasoningText } from "../textReviews.ts";

const kinds = ["观察", "假设", "推理", "结论"] as const;
export type LiliReflectionKind = typeof kinds[number];

export function isLiliReflectionRequest(question: string): boolean {
  return /^检查这条(观察|假设|推理|结论)[：:]/u.test(question.trim());
}

/** Checks the structure of a student's statement. It never certifies physics or measurements. */
export function reviewLiliReflection(question: string): { text: string; suggestions: string[] } | null {
  const match = question.trim().match(/^检查这条(观察|假设|推理|结论)[：:]\s*([\s\S]*)$/u);
  if (!match) return null;
  const kind = match[1] as LiliReflectionKind;
  const statement = (match[2] ?? "").trim();
  if (!statement) return { text: `请在“检查这条${kind}：”后写下你自己的${kind}。我会标出表述中缺少的环节，不替你补写数据。`, suggestions: ["给我一级提示", "我应该记录哪些证据？"] };
  const review = kind === "观察" ? reviewHarnessEvidenceText(statement)
    : kind === "假设" ? reviewHarnessHypothesisText(statement)
      : kind === "推理" ? reviewHarnessReasoningText(statement)
        : reviewHarnessConclusionText(statement);
  const missing = "missing" in review ? review.missing : "gaps" in review ? review.gaps : review.risks;
  const label = kind === "观察" ? "观察证据" : kind === "假设" ? "可检验假设" : kind === "推理" ? "因果推理" : "实验结论";
  return { text: `${label}的表述检查 · ${review.score}/4 项\n${review.feedback}${missing.length ? `\n还需核对：${missing.join("；")}。` : ""}\n你可以按这个框架修改：${review.template}\n这只检查文字是否交代条件、证据与适用范围；没有核实你写的数值或操作，不能据此认定物理结论正确。请保留原始记录，不要为了通过检查而改写读数。`, suggestions: ["检查我的记录", "怎样控制变量？", "给我三级提示"] };
}
