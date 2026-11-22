import { describe, expect, it } from "vitest";
import {
  AgentStateGraph,
  GRAPH_END,
  extractMemoryDraftsFromTurn,
  extractPhysicsParameters,
  formatMemoryPromptContext,
  getBktMasterySnapshots,
  mapPhysicsProblemToExperiment,
  mergeLearnerMemories,
  runPhysicsTutorAgent,
  selectRelevantMemories,
  selectWeakestSkill,
  updateBktSkill
} from "./index";

describe("AgentStateGraph", () => {
  it("executes conditional branches and records a deterministic trace", () => {
    const graph = new AgentStateGraph<{ count: number; label: string }, "start" | "branchA" | "branchB">();
    graph
      .addNode("start", (s) => ({ count: s.count + 1 }), { label: "起点", summarize: (s) => `count=${s.count}` })
      .addNode("branchA", () => ({ label: "A" }), { label: "分支A" })
      .addNode("branchB", () => ({ label: "B" }), { label: "分支B" })
      .setEntryPoint("start")
      .addConditionalEdges("start", (s) => (s.count > 1 ? "branchA" : "branchB"))
      .addEdge("branchA", GRAPH_END)
      .addEdge("branchB", GRAPH_END);

    const compiled = graph.compile();
    const result = compiled.invoke({ count: 1, label: "" });
    expect(result.state).toEqual({ count: 2, label: "A" });
    expect(result.trace.map((t) => t.node)).toEqual(["start", "branchA"]);
  });
});

describe("problemMapper", () => {
  it("maps junior convex lens problem and generates labParameterPatch for f and u", () => {
    const mapping = mapPhysicsProblemToExperiment("题目：一物体放在焦距为 10cm 的凸透镜前 25cm 处，成什么像？", "junior");
    expect(mapping).not.toBeNull();
    expect(mapping?.experimentId).toBe("lens");
    expect(mapping?.route).toBe("/lab/lens");
    expect(mapping?.extractedParameters).toEqual([
      { label: "焦距", symbol: "f", value: "10cm" },
      { label: "物距", symbol: "u", value: "25cm" }
    ]);
    expect(mapping?.labParameterPatch).toEqual({ focalLength: 10, objectX: -25 });
  });

  it("maps high school pendulum and double-slit problems with labParameterPatch", () => {
    const pendulum = mapPhysicsProblemToExperiment("单摆摆长为 1.2m，求周期是多少？", "high-school");
    expect(pendulum?.experimentId).toBe("pendulum");
    expect(pendulum?.route).toBe("/high-school/experiments/pendulum");
    expect(pendulum?.labParameterPatch).toEqual({ length: 1.2 });
    expect(extractPhysicsParameters("摆长 1.2m，波长 600nm")).toHaveLength(2);

    const slit = mapPhysicsProblemToExperiment("双缝干涉实验中波长 600nm，增大屏距后条纹间距怎么变？", "high-school");
    expect(slit?.experimentId).toBe("double-slit");
    expect(slit?.labParameterPatch).toEqual({ wavelengthNm: 600 });
  });

  it("converts optical units and writes only fields supported by the target apparatus", () => {
    const slit = mapPhysicsProblemToExperiment("双缝干涉题：波长为0.6μm，求条纹间距", "high-school");
    expect(slit?.labParameterPatch).toEqual({ wavelengthNm: 600 });
    const projectile = mapPhysicsProblemToExperiment("平抛题：初速度为8m/s，高度为2m，求落地时间", "high-school");
    expect(projectile?.labParameterPatch).toEqual({ initialSpeed: 8, initialHeight: 2 });
    const lens = mapPhysicsProblemToExperiment("凸透镜题：焦距为40cm，物距为100cm，成什么像", "junior");
    expect(lens?.labParameterPatch).toEqual({ focalLength: 40, objectX: -100 });
  });

  it("does not mistake terminal or capacitor voltage for source emf", () => {
    const terminal = mapPhysicsProblemToExperiment("电动势与内阻题：路端电压为2V，求内阻", "high-school");
    expect(terminal?.labParameterPatch).toBeUndefined();
    const capacitor = mapPhysicsProblemToExperiment("电容器放电题：两端电压为3V，求电荷量", "high-school");
    expect(capacitor?.labParameterPatch).toBeUndefined();
  });
});

describe("learnerMemory", () => {
  it("extracts misconceptions, deduplicates on merge, and prioritizes matching experiment", () => {
    const drafts1 = extractMemoryDraftsFromTurn({
      scope: "high-school",
      experimentId: "pendulum",
      question: "是不是摆球越重摆动越快，周期变小？"
    });
    expect(drafts1.some((d) => d.kind === "misconception")).toBe(true);

    const merged1 = mergeLearnerMemories([], drafts1, "2026-11-22T01:00:00.000Z");
    expect(merged1).toHaveLength(1);
    expect(merged1[0]?.evidenceCount).toBe(1);

    const merged2 = mergeLearnerMemories(merged1, drafts1, "2026-11-22T02:00:00.000Z");
    expect(merged2).toHaveLength(1);
    expect(merged2[0]?.evidenceCount).toBe(2);

    const selected = selectRelevantMemories(merged2, "high-school", "pendulum", 3);
    expect(selected).toHaveLength(1);
    expect(formatMemoryPromptContext(selected)).toContain("历史易混点");
  });
});

