import type {
  DialogueAssistant,
  HarnessArea,
  HarnessDialogueIntent,
  HarnessDialogueMessage,
  HarnessDialogueReply,
  HarnessEvent,
  HarnessSession,
  HarnessValue
} from "./types";

export interface HarnessModuleGuide {
  title: string;
  focus: string;
  principle: string;
  action: string;
  compare: string;
}

type ModuleProfile = HarnessModuleGuide;

const areaProfiles: Record<HarnessArea, ModuleProfile> = {
  optics: { title: "光学现象", focus: "光线的传播方向、交点与光屏上的变化", principle: "光的直线传播、反射、折射或透镜成像规律", action: "只改变一个光学条件，再沿着代表光线追踪结果", compare: "固定光源和一种器材，只改变角度、距离或介质中的一个量" },
  lens: { title: "透镜成像", focus: "像的位置、大小、正倒、虚实和清晰程度", principle: "薄透镜成像与三条特殊光线", action: "保持焦距不变，先让物体跨过焦点或二倍焦距", compare: "选择焦距相同的两组物距，并用光屏检验实像" },
  sound: { title: "声音实验", focus: "振动、波形、接收强度与听觉特征", principle: "声音由振动产生并依靠介质传播", action: "固定一个变量，只改变频率、振幅、介质或距离中的一个", compare: "设置一组基准，再只改变一个声学条件" },
  mechanics: { title: "力学实验", focus: "运动状态、受力、力臂和读数怎样共同变化", principle: "运动与力、平衡、压强或浮沉规律", action: "先画出研究对象，再明确哪个量被保持不变", compare: "用两组只有一个条件不同的数据比较" },
  circuit: { title: "电学实验", focus: "完整电流路径、仪表读数和用电器状态", principle: "闭合电路、欧姆定律、电功率或电流的磁效应", action: "先确认电路闭合，再追踪电流从电源出发如何回到电源", compare: "保持连接方式不变只改一个电学量，或保持元件不变只换连接方式" },
  thermal: { title: "热学实验", focus: "温度、时间、状态和曲线形状", principle: "物体吸放热与物态变化规律", action: "启动过程并连续观察，不要只读取某一个时刻", compare: "保持物质和初温相同，只改变质量、功率或环境条件之一" },
  measurement: { title: "测量实验", focus: "仪器零点、分度值、质量、体积和单位", principle: "测量规则以及密度等于质量与体积之比", action: "先分别取得质量和体积证据，再进行计算", compare: "重复测量或更换样品，检查比值是否稳定" }
};

