import { useEffect, useRef, useState } from "react";
import { LEARNING_FEEDBACK_BODY_LIMIT, LEARNING_RECORD_FIELD_LIMITS } from "@physics-lab/contracts";
import type { LearningFeedback, LearningRecordContent, SessionLearningRecord } from "@physics-lab/contracts";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { studentApi } from "../../../data/teacherApi";
import { isCurrentStudentRecordScope, type StudentRecordScope } from "../../../data/studentRecordScope";
import { LearningFeedbackList } from "../../learning-feedback/LearningFeedbackList";
import "./StudentLearningFeedback.css";

type FeedbackView = { identity: string; status: "loading" | "loaded" | "error"; feedback: LearningFeedback[]; readAt?: string; error?: string };
const fields = Object.keys(LEARNING_RECORD_FIELD_LIMITS) as Array<keyof LearningRecordContent>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const validTime = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

// This is a response-integrity check, not authorization. The API must enforce
// ownership from its authenticated student and the stored session.
function checkedFeedback(response: unknown, detail: SessionLearningRecord): LearningFeedback[] {
  const session = detail.session;
  if (!Array.isArray(response)) throw new Error("反馈返回格式不完整，请重新读取。");
  const ids = new Set<string>();
  for (const item of response) {
    if (!object(item) || item.schoolId !== session.schoolId || item.classId !== session.classId || item.taskId !== session.taskId
      || item.sessionId !== session.id || item.learnerId !== session.learnerId) throw new Error("反馈归属与当前实验不一致，未显示这批内容。请重新读取。");
    if (!nonempty(item.id) || ids.has(item.id) || !nonempty(item.authorId) || !nonempty(item.authorName)
      || (item.authorRole !== "teacher" && item.authorRole !== "admin") || !nonempty(item.mutationId)
      || typeof item.body !== "string" || !item.body.trim() || item.body.length > LEARNING_FEEDBACK_BODY_LIMIT
      || !Number.isSafeInteger(item.reportRevision) || Number(item.reportRevision) < 1
      || !validTime(item.reportUpdatedAt) || !validTime(item.createdAt) || !object(item.reportSnapshot)) throw new Error("反馈正文或版本信息不完整，未显示这批内容。请重新读取。");
    const content = item.reportSnapshot;
    if (fields.some((field) => typeof content[field] !== "string" || (content[field] as string).length > LEARNING_RECORD_FIELD_LIMITS[field])) throw new Error("反馈所关联的原报告不完整，未显示这批内容。请重新读取。");
    ids.add(item.id);
  }
  return response as LearningFeedback[];
}

export function StudentLearningFeedback({ scope, detail, hasLocalChanges = false }: {
  scope: StudentRecordScope; detail: SessionLearningRecord; hasLocalChanges?: boolean;
}) {
  const session = detail.session;
  const identity = JSON.stringify([scope.key, scope.revision, scope.apiNamespace, session.id, session.schoolId, session.learnerId, session.classId, session.taskId]);
  const [view, setView] = useState<FeedbackView | null>(null);
  const mounted = useRef(true);
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  const inFlight = useRef(false);
  const requestNumber = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; requestNumber.current++; inFlight.current = false; };
  }, []);
  useEffect(() => { requestNumber.current++; inFlight.current = false; }, [identity]);
  const ownsSession = scope.mode === "account" && !!scope.key && session.schoolId === scope.schoolId && session.learnerId === scope.studentId;
  // canWrite here means the fixed student login is still valid for a network
  // read. Expired accounts may read local reports, but feedback is not cached.
  const canRead = () => mounted.current && currentIdentity.current === identity && ownsSession && isCurrentStudentRecordScope(scope, true);
  const visible = view?.identity === identity ? view : null;

  async function read() {
    if (!canRead() || inFlight.current) return;
    const request = ++requestNumber.current;
    inFlight.current = true;
    setView({ identity, status: "loading", feedback: [] });
    try {
      const response = await studentApi.feedback(session.id);
      if (!canRead() || requestNumber.current !== request) return;
      const feedback = checkedFeedback(response, detail);
      if (!canRead() || requestNumber.current !== request) return;
      setView({ identity, status: "loaded", feedback, readAt: new Date().toISOString() });
    } catch (error) {
      if (canRead() && requestNumber.current === request) setView({ identity, status: "error", feedback: [], error: error instanceof Error ? error.message : "暂时无法读取反馈，请联网后重试。" });
    } finally {
      if (requestNumber.current === request) inFlight.current = false;
    }
  }

  if (!canRead()) return <section className="student-learning-feedback" aria-label="教师反馈"><h2>教师反馈</h2><p role="status">教师反馈需要用本次实验的学生账号联网读取。登录已过期或身份已变化时，请重新登录后打开这份档案。</p></section>;
  return <section className="student-learning-feedback" aria-label="教师反馈">
    <header><MessageSquareText size={19} aria-hidden="true" /><div><h2>教师反馈</h2><p>查看老师对某一版报告的具体建议，并核对当时的四段原文。</p></div></header>
    <p className="student-feedback-boundary">{session.status === "completed"
      ? "这次实验已完成，原报告保持只读。查看反馈不会重新开启实验；本页暂不支持已完成报告修订或关联反馈的重做。"
      : "这次实验尚未完成。读完建议后，你可以自行修改上方原报告并保存；读取反馈不会替你修改正文或完成实验。"}</p>
    <p className="student-feedback-version">{detail.record ? `当前已读取的账号报告：版本 ${detail.record.revision}。` : "当前尚未读取到已保存的账号报告版本。"}版本对照不包含未同步的本机草稿。{hasLocalChanges && " 上方有与账号版本不同的本机文字，请先核对保存状态。"}</p>
    <button type="button" disabled={visible?.status === "loading"} onClick={() => void read()}><RefreshCw size={15} aria-hidden="true" />{visible?.status === "loading" ? "正在读取反馈…" : visible?.status === "error" ? "重试读取反馈" : visible?.status === "loaded" ? "重新读取反馈" : "读取教师反馈"}</button>
    {!visible && <p className="student-feedback-note">尚未读取。反馈仅在本页内存中展示，不写入公共本机存储。</p>}
    {visible?.status === "error" && <p role="alert">未能读取反馈：{visible.error} 当前不能判断是否有新反馈，请重试。</p>}
    {visible?.status === "loaded" && <>
      <p className="student-feedback-note">本次读取于 {new Date(visible.readAt!).toLocaleString("zh-CN")}。教师以后可能追加反馈，可再次读取。</p>
      {!visible.feedback.length ? <p role="status">本次读取未发现教师反馈。</p> : <LearningFeedbackList feedback={visible.feedback} currentRevision={detail.record?.revision} canReveal={canRead} />}
    </>}
  </section>;
}
