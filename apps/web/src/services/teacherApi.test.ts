import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("demo API isolation", () => {
  it("ignores stored login tokens and blocks requests even when a backend URL exists", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "true");
    vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    vi.stubGlobal("window", { localStorage: { getItem: () => "old-login-token" } });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { studentApi, teacherApi } = await import("./teacherApi");

    expect(studentApi.hasSession()).toBe(false);
    expect(teacherApi.hasSession()).toBe(false);
    expect(studentApi.isConfigured()).toBe(false);
    await expect(studentApi.health()).rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
    await expect(teacherApi.me()).rejects.toMatchObject({ code: "API_NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores a classroom session left by an earlier authenticated visit", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "true");
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ id: "old-session", status: "active" }) } });
    const { activeStudentSession } = await import("./studentSessionSync");
    expect(activeStudentSession()).toBeNull();
  });

  it("keeps authenticated requests available in the explicitly configured full version", async () => {
    vi.stubEnv("VITE_DEMO_ONLY", "false");
    vi.stubEnv("VITE_API_URL", "https://backend.example.test/api");
    vi.stubGlobal("window", { localStorage: { getItem: () => "existing-token" } });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "teacher" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { teacherApi } = await import("./teacherApi");

    expect(teacherApi.hasSession()).toBe(true);
    await expect(teacherApi.me()).resolves.toEqual({ id: "teacher" });
    expect(fetch).toHaveBeenCalledWith("https://backend.example.test/api/auth/me", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer existing-token" })
    }));
  });
});
