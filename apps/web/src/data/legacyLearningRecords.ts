import type { LearningRecordContent } from '@physics-lab/contracts';

/** This is a read-only, explicit inspection of pre-namespace report keys. */
export const LEGACY_LEARNING_RECORD_BOUNDARY = '旧本机档案：仅按旧键中的学生 ID 与课堂会话 ID 筛选，未验证属于当前学校或后台；不同标签页草稿各自保留。不会自动迁移、上传、删除或补写，也不作为当前账号的已保存报告。备份保留原键与原始文字；本次读取不是跨标签页的原子快照。';
export interface LegacyLearningRecordAccess {
  learnerId: string;
  sessionId: string;
  /** The caller captures its current student identity and route, including read-only expiry rules. */
  isCurrent(): boolean;
}
export interface LegacyLearningRecordEntry {
  key: string;
  kind: 'server' | 'draft';
  tabId: string | null;
  rawPayload: string | null;
  status: 'valid' | 'empty' | 'invalid-json' | 'invalid-shape' | 'invalid-key' | 'unreadable';
  /** A readable old copy, never authenticated current-account evidence. Invalid data stays raw-only. */
  content: LearningRecordContent | null;
  issues: string[];
}
export interface LegacyLearningRecordSnapshot {
  boundary: string;
  learnerId: string;
  sessionId: string;
  capturedAt: string;
  entries: LegacyLearningRecordEntry[];
  /** Includes malformed data as well as storage failures. */
  failed: boolean;
  /** At least one payload/key could not be read, or the key inventory changed while scanning. */
  partial: boolean;
  issues: string[];
}
type ReadStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;
const snapshotGuards = new WeakMap<LegacyLearningRecordSnapshot, () => boolean>();
const fields = ['prediction', 'measurements', 'conclusion', 'question'] as const;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const revision = (value: unknown, minimum: number) => Number.isSafeInteger(value) && Number(value) >= minimum;
const content = (value: unknown): value is LearningRecordContent => object(value) && fields.every((field) => typeof value[field] === 'string');
const copyContent = (value: LearningRecordContent): LearningRecordContent => ({ prediction: value.prediction, measurements: value.measurements, conclusion: value.conclusion, question: value.question });

function current(access: LegacyLearningRecordAccess, original?: () => boolean) {
  let allowed = false;
  try { allowed = Boolean(access.isCurrent()) && (!original || Boolean(original())); } catch { /* Read guards fail closed. */ }
  if (!allowed) throw new Error('学生身份或课堂会话已变化，未读取或导出旧本机档案。请从当前课堂记录重新打开。');
}
function baseKey(access: LegacyLearningRecordAccess) {
  try {
    if (typeof access.learnerId !== 'string' || !access.learnerId.trim() || typeof access.sessionId !== 'string' || !access.sessionId.trim()) throw new Error();
    return `physics-learning-record-v2:${encodeURIComponent(access.learnerId)}:${encodeURIComponent(access.sessionId)}`;
  } catch { throw new Error('查看旧本机档案需要明确的当前学生 ID 和课堂会话 ID。'); }
}
function preview(value: unknown, kind: LegacyLearningRecordEntry['kind'], learnerId: string, sessionId: string): LearningRecordContent | null | undefined {
  if (kind === 'draft') {
    if (value === null) return null;
    if (!object(value) || !content(value) || !revision(value.expectedRevision, 0) || typeof value.mutationId !== 'string' || !value.mutationId) return undefined;
    // Old drafts normally have neither identity field. Do not present a known mismatch as readable evidence.
    if (('learnerId' in value && value.learnerId !== learnerId) || ('sessionId' in value && value.sessionId !== sessionId)) return undefined;
    return copyContent(value);
  }
  if (!object(value) || !object(value.session)) return undefined;
  const session = value.session;
  if (session.learnerId !== learnerId || session.id !== sessionId || !['schoolId', 'taskId', 'classId', 'experimentId'].every((key) => typeof session[key] === 'string')
    || !['active', 'completed'].includes(String(session.status)) || !time(session.startedAt) || !time(session.updatedAt)
    || (session.completedAt !== null && !time(session.completedAt))
    || !['learnerName', 'taskTitle', 'className', 'lessonTitle'].every((key) => typeof value[key] === 'string')) return undefined;
  if (value.record === null) return null;
  const record = value.record;
  if (!object(record) || !content(record) || record.learnerId !== learnerId || record.sessionId !== sessionId || !revision(record.revision, 1)
    || typeof record.lastMutationId !== 'string' || !record.lastMutationId || !time(record.updatedAt)) return undefined;
  return copyContent(record);
}

