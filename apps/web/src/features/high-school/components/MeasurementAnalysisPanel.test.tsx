import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCapacitorHistory, analyzeHighSchoolMeasurements, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, simulateHighSchoolExperiment, type HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { MeasurementAnalysisPanel } from "./MeasurementAnalysisPanel";
import { MeasurementPointTable } from "./MeasurementPointTable";
import type { HighSchoolMeasurement } from "../experiments/workbench";

function reading(experimentId: HighSchoolExperimentId, id: string, changes: Record<string, number> = {}, timeSeconds = 0): HighSchoolMeasurement {
  const parameters = { ...defaultHighSchoolParameters(experimentId), ...changes };
  const capacitorHistory = experimentId === "capacitor-charge" ? createCapacitorHistory("analysis-render") : undefined;
  return { id, createdAt: "2026-11-11T00:00:00.000Z", timeSeconds, parameters, metrics: simulateHighSchoolExperiment(experimentId, parameters, timeSeconds, capacitorHistory).metrics, ...(capacitorHistory ? { capacitorHistory } : {}) };
}

function readyRecords(id: HighSchoolExperimentId) {
  if (id === "uniform-acceleration") return [0, .2, .4, .6].map((time, index) => reading(id, `sample-${index + 1}`, {}, time));
  return [0, 1, 2].map((index) => {
    const recordId = `sample-${index + 1}`;
    // Steady instruments need distinct controlled conditions, not three timestamps.
    if (id === "centripetal-force") return reading(id, recordId, {mass: .1 + index * .1});
    if (id === "precision-length") return reading(id, recordId, {contactMode: 2, zeroCorrection: 1, objectLengthMm: 2 + index * 3});
    if (id === "resistivity") return reading(id, recordId, {length: .5 + index * .5});
    if (id === "multimeter") return reading(id, recordId, {supplyVoltage: 3 + index * 3});
    if (id === "momentum-conservation") return reading(id, recordId, {velocity1: .5 + index * .5}, 2);
    if (id === "refractive-index") return reading(id, recordId, {incidentAngleDegrees: index * 20});
    if (id === "transformer-ratio") return reading(id, recordId, {primaryRmsVoltage: 3 + index * 3});
    if (id === "oil-film") return reading(id, recordId, {filmAreaCm2: 50 + index * 50});
    if (id === "gas-pressure-volume") return reading(id, recordId, {volumeMl: 20 + index * 20});
    if (id === "photoelectric-effect") return reading(id, recordId, {frequencyTHz: 600 + index * 200});
    if (id === "charged-particle-field") return reading(id, recordId, {speedKmPerSecond: 1 + index});
    if (id === "force-composition") return reading(id, recordId, { angle2Degrees: index * 60 });
    if (id === "spring-force") return reading(id, recordId, { loadMassGrams: index * 100 });
    if (id === "newton-second-law") return reading(id, recordId, { cartMass: .6 - (.05 + index * .05), hangingMass: .05 + index * .05 });
    if (id === "pendulum") return reading(id, recordId, { length: .5 + index * .5, amplitudeDegrees: 5 });
    if (id === "emf-internal-resistance") return reading(id, recordId, { loadResistance: 2 + index * 3 });
    if (id === "double-slit") return reading(id, recordId, { screenDistance: 1 + index * .5 });
    return reading(id, recordId, {}, index * .2);
  });
}

function render(id: HighSchoolExperimentId, records: HighSchoolMeasurement[]) {
  return renderToStaticMarkup(<MeasurementAnalysisPanel experimentId={id} records={records} />);
}

