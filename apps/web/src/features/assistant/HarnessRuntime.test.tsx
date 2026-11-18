import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HarnessRuntime } from "./HarnessRuntime";

type EffectSlot = { deps?: readonly unknown[]; cleanup?: () => void };
const state = vi.hoisted(() => ({
  location: { pathname: "/student/explore/sound", search: "?module=sound-features" },
  slots: [] as EffectSlot[], cursor: 0, effects: [] as Array<() => void>,
  enterArea: vi.fn(async () => {}), leaveArea: vi.fn(), setPanelOpen: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useLocation: () => state.location }));
vi.mock("./harnessStore", () => ({ useHarnessStore: (selector: (value: typeof state) => unknown) => selector(state) }));
vi.mock("./AssistantPanel", () => ({ HarnessPanel: () => null }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  // Deliberately recompute context: equivalent routing objects must not restart the effect.
  useMemo: (create: () => unknown) => create(),
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = state.cursor++;
    const slot = state.slots[index] ?? (state.slots[index] = {});
    if (!deps || !slot.deps || slot.deps.length !== deps.length || slot.deps.some((value, i) => !Object.is(value, deps[i]))) {
      slot.deps = deps;
      state.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
    }
  },
}));

function render(pathname = state.location.pathname, search = state.location.search) {
  state.location = { pathname, search }; state.cursor = 0;
  const result = HarnessRuntime(); state.effects.splice(0).forEach((effect) => effect()); return result;
}
function unmount() { state.slots.forEach((slot) => { slot.cleanup?.(); slot.cleanup = undefined; }); }
beforeEach(() => {
  state.slots = []; state.effects = []; state.cursor = 0;
  state.location = { pathname: "/student/explore/sound", search: "?module=sound-features" };
  state.enterArea.mockClear(); state.leaveArea.mockClear(); state.setPanelOpen.mockClear();
  vi.stubGlobal("window", { speechSynthesis: { cancel: vi.fn() } });
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("Guangguang route lifecycle", () => {
  it("opens dialogue on a query change without cancelling or re-entering the same experiment", () => {
    render();
    render(undefined, "?module=sound-features&harness=dialogue");
    render(undefined, "?harness=dialogue&module=sound-features&tab=notes");
    expect(state.enterArea).toHaveBeenCalledTimes(1);
    expect(state.enterArea).toHaveBeenLastCalledWith("sound", "sound-features");
    expect(state.leaveArea).not.toHaveBeenCalled();
    expect(state.setPanelOpen).toHaveBeenCalledWith(true);
  });

  it("cleans up when the module changes or when leaving experiment routes, then re-enters on return", () => {
    render(); render(undefined, "?module=sound-medium");
    expect(state.leaveArea).toHaveBeenCalledTimes(1);
    expect(state.enterArea).toHaveBeenLastCalledWith("sound", "sound-medium");
    expect(render("/student/notebook", "?harness=dialogue")).toBeNull();
    expect(state.leaveArea).toHaveBeenCalledTimes(2);
    render("/student/explore/sound", "?module=sound-features");
    expect(state.enterArea).toHaveBeenCalledTimes(3);
    unmount(); expect(state.leaveArea).toHaveBeenCalledTimes(3);
  });
});
