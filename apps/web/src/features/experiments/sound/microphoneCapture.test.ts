import { describe, expect, it, vi } from "vitest";
import { createMicrophoneCapture } from "./microphoneCapture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function devices(resume: () => Promise<void> = async () => {}) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = { fftSize: 0, smoothingTimeConstant: 0, disconnect: vi.fn() };
  const context = { resume: vi.fn(resume), close: vi.fn(async () => {}), createAnalyser: vi.fn(() => analyser), createMediaStreamSource: vi.fn(() => source) };
  return { track, stream, source, analyser, context, createContext: vi.fn(() => context as unknown as AudioContext) };
}

describe("microphone acquisition cancellation and ownership", () => {
  it("stops a late permission stream after leaving the page, without creating an audio context", async () => {
    const permission = deferred<MediaStream>(), media = devices();
    const capture = createMicrophoneCapture({ getUserMedia: () => permission.promise, createContext: media.createContext });
    const request = capture.start(); capture.stop();
    permission.resolve(media.stream);
    expect(await request.ready).toBeNull();
    expect(request.isCurrent()).toBe(false);
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(media.createContext).not.toHaveBeenCalled();
  });

  it("releases an acquired stream when constructing the audio context fails", async () => {
    const media = devices();
    const capture = createMicrophoneCapture({ getUserMedia: async () => media.stream, createContext: () => { throw new Error("No audio device"); } });
    await expect(capture.start().ready).rejects.toThrow("No audio device");
    expect(media.track.stop).toHaveBeenCalledOnce();
    capture.stop(); expect(media.track.stop).toHaveBeenCalledOnce();
  });

  it("releases both stream and context on rejected audio resume", async () => {
    const media = devices(async () => { throw new Error("Resume denied"); });
    const capture = createMicrophoneCapture({ getUserMedia: async () => media.stream, createContext: media.createContext });
    await expect(capture.start().ready).rejects.toThrow("Resume denied");
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(media.context.close).toHaveBeenCalledOnce();
    expect(media.context.createAnalyser).not.toHaveBeenCalled();
  });

  it("cancels while resume is pending and refuses to start analysis when it later resolves", async () => {
    const pending = deferred<void>(), media = devices(() => pending.promise);
    const capture = createMicrophoneCapture({ getUserMedia: async () => media.stream, createContext: media.createContext });
    const request = capture.start(); await Promise.resolve();
    expect(media.context.resume).toHaveBeenCalledOnce(); capture.stop();
    expect(media.track.stop).toHaveBeenCalledOnce(); expect(media.context.close).toHaveBeenCalledOnce();
    pending.resolve(); expect(await request.ready).toBeNull();
    expect(media.source.connect).not.toHaveBeenCalled();
    expect(media.context.close).toHaveBeenCalledOnce();
  });

  it("keeps a new capture alive when a cancelled older request rejects", async () => {
    const older = deferred<MediaStream>(), media = devices();
    const getUserMedia = vi.fn().mockImplementationOnce(() => older.promise).mockResolvedValue(media.stream);
    const capture = createMicrophoneCapture({ getUserMedia, createContext: media.createContext });
    const first = capture.start(), second = capture.start();
    expect(await second.ready).toEqual({ context: media.context, analyser: media.analyser });
    older.reject(new Error("Old permission denied")); expect(await first.ready).toBeNull();
    expect(second.isCurrent()).toBe(true); expect(media.track.stop).not.toHaveBeenCalled();
    capture.stop(); expect(media.track.stop).toHaveBeenCalledOnce(); expect(media.source.disconnect).toHaveBeenCalledOnce();
  });

  it("cleans partially connected nodes and attempts every cleanup even when one throws", async () => {
    const media = devices();
    media.source.connect.mockImplementation(() => { throw new Error("Connect failed"); });
    media.source.disconnect.mockImplementation(() => { throw new Error("Already disconnected"); });
    media.context.close.mockRejectedValue(new Error("Already closed"));
    const capture = createMicrophoneCapture({ getUserMedia: async () => media.stream, createContext: media.createContext });
    await expect(capture.start().ready).rejects.toThrow("Connect failed");
    expect(media.track.stop).toHaveBeenCalledOnce();
    expect(media.analyser.disconnect).toHaveBeenCalledOnce();
    expect(media.context.close).toHaveBeenCalledOnce();
  });
});
