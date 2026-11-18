import type { LearningRecordContent, SaveLearningRecordRequest, SessionLearningRecord } from "@physics-lab/contracts";
import { LEARNING_RECORD_FIELD_LIMITS } from "@physics-lab/contracts";
import { studentApi, TeacherApiError } from "./teacherApi";
import { isCurrentStudentRecordScope, type StudentRecordScope } from "./studentRecordScope";

export interface CachedLearningRecord {
  server: SessionLearningRecord;
  pending: SaveLearningRecordRequest | null;
}

type StoragePort = Pick<Storage, "getItem" | "setItem" | "key" | "length">;
type RecordGateway = {
  saveLearningRecord(sessionId: string, input: SaveLearningRecordRequest): Promise<SessionLearningRecord>;
};
export interface LearningRecordDraft {
  clientId: string;
  isCurrentTab: boolean;
  raw: string;
  valid: boolean;
  pending: SaveLearningRecordRequest | null;
  error?: string;
}
export interface LearningRecordServerCopy {
  raw: string | null;
  valid: boolean;
  error?: string;
}
export type LearningRecordScopeGuard = (scope: StudentRecordScope, requireWrite?: boolean) => boolean;

const contentFields = ["prediction", "measurements", "conclusion", "question"] as const;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const isRevision = (value: unknown, minimum = 0): value is number => Number.isSafeInteger(value) && Number(value) >= minimum;

function isContent(value: unknown): value is LearningRecordContent {
  return isObject(value) && contentFields.every((field) => typeof value[field] === "string");
}

function isDetail(value: unknown, scope: StudentRecordScope, sessionId: string): value is SessionLearningRecord {
  if (!isObject(value) || !isObject(value.session)) return false;
  const session = value.session;
  if (session.id !== sessionId || session.learnerId !== scope.studentId || session.schoolId !== scope.schoolId || !scope.studentId || !scope.schoolId || !sessionId) return false;
  if (!["schoolId", "taskId", "classId", "experimentId"].every((field) => typeof session[field] === "string")) return false;
  if (session.status !== "active" && session.status !== "completed") return false;
  if (!isTime(session.startedAt) || !isTime(session.updatedAt) || (session.completedAt !== null && !isTime(session.completedAt))) return false;
  if (!["learnerName", "taskTitle", "className", "lessonTitle"].every((field) => typeof value[field] === "string")) return false;
  const record = value.record;
  return record === null || (isObject(record) && isContent(record) && record.sessionId === sessionId && record.learnerId === scope.studentId &&
    isRevision(record.revision, 1) && typeof record.lastMutationId === "string" && Boolean(record.lastMutationId) && isTime(record.updatedAt));
}

function isPending(value: unknown): value is SaveLearningRecordRequest {
  return isObject(value) && isContent(value) && isRevision(value.expectedRevision) && typeof value.mutationId === "string" && Boolean(value.mutationId);
}

// Record revisions and session completion advance independently. A delayed GET or
// save acknowledgement must not rewind either, including updates from another tab.
function mergeServer(previous: SessionLearningRecord | undefined, incoming: SessionLearningRecord): SessionLearningRecord {
  if (!previous) return incoming;
  const previousRevision = previous.record?.revision ?? 0;
  const incomingRevision = incoming.record?.revision ?? 0;
  const record = incomingRevision > previousRevision ? incoming.record : previous.record;
  const session = previous.session.status === "completed" && incoming.session.status !== "completed"
    ? previous.session
    : incoming.session.status === "completed" && previous.session.status !== "completed"
      ? incoming.session
      : Date.parse(incoming.session.updatedAt) > Date.parse(previous.session.updatedAt) ? incoming.session : previous.session;
  const metadata = record === previous.record && session === previous.session ? previous : incoming;
  return { ...metadata, session, record };
}

