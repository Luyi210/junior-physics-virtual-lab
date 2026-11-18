import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement, defaultHighSchoolParameters } from "@physics-lab/physics/high-school";
import { getHighSchoolContext, publishHighSchoolContext } from "../../../data/highSchoolContext";
import { getHighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { manualRecordsToContext } from "./manualContext";
import type { ManualMeasurementRecord } from "./manualMeasurementRepository";

vi.mock("../../../data/highSchoolRecordScope", () => {
  const scope = { key: "guest:manual-context-test", mode: "guest", canWrite: true, authChannel: null, revision: 1, label: "测试访客" };
  return { getHighSchoolRecordScope: () => scope, subscribeHighSchoolRecordScope: () => () => {} };
});

const scope = getHighSchoolRecordScope();

function pendulumRecord(id = "pendulum-1", timeSeconds = 10.016666666666667): ManualMeasurementRecord {
  const parameters = { ...defaultHighSchoolParameters("pendulum"), length: 1, amplitudeDegrees: 5 };
  const { metrics, ...manual } = calculatePendulumTimingMeasurement({ startTimeSeconds: .31, endTimeSeconds: timeSeconds, periodCount: 5, length: parameters.length, amplitudeDegrees: parameters.amplitudeDegrees });
  return { id, createdAt: "2026-11-11T10:00:00.000Z", timeSeconds, parameters, metrics, manual };
}
function slitRecord(id = "slit-1"): ManualMeasurementRecord {
  const parameters = defaultHighSchoolParameters("double-slit");
  const { metrics, ...manual } = calculateDoubleSlitPositionMeasurement({ leftPositionMm: -2.3, rightPositionMm: 3.7, intervalCount: 3, slitSeparationMm: parameters.slitSeparationMm, screenDistance: parameters.screenDistance });
  return { id, createdAt: "2026-11-11T10:00:00.000Z", timeSeconds: 0, parameters, metrics, manual };
}
afterEach(() => { publishHighSchoolContext(null, scope); });

describe("manual archive to assistant context", () => {
  it("keeps the total manual count and sends only the latest ten records in archive order", () => {
    const records = Array.from({ length: 13 }, (_, index) => pendulumRecord(`p-${index}`));
    const context = manualRecordsToContext("pendulum", records);
    expect(context.manualRecordCount).toBe(13);
    expect(context.manualSamples?.map((sample) => sample.id)).toEqual(records.slice(-10).map((record) => record.id));
    expect(context).not.toHaveProperty("recordCount");
    expect(context).not.toHaveProperty("samples");
  });

  it("projects a field whitelist and preserves original raw readings, conditions and unrounded clock time", () => {
    const record = pendulumRecord();
    record.parameters.unexpected = 99;
    record.manual.readings.unexpected = 99;
    record.manual.assumptions.push("Do not send this stored prose");
    record.metrics[0]!.value = 99999;
    const sample = manualRecordsToContext("pendulum", [record]).manualSamples![0]!;
    expect(Object.keys(sample).sort()).toEqual(["id", "kind", "parameters", "readings", "timeSeconds"]);
    expect(Object.keys(sample.parameters).sort()).toEqual(["amplitudeDegrees", "length", "mass"]);
    expect(Object.keys(sample.readings).sort()).toEqual(["amplitudeDegrees", "endTimeSeconds", "length", "periodCount", "startTimeSeconds"]);
    expect(sample.readings).toMatchObject({ startTimeSeconds: .31, endTimeSeconds: 10.02, periodCount: 5 });
    expect(sample.timeSeconds).toBe(record.timeSeconds);
    expect(JSON.stringify(sample)).not.toMatch(/99999|Do not send|createdAt|metrics|resolution|unexpected/);
    record.parameters.length = 2;
    record.manual.readings.startTimeSeconds = 1;
    expect(sample.parameters.length).toBe(1);
    expect(sample.readings.startTimeSeconds).toBe(.31);
  });

  it("keeps the selected double-slit coordinates and count without deriving them from the known wavelength", () => {
    const record = slitRecord();
    record.parameters.wavelengthNm = 700;
    const context = manualRecordsToContext("double-slit", [record]);
    expect(context.manualRecordCount).toBe(1);
    expect(context.manualSamples?.[0]).toMatchObject({ kind: "double-slit-positions", timeSeconds: 0, parameters: { wavelengthNm: 700 }, readings: { leftPositionMm: -2.3, rightPositionMm: 3.7, intervalCount: 3 } });
    expect(Object.keys(context.manualSamples![0]!.readings).sort()).toEqual(["intervalCount", "leftPositionMm", "rightPositionMm", "screenDistance", "slitSeparationMm"]);
  });

  it("omits damaged clocks, non-quantized readings, duplicate IDs and foreign instrument records", () => {
    const mismatch = pendulumRecord("mismatch"); mismatch.timeSeconds = 11;
    const tooLate = pendulumRecord("late", 61);
    const unquantized = pendulumRecord("unquantized"); unquantized.manual.readings.endTimeSeconds = 10.016;
    const wrongSettings = pendulumRecord("settings"); wrongSettings.parameters.length = 2;
    const valid = pendulumRecord("valid");
    const context = manualRecordsToContext("pendulum", [mismatch, tooLate, unquantized, wrongSettings, slitRecord(), valid, valid]);
    expect(context.manualRecordCount).toBe(1);
    expect(context.manualSamples?.map((record) => record.id)).toEqual(["valid"]);
    const movingSlit = slitRecord(); movingSlit.timeSeconds = 1;
    expect(manualRecordsToContext("double-slit", [movingSlit]).manualRecordCount).toBe(0);
  });

  it("does not add manual fields on other experiment routes, including when old records are passed", () => {
    expect(manualRecordsToContext("projectile-motion", [pendulumRecord()])).toEqual({});
    expect(manualRecordsToContext("double-slit", [pendulumRecord()])).toEqual({ manualRecordCount: 0, manualSamples: [] });
  });

  it("replaces equal-count archives and clearing context without retaining older raw data", () => {
    const base = { experimentId: "pendulum", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 0, recordCount: 7, samples: [] };
    publishHighSchoolContext({ ...base, ...manualRecordsToContext("pendulum", [pendulumRecord("old")]) }, scope);
    publishHighSchoolContext({ ...base, ...manualRecordsToContext("pendulum", [pendulumRecord("replacement", 12)]) }, scope);
    expect(getHighSchoolContext()?.manualSamples?.[0]?.id).toBe("replacement");
    expect(getHighSchoolContext()?.recordCount).toBe(7);
    publishHighSchoolContext({ ...base, ...manualRecordsToContext("pendulum", []) }, scope);
    expect(getHighSchoolContext()?.manualSamples).toEqual([]);
    expect(getHighSchoolContext()?.manualRecordCount).toBe(0);
    publishHighSchoolContext(null, scope);
    expect(getHighSchoolContext()).toBeNull();
  });
});
