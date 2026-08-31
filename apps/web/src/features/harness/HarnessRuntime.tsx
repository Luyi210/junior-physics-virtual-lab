import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, ArrowRight, BookMarked, BrainCircuit, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Crosshair, GraduationCap, Lightbulb, Maximize2, MessageCircle, MousePointerClick, MoveHorizontal, Network, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Save, ScanSearch, SendHorizontal, ShieldCheck, Sparkles, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { analyzeHarnessDraft, createHarnessExperimentSummary, diagnoseHarnessExperiment, getHarnessAdaptiveQuestions, getHarnessCoachAlert, getHarnessConceptMemory, getHarnessConceptNode, getHarnessKnowledgeMastery, getHarnessLearnerModel, getHarnessLearningBranch, getHarnessModuleGuide, getHarnessQuickQuestions, getHarnessReviewSchedule, getHarnessTutorialAction, getRecommendedHarnessHintLevel } from "@physics-lab/harness";
import type { HarnessArea, HarnessEventType, HarnessTutorialAction } from "@physics-lab/harness";
import { useHarnessStore } from "./harnessStore";
import { OrangeCatAvatar, shuffleOrangeCatAvatar, useOrangeCatAvatarLabel } from "./OrangeCatAvatar";
import {
  dispatchTutorialCommand,
  getApparatusContext,
  getLatestExperimentSnapshot,
  subscribeExperimentSnapshots
} from "./tutorialBridge";
import type { ExperimentSnapshot, TutorialCommand, TutorialTarget } from "./tutorialBridge";
import { guidedOpticsTutorials } from "./opticsTutorials";
import type { GuidedTutorialProfile, GuidedTutorialTarget } from "./opticsTutorials";
import type { StudentTaskLessonContext } from "@physics-lab/contracts";
import { studentApi } from "../../services/teacherApi";
import { activeStudentSession } from "../../services/studentSessionSync";

const eventNames: Record<HarnessEventType, string> = {
  "module.entered": "进入实验情境",
  "control.changed": "调整实验参数",
  "simulation.toggled": "改变动态状态",
  "configuration.changed": "切换实验配置",
  "scene.navigated": "旋转或缩放三维场景",
  "view.changed": "切换三维观察视角",
  "observation.created": "保存一条观察",
  "insight.read": "查看方法提示",
  "dialogue.asked": "向探究伙伴提问"
};

const areaNames: Record<HarnessArea, string> = {
  optics: "光现象",
  lens: "透镜",
  sound: "声现象",
  mechanics: "运动与力",
  circuit: "电与磁",
  thermal: "热与物态",
  measurement: "质量与密度"
};

type PanelView = "dialogue" | "tutorial" | "review";
type TutorialRequirement = "white-source-on" | "prism-rotated" | "screen-moved";

