import { TeacherClass, createTeacherClass } from "../teacherWorkspace";
import { useState, FormEvent } from "react";
import { Plus, Check, Search, Filter, Users, ArrowRight, X, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function TeacherClasses({ classes, onAdd }: { classes: TeacherClass[]; onAdd: (item: TeacherClass) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("全部年级");
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const visibleClasses = classes.filter((item) => (grade === "全部年级" || item.grade === grade) && `${item.name} ${item.joinCode}`.toLowerCase().includes(query.trim().toLowerCase()));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const grade = String(data.get("grade") ?? "八年级");
    const studentCount = Number(data.get("studentCount") ?? 0);
    if (!name || !studentCount) return;
    const classItem = createTeacherClass({ name, grade, studentCount });
    onAdd(classItem);
    setNotice(`${classItem.name} 已创建，入口码为 ${classItem.joinCode}`);
    setShowForm(false);
    event.currentTarget.reset();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`已复制班级入口码 ${code}`);
    } catch {
      setNotice(`班级入口码：${code}`);
    }
  }

  return (
    <div className="teacher-view teacher-classes-view">
      <section className="teacher-view-toolbar">
        <div><span>CLASS MATRIX / {classes.length.toString().padStart(2, "0")}</span><h2>教学班坐标</h2><p>入口码用于演示班级边界；真实学生加入能力需账号后端接入。</p></div>
        <button className="teacher-button primary" type="button" onClick={() => setShowForm((value) => !value)}><Plus size={17} />新建班级</button>
      </section>

      {notice && <div className="teacher-notice"><Check size={15} />{notice}<button type="button" onClick={() => setNotice("")}>关闭</button></div>}

      {showForm && (
        <form className="teacher-create-form" onSubmit={submit}>
          <header><div><span>NEW COORDINATE</span><h3>建立一个教学班</h3></div><button type="button" onClick={() => setShowForm(false)}>取消</button></header>
          <label><span>班级名称</span><input name="name" placeholder="例如：八年级（3）班" required /></label>
          <label><span>年级</span><select name="grade" defaultValue="八年级"><option>七年级</option><option>八年级</option><option>九年级</option></select></label>
          <label><span>学生人数</span><input name="studentCount" type="number" min="1" max="80" defaultValue="40" required /></label>
          <button className="teacher-button primary" type="submit"><Check size={16} />创建并生成入口码</button>
        </form>
      )}

      <section className="teacher-data-toolbar" aria-label="班级筛选">
        <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索班级名称或入口码" /></label>
        <label><Filter size={14} /><select value={grade} onChange={(event) => setGrade(event.target.value)}><option>全部年级</option><option>七年级</option><option>八年级</option><option>九年级</option></select></label>
        <span>显示 {visibleClasses.length} / {classes.length} 个班级</span>
      </section>

      <section className="teacher-class-grid">
        {visibleClasses.map((item, index) => (
          <article key={item.id} style={{ "--class-accent": item.color } as React.CSSProperties}>
            <header><span>CLASS / {String(index + 1).padStart(2, "0")}</span><i><Users size={20} /></i></header>
            <h3>{item.name}</h3><p>{item.grade} · {item.studentCount} 名学生</p>
            <div className="teacher-code-block"><span>课堂入口码</span><strong>{item.joinCode}</strong><button type="button" onClick={() => void copyCode(item.joinCode)}>复制</button></div>
            <dl><div><dt>本周课例</dt><dd>{index + 1} 节</dd></div><div><dt>实验准备度</dt><dd>{[88, 76, 93, 81][index % 4]}%</dd></div></dl>
            <div className="teacher-class-actions"><button type="button" onClick={() => setSelectedClass(item)}>查看班级详情</button><Link to="/teacher/lessons">为此班备课 <ArrowRight size={15} /></Link></div>
          </article>
        ))}
        {!visibleClasses.length && <div className="teacher-filter-empty"><Search size={25} /><b>没有匹配的教学班</b><p>调整关键词或年级筛选后再试。</p></div>}
      </section>

      {selectedClass && <div className="teacher-detail-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setSelectedClass(null)}>
        <aside className="teacher-class-detail" role="dialog" aria-modal="true" aria-label={`${selectedClass.name}详情`} style={{ "--class-accent": selectedClass.color } as React.CSSProperties}>
          <header><div><span>CLASS DETAIL / LOCAL DEMO</span><h2>{selectedClass.name}</h2><p>{selectedClass.grade} · {selectedClass.studentCount} 名学生</p></div><button type="button" onClick={() => setSelectedClass(null)} aria-label="关闭班级详情"><X size={18} /></button></header>
          <section className="teacher-class-detail-kpis"><div><strong>{[88, 76, 93, 81][classes.indexOf(selectedClass) % 4]}%</strong><span>实验准备度</span></div><div><strong>{classes.indexOf(selectedClass) + 1}</strong><span>本周课例</span></div><div><strong>{selectedClass.studentCount - 1}</strong><span>最近在线</span></div></section>
          <section className="teacher-class-detail-code"><span>CLASS ACCESS COORDINATE</span><b>{selectedClass.joinCode}</b><button type="button" onClick={() => void copyCode(selectedClass.joinCode)}>复制入口码</button><p>入口码目前只用于本地演示，不代表真实账号已经加入。</p></section>
          <section className="teacher-class-detail-groups"><header><span>LEARNING GROUPS</span><b>实验小组建议</b></header><div>{["A 组 · 变量控制", "B 组 · 现象记录", "C 组 · 证据比较", "D 组 · 解释表达"].map((item, index) => <article key={item}><i>{index + 1}</i><span><b>{item}</b><small>{Math.floor(selectedClass.studentCount / 4) + (index < selectedClass.studentCount % 4 ? 1 : 0)} 人</small></span></article>)}</div></section>
          <footer><Link className="teacher-button primary" to="/teacher/lessons" onClick={() => setSelectedClass(null)}><BookOpen size={16} />为这个班编排实验课</Link><button className="teacher-button ghost" type="button" onClick={() => setSelectedClass(null)}>关闭详情</button></footer>
        </aside>
      </div>}
    </div>
  );
}
