import { memo, useId, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ScatterChart } from "lucide-react";
import { analyzeHighSchoolMeasurements, highSchoolExperiment, type HighSchoolAnalysisGroup, type HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { formatMeasurement, formatParameterValue, type HighSchoolMeasurement } from "../experiments/workbench";
import { MeasurementPointTable, measurementPointRecordLabel } from "./MeasurementPointTable";
import "./MeasurementAnalysisPanel.css";

const statusLabels: Record<HighSchoolAnalysisGroup["status"], string> = {
  ready: "可以拟合", insufficient: "继续采样", unsupported: "超出适用条件"
};

/** Selects existing model groups; regression and scientific grouping belong to physics. */
export const MeasurementAnalysisPanel = memo(function MeasurementAnalysisPanel({ experimentId, records }: { experimentId: HighSchoolExperimentId; records: HighSchoolMeasurement[] }) {
  const definition = highSchoolExperiment(experimentId);
  const headingId = useId();
  const relationSelectId = useId();
  const groupSelectId = useId();
  const analysis = useMemo(() => analyzeHighSchoolMeasurements(experimentId, records), [experimentId, records]);
  const [selection, setSelection] = useState({ relationshipId: "", groupId: "" });
  const relationships = [...new Map(analysis.groups.map((group) => [group.relationshipId, { id: group.relationshipId, title: group.title }])).values()];
  const defaultRelationshipId = experimentId === "uniform-acceleration" ? "interval-velocity-time" : relationships[0]?.id;
  const relationshipId = relationships.some((relationship) => relationship.id === selection.relationshipId) ? selection.relationshipId : defaultRelationshipId;
  const groups = analysis.groups.filter((group) => group.relationshipId === relationshipId);
  const selectedGroup = groups.find((group) => group.id === selection.groupId) ?? groups[0];
  const recordNumbers = useMemo(() => new Map(records.map((record, index) => [record.id, index + 1])), [records]);

  return <section className="hs-analysis-panel" aria-labelledby={headingId}>
    <header className="hs-analysis-heading"><div><span className="hs-kicker">04 / 记录分析</span><h2 id={headingId}>用一组数据，检验一个关系。</h2><p>{analysis.notice}</p></div><span className="hs-analysis-source"><ScatterChart size={15} aria-hidden="true" />仿真记录分析</span></header>
    {selectedGroup && <>
      <div className="hs-analysis-selectors">
        <div><label htmlFor={relationSelectId}>选择分析关系</label><select id={relationSelectId} value={relationshipId} onChange={(event) => setSelection({ relationshipId: event.target.value, groupId: "" })}>{relationships.map((relationship) => <option value={relationship.id} key={relationship.id}>{relationship.title}</option>)}</select></div>
        <div><label htmlFor={groupSelectId}>选择同条件组</label><select id={groupSelectId} value={selectedGroup.id} onChange={(event) => setSelection({ relationshipId: selectedGroup.relationshipId, groupId: event.target.value })}>{groups.map((group, index) => <option value={group.id} key={group.id}>{`条件组 ${String(index + 1).padStart(2, "0")} · ${group.points.length} 个${group.pointSource === "position-interval" ? "区间" : "采样点"} · ${statusLabels[group.status]}`}</option>)}</select></div>
        <p>改变控制变量的记录会分开分析。<br />当前关系共 {groups.length} 个条件组。</p>
      </div>
      <div className="hs-analysis-conditions"><span>本组保持不变</span>{selectedGroup.controls.length ? <dl>{selectedGroup.controls.map((control) => <div key={control.key}><dt>{control.label}</dt><dd>{definition.parameters.some(parameter => parameter.key === control.key) ? formatParameterValue(definition.parameters.find(parameter => parameter.key === control.key)!, control.value) : formatMeasurement(control.value)}<small>{control.unit}</small></dd></div>)}</dl> : <p>记录后，会在这里显示本组的控制变量。</p>}</div>
      <div className="hs-analysis-body" data-analysis-group={selectedGroup.id} data-analysis-status={selectedGroup.status}>
        <div className="hs-analysis-evidence">
          <div className="hs-analysis-plot-heading"><h3>{selectedGroup.title}</h3><span>{selectedGroup.points.length} 个{selectedGroup.pointSource === "position-interval" ? "区间" : "点"} · {selectedGroup.distinctXCount} 个不同横坐标</span></div>
          {selectedGroup.pointSource === "position-interval" && <p className="hs-analysis-source-note">先记录至少4个不同时刻的位置，再由相邻两点计算区间平均速度Δx/Δt，并放在时间中点。只有在匀变速条件下，它才等于该中点的瞬时速度。</p>}
          <MeasurementAnalysisPlot group={selectedGroup} recordNumbers={recordNumbers} />
          <MeasurementPointTable group={selectedGroup} recordNumbers={recordNumbers} />
        </div>
        <aside className="hs-analysis-result" aria-label="当前组的分析结果">
          <span className={`hs-analysis-status is-${selectedGroup.status}`}>{statusLabels[selectedGroup.status]}</span>
          {selectedGroup.estimates.length > 0 && <><h3>由这组仿真记录估计</h3><dl className="hs-analysis-estimates">{selectedGroup.estimates.map((estimate) => <div key={estimate.key}><dt>{estimate.label}</dt><dd>{formatMeasurement(estimate.value, 4)}<small>{estimate.unit}</small></dd></div>)}</dl></>}
          {selectedGroup.reasons.length > 0 && <div className="hs-analysis-reasons"><h3>{selectedGroup.status === "unsupported" ? "为什么暂不作此推断？" : "还需要哪些证据？"}</h3><ul>{selectedGroup.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
          {selectedGroup.fit && <><dl className="hs-analysis-fit-quality"><div><dt>均值点拟合优度 R²</dt><dd>{selectedGroup.fit.rSquared === null ? "未定义" : formatMeasurement(selectedGroup.fit.rSquared, 4)}</dd></div><div><dt>均值点均方根残差</dt><dd>{formatMeasurement(selectedGroup.fit.rmse, 4)} {selectedGroup.yAxis.unit}</dd></div></dl><p>{selectedGroup.pointSource === "position-interval" ? "图中显示由位置记录推算的全部区间点，并按不同中点时刻等权拟合。拟合残差不能表示原始位置读数的离散程度。" : "同一横坐标的读数先取均值，再等权拟合并计算上述指标；图中保留全部原始点。均值点残差不能表示原始读数的离散程度。"}</p></>}
          <div className="hs-analysis-next"><ArrowUpRight size={18} aria-hidden="true" /><div><h3>下一组记录这样做</h3><p>{selectedGroup.nextStep}</p><button type="button" onClick={() => { const heading = document.getElementById("hs-controls-title"); heading?.scrollIntoView({ block: "center" }); heading?.focus({ preventScroll: true }); }}>回到实验条件<ArrowUpRight size={13} aria-hidden="true" /></button></div></div>
        </aside>
      </div>
      <details className="hs-analysis-boundaries" open><summary>这项分析的适用条件<ChevronDown size={15} aria-hidden="true" /></summary><ul>{selectedGroup.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul><p>采样点来自虚拟实验模型。拟合用于探究模型关系，不代表真实器材的测量精度。</p></details>
    </>}
    {analysis.excluded.length > 0 && <details className="hs-analysis-excluded"><summary>{analysis.excluded.length} 条记录未参与分析<ChevronDown size={15} aria-hidden="true" /></summary><ul>{analysis.excluded.map((excluded, index) => <li key={`${excluded.recordId}-${index}`}>记录 {recordNumbers.get(excluded.recordId) ?? "—"}：{excluded.reason}</li>)}</ul><p>原记录仍保留在上方记录表中。</p></details>}
  </section>;
});

function axisLabel(axis: HighSchoolAnalysisGroup["xAxis"]) {
  return `${axis.label}${axis.unit ? ` / ${axis.unit}` : ""}`;
}

function MeasurementAnalysisPlot({ group, recordNumbers }: { group: HighSchoolAnalysisGroup; recordNumbers: Map<string, number> }) {
  const titleId = useId();
  const descriptionId = useId();
  if (!group.points.length) return <div className="hs-analysis-empty"><ScatterChart size={34} strokeWidth={1.3} aria-hidden="true" /><h4>还没有可分析的采样点。</h4><p>按“下一组记录这样做”的提示保留条件，记录不同工作点；数据会自动出现在这里。</p></div>;
  const fittedPoints = group.fit?.points ?? [];
  const pointLabel = group.pointSource === "position-interval" ? "由位置记录推算的区间速度" : "保存的仿真采样点";
  const extentPoints = [...group.points, ...fittedPoints];
  const rawXMin = Math.min(...extentPoints.map((point) => point.x));
  const rawXMax = Math.max(...extentPoints.map((point) => point.x));
  const rawYMin = Math.min(...extentPoints.map((point) => point.y));
  const rawYMax = Math.max(...extentPoints.map((point) => point.y));
  // Projection and padding affect SVG layout only; the model supplies all plotted data.
  const xPadding = rawXMax > rawXMin ? (rawXMax - rawXMin) * .07 : Math.max(Math.abs(rawXMin) * .1, .1);
  const yPadding = rawYMax > rawYMin ? (rawYMax - rawYMin) * .12 : Math.max(Math.abs(rawYMin) * .1, .1);
  const xLow = rawXMin - xPadding;
  const xHigh = rawXMax + xPadding;
  const yLow = rawYMin - yPadding;
  const yHigh = rawYMax + yPadding;
  const x = (value: number) => 83 + (value - xLow) / (xHigh - xLow) * 570;
  const y = (value: number) => 262 - (value - yLow) / (yHigh - yLow) * 219;
  const fitPath = fittedPoints.map((point, index) => `${index ? "L" : "M"}${x(point.x).toFixed(2)},${y(point.y).toFixed(2)}`).join(" ");
  return <figure className="hs-analysis-plot"><svg viewBox="0 0 690 320" role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
    <title id={titleId}>{`${group.title}；${group.points.length} 个分析点${group.fit ? "及其线性拟合" : "，尚无拟合线"}。`}</title><desc id={descriptionId}>{`横轴${axisLabel(group.xAxis)}；纵轴${axisLabel(group.yAxis)}。铜色圆点表示${pointLabel}，绿色虚线表示拟合。逐点数值见图后展开表格。`}</desc>
    {Array.from({ length: 5 }, (_, index) => {
      const xValue = xLow + (xHigh - xLow) * index / 4;
      const yValue = yLow + (yHigh - yLow) * index / 4;
      return <g key={index}><path d={`M${x(xValue)} 43V262M83 ${y(yValue)}H653`} fill="none" stroke="#dce0d4" strokeDasharray="3 5" /><text x={x(xValue)} y="282" textAnchor="middle">{formatMeasurement(xValue, 5)}</text><text x="72" y={y(yValue) + 4} textAnchor="end">{formatMeasurement(yValue, 5)}</text></g>;
    })}
    <path d="M83 43V262H653" stroke="#6b7a6b" fill="none" />
    {group.fit && <path data-analysis-fit="true" d={fitPath} fill="none" stroke="#235540" strokeWidth="2.5" strokeDasharray="7 4" />}
    {group.points.map((point) => <circle key={point.recordId} data-analysis-point={point.recordId} cx={x(point.x)} cy={y(point.y)} r="5" fill="#b96235" stroke="#fcfaf2" strokeWidth="1.5"><title>{`来源记录 ${measurementPointRecordLabel(point, recordNumbers)}：${group.xAxis.label} ${formatMeasurement(point.x, 5)} ${group.xAxis.unit}；${group.yAxis.label} ${formatMeasurement(point.y, 5)} ${group.yAxis.unit}`}</title></circle>)}
    <text x="83" y="23">{axisLabel(group.yAxis)}</text><text x="653" y="312" textAnchor="end">{axisLabel(group.xAxis)}</text>
  </svg><figcaption><span><i className="hs-analysis-dot" />{pointLabel}</span>{group.fit ? <span><i className="hs-analysis-line" />本组线性拟合</span> : <span>满足条件后显示拟合线</span>}</figcaption></figure>;
}
