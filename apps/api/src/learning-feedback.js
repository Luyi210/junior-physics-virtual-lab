import { randomUUID } from "node:crypto";
import { LEARNING_FEEDBACK_BODY_LIMIT } from "@physics-lab/contracts";
import { ApiError } from "./http.js";

export function validateLearningFeedback(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !["body", "expectedRevision", "mutationId"].includes(key))) {
    throw new ApiError(422, "VALIDATION_ERROR", "反馈必须是仅包含正文、报告版本和操作编号的 JSON 对象");
  }
  if (typeof input.body !== "string" || !input.body.trim() || input.body.length > LEARNING_FEEDBACK_BODY_LIMIT) {
    throw new ApiError(422, "VALIDATION_ERROR", `反馈正文不能为空，且不能超过 ${LEARNING_FEEDBACK_BODY_LIMIT} 个字符`);
  }
  if (input.body.includes("\u0000") || !input.body.isWellFormed()) {
    throw new ApiError(422, "VALIDATION_ERROR", "反馈正文不能包含空字符或不完整的 Unicode 字符");
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new ApiError(422, "VALIDATION_ERROR", "expectedRevision 必须是至少为 1 的安全整数");
  }
  if (typeof input.mutationId !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(input.mutationId)) {
    throw new ApiError(422, "VALIDATION_ERROR", "mutationId 必须是 1 到 160 位字母、数字或 . _ : - 标识");
  }
  // Keep exactly what the author submitted, including intentional whitespace.
  // The JS UTF-16 limit is intentionally at least as strict as SQL length(text).
  return { body: input.body, expectedRevision: input.expectedRevision, mutationId: input.mutationId };
}

function mapFeedback(row) {
  return {
    id: row.id, schoolId: row.school_id, classId: row.class_id, taskId: row.task_id,
    sessionId: row.session_id, learnerId: row.learner_id, authorId: row.author_id,
    authorName: row.author_name, authorRole: row.author_role, body: row.body,
    reportRevision: Number(row.report_revision), reportUpdatedAt: row.report_updated_at,
    reportSnapshot: { prediction: row.report_prediction, measurements: row.report_measurements,
      conclusion: row.report_conclusion, question: row.report_question },
    mutationId: row.mutation_id, createdAt: row.created_at
  };
}

const sessionFrom = `FROM sessions s
  JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id
  JOIN tasks t ON t.id=s.task_id AND t.class_id=s.class_id AND t.school_id=s.school_id
  JOIN users learner ON learner.id=s.learner_id AND learner.school_id=s.school_id`;

async function accessibleSession(db, user, sessionId) {
  const row = await db.get(`SELECT s.*, c.created_by class_owner ${sessionFrom}
    WHERE s.id=? AND s.school_id=?`, [sessionId, user.schoolId]);
  if (!row) throw new ApiError(404, "SESSION_NOT_FOUND", "没有找到这个实验会话");
  if ((user.role === "student" && row.learner_id === user.id) ||
      (user.role === "teacher" && row.class_owner === user.id) || user.role === "admin") return row;
  throw new ApiError(403, "FEEDBACK_FORBIDDEN", "只能查看本人或所负责班级的报告反馈");
}

export async function listSessionLearningFeedback(db, user, sessionId) {
  await accessibleSession(db, user, sessionId);
  return (await db.all(`SELECT * FROM session_learning_feedback
    WHERE session_id=? AND school_id=? ORDER BY created_at, id`, [sessionId, user.schoolId])).map(mapFeedback);
}

function repeatedFeedback(row, input) {
  if (row.body !== input.body || Number(row.report_revision) !== input.expectedRevision) {
    throw new ApiError(409, "FEEDBACK_CONFLICT", "此反馈操作编号已用于不同正文或报告版本，请核对原反馈");
  }
  return mapFeedback(row);
}

export async function createSessionLearningFeedback(db, user, sessionId, input) {
  if (!["teacher", "admin"].includes(user.role)) {
    throw new ApiError(403, "ROLE_FORBIDDEN", "只有负责班级的教师或管理员可以提交反馈");
  }
  await accessibleSession(db, user, sessionId);
  const mutationParams = [sessionId, user.id, input.mutationId];
  const previous = await db.get(`SELECT * FROM session_learning_feedback
    WHERE session_id=? AND author_id=? AND mutation_id=?`, mutationParams);
  if (previous) return repeatedFeedback(previous, input);

  // One atomic statement captures both report revision and all four fields from
  // a consistent database snapshot. No await spans a SQLite transaction on the
  // shared connection. Recheck ownership and the current author inside SQL;
  // the preflight reads above only provide useful errors/idempotent retries.
  const saved = await db.get(`INSERT INTO session_learning_feedback
    (id, school_id, class_id, task_id, session_id, learner_id, author_id, author_name, author_role,
     body, report_revision, report_updated_at, report_prediction, report_measurements,
     report_conclusion, report_question, mutation_id, created_at)
    SELECT ? AS id, s.school_id, s.class_id, s.task_id, s.id AS session_id, s.learner_id,
      author.id AS author_id, author.name AS author_name, author.role AS author_role,
      ? AS body, r.revision AS report_revision, r.updated_at AS report_updated_at,
      r.prediction AS report_prediction, r.measurements AS report_measurements,
      r.conclusion AS report_conclusion, r.question AS report_question, ? AS mutation_id, ? AS created_at
    ${sessionFrom}
    JOIN session_learning_records r ON r.session_id=s.id AND r.learner_id=s.learner_id
    JOIN users author ON author.id=? AND author.school_id=s.school_id
    WHERE s.id=? AND s.school_id=? AND r.revision=CAST(? AS BIGINT) AND author.status='active'
      AND author.role=? AND (author.role='admin' OR (author.role='teacher' AND c.created_by=author.id))
    ON CONFLICT (author_id, session_id, mutation_id) DO NOTHING RETURNING *`,
  [randomUUID(), input.body, input.mutationId, new Date().toISOString(),
    user.id, sessionId, user.schoolId, input.expectedRevision, user.role]);
  if (saved) return repeatedFeedback(saved, input);

  // A competing identical request may have won, or the report/permission changed
  // while this request awaited SQL. Old successful mutations remain retryable
  // after later student revisions, but can never be reused for different text.
  await accessibleSession(db, user, sessionId);
  const author = await db.get("SELECT school_id, role, status FROM users WHERE id=?", [user.id]);
  if (!author || author.school_id !== user.schoolId || author.role !== user.role || author.status !== "active") {
    throw new ApiError(401, "AUTH_INVALID", "登录身份已经失效");
  }
  const existing = await db.get(`SELECT * FROM session_learning_feedback
    WHERE session_id=? AND author_id=? AND mutation_id=?`, mutationParams);
  if (existing) return repeatedFeedback(existing, input);
  if (!await db.get("SELECT session_id FROM session_learning_records WHERE session_id=?", [sessionId])) {
    throw new ApiError(409, "RECORD_REQUIRED", "学生尚未保存报告，暂时不能提交报告反馈");
  }
  throw new ApiError(409, "RECORD_CONFLICT", "学生报告已有更新，请重新阅读最新版本后再提交反馈");
}
