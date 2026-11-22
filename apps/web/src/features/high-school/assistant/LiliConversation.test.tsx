import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LiliChatReply, LiliChatRequest, LiliExperimentContext } from "@physics-lab/contracts";
import { createLiliGuidance } from "@physics-lab/harness/lili";
import { defaultHighSchoolParameters, createCapacitorHistory, simulateHighSchoolExperiment } from "@physics-lab/physics/high-school";
import type { HighSchoolRecordScope } from "../../../data/highSchoolRecordScope";
import { LiliAssistant } from "./LiliAssistant";
import { LiliReviewPanel } from "./LiliReviewPanel";
import { LiliQuestionContext } from "./LiliQuestionContext";
import { captureLiliContext, collectLiliRecentDialogue, createLiliConversationId, liliContextChanged } from "./liliConversationContext";
import { TutorHintLadder } from "../../../shared/components/TutorHintLadder";

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
type Frame = { slots: Slot[]; cursor: number; effects: Array<() => void>; dirty: boolean };
const state = vi.hoisted(() => ({
  frame: null as Frame | null, request: vi.fn(), context: null as LiliExperimentContext | null,
  scope: {} as HighSchoolRecordScope, listeners: new Set<() => void>(),
  visit: 0, visitedExperiment: null as string | null, contextListeners: new Set<() => void>(),
}));
vi.mock("../../../data/highSchoolRecordScope", () => ({
  getHighSchoolRecordScope: () => state.scope,
  subscribeHighSchoolRecordScope: (listener: () => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener); },
  isCurrentHighSchoolRecordScope: (scope: HighSchoolRecordScope) => scope === state.scope,
}));
vi.mock("../../../data/highSchoolContext", () => ({
  getHighSchoolContext: () => state.context,
  getHighSchoolExperimentVisit: () => {
    const id = state.context?.experimentId ?? null;
    if (id !== state.visitedExperiment) { state.visitedExperiment = id; state.visit += 1; }
    return state.visit;
  },
  subscribeHighSchoolContext: (listener: () => void) => { state.contextListeners.add(listener); return () => { state.contextListeners.delete(listener); }; },
}));
vi.mock("./liliRequest", async original => ({ ...await original<typeof import("./liliRequest")>(), requestLiliForScope: state.request }));
vi.mock("./useCorgiAvatarRotation", () => ({ useCorgiAvatarRotation: () => ({ index: 0, setInteracting() {} }) }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  const slot = () => { const frame = state.frame!; return frame.slots[frame.cursor++] ?? (frame.slots[frame.cursor - 1] = {}); };
  return { ...actual,
    useState(initial: unknown) {
      if (!state.frame) return actual.useState(initial);
      const frame = state.frame, current = slot();
      if (!Object.hasOwn(current, "value")) current.value = typeof initial === "function" ? initial() : initial;
      return [current.value, (next: unknown) => { const value = typeof next === "function" ? next(current.value) : next; if (!Object.is(current.value, value)) { current.value = value; frame.dirty = true; } }];
    },
    useRef(initial: unknown) { if (!state.frame) return actual.useRef(initial); const current = slot(); return current.value ??= { current: initial }; },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      if (!state.frame) return actual.useEffect(effect, deps);
      const current = slot();
      if (!current.deps || !deps || current.deps.length !== deps.length || current.deps.some((value, index) => !Object.is(value, deps[index]))) {
        current.deps = deps; state.frame.effects.push(() => { current.cleanup?.(); current.cleanup = effect() || undefined; });
      }
    },
    useSyncExternalStore(subscribe: (fn: () => void) => () => void, getSnapshot: () => unknown, server?: () => unknown) { return state.frame ? getSnapshot() : actual.useSyncExternalStore(subscribe, getSnapshot, server); },
  };
});
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return Array.isArray(node) ? node.map(text).join("") : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : typeof node === "string" || typeof node === "number" ? String(node) : ""; }
function find(tree: ReactNode, type: string, label?: string) { const result = nodes(tree).find(node => node.type === type && (!label || node.props["aria-label"] === label)); if (!result) throw Error(`Missing ${type} ${label}`); return result; }
function click(node: Element) { (node.props.onClick as () => void)(); }
const cleanups: Array<() => void> = [];
function mountConversation() {
  state.frame = { slots: [], cursor: 0, effects: [], dirty: false };
  const outer = LiliAssistant();
  state.frame = null;
  const frame: Frame = { slots: [], cursor: 0, effects: [], dirty: false };
  const app = { tree: null as ReactNode, focus: vi.fn(), focusedElements: [] as string[], scroll: vi.fn(),
    render() {
      let turns = 0;
      do { frame.dirty = false; frame.cursor = 0; state.frame = frame;
        try { app.tree = (outer.type as (props: { scope: HighSchoolRecordScope }) => ReactNode)(outer.props); } finally { state.frame = null; }
        for (const node of nodes(app.tree)) if (node.props.ref && typeof node.props.ref === "object") (node.props.ref as { current: unknown }).current = { focus(options?: FocusOptions) { app.focusedElements.push(node.type as string); app.focus(options); }, scrollIntoView: app.scroll };
        frame.effects.splice(0).forEach(effect => effect());
        if (++turns > 20) throw Error("Render loop");
      } while (frame.dirty);
    },
    ask(question: string) {
      (find(app.tree, "textarea").props.onChange as (event: unknown) => void)({ target: { value: question } }); app.render();
      (find(app.tree, "form").props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); app.render();
    },
    unmount() { frame.slots.forEach(slot => { slot.cleanup?.(); slot.cleanup = undefined; }); },
  };
  // Outer has only a store subscription; use the real element key and inner callbacks.
  app.render(); click(find(app.tree, "button", "和力力讨论实验")); app.render(); cleanups.push(app.unmount); return app;
}
function context(parameters = defaultHighSchoolParameters("spring-force")): LiliExperimentContext { return { experimentId: "spring-force", parameters, timeSeconds: 0, recordCount: 0 }; }
function deferred() { let resolve!: (reply: LiliChatReply) => void, reject!: (error: Error) => void; const promise = new Promise<LiliChatReply>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
function replies(app: ReturnType<typeof mountConversation>) { return nodes(app.tree).filter(node => node.type === "article" && node.props.className === "lili-message is-lili"); }
function snapshotHtml(article: Element) { const node = nodes(article).find(node => node.type === LiliQuestionContext)!; return renderToStaticMarkup(<LiliQuestionContext {...node.props as Parameters<typeof LiliQuestionContext>[0]} />); }

beforeEach(() => {
  vi.useFakeTimers(); state.request.mockReset(); state.listeners.clear(); state.contextListeners.clear(); state.visit = 0; state.visitedExperiment = null; state.context = context();
  state.scope = { key: "account:student-a", mode: "account", label: "学生甲", canWrite: true, authChannel: "student", revision: 1 };
  vi.stubGlobal("crypto", { randomUUID: () => "10000000-0000-4000-8000-000000000001" });
});
afterEach(() => { state.frame = null; cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Lili action coaching and experiment visits", () => {
  it("opens the live review and carries its condition check into the same conversation", () => {
    state.scope = { key: "guest", mode: "guest", label: "本机访客", canWrite: true, authChannel: null, revision: 1 };
    state.context = { experimentId: "pendulum", parameters: { ...defaultHighSchoolParameters("pendulum"), amplitudeDegrees: 20 }, timeSeconds: 0, recordCount: 0 };
    const app = mountConversation();
    const tab = nodes(app.tree).find(node => node.props.role === "tab" && text(node) === "现场判断")!;
    click(tab); app.render();
    const review = nodes(app.tree).find(node => node.type === LiliReviewPanel)!;
    const reviewTree = LiliReviewPanel(review.props as Parameters<typeof LiliReviewPanel>[0]);
    expect(renderToStaticMarkup(reviewTree)).toContain("摆角超过10°");
    const check = nodes(reviewTree).find(node => node.type === "button" && text(node).includes("核对当前条件"))!;
    click(check); app.render();
    expect(text(replies(app).at(-1))).toContain("摆角超过10°");
    expect(state.request).not.toHaveBeenCalled();
    expect(nodes(app.tree).find(node => node.props.role === "tab" && text(node) === "问力力")?.props["aria-selected"]).toBe(true);
  });
  it("lets a student bring an observation draft into local coaching", () => {
    const app = mountConversation();
    click(nodes(app.tree).find(node => node.props.role === "tab" && text(node) === "现场判断")!); app.render();
    const review = nodes(app.tree).find(node => node.type === LiliReviewPanel)!;
    const draft = nodes(LiliReviewPanel(review.props as Parameters<typeof LiliReviewPanel>[0])).find(node => node.type === "button" && text(node) === "观察")!;
    click(draft); app.render();
    expect(find(app.tree, "textarea").props.value).toBe("检查这条观察：");
    app.ask("检查这条观察：保持原长不变，把质量从 50 g 调到 100 g，弹力从 0.49 N 变为 0.98 N。");
    expect(text(replies(app).at(-1))).toContain("观察证据的表述检查");
    expect(state.request).not.toHaveBeenCalled();
  });
  it("checks actual record availability locally and explains a topic more simply without another network call", async () => {
    state.context!.recordCount = 12;
    state.request.mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation(); app.ask("检查我的记录");
    expect(state.request).not.toHaveBeenCalled();
    expect(text(replies(app).at(-1))).toContain("条数不是证据");
    app.ask("怎样控制变量？"); await settle(); app.render();
    const previous = text(replies(app).at(-1));
    app.ask("换个说法");
    expect(state.request).toHaveBeenCalledTimes(1);
    expect(text(replies(app).at(-1))).toContain("换个说法");
    expect(text(replies(app).at(-1))).not.toBe(previous);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not revive a previous visit's topic or let an aborted reply clear a new request after rapid A-B-A", async () => {
    const old = deferred(), next = deferred();
    state.request.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const app = mountConversation(); app.ask("怎样控制变量？");
    const signal = state.request.mock.calls[0][0].signal as AbortSignal;
    state.context = { experimentId: "pendulum", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 0, recordCount: 0 };
    for (const callback of state.contextListeners) callback();
    state.context = context();
    for (const callback of state.contextListeners) callback();
    app.render();
    expect(signal.aborted).toBe(true);
    app.ask("为什么？");
    expect(text(replies(app).at(-1))).toContain("你想继续哪一部分");
    expect(state.request).toHaveBeenCalledTimes(1);
    app.ask("弹簧的原长是什么？");
    old.resolve({ text: "旧访次不应出现", mode: "ai", sources: [], suggestions: [] });
    await settle(); app.render();
    expect(text(app.tree)).not.toContain("旧访次不应出现");
    expect(text(app.tree)).toContain("力力正在整理思路");
    next.resolve({ text: "新访次的解释", mode: "ai", sources: [], suggestions: [] });
    await settle(); app.render();
    expect(text(replies(app).at(-1))).toContain("新访次的解释");
    expect(text(app.tree)).not.toContain("力力正在整理思路");
  });
});

describe("Lili question snapshots through actual conversation callbacks", () => {
  it("answers a guest's typed question immediately without testing an unavailable AI service", () => {
    state.scope = { key: "guest", mode: "guest", label: "本机访客", canWrite: true, authChannel: null, revision: 1 };
    const app = mountConversation(); app.ask("当前弹力是多少？");
    expect(state.request).not.toHaveBeenCalled();
    expect(replies(app)).toHaveLength(1);
    expect(text(replies(app)[0])).toContain("0.98");
    expect(text(app.tree)).toContain("本地引导");
    expect(text(app.tree)).not.toContain("联网待验证");
    expect(find(app.tree, "textarea").props.disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back after timeout even when the transport ignores abort, then accepts another question", async () => {
    const held = deferred(); state.request.mockReturnValue(held.promise);
    const app = mountConversation();
    expect(text(app.tree)).toContain("联网待验证");
    expect(text(app.tree)).not.toContain("可请求联网");
    app.ask("当前弹力是多少？");
    const signal = state.request.mock.calls[0][0].signal as AbortSignal;
    await vi.advanceTimersByTimeAsync(50_000); app.render();
    expect(signal.aborted).toBe(true);
    expect(replies(app)).toHaveLength(1);
    expect(text(app.tree)).toContain("已改用本地实验引导");
    expect(text(app.tree)).not.toContain("力力正在整理思路");
    expect(text(app.tree)).not.toContain("上条为 AI 回复");
    expect(find(app.tree, "textarea").props.disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    app.ask("帮我检查当前实验");
    expect(replies(app)).toHaveLength(2);
    held.resolve({ text: "超时后的迟到答案", mode: "ai", sources: [], suggestions: [] }); await settle(); app.render();
    expect(replies(app)).toHaveLength(2);
    expect(text(app.tree)).not.toContain("超时后的迟到答案");
  });

  it("keeps the experiment visible after dismissing a pending chat and shows its answer only when reopened", async () => {
    const held = deferred(); state.request.mockReturnValue(held.promise);
    const app = mountConversation(); app.ask("当前弹力是多少？");
    click(find(app.tree, "button", "收起力力")); app.render();
    expect(nodes(app.tree).some(node => node.props.id === "lili-panel")).toBe(false);
    held.resolve({ text: "这条答案来自提问时的实验条件。", mode: "ai", sources: [], suggestions: [] });
    await settle(); app.render();
    expect(nodes(app.tree).some(node => node.props.id === "lili-panel")).toBe(false);
    click(find(app.tree, "button", "和力力讨论实验")); app.render();
    expect(replies(app)).toHaveLength(1);
    expect(text(app.tree)).toContain("上条为 AI 回复");
    expect(find(app.tree, "textarea").props.value).toBe("");
    expect(app.focusedElements).not.toContain("textarea");
  });

  it("updates the open panel for a keyboard-sized visible viewport and keeps close focus on the launcher", () => {
    const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetLeft: 0, offsetTop: 0, scale: 1 });
    const browser = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844, visualViewport: viewport });
    vi.stubGlobal("window", browser);
    const app = mountConversation();
    expect(find(app.tree, "section").props.style).toMatchObject({ "--panel-viewport-width": "390px", "--panel-viewport-height": "844px" });
    viewport.height = 320; viewport.offsetTop = 140;
    viewport.dispatchEvent(new Event("resize")); app.render();
    expect(find(app.tree, "section").props.style).toMatchObject({ "--panel-viewport-height": "320px", "--panel-viewport-top": "140px" });
    expect(app.focusedElements).not.toContain("textarea");
    expect(state.request).not.toHaveBeenCalled();
    click(find(app.tree, "button", "收起力力")); app.render();
    expect(app.focusedElements.at(-1)).toBe("button");
    expect(app.focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(find(app.tree, "button", "和力力讨论实验").props["aria-expanded"]).toBe(false);
  });

  it("keeps the welcome at the top on empty opens, focuses the panel instead of the keyboard input, and follows pending or existing conversation content", async () => {
    const held = deferred(); state.request.mockReturnValue(held.promise);
    const app = mountConversation();
    expect(app.focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(app.focusedElements).toEqual(["section"]);
    expect(find(app.tree, "section").props.tabIndex).toBe(-1);
    expect(app.scroll).not.toHaveBeenCalled();
    click(find(app.tree, "button", "收起力力")); app.render();
    click(find(app.tree, "button", "和力力讨论实验")); app.render();
    expect(app.focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(app.focusedElements.at(-1)).toBe("section");
    expect(app.focusedElements).not.toContain("textarea");
    expect(app.scroll).not.toHaveBeenCalled();
    app.ask("当前弹力是多少？");
    expect(app.scroll).toHaveBeenCalledOnce();
    expect(app.scroll).toHaveBeenLastCalledWith({ block: "nearest", behavior: "auto" });
    held.resolve({ text: "这是一条已返回的回复。", mode: "ai", sources: [], suggestions: [] });
    await settle(); app.render(); expect(app.scroll).toHaveBeenCalledTimes(2);
    click(find(app.tree, "button", "收起力力")); app.render(); expect(app.scroll).toHaveBeenCalledTimes(2);
    click(find(app.tree, "button", "和力力讨论实验")); app.render(); expect(app.scroll).toHaveBeenCalledTimes(3);
    expect(replies(app)).toHaveLength(1);
  });
  it("keeps a late 100g answer with its original conditions after changing to 200g, and retains both conversations", async () => {
    const held = deferred(); state.request.mockReturnValueOnce(held.promise).mockImplementation(({ request }: { request: LiliChatRequest }) => Promise.resolve(createLiliGuidance(request.question, request.context)));
    const app = mountConversation(); app.ask("当前的弹力是多少？");
    const captured = state.request.mock.calls[0][0].request as LiliChatRequest;
    expect(captured.context?.parameters.loadMassGrams).toBe(100);
    state.context!.parameters.loadMassGrams = 200; app.render();
    expect(captured.context?.parameters.loadMassGrams).toBe(100);
    held.resolve(createLiliGuidance(captured.question, captured.context)); await settle(); app.render();
    expect(text(replies(app)[0])).toContain("0.98");
    const html = snapshotHtml(replies(app)[0]);
    expect(html).toContain("100 g"); expect(html).toContain("仍基于提问时的快照"); expect(html).not.toContain("200 g");
    expect(simulateHighSchoolExperiment("spring-force", state.context!.parameters).state.force).toBeCloseTo(1.96);
    app.ask("现在的弹力是多少？"); await settle(); app.render();
    expect(replies(app)).toHaveLength(2);
    expect(snapshotHtml(replies(app)[0])).toContain("100 g"); expect(snapshotHtml(replies(app)[1])).toContain("200 g");
    expect(snapshotHtml(replies(app)[1])).not.toContain("仍基于");
    const ids = nodes(app.tree).filter(node => node.type === "article").map(node => node.key); expect(new Set(ids).size).toBe(4);
  });
  it("marks a changed physical time and same-count archive replacement without attributing later readings to the old question", async () => {
    state.context = { experimentId: "pendulum", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 1, recordCount: 1, samples: [{ id: "a", timeSeconds: 1, parameters: defaultHighSchoolParameters("pendulum") }] };
    const held = deferred(); state.request.mockReturnValue(held.promise); const app = mountConversation(); app.ask("怎么分析记录？");
    const request = state.request.mock.calls[0][0].request as LiliChatRequest;
    state.context = { ...state.context, timeSeconds: 2, samples: [{ ...state.context.samples![0], id: "b", timeSeconds: 2 }] };
    held.resolve(createLiliGuidance(request.question, request.context)); await settle(); app.render();
    expect(snapshotHtml(replies(app)[0])).toContain("· 1 s"); expect(snapshotHtml(replies(app)[0])).toContain("自动模型采样 1 条");
    expect(snapshotHtml(replies(app)[0])).toContain("所附记录已变化");
    state.context.timeSeconds = 1; app.render(); expect(snapshotHtml(replies(app)[0])).toContain("所附记录已变化");
  });
  it("retains the captured conditions on network failure and does not append an explicitly cancelled late answer", async () => {
    const failed = deferred(); state.request.mockReturnValueOnce(failed.promise); const app = mountConversation(); app.ask("怎么控制变量？");
    state.context = context({ ...state.context!.parameters, loadMassGrams: 250 }); failed.reject(Error("offline")); await settle(); app.render();
    expect(replies(app)).toHaveLength(1); expect(snapshotHtml(replies(app)[0])).toContain("100 g"); expect(text(app.tree)).toContain("已改用本地实验引导");
    const late = deferred(); state.request.mockReturnValueOnce(late.promise); app.ask("现在的弹力是多少？"); click(find(app.tree, "button", "停止等待"));
    late.resolve({ text: "不应显示的迟到回答", mode: "ai", sources: [], suggestions: [] }); await settle(); app.render();
    expect(replies(app)).toHaveLength(1); expect(text(app.tree)).not.toContain("不应显示");
  });
  it("discards the old owner's pending snapshot after renewal and starts the new keyed conversation empty", async () => {
    const held = deferred(); state.request.mockReturnValue(held.promise); const app = mountConversation(); app.ask("查看甲的读数");
    const signal = state.request.mock.calls[0][0].signal as AbortSignal;
    state.scope = { ...state.scope, revision: 2 }; [...state.listeners].forEach(listener => listener()); app.unmount();
    const next = mountConversation(); held.resolve({ text: "旧会话回答", mode: "ai", sources: [], suggestions: [] }); await settle(); next.render();
    expect(signal.aborted).toBe(true); expect(replies(next)).toHaveLength(0); expect(text(next.tree)).not.toContain("查看甲的读数");
  });
  it("renders homepage guidance honestly when the question contained no selected experiment", async () => {
    state.context = null; state.request.mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation(); app.ask("先做什么？"); await settle(); state.context = context(); app.render();
    expect(snapshotHtml(replies(app)[0])).toContain("提问时尚未选定实验"); expect(snapshotHtml(replies(app)[0])).toContain("仍基于提问时的快照");
  });
});

describe("secure conversation ID compatibility", () => {
  it("uses the secure byte API when randomUUID is missing, and sends a valid UUID with distinct message keys", async () => {
    const random = vi.fn((bytes: Uint8Array) => { bytes.forEach((_, index) => bytes[index] = index); return bytes; });
    vi.stubGlobal("crypto", { getRandomValues: random }); state.request.mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation(); app.ask("先做什么？"); await settle(); app.render(); app.ask("怎样控制变量？"); await settle(); app.render();
    const id = state.request.mock.calls[0][0].request.conversationId;
    expect(id).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f"); expect(random).toHaveBeenCalledOnce();
    expect(state.request.mock.calls[1][0].request.conversationId).toBe(id);
    expect(new Set(nodes(app.tree).filter(node => node.type === "article").map(node => node.key)).size).toBe(4);
  });
  it("opens and answers locally without any secure random API, without calling the network request path", async () => {
    vi.stubGlobal("crypto", undefined); const app = mountConversation(); app.ask("当前弹力是多少？"); await settle(); app.render();
    expect(state.request).not.toHaveBeenCalled(); expect(replies(app)).toHaveLength(1); expect(text(replies(app)[0])).toContain("0.98");
    expect(text(app.tree)).toContain("未发送联网请求"); expect(text(app.tree)).not.toContain("可请求联网帮助"); expect(vi.getTimerCount()).toBe(0);
  });
  it("also degrades safely if secure APIs throw, and uses random bytes if only randomUUID throws", () => {
    vi.stubGlobal("crypto", { randomUUID() { throw Error("blocked"); }, getRandomValues(bytes: Uint8Array) { return bytes.fill(255); } });
    expect(createLiliConversationId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    vi.stubGlobal("crypto", { getRandomValues() { throw Error("blocked"); } }); expect(createLiliConversationId()).toBeNull();
  });
});

describe("question context presentation", () => {
  it("compares nested content rather than counts or object key order, retaining immutable raw manual readings", () => {
    const current: LiliExperimentContext = { ...context(), manualRecordCount: 1, manualSamples: [{ id: "manual-a", kind: "pendulum-timing", parameters: { length: 1, mass: .2, amplitudeDegrees: 5 }, readings: { startTimeSeconds: 1, endTimeSeconds: 11, periodCount: 5, length: 1, amplitudeDegrees: 5 }, timeSeconds: 11 }] };
    const captured = captureLiliContext(current)!;
    const reordered = { ...current, parameters: { loadMassGrams: 100, naturalLength: .15, stiffness: 20 } };
    expect(liliContextChanged(captured, reordered)).toBe(false);
    current.manualSamples![0].readings.periodCount = 4;
    expect(liliContextChanged(captured, current)).toBe(true); expect(captured.manualSamples![0].readings.periodCount).toBe(5);
  });
  it("shows the original capacitor switching sequence and human-readable parameter choices", () => {
    const captured: LiliExperimentContext = { experimentId: "capacitor-charge", parameters: defaultHighSchoolParameters("capacitor-charge"), timeSeconds: 2, recordCount: 0, capacitorHistory: createCapacitorHistory("run-a") };
    captured.capacitorHistory!.segments.push({ startTimeSeconds: 1, mode: "open" });
    const current = captureLiliContext(captured)!; current.capacitorHistory!.segments.push({ startTimeSeconds: 2, mode: "discharge" });
    const html = renderToStaticMarkup(<LiliQuestionContext captured={captured} current={current} />);
    expect(html).toContain("0 s：充电"); expect(html).toContain("1 s：开路"); expect(html).not.toContain("2 s：放电"); expect(html).toContain("仍基于");
    const multimeter = { ...context(defaultHighSchoolParameters("multimeter")), experimentId: "multimeter" };
    const meterHtml = renderToStaticMarkup(<LiliQuestionContext captured={multimeter} current={multimeter} />);
    expect(meterHtml).toContain("电压"); expect(meterHtml).not.toContain("仍基于");
  });
});

describe("experiment-scoped hints and suggested follow-ups", () => {
  const ladder = (app: ReturnType<typeof mountConversation>) => nodes(app.tree).find(node => node.type === TutorHintLadder)!;
  const suggestions = (app: ReturnType<typeof mountConversation>) => text(nodes(app.tree).find(node => node.props.className === "lili-suggestions")?.props.children as ReactNode);
  it("only advances after an explicit hint reply, and ordinary questions preserve its last level", async () => {
    state.request.mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation();
    expect(ladder(app).props.currentLevel).toBe(0);
    expect(ladder(app).props.tone).toBe("cosmic");
    (ladder(app).props.onSelect as (level: number) => void)(1); app.render();
    expect(ladder(app).props.currentLevel).toBe(1);
    expect(ladder(app).props.disabled).toBe(false);
    expect(state.request).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(text(replies(app)[0])).toContain("一级提示 ·");
    expect(suggestions(app)).toContain("给我二级提示");
    app.ask("怎样控制变量？"); await settle(); app.render();
    expect(ladder(app).props.currentLevel).toBe(1);
    (ladder(app).props.onSelect as (level: number) => void)(2); app.render(); await settle(); app.render();
    expect(state.request).toHaveBeenCalledOnce();
    expect(state.request.mock.calls[0][0].request.question).toBe("怎样控制变量？");
    expect(text(replies(app)[2])).toContain("二级提示 ·");
    expect(ladder(app).props.currentLevel).toBe(2);
    expect(text(app.tree)).toContain("依据提问时的条件生成");
    expect(text(app.tree)).not.toContain("未获得可用的联网回复");
  });
  it("answers explicit hints synchronously for a signed-in student even if the network would never return", () => {
    state.request.mockReturnValue(new Promise(() => {}));
    expect(state.scope.mode).toBe("account"); expect(state.scope.authChannel).toBe("student");
    const app = mountConversation(); app.ask("给我三级提示");
    expect(state.request).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(replies(app)).toHaveLength(1);
    expect(text(replies(app)[0])).toContain("三级提示 · 用证据自检");
    expect(ladder(app).props.currentLevel).toBe(3);
    expect(ladder(app).props.disabled).toBe(false);
    expect(text(app.tree)).not.toContain("力力正在整理思路");
  });
  it("preserves displayed snapshots but starts a fresh hint context when returning to an experiment", async () => {
    state.request.mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation(); app.ask("给我一级提示"); await settle(); app.render();
    expect(ladder(app).props.currentLevel).toBe(1);
    state.context = { experimentId: "pendulum", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 0, recordCount: 0 }; app.render();
    expect(ladder(app).props.currentLevel).toBe(0);
    expect(suggestions(app)).not.toContain("给我二级提示");
    app.ask("给我三级提示"); await settle(); app.render();
    expect(ladder(app).props.currentLevel).toBe(3);
    state.context = context(); app.render();
    expect(ladder(app).props.currentLevel).toBe(0);
    expect(suggestions(app)).not.toContain("给我二级提示");
    expect(replies(app)).toHaveLength(2);
    expect(snapshotHtml(replies(app)[1])).toContain("单摆周期与摆角");
    expect(snapshotHtml(replies(app)[1])).toContain("仍基于提问时的快照");
  });
  it("cancels a pending answer on experiment change without inserting it into the new discussion", async () => {
    const held = deferred(); state.request.mockReturnValue(held.promise);
    const app = mountConversation(); app.ask("怎样控制变量？");
    const original = state.request.mock.calls[0][0].request as LiliChatRequest;
    state.context = { experimentId: "pendulum", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 0, recordCount: 0 }; app.render();
    held.resolve({ ...createLiliGuidance(original.question, original.context), suggestions: ["弹簧原长与总长如何区分？"] }); await settle(); app.render();
    expect(replies(app)).toHaveLength(0);
    expect(state.request.mock.calls[0][0].signal.aborted).toBe(true);
    expect(ladder(app).props.currentLevel).toBe(0);
    expect(suggestions(app)).not.toContain("弹簧原长与总长如何区分？");
    expect(text(app.tree)).not.toContain("力力正在整理思路");
  });
  it("cancelled ordinary questions do not count as hints and returning home offers homepage suggestions", async () => {
    const held = deferred(); state.request.mockReturnValueOnce(held.promise).mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation(); app.ask("先做什么？");
    click(find(app.tree, "button", "停止等待")); app.render();
    held.resolve({ text: "迟到回答", mode: "guided", suggestions: ["旧建议"], sources: [] }); await settle(); app.render();
    expect(ladder(app).props.currentLevel).toBe(0);
    expect(text(app.tree)).not.toContain("迟到回答");
    state.context = null; app.render();
    expect(ladder(app)).toBeUndefined();
    app.ask("平抛运动怎么探究？"); await settle(); app.render();
    expect(suggestions(app)).toContain("平抛运动要记录什么？");
    state.context = context(); app.render();
    expect(ladder(app).props.currentLevel).toBe(0);
    expect(suggestions(app)).not.toContain("平抛运动要记录什么？");
  });
});

describe("completed dialogue and local current checks", () => {
  it("keeps the last three completed same-experiment pairs, clips text and excludes abandoned questions", () => {
    const spring = context(), pendulum = { ...context(), experimentId: "pendulum" };
    const messages = Array.from({ length: 5 }, (_, index) => [
      { id: `q-${index}`, role: "student" as const, text: `原问题${index}`, ...(index === 4 ? { effectiveQuestion: "给我三级提示" } : {}) },
      { id: `q-${index}-reply`, role: "lili" as const, text: `回答${index}`, questionContext: spring },
    ]).flat();
    messages.push({ id: "cancelled", role: "student", text: "取消的内容" });
    messages.push({ id: "other", role: "student", text: "单摆问题" }, { id: "other-reply", role: "lili", text: "单摆回答", questionContext: pendulum });
    const history = collectLiliRecentDialogue(messages, spring);
    expect(history.map(turn => turn.question)).toEqual(["原问题2", "原问题3", "给我三级提示"]);
    expect(history.map(turn => turn.answer)).toEqual(["回答2", "回答3", "回答4"]);
    expect(collectLiliRecentDialogue(messages, null)).toEqual([]);
    expect(collectLiliRecentDialogue([{ id: "long", role: "student", text: "问".repeat(1700) }, { id: "long-reply", role: "lili", text: "答".repeat(2500), questionContext: spring }], spring)[0]).toMatchObject({ question: "问".repeat(1600), answer: "答".repeat(2400) });
  });
  it("keeps repeated relative hints local after the bounded history has dropped the first explicit question", () => {
    state.request.mockReturnValue(new Promise(() => {}));
    const app = mountConversation(); app.ask("给我一级提示");
    for (let index = 0; index < 5; index++) app.ask("再给一点提示");
    expect(state.request).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(text(replies(app).at(-1))).toContain("三级提示 ·");
    expect(text(replies(app).at(-1))).not.toContain("四级");
    const students = nodes(app.tree).filter(node => node.type === "article" && node.props.className === "lili-message is-student");
    expect(text(students.at(-1))).toContain("再给一点提示");
    expect(text(students.at(-1))).not.toContain("给我三级提示");
  });
  it("passes only completed current-experiment context to repeated why questions and preserves their original display", async () => {
    state.request.mockImplementation(({ localReply }) => Promise.resolve(localReply));
    const app = mountConversation(); app.ask("怎样控制变量？"); await settle(); app.render();
    for (let index = 0; index < 5; index++) { app.ask("为什么？"); await settle(); app.render(); }
    const latestRequest = state.request.mock.calls.at(-1)![0].request as LiliChatRequest;
    expect(latestRequest.question).toBe("为什么？");
    expect(latestRequest.recentDialogue).toHaveLength(3);
    expect(latestRequest.recentDialogue!.every(turn => turn.experimentId === "spring-force" && turn.question === "为什么要控制变量？")).toBe(true);
    expect(text(replies(app).at(-1))).toContain("如果几项一起变，就难以区分各自影响");
    state.context = { experimentId: "pendulum", parameters: defaultHighSchoolParameters("pendulum"), timeSeconds: 0, recordCount: 0 }; app.render();
    const before = state.request.mock.calls.length;
    app.ask("为什么？");
    expect(state.request).toHaveBeenCalledTimes(before);
    expect(text(replies(app).at(-1))).toContain("你想继续哪一部分");
  });
  it("checks the new wiring immediately after correction while keeping the old error snapshot intact", () => {
    state.request.mockReturnValue(new Promise(() => {}));
    state.context = { experimentId: "multimeter", parameters: { ...defaultHighSchoolParameters("multimeter"), functionMode: 1, connection: 0 }, timeSeconds: 0, recordCount: 0 };
    const app = mountConversation(); app.ask("帮我检查当前实验");
    expect(text(replies(app)[0])).toContain("当前接法或供电状态无效");
    state.context.parameters.connection = 1; app.render(); app.ask("现在呢？");
    expect(state.request).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(text(replies(app)[1])).not.toContain("当前接法或供电状态无效");
    expect(text(replies(app)[1])).toContain("不表示所有实验步骤都已验证");
    expect(snapshotHtml(replies(app)[0])).toContain("并联待测电阻");
    expect(snapshotHtml(replies(app)[1])).toContain("串联回路");
  });
});
