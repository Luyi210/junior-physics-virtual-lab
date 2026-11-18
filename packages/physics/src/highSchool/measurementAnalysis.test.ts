import { describe, expect, it } from "vitest";
import {
  analyzeHighSchoolMeasurements, defaultHighSchoolParameters, simulateHighSchoolExperiment,
  type HighSchoolAnalysisMeasurement, type HighSchoolAnalysisGroup, type HighSchoolExperimentId
} from "./index";

function sample(id: HighSchoolExperimentId, overrides: Record<string, number> = {}, timeSeconds = 0, name = `${timeSeconds}:${JSON.stringify(overrides)}`): HighSchoolAnalysisMeasurement {
  const parameters = { ...defaultHighSchoolParameters(id), ...overrides };
  return { id: name, timeSeconds, parameters, metrics: simulateHighSchoolExperiment(id, parameters, timeSeconds).metrics.map((entry) => ({ ...entry })) };
}
function replace(reading: HighSchoolAnalysisMeasurement, key: string, value: number) {
  return { ...reading, metrics: reading.metrics.map((entry) => entry.key === key ? { ...entry, value } : entry) };
}
function estimate(group: HighSchoolAnalysisGroup, key: string) { return group.estimates.find((entry) => entry.key === key)!.value; }
function relationGroups(id: HighSchoolExperimentId, records: HighSchoolAnalysisMeasurement[], relationshipId: string) {
  return analyzeHighSchoolMeasurements(id, records).groups.filter((group) => group.relationshipId === relationshipId);
}