/** Call only after an explicit user action. No storage or network work happens at module load. */
export function readLegacyLearningRecords(access: LegacyLearningRecordAccess, suppliedStorage?: ReadStorage): LegacyLearningRecordSnapshot {
  const base = baseKey(access);
  current(access);
  const guard = access.isCurrent.bind(access);
  const snapshot: LegacyLearningRecordSnapshot = { boundary: LEGACY_LEARNING_RECORD_BOUNDARY, learnerId: access.learnerId, sessionId: access.sessionId,
    capturedAt: new Date().toISOString(), entries: [], failed: false, partial: false, issues: [] };
  const issue = (message: string, partial = false) => { snapshot.failed = true; snapshot.partial ||= partial; snapshot.issues.push(message); };
  let storage: ReadStorage;
  let length: number;
  try {
    storage = suppliedStorage ?? window.localStorage;
    length = storage.length;
    if (!Number.isSafeInteger(length) || length < 0) throw new Error();
  } catch {
    issue('浏览器存储目录无法读取；本次结果不包含全部旧本机档案。', true);
    current(access, guard); snapshotGuards.set(snapshot, guard); return snapshot;
  }
  const keys = new Set<string>();
  for (let index = 0; index < length; index++) {
    current(access, guard);
    try {
      const key = storage.key(index);
      if (key === null) issue('读取时本机存储目录发生变化，可能有条目未列入；请重新打开后核对。', true);
      else if (key === base || key.startsWith(`${base}:draft:`)) keys.add(key);
    } catch { issue(`无法读取本机存储目录第 ${index + 1} 项；可能有条目未列入。`, true); }
  }
  try { if (storage.length !== length) issue('读取期间本机存储条目数量变化；本次结果可能不完整。', true); }
  catch { issue('读取后无法复核本机存储目录；本次结果可能不完整。', true); }
  for (const key of [...keys].sort()) {
    current(access, guard);
    const kind = key === base ? 'server' : 'draft';
    const entry: LegacyLearningRecordEntry = { key, kind, tabId: null, rawPayload: null, status: 'unreadable', content: null, issues: [] };
    if (kind === 'draft') {
      const suffix = key.slice(`${base}:draft:`.length);
      try {
        const decoded = decodeURIComponent(suffix);
        if (!decoded || encodeURIComponent(decoded) !== suffix) throw new Error();
        entry.tabId = decoded;
      } catch { entry.status = 'invalid-key'; entry.issues.push('旧草稿的标签页编号格式损坏，仅保留原键与原文供备份。'); }
    }
    try {
      entry.rawPayload = storage.getItem(key);
      if (entry.rawPayload === null) throw new Error();
    } catch {
      entry.status = 'unreadable'; entry.issues.push('原始内容无法读取或已被其他标签页移除；备份中仅保留已发现的键。');
      snapshot.partial = true;
    }
    current(access, guard);
    if (entry.rawPayload !== null && entry.status !== 'invalid-key') {
      let parsed: unknown;
      try { parsed = JSON.parse(entry.rawPayload); }
      catch { entry.status = 'invalid-json'; entry.issues.push('原始文字不是有效 JSON，仍完整保留供备份。'); }
      if (entry.status !== 'invalid-json') {
        const readable = preview(parsed, kind, access.learnerId, access.sessionId);
        if (readable === undefined) { entry.status = 'invalid-shape'; entry.issues.push('旧内容格式不完整，或其中的学生/会话标识与旧键不符；不显示为正常正文，原文仍保留。'); }
        else { entry.content = readable; entry.status = readable === null ? 'empty' : 'valid'; }
      }
    }
    snapshot.entries.push(entry);
    for (const message of entry.issues) issue(`${key}：${message}`);
  }
  current(access, guard);
  snapshotGuards.set(snapshot, guard);
  return snapshot;
}

/** Returns backup JSON only; it neither downloads nor mutates any local/cloud record. */
export function createLegacyLearningRecordsBackup(snapshot: LegacyLearningRecordSnapshot, access: LegacyLearningRecordAccess): string {
  baseKey(access);
  const guard = snapshotGuards.get(snapshot);
  if (!guard || snapshot.learnerId !== access.learnerId || snapshot.sessionId !== access.sessionId) throw new Error('旧本机档案预览与当前学生或会话不符，请重新打开后备份。');
  current(access, guard);
  return JSON.stringify({ format: 'physics-legacy-learning-records-backup-v1', source: 'legacy-local-learning-record-v2', boundary: LEGACY_LEARNING_RECORD_BOUNDARY,
    learnerIdFromOldKey: snapshot.learnerId, sessionIdFromOldKey: snapshot.sessionId, capturedAt: snapshot.capturedAt, exportedAt: new Date().toISOString(),
    collectionReadComplete: !snapshot.partial,
    completenessNote: snapshot.partial ? '本次读取不完整；无法读取的原文不能包含在备份中，请保留浏览器中的旧数据并稍后重试。' : '本次发现的匹配键均已读取；不保证其他标签页并发修改时的原子快照，结构损坏的原文也不代表已验证记录。',
    failed: snapshot.failed, partial: snapshot.partial, issues: snapshot.issues,
    entries: snapshot.entries.map(({ key, kind, tabId, rawPayload, status, issues }) => ({ key, kind, tabId, rawPayload, status, issues })),
  }, null, 2);
}
