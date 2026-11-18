export interface NotebookDraft {
  whatIDid: string;
  whatIObserved: string;
  whatILearned: string;
  question: string;
}

const prefix = "physics-notebook-tab-draft:";
// A failed browser write must not discard text during SPA navigation.
// Successful drafts live in sessionStorage, isolated from other open tabs.
const memoryDrafts = new Map<string, NotebookDraft>();
const key = (id: string) => `${prefix}${encodeURIComponent(id)}`;

export function hasUnpersistedNotebookDrafts() { return memoryDrafts.size > 0; }
export function isNotebookDraftMemoryOnly(id: string) { return memoryDrafts.has(id); }

export function readNotebookDraft(id: string): NotebookDraft | null {
  const memory = memoryDrafts.get(id);
  if (memory) return { ...memory };
  const raw = window.sessionStorage.getItem(key(id));
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !["whatIDid", "whatIObserved", "whatILearned", "question"].every((field) => typeof (value as Record<string, unknown>)[field] === "string")) {
    throw new Error("草稿格式不完整");
  }
  return value as NotebookDraft;
}

export function writeNotebookDraft(id: string, draft: NotebookDraft) {
  memoryDrafts.set(id, { ...draft });
  window.sessionStorage.setItem(key(id), JSON.stringify(draft));
  memoryDrafts.delete(id);
}

export function clearNotebookDraft(id: string) {
  memoryDrafts.delete(id);
  window.sessionStorage.removeItem(key(id));
}