describe("saved virtual measurement analysis", () => {
  it("identifies its provenance and supplies useful empty groups without fabricating data", () => {
    const result = analyzeHighSchoolMeasurements("projectile-motion", []);
    expect(result.provenance).toBe("simulation");
    expect(result.notice).toContain("不是真实器材测量");
    expect(result.acceptedCount).toBe(0);
    expect(result.groups).toHaveLength(3);
    expect(result.groups.every((group) => group.status === "insufficient" && group.fit === null && group.points.length === 0 && group.reasons.length > 0 && group.nextStep)).toBe(true);
  });

  it("fits the saved v-t data rather than silently replacing readings with model values", () => {
    const records = [0, 1, 2, 3].map((time) => replace(sample("uniform-acceleration", { acceleration: 0.8 }, time), "velocity", -2 * time + 4));
    const result = analyzeHighSchoolMeasurements("uniform-acceleration", records);
    const group = result.groups[0]!;
    expect(group.status).toBe("ready");
    expect(estimate(group, "acceleration")).toBeCloseTo(-2, 12);
    expect(estimate(group, "initialVelocity")).toBeCloseTo(4, 12);
    expect(group.fit!.points).toEqual([{ x: 0, y: 4 }, { x: 3, y: -2 }]);
    expect(group.fit!.rSquared).toBe(1);
    expect(group.fit!.rmse).toBe(0);
    expect(records[0]!.parameters.acceleration).toBe(0.8);
  });

  it("keeps changed controls in separate groups and does not force a regression through two x values", () => {
    const records = [sample("uniform-acceleration", {}, 0), sample("uniform-acceleration", {}, 1), sample("uniform-acceleration", { acceleration: 1.2 }, 2)];
    const result = analyzeHighSchoolMeasurements("uniform-acceleration", records);
    expect(result.groups.filter((group) => group.relationshipId === "velocity-time").map((group) => group.distinctXCount)).toEqual([2, 1]);
    expect(result.groups.filter((group) => group.relationshipId === "interval-velocity-time").map((group) => group.distinctXCount)).toEqual([1, 0]);
    expect(result.groups.every((group) => group.fit === null && group.status === "insufficient")).toBe(true);
  });

  it("does not count repeated readings as distinct x values and weights each distinct x once", () => {
    const repeated = Array.from({ length: 10 }, (_, i) => sample("uniform-acceleration", {}, 1, `repeat-${i}`));
    const insufficient = analyzeHighSchoolMeasurements("uniform-acceleration", repeated).groups[0]!;
    expect(insufficient.distinctXCount).toBe(1);
    expect(insufficient.fit).toBeNull();
    const records = [replace(sample("uniform-acceleration", {}, 0), "velocity", 0), replace(sample("uniform-acceleration", {}, 1), "velocity", 1), replace(sample("uniform-acceleration", {}, 2), "velocity", 3)];
    const ordinary = analyzeHighSchoolMeasurements("uniform-acceleration", records).groups[0]!;
    const duplicates = analyzeHighSchoolMeasurements("uniform-acceleration", [...records, ...Array.from({ length: 8 }, (_, i) => ({ ...records[2]!, id: `copy-${i}` }))]).groups[0]!;
    expect(duplicates.distinctXCount).toBe(3);
    expect(duplicates.fit!.slope).toBeCloseTo(ordinary.fit!.slope, 12);
    expect(duplicates.fit!.rmse).toBeCloseTo(ordinary.fit!.rmse, 12);
    expect(ordinary.fit!.rmse).toBeGreaterThan(0);
    expect(ordinary.fit!.rSquared).toBeLessThan(1);
  });

  it("declares mean-based fit statistics while preserving all six scattered original readings", () => {
    const records = [0, 1, 2].flatMap((time) => [-1, 1].map((offset) => replace(sample("uniform-acceleration", {}, time, `${time}:${offset}`), "velocity", 2 * time + 1 + offset)));
    const group = analyzeHighSchoolMeasurements("uniform-acceleration", records).groups[0]!;
    expect(group.distinctXCount).toBe(3);
    expect(group.points.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 0, y: 0 }, { x: 0, y: 2 },
      { x: 1, y: 2 }, { x: 1, y: 4 },
      { x: 2, y: 4 }, { x: 2, y: 6 }
    ]);
    expect(group.fit).toMatchObject({ statisticsBasis: "distinct-x-means", slope: 2, intercept: 1, rmse: 0, rSquared: 1 });
    expect(group.fit!.points).toEqual([{ x: 0, y: 1 }, { x: 2, y: 5 }]);
  });

  it("rejects non-finite readings, incomplete parameters, wrong units, duplicates and overflow explicitly", () => {
    const good = sample("uniform-acceleration", {}, 0, "good");
    const missingMetric = { ...sample("uniform-acceleration", {}, 1, "missing-metric"), metrics: [] };
    const missingParameters = { ...sample("uniform-acceleration", {}, 1, "missing-parameters"), parameters: { acceleration: 1 } };
    const wrongUnit = sample("uniform-acceleration", {}, 1, "wrong-unit"); wrongUnit.metrics.find((entry) => entry.key === "velocity")!.unit = "km/h";
    const result = analyzeHighSchoolMeasurements("uniform-acceleration", [good, good, replace(sample("uniform-acceleration", {}, 1, "nan"), "velocity", NaN), missingMetric, missingParameters, wrongUnit, { ...good, id: "bad-time", timeSeconds: Infinity }]);
    expect(result.acceptedCount).toBe(1);
    expect(result.excluded).toHaveLength(6);
    expect(result.excluded.map((entry) => entry.reason).join(" ")).toMatch(/默认值/);
    expect(result.excluded.map((entry) => entry.reason).join(" ")).toMatch(/不能用当前模型补造/);
    const huge = replace(sample("pendulum"), "period", 1e300);
    expect(analyzeHighSchoolMeasurements("pendulum", [huge]).excluded[0]!.reason).toContain("溢出");
    expect(() => analyzeHighSchoolMeasurements("not-an-experiment" as HighSchoolExperimentId, [])).toThrow(RangeError);
  });

  it("rejects nearly identical independent values instead of amplifying roundoff into a slope", () => {
    const records = [0, 1e-12, 2e-12].map((time) => sample("uniform-acceleration", {}, time));
    const group = analyzeHighSchoolMeasurements("uniform-acceleration", records).groups[0]!;
    expect(group.distinctXCount).toBe(3);
    expect(group.fit).toBeNull();
    expect(group.reasons.join(" ")).toContain("变化过小");
  });
});

