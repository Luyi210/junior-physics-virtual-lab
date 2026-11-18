import type { LearningRecordContent } from '@physics-lab/contracts';
import { isCurrentStudentRecordScope, type StudentRecordScope } from './studentRecordScope';

export interface UnsavedLearningRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly baseRevision: number;
  readonly content: Readonly<LearningRecordContent>;
}

const fields = ['prediction', 'measurements', 'conclusion', 'question'] as const;
const empty: readonly UnsavedLearningRecord[] = Object.freeze([]);
// This module belongs to this browser tab. It intentionally survives route and
// token-revision remounts, but is neither persisted nor shared with another tab.
const copies = new Map<string, readonly UnsavedLearningRecord[]>();
const listeners = new Set<() => void>();
let nextEditor = 0;
let warningWindow: Window | null = null;
const ownerKey = (scope: StudentRecordScope, sessionId: string) => JSON.stringify([scope.key, sessionId]);
const matches = (a: Readonly<LearningRecordContent>, b: LearningRecordContent) => fields.every((field) => a[field] === b[field]);
const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
function changed() {
  const target = typeof window === 'undefined' ? null : window;
  if (warningWindow && (!copies.size || warningWindow !== target)) { warningWindow.removeEventListener('beforeunload', warn); warningWindow = null; }
  if (copies.size && target && !warningWindow) { target.addEventListener('beforeunload', warn); warningWindow = target; }
  for (const listener of [...listeners]) listener();
}
function requireScope(scope: StudentRecordScope, write = false) {
  if (!isCurrentStudentRecordScope(scope, write)) throw new Error('学生身份已改变或当前账号只读，未改变未落盘副本。');
}
export function newUnsavedLearningRecordEditorId(): string { return `tab-editor-${++nextEditor}`; }
export function subscribeUnsavedLearningRecords(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getUnsavedLearningRecords(scope: StudentRecordScope, sessionId: string): readonly UnsavedLearningRecord[] {
  if (!sessionId || !isCurrentStudentRecordScope(scope)) return empty;
  return copies.get(ownerKey(scope, sessionId)) ?? empty;
}

/** Stage text before attempting storage. A successful write clears only exact text. */
export function preserveUnsavedLearningRecord(scope: StudentRecordScope, sessionId: string, editorId: string, content: LearningRecordContent, baseRevision: number): void {
  requireScope(scope, true);
  if (!sessionId || !editorId || !Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new Error('未落盘副本的会话或版本无效。');
  const key = ownerKey(scope, sessionId);
  const previous = copies.get(key) ?? empty;
  const own = previous.find((copy) => copy.id === editorId);
  const now = new Date().toISOString();
  const next: UnsavedLearningRecord = Object.freeze({ id: editorId, createdAt: own?.createdAt ?? now, updatedAt: now,
    baseRevision: own?.baseRevision ?? baseRevision, content: Object.freeze({ ...content }) });
  copies.set(key, Object.freeze([...previous.filter((copy) => copy.id !== editorId), next]));
  changed();
}

/** GETs and save ACKs never call this: only a successful write of the same text. */
export function clearSavedUnsavedLearningRecords(scope: StudentRecordScope, sessionId: string, saved: LearningRecordContent): void {
  requireScope(scope, true);
  const key = ownerKey(scope, sessionId);
  const previous = copies.get(key);
  if (!previous) return;
  const next = previous.filter((copy) => !matches(copy.content, saved));
  if (next.length === previous.length) return;
  if (next.length) copies.set(key, Object.freeze(next)); else copies.delete(key);
  changed();
}
