import {
  ArrowRight,
  Atom,
  Beaker,
  CircuitBoard,
  Flame,
  Focus,
  GraduationCap,
  Presentation,
  Ruler,
  Sparkles,
  Waves
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";
import type { PhysicsField } from "../../components/PhysicsFieldMotif";
import { DashboardPhysicsCanvas } from "../student/DashboardPhysicsCanvas";

interface LabCard {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: string;
  path: string;
  field: PhysicsField;
}

const labs: LabCard[] = [
  { title: "光现象探索岛", subtitle: "色散 · 传播 · 反射 · 折射", icon: Focus, tone: "cyan", path: "/student/explore/light", field: "light" },
  { title: "声音实验场", subtitle: "振动 · 音调 · 响度", icon: Waves, tone: "blue", path: "/student/explore/sound", field: "sound" },
  { title: "杠杆平衡", subtitle: "力 · 力臂 · 力矩", icon: Ruler, tone: "green", path: "/student/explore/mechanics", field: "mechanics" },
  { title: "自由电路", subtitle: "串联 · 并联 · 电流", icon: CircuitBoard, tone: "red", path: "/student/explore/circuit", field: "circuit" },
  { title: "水的沸腾", subtitle: "加热 · 温度 · 图像", icon: Flame, tone: "orange", path: "/student/explore/thermal", field: "thermal" },
  { title: "密度探究", subtitle: "质量 · 体积 · 材料", icon: Beaker, tone: "violet", path: "/student/explore/measurement", field: "measurement" }
];

export function HomePage() {
  return (
    <div className="home-page">
      <header className="home-nav">
        <BrandMark />
        <nav aria-label="主导航">
          <Link to="/student">学生端</Link>
          <Link to="/teacher">教师端</Link>
          <a href="#labs">领域目录</a>
          <a href="#architecture">平台能力</a>
          <span className="version-chip"><span /> 本地演算核心已就绪</span>
        </nav>
      </header>

      <main>
        <section className="hero-lab">
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={16} /> 下一代初中物理实验环境</p>
            <h1>让规律不再只是<br /><em>写在黑板上。</em></h1>
            <p className="hero-description">
              拖动、连接、测量、记录。把每一个抽象公式，变成学生可以亲手改变的实验现场。
            </p>
            <div className="portal-entry-grid" aria-label="选择使用端口">
              <Link className="portal-entry student-entry" to="/student">
                <i><GraduationCap size={22} /></i>
                <span><small>PORT 01 / STUDENT</small><strong>进入学生探究端</strong><em>自由选择领域和实验</em></span>
                <ArrowRight size={19} />
              </Link>
              <Link className="portal-entry teacher-entry" to="/teacher">
                <i><Presentation size={22} /></i>
                <span><small>PORT 02 / TEACHER</small><strong>进入教师端</strong><em>课程组织与数据功能规划中</em></span>
                <ArrowRight size={19} />
              </Link>
            </div>
            <p className="entry-model-note"><strong>一个平台，两个端口：</strong>学生端负责开放实验与自主探究；教师端负责未来的课程组织、课堂演示和学习数据。凸透镜精密实验台属于学生端的光学工具，不再单独占用平台入口。</p>
            <dl className="hero-stats">
              <div><dt>02</dt><dd>学生端与教师端</dd></div>
              <div><dt>06</dt><dd>已开放实验领域</dd></div>
              <div><dt>100%</dt><dd>网页端本地计算</dd></div>
            </dl>
            <PhysicsFieldMotif field="mixed" className="home-field-atlas" />
          </div>

          <div className="hero-instrument home-live-physics">
            <div className="instrument-grid" />
            <DashboardPhysicsCanvas />
            <div className="formula-plate">
              <span>PHYSICS LIVE CANVAS / 动态物理画布</span>
              <strong>观察运动，再进入实验改变条件</strong>
              <small>Canvas 实时绘制 · 本地运行</small>
            </div>
          </div>
        </section>

        <section className="lab-library" id="labs">
          <div className="section-heading">
            <div>
              <span>STUDENT SPACE / 01—06 · ALL OPEN</span>
              <h2>学生探索空间 · 六个物理领域</h2>
            </div>
            <p>下面六张卡片都属于“学生探索空间”，不是六个独立平台。选择领域后，再进入其中的动态实验。</p>
          </div>
          <div className="lab-grid">
            {labs.map((lab, index) => {
              const Icon = lab.icon;
              const content = (
                <>
                  <PhysicsFieldMotif field={lab.field} className="lab-card-physics" />
                  <div className={`lab-icon tone-${lab.tone}`}><Icon size={25} /></div>
                  <span className="lab-number">0{index + 1}</span>
                  <div className="lab-card-copy">
                    <h3>{lab.title}</h3>
                    <p>{lab.subtitle}</p>
                  </div>
                  <span className="lab-status ready">动态开放 · 进入实验</span>
                  <ArrowRight className="card-arrow" size={19} />
                </>
              );
              return <Link className="lab-card active-card" to={lab.path} key={lab.title}>{content}</Link>;
            })}
          </div>
        </section>

        <section className="architecture-band" id="architecture">
          <div className="architecture-title">
            <Atom size={30} />
            <div><span>MODEL–VIEW SEPARATION</span><h2>为前后端扩展准备的实验内核</h2></div>
          </div>
          <div className="architecture-steps">
            <div><b>01</b><strong>场景状态</strong><span>元件位置、参数、连接</span></div>
            <div><b>02</b><strong>物理核心</strong><span>独立 TypeScript 计算包</span></div>
            <div><b>03</b><strong>交互视图</strong><span>React + Konva 场景图</span></div>
            <div><b>04</b><strong>数据契约</strong><span>前后端共享类型定义</span></div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <BrandMark />
        <p>基于课程标准重新设计 · 不依赖 PhET 源码与素材</p>
      </footer>
    </div>
  );
}
