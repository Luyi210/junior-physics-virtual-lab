import { FormEvent, useMemo, useState } from "react";
import type { PlatformUser, TeachingClass } from "@physics-lab/contracts";
import { ArrowRight, Check, Copy, LoaderCircle, Plus, Search, UserPlus, Users, X } from "lucide-react";
import { teacherApi, TeacherApiError } from "../../services/teacherApi";
import { Link } from "react-router-dom";

const accents = ["#78ddff", "#8ca7ff", "#55e5c1", "#ffd36a"];

export function TeacherRealClasses({ classes, students, onRefresh }: {
  classes: TeachingClass[];
  students: PlatformUser[];
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = classes.find((item) => item.id === selectedId) ?? null;
  const members = selected ? students.filter((student) => student.classIds.includes(selected.id)) : [];
  const visible = useMemo(() => classes.filter((item) => `${item.name} ${item.grade} ${item.joinCode}`.toLowerCase().includes(query.trim().toLowerCase())), [classes, query]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const created = await teacherApi.createClass({ name: String(data.get("name")), grade: String(data.get("grade")) });
      await onRefresh();
      setSelectedId(created.id);
      setShowCreate(false);
      setMessage(`${created.name} 已创建，课堂入口码为 ${created.joinCode}`);
    } catch (error) {
      setMessage(error instanceof TeacherApiError ? error.message : "班级创建失败");
    } finally { setBusy(false); }
  }

  async function copyCode(code: string) {
    await navigator.clipboard?.writeText(code);
    setMessage(`入口码 ${code} 已复制`);
  }

  return <div className="teacher-view teacher-real-classes">
    <section className="teacher-view-toolbar"><div><span>REAL CLASS NETWORK</span><h2>真实教学班级</h2><p>班级、入口码和成员人数均来自学校数据库；学生归属可在“账号与成员”中调整。</p></div><button className="teacher-button primary" type="button" onClick={() => setShowCreate(true)}><Plus size={16} />创建教学班</button></section>
    <section className="teacher-real-class-summary"><div><Users size={18} /><span><small>CLASS COUNT</small><b>{classes.length} 个教学班</b></span></div><div><UserPlus size={18} /><span><small>BOUND STUDENTS</small><b>{students.filter((student) => student.classIds.length).length} 名已分班</b></span></div><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索班级、年级或入口码" /></label></section>
    {message && <p className="teacher-real-feedback"><Check size={14} />{message}</p>}
    <section className="teacher-real-class-grid">{visible.map((item, index) => {
      const classMembers = students.filter((student) => student.classIds.includes(item.id));
      return <article key={item.id} style={{ "--class-accent": accents[index % accents.length] } as React.CSSProperties}>
        <header><span>CLASS NODE / {String(index + 1).padStart(2, "0")}</span><i><Users size={20} /></i></header>
        <h3>{item.name}</h3><p>{item.grade} · {classMembers.length} 名真实成员</p>
        <div className="teacher-real-code"><span>课堂入口码</span><b>{item.joinCode}</b><button type="button" onClick={() => void copyCode(item.joinCode)}><Copy size={13} />复制</button></div>
        <div className="teacher-real-member-preview">{classMembers.slice(0, 5).map((student) => <i key={student.id} title={student.name}>{student.name.slice(-1)}</i>)}{classMembers.length > 5 && <em>+{classMembers.length - 5}</em>}{!classMembers.length && <small>还没有学生加入</small>}</div>
        <footer><button type="button" onClick={() => setSelectedId(item.id)}>查看真实成员 <ArrowRight size={14} /></button><Link to="/teacher/lessons">发布实验任务</Link></footer>
      </article>;
    })}</section>

    {selected && <div className="teacher-detail-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedId(null)}><aside className="teacher-real-class-detail" role="dialog" aria-modal="true"><header><div><span>CLASS MEMBER SIGNAL</span><h2>{selected.name}</h2><p>{selected.grade} · {members.length} 名学生</p></div><button type="button" onClick={() => setSelectedId(null)}><X size={18} /></button></header><section><div className="teacher-real-detail-code"><span>CLASS ACCESS</span><b>{selected.joinCode}</b><button type="button" onClick={() => void copyCode(selected.joinCode)}><Copy size={13} />复制入口码</button></div><div className="teacher-real-member-list">{members.map((student, index) => <article key={student.id}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{student.name}</b><small>{student.email}</small></span><em className={`is-${student.status}`}>{student.status === "active" ? "正常" : "停用"}</em></article>)}{!members.length && <p>这个班级还没有学生。请前往“账号与成员”为学生分班。</p>}</div></section><footer><Link className="teacher-button primary" to="/teacher/accounts"><UserPlus size={15} />管理班级成员</Link></footer></aside></div>}

    {showCreate && <div className="teacher-backend-login-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setShowCreate(false)}><form className="teacher-backend-login" onSubmit={create}><header><div><span>CREATE CLASS NODE</span><h2>创建真实教学班</h2><p>班级将写入学校数据库，并自动生成唯一入口码。</p></div><button type="button" onClick={() => setShowCreate(false)}><X size={18} /></button></header><label><span>班级名称</span><input name="name" placeholder="例如：八年级（2）班" required /></label><label><span>所属年级</span><select name="grade" defaultValue="八年级"><option>七年级</option><option>八年级</option><option>九年级</option></select></label>{message && <p className="teacher-backend-error">{message}</p>}<button className="teacher-button primary wide" type="submit" disabled={busy}>{busy ? <LoaderCircle size={15} className="is-spinning" /> : <Plus size={15} />}{busy ? "正在创建" : "创建并生成入口码"}</button></form></div>}
  </div>;
}
