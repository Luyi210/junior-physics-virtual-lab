import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BarChart3, BookOpenCheck, Command, FlaskConical, Radio, Search, Users, X, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TeacherWorkspace, teacherExperimentCatalog } from "./teacherWorkspace";

type CommandItem = {
  id: string;
  group: "快捷操作" | "班级" | "课例" | "报告";
  title: string;
  meta: string;
  path: string;
  icon: typeof Search;
};

export function TeacherCommandCenter({ workspace }: { workspace: TeacherWorkspace }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 60);
    else setQuery("");
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const commands: CommandItem[] = [
      { id: "new-lesson", group: "快捷操作", title: "创建实验课例", meta: "从实验目录开始结构化备课", path: "/teacher/lessons", icon: FlaskConical },
      { id: "live", group: "快捷操作", title: workspace.liveSession ? "返回正在进行的课堂" : "进入课堂控制台", meta: workspace.liveSession ? "课堂信号正在接收" : "选择待课课例并启动", path: "/teacher/live", icon: Radio },
      { id: "reports", group: "快捷操作", title: "查看课堂证据", meta: `${workspace.reports.length} 份报告`, path: "/teacher/reports", icon: BarChart3 },
      ...workspace.classes.map((item) => ({ id: item.id, group: "班级" as const, title: item.name, meta: `${item.grade} · ${item.studentCount} 人 · ${item.joinCode}`, path: "/teacher/classes", icon: Users })),
      ...workspace.lessons.map((item) => ({ id: item.id, group: "课例" as const, title: item.title, meta: `${teacherExperimentCatalog.find((entry) => entry.id === item.experimentId)?.field ?? "物理"} · ${item.scheduledAt}`, path: "/teacher/lessons", icon: BookOpenCheck })),
      ...workspace.reports.map((item) => ({ id: item.id, group: "报告" as const, title: item.lessonTitle, meta: `${item.className} · ${item.createdAt}`, path: "/teacher/reports", icon: BarChart3 }))
    ];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((item) => `${item.title} ${item.meta} ${item.group}`.toLowerCase().includes(normalized));
  }, [query, workspace]);

  const groups = ["快捷操作", "班级", "课例", "报告"] as const;

  function select(item: CommandItem) {
    navigate(item.path);
    setOpen(false);
  }

  return (
    <>
      <button className="teacher-command-trigger" type="button" onClick={() => setOpen(true)} aria-label="打开教师端快捷中心">
        <Search size={15} /><span>搜索与快捷操作</span><kbd><Command size={11} />K</kbd>
      </button>
      {open && (
        <div className="teacher-command-overlay" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setOpen(false)}>
          <section className="teacher-command-dialog" role="dialog" aria-modal="true" aria-label="教师端快捷中心">
            <header><div><Zap size={17} /><span><small>COMMAND OBSERVATORY</small><b>教学快捷中心</b></span></div><button type="button" onClick={() => setOpen(false)} aria-label="关闭快捷中心"><X size={18} /></button></header>
            <label className="teacher-command-search"><Search size={18} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索班级、课例、报告或操作…" /><kbd>ESC</kbd></label>
            <div className="teacher-command-results">
              {groups.map((group) => {
                const entries = items.filter((item) => item.group === group);
                if (!entries.length) return null;
                return <section key={group}><h3>{group}</h3>{entries.slice(0, group === "快捷操作" ? 4 : 5).map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => select(item)}><i><Icon size={16} /></i><span><b>{item.title}</b><small>{item.meta}</small></span><ArrowRight size={15} /></button>; })}</section>;
              })}
              {!items.length && <div className="teacher-command-empty"><Search size={24} /><b>没有找到相关内容</b><p>可以尝试搜索“八年级”“光学”或“报告”。</p></div>}
            </div>
            <footer><span>点击结果打开</span><span>ESC 关闭</span><em>仅搜索当前本地工作区</em></footer>
          </section>
        </div>
      )}
    </>
  );
}