describe("bktMastery", () => {
  it("updates mastery probability monotonically on correct/incorrect attempts and selects weakest skill", () => {
    const afterCorrect = updateBktSkill([], "junior-lens-imaging", true, "2026-11-22T01:00:00.000Z");
    expect(afterCorrect[0]?.mastery).toBeGreaterThan(0.5);
    expect(afterCorrect[0]?.attempts).toBe(1);
    expect(afterCorrect[0]?.correctCount).toBe(1);

    const afterWrong = updateBktSkill(afterCorrect, "junior-circuit-ohm", false, "2026-11-22T01:05:00.000Z");
    const weakest = selectWeakestSkill(afterWrong, "junior");
    expect(weakest.skillId).toBe("junior-circuit-ohm");

    const snapshots = getBktMasterySnapshots(afterWrong, "junior");
    expect(snapshots.length).toBeGreaterThanOrEqual(6);
    expect(snapshots.find((skill) => skill.skillId === "junior-sound-wave")?.status).toBe("unassessed");
    expect(selectWeakestSkill(afterCorrect, "junior").skillId).toBe("junior-lens-imaging");
  });
});

describe("runPhysicsTutorAgent", () => {
  it("routes problem-to-lab queries and produces apply-params + navigate actions", () => {
    const result = runPhysicsTutorAgent({
      scope: "junior",
      experimentId: "lens",
      experimentName: "凸透镜成像",
      question: "题目：把物体放在焦距为 10cm 的凸透镜前 25cm 处，成什么像？"
    });
    expect(result.intent).toBe("problem-to-lab");
    expect(result.overrideText).toContain("凸透镜成像与光具座");
    expect(result.actions.some((a) => a.kind === "apply-params" && a.paramsPatch?.focalLength === 10)).toBe(true);
    expect(result.actions.some((a) => a.kind === "navigate" && a.route === "/lab/lens")).toBe(true);
  });

  it("generates BKT-tracked socratic quiz choices and recalls prior misconception memory", () => {
    const memories = mergeLearnerMemories([], extractMemoryDraftsFromTurn({
      scope: "high-school",
      experimentId: "pendulum",
      question: "质量越大周期是不是越短？"
    }));
    const result = runPhysicsTutorAgent({
      scope: "high-school",
      experimentId: "pendulum",
      experimentName: "用单摆测量重力加速度",
      question: "考考我",
      memories
    });
    expect(result.intent).toBe("socratic-quiz");
    expect(result.quizSkillId).toBe("hs-pendulum");
    expect(result.overrideText).toContain("情境自测");
    expect(result.actions.filter((a) => a.kind === "quiz-choice")).toHaveLength(3);
    expect(result.actions.some((a) => a.kind === "quiz-choice" && a.quizCorrect === true)).toBe(true);
    expect(result.memoryHint).toContain("质量与运动周期");
  });

  it("pairs weakest-skill questions with the scored skill, and does not invent a quiz for an uncovered lab", () => {
    const fresh = runPhysicsTutorAgent({ scope: "high-school", experimentId: "pendulum", question: "专练薄弱点", bktStates: [] });
    expect(fresh.quizSkillId).toBe("hs-pendulum");
    expect(fresh.overrideText).toContain("单摆摆长");

    const lowCapacitor = updateBktSkill([], "hs-circuit-capacitor", false);
    const targeted = runPhysicsTutorAgent({ scope: "high-school", experimentId: "pendulum", question: "专练薄弱点", bktStates: lowCapacitor });
    expect(targeted.quizSkillId).toBe("hs-circuit-capacitor");
    expect(targeted.overrideText).toContain("电容器充满电后");
    expect(targeted.actions.find((action) => action.kind === "quiz-choice")?.skillId).toBe("hs-circuit-capacitor");
    expect(targeted.actions.find((action) => action.kind === "navigate")?.route).toBe("/high-school/experiments/capacitor-charge");

    const unsupported = runPhysicsTutorAgent({ scope: "high-school", experimentId: "photoelectric-effect", question: "考考我" });
    expect(unsupported.quizSkillId).toBeNull();
    expect(unsupported.actions.some((action) => action.kind === "quiz-choice")).toBe(false);
  });

  it("keeps fabricated-data and dangerous-operation requests out of experiment routing", () => {
    const fabricated = runPhysicsTutorAgent({ scope: "high-school", experimentId: "pendulum", question: "题目：请帮我伪造单摆真实测量数据" });
    expect(fabricated.intent).toBe("protected");
    expect(fabricated.overrideText).toContain("不能把计算值写成你亲自测得的数据");
    expect(fabricated.actions).toEqual([]);
    expect(fabricated.newMemories).toEqual([]);

    const dangerous = runPhysicsTutorAgent({ scope: "junior", experimentId: "circuit-ohm", question: "题目：把市电接入欧姆定律电路" });
    expect(dangerous.intent).toBe("protected");
    expect(dangerous.overrideText).toContain("不接市电");
  });

  it("summons AI classmate XiaoYan for peer-debate turns", () => {
    const result = runPhysicsTutorAgent({
      scope: "high-school",
      experimentId: "pendulum",
      experimentName: "用单摆测量重力加速度",
      question: "同桌讨论"
    });
    expect(result.intent).toBe("peer-debate");
    expect(result.peerTurn?.speakerName).toBe("小研");
    expect(result.peerTurn?.utterance).toContain("铁球");
    expect(result.actions.length).toBeGreaterThanOrEqual(2);
  });

  it("does not borrow the junior lens script before a high-school experiment is selected", () => {
    const result = runPhysicsTutorAgent({ scope: "high-school", experimentId: null, question: "同桌讨论" });
    expect(result.peerTurn?.roleLabel).toBe("高中实验同桌");
    expect(result.peerTurn?.utterance).toContain("这个实验");
    expect(result.peerTurn?.utterance).not.toContain("蜡烛");
  });
});
