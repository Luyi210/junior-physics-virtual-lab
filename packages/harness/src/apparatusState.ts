import type { HarnessApparatusContext, HarnessApparatusDatum, HarnessDialogueIntent } from "./types";

export interface HarnessGroundedApparatusReply {
  intent: HarnessDialogueIntent;
  text: string;
  followUps: string[];
}

export interface HarnessApparatusGuide {
  title: string;
  principle: string;
  focus: string;
}

function allData(context: HarnessApparatusContext, which: "current" | "previous" = "current") {
  const snapshot = context[which];
  return snapshot ? [...snapshot.controls, ...snapshot.apparatus, ...snapshot.readings, ...snapshot.derived] : [];
}

function datum(context: HarnessApparatusContext, id: string, which: "current" | "previous" = "current"): HarnessApparatusDatum | undefined {
  return allData(context, which).find((item) => item.id === id);
}

function value(context: HarnessApparatusContext, id: string, which: "current" | "previous" = "current") {
  return datum(context, id, which)?.value;
}

function numberValue(context: HarnessApparatusContext, id: string, which: "current" | "previous" = "current") {
  const found = value(context, id, which);
  return typeof found === "number" ? found : undefined;
}

function booleanValue(context: HarnessApparatusContext, id: string, which: "current" | "previous" = "current") {
  const found = value(context, id, which);
  return typeof found === "boolean" ? found : undefined;
}

function textValue(context: HarnessApparatusContext, id: string, which: "current" | "previous" = "current") {
  const found = value(context, id, which);
  return typeof found === "string" ? found : undefined;
}

function changed(context: HarnessApparatusContext, id: string) {
  if (!context.previous) return false;
  return value(context, id, "previous") !== value(context, id, "current");
}

function transition(context: HarnessApparatusContext, id: string, digits = 0) {
  const current = numberValue(context, id);
  const previous = numberValue(context, id, "previous");
  const item = datum(context, id);
  if (current === undefined || !item) return "";
  const render = (input: number) => input.toFixed(digits);
  return previous !== undefined && previous !== current
    ? `${item.label}从 ${render(previous)} ${item.unit ?? ""}调到 ${render(current)} ${item.unit ?? ""}`
    : `当前${item.label}是 ${render(current)} ${item.unit ?? ""}`;
}

export function summarizeHarnessApparatus(context?: HarnessApparatusContext): string | undefined {
  if (!context) return undefined;
  const changes = allData(context).filter((item) => changed(context, item.id)).slice(0, 2);
  if (changes.length > 0) {
    const descriptions = changes.map((item) => {
      const before = value(context, item.id, "previous");
      return `${item.label}从${String(before)}${item.unit ?? ""}变为${String(item.value)}${item.unit ?? ""}`;
    });
    return `我读取到装置刚才的变化：${descriptions.join("，")}。`;
  }
  const readings = context.current.readings.slice(0, 2).map((item) => `${item.label}为${String(item.value)}${item.unit ?? ""}`);
  return readings.length > 0 ? `我读取到当前装置：${readings.join("，")}。` : undefined;
}

function soundReply(question: string, context: HarnessApparatusContext): HarnessGroundedApparatusReply | undefined {
  if (!/(现在|当前|刚才|频率|振幅|音调|响度|波形|声音|声源|变化|为什么)/.test(question)) return undefined;
  const frequency = numberValue(context, "frequency") ?? 0;
  const amplitude = numberValue(context, "amplitude") ?? 0;
  const playing = booleanValue(context, "source-on") ?? false;
  const pitch = textValue(context, "pitch") ?? "尚未形成读数";
  const frequencyLine = transition(context, "frequency", 0);
  const amplitudeLine = transition(context, "amplitude", 0);
  const focusAmplitude = /(振幅|响度|音量)/.test(question);
  const focusFrequency = /(频率|音调|高低音)/.test(question);
  let evidence = `我读取到当前装置：声源${playing ? "已启动" : "已暂停"}，频率 ${frequency.toFixed(0)} Hz，相对振幅 ${amplitude.toFixed(0)}%，波形显示“${pitch}”。`;
  if (focusAmplitude) evidence = `我读取到：${amplitudeLine}；当前频率为 ${frequency.toFixed(0)} Hz。`;
  if (focusFrequency) evidence = `我读取到：${frequencyLine}；当前相对振幅为 ${amplitude.toFixed(0)}%。`;
  const explanation = focusAmplitude
    ? "振幅主要影响响度，振幅越大，波形上下起伏越高；它不会直接决定音调。"
    : focusFrequency
      ? "频率主要影响音调，频率越高，相同时间内振动次数越多、波形越密；它不会直接决定响度。"
      : "在这个模型中，频率对应波形疏密和音调，振幅对应波形高度和响度。判断因果时应固定其中一个，只改变另一个。";
  return { intent: "explain", text: `${evidence}${playing ? "" : "声源暂停时参数仍被保留，但没有持续发声过程。"}${explanation}`, followUps: ["只改变频率会看到什么？", "只改变振幅会看到什么？", "帮我设计一组公平对比"] };
}

