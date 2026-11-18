import type { HarnessExperimentDiagnosis, HarnessModuleGuide } from "./dialogue";
import { getHarnessConceptNode } from "./conceptGraph";
import { reviewHarnessEvidenceText } from "./understanding";
import type { HarnessApparatusContext, HarnessDialogueReply, HarnessSession } from "./types";

/** Match a complete coaching request; a new, specific physics question wins. */
export function isHarnessNextStepQuestion(question: string): boolean {
  const text = question.trim().replace(/[。！？?!]+$/, "");
  return /^(?:(?:请)?(?:帮我)?(?:规划|安排)(?:一下)?下一步(?:操作)?|(?:我)?(?:现在|接下来)?(?:应该|该|要)?(?:做什么|怎么做)|下一步(?:我)?(?:应该|该|要)?(?:做什么|怎么做|怎么操作))$/.test(text);
}

const firstActions: Record<string, string> = {
  "sound-features": "保留当前振幅，只把频率调到另一个值",
  "sound-medium": "保持声源和接收距离不变，只减少容器中的空气量",
  "sound-noise": "保持声源处声级不变，只启用一种降噪措施",
  "sound-echo": "保持声速不变，只改变回声的往返时间",
  "mechanics-speed": "先固定光电门间路程，安装起点门和终点门，再让小车就位",
  "mechanics-friction": "先让物体在水平面上匀速运动，再读取测力计示数",
  "mechanics-buoyancy": "先让物体静止悬挂在空气中，记录测力计示数 G",
  "circuit-power": "先断开开关，核对安全电压和电表接法，接好电能计时器",
  "circuit-ohm": "先核对电表接法与量程；接线正确后，固定电阻只改变电压",
  "thermal-boiling": "保持水量、气压和加热功率不变，启动后记录一个升温阶段的温度与时间",
  "thermal-evaporation": "保留温度和空气流动设置，只改变液面面积，并记下计时时长",
  "measurement-density": "先选择同一样品，完成称量并记下质量和单位",
  "measurement-liquid-density": "先记录空容器和装有液体时的质量，求出液体净质量",
  "measurement-balance": "先让天平空载、游码归零，再检查是否调平",
};

function firstAction(module: string, guide: HarnessModuleGuide): string {
  return firstActions[module] ?? guide.action.split(/[。；]/)[0]!.replace(/[，,]?(?:再|然后).+$/, "").slice(0, 140);
}

/** The caller supplies the current identity's observation/event window. */
export function createHarnessNextStep(
  session: HarnessSession, module: string, context: HarnessApparatusContext | undefined,
  guide: HarnessModuleGuide, diagnosis: HarnessExperimentDiagnosis,
): HarnessDialogueReply {
  const followUps = ["帮我检查当前实验", "我应该记录哪些证据？", "下一步做什么？"];
  const current = context?.current.module === module ? context.current : undefined;
  const action = firstAction(module, guide);
  if (!current) return {
    intent: "method", text: `我还没有取得“${guide.title}”的当前装置快照，不能判断你做到哪一步。\n可以先做这一小步：${action}。\n观察目标：${guide.focus}。操作后再检查当前实验；这只是建议，不是已完成记录。`, followUps,
  };
  const issue = current.validity.issues.find((item) => item.trim())?.slice(0, 240);
  if (issue) return {
    intent: "method", text: `先处理当前页面这一项提醒：“${issue}”。\n下一步只针对这项提示检查或调整，不同时更改其他研究条件。调整后再检查，观察这条提示是否消失。若不清楚该动哪个控件，请把提示中不明白的词告诉我。\n提示消失也不等于完成测量，之后仍需记录实际现象。`, followUps,
  };
  if (!current.validity.ready) return {
    intent: "method", text: `页面还没有达到可读数状态，但没有说明具体缺哪一步，我不能猜测故障。\n先核对这一项准备：${action}。\n看页面是否出现可读数状态或明确提示；在此之前不要把模型预测当作测量结果。`, followUps,
  };
  // No module identifiers exist on observations. A module entry/related event is
  // therefore required before treating one as this experiment's learner record.
  const lastEntry = [...session.events].reverse().find((event) => event.type === "module.entered");
  const entryIndex = lastEntry ? session.events.indexOf(lastEntry) : -1;
  const sameModule = !lastEntry || lastEntry.payload.module === module;
  const observations = sameModule ? session.observations.filter((observation) => {
    if (/^【.+探究小结】/.test(observation.text)) return false;
    if (lastEntry && observation.createdAt < lastEntry.occurredAt) return false;
    if (!observation.relatedEventId) return Boolean(lastEntry);
    const relatedIndex = session.events.findIndex((event) => event.id === observation.relatedEventId);
    const related = session.events[relatedIndex];
    return Boolean(related && (!related.payload.module || related.payload.module === module)
      && relatedIndex >= entryIndex);
  }) : [];
  const latestObservation = observations.at(-1);
  if (latestObservation) {
    const review = reviewHarnessEvidenceText(latestObservation.text);
    const step = review.score < 4
      ? `先补这条记录中的“${review.missing[0]}”，只写你实际看到的条件、数值或状态，不补猜测值。`
      : `用自己的话补一句：“在保持____不变时，我看到____；这可能与${guide.principle}有关，因为____。”`;
    return {
      intent: "reflect", text: `你在本次实验写过：“${latestObservation.text.slice(0, 160)}”。这是你的观察描述，我还没有独立核验其真实性。\n下一小步：${step}\n核对目标：${getHarnessConceptNode(module)?.evidenceCriteria[0] ?? guide.focus}。这一步用于检查证据，不表示结论或理解已经正确。`, followUps,
    };
  }
  if (sameModule && diagnosis.comparisonReady) return {
    intent: "reflect", text: `记录里，同一控制项出现过不同取值；这只能说明尝试过变化，还不能证明两组条件可比。\n下一小步：先核对除“${diagnosis.activeControls[0] ?? "研究条件"}”以外的条件是否相同，再分别写下${guide.focus}。没有留下前一组现象，就回到基准重新观察，不要补造读数。\n观察目标：把条件、页面显示和你看到的现象分开记录；模型推导值不是手动测量值。`, followUps,
  };
  if (sameModule && diagnosis.operationCount > 0) return {
    intent: "method", text: `本次有操作记录，但还没有可引用的观察记录。\n下一小步：先保留当前设置，写下一条“在____条件下，我看到____”，重点看${guide.focus}。\n若刚改了多个条件，先核对它们并建立一组基准；现在不急着继续改参数。页面显示或模型推导请标明来源，不能写成自己手动测得。`, followUps,
  };
  return {
    intent: "method", text: `先做这一小步：${action}。\n只观察：${guide.focus}；先记下变化前后的现象，再告诉我看到了什么。\n当前页面未报告阻碍条件，但我不会据此假定你已经操作、测量或得出了结论。`, followUps,
  };
}

