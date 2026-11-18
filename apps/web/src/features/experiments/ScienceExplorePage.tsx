import { useParams, Navigate, useSearchParams, Link } from "react-router-dom";
import { useApparatusDomSync } from "../assistant/useApparatusDomSync";
import { PageIntroduction } from "../../shared/components/PageIntroduction";
import { BrandMark } from "../../shared/components/BrandMark";
import { Home, Focus, Sparkles, ArrowRight, Mic2, Ear } from "lucide-react";
import { PhysicsInquiryRibbon } from "../../shared/components/PhysicsInquiryRibbon";
import { ExperimentWorkspaceDock } from "./shared/ExperimentWorkspaceDock";
import { PhysicsFieldMotif } from "../../shared/components/PhysicsFieldMotif";
import { isField, fieldMeta, scienceModules, type ScienceModuleMeta, type FieldKey, inquiryFormulas } from "./catalog/scienceCatalog";
import { ScienceModuleExperience } from "./scienceRegistry";

export function StudentScienceExplore() {
  const { field } = useParams();
  if (!isField(field)) return <Navigate to="/student" replace />;
  const meta = fieldMeta[field];
  const Icon = meta.icon;
  const [params, setParams] = useSearchParams();
  const modules = scienceModules[field];
  const requestedModule = params.get("module");
  const activeModule = modules.find((module) => module.key === requestedModule) ?? null;
  const selectModule = (key?: ScienceModuleMeta["key"]) => setParams(key ? { module: key } : {});
  useApparatusDomSync(activeModule?.key, ".science-module-experience > .science-lab");
  return <div className="science-explore-page science-structure-v2" style={{ "--science-accent": meta.accent } as React.CSSProperties}>
    {!activeModule && <PageIntroduction
      key={field}
      pageKey={`field-${field}`}
      eyebrow={`${meta.book} / 领域导览`}
      title={`${meta.title}：${meta.subtitle}`}
      description={`${meta.description} 本页是实验目录，不规定学习顺序；可以从最感兴趣的问题直接进入装置。`}
      points={meta.strands.map((strand) => `探索“${strand}”中的现象、变量与规律`)}
      icon={Icon}
      accent={meta.accent}
      enterLabel={`查看${meta.title}实验`}
      persistence="local"
      triggerLabel="领域向导"
    />}
    <header className="science-header"><Link to="/student"><BrandMark compact /></Link><div><Icon size={19} /><span><small>FIELD / 当前领域</small><strong>{meta.title}</strong></span></div><p>{activeModule ? `${activeModule.chapter} · ${activeModule.title}` : meta.subtitle}</p><Link to="/student"><Home size={16} />六领域首页</Link></header>
    <main className="science-layout">
      <aside className="science-nav"><span>01—06 · 物理领域</span><Link to="/student/explore/light"><Focus size={18} /><span><strong>光现象</strong><small>传播、反射、折射与透镜</small></span></Link>{(Object.keys(fieldMeta) as FieldKey[]).map((key) => { const item = fieldMeta[key]; const ItemIcon = item.icon; return <Link className={key === field ? "active" : ""} to={`/student/explore/${key}`} key={key}><ItemIcon size={18} /><span><strong>{item.title}</strong><small>{item.strands.join(" · ")}</small></span></Link>; })}</aside>
      <section className="science-stage">
        <div className="science-module-bar"><div><span>EXPERIMENTS / 实验</span><strong>{activeModule ? activeModule.title : `${meta.title}实验目录`}</strong></div><nav aria-label={`${meta.title}实验目录`}><button className={!activeModule ? "active" : ""} onClick={() => selectModule()}><Sparkles size={15} /><span>目录</span></button>{modules.map((module, index) => { const ModuleIcon = module.icon; return <button className={activeModule?.key === module.key ? "active" : ""} onClick={() => selectModule(module.key)} title={module.title} key={module.key}><b>{String(index + 1).padStart(2, "0")}</b><ModuleIcon size={15} /><span>{module.shortTitle}</span></button>; })}</nav></div>
        {activeModule && <PhysicsInquiryRibbon title={activeModule.title} question={activeModule.question} variable={activeModule.guide[1]} evidence={`记录“${activeModule.note}”对应的读数、状态和变化趋势`} law={activeModule.guide[2]} application={activeModule.life.slice(0, 2).map((item) => item.title).join("、")} formula={inquiryFormulas[activeModule.key]} />}
        {activeModule && <ExperimentWorkspaceDock experiment={activeModule.key} title={activeModule.title} context={`${meta.title} · ${activeModule.chapter}`} targetSelector=".science-module-experience > .science-lab" />}
        {!activeModule ? <ScienceFieldOverview field={field} onSelect={selectModule} /> : <ScienceModuleExperience field={field} module={activeModule} />}
      </section>
    </main>
  </div>;
}

function ScienceFieldOverview({ field, onSelect }: { field: FieldKey; onSelect: (key: ScienceModuleMeta["key"]) => void }) {
  const meta = fieldMeta[field];
  const Icon = meta.icon;
  const modules = scienceModules[field];
  return <div className={`science-field-overview overview-${field}`}>
    <section className="science-field-hero"><div><span>OPEN FIELD / 自由探索</span><h1>{meta.title}</h1><p>{meta.description}</p><div className="science-strand-tags">{meta.strands.map((strand) => <b key={strand}>{strand}</b>)}</div></div><PhysicsFieldMotif field={field} className="science-field-physics" /><div className="science-field-emblem"><Icon size={38} /><strong>{modules.length}</strong><small>个动态实验</small></div></section>
    {field === "sound" && <SoundFieldMonitor />}
    <section className="science-overview-heading"><div><span>EXPERIMENT MAP / 实验目录</span><h2>选择一个问题，直接进入装置。</h2></div><p>不规定先后顺序。每个实验都包含动态操作、实验说明和生活应用。</p></section>
    <div className="science-module-card-grid">{modules.map((module, index) => { const ModuleIcon = module.icon; return <button onClick={() => onSelect(module.key)} key={module.key}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><i><ModuleIcon size={24} /></i><small>{module.chapter}</small><h3>{module.title}</h3><p>{module.note}</p><blockquote>{module.question}</blockquote><b>进入动态实验 <ArrowRight size={15} /></b></button>; })}</div>
    <section className="science-curriculum-note"><span>对应教材</span><strong>{meta.book}</strong><p>教材章节用于说明知识来源，不代表必须按照章节顺序完成实验。</p></section>
  </div>;
}

function SoundFieldMonitor() {
  const wave = Array.from({ length: 91 }, (_, index) => `${index * 9},${55 + Math.sin(index * .42) * (12 + index / 8)}`).join(" ");
  return <section className="sound-field-monitor" aria-label="声音传播观测模型">
    <header><span><i />ACOUSTIC SIGNAL ONLINE</span><b>声音不是“飞出去的东西”，而是振动在介质中传递。</b></header>
    <div className="sound-monitor-chain"><article><i><Mic2 size={21} /></i><span><small>01 / SOURCE</small><strong>声源振动</strong><em>产生疏密变化</em></span></article><div className="sound-monitor-wave"><svg viewBox="0 0 810 110" preserveAspectRatio="none"><polyline points={wave} /></svg><span>介质粒子在平衡位置附近振动</span></div><article><i><Ear size={21} /></i><span><small>03 / RECEIVER</small><strong>接收声音</strong><em>形成听觉或读数</em></span></article></div>
    <footer>{["振幅 A → 响度线索", "频率 f → 音调线索", "传播需要介质", "回声经历往返路径"].map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</footer>
  </section>;
}
