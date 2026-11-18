import { ChevronDown } from "lucide-react";
import type { HighSchoolAnalysisGroup } from "@physics-lab/physics/high-school";
import { formatMeasurement } from "../experiments/workbench";

type Point = HighSchoolAnalysisGroup["points"][number];

/** Derived points retain the actual source record numbers instead of showing an invented record. */
export function measurementPointRecordLabel(point: Point, recordNumbers: Map<string, number>) {
  return (point.sourceRecordIds ?? [point.recordId]).map((id) => recordNumbers.get(id))
    .sort((a, b) => (a ?? Infinity) - (b ?? Infinity)).map((number) => number ?? "—").join("、");
}

export function MeasurementPointTable({ group, recordNumbers }: { group: HighSchoolAnalysisGroup; recordNumbers: Map<string, number> }) {
  if (!group.points.length) return null;
  const intervals = group.pointSource === "position-interval";
  const format = (value: number) => formatMeasurement(value, 5);
  const axisLabel = (axis: HighSchoolAnalysisGroup["xAxis"]) => `${axis.label}${axis.unit ? ` / ${axis.unit}` : ""}`;
  return <details className="hs-analysis-point-table">
    <summary>{intervals ? "查看位置区间与速度计算" : "查看本组采样数值"}<ChevronDown size={15} aria-hidden="true" /></summary>
    {intervals && <p className="hs-analysis-source-note">相同时间的重复位置先取均值，再用相邻时刻计算Δx/Δt。下表列出来源记录和起止数值；这些区间速度是派生值，原始记录仍保留在上方。</p>}
    <div className="hs-table-scroll" tabIndex={0} aria-label={intervals ? "位置区间与速度计算表，可横向滚动" : "本组仿真采样数值，可横向滚动"}>
      <table><thead><tr><th scope="col">原记录序号</th>{intervals && <><th scope="col">时间起止 / s</th><th scope="col">位置起止 / m</th><th scope="col">Δt / s</th><th scope="col">Δx / m</th></>}<th scope="col">{axisLabel(group.xAxis)}</th><th scope="col">{axisLabel(group.yAxis)}</th></tr></thead>
        <tbody>{group.points.map((point) => <tr key={point.recordId} data-analysis-source={intervals ? "position-interval" : "saved-reading"}>
          <th scope="row">{measurementPointRecordLabel(point, recordNumbers)}</th>
          {intervals && (point.interval ? <>
            <td>{format(point.interval.startTimeSeconds)} → {format(point.interval.endTimeSeconds)}</td>
            <td>{format(point.interval.startPosition)} → {format(point.interval.endPosition)}</td>
            <td>{format(point.interval.endTimeSeconds - point.interval.startTimeSeconds)}</td>
            <td>{format(point.interval.endPosition - point.interval.startPosition)}</td>
          </> : <><td>—</td><td>—</td><td>—</td><td>—</td></>)}
          <td>{format(point.x)}</td><td>{format(point.y)}</td>
        </tr>)}</tbody></table>
    </div>
  </details>;
}
