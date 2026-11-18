import { FormEvent, useMemo, useRef, useState } from "react";
import { useTeacherSessionGuard } from "./useTeacherSessionGuard";
import type { PlatformUser, TeachingClass } from "@physics-lab/contracts";
import { Check, ChevronRight, CircleOff, GraduationCap, KeyRound, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, UserCog, UserRoundCheck, Users, X } from "lucide-react";
import { TeacherApiError, teacherApi } from "../../data/teacherApi";

function timeText(value: string | null) {
  if (!value) return "尚未登录";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

type CreatedAccountRecovery = {
  account: PlatformUser;
  classId: string;
  className: string;
  membershipPending: boolean;
};

export function TeacherAccountCenter({ currentUser, students, teachers, classes, onRefresh }: {
  currentUser: PlatformUser;
  students: PlatformUser[];
  teachers: PlatformUser[];
  classes: TeachingClass[];
  onRefresh: () => Promise<void>;
}) {
  const guard = useTeacherSessionGuard();
  const isAdmin = currentUser.role === "admin";
  const accounts = useMemo(() => isAdmin ? [...teachers, ...students] : students, [isAdmin, students, teachers]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "teacher" | "student">("all");
  const [classId, setClassId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createRole, setCreateRole] = useState<"teacher" | "student">("student");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [createdRecovery, setCreatedRecovery] = useState<CreatedAccountRecovery | null>(null);
  const recoveryRef = useRef<CreatedAccountRecovery | null>(null);
  const creationBusy = useRef(false);
  const creationSubmitted = useRef(false);

  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const visibleAccounts = useMemo(() => accounts.filter((account) => {
    const matchesQuery = !query.trim() || `${account.name} ${account.email} ${account.classNames.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || account.status === status;
    const matchesClass = classId === "all" || account.classIds.includes(classId);
    const matchesRole = roleFilter === "all" || account.role === roleFilter;
    return matchesQuery && matchesStatus && matchesClass && matchesRole;
  }), [accounts, classId, query, roleFilter, status]);

  const activeCount = accounts.filter((account) => account.status === "active").length;
  const loggedInCount = accounts.filter((account) => account.lastLoginAt).length;
  const unassignedCount = students.filter((student) => !student.classIds.length).length;

  async function perform(key: string, action: () => Promise<unknown>, success: string) {
    if (!guard() || creationBusy.current) return;
    setBusy(key);
    setMessage("");
    try {
      await action();
      if (!guard()) return;
      await onRefresh();
      if (!guard()) return;
      setMessage(success);
    } catch (error) {
      if (!guard()) return;
      setMessage(error instanceof TeacherApiError ? error.message : "后台操作失败，请稍后重试");
    } finally {
      if (guard()) setBusy("");
    }
  }

  // Account creation and class membership are separate server operations. Keep
  // the confirmed account even when the second operation has an unknown result.
  async function finishCreatedAccount(initial: CreatedAccountRecovery, form?: HTMLFormElement) {
    let outcome = initial;
    const current = () => guard() && recoveryRef.current === outcome;
    let membershipError = "";
    let refreshError = "";
    try {
      if (!current()) return;
      if (outcome.membershipPending) {
        try {
          await teacherApi.addClassMember(outcome.classId, outcome.account.email);
          if (!current()) return;
          outcome = { ...outcome, membershipPending: false };
          recoveryRef.current = outcome;
          setCreatedRecovery(outcome);
        } catch (error) {
          if (!current()) return;
          membershipError = error instanceof TeacherApiError ? error.message : "加入班级失败，请重试确认分班结果";
        }
      }
      if (!current()) return;
      setShowCreate(false);
      form?.reset();
      // A failed membership request must not hide the already-created account.
      try {
        await onRefresh();
        if (!current()) return;
      } catch {
        if (!current()) return;
        refreshError = "账号列表刷新失败";
      }
      if (!current()) return;
      if (!outcome.membershipPending && !refreshError) {
        recoveryRef.current = null;
        setCreatedRecovery(null);
        setSelectedId(outcome.account.id);
        setMessage(`${outcome.account.role === "teacher" ? "教师" : "学生"}账号已创建并写入后台`);
      } else {
        setMessage(`账号已创建。${[membershipError, refreshError].filter(Boolean).join("；")}。请使用下方恢复操作，无需重新创建账号。`);
      }
    } finally {
      if (guard()) { creationBusy.current = false; setBusy(""); }
    }
  }

  async function retryCreatedAccount(outcome: CreatedAccountRecovery) {
    if (!guard() || creationBusy.current || recoveryRef.current !== outcome) return;
    creationBusy.current = true;
    setBusy("create-recovery");
    setMessage("");
    await finishCreatedAccount(outcome);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guard() || creationBusy.current || creationSubmitted.current || recoveryRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedClassId = createRole === "student" ? String(data.get("classId") ?? "") : "";
    creationBusy.current = true;
    creationSubmitted.current = true;
    setBusy("create");
    setMessage("");
    try {
      const created = await teacherApi.createAccount({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")), role: createRole });
      if (!guard()) return;
      const outcome = { account: created, classId: selectedClassId, className: classes.find((item) => item.id === selectedClassId)?.name ?? selectedClassId, membershipPending: Boolean(selectedClassId) };
      recoveryRef.current = outcome;
      setCreatedRecovery(outcome);
      await finishCreatedAccount(outcome, form);
    } catch (error) {
      if (!guard()) return;
      creationSubmitted.current = false;
      creationBusy.current = false;
      setBusy("");
      setMessage(error instanceof TeacherApiError ? error.message : "创建账号失败，请稍后重试");
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guard() || !selected) return;
    const password = String(new FormData(event.currentTarget).get("password"));
    await perform(`password-${selected.id}`, () => teacherApi.resetAccountPassword(selected.id, password), `${selected.name} 的临时密码已更新`);
  }

  async function toggleMembership(targetClass: TeachingClass) {
    if (!guard() || !selected) return;
    const joined = selected.classIds.includes(targetClass.id);
    await perform(`class-${targetClass.id}`, () => joined ? teacherApi.removeClassMember(targetClass.id, selected.id) : teacherApi.addClassMember(targetClass.id, selected.email), joined ? `已将 ${selected.name} 移出 ${targetClass.name}` : `已将 ${selected.name} 加入 ${targetClass.name}`);
  }

  if (!guard()) return <p role="status">教师登录状态已变化，请重新打开账号页面。</p>;

  return (
    <div className="teacher-view teacher-account-view">
      <section className="teacher-view-toolbar teacher-account-heading">
        <div><span>{isAdmin ? "PLATFORM IDENTITY CONTROL" : "IDENTITY & CLASS NETWORK"}</span><h2>{isAdmin ? "平台账号与权限管理" : "学校账号与班级成员"}</h2><p>{isAdmin ? "管理员统一创建教师和学生身份；账号停用后，已有登录令牌也会立即失效。" : "账号、登录状态与班级归属均来自真实后台；停用账号后，已有令牌也会立即失效。"}</p></div>
        <button className="teacher-button primary" type="button" disabled={Boolean(busy) || Boolean(createdRecovery)} onClick={() => { if (!guard() || creationBusy.current || recoveryRef.current) return; creationSubmitted.current = false; setCreateRole("student"); setShowCreate(true); }}><Plus size={16} />{isAdmin ? "创建教师或学生" : "创建学生账号"}</button>
      </section>

      <section className="teacher-account-kpis">
        <article><i><Users size={18} /></i><span><small>{isAdmin ? "MANAGED IDENTITIES" : "STUDENT IDENTITIES"}</small><b>{accounts.length}<em>个{isAdmin ? "受管" : "学生"}账号</em></b></span></article>
        <article><i>{isAdmin ? <GraduationCap size={18} /> : <ShieldCheck size={18} />}</i><span><small>{isAdmin ? "TEACHER IDENTITIES" : "ACTIVE ACCESS"}</small><b>{isAdmin ? teachers.length : activeCount}<em>{isAdmin ? "个教师账号" : "个账号可登录"}</em></b></span></article>
        <article><i><UserRoundCheck size={18} /></i><span><small>LOGIN FOOTPRINT</small><b>{loggedInCount}<em>人已有登录记录</em></b></span></article>
        <article className={unassignedCount ? "has-warning" : ""}><i><CircleOff size={18} /></i><span><small>CLASS BINDING</small><b>{unassignedCount}<em>人尚未分班</em></b></span></article>
      </section>

      <section className="teacher-account-console">
        <header className="teacher-account-toolbar">
          <label><Search size={15} /><input value={query} onChange={(event) => guard() && setQuery(event.target.value)} placeholder="搜索姓名、账号或班级" /></label>
          {isAdmin && <select value={roleFilter} onChange={(event) => guard() && setRoleFilter(event.target.value as typeof roleFilter)} aria-label="按身份筛选"><option value="all">全部身份</option><option value="teacher">教师</option><option value="student">学生</option></select>}
          <select value={classId} onChange={(event) => guard() && setClassId(event.target.value)} aria-label="按班级筛选"><option value="all">全部班级</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={status} onChange={(event) => guard() && setStatus(event.target.value as typeof status)} aria-label="按状态筛选"><option value="all">全部状态</option><option value="active">正常</option><option value="disabled">已停用</option></select>
          <button type="button" onClick={() => void perform("refresh", async () => {}, "账号列表已刷新")}><RefreshCw size={14} />刷新</button>
          <span>{visibleAccounts.length} / {accounts.length}</span>
        </header>

        {message && <div className="teacher-account-message"><Check size={14} />{message}</div>}
        {createdRecovery && !showCreate && <section className="teacher-account-detail-section" aria-label="已创建账号的后续操作">
          <h3>账号已创建：{createdRecovery.account.name}</h3>
          <p>{createdRecovery.account.email} · {createdRecovery.membershipPending ? `加入“${createdRecovery.className}”的结果尚未确认。重试只处理分班，不会重新创建账号。` : `${createdRecovery.classId ? "分班操作已完成，" : "本次未选择班级，"}账号列表尚未刷新成功。`}</p>
          <button className="teacher-button primary" type="button" disabled={Boolean(busy)} onClick={() => void retryCreatedAccount(createdRecovery)}>{busy === "create-recovery" ? "正在处理" : createdRecovery.membershipPending ? "重试加入班级" : "重试刷新账号列表"}</button>
          <button className="teacher-button" type="button" disabled={Boolean(busy)} onClick={() => { if (!guard() || creationBusy.current || recoveryRef.current !== createdRecovery) return; recoveryRef.current = null; setCreatedRecovery(null); setMessage(`账号 ${createdRecovery.account.email} 已保留。${createdRecovery.membershipPending ? "请稍后在账号管理中核对班级归属。" : "请稍后刷新账号列表。"}`); }}>稍后在账号管理中处理</button>
        </section>}

        <div className="teacher-account-table" role="table" aria-label={isAdmin ? "教师与学生账号列表" : "学生账号列表"}>
          <div className="teacher-account-row is-header" role="row"><span>账号身份</span><span>登录账号</span><span>班级／权限</span><span>最近登录</span><span>状态</span><span>操作</span></div>
          {visibleAccounts.map((account, index) => <div className="teacher-account-row" role="row" key={account.id}>
            <span className="teacher-account-identity"><i>{account.role === "teacher" ? <UserCog size={13} /> : String(index + 1).padStart(2, "0")}</i><b>{account.name}<small>{account.role === "teacher" ? "教师账号" : "学生账号"} · ID {account.id.slice(-8).toUpperCase()}</small></b></span>
            <span className="teacher-account-email">{account.email}</span>
            <span className="teacher-account-classes">{account.role === "teacher" ? <em className="is-teacher">教学与班级管理</em> : account.classNames.length ? account.classNames.map((name) => <em key={name}>{name}</em>) : <em className="is-empty">未分班</em>}</span>
            <span>{timeText(account.lastLoginAt)}</span>
            <span><strong className={`teacher-account-status is-${account.status}`}><i />{account.status === "active" ? "正常" : "已停用"}</strong></span>
            <span><button className="teacher-account-detail-button" type="button" onClick={() => guard() && setSelectedId(account.id)}>管理 <ChevronRight size={14} /></button></span>
          </div>)}
          {!visibleAccounts.length && <div className="teacher-account-empty"><Search size={24} /><b>没有匹配的账号</b><p>调整筛选条件，或创建新的教师或学生账号。</p></div>}
        </div>
      </section>

      {selected && <div className="teacher-detail-overlay" role="presentation" onMouseDown={(event) => guard() && event.currentTarget === event.target && setSelectedId(null)}>
        <aside className="teacher-account-detail" role="dialog" aria-modal="true" aria-label={`${selected.name}账号管理`}>
          <header><div><span>IDENTITY CONTROL</span><h2>{selected.name}</h2><p>{selected.email}</p></div><button type="button" onClick={() => guard() && setSelectedId(null)} aria-label="关闭"><X size={18} /></button></header>
          <section className="teacher-account-detail-state">
            <div><small>{selected.role === "teacher" ? "教师账号状态" : "学生账号状态"}</small><b className={`is-${selected.status}`}><i />{selected.status === "active" ? "允许登录" : "已停止登录"}</b></div>
            <button type="button" disabled={Boolean(busy)} onClick={() => void perform(`status-${selected.id}`, () => teacherApi.updateAccountStatus(selected.id, selected.status === "active" ? "disabled" : "active"), selected.status === "active" ? `${selected.name} 的账号已停用` : `${selected.name} 的账号已恢复`)}>{busy === `status-${selected.id}` ? <LoaderCircle size={14} className="is-spinning" /> : selected.status === "active" ? <CircleOff size={14} /> : <ShieldCheck size={14} />}{selected.status === "active" ? "停用账号" : "恢复账号"}</button>
          </section>
          {selected.role === "student" ? <section className="teacher-account-detail-section"><header><span>CLASS MEMBERSHIP</span><b>班级归属</b></header><div className="teacher-membership-list">{classes.map((item) => {
            const joined = selected.classIds.includes(item.id);
            return <button className={joined ? "is-joined" : ""} type="button" key={item.id} disabled={Boolean(busy)} onClick={() => void toggleMembership(item)}><i>{joined ? <Check size={13} /> : <Plus size={13} />}</i><span><b>{item.name}</b><small>{item.grade} · {item.studentCount} 人</small></span><em>{busy === `class-${item.id}` ? "处理中" : joined ? "已加入" : "加入班级"}</em></button>;
          })}</div></section> : <section className="teacher-account-detail-section teacher-account-role-scope"><header><span>TEACHING PERMISSIONS</span><b>教师权限范围</b></header><div><GraduationCap size={21} /><span><b>实验教学管理权限</b><p>可以管理学生、班级、课例和教学任务；不能创建、停用或重置其他教师账号。</p></span></div></section>}
          <section className="teacher-account-detail-section"><header><span>CREDENTIAL RESET</span><b>重置临时密码</b></header><form className="teacher-password-reset" onSubmit={resetPassword}><label><KeyRound size={14} /><input name="password" type="text" key={selected.id} defaultValue={selected.role === "teacher" ? "Teacher123!" : "Student123!"} minLength={8} required /></label><button type="submit" disabled={Boolean(busy)}>{busy === `password-${selected.id}` ? <LoaderCircle size={14} className="is-spinning" /> : <KeyRound size={14} />}确认重置</button></form><p>密码会以 scrypt 散列写入数据库；这里只显示本次输入的临时密码。</p></section>
          <footer><span>创建于 {timeText(selected.createdAt)}</span><span>最近登录 {timeText(selected.lastLoginAt)}</span></footer>
        </aside>
      </div>}

      {showCreate && <div className="teacher-backend-login-overlay" role="presentation" onMouseDown={(event) => guard() && event.currentTarget === event.target && setShowCreate(false)}>
        <form className="teacher-backend-login teacher-create-student" onSubmit={createAccount}>
          <header><div><span>{createRole === "teacher" ? "NEW TEACHER IDENTITY" : "NEW STUDENT IDENTITY"}</span><h2>创建{createRole === "teacher" ? "教师" : "学生"}账号</h2><p>{createRole === "teacher" ? "教师创建后可进入教学后台，管理学生、班级、课例和任务。" : "学生创建后可立即登录，也可以同时加入一个教学班。"}</p></div><button type="button" onClick={() => guard() && setShowCreate(false)} aria-label="关闭"><X size={18} /></button></header>
          {isAdmin && <label><span>账号身份</span><select value={createRole} onChange={(event) => guard() && setCreateRole(event.target.value as typeof createRole)}><option value="student">学生账号</option><option value="teacher">教师账号</option></select></label>}
          <label><span>{createRole === "teacher" ? "教师姓名" : "学生姓名"}</span><input name="name" required maxLength={80} placeholder={createRole === "teacher" ? "例如：王老师" : "例如：张小宇"} /></label>
          <label><span>登录邮箱</span><input name="email" type="email" required maxLength={180} placeholder={createRole === "teacher" ? "teacher02@physics.local" : "student11@physics.local"} /></label>
          <label><span>临时密码</span><input name="password" type="text" key={createRole} defaultValue={createRole === "teacher" ? "Teacher123!" : "Student123!"} required minLength={8} /></label>
          {createRole === "student" && <label><span>加入班级</span><select name="classId" defaultValue={classes[0]?.id ?? ""}><option value="">暂不分班</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {message && <p className="teacher-backend-error">{message}</p>}
          <button className="teacher-button primary wide" type="submit" disabled={busy === "create"}>{busy === "create" ? <LoaderCircle size={15} className="is-spinning" /> : <Plus size={15} />}{busy === "create" ? "正在创建" : `创建${createRole === "teacher" ? "教师" : "学生"}账号`}</button>
        </form>
      </div>}
    </div>
  );
}
