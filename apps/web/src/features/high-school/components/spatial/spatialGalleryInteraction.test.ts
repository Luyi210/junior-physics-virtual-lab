import { describe, expect, it, vi } from "vitest";
import { createSpatialGalleryInteraction } from "./spatialGalleryInteraction";

function setup() {
  const elements = new Set<HTMLElement>();
  function stage(width = 200) {
    const styles = new Map<string, string>(), attrs = new Map<string, string>();
    const element = {
      style: { setProperty: (name: string, value: string) => styles.set(name, value), removeProperty: (name: string) => styles.delete(name) },
      setAttribute: (name: string, value: string) => attrs.set(name, value), removeAttribute: (name: string) => attrs.delete(name),
      getBoundingClientRect: () => ({ left: 10, top: 20, width, height: 100 }),
    } as unknown as HTMLElement;
    elements.add(element); return { element, styles, attrs };
  }
  const frames = new Map<number, FrameRequestCallback>(); let nextId = 0;
  const requestFrame = vi.fn((callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; });
  const cancelFrame = vi.fn((id: number) => { frames.delete(id); });
  const controller = createSpatialGalleryInteraction({ contains: (element: HTMLElement) => elements.has(element) } as unknown as HTMLElement, { requestFrame, cancelFrame });
  return { stage, elements, frames, requestFrame, cancelFrame, controller,
    paint() { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(0)); },
  };
}

describe("one pointer-depth controller for the experiment gallery", () => {
  it("is static until enabled and never starts a recurring animation", () => {
    const app = setup(), stage = app.stage();
    app.controller.move(stage.element, 100, 60, "mouse"); expect(app.frames.size).toBe(0);
    app.controller.setEnabled(true); app.controller.move(stage.element, 110, 70, "mouse"); app.paint();
    expect(stage.styles.get("--hs-scene-rotate-y")).toBe("0.00deg");
    expect(app.frames.size).toBe(0); expect(app.requestFrame).toHaveBeenCalledOnce();
  });

  it("coalesces pointer bursts and clamps only the instrument scene to small angles", () => {
    const app = setup(), stage = app.stage(); app.controller.setEnabled(true);
    app.controller.move(stage.element, 30, 30, "mouse");
    app.controller.move(stage.element, 60, 60, "mouse");
    app.controller.move(stage.element, 1000, -1000, "mouse");
    expect(app.frames.size).toBe(1); app.paint();
    expect([...stage.styles]).toEqual([
      ["--hs-scene-rotate-x", "3.50deg"], ["--hs-scene-rotate-y", "4.50deg"],
      ["--hs-scene-light-x", "88.00%"], ["--hs-scene-light-y", "19.00%"],
    ]);
    expect(stage.attrs.get("data-spatial-active")).toBe("true");
  });

  it("clears the previous card when moving between instruments or back to body text", () => {
    const app = setup(), one = app.stage(), two = app.stage(); app.controller.setEnabled(true);
    app.controller.move(one.element, 20, 30, "mouse"); app.paint();
    app.controller.move(two.element, 200, 100, "mouse");
    expect(one.styles.size).toBe(0); expect(one.attrs.size).toBe(0);
    app.paint(); expect(two.attrs.size).toBe(1);
    app.controller.move(null, 200, 200, "mouse");
    expect(two.styles.size).toBe(0); expect(two.attrs.size).toBe(0); expect(app.frames.size).toBe(0);
  });

  it("resets on touch, preference/visibility disable, cancellation and disposal including a late frame", () => {
    const app = setup(), stage = app.stage(); app.controller.setEnabled(true);
    app.controller.move(stage.element, 20, 30, "mouse"); app.paint();
    app.controller.move(stage.element, 20, 30, "touch"); expect(stage.styles.size).toBe(0);
    app.controller.move(stage.element, 20, 30, "pen"); expect(app.frames.size).toBe(0);
    app.controller.move(stage.element, 20, 30, "mouse"); app.controller.setEnabled(false);
    expect(app.frames.size).toBe(0); expect(stage.styles.size).toBe(0);
    app.controller.setEnabled(true); app.controller.move(stage.element, 20, 30, "mouse"); app.controller.reset();
    expect(app.frames.size).toBe(0);
    app.controller.move(stage.element, 20, 30, "mouse"); const late = [...app.frames.values()][0]; app.controller.dispose(); late(0);
    app.controller.setEnabled(true); app.controller.move(stage.element, 20, 30, "mouse");
    expect(stage.styles.size).toBe(0); expect(app.frames.size).toBe(0);
  });

  it("ignores filtered-out, zero-size and non-finite targets without retaining transforms", () => {
    const app = setup(), stage = app.stage(), hidden = app.stage(0); app.controller.setEnabled(true);
    app.controller.move(stage.element, 20, 30, "mouse"); app.elements.delete(stage.element); app.paint();
    expect(stage.styles.size).toBe(0);
    app.controller.move(hidden.element, 20, 30, "mouse"); app.paint(); expect(hidden.styles.size).toBe(0);
    app.controller.move(hidden.element, NaN, 30, "mouse"); expect(app.frames.size).toBe(0);
  });
});
