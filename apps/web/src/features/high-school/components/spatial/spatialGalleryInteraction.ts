type FrameScheduler = {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
};

const spatialProperties = ["--hs-scene-rotate-x", "--hs-scene-rotate-y", "--hs-scene-light-x", "--hs-scene-light-y"];

/** One idle-free pointer controller for the whole catalogue, never a loop per card. */
export function createSpatialGalleryInteraction(root: HTMLElement, scheduler: FrameScheduler) {
  let enabled = false;
  let disposed = false;
  let active: HTMLElement | null = null;
  let frame: number | null = null;
  let point = { x: 0, y: 0 };

  function reset() {
    if (frame !== null) scheduler.cancelFrame(frame);
    frame = null;
    if (active) {
      active.removeAttribute("data-spatial-active");
      spatialProperties.forEach(property => active!.style.removeProperty(property));
      active = null;
    }
  }

  function paint() {
    frame = null;
    if (!enabled || disposed || !active || !root.contains(active)) { reset(); return; }
    const rect = active.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) { reset(); return; }
    const x = Math.max(-1, Math.min(1, (point.x - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (point.y - rect.top) / rect.height * 2 - 1));
    active.style.setProperty("--hs-scene-rotate-x", `${(-y * 3.5).toFixed(2)}deg`);
    active.style.setProperty("--hs-scene-rotate-y", `${(x * 4.5).toFixed(2)}deg`);
    active.style.setProperty("--hs-scene-light-x", `${(50 + x * 38).toFixed(2)}%`);
    active.style.setProperty("--hs-scene-light-y", `${(45 + y * 26).toFixed(2)}%`);
    active.setAttribute("data-spatial-active", "true");
  }

  return {
    setEnabled(value: boolean) { enabled = value && !disposed; if (!enabled) reset(); },
    move(target: HTMLElement | null, clientX: number, clientY: number, pointerType: string) {
      if (!enabled || disposed || pointerType !== "mouse" || !target || !root.contains(target)
        || !Number.isFinite(clientX) || !Number.isFinite(clientY)) { reset(); return; }
      if (active !== target) { reset(); active = target; }
      point = { x: clientX, y: clientY };
      if (frame === null) frame = scheduler.requestFrame(paint);
    },
    reset,
    dispose() { disposed = true; enabled = false; reset(); },
  };
}
