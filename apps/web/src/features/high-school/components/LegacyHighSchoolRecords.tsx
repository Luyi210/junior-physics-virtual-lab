import { useEffect, useState } from "react";
import { Download, History } from "lucide-react";
import type { HighSchoolExperimentDefinition } from "@physics-lab/physics/high-school";
import { readLegacyMeasurements, type MeasurementSnapshot } from "../experiments/measurementStorage";
import { readLegacyManualMeasurements, manualMeasurementsToCsv, type ManualMeasurementSnapshot } from "../experiments/manualMeasurementRepository";
import { formatMeasurement, measurementsToCsv, type HighSchoolMeasurement } from "../experiments/workbench";
import "./LegacyHighSchoolRecords.css";

type LegacySnapshot = { automatic: MeasurementSnapshot; manual: ManualMeasurementSnapshot | null };
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LegacyHighSchoolRecords({ definition }: { definition: HighSchoolExperimentDefinition }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<LegacySnapshot | null>(null);
  useEffect(() => {
    if (!open) return;
    const refresh = () => setSnapshot({ automatic: readLegacyMeasurements(definition.id),
      manual: definition.id === "pendulum" || definition.id === "double-slit" ? readLegacyManualMeasurements(definition.id) : null });
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [open, definition.id]);
  const manualId = definition.id === "pendulum" || definition.id === "double-slit" ? definition.id : null;
  return <details className="hs-legacy-records" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><History size={17} aria-hidden="true" /><span>升级前的公共本机档案</span><small>只读查看 / 导出</small></summary>
    <p>这些旧记录没有保存账号归属，继续保留在原位置。展开后可查看和导出；不会自动归入当前账号，也不会传给力力。</p>
    {open && snapshot && <>
      {(snapshot.automatic.failed || snapshot.manual?.failed || Boolean(snapshot.manual?.excludedCount)) && <p role="alert">部分旧记录无法读取，原始数据仍保留，未删除或覆盖。</p>}
      <div className="hs-legacy-record-heading"><h3>旧自动模型采样 · {snapshot.automatic.records.length} 条</h3><button type="button" className="hs-button" disabled={!snapshot.automatic.records.length} onClick={() => download(measurementsToCsv(snapshot.automatic.records, definition), `${definition.title}-升级前自动采样.csv`)}><Download size={14} aria-hidden="true" />导出旧自动采样</button></div>
      <LegacyHighSchoolRecordTable records={snapshot.automatic.records} />
      {snapshot.manual && manualId && <><div className="hs-legacy-record-heading"><h3>旧手动虚拟读数 · {snapshot.manual.records.length} 条</h3><button type="button" className="hs-button" disabled={!snapshot.manual.records.length} onClick={() => download(manualMeasurementsToCsv(manualId, snapshot.manual!.records), `${definition.title}-升级前手动读数.csv`)}><Download size={14} aria-hidden="true" />导出旧手动读数</button></div><LegacyHighSchoolRecordTable records={snapshot.manual.records} /></>}
    </>}
  </details>;
}

export function LegacyHighSchoolRecordTable({ records }: { records: HighSchoolMeasurement[] }) {
  if (!records.length) return <p className="hs-legacy-empty">没有可读取的旧记录。</p>;
  return <div className="hs-table-scroll" tabIndex={0} aria-label="升级前的只读记录，可横向滚动"><table><thead><tr><th scope="col">序号</th><th scope="col">保存时刻</th><th scope="col">实验时刻 / s</th><th scope="col">已保存的结果</th><th scope="col">原始条件</th></tr></thead><tbody>{records.map((record, index) => <tr key={record.id}><th scope="row">{index + 1}</th><td>{record.createdAt}</td><td>{formatMeasurement(record.timeSeconds)}</td><td>{record.metrics.map((metric, metricIndex) => <p key={metricIndex}>{metric.label}：{formatMeasurement(metric.value, 4)} {metric.unit}</p>)}</td><td><details><summary>查看原始字段</summary><pre>{JSON.stringify({ parameters: record.parameters, ...("manual" in record ? { manual: record.manual } : {}) }, null, 2)}</pre></details></td></tr>)}</tbody></table></div>;
}
