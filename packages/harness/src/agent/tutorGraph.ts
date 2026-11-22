import { AgentStateGraph, GRAPH_END, type AgentTraceStep } from "./stateGraph.ts";
import {
  extractMemoryDraftsFromTurn,
  selectRelevantMemories,
  type LearnerMemoryDraft,
  type LearnerMemoryItem,
  type LearnerMemoryScope
} from "./learnerMemory.ts";
import {
  isPhysicsProblemPrompt,
  mapPhysicsProblemToExperiment,
  type PhysicsProblemMapping
} from "./problemMapper.ts";
import {
  resolveSkillIdForExperiment,
  getBktMasterySnapshots,
  type BktSkillState
} from "./bktMastery.ts";
import {
  createPeerClassmateTurn,
  type PeerClassmateTurn
} from "./peerClassroom.ts";
import { protectedTutorReply } from "./protectedQuestion.ts";

export type TutorAgentIntent =
  | "protected"
  | "problem-to-lab"
  | "socratic-quiz"
  | "peer-debate"
  | "concept-compare"
  | "error-diagnosis"
  | "experiment-coach";

export interface TutorAgentAction {
  id: string;
  kind: "navigate" | "ask" | "hint" | "apply-params" | "quiz-choice";
  label: string;
  description: string;
  route?: string;
  prompt?: string;
  hintLevel?: 1 | 2 | 3;
  targetExperimentId?: string;
  paramsPatch?: Record<string, number>;
  skillId?: string;
  quizCorrect?: boolean;
}

export interface TutorAgentInput {
  scope: LearnerMemoryScope;
  experimentId: string | null;
  experimentName?: string | null;
  question: string;
  memories?: readonly LearnerMemoryItem[];
  bktStates?: readonly BktSkillState[];
  hasMeasurements?: boolean;
  hasWarning?: boolean;
}

export interface TutorAgentResult {
  intent: TutorAgentIntent;
  intentLabel: string;
  overrideText: string | null;
  memoryHint: string | null;
  peerTurn: PeerClassmateTurn | null;
  quizSkillId: string | null;
  actions: TutorAgentAction[];
  problemMapping: PhysicsProblemMapping | null;
  newMemories: LearnerMemoryDraft[];
  trace: AgentTraceStep[];
}

interface TutorGraphState extends Record<string, unknown> {
  input: TutorAgentInput;
  intent: TutorAgentIntent;
  intentLabel: string;
  relevantMemories: LearnerMemoryItem[];
  problemMapping: PhysicsProblemMapping | null;
  overrideText: string | null;
  memoryHint: string | null;
  peerTurn: PeerClassmateTurn | null;
  quizSkillId: string | null;
  actions: TutorAgentAction[];
  newMemories: LearnerMemoryDraft[];
}

const INTENT_LABELS: Record<TutorAgentIntent, string> = {
  protected: "安全与证据边界",
  "problem-to-lab": "题目映射实验台",
  "socratic-quiz": "BKT 自适应苏格拉底自测",
  "peer-debate": "情境同桌挑错",
  "concept-compare": "对照概念拆解",
  "error-diagnosis": "实验错因诊断",
  "experiment-coach": "实验探究引导"
};

