import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { highSchoolExperiments } from "@physics-lab/knowledge/high-school";
import { HIGH_SCHOOL_EXPERIMENTS } from "@physics-lab/physics/high-school";
import { Link } from "react-router-dom";
import { HighSchoolHomePage } from "./HighSchoolHomePage";

type Slot = { value?: unknown; deps?: readonly unknown[] };
type Frame = { slots: Slot[]; cursor: number };
const hooks = vi.hoisted(() => ({ frame: null as Frame | null }));
// Actual page callbacks and catalogue, with controlled hook state. This does not
// emulate DOM layout, focus delivery, React reconciliation or browser scrolling.
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const slot = () => {
    const frame = hooks.frame!;
    return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {});
  };
  return { ...actual,
    useState: (initial: unknown) => {
      if (!hooks.frame) return actual.useState(initial);
      const item = slot();
      if (!("value" in item)) item.value = typeof initial === "function" ? initial() : initial;
      return [item.value, (next: unknown) => { item.value = typeof next === "function" ? next(item.value) : next; }];
    },
    useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
      if (!hooks.frame) return actual.useMemo(factory, deps);
      const item = slot();
      if (!item.deps || deps.some((value, index) => !Object.is(value, item.deps![index]))) {
        item.value = factory(); item.deps = deps;
      }
      return item.value;
    },
    useRef: (initial: unknown) => {
      if (!hooks.frame) return actual.useRef(initial);
      const item = slot(); item.value ??= { current: initial }; return item.value;
    },
    useSyncExternalStore: () => ({ mode: "blocked", key: null, canWrite: false, authChannel: null, revision: 0, label: "选择档案归属" }),
  };
});

type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node)
    ? [node, ...nodes(node.props.children as ReactNode)] : [];
}
function text(node: ReactNode): string {
  return typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node)
    ? node.map(text).join("") : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : "";
}
function mount() {
  const frame: Frame = { slots: [], cursor: 0 };
  const focus = vi.fn();
  const app = {
    tree: null as ReactNode,
    render() {
      frame.cursor = 0; hooks.frame = frame;
      try { app.tree = HighSchoolHomePage(); } finally { hooks.frame = null; }
      (app.search().props.ref as { current: unknown }).current = { focus };
    },
    search() { return nodes(app.tree).find(node => node.props.id === "hs-experiment-search")!; },
    ids() { return nodes(app.tree).filter(node => node.type === "article").map(node => node.props["data-experiment-id"]); },
    button(label: string) {
      const control = nodes(app.tree).find(node => node.type === "button" && (text(node) === label || node.props["aria-label"] === label));
      expect(control, label).toBeDefined(); return control!;
    },
    click(label: string) { (app.button(label).props.onClick as () => void)(); app.render(); },
    query(value: string) { (app.search().props.onChange as (event: unknown) => void)({ target: { value } }); app.render(); },
    status(value: string) { (nodes(app.tree).find(node => node.type === "select")!.props.onChange as (event: unknown) => void)({ target: { value } }); app.render(); },
    focus,
  };
  app.render(); return app;
}
afterEach(() => { hooks.frame = null; vi.unstubAllGlobals(); });

describe("observatory catalogue interactions", () => {
  it("links every available catalogue card to its implemented experiment and keeps planned cards closed", () => {
    const app = mount();
    const cards = nodes(app.tree).filter(node => node.type === "article");
    expect(cards).toHaveLength(highSchoolExperiments.length);
    for (const item of highSchoolExperiments) {
      const card = cards.find(node => node.props["data-experiment-id"] === item.id)!;
      const links = nodes(card).filter(node => node.type === Link);
      if (item.status === "ready") {
        expect(HIGH_SCHOOL_EXPERIMENTS.some(definition => definition.id === item.id)).toBe(true);
        expect(links).toHaveLength(1);
        expect(links[0].props.to).toBe(`/high-school/experiments/${item.id}`);
      } else expect(links).toHaveLength(0);
    }
  });

  it("searches multiple words across domain and instrument conditions, without changing the catalogue", () => {
    const app = mount();
    app.query("  光学　折射  ");
    expect(app.ids()).toEqual(["refractive-index"]);
    app.query("弹簧 Ｌ₀");
    expect(app.ids()).toEqual(["spring-force"]);
    app.click("清除搜索词");
    expect(app.ids()).toEqual(highSchoolExperiments.map(item => item.id));
    expect(app.focus).toHaveBeenCalledOnce();
  });

  it("can remove just a conflicting textbook filter while preserving the selected physics domain", () => {
    const app = mount();
    const volumeButton = nodes(app.tree).find(node => node.type === "button" && text(node).startsWith("必修第一册"))!;
    (volumeButton.props.onClick as () => void)(); app.render();
    app.click("光学");
    expect(app.ids()).toEqual([]);
    expect(text(app.tree)).toContain("没有匹配的实验");
    app.click("移除筛选：必修第一册");
    expect(app.ids()).toContain("refractive-index");
    expect(app.ids()).not.toContain("newton-second-law");
    expect(app.button("光学").props["aria-pressed"]).toBe(true);
    expect(app.button("移除筛选：光学")).toBeDefined();
  });

  it("recovers from an empty search without discarding other filters, then resets every condition explicitly", () => {
    const app = mount(); app.click("振动与波"); app.status("ready"); app.query("不存在的实验");
    expect(app.ids()).toEqual([]);
    app.click("仅清除搜索词");
    expect(app.ids()).toContain("pendulum");
    expect(app.button("振动与波").props["aria-pressed"]).toBe(true);
    expect(nodes(app.tree).find(node => node.type === "select")!.props.value).toBe("ready");
    app.click("重置全部");
    expect(app.ids()).toHaveLength(highSchoolExperiments.length);
    expect(app.search().props.value).toBe("");
    expect(app.button("全部领域").props["aria-pressed"]).toBe(true);
    expect(nodes(app.tree).find(node => node.type === "select")!.props.value).toBe("all");
    expect(nodes(app.tree).some(node => node.props["aria-label"] === "当前筛选条件")).toBe(false);
  });

  it("explains the empty planned category honestly and restores the real available catalogue", () => {
    const app = mount(); app.status("planned");
    expect(app.ids()).toEqual([]);
    expect(text(app.tree)).toContain("当前目录中的实验都已开放");
    app.click(`查看全部 ${highSchoolExperiments.length} 项实验`);
    expect(app.ids()).toHaveLength(highSchoolExperiments.length);
  });

  it.each([false, true])("moves the primary entry to the catalogue without a route fragment (reduced motion: %s)", reduced => {
    const focus = vi.fn(), scrollIntoView = vi.fn();
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
    vi.stubGlobal("document", { getElementById: vi.fn(() => ({ focus, scrollIntoView })) });
    const app = mount(); app.click("探索全部实验");
    expect(document.getElementById).toHaveBeenCalledWith("hs-catalog");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: reduced ? "auto" : "smooth", block: "start" });
    expect(nodes(app.tree).find(node => node.props.id === "hs-catalog")!.props.tabIndex).toBe(-1);
  });
});
