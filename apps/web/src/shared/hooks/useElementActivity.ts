import { useEffect, useState } from "react";
import type { RefObject } from "react";

/**
 * 只让视口附近且浏览器标签可见的重动画继续运行。
 * 页面首次渲染时保持 active，避免 Canvas 在观察器回调前出现空白。
 */
export function useElementActivity<T extends Element>(ref: RefObject<T | null>, rootMargin = "180px") {
  const [nearViewport, setNearViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setNearViewport(Boolean(entry?.isIntersecting)), { rootMargin, threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return nearViewport && pageVisible;
}
