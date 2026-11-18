import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateDoubleSlitPositionMeasurement, defaultHighSchoolParameters, simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import { ManualMeasurementPanel } from "./ManualMeasurementPanel";
import { beginVirtualTiming, observeVirtualTiming } from "./manualInstrumentState";
import * as manualMeasurements from "../experiments/useManualMeasurements";

afterEach(() => { vi.restoreAllMocks(); });

function renderInstrument(experimentId: "pendulum" | "double-slit", changes: Record<string, number> = {}, recordWritable = true) {
  const parameters = { ...defaultHighSchoolParameters(experimentId), ...changes };
  return renderToStaticMarkup(<ManualMeasurementPanel experimentId={experimentId} scopeKey="test:guest" recordWritable={recordWritable} canWrite={() => recordWritable} canRead={() => true} parameters={parameters} timeSeconds={0} simulation={simulateHighSchoolExperiment(experimentId, parameters, 0)} clockRunning={false} resetToken={0} onClockToggle={() => {}} onClockStep={() => {}} />);
}

function mockArchive(records: ReturnType<typeof manualMeasurements.useManualMeasurements>["records"], recovery?: ReturnType<typeof manualMeasurements.useManualMeasurements>["recovery"], storageError = true) {
  vi.spyOn(manualMeasurements, "useManualMeasurements").mockReturnValue({
    records, recovery, storageError, excludedCount: 0, actionError: "",
    save: vi.fn(() => ({ saved: false, failed: true, pendingRecovery: undefined, error: undefined })), clear: vi.fn(() => false),
    retryPending: vi.fn(() => ({ failed: false, error: undefined })), recoverPending: vi.fn(() => ({ recoveredCount: 0, failed: false, error: undefined })),
    exportCsv: vi.fn(() => true), exportRecoveryCsv: vi.fn(() => true), exportRecoveryBackup: vi.fn(() => true),
  });
}

describe("virtual manual measurement controls", () => {
  it("renders a student-operated stopwatch with an empty count instead of a model-filled period", () => {
    const html = renderInstrument("pendulum");
    expect(html).toContain("开始计时");
    expect(html).toContain("停止计时");
    expect(html).toContain("单步定位");
    expect(html).toContain("完整周期数 N");
    expect(html).toContain('placeholder="由你计数后填写" value=""');
    expect(html).toContain("1/60 s");
    expect(html).toContain("0.01");
    expect(html).toContain("这些是虚拟仪器手动读数");
    expect(html).not.toContain('class="hs-manual-result"');
    expect(html).not.toContain("NaN");
  });

  it("renders the intensity screen with two accessible unselected coordinates and no inferred count", () => {
    const html = renderInstrument("double-slit");
    expect(html).toContain("定位 A · 左亮纹");
    expect(html).toContain("定位 B · 右亮纹");
    expect(html).toContain('aria-label="左亮纹坐标，毫米"');
    expect(html).toContain('aria-label="右亮纹坐标，毫米"');
    expect(html).toContain("尚未定位，移动滑块选择位置");
    expect(html).toContain('placeholder="由你观察后填写" value=""');
    expect(html).toContain("共有 5 个相邻间隔");
    expect(html).toContain("不会自动吸附到理论亮纹");
    expect(html).toContain("开始下一次读尺");
    expect(html.match(/<stop /g)).toHaveLength(1601);
    expect(html).not.toContain('class="hs-manual-result"');
    expect(html).not.toContain("NaN");
  });

  it("explains when the visible screen has too few bright fringes for a manual spacing measurement", () => {
    const html = renderInstrument("double-slit", { wavelengthNm: 700, slitSeparationMm: .1, screenDistance: 3 });
    expect(html).toContain("当前可见屏区不足两条亮纹");
    expect(html).toContain("请减小屏距 L 或增大缝间距 d");
    expect(html).not.toContain('class="hs-manual-result"');
    expect(renderInstrument("double-slit")).not.toContain("当前可见屏区不足两条亮纹");
  });

  it("starts both tools with a separate manual archive and CSV export", () => {
    mockArchive([], undefined, false);
    for (const id of ["pendulum", "double-slit"] as const) {
      const html = renderInstrument(id);
      expect(html).toContain("手动读数档案");
      expect(html).toContain("导出手动读数 CSV");
      expect(html).toContain("还没有手动读数");
      expect(html).toContain('aria-label="清空本实验手动读数"');
      expect(html).not.toContain('href="#');
      expect(html).not.toContain("重试本机保存");
    }
  });

  it.each([true, false])("offers recovery at 120 records, honoring writable=%s without removing CSV rescue", (recordWritable) => {
    const parameters = defaultHighSchoolParameters("double-slit");
    const { metrics, ...manual } = calculateDoubleSlitPositionMeasurement({ leftPositionMm: -3.3, rightPositionMm: 3.3, intervalCount: 2, slitSeparationMm: parameters.slitSeparationMm, screenDistance: parameters.screenDistance });
    const records = Array.from({ length: 120 }, (_, index) => ({ id: `recovery-${index}`, createdAt: "2026-11-11T00:00:00.000Z", timeSeconds: 0, parameters, metrics, manual }));
    mockArchive(records);
    const html = renderInstrument("double-slit", {}, recordWritable);
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    const retry = buttons.find((button) => button[2]!.includes("重试本机保存"));
    const csv = buttons.find((button) => button[2]!.includes("导出手动读数 CSV"));
    expect(html).toContain("120 / 120");
    expect(retry).toBeDefined();
    expect(retry![1]!.includes("disabled")).toBe(!recordWritable);
    expect(csv).toBeDefined();
    expect(csv![1]).not.toContain("disabled");
    expect(html).toContain("请先导出 CSV 保留副本");
    expect(html).toContain("无需新增读数");
    expect(html).not.toContain("全部保存成功");
  });

  it("shows raw recovery readings separately from the empty current manual archive", () => {
    const parameters = defaultHighSchoolParameters("double-slit");
    const { metrics, ...manual } = calculateDoubleSlitPositionMeasurement({ leftPositionMm: -3.3, rightPositionMm: 3.3, intervalCount: 2, slitSeparationMm: parameters.slitSeparationMm, screenDistance: parameters.screenDistance });
    const record = { id: "pending-manual", createdAt: "2026-11-11T00:00:00.000Z", timeSeconds: 0, parameters, metrics, manual };
    mockArchive([], { records: [record], reviewToken: "private-review-token", excludedCount: 0 });
    const html = renderInstrument("double-slit");
    expect(html).toContain("另有 1 条待恢复读数独立保留");
    expect(html).toContain("还没有手动读数");
    expect(html).toContain('aria-label="待恢复读数，可横向滚动"');
    expect(html).not.toContain('aria-label="手动读数记录，可横向滚动"');
    expect(html).toContain("原始手动读数");
    expect(html).toContain("-3.3");
    expect(html).toContain("导出待恢复读数 CSV");
    expect(html).not.toContain("private-review-token");
  });

  it("keeps an entirely invalid recovery batch visible as a backup-only rescue", () => {
    mockArchive([], { records: [], reviewToken: "hidden-invalid-token", excludedCount: 2 });
    const html = renderInstrument("double-slit");
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    expect(html).toContain("另有 2 条待恢复读数独立保留");
    expect(html).toContain("2 条数据无法按当前格式核对");
    expect(buttons.find((button) => button[2]!.includes("保存到当前档案"))![1]).toContain("disabled");
    expect(buttons.find((button) => button[2]!.includes("导出待恢复读数 CSV"))![1]).toContain("disabled");
    expect(buttons.find((button) => button[2]!.includes("备份原始数据"))![1]).not.toContain("disabled");
    expect(html).not.toContain("hidden-invalid-token");
  });
});

