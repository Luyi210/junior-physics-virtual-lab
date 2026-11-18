import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessApparatusContext } from "@physics-lab/harness";
import { appendDialogueExchange } from "@physics-lab/harness";

const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => {}), find: vi.fn(async () => undefined), ask: vi.fn(), hasSession: vi.fn(() => true),
  scope: { revision: 1, mode: "account", canWrite: true }, listeners: new Set<() => void>(),
  apparatusListeners: new Set<(context: HarnessApparatusContext) => void>(),
  apparatus: undefined as HarnessApparatusContext | undefined,
}));
vi.mock("../../data/harnessSessionRepository", () => ({ localHarnessSessionRepository: { save: mocks.save, find: mocks.find } }));
vi.mock("../../data/studentSessionSync", () => ({ syncHarnessEvent: vi.fn(), syncHarnessObservation: vi.fn() }));
vi.mock("../../data/teacherApi", () => ({ studentApi: { hasSession: mocks.hasSession, askGuangguang: mocks.ask } }));
vi.mock("../../data/studentRecordScope", () => ({
  getStudentRecordScope: () => ({ ...mocks.scope }),
  subscribeStudentRecordScope: (callback: () => void) => { mocks.listeners.add(callback); return () => mocks.listeners.delete(callback); },
}));
vi.mock("./tutorialBridge", () => ({ getApparatusContext: () => mocks.apparatus,
  subscribeApparatusSnapshots: (callback: (context: HarnessApparatusContext) => void) => { mocks.apparatusListeners.add(callback); return () => mocks.apparatusListeners.delete(callback); },
}));

