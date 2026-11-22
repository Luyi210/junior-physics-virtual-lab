import { describe, expect, it } from "vitest";
import { defaultHighSchoolParameters } from "@physics-lab/physics/high-school";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import { getLiliCoachState } from "./lili";

function context(id: string): LiliExperimentContext {
  return { experimentId: id, parameters: defaultHighSchoolParameters(id as Parameters<typeof defaultHighSchoolParameters>[0]), timeSeconds: 0, recordCount: 0 };
}

describe("Lili live coaching state", () => {
  it("responds to a changed apparatus condition without judging earlier records", () => {
    const current = context("pendulum");
    current.parameters.amplitudeDegrees = 20;
    const blocked = getLiliCoachState(current);
    expect(blocked.stage).toBe("check");
    expect(blocked.issue).toContain("超过10°");
    expect(blocked.next).toContain("旧记录");
    current.parameters.amplitudeDegrees = 5;
    const corrected = getLiliCoachState(current);
    expect(corrected.stage).toBe("observe");
    expect(corrected.issue).toBeNull();
  });

  it("separates an actual saved sample from a bare record count", () => {
    const current = context("spring-force");
    current.recordCount = 12;
    const countOnly = getLiliCoachState(current);
    expect(countOnly.stage).toBe("review");
    expect(countOnly.summary).toContain("没有收到具体采样");
    current.samples = [{ id: "one", parameters: { ...current.parameters }, timeSeconds: 0 }];
    const supplied = getLiliCoachState(current);
    expect(supplied.modelSamples).toBe(1);
    expect(supplied.modelRecordCount).toBe(12);
    expect(supplied.summary).toContain("1 条自动模型采样");
    expect(supplied.next).toContain("保存时的条件");
  });

  it("distinguishes observation time from saved evidence", () => {
    const current = context("projectile-motion");
    current.timeSeconds = .2;
    const coaching = getLiliCoachState(current);
    expect(coaching.stage).toBe("record");
    expect(coaching.timeSeconds).toBeCloseTo(.2);
    expect(coaching.modelSamples).toBe(0);
    expect(coaching.question).toBe("我应该记录哪些证据？");
    expect(getLiliCoachState(null).stage).toBe("choose");
  });

  it("offers a variable-specific prediction before evidence and a bounded conclusion challenge after it", () => {
    const current = context("spring-force");
    const before = getLiliCoachState(current);
    expect(before.variables?.independent).toContain("悬挂总质量");
    expect(before.challenge?.kind).toBe("假设");
    expect(before.challenge?.prompt).toContain("伸长量x=L−L₀");
    current.recordCount = 1;
    current.samples = [{ id: "one", parameters: { ...current.parameters }, timeSeconds: 0 }];
    const after = getLiliCoachState(current);
    expect(after.challenge?.kind).toBe("结论");
    expect(after.challenge?.prompt).toContain("哪些情况还不能外推");
    const blocked = context("pendulum");
    blocked.parameters.amplitudeDegrees = 20;
    expect(getLiliCoachState(blocked).challenge).toBeNull();
  });
});
