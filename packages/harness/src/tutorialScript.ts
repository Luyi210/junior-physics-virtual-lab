import type { HarnessEventType } from "./types";

export type HarnessTutorialAction =
  | { type: "speech"; text: string }
  | { type: "spotlight"; target: string }
  | { type: "wait-for-event"; eventTypes: HarnessEventType[]; prompt: string; minimumCount: number }
  | { type: "question"; prompt: string; choices: string[]; answerIndex: number; explanation: string }
  | { type: "prompt-record"; template: string };

export interface HarnessTutorialActionSource {
  narration: string;
  target: string;
  hint: string;
  requiresInteraction?: boolean;
  acceptedEvents?: HarnessEventType[];
  question?: { prompt: string; choices: string[]; answerIndex: number; explanation: string };
  promptRecord?: boolean;
}

export interface HarnessTutorialActionValidation {
  valid: boolean;
  errors: string[];
}

export function buildHarnessTutorialActions(source: HarnessTutorialActionSource): HarnessTutorialAction[] {
  const actions: HarnessTutorialAction[] = [
    { type: "speech", text: source.narration },
    { type: "spotlight", target: source.target }
  ];
  if (source.requiresInteraction) actions.push({
    type: "wait-for-event",
    eventTypes: source.acceptedEvents ?? [],
    prompt: source.hint,
    minimumCount: 1
  });
  if (source.question) actions.push({ type: "question", ...source.question });
  if (source.promptRecord) actions.push({ type: "prompt-record", template: "我改变了____，观察到____，这可能说明____。" });
  return actions;
}

export function validateHarnessTutorialActions(actions: HarnessTutorialAction[]): HarnessTutorialActionValidation {
  const errors: string[] = [];
  if (!actions.some((action) => action.type === "speech")) errors.push("教程镜头缺少 speech 动作");
  actions.forEach((action, index) => {
    if (action.type === "speech" && !action.text.trim()) errors.push(`动作 ${index + 1} 的讲解文本为空`);
    if (action.type === "spotlight" && !action.target.trim()) errors.push(`动作 ${index + 1} 的高亮目标为空`);
    if (action.type === "wait-for-event" && action.eventTypes.length === 0) errors.push(`动作 ${index + 1} 等待操作却没有声明可接受事件`);
    if (action.type === "wait-for-event" && action.minimumCount < 1) errors.push(`动作 ${index + 1} 的最小事件数必须大于零`);
    if (action.type === "question" && (action.answerIndex < 0 || action.answerIndex >= action.choices.length)) errors.push(`动作 ${index + 1} 的正确答案索引越界`);
  });
  return { valid: errors.length === 0, errors };
}

export function getHarnessTutorialAction<T extends HarnessTutorialAction["type"]>(actions: HarnessTutorialAction[] | undefined, type: T): Extract<HarnessTutorialAction, { type: T }> | undefined {
  return actions?.find((action): action is Extract<HarnessTutorialAction, { type: T }> => action.type === type);
}
