import { ApiError, optionalString, requiredEnum, requiredString } from "./http.js";

const VALID_SCOPES = ["junior", "high-school"];
const VALID_KINDS = ["misconception", "goal", "strength", "preference"];
const MAX_MEMORIES_PER_SCOPE = 48;

function normalizeMemoryId(scope, kind, topic) {
  const key = `${scope}:${kind}:${topic.trim().toLowerCase()}`;
  return `mem-${key.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/giu, "-").slice(0, 96)}`;
}

function mapRow(row) {
  return {
    id: row.id,
    scope: row.scope,
    experimentId: row.experiment_id ?? null,
    kind: row.kind,
    topic: row.topic,
    summary: row.summary,
    evidenceCount: Number(row.evidence_count ?? 1),
    updatedAt: row.updated_at
  };
}

export function validateLearnerMemoryDraft(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(422, "VALIDATION_ERROR", "学习记忆格式不正确");
  }
  return {
    scope: requiredEnum(body, "scope", VALID_SCOPES),
    experimentId: optionalString(body, "experimentId", { max: 80 }),
    kind: requiredEnum(body, "kind", VALID_KINDS),
    topic: requiredString(body, "topic", { max: 120 }),
    summary: requiredString(body, "summary", { max: 600 })
  };
}

export async function listLearnerMemories(db, user, scope = null) {
  if (scope && !VALID_SCOPES.includes(scope)) {
    throw new ApiError(422, "VALIDATION_ERROR", "scope 参数无效");
  }
  const rows = scope
    ? await db.all(
      `SELECT id, scope, experiment_id, kind, topic, summary, evidence_count, updated_at
       FROM learner_memories
       WHERE school_id = ? AND learner_id = ? AND scope = ?
       ORDER BY updated_at DESC
       LIMIT 48`,
      [user.schoolId, user.id, scope]
    )
    : await db.all(
      `SELECT id, scope, experiment_id, kind, topic, summary, evidence_count, updated_at
       FROM learner_memories
       WHERE school_id = ? AND learner_id = ?
       ORDER BY updated_at DESC
       LIMIT 48`,
      [user.schoolId, user.id]
    );
  return rows.map(mapRow);
}

export async function upsertLearnerMemory(db, user, draft) {
  const now = new Date().toISOString();
  const id = normalizeMemoryId(draft.scope, draft.kind, draft.topic);
  const existing = await db.get(
    "SELECT id, evidence_count FROM learner_memories WHERE id = ? AND school_id = ? AND learner_id = ?",
    [id, user.schoolId, user.id]
  );
  if (existing) {
    const nextCount = Number(existing.evidence_count ?? 1) + 1;
    await db.run(
      `UPDATE learner_memories
       SET experiment_id = COALESCE(?, experiment_id), summary = ?, evidence_count = ?, updated_at = ?
       WHERE id = ? AND school_id = ? AND learner_id = ?`,
      [draft.experimentId ?? null, draft.summary, nextCount, now, id, user.schoolId, user.id]
    );
  } else {
    const usage = await db.get(
      "SELECT COUNT(*) AS count FROM learner_memories WHERE school_id = ? AND learner_id = ? AND scope = ?",
      [user.schoolId, user.id, draft.scope]
    );
    if (Number(usage?.count ?? 0) >= MAX_MEMORIES_PER_SCOPE) {
      throw new ApiError(422, "MEMORY_LIMIT", "本类学习记忆已达上限，请先删除不需要的条目");
    }
    await db.run(
      `INSERT INTO learner_memories (id, school_id, learner_id, scope, experiment_id, kind, topic, summary, evidence_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, user.schoolId, user.id, draft.scope, draft.experimentId ?? null, draft.kind, draft.topic, draft.summary, now, now]
    );
  }
  const saved = await db.get(
    `SELECT id, scope, experiment_id, kind, topic, summary, evidence_count, updated_at
     FROM learner_memories
     WHERE id = ? AND school_id = ? AND learner_id = ?`,
    [id, user.schoolId, user.id]
  );
  return mapRow(saved);
}

export async function deleteLearnerMemory(db, user, memoryId) {
  const result = await db.run(
    "DELETE FROM learner_memories WHERE id = ? AND school_id = ? AND learner_id = ?",
    [memoryId, user.schoolId, user.id]
  );
  if (!result.changes) {
    throw new ApiError(404, "MEMORY_NOT_FOUND", "未找到对应的学习记忆");
  }
  return { deleted: true, id: memoryId };
}
