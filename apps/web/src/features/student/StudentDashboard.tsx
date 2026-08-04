import { ArrowRight, Beaker, BookOpenText, CircuitBoard, CircleDot, Compass, Flame, Focus, Lightbulb, MessageCircleQuestion, Network, PencilLine, Ruler, SendHorizontal, Sparkles, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";
import type { PhysicsField } from "../../components/PhysicsFieldMotif";
import { OrangeCatAvatar, shuffleOrangeCatAvatar, useOrangeCatAvatarLabel } from "../harness/OrangeCatAvatar";
import { DashboardPhysicsCanvas } from "./DashboardPhysicsCanvas";
import type { DashboardPhysicsScene } from "./DashboardPhysicsCanvas";
import { knowledgeGraphQuestions, physicsGraphDomains, physicsKnowledgeGraphStats, searchPhysicsKnowledgeGraph } from "./physicsKnowledgeGraph";
import type { KnowledgeGraphSearchResult, PhysicsGraphDomain } from "./physicsKnowledgeGraph";

interface DiscoveryField {
  key: Exclude<PhysicsField, "mixed">;
  number: string;
  title: string;
  chapter: string;
  note: string;
  count: string;
  question: string;
  icon: LucideIcon;
  color: string;
  preview: DashboardPhysicsScene;
  previewLabel: string;
}

const fields: DiscoveryField[] = [
  { key: "light", number: "01", title: "光现象", chapter: "八上 · 第二、三章", note: "传播、反射、折射、色散与透镜成像", count: "15 个实验", question: "白光为什么能变成彩虹？", icon: Focus, color: "#36bfa8", preview: "light", previewLabel: "白光通过三棱镜" },
  { key: "sound", number: "02", title: "声现象", chapter: "八上 · 第一章", note: "声音的产生、传播、特性与听不见的声", count: "4 个实验", question: "真空中为什么听不到声音？", icon: Waves, color: "#4d9ed4", preview: "sound", previewLabel: "振动形成传播波" },
  { key: "mechanics", number: "03", title: "运动与力", chapter: "八上、八下、九上", note: "速度、摩擦、杠杆、压强与浮力", count: "5 个实验", question: "小小的力怎样撬起重物？", icon: Ruler, color: "#d79b2f", preview: "mechanics", previewLabel: "杠杆两侧的转动效果" },
  { key: "circuit", number: "04", title: "电与磁", chapter: "九上、九下", note: "电路连接、欧姆定律、电功率与电磁铁", count: "4 个实验", question: "电流在并联电路里怎样分路？", icon: CircuitBoard, color: "#e4614b", preview: "circuit", previewLabel: "电流沿闭合路径运动" },
  { key: "thermal", number: "05", title: "热与物态", chapter: "八上 · 第四章", note: "温度、沸腾、熔化与蒸发现象", count: "4 个实验", question: "水沸腾后为何不再升温？", icon: Flame, color: "#dc7b34", preview: "thermal", previewLabel: "加热与粒子运动" },
  { key: "measurement", number: "06", title: "质量与密度", chapter: "八下 · 第六章", note: "天平、量筒、质量体积关系与密度", count: "4 个实验", question: "不规则石块的体积怎样测量？", icon: Beaker, color: "#8b72ce", preview: "density", previewLabel: "天平与量筒测密度" }
];

function DashboardCatGuide() {
  const [question, setQuestion] = useState("");
  const [recommendation, setRecommendation] = useState<KnowledgeGraphSearchResult>();
  const avatarLabel = useOrangeCatAvatarLabel();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) shuffleOrangeCatAvatar();
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  const ask = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setQuestion(next);
    setRecommendation(searchPhysicsKnowledgeGraph(next));
    shuffleOrangeCatAvatar();
  };

  const submitQuestion = (event: FormEvent) => {
    event.preventDefault();
    ask(question);
  };

  return <section className="dashboard-cat-guide" aria-label="光光学习小助手">
    <div className="dashboard-cat-portrait"><OrangeCatAvatar key={avatarLabel} mood={recommendation?.found ? "celebrating" : recommendation ? "listening" : "idle"} /><button type="button" onClick={shuffleOrangeCatAvatar} title="立即更换光光形象"><i />{avatarLabel} · 换一只</button></div>
    <div className="dashboard-cat-copy">
      <span>PHYSICS KNOWLEDGE GRAPH / 光光学习小助手</span>
      <h3>{recommendation?.title ?? "有自己的问题？让光光帮你找到合适的实验。"}</h3>
      <p>{recommendation?.message ?? `把生活现象、实验器材或变化写下来。光光会在 ${physicsKnowledgeGraphStats.experiments} 个实验节点中寻找概念关系，但不会直接替你给出结论。`}</p>
      {recommendation?.to && <Link to={recommendation.to}>{recommendation.action} <ArrowRight size={15} /></Link>}
    </div>
    <form onSubmit={submitQuestion}>
      <label htmlFor="student-custom-question"><MessageCircleQuestion size={16} />我的自定义问题</label>
      <div><input id="student-custom-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：为什么雨后会出现彩虹？" /><button type="submit" disabled={!question.trim()}><SendHorizontal size={16} />问问光光</button></div>
      <small><Lightbulb size={13} />本地知识图谱检索，不调用大语言模型</small>
    </form>

    {recommendation && <div className={`dashboard-knowledge-result ${recommendation.found ? "found" : "needs-clue"}`}>
      <header><Network size={19} /><span><small>LOCAL GRAPH REASONING / 本地关联路径</small><strong>{recommendation.found ? `匹配可信度 ${recommendation.confidence}%` : "等待更多线索"}</strong></span></header>
      <div className="knowledge-trail" aria-label="知识图谱匹配路径">
        {recommendation.trail.map((item, index) => <span key={`${item}-${index}`}><b>{item}</b>{index < recommendation.trail.length - 1 && <ArrowRight size={13} />}</span>)}
      </div>
      {recommendation.matchedTerms.length > 0 && <div className="knowledge-matches"><small>从问题中识别</small>{recommendation.matchedTerms.map((term) => <b key={term}><CircleDot size={11} />{term}</b>)}</div>}
      <section className="knowledge-alternatives"><span>相邻知识与其他可能</span><div>{recommendation.alternatives.map((item) => <Link to={item.to} key={`${item.to}-${item.title}`}><strong>{item.title}</strong><small>{item.reason}</small><ArrowRight size={14} /></Link>)}</div></section>
      <section className="knowledge-follow-ups"><span>光光建议继续追问</span><div>{recommendation.followUps.map((item) => <button type="button" onClick={() => ask(item)} key={item}>{item}</button>)}</div></section>
    </div>}
  </section>;
}

