import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { LearningRecordContent, PlatformUser, SessionLearningRecord, TeachingClass, TeachingTask } from "@physics-lab/contracts";
import { BookOpenCheck, ChevronDown, ClipboardList, LoaderCircle, RefreshCw } from "lucide-react";
import { teacherApi, TeacherApiError } from "../../data/teacherApi";
import { getTeacherSessionScope, subscribeTeacherSessionScope } from "../../data/teacherSessionScope";
import { useTeacherSessionGuard } from "./useTeacherSessionGuard";
import { TeacherFeedbackPanel } from "./TeacherFeedbackPanel";
import "./TeacherLearningRecords.css";

type CatalogState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; classes: TeachingClass[]; tasks: TeachingTask[] };

type RecordsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; records: SessionLearningRecord[] };

const recordFields: Array<{ key: keyof LearningRecordContent; label: string }> = [
  { key: "prediction", label: "实验预测" },
  { key: "measurements", label: "测量数据与观察" },
  { key: "conclusion", label: "实验结论" },
  { key: "question", label: "疑问与反思" }
];

function requestError(error: unknown) {
  return error instanceof TeacherApiError ? error.message : "暂时无法连接后台，请检查连接后重试。";
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间暂不可用" : date.toLocaleString("zh-CN", { hour12: false });
}

export function learningRecordStatus(item: SessionLearningRecord) {
  if (item.session.status === "completed") return { key: "completed", label: "已完成" } as const;
  if (item.record && recordFields.some(({ key }) => item.record?.[key].trim())) return { key: "active", label: "进行中" } as const;
  return { key: "empty", label: "未填写" } as const;
}

export function TeacherLearningRecords({ currentUser }: { currentUser: PlatformUser }) {
  const scope = useSyncExternalStore(subscribeTeacherSessionScope, getTeacherSessionScope, getTeacherSessionScope);
  if (!scope.canAccess || scope.userId !== currentUser.id || scope.schoolId !== currentUser.schoolId || scope.role !== currentUser.role) {
    return <RecordsMessage>教师身份已改变或已过期，请重新登录后查看实验档案。</RecordsMessage>;
  }
  return <TeacherLearningRecordsContent key={`${scope.key}:${scope.revision}`} currentUser={currentUser} />;
}

export function TeacherLearningRecordsContent({ currentUser }: { currentUser: PlatformUser }) {
  const canAct = useTeacherSessionGuard();
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [catalogReload, setCatalogReload] = useState(0);
  const [classId, setClassId] = useState("");
  const [taskId, setTaskId] = useState("");

  useEffect(() => {
    let current = true;
    if (!canAct()) return;
    setCatalog({ status: "loading" });
    setClassId("");
    setTaskId("");
    void Promise.all([teacherApi.classes(), teacherApi.tasks()]).then(([classes, tasks]) => {
      if (!current || !canAct()) return;
      const accessibleClasses = classes.filter((item) => item.schoolId === currentUser.schoolId && (currentUser.role === "admin" || item.createdBy === currentUser.id));
      const accessibleIds = new Set(accessibleClasses.map((item) => item.id));
      setCatalog({ status: "ready", classes: accessibleClasses, tasks: tasks.filter((item) => item.schoolId === currentUser.schoolId && accessibleIds.has(item.classId)) });
    }).catch((error: unknown) => {
      if (current && canAct()) setCatalog({ status: "error", message: requestError(error) });
    });
    return () => { current = false; };
  }, [currentUser.id, currentUser.schoolId, currentUser.role, catalogReload, canAct]);

  const tasks = useMemo(() => catalog.status === "ready" ? catalog.tasks.filter((task) => !classId || task.classId === classId) : [], [catalog, classId]);
  const selectedTask = tasks.find((task) => task.id === taskId);

  function reloadCatalog() {
    if (!canAct()) return;
    setCatalog({ status: "loading" });
    setTaskId("");
    setCatalogReload((value) => value + 1);
  }

  if (!canAct()) return <RecordsMessage>教师身份已改变，请重新打开实验档案。</RecordsMessage>;

  return <div className="teacher-view teacher-learning-records">
    <section className="teacher-view-toolbar">
      <div><span>EXPERIMENT RECORDS</span><h2>学生实验档案</h2><p>按教学任务阅读学生保存的预测、数据、结论和疑问。每次实验单独保留。</p></div>
      <button className="teacher-button ghost" type="button" onClick={reloadCatalog} disabled={catalog.status === "loading"}><RefreshCw size={15} />刷新班级与任务</button>
    </section>

    {catalog.status === "loading" && <RecordsMessage loading>正在读取班级与教学任务…</RecordsMessage>}
    {catalog.status === "error" && <RecordsMessage error action={reloadCatalog}>{catalog.message}</RecordsMessage>}
    {catalog.status === "ready" && <>
      {!catalog.classes.length ? <RecordsMessage>还没有可查看的班级。请先在班级管理中建立班级，再发布实验任务。</RecordsMessage> : <>
        <div className="teacher-record-filters">
          <label><span>班级</span><select value={classId} onChange={(event) => { if (!canAct()) return; setClassId(event.target.value); setTaskId(""); }}>
            <option value="">全部可查看班级</option>
            {catalog.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label><span>实验任务</span><select value={taskId} onChange={(event) => { if (canAct()) setTaskId(event.target.value); }} disabled={!tasks.length}>
            <option value="">{tasks.length ? "请选择实验任务" : "暂无教学任务"}</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}{!classId ? ` · ${catalog.classes.find((item) => item.id === task.classId)?.name ?? ""}` : ""}</option>)}
          </select></label>
        </div>
        {!tasks.length ? <RecordsMessage>这个范围内还没有教学任务。请到“实验备课”创建课例并发布任务。</RecordsMessage>
          : selectedTask ? <TaskLearningRecords key={`${currentUser.id}:${selectedTask.id}`} task={selectedTask} />
            : <RecordsMessage>选择一个实验任务，查看学生实际保存的实验记录。</RecordsMessage>}
      </>}
    </>}
  </div>;
}

