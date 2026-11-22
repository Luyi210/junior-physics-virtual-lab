import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowRight, Atom, BookOpen, Compass, MoveUpRight, Orbit, Search, SlidersHorizontal, X } from "lucide-react";
import { Link } from "react-router-dom";
import { highSchoolCurriculumNote, highSchoolCurriculumSources, highSchoolDomains, highSchoolExperiments, highSchoolVolumes } from "@physics-lab/knowledge/high-school";
import { HIGH_SCHOOL_EXPERIMENTS } from "@physics-lab/physics";
import { HighSchoolHeader } from "../components/HighSchoolHeader";
import { InstrumentIllustration } from "../components/InstrumentIllustration";
import { SpatialExperimentGallery } from "../components/spatial/SpatialExperimentGallery";
import { HighSchoolShowcase } from "../components/showcase/HighSchoolShowcase";
import { CosmicObservatory } from "../components/cosmos/CosmicObservatory";
import { HighSchoolRecordScopePanel } from "../components/HighSchoolRecordScopePanel";
import { getHighSchoolRecordScope, subscribeHighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { PageIntroduction } from "../../../shared/components/PageIntroduction";
import "./HighSchoolPages.css";
import "../styles/HighSchoolTheme.css";
import "../styles/HighSchoolMobile.css";
import "./HighSchoolHome.css";
import "./HighSchoolGuide.css";

const experimentNumbers = new Map(highSchoolExperiments.map((item, index) => [item.id, String(index + 1).padStart(2, "0")]));
const volumeCounts = new Map(highSchoolVolumes.map(volume => [volume.id, highSchoolExperiments.filter(item => item.volume === volume.id).length]));
const normalizeSearch = (value: string) => value.normalize("NFKC").toLocaleLowerCase().trim();
const searchIndex = new Map(highSchoolExperiments.map(item => [item.id, normalizeSearch([
  item.name, item.chapter, item.learningGoal,
  highSchoolVolumes.find(volume => volume.id === item.volume)?.name,
  highSchoolDomains.find(domain => domain.id === item.domain)?.name,
  ...item.variables.independent, ...item.variables.dependent, ...item.variables.controlled,
].join(" "))]));

export function HighSchoolHomePage() {
  const scope = useSyncExternalStore(subscribeHighSchoolRecordScope, getHighSchoolRecordScope, getHighSchoolRecordScope);
  const [volume, setVolume] = useState("all");
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState<"all" | "ready" | "planned">("all");
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const openIds = useMemo(() => new Set<string>(HIGH_SCHOOL_EXPERIMENTS.map((item) => item.id)), []);
  const readyCount = highSchoolExperiments.filter(item => item.status === "ready" && openIds.has(item.id)).length;
  const searchTerms = useMemo(() => normalizeSearch(query).split(/\s+/u).filter(Boolean), [query]);
  const experiments = useMemo(() => highSchoolExperiments.filter((item) =>
    (volume === "all" || item.volume === volume) && (domain === "all" || item.domain === domain) &&
    (status === "all" || (status === "ready" ? item.status === "ready" && openIds.has(item.id) : item.status !== "ready" || !openIds.has(item.id))) &&
    searchTerms.every(term => searchIndex.get(item.id)!.includes(term))
  ).sort((left, right) => Number(right.status === "ready" && openIds.has(right.id)) - Number(left.status === "ready" && openIds.has(left.id))), [volume, domain, status, searchTerms, openIds]);
  const filters = [
    ...(volume !== "all" ? [{ key: "volume", label: highSchoolVolumes.find(item => item.id === volume)!.name, clear: () => setVolume("all") }] : []),
    ...(domain !== "all" ? [{ key: "domain", label: highSchoolDomains.find(item => item.id === domain)!.name, clear: () => setDomain("all") }] : []),
    ...(status !== "all" ? [{ key: "status", label: status === "ready" ? "已开放" : "筹备中", clear: () => setStatus("all") }] : []),
    ...(searchTerms.length ? [{ key: "query", label: `关键词：${query.trim()}`, clear: clearSearch }] : []),
  ];
  const filtered = filters.length > 0;
  function clearSearch() { setQuery(""); searchInput.current?.focus(); }
  function resetFilters() { setVolume("all"); setDomain("all"); setStatus("all"); setQuery(""); }
  function exploreCatalog() {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const catalog = document.getElementById("hs-catalog");
    catalog?.focus({ preventScroll: true });
    catalog?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return <div className="hs-page hs-home hs-lab-theme hs-cosmic-theme">
    <PageIntroduction
      pageKey="high-school-lab-guide"
      eyebrow="WELCOME / 高中物理实验室"
      title="从题目出发，让物理过程可见。"
      description="先选一个问题或实验，再改变条件、观察现象、保存证据。每一步都能随时向力力求助。"
      points={["从实验目录或题目可视化进入", "调一个变量，看动态与图像变化", "保存读数，分开分析模型与手动证据"]}
      icon={Orbit}
      accent="#8edcef"
      enterLabel="开始探究"
      variant="highschool"
      persistence="local"
      triggerLabel="高中使用引导"
      steps={[
        { eyebrow: "01 / CHOOSE A QUESTION", title: "先选问题，再进实验。", description: "可以从教材实验目录选主题，也可以在题目可视化中粘贴题干。识别到受支持的题型和完整数值后，才会生成可调场景。", points: ["当前支持抛体与弹簧静态平衡", "识别不了时会说明缺少条件或适用范围"], icon: Atom },
        { eyebrow: "02 / CHANGE ONE VARIABLE", title: "让一个条件发生变化。", description: "在实验中调节参数、观察动态、读取图像。想比较关系时，保留其他会影响结果的条件。", points: ["先预测，再改变条件", "可切换适合屏幕的二维或三维视图"], icon: SlidersHorizontal },
        { eyebrow: "03 / KEEP THE EVIDENCE", title: "用保存的读数解释现象。", description: "记录当前条件和读数，再让力力帮你核对证据、发现卡点。模型采样与手动虚拟读数分开看。", points: ["记录不足时继续采样", "结论写明条件与适用范围"], icon: BookOpen }
      ]}
    />
    <HighSchoolHeader />
    <main>
      <section className="hs-cosmic-hero" aria-labelledby="hs-home-title">
        <div className="hs-station-rail"><span><i aria-hidden="true" />物理观测站</span><span>从直觉开始，向证据靠近</span></div>
        <div className="hs-cosmic-copy">
          <span className="hs-kicker"><i aria-hidden="true" />高中物理 · 虚拟实验室</span>
          <h1 id="hs-home-title">从宏观宇宙，<br /><em>到微观世界。</em></h1>
          <p>追踪运动，改变场与光。<br />亲手调整条件，用图像与数据回应你的猜想。</p>
          <div className="hs-cosmic-actions"><button className="hs-button hs-primary" type="button" onClick={exploreCatalog}>探索全部实验<ArrowDown size={18} /></button><Link className="hs-hero-quick-start hs-problem-link" to="/high-school/problems"><Atom size={18} />题目可视化<ArrowRight size={17} /></Link><Link className="hs-hero-quick-start" to="/high-school/experiments/uniform-acceleration">从小车运动开始<ArrowRight size={17} /></Link></div>
          <div className="hs-cosmic-count"><strong>{String(readyCount).padStart(2, "0")}</strong><span>项实验已开放<small>{highSchoolVolumes.length} 册教材 · {highSchoolDomains.length} 个物理领域</small></span></div>
        </div>
        <div className="hs-cosmic-observatory"><div className="hs-observatory-frame"><CosmicObservatory /></div></div>
      </section>

      <section className="hs-live-laboratory" aria-labelledby="hs-live-laboratory-title">
        <div className="hs-live-intro"><span className="hs-kicker"><span className="hs-section-index">01</span>即时模型</span><h2 id="hs-live-laboratory-title">先让一个<br /><em>现象发生。</em></h2><p>轻轻改变一个条件。<br />摆动、轨迹与碰撞，立即给出回应。</p><ol className="hs-live-steps"><li><span>01</span><Compass size={18} aria-hidden="true" /><div><b>选择一个现象</b><small>先预测，再观察</small></div></li><li><span>02</span><SlidersHorizontal size={18} aria-hidden="true" /><div><b>改变一个变量</b><small>让差异变得可见</small></div></li><li><span>03</span><BookOpen size={18} aria-hidden="true" /><div><b>进入完整实验</b><small>记录读数，检验你的解释</small></div></li></ol><button type="button" className="hs-live-catalog-link" onClick={exploreCatalog}>选择我的实验<ArrowDown size={17} /></button></div>
        <div className="hs-home-showcase"><HighSchoolShowcase /></div>
      </section>

      <section className="hs-catalog" id="hs-catalog" tabIndex={-1} aria-labelledby="hs-catalog-title">
        <header className="hs-section-heading"><div><span className="hs-kicker"><span className="hs-section-index">02</span>实验目录</span><h2 id="hs-catalog-title">选定问题。<em>开始验证。</em></h2><p>按教材、领域或变量，找到你的下一次探索。</p></div><div className="hs-catalog-search"><div className="hs-search"><Search size={19} aria-hidden="true" /><label className="hs-sr-only" htmlFor="hs-experiment-search">搜索实验</label><input ref={searchInput} id="hs-experiment-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="实验、章节或变量" aria-controls="hs-experiment-results" aria-describedby="hs-search-help" />{query && <button type="button" className="hs-search-clear" aria-label="清除搜索词" onClick={clearSearch}><X size={17} aria-hidden="true" /></button>}</div><span id="hs-search-help">多个关键词用空格分开，如「光学 折射」</span></div></header>
        <HighSchoolRecordScopePanel scope={scope} />
        <div className="hs-catalog-layout"><aside className="hs-course-filter" aria-label="课程筛选"><span className="hs-filter-caption"><BookOpen size={15} />教材册别</span><div className="hs-volume-list"><button type="button" className={volume === "all" ? "is-active" : ""} aria-pressed={volume === "all"} onClick={() => setVolume("all")}><span>全部课程</span><small>{highSchoolExperiments.length}</small></button>{highSchoolVolumes.map((item) => <button key={item.id} type="button" className={volume === item.id ? "is-active" : ""} aria-pressed={volume === item.id} onClick={() => setVolume(item.id)}><span>{item.name}</span><small>{volumeCounts.get(item.id)}</small></button>)}</div><div className="hs-filter-note"><span className="hs-home-note-rule" /><h3>先实验，再归纳。</h3><p>{readyCount} 项实验已开放。装置、读数和图像来自同一物理模型，适用条件与模型边界在实验中说明。</p><span>虚拟探究 · 不代替实体操作</span></div></aside>
          <div className="hs-catalog-content"><div className="hs-domain-filter" role="group" aria-label="物理领域"><button type="button" className={domain === "all" ? "is-active" : ""} aria-pressed={domain === "all"} onClick={() => setDomain("all")}>全部领域</button>{highSchoolDomains.map((item) => <button type="button" key={item.id} data-domain={item.id} className={domain === item.id ? "is-active" : ""} aria-pressed={domain === item.id} onClick={() => setDomain(item.id)}><i aria-hidden="true" />{item.name}</button>)}</div><div className="hs-result-heading"><div><p role="status" aria-live="polite" aria-atomic="true">{filtered ? "匹配" : "全部"} <b>{experiments.length}</b> 项实验</p>{filtered && <button type="button" onClick={resetFilters}>重置全部</button>}</div><label><span className="hs-sr-only">开放状态</span><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">全部状态</option><option value="ready">已开放</option><option value="planned">筹备中</option></select></label></div>
            {filtered && <div className="hs-active-filters" role="group" aria-label="当前筛选条件">{filters.map(filter => <button key={filter.key} type="button" onClick={filter.clear} aria-label={`移除筛选：${filter.label}`}><span>{filter.label}</span><X size={14} aria-hidden="true" /></button>)}</div>}
            {experiments.length ? <SpatialExperimentGallery>{experiments.map((item) => {
              const ready = item.status === "ready" && openIds.has(item.id);
              const domainName = highSchoolDomains.find(entry => entry.id === item.domain)?.name;
              return <article className={`hs-experiment-card${ready ? "" : " is-planned"}`} data-domain={item.domain} data-experiment-id={item.id} key={item.id}>
                <div className="hs-card-scene" aria-hidden="true" data-spatial-stage="true"><span className="hs-card-scene-glint" /><div className="hs-card-scene-meta"><span className="hs-card-number">{experimentNumbers.get(item.id)}</span><span>{domainName}</span></div><div className="hs-card-instrument-stage"><span className="hs-card-plinth" /><span className="hs-card-object-shadow" /><div className="hs-card-instrument-object">{ready ? <InstrumentIllustration small kind={item.id} /> : <Compass className="hs-card-planned-mark" size={56} strokeWidth={1} />}</div></div><span className="hs-card-scene-caption">{ready ? "二维 / 三维装置" : "装置筹备中"}</span></div>
                <div className="hs-card-body"><div className="hs-card-topline"><span className="hs-card-volume">{highSchoolVolumes.find((entry) => entry.id === item.volume)?.name}</span><span className={`hs-availability${ready ? " is-ready" : ""}`}><i aria-hidden="true" />{ready ? "已开放" : "筹备中"}</span></div><h3>{item.name}</h3><p>{item.learningGoal}</p><small className="hs-card-chapter">{item.chapter}</small></div>
                <footer>{ready ? <Link to={`/high-school/experiments/${item.id}`} aria-label={`进入${item.name}`}>进入实验<ArrowRight size={18} /></Link> : <span>实验装置筹备中</span>}<small>{domainName}</small></footer>
              </article>;
            })}</SpatialExperimentGallery> : <div className="hs-empty" id="hs-experiment-results"><div className="hs-empty-orbit" aria-hidden="true"><Search size={28} /></div><h3>没有匹配的实验</h3><p>{status === "planned" && readyCount === highSchoolExperiments.length ? "当前目录中的实验都已开放，可以切回已开放实验继续探索。" : "试着移除一项筛选，或换一个实验名称、章节、变量。"}</p><div className="hs-empty-actions">{searchTerms.length > 0 && <button className="hs-button" type="button" onClick={clearSearch}>仅清除搜索词</button>}<button className="hs-button hs-primary" type="button" onClick={resetFilters}>查看全部 {highSchoolExperiments.length} 项实验<ArrowRight size={16} /></button></div></div>}
          </div>
        </div>
      </section>
      <details className="hs-curriculum-note"><summary><span><BookOpen size={17} />教材与课程依据</span><span>查看参考资料<MoveUpRight size={14} /></span></summary><p>{highSchoolCurriculumNote}</p><div>{Object.entries(highSchoolCurriculumSources).map(([key, url]) => <a key={key} href={url} target="_blank" rel="noreferrer">{({ baselineStandard: "课程标准参考文本", revision2025: "2025 年修订发布说明", courseDirectory: "高中课程目录", textbookPortal: "人教版教材目录", required1: "必修第一册", required2: "必修第二册", required3: "必修第三册", elective1: "选择性必修第一册", elective2: "选择性必修第二册", elective3: "选择性必修第三册" } as Record<string, string>)[key] ?? "课程依据资料"}<MoveUpRight size={12} /></a>)}</div></details>
      <section className="hs-inquiry-banner"><div><span className="hs-kicker">下一次探索</span><h2>规律，<em>等你亲手验证。</em></h2><p>改变力与质量，观察加速度如何回应。</p></div><Link className="hs-button" to="/high-school/experiments/newton-second-law">进入牛顿第二定律实验<ArrowRight size={17} /></Link></section>
    </main>
    <footer className="hs-footer"><span>格物 / 高中物理</span><p>保持好奇，保持求证。</p><Link to="/">返回平台首页<ArrowRight size={14} /></Link></footer>
  </div>;
}
