import { useId, useState, type PointerEvent } from "react";
import type { HighSchoolSimulation } from "@physics-lab/physics";
import { formatMeasurement } from "../experiments/workbench";
import { nearestPlotPoint, type PlotPoint } from "../experiments/plotProbe";

function axisLabel(value: number, step: number, minimumDigits = 2) {
  const digits = Math.min(12, Math.max(minimumDigits, 1 - Math.floor(Math.log10(step))));
  return formatMeasurement(value, digits);
}

export function ExperimentPlot({ series, currentPoint, historyOnly = false, probeAtX }: { series: HighSchoolSimulation["series"][number]; currentPoint?: PlotPoint; historyOnly?: boolean; probeAtX?: (x: number) => PlotPoint | null }) {
  const titleId = useId();
  const [probe, setProbe] = useState<{ point: PlotPoint; exact: boolean; index: number } | null>(null);
  const points = series.points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!points.length) return <p className="hs-empty">当前参数下没有可显示的数据。</p>;
  const xLow = Math.min(...points.map((point) => point.x));
  const rawXHigh = Math.max(...points.map((point) => point.x));
  // Only a constant domain needs padding. SI volumes can legitimately span
  // much less than .001 m³; a fixed minimum would hide most of their curve.
  const xHigh = rawXHigh > xLow ? rawXHigh : xLow + Math.max(Math.abs(xLow) * .1, .001);
  const rawLow = Math.min(0, ...points.map((point) => point.y));
  const rawHigh = Math.max(0, ...points.map((point) => point.y));
  const margin = rawHigh > rawLow ? (rawHigh - rawLow) * .1 : .001;
  const yLow = rawLow - margin;
  const yHigh = rawHigh + margin;
  const x = (value: number) => 66 + (value - xLow) / (xHigh - xLow) * 612;
  const y = (value: number) => 254 - (value - yLow) / (yHigh - yLow) * 216;
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(" ");
  const marker = currentPoint && Number.isFinite(currentPoint.x) && Number.isFinite(currentPoint.y) ? currentPoint : null;
  const description = historyOnly ? "曲线仅显示本轮已发生的过程，开关切换处保留电流跃变。" : "曲线显示当前参数下模型计算的完整关系。";
  function inspectAt(px: number, py: number) {
    if (px < 66 || px > 678 || py < 38 || py > 254) return;
    const requestedX = xLow + (px - 66) / 612 * (xHigh - xLow);
    const requestedY = yHigh - (py - 38) / 216 * (yHigh - yLow);
    const exact = probeAtX?.(requestedX);
    if (exact && Number.isFinite(exact.x) && Number.isFinite(exact.y)) {
      const nearby = nearestPlotPoint(points, exact.x, exact.y, xHigh - xLow, yHigh - yLow);
      setProbe({ point: exact, exact: true, index: nearby ? points.indexOf(nearby) : 0 });
      return;
    }
    const sample = nearestPlotPoint(points, requestedX, requestedY, xHigh - xLow, yHigh - yLow);
    if (sample) setProbe({ point: sample, exact: false, index: points.indexOf(sample) });
  }
  function inspect(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!(bounds.width > 0) || !(bounds.height > 0)) return;
    inspectAt((event.clientX - bounds.left) / bounds.width * 720, (event.clientY - bounds.top) / bounds.height * 305);
  }
  function inspectIndex(index: number) {
    const sample = points[index];
    if (!sample) return;
    const exact = probeAtX?.(sample.x);
    setProbe(exact && Number.isFinite(exact.x) && Number.isFinite(exact.y)
      ? { point: exact, exact: true, index }
      : { point: sample, exact: false, index });
  }
  return <figure className="hs-plot"><svg viewBox="0 0 720 305" role="img" aria-labelledby={titleId} onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); inspect(event); }} onPointerMove={(event) => { if (event.buttons) inspect(event); }}><title id={titleId}>{`${series.label}；横轴${series.xLabel}，单位${series.xUnit || "无"}；纵轴单位${series.yUnit || "无"}。${description} 按住并拖动图像可查看模型读数。`}</title>
    {Array.from({ length: 5 }, (_, index) => {
      const xValue = xLow + (xHigh - xLow) * index / 4;
      const yValue = yLow + (yHigh - yLow) * index / 4;
      return <g key={index}><path d={`M${x(xValue)} 38V254M66 ${y(yValue)}H678`} stroke="#dce0d4" strokeDasharray="3 5" /><text x={x(xValue)} y="275" textAnchor="middle">{axisLabel(xValue, (xHigh - xLow) / 4)}</text><text x="54" y={y(yValue) + 4} textAnchor="end">{axisLabel(yValue, (yHigh - yLow) / 4, yHigh - yLow < .1 ? 5 : 2)}</text></g>;
    })}<path d="M66 38V254H678" stroke="#6b7a6b" fill="none" /><path d={path} fill="none" stroke="#235540" strokeWidth="2.7" strokeLinejoin="round" />{marker && <g><path d={`M${x(marker.x)} 38V254`} stroke="#bf6637" strokeDasharray="4 4" /><circle data-current-point={`${marker.x},${marker.y}`} cx={x(marker.x)} cy={y(marker.y)} r="5" fill="#bf6637" stroke="#faf8f0" strokeWidth="2" /></g>}{probe && <g className="hs-plot-probe"><path d={`M${x(probe.point.x)} 38V254M66 ${y(probe.point.y)}H678`} stroke="#67ddf3" strokeDasharray="3 5" /><circle cx={x(probe.point.x)} cy={y(probe.point.y)} r="6" fill="#67ddf3" stroke="#061827" strokeWidth="2" /></g>}<rect x="66" y="38" width="612" height="216" fill="transparent" /><text x="66" y="23">{series.label}{series.yUnit ? ` / ${series.yUnit}` : ""}</text><text x="678" y="299" textAnchor="end">{series.xLabel}{series.xUnit ? ` / ${series.xUnit}` : ""}</text>
  </svg><div className="hs-plot-inspector" aria-live="polite"><span className="hs-plot-inspector-label">图像探针</span>{probe ? <><span>{series.xLabel} <strong>{formatMeasurement(probe.point.x, 5)} {series.xUnit}</strong></span><span>{series.label} <strong>{formatMeasurement(probe.point.y, 5)} {series.yUnit}</strong></span>{marker && <span className="hs-plot-inspector-delta">相对当前读数 Δ{series.yUnit ? ` / ${series.yUnit}` : ""} <strong>{formatMeasurement(probe.point.y - marker.y, 5)}</strong></span>}<small>{probe.exact ? "此时刻由物理模型重新计算" : "曲线上的模型采样点"}</small><button type="button" onClick={() => setProbe(null)}>清除探针</button></> : <span className="hs-plot-inspector-hint">在曲线上点按或拖动查看坐标；铜色点是当前实验读数。</span>}</div>{points.length > 1 && <label className="hs-plot-probe-range">逐点查看曲线<input type="range" min={0} max={points.length - 1} step={1} value={probe?.index ?? 0} onChange={(event) => inspectIndex(Number(event.target.value))} aria-label="图像探针采样位置" /></label>}<figcaption>{historyOnly ? "绿线为本轮已经发生的模型过程，铜色标记为当前读数；未来切换尚未发生，不预画。" : marker ? "绿线为完整模型曲线，铜色标记对应当前模型读数。" : "曲线为当前参数下的模型关系；改变右侧参数，比较曲线如何变化。"}</figcaption></figure>;
}
