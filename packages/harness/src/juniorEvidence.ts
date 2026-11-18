import { reviewHarnessReasoningText } from "./understanding";
import type { HarnessSession } from "./types";

/** A coaching signal for learner-authored structure, not correctness or mastery. */
export function countHarnessLearnerReasoning(session: HarnessSession, module: string, scope: "current" | "history" = "current"): number {
  const lastEntry = [...session.events].reverse().find((event) => event.type === "module.entered");
  if (scope === "current" && lastEntry && lastEntry.payload.module !== module) return 0;
  const entryTime = scope === "current" ? lastEntry?.occurredAt : undefined;
  return (session.dialogue ?? []).filter((message) => {
    if (message.role !== "learner" || message.module !== module || (entryTime && message.createdAt < entryTime)) return false;
    const submitted = message.text.trim().replace(/^(?:帮我检查)?(?:我的)?(?:因果解释|解释|推理|结论)[:：]\s*/, "");
    // A request for an explanation is not the learner providing one.
    if (/^(为什么|怎么|如何|请|能不能|可以|帮我)/.test(submitted)) return false;
    const review = reviewHarnessReasoningText(submitted);
    return ["evidence", "bridge", "control"].every((id) => review.items.some((item) => item.id === id && item.passed));
  }).length;
}
