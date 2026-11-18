import type { HarnessDialogueMessage } from "./types";

export type HarnessShortFollowUp = "why" | "simplify" | "next" | "hint";
export function harnessShortFollowUp(question: string): HarnessShortFollowUp | undefined {
  const text = question.trim().replace(/[。！？?!]$/, "");
  if (/^(为什么|为啥|为什么会这样)$/.test(text)) return "why";
  if (/^(没看懂|我没看懂|还是没看懂|不太懂|换个说法|换一种说法|说简单点|能说简单点吗)$/.test(text)) return "simplify";
  if (/^(下一步呢|然后呢|接下来呢)$/.test(text)) return "next";
  if (/^(再给一点提示|再给点提示|再提示一点)$/.test(text)) return "hint";
  return undefined;
}

export function explicitJuniorHint(question: string): 0 | 1 | 2 | 3 {
  const match = /^(?:给我)?([一二三123])级提示[。！？?!]?$/.exec(question.trim());
  return match ? ({ 一: 1, 二: 2, 三: 3, "1": 1, "2": 2, "3": 3 } as const)[match[1] as "一" | "二" | "三" | "1" | "2" | "3"] : 0;
}

/** Caller must supply only the current identity's in-memory completed exchanges. */
export function resolveHarnessFollowUp(question: string, module: string, messages: HarnessDialogueMessage[]) {
  const kind = harnessShortFollowUp(question);
  if (!kind) return undefined;
  const pairs: Array<{ question: HarnessDialogueMessage; reply: HarnessDialogueMessage }> = [];
  for (let index = messages.length - 1; index > 0 && pairs.length < 3; index -= 1) {
    const reply = messages[index]!; const prompt = messages[index - 1]!;
    if (reply.role !== "assistant" || prompt.role !== "learner") continue;
    if (reply.module !== module || prompt.module !== module) break;
    pairs.push({ question: prompt, reply }); index -= 1;
  }
  const previous = pairs[0];
  const anchor = pairs.find((pair) => !harnessShortFollowUp(pair.question.text))?.question.text.slice(0, 200);
  const lastExplicitHint = pairs.map((pair) => explicitJuniorHint(pair.question.text)).find((level) => level > 0) ?? 0;
  return { kind, previous, anchor, nextHintLevel: Math.min(lastExplicitHint + 1, 3) as 1 | 2 | 3 };
}
