import { describe, expect, it } from "vitest";
import { densityGeometry, densityVolumeToY } from "./densityGeometry";

describe("density cylinder calibration", () => {
  it("uses a single 0–100 mL calibration for all ticks and the lowest meniscus level", () => {
    const shape = densityGeometry({ waterAdded: true, sampleVolumeCm3: 20, immersed: false, condition: "correct" });
    expect(shape.volumeMl).toBe(50);
    expect(shape.surfaceY).toBe(200);
    expect(shape.ticks.find((tick) => tick.volumeMl === 50)?.y).toBe(shape.surfaceY);
    expect(densityVolumeToY(0)).toBe(350);
    expect(densityVolumeToY(100)).toBe(50);
    for (let index = 1; index < shape.ticks.length; index += 1) expect(shape.ticks[index - 1].y - shape.ticks[index].y).toBe(15);
  });

  it.each([12, 20, 25])("puts the full %s cm³ sample below the matching final-volume tick without floor contact", (volume) => {
    const shape = densityGeometry({ waterAdded: true, sampleVolumeCm3: volume, immersed: true, condition: "correct" });
    expect(shape.volumeMl).toBe(50 + volume);
    expect(shape.surfaceY).toBe(densityVolumeToY(50 + volume));
    expect(shape.object!.top).toBeGreaterThan(shape.surfaceY);
    expect(shape.object!.bottom).toBeLessThan(shape.scale.bottom);
    expect(shape.fullyImmersed).toBe(true);
  });

  it.each([12, 20, 25])("visibly exposes exactly 2 cm³ of the %s cm³ equal-cross-section specimen", (volume) => {
    const shape = densityGeometry({ waterAdded: true, sampleVolumeCm3: volume, immersed: true, condition: "partial" });
    const body = shape.object!;
    expect(body.top).toBeLessThan(shape.surfaceY);
    expect(body.bottom).toBeGreaterThan(shape.surfaceY);
    const visibleFraction = (shape.surfaceY - body.top) / body.height;
    expect(visibleFraction * volume).toBeCloseTo(2, 12);
    expect(shape.displacedVolumeMl).toBe(volume - 2);
    expect(shape.volumeMl).toBe(48 + volume);
    expect(shape.fullyImmersed).toBe(false);
    expect(body.bottom).toBeLessThan(shape.scale.bottom);
  });

  it("shows bubble displacement separately while the sample remains fully immersed", () => {
    const shape = densityGeometry({ waterAdded: true, sampleVolumeCm3: 20, immersed: true, condition: "bubbles" });
    expect(shape.submergedVolumeCm3).toBe(20);
    expect(shape.bubbleVolumeMl).toBe(2);
    expect(shape.volumeMl).toBe(72);
    expect(shape.fullyImmersed).toBe(true);
    expect(shape.object!.top).toBeGreaterThan(shape.surfaceY);
  });

  it("keeps an empty cylinder empty and a suspended sample above the initial water", () => {
    const empty = densityGeometry({ waterAdded: false, sampleVolumeCm3: null, immersed: false, condition: "correct" });
    expect(empty.volumeMl).toBe(0);
    expect(empty.object).toBeNull();
    for (const volume of [12, 20, 25]) {
      const before = densityGeometry({ waterAdded: true, sampleVolumeCm3: volume, immersed: false, condition: "correct" });
      expect(before.object!.bottom).toBeLessThan(before.surfaceY);
      expect(before.submergedVolumeCm3).toBe(0);
      expect(before.fullyImmersed).toBe(false);
    }
  });

  it("rejects invalid volumes and immersion without water or a specimen", () => {
    for (const volume of [-1, 101, NaN, Infinity]) expect(() => densityVolumeToY(volume)).toThrow(RangeError);
    expect(() => densityGeometry({ waterAdded: false, sampleVolumeCm3: 20, immersed: true, condition: "correct" })).toThrow(RangeError);
    expect(() => densityGeometry({ waterAdded: true, sampleVolumeCm3: null, immersed: true, condition: "correct" })).toThrow(RangeError);
  });
});