// Acknowledgements only clear the exact mutation that was sent. Newer local edits survive.
export function createLearningRecordRepository(storage: StoragePort, api: RecordGateway, newId: () => string = () => crypto.randomUUID(), clientId = "default", guard: LearningRecordScopeGuard = isCurrentStudentRecordScope) {
  const flights = new Map<string, Promise<SessionLearningRecord>>();
  const key = (scope: StudentRecordScope, sessionId: string) => `physics-learning-record-v3:${scope.key}:${encodeURIComponent(sessionId)}`;
  const draftKey = (scope: StudentRecordScope, sessionId: string) => `${key(scope, sessionId)}:draft:${encodeURIComponent(clientId)}`;

  function assertScope(scope: StudentRecordScope, write = false) {
    if (!scope || scope.mode !== "account" || !scope.key || !scope.schoolId || !scope.studentId || !scope.apiNamespace || !guard(scope, false)) {
      throw new TeacherApiError(401, "ACCOUNT_CHANGED", "学生登录身份或后台已改变，请重新打开这份记录；本机草稿仍保留");
    }
    if (write && (!scope.canWrite || !guard(scope, true))) throw new TeacherApiError(401, "RECORD_READ_ONLY", "学生登录已过期或当前身份只读，请重新登录后再保存；本机草稿仍保留");
  }
  function stored(key: string): string | null {
    try { return storage.getItem(key); }
    catch { throw new Error("本机课堂记录暂时无法读取，请先检查存储；不能将其视为没有草稿"); }
  }
  function parsed(raw: string, kind: string): unknown {
    try { return JSON.parse(raw); }
    catch { throw new Error(`本机${kind}内容损坏，原始内容仍保留，请先导出核对`); }
  }
  function readServer(scope: StudentRecordScope, sessionId: string): SessionLearningRecord | undefined {
    const raw = stored(key(scope, sessionId));
    if (raw === null) return undefined;
    const value = parsed(raw, "课堂记录");
    if (!isDetail(value, scope, sessionId)) throw new Error("本机课堂记录身份或内容不完整，原始内容仍保留，请先导出核对");
    return value;
  }
  function readServerCopy(scope: StudentRecordScope, sessionId: string): LearningRecordServerCopy {
    assertScope(scope);
    const raw = stored(key(scope, sessionId));
    let error: string | undefined;
    if (raw !== null) {
      let value: unknown;
      try { value = JSON.parse(raw); } catch { error = "本机已保存版本的JSON损坏"; }
      if (!error && !isDetail(value, scope, sessionId)) error = "本机已保存版本的学校、学生或内容不匹配";
    }
    assertScope(scope);
    return { raw, valid: !error, ...(error ? { error } : {}) };
  }
  function read(scope: StudentRecordScope, sessionId: string): CachedLearningRecord | null {
    assertScope(scope);
    const server = readServer(scope, sessionId);
    if (!server) { assertScope(scope); return null; }
    const raw = stored(draftKey(scope, sessionId));
    const pending = raw === null ? null : parsed(raw, "课堂草稿");
    if (pending !== null && !isPending(pending)) throw new Error("本机课堂草稿内容不完整，原始内容仍保留，请先导出核对");
    assertScope(scope);
    return { server, pending };
  }
  function listDrafts(scope: StudentRecordScope, sessionId: string): LearningRecordDraft[] {
    assertScope(scope);
    const prefix = `${key(scope, sessionId)}:draft:`;
    function storageKeys(): string[] {
      const keys: string[] = [];
      try {
        const count = storage.length;
        if (!Number.isSafeInteger(count) || count < 0) throw new Error("invalid length");
        for (let index = 0; index < count; index++) {
          const candidate = storage.key(index);
          if (candidate === null) throw new Error("storage changed while enumerating");
          keys.push(candidate);
        }
        if (storage.length !== count || new Set(keys).size !== count) throw new Error("storage changed while enumerating");
      } catch { throw new Error("暂时无法完整检查其他标签页的课堂草稿，本机内容可能正在变化，请重新核对"); }
      return keys.sort();
    }
    const beforeKeys = storageKeys();
    const keys = beforeKeys.filter((candidate) => candidate.startsWith(prefix));
    const drafts: LearningRecordDraft[] = [];
    for (const entryKey of keys) {
      const raw = stored(entryKey);
      if (raw === null) throw new Error("本机课堂草稿在检查过程中发生变化，请重新核对后再继续");
      const suffix = entryKey.slice(prefix.length);
      let entryClientId = suffix;
      let error: string | undefined;
      try {
        entryClientId = decodeURIComponent(suffix);
        if (!entryClientId || encodeURIComponent(entryClientId) !== suffix) error = "草稿标签标识为空或编码不规范";
      } catch { error = "草稿标签标识损坏"; }
      let value: unknown;
      try { value = JSON.parse(raw); } catch { error = "草稿JSON损坏"; }
      if (value === null && !error) continue;
      if (!isPending(value)) error ??= "草稿内容不完整";
      drafts.push({ clientId: entryClientId, isCurrentTab: entryKey === draftKey(scope, sessionId), raw, valid: !error,
        pending: !error && isPending(value) ? value : null, ...(error ? { error } : {}) });
    }
    const afterKeys = storageKeys();
    if (beforeKeys.length !== afterKeys.length || beforeKeys.some((entry, index) => entry !== afterKeys[index])) {
      throw new Error("本机课堂草稿清单在检查过程中发生变化，请重新核对后再继续");
    }
    assertScope(scope);
    return drafts.sort((left, right) => left.clientId.localeCompare(right.clientId));
  }
  function writePending(scope: StudentRecordScope, sessionId: string, pending: SaveLearningRecordRequest | null) {
    assertScope(scope, true);
    // Quota or blocked-storage errors reach the UI; never claim the draft is saved.
    storage.setItem(draftKey(scope, sessionId), JSON.stringify(pending));
  }
  function writeServer(scope: StudentRecordScope, detail: SessionLearningRecord) {
    const server = mergeServer(readServer(scope, detail.session.id), detail);
    assertScope(scope, true);
    storage.setItem(key(scope, detail.session.id), JSON.stringify(server));
    return server;
  }
  function remember(scope: StudentRecordScope, detail: SessionLearningRecord) {
    assertScope(scope, true);
    if (!isDetail(detail, scope, detail?.session?.id)) throw new Error("不能保存其他学校、账号或不完整的实验记录");
    writeServer(scope, detail);
    const cached = read(scope, detail.session.id);
    if (!cached) throw new Error("本页实验草稿无法读取，请重新打开后核对");
    return cached;
  }
  function queue(scope: StudentRecordScope, sessionId: string, content: LearningRecordContent, replaceBase = false, displayedRevision?: number) {
    assertScope(scope, true);
    const cached = read(scope, sessionId);
    if (!cached) throw new Error("请先读取这次实验，再填写记录");
    const pending = {
      ...content,
      expectedRevision: replaceBase ? cached.server.record?.revision ?? 0
        : cached.pending?.expectedRevision ?? displayedRevision ?? cached.server.record?.revision ?? 0,
      mutationId: newId()
    };
    writePending(scope, sessionId, pending);
    return { ...cached, pending };
  }
  function restoreDraft(scope: StudentRecordScope, sessionId: string, content: LearningRecordContent, expectedRevision: number): CachedLearningRecord {
    assertScope(scope, true);
    if (!isRevision(expectedRevision)) throw new Error("恢复草稿的原始版本号必须是非负安全整数");
    if (!isContent(content) || contentFields.some((field) => content[field].length > LEARNING_RECORD_FIELD_LIMITS[field])) {
      throw new Error("恢复草稿的四段内容必须是字符串且不能超过长度限制");
    }
    const server = readServer(scope, sessionId);
    if (!server) throw new Error("请先读取这次实验，再恢复草稿");
    if (server.session.status === "completed") throw new Error("这次实验已完成，不能恢复为可上传草稿；原始草稿仍可导出");
    // Explicit recovery preserves the authored CAS base. A single atomic storage
    // write replaces this page's draft only on success; no preliminary clearing.
    const pending: SaveLearningRecordRequest = { ...recordContent(content), expectedRevision, mutationId: newId() };
    writePending(scope, sessionId, pending);
    return { server, pending };
  }
  function useServer(scope: StudentRecordScope, sessionId: string) {
    assertScope(scope, true);
    const cached = read(scope, sessionId);
    if (!cached) throw new Error("没有可用的已保存记录");
    writePending(scope, sessionId, null);
    return { ...cached, pending: null };
  }
  function sync(scope: StudentRecordScope, sessionId: string): Promise<SessionLearningRecord> {
    try { assertScope(scope, true); } catch (error) { return Promise.reject(error); }
    const id = `${key(scope, sessionId)}:scope-revision:${scope.revision}`;
    const previous = flights.get(id);
    if (previous) return previous;
    const work = (async () => {
      let cached = read(scope, sessionId);
      if (!cached) throw new Error("没有可同步的实验记录");
      while (cached.pending) {
        assertScope(scope, true);
        const sent: SaveLearningRecordRequest = cached.pending;
        const detail = await api.saveLearningRecord(sessionId, sent);
        // A valid server ACK may belong to the previous token/backend/school.
        // Keep its original pending mutation untouched until this identity returns.
        assertScope(scope, true);
        if (!isDetail(detail, scope, sessionId) || !detail.record || detail.record.lastMutationId !== sent.mutationId ||
          detail.record.revision !== sent.expectedRevision + 1 || !contentFields.every((field) => detail.record?.[field] === sent[field])) {
          throw new Error("服务器返回了不匹配的实验记录，待同步草稿仍保留");
        }
        const latest = read(scope, sessionId);
        if (!latest) throw new Error("本机记录已发生变化，请重新读取后核对；本次同步未更新本机副本");
        let pending = latest.pending;
        if (pending?.mutationId === sent.mutationId) pending = null;
        else if (pending && pending.expectedRevision === sent.expectedRevision) {
          // Advance only to this acknowledgement, not an unrelated newer server
          // revision: an unseen edit from another tab must still cause a conflict.
          pending = { ...pending, expectedRevision: detail.record.revision };
        }
        const server = writeServer(scope, detail);
        writePending(scope, sessionId, pending);
        cached = { server, pending };
      }
      assertScope(scope, true);
      return cached.server;
    })();
    flights.set(id, work);
    void work.finally(() => { if (flights.get(id) === work) flights.delete(id); }).catch(() => undefined);
    return work;
  }
  return { read, remember, queue, restoreDraft, useServer, sync, listDrafts, readServerCopy };
}

let repository: ReturnType<typeof createLearningRecordRepository> | undefined;
export function learningRecordRepository() {
  if (!repository) {
    // A duplicated tab can inherit sessionStorage, so it cannot identify a live
    // writer. Each page lifetime gets its own key; refresh keeps previous drafts
    // available through listDrafts for explicit recovery/export, without adoption.
    repository = createLearningRecordRepository(window.localStorage, studentApi, undefined, crypto.randomUUID());
  }
  return repository;
}

export function recordContent(value: LearningRecordContent | null | undefined): LearningRecordContent {
  return { prediction: value?.prediction ?? "", measurements: value?.measurements ?? "", conclusion: value?.conclusion ?? "", question: value?.question ?? "" };
}
