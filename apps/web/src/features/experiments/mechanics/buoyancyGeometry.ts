export interface BuoyancyGeometryInput {
  objectVolumeCm3: number;
  immersionPercent: number;
  touchingBottom: boolean;
}

/** One coordinate system for the vessel, displaced liquid and a vertical uniform prism. */
export function buoyancyGeometry({ objectVolumeCm3, immersionPercent, touchingBottom }: BuoyancyGeometryInput) {
  if (!Number.isFinite(objectVolumeCm3) || objectVolumeCm3 <= 0 || objectVolumeCm3 > 150) throw new RangeError("物体体积须在 0 至 150 cm³ 之间。");
  if (!Number.isFinite(immersionPercent) || immersionPercent < 0 || immersionPercent > 100) throw new RangeError("浸入程度须在 0 至 100% 之间。");
  if (touchingBottom && immersionPercent !== 100) throw new RangeError("碰底演练要求物体先完全浸没。");
  const vessel = { left: 146, right: 434, top: 290, bottom: 548 };
  const fraction = immersionPercent / 100;
  const displacedVolumeCm3 = objectVolumeCm3 * fraction;
  const surfaceY = 366 - displacedVolumeCm3 / 3;
  const height = objectVolumeCm3 * .6;
  const width = 68;
  // At zero the object is visibly in air. Once in contact, its submerged height
  // follows the same fraction as displaced volume; lowering further does not add buoyancy.
  const airGap = immersionPercent === 0 ? 24 : 0;
  const top = touchingBottom ? vessel.bottom - height : surfaceY - height * (1 - fraction) - airGap;
  return {
    viewBox: "0 0 600 630", vessel, surfaceY, displacedVolumeCm3,
    object: { left: 290 - width / 2, top, width, height, bottom: top + height },
    fullyImmersed: fraction === 1,
    submergedFraction: fraction,
    suspension: { x: 290, top: 232, bottom: top }
  };
}