interface TutorialStep {
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

const dispersionTutorialSteps: TutorialStep[] = [
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

function requirementMet(requirement: TutorialRequirement | undefined, snapshot: ExperimentSnapshot | undefined) {
  if (!requirement || !snapshot || snapshot.module !== "dispersion") return !requirement;
  if (snapshot.origin !== "learner") return false;
  const state = snapshot.state;
  if (requirement === "white-source-on") return state.lightMode === "white" && state.sourceOn;
  if (requirement === "prism-rotated") return Math.abs(state.prismAngle) >= 8;
  return state.screenDistance >= 320;
}

function createScienceTutorialProfile(area: HarnessArea, module: string): GuidedTutorialProfile {
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

function selectTeacherChineseVoice(voices: SpeechSynthesisVoice[]) {
  const chineseVoices = voices.filter((voice) => /^zh([_-]|$)/i.test(voice.lang));
  const candidates = chineseVoices.length ? chineseVoices : voices;
  const preferredNames: Array<[RegExp, number]> = [
    [/Xiaoxiao|晓晓|小晓/i, 190],
    [/Ting[- ]?Ting|Tingting|Mei[- ]?Jia|Meijia|Sin[- ]?Ji|Sinji|Yaoyao|Huihui/i, 170],
    [/Google.*(?:普通话|Mandarin|Chinese)|普通话|Mandarin/i, 155],
    [/Xiaoyi|Xiaohan|Xiaomeng|Xiaorui|小艺|晓涵|晓梦|晓睿/i, 145],
    [/Yunxi|Yunjian|Yunyang|Kangkang|云希|云健|云扬/i, 105]
  ];
  const noveltyVoices = /Grandpa|Grandma|Rocko|Eddy|Flo|Sandy|Shelley|Whisper|Wobble|Bahh|Bells|Bubbles/i;
  return [...candidates].sort((left, right) => {
    const score = (voice: SpeechSynthesisVoice) => {
      const nameScore = preferredNames.reduce((best, [pattern, value]) => pattern.test(voice.name) ? Math.max(best, value) : best, 0);
      const languageScore = /^zh[-_]CN$/i.test(voice.lang) ? 30 : /^zh/i.test(voice.lang) ? 20 : 0;
      const naturalScore = /Natural|Neural|自然/i.test(voice.name) ? 28 : 0;
      return nameScore + languageScore + naturalScore + (voice.localService ? 4 : 0) - (noveltyVoices.test(voice.name) ? 120 : 0);
    };
    return score(right) - score(left);
  })[0];
}

interface SpotlightRect { top: number; left: number; width: number; height: number }

type SpotlightTarget = TutorialTarget | GuidedTutorialTarget;

const genericSpotlightSelectors: Record<GuidedTutorialTarget, string[]> = {
  module: [".explore-module-content .open-module-intro", ".explore-module-content .open-experience"],
  visual: [
    ".explore-module-content .concept-sim",
    ".explore-module-content .sound-sim",
    ".explore-module-content .lever-sim",
    ".explore-module-content .circuit-sim",
    ".explore-module-content .thermal-sim",
    ".explore-module-content .density-sim",
    ".explore-module-content .balance-lab-sim",
    ".explore-module-content .ray-law-lab",
    ".explore-module-content .camera-lab",
    ".explore-module-content .eye-lab",
    ".explore-module-content .color-mix-lab",
    ".explore-module-content .correction-lab",
    ".explore-module-content .instrument-lab",
    ".explore-module-content .celestial-axis",
    ".explore-module-content .experience-canvas"
  ],
  controls: [
    ".explore-module-content .science-controls",
    ".explore-module-content .balance-operation-dock",
    ".explore-module-content .open-control-deck",
    ".explore-module-content .rgb-controls",
    ".explore-module-content .medium-tabs",
    ".explore-module-content .correction-lens-deck",
    ".explore-module-content .instrument-switch"
  ],
  explanation: [".explore-module-content .science-module-guide", ".explore-module-content .dispersion-guide", ".explore-module-content .physics-law-plate", ".explore-module-content .open-module-intro"],
  application: [
    ".explore-module-content .science-life-application",
    ".explore-module-content .rainbow-life-section",
    ".explore-module-content .micro-display-workbench",
    ".explore-module-content .mirror-life-workbench",
    ".explore-module-content .invisible-application-picker",
    ".explore-module-content .open-experience > section:last-of-type"
  ]
};

function TutorialSpotlight({ target, label }: { target: SpotlightTarget; label: string }) {
  const [rect, setRect] = useState<SpotlightRect>();

  useEffect(() => {
    setRect(undefined);
    let alignedToTarget = false;
    let frame = 0;
    const update = () => {
      const preferred = [...document.querySelectorAll(`[data-tutorial-spotlight="${target}"]`)];
      const fallback = [...document.querySelectorAll(`[data-tutorial-target="${target}"]`)];
      const generic = target in genericSpotlightSelectors
        ? genericSpotlightSelectors[target as GuidedTutorialTarget]
          .map((selector) => document.querySelector(selector))
          .filter((node): node is Element => Boolean(node))
        : [];
      const candidates = preferred.length ? preferred : fallback.length ? fallback : generic;
      const visibleCandidates = candidates.filter((node) => {
        const item = node.getBoundingClientRect();
        return item.width > 0 && item.height > 0 && item.bottom > 0 && item.top < window.innerHeight;
      });
      if (candidates[0] && !alignedToTarget) {
        alignedToTarget = true;
        candidates[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const selected = target in genericSpotlightSelectors && visibleCandidates.length ? [visibleCandidates[0]] : visibleCandidates;
      const bounds = selected
        .map((node) => node.getBoundingClientRect())
        .filter((item) => item.width > 0 && item.height > 0 && item.bottom > 0 && item.top < window.innerHeight);
      if (!bounds.length) return;
      const padding = target === "experiment" ? 8 : 13;
      const left = Math.max(7, Math.min(...bounds.map((item) => item.left)) - padding);
      const top = Math.max(7, Math.min(...bounds.map((item) => item.top)) - padding);
      const right = Math.min(window.innerWidth - 7, Math.max(...bounds.map((item) => item.right)) + padding);
      const bottom = Math.min(window.innerHeight - 7, Math.max(...bounds.map((item) => item.bottom)) + padding);
      const next = { top, left, width: right - left, height: bottom - top };
      setRect((current) => current && Math.abs(current.top - next.top) < .5 && Math.abs(current.left - next.left) < .5 && Math.abs(current.width - next.width) < .5 && Math.abs(current.height - next.height) < .5 ? current : next);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    const interval = window.setInterval(scheduleUpdate, 400);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [label, target]);

  if (!rect) return null;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return createPortal(<div className="tutorial-spotlight" aria-hidden="true">
    <i className="tutorial-spotlight-shade shade-top" style={{ top: 0, left: 0, width: viewportWidth, height: rect.top }} />
    <i className="tutorial-spotlight-shade shade-left" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
    <i className="tutorial-spotlight-shade shade-right" style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, viewportWidth - rect.left - rect.width), height: rect.height }} />
    <i className="tutorial-spotlight-shade shade-bottom" style={{ top: rect.top + rect.height, left: 0, width: viewportWidth, height: Math.max(0, viewportHeight - rect.top - rect.height) }} />
    <i className="tutorial-spotlight-frame" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
    <span className="tutorial-spotlight-label" style={{ top: Math.max(8, rect.top - 34), left: Math.min(rect.left + 5, viewportWidth - 190) }}><Sparkles size={13} />光光正在讲这里 · {label.split("·")[0]}</span>
  </div>, document.body);
}

function routeHarnessContext(pathname: string, search: string): { area: HarnessArea; module: string } | undefined {
  const params = new URLSearchParams(search);
  if (pathname === "/lab/lens") return { area: "lens", module: "bench" };
  if (pathname === "/student/explore/light") {
    return { area: "optics", module: params.get("mode") ?? "overview" };
  }
  const value = pathname.match(/^\/student\/explore\/(sound|mechanics|circuit|thermal|measurement)$/)?.[1];
  if (!value) return undefined;
  return { area: value as HarnessArea, module: params.get("module") ?? `${value}-overview` };
}

export function HarnessRuntime() {
  const location = useLocation();
  const context = useMemo(() => routeHarnessContext(location.pathname, location.search), [location.pathname, location.search]);
  const enterArea = useHarnessStore((state) => state.enterArea);
  const setPanelOpen = useHarnessStore((state) => state.setPanelOpen);

  useEffect(() => {
    if (context) void enterArea(context.area, context.module);
  }, [context, enterArea]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    setPanelOpen(false);
  }, [setPanelOpen]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("harness") === "dialogue") setPanelOpen(true);
  }, [location.search, setPanelOpen]);

  if (!context) return null;
  return <HarnessPanel />;
}

function HarnessPanel() {
  const activeArea = useHarnessStore((state) => state.activeArea);
  const activeModule = useHarnessStore((state) => state.activeModule);
  const loading = useHarnessStore((state) => state.loading);
  const panelOpen = useHarnessStore((state) => state.panelOpen);
  const session = useHarnessStore((state) => state.session);
  const unread = useHarnessStore((state) => state.session?.insights.filter((item) => !item.read).length ?? 0);
  const setPanelOpen = useHarnessStore((state) => state.setPanelOpen);
  const askQuestion = useHarnessStore((state) => state.askQuestion);
  const saveObservation = useHarnessStore((state) => state.saveObservation);
  const readInsight = useHarnessStore((state) => state.readInsight);
  const [panelView, setPanelView] = useState<PanelView>("dialogue");
  const [tutorialCompact, setTutorialCompact] = useState(false);
  const [tutorialMiniSide, setTutorialMiniSide] = useState<"left" | "right">("right");
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarySaved, setSummarySaved] = useState(false);
  const [coachTarget, setCoachTarget] = useState<SpotlightTarget>();
  const streamEndRef = useRef<HTMLDivElement>(null);
  const avatarLabel = useOrangeCatAvatarLabel();

