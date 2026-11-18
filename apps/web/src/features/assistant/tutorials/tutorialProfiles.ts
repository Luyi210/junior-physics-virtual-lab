import { type TutorialTarget, type TutorialCommand, type ExperimentSnapshot } from "../tutorialBridge";
import { type GuidedTutorialTarget, type GuidedTutorialProfile } from "../opticsTutorials";
import { type HarnessEventType, type HarnessTutorialAction, type HarnessArea, getHarnessModuleGuide } from "@physics-lab/harness";

type TutorialRequirement = "white-source-on" | "prism-rotated" | "screen-moved";

export interface TutorialStep {
  id: string;
  eyebrow: string;
  title: string;
  narration: string;
  hint: string;
  target: TutorialTarget | GuidedTutorialTarget;
  state?: Extract<TutorialCommand, { type: "widget_setState" }>["state"];
  requirement?: TutorialRequirement;
  requiresInteraction?: boolean;
  acceptedEvents?: HarnessEventType[];
  question?: { prompt: string; choices: string[]; answerIndex: number; explanation: string };
  actions?: HarnessTutorialAction[];
}

export const dispersionTutorialSteps: TutorialStep[] = [
  {
    id: "meet-lab",
    eyebrow: "镜头 01 · 认识装置",
    title: "先别急着看答案，我们从一束没有开启的光开始。",
    narration: "你好，我是橘猫实验员光光。这里有光源、狭缝、三棱镜和光屏。我已经把装置恢复到初始状态，接下来由你亲手让现象发生。",
    hint: "留意光从左向右依次经过哪些装置。",
    target: "experiment",
    state: { prismAngle: 0, screenDistance: 250, slitWidth: 3, lightMode: "white", sourceOn: false }
  },
  {
    id: "turn-on-white",
    eyebrow: "镜头 02 · 让现象发生",
    title: "请确认选择“白光”，再亲手打开光源。",
    narration: "现在轮到你操作。选择白光，然后点击打开光源。成功后，沿着光线一直看到最右边的光屏。",
    hint: "教程会等待你的操作，不会替你直接呈现结果。",
    target: "source",
    requirement: "white-source-on"
  },
  {
    id: "find-spectrum",
    eyebrow: "镜头 03 · 寻找证据",
    title: "光屏上的彩色光带，是判断色散发生的证据。",
    narration: "白光进入三棱镜后，不同颜色偏折程度不同。红光偏折较小，紫光偏折较大，所以它们在光屏上的落点逐渐分开。",
    hint: "不要只看三棱镜附近，要追踪每束光最终落在哪里。",
    target: "screen"
  },
  {
    id: "rotate-prism",
    eyebrow: "镜头 04 · 改变一个条件",
    title: "拖动“三棱镜转角”，把转角调到 8° 以上或 −8° 以下。",
    narration: "请你旋转三棱镜，观察整组色带怎样上下移动。我们只改变棱镜转角，其他条件先保持不变。",
    hint: "达到要求后，我会告诉你可以继续比较。",
    target: "prism",
    requirement: "prism-rotated"
  },
  {
    id: "move-screen",
    eyebrow: "镜头 05 · 拉开距离",
    title: "把“棱镜到光屏距离”调到 320 mm 或更远。",
    narration: "现在移动光屏。距离增大时，不同颜色光到达光屏前有了更长的传播路程，色带会更容易分开。",
    hint: "比较色带宽度，而不只是亮暗变化。",
    target: "screen-distance",
    requirement: "screen-moved"
  },
  {
    id: "red-light",
    eyebrow: "镜头 06 · 单色光对照",
    title: "换成红色单色光，光屏上还会出现七种颜色吗？",
    narration: "我先把光源切换成红光。你会看到它仍然发生折射，但光屏上只留下一条红色光带，三棱镜没有制造出新的颜色。",
    hint: "自动演示只改变光源，棱镜和光屏位置保持不变。",
    target: "light-picker",
    state: { lightMode: "red", sourceOn: true },
    question: { prompt: "预测一下：红色单色光通过三棱镜后，光屏上会出现什么？", choices: ["连续七色光谱", "一条红色光带", "重新变成白光"], answerIndex: 1, explanation: "对！红光会改变传播方向，但不会产生新的颜色。" }
  },
  {
    id: "blue-light",
    eyebrow: "镜头 07 · 比较偏折",
    title: "再换成蓝光，比较它和红光的落点。",
    narration: "蓝光的偏折比红光更明显。正是因为各种颜色偏折程度不同，白光经过三棱镜后才会展开。",
    hint: "这一步比较的是位置，不是颜色谁更亮。",
    target: "screen",
    state: { lightMode: "blue", sourceOn: true }
  },
  {
    id: "rgb-light",
    eyebrow: "镜头 08 · 混合光验证",
    title: "RGB 混合光通过三棱镜，会重新分成三条色光。",
    narration: "我把红、绿、蓝混合光送进三棱镜。光屏上的三条色光说明：复色光中原本包含的成分光，被三棱镜重新分开了。",
    hint: "三条光带与白光的连续光谱并不相同。",
    target: "result",
    state: { lightMode: "rgb", sourceOn: true },
    question: { prompt: "RGB 混合光中原本包含三种主要色光，光屏结果应该是？", choices: ["一条白色光带", "连续七色光谱", "红、绿、蓝三条光带"], answerIndex: 2, explanation: "正确。三棱镜把混合光中已有的红、绿、蓝重新分开。" }
  },
  {
    id: "conclusion",
    eyebrow: "镜头 09 · 用证据作结",
    title: "三棱镜分开的是已有色光，而不是凭空创造颜色。",
    narration: "实验完成。白光形成连续光谱，混合光分开成对应成分，单色光只偏折。现在你可以退出教程，继续自由改变角度、距离和狭缝宽度。",
    hint: "自由探索仍然保留；教程只是另一种进入实验的方式。",
    target: "result",
    state: { lightMode: "white", sourceOn: true, prismAngle: 0, screenDistance: 320, slitWidth: 3 }
  }
];