const moduleProfiles: Record<string, Partial<ModuleProfile> & Pick<ModuleProfile, "title">> = {
  dispersion: { title: "光的色散", focus: "不同颜色最终落在光屏上的位置和光谱宽度", principle: "不同色光通过三棱镜时偏折程度不同", action: "先用白光形成光谱，再切换单色光比较" },
  straight: { title: "小孔成像", focus: "烛焰上下两端的光穿孔后如何交换位置", principle: "同一种均匀介质中光沿直线传播", action: "拖动物体或光屏，同时追踪两条边缘光线" },
  reflection: { title: "光的反射", focus: "入射角与反射角是否同步变化", principle: "反射光线、入射光线和法线在同一平面，反射角等于入射角", action: "改变入射角，再用正视视角读取角度" },
  refraction: { title: "光的折射", focus: "光跨过分界面后的偏折方向与角度", principle: "光从一种介质斜射入另一种介质时传播方向通常改变", action: "固定两种介质，只改变入射角" },
  "color-mix": { title: "色光混合", focus: "重叠区域的颜色怎样随三束色光强度变化", principle: "红、绿、蓝是色光三原色，色光混合属于加色混合", action: "先单独点亮一种色光，再逐束叠加" },
  celestial: { title: "日食与月食", focus: "本影、半影以及三个天体的相对位置", principle: "光的直线传播会在遮挡物后形成影区", action: "旋转观察空间，同时沿太阳光方向检查影区" },
  "plane-mirror": { title: "平面镜成像", focus: "物与像到镜面的距离、大小和连线方向", principle: "平面镜成等大、正立的虚像，物像关于镜面对称", action: "移动物体后从不同视角寻找像的位置" },
  "curved-mirror": { title: "曲面镜成像", focus: "焦点、视野以及像的虚实和大小", principle: "凹面镜使近轴平行光会聚，凸面镜使近轴平行光发散", action: "先切换凹凸面镜，再只改变物距" },
  magnifier: { title: "放大镜", focus: "物体位于焦点以内时看到的正立放大虚像", principle: "凸透镜焦内成正立放大的虚像", action: "把物体移到焦点两侧，比较光屏能否承接像" },
  bench: { title: "自由光具座", focus: "物距、像距、焦距与光屏清晰度", principle: "凸透镜成像规律", action: "先固定焦距，移动物体后再寻找清晰像面" },
  "sound-medium": { title: "声音的产生与传播", focus: "空气减少或距离增大时接收强度怎样变化", principle: "声音由振动产生，传播需要介质", action: "保持距离不变先减少空气，再恢复空气改变距离" },
  "sound-features": { title: "声音三要素", focus: "波形的高度、疏密与声音特性的对应关系", principle: "振幅主要影响响度，频率主要影响音调", action: "固定振幅改变频率，再反过来操作" },
  "sound-noise": { title: "噪声的产生与控制", focus: "接收处声级随声源和衰减量怎样变化", principle: "控制噪声可以从声源、传播途中和接收端入手", action: "固定声源处声级，只改变一种控制措施的等效衰减量" },
  "sound-echo": { title: "回声测距", focus: "声速、往返时间与目标距离", principle: "回声走过往返路程，目标距离等于声速乘往返时间的一半", action: "固定介质声速，只改变回声往返时间" },
  "mechanics-speed": { title: "运动与速度", focus: "路程、时间和平均速度的对应关系", principle: "平均速度等于通过的路程除以所用时间", action: "先固定路程改变时间，再固定时间改变路程" },
  "mechanics-friction": { title: "滑动摩擦力", focus: "匀速拉动时测力计示数随压力和接触面怎样变化", principle: "水平匀速时拉力与滑动摩擦力平衡", action: "保持接触面不变改变压力，再换接触面进行比较" },
  "mechanics-lever": { title: "杠杆平衡", focus: "左右两侧力与力臂的乘积", principle: "杠杆平衡时动力乘动力臂等于阻力乘阻力臂", action: "只移动一侧钩码，观察哪一端下沉" },
  "mechanics-pressure": { title: "压力作用效果与压强", focus: "压力和受力面积共同决定的压强", principle: "压强等于压力除以受力面积", action: "先固定受力面积改变压力，再固定压力改变受力面积" },
  "mechanics-buoyancy": { title: "浮力与浮沉", focus: "物体平均密度与液体密度的大小关系", principle: "自由浸没物体的浮沉取决于浮力与重力的关系", action: "保持物体不变更换液体，再保持液体不变改变物体平均密度" },
  "circuit-basic": { title: "串联与并联电路", focus: "开关闭合后电流有几条完整路径", principle: "串联只有一条电流路径，并联有多条支路", action: "先闭合开关，再保持电阻不变切换连接方式" },
  "circuit-ohm": { title: "欧姆定律", focus: "电流随电压或电阻变化的方向", principle: "同一导体中电流与电压成正比、与电阻成反比", action: "固定电阻改变电压，再固定电压改变电阻" },
  "circuit-power": { title: "电功率", focus: "电压、电流与电流做功快慢", principle: "用电器的实际电功率等于其两端电压与通过电流的乘积", action: "固定电压改变电流，再用相同时间比较电能" },
  "circuit-magnet": { title: "电流的磁效应", focus: "线圈匝数和电流改变时磁性强弱的趋势", principle: "其他条件相同时，匝数增加或电流增大通常会增强电磁铁磁性", action: "固定铁芯和匝数改变电流，再固定电流改变匝数" },
  "thermal-thermometer": { title: "温度计的使用", focus: "量程、分度值和液柱末端的读数", principle: "测温前要看量程和分度值，读数时视线与液柱末端相平", action: "先判断量程和分度值，再读取液柱末端位置" },
  "thermal-boiling": { title: "观察水的沸腾", focus: "达到沸点前后温度曲线的斜率", principle: "水沸腾时继续吸热，但温度保持在沸点附近", action: "启动加热并连续观察曲线直到出现平台" },
  "thermal-melting": { title: "冰的熔化", focus: "固态、熔化和液态阶段的温度变化", principle: "晶体熔化时继续吸热，但温度保持在熔点附近", action: "连续观察升温段和熔化平台，不只读取一个时刻" },
  "thermal-evaporation": { title: "影响蒸发快慢的因素", focus: "温度、表面积和空气流动对蒸发快慢的影响", principle: "温度升高、表面积增大或空气流动加快通常会加快蒸发", action: "固定表面积，只比较温度或空气流动中的一个变量" },
  "measurement-balance": { title: "托盘天平测质量", focus: "调平、砝码、游码和指针位置", principle: "平衡时物体质量等于砝码总质量与游码示数之和", action: "先空载归零调平，再由大到小加砝码并用游码微调" },
  "measurement-mass-volume": { title: "质量与体积的关系", focus: "同种材料的质量、总体积及二者比值", principle: "同种物质在状态不变时质量与体积成正比，质量体积比保持不变", action: "改变样品总体积，记录对应质量并比较比值" },
  "measurement-density": { title: "测量固体密度", focus: "天平质量与量筒前后体积差", principle: "密度等于质量除以体积", action: "先选样品称量，再完全浸没读取排水体积" },
  "measurement-liquid-density": { title: "测量液体密度", focus: "液体质量、量筒体积和空容器质量", principle: "液体密度等于扣除容器后的液体质量除以体积", action: "先求液体净质量，再读取体积并计算密度" }
};