describe("high-school measurement analysis rendering", () => {
  for (const { id } of HIGH_SCHOOL_EXPERIMENTS) {
    it(`shows honest empty-state guidance for ${id}`, () => {
      const html = render(id, []);
      const analysis = analyzeHighSchoolMeasurements(id, []);
      expect(html).toContain("仿真记录分析");
      expect(html).toContain("还没有可分析的采样点");
      expect(html).toContain("下一组记录这样做");
      expect(html).toContain((id === "uniform-acceleration" ? analysis.groups.find((group) => group.relationshipId === "interval-velocity-time")! : analysis.groups[0]).nextStep);
      expect(html).toContain('data-analysis-status="insufficient"');
      expect(html).not.toContain('data-analysis-fit="true"');
      expect(html).not.toContain('class="hs-analysis-estimates"');
      expect(html).not.toMatch(/NaN|Infinity/);
      expect(html).not.toContain('href="#');
    });

    it(`renders saved points, model fit, units and applicable conditions for ${id}`, () => {
      const records = readyRecords(id);
      const analysis = analyzeHighSchoolMeasurements(id, records);
      const group = id === "uniform-acceleration" ? analysis.groups.find((candidate) => candidate.relationshipId === "interval-velocity-time")! : analysis.groups[0];
      const html = render(id, records);
      expect(group.status).toBe("ready");
      expect(html).toContain('data-analysis-status="ready"');
      expect(html).toContain('data-analysis-fit="true"');
      expect(html.match(/data-analysis-point=/g)).toHaveLength(3);
      for (const estimate of group.estimates) {
        expect(html).toContain(estimate.label);
        expect(html).toContain(estimate.unit);
      }
      expect(html).toContain(id === "uniform-acceleration" ? "查看位置区间与速度计算" : "查看本组采样数值");
      expect(html).toContain("不代表真实器材的测量精度");
      expect(html).not.toMatch(/NaN|Infinity/);
    });
  }

  it("keeps changed control conditions in separate selectable groups instead of creating a false fit", () => {
    const records = [reading("uniform-acceleration", "a", {}, 0), reading("uniform-acceleration", "b", { acceleration: 1.5 }, .2), reading("uniform-acceleration", "c", { acceleration: 1.5 }, .4)];
    const html = render("uniform-acceleration", records);
    expect(html).toContain("条件组 01 · 0 个");
    expect(html).toContain("条件组 02 · 1 个");
    expect(html).not.toContain("data-analysis-point=");
    expect(html).not.toContain('data-analysis-fit="true"');
    expect(html).toContain("改变控制变量的记录会分开分析");
  });

  it("offers all projectile relationships as distinct selection options", () => {
    const html = render("projectile-motion", readyRecords("projectile-motion"));
    expect(html).toContain('value="horizontal-position-time"');
    expect(html).toContain('value="vertical-velocity-time"');
    expect(html).toContain('value="vertical-drop-time-squared"');
    expect(html.match(/data-analysis-point=/g)).toHaveLength(3);
  });

  it("shows large-angle pendulum samples but withholds a small-angle gravity estimate", () => {
    const records = [0.5, 1, 1.5].map((length, index) => reading("pendulum", `large-${index}`, { amplitudeDegrees: 45, length }));
    const html = render("pendulum", records);
    expect(html).toContain('data-analysis-status="unsupported"');
    expect(html).toContain("释放摆角超过 10°");
    expect(html.match(/data-analysis-point=/g)).toHaveLength(3);
    expect(html).not.toContain('data-analysis-fit="true"');
    expect(html).not.toContain('class="hs-analysis-estimates"');
  });

  it("renders a valid zero-internal-resistance fit with undefined R-squared", () => {
    const records = [2, 5, 8].map((loadResistance, index) => reading("emf-internal-resistance", `ideal-${index}`, { internalResistance: 0, loadResistance }));
    const html = render("emf-internal-resistance", records);
    expect(html).toContain('data-analysis-fit="true"');
    expect(html).toContain("未定义");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("explains excluded readings without silently replacing missing history", () => {
    const record = reading("uniform-acceleration", "missing-velocity");
    record.metrics = record.metrics.filter((metric) => metric.key !== "velocity");
    const html = render("uniform-acceleration", [record]);
    expect(html).toContain("1 条记录未参与分析");
    expect(html).toContain("不能用当前模型补造历史数据");
    expect(html).not.toContain("data-analysis-point=");
  });

  it("escapes persisted record identifiers in SVG attributes", () => {
    const html = render("emf-internal-resistance", [reading("emf-internal-resistance", '"><script>alert(1)</script>')]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("opens uniform motion with position-derived intervals and exposes enough values to recalculate each speed", () => {
    const records = readyRecords("uniform-acceleration");
    for (const record of records) record.metrics.find((metric) => metric.key === "velocity")!.value = 999;
    records.splice(2, 0, { ...records[1], id: "repeated-time", metrics: records[1].metrics.map((metric) => ({ ...metric })) });
    const html = render("uniform-acceleration", records);
    expect(html).toContain('value="interval-velocity-time" selected=""');
    expect(html).toContain('value="velocity-time"');
    expect(html.match(/data-analysis-point=/g)).toHaveLength(3);
    expect(html).toContain("至少4个不同时刻");
    expect(html).toContain("只有在匀变速条件下");
    expect(html).toContain("相同时间的重复位置先取均值");
    expect(html).toContain("由位置记录推算的区间速度");
    expect(html).toContain("来源记录 1、2、3");
    expect(html).toContain("0 → 0.2");
    expect(html).toContain("0 → 0.216");
    expect(html).toContain(">1.08</td>");
    expect(html).toContain("Δt / s");
    expect(html).toContain("Δx / m");
    expect(html).not.toContain(">999</td>");
    expect(html).not.toContain("图中保留全部原始点");
  });

  it("requires four different position times even when the direct model-velocity fit is already possible", () => {
    const records = readyRecords("uniform-acceleration").slice(0, 3);
    const html = render("uniform-acceleration", records);
    expect(html.match(/data-analysis-point=/g)).toHaveLength(2);
    expect(html).toContain('data-analysis-status="insufficient"');
    expect(html).not.toContain('data-analysis-fit="true"');
    expect(html).toContain("至少4个不同时刻");
  });

  it("offers the fixed-force mass relationship and preserves original record references in its table", () => {
    const records = [.5, 1, 1.5].map((cartMass, index) => reading("newton-second-law", `mass-${index}`, { cartMass, hangingMass: .05, resistance: .05 }));
    const html = render("newton-second-law", records);
    expect(html).toContain('value="acceleration-net-force"');
    expect(html).toContain('value="acceleration-inverse-mass"');
    const group = analyzeHighSchoolMeasurements("newton-second-law", records).groups.find((entry) => entry.relationshipId === "acceleration-inverse-mass")!;
    expect(group.status).toBe("ready");
    const table = renderToStaticMarkup(<MeasurementPointTable group={group} recordNumbers={new Map(records.map((record, index) => [record.id, index + 1]))} />);
    expect(table).toContain(group.xAxis.unit);
    expect(table).toContain("m/s²");
    expect(table).toContain('scope="row">1</th>');
    expect(table).toContain('scope="row">3</th>');
    expect(table).not.toContain("位置起止");
  });
});
