import { describe, expect, it } from "vitest";
import { analyzeTimedPlateauEvidence, calculateHeatingTemperature, calculateIceMeltingState, calculateWaterBoilingPoint } from "@physics-lab/physics";
import { appendTimedReading } from "./timedReadings";

describe("thermal readings retain the whole observation run", () => {
  it("keeps boiling's sole warming point after more than eight plateau samples", () => {
    const boilingPoint = calculateWaterBoilingPoint(101.325);
    const reading = (time: number) => {
      const temperature = calculateHeatingTemperature(time, 800, 200, 25, boilingPoint);
      return { time, temperature, phase: temperature >= boilingPoint - .2 ? "plateau" : "warming" };
    };
    let rows = [reading(20)];
    const warming = rows[0];
    for (let time = 100; time <= 184; time += 12) {
      rows = appendTimedReading(rows, reading(time));
      const plateau = analyzeTimedPlateauEvidence(rows.filter((row) => row.phase === "plateau").map((row) => ({ time: row.time, value: row.temperature })), 10, .3);
      if (time >= 112) expect(rows.some((row) => row.phase === "warming") && plateau.plateau).toBe(true);
    }
    expect(rows).toHaveLength(9);
    expect(rows[0]).toBe(warming);
    expect(rows.map((row) => row.time)).toEqual([20, 100, 112, 124, 136, 148, 160, 172, 184]);
  });

  it("keeps melting's sole solid-stage point after ten melting samples", () => {
    const reading = (time: number) => ({ time, ...calculateIceMeltingState(time, 100, 20) });
    let rows = [reading(2)];
    const solid = rows[0];
    for (let time = 10; time <= 100; time += 10) {
      rows = appendTimedReading(rows, reading(time));
      const plateau = analyzeTimedPlateauEvidence(rows.filter((row) => row.phase === "melting").map((row) => ({ time: row.time, value: row.temperature })), 10, .2);
      if (time >= 20) expect(rows.some((row) => row.phase === "solid") && plateau.plateau).toBe(true);
    }
    expect(rows).toHaveLength(11);
    expect(rows[0]).toBe(solid);
    expect(rows.at(-1)?.time).toBe(100);
  });

  it("updates the same displayed second without manufacturing a second plateau point", () => {
    const original = { time: 20, temperature: 0, id: "first" };
    const replacement = { time: 20, temperature: 0, id: "updated" };
    const input = [original];
    const rows = appendTimedReading(input, replacement);
    expect(rows).toEqual([replacement]);
    expect(input).toEqual([original]);
    expect(analyzeTimedPlateauEvidence(rows.map((row) => ({ time: row.time, value: row.temperature })), 10, .2).plateau).toBe(false);
  });

  it("retains every unique second within the observation limit and starts an empty new run independently", () => {
    let rows: Array<{ time: number; temperature: number }> = [];
    for (let time = 1; time <= 360; time++) rows = appendTimedReading(rows, { time, temperature: time });
    expect(rows).toHaveLength(360);
    expect(appendTimedReading(rows, { time: 360, temperature: 100 })).toHaveLength(360);
    const newRun = appendTimedReading([], { time: 1, temperature: 25 });
    expect(newRun).toEqual([{ time: 1, temperature: 25 }]);
    expect(rows).toHaveLength(360);
  });
});