const SOCRATIC_QUIZ_BANK: Record<string, { scenario: string; choices: Array<{ text: string; correct: boolean }>; probe: string }> = {
  lens: {
    scenario: "把焦距 10 cm 的凸透镜固定，物体放在距透镜 15 cm 处。光屏移动后成清晰的像。",
    choices: [
      { text: "成倒立、放大的实像，像距大于 20 cm", correct: true },
      { text: "成倒立、缩小的实像，像距在 10~20 cm 之间", correct: false },
      { text: "光屏上接不到像，只能透过透镜看到虚像", correct: false }
    ],
    probe: "先别急着算公式：15 cm 处于 f 和 2f 之间，对应生活中照相机还是投影仪？点击选项检验并去光具座调一下。"
  },
  "circuit-ohm": {
    scenario: "保持定值电阻不变，把电源电压从 3 V 调到 6 V；再保持电压 6 V 不变，把电阻加倍。",
    choices: [
      { text: "第一次电流加倍，第二次电流减半", correct: true },
      { text: "两次电流都加倍", correct: false },
      { text: "第一次电流不变，第二次电流减半", correct: false }
    ],
    probe: "哪一步是在验证 I 与 U 成正比，哪一步是在验证 I 与 R 成反比？"
  },
  pendulum: {
    scenario: "同一地点，把单摆摆长从 0.5 m 增加到 2.0 m，摆球质量不变，保持小摆角。",
    choices: [
      { text: "周期变为原来的 2 倍", correct: true },
      { text: "周期变为原来的 4 倍", correct: false },
      { text: "周期几乎不变", correct: false }
    ],
    probe: "根据 T² 与 L 的正比关系，L 变成 4 倍时 T 怎么变？选完可以去单摆实验台测两组对比一下。"
  },
  "double-slit": {
    scenario: "保持红光波长和屏距不变，把双缝间距 d 调小为原来的一半。",
    choices: [
      { text: "光屏上相邻亮纹间距 Δx 变宽为原来 2 倍", correct: true },
      { text: "相邻亮纹间距 Δx 变窄为原来一半", correct: false },
      { text: "亮纹间距不变，只是亮度变暗", correct: false }
    ],
    probe: "在 Δx = Lλ/d 中，d 在分母上。去双缝实验台调小 d，看看亮纹是变密还是变疏？"
  },
  "spring-force": {
    scenario: "同一根轻质弹簧在弹性限度内，挂 100 g 砝码时伸长 2.0 cm，再加挂 100 g 砝码。",
    choices: [
      { text: "总伸长量变为 4.0 cm，劲度系数 k 不变", correct: true },
      { text: "总伸长量变为 4.0 cm，劲度系数 k 变为原来 2 倍", correct: false },
      { text: "伸长量不变", correct: false }
    ],
    probe: "劲度系数 k 是由外力决定的，还是由弹簧自身决定的？"
  },
  "capacitor-charge": {
    scenario: "电容器充满电后，把单刀双掷开关从充电挡切到经电阻 R 放电挡，若把电阻 R 换大一倍。",
    choices: [
      { text: "放电变慢，时间常数 τ = RC 增大一倍", correct: true },
      { text: "放电变快，电压瞬间降为零", correct: false },
      { text: "放电快慢不变，只影响最大电压", correct: false }
    ],
    probe: "电阻变大后，放电初始电流变小；电压降到相同剩余比例所需时间会变长还是变短？"
  }
};

const QUIZ_EXPERIMENT_BY_SKILL: Record<string, string> = {
  "junior-lens-imaging": "lens",
  "junior-circuit-ohm": "circuit-ohm",
  "hs-pendulum": "pendulum",
  "hs-double-slit": "double-slit",
  "hs-spring-force": "spring-force",
  "hs-circuit-capacitor": "capacitor-charge"
};