export function StudentDashboard() {
  const [questionDomain, setQuestionDomain] = useState<"all" | PhysicsGraphDomain>("all");
  const visibleQuestions = questionDomain === "all" ? knowledgeGraphQuestions : knowledgeGraphQuestions.filter((question) => question.domain === questionDomain);

  return (
    <div className="explore-page discovery-home">
      <header className="explore-header">
        <Link to="/"><BrandMark /></Link>
        <nav aria-label="学生探索导航">
          <Link className="active" to="/student">探索首页</Link>
          <a href="#fields">六个领域</a>
          <a href="#questions">问题入口</a>
          <a href="#guangguang">问问光光</a>
          <Link to="/student/notebook">实验记录本</Link>
          <Link to="/lab/lens">精密实验台</Link>
        </nav>
        <div className="explorer-id"><span>当前模式</span><b>自由探索</b><i>探</i></div>
      </header>

      <main>
        <section className="discovery-home-hero">
          <div className="discovery-home-copy">
            <p><Sparkles size={17} /> OPEN DISCOVERY SPACE / 学生探索空间</p>
            <h1>从一个<em>问题</em>开始，<br />用实验把猜想变成证据。</h1>
            <span>六个领域属于同一个开放平台。没有规定顺序，也没有必做任务；学生通过改变条件、观察现象和解释证据，逐渐形成自己的物理观念。</span>
            <div className="discovery-route-line" aria-label="平台使用路径">
              <b>01 提出问题</b><ArrowRight size={16} /><b>02 作出猜想</b><ArrowRight size={16} /><b>03 操作实验</b><ArrowRight size={16} /><b>04 寻找证据</b><ArrowRight size={16} /><b>05 形成解释</b>
            </div>
          </div>
          <div className="discovery-home-atlas">
            <DashboardPhysicsCanvas />
            <span className="physics-canvas-live"><i />PHYSICS LIVE CANVAS</span>
          </div>
        </section>

        <section className="discovery-field-section" id="fields">
          <header className="discovery-section-title">
            <div><span>01—06 / ALL FIELDS</span><h2>先看动态现象，再选择物理领域</h2></div>
            <p>每张卡片都有一个持续运行的实验预览。点击卡片后进入该领域，再自由选择具体实验。</p>
          </header>
          <div className="discovery-field-grid">
            {fields.map((field) => {
              const Icon = field.icon;
              return (
                <Link
                  className={`discovery-field-card field-${field.key}`}
                  style={{ "--field-accent": field.color } as CSSProperties}
                  to={`/student/explore/${field.key}`}
                  key={field.key}
                >
                  <PhysicsFieldMotif field={field.key} className="discovery-field-motif" />
                  <div className="discovery-card-top"><b>{field.number}</b><span>{field.count}</span></div>
                  <div className="discovery-field-preview">
                    <DashboardPhysicsCanvas sceneKey={field.preview} compact />
                    <strong>{field.previewLabel}</strong>
                  </div>
                  <div className="discovery-field-title"><i><Icon size={23} /></i><span><small>{field.chapter}</small><h2>{field.title}</h2></span></div>
                  <p>{field.note}</p>
                  <blockquote>{field.question}</blockquote>
                  <strong className="discovery-field-enter">查看实验目录 <ArrowRight size={16} /></strong>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="discovery-question-section" id="questions">
          <div className="discovery-question-heading">
            <span>START WITH A QUESTION</span>
            <h2>也可以不按章节，直接追一个好奇的问题。</h2>
            <p>问题库由实验知识图谱生成，覆盖概念、器材、生活现象和观察证据。点击问题会进入对应实验，答案仍需通过操作寻找。</p>
            <div className="knowledge-graph-stats"><span><b>{physicsKnowledgeGraphStats.experiments}</b>实验节点</span><span><b>{physicsKnowledgeGraphStats.signals}</b>现象线索</span><span><b>{physicsKnowledgeGraphStats.relations}</b>知识关联</span></div>
            <b>{String(visibleQuestions.length).padStart(2, "0")} 个问题入口 · 当前筛选</b>
          </div>
          <div className="knowledge-question-browser">
            <nav className="knowledge-domain-filter" aria-label="按物理领域筛选问题">
              <button className={questionDomain === "all" ? "active" : ""} onClick={() => setQuestionDomain("all")}>全部 <b>{knowledgeGraphQuestions.length}</b></button>
              {(Object.entries(physicsGraphDomains) as Array<[PhysicsGraphDomain, (typeof physicsGraphDomains)[PhysicsGraphDomain]]>).map(([key, domain]) => <button className={questionDomain === key ? "active" : ""} onClick={() => setQuestionDomain(key)} key={key}>{domain.label} <b>{knowledgeGraphQuestions.filter((question) => question.domain === key).length}</b></button>)}
            </nav>
            <div className="discovery-question-list">
              {visibleQuestions.map((question) => <Link to={question.to} key={question.text}><b>{question.mark}</b><span>{question.text}</span><ArrowRight size={16} /></Link>)}
            </div>
          </div>
        </section>

        <div id="guangguang"><DashboardCatGuide /></div>

        <section className="dashboard-notebook-entry">
          <div className="dashboard-notebook-icon"><BookOpenText size={38} /><i /><i /><i /></div>
          <div><span>EXPERIMENT NOTEBOOK / 实验记录本</span><h2>做过的操作会留下轨迹，真正的收获由你亲自写下。</h2><p>自动整理实验次数、参数变化和已保存观察，再用“我做了什么、我观察到什么、我学到了什么、我还想知道”完成自己的探究记录。</p></div>
          <aside><PencilLine size={20} /><strong>不是任务打卡</strong><small>没有规定篇数，可以随时补充或修改。</small></aside>
          <Link to="/student/notebook">打开我的记录本 <ArrowRight size={17} /></Link>
        </section>

        <section className="discovery-tool-note">
          <div><Compass size={24} /><span><small>OPTICS / ADVANCED TOOL</small><strong>光学探究需要精确读数时，可以进入凸透镜精密实验台。</strong></span></div>
          <p>它属于学生探究端中的光学高级工具，与放大镜、照相机和人眼成像等实验处于同一学习体系。</p>
          <Link to="/lab/lens">打开精密实验台 <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}
