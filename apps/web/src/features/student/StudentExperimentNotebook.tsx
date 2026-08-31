import { harnessSessionsToXAPIStatements } from "@physics-lab/harness";
import type { HarnessArea, HarnessEvent, HarnessEventType, HarnessSession } from "@physics-lab/harness";
import type { StudentExperimentSession } from "@physics-lab/contracts";
import { Activity, ArrowLeft, ArrowRight, BookOpenText, Check, ChevronRight, CircleCheck, ClipboardList, Clock3, Cloud, Database, Download, Eye, FileJson, FlaskConical, HelpCircle, Lightbulb, PencilLine, Radio, RotateCcw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { experimentNotebookRepository } from "../../services/experimentNotebookRepository";
import type { ExperimentNotebookEntry } from "../../services/experimentNotebookRepository";
import { localHarnessSessionRepository } from "../../services/harnessSessionRepository";
import { studentApi } from "../../services/teacherApi";

interface ExperimentActivity {
  id: string;
  area: HarnessArea;
  module: string;
  title: string;
  field: string;
  accent: string;
  firstAt: string;
  lastAt: string;
  events: HarnessEvent[];
  observations: string[];
  to: string;
}

interface NotebookDraft {
  whatIDid: string;
  whatIObserved: string;
  whatILearned: string;
  question: string;
}

const emptyDraft: NotebookDraft = { whatIDid: "", whatIObserved: "", whatILearned: "", question: "" };

const areaInfo: Record<HarnessArea, { label: string; accent: string }> = {
  optics: { label: "光现象", accent: "#37ad9d" },
  lens: { label: "透镜实验", accent: "#37ad9d" },
  sound: { label: "声现象", accent: "#4d9ed4" },
  mechanics: { label: "运动与力", accent: "#d79b2f" },
  circuit: { label: "电与磁", accent: "#e4614b" },
  thermal: { label: "热与物态", accent: "#dc7b34" },
  measurement: { label: "质量与密度", accent: "#8b72ce" }
};

const moduleTitles: Record<string, string> = {
  overview: "光学探究总览", dispersion: "光的色散", straight: "光的直线传播", reflection: "光的反射", refraction: "光的折射",
  "color-mix": "色光三原色", celestial: "日食与月食", "plane-mirror": "平面镜成像", "curved-mirror": "凹面镜与凸面镜", "invisible-light": "红外线与紫外线",
  magnifier: "放大镜", bench: "凸透镜成像", camera: "照相机", eye: "人的眼睛", correction: "视力矫正", instruments: "望远镜与显微镜",
  "sound-overview": "声音实验场总览", "sound-medium": "声音的产生与传播", "sound-features": "响度、音调和音色", "sound-noise": "噪声的产生与控制", "sound-echo": "听不见的声音与回声测距",
  "mechanics-overview": "力学工坊总览", "mechanics-speed": "路程、时间与速度", "mechanics-friction": "影响滑动摩擦力的因素", "mechanics-lever": "探究杠杆的平衡条件", "mechanics-pressure": "压力作用效果与压强", "mechanics-buoyancy": "浮力与物体的浮沉条件",
  "circuit-overview": "电学连接室总览", "circuit-basic": "串联与并联电路", "circuit-ohm": "电流与电压、电阻的关系", "circuit-power": "测量用电器的电功率", "circuit-magnet": "通电螺线管与电磁铁",
  "thermal-overview": "热学观察站总览", "thermal-thermometer": "温度计的使用与读数", "thermal-boiling": "观察水的沸腾", "thermal-melting": "冰的熔化温度曲线", "thermal-evaporation": "影响蒸发快慢的因素",
  "measurement-overview": "物质测量室总览", "measurement-balance": "用托盘天平测量质量", "measurement-mass-volume": "探究质量与体积的关系", "measurement-density": "测量不规则固体的密度", "measurement-liquid-density": "测量液体的密度"
};

const actionNames: Partial<Record<HarnessEventType, string>> = {
  "control.changed": "调整实验参数",
  "simulation.toggled": "改变运行状态",
  "configuration.changed": "切换实验配置",
  "scene.navigated": "移动或旋转观察场景",
  "view.changed": "切换观察视角",
  "dialogue.asked": "向光光提出问题",
  "observation.created": "保存实验观察"
};

function experimentLink(area: HarnessArea, module: string) {
  if (area === "optics") return `/student/explore/light?mode=${module}`;
  if (area === "lens") return "/lab/lens";
  return `/student/explore/${area}?module=${module}`;
}

function getExperimentTitle(module: string) {
  return moduleTitles[module] ?? module.replaceAll("-", " ");
}

function deriveActivities(sessions: HarnessSession[]): ExperimentActivity[] {
  const activities = new Map<string, ExperimentActivity>();

  sessions.forEach((session) => {
    let current: ExperimentActivity | undefined;
    const eventActivity = new Map<string, ExperimentActivity>();
    const events = [...session.events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

    events.forEach((event) => {
      if (event.type === "module.entered" && typeof event.payload.module === "string") {
        const module = event.payload.module;
        const id = `${session.area}:${module}`;
        current = activities.get(id);
        if (!current) {
          current = {
            id,
            area: session.area,
            module,
            title: getExperimentTitle(module),
            field: areaInfo[session.area].label,
            accent: areaInfo[session.area].accent,
            firstAt: event.occurredAt,
            lastAt: event.occurredAt,
            events: [],
            observations: [],
            to: experimentLink(session.area, module)
          };
          activities.set(id, current);
        }
        current.lastAt = event.occurredAt;
      }
      if (!current) return;
      current.events.push(event);
      current.lastAt = event.occurredAt;
      eventActivity.set(event.id, current);
    });

    session.observations.forEach((observation) => {
      const exact = observation.relatedEventId ? eventActivity.get(observation.relatedEventId) : undefined;
      const nearest = exact ?? [...activities.values()]
        .filter((activity) => activity.area === session.area && activity.lastAt <= observation.createdAt)
        .sort((left, right) => right.lastAt.localeCompare(left.lastAt))[0];
      if (nearest && !nearest.observations.includes(observation.text)) nearest.observations.push(observation.text);
    });
  });

  return [...activities.values()].sort((left, right) => right.lastAt.localeCompare(left.lastAt));
}

function operationSummary(activity: ExperimentActivity) {
  const counts = new Map<HarnessEventType, number>();
  activity.events.forEach((event) => counts.set(event.type, (counts.get(event.type) ?? 0) + 1));
  const parts = Object.entries(actionNames)
    .map(([type, label]) => ({ label, count: counts.get(type as HarnessEventType) ?? 0 }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.label}${item.count}次`);
  return parts.length ? `我进入了“${activity.title}”，${parts.join("，")}。` : `我进入了“${activity.title}”，认识了实验装置和探究问题。`;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function StudentExperimentNotebook() {
  const [sessions, setSessions] = useState<HarnessSession[]>([]);
  const [entries, setEntries] = useState<ExperimentNotebookEntry[]>(() => experimentNotebookRepository.findAll());
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<NotebookDraft>(emptyDraft);
  const [saved, setSaved] = useState(false);
  const [exported, setExported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cloudSessions, setCloudSessions] = useState<StudentExperimentSession[]>([]);

  useEffect(() => {
    localHarnessSessionRepository.findAll().then(setSessions).catch(() => setSessions([])).finally(() => setLoading(false));
    if (studentApi.hasSession()) studentApi.sessions().then(setCloudSessions).catch(() => setCloudSessions([]));
  }, []);

  const activities = useMemo(() => {
    const derived = deriveActivities(sessions);
    entries.forEach((entry) => {
      if (derived.some((activity) => activity.id === entry.id)) return;
      derived.push({ id: entry.id, area: entry.area, module: entry.module, title: entry.experimentTitle, field: areaInfo[entry.area].label, accent: areaInfo[entry.area].accent, firstAt: entry.createdAt, lastAt: entry.updatedAt, events: [], observations: [], to: experimentLink(entry.area, entry.module) });
    });
    return derived.sort((left, right) => right.lastAt.localeCompare(left.lastAt));
  }, [entries, sessions]);

  useEffect(() => {
    if (!selectedId && activities[0]) setSelectedId(activities[0].id);
  }, [activities, selectedId]);

  const selected = activities.find((activity) => activity.id === selectedId);
  const existing = entries.find((entry) => entry.id === selectedId);

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft);
      return;
    }
    const entry = entries.find((item) => item.id === selected.id);
    setDraft(entry ? { whatIDid: entry.whatIDid, whatIObserved: entry.whatIObserved, whatILearned: entry.whatILearned, question: entry.question } : {
      whatIDid: operationSummary(selected),
      whatIObserved: selected.observations.join("\n"),
      whatILearned: "",
      question: ""
    });
    setSaved(false);
  }, [entries, selected?.id]);

  const completedFields = new Set(entries.map((entry) => entry.area)).size;
  const totalOperations = activities.reduce((sum, activity) => sum + activity.events.filter((event) => event.type !== "module.entered").length, 0);
  const canSave = Boolean(selected && (draft.whatIDid.trim() || draft.whatIObserved.trim() || draft.whatILearned.trim() || draft.question.trim()));

  const exportLearningTrace = () => {
    const statements = harnessSessionsToXAPIStatements(sessions);
    if (!statements.length && !entries.length) return;
    const payload = {
      format: "xAPI 1.0.3 compatible learning trace",
      exportedAt: new Date().toISOString(),
      source: "初中物理虚拟实验平台 V2",
      statements,
      notebookEntries: entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `物理学习轨迹-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1800);
  };

  const save = () => {
    if (!selected || !canSave) return;
    const now = new Date().toISOString();
    experimentNotebookRepository.save({
      id: selected.id,
      area: selected.area,
      module: selected.module,
      experimentTitle: selected.title,
      whatIDid: draft.whatIDid.trim(),
      whatIObserved: draft.whatIObserved.trim(),
      whatILearned: draft.whatILearned.trim(),
      question: draft.question.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    setEntries(experimentNotebookRepository.findAll());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const resetFromActivity = () => {
    if (!selected) return;
    setDraft({ whatIDid: operationSummary(selected), whatIObserved: selected.observations.join("\n"), whatILearned: "", question: "" });
  };

  const remove = () => {
    if (!existing || !window.confirm(`删除“${existing.experimentTitle}”的学习记录吗？自动实验轨迹仍会保留。`)) return;
    experimentNotebookRepository.remove(existing.id);
    setEntries(experimentNotebookRepository.findAll());
  };

  return <div className="explore-page experiment-notebook-page">
    <header className="explore-header notebook-site-header">
      <Link to="/"><BrandMark /></Link>
      <nav aria-label="学生平台导航">
        <Link to="/student">探索首页</Link>
        <Link to="/student#fields">六个领域</Link>
        <Link className="active" to="/student/notebook">实验记录本</Link>
      </nav>
      <Link className="notebook-back-link" to="/student"><ArrowLeft size={16} />回到学生平台</Link>
    </header>

    <main className="notebook-shell">
      <section className="notebook-hero">
        <div>
          <span><Sparkles size={16} /> MY PHYSICS FIELD NOTES / 我的实验记录本</span>
          <h1>把操作变成证据，<br />把发现写成自己的话。</h1>
          <p>平台会整理你真实做过的实验操作，但“观察到了什么”和“学到了什么”由你亲自完成。这里没有标准篇数，也不按任务打卡。</p>
        </div>
        <aside aria-label="记录本统计">
          <BookOpenText size={35} />
          <dl><div><dt>{entries.length}</dt><dd>篇学习记录</dd></div><div><dt>{activities.length}</dt><dd>个到访实验</dd></div><div><dt>{totalOperations}</dt><dd>次实验操作</dd></div><div><dt>{completedFields}</dt><dd>个物理领域</dd></div></dl>
          <div className="notebook-portability" aria-label="学习轨迹数据能力"><span><Database size={12} />本地保存</span><span><ShieldCheck size={12} />结构校验</span><span><FileJson size={12} />xAPI 1.0.3</span></div>
          <button className="notebook-export-trace" type="button" onClick={exportLearningTrace} disabled={!sessions.length && !entries.length}>{exported ? <Check size={15} /> : <Download size={15} />}{exported ? "学习轨迹已导出" : "导出可迁移学习轨迹"}</button>
          <small>当前保存在本机；导出文件可供未来教师端或后端读取</small>
        </aside>
      </section>

      {studentApi.hasSession() && <section className="notebook-cloud-strip">
        <header><i><Cloud size={19} /></i><span><small>SCHOOL CLOUD EVIDENCE / 学校云端实验档案</small><b>任务过程与个人反思，分别保存、相互补充</b><p>上方记录本保存你写下的原话；这里显示已同步到班级后台的实验操作与观察。</p></span></header>
        <div><article><CircleCheck size={17} /><strong>{cloudSessions.filter((session) => session.status === "completed").length}</strong><span>已完成会话</span></article><article><Activity size={17} /><strong>{cloudSessions.reduce((sum, session) => sum + session.eventCount, 0)}</strong><span>同步操作</span></article><article><BookOpenText size={17} /><strong>{cloudSessions.reduce((sum, session) => sum + session.observationCount, 0)}</strong><span>同步观察</span></article></div>
        {cloudSessions.find((session) => session.status === "active") ? <Link to="/student#my-tasks"><Radio size={14} />有实验正在进行，返回航行台继续 <ArrowRight size={14} /></Link> : <Link to="/student#my-tasks">查看全部实验档案 <ArrowRight size={14} /></Link>}
      </section>}

      <section className="notebook-workspace">
        <aside className="notebook-activity-rail">
          <header><span>AUTO TRACE / 自动轨迹</span><h2>我最近做过</h2><p>从实验平台的真实操作中整理</p></header>
          {loading ? <div className="notebook-loading"><i />正在翻阅实验轨迹…</div> : activities.length === 0 ? <div className="notebook-empty-rail"><FlaskConical size={28} /><strong>还没有实验轨迹</strong><p>先进入任意实验并调整一次参数，记录本就会自动出现材料。</p><Link to="/student">去选择实验 <ArrowRight size={14} /></Link></div> : <div className="notebook-activity-list">
            {activities.map((activity) => <button style={{ "--notebook-accent": activity.accent } as React.CSSProperties} className={selectedId === activity.id ? "active" : ""} onClick={() => setSelectedId(activity.id)} key={activity.id}>
              <i /><span><small>{activity.field} · {timeLabel(activity.lastAt)}</small><strong>{activity.title}</strong><em>{activity.events.filter((event) => event.type !== "module.entered").length} 次操作 · {entries.some((entry) => entry.id === activity.id) ? "已写记录" : "待整理"}</em></span><ChevronRight size={17} />
            </button>)}
          </div>}
        </aside>

        <article className="notebook-paper">
          {!selected ? <div className="notebook-paper-empty"><BookOpenText size={46} /><h2>先做一次实验，再写下自己的发现。</h2><p>自动轨迹只负责提醒你做过什么，不会替你生成学习结论。</p><Link to="/student">进入开放实验平台 <ArrowRight size={16} /></Link></div> : <>
            <header className="notebook-paper-heading" style={{ "--notebook-accent": selected.accent } as React.CSSProperties}>
              <div><span>FIELD NOTE / {selected.field}</span><h2>{selected.title}</h2><p><Clock3 size={14} />最近实验：{timeLabel(selected.lastAt)}</p></div>
              <Link to={selected.to}>回到这个实验 <ArrowRight size={15} /></Link>
            </header>

            <section className="notebook-auto-evidence">
              <header><ClipboardList size={18} /><span><small>平台自动整理</small><strong>本次探究留下的事实</strong></span></header>
              <div>{Object.entries(actionNames).map(([type, label]) => {
                const count = selected.events.filter((event) => event.type === type).length;
                return count > 0 ? <span key={type}><b>{count}</b>{label}</span> : null;
              })}</div>
              {selected.observations.length > 0 && <blockquote>“{selected.observations.at(-1)}”<small>此前保存的观察</small></blockquote>}
            </section>

            <div className="notebook-writing-grid">
              <label className="did"><span><PencilLine size={17} /><b>01</b><strong>我做了什么</strong><small>写操作和改变的条件</small></span><textarea value={draft.whatIDid} onChange={(event) => setDraft({ ...draft, whatIDid: event.target.value })} placeholder="例如：我先打开白光，再转动三棱镜，最后移动光屏比较色带……" /></label>
              <label className="observed"><span><Eye size={17} /><b>02</b><strong>我观察到什么</strong><small>只写看见或测到的证据</small></span><textarea value={draft.whatIObserved} onChange={(event) => setDraft({ ...draft, whatIObserved: event.target.value })} placeholder="例如：光屏上出现了按顺序排列的彩色光带……" /></label>
              <label className="learned"><span><Lightbulb size={17} /><b>03</b><strong>我学到了什么</strong><small>试着用自己的话解释</small></span><textarea value={draft.whatILearned} onChange={(event) => setDraft({ ...draft, whatILearned: event.target.value })} placeholder="例如：我认识到白光中原本包含多种色光……" /></label>
              <label className="question"><span><HelpCircle size={17} /><b>04</b><strong>我还想知道</strong><small>保留一个可以继续实验的问题</small></span><textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} placeholder="例如：如果换成红色单色光，还会出现彩色光带吗？" /></label>
            </div>

            <footer className="notebook-paper-actions">
              <button type="button" onClick={resetFromActivity}><RotateCcw size={15} />重新读取自动轨迹</button>
              {existing && <button className="danger" type="button" onClick={remove}><Trash2 size={15} />删除这篇</button>}
              <span>学习内容不会自动生成，保存的是你的原话。</span>
              <button className="primary" type="button" onClick={save} disabled={!canSave}>{saved ? <Check size={17} /> : <Save size={17} />}{saved ? "已经保存" : existing ? "更新学习记录" : "保存学习记录"}</button>
            </footer>
          </>}
        </article>
      </section>

      {entries.length > 0 && <section className="notebook-record-library">
        <header><div><span>MY DISCOVERY ARCHIVE</span><h2>我的发现档案</h2></div><p>每篇记录都可以继续修改。随着实验次数增加，你会看到自己的问题和解释怎样发生变化。</p></header>
        <div>{entries.map((entry, index) => <button onClick={() => { setSelectedId(entry.id); document.querySelector(".notebook-workspace")?.scrollIntoView({ behavior: "smooth" }); }} key={entry.id}>
          <b>{String(index + 1).padStart(2, "0")}</b><small>{areaInfo[entry.area].label} · {timeLabel(entry.updatedAt)}</small><h3>{entry.experimentTitle}</h3><p>{entry.whatILearned || entry.whatIObserved || entry.whatIDid}</p><span>继续阅读与修改 <ArrowRight size={14} /></span>
        </button>)}</div>
      </section>}
    </main>
  </div>;
}
