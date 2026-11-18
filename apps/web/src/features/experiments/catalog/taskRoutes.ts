import { getClassroomExperiment } from "@physics-lab/knowledge/classroom";

export function experimentTaskPath(experimentId: string | undefined, taskId: string, sessionId: string) {
  const path = getClassroomExperiment(experimentId ?? "")?.path ?? "/student";
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}taskId=${encodeURIComponent(taskId)}&sessionId=${encodeURIComponent(sessionId)}`;
}
