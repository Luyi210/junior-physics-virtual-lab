import { describe, expect, it } from "vitest";
import type { LiliExperimentContext, LiliManualSample } from "@physics-lab/contracts";
import { defaultHighSchoolParameters } from "@physics-lab/physics/high-school";
import { liliManualReference, prepareLiliManualContext } from "@physics-lab/harness/lili-manual";

function pendulum(): LiliManualSample {
  return {
    id: "timing-1", kind: "pendulum-timing", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 10.016666666666667,
    readings: { startTimeSeconds: 0.02, endTimeSeconds: 10.02, periodCount: 4, length: 1, amplitudeDegrees: 10 }
  };
}
function slit(): LiliManualSample {
  return {
    id: "slit-1", kind: "double-slit-positions", parameters: defaultHighSchoolParameters("double-slit"), timeSeconds: 0,
    readings: { leftPositionMm: -6.6, rightPositionMm: 6.6, intervalCount: 4, slitSeparationMm: 0.25, screenDistance: 1.5 }
  };
}
function context(sample: LiliManualSample = pendulum(), count = 1): LiliExperimentContext {
  return { experimentId: sample.kind === "pendulum-timing" ? "pendulum" : "double-slit", parameters: { ...sample.parameters }, timeSeconds: 0, recordCount: 0, manualRecordCount: count, manualSamples: [sample] };
}
function prepare(value: LiliExperimentContext) { return prepareLiliManualContext(value.experimentId, value); }
function metric(value: ReturnType<typeof liliManualReference>, key: string) { return value!.records[0]!.metrics.find((entry) => entry.key === key)?.value; }