describe("manual stopwatch continuity", () => {
  const parameters = defaultHighSchoolParameters("pendulum");

  it("captures a condition snapshot and preserves a paused virtual clock", () => {
    const mutable = { ...parameters };
    const run = beginVirtualTiming(2, mutable);
    mutable.length = 2;
    expect(run.parameters.length).toBe(parameters.length);
    const paused = observeVirtualTiming(run, 2, parameters);
    expect(paused.reason).toBe("");
    expect(paused.run?.lastTimeSeconds).toBe(2);
  });

  it("invalidates any time reversal, including a reset that remains after the starting time", () => {
    const start = beginVirtualTiming(0, parameters);
    const advanced = observeVirtualTiming(start, 12, parameters).run!;
    const rewind = observeVirtualTiming(advanced, 5, parameters);
    expect(rewind.run).toBeNull();
    expect(rewind.reason).toContain("时间已回退");
  });

  it("invalidates parameter changes and never changes the earlier captured snapshot", () => {
    const start = beginVirtualTiming(3, parameters);
    const changed = observeVirtualTiming(start, 4, { ...parameters, amplitudeDegrees: 45 });
    expect(changed.run).toBeNull();
    expect(changed.reason).toContain("实验条件已改变");
    expect(start.parameters.amplitudeDegrees).toBe(parameters.amplitudeDegrees);
  });

  it("keeps timing active at an observation boundary instead of automatically declaring cycles", () => {
    const advanced = observeVirtualTiming(beginVirtualTiming(1, parameters), 60, parameters);
    expect(advanced.run).toMatchObject({ startTimeSeconds: 1, lastTimeSeconds: 60 });
    expect(advanced.reason).toBe("");
    expect(advanced.run).not.toHaveProperty("periodCount");
    expect(advanced.run).not.toHaveProperty("endTimeSeconds");
  });

  it("invalidates an explicit reset even when the virtual clock and parameters remain unchanged at zero", () => {
    const start = beginVirtualTiming(0, parameters, 2);
    expect(observeVirtualTiming(start, 0, parameters, 2).run).not.toBeNull();
    const reset = observeVirtualTiming(start, 0, parameters, 3);
    expect(reset.run).toBeNull();
    expect(reset.reason).toContain("重新计时");
    expect(reset.reason).toContain("已保存的手动记录保留");
    const restarted = beginVirtualTiming(0, parameters, 3);
    expect(observeVirtualTiming(restarted, 2, parameters, 3).run?.lastTimeSeconds).toBe(2);
  });
});
