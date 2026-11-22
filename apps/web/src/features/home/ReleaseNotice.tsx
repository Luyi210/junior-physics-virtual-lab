import { useState } from "react";
import { ArrowRight, Bell, X } from "lucide-react";
import { releaseNotes } from "./releaseNotes";
import "./ReleaseNotice.css";

const latest = releaseNotes[0];
const dismissedKey = "physics-lab-release-dismissed";

function hasDismissedLatest() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(dismissedKey) === latest.version;
  } catch {
    return false;
  }
}

export function ReleaseNotice() {
  const [dismissed, setDismissed] = useState(hasDismissedLatest);
  const [expanded, setExpanded] = useState(false);

  function dismiss() {
    setDismissed(true);
    setExpanded(false);
    try {
      window.localStorage.setItem(dismissedKey, latest.version);
    } catch {
      // The notice can still be dismissed for this visit if storage is blocked.
    }
  }

  return (
    <section className={`home-release ${dismissed ? "is-dismissed" : ""}`} aria-label="版本更新通知">
      <div className="home-release__bar">
        <span className="home-release__signal"><Bell size={15} aria-hidden="true" /> UPDATE LOG</span>
        {!dismissed && <p><strong>新版 · {latest.version}</strong><span>{latest.summary}</span></p>}
        <button className="home-release__open" type="button" aria-expanded={expanded} aria-controls="home-release-history" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收起更新记录" : dismissed ? "查看版本记录" : "查看更新记录"}<ArrowRight size={15} aria-hidden="true" />
        </button>
        {!dismissed && <button className="home-release__dismiss" type="button" aria-label="关闭本次版本提示" onClick={dismiss}><X size={17} aria-hidden="true" /></button>}
      </div>
      {expanded && <div className="home-release__history" id="home-release-history">
        <div className="home-release__heading"><span>RELEASE NOTES / 更新记录</span><h2>每一步更新，都看得见。</h2></div>
        <ol>
          {releaseNotes.map((release, index) => <li key={release.version}>
            <div className="home-release__meta"><span>{index === 0 ? "最新版本" : "历史版本"}</span><time dateTime={release.date}>{release.date}</time></div>
            <div className="home-release__content"><h3>{release.title}</h3><p>{release.summary}</p><ul>{release.changes.map((change) => <li key={change}>{change}</li>)}</ul></div>
            <span className="home-release__version">V {release.version}</span>
          </li>)}
        </ol>
      </div>}
    </section>
  );
}
