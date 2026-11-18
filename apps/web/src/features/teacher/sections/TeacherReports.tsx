import { TeacherReport } from "../teacherWorkspace";
import { useState } from "react";
import { Download, Search, Filter, ChevronRight, FileBarChart, Lightbulb } from "lucide-react";
import { EmptyState } from "../components/TeacherPrimitives";

export function TeacherReports({ reports }: { reports: TeacherReport[] }) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("全部班级");
  const classNames = [...new Set(reports.map((report) => report.className))];
  const visibleReports = reports.filter((report) => (classFilter === "全部班级" || report.className === classFilter) && `${report.lessonTitle} ${report.className}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = visibleReports.find((report) => report.id === selectedId) ?? visibleReports[0] ?? reports[0];
  const averageParticipation = Math.round(reports.reduce((sum, report) => sum + report.participationRate, 0) / Math.max(reports.length, 1));
  const averageProgress = Math.round(reports.reduce((sum, report) => sum + report.averageProgress, 0) / Math.max(reports.length, 1));

  function exportReport() {
    if (!selected) return;
    const rows = [
      ["课堂", selected.lessonTitle],
      ["班级", selected.className],
      ["生成时间", selected.createdAt],
      ["参与率", `${selected.participationRate}%`],
      ["平均进程", `${selected.averageProgress}%`],
      ["观察记录", String(selected.observationCount)],
      ["后续建议", selected.followUp]
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.className}-${selected.lessonTitle}-课堂报告.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!selected) return <div className="teacher-view"><EmptyState title="还没有课堂报告" text="结束一节课堂后，这里会汇总学习过程证据。" action="进入课堂控制台" to="/teacher/live" /></div>;

  return (
    <div className="teacher-view teacher-reports-view">
      <section className="teacher-view-toolbar"><div><span>EVIDENCE ARCHIVE / {reports.length.toString().padStart(2, "0")}</span><h2>课堂学习证据</h2><p>只呈现操作、记录和进程线索，避免把单一指标当作学生能力排名。</p></div><button className="teacher-button ghost" type="button" onClick={exportReport}><Download size={16} />导出当前报告</button></section>
      <section className="teacher-data-toolbar teacher-report-filter"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索课例或班级" /></label><label><Filter size={14} /><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>全部班级</option>{classNames.map((name) => <option key={name}>{name}</option>)}</select></label><span>显示 {visibleReports.length} / {reports.length} 份报告</span></section>
      <div className="teacher-report-layout">
        <aside className="teacher-report-index">
          <header><span>REPORT INDEX</span><b>报告档案</b></header>
          {visibleReports.map((report, index) => <button key={report.id} className={report.id === selected.id ? "active" : ""} type="button" onClick={() => setSelectedId(report.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><small>{report.createdAt} · {report.className}</small><b>{report.lessonTitle}</b></span><ChevronRight size={16} /></button>)}
          {!visibleReports.length && <div className="teacher-report-index-empty"><Search size={20} /><p>没有匹配的课堂报告</p></div>}
        </aside>
        <article className="teacher-report-sheet">
          <header><div><span>PHYSICS LEARNING EVIDENCE</span><h2>{selected.lessonTitle}</h2><p>{selected.className} · {selected.createdAt}</p></div><i><FileBarChart size={27} /></i></header>
          <section className="teacher-report-kpis">
            <div><strong>{selected.participationRate}<small>%</small></strong><span>实验参与率</span></div>
            <div><strong>{selected.averageProgress}<small>%</small></strong><span>平均探究进程</span></div>
            <div><strong>{selected.observationCount}</strong><span>观察记录条数</span></div>
          </section>
          <section className="teacher-report-diagnostic">
            <article><span>参与率对比</span><b className={selected.participationRate >= averageParticipation ? "positive" : "watch"}>{selected.participationRate >= averageParticipation ? "+" : ""}{selected.participationRate - averageParticipation}<small> pct</small></b><p>相对当前报告档案均值 {averageParticipation}%</p></article>
            <article><span>探究进程对比</span><b className={selected.averageProgress >= averageProgress ? "positive" : "watch"}>{selected.averageProgress >= averageProgress ? "+" : ""}{selected.averageProgress - averageProgress}<small> pct</small></b><p>相对当前报告档案均值 {averageProgress}%</p></article>
            <article><span>证据密度</span><b>{Math.round(selected.observationCount / Math.max(selected.averageProgress, 1) * 10) / 10}<small> 条/进程</small></b><p>用于观察记录充足度，不代表学习水平</p></article>
          </section>
          <section className="teacher-report-chart"><header><span>PROCESS SIGNAL</span><b>课堂进程信号</b></header><div className="teacher-signal-chart"><i style={{ height: "42%" }} /><i style={{ height: "58%" }} /><i style={{ height: "64%" }} /><i style={{ height: "73%" }} /><i style={{ height: `${selected.averageProgress}%` }} /><i style={{ height: `${Math.min(98, selected.participationRate)}%` }} /><span>进入实验</span><span>调整变量</span><span>记录现象</span><span>比较证据</span><span>形成解释</span><span>完成课堂</span></div></section>
          <section className="teacher-report-evidence"><header><span>OBSERVED EVIDENCE</span><b>本节课看见了什么</b></header><ol>{selected.evidence.map((item, index) => <li key={item}><i>{index + 1}</i><span>{item}</span></li>)}</ol></section>
          <section className="teacher-report-followup"><Lightbulb size={21} /><div><span>NEXT TEACHING MOVE</span><b>下一步教学建议</b><p>{selected.followUp}</p></div></section>
          <footer><span>本报告由当前设备上的演示课堂数据生成</span><span>不用于学生排名或自动评价</span></footer>
        </article>
      </div>
    </div>
  );
}
