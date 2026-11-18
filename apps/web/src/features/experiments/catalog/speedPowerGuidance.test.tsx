import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createHarnessSession, getHarnessQuickQuestions, RuleBasedDialogueAssistant, type HarnessApparatusContext, type HarnessArea } from "@physics-lab/harness";
import { analyzeTargetVariableComparison, calculateInclinedCartRun } from "@physics-lab/physics";
import { physicsKnowledgeGraph } from "@physics-lab/knowledge";
import { ElectricPowerLab } from "../circuit/ElectricPowerLab";
import { createPowerLabState, powerLabLiveState, powerLabReducer, savablePowerMeasurement, type PowerApplianceKey } from "../circuit/powerLabState";
import { SpeedLab } from "../mechanics/SpeedLab";
import { scienceModules } from "./scienceCatalog";

const assistant = new RuleBasedDialogueAssistant();
function answer(module: "mechanics-speed" | "circuit-power", question: string, withApparatus = true) {
  const area: HarnessArea = module === "mechanics-speed" ? "mechanics" : "circuit";
  const apparatus: HarnessApparatusContext | undefined = withApparatus ? {
    current: { module, capturedAt: "2026-11-11T00:00:00.000Z", origin: "system", controls: [], apparatus: [], readings: [], derived: [], validity: { ready: false, issues: ["等待安装仪器"] } }
  } : undefined;
  return assistant.respondToQuestion(createHarnessSession(area, "achievable-guidance"), module, question, apparatus);
}

describe.each([false, true])("speed and power guidance with live apparatus=%s", (withApparatus) => {
  it("answers the actual first-step question with available speed controls", () => {
    const reply = answer("mechanics-speed", "先做什么？", withApparatus);
    expect(reply.intent).toBe("method");
    expect(reply.text).toContain("安装起点门和终点门");
    expect(reply.text).toContain("从静止释放");
    expect(reply.text).toContain("时间是测量结果");
    expect(reply.text).not.toMatch(/固定路程改变时间|固定时间改变路程/);
  });

  it("keeps the cart interval fixed in the actual comparison quick question", () => {
    const question = getHarnessQuickQuestions("mechanics-speed", "mechanics").find((text) => text === "哪些量要保持不变？")!;
    const reply = answer("mechanics-speed", question, withApparatus);
    expect(reply.intent).toBe("compare");
    expect(reply.text).toContain("保持光电门间路程和同一小车不变");
    expect(reply.text).toContain("只改变轨道高度至少0.1 m");
    expect(reply.text).toContain("只改变路程不计入高度对照");
  });

  it("starts power with connected meters and completed measurements, not an independent current control", () => {
    const reply = answer("circuit-power", "先做什么？", withApparatus);
    expect(reply.intent).toBe("method");
    expect(reply.text).toContain("串联电流表、并联电压表和电能计时器");
    expect(reply.text).toContain("固定同一用电器");
    expect(reply.text).toContain("计时结束后保存");
    expect(reply.text).toContain("只观察保护锁定");
    expect(reply.text).not.toMatch(/固定电压改变电流|电压和电流组合/);
  });

  it("requires both power comparisons rather than just swapping appliances", () => {
    const question = getHarnessQuickQuestions("circuit-power", "circuit").find((text) => text === "哪些量要保持不变？")!;
    const reply = answer("circuit-power", question, withApparatus);
    expect(reply.intent).toBe("compare");
    expect(reply.text).toContain("固定工作时间，只改变安全电压至少1.5 V");
    expect(reply.text).toContain("固定电压，只改变工作时间至少10 s");
    expect(reply.text).toContain("只换用电器不计入核心对照");
    expect(reply.text).toContain("断电后的实时零读数不替代该组测量");
  });
});