describe("physical meaning and controlled comparisons", () => {
  it("groups equal total masses despite floating arithmetic and uses system net force rather than tension", () => {
    const records = [
      sample("newton-second-law", { cartMass: 0.5, hangingMass: 0.05 }),
      sample("newton-second-law", { cartMass: 0.45, hangingMass: 0.1 }),
      sample("newton-second-law", { cartMass: 0.4, hangingMass: 0.15 })
    ];
    const result = analyzeHighSchoolMeasurements("newton-second-law", records);
    expect(result.groups.filter((group) => group.relationshipId === "acceleration-net-force")).toHaveLength(1);
    const group = result.groups[0]!;
    expect(group.status).toBe("ready");
    expect(estimate(group, "totalMass")).toBeCloseTo(0.55, 12);
    expect(group.points[0]!.x).toBeCloseTo(0.05 * 9.8 - 0.05, 12);
    expect(group.points[0]!.x).not.toBe(records[0]!.metrics.find((entry) => entry.key === "tension")!.value);
    expect(group.conditions.join(" ")).toContain("不是绳张力");
    const mixed = analyzeHighSchoolMeasurements("newton-second-law", [...records, sample("newton-second-law", { cartMass: 0.5, hangingMass: 0.1 }), sample("newton-second-law", { cartMass: 0.45, hangingMass: 0.1, resistance: 0.1 })]);
    expect(mixed.groups.filter((group) => group.relationshipId === "acceleration-net-force")).toHaveLength(3);
  });

  it("excludes static-threshold cases rather than plotting a fictional negative net force", () => {
    const result = analyzeHighSchoolMeasurements("newton-second-law", [sample("newton-second-law", { hangingMass: 0.05, resistance: 1 })]);
    expect(result.acceptedCount).toBe(0);
    expect(result.excluded[0]!.reason).toContain("实际合外力为零");
  });

  it.each([0, 30, 90])("fits both projectile components at a %s degree angle without assuming zero vertical launch velocity", (angleDegrees) => {
    const records = [0, 0.2, 0.4].map((time) => sample("projectile-motion", { initialSpeed: 8, angleDegrees, initialHeight: 2 }, time));
    const result = analyzeHighSchoolMeasurements("projectile-motion", records);
    const horizontal = result.groups.find((group) => group.relationshipId === "horizontal-position-time")!;
    const vertical = result.groups.find((group) => group.relationshipId === "vertical-velocity-time")!;
    expect(estimate(horizontal, "horizontalVelocity")).toBeCloseTo(8 * Math.cos(angleDegrees * Math.PI / 180), 12);
    expect(estimate(vertical, "initialVerticalVelocity")).toBeCloseTo(8 * Math.sin(angleDegrees * Math.PI / 180), 12);
    expect(estimate(vertical, "gravity")).toBeCloseTo(9.8, 12);
    expect(vertical.conditions.join(" ")).toContain(angleDegrees ? "必须保留拟合截距" : "竖直初速度为零");
  });

  it("handles zero-speed angled settings as a drop and excludes post-impact timestamps", () => {
    const records = [0, 0.2, 0.4].map((time) => sample("projectile-motion", { initialSpeed: 0, angleDegrees: 30, initialHeight: 2 }, time));
    const groups = analyzeHighSchoolMeasurements("projectile-motion", records).groups;
    expect(groups[0]!.fit!.rSquared).toBeNull();
    expect(groups[1]!.conditions.join(" ")).toContain("设置了角度也不会产生斜抛初速度");
    expect(estimate(groups[1]!, "initialVerticalVelocity")).toBeCloseTo(0, 12);
    const invalid = sample("projectile-motion", {}, 10);
    expect(analyzeHighSchoolMeasurements("projectile-motion", [invalid]).excluded[0]!.reason).toContain("落地");
  });

  it("requires saved flight-window evidence and explicit units before comparing projectile readings", () => {
    const valid = sample("projectile-motion", {}, 0.2);
    const missingWindow = { ...valid, metrics: valid.metrics.filter((entry) => entry.key !== "flightTime") };
    expect(analyzeHighSchoolMeasurements("projectile-motion", [missingWindow]).excluded[0]!.reason).toContain("缺少已保存的 flightTime");
    expect(analyzeHighSchoolMeasurements("projectile-motion", [replace(valid, "flightTime", -1)]).excluded[0]!.reason).toContain("飞行时间必须非负");
    for (const key of ["flightTime", "x", "vy"]) {
      for (const unit of [undefined, "wrong-unit"]) {
        const invalid = { ...valid, metrics: valid.metrics.map((entry) => entry.key === key ? { ...entry, unit } : entry) };
        const result = analyzeHighSchoolMeasurements("projectile-motion", [invalid]);
        expect(result.acceptedCount).toBe(0);
        expect(result.excluded[0]!.reason).toContain(key);
        expect(result.excluded[0]!.reason).toContain("单位");
      }
    }
    const grounded = sample("projectile-motion", { initialSpeed: 0, initialHeight: 0 }, 0);
    expect(analyzeHighSchoolMeasurements("projectile-motion", [grounded]).acceptedCount).toBe(1);
    expect(analyzeHighSchoolMeasurements("projectile-motion", [{ ...grounded, timeSeconds: 0.01 }]).acceptedCount).toBe(0);
  });

  it("estimates pendulum g only under a declared small-angle approximation and exposes its finite-angle bias", () => {
    const records = [0.5, 1, 1.5].map((length) => sample("pendulum", { length, amplitudeDegrees: 10 }));
    const group = analyzeHighSchoolMeasurements("pendulum", records).groups[0]!;
    expect(group.status).toBe("ready");
    expect(estimate(group, "gravity")).toBeGreaterThan(9.76);
    expect(estimate(group, "gravity")).toBeLessThan(9.8);
    expect(group.conditions.join(" ")).toContain("近似偏差");
    expect(group.conditions.join(" ")).toContain("不是学生用秒表");
    const large = analyzeHighSchoolMeasurements("pendulum", [0.5, 1, 1.5].map((length) => sample("pendulum", { length, amplitudeDegrees: 60 }))).groups[0]!;
    expect(large.points).toHaveLength(3);
    expect(large.status).toBe("unsupported");
    expect(large.fit).toBeNull();
    expect(large.estimates).toHaveLength(0);
    expect(large.reasons.join(" ")).toContain("不提供错误的重力加速度");
  });

  it("recovers emf and internal resistance while splitting different source settings", () => {
    const records = [1, 3, 8].map((loadResistance) => sample("emf-internal-resistance", { emf: 3, internalResistance: 0.2, loadResistance }));
    const group = analyzeHighSchoolMeasurements("emf-internal-resistance", records).groups[0]!;
    expect(estimate(group, "emf")).toBeCloseTo(3, 12);
    expect(estimate(group, "internalResistance")).toBeCloseTo(0.2, 12);
    expect(group.fit!.slope).toBeCloseTo(-0.2, 12);
    const mixed = analyzeHighSchoolMeasurements("emf-internal-resistance", [records[0]!, records[1]!, sample("emf-internal-resistance", { emf: 6, loadResistance: 8, internalResistance: 0.2 })]);
    expect(mixed.groups).toHaveLength(2);
    expect(mixed.groups.every((entry) => entry.fit === null)).toBe(true);
  });

  it("marks constant and nearly constant ideal-source voltage R² undefined rather than claiming perfect evidence", () => {
    for (const noise of [0, 1e-14]) {
      const records = [0.3, 1, 7].map((loadResistance, index) => replace(sample("emf-internal-resistance", { emf: 3, internalResistance: 0, loadResistance }), "terminalVoltage", 3 + (index - 1) * noise));
      const group = analyzeHighSchoolMeasurements("emf-internal-resistance", records).groups[0]!;
      expect(group.status).toBe("ready");
      expect(group.fit!.rSquared).toBeNull();
      expect(estimate(group, "emf")).toBeCloseTo(3, 12);
      expect(estimate(group, "internalResistance")).toBeCloseTo(0, 12);
      expect(group.conditions.join(" ")).toContain("I>0 且 r>0 时 U<E");
      expect(group.conditions.join(" ")).toContain("r=0 时 U=E");
      expect(group.points.every((point) => Math.abs(point.y - 3) < 2e-14)).toBe(true);
    }
  });

  it("labels the double-slit spacing fit as a model consistency check rather than an independent wavelength measurement", () => {
    const records = [0.5, 1, 2].map((screenDistance) => sample("double-slit", { wavelengthNm: 550, slitSeparationMm: 0.25, screenDistance }));
    const group = analyzeHighSchoolMeasurements("double-slit", records).groups[0]!;
    expect(group.status).toBe("ready");
    expect(estimate(group, "wavelengthNm")).toBeCloseTo(550, 10);
    expect(group.conditions.join(" ")).toContain("不能当作独立测量波长的证据");
    const mixed = analyzeHighSchoolMeasurements("double-slit", [...records, sample("double-slit", { wavelengthNm: 600 }), sample("double-slit", { slitSeparationMm: 0.3 }), sample("double-slit", { screenPositionMm: 1 })]);
    expect(mixed.groups).toHaveLength(4);
  });
});