  const analysis = useMemo(() => {
    if (!panelOpen || !session || !activeArea || !activeModule) return {
      latestInsight: undefined,
      recentEvents: [],
      dialogue: [],
      diagnosis: undefined,
      learnerModel: undefined,
      knowledgeMastery: undefined,
      reviewSchedule: undefined,
      experimentSummary: undefined,
      conceptNode: undefined,
      learningBranch: undefined,
      coachAlert: undefined,
      conceptMemory: undefined,
      recommendedHintLevel: 1 as const,
      quickQuestions: [],
      questionLibrary: []
    };
    return {
      latestInsight: session.insights.at(-1),
      recentEvents: session.events.slice(-5).reverse(),
      dialogue: (session.dialogue ?? []).filter((message) => message.module === activeModule).slice(-14),
      diagnosis: diagnoseHarnessExperiment(session, activeModule),
      learnerModel: getHarnessLearnerModel(session, activeModule),
      knowledgeMastery: getHarnessKnowledgeMastery(session, activeModule),
      reviewSchedule: getHarnessReviewSchedule(session, activeModule),
      experimentSummary: createHarnessExperimentSummary(session, activeModule),
      conceptNode: getHarnessConceptNode(activeModule),
      learningBranch: getHarnessLearningBranch(session, activeModule),
      coachAlert: getHarnessCoachAlert(session, activeModule, getApparatusContext(activeModule)),
      conceptMemory: getHarnessConceptMemory(session, activeModule),
      recommendedHintLevel: getRecommendedHarnessHintLevel(session, activeModule),
      quickQuestions: getHarnessAdaptiveQuestions(session, activeModule),
      questionLibrary: getHarnessQuickQuestions(activeModule, activeArea)
    };
  }, [activeArea, activeModule, panelOpen, session]);
  const latestInsight = analysis.latestInsight;
  const recentEvents = analysis.recentEvents ?? [];
  const dialogue = analysis.dialogue ?? [];
  const diagnosis = analysis.diagnosis;
  const learnerModel = analysis.learnerModel;
  const knowledgeMastery = analysis.knowledgeMastery;
  const reviewSchedule = analysis.reviewSchedule;
  const experimentSummary = analysis.experimentSummary;
  const conceptNode = analysis.conceptNode;
  const learningBranch = analysis.learningBranch;
  const coachAlert = analysis.coachAlert;
  const conceptMemory = analysis.conceptMemory;
  const recommendedHintLevel = analysis.recommendedHintLevel;
  const evidencedDimensions = learnerModel?.dimensions.filter((dimension) => dimension.score >= 50).length ?? 0;
  const quickQuestions = analysis.quickQuestions ?? [];
  const questionLibrary = analysis.questionLibrary ?? [];
  const lastFollowUps = [...dialogue].reverse().find((message) => message.role === "assistant")?.followUps;
  const suggestions = lastFollowUps?.length ? lastFollowUps : quickQuestions;
  const draftFeedback = activeArea && activeModule ? analyzeHarnessDraft(activeArea, activeModule, draft) : undefined;
  const dockCoachAlert = !panelOpen && session && activeModule ? getHarnessCoachAlert(session, activeModule, getApparatusContext(activeModule)) : undefined;

