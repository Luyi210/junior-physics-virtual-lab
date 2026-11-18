import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { attachTonePlaybackLifecycle, createTonePlaybackController, tonePlaybackView, type ToneParameters, type TonePlaybackController } from "./tonePlayback";

export function useTonePlayback(parameters: ToneParameters, onPlayingChange: (playing: boolean) => void) {
  const controllerRef = useRef<TonePlaybackController | null>(null);
  if (!controllerRef.current) controllerRef.current = createTonePlaybackController();
  const controller = controllerRef.current;
  const latest = useRef({ parameters, onPlayingChange });
  latest.current = { parameters, onPlayingChange };
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => attachTonePlaybackLifecycle(controller, (playing) => latest.current.onPlayingChange(playing), document), [controller]);
  useEffect(() => controller.update(parameters), [controller, parameters.frequency, parameters.amplitude, parameters.timbre]);
  const toggle = useCallback(() => {
    const status = controller.getSnapshot().status;
    if (status === "starting" || status === "playing") controller.stop();
    else void controller.start(latest.current.parameters);
  }, [controller]);
  return { ...tonePlaybackView(snapshot), status: snapshot.status, toggle };
}
