import { afterEach, describe, expect, it, vi } from "vitest";
import { observePanelViewport, readPanelViewport } from "./useVisualViewportPanel";

function phone(withVisualViewport = true) {
  const viewport = Object.assign(new EventTarget(), { width: 390, height: 760, offsetTop: 0, offsetLeft: 0, scale: 1 });
  const target = Object.assign(new EventTarget(), {
    innerWidth: 390, innerHeight: 844, visualViewport: withVisualViewport ? viewport : undefined,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  });
  return { target: target as unknown as Window, viewport };
}
afterEach(() => vi.useRealTimers());

describe("mobile chat visible viewport", () => {
  it("keeps the composer within the area above the keyboard, including browser panning", () => {
    const { target, viewport } = phone();
    Object.assign(viewport, { height: 352, offsetTop: 58 });
    expect(readPanelViewport(target)).toEqual({
      "--panel-viewport-top": "58px", "--panel-viewport-left": "0px",
      "--panel-viewport-width": "390px", "--panel-viewport-height": "352px",
    });
  });

  it("coalesces keyboard events and restores the panel when the keyboard closes or the phone rotates", () => {
    vi.useFakeTimers();
    const { target, viewport } = phone();
    const update = vi.fn();
    const stop = observePanelViewport(target, update);
    Object.assign(viewport, { height: 320, offsetTop: 20 });
    viewport.dispatchEvent(new Event("resize")); viewport.dispatchEvent(new Event("scroll"));
    expect(update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(16);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.lastCall?.[0]["--panel-viewport-height"]).toBe("320px");
    Object.assign(viewport, { width: 844, height: 390, offsetTop: 0 });
    target.dispatchEvent(new Event("resize")); vi.advanceTimersByTime(16);
    expect(update.mock.lastCall?.[0]["--panel-viewport-width"]).toBe("844px");
    expect(update.mock.lastCall?.[0]["--panel-viewport-top"]).toBe("0px");
    stop();
  });

  it("leaves pinch zoom available rather than shrinking the panel to undo magnification", () => {
    const { target, viewport } = phone();
    viewport.scale = 2; viewport.width = 195;
    expect(readPanelViewport(target)).toBeNull();
    viewport.scale = 1; viewport.width = 390;
    expect(readPanelViewport(target)?.["--panel-viewport-width"]).toBe("390px");
  });

  it("falls back to the window viewport in browsers without VisualViewport", () => {
    const { target } = phone(false);
    expect(readPanelViewport(target)?.["--panel-viewport-height"]).toBe("844px");
  });

  it("removes listeners and cancels pending updates when the chat closes", () => {
    vi.useFakeTimers();
    const { target, viewport } = phone(); const update = vi.fn();
    const stop = observePanelViewport(target, update);
    viewport.dispatchEvent(new Event("resize")); stop();
    viewport.dispatchEvent(new Event("scroll")); target.dispatchEvent(new Event("resize"));
    vi.runAllTimers(); expect(update).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
