import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLocalLearnerMemories, recordLearnerMemoryDrafts, removeLocalLearnerMemory } from "./learnerMemoryStore";
import { loadLocalBktStates, recordLocalBktAttempt } from "./bktMasteryStore";

const entries = new Map<string, string>();

beforeEach(() => {
  entries.clear();
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); }
  } });
});

afterEach(() => vi.unstubAllGlobals());

describe("agent local records follow the selected learner archive", () => {
  it("does not expose another account's memories or import the former grade-only archive", () => {
    const draft = { scope: "junior" as const, experimentId: "lens", kind: "goal" as const, topic: "成像", summary: "研究物距" };
    const first = recordLearnerMemoryDrafts("junior", "student:school:a", [draft]);
    entries.set("gewu-agent-memories-v1:junior", JSON.stringify(first));
    expect(first).toHaveLength(1);
    expect(loadLocalLearnerMemories("junior", "student:school:b")).toEqual([]);
    expect(loadLocalLearnerMemories("junior", null)).toEqual([]);
    expect(recordLearnerMemoryDrafts("junior", null, [draft])).toEqual([]);
    expect(removeLocalLearnerMemory("junior", "student:school:b", first[0]!.id)).toEqual([]);
    expect(loadLocalLearnerMemories("junior", "student:school:a")).toHaveLength(1);
  });

  it("keeps quiz estimates separate for each account and grade", () => {
    const first = recordLocalBktAttempt("high-school", "account:school:a", "hs-pendulum", true);
    expect(first[0]?.attempts).toBe(1);
    expect(loadLocalBktStates("high-school", "account:school:b")).toEqual([]);
    expect(loadLocalBktStates("junior", "account:school:a")).toEqual([]);
    expect(recordLocalBktAttempt("high-school", null, "hs-pendulum", true)).toEqual([]);
    expect(loadLocalBktStates("high-school", "account:school:a")[0]?.attempts).toBe(1);
  });
});