describe("Lili manual virtual instrument boundary", () => {
  it("whitelists original readings without retaining client calculations or prompt text", () => {
    const original = pendulum();
    const input = { ...context(original), manualSamples: [{ ...original, metrics: [{ key: "gravity", value: 999 }], assumptions: ["UNTRUSTED-INSTRUCTION"], warnings: ["UNTRUSTED-INSTRUCTION"], resolution: { value: 999, unit: "s" } }], manualAnalysis: "UNTRUSTED-INSTRUCTION" };
    const result = prepare(input);
    expect(result).toEqual({ manualRecordCount: 1, manualSamples: [original] });
    expect(result.manualSamples![0]!.readings).not.toBe(original.readings);
    expect(result.manualSamples![0]!.parameters).not.toBe(original.parameters);
    const reference = liliManualReference(input)!;
    expect(JSON.stringify(reference)).not.toContain("UNTRUSTED-INSTRUCTION");
    expect(metric(reference, "gravity")).not.toBe(999);
    expect(reference.records[0]!.resolution).toEqual({ value: 0.01, unit: "s" });
  });

  it("keeps old contexts compatible while rejecting unsupported manual experiment kinds", () => {
    expect(prepareLiliManualContext("pendulum", {})).toEqual({});
    expect(prepareLiliManualContext("emf-internal-resistance", { recordCount: 3, samples: [] })).toEqual({});
    for (const id of ["emf-internal-resistance", "projectile-motion", "unknown"]) expect(() => prepareLiliManualContext(id, { manualRecordCount: 0, manualSamples: [] })).toThrow(RangeError);
    for (const value of [null, [], 2, "record"]) expect(() => prepareLiliManualContext("pendulum", value)).toThrow(RangeError);
  });

  it("requires bounded integer totals and never infers missing totals from sample count", () => {
    const base = context();
    for (const count of [-1, 2001, 1.5, NaN, Infinity, "1", null, undefined]) expect(() => prepareLiliManualContext("pendulum", { ...base, manualRecordCount: count })).toThrow(RangeError);
    expect(() => prepare({ ...base, manualRecordCount: 0 })).toThrow(RangeError);
    expect(prepareLiliManualContext("pendulum", { manualRecordCount: 0, manualSamples: [] })).toEqual({ manualRecordCount: 0, manualSamples: [] });
    expect(() => prepareLiliManualContext("pendulum", { manualRecordCount: 1, manualSamples: null })).toThrow(RangeError);
  });

  it("limits the included window to ten and reports omitted records separately", () => {
    const samples = Array.from({ length: 10 }, (_, index) => ({ ...pendulum(), id: `timing-${index}` }));
    const base = { ...context(), manualRecordCount: 2000, manualSamples: samples };
    expect(prepare(base).manualSamples).toHaveLength(10);
    const reference = liliManualReference(base)!;
    expect([reference.totalSavedCount, reference.includedCount, reference.omittedCount]).toEqual([2000, 10, 1990]);
    expect(() => prepare({ ...base, manualSamples: [...samples, { ...pendulum(), id: "eleventh" }] })).toThrow(RangeError);
  });

  it("rejects duplicate or unbounded identifiers and preserves independent sample order", () => {
    const sample = pendulum();
    for (const id of ["", "x".repeat(101), "<question>", "space id", "中文"]) expect(() => prepare(context({ ...sample, id }))).toThrow(RangeError);
    expect(() => prepare({ ...context(sample, 2), manualSamples: [sample, sample] })).toThrow(RangeError);
    expect(prepare(context({ ...sample, id: "a".repeat(100) })).manualSamples![0]!.id).toHaveLength(100);
    const samples = [{ ...sample, id: "second" }, { ...sample, id: "first" }];
    expect(prepare({ ...context(sample, 2), manualSamples: samples }).manualSamples!.map((entry) => entry.id)).toEqual(["second", "first"]);
  });

  it("rejects wrong apparatus kind and malformed sample objects", () => {
    const base = context();
    expect(() => prepare({ ...base, manualSamples: [{ ...pendulum(), kind: "double-slit-positions" }] })).toThrow(RangeError);
    for (const sample of [null, [], 7, "sample"]) expect(() => prepareLiliManualContext("pendulum", { ...base, manualSamples: [sample] })).toThrow(RangeError);
  });

  it("requires complete bounded condition snapshots rather than inserting defaults", () => {
    for (const sample of [pendulum(), slit()]) {
      const incomplete = { ...sample.parameters };
      delete incomplete[Object.keys(incomplete)[0]!];
      for (const parameters of [{}, incomplete, { ...sample.parameters, unknown: 1 }, { ...sample.parameters, [Object.keys(sample.parameters)[0]!]: Infinity }]) expect(() => prepare(context({ ...sample, parameters }))).toThrow(RangeError);
    }
    const sample = pendulum();
    expect(() => prepare(context({ ...sample, parameters: { ...sample.parameters, mass: 0 } }))).toThrow(RangeError);
    const optical = slit();
    expect(() => prepare(context({ ...optical, parameters: { ...optical.parameters, wavelengthNm: 800 } }))).toThrow(RangeError);
  });

  it("accepts exactly the numeric raw-reading fields and rejects missing, prose or non-finite readings", () => {
    for (const sample of [pendulum(), slit()]) {
      const key = Object.keys(sample.readings)[0]!;
      const missing = { ...sample.readings }; delete missing[key];
      const badReadings: unknown[] = [missing, { ...sample.readings, unit: "s" }, { ...sample.readings, extra: 1 }, { ...sample.readings, [key]: "0" }, { ...sample.readings, [key]: NaN }, { ...sample.readings, [key]: Infinity }, null, []];
      for (const readings of badReadings) expect(() => prepareLiliManualContext(context(sample).experimentId, { ...context(sample), manualSamples: [{ ...sample, readings }] })).toThrow(RangeError);
    }
  });

  it("rejects condition mismatches between an operation and its own saved apparatus snapshot", () => {
    const p = pendulum(); const s = slit();
    for (const key of ["length", "amplitudeDegrees"]) expect(() => prepare(context({ ...p, readings: { ...p.readings, [key]: p.readings[key]! + 0.1 } }))).toThrow(RangeError);
    for (const key of ["slitSeparationMm", "screenDistance"]) expect(() => prepare(context({ ...s, readings: { ...s.readings, [key]: s.readings[key]! + 0.01 } }))).toThrow(RangeError);
  });

  it("checks the pendulum observation window and quantized stop time without rounding the raw operation timestamp", () => {
    const sample = pendulum();
    expect(prepare(context(sample)).manualSamples![0]!.timeSeconds).toBe(sample.timeSeconds);
    for (const timeSeconds of [-1, NaN, Infinity, 10, 60.0001]) expect(() => prepare(context({ ...sample, timeSeconds }))).toThrow(RangeError);
    const edge = { ...sample, timeSeconds: 60, readings: { ...sample.readings, endTimeSeconds: 60 } };
    expect(prepare(context(edge)).manualSamples![0]!.readings.endTimeSeconds).toBe(60);
    expect(() => prepare(context({ ...edge, readings: { ...edge.readings, endTimeSeconds: 60.01 } }))).toThrow(RangeError);
    expect(() => prepare(context({ ...edge, readings: { ...edge.readings, startTimeSeconds: 60.01 } }))).toThrow(RangeError);
    expect(() => prepare(context({ ...slit(), timeSeconds: 0.01 }))).toThrow(RangeError);
  });

  it("rejects unquantized readings instead of silently rewriting them", () => {
    const p = pendulum(); const s = slit();
    expect(() => prepare(context({ ...p, readings: { ...p.readings, startTimeSeconds: 0.016666666666667 } }))).toThrow(RangeError);
    expect(() => prepare(context({ ...p, readings: { ...p.readings, endTimeSeconds: p.timeSeconds } }))).toThrow(RangeError);
    for (const key of ["leftPositionMm", "rightPositionMm"]) expect(() => prepare(context({ ...s, readings: { ...s.readings, [key]: s.readings[key]! + 0.01 } }))).toThrow(RangeError);
  });

  it("recomputes a user's wrong cycle count as entered rather than returning the nonlinear model period", () => {
    const sample = pendulum();
    const reference = liliManualReference(context(sample))!;
    expect(reference.records[0]!.readings).toEqual(sample.readings);
    expect(metric(reference, "elapsedTime")).toBe(10);
    expect(metric(reference, "period")).toBe(2.5);
    expect(metric(reference, "gravity")).toBeCloseTo(4 * Math.PI ** 2 / 2.5 ** 2, 12);
    const differentCount = { ...sample, readings: { ...sample.readings, periodCount: 5 } };
    expect(metric(liliManualReference(context(differentCount)), "period")).toBe(2);
    expect(reference.provenance).toBe("virtual-manual");
    expect(reference.notice).toContain("未验证完整周期计数");
    expect(reference.notice).toContain("不是真实器材实测");
    expect(reference.notice).toContain("不能当作测量精度");
  });

  it("keeps large-angle timing but excludes the small-angle gravity estimate", () => {
    const sample = pendulum();
    expect(metric(liliManualReference(context(sample)), "gravity")).toBeTypeOf("number");
    const large = { ...sample, parameters: { ...sample.parameters, amplitudeDegrees: 60 }, readings: { ...sample.readings, amplitudeDegrees: 60 } };
    const reference = liliManualReference(context(large))!;
    expect(metric(reference, "period")).toBe(2.5);
    expect(metric(reference, "gravity")).toBeUndefined();
    expect(reference.records[0]!.warnings.join(" ")).toContain("不输出 g");
  });

  it("derives 550 nm from selected coordinates even with a different known wavelength setting", () => {
    const sample = slit();
    sample.parameters.wavelengthNm = 700;
    const reference = liliManualReference(context(sample))!;
    expect(metric(reference, "spanMm")).toBeCloseTo(13.2, 12);
    expect(metric(reference, "fringeSpacingMm")).toBeCloseTo(3.3, 12);
    expect(metric(reference, "wavelengthNm")).toBeCloseTo(550, 10);
    expect(reference.records[0]!.parameters.wavelengthNm).toBe(700);
    expect(reference.records[0]!.readings).toEqual(sample.readings);
    const wrongCount = { ...sample, readings: { ...sample.readings, intervalCount: 5 } };
    expect(metric(liliManualReference(context(wrongCount)), "wavelengthNm")).toBeCloseTo(440, 10);
    const outsideSetting = { ...sample, readings: { ...sample.readings, intervalCount: 1 } };
    const warning = liliManualReference(context(outsideSetting))!;
    expect(metric(warning, "wavelengthNm")).toBeCloseTo(2200, 10);
    expect(warning.records[0]!.warnings.join(" ")).toContain("超出本实验");
  });

  it("rejects invalid interval counts and impossible reading geometry without repairing them", () => {
    for (const count of [0, -1, 1.5, 101]) {
      const p = pendulum(); const s = slit();
      expect(() => prepare(context({ ...p, readings: { ...p.readings, periodCount: count } }))).toThrow(RangeError);
      expect(() => prepare(context({ ...s, readings: { ...s.readings, intervalCount: count } }))).toThrow(RangeError);
    }
    const p = pendulum(); const s = slit();
    for (const start of [-0.01, 10.02, 11]) expect(() => prepare(context({ ...p, readings: { ...p.readings, startTimeSeconds: start } }))).toThrow(RangeError);
    for (const right of [-20.1, -6.6, -7, 20.1]) expect(() => prepare(context({ ...s, readings: { ...s.readings, rightPositionMm: right } }))).toThrow(RangeError);
  });

  it("uses each saved set of conditions independently from the current workbench without mutating records", () => {
    const first = pendulum();
    const second: LiliManualSample = { ...pendulum(), id: "different-length", parameters: { ...first.parameters, length: 2 }, readings: { ...first.readings, length: 2 } };
    const input = { ...context(first, 2), parameters: { ...first.parameters, length: 0.3, amplitudeDegrees: 75 }, manualSamples: [first, second] };
    const before = structuredClone(input);
    const reference = liliManualReference(input)!;
    const gravity = reference.records.map((record) => record.metrics.find((entry) => entry.key === "gravity")!.value);
    expect(gravity[1]).toBeCloseTo(gravity[0]! * 2, 12);
    expect(reference.records.map((record) => record.readings.length)).toEqual([1, 2]);
    expect(input).toEqual(before);
    reference.records[0]!.readings.periodCount = 99;
    expect(input.manualSamples[0]!.readings.periodCount).toBe(4);
  });

  it("does not invent manual readings when only a count is available or legacy fields are absent", () => {
    const base = context();
    delete base.manualSamples;
    base.manualRecordCount = 12;
    expect(liliManualReference(base)).toMatchObject({ totalSavedCount: 12, includedCount: 0, omittedCount: 12, records: [] });
    delete base.manualRecordCount;
    expect(liliManualReference(base)).toBeNull();
    expect(liliManualReference(null)).toBeNull();
  });

  it("fails closed when a direct reference caller supplies invalid operations", () => {
    const base = context();
    expect(liliManualReference({ ...base, manualSamples: [{ ...pendulum(), readings: {} }] })).toBeNull();
    expect(liliManualReference({ ...base, experimentId: "unknown" })).toBeNull();
  });
});
