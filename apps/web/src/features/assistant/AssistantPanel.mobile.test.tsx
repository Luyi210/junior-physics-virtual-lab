import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { HarnessPanel } from "./AssistantPanel";
import { createHarnessSession } from "@physics-lab/harness";

const fixture = vi.hoisted(() => ({
  state: {} as Record<string, unknown>, effects: [] as Array<() => void | (() => void)>,
  viewport: vi.fn(), setDraft: vi.fn(),
}));
vi.mock("./harnessStore", () => ({ useHarnessStore: (selector: (state: Record<string, unknown>) => unknown) => selector(fixture.state) }));
vi.mock("../../shared/hooks/useVisualViewportPanel", () => ({ useVisualViewportPanel: fixture.viewport }));
vi.mock("./OrangeCatAvatar", () => ({ OrangeCatAvatar: () => null, useOrangeCatAvatarLabel: () => "光光" }));
vi.mock("../../data/teacherApi", () => ({ DEMO_ONLY: true, studentApi: { hasSession: () => false } }));
vi.mock("../../data/studentRecordScope", () => ({
  getStudentRecordScope: () => ({ key: "student:test", revision: 1 }),
  subscribeStudentRecordScope: () => () => {},
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
    useState: (initial: unknown) => [initial === "" ? "为什么？" : initial, fixture.setDraft],
    useRef: (initial: unknown) => ({ current: initial }),
    useMemo: (factory: () => unknown) => factory(),
    useEffect: (effect: () => void | (() => void)) => { fixture.effects.push(effect); },
  };
});

type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : [];
}
function find(tree: ReactNode, label: string) {
  const node = nodes(tree).find(node => node.props["aria-label"] === label);
  if (!node) throw Error(`Missing ${label}`);
  return node;
}
const cleanups: Array<() => void> = [];
beforeEach(() => {
  fixture.effects.length = 0; fixture.viewport.mockReset(); fixture.setDraft.mockReset();
  fixture.viewport.mockReturnValue({ "--panel-viewport-height": "320px", "--panel-viewport-top": "40px" });
  fixture.state = { panelOpen: true, loading: false, activeArea: "sound", activeModule: "sound-features", session: createHarnessSession("sound"), asking: false, setPanelOpen: vi.fn(), askQuestion: vi.fn().mockResolvedValue(true) };
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), speechSynthesis: { cancel: vi.fn() } });
});
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe("Guangguang phone conversation controls", () => {
  it("binds the visible viewport and focuses the panel, never the input, before restoring the launcher on close", () => {
    const tree = HarnessPanel();
    const panel = find(tree, "橘猫实验员交流与动态教程"), launcher = find(tree, "打开橘猫实验员");
    const panelFocus = vi.fn(), launcherFocus = vi.fn(), inputFocus = vi.fn();
    (panel.props.ref as { current: unknown }).current = { focus: panelFocus };
    (launcher.props.ref as { current: unknown }).current = { focus: launcherFocus };
    const input = find(tree, "向探究伙伴提问");
    if (input.props.ref) (input.props.ref as { current: unknown }).current = { focus: inputFocus };
    fixture.effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); });
    expect(fixture.viewport).toHaveBeenCalledWith(true);
    expect(panel.props.style).toEqual({ "--panel-viewport-height": "320px", "--panel-viewport-top": "40px" });
    expect(panelFocus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(inputFocus).not.toHaveBeenCalled();
    expect(launcher.props["aria-controls"]).toBe(panel.props.id);
    (find(tree, "收起探究伙伴").props.onClick as () => void)();
    expect(fixture.state.setPanelOpen).toHaveBeenCalledWith(false);
    expect(launcherFocus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  it.each([{ isComposing: true, keyCode: 13 }, { isComposing: false, keyCode: 229 }])("does not send while Chinese input is being confirmed: %j", nativeEvent => {
    const input = find(HarnessPanel(), "向探究伙伴提问"), preventDefault = vi.fn();
    (input.props.onKeyDown as (event: unknown) => void)({ key: "Enter", shiftKey: false, nativeEvent, preventDefault });
    expect(fixture.state.askQuestion).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("preserves Shift+Enter line breaks and sends a completed Enter question once", async () => {
    const input = find(HarnessPanel(), "向探究伙伴提问"), preventDefault = vi.fn();
    const key = input.props.onKeyDown as (event: unknown) => void;
    key({ key: "Enter", shiftKey: true, nativeEvent: { isComposing: false, keyCode: 13 }, preventDefault });
    expect(fixture.state.askQuestion).not.toHaveBeenCalled();
    key({ key: "Enter", shiftKey: false, nativeEvent: { isComposing: false, keyCode: 13 }, preventDefault });
    expect(fixture.state.askQuestion).toHaveBeenCalledExactlyOnceWith("为什么？");
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
