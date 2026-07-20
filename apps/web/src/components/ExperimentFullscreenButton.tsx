import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
import { useHarnessStore } from "../features/harness/harnessStore";

interface ExperimentFullscreenButtonProps {
  targetSelector: string;
  experiment: string;
  className?: string;
  label?: string;
  hint?: string;
  title?: string;
}

export function ExperimentFullscreenButton({
  targetSelector,
  experiment,
  className = "experiment-fullscreen-trigger",
  label = "全屏工作台",
  hint = "画面与控制台一起放大",
  title = "全屏边操作边观察"
}: ExperimentFullscreenButtonProps) {
  const recordHarness = useHarnessStore((state) => state.record);
  const [fullscreenTarget, setFullscreenTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const element = document.fullscreenElement;
      setFullscreenTarget(element instanceof HTMLElement && element.matches(targetSelector) ? element : null);
    };
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [targetSelector]);

  const enter = async () => {
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!target?.requestFullscreen) return;
    try {
      await target.requestFullscreen();
      recordHarness("view.changed", { experiment, view: "fullscreen", action: "enter" });
    } catch {
      recordHarness("view.changed", { experiment, view: "fullscreen", action: "unavailable" });
    }
  };

  const exit = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    recordHarness("view.changed", { experiment, view: "fullscreen", action: "exit" });
  };

  return <>
    <button className={`experiment-fullscreen-control ${className}`} onClick={enter} title={title} aria-label={title}>
      <Maximize2 size={18} />
      <span><strong>{label}</strong><small>{hint}</small></span>
    </button>
    {fullscreenTarget && createPortal(<button className="experiment-fullscreen-exit" onClick={exit}><Minimize2 size={18} />退出全屏</button>, fullscreenTarget)}
  </>;
}
