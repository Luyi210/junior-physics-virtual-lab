import { LEARNING_RECORD_FIELD_LIMITS } from "@physics-lab/contracts";
import type { LearningRecordContent, SessionLearningRecord } from "@physics-lab/contracts";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpenText, CloudCheck, RefreshCw, Save } from "lucide-react";
import { learningRecordRepository, recordContent, type LearningRecordDraft } from "../../../data/learningRecordRepository";
import { studentApi, TeacherApiError } from "../../../data/teacherApi";
import { getStudentRecordScope, subscribeStudentRecordScope, isCurrentStudentRecordScope, type StudentRecordScope } from "../../../data/studentRecordScope";
import { newUnsavedLearningRecordEditorId, preserveUnsavedLearningRecord, clearSavedUnsavedLearningRecords, getUnsavedLearningRecords, type UnsavedLearningRecord } from "../../../data/unsavedLearningRecord";
import { UnsavedLearningRecordPanel } from "../components/UnsavedLearningRecordPanel";
import { OtherLearningRecordDrafts } from "../components/OtherLearningRecordDrafts";
import { LegacyLearningRecordPanel } from "../components/LegacyLearningRecordPanel";
import { StudentLearningFeedback } from "../components/StudentLearningFeedback";
import { experimentTaskPath } from "../../experiments/catalog/taskRoutes";
import { getClassroomExperiment } from "@physics-lab/knowledge/classroom";
import { ClassroomEvidencePicker } from "../../high-school/components/ClassroomEvidencePicker";
import "./StudentLearningRecordPage.css";

const labels: Record<keyof LearningRecordContent, string> = {
  prediction: "实验前的预测", measurements: "测量数据与观察", conclusion: "我的结论与依据", question: "还想追问的问题"
};
const hints: Record<keyof LearningRecordContent, string> = {
  prediction: "先预测变量改变后会发生什么，并写下理由。",
  measurements: "例如：焦距 10 cm；物距 30 cm，像距 15 cm，倒立、缩小的实像。请填写你实际测得的数据和单位。",
  conclusion: "哪些数据支持你的结论？预测与结果是否一致？",
  question: "还有什么无法解释？下一次想怎样验证？"
};
type SaveState = "loading" | "saved" | "pending" | "syncing" | "conflict" | "error";

export function StudentLearningRecordPage() {
  const { sessionId = "" } = useParams();
  const scope = useSyncExternalStore(subscribeStudentRecordScope, getStudentRecordScope, getStudentRecordScope);
  return <RecordEditor key={`${sessionId}:${scope.key}:${scope.revision}`} sessionId={sessionId} scope={scope} />;
}

