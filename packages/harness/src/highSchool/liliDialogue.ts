import type { LiliDialogueTurn, LiliExperimentContext } from "@physics-lab/contracts";
import { liliHintLevel } from "@physics-lab/harness/lili-scaffolding";

const compact = (question: string) => question.normalize("NFKC").trim().replace(/[\s。！？?!…]/gu, "");
const more = (question: string) => /^(?:再给(?:我)?(?:一点|一个)?提示|再提示(?:一下)?|再来一点提示|进一步提示|继续提示)$/u.test(compact(question));
const next = (question: string) => /^(?:下一步(?:呢)?|接下来(?:呢)?|然后呢)$/u.test(compact(question));
export const isLiliSimplificationRequest = (question: string): boolean => /^(?:没看懂|不太明白|不明白|看不懂|没懂|换个说法|说简单一点|讲简单一点|简单说一下)$/u.test(compact(question));
export const isLiliLifeConnectionRequest = (question: string): boolean => /生活|日常|现实|身边|举.{0,6}例子?|实际应用|生活场景/iu.test(question);
const explain = (question: string) => isLiliSimplificationRequest(question) || /^(?:为什么(?:呢)?|为啥|再解释(?:一下)?|能再解释一下吗)$/u.test(compact(question));

export function isLiliCurrentCheck(question: string): boolean {
  return /^(?:(?:(?:请)?帮我)?(?:检查|看看)(?:一下)?当前实验(?:状态)?|现在呢|这样可以吗|现在对吗|这样对吗)$/u.test(compact(question));
}

export type LiliFollowUp = { question: string; notice?: string; needsClarification?: boolean; style?: "simple" };

/** Past dialogue selects a topic only. Old answers and parameters are never evidence. */
export function resolveLiliFollowUp(question: string, context: LiliExperimentContext | null, recentDialogue: readonly LiliDialogueTurn[] = []): LiliFollowUp {
  if (!more(question) && !next(question) && !explain(question)) return { question };
  const turns = recentDialogue.filter(turn => turn.experimentId === (context?.experimentId ?? null) && turn.question.trim() && turn.answer.trim()).slice(-3);
  // The UI expands resolved short questions in this bounded history, while displaying students' original words.
  const previous = [...turns].reverse().find(turn => !more(turn.question) && !next(turn.question) && !explain(turn.question));
  const clarify = { question, needsClarification: true, notice: "这句追问还缺少明确的话题，我先不猜你的意思。" };
  if (!previous) return clarify;
  if (next(question)) return { question: "帮我规划下一步", notice: "接着当前实验，根据这次收到的条件和记录选择下一步；不会把旧回复当成已经完成的操作。" };
  const topic = previous.question;
  const lastHint = liliHintLevel(topic);
  if (more(question)) {
    const level = lastHint ? Math.min(lastHint + 1, 3) : 2;
    return { question: `给我${["一", "二", "三"][level - 1]}级提示`, notice: lastHint === 3 ? "已到三级提示，我们继续核对证据；这不表示实验已经完成。以下按这次提问的条件重新检查。" : "接着刚才的探究话题，给你更具体的提示；以下按这次提问的条件重新检查。" };
  }
  const explanation: Pick<LiliFollowUp, "notice" | "style"> = {
    notice: "接着刚才的问题解释；以下按这次提问的条件重新检查，旧回复里的数值不作为当前读数。",
    ...(isLiliSimplificationRequest(question) ? { style: "simple" as const } : {})
  };
  if (lastHint === 1 || lastHint === 2 || /变量|控制|固定|保持.*不变/u.test(topic)) return { question: "为什么要控制变量？", ...explanation };
  if (lastHint === 3) return { question: "我应该记录哪些证据？", ...explanation };
  if (/手动|读尺|秒表|纸带|计时读数|周期数/u.test(topic)) return { question: "手动读数有哪些误差来源？", ...explanation };
  if (/图像|图线|拟合|斜率|横轴|纵轴/u.test(topic)) return { question: "怎样理解这项实验的图像分析方法？", ...explanation };
  if (/误差|不一致|偏大|偏小|精度/u.test(topic)) return { question: "有哪些误差来源？", ...explanation };
  if (isLiliLifeConnectionRequest(topic)) return { question: "生活中有什么例子？", ...explanation };
  if (isLiliCurrentCheck(topic) || /当前|现在|状态|无效|超量程|全反射|未碰撞|不相遇|零场|不动|没动/u.test(topic)) return { question: "帮我检查当前实验", ...explanation };
  if (/记录|证据|数据|单位|规划下一步|下一步.*做什么/u.test(topic)) return { question: "我应该记录哪些证据？", ...explanation };
  return clarify;
}
