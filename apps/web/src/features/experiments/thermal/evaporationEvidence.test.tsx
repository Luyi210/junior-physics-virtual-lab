import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { analyzeControlledComparison, calculateEvaporationTrial } from "@physics-lab/physics";
import { appendEvaporationEvidence, createEvaporationEvidence, evaporationComparisonPrompt, evaporationReading } from "./evaporationEvidence";
import { EvaporationEvidenceLedger } from "./EvaporationEvidenceLedger";

function trial(temperature: number, durationSeconds: number, area = 100, airflow = 0, id = temperature + durationSeconds) {
  const result = calculateEvaporationTrial(50, temperature, area, airflow, durationSeconds);
  return createEvaporationEvidence({ id, temperature, area, airflow, durationSeconds, elapsedSeconds: durationSeconds, initialMassGrams: 50, remainingMassGrams: result.remainingMassGrams })!;
}

describe("evaporation balance and time evidence", () => {
  it("keeps the original durations when a warmer, shorter run loses less mass but has a higher rate", () => {
    const base = trial(25, 120); const warmer = trial(40, 30);
    expect(base).toMatchObject({ durationSeconds: 120, loss: .152, rate: .076 });
    expect(warmer).toMatchObject({ durationSeconds: 30, loss: .05, rate: .1 });
    expect(warmer.loss).toBeLessThan(base.loss);
    const comparison = analyzeControlledComparison([base.temperature, base.area, base.airflow], [warmer.temperature, warmer.area, warmer.airflow], base.rate, warmer.rate, .0001);
    expect(comparison).toMatchObject({ valid: true, changedIndexes: [0], outcomeDirection: "increase" });
    const html = renderToStaticMarkup(<EvaporationEvidenceLedger records={[base, warmer]} />);
    expect(html).toContain("不同时长比较速率，不直接比较失重");
    expect(html).toContain("<td>25</td><td>100</td><td>0</td><td>120</td><td>50.000</td><td>49.848</td><td>0.152</td><td>0.076</td>");
    expect(html).toContain("<td>40</td><td>100</td><td>0</td><td>30</td><td>50.000</td><td>49.950</td><td>0.050</td><td>0.100</td>");
  });

  it("computes .088 g/min from the displayed .044 g loss, without using hidden model digits", () => {
    const result = calculateEvaporationTrial(50, 25, 50, 2, 30);
    expect(result.evaporatedMassGrams).toBeCloseTo(.0437, 12);
    const saved = trial(25, 30, 50, 2);
    expect(saved).toMatchObject({ initialMassGrams: 50, remainingMassGrams: 49.956, loss: .044, rate: .088 });
    expect(saved.rate).not.toBeCloseTo(result.evaporationRateGramsPerMinute, 6);
    expect(evaporationReading(50, result.remainingMassGrams, 30)).toMatchObject({ loss: saved.loss, rate: saved.rate });
  });

  it("does not save zero-time, unfinished paused, or mismatched-duration readings", () => {
    const input = { id: 1, temperature: 25, area: 100, airflow: 0, durationSeconds: 30, initialMassGrams: 50, remainingMassGrams: 49.9 };
    for (const elapsedSeconds of [0, 10, 29, 60]) expect(createEvaporationEvidence({ ...input, elapsedSeconds })).toBeNull();
    expect(evaporationReading(50, 50, 0).rate).toBeNull();
  });

  it("captures immutable conditions and readings without depending on later controls", () => {
    const input = { id: 1, temperature: 25, area: 100, airflow: 0, durationSeconds: 60, elapsedSeconds: 60, initialMassGrams: 50, remainingMassGrams: 49.924 };
    const saved = createEvaporationEvidence(input)!;
    input.temperature = 40; input.durationSeconds = 30; input.remainingMassGrams = 49.95;
    expect(saved).toMatchObject({ temperature: 25, durationSeconds: 60, remainingMassGrams: 49.924, loss: .076, rate: .076 });
    expect(Object.isFrozen(saved)).toBe(true);
  });

  it("retains different durations and deduplicates repeated saves of the same condition and duration", () => {
    const first = trial(25, 30); const longer = trial(25, 120);
    const records = appendEvaporationEvidence([first], longer);
    expect(records).toHaveLength(2);
    const repeated = trial(25, 120, 100, 0, 999);
    expect(appendEvaporationEvidence(records, repeated)).toEqual([repeated, first]);
    const comparison = analyzeControlledComparison([25, 100, 0], [25, 100, 0], first.rate, longer.rate);
    expect(comparison).toMatchObject({ valid: false, changedIndexes: [] });
    expect(evaporationComparisonPrompt(comparison.changedIndexes.length).title).toBe("最近两组使用相同条件");
    expect(evaporationComparisonPrompt(2).title).toContain("同时改变了多个条件");
  });

  it("does not turn impossible balance readings or non-finite evidence into a conclusion", () => {
    for (const remaining of [NaN, Infinity, -1, 51]) expect(() => evaporationReading(50, remaining, 30)).toThrow(RangeError);
    expect(() => evaporationReading(50, 49, -1)).toThrow(RangeError);
    expect(() => createEvaporationEvidence({ id: 1, temperature: 100, area: 100, airflow: 0, durationSeconds: 30, elapsedSeconds: 30, initialMassGrams: 50, remainingMassGrams: 49 })).toThrow(RangeError);
  });
});