function classify(question: string): HarnessDialogueIntent {
  if (/(猜|预测|会不会|如果)/.test(question)) return "predict";
  if (/(对比|比较|控制变量|关系|影响)/.test(question)) return "compare";
  if (/(为什么|原理|说明什么|怎么回事|原因)/.test(question)) return "explain";
  if (/(记录|总结|结论|发现)/.test(question)) return "reflect";
  if (/(怎么|如何|下一步|操作|看什么|提示|帮助)/.test(question)) return "method";
  return "orientation";
}

function describeValue(value: HarnessValue | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

export interface HarnessExperimentDiagnosis {
  stage: "orientation" | "exploring" | "comparing" | "evidence";
  stageLabel: string;
  progress: number;
  operationCount: number;
  activeControls: string[];
  comparisonReady: boolean;
  observationCount: number;
  summary: string;
  nextMove: string;
}

export interface HarnessLearnerDimension {
  id: "operation" | "comparison" | "evidence" | "reasoning";
  label: string;
  score: number;
  note: string;
}

export interface HarnessLearnerModel {
  level: "starter" | "observer" | "comparer" | "investigator" | "explainer";
  levelLabel: string;
  overall: number;
  dimensions: HarnessLearnerDimension[];
  strength: string;
  nextChallenge: string;
  memoryLine: string;
}

const experimentEventTypes = new Set<HarnessEvent["type"]>(["control.changed", "configuration.changed", "simulation.toggled", "view.changed", "scene.navigated"]);

function currentModuleEvents(session: HarnessSession, module: string): HarnessEvent[] {
  let entryIndex = -1;
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.type === "module.entered" && event.payload.module === module) {
      entryIndex = index;
      break;
    }
  }
  return entryIndex < 0 ? session.events : session.events.slice(entryIndex + 1);
}

