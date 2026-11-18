import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeverForceLineDiagnostic } from "./LeverForceLineDiagnostic";
import { LeverLab } from "./LeverLab";
import { appendLeverForceLineTrial, compareLeverForceLineTrials, createLeverForceLineTrial, hasLeverForceLineTrial, leverForceLineGeometry } from "./leverForceLineEvidence";

describe("lever force-line controlled evidence", () => {
  it("does not combine angles recorded with different force or suspension distance", () => {
    const ninety = createLeverForceLineTrial("ninety", 2, 6, 90);
    for (const thirty of [createLeverForceLineTrial("changed-force", 4, 6, 30), createLeverForceLineTrial("changed-distance", 2, 3, 30)]) {
      const result = compareLeverForceLineTrials([ninety, thirty]);
      expect(result.ready).toBe(false);
      expect(result.perpendicular).toBeNull();
      expect(result.reason).toContain("拉力或悬点距离不同");
    }
  });

  it("recognizes a matching pair among mixed settings and returns the original snapshots", () => {
    const ninety = createLeverForceLineTrial("ninety", 2, 6, 90);
    const thirty = createLeverForceLineTrial("thirty", 2, 6, 30);
    const result = compareLeverForceLineTrials([createLeverForceLineTrial("unrelated", 4, 5, 60), ninety, thirty]);
    expect(result.ready).toBe(true);
    expect(result.perpendicular).toBe(ninety);
    expect(result.oblique).toBe(thirty);
    expect(ninety).toMatchObject({ force: 2, pivotDistance: 6, angle: 90, perpendicularArm: 6, moment: 12 });
    expect(thirty.perpendicularArm).toBeCloseTo(3, 12);
    expect(thirty.moment).toBeCloseTo(6, 12);
    expect(Object.isFrozen(ninety)).toBe(true);
    expect(compareLeverForceLineTrials([createLeverForceLineTrial("sixty", 2, 6, 60), thirty]).ready).toBe(false);
  });

  it("deduplicates only the same saved conditions and does not mark a changed setup as recorded", () => {
    const trial = createLeverForceLineTrial("first", 2, 6, 90);
    const records = [trial];
    expect(appendLeverForceLineTrial(records, createLeverForceLineTrial("again", 2, 6, 90))).toBe(records);
    const changed = appendLeverForceLineTrial(records, createLeverForceLineTrial("new-force", 4, 6, 90));
    expect(changed).toHaveLength(2);
    expect(records).toEqual([trial]);
    expect(hasLeverForceLineTrial(records, 2, 6, 90)).toBe(true);
    expect(hasLeverForceLineTrial(records, 4, 6, 90)).toBe(false);
    expect(hasLeverForceLineTrial(records, 2, 3, 90)).toBe(false);
  });

  it("rejects invalid or internally inconsistent evidence instead of declaring a completed comparison", () => {
    expect(() => createLeverForceLineTrial("bad", NaN, 6, 90)).toThrow(RangeError);
    expect(() => createLeverForceLineTrial("bad", 2, Infinity, 90)).toThrow(RangeError);
    expect(() => createLeverForceLineTrial("bad", 0, 6, 90)).toThrow(RangeError);
    const ninety = createLeverForceLineTrial("ninety", 2, 6, 90);
    const corrupt = { ...createLeverForceLineTrial("thirty", 2, 6, 30), moment: 12 };
    expect(compareLeverForceLineTrials([ninety, corrupt]).ready).toBe(false);
    expect(() => appendLeverForceLineTrial([ninety], corrupt)).toThrow(RangeError);
  });

  it("renders the saved F/r/arm/moment after live controls change instead of recomputing past results", () => {
    const trials = [createLeverForceLineTrial("ninety", 2, 6, 90), createLeverForceLineTrial("thirty", 2, 6, 30)];
    const html = renderToStaticMarkup(createElement(LeverForceLineDiagnostic, { force: 6, pivotDistance: 9, angle: 30, trials, perpendicularArm: 4.5, moment: 27, comparison: compareLeverForceLineTrials(trials), invariantReady: true, onAngleChange: () => {}, onRecord: () => {} }));
    expect(html).toContain("已保存对照：F=2.0 N、r=6.0 格；90°时 l=6.00 格、力矩=12.00 N·格；30°时 l=3.00 格、力矩=6.00 N·格。");
    expect(html).toContain("记录当前作用线");
    expect(html).not.toContain("当前条件已记录");
    expect(html).toContain('data-part="perpendicular-arm"');
  });

  it("shows an empty beam during initial calibration instead of faded attached weights", () => {
    const html = renderToStaticMarkup(createElement(LeverLab));
    expect(html).toContain("lever-balance-bench calibrating");
    expect(html).toContain("空杠杆尚未调平");
    expect(html).not.toContain('class="lever-hanger');
  });
});

describe("lever force-line projection geometry", () => {
  it.each([30, 60, 90])("shows a true perpendicular arm at %s degrees from the actual pivot", (angle) => {
    for (const distance of [1, 2, 6, 9]) {
      const geometry = leverForceLineGeometry(distance, angle);
      const { origin, application, direction, foot } = geometry;
      expect(application.x - origin.x).toBe(distance * geometry.pixelsPerUnit);
      expect(application.y).toBe(origin.y);
      const arm = { x: foot.x - origin.x, y: foot.y - origin.y };
      expect(arm.x * direction.x + arm.y * direction.y).toBeCloseTo(0, 10);
      expect((foot.x - application.x) * direction.y - (foot.y - application.y) * direction.x).toBeCloseTo(0, 10);
      expect(Math.hypot(arm.x, arm.y) / geometry.pixelsPerUnit).toBeCloseTo(createLeverForceLineTrial("reference", 2, distance, angle).perpendicularArm, 10);
      for (const point of [origin, application, foot, geometry.lineStart, geometry.forceEnd, ...geometry.rightAngle]) {
        expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThan(520);
        expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThan(230);
      }
    }
  });

  it("extends the force line through the true foot even at the longest arm and shallowest angle", () => {
    const { application, lineStart, foot, direction } = leverForceLineGeometry(9, 30);
    expect(Math.hypot(application.x - foot.x, application.y - foot.y)).toBeGreaterThan(230);
    expect((foot.x - lineStart.x) * direction.x + (foot.y - lineStart.y) * direction.y).toBeCloseTo(8, 10);
    expect(() => leverForceLineGeometry(NaN, 30)).toThrow(RangeError);
  });
});
