import { FormEvent, useMemo, useState } from "react";
import type { PlatformUser, TeachingClass } from "@physics-lab/contracts";
import { Check, ChevronRight, CircleOff, GraduationCap, KeyRound, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, UserCog, UserRoundCheck, Users, X } from "lucide-react";
import { TeacherApiError, teacherApi } from "../../services/teacherApi";

function timeText(value: string | null) {
  if (!value) return "尚未登录";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function TeacherAccountCenter({ currentUser, students, teachers, classes, onRefresh }: {
  currentUser: PlatformUser;
  students: PlatformUser[];
  teachers: PlatformUser[];
  classes: TeachingClass[];
  onRefresh: () => Promise<void>;
}) {
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
    setBusy(key);
    setMessage("");
    try {
      await action();
      await onRefresh();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof TeacherApiError ? error.message : "后台操作失败，请稍后重试");
    } finally {
      setBusy("");
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const selectedClassId = String(data.get("classId"));
    await perform("create", async () => {
      const created = await teacherApi.createAccount({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")), role: createRole });
      if (createRole === "student" && selectedClassId) await teacherApi.addClassMember(selectedClassId, created.email);
      setShowCreate(false);
      setSelectedId(created.id);
      form.reset();
    }, `${createRole === "teacher" ? "教师" : "学生"}账号已创建并写入后台`);
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const password = String(new FormData(event.currentTarget).get("password"));
    await perform(`password-${selected.id}`, () => teacherApi.resetAccountPassword(selected.id, password), `${selected.name} 的临时密码已更新`);
  }

  async function toggleMembership(targetClass: TeachingClass) {
    if (!selected) return;
    const joined = selected.classIds.includes(targetClass.id);
    await perform(`class-${targetClass.id}`, () => joined ? teacherApi.removeClassMember(targetClass.id, selected.id) : teacherApi.addClassMember(targetClass.id, selected.email), joined ? `已将 ${selected.name} 移出 ${targetClass.name}` : `已将 ${selected.name} 加入 ${targetClass.name}`);
  }

  return (
    <div className="teacher-view teacher-account-view">
      <section className="teacher-view-toolbar teacher-account-heading">
        <div><span>{isAdmin ? "PLATFORM IDENTITY CONTROL" : "IDENTITY & CLASS NETWORK"}</span><h2>{isAdmin ? "平台账号与权限管理" : "学校账号与班级成员"}</h2><p>{isAdmin ? "管理员统一创建教师和学生身份；账号停用后，已有登录令牌也会立即失效。" : "账号、登录状态与班级归属均来自真实后台；停用账号后，已有令牌也会立即失效。"}</p></div>
        <button className="teacher-button primary" type="button" onClick={() => { setCreateRole("student"); setShowCreate(true); }}><Plus size={16} />{isAdmin ? "创建教师或学生" : "创建学生账号"}</button>
      </section>

      <section className="teacher-account-kpis">
        <article><i><Users size={18} /></i><span><small>{isAdmin ? "MANAGED IDENTITIES" : "STUDENT IDENTITIES"}</small><b>{accounts.length}<em>个{isAdmin ? "受管" : "学生"}账号</em></b></span></article>
        <article><i>{isAdmin ? <GraduationCap size={18} /> : <ShieldCheck size={18} />}</i><span><small>{isAdmin ? "TEACHER IDENTITIES" : "ACTIVE ACCESS"}</small><b>{isAdmin ? teachers.length : activeCount}<em>{isAdmin ? "个教师账号" : "个账号可登录"}</em></b></span></article>
        <article><i><UserRoundCheck size={18} /></i><span><small>LOGIN FOOTPRINT</small><b>{loggedInCount}<em>人已有登录记录</em></b></span></article>
        <article className={unassignedCount ? "has-warning" : ""}><i><CircleOff size={18} /></i><span><small>CLASS BINDING</small><b>{unassignedCount}<em>人尚未分班</em></b></span></article>
      </section>

      <section className="teacher-account-console">
        <header className="teacher-account-toolbar">
          <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、账号或班级" /></label>
          {isAdmin && <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} aria-label="按身份筛选"><option value="all">全部身份</option><option value="teacher">教师</option><option value="student">学生</option></select>}
          <select value={classId} onChange={(event) => setClassId(event.target.value)} aria-label="按班级筛选"><option value="all">全部班级</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="按状态筛选"><option value="all">全部状态</option><option value="active">正常</option><option value="disabled">已停用</option></select>
          <button type="button" onClick={() => void onRefresh()}><RefreshCw size={14} />刷新</button>
          <span>{visibleAccounts.length} / {accounts.length}</span>
        </header>

        {message && <div className="teacher-account-message"><Check size={14} />{message}</div>}

        <div className="teacher-account-table" role="table" aria-label={isAdmin ? "教师与学生账号列表" : "学生账号列表"}>
          <div className="teacher-account-row is-header" role="row"><span>账号身份</span><span>登录账号</span><span>班级／权限</span><span>最近登录</span><span>状态</span><span>操作</span></div>
          {visibleAccounts.map((account, index) => <div className="teacher-account-row" role="row" key={account.id}>
            <span className="teacher-account-identity"><i>{account.role === "teacher" ? <UserCog size={13} /> : String(index + 1).padStart(2, "0")}</i><b>{account.name}<small>{account.role === "teacher" ? "教师账号" : "学生账号"} · ID {account.id.slice(-8).toUpperCase()}</small></b></span>
            <span className="teacher-account-email">{account.email}</span>
            <span className="teacher-account-classes">{account.role === "teacher" ? <em className="is-teacher">教学与班级管理</em> : account.classNames.length ? account.classNames.map((name) => <em key={name}>{name}</em>) : <em className="is-empty">未分班</em>}</span>
            <span>{timeText(account.lastLoginAt)}</span>
            <span><strong className={`teacher-account-status is-${account.status}`}><i />{account.status === "active" ? "正常" : "已停用"}</strong></span>
            <span><button className="teacher-account-detail-button" type="button" onClick={() => setSelectedId(account.id)}>管理 <ChevronRight size={14} /></button></span>
          </div>)}
          {!visibleAccounts.length && <div className="teacher-account-empty"><Search size={24} /><b>没有匹配的账号</b><p>调整筛选条件，或创建新的教师或学生账号。</p></div>}
        </div>
      </section>

      {selected && <div className="teacher-detail-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedId(null)}>
        <aside className="teacher-account-detail" role="dialog" aria-modal="true" aria-label={`${selected.name}账号管理`}>
          <header><div><span>IDENTITY CONTROL</span><h2>{selected.name}</h2><p>{selected.email}</p></div><button type="button" onClick={() => setSelectedId(null)} aria-label="关闭"><X size={18} /></button></header>
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

      {showCreate && <div className="teacher-backend-login-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setShowCreate(false)}>
        <form className="teacher-backend-login teacher-create-student" onSubmit={createAccount}>
          <header><div><span>{createRole === "teacher" ? "NEW TEACHER IDENTITY" : "NEW STUDENT IDENTITY"}</span><h2>创建{createRole === "teacher" ? "教师" : "学生"}账号</h2><p>{createRole === "teacher" ? "教师创建后可进入教学后台，管理学生、班级、课例和任务。" : "学生创建后可立即登录，也可以同时加入一个教学班。"}</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="关闭"><X size={18} /></button></header>
          {isAdmin && <label><span>账号身份</span><select value={createRole} onChange={(event) => setCreateRole(event.target.value as typeof createRole)}><option value="student">学生账号</option><option value="teacher">教师账号</option></select></label>}
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
