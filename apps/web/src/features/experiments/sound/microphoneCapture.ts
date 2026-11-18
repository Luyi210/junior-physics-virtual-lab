interface CaptureRun {
  stream?: MediaStream;
  context?: AudioContext;
  source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
}

interface CaptureOptions {
  getUserMedia?: () => Promise<MediaStream>;
  createContext?: () => AudioContext;
}

function release(run: CaptureRun) {
  const { stream, context, source, analyser } = run;
  run.stream = undefined; run.context = undefined; run.source = undefined; run.analyser = undefined;
  try { for (const track of stream?.getTracks() ?? []) { try { track.stop(); } catch { /* Release the other tracks too. */ } } } catch { /* Continue releasing audio nodes. */ }
  try { source?.disconnect(); } catch { /* A partially connected source may already be detached. */ }
  try { analyser?.disconnect(); } catch { /* Still close the context. */ }
  try { if (context) void Promise.resolve(context.close()).catch(() => {}); } catch { /* Already closed or unavailable. */ }
}

/** Own each permission request separately, including resources delivered after cancellation. */
export function createMicrophoneCapture(options: CaptureOptions = {}) {
  let active: CaptureRun | undefined;
  const stop = () => {
    const run = active;
    active = undefined;
    if (run) release(run);
  };
  const start = () => {
    stop();
    const run: CaptureRun = {};
    active = run;
    const isCurrent = () => active === run;
    const ready = (async () => {
      try {
        run.stream = await (options.getUserMedia ?? (() => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })))();
        if (!isCurrent()) { release(run); return null; }
        const context = (options.createContext ?? (() => {
          const Constructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Constructor) throw new Error("当前浏览器不支持音频分析");
          return new Constructor();
        }))();
        run.context = context;
        await context.resume();
        if (!isCurrent()) { release(run); return null; }
        const analyser = context.createAnalyser();
        run.analyser = analyser;
        analyser.fftSize = 2048; analyser.smoothingTimeConstant = .78;
        const source = context.createMediaStreamSource(run.stream!);
        run.source = source;
        source.connect(analyser);
        return { context, analyser };
      } catch (error) {
        release(run);
        if (isCurrent()) throw error;
        return null;
      }
    })();
    return { ready, isCurrent };
  };
  return { start, stop };
}
