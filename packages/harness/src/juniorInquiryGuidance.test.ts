import { describe, expect, it } from "vitest";
import { createHarnessSession, getHarnessQuickQuestions, RuleBasedDialogueAssistant } from "./index";
import type { HarnessApparatusContext, HarnessArea } from "./index";

const assistant = new RuleBasedDialogueAssistant();

const cases: { module: string; area: HarnessArea; required: string[]; excluded: RegExp }[] = [
  {
    module: "mechanics-buoyancy", area: "mechanics",
    required: ["同一物体", "完全浸没", "静止", "不碰底", "只更换液体", "G−F′"],
    excluded: /自由释放|改变物体平均密度/
  },
  {
    module: "thermal-boiling", area: "thermal",
    required: ["水量、加热功率和初温不变", "气压", "20 kPa", "保存", "沸点"],
    excluded: /改变质量|改变功率|改变水量|质量、功率或环境/
  },
  {
    module: "thermal-evaporation", area: "thermal",
    required: ["50 g", "温度", "液面面积", "空气流动", "其余两个保持不变", "三因素", "失重", "g/min"],
    excluded: /初温相同|改变质量|改变功率|质量、功率或环境/
  }
];

describe.each([false, true])("junior inquiry quick questions with live apparatus=%s", (withApparatus) => {
  it.each(cases)("uses achievable controlled comparisons for $module", ({ module, area, required, excluded }) => {
    // Exercise the actual quick-question route, including its precedence over the generic state adapter.
    const question = getHarnessQuickQuestions(module, area).find((item) => item === "哪些量要保持不变？");
    expect(question).toBeDefined();
    const apparatus: HarnessApparatusContext | undefined = withApparatus ? {
      current: {
        module, capturedAt: "2026-11-11T00:00:00.000Z", origin: "system",
        controls: [], apparatus: [], readings: [], derived: [],
        validity: { ready: false, issues: ["尚未形成完整对照证据"] }
      }
    } : undefined;
    const reply = assistant.respondToQuestion(createHarnessSession(area, "inquiry-guidance"), module, question!, apparatus);
    expect(reply.intent).toBe("compare");
    for (const term of required) expect(reply.text).toContain(term);
    expect(reply.text).not.toMatch(excluded);
  });
});
