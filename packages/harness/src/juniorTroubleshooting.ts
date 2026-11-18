import type { HarnessApparatusContext, HarnessApparatusDatum, HarnessDialogueReply } from "./types";

interface Guide { title: string; focus: string; action: string; compare: string }

export function isHarnessApparatusCheckQuestion(question: string): boolean {
  const text = question.trim().replace(/[。！？?!]$/, "");
  if (/^(现在呢|这样可以吗|现在对吗|这样对吗)$/.test(text)) return true;
  return /^(?:请)?(?:帮我)?(?:检查|排查)(?:一下)?(?:当前|现在|这个)?(?:实验装置|实验|装置)(?:状态)?(?:一下)?$/.test(text);
}

function render(item: HarnessApparatusDatum): string {
  const source = { control: "控件设置", apparatus: "装置状态", reading: "页面读数", model: "模型推导" }[item.source];
  const value = typeof item.value === "boolean" ? item.value ? "是" : "否" : String(item.value);
  return `${source}·${item.label}：${value}${item.unit ?? ""}`.slice(0, 180);
}

/** Snapshot readiness is not proof of a completed measurement or a correct conclusion. */
export function createHarnessApparatusCheck(module: string, context: HarnessApparatusContext | undefined, guide: Guide): HarnessDialogueReply {
  if (!context || context.current.module !== module) return {
    intent: "method", text: `我还没有取得“${guide.title}”的当前装置快照，不能判断哪里有问题，也不会用别的实验记录代替。请先在本实验操作一个控件，再点“检查当前实验”。如果仍没有状态，请告诉我你看到的具体提示或读数。`,
    followUps: ["帮我检查当前实验", "给我一级提示", "我应该记录哪些证据？"],
  };
  const current = context.current;
  const facts = [...current.apparatus, ...current.controls, ...current.readings]
    .filter((item) => item.value !== null && item.value !== "" && (typeof item.value !== "number" || Number.isFinite(item.value)))
    .slice(0, 3).map(render);
  const issues = current.validity.issues.filter((issue) => issue.trim()).slice(0, 2).map((issue) => issue.slice(0, 240));
  const previous = context.previous?.module === module ? context.previous : undefined;
  const changed = previous ? current.controls.filter((item) => previous.controls.some((before) => before.id === item.id && !Object.is(before.value, item.value))) : [];
  const evidence = facts.length ? `我能核对的当前状态：${facts.join("；")}。` : "当前快照没有可核对的具体数值，不能把空白补成测量结果。";
  const status = issues.length ? `页面目前提醒：${issues.join("；")}`
    : current.validity.ready ? "当前快照未报告待处理条件，但这不等于实验已完成或结论正确。"
      : "页面仍在等待必要操作或证据，但没有给出具体原因；我不能猜测是哪一处故障。";
  const action = issues.length ? `先处理第一项：“${issues[0]}”。操作后再检查，看看这条页面提示是否消失；消失后仍需核对并保存自己的证据。`
    : current.validity.ready ? `下一小步：${guide.compare}。把各组条件和你实际观察到的现象分别记下，再判断是否支持结论。`
      : `下一小步：${guide.action}。如果仍无变化，请描述具体的控件状态或提示。`;
  const contrast = changed.length > 1 ? `\n对照提醒：相邻页面快照中的${changed.slice(0, 3).map((item) => item.label.slice(0, 32)).join("、")}发生过变化。如果准备用它们作对照，请先确认只改变一个研究条件；仅凭页面变化不能认定你做错了。` : "";
  return { intent: "method", text: `${evidence}\n${status}\n${action}${contrast}\n以上依据页面状态；模型推导不代替手动测量，操作记录也不证明观察结论。`, followUps: ["帮我检查当前实验", "给我一级提示", "我应该记录哪些证据？"] };
}
