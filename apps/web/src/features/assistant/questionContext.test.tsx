import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { appendDialogueExchange, createHarnessSession } from "@physics-lab/harness";
import type { HarnessApparatusContext } from "@physics-lab/harness";
import { apparatusSignature, captureQuestionContext, completedHintLevel } from "./questionContext";
import { QuestionEvidence } from "./QuestionEvidence";

describe("question evidence and explicit hint progress", () => {
  it("caps evidence size, distinguishes model output and never turns missing values into measurements", () => {
    const context: HarnessApparatusContext = { current: { module: "bench", capturedAt: new Date().toISOString(), origin: "system", controls: [], apparatus: [], readings: [],
      derived: Array.from({ length: 20 }, (_, index) => ({ id: String(index), label: "a".repeat(300), value: null, source: "model" })), validity: { ready: false, issues: ["装置未就绪"] } } };
    const snapshot = captureQuestionContext(context);
    expect(snapshot.evidence).toHaveLength(6); expect(snapshot.evidence.every((item) => item.length <= 200)).toBe(true);
    expect(snapshot.evidence[0]).toContain("模型推导"); expect(snapshot.evidence.at(-1)).toContain("装置未就绪");
    const signature = apparatusSignature(context); context.current.capturedAt = "2030-01-01T00:00:00.000Z";
    expect(apparatusSignature(context)).toBe(signature);
    context.current.validity.ready = true; expect(apparatusSignature(context)).not.toBe(signature);
  });

  it("only reflects explicit completed hints from the active module, ignoring regular questions and incomplete turns", () => {
    let session = createHarnessSession("sound"); const reply = { intent: "method" as const, text: "提示", followUps: [] };
    session = appendDialogueExchange(session, "sound-features", "给我一级提示", reply);
    session = appendDialogueExchange(session, "sound-features", "我下一步怎么做？", reply);
    session = appendDialogueExchange(session, "sound-medium", "给我三级提示", reply);
    expect(completedHintLevel(session.dialogue!, "sound-features")).toBe(1);
    expect(completedHintLevel(session.dialogue!, "sound-medium")).toBe(3);
    expect(completedHintLevel(session.dialogue!, "bench")).toBe(0);
    session.dialogue!.push({ id: "unanswered", role: "learner", module: "sound-features", text: "给我三级提示", createdAt: new Date().toISOString() });
    expect(completedHintLevel(session.dialogue!, "sound-features")).toBe(1);
  });

  it("renders historical grounding with a changed-state notice and a new-context retry", () => {
    const html = renderToStaticMarkup(<QuestionEvidence snapshot={{ capturedAt: "2026-11-12T00:00:00.000Z", apparatusAvailable: true, evidence: ["控件 · 频率：400Hz"], changedWhileWaiting: true }} onAskAgain={() => {}} disabled />);
    expect(html).toContain("这条回答仍对应提问时的状态"); expect(html).toContain("控件 · 频率：400Hz");
    expect(html).toContain("模型推导、操作记录不等于你亲手测得的数据"); expect(html).toContain("按现在的装置再问"); expect(html).toContain("disabled");
    expect(renderToStaticMarkup(<QuestionEvidence snapshot={captureQuestionContext()} />)).toContain("不能核实当前读数");
  });
});
