import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformUser, SessionLearningRecord, StudentTaskLessonContext } from '@physics-lab/contracts';

const STUDENT = 'physics-lab-v2-api-student-token';
const TEACHER = 'physics-lab-v2-api-teacher-token';
const NOW = 1_800_000_000_000;
const request = { experimentId: 'pendulum', taskId: 'task-a', sessionId: 'session-a' };
const owner = { learnerId: 'student-a', schoolId: 'school-a' };
const user: PlatformUser = {
  id: owner.learnerId, schoolId: owner.schoolId, role: 'student', name: '学生甲', email: 'student@example.test',
  status: 'active', lastLoginAt: null, classIds: ['class-a'], classNames: ['高一一班'], createdAt: new Date(NOW).toISOString(),
};
const record: SessionLearningRecord = {
  session: { id: request.sessionId, schoolId: owner.schoolId, taskId: request.taskId, classId: 'class-a',
    learnerId: owner.learnerId, experimentId: request.experimentId, status: 'active',
    startedAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString(), completedAt: null },
  learnerName: user.name, taskTitle: '单摆探究', className: '高一一班', lessonTitle: '单摆周期', record: null,
};
const lesson: StudentTaskLessonContext = {
  title: '单摆周期', objective: '用虚拟读数探究周期', inquiryQuestion: '摆长如何影响周期？',
  predictionPrompt: null, controlledVariable: '小摆角', evidenceRequirement: '记录摆长与完整周期数', reflectionPrompt: null,
};
class MemoryStorage {
  data = new Map<string, string>();
  failRead = false;
  getItem(key: string) { if (this.failRead) throw new Error('Storage unavailable'); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  get length() { return this.data.size; }
}
let storage: MemoryStorage;
function token(changes: Record<string, unknown> = {}, signature = 'signature') {
  const payload = { sub: user.id, schoolId: user.schoolId, role: 'student', name: user.name, exp: NOW / 1000 + 3600, ...changes };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return `${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}.${signature}`;
}
function gateway() {
  return { me: vi.fn().mockResolvedValue(structuredClone(user)), learningRecord: vi.fn().mockResolvedValue(structuredClone(record)), taskLesson: vi.fn().mockResolvedValue(structuredClone(lesson)) };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function services() {
  const scopes = await import('./highSchoolRecordScope');
  const classroom = await import('./highSchoolClassroom');
  const api = await import('./teacherApi');
  return { scopes, classroom, api };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  vi.stubEnv('VITE_DEMO_ONLY', 'false'); vi.stubEnv('VITE_API_URL', 'https://school.example.test/api');
  storage = new MemoryStorage();
  const browser = new EventTarget();
  Object.assign(browser, { localStorage: storage, location: { origin: 'https://lab.example.test' } });
  vi.stubGlobal('window', browser); vi.stubGlobal('document', new EventTarget());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('high-school explicit classroom link', () => {
  it('does not inherit an active task on a free experiment and preserves valid decoded identifiers', async () => {
    storage.setItem('physics-lab-v2-active-api-session', JSON.stringify(record.session));
    const { classroom } = await services();
    expect(classroom.highSchoolClassroomRequest('pendulum', '?view=3d')).toBeNull();
    expect(classroom.highSchoolClassroomRequest('pendulum', '?taskId=task%2F%E7%94%B2&sessionId=session%2B1')).toEqual({
      experimentId: 'pendulum', taskId: 'task/甲', sessionId: 'session+1',
    });
  });

  it.each(['?taskId=task-a', '?sessionId=session-a', '?taskId=&sessionId=session-a', '?taskId=%20&sessionId=session-a',
    '?taskId=task-a&taskId=task-a&sessionId=session-a', '?taskId=task-a&sessionId=session-a&sessionId=other',
    `?taskId=${'t'.repeat(201)}&sessionId=session-a`])('rejects incomplete or ambiguous classroom URLs: %s', async (search) => {
    const { classroom } = await services();
    expect(() => classroom.highSchoolClassroomRequest('pendulum', search)).toThrow('任务链接不完整');
  });

  it.each(['future-unpublished-experiment', 'lens', 'unknown'])('does not connect planned, junior or unknown experiments: %s', async (id) => {
    const { classroom } = await services();
    expect(() => classroom.highSchoolClassroomRequest(id, '?taskId=task-a&sessionId=session-a')).toThrow('不是已开放的高中');
  });
});

describe('classroom evidence owner guard using actual scope and token storage', () => {
  it('allows only the current student, school and API namespace and invalidates a renewed token', async () => {
    storage.setItem(STUDENT, token());
    const { scopes, classroom } = await services();
    const before = scopes.getHighSchoolRecordScope();
    expect(classroom.canUseHighSchoolClassroomScope(before, owner)).toBe(true);
    expect(classroom.canUseHighSchoolClassroomScope(before, { ...owner, learnerId: 'other' })).toBe(false);
    expect(classroom.canUseHighSchoolClassroomScope(before, { ...owner, schoolId: 'other' })).toBe(false);
    expect(classroom.canUseHighSchoolClassroomScope({ ...before, key: before.key!.replace('school.example.test', 'other.example.test') }, owner)).toBe(false);
    storage.setItem(STUDENT, token({ exp: NOW / 1000 + 7200 }, 'renewedSignature'));
    const renewed = scopes.getHighSchoolRecordScope();
    expect(renewed.key).toBe(before.key);
    expect(classroom.canUseHighSchoolClassroomScope(before, owner)).toBe(false);
    expect(classroom.canUseHighSchoolClassroomScope(renewed, owner)).toBe(true);
  });

  it('fails closed for expired, guest, teacher, blocked, demo and unreadable identities before calling any API', async () => {
    storage.setItem(STUDENT, token({ exp: NOW / 1000 + 1 }));
    storage.setItem(TEACHER, token({ sub: 'teacher-a', role: 'teacher' }));
    const { scopes, classroom } = await services(); const api = gateway();
    const snapshots = [scopes.getHighSchoolRecordScope(), scopes.selectHighSchoolRecordScope('teacher'), scopes.selectHighSchoolRecordScope('guest')];
    const student = scopes.selectHighSchoolRecordScope('student');
    vi.setSystemTime(NOW + 2000); snapshots.push(student, scopes.getHighSchoolRecordScope());
    storage.failRead = true; snapshots.push(scopes.getHighSchoolRecordScope());
    for (const snapshot of snapshots) {
      expect(classroom.canUseHighSchoolClassroomScope(snapshot, owner)).toBe(false);
      await expect(classroom.loadHighSchoolClassroom(request, snapshot, api)).rejects.toThrow('有效的学生档案');
    }
    expect(api.me).not.toHaveBeenCalled(); expect(api.learningRecord).not.toHaveBeenCalled(); expect(api.taskLesson).not.toHaveBeenCalled();
    storage.failRead = false; vi.stubEnv('VITE_DEMO_ONLY', 'true'); vi.resetModules();
    const demo = await services(); const snapshot = demo.scopes.getHighSchoolRecordScope();
    expect(snapshot.mode).toBe('demo');
    expect(demo.classroom.canUseHighSchoolClassroomScope(snapshot, owner)).toBe(false);
    await expect(demo.classroom.loadHighSchoolClassroom(request, snapshot, api)).rejects.toThrow('有效的学生档案');
  });

  it('uses the actual student API and token with a separate teacher login present', async () => {
    const studentToken = token(); storage.setItem(STUDENT, studentToken);
    storage.setItem(TEACHER, token({ sub: 'teacher-a', role: 'teacher' }, 'teacherSignature'));
    const { scopes, classroom } = await services(); const scope = scopes.selectHighSchoolRecordScope('student');
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${studentToken}`);
      const path = new URL(String(input)).pathname;
      const data = path.endsWith('/auth/me') ? user : path.endsWith('/record') ? record : lesson;
      return new Response(JSON.stringify({ data }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    await expect(classroom.loadHighSchoolClassroom(request, scope)).resolves.toEqual({ record, lesson });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      'https://school.example.test/api/auth/me', 'https://school.example.test/api/sessions/session-a/record',
      'https://school.example.test/api/tasks/task-a/lesson-context',
    ]);
  });

  it('checks every ownership and route field before requesting lesson details', async () => {
    storage.setItem(STUDENT, token());
    const { scopes, classroom } = await services(); const scope = scopes.getHighSchoolRecordScope();
    for (const [field, value] of Object.entries({ learnerId: 'other', schoolId: 'other', id: 'other', taskId: 'other', experimentId: 'double-slit' })) {
      const api = gateway(); api.learningRecord.mockResolvedValue({ ...record, session: { ...record.session, [field]: value } });
      await expect(classroom.loadHighSchoolClassroom(request, scope, api)).rejects.toThrow('不一致');
      expect(api.taskLesson).not.toHaveBeenCalled();
    }
    const wrongRole = gateway(); wrongRole.me.mockResolvedValue({ ...user, role: 'teacher' });
    await expect(classroom.loadHighSchoolClassroom(request, scope, wrongRole)).rejects.toThrow('不一致');
    const wrongOwner = gateway(); wrongOwner.me.mockResolvedValue({ ...user, id: 'other' });
    wrongOwner.learningRecord.mockResolvedValue({ ...record, session: { ...record.session, learnerId: 'other' } });
    await expect(classroom.loadHighSchoolClassroom(request, scope, wrongOwner)).rejects.toThrow('本机档案与后台学生身份不一致');
    expect(wrongRole.taskLesson).not.toHaveBeenCalled(); expect(wrongOwner.taskLesson).not.toHaveBeenCalled();
  });

  it.each(['logout', 'switch-account', 'renew', 'expiry', 'guest'] as const)('rejects late report responses after %s', async (change) => {
    storage.setItem(STUDENT, token());
    const { scopes, classroom, api: realApi } = await services(); const scope = scopes.getHighSchoolRecordScope();
    const waiting = deferred<SessionLearningRecord>(); const api = gateway(); api.learningRecord.mockReturnValue(waiting.promise);
    const promise = classroom.loadHighSchoolClassroom(request, scope, api);
    const rejected = expect(promise).rejects.toThrow('有效的学生档案');
    if (change === 'logout') realApi.studentApi.logout();
    if (change === 'switch-account') storage.setItem(STUDENT, token({ sub: 'student-b' }));
    if (change === 'renew') storage.setItem(STUDENT, token({}, 'renewedSignature'));
    if (change === 'expiry') vi.setSystemTime(NOW + 3_601_000);
    if (change === 'guest') scopes.selectHighSchoolRecordScope('guest');
    waiting.resolve(record); await rejected;
    expect(api.taskLesson).not.toHaveBeenCalled();
  });

  it('also invalidates a late lesson response after the identity was initially verified', async () => {
    storage.setItem(STUDENT, token());
    const { scopes, classroom } = await services(); const scope = scopes.getHighSchoolRecordScope();
    const waiting = deferred<StudentTaskLessonContext>(); const started = deferred<void>(); const api = gateway();
    api.taskLesson.mockImplementation(() => { started.resolve(); return waiting.promise; });
    const promise = classroom.loadHighSchoolClassroom(request, scope, api);
    const rejected = expect(promise).rejects.toThrow('有效的学生档案');
    await started.promise; scopes.selectHighSchoolRecordScope('guest'); waiting.resolve(lesson); await rejected;
  });

  it('keeps a verified historical report available only for a lesson-endpoint API 404', async () => {
    storage.setItem(STUDENT, token());
    const { scopes, classroom, api: realApi } = await services(); const scope = scopes.getHighSchoolRecordScope();
    const api = gateway(); const completed: SessionLearningRecord = { ...record, session: { ...record.session, status: 'completed', completedAt: new Date(NOW).toISOString() } };
    api.learningRecord.mockResolvedValue(completed);
    api.taskLesson.mockRejectedValue(new realApi.TeacherApiError(404, 'TASK_NOT_FOUND', 'Task closed'));
    await expect(classroom.loadHighSchoolClassroom(request, scope, api)).resolves.toEqual({ record: completed, lesson: null });
    for (const error of [new Error('network failed'), new realApi.TeacherApiError(401, 'UNAUTHORIZED', 'expired'),
      new realApi.TeacherApiError(403, 'FORBIDDEN', 'denied'), new realApi.TeacherApiError(500, 'SERVER_ERROR', 'failed'),
      Object.assign(new Error('not an API error'), { status: 404 })]) {
      api.taskLesson.mockRejectedValue(error);
      await expect(classroom.loadHighSchoolClassroom(request, scope, api)).rejects.toBe(error);
    }
  });

  it('does not hide a missing report behind the historical-lesson fallback', async () => {
    storage.setItem(STUDENT, token());
    const { scopes, classroom, api: realApi } = await services(); const scope = scopes.getHighSchoolRecordScope();
    const api = gateway(); const missing = new realApi.TeacherApiError(404, 'SESSION_NOT_FOUND', 'missing');
    api.learningRecord.mockRejectedValue(missing);
    await expect(classroom.loadHighSchoolClassroom(request, scope, api)).rejects.toBe(missing);
    expect(api.taskLesson).not.toHaveBeenCalled();
  });
});
