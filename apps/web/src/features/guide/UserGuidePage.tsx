import { ArrowLeft, ArrowRight, BookOpenText, Download, FlaskConical, GraduationCap, HelpCircle, MonitorSmartphone, Presentation, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import "./UserGuidePage.css";

const sections = [
  { id: "start", label: "快速开始" },
  { id: "junior", label: "初中探索" },
  { id: "senior", label: "高中实验" },
  { id: "assistants", label: "光光与力力" },
  { id: "teacher", label: "教师演示" },
  { id: "records", label: "记录与数据" },
  { id: "mobile", label: "手机使用" },
  { id: "questions", label: "常见问题" }
] as const;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Steps({ items }: { items: readonly string[] }) {
  return <ol className="guide-steps">{items.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol>;
}

export function UserGuidePage() {
  return <div className="user-guide-page">
    <header className="guide-topbar">
      <Link to="/" className="guide-back"><ArrowLeft size={17} />返回平台首页</Link>
      <span><BookOpenText size={18} />格物实验室 · 使用指南</span>
      <button type="button" onClick={() => window.print()}><Download size={16} />打印 / 保存 PDF</button>
    </header>

    <main className="guide-shell">
      <section className="guide-hero" aria-labelledby="guide-title">
        <div className="guide-hero-copy">
          <span className="guide-kicker"><Sparkles size={15} /> GET STARTED / 2026.11</span>
          <h1 id="guide-title">先动手，再发现。<br /><em>这份指南陪你开始。</em></h1>
          <p>按你的使用身份找到入口，照着步骤完成第一项实验。网页演示中的记录保存在当前浏览器；需要学校账号和班级任务时，须连接独立教学后台。</p>
          <div className="guide-hero-actions"><button type="button" onClick={() => scrollToSection("start")}>三步开始 <ArrowRight size={16} /></button><button type="button" onClick={() => scrollToSection("records")}>先了解数据保存</button></div>
        </div>
        <div className="guide-orbit" aria-hidden="true"><span className="guide-orbit-ring ring-a" /><span className="guide-orbit-ring ring-b" /><span className="guide-orbit-core"><FlaskConical size={38} /></span><i className="guide-orbit-dot dot-a" /><i className="guide-orbit-dot dot-b" /><small>OBSERVE · CHANGE · RECORD</small></div>
      </section>

      <nav className="guide-index" aria-label="使用指南目录">{sections.map((section) => <button key={section.id} type="button" onClick={() => scrollToSection(section.id)}>{section.label}</button>)}</nav>

      <section id="start" className="guide-section">
        <div className="guide-section-heading"><span>01 / FIRST VISIT</span><h2>第一次使用，从这里开始</h2><p>打开首页后，可以按学习阶段或教学身份进入。访客可直接体验公开实验。</p></div>
        <div className="guide-route-grid">
          <Link to="/student"><GraduationCap size={27} /><small>初中学生</small><strong>探索六大领域</strong><span>从光、声、力、电、热与密度实验开始。</span><ArrowRight size={17} /></Link>
          <Link to="/high-school"><FlaskConical size={27} /><small>高中学生</small><strong>进入高中实验室</strong><span>选择实验，调节变量并观察读数与图像。</span><ArrowRight size={17} /></Link>
          <Link to="/teacher"><Presentation size={27} /><small>教师</small><strong>查看教学演示</strong><span>体验备课与课堂工作台；真实班级需要后台。</span><ArrowRight size={17} /></Link>
        </div>
      </section>

      <section id="junior" className="guide-section guide-split">
        <div className="guide-section-heading"><span>02 / JUNIOR LAB</span><h2>初中探索：选现象，改条件，写发现</h2><p>六个领域都可自由进入，没有固定闯关顺序。</p><Link className="guide-text-link" to="/student">打开初中探索 <ArrowRight size={16} /></Link></div>
        <Steps items={["在学生页选择一个领域，或从生活问题寻找对应实验。", "进入实验后拖动装置、调参数或操作开关；先预测，再一次改变一个条件。", "对照画面、读数和图像，向光光提问；把自己的观察与疑问写入实验记录本。"]} />
      </section>

      <section id="senior" className="guide-section guide-split">
        <div className="guide-section-heading"><span>03 / SENIOR LAB</span><h2>高中实验：让证据支持结论</h2><p>实验台提供二维装置、部分三维视图、变量控制、图像与本机读数记录。</p><Link className="guide-text-link" to="/high-school">打开高中实验室 <ArrowRight size={16} /></Link></div>
        <div><Steps items={["从实验目录选择实验，先阅读实验目标与适用条件。", "调整一个变量，使用播放、暂停、慢放或时间轴观察过程；这些控制仅改变观看方式。", "保存读数，比较不同条件，再写出带有条件和证据的结论。"]} /><div className="guide-callout"><strong>题目可视化的范围</strong><p>可粘贴题目，当前仅对符合格式的抛体运动和弹簧静态平衡题生成可计算场景。缺少必要数值、单位或超出支持题型时，页面会提示补充或更换题目。</p><Link to="/high-school/problems">试用题目可视化 <ArrowRight size={15} /></Link></div></div>
      </section>

      <section id="assistants" className="guide-section">
        <div className="guide-section-heading"><span>04 / EXPERIMENT COMPANIONS</span><h2>光光与力力怎么用</h2><p>两位助手根据当前实验与已支持的知识提供方法提示。重要结论仍要对照装置、读数和教材核实。</p></div>
        <div className="guide-two-up"><article><span>初中 · 光光</span><h3>卡在实验操作时，问光光</h3><p>进入初中实验页后打开光光。可以问“下一步改变什么”“为什么图像变了”，也可以请它帮你寻找已支持的实验、检查观察表述。</p></article><article><span>高中 · 力力</span><h3>需要变量和证据提醒时，问力力</h3><p>在高中专区打开力力，可查看当前实验状态、变量提示、记录复盘和误差分析。输题找实验只覆盖已支持的题型与实验。</p></article></div>
        <p className="guide-footnote">草图白板供自己画图，助手不会识别你画的具体线条；情境同桌使用预设教学观点。网络或 AI 服务不可用时，部分回答会使用本地规则。</p>
      </section>

      <section id="teacher" className="guide-section guide-split">
        <div className="guide-section-heading"><span>05 / TEACHING SPACE</span><h2>教师端：先看演示，再接课堂</h2><p>公开网页可体验教学工作台的本地演示内容。</p><Link className="guide-text-link" to="/teacher">打开教师端 <ArrowRight size={16} /></Link></div>
        <div><Steps items={["从首页进入教师端，在演示模式查看教学总览、备课和课堂页面。", "连接真实教学后台并使用教师账号后，管理学生、班级、课例和任务。", "发布任务后，学生登录相应账号，教师再查看同步的课堂过程与报告。"]} /><div className="guide-callout"><strong>演示与真实课堂</strong><p>GitHub Pages 公开演示不连接学校账号和班级数据库。演示工作区的改动不能作为真实学生提交或教师学情数据。</p></div></div>
      </section>

      <section id="records" className="guide-section">
        <div className="guide-section-heading"><span>06 / YOUR DATA</span><h2>记录保存在哪里</h2><p>离开页面前，先确认记录所属的身份与浏览器。</p></div>
        <div className="guide-data-grid"><article><strong>初中自由探索</strong><p>记录本和学习轨迹保存在当前浏览器。可在记录本导出学习轨迹；更换浏览器或清除站点数据后，原记录不会自动出现。</p><Link to="/student/notebook">查看实验记录本 <ArrowRight size={15} /></Link></article><article><strong>高中实验</strong><p>访客、演示、账号档案在当前浏览器内分开保存。可在实验页导出 CSV；账号档案目前不会自动同步到学校后台。</p><Link to="/high-school">查看高中实验目录 <ArrowRight size={15} /></Link></article><article><strong>真实班级任务</strong><p>需要独立教学后台、学校账号和有效登录。只有明确同步成功的任务过程与报告才会进入学校数据。</p><Link to="/teacher">了解教师端 <ArrowRight size={15} /></Link></article></div>
      </section>

      <section id="mobile" className="guide-section guide-split">
        <div className="guide-section-heading"><span>07 / ON YOUR PHONE</span><h2>手机也能做实验</h2><p>在手机浏览器打开同一网站，从首页选择初中或高中。</p></div>
        <div className="guide-mobile-copy"><MonitorSmartphone size={30} /><p>高中实验在手机上优先显示可操作的二维装置；如果设备支持，也可切换三维。二维画面可按需缩小、放大或重置，画面大小不会改变物理参数和读数。横向表格可左右滑动查看。</p><p>建议使用较新的浏览器。需要保存本机记录时，避免无痕模式，并给浏览器保留站点数据空间。</p></div>
      </section>

      <section id="questions" className="guide-section">
        <div className="guide-section-heading"><span>08 / FAQ</span><h2>常见问题</h2></div>
        <div className="guide-faq"><details><summary><HelpCircle size={18} />扫二维码后能看到我在电脑上做的记录吗？</summary><p>公开演示的自由探索记录通常只在产生记录的那个浏览器中。要跨设备查看班级任务，需要接入教学后台并使用账号，且以页面显示同步成功为准。</p></details><details><summary><HelpCircle size={18} />为什么题目没有生成场景？</summary><p>题目可视化目前只支持抛体运动和弹簧静态平衡的规定输入。请检查题干是否包含所需数值和单位；其他题型可以先在实验目录寻找相关实验。</p></details><details><summary><HelpCircle size={18} />三维画面打不开怎么办？</summary><p>切换到二维装置继续操作。二维和三维使用同一组实验参数与物理读数；手机会优先使用二维。</p></details><details><summary><HelpCircle size={18} />记录保存失败怎么办？</summary><p>先保留当前页面，复制文字或导出页面提供的 CSV／学习轨迹，再重试保存。不要在导出前清除浏览器站点数据。</p></details></div>
      </section>

      <footer className="guide-footer"><span>格物实验室 · 使用指南</span><Link to="/">返回平台首页 <ArrowRight size={15} /></Link></footer>
    </main>
  </div>;
}
