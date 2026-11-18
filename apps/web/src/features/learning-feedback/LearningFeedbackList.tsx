import type { LearningFeedback, LearningRecordContent } from "@physics-lab/contracts";
import { useId, useState } from "react";
import "./LearningFeedbackList.css";

const fields: ReadonlyArray<{ key: keyof LearningRecordContent; label: string }> = [
  { key: "prediction", label: "实验预测" },
  { key: "measurements", label: "测量数据与观察" },
  { key: "conclusion", label: "实验结论" },
  { key: "question", label: "疑问与反思" }
];

function FeedbackTime({ value }: { value: string }) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? <span>时间暂不可用</span>
    : <time dateTime={value}>{date.toLocaleString("zh-CN", { hour12: false })}</time>;
}

export function LearningFeedbackSnapshot({ item }: { item: LearningFeedback }) {
  return <>
    <p>以下是教师留下反馈时的报告快照，保留当时的文字。报告保存于 <FeedbackTime value={item.reportUpdatedAt} />。</p>
    <dl>{fields.map(({ key, label }) => <div key={key}>
      <dt>{label}</dt>
      <dd className={item.reportSnapshot[key].trim() ? "" : "is-empty"}>{item.reportSnapshot[key].trim() ? item.reportSnapshot[key] : "当时尚未填写"}</dd>
    </div>)}</dl>
  </>;
}

export function LearningFeedbackDisclosure({ item, canReveal }: { item: LearningFeedback; canReveal?: () => boolean }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const allowed = !canReveal || canReveal();
  return <section className="learning-feedback-snapshot">
    <button type="button" aria-expanded={open && allowed} aria-controls={contentId} onClick={() => {
      if (canReveal && !canReveal()) return;
      setOpen((value) => !value);
    }}>{open && allowed ? "收起" : "查看"}这条反馈对应的报告原文（第 {item.reportRevision} 版）</button>
    <div id={contentId} hidden={!open || !allowed}>{open && allowed && <LearningFeedbackSnapshot item={item} />}</div>
  </section>;
}

/** Callers own loading/account lifetime and supply the guard used before reveal. */
export function LearningFeedbackList({ feedback, currentRevision, canReveal }: {
  feedback: readonly LearningFeedback[];
  currentRevision?: number;
  canReveal?: () => boolean;
}) {
  return <ol className="learning-feedback-list" aria-label="教师反馈历史">
    {feedback.map((item) => <li className="learning-feedback-entry" key={item.id}>
      <header>
        <strong>{item.authorName}<span>{item.authorRole === "admin" ? "管理员" : "教师"}</span></strong>
        <FeedbackTime value={item.createdAt} />
      </header>
      <p className="learning-feedback-version">针对报告第 {item.reportRevision} 版
        {currentRevision !== undefined && currentRevision > item.reportRevision && <span> · 当前已读取的账号报告为第 {currentRevision} 版</span>}
        {currentRevision !== undefined && currentRevision < item.reportRevision && <span> · 本页账号记录较旧，请重新读取报告</span>}
      </p>
      <p className="learning-feedback-body">{item.body}</p>
      <LearningFeedbackDisclosure item={item} canReveal={canReveal} />
    </li>)}
  </ol>;
}
