import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSeenPageIntroduction, rememberPageIntroduction } from "./pageIntroductionStorage";

const key = "physics-page-guide-v3:field-sound";
afterEach(() => vi.unstubAllGlobals());

describe("optional introduction preferences", () => {
  it.each(["local", "session"] as const)("reads and writes only the requested %s storage", persistence => {
    const selected = { getItem: vi.fn(() => "seen"), setItem: vi.fn() };
    const unused = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal("window", persistence === "local" ? { localStorage: selected, sessionStorage: unused } : { localStorage: unused, sessionStorage: selected });
    expect(hasSeenPageIntroduction(key, persistence)).toBe(true);
    rememberPageIntroduction(key, persistence);
    expect(selected.getItem).toHaveBeenCalledWith(key);
    expect(selected.setItem).toHaveBeenCalledWith(key, "seen");
    expect(unused.getItem).not.toHaveBeenCalled();
    expect(unused.setItem).not.toHaveBeenCalled();
  });

  it.each(["local", "session"] as const)("survives denied %s storage access and still permits dismissing the guide", persistence => {
    const browser = {};
    Object.defineProperty(browser, `${persistence}Storage`, { get() { throw new DOMException("Blocked", "SecurityError"); } });
    vi.stubGlobal("window", browser);
    expect(hasSeenPageIntroduction(key, persistence)).toBe(false);
    expect(() => rememberPageIntroduction(key, persistence)).not.toThrow();
  });

  it("does not block dismissal when an available storage runs out of quota", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem() { throw new DOMException("Full", "QuotaExceededError"); } } });
    expect(hasSeenPageIntroduction(key, "local")).toBe(false);
    expect(() => rememberPageIntroduction(key, "local")).not.toThrow();
  });

  it("does not open a browser-only modal during server rendering", () => {
    vi.stubGlobal("window", undefined);
    expect(hasSeenPageIntroduction(key, "session")).toBe(true);
    expect(() => rememberPageIntroduction(key, "session")).not.toThrow();
  });
});
