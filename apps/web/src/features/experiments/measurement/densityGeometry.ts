export type DensityImmersionCondition = "correct" | "bubbles" | "partial";
const scale = { bottom: 350, top: 50, capacityMl: 100 } as const;

export function densityVolumeToY(volumeMl: number): number {
  if (!Number.isFinite(volumeMl) || volumeMl < 0 || volumeMl > scale.capacityMl) throw new RangeError("量筒读数须在 0 至 100 mL 之间。");
  return scale.bottom - volumeMl / scale.capacityMl * (scale.bottom - scale.top);
}

/** A single calibration supplies the water surface, every tick and the immersion geometry. */
export function densityGeometry({ waterAdded, sampleVolumeCm3, immersed, condition }: { waterAdded: boolean; sampleVolumeCm3: number | null; immersed: boolean; condition: DensityImmersionCondition }) {
  if (sampleVolumeCm3 !== null && (!Number.isFinite(sampleVolumeCm3) || sampleVolumeCm3 <= 2 || sampleVolumeCm3 > 40)) throw new RangeError("当前量筒中的样品体积须大于 2 且不超过 40 cm³。");
  if (immersed && (!waterAdded || sampleVolumeCm3 === null)) throw new RangeError("加入水并选择样品后才能浸入。");
  const sampleVolume = sampleVolumeCm3 ?? 0;
  const submergedVolumeCm3 = immersed ? sampleVolume - (condition === "partial" ? 2 : 0) : 0;
  const bubbleVolumeMl = immersed && condition === "bubbles" ? 2 : 0;
  const displacedVolumeMl = submergedVolumeCm3 + bubbleVolumeMl;
  const volumeMl = waterAdded ? 50 + displacedVolumeMl : 0;
  const surfaceY = densityVolumeToY(volumeMl);
  const height = sampleVolume * 3;
  const submergedFraction = sampleVolume > 0 ? submergedVolumeCm3 / sampleVolume : 0;
  const objectTop = !immersed ? 8 : condition === "partial" ? surfaceY - height * (1 - submergedFraction) : surfaceY + 18;
  return {
    viewBox: "0 0 180 400", scale, volumeMl, surfaceY, displacedVolumeMl, submergedVolumeCm3, bubbleVolumeMl,
    fullyImmersed: immersed && condition !== "partial", submergedFraction,
    object: sampleVolumeCm3 === null ? null : { left: 60, top: objectTop, width: 38, height, bottom: objectTop + height },
    ticks: Array.from({ length: 21 }, (_, index) => ({ volumeMl: index * 5, y: densityVolumeToY(index * 5), major: index % 2 === 0 }))
  };
}
