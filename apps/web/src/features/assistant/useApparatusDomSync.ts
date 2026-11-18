import { useEffect } from "react";
import { captureApparatusSnapshotFromDom } from "./tutorialBridge";

/**
 * 为没有显式状态适配器的实验提供低频 DOM 状态同步。
 * 用户操作后快速更新；静置时降频；标签页隐藏时完全暂停。
 */
export function useApparatusDomSync(module: string | undefined, rootSelector: string) {
  useEffect(() => {
    if (!module) return;
    let debounceTimer = 0;

    const capture = () => {
      if (document.visibilityState === "hidden") return;
      captureApparatusSnapshotFromDom(module, rootSelector);
    };
    const scheduleCapture = (delay = 120) => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(capture, delay);
    };
    const onInteraction = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest(rootSelector)) return;
      scheduleCapture();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleCapture(80);
    };

    scheduleCapture(60);
    const interval = window.setInterval(capture, 1500);
    document.addEventListener("input", onInteraction, true);
    document.addEventListener("change", onInteraction, true);
    document.addEventListener("pointerup", onInteraction, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(debounceTimer);
      window.clearInterval(interval);
      document.removeEventListener("input", onInteraction, true);
      document.removeEventListener("change", onInteraction, true);
      document.removeEventListener("pointerup", onInteraction, true);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [module, rootSelector]);
}
