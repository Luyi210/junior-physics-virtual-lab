import { useEffect, useId, useRef, useState } from "react";
import { LEARNING_FEEDBACK_BODY_LIMIT, type CreateLearningFeedbackRequest, type LearningFeedback, type LearningRecord, type SessionLearningRecord } from "@physics-lab/contracts";
import { MessageSquareText, RefreshCw, Send } from "lucide-react";
import { teacherApi, TeacherApiError } from "../../data/teacherApi";
import { getTeacherSessionScope } from "../../data/teacherSessionScope";
import { LearningFeedbackList } from "../learning-feedback/LearningFeedbackList";
import { useTeacherSessionGuard } from "./useTeacherSessionGuard";
import "./TeacherFeedbackPanel.css";

type Draft = { body: string; reviewed: LearningRecord | null; attempt: CreateLearningFeedbackRequest | null; conflict: boolean };
type FeedbackState = { status: "idle" | "loading" | "ready" | "error"; feedback: LearningFeedback[]; error: string };
const fields = [{ key: "prediction", label: "实验预测" }, { key: "measurements", label: "测量数据与观察" }, { key: "conclusion", label: "实验结论" }, { key: "question", label: "疑问与反思" }] as const;
// Deliberately page-memory only: never persist school report text in localStorage.
// The stable owner key lets the original account resume after a route change or
// renewal. Each mounted instance still enforces the current credential revision.
const drafts = new Map<string, Draft>();
let unloadWindow: Window | undefined;
const warnBeforeUnload = (event: BeforeUnloadEvent) => { if (drafts.size) { event.preventDefault(); event.returnValue = ""; } };
function updateUnloadWarning() {
  if (!drafts.size) { unloadWindow?.removeEventListener("beforeunload", warnBeforeUnload); unloadWindow = undefined; return; }
  if (typeof window !== "undefined" && window !== unloadWindow) {
    unloadWindow?.removeEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("beforeunload", warnBeforeUnload); unloadWindow = window;
  }
}
function sessionIdentity(item: SessionLearningRecord) {
  const value = item.session;
  return JSON.stringify([value.schoolId, value.classId, value.taskId, value.id, value.learnerId]);
}
function feedbackBelongs(value: LearningFeedback, item: SessionLearningRecord) {
  const session = item.session;
  return value && value.sessionId === session.id && value.schoolId === session.schoolId && value.classId === session.classId
    && value.taskId === session.taskId && value.learnerId === session.learnerId && typeof value.id === "string" && !!value.id
    && typeof value.authorName === "string" && typeof value.authorId === "string" && (value.authorRole === "teacher" || value.authorRole === "admin")
    && typeof value.body === "string" && !!value.body.trim() && value.body.length <= LEARNING_FEEDBACK_BODY_LIMIT
    && typeof value.createdAt === "string" && typeof value.reportUpdatedAt === "string" && typeof value.mutationId === "string" && Number.isSafeInteger(value.reportRevision) && value.reportRevision >= 1
    && value.reportSnapshot && fields.every(({ key }) => typeof value.reportSnapshot[key] === "string");
}
function recordBelongs(value: LearningRecord | null, item: SessionLearningRecord) {
  return value === null || (value.sessionId === item.session.id && value.learnerId === item.session.learnerId && Number.isSafeInteger(value.revision)
    && value.revision >= 1 && fields.every(({ key }) => typeof value[key] === "string"));
}
function messageOf(error: unknown) { return error instanceof Error ? error.message : "暂时无法连接后台，请重试。"; }
function sameAttempt(a: CreateLearningFeedbackRequest | null, b: CreateLearningFeedbackRequest) {
  return a?.mutationId === b.mutationId && a.body === b.body && a.expectedRevision === b.expectedRevision;
}
function newMutationId() {
  const random = globalThis.crypto;
  if (typeof random?.randomUUID === "function") return `feedback-${random.randomUUID()}`;
  if (typeof random?.getRandomValues === "function") {
    const bytes = random.getRandomValues(new Uint8Array(16));
    return `feedback-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error("浏览器无法生成安全的提交编号，请在 HTTPS 地址或受支持的浏览器中打开。反馈草稿仍保留在当前标签，本次没有发送。");
}

export function TeacherFeedbackPanel({ item }: { item: SessionLearningRecord }) {
  const canAct = useTeacherSessionGuard();
  const [owner] = useState(getTeacherSessionScope);
  const [identity] = useState(() => sessionIdentity(item));
  const currentIdentity = useRef(sessionIdentity(item));
  currentIdentity.current = sessionIdentity(item);
  const storageKey = JSON.stringify([owner.key, identity]);
  const valid = () => canAct() && owner.schoolId === item.session.schoolId && identity === currentIdentity.current;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => drafts.get(storageKey) ?? { body: "", reviewed: recordBelongs(item.record, item) ? item.record : null, attempt: null, conflict: false });
  const draftRef = useRef(draft);
  const [list, setList] = useState<FeedbackState>({ status: "idle", feedback: [], error: "" });
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<SessionLearningRecord | null>(null);
  const [message, setMessage] = useState("");
  const latestReadRevision = useRef(0);
  if (valid()) latestReadRevision.current = Math.max(latestReadRevision.current, recordBelongs(item.record, item) ? item.record?.revision ?? 0 : 0, draft.reviewed?.revision ?? 0);
  const sequence = useRef(0);
  const previewSequence = useRef(0);
  const bodyId = useId();
  const panelId = useId();

  useEffect(() => () => { sequence.current += 1; previewSequence.current += 1; }, []);

  function updateDraft(next: Draft) {
    if (!valid()) return;
    draftRef.current = next;
    if (next.body || next.attempt) drafts.set(storageKey, next); else drafts.delete(storageKey);
    updateUnloadWarning(); setDraft(next);
  }
  async function loadFeedback() {
    if (!valid()) return;
    const request = ++sequence.current;
    setList((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const feedback = await teacherApi.feedback(item.session.id);
      if (!valid() || request !== sequence.current) return;
      if (!Array.isArray(feedback) || !feedback.every((value) => feedbackBelongs(value, item))) throw new Error("反馈与当前实验归属不一致，未显示这批内容，请刷新后重试。");
      setList((current) => ({ status: "ready", feedback: [...current.feedback, ...feedback.filter((value) => !current.feedback.some((saved) => saved.id === value.id))], error: "" }));
    } catch (error) { if (valid() && request === sequence.current) setList((current) => ({ ...current, status: "error", error: messageOf(error) })); }
  }
  function togglePanel() {
    if (!valid()) return;
    setOpen(!open);
    if (!open && list.status === "idle") void loadFeedback();
  }
  function editBody(value: string) {
    if (!valid() || draftRef.current.attempt || sendingRef.current) return;
    updateDraft({ ...draftRef.current, body: value }); setMessage("");
  }
  async function sendFeedback() {
    if (!valid() || sendingRef.current) return;
    const current = draftRef.current;
    if (current.conflict) { setMessage("请先刷新并重新核对报告正文，之后才能再次提交。"); return; }
    if (!current.reviewed) { setMessage("学生尚未保存报告，暂时不能提交反馈。"); return; }
    if (!current.body.trim() || current.body.length > LEARNING_FEEDBACK_BODY_LIMIT) { setMessage(`请填写 1–${LEARNING_FEEDBACK_BODY_LIMIT} 字的反馈，不能只有空白。`); return; }
    let attempt: CreateLearningFeedbackRequest;
    try { attempt = current.attempt ?? { body: current.body, expectedRevision: current.reviewed.revision, mutationId: newMutationId() }; }
    catch (error) { setMessage(messageOf(error)); return; }
    updateDraft({ ...current, attempt });
    sendingRef.current = true; setSending(true); setMessage("");
    try {
      const feedback = await teacherApi.createFeedback(item.session.id, attempt);
      if (!valid()) return;
      if (!feedbackBelongs(feedback, item) || feedback.mutationId !== attempt.mutationId || feedback.reportRevision !== attempt.expectedRevision || feedback.body !== attempt.body) {
        throw new Error("后台返回的反馈与本次提交不一致，结果尚未确认，请保留原提交并重试。");
      }
      setList((state) => ({ status: "ready", error: "", feedback: [feedback, ...state.feedback.filter((value) => value.id !== feedback.id)] }));
      if (sameAttempt(draftRef.current.attempt, attempt)) updateDraft({ body: "", reviewed: draftRef.current.reviewed, attempt: null, conflict: false });
      setMessage("反馈已保存。它保留了本次核对的报告版本，不会修改或解锁学生正文。");
    } catch (error) {
      if (!valid()) return;
      if (error instanceof TeacherApiError && (error.code === "RECORD_CONFLICT" || error.code === "RECORD_REQUIRED" || error.code === "FEEDBACK_CONFLICT")) {
        updateDraft({ ...draftRef.current, attempt: null, conflict: true }); setPreview(null);
        setMessage(error.code === "FEEDBACK_CONFLICT" ? "提交编号发生冲突，反馈草稿已保留。请先刷新反馈核对已保存条目，再刷新报告并重新核对正文后提交。" : "报告已变化或暂时没有已保存正文。反馈草稿已保留；请刷新并重新核对正文后再提交。");
      } else if (error instanceof TeacherApiError && error.status >= 400 && error.status < 500 && error.code !== "FEEDBACK_CONFLICT") {
        updateDraft({ ...draftRef.current, attempt: null }); setMessage(messageOf(error));
      } else {
        // An unknown result remains the same immutable operation on retry.
        setMessage(`${messageOf(error)} 发送结果尚未确认；重试会沿用原正文、版本和提交编号，不会改成另一条反馈。`);
      }
    } finally { if (valid()) { sendingRef.current = false; setSending(false); } }
  }
  async function refreshReport() {
    if (!valid() || sendingRef.current || draftRef.current.attempt || refreshing) return;
    const request = ++previewSequence.current;
    setRefreshing(true); setPreview(null); setMessage("");
    try {
      const records = await teacherApi.taskRecords(item.session.taskId);
      if (!valid() || request !== previewSequence.current) return;
      const candidates = records.filter((value) => value.session.id === item.session.id);
      if (candidates.length !== 1 || sessionIdentity(candidates[0]) !== identity || !recordBelongs(candidates[0].record, item)) throw new Error("当前任务中没有找到归属一致的实验报告，请重新打开档案核对。");
      latestReadRevision.current = Math.max(latestReadRevision.current, candidates[0].record?.revision ?? 0);
      setPreview(candidates[0]);
    } catch (error) { if (valid() && request === previewSequence.current) setMessage(messageOf(error)); }
    finally { if (valid() && request === previewSequence.current) setRefreshing(false); }
  }
  function acceptPreview() {
    if (!valid() || !preview?.record || sendingRef.current || draftRef.current.attempt) return;
    updateDraft({ ...draftRef.current, reviewed: preview.record, conflict: false, attempt: null });
    setPreview(null); setMessage(`已改用第 ${preview.record.revision} 版作为反馈依据。草稿未发送，请核对反馈文字后明确提交。`);
  }

  if (!valid()) return null;
  const pending = !!draft.body || !!draft.attempt;
  return <section className="teacher-feedback-panel" aria-label="教师反馈">
    <button type="button" className="teacher-button ghost teacher-feedback-toggle" aria-expanded={open} aria-controls={panelId} onClick={togglePanel}>
      <MessageSquareText size={16} />{open ? "收起教师反馈" : "查看与编写教师反馈"}{pending && <span>有未提交或待确认反馈</span>}
    </button>
    {open && <div id={panelId} className="teacher-feedback-body">
      <header><div><h4>针对这次实验，给出具体建议</h4><p>反馈与学生报告分开保存，不自动评分。{item.session.status === "completed" ? "这次实验已完成，反馈不会解锁原报告。" : "学生可以在本次实验仍开放编辑时自行修改正文。"}</p></div>
        <button type="button" className="teacher-button ghost" onClick={() => void loadFeedback()} disabled={list.status === "loading"}><RefreshCw size={14} />刷新反馈</button></header>
      {list.status === "loading" && <p role="status">正在读取这次实验的教师反馈…</p>}
      {list.status === "error" && <p className="teacher-feedback-error" role="alert">{list.error}</p>}
      {list.status === "ready" && !list.feedback.length && <p className="teacher-feedback-empty">这次实验还没有已保存的教师反馈。</p>}
      {list.feedback.length > 0 && <LearningFeedbackList feedback={list.feedback} currentRevision={latestReadRevision.current || undefined} canReveal={valid} />}
      <div className="teacher-feedback-compose">
        {draft.reviewed ? <>
          <p className="teacher-feedback-version">本条反馈依据：报告第 <strong>{draft.reviewed.revision}</strong> 版 · 更新于 <time dateTime={draft.reviewed.updatedAt}>{draft.reviewed.updatedAt}</time></p>
          <ReportPreview record={draft.reviewed} title="核对本条反馈对应的四段正文" canReveal={valid} />
        </> : <p role="status">学生尚未保存报告，暂时不能编写反馈。可刷新报告查看最新状态。</p>}
        <button className="teacher-button ghost" type="button" onClick={() => void refreshReport()} disabled={refreshing || sending || !!draft.attempt}><RefreshCw size={14} />{refreshing ? "正在读取报告…" : "刷新报告，重新核对版本"}</button>
        {preview && <div className="teacher-feedback-review" aria-label="最新报告预览">
          {preview.record ? <><p>刚读取的报告第 <strong>{preview.record.revision}</strong> 版。请阅读四段正文；确认后才会改变本条反馈的依据。</p><ReportPreview record={preview.record} title="最新报告四段正文" canReveal={valid} /><button className="teacher-button" type="button" onClick={acceptPreview}>已重新核对，改用此版本</button></> : <p>当前仍没有已保存的报告。已有反馈草稿保留，暂不能提交。</p>}
        </div>}
        <label htmlFor={bodyId}>教师反馈正文</label>
        <textarea id={bodyId} value={draft.body} maxLength={LEARNING_FEEDBACK_BODY_LIMIT} disabled={!draft.reviewed} readOnly={sending || !!draft.attempt} onChange={(event) => editBody(event.target.value)} placeholder="指出具体证据，再提出学生能够继续完成的问题。" rows={5} />
        <div className="teacher-feedback-compose-meta"><span>{draft.body.length} / {LEARNING_FEEDBACK_BODY_LIMIT}</span><span>{draft.attempt ? "原提交内容已锁定，等待确认结果" : "尚未提交"}</span></div>
        {pending && <p className="teacher-feedback-draft-note" role="status">未提交反馈仅保留在当前标签的内存中；收起或切换任务后可回来继续。刷新、关闭标签会丢失草稿。换号后不显示原账号草稿；在此标签回到原账号可继续。已经发送的请求可能仍由后台完成，请重试核对，不能视为撤回。</p>}
        {message && <p className={draft.conflict || draft.attempt ? "teacher-feedback-error" : "teacher-feedback-message"} role="status">{message}</p>}
        <button type="button" className="teacher-button" onClick={() => void sendFeedback()} disabled={sending || draft.conflict || !draft.reviewed || !draft.body.trim() || draft.body.length > LEARNING_FEEDBACK_BODY_LIMIT}><Send size={14} />{sending ? "正在提交…" : draft.attempt ? "重试确认原提交" : "提交这条反馈"}</button>
      </div>
    </div>}
  </section>;
}

export function TeacherFeedbackReportPreview({ record, title, canReveal }: { record: LearningRecord; title: string; canReveal: () => boolean }) {
  const [open, setOpen] = useState(true);
  const contentId = useId();
  const allowed = canReveal();
  return <section className="teacher-feedback-report"><button type="button" aria-controls={contentId} aria-expanded={open && allowed} onClick={() => { if (canReveal()) setOpen((value) => !value); }}>{open && allowed ? "收起" : "展开"}{title}</button><div id={contentId} hidden={!open || !allowed}>{open && allowed && <dl>{fields.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{record[key].trim() ? record[key] : "尚未填写"}</dd></div>)}</dl>}</div></section>;
}
const ReportPreview = TeacherFeedbackReportPreview;
