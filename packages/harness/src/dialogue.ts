import type {
  DialogueAssistant,
  HarnessArea,
  HarnessApparatusContext,
  HarnessDialogueIntent,
  HarnessDialogueMessage,
  HarnessDialogueReply,
  HarnessEvent,
  HarnessSession,
  HarnessValue
} from "./types";
import { answerFromHarnessApparatus, summarizeHarnessApparatus } from "./apparatusState";
import { findHarnessMisconception, getHarnessConceptNode } from "./conceptGraph";
import { reviewHarnessConclusionText, reviewHarnessEvidenceText, reviewHarnessHypothesisText, reviewHarnessReasoningText, understandHarnessQuestion } from "./understanding";

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

const calculationGuides: Record<string, string> = {
  reflection: "反射角等于入射角，两个角都从法线量起：∠r=∠i。",
  "sound-echo": "目标距离等于声速乘回声往返时间的一半：s=vt/2。",
  "mechanics-speed": "平均速度等于总路程除以总时间：v=s/t。",
  "mechanics-lever": "杠杆平衡时两侧力矩相等：F₁l₁=F₂l₂。",
  "mechanics-pressure": "压强等于压力除以受力面积：p=F/S。",
  "circuit-ohm": "对同一段电路可用 I=U/R；代入前要统一伏特、安培和欧姆。",
  "circuit-power": "电功率 P=UI，工作一段时间消耗的电能 W=Pt。",
  "measurement-balance": "天平平衡后，物体质量等于砝码总质量加游码示数。",
  "measurement-mass-volume": "用 m/V 比较同种物质各组数据，状态不变时比值应近似稳定。",
  "measurement-density": "固体体积 V=V₂−V₁，密度 ρ=m/V。",
  "measurement-liquid-density": "液体净质量 m=m总−m杯，密度 ρ=m/V。"
};

const safetyGuides: Record<HarnessArea, string> = {
  optics: "不要直视强光源或激光，也不要用凸透镜会聚太阳光照向眼睛或可燃物；虚拟装置中的高亮光线只是示意。",
  lens: "不要用透镜直接观察太阳，也不要把强光会聚到眼睛或可燃物；真实光具座移动器材时要防止镜片跌落。",
  sound: "真实听音实验要控制音量和持续时间，不要把高声级声源贴近耳朵。",
  mechanics: "检查支架与钩码是否稳固，改变载荷时避免手处在可能下落、弹出或夹伤的位置。",
  circuit: "连接或改动真实电路前应先断开开关，严禁直接短接电源，并选择合适的电表量程。",
  thermal: "真实加热实验要防止烫伤，使用夹持工具；停止加热后器材仍可能高温，不能立即用手触碰。",
  measurement: "使用天平时用镊子取放砝码，不称量超过量程的物体；玻璃量筒应放稳，避免跌落。"
};

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

export interface HarnessLearningBranch {
  id: "observe" | "compare" | "evidence" | "explain" | "transfer";
  eyebrow: string;
  title: string;
  reason: string;
  prompt: string;
}

export interface HarnessExperimentSummary {
  title: string;
  question: string;
  changedConditions: string[];
  evidence: string[];
  interpretation: string;
  missingEvidence: string;
  recordText: string;
  ready: boolean;
  alreadySaved: boolean;
}

const experimentEventTypes = new Set<HarnessEvent["type"]>(["control.changed", "configuration.changed", "simulation.toggled", "view.changed", "scene.navigated"]);
const summaryEvidenceEventTypes = new Set<HarnessEvent["type"]>(["control.changed", "configuration.changed", "simulation.toggled"]);

function isGeneratedSummary(text: string): boolean {
  return /^【.+探究小结】/.test(text);
}

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

