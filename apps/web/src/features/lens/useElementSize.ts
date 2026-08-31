import { useEffect, useRef, useState } from "react";

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 900, height: 600 });

  useEffect(() => {
    if (!ref.current) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        setSize((current) => current.width === width && current.height === height ? current : { width, height });
      });
    });
    observer.observe(ref.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return { ref, size };
}
