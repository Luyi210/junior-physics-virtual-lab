import { calculateMechanicalEnergyTapeMeasurement, validateMechanicalEnergyTapeObservation } from '@physics-lab/physics/high-school';

/** Shared captions for the exact inputs carried into CSV and the classroom text copy. */
export const mechanicalEnergyReadingLabels: Record<string, { label: string; unit: string }> = {
  mass: { label: '重物质量', unit: 'kg' },
  dropHeight: { label: '可用下落距离', unit: 'm' },
  resistanceRatio: { label: '恒定阻力与重力之比', unit: '无量纲' },
  indexA: { label: 'A点编号', unit: '号' }, indexB: { label: 'B点编号', unit: '号' },
  aBeforeMm: { label: 'A前一点位置', unit: 'mm' }, aCenterMm: { label: 'A点位置', unit: 'mm' }, aAfterMm: { label: 'A后一点位置', unit: 'mm' },
  bBeforeMm: { label: 'B前一点位置', unit: 'mm' }, bCenterMm: { label: 'B点位置', unit: 'mm' }, bAfterMm: { label: 'B后一点位置', unit: 'mm' },
};

/** Validate observation time/conditions, then derive only from the saved raw inputs. */
export function checkedMechanicalEnergyTape(parameters: Record<string, number>, readings: Record<string, number>, timeSeconds: number) {
  const p = { mass: parameters.mass!, dropHeight: parameters.dropHeight!, resistanceRatio: parameters.resistanceRatio! };
  validateMechanicalEnergyTapeObservation(p, readings, timeSeconds);
  return calculateMechanicalEnergyTapeMeasurement({
    mass: readings.mass!, dropHeight: readings.dropHeight!, resistanceRatio: readings.resistanceRatio!,
    indexA: readings.indexA!, indexB: readings.indexB!,
    aBeforeMm: readings.aBeforeMm!, aCenterMm: readings.aCenterMm!, aAfterMm: readings.aAfterMm!,
    bBeforeMm: readings.bBeforeMm!, bCenterMm: readings.bCenterMm!, bAfterMm: readings.bAfterMm!,
  });
}