function createTutorGraph() {
  const graph = new AgentStateGraph<
    TutorGraphState,
    "classify_intent" | "protected_reply" | "load_memory" | "problem_mapper" | "socratic_quiz" | "peer_debate" | "coach_and_diagnose" | "physics_guardrail" | "extract_memory"
  >({ maxSteps: 10 });

  graph
    .addNode(
      "classify_intent",
      (state) => {
        const q = state.input.question.trim();
        let intent: TutorAgentIntent = "experiment-coach";
        if (protectedTutorReply(q)) {
          intent = "protected";
        } else if (/同桌|小研|挑错|找茬|辩论|同学怎么看/iu.test(q)) {
          intent = "peer-debate";
        } else if (isPhysicsProblemPrompt(q) || /找实验|对应.*实验|复现.*题/iu.test(q)) {
          intent = "problem-to-lab";
        } else if (/考考我|出一道题|自测|小测验|巩固练习|给我出题|专练薄弱点|薄弱点/iu.test(q)) {
          intent = "socratic-quiz";
        } else if (/区别|对比|有什么不同|还是.*好/iu.test(q)) {
          intent = "concept-compare";
        } else if (state.input.hasWarning || /为什么不对|报错|异常|偏大|偏小|误差|接错了|不亮|不动/iu.test(q)) {
          intent = "error-diagnosis";
        }
        return { intent, intentLabel: INTENT_LABELS[intent] };
      },
      {
        label: "意图识别",
        summarize: (s) => `识别为「${s.intentLabel}」`
      }
    )
    .addNode(
      "protected_reply",
      (state) => ({ overrideText: protectedTutorReply(state.input.question), memoryHint: null, actions: [] }),
      { label: "安全与证据边界", summarize: () => "已给出安全或记录边界提示" }
    )
    .addNode(
      "load_memory",
      (state) => {
        const relevant = selectRelevantMemories(
          state.input.memories ?? [],
          state.input.scope,
          state.input.experimentId,
          3
        );
        const top = relevant[0];
        const memoryHint = top
          ? `结合你之前的学习记录（${top.topic}）：${top.summary}`
          : null;
        return { relevantMemories: relevant, memoryHint };
      },
      {
        label: "长期记忆检索",
        summarize: (s) => s.relevantMemories.length ? `命中 ${s.relevantMemories.length} 条跨实验记忆` : "暂无历史薄弱点记录"
      }
    )
    .addNode(
      "problem_mapper",
      (state) => {
        const mapping = mapPhysicsProblemToExperiment(state.input.question, state.input.scope);
        if (!mapping) {
          return {
            problemMapping: null,
            overrideText: "我读了这道题，暂时还没精准匹配到具体实验模块。你可以补充核心关键词（比如“凸透镜焦距”“单摆摆长”“欧姆定律”“双缝干涉”“电容器充放电”），我就能帮你一键定位到对应实验台并提取参数。",
            actions: [
              { id: "act-ask-clarify", kind: "ask", label: "用示例题试试看", description: "示例：焦距 10cm 凸透镜前 25cm 处成什么像？", prompt: "题目：一物体放在焦距为 10cm 的凸透镜前 25cm 处，成什么像？" }
            ]
          };
        }
        const paramLine = mapping.extractedParameters.length
          ? `已提取题目参数：${mapping.extractedParameters.map((p) => `${p.label} ${p.symbol} = ${p.value}`).join("，")}。`
          : "题目未包含具体数值，可以先在实验台使用默认参数建立定性对照。";
        const steps = mapping.verificationPlan.map((step, i) => `${i + 1}. ${step}`).join("\n");
        const text = [
          `这道题可在「${mapping.title}」实验台动手验证（关键词匹配参考度 ${Math.round(mapping.confidence * 100)}%）。`,
          paramLine,
          `建议验证步骤：\n${steps}`,
          `先想一想：${mapping.guidingQuestion}`
        ].join("\n\n");

        const actions: TutorAgentAction[] = [];
        if (mapping.labParameterPatch && Object.keys(mapping.labParameterPatch).length > 0) {
          actions.push({
            id: `apply-${mapping.experimentId}`,
            kind: "apply-params",
            label: "一键写入实验台参数",
            description: `自动设定参数：${Object.entries(mapping.labParameterPatch).map(([k, v]) => `${k}=${v}`).join(", ")}`,
            targetExperimentId: mapping.experimentId,
            paramsPatch: mapping.labParameterPatch,
            route: mapping.route
          });
        }
        actions.push(
          {
            id: `nav-${mapping.experimentId}`,
            kind: "navigate",
            label: `前往「${mapping.title}」实验台`,
            description: mapping.grade === "high-school" ? "跳转高中实验室对应模块动手验证" : "跳转初中探索空间对应模块动手验证",
            route: mapping.route
          },
          {
            id: `hint-${mapping.experimentId}`,
            kind: "hint",
            label: "先看一级观察提示",
            description: "不直接看结论，先明确观察重点",
            hintLevel: 1
          }
        );
        return { problemMapping: mapping, overrideText: text, actions };
      },
      {
        label: "题目→实验台映射",
        summarize: (s) => s.problemMapping
          ? `匹配到「${s.problemMapping.title}」${s.problemMapping.labParameterPatch ? "并生成参数写入指令" : ""}`
          : "需要补充物理关键词"
      }
    )
    .addNode(
      "socratic_quiz",
      (state) => {
        const asksWeakest = /薄弱点|最弱|掌握度/iu.test(state.input.question);
        const expId = state.input.experimentId ?? "";
        const available = getBktMasterySnapshots(state.input.bktStates ?? [], state.input.scope)
          .filter((skill) => QUIZ_EXPERIMENT_BY_SKILL[skill.skillId]);
        const currentSkillId = resolveSkillIdForExperiment(state.input.scope, expId);
        const currentSkill = available.find((skill) => skill.skillId === currentSkillId && QUIZ_EXPERIMENT_BY_SKILL[skill.skillId] === expId);
        const attempted = available.filter((skill) => skill.attempts > 0);
        const weakest = [...attempted].sort((a, b) => a.mastery - b.mastery)[0];
        const selected = asksWeakest ? (weakest ?? currentSkill ?? available[0]) : currentSkill;
        if (!selected) {
          return {
            overrideText: "当前实验还没有经过核对的情境自测题。可以先记录一组实验条件和读数，或者去凸透镜、欧姆定律、单摆、双缝、弹簧或电容器实验台练习。",
            quizSkillId: null,
            actions: [{ id: "quiz-plan", kind: "ask", label: "先规划实验步骤", description: "根据当前装置安排一组可验证的对照", prompt: "帮我规划下一步" }]
          };
        }
        const skillId = selected.skillId;
        const quizExperimentId = QUIZ_EXPERIMENT_BY_SKILL[skillId]!;
        const preset = SOCRATIC_QUIZ_BANK[quizExperimentId]!;
        const expName = asksWeakest && weakest
          ? `${selected.label}（当前练习估计 ${selected.masteryPercent}%）`
          : (state.input.experimentName ?? selected.label);
        const memoryMisconception = state.relevantMemories.find((m) => m.kind === "misconception");

        const choicesText = preset.choices.map((c, idx) => `${["A", "B", "C"][idx]}. ${c.text}`).join("\n");
        const text = [
          asksWeakest && !weakest
            ? `还没有已完成的自测记录，先从「${selected.label}」开始练习：`
            : `来一道针对「${expName}」的情境自测：`,
          preset.scenario,
          choicesText,
          preset.probe,
          memoryMisconception ? `（小提醒：你之前在「${memoryMisconception.topic}」上曾犹豫过，这次正好检验一下！）` : ""
        ].filter(Boolean).join("\n\n");

        const actions: TutorAgentAction[] = preset.choices.map((choice, idx) => {
          const letter = ["A", "B", "C"][idx]!;
          return {
            id: `quiz-${letter.toLowerCase()}`,
            kind: "quiz-choice",
            label: `选 ${letter}`,
            description: choice.text,
            skillId,
            quizCorrect: choice.correct,
            prompt: choice.correct
              ? `这道自测题我选 ${letter}（${choice.text}）。请确认我的核心思路，并告诉我还可以调哪个参数做进阶验证？`
              : `这道自测题我选 ${letter}（${choice.text}）。请不要直接告诉我正确答案，给我一个反例或实验台操作线索让我自己发现问题！`
          };
        });

        if (asksWeakest && quizExperimentId !== expId) {
          actions.unshift({
            id: `quiz-nav-${quizExperimentId}`,
            kind: "navigate",
            label: "前往对应实验台验证",
            description: `这道自测对应「${selected.label}」`,
            route: selected.route
          });
        }

        return { overrideText: text, quizSkillId: skillId, actions };
      },
      {
        label: "BKT 自适应出题",
        summarize: (s) => `针对知识点 ${s.quizSkillId ?? "当前实验"} 生成可追踪自测题`
      }
    )
    .addNode(
      "peer_debate",
      (state) => {
        const peerTurn = createPeerClassmateTurn(
          state.input.scope,
          state.input.experimentId,
          state.input.experimentName
        );
        const text = `我把实验同桌「${peerTurn.speakerName}」请过来了，听听他刚才在实验台上的想法——看看你能不能找出他推理里的漏洞！`;
        const actions: TutorAgentAction[] = [
          {
            id: "peer-refute",
            kind: "ask",
            label: "帮小研纠正并验证",
            description: peerTurn.challengePrompt,
            prompt: `针对小研说的“${peerTurn.utterance}”，我觉得有问题：请带我一步步在实验台设计一个反例验证！`
          },
          {
            id: "peer-quiz",
            kind: "ask",
            label: "做道自测巩固一下",
            description: "用 BKT 自测题检验这部分知识点掌握度",
            prompt: "考考我"
          }
        ];
        return { overrideText: text, peerTurn, actions };
      },
      {
        label: "情境同桌讨论",
        summarize: (s) => s.peerTurn ? `同桌「${s.peerTurn.speakerName}」发起观点讨论` : "已启动课堂讨论"
      }
    )
    .addNode(
      "coach_and_diagnose",
      (state) => {
        const actions: TutorAgentAction[] = [];
        const mapping = mapPhysicsProblemToExperiment(state.input.question, state.input.scope);

        if (mapping?.labParameterPatch && Object.keys(mapping.labParameterPatch).length > 0) {
          actions.push({
            id: `apply-inline-${mapping.experimentId}`,
            kind: "apply-params",
            label: "一键写入提到参数",
            description: `自动设定参数：${Object.entries(mapping.labParameterPatch).map(([k, v]) => `${k}=${v}`).join(", ")}`,
            targetExperimentId: mapping.experimentId,
            paramsPatch: mapping.labParameterPatch,
            route: mapping.route
          });
        } else if (mapping && mapping.experimentId !== state.input.experimentId) {
          actions.push({
            id: `nav-related-${mapping.experimentId}`,
            kind: "navigate",
            label: `切换到「${mapping.title}」对照验证`,
            description: "你的问题涉及该实验的核心规律，可一键前往验证",
            route: mapping.route
          });
        }

        if (state.intent === "error-diagnosis") {
          actions.push(
            { id: "act-check-current", kind: "ask", label: "核对当前装置与读数", description: "排查当前参数和测量限制", prompt: "帮我检查当前实验" },
            { id: "act-hint-2", kind: "hint", label: "查看二级操作提示", description: "定位具体需要调整的器材步骤", hintLevel: 2 }
          );
        } else if (state.intent === "concept-compare") {
          actions.push(
            { id: "act-next-step", kind: "ask", label: "规划一组对照实验", description: "只改一个变量看清概念差异", prompt: "帮我规划下一步" },
            { id: "act-peer-debate", kind: "ask", label: "听听同桌小研怎么说", description: "和 AI 实验同桌一起辩论找漏洞", prompt: "同桌讨论" }
          );
        } else {
          if (!state.input.hasMeasurements) {
            actions.push({ id: "act-plan-next", kind: "ask", label: "规划下一步操作", description: "结合当前装置获取可执行步骤", prompt: "帮我规划下一步" });
          }
          actions.push({ id: "act-socratic-quiz", kind: "ask", label: "来道情境自测题", description: "边做实验边更新掌握度", prompt: "考考我" });
        }

        return { problemMapping: mapping, actions: actions.slice(0, 3) };
      },
      {
        label: "实验诊断与动作规划",
        summarize: (s) => `生成 ${s.actions.length} 项联动建议`
      }
    )
    .addNode(
      "physics_guardrail",
      (state) => {
        if (state.overrideText && /你已经测得|实测结果表明/u.test(state.overrideText)) {
          return {
            overrideText: state.overrideText
              .replaceAll("你已经测得", "在虚拟实验台可先观察")
              .replaceAll("实测结果表明", "理论模型预计")
          };
        }
        return {};
      },
      {
        label: "模型与读数措辞检查",
        summarize: () => "已检查预设回复的来源措辞；数值仍需由物理模型核对"
      }
    )
    .addNode(
      "extract_memory",
      (state) => {
        const drafts = extractMemoryDraftsFromTurn({
          scope: state.input.scope,
          experimentId: state.problemMapping?.experimentId ?? state.input.experimentId,
          question: state.input.question
        });
        return { newMemories: drafts };
      },
      {
        label: "长期记忆沉淀",
        summarize: (s) => s.newMemories.length ? `提炼 ${s.newMemories.length} 条学习线索` : "本轮无需新增记忆"
      }
    )
    .setEntryPoint("classify_intent")
    .addConditionalEdges("classify_intent", (state) => state.intent === "protected" ? "protected_reply" : "load_memory")
    .addEdge("protected_reply", GRAPH_END)
    .addConditionalEdges("load_memory", (state) => {
      if (state.intent === "problem-to-lab") return "problem_mapper";
      if (state.intent === "socratic-quiz") return "socratic_quiz";
      if (state.intent === "peer-debate") return "peer_debate";
      return "coach_and_diagnose";
    })
    .addEdge("problem_mapper", "physics_guardrail")
    .addEdge("socratic_quiz", "physics_guardrail")
    .addEdge("peer_debate", "physics_guardrail")
    .addEdge("coach_and_diagnose", "physics_guardrail")
    .addEdge("physics_guardrail", "extract_memory")
    .addEdge("extract_memory", GRAPH_END);

  return graph.compile();
}

const compiledTutorGraph = createTutorGraph();

export function runPhysicsTutorAgent(input: TutorAgentInput): TutorAgentResult {
  const { state, trace } = compiledTutorGraph.invoke({
    input,
    intent: "experiment-coach",
    intentLabel: INTENT_LABELS["experiment-coach"],
    relevantMemories: [],
    problemMapping: null,
    overrideText: null,
    memoryHint: null,
    peerTurn: null,
    quizSkillId: null,
    actions: [],
    newMemories: []
  });

  return {
    intent: state.intent,
    intentLabel: state.intentLabel,
    overrideText: state.overrideText,
    memoryHint: state.memoryHint,
    peerTurn: state.peerTurn,
    quizSkillId: state.quizSkillId,
    actions: state.actions,
    problemMapping: state.problemMapping,
    newMemories: state.newMemories,
    trace
  };
}
