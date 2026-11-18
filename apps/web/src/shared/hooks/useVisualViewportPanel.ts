import { useEffect, useState, type CSSProperties } from "react";

type PanelViewportStyle = CSSProperties & Partial<Record<`--panel-viewport-${"top" | "left" | "width" | "height"}`, string>>;

/** Match the visible area above a phone keyboard; never counteract pinch zoom. */
export function readPanelViewport(target: Window): PanelViewportStyle | null {
  const viewport = target.visualViewport;
  if (viewport && viewport.scale > 1.01) return null;
  const width = viewport?.width ?? target.innerWidth;
  const height = viewport?.height ?? target.innerHeight;
  if (!(width > 0 && height > 0)) return null;
  return {
    "--panel-viewport-top": `${Math.max(0, viewport?.offsetTop ?? 0)}px`,
    "--panel-viewport-left": `${Math.max(0, viewport?.offsetLeft ?? 0)}px`,
    "--panel-viewport-width": `${width}px`,
    "--panel-viewport-height": `${height}px`,
  };
}

export function observePanelViewport(target: Window, update: (style: PanelViewportStyle) => void) {
  let frame: number | undefined;
  const publish = () => {
    frame = undefined;
    const next = readPanelViewport(target);
    if (next) update(next);
  };
  const schedule = () => {
    if (frame !== undefined) return;
    if (typeof target.requestAnimationFrame === "function") frame = target.requestAnimationFrame(publish);
    else publish();
  };
  const viewport = target.visualViewport;
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  target.addEventListener("resize", schedule);
  publish();
  return () => {
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    target.removeEventListener("resize", schedule);
    if (frame !== undefined) target.cancelAnimationFrame(frame);
  };
}

/** Only open panels subscribe. These variables are consumed by mobile CSS only. */
export function useVisualViewportPanel(active: boolean): CSSProperties {
  const [style, setStyle] = useState<PanelViewportStyle>({});
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    return observePanelViewport(window, next => setStyle(previous =>
      Object.keys(next).every(key => previous[key as keyof PanelViewportStyle] === next[key as keyof PanelViewportStyle]) ? previous : next
    ));
  }, [active]);
  return active ? style : {};
}