  useEffect(() => {
    if (!panelOpen) return;
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [dialogue.length, panelOpen, activeModule]);

  useEffect(() => {
    setSummaryOpen(false);
    setSummarySaved(false);
    setCoachTarget(undefined);
  }, [activeModule]);

  useEffect(() => {
    const openTutorial = () => {
      setTutorialCompact(false);
      setPanelView("tutorial");
      setPanelOpen(true);
    };
    window.addEventListener("physics-harness:open-tutorial", openTutorial);
    return () => window.removeEventListener("physics-harness:open-tutorial", openTutorial);
  }, [setPanelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      window.speechSynthesis?.cancel();
      setTutorialCompact(false);
      setPanelOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [panelOpen, setPanelOpen]);

  const send = (text = draft, preserveDraft = false) => {
    const question = text.trim();
    if (!question || !askQuestion(question)) return;
    if (!preserveDraft) setDraft("");
  };

  const askFromReview = (text: string) => {
    send(text);
    setPanelView("dialogue");
  };

  const save = () => {
    if (!saveObservation(draft)) return;
    setDraft("");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };

  const saveSummary = () => {
    if (!experimentSummary?.ready || experimentSummary.alreadySaved || !saveObservation(experimentSummary.recordText)) return;
    setSummarySaved(true);
    window.setTimeout(() => setSummarySaved(false), 1800);
  };

  return (
    <>
      <button className={`harness-dock-trigger harness-dialogue-trigger cat-dock-trigger dock-${dockCoachAlert?.severity ?? "idle"}`} onClick={() => setPanelOpen(true)} aria-label={`打开橘猫实验员${dockCoachAlert ? `：${dockCoachAlert.title}` : ""}`}>
        <OrangeCatAvatar mood={unread > 0 ? "listening" : "idle"} />
        <span><small>{dockCoachAlert?.severity === "warning" ? "光光发现一个卡点" : dockCoachAlert?.severity === "ready" ? "本轮可以继续挑战" : "光光正在观察实验"}</small><strong>{dockCoachAlert?.title ?? "打开智能实验教练"}</strong></span>
        {unread > 0 && <b>{unread}</b>}
      </button>

      {panelOpen && (
        <>{coachTarget && <TutorialSpotlight target={coachTarget} label="智能定位" />}
        <aside className={`harness-panel harness-dialogue-panel cat-partner-panel ${panelView === "tutorial" && tutorialCompact ? `tutorial-compact mini-side-${tutorialMiniSide}` : ""}`} role="dialog" aria-modal="true" aria-label="橘猫实验员交流与动态教程">
          <header>
            <div className="harness-panel-mark cat-panel-mark"><OrangeCatAvatar compact /></div>
            <div><span>INQUIRY HARNESS / 橘猫实验伙伴</span><strong>橘猫实验员 · 光光</strong><small>{avatarLabel} · 本次探究保持此形象</small></div>
            <div className="cat-panel-actions">
              <button className="cat-avatar-shuffle" onClick={shuffleOrangeCatAvatar} aria-label={`更换光光形象，当前为${avatarLabel}`} title="换一只光光"><RefreshCw size={15} /><span>换形象</span></button>
              <button onClick={() => { setTutorialCompact(false); setPanelOpen(false); }} aria-label="收起探究伙伴"><X size={17} /></button>
            </div>
          </header>

          <div className="harness-assurance harness-dialogue-assurance">
            <ShieldCheck size={16} />
            <span><strong>循证对话＋可操作动态教程</strong><small>依据当前装置和实验记录提供引导，不替你完成实验</small></span>
          </div>

          <nav className="cat-panel-tabs" aria-label="橘猫实验员功能">
            <button className={panelView === "dialogue" ? "active" : ""} onClick={() => { setTutorialCompact(false); setPanelView("dialogue"); }}><MessageCircle size={16} /><span>我有问题<small>提问与分级提示</small></span></button>
            <button className={panelView === "tutorial" ? "active" : ""} onClick={() => setPanelView("tutorial")}><GraduationCap size={17} /><span>带我做<small>边讲解边操作</small></span></button>
            <button className={panelView === "review" ? "active" : ""} onClick={() => { setTutorialCompact(false); setPanelView("review"); }}><BookMarked size={16} /><span>看看实验<small>证据与本次小结</small></span></button>
          </nav>

          {loading || !session || !activeArea || !activeModule ? (
            <div className="harness-loading"><span /><p>正在恢复本地探究记录…</p></div>
          ) : panelView !== "tutorial" ? (
            <div className={`harness-panel-body harness-dialogue-body panel-view-${panelView}`}>
              <section className="harness-dialogue-context">
                <div><span>当前讨论</span><strong>{areaNames[activeArea]} · {activeModule.replaceAll("-", " ")}</strong></div>
                <div className="harness-dialogue-metrics"><span><Activity size={13} />{diagnosis?.operationCount ?? 0} 次当前操作</span><span><BookMarked size={13} />{diagnosis?.observationCount ?? 0} 条当前发现</span></div>
              </section>

              {panelView === "review" && <section className="cat-review-intro"><BookMarked size={18} /><span><small>EXPERIMENT REVIEW / 本次实验分析</small><strong>只根据真实操作和你亲自保存的观察进行分析</strong><p>这不是分数，也不会自动补写学生没有观察到的实验结果。</p></span></section>}

              {panelView === "review" && diagnosis && <section className={`harness-inquiry-state stage-${diagnosis.stage}`} aria-label="光光的实验状态诊断">
                <header><span><Sparkles size={14} />光光的现场判断</span><strong>{diagnosis.stageLabel}</strong></header>
                <div className="harness-inquiry-progress" aria-label={`探究进度 ${diagnosis.progress} / 4`}>{[1, 2, 3, 4].map((step) => <i className={step <= diagnosis.progress ? "active" : ""} key={step} />)}<small>{diagnosis.progress} / 4</small></div>
                <p>{diagnosis.summary}</p>
                <aside><ArrowRight size={14} /><span><small>建议下一步</small><strong>{diagnosis.nextMove}</strong></span></aside>
              </section>}

              {panelView === "review" && learnerModel && <details className={`harness-learner-model level-${learnerModel.level}`}>
                <summary><span><GraduationCap size={15} /><small>光光的学习画像 · 不是成绩</small><strong>{learnerModel.levelLabel}</strong></span><b>{evidencedDimensions}<small>/4 项已有证据</small></b><ChevronDown size={14} /></summary>
                <div className="harness-mastery-grid">{learnerModel.dimensions.map((dimension) => { const status = dimension.score >= 70 ? "证据较充分" : dimension.score > 0 ? "正在形成" : "等待观察"; return <article key={dimension.id}><header><span>{dimension.label}</span><b>{status}</b></header><i><b style={{ width: `${dimension.score}%` }} /></i><p>{dimension.note}</p></article>; })}</div>
                <footer><p><Sparkles size={13} />这些状态只来自当前实验的操作和记录，不评价学生能力。{learnerModel.strength}；{learnerModel.memoryLine}。</p><aside><strong>下一项小挑战</strong><span>{learnerModel.nextChallenge}</span><button type="button" onClick={(event) => { event.preventDefault(); askFromReview("根据我的记录给我一个小挑战"); }}>让光光出题 <ArrowRight size={13} /></button></aside></footer>
              </details>}

              {panelView === "review" && knowledgeMastery && <section className={`harness-long-memory band-${knowledgeMastery.band}`} aria-label="光光的长期掌握证据">
                <header><span><BrainCircuit size={15} /><small>LONG-TERM MEMORY / 跨多次实验记忆</small><strong>{knowledgeMastery.bandLabel}</strong></span><b>{knowledgeMastery.evidenceCount}<small>/5 类掌握证据</small></b></header>
                <div className="harness-long-memory-meter"><i><b style={{ width: `${knowledgeMastery.score}%` }} /></i><small>证据覆盖 {knowledgeMastery.score}% · 可信度 {Math.round(knowledgeMastery.confidence * 100)}%</small></div>
                <div className="harness-long-memory-signals"><span><b>{knowledgeMastery.visits}</b>次进入</span><span><b>{knowledgeMastery.operations}</b>次操作</span><span><b>{knowledgeMastery.comparisons}</b>项对照</span><span><b>{knowledgeMastery.observations}</b>条记录</span><span><b>{knowledgeMastery.reasoningTurns}</b>次解释</span></div>
                <p><ShieldCheck size={13} /><span><strong>当前证据：</strong>{knowledgeMastery.strength}。<strong>复习建议：</strong>{knowledgeMastery.nextReview}。</span></p>
                {reviewSchedule && <div className={`harness-review-schedule status-${reviewSchedule.status}`}><RotateCcw size={14} /><span><small>主动回忆计划</small><strong>{reviewSchedule.label}</strong><p>{reviewSchedule.reason}</p></span>{reviewSchedule.status !== "not-ready" && <button type="button" onClick={() => askFromReview(reviewSchedule.prompt)}>{reviewSchedule.status === "due" ? "现在回忆" : "提前练习"}<ArrowRight size={12} /></button>}</div>}
                {knowledgeMastery.misconception && <aside className={knowledgeMastery.misconception.count >= 2 ? "repeated" : ""}><Lightbulb size={14} /><span><small>概念核验记忆 · 出现 {knowledgeMastery.misconception.count} 次</small><strong>{knowledgeMastery.misconception.claim}</strong></span><button type="button" onClick={() => askFromReview(knowledgeMastery.misconception!.probe)}>用反例再验证 <ArrowRight size={13} /></button></aside>}
                <footer>这不是成绩或能力预测；它只汇总本机保存的操作、记录和对话证据。</footer>
              </section>}

              {panelView === "dialogue" && learningBranch && <section className={`harness-learning-branch branch-${learningBranch.id}`} aria-label="光光的可选探究支线">
                <div className="harness-learning-branch-mark"><span /><span /><span /></div>
                <div><small>{learningBranch.eyebrow}</small><strong>{learningBranch.title}</strong><p>{learningBranch.reason}</p></div>
                <button type="button" onClick={() => send(learningBranch.prompt)}>跟光光试试看 <ArrowRight size={13} /></button>
              </section>}

              {panelView === "dialogue" && coachAlert && <section className={`harness-smart-coach severity-${coachAlert.severity}`} aria-live="polite">
                <header><span><BrainCircuit size={15} />{coachAlert.eyebrow}</span><b>{coachAlert.severity === "warning" ? "需修正" : coachAlert.severity === "ready" ? "可挑战" : "建议"}</b></header>
                <strong>{coachAlert.title}</strong><p>{coachAlert.message}</p>
                <small><ScanSearch size={12} />{coachAlert.evidence}</small>
                <footer><button type="button" onClick={() => send(coachAlert.prompt)}>{coachAlert.actionLabel}<ArrowRight size={13} /></button><button type="button" onClick={() => setCoachTarget((current) => current ? undefined : coachAlert.target)}><Crosshair size={13} />{coachTarget ? "取消定位" : "在实验中定位"}</button></footer>
              </section>}

              {panelView === "dialogue" && conceptMemory && <div className="harness-memory-line"><BrainCircuit size={13} /><span><small>本地学习记忆</small>{conceptMemory.line}</span></div>}

              {panelView === "review" && conceptNode && <details className="harness-concept-map">
                <summary>
                  <Network size={15} />
                  <span><small>来自课本关系与实验证据</small><strong>{conceptNode.title}</strong></span>
                  <b>{conceptNode.evidenceCriteria.length}<small>条证据标准</small></b>
                  <ChevronDown size={14} />
                </summary>
                <div className="harness-concept-map-body">
                  <header><small>本轮探究问题</small><strong>{conceptNode.inquiryQuestion}</strong></header>
                  <section><span>前置概念</span><div>{conceptNode.prerequisites.map((item) => <b key={item}>{item}</b>)}</div></section>
                  <section><span>证据检查</span><ol>{conceptNode.evidenceCriteria.map((criterion) => <li key={criterion}><i />{criterion}</li>)}</ol></section>
                  {conceptNode.misconceptions[0] && <aside>
                    <span><Lightbulb size={13} />常见混淆</span>
                    <p>{conceptNode.misconceptions[0].claim}</p>
                    <button type="button" onClick={(event) => { event.preventDefault(); askFromReview(`这个说法对吗：${conceptNode.misconceptions[0]!.claim}`); }}>让光光带我验证 <ArrowRight size={13} /></button>
                  </aside>}
                  <footer><small>可以继续自由探索，不要求按图谱顺序完成。</small><div>{conceptNode.connections.map((item) => <span key={item}>{item}</span>)}</div></footer>
                </div>
              </details>}

              {panelView === "dialogue" && <section className="harness-hint-ladder" aria-label="光光三级提示">
                <header><span><Lightbulb size={14} />卡住了吗？按需要逐级打开提示</span><small>光光推荐第 {recommendedHintLevel} 级 · 提示逐渐具体但不直接显示答案</small></header>
                <div><button className={recommendedHintLevel === 1 ? "recommended" : ""} type="button" onClick={() => send("给我一级提示")}><b>01</b><span><strong>观察方向</strong><small>先看什么</small></span></button><button className={recommendedHintLevel === 2 ? "recommended" : ""} type="button" onClick={() => send("给我二级提示")}><b>02</b><span><strong>操作脚手架</strong><small>怎样比较</small></span></button><button className={recommendedHintLevel === 3 ? "recommended" : ""} type="button" onClick={() => send("给我三级提示")}><b>03</b><span><strong>证据句式</strong><small>如何表达</small></span></button></div>
              </section>}

              {panelView === "review" && experimentSummary && <section className={`harness-session-summary ${summaryOpen ? "open" : ""}`} aria-label="本次探究小结">
                <header>
                  <button type="button" onClick={() => setSummaryOpen((open) => !open)} aria-expanded={summaryOpen}>
                    <BookMarked size={16} />
                    <span><small>光光只整理真实操作与观察</small><strong>本次探究小结</strong></span>
                    <b>{experimentSummary.changedConditions.length}<small>项条件</small></b>
                    <b>{experimentSummary.evidence.length}<small>条证据</small></b>
                    <ChevronDown size={14} />
                  </button>
                </header>
                {summaryOpen && <div className="harness-session-summary-sheet">
                  <dl>
                    <div><dt>研究问题</dt><dd>{experimentSummary.question}</dd></div>
                    <div><dt>改变条件</dt><dd>{experimentSummary.changedConditions.length ? experimentSummary.changedConditions.join("；") : "尚未记录有效的条件变化"}</dd></div>
                    <div className={experimentSummary.evidence.length ? "has-evidence" : "missing-evidence"}><dt>观察证据</dt><dd>{experimentSummary.evidence.length ? experimentSummary.evidence.join("；") : "学生尚未保存观察证据，光光不会替你补写。"}</dd></div>
                    <div><dt>暂时解释</dt><dd>{experimentSummary.interpretation}</dd></div>
                    <div><dt>还需补充</dt><dd>{experimentSummary.missingEvidence}</dd></div>
                  </dl>
                  <footer>
                    <small><ShieldCheck size={12} />依据当前实验会话自动整理，可继续修改和补充。</small>
                    <button type="button" onClick={saveSummary} disabled={!experimentSummary.ready || experimentSummary.alreadySaved || summarySaved}>
                      {experimentSummary.alreadySaved || summarySaved ? <CircleCheck size={14} /> : <Save size={14} />}
                      {experimentSummary.alreadySaved || summarySaved ? "已存入记录" : experimentSummary.ready ? "存入实验记录" : "操作后可保存"}
                    </button>
                  </footer>
                </div>}
              </section>}

              {panelView === "review" && <Link className="harness-notebook-link" to="/student/notebook" onClick={() => setPanelOpen(false)}><BookMarked size={18} /><span><small>实验结束后</small><strong>把本次操作和发现整理进实验记录本</strong></span><ArrowRight size={15} /></Link>}

              {panelView === "dialogue" && <section className="harness-chat" aria-live="polite">
                <div className="harness-chat-stream">
                  {dialogue.length === 0 && (
                    <article className="harness-message assistant welcome">
                      <i><OrangeCatAvatar compact /></i>
                      <div><small>橘猫实验员 · 光光</small><p>喵，我已经连接到当前实验。你可以问我下一步观察什么、为什么出现这个现象；也可以切换到“带我做”或“看看实验”。</p><em>回答来自本地物理规则，不是大语言模型。</em></div>
                    </article>
                  )}
                  {dialogue.map((message) => (
                    <article className={`harness-message ${message.role}`} key={message.id}>
                      <i>{message.role === "assistant" ? <OrangeCatAvatar compact /> : <UserRound size={16} />}</i>
                      <div><small>{message.role === "assistant" ? "橘猫实验员 · 光光" : "我的问题"}</small><p>{message.text}</p>{message.intent && <em><BrainCircuit size={10} />依据当前装置与学习轨迹 · {message.intent.toUpperCase()}</em>}</div>
                    </article>
                  ))}
                  <div ref={streamEndRef} />
                </div>

                <div className="harness-quick-questions" aria-label="快捷提问">
                  <span>接着问</span>
                  <div>{suggestions.slice(0, 4).map((question) => <button onClick={() => send(question)} key={question}>{question}</button>)}</div>
                </div>

                <details className="harness-question-library">
                  <summary><MessageCircle size={14} /><span><small>不知道怎样提问？</small><strong>查看光光还能回答什么</strong></span><b>{questionLibrary.length}<small>类示例</small></b><ChevronDown size={13} /></summary>
                  <div>{questionLibrary.map((question, index) => <button type="button" onClick={(event) => { event.preventDefault(); send(question); }} key={question}><b>{String(index + 1).padStart(2, "0")}</b><span>{question}</span><ArrowRight size={12} /></button>)}</div>
                </details>

                <div className="harness-composer">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    placeholder="输入与当前实验有关的问题或猜想……"
                    aria-label="向探究伙伴提问"
                  />
                  {draftFeedback && <div className={`harness-draft-intelligence mode-${draftFeedback.mode}`}><BrainCircuit size={13} /><span><strong>{draftFeedback.label}</strong><small>{draftFeedback.message}</small>{draftFeedback.checklist && <i>{draftFeedback.checklist.map((item) => <b className={item.passed ? "passed" : ""} key={item.id}>{item.passed ? <Check size={9} /> : <span />}{item.label}</b>)}</i>}</span><b>{Math.round(draftFeedback.confidence * 100)}%</b></div>}
                  {draftFeedback?.mode === "observation" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}保持____不变，把____从____调到____；我观察到____从____变为____。`)}><Sparkles size={13} />补入证据框架</button>}
                  {draftFeedback?.mode === "hypothesis" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template hypothesis" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}如果只把____从____调到____，并保持____不变，那么我预测____会____；我将通过比较____来检验。`)}><Sparkles size={13} />补成可检验假设</button>}
                  {draftFeedback?.mode === "reasoning" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template reasoning" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}在保持____不变时，我观察到____；因为____会导致____，所以这组证据支持____。`)}><Sparkles size={13} />补上因果桥梁</button>}
                  {draftFeedback?.mode === "conclusion" && (draftFeedback.observationQuality ?? 0) < 3 && <button className="harness-evidence-template conclusion" type="button" onClick={() => setDraft((value) => `${value.trim()}${value.trim() ? "\n" : ""}在保持____不变、只改变____的条件下，根据两组观察，我发现____；在本次实验范围内，这说明____。`)}><Sparkles size={13} />补入结论边界</button>}
                  <button className={`harness-send ${draftFeedback?.mode === "question" ? "suggested" : ""}`} onClick={() => draftFeedback?.mode === "observation" ? send(`检查这条观察：${draft}`, true) : draftFeedback?.mode === "hypothesis" ? send(`检查这条假设：${draft}`, true) : draftFeedback?.mode === "reasoning" ? send(`检查这条因果推理链：${draft}`, true) : draftFeedback?.mode === "conclusion" ? send(`检查这条结论：${draft}`, true) : send()} disabled={!draft.trim()}><SendHorizontal size={16} /><span>{draftFeedback?.mode === "observation" ? "审查证据" : draftFeedback?.mode === "hypothesis" ? "审查假设" : draftFeedback?.mode === "reasoning" ? "审查因果链" : draftFeedback?.mode === "conclusion" ? "审查结论" : "发送问题"}</span></button>
                  <button className={`harness-save-observation ${draftFeedback?.mode === "observation" ? "suggested" : ""}`} onClick={save} disabled={!draft.trim()}>{saved ? <Check size={15} /> : <Save size={15} />}{saved ? "已保存" : "保存为观察"}</button>
                  <small>Enter 发送 · Shift + Enter 换行</small>
                </div>
              </section>}

              {panelView === "review" && latestInsight && (
                <button className={`harness-live-insight ${latestInsight.read ? "read" : ""}`} onClick={() => readInsight(latestInsight.id)}>
                  <Lightbulb size={17} /><span><small>规则引擎刚刚注意到</small><strong>{latestInsight.title}</strong><p>{latestInsight.message}</p></span>{!latestInsight.read && <b>新</b>}
                </button>
              )}

              {panelView === "review" && <details className="harness-trace harness-dialogue-trace">
                <summary><span>探究档案与最近事件</span><ChevronDown size={14} /></summary>
                <ol>{recentEvents.map((event) => <li key={event.id}><i /><span>{eventNames[event.type]}</span><time>{new Date(event.occurredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></li>)}</ol>
              </details>}
            </div>
          ) : (
            <TutorialExperience activeArea={activeArea} activeModule={activeModule} compact={tutorialCompact} side={tutorialMiniSide} onCompactChange={setTutorialCompact} onSideChange={setTutorialMiniSide} />
          )}

          <footer><span>GUANGGUANG · 智能实验教练</span><button onClick={() => setPanelOpen(false)}>回到实验 <ArrowRight size={14} /></button></footer>
        </aside></>
      )}
    </>
  );
}

function TutorialExperience({ activeArea, activeModule, compact, side, onCompactChange, onSideChange }: { activeArea: HarnessArea; activeModule: string; compact: boolean; side: "left" | "right"; onCompactChange: (compact: boolean) => void; onSideChange: (side: "left" | "right") => void }) {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [narratorVoice, setNarratorVoice] = useState<SpeechSynthesisVoice>();
  const [speaking, setSpeaking] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [snapshot, setSnapshot] = useState<ExperimentSnapshot | undefined>(() => getLatestExperimentSnapshot("dispersion"));
  const [runVersion, setRunVersion] = useState(0);
  const [interactionGate, setInteractionGate] = useState({ stepId: "", baseline: 0 });
  const [taskContext, setTaskContext] = useState<StudentTaskLessonContext | null>(null);
  const demoTimersRef = useRef<number[]>([]);
  const tutorialSession = useHarnessStore((state) => state.session);
  const generatedProfile = !activeModule.endsWith("-overview") && activeModule !== "overview" ? createScienceTutorialProfile(activeArea, activeModule) : undefined;
  const guidedProfile = guidedOpticsTutorials[activeModule] ?? generatedProfile;
  const tutorialSteps: TutorialStep[] = activeModule === "dispersion" ? dispersionTutorialSteps : guidedProfile?.steps ?? [];
  const step = tutorialSteps[stepIndex] ?? tutorialSteps[0];
  const speechAction = getHarnessTutorialAction(step?.actions, "speech");
  const spotlightAction = getHarnessTutorialAction(step?.actions, "spotlight");
  const waitAction = getHarnessTutorialAction(step?.actions, "wait-for-event");
  const baseStepNarration = speechAction?.text ?? step?.narration ?? "";
  const stepNarration = taskContext && stepIndex === 0
    ? `你现在正在完成班级实验任务。本节课要研究：${taskContext.inquiryQuestion}。先记住证据要求：${taskContext.evidenceRequirement ?? "保存可比较的数据和观察。"}。${baseStepNarration}`
    : baseStepNarration;
  const stepTarget = (spotlightAction?.target ?? step?.target ?? "module") as SpotlightTarget;
  const stepAcceptedEvents = waitAction?.eventTypes ?? step?.acceptedEvents ?? [];
  const waitsForInteraction = Boolean(waitAction || step?.requiresInteraction);
  const eventCount = tutorialSession?.events.length ?? 0;
  const interactionBaseline = interactionGate.stepId === step?.id ? interactionGate.baseline : eventCount;
  const interactionEvents = tutorialSession?.events.slice(interactionBaseline).filter((event) => stepAcceptedEvents.includes(event.type)) ?? [];
  const latestInteraction = interactionEvents.at(-1);
  const genericInteractionSatisfied = !waitsForInteraction || interactionEvents.length >= (waitAction?.minimumCount ?? 1);
  const satisfied = activeModule === "dispersion" ? requirementMet(step?.requirement, snapshot) : genericInteractionSatisfied;
  const requiresAction = Boolean(step?.requirement || waitsForInteraction);
  const selectedAnswer = step ? answers[step.id] : undefined;
  const questionSatisfied = !step?.question || selectedAnswer === step.question.answerIndex;
  const readyToAdvance = satisfied && questionSatisfied;
  const available = activeModule === "dispersion" || Boolean(guidedProfile);

  useEffect(() => {
    let active = true;
    const activeSession = activeStudentSession();
    const taskId = new URLSearchParams(window.location.search).get("taskId") ?? activeSession?.taskId;
    const areaByExperiment: Record<string, HarnessArea> = { light: "optics", lens: "lens", mechanics: "mechanics", circuit: "circuit", sound: "sound", thermal: "thermal", measurement: "measurement" };
    if (!taskId || !studentApi.hasSession() || (activeSession && areaByExperiment[activeSession.experimentId] !== activeArea)) { setTaskContext(null); return; }
    void studentApi.taskLesson(taskId).then((context) => { if (active) setTaskContext(context); }).catch(() => { if (active) setTaskContext(null); });
    return () => { active = false; };
  }, [activeModule]);

  useEffect(() => subscribeExperimentSnapshots((next) => {
    if (next.module === "dispersion") setSnapshot(next);
  }), []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setNarratorVoice(selectTeacherChineseVoice(window.speechSynthesis.getVoices()));
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    setStarted(false);
    setStepIndex(0);
    setAutoPlay(true);
    window.speechSynthesis?.cancel();
    onCompactChange(false);
    if (activeModule === "dispersion") dispatchTutorialCommand({ type: "widget_clearHighlight", module: "dispersion" });
  }, [activeModule, onCompactChange]);

  useEffect(() => {
    if (started && (step?.question || stepIndex === tutorialSteps.length - 1) && compact) onCompactChange(false);
  }, [compact, onCompactChange, started, step, stepIndex, tutorialSteps.length]);

  useEffect(() => {
    if (!started || !waitsForInteraction || !step) return;
    setInteractionGate({ stepId: step.id, baseline: tutorialSession?.events.length ?? 0 });
  }, [started, step?.id, waitsForInteraction]);

  useEffect(() => {
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
    setDemoRunning(false);
    return () => {
      demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      demoTimersRef.current = [];
    };
  }, [stepIndex]);

  useEffect(() => {
    if (!started || !available || !step) return;
    if (activeModule === "dispersion") {
      dispatchTutorialCommand({ type: "widget_highlight", module: "dispersion", target: stepTarget as TutorialTarget });
      if (step.state) dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: step.state });
    }

    window.speechSynthesis?.cancel();
    if (!voiceEnabled || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(stepNarration);
    utterance.lang = "zh-CN";
    if (narratorVoice) utterance.voice = narratorVoice;
    // 指导老师预设：语速略慢但不拖沓，保持自然音高，避免低沉失真。
    utterance.rate = .92;
    utterance.pitch = 1.02;
    utterance.volume = .95;
    let active = true;
    utterance.onstart = () => active && setSpeaking(true);
    utterance.onend = () => active && setSpeaking(false);
    utterance.onerror = () => active && setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
    return () => {
      active = false;
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [activeModule, available, narratorVoice, runVersion, started, step, stepNarration, stepTarget, voiceEnabled]);

  useEffect(() => {
    if (!started || !autoPlay || speaking || demoRunning || !readyToAdvance || stepIndex >= tutorialSteps.length - 1) return;
    const timer = window.setTimeout(() => setStepIndex((value) => value + 1), voiceEnabled ? 1700 : 5600);
    return () => window.clearTimeout(timer);
  }, [autoPlay, demoRunning, readyToAdvance, speaking, started, stepIndex, tutorialSteps.length, voiceEnabled]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    if (activeModule === "dispersion") dispatchTutorialCommand({ type: "widget_clearHighlight", module: "dispersion" });
  }, [activeModule]);

  const begin = () => {
    setStepIndex(0);
    setAnswers({});
    setInteractionGate({ stepId: "", baseline: tutorialSession?.events.length ?? 0 });
    setDemoRunning(false);
    setStarted(true);
    setAutoPlay(true);
    onCompactChange(true);
    setRunVersion((value) => value + 1);
  };

  const stop = () => {
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
    setStarted(false);
    onCompactChange(false);
    setAutoPlay(false);
    setSpeaking(false);
    window.speechSynthesis?.cancel();
    if (activeModule === "dispersion") dispatchTutorialCommand({ type: "widget_clearHighlight", module: "dispersion" });
  };

  const togglePlayback = () => {
    setAutoPlay((value) => {
      const next = !value;
      if (next) window.speechSynthesis?.resume();
      else window.speechSynthesis?.pause();
      return next;
    });
  };

  const replay = () => {
    window.speechSynthesis?.cancel();
    setRunVersion((value) => value + 1);
  };

  const toggleVoice = () => {
    setVoiceEnabled((value) => !value);
    setRunVersion((value) => value + 1);
  };

  const runDemonstration = () => {
    if (activeModule !== "dispersion" || !step.requirement || demoRunning) return;
    demoTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    demoTimersRef.current = [];
    setDemoRunning(true);
    dispatchTutorialCommand({ type: "widget_highlight", module: "dispersion", target: stepTarget as TutorialTarget });
    const later = (delay: number, state?: Extract<TutorialCommand, { type: "widget_setState" }>["state"], finish = false) => {
      const timer = window.setTimeout(() => {
        if (state) dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state });
        if (finish) setDemoRunning(false);
      }, delay);
      demoTimersRef.current.push(timer);
    };
    if (step.requirement === "white-source-on") {
      dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: { lightMode: "white", sourceOn: false } });
      later(500, { sourceOn: true });
      later(1900, { sourceOn: false });
      later(2500, undefined, true);
    } else if (step.requirement === "prism-rotated") {
      dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: { prismAngle: 0, sourceOn: true } });
      later(500, { prismAngle: -12 });
      later(1800, { prismAngle: 12 });
      later(3100, { prismAngle: 0 });
      later(3800, undefined, true);
    } else {
      dispatchTutorialCommand({ type: "widget_setState", module: "dispersion", state: { screenDistance: 250, sourceOn: true } });
      later(500, { screenDistance: 360 });
      later(2100, { screenDistance: 250 });
      later(2800, undefined, true);
    }
  };

  if (!available) {
    return <div className="harness-panel-body cat-tutorial-unavailable"><OrangeCatAvatar mood="listening" /><span>当前页面</span><h2>请先选择一个具体实验</h2><p>回到领域总览，进入任一具体实验后再打开光光；动态教程会根据当前实验加载对应的操作、证据与解释镜头。</p></div>;
  }

  if (!started) {
    return <div className="harness-panel-body cat-tutorial-cover">
      <div className={`cat-tutorial-cover-art ${activeModule === "dispersion" ? "dispersion" : "guided"}`}><OrangeCatAvatar mood="celebrating" /><span className="cat-prism-beam" /><span className="cat-prism-spectrum" /></div>
      <span>{taskContext ? "CLASS MISSION TUTOR · 班级任务支架" : "DYNAMIC LAB STORY · 自由探索教程"} · {activeModule === "dispersion" ? "约 4 分钟" : guidedProfile.duration}</span>
      <h2>{taskContext ? taskContext.title : activeModule === "dispersion" ? "跟着橘猫，亲手发现白光里的颜色" : guidedProfile.title}</h2>
      <p>{taskContext ? `本次任务的核心问题是：“${taskContext.inquiryQuestion}”光光会用当前装置带你预测、控制变量和寻找证据，但不会替你完成操作。` : activeModule === "dispersion" ? "这不是一段只能观看的视频。光光会边讲边指出装置，在关键步骤停下来，等你亲手打开光源、旋转三棱镜和移动光屏。" : guidedProfile.summary}</p>
      <ul>{(taskContext ? [taskContext.predictionPrompt ?? "操作前先作出预测", taskContext.controlledVariable ?? "每轮只改变一个变量", taskContext.evidenceRequirement ?? "保存可比较的实验记录"] : activeModule === "dispersion" ? ["9 个动态镜头", "3 次学生操作", "白光、单色光与 RGB 对照"] : guidedProfile.highlights).map((item) => <li key={item}><CircleCheck size={15} />{item}</li>)}</ul>
      <button onClick={begin}><PlayCircle size={19} />{taskContext ? "按任务要求开始引导" : "开始动态教程"}</button>
      <small>{taskContext ? "教程退出后任务会话仍保持进行；请回任务舱完成并提交本次实验。" : "随时可以退出，原来的自由探索不会被关闭。"}</small>
    </div>;
  }

  const progress = ((stepIndex + 1) / tutorialSteps.length) * 100;
  const state = activeModule === "dispersion" ? snapshot?.state : undefined;
  const catMood = speaking ? "speaking" : satisfied && requiresAction ? "celebrating" : requiresAction ? "listening" : "idle";
  const finished = stepIndex === tutorialSteps.length - 1 && !speaking;

  if (compact) {
    return <div className="harness-panel-body cat-tutorial-mini-player">
      <TutorialSpotlight target={stepTarget} label={step.eyebrow} />
      <div className="cat-mini-avatar"><OrangeCatAvatar mood={catMood} /><i className={speaking ? "is-speaking" : ""}>{speaking ? "讲解中" : requiresAction && !satisfied ? "轮到你" : requiresAction ? "已检测" : "观察"}</i></div>
      <button className="cat-mini-copy" onClick={() => onCompactChange(false)} aria-label="展开完整讲解面板">
        <span>{step.eyebrow}</span><strong>{step.title}</strong><p>{requiresAction && !satisfied ? step.hint : stepNarration}</p>
      </button>
      <div className="cat-mini-window-tools">
        <button onClick={() => onSideChange(side === "right" ? "left" : "right")} title="把讲解条移到另一侧"><MoveHorizontal size={15} /><span>换边</span></button>
        <button onClick={() => onCompactChange(false)} title="展开完整教程"><Maximize2 size={15} /><span>展开</span></button>
        <button onClick={stop} title="退出教程"><X size={15} /><span>退出</span></button>
      </div>
      <div className="cat-mini-transport">
        <button onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ChevronLeft size={16} />上一步</button>
        <button className="primary" onClick={togglePlayback}>{autoPlay ? <PauseCircle size={17} /> : <PlayCircle size={17} />}{autoPlay ? "暂停" : "继续"}</button>
        <button onClick={() => setStepIndex((value) => Math.min(tutorialSteps.length - 1, value + 1))} disabled={stepIndex === tutorialSteps.length - 1 || !readyToAdvance}>下一步<ChevronRight size={16} /></button>
        {step.requirement && !satisfied && <button className="demo" onClick={runDemonstration} disabled={demoRunning}><MousePointerClick size={15} />{demoRunning ? "示范中…" : "看示范"}</button>}
      </div>
      <div className="cat-mini-progress"><span style={{ width: `${progress}%` }} /></div>
    </div>;
  }

  return <div className="harness-panel-body cat-tutorial-player">
    <TutorialSpotlight target={stepTarget} label={step.eyebrow} />
    <div className="cat-tutorial-progress"><span style={{ width: `${progress}%` }} /><b>{String(stepIndex + 1).padStart(2, "0")} / {String(tutorialSteps.length).padStart(2, "0")}</b></div>
    <section className="cat-tutorial-stage">
      <div className="cat-tutorial-avatar"><OrangeCatAvatar mood={catMood} /><i className={speaking ? "is-speaking" : ""}>{speaking ? "指导老师讲解中" : requiresAction && !satisfied ? "等你操作" : requiresAction ? "操作已记录" : "观察中"}</i></div>
      <div className="cat-speech-card" aria-live="polite"><span>{step.eyebrow}</span><h2>{step.title}</h2><p>{stepNarration}</p></div>
    </section>

    <div className={`cat-tutorial-task ${requiresAction ? satisfied ? "is-complete" : "is-waiting" : "is-observing"}`}>
      {requiresAction ? satisfied ? <CircleCheck size={18} /> : <Sparkles size={18} /> : <Lightbulb size={18} />}
      <span><small>{requiresAction ? satisfied ? "真实操作已检测" : "现在请你操作实验" : "本镜头观察提示"}</small><strong>{satisfied && requiresAction ? latestInteraction ? `已记录：${eventNames[latestInteraction.type]}。可以继续观察。` : "做得好，已经找到继续前进的证据。" : step.hint}</strong></span>
      {step.requirement && !satisfied && <button className="cat-tutorial-demo" onClick={runDemonstration} disabled={demoRunning}><MousePointerClick size={15} />{demoRunning ? "光光正在操作…" : "先看光光示范"}</button>}
    </div>

    {step.question && <section className="cat-tutorial-question" aria-label="预测问题">
      <span>PREDICT / 先预测再观察</span><h3>{step.question.prompt}</h3>
      <div>{step.question.choices.map((choice, index) => <button className={`${selectedAnswer === index ? "selected" : ""} ${selectedAnswer === index ? index === step.question!.answerIndex ? "correct" : "wrong" : ""}`} onClick={() => setAnswers((current) => ({ ...current, [step.id]: index }))} key={choice}><b>{String.fromCharCode(65 + index)}</b>{choice}</button>)}</div>
      {selectedAnswer !== undefined && <p className={questionSatisfied ? "correct" : "wrong"}>{questionSatisfied ? step.question.explanation : activeModule === "dispersion" ? "这个判断和光屏证据不一致，再换一个答案试试看。" : "这个判断与当前实验规律不一致，再换一个答案试试看。"}</p>}
    </section>}

    {finished && <section className="cat-tutorial-finish" aria-label="动态教程完成">
      <CircleCheck size={23} />
      <div><small>TUTORIAL COMPLETE / 教程完成</small><strong>{taskContext ? "操作引导结束，请检查任务证据。" : "讲解结束，实验仍然保持开放。"}</strong><p>{taskContext ? `${taskContext.reflectionPrompt ?? "用一个新情境检验刚才形成的解释。"} 保存观察后，回到任务舱点击“完成本次实验”。` : "现在可以带着刚才的预测和证据继续自由改变条件，或者重新播放整个教程。"}</p></div>
      <button onClick={stop}>{taskContext ? "继续完成任务实验" : "回到自由实验"}</button><button className="restart" onClick={begin}><RotateCcw size={14} />重新播放</button>
    </section>}

    {state && <div className="cat-tutorial-live-state" aria-label="当前实验状态">
      <span><small>光源</small><b>{state.sourceOn ? state.lightMode.toUpperCase() : "OFF"}</b></span>
      <span><small>棱镜</small><b>{state.prismAngle}°</b></span>
      <span><small>光屏</small><b>{state.screenDistance} mm</b></span>
    </div>}

    <div className="cat-tutorial-transport">
      <button onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0} aria-label="上一步"><ChevronLeft size={18} /></button>
      <button className="transport-primary" onClick={togglePlayback}>{autoPlay ? <PauseCircle size={18} /> : <PlayCircle size={18} />}{autoPlay ? "暂停自动播放" : "继续自动播放"}</button>
      <button onClick={() => setStepIndex((value) => Math.min(tutorialSteps.length - 1, value + 1))} disabled={stepIndex === tutorialSteps.length - 1 || !readyToAdvance} aria-label="下一步"><ChevronRight size={18} /></button>
    </div>

    <div className="cat-tutorial-tools">
      <button onClick={replay}><RotateCcw size={15} />重播本步</button>
      <button onClick={toggleVoice}>{voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{voiceEnabled ? "关闭讲解" : "开启讲解"}</button>
      <button onClick={stop}>退出教程</button>
    </div>

    <nav className="cat-tutorial-dots" aria-label="教程镜头">
      {tutorialSteps.map((item, index) => <button className={`${index === stepIndex ? "active" : ""} ${index < stepIndex ? "visited" : ""}`} onClick={() => setStepIndex(index)} aria-label={`进入${item.eyebrow}`} key={item.id}>{index + 1}</button>)}
    </nav>
  </div>;
}
