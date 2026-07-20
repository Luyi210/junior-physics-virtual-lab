import type { HarnessArea, HarnessInsight, HarnessRule, HarnessRuleContext, HarnessSession, LearningAssistant, HarnessEvent } from "./types";

const areaOrientation: Record<HarnessArea, { title: string; message: string }> = {
  optics: { title: "先确认它对应哪条基础规律", message: "基础层包含色散、直线传播、反射和折射四个实验；进入应用模块后，先找到它连接的基础规律，再一次只改变一个条件追踪光路。" },
  lens: { title: "先选择一个想追踪的变化", message: "可以只改变物距、焦距或镜片组合中的一个量，观察像的位置、大小和清晰程度怎样响应。" },
  sound: { title: "把声音拆成两个变量", message: "先保持振幅不变，只改变频率；再反过来比较。这样更容易分清音调和响度。" },
  mechanics: { title: "平衡不只有一种答案", message: "你可以改变力，也可以改变力臂。试着寻找两组完全不同、但都能让杠杆平衡的组合。" },
  circuit: { title: "先追踪电流的完整路径", message: "闭合开关后观察运动粒子，再切换串联与并联，比较总电流和各支路发生了什么。" },
  thermal: { title: "把曲线当成实验现象", message: "启动加热后，不只看温度计，也观察温度—时间图像在接近沸点时怎样变化。" },
  measurement: { title: "质量和体积要分别取得证据", message: "先读取天平质量，再用排水法测体积，最后检查密度是否与材料身份相符。" }
};

export const defaultHarnessRules: HarnessRule[] = [
  {
    id: "orientation-on-entry",
    priority: 100,
    when: ({ event, hasInsight }) => event.type === "module.entered" && !hasInsight("orientation-on-entry"),
    create: ({ session }) => ({ kind: "orientation", ...areaOrientation[session.area] })
  },
  {
    id: "change-one-variable",
    priority: 80,
    when: ({ event, eventCount, hasInsight }) => event.type === "control.changed" && eventCount("control.changed") >= 3 && !hasInsight("change-one-variable"),
    create: () => ({ kind: "method", title: "试试控制变量", message: "你已经调整了几个参数。下一轮可以只改变一个量，其余保持不变，这样更容易判断是谁造成了变化。" })
  },
  {
    id: "capture-observation",
    priority: 70,
    when: ({ event, eventCount, session, hasInsight }) => event.type === "control.changed" && eventCount("control.changed") >= 5 && session.observations.length === 0 && !hasInsight("capture-observation"),
    create: () => ({ kind: "question", title: "现在值得停下来记一笔", message: "刚才哪一次变化最明显？用自己的话记录现象，不需要先判断解释是否正确。" })
  },
  {
    id: "compare-after-observation",
    priority: 90,
    when: ({ event, hasInsight }) => event.type === "observation.created" && !hasInsight("compare-after-observation"),
    create: () => ({ kind: "connection", title: "让这条发现变成证据", message: "能否设计一组不同条件，让现象再次出现？重复或反例都能帮助你判断这是不是稳定规律。" })
  },
  {
    id: "predict-before-run",
    priority: 60,
    when: ({ event, eventCount, hasInsight }) => event.type === "simulation.toggled" && event.payload.running === true && eventCount("simulation.toggled") === 1 && !hasInsight("predict-before-run"),
    create: () => ({ kind: "question", title: "运行之前，你的预测是什么？", message: "先在心里选一个最可能发生的变化，再用动画和读数检验它。预测错误也会产生有价值的发现。" })
  },
  {
    id: "three-dimensional-view-is-not-a-new-law",
    areas: ["optics"],
    priority: 85,
    when: ({ event, hasInsight }) => event.type === "scene.navigated" && (event.payload.experiment === "reflection" || event.payload.experiment === "refraction") && !hasInsight("three-dimensional-view-is-not-a-new-law"),
    create: () => ({ kind: "connection", title: "旋转的是观察位置，不是物理规律", message: "三维视角能帮助你看清镜面、分界面和测量平面。无论从哪里观察，入射角、反射角和折射角仍要在光线与法线所在的平面内测量。" })
  },
  {
    id: "compare-spatial-view-presets",
    areas: ["optics"],
    priority: 75,
    when: ({ event, session, hasInsight }) => event.type === "view.changed" && new Set(session.events.filter((item) => item.type === "view.changed" && item.payload.experiment === event.payload.experiment).map((item) => item.payload.view)).size >= 2 && !hasInsight("compare-spatial-view-presets"),
    create: () => ({ kind: "method", title: "用两个视角验证同一个结论", message: "先用空间视角认清装置，再切到正视光路读取角度，最后用俯视图确认光线是否都在同一个测量平面内。" })
  },
  {
    id: "black-hole-extends-straight-light",
    areas: ["optics"],
    priority: 92,
    when: ({ event, hasInsight }) => (event.type === "control.changed" || event.type === "configuration.changed") && event.payload.experiment === "black-hole" && !hasInsight("black-hole-extends-straight-light"),
    create: () => ({ kind: "connection", title: "这不是否定光的直线传播", message: "初中实验把时空近似看成平直；黑洞附近时空强烈弯曲。请保持质量不变，只改变光线离中心的距离，比较逃逸、绕行与被捕获。" })
  }
];

function insightId(ruleId: string, event: HarnessEvent): string {
  return `insight-${ruleId}-${event.id}`;
}

export class RuleBasedLearningAssistant implements LearningAssistant {
  readonly provider = "rules" as const;

  constructor(private readonly rules: HarnessRule[] = defaultHarnessRules) {}

  respond(session: HarnessSession, event: HarnessEvent): HarnessInsight[] {
    const context: HarnessRuleContext = {
      session,
      event,
      eventCount: (type) => session.events.filter((item) => item.type === type).length,
      hasInsight: (ruleId) => session.insights.some((item) => item.ruleId === ruleId)
    };

    return this.rules
      .filter((rule) => (!rule.areas || rule.areas.includes(session.area)) && rule.when(context))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 2)
      .map((rule) => ({
        id: insightId(rule.id, event),
        ruleId: rule.id,
        ...rule.create(context),
        createdAt: event.occurredAt,
        relatedEventId: event.id,
        read: false
      }));
  }
}