function balanceReply(question: string, context: HarnessApparatusContext): HarnessGroundedApparatusReply | undefined {
  if (!/(现在|当前|刚才|天平|平衡|指针|砝码|游码|质量|读数|为什么|怎么|下一步)/.test(question)) return undefined;
  const calibrated = booleanValue(context, "calibrated") ?? false;
  const objectPlaced = booleanValue(context, "object-placed") ?? false;
  const balanced = booleanValue(context, "balanced") ?? false;
  const rider = numberValue(context, "rider") ?? 0;
  const weights = numberValue(context, "weights-total") ?? 0;
  const pointer = textValue(context, "pointer") ?? "状态未知";
  const guidance = textValue(context, "guidance") ?? context.current.validity.issues[0] ?? "继续观察指针";
  let evidence = `我读取到当前天平：指针${pointer}，游码 ${rider.toFixed(1)} g，右盘砝码合计 ${weights.toFixed(0)} g。`;
  let explanation = guidance;
  if (!calibrated) {
    evidence += "空载调平尚未完成。";
    explanation = `${guidance} 调平前不能放物称量，也不能把当前数值当作物体质量。`;
  } else if (!objectPlaced) {
    evidence += "空载已经调平，左盘还没有放入待测物。";
    explanation = "下一步应把待测物放在左盘，再按照由大到小的顺序向右盘加砝码。";
  } else if (!balanced) {
    evidence += "待测物已放入，但天平还没有重新平衡。";
    explanation = `${guidance} 这时光光不会提前给出待测物质量。`;
  } else {
    const measured = numberValue(context, "measured-mass") ?? weights + rider;
    evidence += `指针已经对中，测得质量为 ${measured.toFixed(1)} g。`;
    explanation = `这个结果来自平衡条件：物体质量 = 砝码总质量 ${weights.toFixed(0)} g + 游码示数 ${rider.toFixed(1)} g。`;
  }
  return { intent: balanced ? "explain" : "method", text: `${evidence}${explanation}`, followUps: balanced ? ["为什么要先放砝码后移游码？", "怎样把这次读数写进记录本？", "天平读数可能有哪些误差？"] : ["我下一步应该操作哪里？", "为什么称量时不能再调平衡螺母？", "怎样判断天平真正平衡？"] };
}

function circuitReply(question: string, context: HarnessApparatusContext): HarnessGroundedApparatusReply | undefined {
  if (!/(现在|当前|刚才|电路|接线|导线|开关|灯|电流|电阻|电压|串联|并联|亮|为什么|故障|断路)/.test(question)) return undefined;
  const topology = textValue(context, "topology") ?? "未知连接";
  const connected = numberValue(context, "connected-wires") ?? 0;
  const required = numberValue(context, "required-wires") ?? 0;
  const fullyWired = booleanValue(context, "fully-wired") ?? false;
  const closed = booleanValue(context, "switch-closed") ?? false;
  const lamp1 = booleanValue(context, "lamp1-connected") ?? false;
  const lamp2 = booleanValue(context, "lamp2-connected") ?? false;
  const totalCurrent = numberValue(context, "total-current") ?? 0;
  const current1 = numberValue(context, "current1") ?? 0;
  const current2 = numberValue(context, "current2") ?? 0;
  const voltage = numberValue(context, "voltage") ?? 0;
  let evidence = `我读取到当前装置：${topology}任务，导线 ${connected}/${required} 根，总开关${closed ? "闭合" : "断开"}，L₁${lamp1 ? "接通" : "断路"}、L₂${lamp2 ? "接通" : "断路"}，电源 ${voltage.toFixed(1)} V。`;
  let explanation: string;
  if (!fullyWired) explanation = `回路还差 ${Math.max(0, required - connected)} 根导线，所以当前没有完整电流路径，不能用灯泡状态比较串并联规律。`;
  else if (!closed) explanation = "接线已经完整，但开关断开，电流为 0 A；合上开关后才能观察。";
  else {
    evidence += `模型读数为干路 ${totalCurrent.toFixed(2)} A，I₁=${current1.toFixed(2)} A，I₂=${current2.toFixed(2)} A。`;
    explanation = topology.includes("并联")
      ? "并联有独立支路；某只灯断路时，另一条仍完整的支路可以继续有电流。干路电流等于各有效支路电流之和。"
      : "串联只有一条电流路径；任一灯断路都会破坏整条回路，两处电流都变为零。";
  }
  return { intent: fullyWired && closed ? "explain" : "method", text: `${evidence}${explanation}`, followUps: !fullyWired ? ["下一根导线应该接哪里？", "完整回路必须经过哪些元件？", "为什么接线时要断开开关？"] : ["旋松 L₁ 会发生什么？", "切换并联后电流怎样变化？", "帮我比较两种连接方式"] };
}