function RecordEditor({ sessionId, scope }: { sessionId: string; scope: StudentRecordScope }) {
  const [memoryEditorId] = useState(newUnsavedLearningRecordEditorId);
  const [detail, setDetail] = useState<SessionLearningRecord | null>(null);
  const [draft, setDraft] = useState<LearningRecordContent>(() => recordContent(null));
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState("");
  const [editCount, setEditCount] = useState(0);
  const [reload, setReload] = useState(0);
  const [storageFailed, setStorageFailed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const mounted = useRef(true);
  const blocked = useRef(false);
  const syncing = useRef(false);
  const storageFailedRef = useRef(false);
  const draftBaseRevision = useRef(0);
  const editorSnapshot = useRef({ detail, draft, state, resolving });
  editorSnapshot.current = { detail, draft, state, resolving };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const isCurrent = useCallback((write = false) => mounted.current && isCurrentStudentRecordScope(scope, write), [scope]);

  useEffect(() => {
    let active = true;
    const current = (write = false) => active && isCurrent(write);
    setState("loading"); setDetail(null); setMessage("");
    if (!scope.key || scope.mode !== "account") { setState("error"); setMessage(scope.label); return; }
    void (async () => {
      if (!current()) return;
      const repository = learningRecordRepository();
      let cached;
      let offline = !scope.canWrite;
      if (!scope.canWrite) {
        cached = repository.read(scope, sessionId);
        if (!cached) throw new Error("登录已过期，本机没有这份档案的新版本副本。请用原学生账号重新登录。");
      } else {
        try {
          if (!current(true)) return;
          const user = await studentApi.me();
          if (!current(true)) return;
          if (user.id !== scope.studentId || user.schoolId !== scope.schoolId || user.role !== "student") throw new TeacherApiError(403, "ACCOUNT_CHANGED", "学生身份与当前档案归属不一致，请重新登录。");
          const response = await studentApi.learningRecord(sessionId);
          if (!current(true)) return;
          cached = repository.remember(scope, response);
        } catch (error) {
          if (!current()) return;
          if (error instanceof TeacherApiError && error.status < 500) throw error;
          cached = repository.read(scope, sessionId);
          if (!cached) throw error;
          offline = true;
        }
      }
      if (!current()) return;
      draftBaseRevision.current = cached.pending?.expectedRevision ?? cached.server.record?.revision ?? 0;
      setDetail(cached.server); setDraft(recordContent(cached.pending ?? cached.server.record));
      const conflict = Boolean(cached.pending && (cached.server.session.status === "completed" || cached.pending.expectedRevision !== (cached.server.record?.revision ?? 0)) && cached.pending.mutationId !== cached.server.record?.lastMutationId);
      blocked.current = conflict;
      setState(conflict ? "conflict" : cached.pending ? "pending" : "saved");
      setMessage(!scope.canWrite ? "登录已过期，当前只读展示原账号的本机副本；草稿保留，重新登录后才能编辑或同步。" : conflict ? "已保存的版本有变化，本机草稿仍保留。请对照后选择。" : offline ? "当前显示本机副本，联网后可重新核对。" : "");
      if (scope.canWrite && cached.pending && !conflict) setEditCount((value) => value + 1);
    })().catch((error: unknown) => {
      if (current()) { setState("error"); setMessage(error instanceof Error ? error.message : "暂时无法读取记录"); }
    });
    return () => { active = false; };
  }, [sessionId, reload, scope, isCurrent]);

  const synchronize = useCallback(async () => {
    if (!isCurrent(true) || blocked.current || syncing.current || storageFailedRef.current) return;
    const repository = learningRecordRepository();
    let hasPending = false;
    try {
      hasPending = Boolean(repository.read(scope, sessionId)?.pending);
      if (!hasPending) return;
      syncing.current = true;
      setState("syncing"); setMessage("");
      const saved = await repository.sync(scope, sessionId);
      if (!isCurrent(true)) return;
      setDetail(saved);
      // Never replace text whose newer local write failed while the ACK was pending.
      if (storageFailedRef.current) return;
      const pending = repository.read(scope, sessionId)?.pending;
      if (pending) { draftBaseRevision.current = pending.expectedRevision; setState("pending"); }
      else { draftBaseRevision.current = saved.record?.revision ?? 0; setDraft(recordContent(saved.record)); setState("saved"); }
    } catch (error) {
      if (!isCurrent(true) || storageFailedRef.current) return;
      const conflict = error instanceof TeacherApiError && ["RECORD_CONFLICT", "SESSION_COMPLETED"].includes(error.code);
      blocked.current = conflict;
      const retryable = hasPending && (!(error instanceof TeacherApiError) || error.status >= 500 || error.status === 429);
      setState(conflict ? "conflict" : retryable ? "pending" : "error");
      setMessage(conflict ? "记录在其他页面已更新或实验已完成。本机草稿仍保留，请对照处理。" : error instanceof Error ? error.message : "暂时无法同步；当前内容仍显示，请保留此页面后重试。");
      if (conflict && isCurrent(true)) {
        try {
          const latest = await studentApi.learningRecord(sessionId);
          if (!isCurrent(true)) return;
          const cached = repository.remember(scope, latest);
          setDetail(cached.server);
        } catch { /* Keep the draft visible until the current account can refresh. */ }
      }
    } finally { syncing.current = false; }
  }, [scope, sessionId, isCurrent]);

  useEffect(() => {
    if (!editCount || storageFailed || blocked.current) return;
    const timer = window.setTimeout(() => { void synchronize(); }, 800);
    return () => window.clearTimeout(timer);
  }, [editCount, storageFailed, synchronize]);
  useEffect(() => {
    const online = () => { void synchronize(); };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [synchronize]);
  useEffect(() => {
    if (state !== "pending" || storageFailed || blocked.current) return;
    const timer = window.setTimeout(() => { void synchronize(); }, 5_000);
    return () => window.clearTimeout(timer);
  }, [state, storageFailed, synchronize]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (storageFailed) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed]);

  function edit(field: keyof LearningRecordContent, value: string) {
    if (!isCurrent(true) || !detail || state === "loading" || detail.session.status === "completed" || resolving) return;
    const next = { ...draft, [field]: value };
    setDraft(next);
    try {
      preserveUnsavedLearningRecord(scope, sessionId, memoryEditorId, next, draftBaseRevision.current);
      const queued = learningRecordRepository().queue(scope, sessionId, next, false, detail.record?.revision ?? 0);
      draftBaseRevision.current = queued.pending.expectedRevision;
      clearSavedUnsavedLearningRecords(scope, sessionId, next);
      storageFailedRef.current = false;
      setStorageFailed(false); setState(blocked.current ? "conflict" : "pending");
      if (!blocked.current) setMessage("");
      setEditCount((count) => count + 1);
    } catch {
      storageFailedRef.current = true;
      setStorageFailed(true); setState("error"); setMessage("浏览器无法保存草稿，请先复制填写内容，避免离开页面后丢失。");
    }
  }

  async function resolveConflict(keepMine: boolean) {
    if (resolving || !isCurrent(true)) return;
    setResolving(true);
    setMessage("");
    try {
      const repository = learningRecordRepository();
      const response = await studentApi.learningRecord(sessionId);
      // A delayed conflict dialog must not clear or replace the former student's
      // pending draft after logout, token renewal, backend switch or unmount.
      if (!isCurrent(true)) return;
      const latest = repository.remember(scope, response).server;
      setDetail(latest);
      if (keepMine && latest.session.status === "completed") throw new Error("这次实验已经完成，只能查看已保存版本。本机草稿仍保留，可复制后用于新的实验。");
      if (keepMine) {
        preserveUnsavedLearningRecord(scope, sessionId, memoryEditorId, draft, draftBaseRevision.current);
        const queued = repository.queue(scope, sessionId, draft, true);
        draftBaseRevision.current = queued.pending.expectedRevision;
        clearSavedUnsavedLearningRecords(scope, sessionId, draft);
      }
      else { repository.useServer(scope, sessionId); draftBaseRevision.current = latest.record?.revision ?? 0; setDraft(recordContent(latest.record)); }
      storageFailedRef.current = false; setStorageFailed(false);
      blocked.current = false; setState(keepMine ? "pending" : "saved");
      if (keepMine) await synchronize();
    } catch (error) { if (isCurrent(true)) setMessage(error instanceof Error ? error.message : "暂时无法处理版本差异"); }
    finally { if (isCurrent(true)) setResolving(false); }
  }

  function getRestoreToken() {
    const current = editorSnapshot.current;
    if (!isCurrent(true) || !current.detail || current.detail.session.status !== "active" || current.resolving || syncing.current || current.state === "loading") throw new Error("当前报告不可恢复草稿，请先登录并读取仍在进行的实验。");
    const cached = learningRecordRepository().read(scope, sessionId);
    if (!cached || cached.server.session.status !== "active") throw new Error("这次实验的本机账号记录不可写，请重新读取；原副本仍可导出。");
    return JSON.stringify([scope.key, scope.revision, sessionId, current.draft, cached]);
  }

  function restoreContent(content: LearningRecordContent, baseRevision: number, targetToken: string, sourceCurrent: () => boolean): boolean {
    try {
      if (!sourceCurrent() || getRestoreToken() !== targetToken) throw new Error("来源或上方草稿已变化，未替换正文。请重新预览并核对后恢复。");
      const restored = learningRecordRepository().restoreDraft(scope, sessionId, content, baseRevision);
      draftBaseRevision.current = baseRevision;
      setDetail(restored.server); setDraft(recordContent(restored.pending));
      clearSavedUnsavedLearningRecords(scope, sessionId, content);
      storageFailedRef.current = false; setStorageFailed(false);
      const conflict = baseRevision !== (restored.server.record?.revision ?? 0);
      blocked.current = conflict; setState(conflict ? "conflict" : "pending");
      setMessage(conflict ? "已恢复到本机草稿；原版本与账号当前版本不同，请对照后选择，尚未上传覆盖。" : "已恢复到本机草稿，将按原版本同步。来源页面的副本仍保留。");
      if (!conflict) setEditCount((count) => count + 1);
      return true;
    } catch (error) {
      if (isCurrent()) setMessage(error instanceof Error ? error.message : "未能恢复草稿，原副本仍保留。");
      return false;
    }
  }
  function restoreMemory(copy: UnsavedLearningRecord, targetToken: string): boolean {
    return restoreContent(copy.content, copy.baseRevision, targetToken, () => getUnsavedLearningRecords(scope, sessionId).includes(copy));
  }
  function restoreOther(copy: LearningRecordDraft, targetToken: string): boolean {
    if (!copy.valid || !copy.pending || copy.isCurrentTab) return false;
    return restoreContent(recordContent(copy.pending), copy.pending.expectedRevision, targetToken, () => learningRecordRepository().listDrafts(scope, sessionId).some((current) => current.clientId === copy.clientId && current.raw === copy.raw && current.valid && !current.isCurrentTab));
  }

  const completed = detail?.session.status === "completed";
  const readOnly = !scope.canWrite || completed || resolving;
  const statusText = !scope.canWrite && detail ? "登录已过期 · 本机只读" : storageFailed ? "尚未保存" : state === "loading" ? "正在读取" : state === "error" ? (detail ? "同步未完成" : "读取失败") : state === "syncing" ? "正在同步" : state === "conflict" ? "需要核对版本" : state === "pending" ? "已存本机 · 待同步" : completed ? "已归档 · 只读" : detail?.record ? "已保存到账号" : "尚未填写";
  return <main className="learning-record-page">
    <header className="learning-record-top"><Link to="/student"><ArrowLeft size={17} />学生空间</Link><span><BookOpenText size={17} />我的实验档案</span></header>
    <section className="learning-record-paper" aria-label="班级实验记录">
      <header><small>每一次实验，都留下自己的证据</small><h1>{detail?.taskTitle ?? "实验记录"}</h1>{detail && <p>{detail.className} · {detail.lessonTitle}</p>}<span className={`record-save-state is-${state}`} role="status"><CloudCheck size={16} />{statusText}</span></header>
      {message && <p className="learning-record-message" role={state === "error" || state === "conflict" ? "alert" : "status"}>{message}</p>}
      {!detail ? <div className="learning-record-empty">{state === "loading" ? "正在读取你的实验档案…" : <><Link to="/student">返回学生首页登录</Link><button type="button" onClick={() => setReload((value) => value + 1)}>重新读取</button></>}</div> : <>
        <div className="learning-record-fields">{(Object.keys(labels) as (keyof LearningRecordContent)[]).map((field) => <label key={field} htmlFor={`learning-${field}`}><strong>{labels[field]}</strong><textarea id={`learning-${field}`} value={draft[field]} readOnly={readOnly} maxLength={LEARNING_RECORD_FIELD_LIMITS[field]} rows={field === "measurements" ? 7 : 4} placeholder={field === "measurements" && getClassroomExperiment(detail.session.experimentId)?.stage === "high-school" ? "写下条件、数值、单位和观察现象，并区分模型采样与手动虚拟仪器读数。也可在下方选择本机读数加入草稿。" : field === "measurements" && detail.session.experimentId !== "lens" ? "写下实际测量条件、数值、单位和观察到的现象。" : hints[field]} onChange={(event) => edit(field, event.target.value)} /><small>{draft[field].length} / {LEARNING_RECORD_FIELD_LIMITS[field]} 字</small></label>)}</div>
        <ClassroomEvidencePicker detail={detail} measurements={draft.measurements} disabled={Boolean(readOnly) || state === "loading" || state === "syncing" || state === "conflict"} onAppend={(text) => edit("measurements", text)} />
        {state === "conflict" && <aside className="learning-record-conflict"><h2>对照已保存的版本</h2><p>上方保留本机草稿，下方是最近读取的账号记录。</p>{(Object.keys(labels) as (keyof LearningRecordContent)[]).map((field) => <div key={field}><b>{labels[field]}</b><p>{detail.record?.[field] || "未填写"}</p></div>)}<div className="record-actions">{!completed && <button type="button" disabled={!scope.canWrite || resolving} onClick={() => void resolveConflict(true)}>保留我的内容并保存</button>}<button type="button" disabled={!scope.canWrite || resolving} onClick={() => void resolveConflict(false)}>采用已保存版本</button></div></aside>}
        <footer className="record-actions">{!completed && state !== "conflict" && <button type="button" disabled={!scope.canWrite || state === "syncing" || storageFailed} onClick={() => void synchronize()}><Save size={16} />{state === "syncing" ? "同步中…" : "保存到账号"}</button>}<Link to={experimentTaskPath(detail.session.experimentId, detail.session.taskId, sessionId)}>返回实验</Link><Link to="/student#my-tasks">回到任务中心</Link>{state === "pending" && <button type="button" disabled={!scope.canWrite} onClick={() => void synchronize()}><RefreshCw size={15} />重试同步</button>}<button type="button" disabled={state === "syncing" || storageFailed || resolving} onClick={() => setReload((value) => value + 1)}><RefreshCw size={15} />重新读取账号记录</button></footer>
        <StudentLearningFeedback key={`feedback:${scope.key}:${scope.revision}:${sessionId}`} scope={scope} detail={detail} hasLocalChanges={(Object.keys(labels) as (keyof LearningRecordContent)[]).some((field) => draft[field] !== (detail.record?.[field] ?? ""))} />
        <p className="learning-record-footnote">{!scope.canWrite ? "当前仅可查看原账号本机副本，请重新登录后继续。" : completed ? "这次实验已完成，记录保留供你和任课老师查看。" : "填写后先保存到本机，再同步到账号。刷新前已写入本机的页面草稿可在下方核对并恢复；未落盘的文字请先导出。同步后可回到任务中心完成并归档。"}{detail.record && ` 最近保存：${new Date(detail.record.updatedAt).toLocaleString("zh-CN")}`}</p>
      </>}
      {scope.mode === "account" && scope.studentId && <><UnsavedLearningRecordPanel key={`memory:${scope.key}:${scope.revision}:${sessionId}`} scope={scope} sessionId={sessionId} getRestoreToken={getRestoreToken} onRestore={completed ? undefined : restoreMemory} restoreDisabled={!scope.canWrite || !detail || resolving || state === "syncing" || state === "loading"} /><LegacyLearningRecordPanel key={`legacy:${scope.key}:${scope.revision}:${sessionId}`} scope={scope} sessionId={sessionId} /><OtherLearningRecordDrafts key={`other:${scope.key}:${scope.revision}:${sessionId}`} scope={scope} sessionId={sessionId} getRestoreToken={getRestoreToken} onRestore={completed ? undefined : restoreOther} restoreDisabled={!scope.canWrite || !detail || resolving || state === "syncing" || state === "loading"} /></>}
    </section>
  </main>;
}