describe("position-derived interval velocity", () => {
  const intervalGroups = (records: HighSchoolAnalysisMeasurement[]) => relationGroups("uniform-acceleration", records, "interval-velocity-time");

  it("uses saved positions at unequal times, preserves negative acceleration and ignores the saved velocity and model answer", () => {
    const records = [0, 0.5, 1.5, 3].map((time) => replace(replace(sample("uniform-acceleration", {}, time), "position", 5 + 3 * time - time ** 2), "velocity", 100 + 7 * time));
    const result = analyzeHighSchoolMeasurements("uniform-acceleration", records);
    expect(result.groups.map((group) => group.relationshipId)).toEqual(["velocity-time", "interval-velocity-time"]);
    const group = result.groups[1]!;
    expect(group.pointSource).toBe("position-interval");
    expect(result.groups[0]!.pointSource).toBe("saved-reading");
    expect(group.status).toBe("ready");
    expect(group.points.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 0.25, y: 2.5 }, { x: 1, y: 1 }, { x: 2.25, y: -1.5 }]);
    expect(estimate(group, "acceleration")).toBeCloseTo(-2, 12);
    expect(estimate(group, "initialVelocity")).toBeCloseTo(3, 12);
    expect(estimate(result.groups[0]!, "acceleration")).toBeCloseTo(7, 12);
    expect(group.points[0]).toMatchObject({ sourceRecordIds: [records[0]!.id, records[1]!.id], interval: { startTimeSeconds: 0, endTimeSeconds: 0.5, startPosition: 5, endPosition: 6.25 } });
    expect(group.conditions.join(" ")).toContain("不适用于任意变速运动");
    expect(group.conditions.join(" ")).toContain("区间共享端点");
    expect(group.nextStep).toContain("至少 4 个");
  });

  it("averages repeated-time positions and retains every source id without mutating or depending on record order", () => {
    const p = { initialVelocity: 1, acceleration: 2 };
    const records = [sample("uniform-acceleration", p, 0, "t0"), replace(sample("uniform-acceleration", p, 1, "t1-b"), "position", 3), replace(sample("uniform-acceleration", p, 1, "t1-a"), "position", 1), sample("uniform-acceleration", p, 2, "t2"), sample("uniform-acceleration", p, 3, "t3")];
    const before = JSON.stringify(records);
    const group = intervalGroups(records)[0]!;
    expect(group.points.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 0.5, y: 2 }, { x: 1.5, y: 4 }, { x: 2.5, y: 6 }]);
    expect(group.points[0]).toMatchObject({ sourceRecordIds: ["t0", "t1-a", "t1-b"], interval: { startTimeSeconds: 0, endTimeSeconds: 1, startPosition: 0, endPosition: 2 } });
    expect(group.points[1]!.sourceRecordIds).toEqual(["t1-a", "t1-b", "t2"]);
    expect(estimate(group, "acceleration")).toBeCloseTo(2, 12);
    expect(intervalGroups([...records].reverse())[0]!.points).toEqual(group.points);
    expect(JSON.stringify(records)).toBe(before);
  });

  it("requires four distinct times and never bridges changed initial velocity, acceleration or duration", () => {
    const three = [0, 1, 2].map((time) => sample("uniform-acceleration", {}, time));
    const duplicates = [...three, ...Array.from({ length: 5 }, (_, n) => sample("uniform-acceleration", {}, 2, `repeat-${n}`))];
    const insufficient = intervalGroups(duplicates)[0]!;
    expect(insufficient.distinctXCount).toBe(2);
    expect(insufficient.status).toBe("insufficient");
    expect(insufficient.fit).toBeNull();
    expect(insufficient.reasons.join(" ")).toContain("至少需要 4 个不同时刻");
    const mixed = [...three, sample("uniform-acceleration", { initialVelocity: 2 }, 3), sample("uniform-acceleration", { acceleration: 1.2 }, 3), sample("uniform-acceleration", { duration: 6 }, 3)];
    const groups = intervalGroups(mixed);
    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.points.length)).toEqual([2, 0, 0, 0]);
    expect(groups.every((group) => group.fit === null)).toBe(true);
  });

  it("rejects unusably short time intervals and position-difference overflow while retaining the direct velocity relation", () => {
    const near = [0, 1e-12, 1, 2].map((time) => sample("uniform-acceleration", {}, time));
    const result = analyzeHighSchoolMeasurements("uniform-acceleration", near);
    expect(result.groups[0]!.status).toBe("ready");
    expect(result.groups[1]!.fit).toBeNull();
    expect(result.groups[1]!.reasons.join(" ")).toContain("时间间隔过小");
    const huge = [0, 1, 2, 3].map((time) => replace(sample("uniform-acceleration", {}, time), "position", time % 2 ? 1e308 : -1e308));
    expect(intervalGroups(huge)[0]!.reasons.join(" ")).toContain("溢出");
  });

  it("does not synthesize missing, non-finite or unitless saved positions", () => {
    const good = sample("uniform-acceleration", {}, 0);
    const invalid = [
      { ...good, metrics: good.metrics.filter((entry) => entry.key !== "position") },
      replace(good, "position", NaN),
      { ...good, metrics: good.metrics.map((entry) => entry.key === "position" ? { ...entry, unit: undefined } : entry) },
      { ...good, metrics: good.metrics.map((entry) => entry.key === "position" ? { ...entry, unit: "cm" } : entry) }
    ];
    for (const reading of invalid) {
      const result = analyzeHighSchoolMeasurements("uniform-acceleration", [reading]);
      expect(result.acceptedCount).toBe(0);
      expect(result.excluded).toHaveLength(1);
      expect(result.groups.every((group) => group.fit === null)).toBe(true);
    }
  });
});