function eventControl(event: HarnessEvent): string {
  return describeValue(event.payload.control)
    || describeValue(event.payload.action)
    || describeValue(event.payload.view)
    || describeValue(event.payload.experiment)
    || "实验条件";
}

function eventReading(event: HarnessEvent): string {
  const value = describeValue(event.payload.value)
    || (typeof event.payload.running === "boolean" ? (event.payload.running ? "已启动" : "已暂停") : "已改变");
  return `${value}${describeValue(event.payload.unit)}`;
}

export function diagnoseHarnessExperiment(session: HarnessSession, module: string): HarnessExperimentDiagnosis {
  const events = currentModuleEvents(session, module);
  const operations = events.filter((event) => experimentEventTypes.has(event.type));
  const controls = new Map<string, Set<string>>();
  operations
    .filter((event) => event.type === "control.changed" || event.type === "configuration.changed")
    .forEach((event) => {
      const name = eventControl(event);
      const values = controls.get(name) ?? new Set<string>();
      values.add(eventReading(event));
      controls.set(name, values);
    });
  const activeControls = [...controls.keys()].slice(-3);
  const comparisonReady = [...controls.values()].some((values) => values.size >= 2);
  const entryTime = [...session.events].reverse().find((event) => event.type === "module.entered" && event.payload.module === module)?.occurredAt;
  const observationCount = session.observations.filter((observation) => !entryTime || observation.createdAt >= entryTime).length;
  const progress = Math.min(4, (operations.length > 0 ? 1 : 0) + (comparisonReady ? 1 : 0) + (operations.length >= 4 ? 1 : 0) + (observationCount > 0 ? 1 : 0));
  const stage = observationCount > 0 ? "evidence" : comparisonReady ? "comparing" : operations.length > 0 ? "exploring" : "orientation";
  const stageLabels = { orientation: "准备提问", exploring: "正在操作", comparing: "形成对比", evidence: "整理证据" } as const;
  const latest = operations.at(-1);
  const summary = latest
    ? `最近一次操作：${eventControl(latest)} → ${eventReading(latest)}。`
    : "当前实验还没有操作记录。";
  let nextMove = "先提出一个可以通过装置检验的问题，再改变一个条件。";
  if (operations.length > 0 && activeControls.length > 1 && !comparisonReady) nextMove = `你连续改变了${activeControls.join("、")}；下一轮请固定其中两个，只改变一个。`;
  else if (operations.length > 0 && !comparisonReady) nextMove = `再给“${activeControls[0] ?? "同一个条件"}”设置一个不同取值，形成可比较的两组现象。`;
  else if (comparisonReady && observationCount === 0) nextMove = "已经形成两组条件，请记录具体读数、方向或状态差异。";
  else if (observationCount > 0) nextMove = "已有观察记录，可以用另一组条件复现，或寻找一个反例。";
  return { stage, stageLabel: stageLabels[stage], progress, operationCount: operations.length, activeControls, comparisonReady, observationCount, summary, nextMove };
}

