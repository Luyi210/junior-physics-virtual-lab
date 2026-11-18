import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { createSpatialGalleryInteraction } from "./spatialGalleryInteraction";

/** Decorative depth only: controls, labels and experiment state remain outside it. */
export function SpatialExperimentGallery({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const interaction = useRef<ReturnType<typeof createSpatialGalleryInteraction> | null>(null);

  useEffect(() => {
    if (!root.current || typeof window.matchMedia !== "function") return;
    const controller = createSpatialGalleryInteraction(root.current, {
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: handle => window.cancelAnimationFrame(handle),
    });
    interaction.current = controller;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => controller.setEnabled(fine.matches && !reduced.matches && !document.hidden);
    fine.addEventListener("change", update);
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("blur", controller.reset);
    update();
    return () => {
      controller.dispose();
      fine.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("blur", controller.reset);
      if (interaction.current === controller) interaction.current = null;
    };
  }, []);

  // Filtering may remove a hovered card while this shared gallery remains mounted.
  useEffect(() => { interaction.current?.reset(); }, [children]);

  function move(event: PointerEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-spatial-stage]") : null;
    interaction.current?.move(target, event.clientX, event.clientY, event.pointerType);
  }
  const reset = () => interaction.current?.reset();

  return <div ref={root} className="hs-experiment-grid" id="hs-experiment-results" data-spatial-gallery="true"
    onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onPointerDown={reset} onFocusCapture={reset}>
    {children}
  </div>;
}
