import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThermalLab } from "./BoilingLab";
import { MeltingLab } from "./MeltingLab";
import { EvaporationLab } from "./EvaporationLab";

const clock = vi.hoisted(() => ({ complete: false }));
vi.mock("./useThermalRunClock", () => ({ useThermalRunClock: (limitSeconds: number) => ({
  elapsedSeconds: clock.complete ? limitSeconds : 0, complete: clock.complete, running: false,
  revision: 1, toggle: () => {}, reset: () => {}
}) }));
beforeEach(() => { clock.complete = false; });

describe("thermal run controls and displayed evidence", () => {
  it.each([[ThermalLab, "24倍"], [MeltingLab, "12.5倍"], [EvaporationLab, "10倍"]] as const)("labels the accelerated experiment clock", (Lab, speed) => {
    const html = renderToStaticMarkup(<Lab />);
    expect(html).toContain(`${speed}加速演示`);
    expect(html).toContain("显示秒数是实验时间");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it.each([ThermalLab, MeltingLab])("disables starting at the observation limit and exposes an explicit reset", (Lab) => {
    clock.complete = true;
    const html = renderToStaticMarkup(<Lab />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?本轮已结束，请重置<\/button>/);
    expect(html).toContain("本轮观察已结束");
    expect(html).toContain("重置当前实验");
    expect(html).not.toContain("继续加热后再");
  });

  it("keeps evaporation's completed readings visible until saving or an explicit reset", () => {
    clock.complete = true;
    const html = renderToStaticMarkup(<EvaporationLab />);
    expect(html).toContain("本轮计时完成，请重置");
    expect(html).toContain("本轮计时已完成，请先保存称量");
    expect(html).toContain("49.924 g");
    expect(html).toContain("平均速率 0.076 g/min");
    expect(html).toContain("重置本轮计时");
  });
});
