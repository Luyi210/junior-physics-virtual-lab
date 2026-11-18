import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiliExperimentContext } from "@physics-lab/contracts";
import type { HighSchoolRecordScope } from "./highSchoolRecordScope";

const service = vi.hoisted(() => ({
  current: null as HighSchoolRecordScope | null,
  onNextRead: null as HighSchoolRecordScope | null,
  listeners: new Set<() => void>(),
}));

vi.mock("./highSchoolRecordScope", () => ({
  getHighSchoolRecordScope: () => {
    if (service.onNextRead) {
      service.current = service.onNextRead;
      service.onNextRead = null;
      const listeners = [...service.listeners];
      queueMicrotask(() => listeners.forEach((listener) => listener()));
    }
    return service.current!;
  },
  subscribeHighSchoolRecordScope: (listener: () => void) => {
    service.listeners.add(listener);
    return () => { service.listeners.delete(listener); };
  },
}));

function account(revision = 1, key = "account:student:a"): HighSchoolRecordScope {
  return { key, mode: "account", canWrite: true, authChannel: "student", revision, label: "学生账号" };
}
function changeScope(next: HighSchoolRecordScope) {
  service.current = next;
  service.listeners.forEach((listener) => listener());
}

it("changes visit identity on A-B-A and leaving while parameter updates keep the same visit", () => {
  const owner = service.current!;
  const first = context();
  store.publishHighSchoolContext(first, owner);
  const visitA = store.getHighSchoolExperimentVisit();
  store.publishHighSchoolContext(context(2), owner);
  expect(store.getHighSchoolExperimentVisit()).toBe(visitA);
  store.publishHighSchoolContext({ ...first, experimentId: "spring-force" }, owner);
  expect(store.getHighSchoolExperimentVisit()).toBeGreaterThan(visitA);
  store.publishHighSchoolContext(first, owner);
  const returnVisit = store.getHighSchoolExperimentVisit();
  expect(returnVisit).toBeGreaterThan(visitA + 1);
  store.publishHighSchoolContext(null, owner);
  expect(store.getHighSchoolExperimentVisit()).toBeGreaterThan(returnVisit);
  changeScope(account(owner.revision + 1));
  expect(store.getHighSchoolExperimentVisit()).toBeGreaterThan(returnVisit + 1);
});
function context(timeSeconds = 1): LiliExperimentContext {
  return { experimentId: "pendulum", parameters: { length: 1, amplitudeDegrees: 5, mass: 1 }, timeSeconds, recordCount: 0 };
}

let store: typeof import("./highSchoolContext");
beforeEach(async () => {
  vi.resetModules();
  service.listeners.clear();
  service.current = account();
  service.onNextRead = null;
  store = await import("./highSchoolContext");
});

