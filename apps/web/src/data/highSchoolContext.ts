import type { LiliExperimentContext } from "@physics-lab/contracts";
import { getHighSchoolRecordScope, subscribeHighSchoolRecordScope, type HighSchoolRecordScope } from "./highSchoolRecordScope";

type ContextOwner = Pick<HighSchoolRecordScope, "key" | "mode" | "revision">;
let current: { context: LiliExperimentContext; owner: ContextOwner } | null = null;
let observedScope: ContextOwner = ownerOf(getHighSchoolRecordScope());
const listeners = new Set<() => void>();
let notificationQueued = false;
let experimentVisit = 0;

function ownerOf(scope: HighSchoolRecordScope): ContextOwner {
  return { key: scope.key, mode: scope.mode, revision: scope.revision };
}

function sameOwner(left: ContextOwner, right: ContextOwner): boolean {
  return left.key === right.key && left.mode === right.mode && left.revision === right.revision;
}

function notify() {
  notificationQueued = false;
  for (const listener of [...listeners]) listener();
}

function deferNotification() {
  if (notificationQueued) return;
  notificationQueued = true;
  queueMicrotask(() => { if (notificationQueued) notify(); });
}

/** Re-check on reads too: the session may expire before a scheduled scope notification. */
function refreshScope(notifyImmediately = false): HighSchoolRecordScope {
  const scope = getHighSchoolRecordScope();
  const changed = !sameOwner(observedScope, scope);
  if (changed) {
    // Update before notifying: subscribers may synchronously read this store again.
    observedScope = ownerOf(scope);
    current = null;
    experimentVisit += 1;
  }
  // getSnapshot must invalidate its result immediately without updating another component during render.
  if (notifyImmediately && (changed || notificationQueued)) notify();
  else if (changed) deferNotification();
  return scope;
}

subscribeHighSchoolRecordScope(() => { refreshScope(true); });

/** The captured owner is required even for cleanup, so an old session cannot clear a new one. */
export function publishHighSchoolContext(context: LiliExperimentContext | null, owner: HighSchoolRecordScope): boolean {
  const scope = refreshScope();
  if (scope.key === null || scope.mode === "blocked" || !sameOwner(owner, scope)) return false;
  // Read-only accounts may still use local guidance. Network access is checked by the caller.
  if (context === null) {
    if (!current || !sameOwner(current.owner, owner)) return false;
    current = null;
    experimentVisit += 1;
  } else {
    if (current?.context === context && sameOwner(current.owner, owner)) return true;
    if (current?.context.experimentId !== context.experimentId) experimentVisit += 1;
    current = { context, owner: ownerOf(owner) };
  }
  notify();
  return true;
}

export function getHighSchoolContext(): LiliExperimentContext | null {
  const scope = refreshScope();
  return scope.key !== null && scope.mode !== "blocked" && current && sameOwner(current.owner, scope) ? current.context : null;
}

/** Changes on leaving/changing an experiment, even for A → B → A between renders. */
export function getHighSchoolExperimentVisit(): number {
  refreshScope();
  return experimentVisit;
}

export function subscribeHighSchoolContext(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
