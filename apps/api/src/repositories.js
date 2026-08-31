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
    classIds: typeof row.class_ids === "string" && row.class_ids ? row.class_ids.split(",") : [],
    classNames: typeof row.class_names === "string" && row.class_names ? row.class_names.split("|") : [],
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

export function findUserForLogin(db, email) {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
}

export function findUser(db, id) {
  return mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

export function recordUserLogin(db, id) {
  db.prepare("UPDATE users SET last_login_at=? WHERE id=?").run(new Date().toISOString(), id);
  return findUser(db, id);
}

export function listUsers(db, user, role) {
  const select = `SELECT u.*, GROUP_CONCAT(c.id) class_ids, GROUP_CONCAT(c.name, '|') class_names
    FROM users u
    LEFT JOIN class_members cm ON cm.user_id=u.id
    LEFT JOIN classes c ON c.id=cm.class_id`;
  const rows = role
    ? db.prepare(`${select} WHERE u.school_id=? AND u.role=? GROUP BY u.id ORDER BY u.name`).all(user.schoolId, role)
    : db.prepare(`${select} WHERE u.school_id=? GROUP BY u.id ORDER BY u.role, u.name`).all(user.schoolId);
  return rows.map(mapUser);
}

export function createManagedAccount(db, user, input) {
  if (input.role === "teacher" && user.role !== "admin") throw new ApiError(403, "TEACHER_CREATE_FORBIDDEN", "只有平台管理员可以创建教师账号");
  if (!['teacher', 'student'].includes(input.role)) throw new ApiError(422, "ROLE_INVALID", "只能创建教师或学生账号");
  const existing = db.prepare("SELECT id FROM users WHERE lower(email)=lower(?)").get(input.email);
  if (existing) throw new ApiError(409, "EMAIL_EXISTS", "这个邮箱已经存在账号");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, user.schoolId, input.email, hashPassword(input.password), input.name, input.role, now);
  return findUser(db, id);
}

function findManagedAccount(db, user, userId) {
  const account = db.prepare("SELECT * FROM users WHERE id=? AND school_id=?").get(userId, user.schoolId);
  if (!account || !["teacher", "student"].includes(account.role)) throw new ApiError(404, "ACCOUNT_NOT_FOUND", "没有找到可管理的教师或学生账号");
  if (user.role !== "admin" && account.role !== "student") throw new ApiError(403, "ACCOUNT_MANAGE_FORBIDDEN", "教师只能管理学生账号");
  return account;
}

export function updateManagedAccountStatus(db, user, userId, status) {
  findManagedAccount(db, user, userId);
  db.prepare("UPDATE users SET status=? WHERE id=?").run(status, userId);
  return findUser(db, userId);
}

export function resetManagedAccountPassword(db, user, userId, password) {
  findManagedAccount(db, user, userId);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(password), userId);
  return { userId, resetAt: new Date().toISOString() };
}

export function listClasses(db, user) {
  const where = user.role === "student" ? "c.school_id = ? AND EXISTS (SELECT 1 FROM class_members cm2 WHERE cm2.class_id = c.id AND cm2.user_id = ?)" : "c.school_id = ?";
  const params = user.role === "student" ? [user.schoolId, user.id] : [user.schoolId];
  return db.prepare(`SELECT c.*, COUNT(cm.user_id) AS student_count FROM classes c LEFT JOIN class_members cm ON cm.class_id = c.id WHERE ${where} GROUP BY c.id ORDER BY c.created_at DESC`).all(...params).map(mapClass);
}

export function getClass(db, id, schoolId) {
  const row = db.prepare("SELECT c.*, COUNT(cm.user_id) AS student_count FROM classes c LEFT JOIN class_members cm ON cm.class_id = c.id WHERE c.id = ? AND c.school_id = ? GROUP BY c.id").get(id, schoolId);
  if (!row) throw new ApiError(404, "CLASS_NOT_FOUND", "没有找到这个班级");
  const classItem = mapClass(row);
  const members = db.prepare("SELECT u.id, u.name, u.email, u.role, cm.joined_at FROM class_members cm JOIN users u ON u.id = cm.user_id WHERE cm.class_id = ? ORDER BY u.name").all(id).map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role, joinedAt: member.joined_at }));
  return { ...classItem, members };
}

