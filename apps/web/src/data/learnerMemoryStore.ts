import { mergeLearnerMemories, type LearnerMemoryDraft, type LearnerMemoryItem, type LearnerMemoryScope } from "@physics-lab/harness/agent";

const STORAGE_KEY_PREFIX = "gewu-agent-memories-v1:";

function storageKey(scope: LearnerMemoryScope, ownerKey: string | null): string | null {
  return ownerKey ? `${STORAGE_KEY_PREFIX}${scope}:${ownerKey}` : null;
}

export function loadLocalLearnerMemories(scope: LearnerMemoryScope, ownerKey: string | null): LearnerMemoryItem[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const key = storageKey(scope, ownerKey);
    if (!key) return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LearnerMemoryItem => (
      Boolean(item)
      && typeof item === "object"
      && typeof item.id === "string"
      && typeof item.topic === "string"
      && typeof item.summary === "string"
    ));
  } catch {
    return [];
  }
}

export function saveLocalLearnerMemories(scope: LearnerMemoryScope, ownerKey: string | null, items: readonly LearnerMemoryItem[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const key = storageKey(scope, ownerKey);
    if (!key) return;
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, 24)));
  } catch {
    // Ignore storage quota or private browsing errors cleanly.
  }
}

export function recordLearnerMemoryDrafts(
  scope: LearnerMemoryScope,
  ownerKey: string | null,
  drafts: readonly LearnerMemoryDraft[]
): LearnerMemoryItem[] {
  const existing = loadLocalLearnerMemories(scope, ownerKey);
  if (!drafts.length) return existing;
  if (!ownerKey) return [];
  const merged = mergeLearnerMemories(existing, drafts);
  saveLocalLearnerMemories(scope, ownerKey, merged);
  return merged;
}

export function removeLocalLearnerMemory(scope: LearnerMemoryScope, ownerKey: string | null, id: string): LearnerMemoryItem[] {
  const next = loadLocalLearnerMemories(scope, ownerKey).filter((item) => item.id !== id);
  saveLocalLearnerMemories(scope, ownerKey, next);
  return next;
}
