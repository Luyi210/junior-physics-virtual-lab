import type { LiliExperimentContext, LiliManualSample } from "@physics-lab/contracts";
import { prepareLiliManualContext } from "@physics-lab/harness/lili-manual";
import { highSchoolExperiment, MECHANICAL_ENERGY_TAPE_READING_KEYS } from "@physics-lab/physics/high-school";
import type { ManualMeasurementRecord } from "./manualMeasurementRepository";

type ManualContext = Pick<LiliExperimentContext, "manualRecordCount" | "manualSamples">;
const readingKeys = {
  pendulum: ["startTimeSeconds", "endTimeSeconds", "periodCount", "length", "amplitudeDegrees"],
  "double-slit": ["leftPositionMm", "rightPositionMm", "intervalCount", "slitSeparationMm", "screenDistance"],
  "mechanical-energy": MECHANICAL_ENERGY_TAPE_READING_KEYS
} as const;
const expectedKind = { pendulum: "pendulum-timing", "double-slit": "double-slit-positions", "mechanical-energy": "mechanical-energy-tape" } as const;

/** Only saved raw operations cross into assistant context; stored conclusions and prose do not. */
export function manualRecordsToContext(experimentId: string, records: readonly ManualMeasurementRecord[]): ManualContext {
  if (experimentId !== "pendulum" && experimentId !== "double-slit" && experimentId !== "mechanical-energy") return {};
  const parameterKeys = highSchoolExperiment(experimentId).parameters.map((parameter) => parameter.key);
  const accepted: LiliManualSample[] = [];
  const ids = new Set<string>();
  for (const record of records) {
    if (record.manual?.kind !== expectedKind[experimentId] || record.manual.provenance !== "virtual-manual" || ids.has(record.id)) continue;
    try {
      const sample: LiliManualSample = {
        id: record.id,
        kind: record.manual.kind,
        parameters: Object.fromEntries(parameterKeys.map((key) => [key, record.parameters[key]])),
        readings: Object.fromEntries(readingKeys[experimentId].map((key) => [key, record.manual.readings[key]])),
        timeSeconds: record.timeSeconds
      };
      // Reuse the shared raw-reading validation, including clock/end-readout consistency.
      const validated = prepareLiliManualContext(experimentId, { manualRecordCount: 1, manualSamples: [sample] }).manualSamples?.[0];
      if (validated) { accepted.push(validated); ids.add(validated.id); }
    } catch { /* Damaged or foreign records cannot enter an otherwise valid question. */ }
  }
  return { manualRecordCount: accepted.length, manualSamples: accepted.slice(-10) };
}
