import { useEffect, useState } from "react";
import { Download, Save } from "lucide-react";
import type { HighSchoolExperimentDefinition } from "@physics-lab/physics";
import { formatMeasurement, type HighSchoolMeasurement } from "../experiments/workbench";
import { mechanicalEnergyReadingLabels } from "../experiments/mechanicalEnergyEvidence";
import { CapacitorHistoryDetails } from "./CapacitorHistoryDetails";
import "./MeasurementRecoveryPanel.css";

interface Props {
  records: readonly HighSchoolMeasurement[];
  definition: HighSchoolExperimentDefinition;
  reviewToken: string | null;
  writable: boolean;
  onExport: () => void;
  onRecover: (reviewToken: string) => void;
  kind?: "automatic" | "manual";
  excludedCount?: number;
  onExportBackup?: () => void;
}

const readingLabels: Record<string, string> = {
  ...Object.fromEntries(Object.entries(mechanicalEnergyReadingLabels).map(([key, field]) => [key, `${field.label} / ${field.unit}`])),
  startTimeSeconds: "开始读数 / s", endTimeSeconds: "停止读数 / s", periodCount: "完整周期数",
  length: "摆长 / m", amplitudeDegrees: "释放摆角 / °", leftPositionMm: "A坐标 / mm",
  rightPositionMm: "B坐标 / mm", intervalCount: "相邻间隔数", slitSeparationMm: "缝间距 / mm", screenDistance: "屏距 / m"
};

function rawReadings(record: HighSchoolMeasurement): [string, number][] {
  const manual = (record as HighSchoolMeasurement & { manual?: { readings?: Record<string, unknown> } }).manual;
  if (!manual?.readings || typeof manual.readings !== "object") return [];
  return Object.entries(manual.readings).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]));
}

/** A recovery review is separate from saved evidence and is bound to its storage token. */
export function MeasurementRecoveryPanel({ records, definition, reviewToken, writable, onExport, onRecover, kind = "automatic", excludedCount = 0, onExportBackup }: Props) {
  const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  useEffect(() => { setConfirmedToken(null); }, [reviewToken, writable, records, excludedCount]);
  const total = records.length + excludedCount;
  if (!total) return null;
  const canRecover = writable && reviewToken !== null && excludedCount === 0;
  const confirming = canRecover && confirmedToken === reviewToken;

  return <section className="hs-recovery-panel" aria-label={`${kind === "manual" ? "手动" : "自动"}读数恢复`}>
    <header><span className="hs-kicker">待恢复读数 · {total} 条</span><h3>先核对，再存入当前档案。</h3><p>本机档案读取中断时产生了这些读数。它们尚未加入当前档案，也未用于记录分析或交给力力。请先查看或导出副本。</p></header>
    {excludedCount > 0 && <p className="hs-recovery-warning" role="alert">其中 {excludedCount} 条数据无法按当前格式核对，未列在下表，因此暂不能整批恢复。请备份原始数据，避免刷新后丢失。</p>}
    {!writable ? <p className="hs-recovery-warning">当前档案只读。可以导出副本，确认档案归属并重新登录后再恢复。</p> : reviewToken === null && <p className="hs-recovery-warning">目前还无法读取当前本机档案。请先导出副本，稍后重试本机保存，再回来核对。</p>}
    {records.length > 0 && <details className="hs-recovery-details" open><summary>核对这 {records.length} 条{kind === "manual" ? "手动虚拟读数" : "模型采样"}</summary><div className="hs-table-scroll" tabIndex={0} aria-label="待恢复读数，可横向滚动"><table><thead><tr><th scope="col">序号</th><th scope="col">记录时间 / UTC</th><th scope="col">实验时刻 / s</th>{kind === "manual" && <th scope="col">原始手动读数</th>}<th scope="col">{kind === "manual" ? "按读数计算" : "模型读数"}</th><th scope="col">当时的条件</th></tr></thead><tbody>{records.map((record, index) => <tr key={`${record.id}:${index}`}><th scope="row">{index + 1}</th><td>{record.createdAt.replace("T", " ").replace("Z", "")}</td><td>{formatMeasurement(record.timeSeconds)}</td>{kind === "manual" && <td><dl>{rawReadings(record).map(([key, value]) => <div key={key}><dt>{readingLabels[key] ?? key}</dt><dd>{formatMeasurement(value)}</dd></div>)}</dl></td>}<td><dl>{record.metrics.map((metric) => <div key={metric.key}><dt>{metric.label}</dt><dd>{formatMeasurement(metric.value)} {metric.unit}</dd></div>)}</dl></td><td><dl>{definition.parameters.map((parameter) => <div key={parameter.key}><dt>{parameter.label}</dt><dd>{formatMeasurement(record.parameters[parameter.key])} {parameter.unit}</dd></div>)}</dl>{record.capacitorHistory && <CapacitorHistoryDetails history={record.capacitorHistory} timeSeconds={record.timeSeconds} />}</td></tr>)}</tbody></table></div></details>}
    <div className="hs-recovery-actions"><button className="hs-button" type="button" onClick={onExport} disabled={!records.length}><Download size={15} aria-hidden="true" />导出待恢复读数 CSV</button>{excludedCount > 0 && onExportBackup && <button className="hs-button" type="button" onClick={onExportBackup}><Download size={15} aria-hidden="true" />备份原始数据</button>}<button className="hs-button" type="button" disabled={!canRecover} onClick={() => setConfirmedToken(reviewToken)}><Save size={15} aria-hidden="true" />保存到当前档案</button></div>
    {confirming && <div className="hs-recovery-confirm" role="group" aria-label="确认恢复读数"><p>将上面 {records.length} 条读数保存到当前档案？即使档案此前已清空，确认后也会加入这些读数。</p><button className="hs-button hs-primary" type="button" onClick={() => { const token = confirmedToken; setConfirmedToken(null); if (token !== null && token === reviewToken) onRecover(token); }}>确认保存这 {records.length} 条</button><button className="hs-button" type="button" onClick={() => setConfirmedToken(null)}>继续核对</button></div>}
    <p className="hs-recovery-footnote">待恢复副本暂留在当前页面会话中；关闭或刷新前请导出。手动虚拟读数与模型采样都不是真实器材实测。</p>
  </section>;
}
