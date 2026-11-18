import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ElectricPowerLab } from "./ElectricPowerLab";

describe("ElectricPowerLab rendering", () => {
  it("labels source voltage, real-time load meters, and the completion latch separately", () => {
    const html = renderToStaticMarkup(<ElectricPowerLab />);
    expect(html).toContain("电源设定电压");
    expect(html).toContain("负载端实时电压 V");
    expect(html).toContain("实时电流 A");
    expect(html).toContain("实时功率 P=UI");
    expect(html).toContain("本轮完成快照");
    expect(html).toContain("累计 W（断开后保留）");
    expect(html).toContain("电源与串联开关，当前断开");
    expect(html).toContain("调整条件会重置本轮计时，已存证据保留");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
