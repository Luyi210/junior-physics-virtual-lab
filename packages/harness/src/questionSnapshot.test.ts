import { describe, expect, it } from "vitest";
import { appendDialogueExchange, createHarnessSession, validateHarnessSession } from "./index";

describe("persisted question snapshots", () => {
  it("accepts legacy dialogue and stores a separate copy of bounded optional snapshot evidence", () => {
    const snapshot = { capturedAt: "2026-11-12T00:00:00.000Z", apparatusAvailable: true, evidence: ["控件 · 频率：400Hz"], changedWhileWaiting: false };
    const reply = { intent: "method" as const, text: "先观察", followUps: [] };
    const legacy = appendDialogueExchange(createHarnessSession("sound"), "sound-features", "怎么做？", reply);
    expect(validateHarnessSession(legacy).valid).toBe(true);
    const next = appendDialogueExchange(legacy, "sound-features", "怎么做？", { ...reply, contextSnapshot: snapshot });
    snapshot.evidence[0] = "后来变化";
    expect(next.dialogue?.at(-1)?.contextSnapshot?.evidence).toEqual(["控件 · 频率：400Hz"]);
    expect(validateHarnessSession(next).valid).toBe(true);
  });

  it.each([{ evidence: Array(7).fill("value") }, { evidence: ["a".repeat(201)] }, { capturedAt: "invalid" }, { apparatusAvailable: "yes" }, { changedWhileWaiting: null }])("rejects malformed or unbounded saved evidence %j", (change) => {
    const session = appendDialogueExchange(createHarnessSession("sound"), "sound-features", "怎么做？", {
      intent: "method", text: "先观察", followUps: [], contextSnapshot: { capturedAt: "2026-11-12T00:00:00.000Z", apparatusAvailable: true, evidence: [], changedWhileWaiting: false },
    });
    Object.assign(session.dialogue!.at(-1)!.contextSnapshot!, change);
    expect(validateHarnessSession(session).valid).toBe(false);
  });
});
