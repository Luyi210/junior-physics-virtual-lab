export interface ToneParameters {
  frequency: number;
  amplitude: number;
  timbre: "sine" | "triangle" | "square";
}

export interface TonePlaybackSnapshot {
  status: "idle" | "starting" | "playing" | "error";
  message: string;
}

export type ToneAudioContext = Pick<AudioContext, "state" | "currentTime" | "destination" | "createOscillator" | "createGain" | "resume" | "close" | "addEventListener" | "removeEventListener">;

interface ToneRun {
  context?: ToneAudioContext;
  oscillator?: OscillatorNode;
  gain?: GainNode;
  stateListener?: () => void;
  timer?: ReturnType<typeof setTimeout>;
  started: boolean;
  promise: Promise<boolean>;
  settle: (playing: boolean) => void;
}

const IDLE: TonePlaybackSnapshot = { status: "idle", message: "试听可选，调整参数即可观察和比较波形。" };

function browserAudioContext(): ToneAudioContext | null {
  if (typeof window === "undefined") return null;
  const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : null;
}

export function createTonePlaybackController(options: { createContext?: () => ToneAudioContext | null; timeoutMs?: number } = {}) {
  let snapshot = IDLE;
  let active: ToneRun | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: TonePlaybackSnapshot) => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  // Each cleanup step is independent: one browser error must not skip the remaining resources.
  const release = (run: ToneRun) => {
    if (run.timer !== undefined) clearTimeout(run.timer);
    const { context, oscillator, gain, stateListener } = run;
    run.context = undefined; run.oscillator = undefined; run.gain = undefined; run.stateListener = undefined;
    try { if (context && stateListener) context.removeEventListener("statechange", stateListener); } catch { /* detached below */ }
    try { oscillator?.stop(); } catch { /* an oscillator may not have started */ }
    try { oscillator?.disconnect(); } catch { /* continue disconnecting the output */ }
    try { gain?.disconnect(); } catch { /* still close the context */ }
    try { if (context) void Promise.resolve(context.close()).catch(() => {}); } catch { /* already closed or unavailable */ }
  };

  const finish = (run: ToneRun, next: TonePlaybackSnapshot) => {
    if (active !== run) return;
    active = undefined;
    // Settle cancellation immediately, even if the browser's resume() never settles.
    run.settle(false);
    release(run);
    publish(next);
  };

  const fail = (run: ToneRun, message: string) => finish(run, { status: "error", message: `${message}波形和对照仍可使用。` });

  const update = (parameters: ToneParameters) => {
    const run = active;
    if (!run?.context || !run.oscillator || !run.gain) return;
    try {
      run.oscillator.frequency.setTargetAtTime(parameters.frequency, run.context.currentTime, .02);
      run.gain.gain.setTargetAtTime(.008 + parameters.amplitude / 4200, run.context.currentTime, .02);
      run.oscillator.type = parameters.timbre;
    } catch { fail(run, "试听参数更新失败，请重新点击试听。"); }
  };

  const start = (parameters: ToneParameters): Promise<boolean> => {
    if (active) { const promise = active.promise; update(parameters); return promise; }
    let settle!: (playing: boolean) => void;
    const promise = new Promise<boolean>((resolve) => { settle = resolve; });
    const run: ToneRun = { promise, settle, started: false };
    active = run;
    publish({ status: "starting", message: "正在启动试听，可再次点击取消。" });
    if (active !== run) return promise;
    run.timer = setTimeout(() => fail(run, "试听启动超时，请重新点击试听。"), options.timeoutMs ?? 6000);

    const begin = () => {
      if (active !== run) return;
      if (run.context?.state !== "running") { fail(run, "浏览器尚未允许播放，请重新点击试听。"); return; }
      try {
        run.oscillator!.start();
        run.started = true;
        if (active !== run) return;
        if (run.context.state !== "running") { fail(run, "试听被浏览器中断，请重新点击试听。"); return; }
        clearTimeout(run.timer);
        run.settle(true);
        publish({ status: "playing", message: "正在低音量试听；可停止试听后继续比较波形。" });
      } catch { fail(run, "声源启动失败，请重新点击试听。"); }
    };

    try {
      const context = (options.createContext ?? browserAudioContext)();
      if (!context) { fail(run, "当前浏览器不支持试听，可换用支持音频的浏览器。"); return promise; }
      run.context = context;
      run.oscillator = context.createOscillator();
      run.gain = context.createGain();
      run.oscillator.type = parameters.timbre;
      run.oscillator.frequency.value = parameters.frequency;
      run.gain.gain.value = .008 + parameters.amplitude / 4200;
      run.oscillator.connect(run.gain);
      run.gain.connect(context.destination);
      run.stateListener = () => {
        if (active !== run) return;
        if ((run.started && context.state !== "running") || context.state === "closed" || String(context.state) === "interrupted") {
          fail(run, "试听被浏览器暂停或中断，请重新点击试听。");
        }
      };
      context.addEventListener("statechange", run.stateListener);
      if (context.state === "running") begin();
      else {
        // A statechange to running alone is not enough: wait for resume() to fulfill.
        void Promise.resolve(context.resume()).then(begin, () => fail(run, "浏览器未能启动试听，请重新点击试听。"));
      }
    } catch { fail(run, "音频装置初始化失败，请重新点击试听。"); }
    return promise;
  };

  const stop = (reason: "user" | "hidden" | "unmount" = "user") => {
    if (!active) return;
    const pending = snapshot.status === "starting";
    finish(active, { status: "idle", message: reason === "hidden"
      ? "页面已隐藏，试听已停止；返回后请重新点击试听。"
      : pending ? "已取消试听启动，仍可调整参数和比较波形。" : "试听已停止，仍可调整参数和比较波形。" });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start, update, stop
  };
}

export type TonePlaybackController = ReturnType<typeof createTonePlaybackController>;

export function tonePlaybackView(snapshot: TonePlaybackSnapshot) {
  return {
    playing: snapshot.status === "playing",
    pending: snapshot.status === "starting",
    buttonLabel: snapshot.status === "starting" ? "取消启动试听" : snapshot.status === "error" ? "重试低音量试听" : "低音量试听",
    message: snapshot.message
  };
}

type VisibilitySource = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

/** Shared by the hook and tests; cleanup cancels a run but leaves the controller reusable in StrictMode. */
export function attachTonePlaybackLifecycle(controller: TonePlaybackController, onPlayingChange: (playing: boolean) => void, visibility?: VisibilitySource) {
  let wasPlaying = controller.getSnapshot().status === "playing";
  const unsubscribe = controller.subscribe(() => {
    const playing = controller.getSnapshot().status === "playing";
    if (playing !== wasPlaying) { wasPlaying = playing; onPlayingChange(playing); }
  });
  const onVisibilityChange = () => { if (visibility?.visibilityState === "hidden") controller.stop("hidden"); };
  visibility?.addEventListener("visibilitychange", onVisibilityChange);
  onVisibilityChange();
  return () => {
    controller.stop("unmount");
    unsubscribe();
    visibility?.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
