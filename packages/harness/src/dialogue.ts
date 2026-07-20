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

interface ModuleProfile {
  title: string;
  focus: string;
  principle: string;
  action: string;
  compare: string;
}

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
  "curved-mirror": { title: "曲面镜成像", focus: "焦点、视野以及像的虚实和大小", principle: "凹面镜会聚光，凸面镜发散光", action: "先切换凹凸面镜，再只改变物距" },
  magnifier: { title: "放大镜", focus: "物体位于焦点以内时看到的正立放大虚像", principle: "凸透镜焦内成正立放大的虚像", action: "把物体移到焦点两侧，比较光屏能否承接像" },
  bench: { title: "自由光具座", focus: "物距、像距、焦距与光屏清晰度", principle: "凸透镜成像规律", action: "先固定焦距，移动物体后再寻找清晰像面" },
  "sound-medium": { title: "声音的产生与传播", focus: "空气减少或距离增大时接收强度怎样变化", principle: "声音由振动产生，传播需要介质", action: "保持距离不变先减少空气，再恢复空气改变距离" },
  "sound-features": { title: "声音三要素", focus: "波形的高度、疏密与声音特性的对应关系", principle: "振幅主要影响响度，频率主要影响音调", action: "固定振幅改变频率，再反过来操作" },
  "mechanics-lever": { title: "杠杆平衡", focus: "左右两侧力与力臂的乘积", principle: "杠杆平衡时动力乘动力臂等于阻力乘阻力臂", action: "只移动一侧钩码，观察哪一端下沉" },
  "circuit-basic": { title: "串联与并联电路", focus: "开关闭合后电流有几条完整路径", principle: "串联只有一条电流路径，并联有多条支路", action: "先闭合开关，再保持电阻不变切换连接方式" },
  "circuit-ohm": { title: "欧姆定律", focus: "电流随电压或电阻变化的方向", principle: "同一导体中电流与电压成正比、与电阻成反比", action: "固定电阻改变电压，再固定电压改变电阻" },
  "thermal-boiling": { title: "观察水的沸腾", focus: "达到沸点前后温度曲线的斜率", principle: "水沸腾时继续吸热，但温度保持在沸点附近", action: "启动加热并连续观察曲线直到出现平台" },
  "measurement-density": { title: "测量固体密度", focus: "天平质量与量筒前后体积差", principle: "密度等于质量除以体积", action: "先选样品称量，再完全浸没读取排水体积" }
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

function recentState(session: HarnessSession): string {
  const event = [...session.events].reverse().find((item) => item.type === "control.changed" || item.type === "configuration.changed" || item.type === "simulation.toggled");
  if (!event) return "当前还没有参数变化记录。";
  const control = describeValue(event.payload.control) || describeValue(event.payload.action) || "实验条件";
  const value = describeValue(event.payload.value) || (typeof event.payload.running === "boolean" ? (event.payload.running ? "已启动" : "已暂停") : "已改变");
  const unit = describeValue(event.payload.unit);
  return `我看到你最近把“${control}”调整为${value}${unit}。`;
}

function profileFor(area: HarnessArea, module: string): ModuleProfile {
  return { ...areaProfiles[area], ...moduleProfiles[module] };
}

export function getHarnessQuickQuestions(module: string, area: HarnessArea): string[] {
  const profile = profileFor(area, module);
  return ["下一步应该观察什么？", `为什么这个实验能说明${profile.principle}？`, "怎样设计一组公平的对比？", "帮我检查一下我的猜想"];
}

export class RuleBasedDialogueAssistant implements DialogueAssistant {
  readonly provider = "rules" as const;

  respondToQuestion(session: HarnessSession, module: string, rawQuestion: string): HarnessDialogueReply {
    const question = rawQuestion.trim();
    const profile = profileFor(session.area, module);
    const intent = classify(question);
    const state = recentState(session);
    const hasExperimentWord = /(光|像|声音|振动|频率|力|杠杆|电|电流|电压|电阻|温度|沸腾|质量|体积|密度|实验|参数|现象|观察|猜|预测|比较|为什么|怎么)/.test(question);

    if (/^(你好|您好|在吗|嗨|hello)[！!。. ]*$/.test(question)) {
      return { intent: "orientation", text: `我在。我是当前“${profile.title}”的本地规则伙伴，可以结合你的操作记录讨论实验方法，但还不能像大语言模型一样回答任意话题。你可以先问我下一步观察什么。`, followUps: getHarnessQuickQuestions(module, session.area).slice(0, 3) };
    }

    if (!hasExperimentWord) {
      return { intent: "orientation", text: `这个问题超出了我当前的“${profile.title}”规则库。我不会猜测答案；可以把问题改成与当前装置、参数、现象或猜想有关的表达。`, followUps: getHarnessQuickQuestions(module, session.area).slice(0, 3) };
    }

    const replies: Record<HarnessDialogueIntent, string> = {
      orientation: `我们现在研究的是“${profile.title}”。${state}先把问题缩小到一个可改变的条件：${profile.action}，重点观察${profile.focus}。`,
      method: `${state}下一步建议：${profile.action}。操作后先不要急着下结论，重点记录${profile.focus}，并保留一组未改变条件的基准。`,
      explain: `这个现象主要用“${profile.principle}”解释。${state}先沿着装置中的因果顺序描述现象，再判断${profile.focus}是否支持这条规律；仅凭一次画面变化还不能算完整证据。`,
      compare: `可以设计 A、B 两组：${profile.compare}。先记录基准组，再改变唯一自变量；两组都比较${profile.focus}。这样观察到的差异才更可能来自你改变的条件。`,
      predict: `你的猜想现在先不判对错。请把它写成“当某个条件增大或减小时，${profile.focus}会怎样变化”。然后按这一步检验：${profile.action}。如果结果相反，也要保留这条反例。`,
      reflect: `可以用三句话记录：①我改变了什么；②我看到${profile.focus}怎样变化；③它是否支持“${profile.principle}”。尽量写具体读数或方向，不只写“变了”。`
    };

    const followUps: Record<HarnessDialogueIntent, string[]> = {
      orientation: ["下一步应该观察什么？", "怎样设计一组公平的对比？"],
      method: ["为什么要一次只改变一个量？", "我应该记录哪些数据？"],
      explain: ["怎样用第二组实验验证？", "这个结论有什么适用条件？"],
      compare: ["哪一个量应该保持不变？", "怎样记录两组结果？"],
      predict: ["怎样把猜想变成可检验的句子？", "如果结果相反怎么办？"],
      reflect: ["帮我把观察变成证据", "怎样寻找一个反例？"]
    };

    return { intent, text: replies[intent], followUps: followUps[intent] };
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
