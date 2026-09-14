import { randomUUID } from "node:crypto";
import { ApiError } from "./http.js";
import { hashPassword } from "./security.js";

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    schoolId: row.school_id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status ?? "active",
    lastLoginAt: row.last_login_at ?? null,
    classIds: Array.isArray(row.class_ids) ? row.class_ids : typeof row.class_ids === "string" && row.class_ids ? row.class_ids.split(",") : [],
    classNames: Array.isArray(row.class_names) ? row.class_names : typeof row.class_names === "string" && row.class_names ? row.class_names.split("|") : [],
    createdAt: row.created_at
  };
}

function mapClass(row) {
  return { id: row.id, schoolId: row.school_id, name: row.name, grade: row.grade, joinCode: row.join_code, createdBy: row.created_by, createdAt: row.created_at, studentCount: Number(row.student_count ?? 0) };
}

function mapLesson(row) {
  return {
    id: row.id, schoolId: row.school_id, createdBy: row.created_by, experimentId: row.experiment_id, title: row.title,
    objective: row.objective, inquiryQuestion: row.inquiry_question, predictionPrompt: row.prediction_prompt,
    controlledVariable: row.controlled_variable, evidenceRequirement: row.evidence_requirement, reflectionPrompt: row.reflection_prompt,
    durationMinutes: row.duration_minutes, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function mapTask(row) {
  return { id: row.id, schoolId: row.school_id, classId: row.class_id, lessonId: row.lesson_id, title: row.title, mode: row.mode, status: row.status, opensAt: row.opens_at, dueAt: row.due_at, allowRetry: Boolean(row.allow_retry), createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, className: row.class_name, lessonTitle: row.lesson_title, experimentId: row.experiment_id };
}

export async function findUserForLogin(db, email) {
  return db.get("SELECT * FROM users WHERE lower(email) = lower(?)", [email]);
}

export async function findUser(db, id) {
  return mapUser(await db.get("SELECT * FROM users WHERE id = ?", [id]));
}

export async function recordUserLogin(db, id) {
  await db.run("UPDATE users SET last_login_at=? WHERE id=?", [new Date().toISOString(), id]);
  return findUser(db, id);
}

export async function listUsers(db, user, role) {
  const select = `SELECT u.*, c.id class_id, c.name class_name
    FROM users u
    LEFT JOIN class_members cm ON cm.user_id=u.id
    LEFT JOIN classes c ON c.id=cm.class_id`;
  const rows = await db.all(
    role ? `${select} WHERE u.school_id=? AND u.role=? ORDER BY u.name, c.name` : `${select} WHERE u.school_id=? ORDER BY u.role, u.name, c.name`,
    role ? [user.schoolId, role] : [user.schoolId]
  );
  const users = new Map();
  for (const row of rows) {
    if (!users.has(row.id)) users.set(row.id, { ...row, class_ids: [], class_names: [] });
    if (row.class_id) users.get(row.id).class_ids.push(row.class_id);
    if (row.class_name) users.get(row.id).class_names.push(row.class_name);
  }
  return [...users.values()].map(mapUser);
}

export async function createManagedAccount(db, user, input) {
  if (input.role === "teacher" && user.role !== "admin") throw new ApiError(403, "TEACHER_CREATE_FORBIDDEN", "只有平台管理员可以创建教师账号");
  if (!['teacher', 'student'].includes(input.role)) throw new ApiError(422, "ROLE_INVALID", "只能创建教师或学生账号");
  const existing = await db.get("SELECT id FROM users WHERE lower(email)=lower(?)", [input.email]);
  if (existing) throw new ApiError(409, "EMAIL_EXISTS", "这个邮箱已经存在账号");
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run("INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, user.schoolId, input.email, hashPassword(input.password), input.name, input.role, now]);
  return findUser(db, id);
}

async function findManagedAccount(db, user, userId) {
  const account = await db.get("SELECT * FROM users WHERE id=? AND school_id=?", [userId, user.schoolId]);
  if (!account || !["teacher", "student"].includes(account.role)) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "没有找到可管理的教师或学生账号");
  if (user.role !== "admin" && account.role !== "student") throw new ApiError(403, "ACCOUNT_MANAGE_FORBIDDEN", "教师只能管理学生账号");
  return account;
}

export async function updateManagedAccountStatus(db, user, userId, status) {
  await findManagedAccount(db, user, userId);
  await db.run("UPDATE users SET status=? WHERE id=?", [status, userId]);
  return findUser(db, userId);
}

export async function resetManagedAccountPassword(db, user, userId, password) {
  await findManagedAccount(db, user, userId);
  await db.run("UPDATE users SET password_hash=? WHERE id=?", [hashPassword(password), userId]);
  return { userId, resetAt: new Date().toISOString() };
}

export async function listClasses(db, user) {
  const where = user.role === "student" ? "c.school_id = ? AND EXISTS (SELECT 1 FROM class_members cm2 WHERE cm2.class_id = c.id AND cm2.user_id = ?)" : "c.school_id = ?";
  const params = user.role === "student" ? [user.schoolId, user.id] : [user.schoolId];
  const [classes, counts] = await Promise.all([
    db.all(`SELECT c.* FROM classes c WHERE ${where} ORDER BY c.created_at DESC`, params),
    db.all("SELECT cm.class_id, COUNT(*) AS student_count FROM class_members cm JOIN classes c ON c.id = cm.class_id WHERE c.school_id = ? GROUP BY cm.class_id", [user.schoolId])
  ]);
  const countByClass = new Map(counts.map((row) => [row.class_id, row.student_count]));
  return classes.map((row) => mapClass({ ...row, student_count: countByClass.get(row.id) ?? 0 }));
}

export async function getClass(db, id, schoolId) {
  const row = await db.get("SELECT * FROM classes WHERE id = ? AND school_id = ?", [id, schoolId]);
  if (!row) throw new ApiError(404, "CLASS_NOT_FOUND", "没有找到这个班级");
  const count = await db.get("SELECT COUNT(*) AS student_count FROM class_members WHERE class_id = ?", [id]);
  const classItem = mapClass({ ...row, student_count: count?.student_count ?? 0 });
  const members = (await db.all("SELECT u.id, u.name, u.email, u.role, cm.joined_at FROM class_members cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? ORDER BY u.name", [id])).map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role, joinedAt: member.joined_at }));
  return { ...classItem, members };
}