export function createClass(db, user, input) {
  const id = randomUUID();
  const joinCode = `PHY${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  db.prepare("INSERT INTO classes (id, school_id, name, grade, join_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, user.schoolId, input.name, input.grade, joinCode, user.id, now);
  return getClass(db, id, user.schoolId);
}

export function addClassMember(db, classId, schoolId, email) {
  getClass(db, classId, schoolId);
  const member = db.prepare("SELECT id, school_id, email, name, role FROM users WHERE lower(email) = lower(?) AND school_id = ? AND role = 'student'").get(email, schoolId);
  if (!member) throw new ApiError(404, "STUDENT_NOT_FOUND", "没有找到这个学校中的学生账号");
  db.prepare("INSERT OR IGNORE INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)").run(classId, member.id, new Date().toISOString());
  return { id: member.id, name: member.name, email: member.email, role: member.role };
}

export function removeClassMember(db, classId, schoolId, userId) {
  getClass(db, classId, schoolId);
  const member = db.prepare("SELECT id FROM users WHERE id=? AND school_id=? AND role='student'").get(userId, schoolId);
  if (!member) throw new ApiError(404, "STUDENT_NOT_FOUND", "没有找到这个学校中的学生账号");
  const result = db.prepare("DELETE FROM class_members WHERE class_id=? AND user_id=?").run(classId, userId);
  if (!result.changes) throw new ApiError(404, "MEMBER_NOT_FOUND", "这名学生不在该班级中");
  return { classId, userId, removed: true };
}

export function listLessons(db, user) {
  return db.prepare("SELECT * FROM lessons WHERE school_id = ? ORDER BY updated_at DESC").all(user.schoolId).map(mapLesson);
}

export function createLesson(db, user, input) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO lessons (id, school_id, created_by, experiment_id, title, objective, inquiry_question, prediction_prompt, controlled_variable, evidence_requirement, reflection_prompt, duration_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, user.schoolId, user.id, input.experimentId, input.title, input.objective, input.inquiryQuestion, input.predictionPrompt, input.controlledVariable, input.evidenceRequirement, input.reflectionPrompt, input.durationMinutes, input.status, now, now);
  return mapLesson(db.prepare("SELECT * FROM lessons WHERE id = ?").get(id));
}

export function listTasks(db, user, classId) {
  const rows = user.role === "student"
    ? db.prepare(`SELECT t.*, c.name class_name, l.title lesson_title, l.experiment_id FROM tasks t JOIN classes c ON c.id=t.class_id JOIN lessons l ON l.id=t.lesson_id JOIN class_members cm ON cm.class_id=t.class_id WHERE t.school_id=? AND cm.user_id=? AND t.status='published' AND (? IS NULL OR t.class_id=?) ORDER BY t.updated_at DESC`).all(user.schoolId, user.id, classId, classId)
    : db.prepare(`SELECT t.*, c.name class_name, l.title lesson_title, l.experiment_id FROM tasks t JOIN classes c ON c.id=t.class_id JOIN lessons l ON l.id=t.lesson_id WHERE t.school_id=? AND (? IS NULL OR t.class_id=?) ORDER BY t.updated_at DESC`).all(user.schoolId, classId, classId);
  return rows.map(mapTask);
}

export function createTask(db, user, input) {
  getClass(db, input.classId, user.schoolId);
  const lesson = db.prepare("SELECT id FROM lessons WHERE id=? AND school_id=?").get(input.lessonId, user.schoolId);
  if (!lesson) throw new ApiError(404, "LESSON_NOT_FOUND", "没有找到这份课例");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO tasks (id, school_id, class_id, lesson_id, title, mode, status, opens_at, due_at, allow_retry, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, user.schoolId, input.classId, input.lessonId, input.title, input.mode, input.status, input.opensAt, input.dueAt, input.allowRetry ? 1 : 0, user.id, now, now);
  return listTasks(db, user, input.classId).find((item) => item.id === id);
}

export function updateTaskStatus(db, user, taskId, status) {
  const result = db.prepare("UPDATE tasks SET status=?, updated_at=? WHERE id=? AND school_id=?").run(status, new Date().toISOString(), taskId, user.schoolId);
  if (!result.changes) throw new ApiError(404, "TASK_NOT_FOUND", "没有找到这个教学任务");
  return listTasks(db, user, null).find((item) => item.id === taskId);
}

export function getStudentTaskLesson(db, user, taskId) {
  const row = db.prepare(`SELECT l.title, l.objective, l.inquiry_question, l.prediction_prompt, l.controlled_variable, l.evidence_requirement, l.reflection_prompt
    FROM tasks t JOIN lessons l ON l.id=t.lesson_id JOIN class_members cm ON cm.class_id=t.class_id
    WHERE t.id=? AND t.school_id=? AND t.status='published' AND cm.user_id=?`).get(taskId, user.schoolId, user.id);
  if (!row) throw new ApiError(404, "TASK_NOT_AVAILABLE", "没有找到属于当前学生的已发布任务");
  return { title: row.title, objective: row.objective, inquiryQuestion: row.inquiry_question, predictionPrompt: row.prediction_prompt, controlledVariable: row.controlled_variable, evidenceRequirement: row.evidence_requirement, reflectionPrompt: row.reflection_prompt };
}

export function createSession(db, user, input) {
  const task = db.prepare("SELECT t.*, l.experiment_id FROM tasks t JOIN lessons l ON l.id=t.lesson_id JOIN class_members cm ON cm.class_id=t.class_id WHERE t.id=? AND t.school_id=? AND t.status='published' AND cm.user_id=?").get(input.taskId, user.schoolId, user.id);
  if (!task) throw new ApiError(403, "TASK_NOT_AVAILABLE", "这个任务未发布或不属于当前学生");
  const nowMs = Date.now();
  if (task.opens_at && new Date(task.opens_at).getTime() > nowMs) throw new ApiError(403, "TASK_NOT_OPEN", "这个实验任务还没有开放");
  if (task.due_at && new Date(task.due_at).getTime() < nowMs) throw new ApiError(403, "TASK_EXPIRED", "这个实验任务已经截止");
  const existing = db.prepare("SELECT * FROM sessions WHERE task_id=? AND learner_id=? AND status='active'").get(input.taskId, user.id);
  if (existing) return mapSession(existing);
  const completed = db.prepare("SELECT id FROM sessions WHERE task_id=? AND learner_id=? AND status='completed' LIMIT 1").get(input.taskId, user.id);
  if (completed && !task.allow_retry) throw new ApiError(409, "TASK_ALREADY_COMPLETED", "这个任务已经完成，教师未开启重复探究");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO sessions (id, school_id, task_id, class_id, learner_id, experiment_id, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)").run(id, user.schoolId, input.taskId, task.class_id, user.id, task.experiment_id, now, now);
  return mapSession(db.prepare("SELECT * FROM sessions WHERE id=?").get(id));
}

function mapSession(row) {
  return { id: row.id, schoolId: row.school_id, taskId: row.task_id, classId: row.class_id, learnerId: row.learner_id, experimentId: row.experiment_id, status: row.status, startedAt: row.started_at, updatedAt: row.updated_at, completedAt: row.completed_at };
}

export function listStudentSessions(db, user) {
  return db.prepare(`SELECT s.*, t.title task_title, c.name class_name, l.title lesson_title,
    (SELECT COUNT(*) FROM session_events e WHERE e.session_id=s.id) event_count,
    (SELECT COUNT(*) FROM observations o WHERE o.session_id=s.id) observation_count
    FROM sessions s
    JOIN tasks t ON t.id=s.task_id
    JOIN classes c ON c.id=s.class_id
    JOIN lessons l ON l.id=t.lesson_id
    WHERE s.school_id=? AND s.learner_id=?
    ORDER BY s.updated_at DESC`).all(user.schoolId, user.id).map((row) => ({
      ...mapSession(row), taskTitle: row.task_title, className: row.class_name, lessonTitle: row.lesson_title,
      eventCount: Number(row.event_count), observationCount: Number(row.observation_count)
    }));
}

function assertSessionAccess(db, sessionId, user) {
  const row = db.prepare("SELECT * FROM sessions WHERE id=? AND school_id=?").get(sessionId, user.schoolId);
  if (!row) throw new ApiError(404, "SESSION_NOT_FOUND", "没有找到这个实验会话");
  if (user.role === "student" && row.learner_id !== user.id) throw new ApiError(403, "SESSION_FORBIDDEN", "不能修改其他学生的实验会话");
  return row;
}

export function appendEvents(db, user, sessionId, events) {
  const session = assertSessionAccess(db, sessionId, user);
  if (session.status !== "active") throw new ApiError(409, "SESSION_COMPLETED", "已完成的实验会话不能继续写入事件");
  const insert = db.prepare("INSERT OR IGNORE INTO session_events (id, session_id, event_type, area, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?, ?)");
  db.exec("BEGIN");
  try {
    events.forEach((event) => insert.run(event.id || randomUUID(), sessionId, event.type, event.area, event.occurredAt, JSON.stringify(event.payload ?? {})));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  db.prepare("UPDATE sessions SET updated_at=? WHERE id=?").run(new Date().toISOString(), sessionId);
  return { accepted: events.length };
}

export function addObservation(db, user, sessionId, text) {
  const session = assertSessionAccess(db, sessionId, user);
  if (session.status !== "active") throw new ApiError(409, "SESSION_COMPLETED", "已完成的实验会话不能继续写入观察");
  const observation = { id: randomUUID(), sessionId, learnerId: user.id, text, createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO observations (id, session_id, learner_id, text, created_at) VALUES (?, ?, ?, ?, ?)").run(observation.id, sessionId, user.id, text, observation.createdAt);
  db.prepare("UPDATE sessions SET updated_at=? WHERE id=?").run(observation.createdAt, sessionId);
  return observation;
}

export function completeSession(db, user, sessionId) {
  assertSessionAccess(db, sessionId, user);
  const now = new Date().toISOString();
  db.prepare("UPDATE sessions SET status='completed', updated_at=?, completed_at=? WHERE id=?").run(now, now, sessionId);
  return mapSession(db.prepare("SELECT * FROM sessions WHERE id=?").get(sessionId));
}

export function addClassPrompt(db, user, classId, text) {
  getClass(db, classId, user.schoolId);
  const prompt = { id: randomUUID(), classId, teacherId: user.id, text, createdAt: new Date().toISOString() };
  db.prepare("INSERT INTO class_prompts (id, class_id, teacher_id, text, created_at) VALUES (?, ?, ?, ?, ?)").run(prompt.id, classId, user.id, text, prompt.createdAt);
  return prompt;
}

export function getLiveClass(db, user, classId) {
  const classItem = getClass(db, classId, user.schoolId);
  const sessions = db.prepare(`SELECT s.*, u.name learner_name,
    (SELECT COUNT(*) FROM session_events e WHERE e.session_id=s.id) event_count,
    (SELECT COUNT(*) FROM observations o WHERE o.session_id=s.id) observation_count
    FROM sessions s JOIN users u ON u.id=s.learner_id WHERE s.class_id=? AND s.status='active' ORDER BY s.updated_at DESC`).all(classId).map((row) => ({ ...mapSession(row), learnerName: row.learner_name, eventCount: Number(row.event_count), observationCount: Number(row.observation_count) }));
  const prompts = db.prepare("SELECT id, class_id, teacher_id, text, created_at FROM class_prompts WHERE class_id=? ORDER BY created_at DESC LIMIT 30").all(classId).map((row) => ({ id: row.id, classId: row.class_id, teacherId: row.teacher_id, text: row.text, createdAt: row.created_at }));
  return { class: classItem, sessions, prompts, generatedAt: new Date().toISOString() };
}

export function getClassReport(db, user, classId) {
  const classItem = getClass(db, classId, user.schoolId);
  const summary = db.prepare(`SELECT COUNT(DISTINCT s.id) session_count, COUNT(DISTINCT s.learner_id) participant_count,
    COUNT(DISTINCT CASE WHEN s.status='completed' THEN s.id END) completed_count,
    COUNT(DISTINCT e.id) event_count, COUNT(DISTINCT o.id) observation_count
    FROM sessions s LEFT JOIN session_events e ON e.session_id=s.id LEFT JOIN observations o ON o.session_id=s.id WHERE s.class_id=?`).get(classId);
  const recentObservations = db.prepare("SELECT o.text, o.created_at, u.name learner_name FROM observations o JOIN sessions s ON s.id=o.session_id JOIN users u ON u.id=o.learner_id WHERE s.class_id=? ORDER BY o.created_at DESC LIMIT 20").all(classId).map((row) => ({ text: row.text, createdAt: row.created_at, learnerName: row.learner_name }));
  return { class: classItem, metrics: { sessions: Number(summary.session_count), participants: Number(summary.participant_count), completed: Number(summary.completed_count), events: Number(summary.event_count), observations: Number(summary.observation_count) }, recentObservations, generatedAt: new Date().toISOString(), boundary: "本报告只汇总实验过程证据，不自动生成学生能力排名。" };
}

export function decodeEventRows(rows) {
  return rows.map((row) => ({ ...row, payload: parseJson(row.payload_json) }));
}
