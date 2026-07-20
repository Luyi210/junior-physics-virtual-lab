import { ArrowRight, Atom, Beaker, CircuitBoard, Compass, Flame, Focus, Ruler, Sparkles, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";
import type { PhysicsField } from "../../components/PhysicsFieldMotif";
import { DashboardPhysicsCanvas } from "./DashboardPhysicsCanvas";

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
}

const fields: DiscoveryField[] = [
  { key: "light", number: "01", title: "光现象", chapter: "八上 · 第二、三章", note: "传播、反射、折射、色散与透镜成像", count: "15 个实验", question: "白光为什么能变成彩虹？", icon: Focus, color: "#36bfa8" },
  { key: "sound", number: "02", title: "声现象", chapter: "八上 · 第一章", note: "声音的产生、传播、特性与听不见的声", count: "4 个实验", question: "真空中为什么听不到声音？", icon: Waves, color: "#4d9ed4" },
  { key: "mechanics", number: "03", title: "运动与力", chapter: "八上、八下、九上", note: "速度、摩擦、杠杆、压强与浮力", count: "5 个实验", question: "小小的力怎样撬起重物？", icon: Ruler, color: "#d79b2f" },
  { key: "circuit", number: "04", title: "电与磁", chapter: "九上、九下", note: "电路连接、欧姆定律、电功率与电磁铁", count: "4 个实验", question: "电流在并联电路里怎样分路？", icon: CircuitBoard, color: "#e4614b" },
  { key: "thermal", number: "05", title: "热与物态", chapter: "八上 · 第四章", note: "温度、沸腾、熔化与蒸发现象", count: "4 个实验", question: "水沸腾后为何不再升温？", icon: Flame, color: "#dc7b34" },
  { key: "measurement", number: "06", title: "质量与密度", chapter: "八下 · 第六章", note: "天平、量筒、质量体积关系与密度", count: "4 个实验", question: "不规则石块的体积怎样测量？", icon: Beaker, color: "#8b72ce" }
];

export function StudentDashboard() {
  return (
    <div className="explore-page discovery-home">
      <header className="explore-header">
        <Link to="/"><BrandMark /></Link>
        <nav aria-label="学生探索导航">
          <Link className="active" to="/student">探索首页</Link>
          <a href="#fields">六个领域</a>
          <a href="#questions">问题入口</a>
          <Link to="/lab/lens">精密实验台</Link>
        </nav>
        <div className="explorer-id"><span>当前模式</span><b>自由探索</b><i>探</i></div>
      </header>

      <main>
        <section className="discovery-home-hero">
          <div className="discovery-home-copy">
            <p><Sparkles size={17} /> OPEN DISCOVERY SPACE / 学生探索空间</p>
            <h1>先选一个领域，<br />再从一个<em>问题</em>开始。</h1>
            <span>六个领域属于同一个开放平台。没有规定顺序，也没有必做任务；进入领域后，可以直接选择任何实验。</span>
            <div className="discovery-route-line" aria-label="平台使用路径">
              <b>01 选择领域</b><ArrowRight size={16} /><b>02 进入实验</b><ArrowRight size={16} /><b>03 操作与观察</b>
            </div>
          </div>
          <div className="discovery-home-atlas">
            <DashboardPhysicsCanvas />
            <span className="physics-canvas-live"><i />PHYSICS LIVE CANVAS</span>
          </div>
        </section>

        <section className="discovery-field-section" id="fields">
          <header className="discovery-section-title">
            <div><span>01—06 / ALL FIELDS</span><h2>选择物理领域</h2></div>
            <p>每张卡片先进入该领域的实验目录；光学和其他领域处于同一层级。</p>
          </header>
          <div className="discovery-field-grid">
            {fields.map((field) => {
              const Icon = field.icon;
              return (
                <Link
                  className={`discovery-field-card field-${field.key}`}
                  style={{ "--field-accent": field.color } as React.CSSProperties}
                  to={`/student/explore/${field.key}`}
                  key={field.key}
                >
                  <PhysicsFieldMotif field={field.key} className="discovery-field-motif" />
                  <div className="discovery-card-top"><b>{field.number}</b><span>{field.count}</span></div>
                  <i><Icon size={27} /></i>
                  <small>{field.chapter}</small>
                  <h2>{field.title}</h2>
                  <p>{field.note}</p>
                  <blockquote>{field.question}</blockquote>
                  <strong>查看实验目录 <ArrowRight size={16} /></strong>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="discovery-question-section" id="questions">
          <div className="discovery-question-heading">
            <span>START WITH A QUESTION</span>
            <h2>也可以不按章节，直接追一个好奇的问题。</h2>
            <p>问题会直接带你进入对应实验，所有参数仍可自由改变。</p>
          </div>
          <div className="discovery-question-list">
            <Link to="/student/explore/light?mode=dispersion"><b>光</b><span>白光穿过三棱镜，会在光屏上留下什么？</span><ArrowRight size={16} /></Link>
            <Link to="/student/explore/sound?module=sound-medium"><b>声</b><span>把空气慢慢抽走，声源还在振动吗？</span><ArrowRight size={16} /></Link>
            <Link to="/student/explore/mechanics?module=mechanics-lever"><b>力</b><span>移动钩码，怎样让倾斜的杠杆重新平衡？</span><ArrowRight size={16} /></Link>
            <Link to="/student/explore/circuit?module=circuit-basic"><b>电</b><span>闭合开关后，串联与并联的电流路径有何不同？</span><ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="discovery-tool-note">
          <div><Compass size={24} /><span><small>ADVANCED TOOL / 独立工具</small><strong>需要精确读数时，再进入凸透镜精密实验台。</strong></span></div>
          <p>它不是第三个学习平台，而是学生探索空间之外的高级实验工具。</p>
          <Link to="/lab/lens">打开精密实验台 <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}
