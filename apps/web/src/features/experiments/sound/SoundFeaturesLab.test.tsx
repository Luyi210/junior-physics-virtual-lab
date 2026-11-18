import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SoundLab } from "./SoundFeaturesLab";
import { tonePlaybackView, type TonePlaybackSnapshot } from "./tonePlayback";

const playback = vi.hoisted(() => ({
  snapshot: { status: "idle", message: "试听可选，调整参数即可观察和比较波形。" } as TonePlaybackSnapshot,
  onPlayingChange: undefined as ((playing: boolean) => void) | undefined,
  frameRecordsToggle: undefined as boolean | undefined,
  record: vi.fn()
}));
vi.mock("../../assistant/harnessStore", () => ({ useHarnessStore: (selector: (state: { record: typeof playback.record }) => unknown) => selector({ record: playback.record }) }));
vi.mock("./useTonePlayback", () => ({ useTonePlayback: (_parameters: unknown, onPlayingChange: (playing: boolean) => void) => {
  playback.onPlayingChange = onPlayingChange;
  return { ...tonePlaybackView(playback.snapshot), status: playback.snapshot.status, toggle: () => {} };
} }));
vi.mock("../shared/ScienceLabPrimitives", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/ScienceLabPrimitives")>();
  return { ...actual, LabFrame: (props: Parameters<typeof actual.LabFrame>[0]) => {
    playback.frameRecordsToggle = props.recordToggleEvent;
    return <actual.LabFrame {...props} />;
  } };
});
const record = playback.record;
beforeEach(() => {
  record.mockClear();
  playback.onPlayingChange = undefined; playback.frameRecordsToggle = undefined;
});

describe("sound preview presentation and event integration", () => {
  it.each([
    ["idle", "试听可选，调整参数即可观察和比较波形。", "低音量试听"],
    ["starting", "正在启动试听，可再次点击取消。", "取消启动试听"],
    ["error", "浏览器未能启动试听，请重新点击试听。波形和对照仍可使用。", "重试低音量试听"],
    ["playing", "正在低音量试听；可停止试听后继续比较波形。", "停止试听"]
  ] as const)("shows %s without disabling the experiment or claiming premature playback", (status, message, label) => {
    playback.snapshot = { status, message };
    const html = renderToStaticMarkup(<SoundLab />);
    expect(html).toContain(message);
    expect(html).toContain(label);
    expect(html).toContain('role="status"');
    expect(html).toContain("保存当前为基准");
    expect(html).toContain('type="range"');
    expect(html.includes('class="speaker playing"')).toBe(status === "playing");
    expect(html.includes('class="sound-particles"><i')).toBe(status === "playing");
    expect(html).toContain("调整参数生成波形，也可低音量试听");
    expect(playback.frameRecordsToggle).toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it("records only actual playing transitions supplied by the playback lifecycle", () => {
    playback.snapshot = { status: "starting", message: "正在启动试听，可再次点击取消。" };
    renderToStaticMarkup(<SoundLab />);
    expect(record).not.toHaveBeenCalled();
    playback.onPlayingChange!(true);
    playback.onPlayingChange!(false);
    expect(record.mock.calls).toEqual([
      ["simulation.toggled", { experiment: "sound-features", running: true, action: "低音量试听已启动" }],
      ["simulation.toggled", { experiment: "sound-features", running: false, action: "试听已停止" }]
    ]);
  });
});
