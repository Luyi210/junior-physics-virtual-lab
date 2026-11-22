import { updateBktSkill, type BktSkillState, type LearnerMemoryScope } from "@physics-lab/harness/agent";

const STORAGE_KEY_PREFIX = "gewu-bkt-mastery-v1:";

function storageKey(scope: LearnerMemoryScope, ownerKey: string | null): string | null {
  return ownerKey ? `${STORAGE_KEY_PREFIX}${scope}:${ownerKey}` : null;
}

export function loadLocalBktStates(scope: LearnerMemoryScope, ownerKey: string | null): BktSkillState[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const key = storageKey(scope, ownerKey);
    if (!key) return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BktSkillState => (
      Boolean(item)
      && typeof item === "object"
      && typeof item.skillId === "string"
      && typeof item.mastery === "number"
      && Number.isFinite(item.mastery)
    ));
  } catch {
    return [];
  }
}

export function saveLocalBktStates(scope: LearnerMemoryScope, ownerKey: string | null, states: readonly BktSkillState[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const key = storageKey(scope, ownerKey);
    if (!key) return;
    window.localStorage.setItem(key, JSON.stringify(states));
  } catch {
    // Ignore storage quota or private browsing errors cleanly.
  }
}

export function recordLocalBktAttempt(
  scope: LearnerMemoryScope,
  ownerKey: string | null,
  skillId: string,
  correct: boolean
): BktSkillState[] {
  const existing = loadLocalBktStates(scope, ownerKey);
  if (!ownerKey) return [];
  const next = updateBktSkill(existing, skillId, correct);
  saveLocalBktStates(scope, ownerKey, next);
  return next;
}
