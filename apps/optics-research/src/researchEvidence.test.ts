import { describe, expect, it } from "vitest";
import { comparisonReady } from "./researchEvidence";
import type { LabTrial, TaskId } from "./researchModel";

function trial(taskId: TaskId, values: LabTrial["values"]): LabTrial {
  return { id: Math.random().toString(36), createdAt: "2026-08-18T00:00:00.000Z", taskId, summary: "test", values };
}

describe("ECD关键对照门槛", () => {
  it("反射任务拒绝重复同一角度", () => {
    const records = [10, 10, 10].map((angle) => trial("reflection", { incidentAngle: angle, reflectionAngle: angle }));
    expect(comparisonReady("reflection", records)).toBe(false);
    records.push(trial("reflection", { incidentAngle: 30, reflectionAngle: 30 }), trial("reflection", { incidentAngle: 50, reflectionAngle: 50 }));
    expect(comparisonReady("reflection", records)).toBe(true);
  });

  it("透镜任务要求跨越三个物距区间并出现清晰实像", () => {
    const records = [
      trial("bench", { objectDistance: 5, focused: false }),
      trial("bench", { objectDistance: 15, focused: true }),
      trial("bench", { objectDistance: 28, focused: false })
    ];
    expect(comparisonReady("bench", records)).toBe(true);
    expect(comparisonReady("bench", records.slice(1))).toBe(false);
  });

  it("色散任务要求比较复色光与单色光", () => {
    expect(comparisonReady("dispersion", [trial("dispersion", { source: "white", landingCount: 6 }), trial("dispersion", { source: "white", landingCount: 6 })])).toBe(false);
    expect(comparisonReady("dispersion", [trial("dispersion", { source: "white", landingCount: 6 }), trial("dispersion", { source: "red", landingCount: 1 })])).toBe(true);
  });

  it("视力矫正任务必须保留基线并比较两种镜片", () => {
    const records = ["none", "concave", "convex"].map((lens) => trial("correction", { lens }));
    expect(comparisonReady("correction", records)).toBe(true);
    expect(comparisonReady("correction", records.slice(1))).toBe(false);
  });
});
