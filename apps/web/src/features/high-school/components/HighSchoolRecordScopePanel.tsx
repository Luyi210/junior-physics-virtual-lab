import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, UserRound } from "lucide-react";
import { getHighSchoolRecordScopeOptions, selectHighSchoolRecordScope, type HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import "./HighSchoolRecordScopePanel.css";

export function HighSchoolRecordScopePanel({ scope }: { scope: HighSchoolRecordScope }) {
  const [error, setError] = useState("");
  const options = getHighSchoolRecordScopeOptions();
  function select(channel: "student" | "teacher" | "guest") {
    try { selectHighSchoolRecordScope(channel); setError(""); }
    catch { setError("暂时无法切换档案，请检查浏览器是否允许本机存储。"); }
  }
  return <section className="hs-record-scope" data-mode={scope.mode} data-writable={scope.canWrite} aria-label="当前实验档案归属">
    <div className="hs-record-scope-title"><FolderOpen size={19} aria-hidden="true" /><div><span>当前本机档案</span><strong>{scope.label}</strong></div><b>{scope.canWrite ? "可记录" : scope.key ? "只读" : "待选择"}</b></div>
    <p>{scope.mode === "demo" ? "演示档案单独保存在这个浏览器，不使用已有账号登录状态。"
      : scope.mode === "guest" ? "访客档案由这个浏览器的使用者共用。登录后可使用独立的账号档案。"
      : scope.mode === "blocked" ? "先选择本次实验的档案归属，再保存记录。已有记录会保留在原来的档案中。"
      : scope.canWrite ? "记录按当前账号分开保存在这个浏览器，暂未同步到学校后台。"
      : "当前账号档案只读。重新登录后可继续保存，也可先导出已有记录。"}</p>
    {scope.mode !== "demo" && <div className="hs-record-scope-actions">{options.map((option) => <button type="button" key={option.channel} aria-pressed={option.selected} onClick={() => select(option.channel)}><UserRound size={14} aria-hidden="true" />{option.label}</button>)}<Link to={scope.authChannel === "teacher" ? "/teacher" : "/student"}>{scope.mode === "account" && !scope.canWrite ? "重新登录" : "管理登录身份"}</Link></div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