export function requirementMet(requirement: TutorialRequirement | undefined, snapshot: ExperimentSnapshot | undefined) {
  if (!requirement || !snapshot || snapshot.module !== "dispersion") return !requirement;
  if (snapshot.origin !== "learner") return false;
  const state = snapshot.state;
  if (requirement === "white-source-on") return state.lightMode === "white" && state.sourceOn;
  if (requirement === "prism-rotated") return Math.abs(state.prismAngle) >= 8;
  return state.screenDistance >= 320;
}

export function createScienceTutorialProfile(area: HarnessArea, module: string): GuidedTutorialProfile {
  const guide = getHarnessModuleGuide(module, area);
  return {
    title: `跟着光光，探究${guide.title}`,
    summary: `这不是播放完就结束的视频。光光会把“${guide.title}”拆成研究问题、真实操作、证据读取和生活联系，并在关键步骤等待你的操作。`,
    duration: "约 3 分钟",
    highlights: ["6 个探究镜头", "1 次真实操作检测", "操作轨迹自动进入记录本"],
    steps: [
      { id: `${module}-question`, eyebrow: "镜头 01 · 明确问题", title: `先确定我们要在“${guide.title}”中寻找什么。`, narration: `你好，我是橘猫实验员光光。本轮重点观察${guide.focus}。先看清装置和读数区域，不急着记结论。`, hint: "先辨认自变量、因变量和需要保持不变的条件。", target: "module" },
      { id: `${module}-operate`, eyebrow: "镜头 02 · 亲手操作", title: guide.action, narration: `${guide.action}。本步骤不会替你移动滑块或启动装置，请亲自完成一次有效操作。`, hint: "在高亮区域改变一个条件；教程检测到真实操作后才继续。", target: "controls", requiresInteraction: true, acceptedEvents: ["control.changed", "configuration.changed", "simulation.toggled"] },
      { id: `${module}-observe`, eyebrow: "镜头 03 · 读取现象", title: "把画面变化转成可以记录的证据。", narration: `重点读取${guide.focus}。区分“我看见或测到什么”和“我认为为什么”，先写事实，再作解释。`, hint: "观察方向、读数、状态或曲线，尽量说出具体变化。", target: "visual" },
      { id: `${module}-compare`, eyebrow: "镜头 04 · 公平比较", title: "用第二组条件检验刚才的发现。", narration: `${guide.compare}。两组实验只有一个主要条件不同，比较才有说服力。`, hint: "保留一组基准，再只改变一个自变量。", target: "controls" },
      { id: `${module}-explain`, eyebrow: "镜头 05 · 形成解释", title: "让证据与物理规律连接起来。", narration: `当前实验联系的规律是：${guide.principle}。请检查刚才的现象是否真的支持它，也要留意模型的适用条件。`, hint: "用“改变了……，观察到……，因此……”组织结论。", target: "explanation" },
      { id: `${module}-transfer`, eyebrow: "镜头 06 · 迁移应用", title: "离开实验台，在生活和科技中重新寻找这个规律。", narration: `现在阅读页面下方的生活应用，分别指出研究对象、发生的物理过程以及可观察证据。教程结束后，实验仍保持开放。`, hint: "不要只记应用名称，要说清楚它利用了哪条规律。", target: "application" }
    ]
  };
}
