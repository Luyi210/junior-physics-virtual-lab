import type { HarnessDialogueContextSnapshot } from "@physics-lab/harness";
import "./questionEvidence.css";

export function QuestionEvidence({ snapshot, onAskAgain, disabled }: {
  snapshot: HarnessDialogueContextSnapshot;
  onAskAgain?: () => void;
  disabled?: boolean;
}) {
  return <div className="harness-question-evidence">
    {snapshot.changedWhileWaiting && <p role="status">等待回答时装置已变化；这条回答仍对应提问时的状态。</p>}
    <details>
      <summary>查看提问时依据 · {new Date(snapshot.capturedAt).toLocaleTimeString("zh-CN", { hour12: false })}</summary>
      {snapshot.apparatusAvailable ? <ul>{snapshot.evidence.map((line, index) => <li key={index}>{line}</li>)}</ul>
        : <p>当时没有可读取的装置快照，回答结合实验主题与已有操作、对话记录，不能核实当前读数。</p>}
      <small>这是页面状态摘要；模型推导、操作记录不等于你亲手测得的数据。</small>
      {onAskAgain && <button type="button" onClick={onAskAgain} disabled={disabled}>按现在的装置再问</button>}
    </details>
  </div>;
}
