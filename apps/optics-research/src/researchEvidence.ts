import type { LabTrial, TaskId } from "./researchModel";

export interface ComparisonCheck {
  id: string;
  label: string;
  passed: boolean;
}

export function comparisonChecklist(taskId: TaskId, trials: LabTrial[]): ComparisonCheck[] {
  if (taskId === "reflection") {
    const angles = new Set(trials.map((trial) => trial.values.incidentAngle));
    return [
      { id: "three-angles", label: "三组不同入射角", passed: angles.size >= 3 },
      { id: "angle-pairs", label: "每组同时记录入射角与反射角", passed: trials.length >= 3 && trials.every((trial) => typeof trial.values.reflectionAngle === "number") }
    ];
  }
  if (taskId === "bench") {
    const zones = new Set(trials.map((trial) => {
      const distance = Number(trial.values.objectDistance);
      return distance < 10 ? "inside-f" : distance < 20 ? "f-to-2f" : "beyond-2f";
    }));
    return [
      { id: "inside-f", label: "焦内物距 u＜f", passed: zones.has("inside-f") },
      { id: "between", label: "一倍与二倍焦距之间", passed: zones.has("f-to-2f") },
      { id: "beyond", label: "二倍焦距以外", passed: zones.has("beyond-2f") },
      { id: "focused", label: "至少找到一组清晰实像", passed: trials.some((trial) => trial.values.focused === true) }
    ];
  }
  if (taskId === "dispersion") {
    const sources = new Set(trials.map((trial) => trial.values.source));
    return [
      { id: "white", label: "记录复色白光", passed: sources.has("white") },
      { id: "red", label: "记录红色单光", passed: sources.has("red") },
      { id: "landing", label: "比较光屏落点数量或色带宽度", passed: trials.length >= 2 && trials.every((trial) => typeof trial.values.landingCount === "number") }
    ];
  }
  const lenses = new Set(trials.map((trial) => trial.values.lens));
  return [
    { id: "none", label: "无镜片基线", passed: lenses.has("none") },
    { id: "concave", label: "凹透镜结果", passed: lenses.has("concave") },
    { id: "convex", label: "凸透镜反例", passed: lenses.has("convex") }
  ];
}

export function comparisonReady(taskId: TaskId, trials: LabTrial[]) {
  return comparisonChecklist(taskId, trials).every((check) => check.passed);
}
