import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculatePendulumTimingMeasurement, defaultHighSchoolParameters, highSchoolExperiment } from "@physics-lab/physics/high-school";
import type { HighSchoolMeasurement } from "../experiments/workbench";
import { MeasurementRecoveryPanel } from "./MeasurementRecoveryPanel";

const definition = highSchoolExperiment("uniform-acceleration");
const record: HighSchoolMeasurement = { id: "unassigned-1", createdAt: "2026-11-11T00:00:00.000Z", timeSeconds: 1, parameters: defaultHighSchoolParameters(definition.id), metrics: [{ key: "position", label: "位移", value: 1.4, unit: "m" }] };
const props = { records: [record], definition, reviewToken: "review-one", writable: true, onExport: () => {}, onRecover: () => {} };
const button = (html: string, label: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find((match) => match[2]!.includes(label));

describe("unassigned measurement recovery review", () => {
  it("shows the exact saved conditions and readouts separately from ordinary evidence", () => {
    const html = renderToStaticMarkup(<MeasurementRecoveryPanel {...props} />);
    expect(html).toContain("尚未加入当前档案");
    expect(html).toContain("未用于记录分析或交给力力");
    expect(html).toContain("2026-11-11 00:00:00.000");
    expect(html).toContain("位移");
    expect(html).toContain("1.4");
    expect(html).toContain("初速度");
    expect(html).toContain("加速度");
    expect(button(html, "保存到当前档案")?.[1]).not.toContain("disabled");
    expect(html).not.toContain("确认保存这");
  });

  it.each([{ writable: true, reviewToken: null }, { writable: false, reviewToken: "review-one" }])("keeps CSV available but prevents recovery when %j", (state) => {
    const html = renderToStaticMarkup(<MeasurementRecoveryPanel {...props} {...state} />);
    expect(button(html, "保存到当前档案")?.[1]).toContain("disabled");
    expect(button(html, "导出待恢复读数 CSV")?.[1]).not.toContain("disabled");
    expect(html).toContain(state.writable ? "目前还无法读取" : "当前档案只读");
  });

  it("previews manual raw timing and count instead of only derived results", () => {
    const parameters: Record<string, number> = { ...defaultHighSchoolParameters("pendulum"), amplitudeDegrees: 5 };
    const result = calculatePendulumTimingMeasurement({ startTimeSeconds: .3, endTimeSeconds: 10.4, periodCount: 5, length: parameters.length!, amplitudeDegrees: 5 });
    const { metrics, ...manual } = result;
    const manualRecord = { ...record, parameters, timeSeconds: 10.4, metrics, manual };
    const html = renderToStaticMarkup(<MeasurementRecoveryPanel {...props} records={[manualRecord]} definition={highSchoolExperiment("pendulum")} kind="manual" />);
    expect(html).toContain("原始手动读数");
    expect(html).toContain("开始读数 / s");
    expect(html).toContain("停止读数 / s");
    expect(html).toContain("完整周期数");
    expect(html).toContain("0.3");
    expect(html).toContain("10.4");
    expect(html).toContain("按读数计算");
    expect(manualRecord.manual.readings).toEqual(result.readings);
  });

  it("allows full raw backup when every pending manual row is unreadable, never confirming hidden rows", () => {
    const html = renderToStaticMarkup(<MeasurementRecoveryPanel {...props} kind="manual" records={[]} excludedCount={2} onExportBackup={() => {}} />);
    expect(html).toContain("其中 2 条数据无法按当前格式核对");
    expect(button(html, "保存到当前档案")?.[1]).toContain("disabled");
    expect(button(html, "导出待恢复读数 CSV")?.[1]).toContain("disabled");
    expect(button(html, "备份原始数据")?.[1]).not.toContain("disabled");
    expect(html).not.toContain("确认保存这");
  });

  it("escapes persisted labels and emits no panel when recovery is empty", () => {
    const malicious = { ...record, metrics: [{ ...record.metrics[0]!, label: '<img src="x" onerror="alert(1)">' }] };
    const html = renderToStaticMarkup(<MeasurementRecoveryPanel {...props} records={[malicious]} />);
    expect(html).not.toContain('<img src="x"');
    expect(html).toContain("&lt;img");
    expect(renderToStaticMarkup(<MeasurementRecoveryPanel {...props} records={[]} />)).toBe("");
  });
});
