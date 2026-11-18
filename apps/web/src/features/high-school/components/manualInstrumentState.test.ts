import { describe, expect, it } from "vitest";
import { calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement, defaultHighSchoolParameters, simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import { isManualReadingRecorded, manualObservationConditionKey, manualReadingSignature } from "./manualInstrumentState";

const parameters = defaultHighSchoolParameters("double-slit");
const input = { leftPositionMm: -2.3, rightPositionMm: 3.7, intervalCount: 3, slitSeparationMm: parameters.slitSeparationMm, screenDistance: parameters.screenDistance };
const original = calculateDoubleSlitPositionMeasurement(input);
const archive = [{ manual: original, parameters }];
const recorded = new Set([manualReadingSignature(original, parameters)]);

describe("manual observation saved content", () => {
  it("keeps the same screen observation and saved status when only its readout probe moves", () => {
    const screen = simulateHighSchoolExperiment("double-slit", parameters).series[0]!.points;
    const condition = manualObservationConditionKey("double-slit-positions", parameters);
    for (const screenPositionMm of [-20, 1, 20]) {
      const movedProbe = { ...parameters, screenPositionMm };
      expect(simulateHighSchoolExperiment("double-slit", movedProbe).series[0]!.points).toEqual(screen);
      expect(manualObservationConditionKey("double-slit-positions", movedProbe)).toBe(condition);
      expect(isManualReadingRecorded(recorded, archive, original, movedProbe)).toBe(true);
      const changedReading = calculateDoubleSlitPositionMeasurement({ ...input, rightPositionMm: 3.8 });
      expect(isManualReadingRecorded(recorded, archive, changedReading, movedProbe)).toBe(false);
      expect(isManualReadingRecorded(recorded, archive, calculateDoubleSlitPositionMeasurement(input), movedProbe)).toBe(true);
    }
    // Signature matching never rewrites the full parameter snapshot kept in the archive.
    expect(archive[0]!.parameters.screenPositionMm).toBe(0);
  });

  it.each([
    ["wavelengthNm", 600], ["slitSeparationMm", .3], ["screenDistance", 2],
  ] as const)("requires a new observation after changing the screen's %s", (key, value) => {
    const changed = { ...parameters, [key]: value };
    expect(simulateHighSchoolExperiment("double-slit", changed).series[0]!.points).not.toEqual(simulateHighSchoolExperiment("double-slit", parameters).series[0]!.points);
    expect(manualObservationConditionKey("double-slit-positions", changed)).not.toBe(manualObservationConditionKey("double-slit-positions", parameters));
    expect(isManualReadingRecorded(recorded, archive, original, changed)).toBe(false);
    expect(archive).toHaveLength(1);
    expect(archive[0]!.parameters[key]).toBe(parameters[key]);
  });

  it("still allows an independent repeated reading or a cleared archive after a probe move", () => {
    const movedProbe = { ...parameters, screenPositionMm: 1 };
    expect(isManualReadingRecorded(recorded, archive, original, movedProbe)).toBe(true);
    expect(isManualReadingRecorded(new Set(), archive, original, movedProbe)).toBe(false);
    expect(isManualReadingRecorded(recorded, [], original, movedProbe)).toBe(false);
  });

  it("keeps identical readings recorded after an unchanged blur recalculates a fresh object", () => {
    const recalculated = calculateDoubleSlitPositionMeasurement({ ...input });
    expect(recalculated).not.toBe(original);
    expect(isManualReadingRecorded(recorded, archive, recalculated, { ...parameters })).toBe(true);
  });

  it("allows changed readings, then remembers earlier saved values when edited back during the same observation", () => {
    const changed = calculateDoubleSlitPositionMeasurement({ ...input, rightPositionMm: 3.8 });
    expect(isManualReadingRecorded(recorded, archive, changed, parameters)).toBe(false);
    const twoReadings = new Set([...recorded, manualReadingSignature(changed, parameters)]);
    const bothArchived = [...archive, { manual: changed, parameters }];
    expect(isManualReadingRecorded(twoReadings, bothArchived, changed, parameters)).toBe(true);
    expect(isManualReadingRecorded(twoReadings, bothArchived, calculateDoubleSlitPositionMeasurement(input), parameters)).toBe(true);
  });

  it("allows re-saving after clearing, including equal-count replacement with a different record", () => {
    expect(isManualReadingRecorded(recorded, [], original, parameters)).toBe(false);
    const replacement = calculateDoubleSlitPositionMeasurement({ ...input, intervalCount: 4 });
    expect(isManualReadingRecorded(recorded, [{ manual: replacement, parameters }], original, parameters)).toBe(false);
  });

  it("allows an intentional new observation with identical values while preserving the earlier archive", () => {
    const nextObservation = new Set<string>();
    expect(isManualReadingRecorded(nextObservation, archive, original, parameters)).toBe(false);
    expect(archive).toHaveLength(1);
    expect(isManualReadingRecorded(recorded, archive, original, parameters)).toBe(true);
  });

  it("includes the complete conditions and raw count, rather than derived results or dictionary order", () => {
    const reordered = { mass: 1, length: 1, amplitudeDegrees: 5 };
    const pendulum = calculatePendulumTimingMeasurement({ startTimeSeconds: .3, endTimeSeconds: 10.4, periodCount: 5, length: 1, amplitudeDegrees: 5 });
    const signature = manualReadingSignature(pendulum, reordered);
    expect(manualReadingSignature({ ...pendulum, readings: Object.fromEntries(Object.entries(pendulum.readings).reverse()) }, { amplitudeDegrees: 5, length: 1, mass: 1 })).toBe(signature);
    expect(manualReadingSignature(pendulum, { ...reordered, mass: 2 })).not.toBe(signature);
    expect(manualReadingSignature({ ...pendulum, readings: { ...pendulum.readings, periodCount: 6 } }, reordered)).not.toBe(signature);
  });
});
