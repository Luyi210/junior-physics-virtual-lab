export interface EvaporationConditions {
  temperature: number;
  area: number;
  airflow: number;
}

export interface EvaporationEvidence extends EvaporationConditions {
  id: number;
  durationSeconds: number;
  initialMassGrams: number;
  remainingMassGrams: number;
  loss: number;
  rate: number;
}

export const EVAPORATION_BALANCE_RESOLUTION_GRAMS = 0.001;

/** Calculate from the saved balance readings and elapsed time, never from a model's predicted rate. */
export function evaporationReading(initialMassGrams: number, remainingMassGrams: number, elapsedSeconds: number) {
  if (![initialMassGrams, remainingMassGrams, elapsedSeconds].every(Number.isFinite)
    || initialMassGrams <= 0 || remainingMassGrams < 0 || remainingMassGrams > initialMassGrams || elapsedSeconds < 0) {
    throw new RangeError("蒸发称量需有限的有效质量与非负计时");
  }
  // The displayed microbalance readings are the evidence; hidden model digits must not change the result.
  const initialUnits = Math.round(initialMassGrams * 1000);
  const remainingUnits = Math.round(remainingMassGrams * 1000);
  if (!Number.isSafeInteger(initialUnits) || !Number.isSafeInteger(remainingUnits) || initialUnits <= 0) throw new RangeError("称量超出天平读数范围");
  const loss = (initialUnits - remainingUnits) / 1000;
  return { initialMassGrams: initialUnits / 1000, remainingMassGrams: remainingUnits / 1000,
    loss, rate: elapsedSeconds > 0 ? loss * 60 / elapsedSeconds : null };
}

export function createEvaporationEvidence(input: EvaporationConditions & {
  id: number;
  elapsedSeconds: number;
  durationSeconds: number;
  initialMassGrams: number;
  remainingMassGrams: number;
}): Readonly<EvaporationEvidence> | null {
  if (![input.id, input.temperature, input.area, input.airflow, input.durationSeconds].every(Number.isFinite)
    || input.temperature < 0 || input.temperature >= 100 || input.area <= 0 || input.airflow < 0 || input.durationSeconds <= 0) {
    throw new RangeError("蒸发记录的条件和时长无效");
  }
  const reading = evaporationReading(input.initialMassGrams, input.remainingMassGrams, input.elapsedSeconds);
  // A paused partial trial and a stale completion from another duration are not completed evidence.
  if (input.elapsedSeconds !== input.durationSeconds || reading.rate === null) return null;
  return Object.freeze({ id: input.id, temperature: input.temperature, area: input.area, airflow: input.airflow,
    durationSeconds: input.elapsedSeconds, initialMassGrams: reading.initialMassGrams, remainingMassGrams: reading.remainingMassGrams,
    loss: reading.loss, rate: reading.rate });
}

export function appendEvaporationEvidence(records: readonly EvaporationEvidence[], entry: EvaporationEvidence) {
  return [entry, ...records.filter((row) => row.temperature !== entry.temperature || row.area !== entry.area
    || row.airflow !== entry.airflow || row.durationSeconds !== entry.durationSeconds)].slice(0, 8);
}

export function evaporationComparisonPrompt(changedConditionCount: number) {
  return changedConditionCount === 0
    ? { title: "最近两组使用相同条件", detail: "可核对不同计时下的失重与平均速率；计时和天平分辨率会影响读数，但这还不是温度、面积或风速的因素对照。" }
    : { title: "最近两组同时改变了多个条件", detail: "请保留水温、液面面积、空气流速中的两个条件不变，再完成一组。" };
}