export async function createClass(db, user, input) {
  const id = randomUUID();
  const joinCode = `PHY${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  await db.run("INSERT INTO classes (id, school_id, name, grade, join_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, user.schoolId, input.name, input.grade, joinCode, user.id, now]);
  return getClass(db, id, user.schoolId);
}

export async function addClassMember(db, classId, schoolId, email) {
  await getClass(db, classId, schoolId);
  const member = await db.get("SELECT id, school_id, email, name, role FROM users WHERE lower(email) = lower(?) AND school_id = ? AND role = 'student'", [email, schoolId]);
  if (!member) throw new ApiError(404, "STUDENT_NOT_FOUND", "没有找到这个学校中的学生账号");
  await db.run("INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [classId, member.id, new Date().toISOString()]);
  return { id: member.id, name: member.name, email: member.email, role: member.role };
}

export async function removeClassMember(db, classId, schoolId, userId) {
  await getClass(db, classId, schoolId);
  const member = await db.get("SELECT id FROM users WHERE id=? AND school_id=? AND role='student'", [userId, schoolId]);
  if (!member) throw new ApiError(404, "STUDENT_NOT_FOUND", "没有找到这个学校中的学生账号");
  const result = await db.run("DELETE FROM class_members WHERE class_id=? AND user_id=?", [classId, userId]);
  if (!result.changes) throw new ApiError(404, "MEMBER_NOT_FOUND", "这名学生不在该班级中");
  return { classId, userId, removed: true };
}

export async function listLessons(db, user) {
  return (await db.all("SELECT * FROM lessons WHERE school_id = ? ORDER BY updated_at DESC", [user.schoolId])).map(mapLesson);
}

export async function createLesson(db, user, input) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(`INSERT INTO lessons (id, school_id, created_by, experiment_id, title, objective, inquiry_question, prediction_prompt, controlled_variable, evidence_requirement, reflection_prompt, duration_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user.schoolId, user.id, input.experimentId, input.title, input.objective, input.inquiryQuestion, input.predictionPrompt, input.controlledVariable, input.evidenceRequirement, input.reflectionPrompt, input.durationMinutes, input.status, now, now]);
  return mapLesson(await db.get("SELECT * FROM lessons WHERE id = ?", [id]));
}

