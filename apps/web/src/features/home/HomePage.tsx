import {
  ArrowRight,
  Atom,
  Beaker,
  CircuitBoard,
  Compass,
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
import { PageIntroduction } from "../../components/PageIntroduction";
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
      <PageIntroduction
        pageKey="platform-home-observatory"
        eyebrow="WELCOME / 欢迎来到物理实验室"
        title="亲手改变条件，看见物理规律发生。"
        description="从生活中的好奇出发，自由选择实验，在操作、观察和记录中找到属于自己的解释。"
        points={["自由探索光、声、力、电、热与物质世界", "拖动装置、改变参数，实时观察现象", "光光助手会陪你思考，而不是直接给出答案", "把发现写进实验记录本，随时继续探究"]}
        icon={Atom}
        accent="#8cddff"
        enterLabel="开始探索"
        variant="home"
        persistence="local"
        triggerLabel="平台向导"
        steps={[
          { eyebrow: "01 / CHOOSE YOUR IDENTITY", title: "先选择你的使用身份。", description: "学生端用于探索实验、接收班级任务与保存观察；教师端用于管理账号、班级、课例和课堂证据。", points: ["学生可以登录，也可以选择游客自由探索", "教师使用真实账号进入教学工作台"], icon: GraduationCap },
          { eyebrow: "02 / TWO DISCOVERY ROUTES", title: "课堂任务与自由探索可以同时存在。", description: "教师发布的任务会给出探究问题和证据要求，但不会关闭学生自主选择其他实验的权利。", points: ["任务模式保存关键实验过程", "自由模式从好奇问题出发", "两种模式都不采用闯关排名"], icon: Compass },
          { eyebrow: "03 / EVIDENCE FIRST", title: "亲手改变条件，再用证据解释现象。", description: "平台中的数值由物理模型计算；光光只提供方法提示、记录支持和追问，不会替学生完成操作或编造结果。", points: ["改变一个变量并比较现象", "记录数据、观察和新问题", "教师依据过程证据组织后续教学"], icon: Atom }
        ]}
      />
      <header className="home-nav">
        <BrandMark />
        <nav aria-label="主导航">
          <Link to="/student">学生端</Link>
          <Link to="/teacher">教师端</Link>
          <a href="#labs">探索领域</a>
          <a href="#architecture">探究方式</a>
          <span className="version-chip"><span /> 六大领域开放探索</span>
        </nav>
      </header>

      <main>
        <section className="hero-lab">
          <div className="home-physics-atmosphere" aria-hidden="true">
            <span className="formula-a">F = ma</span>
            <span className="formula-b">λ = v / f</span>
            <span className="formula-c">ρ = m / V</span>
            <span className="formula-d">P = UI</span>
            <i className="orbit orbit-one" />
            <i className="orbit orbit-two" />
            <b className="energy-node node-one" />
            <b className="energy-node node-two" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow"><Sparkles size={16} /> PHYSICS OBSERVATORY / 初中物理探索平台</p>
            <h1>让规律不再只是<br /><em>写在黑板上。</em></h1>
            <p className="hero-description">
              拖动、连接、测量、记录。把每一个抽象公式，变成学生可以亲手改变的实验现场。
            </p>
            <div className="portal-entry-grid" aria-label="选择使用身份">
              <Link className="portal-entry student-entry" to="/student">
                <i><GraduationCap size={22} /></i>
                <span><small>FOR STUDENTS / 学生</small><strong>进入探索空间</strong><em>选择感兴趣的领域，马上动手实验</em></span>
                <ArrowRight size={19} />
              </Link>
              <Link className="portal-entry teacher-entry" to="/teacher">
                <i><Presentation size={22} /></i>
                <span><small>FOR TEACHERS / 教师</small><strong>进入教学空间</strong><em>开展实验演示，连接课堂教学</em></span>
                <ArrowRight size={19} />
              </Link>
            </div>
            <p className="entry-model-note"><strong>没有固定关卡，也没有唯一的探索路线。</strong>从一个问题出发，尝试改变条件、比较现象，用自己的证据理解物理。</p>
            <dl className="hero-stats">
              <div><dt>06</dt><dd>物理探索领域</dd></div>
              <div><dt>36</dt><dd>实验与探究主题</dd></div>
              <div><dt>∞</dt><dd>自由尝试的可能</dd></div>
            </dl>
            <PhysicsFieldMotif field="mixed" className="home-field-atlas" />
          </div>

          <div className="hero-instrument home-live-physics">
            <div className="instrument-grid" />
            <DashboardPhysicsCanvas />
            <div className="formula-plate">
              <span>WATCH · THINK · EXPLORE / 观察与发现</span>
              <strong>先看见现象，再亲手改变实验条件</strong>
              <small>切换场景，发现不同领域中的物理</small>
            </div>
          </div>
        </section>

        <section className="lab-library" id="labs">
          <div className="section-heading">
            <div>
              <span>CHOOSE YOUR CURIOSITY / 选择你的好奇</span>
              <h2>从哪一种现象开始探索？</h2>
            </div>
            <p>光为什么会转弯？声音怎样传到耳边？物体为什么浮起？选择一个领域，从真实可操作的现象中寻找答案。</p>
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
                  <span className="lab-status ready">开始探索</span>
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
            <div><span>THE WAY OF INQUIRY / 探究的路径</span><h2>每一次发现，都从亲手尝试开始</h2></div>
          </div>
          <div className="architecture-steps">
            <div><b>01</b><strong>提出问题</strong><span>从生活现象中发现好奇</span></div>
            <div><b>02</b><strong>动手实验</strong><span>改变条件并比较现象</span></div>
            <div><b>03</b><strong>记录证据</strong><span>保存数据、观察与猜想</span></div>
            <div><b>04</b><strong>形成解释</strong><span>用证据理解物理规律</span></div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <BrandMark />
        <p>让每一次操作都有回应，让每一个问题都值得探索</p>
      </footer>
    </div>
  );
}