export function getHarnessLearnerModel(session: HarnessSession, module: string): HarnessLearnerModel {
  const diagnosis = diagnoseHarnessExperiment(session, module);
  const reasoningTurns = (session.dialogue ?? []).filter((message) => message.module === module && message.role === "assistant" && (message.intent === "explain" || message.intent === "predict" || message.intent === "reflect")).length;
  const dimensions: HarnessLearnerDimension[] = [
    { id: "operation", label: "主动操作", score: Math.min(100, diagnosis.operationCount * 24), note: diagnosis.operationCount > 0 ? `已完成 ${diagnosis.operationCount} 次有效操作` : "还没有亲手改变实验条件" },
    { id: "comparison", label: "公平对比", score: diagnosis.comparisonReady ? (diagnosis.activeControls.length <= 1 ? 100 : 78) : Math.min(45, diagnosis.operationCount * 12), note: diagnosis.comparisonReady ? "已经形成至少两组可比较条件" : "还需要让同一个条件出现不同取值" },
    { id: "evidence", label: "证据记录", score: Math.min(100, diagnosis.observationCount * 50), note: diagnosis.observationCount > 0 ? `已保存 ${diagnosis.observationCount} 条观察` : "还没有写下读数或现象" },
    { id: "reasoning", label: "解释反思", score: Math.min(100, reasoningTurns * 34), note: reasoningTurns > 0 ? `已进行 ${reasoningTurns} 次预测、解释或反思` : "还没有用证据解释规律" }
  ];
  const overall = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const levels: Pick<HarnessLearnerModel, "level" | "levelLabel"> = overall >= 78
    ? { level: "explainer", levelLabel: "物理解释者" }
    : overall >= 58 ? { level: "investigator", levelLabel: "证据探究者" }
      : overall >= 36 ? { level: "comparer", levelLabel: "条件比较者" }
        : overall >= 15 ? { level: "observer", levelLabel: "现象观察者" }
          : { level: "starter", levelLabel: "问题发现者" };
  const strongest = [...dimensions].sort((a, b) => b.score - a.score)[0];
  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
  const challenges: Record<HarnessLearnerDimension["id"], string> = {
    operation: "亲手改变一个主要条件，并说出你预计会看到什么。",
    comparison: "保持其他条件不变，为同一个变量补一组不同取值。",
    evidence: "把两组具体读数、方向或状态差异保存为观察。",
    reasoning: "用“因为……所以……”把证据与物理规律连接起来。"
  };
  return {
    ...levels,
    overall,
    dimensions,
    strength: strongest && strongest.score > 0 ? `目前较稳定的是“${strongest.label}”` : "光光还在等待你的第一次实验操作",
    nextChallenge: weakest ? challenges[weakest.id] : challenges.operation,
    memoryLine: diagnosis.activeControls.length > 0 ? `本次重点操作过：${diagnosis.activeControls.join("、")}` : "本次实验还没有形成操作记忆"
  };
}

function recentState(session: HarnessSession, module: string): string {
  const event = [...currentModuleEvents(session, module)].reverse().find((item) => item.type === "control.changed" || item.type === "configuration.changed" || item.type === "simulation.toggled");
  if (!event) return "当前实验还没有参数变化记录。";
  const control = describeValue(event.payload.control) || describeValue(event.payload.action) || "实验条件";
  const value = describeValue(event.payload.value) || (typeof event.payload.running === "boolean" ? (event.payload.running ? "已启动" : "已暂停") : "已改变");
  const unit = describeValue(event.payload.unit);
  return `我看到你最近把“${control}”调整为${value}${unit}。`;
}

function profileFor(area: HarnessArea, module: string): ModuleProfile {
  return { ...areaProfiles[area], ...moduleProfiles[module] };
}

export function getHarnessModuleGuide(module: string, area: HarnessArea): HarnessModuleGuide {
  return profileFor(area, module);
}

export function getHarnessQuickQuestions(module: string, area: HarnessArea): string[] {
  const profile = profileFor(area, module);
  return ["下一步应该观察什么？", `为什么这个实验能说明${profile.principle}？`, "怎样设计一组公平的对比？", "帮我检查一下我的猜想"];
}

