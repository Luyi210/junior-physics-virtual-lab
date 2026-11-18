import type { PlatformUser, SessionLearningRecord, StudentTaskLessonContext } from '@physics-lab/contracts';
import { getClassroomExperiment } from '@physics-lab/knowledge/classroom';
import { getPlatformAuthMetadata, studentApi, TeacherApiError } from './teacherApi';
import { isCurrentHighSchoolRecordScope, type HighSchoolRecordScope } from './highSchoolRecordScope';

export interface HighSchoolClassroomRequest { experimentId: string; taskId: string; sessionId: string }
export interface HighSchoolClassroomDetail { record: SessionLearningRecord; lesson: StudentTaskLessonContext | null }
type Gateway = Pick<typeof studentApi, 'me' | 'learningRecord' | 'taskLesson'>;

/** A free experiment never silently inherits another page's active task. */
export function highSchoolClassroomRequest(experimentId: string, search: string): HighSchoolClassroomRequest | null {
  const params = new URLSearchParams(search);
  if (!params.has('taskId') && !params.has('sessionId')) return null;
  if (getClassroomExperiment(experimentId)?.stage !== 'high-school') throw new Error('这不是已开放的高中课堂实验。');
  for (const key of ['taskId', 'sessionId']) {
    const values = params.getAll(key);
    if (values.length !== 1 || !values[0]?.trim() || values[0].length > 200) throw new Error('任务链接不完整或包含重复标识，请从任务中心重新进入。');
  }
  return { experimentId, taskId: params.get('taskId')!, sessionId: params.get('sessionId')! };
}

export function validateHighSchoolClassroom(request: HighSchoolClassroomRequest, user: PlatformUser, record: SessionLearningRecord) {
  const session = record.session;
  if (user.role !== 'student' || session.learnerId !== user.id || session.schoolId !== user.schoolId
    || session.id !== request.sessionId || session.taskId !== request.taskId || session.experimentId !== request.experimentId) {
    throw new Error('当前学生、任务、实验或会话不一致，未连接这份课堂档案。请从任务中心重新进入。');
  }
}

export function canUseHighSchoolClassroomScope(scope: HighSchoolRecordScope, owner: { learnerId: string; schoolId: string }) {
  const namespace = encodeURIComponent(getPlatformAuthMetadata().apiNamespace);
  const expected = `account:${namespace}:${encodeURIComponent(owner.schoolId)}:student:${encodeURIComponent(owner.learnerId)}`;
  return scope.mode === 'account' && scope.authChannel === 'student' && scope.key === expected && isCurrentHighSchoolRecordScope(scope, true);
}

export async function loadHighSchoolClassroom(request: HighSchoolClassroomRequest, scope: HighSchoolRecordScope,
  gateway: Gateway = studentApi, isCurrent: () => boolean = () => isCurrentHighSchoolRecordScope(scope, true)): Promise<HighSchoolClassroomDetail> {
  const check = () => {
    if (scope.mode !== 'account' || scope.authChannel !== 'student' || !scope.canWrite || !isCurrent()) throw new Error('请选用有效的学生档案再连接课堂任务；游客、教师与过期身份不会代为提交。');
  };
  check();
  const [user, record] = await Promise.all([gateway.me(), gateway.learningRecord(request.sessionId)]);
  check();
  validateHighSchoolClassroom(request, user, record);
  const namespace = encodeURIComponent(getPlatformAuthMetadata().apiNamespace);
  if (scope.key !== `account:${namespace}:${encodeURIComponent(user.schoolId)}:student:${encodeURIComponent(user.id)}`) {
    throw new Error('本机档案与后台学生身份不一致，请重新选择学生档案。');
  }
  let lesson: StudentTaskLessonContext | null;
  try { lesson = await gateway.taskLesson(request.taskId); }
  catch (error) {
    // A closed task no longer exposes its lesson endpoint. Its verified owner's
    // historical report stays reachable; do not turn authentication/network failures into success.
    if (!(error instanceof TeacherApiError) || error.status !== 404) throw error;
    lesson = null;
  }
  check();
  return { record, lesson };
}
