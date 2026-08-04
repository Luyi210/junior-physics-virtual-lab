import { ArrowLeft, ArrowRight, BarChart3, BookOpenCheck, Construction, Database, MonitorPlay, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "../../components/BrandMark";
import { PhysicsFieldMotif } from "../../components/PhysicsFieldMotif";

const teacherPlans = [
  {
    number: "01",
    icon: BookOpenCheck,
    title: "课程与实验编排",
    text: "从六个物理领域选择实验，组合成课堂演示、课前探究或课后开放活动。"
  },
  {
    number: "02",
    icon: SlidersHorizontal,
    title: "课堂参数控制",
    text: "教师可以预设初始条件、控制演示节奏，并在关键现象处暂停、比较和讲解。"
  },
  {
    number: "03",
    icon: BarChart3,
    title: "学习过程观察",
    text: "后续接入账号与后台后，汇总学生的实验操作、观察记录和常见探究问题。"
  }
];

export function TeacherDashboard() {
  return (
    <div className="teacher-page">
      <header className="teacher-nav">
        <Link to="/"><BrandMark /></Link>
        <nav aria-label="教师端导航">
          <Link to="/"><ArrowLeft size={15} />平台总入口</Link>
          <Link to="/student">查看学生端</Link>
          <a href="#teacher-plan">教师端规划</a>
        </nav>
        <span><i />框架预留中</span>
      </header>

      <main className="teacher-main">
        <section className="teacher-hero">
          <div className="teacher-hero-copy">
            <p><MonitorPlay size={17} /> TEACHER PORT / 教师端</p>
            <h1>把实验带进课堂，<br />也看见学生<em>怎样探究</em>。</h1>
            <span>教师端是平台的第二个正式端口。当前先建立清晰入口与功能边界，课程管理、班级数据和云端记录将在后端接入后逐步开放。</span>
            <div>
              <Link className="button button-primary" to="/student">查看现有学生实验 <ArrowRight size={17} /></Link>
              <a className="button button-quiet" href="#teacher-plan">查看建设规划</a>
            </div>
          </div>

          <aside className="teacher-status-board" aria-label="教师端当前建设状态">
            <PhysicsFieldMotif field="mixed" className="teacher-physics-blueprint" />
            <header><span>TEACHER CONSOLE</span><b>建设状态</b><Construction size={24} /></header>
            <dl>
              <div><dt>平台入口与页面框架</dt><dd className="ready">已建立</dd></div>
              <div><dt>学生实验内容调用</dt><dd className="ready">可查看</dd></div>
              <div><dt>教师课程编排</dt><dd>待开发</dd></div>
              <div><dt>账号、班级与云端数据</dt><dd>待后端</dd></div>
            </dl>
            <p><Database size={16} />当前不会虚构学生数据，也不会把本地浏览记录冒充为班级统计。</p>
          </aside>
        </section>

        <section className="teacher-plan" id="teacher-plan">
          <header>
            <div><span>DEVELOPMENT BLUEPRINT / 01—03</span><h2>教师端将围绕三个真实课堂需求建设</h2></div>
            <p>先复用已经完成的学生实验，再连接教师操作、学习记录和后台数据。</p>
          </header>
          <div>
            {teacherPlans.map((plan) => {
              const Icon = plan.icon;
              return <article key={plan.number}><b>{plan.number}</b><i><Icon size={25} /></i><h3>{plan.title}</h3><p>{plan.text}</p><span>功能规划中</span></article>;
            })}
          </div>
        </section>

        <section className="teacher-boundary">
          <strong>当前边界</strong>
          <p>教师端现阶段是结构入口，不包含真实账号、班级、作业和统计数据。等后端建设时，再把这些能力接入同一个端口。</p>
          <Link to="/">返回平台总入口 <ArrowRight size={15} /></Link>
        </section>
      </main>
    </div>
  );
}
