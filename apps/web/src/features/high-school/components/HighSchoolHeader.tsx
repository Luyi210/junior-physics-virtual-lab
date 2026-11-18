import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { scrollToWorkbenchSection } from "./WorkbenchChrome";
import "../styles/HighSchoolTypography.css";

export function HighSchoolHeader({ experiment = false }: { experiment?: boolean }) {
  return <><button className="hs-skip-link" type="button" onClick={() => scrollToWorkbenchSection(experiment ? "hs-stage" : "hs-catalog")}>跳到{experiment ? "实验操作" : "实验目录"}</button><header className="hs-header">
    <Link className="hs-brand" to="/high-school" aria-label="高中物理实验室首页">
      <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14.5" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".35" /><circle cx="20" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="20" cy="20" rx="18" ry="6" transform="rotate(-35 20 20)" fill="none" stroke="currentColor" strokeWidth="1.2" /><circle cx="20" cy="20" r="3" fill="currentColor" /><circle cx="34" cy="10" r="1.7" fill="#ffbd73" /><path d="M20 1v5m0 28v5M1 20h5m28 0h5" stroke="currentColor" strokeWidth="1.2" /></svg>
      <span>格物<small>高中物理实验室<br />PHYSICS LAB</small></span>
    </Link>
    <span className="hs-header-method" aria-hidden="true"><span><small>01</small>观察</span><i /><span><small>02</small>推演</span><i /><span><small>03</small>验证</span></span>
    <nav aria-label="高中专区导航">
      <Link to={experiment ? "/high-school" : "/"}><ArrowLeft size={15} />{experiment ? "实验目录" : "平台首页"}</Link>
      <button type="button" onClick={() => scrollToWorkbenchSection(experiment ? "hs-evidence" : "hs-catalog")}>{experiment ? "实验记录" : "探索课程"}<ArrowUpRight size={15} /></button>
    </nav>
  </header></>;
}
