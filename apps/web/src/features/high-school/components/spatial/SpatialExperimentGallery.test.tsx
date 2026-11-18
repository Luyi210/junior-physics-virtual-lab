import { type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { highSchoolExperiments } from "@physics-lab/knowledge/high-school";
import { HighSchoolHomePage } from "../../pages/HighSchoolHomePage";
import { SpatialExperimentGallery } from "./SpatialExperimentGallery";

const hooks = vi.hoisted(() => ({ active: false, refs: [] as Array<{ current: unknown }>, effects: [] as Array<() => void | (() => void)> }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useRef: (value: unknown) => { if (!hooks.active) return actual.useRef(value); const ref = { current: value }; hooks.refs.push(ref); return ref; },
    useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => { if (!hooks.active) return actual.useEffect(effect, deps); hooks.effects.push(effect); },
  };
});
afterEach(() => { hooks.active = false; hooks.refs = []; hooks.effects = []; vi.unstubAllGlobals(); });

describe("spatial gallery composition and lifecycle (controlled effects, not browser rendering)", () => {
  it("gives all 24 catalogue instruments static depth while keeping their headings and links outside the tilted stage", () => {
    const html = renderToStaticMarkup(<MemoryRouter><HighSchoolHomePage /></MemoryRouter>);
    expect((html.match(/data-spatial-gallery="true"/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-spatial-stage="true"/g) ?? [])).toHaveLength(highSchoolExperiments.length);
    expect((html.match(/class="hs-card-plinth"/g) ?? [])).toHaveLength(highSchoolExperiments.length);
    expect((html.match(/class="hs-card-instrument-object"/g) ?? [])).toHaveLength(highSchoolExperiments.length);
    for (const item of highSchoolExperiments) {
      const article = html.slice(html.indexOf(`data-experiment-id="${item.id}"`)).split("</article>")[0];
      expect(article.indexOf('class="hs-card-body"')).toBeGreaterThan(article.indexOf('class="hs-card-scene-caption"'));
      expect(article).toContain(`进入${item.name}`);
    }
  });

  it("uses shared media listeners and clears pointer work on hide, preference changes, keyboard focus and cleanup", () => {
    const fine = new EventTarget(), reduced = new EventTarget();
    Object.assign(fine, { matches: true }); Object.assign(reduced, { matches: false });
    const page = Object.assign(new EventTarget(), { hidden: false });
    const frames = new Map<number, FrameRequestCallback>(); let nextId = 0;
    const win = Object.assign(new EventTarget(), {
      matchMedia: (query: string) => query.includes("reduced-motion") ? reduced : fine,
      requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId; },
      cancelAnimationFrame: (id: number) => frames.delete(id),
    });
    const properties = new Map<string, string>();
    class Target {
      style = { setProperty: (key: string, value: string) => properties.set(key, value), removeProperty: (key: string) => properties.delete(key) };
      closest() { return this; }
      getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 100 }; }
      setAttribute() {} removeAttribute() {}
    }
    vi.stubGlobal("Element", Target); vi.stubGlobal("window", win); vi.stubGlobal("document", page);
    hooks.active = true;
    const element = SpatialExperimentGallery({ children: "catalogue" }) as ReactElement<Record<string, unknown>>;
    hooks.active = false;
    const target = new Target(); hooks.refs[0].current = { contains: (value: unknown) => value === target };
    const cleanups = hooks.effects.map(effect => effect());
    const move = () => (element.props.onPointerMove as (event: unknown) => void)({ target, clientX: 180, clientY: 20, pointerType: "mouse" });
    const paint = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(0)); };
    move(); paint(); expect(properties.size).toBe(4);
    hooks.effects[1](); expect(properties.size).toBe(0); // New filtered children reset the old scene.
    move(); paint();
    page.hidden = true; page.dispatchEvent(new Event("visibilitychange")); expect(properties.size).toBe(0);
    move(); expect(frames.size).toBe(0);
    page.hidden = false; page.dispatchEvent(new Event("visibilitychange")); move(); expect(frames.size).toBe(1);
    Object.assign(reduced, { matches: true }); reduced.dispatchEvent(new Event("change")); expect(frames.size).toBe(0);
    Object.assign(reduced, { matches: false }); reduced.dispatchEvent(new Event("change")); move(); paint();
    Object.assign(fine, { matches: false }); fine.dispatchEvent(new Event("change")); expect(properties.size).toBe(0);
    move(); expect(frames.size).toBe(0);
    Object.assign(fine, { matches: true }); fine.dispatchEvent(new Event("change")); move(); paint();
    (element.props.onFocusCapture as () => void)(); expect(properties.size).toBe(0);
    move(); paint(); win.dispatchEvent(new Event("blur")); expect(properties.size).toBe(0);
    move(); const late = [...frames.values()][0]; cleanups.forEach(cleanup => cleanup?.()); late(0);
    expect(frames.size).toBe(0); expect(properties.size).toBe(0);
    move(); expect(frames.size).toBe(0);
    const replayCleanup = hooks.effects[0](); // StrictMode setup after cleanup creates a usable controller.
    move(); paint(); expect(properties.size).toBe(4);
    replayCleanup?.(); expect(properties.size).toBe(0); expect(frames.size).toBe(0);
  });
});