interface PlainExplanation { meaning: string; action: string; look: string; contrast: string }
function plainExplanation(module: string, anchor: string, guide: HarnessModuleGuide): PlainExplanation {
  if (/控制变量|只改变一个|保持.*不变|对照|公平/.test(anchor)) return {
    meaning: "如果一次改了两件事，看到结果变化就不知道是哪一件起作用。先留住一组基准，第二组只改想研究的那个条件。",
    action: firstAction(module, guide), look: "除了研究的那个条件，两组其他设置是否相同？", contrast: "一次操作不等于一组有效证据；先核对完整条件，再比较实际现象",
  };
  if (/记录|证据|读哪个|读数|模型|测量值/.test(anchor)) return {
    meaning: "先写条件，再写你实际看到的数值或现象，最后才解释原因。页面显示和模型算出的量要标清来源，不能改写成自己手动测得。",
    action: "先找一个与当前研究有关的页面数值或现象，并写出它对应的条件", look: `你要写的是${guide.focus}中的哪一项？它来自页面显示、模型计算，还是你的观察？`, contrast: "“改了参数”是操作，“看到了变化”是观察，“为什么会变”才是解释",
  };
  if (module === "sound-features") {
    if (/音色|声纹|乐器|波形形状/.test(anchor)) return {
      meaning: "音色帮助我们区分不同声源。即使音调和响度相近，不同声源的振动波形形状也可能不同，所以听起来仍不一样。",
      action: "先保持频率和振幅相同，再切换纯音与复合音，比较波形形状", look: "波形重复快慢和高度相近时，形状是否仍不同？", contrast: "音调看振动快慢，响度与振幅等因素有关，音色还与波形形状有关；只改频率不能单独验证音色",
    };
    if (/振幅|响度|响|音量/.test(anchor) && !/频率|音调/.test(anchor)) return {
      meaning: "振幅说的是振动的幅度有多大，不是振动有多快。其他条件相同时，振幅更大通常听起来更响。",
      action: "保持频率不变，只增大振幅", look: "波形变高还是变密？响度怎样变化？", contrast: "“波形更高”对应幅度，“波形更密”对应振动快慢，两者别混在一起",
    };
    return { meaning: "频率就是一秒里振动多少次。振动更快，音调通常更高；这不等于声音一定更响。", action: "保持振幅不变，只提高频率", look: "同样一段时间里，波形是不是更密？音调有什么变化？", contrast: "这里比较的是每秒振动的次数，不是波形的高度" };
  }
  const explanations: Record<string, PlainExplanation> = {
    "sound-echo": { meaning: "计时包含声音走到目标、再返回的两段路。先算出这段总路程，再取一半才是你到目标的距离。", action: "画一条去程箭头和一条等长的返程箭头", look: "计时器计的是一段还是两段路？", contrast: "声速乘往返时间得到总路程，目标距离只是其中一段" },
    "sound-medium": { meaning: "发声体在振动，还要有介质把振动传出去。声源仍在动，并不表示声音一定能到达接收器。", action: "保持声源振动和距离不变，只减少空气量", look: "声源还在振动吗？接收强度有没有变化？", contrast: "把“能发出声音”和“声音能传播到这里”分开判断" },
    reflection: { meaning: "看镜面反射时，两个角都从法线量起。入射光偏离法线多少，反射光在另一边也偏离多少。", action: "保持镜面不动，只改变入射方向", look: "从同一条法线量出的两个角是否相等？", contrast: "角度的起点是法线，不是镜面" },
    "circuit-ohm": { meaning: "先把电阻固定：电压提高，电流才按比例增大。若电阻也变了，就不能只用电压变化解释电流。", action: "保持同一电阻和连接方式，只改变电压", look: "电压和电流各怎样变化？两组是否使用相同电阻？", contrast: "电压是这轮改变的条件，电流是要读的结果，电阻需要保持不变" },
    "mechanics-speed": { meaning: "平均速度说的是一段路平均每秒走多远。同样路程，用时更短，平均速度就更大。", action: "先检查同一条记录中的路程和光电门计时", look: "路程与计时属于同一次运动吗？把这段路程除以这段时间", contrast: "时间来自光电门测量，不能直接调时间来制造想要的速度" },
    "mechanics-buoyancy": { meaning: "同一物体静止悬挂在液体里，液体帮它承担一部分重力，测力计就少拉这一部分。空气与液中示数的差，才用来求浮力。", action: "核对物体完全浸没、静止而且没有碰到底部", look: "空气中示数与液中示数分别来自哪里？", contrast: "碰底时底部也在托住物体，不能把示数差全算作浮力" },
    "mechanics-pressure": { meaning: "同样大小的压力，分摊到更小的面积上，每一小块面积承担的压力就更大，这就是压强更大。", action: "固定压力，只改变受力面积", look: "同种材料上的作用效果或压强显示怎样变化？", contrast: "压力是总的作用力，压强比较的是单位面积上分到多少" },
    "circuit-power": { meaning: "功率看用电快慢，电能看一共用了多少。用电快的电器，如果工作时间很短，也不一定用电更多。", action: "先找同一用电器、相同电压而工作时间不同的两条完成记录", look: "功率是否相同？总电能有没有随时间变化？", contrast: "计时结束的完成记录与断开开关后的即时零读数属于不同状态" },
    "thermal-boiling": { meaning: "水沸腾时仍在吸热，能量用来让液态水变成水蒸气。气压稳定时，温度会在沸点附近保持，而不是一直升高。", action: "保持气压不变，比较沸腾阶段不同时间点的温度", look: "还在加热时，温度曲线是继续上升还是接近平台？", contrast: "“温度没明显升高”不等于“没有继续吸热”" },
    "measurement-density": { meaning: "密度比较的是同样体积装了多少质量。先称质量，再用量筒两次读数的差求物体体积，最后用质量除以体积。", action: "先标出浸没物体前、后的两次量筒读数", look: "物体体积应该用后一次读数，还是两次读数之差？", contrast: "量筒最后显示的总体积不全是物体体积，还包含原来的水" },
  };
  return explanations[module] ?? {
    meaning: `把这句话拆开看：“${guide.principle}”。先分清你改变的条件和最后观察的结果，两者不是同一件事。`,
    action: firstAction(module, guide), look: `这时${guide.focus}中，哪一项变了，哪一项没变？`,
    contrast: `把“我设置了什么”与“我看到了什么”分开；${guide.principle}是解释关系，不能代替观察`,
  };
}

