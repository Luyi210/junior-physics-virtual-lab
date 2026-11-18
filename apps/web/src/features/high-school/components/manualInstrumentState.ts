import type { ManualMeasurementResult } from "@physics-lab/physics/high-school";

export interface VirtualTimingRun {
  startTimeSeconds: number;
  lastTimeSeconds: number;
  parameters: Record<string, number>;
  resetToken: number;
}

export function beginVirtualTiming(timeSeconds: number, parameters: Record<string, number>, resetToken = 0): VirtualTimingRun {
  return { startTimeSeconds: timeSeconds, lastTimeSeconds: timeSeconds, parameters: { ...parameters }, resetToken };
}

/** A reset must invalidate the run even when the new time is still after its starting point. */
export function observeVirtualTiming(run: VirtualTimingRun, timeSeconds: number, parameters: Record<string, number>, resetToken = 0): { run: VirtualTimingRun | null; reason: string } {
  if (resetToken !== run.resetToken) {
    return { run: null, reason: "实验已重新计时，本次未完成的计时已作废。请重新选择起点，已保存的手动记录保留。" };
  }
  const keys = Object.keys(run.parameters);
  if (keys.length !== Object.keys(parameters).length || keys.some((key) => run.parameters[key] !== parameters[key])) {
    return { run: null, reason: "实验条件已改变，本次未完成的计时已作废。已保存的手动记录保留。" };
  }
  if (timeSeconds < run.lastTimeSeconds - 1e-9) {
    return { run: null, reason: "实验时间已回退，本次未完成的计时已作废。请重新选择起点。" };
  }
  return { run: { ...run, lastTimeSeconds: timeSeconds }, reason: "" };
}

type ManualReadings = Pick<ManualMeasurementResult, "kind" | "readings">;
type ArchivedManualReading = { manual: ManualReadings; parameters: Record<string, number> };
const orderedNumbers = (values: Record<string, number>) => Object.keys(values).sort().map((key) => [key, values[key]]);

/** Moving the double-slit probe reads another point; it does not change the observed fringe screen. */
export function manualObservationConditionKey(kind: ManualReadings["kind"], parameters: Record<string, number>): string {
  const conditions = kind === "double-slit-positions"
    ? Object.fromEntries(Object.entries(parameters).filter(([key]) => key !== "screenPositionMm"))
    : parameters;
  return JSON.stringify(orderedNumbers(conditions));
}

/** A reading's identity is its raw snapshot, never a freshly allocated calculation object. */
export function manualReadingSignature(result: ManualReadings, parameters: Record<string, number>): string {
  return JSON.stringify([result.kind, orderedNumbers(result.readings), manualObservationConditionKey(result.kind, parameters)]);
}

/** Deduplicate only within this observation, and only while its content is still in the archive. */
export function isManualReadingRecorded(savedInObservation: ReadonlySet<string>, archive: readonly ArchivedManualReading[], result: ManualReadings, parameters: Record<string, number>): boolean {
  const signature = manualReadingSignature(result, parameters);
  return savedInObservation.has(signature) && archive.some((record) => manualReadingSignature(record.manual, record.parameters) === signature);
}
