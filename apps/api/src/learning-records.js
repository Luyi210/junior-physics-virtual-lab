import { LEARNING_RECORD_FIELD_LIMITS } from "@physics-lab/contracts";
import { ApiError } from "./http.js";

const fields = Object.keys(LEARNING_RECORD_FIELD_LIMITS);
const sessionSelect = `SELECT s.*, u.name learner_name, t.title task_title,
  c.name class_name, c.created_by class_owner, l.title lesson_title
  FROM sessions s JOIN users u ON u.id=s.learner_id
  JOIN tasks t ON t.id=s.task_id JOIN classes c ON c.id=s.class_id
  JOIN lessons l ON l.id=t.lesson_id`;

export function validateLearningRecord(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(422, "VALIDATION_ERROR", "实验记录必须是 JSON 对象");
  }
  const allowed = new Set([...fields, "expectedRevision", "mutationId"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ApiError(422, "VALIDATION_ERROR", "实验记录包含不支持的字段");
  }
  const content = {};
  for (const field of fields) {
    if (typeof body[field] !== "string" || body[field].length > LEARNING_RECORD_FIELD_LIMITS[field]) {
      throw new ApiError(422, "VALIDATION_ERROR", `${field} 必须是最多 ${LEARNING_RECORD_FIELD_LIMITS[field]} 个字符的文字`);
    }
    // Preserve whitespace: repeated saves must compare the exact student-authored text.
    content[field] = body[field];
  }
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "expectedRevision 必须是非负整数");
  }
  if (typeof body.mutationId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(body.mutationId)) {
    throw new ApiError(422, "VALIDATION_ERROR", "mutationId 必须是 1 到 160 位字母、数字或 . _ : - 标识");
  }
  return { ...content, expectedRevision: body.expectedRevision, mutationId: body.mutationId };
}

function mapRecord(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id, learnerId: row.learner_id,
    prediction: row.prediction, measurements: row.measurements, conclusion: row.conclusion, question: row.question,
    revision: Number(row.revision), lastMutationId: row.last_mutation_id, updatedAt: row.updated_at
  };
}

function envelope(row, record) {
  return {
    session: {
      id: row.id, schoolId: row.school_id, taskId: row.task_id, classId: row.class_id,
      learnerId: row.learner_id, experimentId: row.experiment_id, status: row.status,
      startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at
    },
    learnerName: row.learner_name, taskTitle: row.task_title, className: row.class_name,
    lessonTitle: row.lesson_title, record: mapRecord(record)
  };
}

async function accessibleSession(db, user, sessionId) {
  const row = await db.get(`${sessionSelect} WHERE s.id=? AND s.school_id=? AND c.school_id=?`, [sessionId, user.schoolId, user.schoolId]);
  if (!row) throw new ApiError(404, "SESSION_NOT_FOUND", "没有找到这个实验会话");
  if ((user.role === "student" && row.learner_id !== user.id) ||
      (user.role === "teacher" && row.class_owner !== user.id) ||
      !["student", "teacher", "admin"].includes(user.role)) {
    throw new ApiError(403, "RECORD_FORBIDDEN", "只能查看本人或所负责班级的实验记录");
  }
  return row;
}

export async function getSessionLearningRecord(db, user, sessionId) {
  const session = await accessibleSession(db, user, sessionId);
  return envelope(session, await db.get("SELECT * FROM session_learning_records WHERE session_id=?", [sessionId]));
}

function conflict() {
  return new ApiError(409, "RECORD_CONFLICT", "这份记录已有更新，请先读取最新版本再保存");
}

function repeatedSave(current, input) {
  return current?.last_mutation_id === input.mutationId &&
    Number(current.revision) === input.expectedRevision + 1 &&
    fields.every((field) => current[field] === input[field]);
}

export async function saveSessionLearningRecord(db, user, sessionId, input) {
  if (user.role !== "student") throw new ApiError(403, "ROLE_FORBIDDEN", "只有学生本人可以修改实验记录");
  const session = await accessibleSession(db, user, sessionId);
  if (session.status !== "active") throw new ApiError(409, "SESSION_COMPLETED", "已完成的实验记录只能查看");
  const current = await db.get("SELECT * FROM session_learning_records WHERE session_id=?", [sessionId]);
  if (repeatedSave(current, input)) return envelope(session, current);
  if ((Number(current?.revision) || 0) !== input.expectedRevision || current?.last_mutation_id === input.mutationId) throw conflict();

  const now = new Date().toISOString();
  const values = fields.map((field) => input[field]);
  // Both statements compare the revision in SQL, so concurrent requests cannot
  // both replace the same version. RETURNING reports exactly the row saved here.
  const saved = current
    ? await db.get(`UPDATE session_learning_records SET prediction=?, measurements=?, conclusion=?, question=?,
        revision=revision+1, last_mutation_id=?, updated_at=?
        WHERE session_id=? AND revision=? AND session_id IN (SELECT id FROM sessions WHERE status='active')
        RETURNING *`, [...values, input.mutationId, now, sessionId, input.expectedRevision])
    : await db.get(`INSERT INTO session_learning_records
        (session_id, learner_id, prediction, measurements, conclusion, question, revision, last_mutation_id, updated_at)
        SELECT id, learner_id, ?, ?, ?, ?, 1, ?, ? FROM sessions WHERE id=? AND status='active'
        ON CONFLICT (session_id) DO NOTHING RETURNING *`, [...values, input.mutationId, now, sessionId]);
  if (saved && repeatedSave(saved, input)) return envelope(session, saved);

  // Another request may have saved the same mutation while this one awaited SQL.
  const latestSession = await accessibleSession(db, user, sessionId);
  if (latestSession.status !== "active") throw new ApiError(409, "SESSION_COMPLETED", "已完成的实验记录只能查看");
  const latest = await db.get("SELECT * FROM session_learning_records WHERE session_id=?", [sessionId]);
  if (repeatedSave(latest, input)) return envelope(latestSession, latest);
  throw conflict();
}

export async function listTaskLearningRecords(db, user, taskId) {
  if (!["teacher", "admin"].includes(user.role)) throw new ApiError(403, "ROLE_FORBIDDEN", "只有负责班级的教师或管理员可以查看任务记录");
  const task = await db.get(`SELECT t.id, c.created_by class_owner FROM tasks t JOIN classes c ON c.id=t.class_id
    WHERE t.id=? AND t.school_id=? AND c.school_id=?`, [taskId, user.schoolId, user.schoolId]);
  if (!task) throw new ApiError(404, "TASK_NOT_FOUND", "没有找到这个教学任务");
  if (user.role === "teacher" && task.class_owner !== user.id) throw new ApiError(403, "RECORD_FORBIDDEN", "只能查看自己负责班级的任务记录");
  const sessions = await db.all(`${sessionSelect} WHERE s.task_id=? AND s.school_id=? ORDER BY s.started_at DESC, s.id`, [taskId, user.schoolId]);
  const records = await db.all(`SELECT r.* FROM session_learning_records r JOIN sessions s ON s.id=r.session_id
    WHERE s.task_id=? AND s.school_id=?`, [taskId, user.schoolId]);
  const bySession = new Map(records.map((record) => [record.session_id, record]));
  return sessions.map((session) => envelope(session, bySession.get(session.id)));
}