/** Previous assistant text selects the presentation only, never supplies facts. */
export function createHarnessPlainExplanation(
  module: string, anchor: string, previousAnswer: string, context: HarnessApparatusContext | undefined, guide: HarnessModuleGuide,
): HarnessDialogueReply {
  const explanation = plainExplanation(module, anchor, guide);
  const current = context?.current.module === module ? context.current : undefined;
  const issue = current?.validity.issues.find((item) => item.trim())?.slice(0, 200);
  const observation = issue ? `当前先处理页面提醒：“${issue}”；处理后再做这个观察。`
    : !current ? "我还没有当前装置快照，下面只是在解释方法，没有确认你已得到相应现象。" : "下面是建议你验证的现象，不是已经测得的结果。";
  let explanationText: string;
  if (previousAnswer.includes("换成一个观察问题")) {
    explanationText = `这次换成两句话来区分：${explanation.contrast}。\n你先只回答一个小问题：${explanation.look}不用马上写完整结论。`;
  } else if (previousAnswer.includes("用日常说法解释")) {
    explanationText = `换成一个观察问题：${explanation.look}\n可以这样核对：${explanation.action}。\n想通这一点：${explanation.contrast}。`;
  } else {
    explanationText = `用日常说法解释：${explanation.meaning}\n做一个小观察就能核对：${explanation.action}。只看：${explanation.look}`;
  }
  return {
    intent: "explain", text: `还是围绕“${anchor.slice(0, 200)}”。\n${explanationText}\n${observation}这还不是你已经做过的记录；模型推导也不代替手动测量。`,
    followUps: ["还是没看懂", "帮我检查当前实验", "下一步做什么？"],
  };
}