function context(value = 400): HarnessApparatusContext {
  return { current: { module: "sound-features", capturedAt: "2026-11-12T00:00:00.000Z", origin: "learner",
    controls: [{ id: "frequency", label: "频率", value, unit: "Hz", source: "control" }], apparatus: [], readings: [], derived: [], validity: { ready: true, issues: [] } } };
}
function deferred() {
  let resolve!: (value: { text: string; citations: [] }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ text: string; citations: [] }>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve: (text = "远程解释") => resolve({ text, citations: [] }), reject };
}
async function setup() {
  const { useHarnessStore } = await import("./harnessStore");
  await useHarnessStore.getState().enterArea("sound", "sound-features");
  return useHarnessStore;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T00:00:00.000Z"));
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  mocks.scope = { revision: 1, mode: "account", canWrite: true };
  mocks.apparatus = context(); mocks.listeners.clear(); mocks.apparatusListeners.clear(); mocks.ask.mockReset(); mocks.save.mockClear(); mocks.find.mockClear(); mocks.hasSession.mockReturnValue(true);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("Guangguang question lifecycle", () => {
  it.each([undefined, { text: "", citations: [] }, { text: "   ", citations: [] }, { text: "缺少来源字段" }, { text: "损坏的来源", citations: [null] }])("falls back instead of displaying an empty or broken online answer: %j", async reply => {
    const store = await setup(); mocks.ask.mockResolvedValue(reply);
    expect(await store.getState().askQuestion("当前频率说明什么？")).toBe(true);
    expect(store.getState()).toMatchObject({ asking: false, dialogueProvider: "rules", dialogueFallbackReason: "request-failed" });
    const last = store.getState().session?.dialogue?.at(-1);
    expect(last?.text.trim().length).toBeGreaterThan(0);
    expect(last?.provider).toBe("rules");
  });

  it("keeps a pending answer without reopening the dismissed panel and permits local follow-up", async () => {
    const store = await setup(), request = deferred(); mocks.ask.mockReturnValue(request.promise);
    store.getState().setPanelOpen(true);
    const pending = store.getState().askQuestion("当前频率说明什么？");
    store.getState().setPanelOpen(false);
    request.resolve("根据提问时的频率回答。");
    expect(await pending).toBe(true);
    expect(store.getState().panelOpen).toBe(false);
    store.getState().setPanelOpen(true);
    expect(store.getState().session?.dialogue?.at(-1)?.text).toBe("根据提问时的频率回答。");
    expect(await store.getState().askQuestion("帮我检查当前实验")).toBe(true);
    expect(store.getState().dialogueProvider).toBe("rules");
  });

  it("plans from current blockers locally, and uses a fresh explanation for a short rephrase", async () => {
    const store = await setup();
    mocks.apparatus!.current.validity.issues = ["请先确认频率设置"];
    expect(await store.getState().askQuestion("帮我规划下一步")).toBe(true);
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(store.getState().dialogueFallbackReason).toBe("guided-next-step");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("请先确认频率设置");
    mocks.apparatus!.current.validity.issues = [];
    await store.getState().askQuestion("换个说法");
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(store.getState().dialogueFallbackReason).toBe("guided-follow-up");
    expect(store.getState().asking).toBe(false);
  });

  it("freezes the sent apparatus and preserves its labelled evidence when controls change while waiting", async () => {
    const request = deferred(); mocks.ask.mockReturnValue(request.promise); const store = await setup();
    const pending = store.getState().askQuestion("当前频率说明什么？");
    const sent = mocks.ask.mock.calls[0]![0];
    mocks.apparatus!.current.controls[0]!.value = 800;
    expect(sent.context.apparatus.current.controls[0].value).toBe(400);
    store.getState().record("control.changed", { control: "频率", value: 800 });
    request.resolve(); expect(await pending).toBe(true);
    expect(store.getState().session?.dialogue?.at(-1)?.contextSnapshot).toMatchObject({
      changedWhileWaiting: true, apparatusAvailable: true, evidence: expect.arrayContaining(["控件 · 频率：400Hz"]),
    });
    expect(store.getState().session?.events.some((event) => event.payload.value === 800)).toBe(true);
  });

  it("rejects a late answer after leaving A and returning to A, without clearing a new pending request", async () => {
    const old = deferred(); const next = deferred(); mocks.ask.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const store = await setup(); const first = store.getState().askQuestion("频率变化说明什么？");
    const oldSignal = mocks.ask.mock.calls[0]![1] as AbortSignal;
    await store.getState().enterArea("sound", "sound-medium");
    await store.getState().enterArea("sound", "sound-features");
    expect(oldSignal.aborted).toBe(true); expect(await first).toBe(false);
    const second = store.getState().askQuestion("响度变化说明什么？"); old.resolve("不应显示的旧回答");
    await Promise.resolve(); expect(store.getState().asking).toBe(true);
    expect(store.getState().session?.dialogue).toBeUndefined();
    next.resolve("新回答"); expect(await second).toBe(true);
    expect(store.getState().session?.dialogue?.map((message) => message.text)).toEqual(["响度变化说明什么？", "新回答"]);
  });

  it("remembers an apparatus change even after its values return to the original setting", async () => {
    const request = deferred(); mocks.ask.mockReturnValue(request.promise); const store = await setup();
    const pending = store.getState().askQuestion("当前频率说明什么？");
    mocks.apparatus = context(800); for (const callback of mocks.apparatusListeners) callback(mocks.apparatus);
    mocks.apparatus = context(400); for (const callback of mocks.apparatusListeners) callback(mocks.apparatus);
    request.resolve(); expect(await pending).toBe(true);
    expect(store.getState().session?.dialogue?.at(-1)?.contextSnapshot?.changedWhileWaiting).toBe(true);
    expect(mocks.apparatusListeners.size).toBe(0);
  });

  it("cancels on leaving all experiment routes and permits a fresh question after re-entry", async () => {
    const request = deferred(); mocks.ask.mockReturnValue(request.promise); const store = await setup();
    const pending = store.getState().askQuestion("下一步？"); store.getState().leaveArea();
    expect(await pending).toBe(false); expect(store.getState()).toMatchObject({ asking: false, activeModule: undefined, session: undefined });
    request.resolve(); await store.getState().enterArea("sound", "sound-features");
    expect(store.getState().session?.dialogue).toBeUndefined();
  });

  it.each(["notified", "read-at-response"])("discards account changes (%s), with no local fallback inserted", async (mode) => {
    const request = deferred(); mocks.ask.mockReturnValue(request.promise); const store = await setup();
    const pending = store.getState().askQuestion("下一步？"); mocks.scope.revision += 1;
    if (mode === "notified") for (const callback of [...mocks.listeners]) callback();
    request.resolve("另一身份的回答"); expect(await pending).toBe(false);
    expect(store.getState().session?.dialogue).toBeUndefined(); expect(store.getState().asking).toBe(false);
    expect(mocks.listeners.size).toBe(1);
    store.getState().leaveArea(); expect(mocks.listeners.size).toBe(0);
  });

  it("stops a request immediately even if the provider ignores AbortSignal, and allows retry", async () => {
    mocks.ask.mockReturnValue(new Promise(() => {})); const store = await setup();
    const first = store.getState().askQuestion("当前频率说明什么？"); store.getState().cancelQuestion();
    expect(await first).toBe(false); expect(store.getState().questionNotice).toContain("已停止");
    expect(store.getState().session?.dialogue).toBeUndefined();
    mocks.hasSession.mockReturnValue(false); expect(await store.getState().askQuestion("给我一级提示")).toBe(true);
    expect(store.getState().session?.dialogue?.at(-1)?.provider).toBe("rules");
  });

  it("bounds remote waiting and returns a clearly marked local answer on timeout", async () => {
    mocks.ask.mockReturnValue(new Promise(() => {})); const store = await setup();
    const pending = store.getState().askQuestion("当前频率说明什么？"); await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toBe(true); expect((mocks.ask.mock.calls[0]![1] as AbortSignal).aborted).toBe(true);
    expect(store.getState()).toMatchObject({ asking: false, dialogueProvider: "rules", dialogueFallbackReason: "request-failed" });
    expect(store.getState().session?.dialogue?.at(-1)?.contextSnapshot).toBeDefined(); expect(mocks.listeners.size).toBe(1);
    store.getState().leaveArea(); expect(mocks.listeners.size).toBe(0);
  });

  it("keeps unavailable snapshots honest in local guidance and blocks repeated submit", async () => {
    mocks.apparatus = undefined; const request = deferred(); mocks.ask.mockReturnValue(request.promise); const store = await setup();
    const pending = store.getState().askQuestion("当前频率说明什么？"); expect(await store.getState().askQuestion("第二个问题")).toBe(false);
    request.reject(new Error("offline")); expect(await pending).toBe(true);
    expect(store.getState().session?.dialogue?.at(-1)?.contextSnapshot).toMatchObject({ apparatusAvailable: false, evidence: [] });
    expect(store.getState().dialogueFallbackReason).toBe("request-failed");
  });

  it("does not lose a completed reply when switching modules before the delayed IndexedDB save", async () => {
    mocks.hasSession.mockReturnValue(false); const store = await setup(); await store.getState().askQuestion("给我一级提示");
    await store.getState().enterArea("sound", "sound-medium"); await store.getState().enterArea("sound", "sound-features");
    expect(store.getState().session?.dialogue).toHaveLength(2);
  });

  it.each(["给我一级提示", "给我二级提示", "给我3级提示"])("uses a bounded local hint even when logged in: %s", async (question) => {
    const store = await setup(); expect(await store.getState().askQuestion(question)).toBe(true);
    expect(mocks.ask).not.toHaveBeenCalled(); expect(store.getState().dialogueFallbackReason).toBe("guided-hint");
    expect(store.getState().session?.dialogue?.at(-1)?.provider).toBe("rules");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("级提示");
  });

  it("checks the current apparatus locally even for a logged-in user", async () => {
    mocks.apparatus!.current.validity = { ready: true, issues: ["当前装置仍需核对频率设置"] };
    const store = await setup(); await store.getState().askQuestion("帮我检查当前实验");
    expect(mocks.ask).not.toHaveBeenCalled(); expect(store.getState().dialogueFallbackReason).toBe("guided-check");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("仍需核对频率设置");
  });

  it("does not initialize the new conversation window from persisted dialogue", async () => {
    const store = await setup(); const session = appendDialogueExchange(store.getState().session!, "sound-features", "私有旧话题", { intent: "explain", text: "过去的回答", followUps: [] });
    store.setState({ session }); await store.getState().askQuestion("为什么？");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("还不能确定");
    expect(store.getState().session?.dialogue?.at(-1)?.text).not.toContain("私有旧话题");
    expect(store.getState().session?.dialogue?.[0]?.text).toBe("私有旧话题");
  });

  it("continues a current topic but clears follow-up context and hint state on an idle identity change", async () => {
    mocks.hasSession.mockReturnValue(false); const store = await setup();
    await store.getState().askQuestion("频率变高会怎样？"); await store.getState().askQuestion("为什么？");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("频率变高会怎样");
    await store.getState().askQuestion("给我二级提示"); expect(store.getState().guidedHintLevel).toBe(2);
    mocks.scope.revision += 1; for (const callback of [...mocks.listeners]) callback();
    expect(store.getState().guidedHintLevel).toBe(0);
    await store.getState().askQuestion("为什么？");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("还不能确定"); expect(store.getState().guidedHintLevel).toBe(0);
  });

  it("clears the conversation window on leaving and returning to the same module", async () => {
    mocks.hasSession.mockReturnValue(false); const store = await setup(); await store.getState().askQuestion("频率变高会怎样？");
    await store.getState().enterArea("sound", "sound-medium"); await store.getState().enterArea("sound", "sound-features");
    await store.getState().askQuestion("为什么？"); expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("还不能确定");
  });

  it("keeps a resolved topic across five short follow-ups without changing the learner's visible words", async () => {
    mocks.hasSession.mockReturnValue(false); const store = await setup();
    await store.getState().askQuestion("频率变高会怎样？");
    for (const question of ["为什么？", "没看懂", "为什么？", "没看懂", "为什么？"]) {
      await store.getState().askQuestion(question);
      expect(store.getState().session?.dialogue?.at(-2)?.text).toBe(question);
      expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("频率变高会怎样");
      expect(store.getState().session?.dialogue?.at(-1)?.text).not.toContain("还不能确定");
    }
    expect(store.getState().guidedHintLevel).toBe(0);
  });

  it("does not invent a topic after five short follow-ups without an earlier explicit question", async () => {
    const store = await setup();
    for (const question of ["为什么？", "没看懂", "为什么？", "没看懂", "为什么？"]) {
      await store.getState().askQuestion(question);
      expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("还不能确定");
    }
    expect(mocks.ask).not.toHaveBeenCalled();
  });

  it("does not carry an old discussion topic forward through repeated next-step apparatus checks", async () => {
    mocks.hasSession.mockReturnValue(false); const store = await setup();
    await store.getState().askQuestion("频率变高会怎样？");
    for (let index = 0; index < 3; index += 1) {
      await store.getState().askQuestion("下一步呢？");
      expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("先看装置现在需要什么");
    }
    await store.getState().askQuestion("为什么？");
    expect(store.getState().session?.dialogue?.at(-1)?.text).toContain("还不能确定");
    expect(store.getState().session?.dialogue?.at(-1)?.text).not.toContain("频率变高会怎样");
  });

  it("keeps relative hints capped at three beyond the three-pair memory window while preserving visible wording", async () => {
    const store = await setup(); await store.getState().askQuestion("给我一级提示");
    for (let index = 0; index < 6; index += 1) {
      await store.getState().askQuestion("再给一点提示");
      expect(store.getState().guidedHintLevel).toBe(index === 0 ? 2 : 3);
      expect(store.getState().session?.dialogue?.at(-2)?.text).toBe("再给一点提示");
      expect(store.getState().session?.dialogue?.at(-1)?.text).toContain(index === 0 ? "二级提示" : "三级提示");
    }
    expect(mocks.ask).not.toHaveBeenCalled();
  });

  it("sends only the bounded current-identity window and current-page events to ordinary network questions", async () => {
    const store = await setup(); mocks.hasSession.mockReturnValue(false);
    for (let index = 0; index < 5; index += 1) await store.getState().askQuestion(`频率变高会怎样${index}？`);
    mocks.hasSession.mockReturnValue(true); const first = deferred(); mocks.ask.mockReturnValueOnce(first.promise);
    const pending = store.getState().askQuestion("请解释音调");
    expect(mocks.ask.mock.calls[0]![0].context.recentDialogue).toHaveLength(6);
    first.resolve(); await pending;
    mocks.scope.revision += 1; const second = deferred(); mocks.ask.mockReturnValueOnce(second.promise);
    const changed = store.getState().askQuestion("请解释响度"); const sent = mocks.ask.mock.calls[1]![0].context;
    expect(sent.recentDialogue).toEqual([]); expect(sent.recentEvents).toEqual([]); expect(sent.observations).toEqual([]);
    second.resolve(); await changed;
  });
});