describe("high school assistant context ownership", () => {
  it.each(["account", "guest", "demo"] as const)("publishes stable %s snapshots and clears only through their owner", (mode) => {
    const scope: HighSchoolRecordScope = { ...account(), key: mode, mode, authChannel: mode === "account" ? "student" : null };
    changeScope(scope);
    const value = context();
    const listener = vi.fn();
    const unsubscribe = store.subscribeHighSchoolContext(listener);
    expect(store.publishHighSchoolContext(value, scope)).toBe(true);
    expect(store.getHighSchoolContext()).toBe(value);
    expect(store.getHighSchoolContext()).toBe(value);
    expect(store.publishHighSchoolContext(value, scope)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.publishHighSchoolContext(null, scope)).toBe(true);
    expect(store.getHighSchoolContext()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.publishHighSchoolContext(context(2), scope);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("invalidates immediately on account switch and rejects late publishers and old cleanup", () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    const observed: Array<LiliExperimentContext | null> = [];
    store.subscribeHighSchoolContext(() => observed.push(store.getHighSchoolContext()));
    const nextScope = account(2, "account:student:b");
    changeScope(nextScope);
    expect(observed).toEqual([null]);
    const nextContext = context(2);
    store.publishHighSchoolContext(nextContext, nextScope);
    expect(store.publishHighSchoolContext(context(3), oldScope)).toBe(false);
    expect(store.publishHighSchoolContext(null, oldScope)).toBe(false);
    expect(store.getHighSchoolContext()).toBe(nextContext);
    expect(observed).toEqual([null, nextContext]);
    // Returning to the same account must not reactivate an earlier session's closure.
    const returnedScope = account(3);
    changeScope(returnedScope);
    expect(store.publishHighSchoolContext(context(), oldScope)).toBe(false);
    expect(store.publishHighSchoolContext(context(), returnedScope)).toBe(true);
  });

  it("clears on logout, blocks an unselected identity, and allows an explicit new guest scope", () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    const blocked: HighSchoolRecordScope = { key: null, mode: "blocked", canWrite: false, authChannel: null, revision: 2, label: "请选择身份" };
    changeScope(blocked);
    expect(store.getHighSchoolContext()).toBeNull();
    expect(store.publishHighSchoolContext(context(), oldScope)).toBe(false);
    expect(store.publishHighSchoolContext(context(), blocked)).toBe(false);
    const guest: HighSchoolRecordScope = { key: "guest", mode: "guest", canWrite: true, authChannel: null, revision: 3, label: "访客" };
    changeScope(guest);
    const value = context(2);
    expect(store.publishHighSchoolContext(value, guest)).toBe(true);
    expect(store.publishHighSchoolContext(null, oldScope)).toBe(false);
    expect(store.getHighSchoolContext()).toBe(value);
  });

  it("treats token renewal as a new session even when the account key is unchanged", () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    const renewed = { ...oldScope, revision: oldScope.revision + 1 };
    changeScope(renewed);
    expect(store.getHighSchoolContext()).toBeNull();
    expect(store.publishHighSchoolContext(context(), oldScope)).toBe(false);
    const value = context(2);
    expect(store.publishHighSchoolContext(value, renewed)).toBe(true);
    expect(store.publishHighSchoolContext(null, oldScope)).toBe(false);
    expect(store.getHighSchoolContext()).toBe(value);
  });

  it("expires the old context but allows local guidance under the new read-only account scope", () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    const expired = { ...oldScope, canWrite: false, revision: oldScope.revision + 1 };
    changeScope(expired);
    expect(store.getHighSchoolContext()).toBeNull();
    expect(store.publishHighSchoolContext(context(), oldScope)).toBe(false);
    const localContext = context(2);
    expect(store.publishHighSchoolContext(localContext, expired)).toBe(true);
    expect(store.getHighSchoolContext()).toBe(localContext);
  });

  it("invalidates an expired snapshot synchronously but notifies only after the read, without recursion", async () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    const listener = vi.fn(() => expect(store.getHighSchoolContext()).toBeNull());
    store.subscribeHighSchoolContext(listener);
    const expired = { ...oldScope, canWrite: false, revision: 2 };
    service.onNextRead = expired;
    expect(store.getHighSchoolContext()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    expect(store.getHighSchoolContext()).toBeNull();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
    changeScope({ ...expired });
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("coalesces a deferred read notification with a fresh publication instead of replaying stale state", async () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    const observed: Array<LiliExperimentContext | null> = [];
    store.subscribeHighSchoolContext(() => observed.push(store.getHighSchoolContext()));
    const renewed = { ...oldScope, revision: 2 };
    service.onNextRead = renewed;
    expect(store.getHighSchoolContext()).toBeNull();
    expect(observed).toEqual([]);
    const value = context(2);
    store.publishHighSchoolContext(value, renewed);
    expect(observed).toEqual([value]);
    await Promise.resolve();
    expect(observed).toEqual([value]);
    expect(store.getHighSchoolContext()).toBe(value);
  });

  it("does not notify a listener removed before a queued snapshot change is delivered", async () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribeHighSchoolContext(listener);
    service.onNextRead = account(2);
    expect(store.getHighSchoolContext()).toBeNull();
    unsubscribe();
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies scope changes even when no experiment context was published", () => {
    const listener = vi.fn();
    store.subscribeHighSchoolContext(listener);
    changeScope(account(2, "account:student:b"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getHighSchoolContext()).toBeNull();
  });

  it("checks the live scope before accepting a publisher when an expiry event has not run yet", async () => {
    const oldScope = service.current!;
    store.publishHighSchoolContext(context(), oldScope);
    service.onNextRead = { ...oldScope, canWrite: false, revision: 2 };
    expect(store.publishHighSchoolContext(context(2), oldScope)).toBe(false);
    expect(store.getHighSchoolContext()).toBeNull();
    await Promise.resolve();
  });
});
