export interface ShowcaseClockSnapshot { time: number; playing: boolean; active: boolean; finished: boolean }
export interface ShowcasePlaybackOptions {
  durationSeconds: number;
  rate: number;
  requestFrame: (callback: (timestamp: number) => void) => number;
  cancelFrame: (id: number) => void;
  onChange: (snapshot: ShowcaseClockSnapshot) => void;
}

/** A bounded local animation clock. Suspending discards the timestamp, so returning
 * from a hidden/offscreen page never advances through unseen wall-clock time.
 */
export function createShowcasePlayback(options: ShowcasePlaybackOptions) {
  if (!(options.durationSeconds > 0) || !(options.rate > 0) || !Number.isFinite(options.durationSeconds + options.rate)) throw new RangeError('展台时间配置无效。');
  let time = 0, playing = false, visible = false, disposed = false;
  let frame: number | null = null, lastTime: number | null = null, generation = 0, sinceEmit = 0;
  const renderInterval = 1 / 30; // Keep homepage model/render work within 30 updates per wall-clock second.
  const snapshot = (): ShowcaseClockSnapshot => ({ time, playing, active: playing && visible && !disposed, finished: time >= options.durationSeconds });
  const emit = () => { if (!disposed) options.onChange(snapshot()); };
  function cancel() { generation += 1; if (frame !== null) options.cancelFrame(frame); frame = null; lastTime = null; sinceEmit = 0; }
  function schedule() {
    if (disposed || !playing || !visible || frame !== null) return;
    const owner = generation;
    frame = options.requestFrame(now => {
      if (disposed || owner !== generation || !playing || !visible) return;
      frame = null;
      if (Number.isFinite(now)) {
        if (lastTime !== null) {
          const dt = Math.max(0, Math.min((now - lastTime) / 1000, .1));
          const nextTime = time + dt * options.rate;
          // Roundoff at the observation boundary must not require an extra frame.
          time = nextTime >= options.durationSeconds - 1e-12 ? options.durationSeconds : nextTime;
          if (time >= options.durationSeconds) playing = false;
          sinceEmit += dt;
          if (!playing || sinceEmit + 1e-9 >= renderInterval) {
            sinceEmit = Math.max(0, sinceEmit - Math.floor((sinceEmit + 1e-9) / renderInterval) * renderInterval);
            emit();
          }
        }
        lastTime = now;
      }
      if (owner === generation) schedule();
    });
  }
  return {
    snapshot,
    play() { if (disposed) return; if (time >= options.durationSeconds) time = 0; playing = true; cancel(); emit(); schedule(); },
    pause() { if (disposed) return; playing = false; cancel(); emit(); },
    setVisible(next: boolean) { if (disposed || visible === next) return; visible = next; cancel(); emit(); schedule(); },
    dispose() { if (disposed) return; cancel(); playing = false; disposed = true; },
  };
}
