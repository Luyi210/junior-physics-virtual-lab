import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle2, Compass, FlaskConical, Home, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { physicsGraphDomains, physicsKnowledgeGraph } from "./physicsKnowledgeGraph";
import type { PhysicsGraphDomain } from "./physicsKnowledgeGraph";
import { textbookChapters } from "./textbookKnowledge";
import type { ChapterIllustrationKind, TextbookVolume } from "./textbookKnowledge";
import "./StudentTextbookLibrary.css";

type VolumeFilter = "全部" | TextbookVolume;
type DomainFilter = "all" | PhysicsGraphDomain;

const volumes: VolumeFilter[] = ["全部", "八上", "八下", "九上", "九下"];
const domainOrder: DomainFilter[] = ["all", "sound", "light", "thermal", "measurement", "mechanics", "circuit"];
const nodesById = new Map(physicsKnowledgeGraph.map((node) => [node.id, node]));

export function StudentTextbookLibrary() {
  const [volume, setVolume] = useState<VolumeFilter>("全部");
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [query, setQuery] = useState("");

  const filteredChapters = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return textbookChapters.filter((chapter) => {
      if (volume !== "全部" && chapter.volume !== volume) return false;
      if (domain !== "all" && chapter.domain !== domain) return false;
      if (!needle) return true;
      const nodes = chapter.nodeIds.map((id) => nodesById.get(id)).filter(Boolean);
      const searchable = [chapter.title, chapter.locator, chapter.sectionHint, chapter.summary, chapter.law, ...nodes.flatMap((node) => node ? [node.title, node.question, ...node.concepts] : [])].join(" ").toLocaleLowerCase("zh-CN");
      return searchable.includes(needle);
    });
  }, [domain, query, volume]);

  const visibleExperimentCount = filteredChapters.reduce((total, chapter) => total + chapter.nodeIds.length, 0);

  return (
    <div className="textbook-library-page">
      <header className="textbook-topbar">
        <Link to="/" aria-label="返回产品首页"><BrandMark /></Link>
        <nav aria-label="课本知识专栏导航">
          <Link to="/student"><Home size={15} />学生首页</Link>
          <a href="#chapter-atlas"><BookOpenText size={15} />章节图鉴</a>
          <a href="#usage-note"><Compass size={15} />使用说明</a>
        </nav>
        <Link className="textbook-back" to="/student"><ArrowLeft size={16} />返回学生端</Link>
      </header>

      <main>
        <section className="textbook-hero">
          <div className="textbook-hero-orbit" aria-hidden="true"><i /><i /><i /><b>PHYSICS</b></div>
          <div className="textbook-hero-copy">
            <p><Sparkles size={16} /> TEXTBOOK KNOWLEDGE ATLAS / 课本知识专栏</p>
            <h1>把每一次实验，<br />放回它所在的<em>课本章节</em>。</h1>
            <span>依据苏科版（2024）初中物理章节结构，将平台全部实验整理为可检索的数字物理图鉴。每章都有原创知识图解、核心规律和直达实验的证据入口。</span>
            <div className="textbook-hero-actions">
              <a href="#chapter-atlas">开始查找章节 <ArrowRight size={17} /></a>
              <Link to="/student">返回自由探索</Link>
            </div>
          </div>
          <div className="textbook-hero-data" aria-label="专栏内容统计">
            <span><b>{textbookChapters.length}</b><small>对应章节</small></span>
            <span><b>{physicsKnowledgeGraph.length}</b><small>实验节点</small></span>
            <span><b>{Object.keys(physicsGraphDomains).length}</b><small>物理领域</small></span>
            <p><i />苏科版（2024）章节映射已启用</p>
          </div>
        </section>

        <section className="textbook-index" id="chapter-atlas">
          <header>
            <div><small>CHAPTER INDEX / 章节索引</small><h2>从册别、领域或关键词定位知识</h2></div>
            <p>输入“近视”“浮力”“三棱镜”或公式名称，即可找到相关章节和实验。</p>
          </header>

          <div className="textbook-filter-console">
            <label className="textbook-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索章节、概念、实验或生活问题" />
              <span>{filteredChapters.length} 章 / {visibleExperimentCount} 实验</span>
            </label>
            <div className="textbook-filter-row">
              <span>按册别</span>
              <div>{volumes.map((item) => <button type="button" className={volume === item ? "active" : ""} onClick={() => setVolume(item)} key={item}>{item}</button>)}</div>
            </div>
            <div className="textbook-filter-row">
              <span>按领域</span>
              <div>{domainOrder.map((item) => <button type="button" className={domain === item ? "active" : ""} onClick={() => setDomain(item)} key={item}>{item === "all" ? "全部领域" : physicsGraphDomains[item].label}</button>)}</div>
            </div>
          </div>

          {filteredChapters.length > 0 ? (
            <div className="textbook-chapter-grid">
              {filteredChapters.map((chapter, index) => {
                const chapterNodes = chapter.nodeIds.map((id) => nodesById.get(id)).filter((node) => Boolean(node));
                const concepts = [...new Set(chapterNodes.flatMap((node) => node?.concepts ?? []))].slice(0, 7);
                return (
                  <article className={`textbook-chapter-card ${chapterNodes.length >= 5 ? "is-wide" : ""}`} style={{ "--chapter-accent": chapter.accent } as CSSProperties} key={chapter.id}>
                    <header>
                      <span><b>{chapter.volume}</b><i>CH.{chapter.chapterNumber}</i></span>
                      <small>{String(index + 1).padStart(2, "0")} / {String(filteredChapters.length).padStart(2, "0")}</small>
                    </header>
                    <ChapterIllustration kind={chapter.illustration} />
                    <div className="textbook-chapter-copy">
                      <small>{chapter.locator}</small>
                      <h2>{chapter.title}</h2>
                      <p>{chapter.summary}</p>
                      <div className="textbook-law"><span>CORE LAW</span><strong>{chapter.law}</strong></div>
                      <div className="textbook-concepts">{concepts.map((concept) => <span key={concept}>{concept}</span>)}</div>
                    </div>
                    <section className="textbook-experiment-list">
                      <header><span><FlaskConical size={15} />对应虚拟实验</span><b>{chapterNodes.length}</b></header>
                      <div>
                        {chapterNodes.map((node) => node && <Link to={node.route} key={node.id}><span><CheckCircle2 size={14} /><b>{node.title}</b><small>{node.question}</small></span><ArrowRight size={15} /></Link>)}
                      </div>
                    </section>
                    <footer><span>教材小节线索</span><p>{chapter.sectionHint}</p></footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="textbook-empty"><Search size={27} /><h3>没有找到对应章节</h3><p>试试减少关键词，或切换到“全部”册别和领域。</p><button type="button" onClick={() => { setQuery(""); setVolume("全部"); setDomain("all"); }}>清除筛选</button></div>
          )}
        </section>

        <section className="textbook-usage-note" id="usage-note">
          <div><BookOpenText size={28} /><span><small>ORIGINAL LEARNING VISUALS</small><h2>这些是原创课本式知识图解，不是教材扫描页。</h2></span></div>
          <p>章节名称用于帮助学生定位苏科版（2024）教材内容；图解由平台根据物理模型重新绘制，因此清晰、轻量，也能直接连接动态实验。若学校拥有正版教材数字资源授权，后续可在教师后台为每章补充授权页面或校本讲义。</p>
          <Link to="/student">继续自由探索 <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}

function ChapterIllustration({ kind }: { kind: ChapterIllustrationKind }) {
  return (
    <div className={`textbook-chapter-visual visual-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 560 280" role="img">
        <g className="atlas-grid">{Array.from({ length: 11 }, (_, index) => <path d={`M${30 + index * 50} 20V260`} key={`v-${index}`} />)}{Array.from({ length: 6 }, (_, index) => <path d={`M20 ${20 + index * 48}H540`} key={`h-${index}`} />)}</g>
        <path className="atlas-axis" d="M28 238H532M48 258V26" />
        {kind === "sound" && <g><path className="atlas-solid" d="M104 112h38l52-42v140l-52-42h-38z" /><path className="atlas-wave" d="M218 103c42 22 42 52 0 74M250 77c74 39 74 88 0 126M290 52c105 54 105 126 0 180" /><circle className="atlas-point" cx="194" cy="140" r="7" /></g>}
        {kind === "light" && <g><path className="atlas-ray warm" d="M70 92l192 48L70 188" /><path className="atlas-mirror" d="M264 49v182" /><path className="atlas-ray" d="M264 140l205-84M264 140l205 84" /><path className="atlas-dash" d="M264 24v232" /><circle className="atlas-point" cx="264" cy="140" r="7" /></g>}
        {kind === "lens" && <g><path className="atlas-ray warm" d="M58 82l217 58L58 198M58 140h217" /><path className="atlas-lens" d="M275 40c-38 51-38 149 0 200M275 40c38 51 38 149 0 200" /><path className="atlas-ray" d="M275 140l226-58M275 140l226 58M275 140h226" /><path className="atlas-focus" d="M434 126v28M116 126v28" /></g>}
        {kind === "thermal" && <g><path className="atlas-glass" d="M185 62v122c0 41 31 59 76 59s76-18 76-59V62M185 62h152" /><path className="atlas-liquid" d="M187 151c43-15 105 15 148 0v38c0 34-29 50-74 50s-74-16-74-50z" /><path className="atlas-thermo" d="M388 55v132M375 68h26M375 112h26M375 156h26" /><circle className="atlas-warm" cx="388" cy="205" r="20" /><circle className="atlas-bubble" cx="230" cy="133" r="10" /><circle className="atlas-bubble" cx="286" cy="112" r="7" /><path className="atlas-wave warm" d="M214 48c-15-15 15-27 0-42M268 48c-15-15 15-27 0-42M321 48c-15-15 15-27 0-42" /></g>}
        {kind === "motion" && <g><path className="atlas-track" d="M55 200h448M55 215h448" /><path className="atlas-solid" d="M132 161h102l32 39H105z" /><circle className="atlas-wheel" cx="142" cy="207" r="22" /><circle className="atlas-wheel" cx="237" cy="207" r="22" /><path className="atlas-wave" d="M92 89h320M388 72l28 17-28 17" /><path className="atlas-dash" d="M88 118h260" /></g>}
        {kind === "density" && <g><path className="atlas-scale" d="M76 195h190M171 195V83M112 91h118M112 91l-39 76h78zM230 91l-39 76h78z" /><path className="atlas-glass" d="M353 63v157h103V63M353 91h103" /><path className="atlas-liquid" d="M356 136h97v81h-97z" /><path className="atlas-solid" d="M382 130l42-13 15 50-42 13z" /><path className="atlas-dash" d="M343 84h17M343 116h17M343 148h17M343 180h17" /></g>}
        {kind === "friction" && <g><path className="atlas-rough" d="M48 206l18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14 18-14 18 14" /><rect className="atlas-block" x="187" y="104" width="175" height="92" rx="8" /><path className="atlas-wave" d="M363 140h131M471 123l26 17-26 17" /><path className="atlas-ray warm" d="M187 167H84M106 149l-26 18 26 18" /><path className="atlas-dash" d="M274 104V48M257 72l17-27 17 27" /></g>}
        {kind === "pressure" && <g><path className="atlas-glass" d="M310 54v176h164V54M312 119h160" /><path className="atlas-liquid" d="M313 121h158v107H313z" /><rect className="atlas-block" x="344" y="135" width="94" height="60" rx="5" /><path className="atlas-ray" d="M391 194v-96M374 122l17-27 17 27" /><path className="atlas-ray warm" d="M391 136V232M374 209l17 27 17-27" /><rect className="atlas-block" x="78" y="146" width="150" height="55" rx="4" /><path className="atlas-ray warm" d="M153 52v92M136 119l17 27 17-27" /><path className="atlas-dash" d="M78 211h150" /></g>}
        {kind === "lever" && <g><path className="atlas-beam" d="M70 166l425-72" /><path className="atlas-solid" d="M282 213l48-89 48 89z" /><path className="atlas-ray warm" d="M106 79v73M89 127l17 28 17-28" /><path className="atlas-ray" d="M453 62v47M436 84l17 28 17-28" /><rect className="atlas-block" x="73" y="49" width="66" height="35" rx="4" /><rect className="atlas-block" x="425" y="29" width="57" height="31" rx="4" /><circle className="atlas-point" cx="330" cy="122" r="9" /></g>}
        {kind === "circuit" && <g><path className="atlas-wire" d="M91 63h332v55M423 165v57H91V63" /><path className="atlas-battery" d="M72 105h38M65 130h52" /><path className="atlas-wire" d="M91 63v42M91 130v92" /><circle className="atlas-bulb" cx="423" cy="141" r="25" /><path className="atlas-ray" d="M411 129l24 24M435 129l-24 24" /><path className="atlas-switch" d="M222 222l62-30M284 222h59" /><circle className="atlas-point" cx="222" cy="222" r="6" /><circle className="atlas-point" cx="343" cy="222" r="6" /></g>}
        {kind === "ohm" && <g><path className="atlas-axis" d="M86 224V51M74 64l12-16 12 16M86 224h359M430 212l18 12-18 12" /><path className="atlas-graph" d="M86 224L413 70" /><circle className="atlas-point" cx="174" cy="183" r="7" /><circle className="atlas-point" cx="259" cy="143" r="7" /><circle className="atlas-point" cx="346" cy="102" r="7" /><path className="atlas-dash" d="M174 183v41M259 143v81M346 102v122" /><path className="atlas-resistor" d="M333 202h34l8-15 16 30 16-30 16 30 8-15h38" /></g>}
        {kind === "power" && <g><circle className="atlas-meter" cx="280" cy="140" r="96" /><path className="atlas-meter-tick" d="M212 171c12-45 35-69 68-69s57 24 69 69" /><path className="atlas-needle" d="M280 171l50-48" /><circle className="atlas-point" cx="280" cy="171" r="9" /><path className="atlas-bolt" d="M292 33l-41 72h34l-18 64 51-82h-36z" /><path className="atlas-dash" d="M174 224h212" /></g>}
        {kind === "magnet" && <g><path className="atlas-coil" d="M195 91c-35 0-35 98 0 98s35-98 0-98 35 98 70 98 35-98 0-98 35 98 70 98 35-98 0-98" /><path className="atlas-core" d="M140 122h273v37H140z" /><path className="atlas-field" d="M145 112C74 48 74 232 145 169M413 112c71-64 71 120 0 57M157 91C105 37 105 243 157 189M401 91c52-54 52 152 0 98" /><path className="atlas-wire" d="M195 91V49H86M370 189v42h98" /><circle className="atlas-point" cx="86" cy="49" r="7" /><circle className="atlas-point" cx="468" cy="231" r="7" /></g>}
      </svg>
      <span>ORIGINAL PHYSICS PLATE · {kind.toUpperCase()}</span>
    </div>
  );
}