export function getHarnessAdaptiveQuestions(session: HarnessSession, module: string): string[] {
  const diagnosis = diagnoseHarnessExperiment(session, module);
  if (diagnosis.operationCount === 0) return ["我应该先改变哪个条件？", "这个实验重点观察什么？", "帮我把问题变成一个可检验的猜想", "根据我的记录给我一个小挑战"];
  if (!diagnosis.comparisonReady) return ["我刚才的操作说明了什么？", "怎样补一组公平的对比？", "哪些条件需要保持不变？", "根据我的记录给我一个小挑战"];
  if (diagnosis.observationCount === 0) return ["我现在应该记录哪些证据？", "两组结果应该怎样比较？", "这个结果能直接当作结论吗？", "根据我的记录给我一个小挑战"];
  return ["帮我把观察整理成结论", "怎样用第二组实验验证？", "这个结论有什么适用条件？", "我还能寻找什么反例？"];
}

export class RuleBasedDialogueAssistant implements DialogueAssistant {
  readonly provider = "rules" as const;

  respondToQuestion(session: HarnessSession, module: string, rawQuestion: string): HarnessDialogueReply {
    const question = rawQuestion.trim();
    const profile = profileFor(session.area, module);
    const intent = classify(question);
    const state = recentState(session, module);
    const diagnosis = diagnoseHarnessExperiment(session, module);
    const learnerModel = getHarnessLearnerModel(session, module);
    const hasExperimentWord = /(光|像|声音|振动|频率|力|杠杆|电|电流|电压|电阻|温度|沸腾|质量|体积|密度|实验|参数|现象|观察|猜|预测|比较|为什么|怎么|数据|读数|结果|证据|结论|变量)/.test(question)
      || (diagnosis.operationCount > 0 && /(对吗|这样|然后|接下来|刚才)/.test(question));

    if (/^(你好|您好|在吗|嗨|hello)[！!。. ]*$/.test(question)) {
      return { intent: "orientation", text: `我在。我已经读取当前“${profile.title}”的独立操作记录：${diagnosis.summary}${diagnosis.nextMove}我仍是本地规则伙伴，不会脱离实验状态猜测答案。`, followUps: getHarnessAdaptiveQuestions(session, module).slice(0, 3) };
    }

    if (/一级提示/.test(question)) {
      return { intent: "method", text: `一级提示只告诉你观察方向：请盯住${profile.focus}。先说出你认为其中哪一项会随操作改变，再动手验证。`, followUps: ["给我二级提示", "我应该先改变哪个条件？", "帮我把预测写清楚"] };
    }

    if (/二级提示/.test(question)) {
      return { intent: "method", text: `二级提示给出操作脚手架：${profile.action}。请保留一组基准，只让一个主要条件出现不同取值。`, followUps: ["给我三级提示", "哪些条件需要保持不变？", "我完成两组操作了"] };
    }

    if (/三级提示/.test(question)) {
      const evidenceHint = diagnosis.comparisonReady
        ? `你已经有两组条件。现在完成句子：“当我只改变____时，${profile.focus}从____变为____。”`
        : `当前还缺少真正的对比组。${diagnosis.nextMove}`;
      return { intent: "reflect", text: `三级提示帮助你整理证据，但仍不替你写结论：${evidenceHint}`, followUps: ["帮我检查这条证据", "这个结果能直接当作结论吗？", "怎样寻找一个反例？"] };
    }

    if (/(直接.*答案|告诉我.*答案|答案是什么|正确答案|结论是什么)/.test(question)) {
      const scaffold = diagnosis.stage === "orientation"
        ? `先不直接给答案。第一步请找出装置中可以改变的一个条件，并预测${profile.focus}会怎样变化。`
        : diagnosis.stage === "exploring" ? `我先给一级提示：${diagnosis.nextMove}完成后，把两组${profile.focus}放在一起比较。`
          : diagnosis.stage === "comparing" ? `你已经接近结论。请先完成这句话：“当我只改变……时，我观察到……”。我再帮你检查证据是否足够。`
            : `你已经有观察证据。请尝试用“因为……所以……”连接证据与规律；如果逻辑不完整，我会指出缺少的那一步。`;
      return { intent: "method", text: scaffold, followUps: ["给我一级提示", "帮我检查控制变量", "我的证据够了吗？", "根据我的记录给我一个小挑战"] };
    }

    if (/(挑战|考考我|练一练)/.test(question)) {
      return { intent: "predict", text: `好，给你一个刚好比当前进度高一步的挑战：${learnerModel.nextChallenge}我先不判断答案，完成后告诉我你改变了什么、看到了什么。`, followUps: ["我应该记录哪些证据？", "完成后怎样判断是否通过？", "如果结果和预测相反怎么办？"] };
    }

    if (!hasExperimentWord) {
      return { intent: "orientation", text: `这个问题超出了我当前的“${profile.title}”规则库。我不会猜测答案；可以把问题改成与当前装置、参数、现象或猜想有关的表达。`, followUps: getHarnessQuickQuestions(module, session.area).slice(0, 3) };
    }

    const replies: Record<HarnessDialogueIntent, string> = {
      orientation: `我们现在研究的是“${profile.title}”。${state}${diagnosis.nextMove}重点观察${profile.focus}。`,
      method: `${state}${diagnosis.nextMove}接下来重点观察${profile.focus}。如果需要重新开始，可以按这个顺序操作：${profile.action}。`,
      explain: `这个现象主要用“${profile.principle}”解释。${state}先沿着装置中的因果顺序描述现象，再判断${profile.focus}是否支持这条规律；仅凭一次画面变化还不能算完整证据。`,
      compare: diagnosis.comparisonReady
        ? `你已经让同一个条件出现了不同取值，具备初步对比基础。现在不要再同时改变别的量；请把两组${profile.focus}并排记录，再判断差异是否稳定。`
        : `可以设计 A、B 两组：${profile.compare}。${diagnosis.nextMove}两组都比较${profile.focus}。`,
      predict: `你的猜想现在先不判对错。请把它写成“当某个条件增大或减小时，${profile.focus}会怎样变化”。然后按这一步检验：${profile.action}。如果结果相反，也要保留这条反例。`,
      reflect: `你当前处于“${diagnosis.stageLabel}”阶段。可以用三句话记录：①我改变了什么；②我看到${profile.focus}怎样变化；③它是否支持“${profile.principle}”。尽量写具体读数或方向，不只写“变了”。`
    };

    const followUps: Record<HarnessDialogueIntent, string[]> = {
      orientation: ["下一步应该观察什么？", "怎样设计一组公平的对比？"],
      method: ["为什么要一次只改变一个量？", "我应该记录哪些数据？"],
      explain: ["怎样用第二组实验验证？", "这个结论有什么适用条件？"],
      compare: ["哪一个量应该保持不变？", "怎样记录两组结果？"],
      predict: ["怎样把猜想变成可检验的句子？", "如果结果相反怎么办？"],
      reflect: ["帮我把观察变成证据", "怎样寻找一个反例？"]
    };

    return { intent, text: replies[intent], followUps: [...getHarnessAdaptiveQuestions(session, module), ...followUps[intent]].filter((item, index, items) => items.indexOf(item) === index).slice(0, 4) };
  }
}

function createDialogueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function appendDialogueExchange(session: HarnessSession, module: string, question: string, reply: HarnessDialogueReply, now = new Date().toISOString()): HarnessSession {
  const event: HarnessEvent = {
    id: createDialogueId("event-dialogue"),
    sessionId: session.id,
    area: session.area,
    type: "dialogue.asked",
    occurredAt: now,
    payload: { module, question: question.trim(), intent: reply.intent }
  };
  const messages: HarnessDialogueMessage[] = [
    { id: createDialogueId("message-learner"), role: "learner", text: question.trim(), createdAt: now, module },
    { id: createDialogueId("message-assistant"), role: "assistant", text: reply.text, createdAt: now, module, intent: reply.intent, followUps: reply.followUps }
  ];
  return { ...session, updatedAt: now, events: [...session.events, event], dialogue: [...(session.dialogue ?? []), ...messages] };
}
