import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionLearningRecord } from '@physics-lab/contracts';
import { createLegacyLearningRecordsBackup, LEGACY_LEARNING_RECORD_BOUNDARY, readLegacyLearningRecords, type LegacyLearningRecordAccess } from './legacyLearningRecords';

const owner = 'student-a';
const session = 'session-a';
const base = (learnerId = owner, sessionId = session) => `physics-learning-record-v2:${encodeURIComponent(learnerId)}:${encodeURIComponent(sessionId)}`;
const draftKey = (tab: string, learnerId = owner, sessionId = session) => `${base(learnerId, sessionId)}:draft:${encodeURIComponent(tab)}`;
const content = { prediction: '原预测', measurements: '原读数\n保留换行和完整数字 0.9800000000000001', conclusion: '原结论', question: '原问题' };
function detail(learnerId = owner, sessionId = session): SessionLearningRecord {
  return {
    session: { id: sessionId, learnerId, schoolId: 'unknown-old-school', taskId: 'task-a', classId: 'class-a', experimentId: 'pendulum', status: 'active',
      startedAt: '2026-11-10T00:00:00.000Z', updatedAt: '2026-11-10T00:00:00.000Z', completedAt: null },
    learnerName: '旧名字', taskTitle: '旧任务', className: '旧班级', lessonTitle: '旧课例',
    record: { ...content, sessionId, learnerId, revision: 2, lastMutationId: 'old-mutation', updatedAt: '2026-11-10T00:00:00.000Z' },
  };
}
const pending = (text = '尚未同步的原稿', mutationId = 'draft-mutation') => ({ ...content, measurements: text, expectedRevision: 1, mutationId });
function access(learnerId = owner, sessionId = session): LegacyLearningRecordAccess { return { learnerId, sessionId, isCurrent: vi.fn(() => true) }; }
class ReadOnlyStorage {
  values = new Map<string, string>();
  getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  key = vi.fn((index: number) => [...this.values.keys()][index] ?? null);
  get length() { return this.values.size; }
}
function setup() {
  const storage = new ReadOnlyStorage();
  storage.values.set(base(), JSON.stringify(detail()));
  return storage;
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('explicit read-only access to old unscoped classroom copies', () => {
  it('reads every tab draft and server copy without touching another owner, session or version', () => {
    const storage = setup(); const gate = access();
    storage.values.set(draftKey('tab-a'), JSON.stringify(pending('A标签页原稿', 'a')));
    storage.values.set(draftKey('tab-b'), JSON.stringify(pending('B标签页不同原稿', 'b')));
    storage.values.set(draftKey('default'), 'null');
    const forbidden = [base('other-student'), draftKey('tab-a', 'other-student'), base(owner, 'other-session'),
      `${base()}-similar`, `${base()}:draft-other:tab`, 'physics-learning-record-v3:private', 'physics-lab-v2-api-student-token'];
    for (const key of forbidden) storage.values.set(key, 'MUST NOT READ');
    const before = [...storage.values];
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot).toMatchObject({ learnerId: owner, sessionId: session, boundary: LEGACY_LEARNING_RECORD_BOUNDARY, failed: false, partial: false, issues: [] });
    expect(snapshot.entries).toHaveLength(4);
    expect(snapshot.entries.filter((entry) => entry.kind === 'draft').map((entry) => entry.tabId)).toEqual(['default', 'tab-a', 'tab-b']);
    expect(snapshot.entries.find((entry) => entry.tabId === 'tab-a')?.content?.measurements).toBe('A标签页原稿');
    expect(snapshot.entries.find((entry) => entry.tabId === 'tab-b')?.content?.measurements).toBe('B标签页不同原稿');
    expect(snapshot.entries.find((entry) => entry.tabId === 'default')).toMatchObject({ status: 'empty', content: null, rawPayload: 'null' });
    expect(storage.getItem.mock.calls.every(([key]) => !forbidden.includes(key))).toBe(true);
    expect([...storage.values]).toEqual(before);
  });

  it('matches encoded identities exactly, including separators and Unicode', () => {
    const gate = access('学生:a/甲', '课堂:1/乙'); const storage = new ReadOnlyStorage();
    const correct = base(gate.learnerId, gate.sessionId);
    storage.values.set(correct, JSON.stringify(detail(gate.learnerId, gate.sessionId)));
    storage.values.set(draftKey('tab:甲/1', gate.learnerId, gate.sessionId), JSON.stringify(pending()));
    storage.values.set(`physics-learning-record-v2:${gate.learnerId}:${gate.sessionId}`, 'not a canonical key');
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[1]).toMatchObject({ tabId: 'tab:甲/1', status: 'valid' });
    expect(storage.getItem.mock.calls.map(([key]) => key)).toEqual([correct, draftKey('tab:甲/1', gate.learnerId, gate.sessionId)]);
  });

  it('does not attribute matching old IDs to the current backend or school', () => {
    const gate = access(); const storage = setup();
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot.entries[0]?.content).toEqual(content);
    const backup = JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate));
    expect(backup.boundary).toContain('未验证属于当前学校或后台');
    expect(backup.boundary).toContain('不会自动迁移、上传、删除或补写');
    expect(backup).not.toHaveProperty('currentSchoolId'); expect(backup).not.toHaveProperty('apiNamespace');
    expect(JSON.parse(backup.entries[0].rawPayload).session.schoolId).toBe('unknown-old-school');
  });

  it('keeps malformed JSON and non-object payloads byte-for-byte in explicit backups', () => {
    const gate = access(); const storage = setup();
    const raw = '\n{损坏的 JSON；<script>仅文字</script>\n\u0000';
    storage.values.set(draftKey('broken'), raw);
    storage.values.set(draftKey('array'), '["old payload"]');
    storage.values.set(draftKey('empty'), '');
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot).toMatchObject({ failed: true, partial: false });
    expect(snapshot.entries.find((entry) => entry.tabId === 'broken')).toMatchObject({ rawPayload: raw, status: 'invalid-json', content: null });
    expect(snapshot.entries.find((entry) => entry.tabId === 'array')).toMatchObject({ status: 'invalid-shape', content: null });
    expect(snapshot.entries.find((entry) => entry.tabId === 'empty')).toMatchObject({ rawPayload: '', status: 'invalid-json' });
    const backup = JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate));
    expect(backup.entries.find((entry: { tabId: string }) => entry.tabId === 'broken').rawPayload).toBe(raw);
    expect(backup.collectionReadComplete).toBe(true);
    expect(backup.completenessNote).toContain('结构损坏');
  });

  it.each(['session-learner', 'session-id', 'record-learner', 'record-session'] as const)('keeps a mismatched server payload raw-only: %s', (change) => {
    const gate = access(); const storage = setup(); const value = detail();
    if (change === 'session-learner') value.session.learnerId = 'other';
    if (change === 'session-id') value.session.id = 'other';
    if (change === 'record-learner') value.record!.learnerId = 'other';
    if (change === 'record-session') value.record!.sessionId = 'other';
    const raw = JSON.stringify(value); storage.values.set(base(), raw);
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot.entries[0]).toMatchObject({ status: 'invalid-shape', content: null, rawPayload: raw });
    expect(JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate)).entries[0].rawPayload).toBe(raw);
  });

  it('does not present a malformed draft or known conflicting optional identity as normal text', () => {
    const storage = setup();
    storage.values.set(draftKey('negative-revision'), JSON.stringify({ ...pending(), expectedRevision: -1 }));
    storage.values.set(draftKey('missing-mutation'), JSON.stringify({ ...pending(), mutationId: '' }));
    storage.values.set(draftKey('wrong-owner'), JSON.stringify({ ...pending(), learnerId: 'other' }));
    storage.values.set(draftKey('wrong-session'), JSON.stringify({ ...pending(), sessionId: 'other' }));
    storage.values.set(draftKey('missing-field'), JSON.stringify({ measurements: '仍应保留' }));
    const snapshot = readLegacyLearningRecords(access(), storage);
    expect(snapshot.entries.filter((entry) => entry.kind === 'draft').every((entry) => entry.status === 'invalid-shape' && entry.content === null && entry.rawPayload !== null)).toBe(true);
  });

  it('preserves damaged matching draft keys without guessing a tab identity', () => {
    const storage = setup(); const gate = access();
    const damaged = [`${base()}:draft:%ZZ`, `${base()}:draft:`, `${base()}:draft:unescaped:separator`];
    damaged.forEach((key) => storage.values.set(key, JSON.stringify(pending())));
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot.entries.filter((entry) => entry.kind === 'draft').every((entry) => entry.status === 'invalid-key' && entry.tabId === null && entry.content === null)).toBe(true);
    const backup = JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate));
    expect(backup.entries.map((entry: { key: string }) => entry.key)).toEqual([base(), ...damaged].sort());
  });

  it('retains orphaned per-tab drafts even when no server snapshot exists', () => {
    const storage = new ReadOnlyStorage(); storage.values.set(draftKey('orphan'), JSON.stringify(pending()));
    const snapshot = readLegacyLearningRecords(access(), storage);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({ kind: 'draft', tabId: 'orphan', status: 'valid', content: { ...content, measurements: '尚未同步的原稿' } });
  });

  it('records an unreadable matching payload without omitting its key or claiming a complete backup', () => {
    const storage = setup(); const gate = access();
    storage.values.set(draftKey('blocked'), JSON.stringify(pending()));
    storage.getItem.mockImplementation((key) => { if (key === draftKey('blocked')) throw new Error('blocked'); return storage.values.get(key) ?? null; });
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot).toMatchObject({ failed: true, partial: true });
    expect(snapshot.entries.find((entry) => entry.tabId === 'blocked')).toMatchObject({ key: draftKey('blocked'), rawPayload: null, status: 'unreadable', content: null });
    const backup = JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate));
    expect(backup.collectionReadComplete).toBe(false); expect(backup.completenessNote).toContain('本次读取不完整');
  });

  it('reports directory read failures and keeps any matching entries that can still be read', () => {
    const storage = setup(); const gate = access(); storage.values.set(draftKey('tab'), JSON.stringify(pending()));
    storage.key.mockImplementation((index) => { if (index === 0) throw new Error('blocked index'); return [...storage.values.keys()][index] ?? null; });
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot).toMatchObject({ failed: true, partial: true }); expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]?.tabId).toBe('tab'); expect(snapshot.issues.join(' ')).toContain('第 1 项');
    const unavailable = readLegacyLearningRecords(gate, { get length(): number { throw new Error('blocked directory'); }, key: storage.key, getItem: storage.getItem });
    expect(unavailable).toMatchObject({ failed: true, partial: true, entries: [] });
    expect(JSON.parse(createLegacyLearningRecordsBackup(unavailable, gate)).collectionReadComplete).toBe(false);
  });

  it('marks a changing or vanished key inventory as partial instead of silently treating it as empty', () => {
    const storage = setup(); const gate = access(); storage.values.set(draftKey('vanished'), JSON.stringify(pending()));
    storage.getItem.mockImplementation((key) => key === draftKey('vanished') ? null : storage.values.get(key) ?? null);
    const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot.partial).toBe(true);
    expect(snapshot.entries.find((entry) => entry.tabId === 'vanished')?.status).toBe('unreadable');
    const changed = setup();
    changed.key.mockImplementation((index) => { const key = [...changed.values.keys()][index] ?? null; changed.values.set(draftKey('new'), JSON.stringify(pending())); return key; });
    expect(readLegacyLearningRecords(gate, changed).partial).toBe(true);
  });

  it('rejects missing identities and stale access before inspecting storage', () => {
    const storage = setup();
    for (const gate of [access('', session), access(owner, ''), access('\ud800', session)]) expect(() => readLegacyLearningRecords(gate, storage)).toThrow('需要明确');
    expect(() => readLegacyLearningRecords({ ...access(), isCurrent: () => false }, storage)).toThrow('身份或课堂会话已变化');
    expect(() => readLegacyLearningRecords({ ...access(), isCurrent: () => { throw new Error('guard unavailable'); } }, storage)).toThrow('身份或课堂会话已变化');
    expect(storage.key).not.toHaveBeenCalled(); expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('stops when access changes during the scan and refuses stale export even if a newer guard uses the same IDs', () => {
    const storage = setup(); let active = true; const gate = { ...access(), isCurrent: () => active };
    storage.getItem.mockImplementation((key) => { active = false; return storage.values.get(key) ?? null; });
    expect(() => readLegacyLearningRecords(gate, storage)).toThrow('身份或课堂会话已变化');
    active = true; storage.getItem.mockImplementation((key) => storage.values.get(key) ?? null);
    const snapshot = readLegacyLearningRecords(gate, storage); active = false;
    expect(() => createLegacyLearningRecordsBackup(snapshot, access())).toThrow('身份或课堂会话已变化');
  });

  it('binds export to the original explicit view and same owner/session; read-only access may remain permitted', () => {
    const storage = setup(); const gate = access(); const snapshot = readLegacyLearningRecords(gate, storage);
    expect(() => createLegacyLearningRecordsBackup(snapshot, access('other'))).toThrow('预览与当前学生或会话不符');
    expect(() => createLegacyLearningRecordsBackup(snapshot, access(owner, 'other'))).toThrow('预览与当前学生或会话不符');
    expect(() => createLegacyLearningRecordsBackup(structuredClone(snapshot), gate)).toThrow('预览与当前学生或会话不符');
    // No writable requirement: the UI's same-owner expired-account read guard may allow backup.
    expect(JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate)).entries).toHaveLength(1);
  });

  it('exports the original captured text and UTC timestamps without rereading, truncating, uploading or writing', () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-11-11T00:00:00.000Z');
    const storage = setup(); const gate = access(); const raw = JSON.stringify(pending('长'.repeat(13_000)));
    storage.values.set(draftKey('long'), raw); const snapshot = readLegacyLearningRecords(gate, storage);
    expect(snapshot.capturedAt).toBe('2026-11-11T00:00:00.000Z');
    const reads = storage.getItem.mock.calls.length; storage.values.set(draftKey('long'), 'later data');
    vi.setSystemTime('2026-11-11T00:01:00.000Z'); const network = vi.fn(); vi.stubGlobal('fetch', network);
    const backup = JSON.parse(createLegacyLearningRecordsBackup(snapshot, gate));
    expect(backup).toMatchObject({ format: 'physics-legacy-learning-records-backup-v1', capturedAt: snapshot.capturedAt, exportedAt: '2026-11-11T00:01:00.000Z' });
    expect(backup.entries.find((entry: { tabId: string }) => entry.tabId === 'long').rawPayload).toBe(raw);
    expect(storage.getItem).toHaveBeenCalledTimes(reads); expect(network).not.toHaveBeenCalled();
    expect(storage.values.get(draftKey('long'))).toBe('later data');
  });
});
