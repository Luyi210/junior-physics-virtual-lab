import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { corgiAvatarAsset, corgiSourceUrl } from "./corgiAvatars";
import type { useCorgiAvatarRotation } from "./useCorgiAvatarRotation";

export function CorgiAvatarControls({ rotation }: { rotation: ReturnType<typeof useCorgiAvatarRotation> }) {
  return <details className="lili-avatar-controls">
    <summary><span className="lili-avatar-number" aria-hidden="true">{String(rotation.index + 1).padStart(2, "0")}<span> / 05</span></span><span className="lili-avatar-choice"><span>力力形象 · {corgiAvatarAsset(rotation.index).label}</span><small>{rotation.automatic ? "聊天时暂停轮换" : "保持当前形象"}</small></span></summary>
    <div className="lili-avatar-actions" role="group" aria-label="选择力力形象" onKeyDown={event => {
      // Native buttons remain the primary keyboard controls; arrows are an optional shortcut.
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); rotation.previous(); }
      if (event.key === "ArrowRight") { event.preventDefault(); rotation.next(); }
    }}>
      <button type="button" onClick={rotation.previous} aria-label="上一张力力形象"><ChevronLeft size={15} aria-hidden="true" />上一张</button>
      <button type="button" onClick={rotation.next} aria-label="下一张力力形象">下一张<ChevronRight size={15} aria-hidden="true" /></button>
      <button type="button" onClick={rotation.toggleAutomatic} aria-pressed={rotation.automatic} aria-label={rotation.automatic ? "关闭形象自动轮换" : "开启形象自动轮换"}>{rotation.automatic ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}自动轮换</button>
    </div>
    <p>{rotation.status}。手动选图后保持当前形象。</p>
    <a href={corgiSourceUrl()} target="_blank" rel="noreferrer">形象来源</a>
  </details>;
}