describe("fixed-force acceleration versus inverse system mass", () => {
  const inverseGroups = (records: HighSchoolAnalysisMeasurement[]) => relationGroups("newton-second-law", records, "acceleration-inverse-mass");
  const settings = { hangingMass: 0.1, resistance: 0.2, travelDistance: 1 };

  it("uses the whole system mass and recovers mg minus resistance from saved accelerations", () => {
    const records = [0.2, 0.5, 1.5].map((cartMass) => sample("newton-second-law", { ...settings, cartMass }));
    const group = inverseGroups(records)[0]!;
    expect(group.status).toBe("ready");
    expect(group.pointSource).toBe("saved-reading");
    expect(group.xAxis.unit).toBe("kg⁻¹");
    expect(group.points.map((point) => point.x)).toEqual([1 / 1.6, 1 / 0.6, 1 / (0.2 + 0.1)]);
    expect(estimate(group, "netForce")).toBeCloseTo(0.78, 12);
    expect(estimate(group, "netForce")).not.toBeCloseTo(0.98, 5);
    expect(estimate(group, "accelerationIntercept")).toBeCloseTo(0, 12);
    expect(group.controls.map((control) => control.key)).toEqual(["hangingMass", "resistance", "travelDistance"]);
    const edited = records.map((reading) => replace(reading, "acceleration", 2 / (reading.parameters.cartMass! + reading.parameters.hangingMass!) + 0.25));
    expect(estimate(inverseGroups(edited)[0]!, "netForce")).toBeCloseTo(2, 12);
    expect(estimate(inverseGroups(edited)[0]!, "accelerationIntercept")).toBeCloseTo(0.25, 12);
  });

  it("isolates changed hanging mass, resistance and travel and does not count repeated masses as new settings", () => {
    const records = [0.2, 0.5].map((cartMass) => sample("newton-second-law", { ...settings, cartMass }));
    const groups = inverseGroups([...records, { ...records[0]!, id: "repeat" }, sample("newton-second-law", { ...settings, cartMass: 1, hangingMass: 0.2 }), sample("newton-second-law", { ...settings, cartMass: 1, resistance: 0.1 }), sample("newton-second-law", { ...settings, cartMass: 1, travelDistance: 2 })]);
    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.distinctXCount)).toEqual([2, 1, 1, 1]);
    expect(groups.every((group) => group.fit === null)).toBe(true);
  });

  it.each([0.98, 1, 2])("excludes static cases at resistance %s from both Newton relationships", (resistance) => {
    const records = [0.2, 0.5, 1].map((cartMass) => sample("newton-second-law", { hangingMass: 0.1, resistance, cartMass }));
    const result = analyzeHighSchoolMeasurements("newton-second-law", records);
    expect(result.acceptedCount).toBe(0);
    expect(result.excluded).toHaveLength(3);
    expect(result.groups.map((group) => group.relationshipId)).toEqual(["acceleration-net-force", "acceleration-inverse-mass"]);
    expect(result.groups.every((group) => group.fit === null)).toBe(true);
  });
});

