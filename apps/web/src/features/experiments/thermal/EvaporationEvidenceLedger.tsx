import type { EvaporationEvidence } from "./evaporationEvidence";
import "./thermalRecords.css";

export function EvaporationEvidenceLedger({ records }: { records: readonly EvaporationEvidence[] }) {
  return <section className="evap-evidence-ledger thermal-evaporation-records" aria-label="蒸发称量记录">
    <p>每行保留当次条件和计时。天平读数分辨率为 0.001 g；失重 = 初始质量 − 末质量；平均速率 = 失重 ÷ 时长 × 60（g/min）。不同时长比较速率，不直接比较失重。</p>
    {records.length ? <div className="thermal-record-table-scroll"><table>
      <thead><tr><th>水温 / ℃</th><th>面积 / cm²</th><th>风速 / m/s</th><th>时长 / s</th><th>初始 / g</th><th>末质量 / g</th><th>失重 / g</th><th>平均速率 / g/min</th></tr></thead>
      <tbody>{records.map((row) => <tr key={row.id}>
        <td>{row.temperature}</td><td>{row.area}</td><td>{row.airflow}</td><td>{row.durationSeconds}</td>
        <td>{row.initialMassGrams.toFixed(3)}</td><td>{row.remainingMassGrams.toFixed(3)}</td><td>{row.loss.toFixed(3)}</td><td>{row.rate.toFixed(3)}</td>
      </tr>)}</tbody>
    </table></div> : <p>保存一组基准后，分别只改变温度、面积和风速。</p>}
  </section>;
}
