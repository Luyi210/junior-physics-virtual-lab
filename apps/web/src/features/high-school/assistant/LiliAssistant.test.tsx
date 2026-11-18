import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LiliExperimentContext, LiliManualSample } from "@physics-lab/contracts";
import { LiliManualContextNotice } from "./LiliAssistant";
import { calculateMechanicalEnergyTapeMeasurement } from "@physics-lab/physics/high-school";
import { manualRecordsToContext } from "../experiments/manualContext";
import type { ManualMeasurementRecord } from "../experiments/manualMeasurementRepository";

function context(total: number, experimentId = "pendulum"): LiliExperimentContext {
  return { experimentId, parameters: {}, timeSeconds: 0, recordCount: 28, manualRecordCount: total, manualSamples: Array.from({ length: Math.min(10, total) }, (_, index): LiliManualSample => ({ id: `manual-${index}`, kind: experimentId === "pendulum" ? "pendulum-timing" : "double-slit-positions", parameters: {}, readings: {}, timeSeconds: 0 })) };
}
describe("Lili manual context disclosure", () => {
  it("shows manual availability separately from automatic samples and explains explicit-question attachment", () => {
    const ask = vi.fn();
    const html = renderToStaticMarkup(<LiliManualContextNotice context={context(14)} busy={false} onAsk={ask} />);
    expect(html).toContain("14 条 · 本次可引用 10 条");
    expect(html).toContain("仅在你提问时");
    expect(html).toContain("最近最多 10 条虚拟手动读数与当时条件");
    expect(html).toContain("与自动模型采样分开，不是真实器材测量");
    expect(html).toContain("看看我的手动读数");
    expect(html).not.toContain("28 条");
    expect(html).not.toContain("disabled");
    expect(ask).not.toHaveBeenCalled();
  });

  it("guides an empty or cleared archive and disables the dedicated question until records exist", () => {
    const html = renderToStaticMarkup(<LiliManualContextNotice context={context(0, "double-slit")} busy={false} onAsk={() => {}} />);
    expect(html).toContain("0 条 · 本次可引用 0 条");
    expect(html).toContain("先在实验页保存一次手动读数");
    expect(html).toContain('disabled=""');
  });

  it("does not show a manual archive on unrelated routes and prevents duplicate submission while busy", () => {
    for (const current of [null, context(4, "projectile-motion")]) expect(renderToStaticMarkup(<LiliManualContextNotice context={current} busy={false} onAsk={() => {}} />)).toBe("");
    expect(renderToStaticMarkup(<LiliManualContextNotice context={context(1)} busy onAsk={() => {}} />)).toContain('disabled=""');
  });
});

function tapeContext(count: number): LiliExperimentContext {
  const parameters = { mass: .2, dropHeight: 1.2, resistanceRatio: 0 };
  const { metrics, ...manual } = calculateMechanicalEnergyTapeMeasurement({ ...parameters, indexA: 5, indexB: 10,
    aBeforeMm: 31.4, aCenterMm: 49, aAfterMm: 70.6, bBeforeMm: 158.8, bCenterMm: 200, bAfterMm: 237.2 });
  const records: ManualMeasurementRecord[] = Array.from({ length: count }, (_, index) => ({ id: `tape-${index}`, createdAt: "2026-11-11T00:00:00.000Z", timeSeconds: .24, parameters: { ...parameters }, metrics, manual }));
  return { experimentId: "mechanical-energy", parameters, timeSeconds: .24, recordCount: 40, ...manualRecordsToContext("mechanical-energy", records) };
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Array.isArray(node) ? node.flatMap(elements) : isValidElement<Record<string, unknown>>(node) ? [node, ...elements(node.props.children as ReactNode)] : [];
}
describe("mechanical-energy manual archive disclosure", () => {
  it("shows validated paper-tape availability and invokes the explicit question only after the real button callback", () => {
    const current = tapeContext(12), before = structuredClone(current), ask = vi.fn();
    expect(current.manualSamples?.[0]?.kind).toBe("mechanical-energy-tape");
    const tree = LiliManualContextNotice({ context: current, busy: false, onAsk: ask });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("12 条 · 本次可引用 10 条");
    expect(html).toContain("虚拟手动读数"); expect(html).not.toContain("40 条"); expect(ask).not.toHaveBeenCalled();
    const action = elements(tree).find(node => node.type === "button")!;
    expect(action.props.disabled).toBe(false);
    (action.props.onClick as () => void)();
    expect(ask).toHaveBeenCalledExactlyOnceWith("看看我的手动读数"); expect(current).toEqual(before);
  });
  it("keeps cleared paper-tape archives visible but disables the action until there are saved readings", () => {
    for (const [current, busy] of [[tapeContext(0), false], [tapeContext(1), true]] as const) {
      const ask = vi.fn(), html = renderToStaticMarkup(<LiliManualContextNotice context={current} busy={busy} onAsk={ask} />);
      expect(html).toContain("手动读数档案"); expect(html).toContain('disabled=""'); expect(ask).not.toHaveBeenCalled();
    }
    expect(renderToStaticMarkup(<LiliManualContextNotice context={tapeContext(0)} busy={false} onAsk={() => {}} />)).toContain("先在实验页保存一次手动读数");
  });
});