function currentModuleEntryTime(session: HarnessSession, module: string): string | undefined {
  return [...session.events].reverse().find((event) => event.type === "module.entered" && event.payload.module === module)?.occurredAt;
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
  const entryTime = currentModuleEntryTime(session, module);
  const observationCount = session.observations.filter((observation) => (!entryTime || observation.createdAt >= entryTime) && !isGeneratedSummary(observation.text)).length;
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

export function getHarnessLearningBranch(session: HarnessSession, module: string): HarnessLearningBranch | undefined {
  const concept = getHarnessConceptNode(module);
  if (!concept) return undefined;
  const diagnosis = diagnoseHarnessExperiment(session, module);
  const reasoningTurns = (session.dialogue ?? []).filter((message) => message.module === module && message.role === "assistant" && (message.intent === "explain" || message.intent === "reflect")).length;

  if (diagnosis.operationCount === 0) return {
    id: "observe", eyebrow: "可选支线 · 先观察", title: "让一个变量真正动起来",
    reason: "光光还没有读到当前装置的操作证据，你可以从最小的一步开始，也可以继续自由探索。",
    prompt: `给我一级提示：${concept.hintLadder[0]}`
  };
  if (!diagnosis.comparisonReady) return {
    id: "compare", eyebrow: "可选支线 · 做对比", title: "为同一条件补一组取值",
    reason: "已有操作，但还无法把变化归因到一个明确条件；形成对比会让现象更可信。",
    prompt: `给我二级提示：${concept.hintLadder[1]}`
  };
  if (diagnosis.observationCount === 0) return {
    id: "evidence", eyebrow: "可选支线 · 留证据", title: "把看见的差异写具体",
    reason: `两组条件已经形成，请按“${concept.evidenceCriteria[0]}”检查并保存观察。`,
    prompt: "我现在应该记录哪些证据？"
  };
  if (reasoningTurns === 0) return {
    id: "explain", eyebrow: "可选支线 · 作解释", title: "把现象和规律连起来",
    reason: "你已经保存观察，但还没有说明这条证据为何支持或不支持物理规律。",
    prompt: `为什么我的观察可能支持“${concept.title}”？`
  };
  return {
    id: "transfer", eyebrow: "可选支线 · 去迁移", title: `试着连接“${concept.connections[0] ?? "生活现象"}”`,
    reason: "本轮已经具备操作、对比、证据和解释，可以选择迁移到生活科技，也可以寻找反例。",
    prompt: `${concept.connections[0] ?? "生活现象"}和这个实验有什么联系？`
  };
}

export function createHarnessExperimentSummary(session: HarnessSession, module: string): HarnessExperimentSummary {
  const profile = profileFor(session.area, module);
  const diagnosis = diagnoseHarnessExperiment(session, module);
  const operations = currentModuleEvents(session, module).filter((event) => summaryEvidenceEventTypes.has(event.type));
  const valuesByControl = new Map<string, string[]>();
  operations.forEach((event) => {
    const control = event.type === "simulation.toggled" ? "实验运行状态" : eventControl(event);
    const readings = valuesByControl.get(control) ?? [];
    const reading = eventReading(event);
    if (readings.at(-1) !== reading) readings.push(reading);
    valuesByControl.set(control, readings.slice(-4));
  });
  const changedConditions = [...valuesByControl.entries()].slice(-4).map(([control, readings]) => `${control}：${readings.join(" → ")}`);
  const entryTime = currentModuleEntryTime(session, module);
  const summaryPrefix = `【${profile.title}探究小结】`;
  const currentObservations = session.observations.filter((observation) => (!entryTime || observation.createdAt >= entryTime) && !isGeneratedSummary(observation.text));
  const evidence = currentObservations.slice(-3).map((observation) => observation.text);
  const question = `改变实验条件时，${profile.focus}会怎样变化？`;
  const interpretation = evidence.length === 0
    ? "目前只有操作痕迹，还不能代替学生亲自观察到的证据，也不能据此写出确定结论。"
    : diagnosis.comparisonReady
      ? `现有记录可以作为讨论“${profile.principle}”的证据线索，但仍需复现实验或检查反例。`
      : `已经有观察记录，但还缺少公平对比，暂时不能判断它是否充分支持“${profile.principle}”。`;
  const missingEvidence = operations.length === 0
    ? "先完成一次有效操作，并写下操作前后的现象或读数。"
    : !diagnosis.comparisonReady
      ? "让同一个主要条件出现第二个取值，并保持其他条件尽量不变。"
      : evidence.length === 0
        ? "写下两组具体读数、方向或状态差异，不只写“变了”。"
        : "再重复一次实验，或寻找一组与暂时解释不一致的反例。";
  const recordText = [
    summaryPrefix,
    `研究问题：${question}`,
    `改变条件：${changedConditions.length ? changedConditions.join("；") : "尚未记录有效的条件变化"}`,
    `观察证据：${evidence.length ? evidence.join("；") : "学生尚未保存观察证据"}`,
    `暂时解释：${interpretation}`,
    `还需补充：${missingEvidence}`
  ].join("\n");
  return {
    title: profile.title,
    question,
    changedConditions,
    evidence,
    interpretation,
    missingEvidence,
    recordText,
    ready: operations.length > 0,
    alreadySaved: session.observations.some((observation) => (!entryTime || observation.createdAt >= entryTime) && observation.text.startsWith(summaryPrefix))
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
  const concept = getHarnessConceptNode(module);
  return [
    "这个实验主要研究什么？",
    "下一步应该观察什么？",
    "哪些量要保持不变？",
    "我应该记录哪些证据？",
    `为什么这个实验能说明${profile.principle}？`,
    "如果装置没有明显变化，应该检查什么？",
    "这个实验有哪些安全注意事项？",
    concept ? "这个实验最容易和什么混淆？" : "帮我检查一下我的猜想"
  ];
}

export function getHarnessAdaptiveQuestions(session: HarnessSession, module: string): string[] {
  const diagnosis = diagnoseHarnessExperiment(session, module);
  const concept = getHarnessConceptNode(module);
  if (diagnosis.operationCount === 0) return ["我应该先改变哪个条件？", "这个实验重点观察什么？", concept ? "这个实验最容易和什么混淆？" : "帮我把问题变成一个可检验的猜想", "根据我的记录给我一个小挑战"];
  if (!diagnosis.comparisonReady) return ["我刚才的操作说明了什么？", "怎样补一组公平的对比？", "哪些条件需要保持不变？", "根据我的记录给我一个小挑战"];
  if (diagnosis.observationCount === 0) return ["我现在应该记录哪些证据？", "两组结果应该怎样比较？", "这个结果能直接当作结论吗？", "根据我的记录给我一个小挑战"];
  return ["帮我把观察整理成结论", "怎样用第二组实验验证？", "这个结论有什么适用条件？", "我还能寻找什么反例？"];
}

export class RuleBasedDialogueAssistant implements DialogueAssistant {
  readonly provider = "rules" as const;

  respondToQuestion(session: HarnessSession, module: string, rawQuestion: string, apparatus?: HarnessApparatusContext): HarnessDialogueReply {
    const understanding = understandHarnessQuestion(session.area, module, rawQuestion);
    const question = understanding.normalizedText;
    const profile = profileFor(session.area, module);
    const intent = understanding.dialogueIntent;
    const state = summarizeHarnessApparatus(apparatus) ?? recentState(session, module);
    const diagnosis = diagnoseHarnessExperiment(session, module);
    const learnerModel = getHarnessLearnerModel(session, module);
    const concept = getHarnessConceptNode(module);
    const misconception = findHarnessMisconception(module, question);
    const hasExperimentWord = understanding.inScope
      || (diagnosis.operationCount > 0 && /(对吗|这样|然后|接下来|刚才)/.test(question));

    if (/^(你好|您好|在吗|嗨|hello)[！!。. ]*$/.test(question)) {
      return { intent: "orientation", text: `我在。我已经读取当前“${profile.title}”的独立操作记录：${diagnosis.summary}${diagnosis.nextMove}我仍是本地规则伙伴，不会脱离实验状态猜测答案。`, followUps: getHarnessAdaptiveQuestions(session, module).slice(0, 3) };
    }

    if (/(你能|你会|光光能|可以).*(回答|做什么|帮什么|问什么)|怎么问|能问哪些/.test(question)) {
      return {
        intent: "orientation",
        text: `围绕当前“${profile.title}”，你可以问我九类问题：①实验研究什么；②从哪里开始；③改变什么量；④观察什么；⑤记录什么证据；⑥怎样公平比较；⑦物理规律或计算；⑧装置没现象怎么排查；⑨生活应用、常见误区和安全事项。我还会结合当前操作记录回答，但不会编造没有发生的实验结果。`,
        followUps: ["这个实验主要研究什么？", "我应该先改变哪个条件？", "如果装置没有明显变化，应该检查什么？", "这个实验有哪些安全注意事项？"]
      };
    }

    if (/先不要给提示.*回忆.*(?:变量|证据|结论)|无提示回忆/.test(question)) {
      return {
        intent: "reflect",
        text: `进入无提示回忆模式。我先不显示答案，也不引用你以前的结论。请依次回答三件事：①这个实验主要改变了什么、保持什么不变；②你亲眼看到或读到了什么证据；③这些证据在什么条件下支持怎样的结论。\n你回答后，我只标出缺失环节，再按需开放一级提示。`,
        followUps: ["我先回忆变量：……", "我先回忆观察证据：……", "我实在想不起来，给我一级提示"]
      };
    }

    if (/(检查|评价|审查|完善)(这条|下面|以下).*(假设|猜想|预测)|(?:假设|猜想|预测).*[：:]/.test(question)) {
      const hypothesisText = question.split(/[：:]/).slice(1).join("：").trim();
      if (!hypothesisText) return { intent: "predict", text: "请把假设放在冒号后面。光光会检查改变的条件、变化方向、预测结果以及它能否被两组实验检验。", followUps: ["怎样把问题写成可检验假设？", "哪些条件需要保持不变？", "怎样设计第二组？"] };
      const review = reviewHarnessHypothesisText(hypothesisText);
      return {
        intent: "predict",
        text: `假设审查 ${review.score}/4：${review.feedback}${review.missing.length ? ` 仍需补充：${review.missing.join("、")}。` : ""}\n可以按这个框架修改：${review.template}\n光光只检查它是否可检验，不会在实验前把预测当成事实。`,
        followUps: review.score >= 3 ? ["怎样设计公平对照？", "我应该记录哪些证据？", "如果预测不成立怎么办？"] : ["帮我找出自变量和因变量", "给我二级提示", "怎样设计第二组？"]
      };
    }

    if (/(检查|评价|审查|完善)(这条|下面|以下).*(因果|解释链|推理链)|(?:因果|解释链|推理链).*[：:]/.test(question)) {
      const reasoningText = question.split(/[：:]/).slice(1).join("：").trim();
      if (!reasoningText) return { intent: "reflect", text: "请把因果解释放在冒号后面。光光会检查证据、原因桥梁、控制条件和推理边界，寻找中间跳步。", followUps: ["怎样区分现象和解释？", "帮我检查这条证据", "这个结论有什么适用条件？"] };
      const review = reviewHarnessReasoningText(reasoningText);
      return {
        intent: "reflect",
        text: `因果链审查 ${review.score}/4：${review.feedback}${review.gaps.length ? ` 推理缺口：${review.gaps.join("、")}。` : ""}\n可以按这个框架修改：${review.template}\n这里检查的是证据到解释之间有没有跳步，不会因为句子里有“因为、所以”就自动判定正确。`,
        followUps: review.score >= 3 ? ["怎样找一个替代解释？", "怎样用反例继续检验？", "把它整理成有边界的结论"] : ["帮我检查这条证据", "哪些条件需要保持不变？", "给我三级提示"]
      };
    }

    if (/(检查|评价|审查|完善)(这条|下面|以下).*(观察|证据|记录)|(?:观察|证据|记录).*[：:]/.test(question)) {
      const evidenceText = question.split(/[：:]/).slice(1).join("：").trim();
      if (!evidenceText) return { intent: "reflect", text: "请把要检查的观察放在冒号后面。光光会逐项检查实验条件、直接现象、对比关系以及数值或明确状态。", followUps: ["我应该记录哪些证据？", "给我三级提示", "怎样区分现象和结论？"] };
      const review = reviewHarnessEvidenceText(evidenceText);
      const passed = review.items.filter((item) => item.passed).map((item) => item.label);
      return {
        intent: "reflect",
        text: `证据审查 ${review.score}/4：${review.feedback}${passed.length ? ` 已识别：${passed.join("、")}。` : ""}${review.missing.length ? ` 仍需补充：${review.missing.join("、")}。` : ""}\n可以按这个框架修改：${review.template}\n注意：光光只检查表达结构，不会把没有真实观察到的数据替你填进去。`,
        followUps: review.score >= 3 ? ["把它保存为实验观察", "这个证据能直接当作结论吗？", "怎样用第二组实验验证？"] : ["给我三级提示", "我应该读取哪个数值？", "怎样补一组公平对照？"]
      };
    }

    if (/(检查|评价|审查|完善)(这条|下面|以下).*(结论|推理)|(?:结论|推理).*[：:]/.test(question)) {
      const conclusionText = question.split(/[：:]/).slice(1).join("：").trim();
      if (!conclusionText) return { intent: "reflect", text: "请把要检查的结论放在冒号后面。光光会检查是否连接真实证据、说明适用条件，并识别“总是、一定”等过度概括。", followUps: ["这个结果能直接当作结论吗？", "怎样寻找一个反例？", "帮我检查这条证据"] };
      const review = reviewHarnessConclusionText(conclusionText);
      const passed = review.items.filter((item) => item.passed).map((item) => item.label);
      return {
        intent: "reflect",
        text: `结论审查 ${review.score}/4：${review.feedback}${passed.length ? ` 已通过：${passed.join("、")}。` : ""}${review.risks.length ? ` 风险：${review.risks.join("；")}。` : ""}\n可以按这个框架修改：${review.template}\n注意：这项审查只判断推理结构与适用范围，不能替代真实数据，也不自动判定物理结论正确。`,
        followUps: review.score >= 3 ? ["怎样用反例继续检验？", "把观察和结论整理成小结", "这个规律能迁移到哪里？"] : ["帮我检查这条证据", "这个结论有什么适用条件？", "怎样补一组公平对照？"]
      };
    }

    const apparatusReply = answerFromHarnessApparatus(module, question, apparatus, { title: profile.title, principle: profile.principle, focus: profile.focus });
    if (apparatusReply) return apparatusReply;

    if (/一级提示/.test(question)) {
      return { intent: "method", text: `一级提示只告诉你观察方向：${concept?.hintLadder[0] ?? `请盯住${profile.focus}。先说出你认为其中哪一项会随操作改变，再动手验证。`}`, followUps: ["给我二级提示", "我应该先改变哪个条件？", "帮我把预测写清楚"] };
    }

    if (/二级提示/.test(question)) {
      return { intent: "method", text: `二级提示给出操作脚手架：${concept?.hintLadder[1] ?? `${profile.action}。请保留一组基准，只让一个主要条件出现不同取值。`}`, followUps: ["给我三级提示", "哪些条件需要保持不变？", "我完成两组操作了"] };
    }

    if (/三级提示/.test(question)) {
      const evidenceHint = diagnosis.comparisonReady
        ? concept?.hintLadder[2] ?? `你已经有两组条件。现在完成句子：“当我只改变____时，${profile.focus}从____变为____。”`
        : `当前还缺少真正的对比组。${diagnosis.nextMove}`;
      return { intent: "reflect", text: `三级提示帮助你整理证据，但仍不替你写结论：${evidenceHint}`, followUps: ["帮我检查这条证据", "这个结果能直接当作结论吗？", "怎样寻找一个反例？"] };
    }

    if (misconception) {
      return {
        intent: "explain",
        text: `你碰到了“${misconception.claim}”这个常见混淆。需要修正的地方是：${misconception.correction}先不要只记这句话，可以这样用实验核对：${misconception.probe}`,
        followUps: ["给我一级提示", "怎样把这个验证写成对比实验？", "验证后应该记录什么证据？"]
      };
    }

    if (concept && /(容易.*混淆|常见.*错误|错误观念|常见误区)/.test(question)) {
      const item = concept.misconceptions[0];
      if (item) return { intent: "explain", text: `这个实验常见的混淆是：“${item.claim}”。光光先不让你背修正答案，请用这一步辨一辨：${item.probe}`, followUps: [`这个说法对吗：${item.claim}`, "给我一级提示", "怎样记录验证证据？"] };
    }

    if (/(实验目的|研究什么|探究什么|主要.*什么|是干什么|能说明什么|学什么)/.test(question)) {
      return {
        intent: "orientation",
        text: `“${profile.title}”研究的核心问题是：${concept?.inquiryQuestion ?? `改变实验条件时，${profile.focus}怎样变化？`}重点不是先记结论，而是用装置获得能支持或反驳解释的证据。`,
        followUps: ["我应该先改变哪个条件？", "这个实验重点观察什么？", "我应该记录哪些证据？"]
      };
    }

    if (/(从哪.*开始|从哪里入手|先做什么|先干嘛|第一步|操作步骤|操作顺序|怎么开始|如何开始|怎么操作)/.test(question)) {
      return {
        intent: "method",
        text: `可以从这一步开始：${profile.action}。${concept ? `如果还不确定，只做一级提示中的动作：${concept.hintLadder[0]}` : "完成后先描述现象，不急着写结论。"}${diagnosis.operationCount > 0 ? `我还读到：${diagnosis.summary}${diagnosis.nextMove}` : "完成第一次操作后，我会根据装置状态继续提示。"}`,
        followUps: ["哪些量要保持不变？", "操作后重点看哪里？", "给我二级提示"]
      };
    }

    if (/(观察什么|看哪里|重点看|关注什么|测量什么|读哪个|怎么看现象)/.test(question)) {
      return {
        intent: "method",
        text: `${state}重点观察${profile.focus}。${concept ? `先检查这条可见证据：“${concept.evidenceCriteria[0]}”。` : "尽量读取具体方向、状态、数值或曲线变化。"}请把“看见或测到的事实”和“为什么会这样”分开表达。`,
        followUps: ["我应该记录哪些证据？", "怎样比较两组现象？", "观察和结论有什么区别？"]
      };
    }

    if (/(自变量|因变量|控制变量|保持.*不变|固定什么|改变什么量|哪些量|哪个条件)/.test(question)) {
      return {
        intent: "compare",
        text: `本实验可以这样组织变量：${profile.compare}。自变量是你主动改变的那个条件，因变量是要观察的“${profile.focus}”，其余可能影响结果的条件尽量保持一致。${diagnosis.activeControls.length > 1 ? `当前记录里出现过${diagnosis.activeControls.join("、")}，下一组要避免同时改变。` : diagnosis.nextMove}`,
        followUps: ["怎样补一组公平的对比？", "因变量应该怎样记录？", "为什么一次只改变一个量？"]
      };
    }

    if (/(记录什么|哪些证据|证据标准|数据表|表格|怎么记录|读数怎么写|现象怎么写)/.test(question)) {
      const criteria = concept?.evidenceCriteria.map((item, index) => `${index + 1}.${item}`).join("；") ?? `记录改变的条件、${profile.focus}以及单位`;
      return {
        intent: "reflect",
        text: `建议至少记录三部分：改变条件、直接观察或读数、保持不变的条件。当前实验的证据检查是：${criteria}。不要只写“变大了”或“成功了”，应写清从什么状态或数值变到什么状态或数值。`,
        followUps: ["帮我把观察写成证据句", "这个结果能直接当作结论吗？", "怎样检查单位？"]
      };
    }

    if (/(公式|怎么算|如何计算|怎么计算|代入|单位换算)/.test(question)) {
      const guide = calculationGuides[module];
      return {
        intent: "explain",
        text: guide
          ? `${guide}计算前先确认各数据来自同一组实验，并统一单位。光光可以帮你检查计算路径，但不会把尚未测得的数据补进公式。`
          : `“${profile.title}”主要通过现象比较建立“${profile.principle}”，当前规则库没有把它简化成一个必须套用的公式。请先记录${profile.focus}，再判断是否需要定量计算。`,
        followUps: ["帮我检查数据是否来自同一组实验", "我应该记录哪些证据？", "怎样估计测量误差？"]
      };
    }

    if (/(失败|不对|没变化|没反应|没现象|看不到|不工作|不发光|不亮|不平衡|不清晰|模糊|出错|故障|检查什么)/.test(question)) {
      return {
        intent: "method",
        text: `先不要把“没有明显现象”当成实验失败。按三层检查：①装置是否处于可工作状态；②是否真的只改变了一个主要条件；③读数、视角或观察位置是否合适。${concept ? `本实验首先核对：“${concept.evidenceCriteria[0]}”。` : "然后回到一组基准条件重新操作。"}${diagnosis.operationCount > 0 ? diagnosis.nextMove : `可以先这样重建基准：${profile.action}。`}`,
        followUps: ["帮我检查装置状态", "给我一级提示", "怎样重新建立一组基准？"]
      };
    }

    if (/(安全|注意事项|危险|会不会伤|保护|能不能直接碰)/.test(question)) {
      return {
        intent: "method",
        text: `如果把当前虚拟实验迁移到真实课堂，安全边界是：${safetyGuides[session.area]}虚拟平台不会替代教师指导和真实器材操作规范。`,
        followUps: ["真实实验还要检查哪些器材？", "我应该先改变哪个条件？", "这个实验最容易和什么混淆？"]
      };
    }

    if (concept && /(联系|应用|生活|科技|迁移)/.test(question)) {
      const namedConnection = concept.connections.find((connection) => question.includes(connection)) ?? concept.connections[0];
      return {
        intent: "explain",
        text: `“${namedConnection ?? "这个生活现象"}”与“${concept.title}”的连接不能只靠记忆结论。可以把它拆成三步：先找出其中发生变化的物理量，再判断当前实验的哪条证据可以迁移过去，最后说明实验模型省略了哪些真实条件。你可以先从这条证据标准核对：${concept.evidenceCriteria[0]}`,
        followUps: ["帮我把生活现象拆成可观察的物理量", "当前实验省略了哪些真实条件？", "我还能寻找什么反例？"]
      };
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

    if (/(生成|整理|看看|查看)?.*(本次|实验)?.*(小结|总结|记录报告)|把.*观察.*整理/.test(question)) {
      const summary = createHarnessExperimentSummary(session, module);
      return {
        intent: "reflect",
        text: `${summary.recordText}\n\n说明：这份小结只整理已经发生的操作和你亲自保存的观察，不会补写未观察到的结果。`,
        followUps: summary.evidence.length ? ["怎样用第二组实验验证？", "这个解释还缺什么证据？", "我还能寻找什么反例？"] : ["我现在应该记录哪些证据？", "怎样补一组公平的对比？", "给我三级提示"]
      };
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
    { id: createDialogueId("message-assistant"), role: "assistant", text: reply.text, createdAt: now, module, intent: reply.intent, followUps: reply.followUps, citations: reply.citations }
  ];
  return { ...session, updatedAt: now, events: [...session.events, event], dialogue: [...(session.dialogue ?? []), ...messages] };
}