export function TaskLearningRecords({ task }: { task: TeachingTask }) {
  const canAct = useTeacherSessionGuard();
  const [state, setState] = useState<RecordsState>({ status: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let current = true;
    if (!canAct()) return;
    void teacherApi.taskRecords(task.id).then((records) => {
      if (current && canAct()) setState({ status: "ready", records });
    }).catch((error: unknown) => {
      if (current && canAct()) setState({ status: "error", message: requestError(error) });
    });
    return () => { current = false; };
  }, [task.id, reload, canAct]);

  function refreshRecords() {
    if (!canAct()) return;
    setState({ status: "loading" });
    setReload((value) => value + 1);
  }

  if (!canAct()) return <RecordsMessage>教师身份已改变，请重新打开实验档案。</RecordsMessage>;

  return <section className="teacher-record-results" aria-label={`${task.title}的实验记录`}>
    <header><div><span>学生保存的实验过程</span><h3>{task.title}</h3>{task.lessonTitle && <p>{task.lessonTitle}</p>}</div><button className="teacher-button ghost" type="button" onClick={refreshRecords} disabled={state.status === "loading"}><RefreshCw size={14} />刷新记录</button></header>
    {state.status === "loading" && <RecordsMessage loading>正在读取学生实验记录…</RecordsMessage>}
    {state.status === "error" && <RecordsMessage error action={refreshRecords}>{state.message}</RecordsMessage>}
    {state.status === "ready" && (state.records.length ? <>
      <div className="teacher-record-summary" role="status">
        <span><b>{new Set(state.records.map((item) => item.session.learnerId)).size}</b> 名学生开始过实验</span>
        <span><b>{state.records.length}</b> 次实验</span>
        <span><b>{state.records.filter((item) => item.session.status === "completed").length}</b> 次已完成</span>
      </div>
      <p className="teacher-record-note">仅显示已开始的实验；同一学生可以有多次记录。“已完成”表示学生结束了该次实验，不代表结论已通过评价。</p>
      <div className="teacher-record-list">{state.records.map((item) => <LearningRecordDetails key={item.session.id} item={item} feedbackEnabled />)}</div>
    </> : <RecordsMessage>还没有学生开始这个任务。学生从个人任务中进入实验后，这里会显示实验进程和保存的记录。</RecordsMessage>)}
  </section>;
}

export function LearningRecordDetails({ item, feedbackEnabled = false }: { item: SessionLearningRecord; feedbackEnabled?: boolean }) {
  const status = learningRecordStatus(item);
  return <details className="teacher-record-card">
    <summary>
      <i className="teacher-record-icon" aria-hidden="true"><BookOpenCheck size={19} /></i>
      <div className="teacher-record-identity"><strong>{item.learnerName}</strong><span>开始于 {formatTime(item.session.startedAt)}</span></div>
      <span className={`teacher-record-status is-${status.key}`}>{status.label}</span>
      <span className="teacher-record-updated">{item.record ? <>记录更新于 <time dateTime={item.record.updatedAt}>{formatTime(item.record.updatedAt)}</time></> : "尚未保存实验记录"}</span>
      <ChevronDown className="teacher-record-chevron" size={17} aria-hidden="true" />
    </summary>
    <div className="teacher-record-detail">
      <div className="teacher-record-context"><span>{item.className}</span><span>{item.lessonTitle}</span>{item.session.completedAt && <span>结束于 {formatTime(item.session.completedAt)}</span>}</div>
      {item.record ? <dl>{recordFields.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd className={item.record?.[key].trim() ? "" : "is-empty"}>{item.record?.[key].trim() ? item.record[key] : "尚未填写"}</dd></div>)}</dl>
        : <p className="teacher-record-empty-detail">这次实验尚未保存预测、测量数据、结论或疑问。学生保存后，点击“刷新记录”即可查看。</p>}
      {feedbackEnabled && <TeacherFeedbackPanel item={item} />}
    </div>
  </details>;
}

function RecordsMessage({ children, loading, error, action }: { children: React.ReactNode; loading?: boolean; error?: boolean; action?: () => void }) {
  return <div className={`teacher-record-message${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>
    {loading ? <LoaderCircle className="is-spinning" size={22} aria-hidden="true" /> : <ClipboardList size={24} aria-hidden="true" />}
    <p>{children}</p>
    {action && <button className="teacher-button ghost" type="button" onClick={action}>重试</button>}
  </div>;
}
