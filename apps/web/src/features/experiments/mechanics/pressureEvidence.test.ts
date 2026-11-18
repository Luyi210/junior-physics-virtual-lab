import { describe, expect, it } from "vitest";
import { analyzePressureEvidence, createPressureEvidence, pressureEvidenceVerdict } from "./pressureEvidence";

describe("pressure and visible foam evidence", () => {
  it("does not validate deeper indentation when the two area readings are both saturated", () => {
    const records = [[150, 15], [150, 30], [125, 30]].map(([force, area], id) => createPressureEvidence(id, force!, area!));
    expect(records.map((row) => row.indentation)).toEqual([18, 18, 16.7]);
    expect(records.map((row) => row.pressure)).toEqual([100000, 50000, 125 / .003]);
    const result = analyzePressureEvidence(records);
    expect(result.forceEvidence).toBeDefined(); expect(result.areaEvidence).toBeUndefined();
    expect(result).toMatchObject({ ready: false, saturationBlocked: true });
    const verdict = pressureEvidenceVerdict(result, "deeper")!;
    expect(verdict.valid).toBe(false); expect(verdict.detail).toContain("不能据此判定压痕更深");
    expect(verdict.detail).not.toContain("面积预测与证据一致");
  });

  it("does not use a saturated baseline and greater load as evidence of visible force effect", () => {
    const result = analyzePressureEvidence([createPressureEvidence(2, 225, 15), createPressureEvidence(1, 150, 15)]);
    expect(result).toMatchObject({ ready: false, saturationBlocked: true });
    expect(result.forceEvidence).toBeUndefined();
  });

  it("uses displayed tenths of a millimeter, preserves Pa conversion and retains immutable readings", () => {
    const row = createPressureEvidence(1, 50, 60);
    expect(row.indentation).toBe(3.3); expect(row.pressure).toBeCloseTo(8333.3333333333);
    expect(Object.isFrozen(row)).toBe(true);
    // Deliberately supplied near-identical observations have hidden digits but
    // the same 3.3 mm ruler reading. A calculated p change cannot replace that.
    const result = analyzePressureEvidence([{ ...row, id: 2, force: 75, pressure: 12500, indentation: 3.34 }, { ...row, indentation: 3.31 }]);
    expect(result.forceEvidence).toBeUndefined();
  });

  it("recognizes both visible effects without mixing controls, while preserving saturated exploration", () => {
    const records = [[150, 15], [150, 30], [75, 30], [75, 60], [50, 60]].map(([force, area], id) => createPressureEvidence(id, force!, area!));
    const result = analyzePressureEvidence(records);
    expect(result.ready).toBe(true);
    const verdict = pressureEvidenceVerdict(result, "deeper")!;
    expect(verdict.valid).toBe(true); expect(verdict.detail).toContain("可辨压痕对照");
    expect(verdict.detail).toContain("饱和组");
    expect(records).toHaveLength(5);
    const mixed = analyzePressureEvidence([createPressureEvidence(1, 50, 60), createPressureEvidence(2, 75, 30)]);
    expect(mixed.forceEvidence).toBeUndefined(); expect(mixed.areaEvidence).toBeUndefined();
  });

  it("handles reversed comparison order and rejects invalid readings", () => {
    const rows = [createPressureEvidence(1, 50, 60), createPressureEvidence(2, 75, 60), createPressureEvidence(3, 75, 30)];
    expect(analyzePressureEvidence(rows).ready).toBe(true);
    expect(analyzePressureEvidence([...rows].reverse()).ready).toBe(true);
    for (const force of [NaN, Infinity, -1]) expect(() => createPressureEvidence(1, force, 30)).toThrow(RangeError);
    expect(() => createPressureEvidence(1, 50, 0)).toThrow(RangeError);
  });
});
