import { describe, expect, it } from "vitest";
import { classroomExperiments } from "@physics-lab/knowledge/classroom";
import { highSchoolExperiments } from "@physics-lab/knowledge/high-school";
import { experimentTaskPath } from "./taskRoutes";

describe("classroom experiment launch routes", () => {
  it.each(classroomExperiments)("preserves the $id route and its apparatus selection", (experiment) => {
    const source = new URL(experiment.path, "http://local");
    const actual = new URL(experimentTaskPath(experiment.id, "task /?&中文", "session #=+"), "http://local");
    expect(actual.pathname).toBe(source.pathname);
    for (const [key, value] of source.searchParams) expect(actual.searchParams.get(key)).toBe(value);
    expect(actual.searchParams.get("taskId")).toBe("task /?&中文");
    expect(actual.searchParams.get("sessionId")).toBe("session #=+");
    expect(actual.searchParams.getAll("taskId")).toHaveLength(1);
    expect(actual.hash).toBe("");
    if (experiment.stage === "high-school") expect(actual.pathname).toBe(`/high-school/experiments/${experiment.id}`);
  });

  it("does not expose planned or unknown experiments through a classroom link", () => {
    for (const id of [undefined, "missing", ...highSchoolExperiments.filter(({ status }) => status === "planned").map(({ id }) => id)]) {
      expect(experimentTaskPath(id, "task-1", "session-1")).toBe("/student?taskId=task-1&sessionId=session-1");
    }
  });
});
