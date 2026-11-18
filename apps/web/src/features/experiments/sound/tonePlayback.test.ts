import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachTonePlaybackLifecycle, createTonePlaybackController, type ToneAudioContext } from "./tonePlayback";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class AudioContextDouble extends EventTarget {
  state: string;
  currentTime = 12;
  destination = {};
  resumed = deferred();
  oscillator = {
    type: "sine", frequency: { value: 0, setTargetAtTime: vi.fn() },
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn()
  };
  gain = { gain: { value: 0, setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
  createOscillator = vi.fn(() => this.oscillator as unknown as OscillatorNode);
  createGain = vi.fn(() => this.gain as unknown as GainNode);
  resume = vi.fn(() => this.resumed.promise);
  close = vi.fn(() => { this.state = "closed"; return Promise.resolve(); });
  constructor(state = "suspended") { super(); this.state = state; }
  asContext() { return this as unknown as ToneAudioContext; }
  changeState(state: string) { this.state = state; this.dispatchEvent(new Event("statechange")); }
}

class VisibilityDouble extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  hide() { this.visibilityState = "hidden"; this.dispatchEvent(new Event("visibilitychange")); }
}

const parameters = { frequency: 330, amplitude: 42, timbre: "sine" as const };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("tone playback without audio hardware", () => {
  it.each(["unsupported", "constructor"])("reports %s without recording fake playback", async (failure) => {
    const controller = createTonePlaybackController({ createContext: () => {
      if (failure === "constructor") throw new Error("construction failed");
      return null;
    } });
    const changed = vi.fn(); const detach = attachTonePlaybackLifecycle(controller, changed);
    expect(await controller.start(parameters)).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ status: "error" });
    expect(controller.getSnapshot().message).toContain("波形和对照仍可使用");
    expect(changed).not.toHaveBeenCalled();
    detach();
  });

  it.each(["oscillator", "gain", "oscillator-connect", "gain-connect", "start", "resume", "listener"])("cleans partial resources after %s throws", async (failure) => {
    const context = new AudioContextDouble(failure === "start" ? "running" : "suspended");
    const crash = () => { throw new Error("browser failure"); };
    if (failure === "oscillator") context.createOscillator.mockImplementation(crash);
    if (failure === "gain") context.createGain.mockImplementation(crash);
    if (failure === "oscillator-connect") context.oscillator.connect.mockImplementation(crash);
    if (failure === "gain-connect") context.gain.connect.mockImplementation(crash);
    if (failure === "start") context.oscillator.start.mockImplementation(crash);
    if (failure === "resume") context.resume.mockImplementation(crash);
    if (failure === "listener") vi.spyOn(context, "addEventListener").mockImplementation(crash);
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    expect(await controller.start(parameters)).toBe(false);
    expect(controller.getSnapshot().status).toBe("error");
    expect(context.close).toHaveBeenCalledOnce();
    if (failure !== "oscillator") expect(context.oscillator.disconnect).toHaveBeenCalledOnce();
    if (failure !== "oscillator" && failure !== "gain") expect(context.gain.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for resume fulfillment and a running context before starting the oscillator or emitting playback", async () => {
    const context = new AudioContextDouble();
    const factory = vi.fn(() => context.asContext());
    const controller = createTonePlaybackController({ createContext: factory });
    const changed = vi.fn(); const detach = attachTonePlaybackLifecycle(controller, changed);
    const first = controller.start(parameters);
    expect(controller.start(parameters)).toBe(first);
    context.changeState("running");
    expect(controller.getSnapshot().status).toBe("starting");
    expect(context.oscillator.start).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    controller.update({ frequency: 440, amplitude: 70, timbre: "triangle" });
    context.resumed.resolve();
    expect(await first).toBe(true);
    expect(controller.getSnapshot().status).toBe("playing");
    expect(changed.mock.calls).toEqual([[true]]);
    expect(context.oscillator.type).toBe("triangle");
    expect(context.oscillator.frequency.setTargetAtTime).toHaveBeenLastCalledWith(440, 12, .02);
    expect(context.gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(.008 + 70 / 4200, 12, .02);
    await controller.start(parameters);
    expect(factory).toHaveBeenCalledOnce();
    expect(context.oscillator.start).toHaveBeenCalledOnce();
    expect(changed.mock.calls).toEqual([[true]]);
    detach();
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });

  it("starts an already running context once with the original low-gain formula", async () => {
    const context = new AudioContextDouble("running");
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    expect(await controller.start(parameters)).toBe(true);
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.oscillator.frequency.value).toBe(330);
    expect(context.gain.gain.value).toBe(.008 + 42 / 4200);
    controller.stop(); controller.stop();
    expect(context.oscillator.stop).toHaveBeenCalledOnce();
    expect(context.oscillator.disconnect).toHaveBeenCalledOnce();
    expect(context.gain.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it.each(["reject", "still-suspended"])("fails safely when resume %s", async (outcome) => {
    const context = new AudioContextDouble();
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    const changed = vi.fn(); const detach = attachTonePlaybackLifecycle(controller, changed);
    const start = controller.start(parameters);
    if (outcome === "reject") context.resumed.reject(new Error("not allowed"));
    else context.resumed.resolve();
    expect(await start).toBe(false);
    expect(controller.getSnapshot().status).toBe("error");
    expect(context.oscillator.start).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
    detach();
  });

  it("times out a never-settling resume and ignores its eventual success after a new run", async () => {
    const oldContext = new AudioContextDouble(); const newContext = new AudioContextDouble("running");
    const factory = vi.fn().mockReturnValueOnce(oldContext.asContext()).mockReturnValueOnce(newContext.asContext());
    const controller = createTonePlaybackController({ createContext: factory });
    const oldStart = controller.start(parameters);
    vi.advanceTimersByTime(5999);
    expect(controller.getSnapshot().status).toBe("starting");
    vi.advanceTimersByTime(1);
    expect(await oldStart).toBe(false);
    expect(controller.getSnapshot().message).toContain("超时");
    expect(await controller.start(parameters)).toBe(true);
    oldContext.changeState("running"); oldContext.resumed.resolve(); await flush();
    expect(oldContext.oscillator.start).not.toHaveBeenCalled();
    expect(oldContext.close).toHaveBeenCalledOnce();
    expect(newContext.oscillator.start).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe("playing");
    controller.stop();
  });

  it.each(["resolve", "reject"])("settles a cancelled start immediately and ignores late resume %s", async (outcome) => {
    const context = new AudioContextDouble();
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    const start = controller.start(parameters);
    controller.stop();
    expect(await start).toBe(false);
    expect(controller.getSnapshot().message).toContain("已取消");
    if (outcome === "resolve") { context.changeState("running"); context.resumed.resolve(); }
    else context.resumed.reject(new Error("late rejection"));
    await flush();
    expect(controller.getSnapshot().status).toBe("idle");
    expect(context.oscillator.start).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["suspended", "interrupted", "closed"])("stops on %s and requires another user start", async (state) => {
    const context = new AudioContextDouble("running");
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    const changed = vi.fn(); const detach = attachTonePlaybackLifecycle(controller, changed);
    await controller.start(parameters);
    context.changeState(state);
    expect(controller.getSnapshot()).toMatchObject({ status: "error" });
    expect(controller.getSnapshot().message).toContain("重新点击");
    expect(changed.mock.calls).toEqual([[true], [false]]);
    context.changeState("running"); await flush();
    expect(controller.getSnapshot().status).toBe("error");
    expect(context.oscillator.start).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    detach();
  });

  it.each([false, true])("cancels on hidden pages, including pending=%s", async (pending) => {
    const context = new AudioContextDouble(pending ? "suspended" : "running");
    const visibility = new VisibilityDouble();
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    const changed = vi.fn(); const detach = attachTonePlaybackLifecycle(controller, changed, visibility);
    const start = controller.start(parameters);
    visibility.hide();
    expect(await start).toBe(!pending);
    expect(controller.getSnapshot().message).toContain("页面已隐藏");
    context.changeState("running"); context.resumed.resolve(); await flush();
    expect(controller.getSnapshot().status).toBe("idle");
    expect(changed.mock.calls).toEqual(pending ? [] : [[true], [false]]);
    expect(context.oscillator.start).toHaveBeenCalledTimes(pending ? 0 : 1);
    detach();
  });

  it("cancels on unmount and supports StrictMode-style cleanup/remount without reviving the old source", async () => {
    const oldContext = new AudioContextDouble(); const newContext = new AudioContextDouble("running");
    const factory = vi.fn().mockReturnValueOnce(oldContext.asContext()).mockReturnValueOnce(newContext.asContext());
    const controller = createTonePlaybackController({ createContext: factory });
    const changed = vi.fn();
    const firstCleanup = attachTonePlaybackLifecycle(controller, changed);
    const oldStart = controller.start(parameters);
    firstCleanup();
    expect(await oldStart).toBe(false);
    const secondCleanup = attachTonePlaybackLifecycle(controller, changed);
    expect(await controller.start(parameters)).toBe(true);
    oldContext.changeState("running"); oldContext.resumed.resolve(); await flush();
    expect(oldContext.oscillator.start).not.toHaveBeenCalled();
    expect(newContext.oscillator.start).toHaveBeenCalledOnce();
    expect(changed.mock.calls).toEqual([[true]]);
    secondCleanup();
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });

  it.each(["reject", "throw"])("catches close %s and still releases both audio nodes", async (outcome) => {
    const context = new AudioContextDouble("running");
    context.oscillator.stop.mockImplementation(() => { throw new Error("stop failed"); });
    context.oscillator.disconnect.mockImplementation(() => { throw new Error("disconnect failed"); });
    context.gain.disconnect.mockImplementation(() => { throw new Error("output disconnect failed"); });
    context.close.mockImplementation(() => {
      if (outcome === "throw") throw new Error("close failed");
      return Promise.reject(new Error("close rejected"));
    });
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    await controller.start(parameters);
    expect(() => controller.stop()).not.toThrow();
    await flush();
    expect(context.oscillator.stop).toHaveBeenCalledOnce();
    expect(context.oscillator.disconnect).toHaveBeenCalledOnce();
    expect(context.gain.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("stops and reports a failed live parameter update without replacing the oscillator", async () => {
    const context = new AudioContextDouble("running");
    const controller = createTonePlaybackController({ createContext: () => context.asContext() });
    await controller.start(parameters);
    context.gain.gain.setTargetAtTime.mockImplementation(() => { throw new Error("parameter failed"); });
    controller.update({ ...parameters, amplitude: 70 });
    expect(controller.getSnapshot().status).toBe("error");
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.createOscillator).toHaveBeenCalledOnce();
  });
});