describe("zero vertical launch velocity: drop versus time squared", () => {
  const dropGroup = (records: HighSchoolAnalysisMeasurement[]) => relationGroups("projectile-motion", records, "vertical-drop-time-squared")[0]!;

  it.each([{ initialSpeed: 8, angleDegrees: 0 }, { initialSpeed: 0, angleDegrees: 60 }])("fits downward distance from saved heights under %o", (launch) => {
    const records = [0, 0.2, 0.4].map((time) => sample("projectile-motion", { ...launch, initialHeight: 2 }, time));
    const group = dropGroup(records);
    expect(group.status).toBe("ready");
    expect(group.xAxis.unit).toBe("s²");
    expect(group.yAxis.unit).toBe("m");
    expect(group.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(group.points[2]!.x).toBeCloseTo(0.16, 12);
    expect(group.points[2]!.y).toBeCloseTo(0.784, 12);
    expect(estimate(group, "gravity")).toBeCloseTo(9.8, 12);
    expect(estimate(group, "verticalDropIntercept")).toBeCloseTo(0, 12);
    const edited = records.map((reading) => replace(replace(reading, "y", 2 - (3 * reading.timeSeconds ** 2 + 0.1)), "vy", -100 * reading.timeSeconds));
    expect(estimate(dropGroup(edited), "gravity")).toBeCloseTo(6, 12);
    expect(estimate(dropGroup(edited), "verticalDropIntercept")).toBeCloseTo(0.1, 12);
  });

  it("marks angled launches unsupported only for the new relationship and keeps both original fits", () => {
    const records = [0, 0.2, 0.4].map((time) => sample("projectile-motion", { initialSpeed: 8, angleDegrees: 30, initialHeight: 2 }, time));
    const result = analyzeHighSchoolMeasurements("projectile-motion", records);
    expect(result.acceptedCount).toBe(3);
    expect(result.groups.map((group) => group.relationshipId)).toEqual(["horizontal-position-time", "vertical-velocity-time", "vertical-drop-time-squared"]);
    expect(result.groups.map((group) => group.status)).toEqual(["ready", "ready", "unsupported"]);
    expect(result.groups[2]!.points).toHaveLength(3);
    expect(result.groups[2]!.fit).toBeNull();
    expect(result.groups[2]!.estimates).toEqual([]);
    expect(result.groups[2]!.reasons.join(" ")).toContain("竖直初速度不为零");
  });

  it("does not mix changed launch settings or accept absent, non-finite or incorrectly labelled heights", () => {
    const records = [0, 0.2].map((time) => sample("projectile-motion", {}, time));
    const mixed = [...records, sample("projectile-motion", { initialHeight: 3 }, 0.4), sample("projectile-motion", { initialSpeed: 10 }, 0.4), sample("projectile-motion", { angleDegrees: 30 }, 0.4)];
    const groups = relationGroups("projectile-motion", mixed, "vertical-drop-time-squared");
    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.fit === null)).toBe(true);
    const good = records[0]!;
    for (const invalid of [
      { ...good, metrics: good.metrics.filter((entry) => entry.key !== "y") }, replace(good, "y", Infinity),
      { ...good, metrics: good.metrics.map((entry) => entry.key === "y" ? { ...entry, unit: undefined } : entry) },
      { ...good, metrics: good.metrics.map((entry) => entry.key === "y" ? { ...entry, unit: "cm" } : entry) }
    ]) expect(analyzeHighSchoolMeasurements("projectile-motion", [invalid]).acceptedCount).toBe(0);
  });
});