function renderDatum(item: HarnessApparatusDatum) {
  const rendered = typeof item.value === "boolean" ? item.value ? "是" : "否" : item.value === null ? "尚无有效读数" : String(item.value);
  return `${item.label}：${rendered}${item.unit ?? ""}`;
}

function genericReply(question: string, context: HarnessApparatusContext, guide?: HarnessApparatusGuide): HarnessGroundedApparatusReply | undefined {
  if (!/(现在|当前|刚才|装置|读数|结果|现象|变化|变了|为什么|怎么|下一步|没有|没反应|看不到|观察|比较|对吗)/.test(question)) return undefined;
  const currentData = allData(context).filter((item) => item.value !== null && item.value !== "");
  const directlyNamed = currentData.filter((item) => question.includes(item.label.replace(/[（）()]/g, "")) || item.label.split(/[·：]/).some((part) => part.length >= 2 && question.includes(part)));
  const changedData = currentData.filter((item) => changed(context, item.id));
  const preferred = [...directlyNamed, ...changedData, ...context.current.controls, ...context.current.readings]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 5);
  const currentLine = preferred.length > 0 ? preferred.map(renderDatum).join("；") : "页面暂时没有可读取的有效数值";
  const transitions = changedData.slice(0, 3).map((item) => {
    const before = value(context, item.id, "previous");
    return `${item.label}由“${String(before)}${item.unit ?? ""}”变为“${String(item.value)}${item.unit ?? ""}”`;
  });
  const changeLine = transitions.length > 0 ? `与上一状态相比，${transitions.join("，")}。` : "当前没有检测到新的参数变化。";
  const issue = context.current.validity.issues[0];
  const principle = guide?.principle ?? "当前实验对应的物理规律";
  const focus = guide?.focus ?? "直接读数和可见现象";
  let conclusion = `请把这些状态与“${principle}”联系起来，并重点比较${focus}；一次画面不能代替对照证据。`;
  let intent: HarnessDialogueIntent = "explain";
  if (!context.current.validity.ready) {
    intent = "method";
    conclusion = issue ? `装置目前还不具备完整读数条件：${issue}` : "装置目前还没有形成完整有效读数，请先完成一次操作。";
  } else if (/(下一步|怎么操作|怎么办|没有|没反应|看不到)/.test(question)) {
    intent = "method";
    conclusion = `装置已经形成读数。下一步固定其他条件，只改变一个量，再比较${focus}。`;
  } else if (/(为什么|原理|解释)/.test(question)) {
    conclusion = `这组状态本身是证据，不是原因；解释时要用“${principle}”把控制量与${focus}连接起来。`;
  }
  return {
    intent,
    text: `我读取到“${guide?.title ?? context.current.module}”当前装置：${currentLine}。${changeLine}${conclusion}`,
    followUps: ["刚才究竟改变了哪一个量？", "我应该记录哪些直接证据？", "怎样补一组公平的对照？"]
  };
}

export function answerFromHarnessApparatus(module: string, question: string, context?: HarnessApparatusContext, guide?: HarnessApparatusGuide): HarnessGroundedApparatusReply | undefined {
  if (!context || context.current.module !== module) return undefined;
  if (module === "sound-features") return soundReply(question, context);
  if (module === "measurement-balance") return balanceReply(question, context);
  if (module === "circuit-basic") return circuitReply(question, context);
  return genericReply(question, context, guide);
}
