import { describe, expect, it } from "vitest";
import { analyzeHarnessDraft, appendDialogueExchange, buildHarnessTutorialActions, createHarnessExperimentSummary, createHarnessObservation, createHarnessSession, diagnoseHarnessExperiment, findHarnessMisconception, getHarnessCoachAlert, getHarnessConceptMemory, getHarnessConceptNode, getHarnessKnowledgeMastery, getHarnessLearnerModel, getHarnessLearningBranch, getHarnessReviewSchedule, getRecommendedHarnessHintLevel, harnessSessionToXAPIStatements, listHarnessConceptNodes, processHarnessEvent, reviewHarnessConclusionText, reviewHarnessEvidenceText, reviewHarnessHypothesisText, reviewHarnessReasoningText, RuleBasedDialogueAssistant, RuleBasedLearningAssistant, understandHarnessQuestion, validateHarnessSession, validateHarnessTutorialActions } from "./index";
import type { HarnessApparatusContext, HarnessApparatusSnapshot } from "./index";

const assistant = new RuleBasedLearningAssistant();
const dialogueAssistant = new RuleBasedDialogueAssistant();

describe("rule based learning harness", () => {
  it("creates a domain orientation when entering an experiment", () => {
    const session = processHarnessEvent(createHarnessSession("circuit", "test", "2026-01-01T00:00:00.000Z"), {
      type: "module.entered",
      payload: { module: "circuit" },
      occurredAt: "2026-01-01T00:00:01.000Z"
    }, assistant);
    expect(session.events).toHaveLength(1);
    expect(session.insights[0]?.ruleId).toBe("orientation-on-entry");
    expect(session.insights[0]?.message).toContain("串联");
  });

  it("suggests a controlled comparison after repeated changes", () => {
    let session = createHarnessSession("sound", "test");
    for (let index = 0; index < 3; index += 1) {
      session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: index + 1 } }, assistant);
    }
    expect(session.insights.some((item) => item.ruleId === "change-one-variable")).toBe(true);
  });

  it("turns a learner note into evidence-oriented feedback", () => {
    const session = createHarnessObservation(createHarnessSession("thermal", "test"), "水沸腾后温度基本不再升高。", assistant);
    expect(session.observations).toHaveLength(1);
    expect(session.events.at(-1)?.type).toBe("observation.created");
    expect(session.insights.some((item) => item.ruleId === "compare-after-observation")).toBe(true);
  });

  it("connects 3D camera navigation back to the measurement plane", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), {
      type: "scene.navigated",
      payload: { experiment: "reflection", action: "rotate", angle: 35 }
    }, assistant);
    expect(session.insights.some((item) => item.ruleId === "three-dimensional-view-is-not-a-new-law")).toBe(true);
  });

  it("suggests comparing presets after two distinct 3D views", () => {
    let session = createHarnessSession("optics", "test");
    session = processHarnessEvent(session, { type: "view.changed", payload: { experiment: "refraction", view: "front" } }, assistant);
    session = processHarnessEvent(session, { type: "view.changed", payload: { experiment: "refraction", view: "top" } }, assistant);
    expect(session.insights.some((item) => item.ruleId === "compare-spatial-view-presets")).toBe(true);
  });

  it("connects the black-hole extension back to straight-line propagation", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), {
      type: "control.changed",
      payload: { experiment: "black-hole", control: "光线与黑洞中心的距离", value: 120 }
    }, assistant);
    expect(session.insights.some((item) => item.ruleId === "black-hole-extends-straight-light")).toBe(true);
  });

  it("answers a method question with current experiment context", () => {
    let session = createHarnessSession("circuit", "test");
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "电源电压", value: 9, unit: "V" } }, assistant);
    const reply = dialogueAssistant.respondToQuestion(session, "circuit-basic", "下一步应该观察什么？");
    expect(reply.intent).toBe("method");
    expect(reply.text).toContain("电源电压");
    expect(reply.text).toContain("完整路径");
  });

  it("explains the wider question menu without pretending to be an unrestricted chatbot", () => {
    const session = createHarnessSession("measurement", "test");
    const reply = dialogueAssistant.respondToQuestion(session, "measurement-balance", "光光能回答哪些问题？");
    expect(reply.intent).toBe("orientation");
    expect(reply.text).toContain("九类问题");
    expect(reply.text).toContain("不会编造");
  });

  it("understands natural operation and observation questions across domains", () => {
    const measurement = dialogueAssistant.respondToQuestion(createHarnessSession("measurement", "test"), "measurement-balance", "我第一次用天平，到底先干嘛呀？");
    const sound = dialogueAssistant.respondToQuestion(createHarnessSession("sound", "test"), "sound-features", "这个画面我主要看哪里？");
    expect(measurement.intent).toBe("method");
    expect(measurement.text).toContain("空载归零调平");
    expect(sound.text).toContain("波形的高度、疏密");
    expect(sound.text).toContain("事实");
  });

  it("answers variable, evidence and calculation questions with module-specific scaffolds", () => {
    const circuit = dialogueAssistant.respondToQuestion(createHarnessSession("circuit", "test"), "circuit-ohm", "哪些量要保持不变？");
    const evidence = dialogueAssistant.respondToQuestion(createHarnessSession("sound", "test"), "sound-medium", "数据表里到底要记录什么？");
    const pressure = dialogueAssistant.respondToQuestion(createHarnessSession("mechanics", "test"), "mechanics-pressure", "压强应该怎么算？");
    expect(circuit.intent).toBe("compare");
    expect(circuit.text).toContain("自变量");
    expect(evidence.text).toContain("证据检查");
    expect(pressure.text).toContain("p=F/S");
  });

  it("offers troubleshooting and real-lab safety guidance without inventing results", () => {
    const optics = dialogueAssistant.respondToQuestion(createHarnessSession("optics", "test"), "bench", "为什么光屏上看不到清晰的像？");
    const thermal = dialogueAssistant.respondToQuestion(createHarnessSession("thermal", "test"), "thermal-boiling", "做真实实验有什么危险和注意事项？");
    expect(optics.intent).toBe("method");
    expect(optics.text).toContain("三层检查");
    expect(optics.text).toContain("器材同轴且等高");
    expect(thermal.text).toContain("防止烫伤");
    expect(thermal.text).toContain("真实器材操作规范");
  });

  it("still refuses unrelated questions outside the current experiment rules", () => {
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("sound", "test"), "sound-features", "今天午饭吃什么比较好？");
    expect(reply.text).toContain("超出了");
    expect(reply.text).toContain("不会猜测");
  });

  it("normalizes learner speech and extracts physics entities before dialogue routing", () => {
    const understood = understandHarnessQuestion("sound", "sound-features", "我刚昂把频率调高了，咋没更响？");
    expect(understood.normalizedText).toContain("刚刚");
    expect(understood.normalizedText).toContain("怎么");
    expect(understood.inScope).toBe(true);
    expect(understood.intent).toBe("principle");
    expect(understood.entities).toContainEqual({ type: "quantity", value: "频率" });
    expect(understood.entities).toContainEqual({ type: "change", value: "调高" });
  });

  it("understands more common classroom speech without an LLM", () => {
    const why = understandHarnessQuestion("circuit", "circuit-basic", "灯泡为啥没动静，咋回事？");
    const reading = understandHarnessQuestion("measurement", "measurement-balance", "这个数我读不出来");
    expect(why.normalizedText).toContain("为什么");
    expect(why.normalizedText).toContain("没现象");
    expect(why.intent).toBe("troubleshooting");
    expect(reading.normalizedText).toContain("看不到读数");
    expect(reading.inScope).toBe(true);
  });

  it("proactively selects the next coaching intervention from live evidence", () => {
    let session = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "sound-features" } }, assistant);
    expect(getHarnessCoachAlert(session, "sound-features").title).toContain("变量");
    expect(getRecommendedHarnessHintLevel(session, "sound-features")).toBe(1);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 300, unit: "Hz" } }, assistant);
    expect(getHarnessCoachAlert(session, "sound-features").title).toContain("第二组");
    expect(getRecommendedHarnessHintLevel(session, "sound-features")).toBe(2);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 600, unit: "Hz" } }, assistant);
    expect(getHarnessCoachAlert(session, "sound-features").title).toContain("写具体");
    expect(getRecommendedHarnessHintLevel(session, "sound-features")).toBe(3);
  });

  it("prioritizes an invalid live apparatus state over a generic learning suggestion", () => {
    const session = createHarnessSession("mechanics", "test");
    const context: HarnessApparatusContext = { current: {
      module: "mechanics-buoyancy", capturedAt: "2026-01-01T00:00:00.000Z", origin: "learner",
      controls: [], apparatus: [], readings: [], derived: [], validity: { ready: false, issues: ["物体接触杯底，必须先提离杯底。"] }
    } };
    const alert = getHarnessCoachAlert(session, "mechanics-buoyancy", context);
    expect(alert.severity).toBe("warning");
    expect(alert.message).toContain("杯底");
    expect(alert.target).toBe("controls");
  });

  it("classifies a draft as a question or an evidence note before submission", () => {
    const question = analyzeHarnessDraft("sound", "sound-features", "为什么频率升高了音量没变？");
    const evidence = analyzeHarnessDraft("sound", "sound-features", "保持振幅不变，频率从300Hz调到600Hz，音调更高。 ");
    const unrelated = analyzeHarnessDraft("sound", "sound-features", "今天午饭吃什么？");
    expect(question?.mode).toBe("question");
    expect(question?.signals).toContain("频率");
    expect(evidence?.mode).toBe("observation");
    expect(evidence?.observationQuality).toBeGreaterThanOrEqual(3);
    expect(unrelated?.mode).toBe("out-of-scope");
  });

  it("reviews an evidence sentence against four transparent criteria", () => {
    const complete = reviewHarnessEvidenceText("保持振幅不变，把频率从300Hz调到600Hz；我观察到音调比第一组更高。");
    const vague = reviewHarnessEvidenceText("声音变了。");
    expect(complete.score).toBe(4);
    expect(complete.items.every((item) => item.passed)).toBe(true);
    expect(vague.score).toBeLessThanOrEqual(1);
    expect(vague.missing).toContain("实验条件");
  });

  it("detects overgeneralized conclusions without pretending to judge physics correctness", () => {
    const absolute = reviewHarnessConclusionText("所以频率越高声音一定越响。");
    const bounded = reviewHarnessConclusionText("在保持振幅不变的条件下，根据两组观察，本实验中频率升高时音调变高。");
    expect(absolute.score).toBeLessThan(3);
    expect(absolute.risks.join(" ")).toContain("总是、一定");
    expect(bounded.score).toBe(4);
    expect(analyzeHarnessDraft("sound", "sound-features", "所以频率越高声音一定越响。")?.mode).toBe("conclusion");
  });

  it("returns a conclusion review that keeps reasoning scope explicit", () => {
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("sound", "test"), "sound-features", "检查这条结论：所以频率越高声音一定越响。");
    expect(reply.intent).toBe("reflect");
    expect(reply.text).toContain("结论审查");
    expect(reply.text).toContain("不能替代真实数据");
  });

  it("separates testable hypotheses from causal explanations before submission", () => {
    const hypothesis = reviewHarnessHypothesisText("如果只把频率从300Hz调到600Hz，保持振幅不变，那么我预测音调会变高；比较两组波形来检验。");
    const reasoning = reviewHarnessReasoningText("本实验保持振幅不变，两组数据显示频率升高时音调变高；因为频率表示每秒振动次数，所以这组证据支持频率影响音调。");
    expect(hypothesis.score).toBe(4);
    expect(reasoning.score).toBe(4);
    expect(analyzeHarnessDraft("sound", "sound-features", "如果把频率调高，我预测音调会变高。")?.mode).toBe("hypothesis");
    expect(analyzeHarnessDraft("sound", "sound-features", "因为频率表示每秒振动次数，所以音调会变高。")?.mode).toBe("reasoning");
  });

  it("reviews hypotheses and causal chains through transparent dialogue routes", () => {
    const session = createHarnessSession("sound", "test");
    const hypothesis = dialogueAssistant.respondToQuestion(session, "sound-features", "检查这条假设：如果把频率调高，那么我预测音调会变高。");
    const reasoning = dialogueAssistant.respondToQuestion(session, "sound-features", "检查这条因果推理链：因为频率表示每秒振动次数，所以音调会变高。");
    expect(hypothesis.text).toContain("假设审查");
    expect(hypothesis.text).toContain("不会在实验前把预测当成事实");
    expect(reasoning.text).toContain("因果链审查");
    expect(reasoning.text).toContain("不会因为句子里有“因为、所以”");
  });

  it("schedules retrieval practice only after a substantial evidence chain", () => {
    let session = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "sound-features" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    expect(getHarnessReviewSchedule(session, "sound-features", new Date("2026-01-20T00:00:00.000Z")).status).toBe("not-ready");
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 300 }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 600 }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    session = createHarnessObservation(session, "保持振幅不变，频率从300Hz调到600Hz，音调更高。", assistant);
    session = appendDialogueExchange(session, "sound-features", "为什么会这样？", { intent: "explain", text: "请连接振动频率与音调。", followUps: [] }, "2026-01-01T00:00:05.000Z");
    const schedule = getHarnessReviewSchedule(session, "sound-features", new Date("2027-01-10T00:00:00.000Z"));
    expect(schedule.status).toBe("due");
    expect(schedule.prompt).toContain("先不要给提示");
    expect(getHarnessCoachAlert(session, "sound-features").eyebrow).not.toContain("主动回忆");
    const retrieval = dialogueAssistant.respondToQuestion(session, "sound-features", schedule.prompt);
    expect(retrieval.text).toContain("无提示回忆模式");
  });

  it("summarizes cross-visit mastery evidence and remembers recurring misconceptions", () => {
    let session = createHarnessSession("optics", "test");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" } }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "入射角", value: 20 } }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "入射角", value: 40 } }, assistant);
    session = createHarnessObservation(session, "保持镜面不变，入射角从20度变为40度时，反射角也变大。", assistant);
    session = appendDialogueExchange(session, "reflection", "入射角是光线和镜面的夹角吗？", { intent: "explain", text: "请以法线为基准。", followUps: [] });
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" } }, assistant);
    session = appendDialogueExchange(session, "reflection", "入射角是光线和镜面的夹角吗？", { intent: "reflect", text: "用角度计重新核验。", followUps: [] });
    const mastery = getHarnessKnowledgeMastery(session, "reflection");
    expect(mastery.visits).toBe(2);
    expect(mastery.comparisons).toBe(1);
    expect(mastery.observations).toBe(1);
    expect(mastery.misconception?.count).toBe(2);
    expect(mastery.nextReview).toContain("反复出现");
    expect(getHarnessCoachAlert(session, "reflection").eyebrow).toContain("重复误区");
  });

  it("returns a structured evidence review without inventing missing measurements", () => {
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("sound", "test"), "sound-features", "检查这条观察：保持振幅不变，把频率从300Hz调到600Hz；音调更高。");
    expect(reply.intent).toBe("reflect");
    expect(reply.text).toContain("证据审查 4/4");
    expect(reply.text).toContain("不会把没有真实观察到的数据替你填进去");
  });

  it("keeps a transparent local memory of visits and misconception checks", () => {
    let session = createHarnessSession("optics", "test");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" } }, assistant);
    session = appendDialogueExchange(session, "reflection", "入射角是光线和镜面的夹角吗？", { intent: "explain", text: "检查法线。", followUps: [] });
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" } }, assistant);
    const memory = getHarnessConceptMemory(session, "reflection");
    expect(memory.visits).toBe(2);
    expect(memory.misconceptionChecks).toBe(1);
    expect(memory.line).toContain("概念辨析");
  });

  it("links misconception detection and scope confidence into the understanding layer", () => {
    const misconception = understandHarnessQuestion("measurement", "measurement-balance", "称量时可以调螺母吗？");
    const unrelated = understandHarnessQuestion("sound", "sound-features", "今天午饭吃什么比较好？");
    expect(misconception.intent).toBe("misconception");
    expect(misconception.confidence).toBeGreaterThan(.9);
    expect(misconception.matchedSignals[0]).toContain("balance-adjust-during");
    expect(unrelated.inScope).toBe(false);
    expect(unrelated.confidence).toBeLessThanOrEqual(.4);
  });

  it("maps short contextual classroom speech to a usable dialogue intent", () => {
    const understood = understandHarnessQuestion("mechanics", "mechanics-lever", "先干嘛？");
    expect(understood.normalizedText).toContain("先做什么");
    expect(understood.intent).toBe("procedure");
    expect(understood.dialogueIntent).toBe("method");
    expect(understood.inScope).toBe(true);
  });

  it("turns a guess into a testable prediction instead of judging it", () => {
    const session = createHarnessSession("thermal", "test");
    const reply = dialogueAssistant.respondToQuestion(session, "thermal-boiling", "我猜功率越大沸点越高，对吗？");
    expect(reply.intent).toBe("predict");
    expect(reply.text).toContain("先不判对错");
    expect(reply.followUps.length).toBeGreaterThan(0);
  });

  it("diagnoses the current module without borrowing controls from the previous experiment", () => {
    let session = createHarnessSession("optics", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "入射角", value: 30, unit: "°" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "refraction" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    const diagnosis = diagnoseHarnessExperiment(session, "refraction");
    expect(diagnosis.stage).toBe("orientation");
    expect(diagnosis.operationCount).toBe(0);
    expect(diagnosis.summary).not.toContain("入射角");
  });

  it("recognizes a comparison after one control receives two different values", () => {
    let session = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "sound-features" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 300, unit: "Hz" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 600, unit: "Hz" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    const diagnosis = diagnoseHarnessExperiment(session, "sound-features");
    expect(diagnosis.stage).toBe("comparing");
    expect(diagnosis.comparisonReady).toBe(true);
    expect(diagnosis.nextMove).toContain("记录");
  });

  it("builds a transparent learner model from operations, comparison and evidence", () => {
    let session = createHarnessSession("mechanics", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "mechanics-speed" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "运动时间", value: 10, unit: "s" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "运动时间", value: 20, unit: "s" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    session = createHarnessObservation(session, "路程相同时，20秒对应的平均速度更小。", assistant);
    const model = getHarnessLearnerModel(session, "mechanics-speed");
    expect(model.dimensions.find((item) => item.id === "comparison")?.score).toBe(100);
    expect(model.dimensions.find((item) => item.id === "evidence")?.score).toBeGreaterThan(0);
    expect(model.memoryLine).toContain("运动时间");
  });

  it("builds an honest experiment summary without inventing missing evidence", () => {
    let session = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "sound-features" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 300, unit: "Hz" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 600, unit: "Hz" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    const summary = createHarnessExperimentSummary(session, "sound-features");
    expect(summary.ready).toBe(true);
    expect(summary.changedConditions[0]).toContain("300Hz → 600Hz");
    expect(summary.evidence).toHaveLength(0);
    expect(summary.recordText).toContain("学生尚未保存观察证据");
    expect(summary.interpretation).toContain("不能");
  });

  it("places learner observations into a structured experiment summary", () => {
    let session = createHarnessSession("mechanics", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "mechanics-speed" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "运动时间", value: 10, unit: "s" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "运动时间", value: 20, unit: "s" }, occurredAt: "2026-01-01T00:00:03.000Z" }, assistant);
    session = createHarnessObservation(session, "路程相同时，20秒对应的平均速度更小。", assistant);
    const summary = createHarnessExperimentSummary(session, "mechanics-speed");
    expect(summary.evidence).toContain("路程相同时，20秒对应的平均速度更小。");
    expect(summary.recordText).toContain("研究问题：");
    expect(summary.recordText).toContain("暂时解释：");
    expect(summary.alreadySaved).toBe(false);
  });

  it("does not count an auto-generated summary as learner evidence", () => {
    let session = createHarnessSession("optics", "test", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, { type: "module.entered", payload: { module: "reflection" }, occurredAt: "2026-01-01T00:00:01.000Z" }, assistant);
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "入射角", value: 30, unit: "°" }, occurredAt: "2026-01-01T00:00:02.000Z" }, assistant);
    const generated = createHarnessExperimentSummary(session, "reflection");
    session = createHarnessObservation(session, generated.recordText, assistant);
    expect(diagnoseHarnessExperiment(session, "reflection").observationCount).toBe(0);
    expect(createHarnessExperimentSummary(session, "reflection").alreadySaved).toBe(true);
  });

  it("uses a Socratic scaffold when a learner asks for the answer directly", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), { type: "module.entered", payload: { module: "reflection" } }, assistant);
    const reply = dialogueAssistant.respondToQuestion(session, "reflection", "直接告诉我正确答案");
    expect(reply.intent).toBe("method");
    expect(reply.text).toContain("先不直接给答案");
    expect(reply.text).toContain("预测");
  });

  it("reveals help through a three-level scaffold without leaking the conclusion", () => {
    const session = processHarnessEvent(createHarnessSession("optics", "test"), { type: "module.entered", payload: { module: "refraction" } }, assistant);
    const first = dialogueAssistant.respondToQuestion(session, "refraction", "给我一级提示");
    const second = dialogueAssistant.respondToQuestion(session, "refraction", "给我二级提示");
    const third = dialogueAssistant.respondToQuestion(session, "refraction", "给我三级提示");
    expect(first.text).toContain("观察方向");
    expect(second.text).toContain("操作脚手架");
    expect(third.text).toContain("仍不替你写结论");
  });

  it("maps optics experiments to evidence-centered concept nodes", () => {
    const concepts = listHarnessConceptNodes("optics");
    const reflection = getHarnessConceptNode("reflection");
    expect(concepts.length).toBeGreaterThanOrEqual(14);
    expect(reflection?.prerequisites).toContain("入射点与法线");
    expect(reflection?.evidenceCriteria.some((item) => item.includes("法线"))).toBe(true);
    expect(reflection?.hintLadder).toHaveLength(3);
  });

  it("covers every current experiment domain with concept evidence and misconceptions", () => {
    const expectedCounts = { optics: 15, sound: 4, mechanics: 5, circuit: 4, thermal: 4, measurement: 4 } as const;
    Object.entries(expectedCounts).forEach(([area, count]) => {
      const concepts = listHarnessConceptNodes(area as keyof typeof expectedCounts);
      expect(concepts).toHaveLength(count);
      expect(concepts.every((concept) => concept.evidenceCriteria.length >= 3)).toBe(true);
      expect(concepts.every((concept) => concept.misconceptions.length >= 1)).toBe(true);
    });
    expect(listHarnessConceptNodes()).toHaveLength(36);
    expect(findHarnessMisconception("measurement-balance", "称量时可以调螺母吗")?.id).toBe("balance-adjust-during");
    expect(findHarnessMisconception("circuit-basic", "灯泡会把电流用掉一些吗")?.id).toBe("current-used-up");
  });

  it("can ground dialogue in a live apparatus snapshot for every experiment module", () => {
    listHarnessConceptNodes().forEach((concept) => {
      const context: HarnessApparatusContext = { current: {
        module: concept.module, capturedAt: "2026-01-01T00:00:00.000Z", origin: "learner",
        controls: [{ id: "test-control", label: "测试控制量", value: 12, unit: "格", source: "control" }],
        apparatus: [],
        readings: [{ id: "test-reading", label: "当前读数", value: "已形成现象", source: "reading" }],
        derived: [], validity: { ready: true, issues: [] }
      } };
      const reply = dialogueAssistant.respondToQuestion(createHarnessSession(concept.area, "coverage"), concept.module, "当前装置的读数和现象是什么？", context);
      expect(reply.text, concept.module).not.toContain("超出了我当前");
      expect(reply.text.length, concept.module).toBeGreaterThan(20);
    });
  });

  it("uses the generic state adapter to cite changed values and the module principle", () => {
    const snapshot = (angle: number): HarnessApparatusSnapshot => ({
      module: "reflection", capturedAt: "2026-01-01T00:00:00.000Z", origin: "learner",
      controls: [{ id: "angle", label: "入射角", value: angle, unit: "°", source: "control" }],
      apparatus: [], readings: [{ id: "reflection-angle", label: "反射角", value: angle, unit: "°", source: "reading" }],
      derived: [], validity: { ready: true, issues: [] }
    });
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("optics", "test"), "reflection", "当前角度为什么会这样变化？", { previous: snapshot(25), current: snapshot(40) });
    expect(reply.text).toContain("入射角：40°");
    expect(reply.text).toContain("由“25°”变为“40°”");
    expect(reply.text).toContain("反射角等于入射角");
  });

  it("offers an optional learning branch that advances with real experiment evidence", () => {
    let session = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    expect(getHarnessLearningBranch(session, "sound-features")?.id).toBe("observe");
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 300, unit: "Hz" } }, assistant);
    expect(getHarnessLearningBranch(session, "sound-features")?.id).toBe("compare");
    session = processHarnessEvent(session, { type: "control.changed", payload: { control: "频率", value: 600, unit: "Hz" } }, assistant);
    expect(getHarnessLearningBranch(session, "sound-features")?.id).toBe("evidence");
    session = createHarnessObservation(session, "振幅不变时，600Hz 比 300Hz 的音调更高。", assistant);
    expect(getHarnessLearningBranch(session, "sound-features")?.id).toBe("explain");
    session = appendDialogueExchange(session, "sound-features", "为什么这个观察支持声音特性的规律？", { intent: "explain", text: "请连接频率证据与音调。", followUps: [] });
    expect(getHarnessLearningBranch(session, "sound-features")?.id).toBe("transfer");
  });

  it("turns a life-and-technology connection into a transfer scaffold", () => {
    const session = createHarnessSession("sound", "test");
    const reply = dialogueAssistant.respondToQuestion(session, "sound-features", "乐器调音和这个实验有什么联系？");
    expect(reply.intent).toBe("explain");
    expect(reply.text).toContain("乐器调音");
    expect(reply.text).toContain("物理量");
    expect(reply.text).toContain("证据标准");
  });

  it("detects a common misconception and redirects it to an experiment check", () => {
    const misconception = findHarnessMisconception("reflection", "入射角是不是相对镜面量的？");
    expect(misconception?.id).toBe("angle-from-mirror");
    const session = processHarnessEvent(createHarnessSession("optics", "test"), { type: "module.entered", payload: { module: "reflection" } }, assistant);
    const reply = dialogueAssistant.respondToQuestion(session, "reflection", "入射角是光线和镜面的夹角吗？");
    expect(reply.intent).toBe("explain");
    expect(reply.text).toContain("常见混淆");
    expect(reply.text).toContain("法线");
    expect(reply.text).toContain("实验核对");
  });

  it("compiles a tutorial scene into validated speech, spotlight and wait actions", () => {
    const actions = buildHarnessTutorialActions({
      narration: "改变入射角，比较反射角。",
      target: "controls",
      hint: "请亲手改变一次入射角。",
      requiresInteraction: true,
      acceptedEvents: ["control.changed"],
      promptRecord: true
    });
    expect(actions.map((action) => action.type)).toEqual(["speech", "spotlight", "wait-for-event", "prompt-record"]);
    expect(validateHarnessTutorialActions(actions)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a tutorial wait action that cannot observe any experiment event", () => {
    const actions = buildHarnessTutorialActions({ narration: "请操作。", target: "controls", hint: "改变一个量。", requiresInteraction: true });
    const validation = validateHarnessTutorialActions(actions);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain("没有声明可接受事件");
  });

  it("persists a learner and assistant exchange with a trace event", () => {
    const base = createHarnessSession("sound", "test", "2026-01-01T00:00:00.000Z");
    const reply = dialogueAssistant.respondToQuestion(base, "sound-features", "为什么频率会影响音调？");
    const session = appendDialogueExchange(base, "sound-features", "为什么频率会影响音调？", reply, "2026-01-01T00:00:01.000Z");
    expect(session.dialogue).toHaveLength(2);
    expect(session.dialogue?.[1]?.role).toBe("assistant");
    expect(session.events[0]?.type).toBe("dialogue.asked");
  });

  it("validates and migrates an early local session without a version field", () => {
    const current = createHarnessSession("measurement", "test", "2026-01-01T00:00:00.000Z");
    const { schemaVersion: _version, ...legacy } = current;
    const result = validateHarnessSession(legacy);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.value.schemaVersion).toBe(1);
  });

  it("rejects a damaged stored session before it reaches the interface", () => {
    const result = validateHarnessSession({ ...createHarnessSession("sound"), area: "chemistry" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((error) => error.path === "$.area")).toBe(true);
  });

  it("projects experiment events into actor-verb-object xAPI statements", () => {
    let session = createHarnessSession("circuit", "learner-7", "2026-01-01T00:00:00.000Z");
    session = processHarnessEvent(session, {
      type: "module.entered",
      payload: { module: "circuit-ohm" },
      occurredAt: "2026-01-01T00:00:01.000Z"
    }, assistant);
    session = processHarnessEvent(session, {
      type: "control.changed",
      payload: { control: "导体两端电压", value: 6, unit: "V" },
      occurredAt: "2026-01-01T00:00:02.000Z"
    }, assistant);
    const statements = harnessSessionToXAPIStatements(session);
    expect(statements).toHaveLength(2);
    expect(statements[1]?.actor.account.name).toBe("learner-7");
    expect(statements[1]?.verb.display["zh-CN"]).toBe("调节了");
    expect(statements[1]?.object.id).toContain("circuit-ohm");
    expect(statements[1]?.result?.response).toBe("导体两端电压=6 V");
  });

  it("grounds a sound answer in the current and previous controls", () => {
    const snapshot = (frequency: number): HarnessApparatusSnapshot => ({
      module: "sound-features", capturedAt: "2026-01-01T00:00:00.000Z", origin: "learner",
      controls: [
        { id: "frequency", label: "振动频率", value: frequency, unit: "Hz", source: "control" },
        { id: "amplitude", label: "相对振幅", value: 42, unit: "%", source: "control" }
      ],
      apparatus: [{ id: "source-on", label: "声源开关", value: true, source: "apparatus" }],
      readings: [{ id: "pitch", label: "音调观察", value: frequency > 495 ? "音调较高" : "音调中等", source: "reading" }],
      derived: [], validity: { ready: true, issues: [] }
    });
    const context: HarnessApparatusContext = { previous: snapshot(330), current: snapshot(550) };
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("sound", "test"), "sound-features", "我刚才把频率调高以后为什么音调变了？", context);
    expect(reply.text).toContain("从 330 Hz调到 550 Hz");
    expect(reply.text).toContain("相对振幅为 42%");
    expect(reply.text).toContain("频率主要影响音调");
  });

  it("uses the live balance stage without leaking the hidden mass", () => {
    const context: HarnessApparatusContext = { current: {
      module: "measurement-balance", capturedAt: "2026-01-01T00:00:00.000Z", origin: "learner",
      controls: [
        { id: "rider", label: "游码示数", value: 2.1, unit: "g", source: "control" },
        { id: "nut-offset", label: "平衡螺母偏移", value: 0, unit: "格", source: "control" }
      ],
      apparatus: [
        { id: "calibrated", label: "空载调平", value: true, source: "apparatus" },
        { id: "object-placed", label: "待测物已放置", value: true, source: "apparatus" },
        { id: "weights-total", label: "砝码总质量", value: 130, unit: "g", source: "apparatus" },
        { id: "pointer", label: "指针状态", value: "左偏", source: "apparatus" },
        { id: "balanced", label: "称量平衡", value: false, source: "apparatus" }
      ],
      readings: [{ id: "measured-mass", label: "测得质量", value: null, unit: "g", source: "reading" }],
      derived: [{ id: "guidance", label: "当前操作建议", value: "已经接近平衡：移动游码微调。", source: "model" }],
      validity: { ready: false, issues: ["已经接近平衡：移动游码微调。"] }
    } };
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("measurement", "test"), "measurement-balance", "我现在为什么还不能读质量？", context);
    expect(reply.text).toContain("砝码合计 130 g");
    expect(reply.text).toContain("游码 2.1 g");
    expect(reply.text).toContain("不会提前给出");
    expect(reply.text).not.toContain("137.5");
  });

  it("diagnoses an incomplete circuit from its actual wiring state", () => {
    const context: HarnessApparatusContext = { current: {
      module: "circuit-basic", capturedAt: "2026-01-01T00:00:00.000Z", origin: "learner",
      controls: [
        { id: "topology", label: "连接方式", value: "并联", source: "control" },
        { id: "voltage", label: "电源电压", value: 9, unit: "V", source: "control" }
      ],
      apparatus: [
        { id: "connected-wires", label: "已接导线", value: 3, unit: "根", source: "apparatus" },
        { id: "required-wires", label: "所需导线", value: 5, unit: "根", source: "apparatus" },
        { id: "fully-wired", label: "回路接线完整", value: false, source: "apparatus" },
        { id: "switch-closed", label: "总开关闭合", value: false, source: "apparatus" },
        { id: "lamp1-connected", label: "L₁接通", value: true, source: "apparatus" },
        { id: "lamp2-connected", label: "L₂接通", value: true, source: "apparatus" }
      ],
      readings: [], derived: [], validity: { ready: false, issues: ["电路还差 2 根导线。"] }
    } };
    const reply = dialogueAssistant.respondToQuestion(createHarnessSession("circuit", "test"), "circuit-basic", "为什么灯泡不亮？", context);
    expect(reply.text).toContain("导线 3/5 根");
    expect(reply.text).toContain("还差 2 根导线");
    expect(reply.text).toContain("没有完整电流路径");
  });
});