export async function listTasks(db, user, classId) {
  const rows = user.role === "student"
    ? await db.all(`SELECT t.*, c.name class_name, l.title lesson_title, l.experiment_id FROM tasks t JOIN classes c ON c.id=t.class_id JOIN lessons l ON l.id=t.lesson_id JOIN class_members cm ON cm.class_id=t.class_id WHERE t.school_id=? AND cm.user_id=? AND t.status='published' AND (? IS NULL OR t.class_id=?) ORDER BY t.updated_at DESC`, [user.schoolId, user.id, classId, classId])
    : await db.all(`SELECT t.*, c.name class_name, l.title lesson_title, l.experiment_id FROM tasks t JOIN classes c ON c.id=t.class_id JOIN lessons l ON l.id=t.lesson_id WHERE t.school_id=? AND (? IS NULL OR t.class_id=?) ORDER BY t.updated_at DESC`, [user.schoolId, classId, classId]);
  return rows.map(mapTask);
}

export async function createTask(db, user, input) {
  await getClass(db, input.classId, user.schoolId);
  const lesson = await db.get("SELECT id FROM lessons WHERE id=? AND school_id=?", [input.lessonId, user.schoolId]);
  if (!lesson) throw new ApiError(404, "LESSON_NOT_FOUND", "没有找到这份课例");
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(`INSERT INTO tasks (id, school_id, class_id, lesson_id, title, mode, status, opens_at, due_at, allow_retry, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, user.schoolId, input.classId, input.lessonId, input.title, input.mode, input.status, input.opensAt, input.dueAt, input.allowRetry ? 1 : 0, user.id, now, now]);
  return (await listTasks(db, user, input.classId)).find((item) => item.id === id);
}

export async function updateTaskStatus(db, user, taskId, status) {
  const result = await db.run("UPDATE tasks SET status=?, updated_at=? WHERE id=? AND school_id=?", [status, new Date().toISOString(), taskId, user.schoolId]);
  if (!result.changes) throw new ApiError(404, "TASK_NOT_FOUND", "没有找到这个教学任务");
  return (await listTasks(db, user, null)).find((item) => item.id === taskId);
}

export async function getStudentTaskLesson(db, user, taskId) {
  const row = await db.get(`SELECT l.title, l.objective, l.inquiry_question, l.prediction_prompt, l.controlled_variable, l.evidence_requirement, l.reflection_prompt
    FROM tasks t JOIN lessons l ON l.id=t.lesson_id JOIN class_members cm ON cm.class_id=t.class_id
    WHERE t.id=? AND t.school_id=? AND t.status='published' AND cm.user_id=?`, [taskId, user.schoolId, user.id]);
  if (!row) throw new ApiError(404, "TASK_NOT_AVAILABLE", "没有找到属于当前学生的已发布任务");
  return { title: row.title, objective: row.objective, inquiryQuestion: row.inquiry_question, predictionPrompt: row.prediction_prompt, controlledVariable: row.controlled_variable, evidenceRequirement: row.evidence_requirement, reflectionPrompt: row.reflection_prompt };
}

export async function createSession(db, user, input) {
  const task = await db.get("SELECT t.*, l.experiment_id FROM tasks t JOIN lessons l ON l.id=t.lesson_id JOIN class_members cm ON cm.class_id=t.class_id WHERE t.id=? AND t.school_id=? AND t.status='published' AND cm.user_id=?", [input.taskId, user.schoolId, user.id]);
  if (!task) throw new ApiError(403, "TASK_NOT_AVAILABLE", "这个任务未发布或不属于当前学生");
  const nowMs = Date.now();
  if (task.opens_at && new Date(task.opens_at).getTime() > nowMs) throw new ApiError(403, "TASK_NOT_OPEN", "这个实验任务还没有开放");
  if (task.due_at && new Date(task.due_at).getTime() < nowMs) throw new ApiError(403, "TASK_EXPIRED", "这个实验任务已经截止");
  const existing = await db.get("SELECT * FROM sessions WHERE task_id=? AND learner_id=? AND status='active'", [input.taskId, user.id]);
  if (existing) return mapSession(existing);
  const completed = await db.get("SELECT id FROM sessions WHERE task_id=? AND learner_id=? AND status='completed' LIMIT 1", [input.taskId, user.id]);
  if (completed && !task.allow_retry) throw new ApiError(409, "TASK_ALREADY_COMPLETED", "这个任务已经完成，教师未开启重复探究");
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run("INSERT INTO sessions (id, school_id, task_id, class_id, learner_id, experiment_id, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)", [id, user.schoolId, input.taskId, task.class_id, user.id, task.experiment_id, now, now]);
  return mapSession(await db.get("SELECT * FROM sessions WHERE id=?", [id]));
}

function mapSession(row) {
  return { id: row.id, schoolId: row.school_id, taskId: row.task_id, classId: row.class_id, learnerId: row.learner_id, experimentId: row.experiment_id, status: row.status, startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at };
}

export async function listStudentSessions(db, user) {
  return (await db.all(`SELECT s.*, t.title task_title, c.name class_name, l.title lesson_title,
    (SELECT COUNT(*) FROM session_events e WHERE e.session_id=s.id) event_count,
    (SELECT COUNT(*) FROM observations o WHERE o.session_id=s.id) observation_count
    FROM sessions s
    JOIN tasks t ON t.id=s.task_id
    JOIN classes c ON c.id=s.class_id
    JOIN lessons l ON l.id=t.lesson_id
    WHERE s.school_id=? AND s.learner_id=?
    ORDER BY s.updated_at DESC`, [user.schoolId, user.id])).map((row) => ({
      ...mapSession(row), taskTitle: row.task_title, className: row.class_name, lessonTitle: row.lesson_title,
      eventCount: Number(row.event_count), observationCount: Number(row.observation_count)
    }));
}

async function assertSessionAccess(db, sessionId, user) {
  const row = await db.get("SELECT * FROM sessions WHERE id=? AND school_id=?", [sessionId, user.schoolId]);
  if (!row) throw new ApiError(404, "SESSION_NOT_FOUND", "没有找到这个实验会话");
  if (user.role === "student" && row.learner_id !== user.id) throw new ApiError(403, "SESSION_FORBIDDEN", "不能修改其他学生的实验会话");
  return row;
}

export async function appendEvents(db, user, sessionId, events) {
  const session = await assertSessionAccess(db, sessionId, user);
  if (session.status !== "active") throw new ApiError(409, "SESSION_COMPLETED", "已完成的实验会话不能继续写入事件");
  await db.transaction(async (transaction) => {
    for (const event of events) {
      await transaction.run("INSERT INTO session_events (id, session_id, event_type, area, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING", [event.id || randomUUID(), sessionId, event.type, event.area, event.occurredAt, JSON.stringify(event.payload ?? {})]);
    }
    await transaction.run("UPDATE sessions SET updated_at=? WHERE id=?", [new Date().toISOString(), sessionId]);
  });
  return { accepted: events.length };
}

export async function addObservation(db, user, sessionId, text) {
  const session = await assertSessionAccess(db, sessionId, user);
  if (session.status !== "active") throw new ApiError(409, "SESSION_COMPLETED", "已完成的实验会话不能继续写入观察");
  const observation = { id: randomUUID(), sessionId, learnerId: user.id, text, createdAt: new Date().toISOString() };
  await db.run("INSERT INTO observations (id, session_id, learner_id, text, created_at) VALUES (?, ?, ?, ?, ?)", [observation.id, sessionId, user.id, text, observation.createdAt]);
  await db.run("UPDATE sessions SET updated_at=? WHERE id=?", [observation.createdAt, sessionId]);
  return observation;
}

export async function completeSession(db, user, sessionId) {
  await assertSessionAccess(db, sessionId, user);
  const now = new Date().toISOString();
  await db.run("UPDATE sessions SET status='completed', updated_at=?, completed_at=? WHERE id=?", [now, now, sessionId]);
  return mapSession(await db.get("SELECT * FROM sessions WHERE id=?", [sessionId]));
}

export async function addClassPrompt(db, user, classId, text) {
  await getClass(db, classId, user.schoolId);
  const prompt = { id: randomUUID(), classId, teacherId: user.id, text, createdAt: new Date().toISOString() };
  await db.run("INSERT INTO class_prompts (id, class_id, teacher_id, text, created_at) VALUES (?, ?, ?, ?, ?)", [prompt.id, classId, user.id, text, prompt.createdAt]);
  return prompt;
}

export async function getLiveClass(db, user, classId) {
  const classItem = await getClass(db, classId, user.schoolId);
  const sessions = (await db.all(`SELECT s.*, u.name learner_name,
    (SELECT COUNT(*) FROM session_events e WHERE e.session_id=s.id) event_count,
    (SELECT COUNT(*) FROM observations o WHERE o.session_id=s.id) observation_count
    FROM sessions s JOIN users u ON u.id=s.learner_id WHERE s.class_id=? AND s.status='active' ORDER BY s.updated_at DESC`, [classId])).map((row) => ({ ...mapSession(row), learnerName: row.learner_name, eventCount: Number(row.event_count), observationCount: Number(row.observation_count) }));
  const prompts = (await db.all("SELECT id, class_id, teacher_id, text, created_at FROM class_prompts WHERE class_id=? ORDER BY created_at DESC LIMIT 30", [classId])).map((row) => ({ id: row.id, classId: row.class_id, teacherId: row.teacher_id, text: row.text, createdAt: row.created_at }));
  return { class: classItem, sessions, prompts, generatedAt: new Date().toISOString() };
}

export async function getClassReport(db, user, classId) {
  const classItem = await getClass(db, classId, user.schoolId);
  const summary = await db.get(`SELECT COUNT(DISTINCT s.id) session_count, COUNT(DISTINCT s.learner_id) participant_count,
    COUNT(DISTINCT CASE WHEN s.status='completed' THEN s.id END) completed_count,
    COUNT(DISTINCT e.id) event_count, COUNT(DISTINCT o.id) observation_count
    FROM sessions s LEFT JOIN session_events e ON e.session_id=s.id LEFT JOIN observations o ON o.session_id=s.id WHERE s.class_id=?`, [classId]);
  const recentObservations = (await db.all("SELECT o.text, o.created_at, u.name learner_name FROM observations o JOIN sessions s ON s.id=o.session_id JOIN users u ON u.id=o.learner_id WHERE s.class_id=? ORDER BY o.created_at DESC LIMIT 20", [classId])).map((row) => ({ text: row.text, createdAt: row.created_at, learnerName: row.learner_name }));
  return { class: classItem, metrics: { sessions: Number(summary.session_count), participants: Number(summary.participant_count), completed: Number(summary.completed_count), events: Number(summary.event_count), observations: Number(summary.observation_count) }, recentObservations, generatedAt: new Date().toISOString(), boundary: "本报告只汇总实验过程证据，不自动生成学生能力排名。" };
}

export function decodeEventRows(rows) {
  return rows.map((row) => ({ ...row, payload: parseJson(row.payload_json) }));
}
