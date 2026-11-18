import type { HarnessApparatusContext, HarnessDialogueContextSnapshot, HarnessDialogueMessage } from "@physics-lab/harness";
import { explicitJuniorHint } from "@physics-lab/harness";

export function apparatusSignature(context?: HarnessApparatusContext): string {
  if (!context) return "unavailable";
  const { module, controls, apparatus, readings, derived, validity } = context.current;
  return JSON.stringify({ module, controls, apparatus, readings, derived, validity });
}

export function captureQuestionContext(context?: HarnessApparatusContext): HarnessDialogueContextSnapshot {
  const names = { control: "控件", apparatus: "装置状态", reading: "页面读数", model: "模型推导" };
  const current = context?.current;
  const evidence = current ? [...current.controls, ...current.apparatus, ...current.readings, ...current.derived]
    .slice(0, 5).map((item) => `${names[item.source]} · ${item.label}：${item.value === null ? "暂无有效值" : typeof item.value === "boolean" ? item.value ? "是" : "否" : item.value}${item.unit ?? ""}`.slice(0, 200)) : [];
  if (current) evidence.push((current.validity.ready ? "装置状态：页面已提供可用读数；不等于已完成学生测量。" : `装置状态：尚未满足读数条件${current.validity.issues[0] ? `，${current.validity.issues[0]}` : ""}。`).slice(0, 200));
  return { capturedAt: new Date().toISOString(), apparatusAvailable: !!current, evidence, changedWhileWaiting: false };
}

/** Only an explicit question with a completed paired reply advances this display. */
export function explicitHintLevel(question: string): 0 | 1 | 2 | 3 {
  return explicitJuniorHint(question);
}

export function completedHintLevel(messages: HarnessDialogueMessage[], module: string): 0 | 1 | 2 | 3 {
  for (let index = messages.length - 1; index > 0; index -= 1) {
    const reply = messages[index]!;
    const question = messages[index - 1]!;
    if (reply.role !== "assistant" || question.role !== "learner" || reply.module !== module || question.module !== module) continue;
    const level = explicitHintLevel(question.text);
    if (level) return level;
  }
  return 0;
}