describe("guidance examples are executable with the actual controls and evidence rules", () => {
  it("derives the advertised speed comparison from supported controls and measured times", () => {
    const reply = answer("mechanics-speed", "先做什么？").text;
    const setup = reply.match(/路程([\d.]+) m、轨道高度([\d.]+) m/)!;
    const nextHeight = reply.match(/高度从[\d.]+ m改为([\d.]+) m/)!;
    expect(setup).not.toBeNull();
    expect(nextHeight).not.toBeNull();
    const length = Number(setup[1]);
    const beforeHeight = Number(setup[2]);
    const afterHeight = Number(nextHeight[1]);
    const controls = renderToStaticMarkup(<SpeedLab />);
    for (const value of [length, beforeHeight, afterHeight]) expect(controls).toContain(`>${value.toFixed(1)} m</button>`);
    const before = calculateInclinedCartRun(length, beforeHeight);
    const after = calculateInclinedCartRun(length, afterHeight);
    const comparison = analyzeTargetVariableComparison([length, beforeHeight], [length, afterHeight], before.averageSpeed, after.averageSpeed, 1, .1, "same-direction", .0001);
    expect(comparison.validTargetComparison).toBe(true);
    expect(after.timeSeconds).toBeLessThan(before.timeSeconds);
    expect(after.averageSpeed).toBeCloseTo(length / after.timeSeconds, 12);
    // Keeping height fixed and changing only distance must not complete this task.
    const otherDistance = calculateInclinedCartRun(.8, beforeHeight);
    expect(analyzeTargetVariableComparison([length, beforeHeight], [.8, beforeHeight], before.averageSpeed, otherDistance.averageSpeed, 1, .1, "same-direction", .0001).validTargetComparison).toBe(false);
  });

  const completePowerRun = (voltage: number, seconds: number, appliance: PowerApplianceKey = "lamp") => {
    let run = powerLabReducer(createPowerLabState(), { type: "appliance", key: appliance });
    for (const instrument of ["ammeter", "voltmeter", "energy"] as const) run = powerLabReducer(run, { type: "connection", instrument });
    run = powerLabReducer(run, { type: "voltage", value: voltage });
    run = powerLabReducer(run, { type: "duration", value: seconds });
    run = powerLabReducer(run, { type: "toggle" });
    expect(powerLabLiveState(run).conducting).toBe(true);
    run = powerLabReducer(run, { type: "tick", seconds });
    expect(powerLabLiveState(run).current).toBe(0);
    expect(powerLabLiveState(run).power).toBe(0);
    const measurement = savablePowerMeasurement(run);
    expect(measurement).not.toBeNull();
    return measurement!;
  };

  it("executes the three recommended power runs and produces both required evidence pairs", () => {
    const reply = answer("circuit-power", "先做什么？").text;
    const conditions = [...reply.matchAll(/([\d.]+) V、(\d+) s/g)].map((match) => ({ voltage: Number(match[1]), seconds: Number(match[2]) }));
    expect(conditions).toHaveLength(3);
    const controls = renderToStaticMarkup(<ElectricPowerLab />);
    for (const condition of conditions) {
      expect(controls).toContain(`>${condition.voltage} V</button>`);
      expect(controls).toContain(`>${condition.seconds} s</button>`);
    }
    const [baseline, voltageRun, timeRun] = conditions.map(({ voltage, seconds }) => completePowerRun(voltage, seconds));
    const attributes = (row: NonNullable<ReturnType<typeof savablePowerMeasurement>>) => [row.appliance, row.voltage, row.seconds];
    expect(analyzeTargetVariableComparison(attributes(baseline!), attributes(voltageRun!), baseline!.power, voltageRun!.power, 1, 1.5, "same-direction", .001).validTargetComparison).toBe(true);
    expect(analyzeTargetVariableComparison(attributes(baseline!), attributes(timeRun!), baseline!.energy, timeRun!.energy, 2, 10, "same-direction", .001).validTargetComparison).toBe(true);
    expect(baseline!.power).toBe(3);
    expect(baseline!.energy).toBe(90);
    expect(timeRun!.energy).toBe(180);
    // The UI compares saved pairs: the last run is compared with the retained baseline,
    // not with the immediately preceding run that differs in both voltage and duration.
    expect(analyzeTargetVariableComparison(attributes(voltageRun!), attributes(timeRun!), voltageRun!.energy, timeRun!.energy, 2, 10, "same-direction", .001).validTargetComparison).toBe(false);
    const changedAppliance = completePowerRun(baseline!.voltage, baseline!.seconds, "motor");
    expect(analyzeTargetVariableComparison(attributes(baseline!), attributes(changedAppliance), baseline!.power, changedAppliance.power, 1, 1.5, "same-direction", .001).validTargetComparison).toBe(false);
  });

  it("keeps the protection demonstration nonconducting and requires safe recovery", () => {
    let run = createPowerLabState();
    for (const instrument of ["ammeter", "voltmeter", "energy"] as const) run = powerLabReducer(run, { type: "connection", instrument });
    run = powerLabReducer(run, { type: "voltage", value: 7.5 });
    run = powerLabReducer(run, { type: "toggle" });
    expect(powerLabLiveState(run).unsafe).toBe(true);
    expect(powerLabLiveState(run).conducting).toBe(false);
    expect(savablePowerMeasurement(run)).toBeNull();
    run = powerLabReducer(run, { type: "voltage", value: 6 });
    expect(powerLabLiveState(run).unsafe).toBe(false);
  });
});

describe("catalog, graph and evidence hints agree with the experiment task", () => {
  it("keeps speed hints on one measured interval and a height comparison", () => {
    const catalog = scienceModules.mechanics.find((item) => item.key === "mechanics-speed")!;
    const graph = physicsKnowledgeGraph.find((item) => item.id === "mechanics-speed")!;
    const records = answer("mechanics-speed", "我应该记录哪些证据？").text;
    const hint = answer("mechanics-speed", "给我二级提示").text;
    for (const text of [catalog.guide.join(""), graph.guidance + graph.evidence, records, hint]) {
      expect(text).toContain("高度");
      expect(text).toContain("0.1 m");
      expect(text).not.toMatch(/固定时间改变路程|固定路程改变时间|把各段路程、时间分别相加/);
    }
  });

  it("keeps power evidence and hints on two independent comparisons plus safety", () => {
    const catalog = scienceModules.circuit.find((item) => item.key === "circuit-power")!;
    const graph = physicsKnowledgeGraph.find((item) => item.id === "circuit-power")!;
    const records = answer("circuit-power", "我应该记录哪些证据？").text;
    for (const text of [catalog.guide.join(""), graph.guidance + graph.evidence, records]) {
      expect(text).toContain("同一用电器");
      expect(text).toContain("1.5 V");
      expect(text).toContain("10 s");
      expect(text).toContain("完成快照");
      expect(text).toContain("7.5 V");
      expect(text).not.toContain("固定电压改变电流");
    }
    const hint = answer("circuit-power", "给我二级提示").text;
    expect(hint).toContain("先固定时间，只改变安全电压");
    expect(hint).toContain("再固定电压，只改变工作时间");
  });
});
