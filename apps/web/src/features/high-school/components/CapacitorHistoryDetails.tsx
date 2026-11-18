import type { CapacitorHistory } from '@physics-lab/contracts';
import { capacitorModeLabels } from '../experiments/capacitorEvidence';
import { formatMeasurement } from '../experiments/workbench';
import './CapacitorHistoryDetails.css';

/** A view of saved operations. Never substitutes the current live run. */
export function CapacitorHistoryDetails({ history, timeSeconds }: { history: CapacitorHistory; timeSeconds: number }) {
  const index = history.segments.length - 1;
  const segment = history.segments[index];
  return <details className="hs-capacitor-history"><summary>查看保存的开关过程 · {history.segments.length} 段</summary>
    <p>轮次 <code>{history.runId}</code>；从 0 V 开始，整轮 R、C、E 固定。</p>
    <ol>{history.segments.map((entry, ordinal) => <li key={`${ordinal}:${entry.startTimeSeconds}`}>
      {formatMeasurement(entry.startTimeSeconds)} s 起：{capacitorModeLabels[entry.mode]}{ordinal === index ? '（记录所在段）' : ''}
    </li>)}</ol>
    {segment && <p>当前记录在第 {index + 1} 段，段内历时 {formatMeasurement(timeSeconds - segment.startTimeSeconds)} s。段初电压继承上段，不因切换归零。</p>}
  </details>;
}
