import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { highSchoolExperiment } from "@physics-lab/physics/high-school";
import type { HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { HighSchoolRecordScopePanel } from "./HighSchoolRecordScopePanel";
import { LegacyHighSchoolRecords, LegacyHighSchoolRecordTable } from "./LegacyHighSchoolRecords";

const mocks = vi.hoisted(() => ({ read: vi.fn(), readManual: vi.fn() }));
vi.mock("../../../data/highSchoolRecordScope", () => ({
  getHighSchoolRecordScopeOptions: () => [
    { channel: "student", label: "学生 · 甲", selected: false, expired: true },
    { channel: "guest", label: "游客档案 · 当前浏览器共享", selected: false, expired: false }
  ], selectHighSchoolRecordScope: vi.fn()
}));
vi.mock("../experiments/measurementStorage", () => ({ readLegacyMeasurements: mocks.read }));
vi.mock("../experiments/manualMeasurementRepository", () => ({ readLegacyManualMeasurements: mocks.readManual, manualMeasurementsToCsv: vi.fn() }));

const account: HighSchoolRecordScope = { key: "school:student:a", mode: "account", label: "学生 · 甲", canWrite: true, authChannel: "student", revision: 1 };
const renderScope = (scope: HighSchoolRecordScope) => renderToStaticMarkup(<MemoryRouter><HighSchoolRecordScopePanel scope={scope} /></MemoryRouter>);

describe("record identity explanations", () => {
  it("distinguishes a local account archive from school synchronization", () => {
    expect(renderScope(account)).toContain("暂未同步到学校后台");
    expect(renderScope({ ...account, canWrite: false })).toContain("重新登录");
    expect(renderScope({ ...account, canWrite: false })).toContain("先导出已有记录");
  });

  it("explains shared guest data, explicit selection and isolated demo behavior", () => {
    expect(renderScope({ ...account, key: "guest", mode: "guest", authChannel: null })).toContain("浏览器的使用者共用");
    expect(renderScope({ ...account, key: null, mode: "blocked", canWrite: false })).toContain("先选择本次实验的档案归属");
    const demo = renderScope({ ...account, key: "demo", mode: "demo", authChannel: null });
    expect(demo).toContain("不使用已有账号登录状态");
    expect(demo).not.toContain("管理登录身份");
  });

  it("does not read old public records merely by rendering the experiment", () => {
    const html = renderToStaticMarkup(<LegacyHighSchoolRecords definition={highSchoolExperiment("pendulum")} />);
    expect(html).toContain("不会传给力力");
    expect(html).toContain("只读查看 / 导出");
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.readManual).not.toHaveBeenCalled();
  });

  it("renders an old record without edit/delete actions and escapes stored text", () => {
    const html = renderToStaticMarkup(<LegacyHighSchoolRecordTable records={[{ id: "old", createdAt: "2026-11-11T00:00:00.000Z", timeSeconds: 2,
      parameters: { length: 1 }, metrics: [{ key: "period", label: "<script>unsafe</script>", value: 2.01, unit: "s" }] }]} />);
    expect(html).toContain("2.01");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("清空");
  });
});
