import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { hashPassword } from "./security.js";
import { countInvalidDatabaseIdentities, initializationResult, planDatabaseInitialization } from "./database-initialization.js";

const schema = `
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
    last_login_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS class_members (
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY(class_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    experiment_id TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    inquiry_question TEXT NOT NULL,
    prediction_prompt TEXT,
    controlled_variable TEXT,
    evidence_requirement TEXT,
    reflection_prompt TEXT,
    duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('draft','ready','archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    lesson_id TEXT NOT NULL REFERENCES lessons(id),
    title TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('before-class','in-class','after-class')),
    status TEXT NOT NULL CHECK(status IN ('draft','published','closed','archived')),
    opens_at TEXT,
    due_at TEXT,
    allow_retry INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    task_id TEXT NOT NULL REFERENCES tasks(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    learner_id TEXT NOT NULL REFERENCES users(id),
    experiment_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active','completed')),
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS session_learning_records (
    session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id),
    prediction TEXT NOT NULL,
    measurements TEXT NOT NULL,
    conclusion TEXT NOT NULL,
    question TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK(revision > 0),
    last_mutation_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session_learning_feedback (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id),
    class_id TEXT NOT NULL REFERENCES classes(id),
    task_id TEXT NOT NULL REFERENCES tasks(id),
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id),
    author_id TEXT NOT NULL REFERENCES users(id),
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL CHECK(author_role IN ('teacher','admin')),
    body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000),
    report_revision INTEGER NOT NULL CHECK(report_revision > 0),
    report_updated_at TEXT NOT NULL,
    report_prediction TEXT NOT NULL,
    report_measurements TEXT NOT NULL,
    report_conclusion TEXT NOT NULL,
    report_question TEXT NOT NULL,
    mutation_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(author_id, session_id, mutation_id)
  );

  CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    area TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    learner_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS class_prompts (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id TEXT NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON class_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_lessons_school ON lessons(school_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_class ON tasks(class_id, status);
  CREATE INDEX IF NOT EXISTS idx_sessions_class_status ON sessions(class_id, status);
  CREATE INDEX IF NOT EXISTS idx_feedback_session ON session_learning_feedback(session_id, created_at, id);
  CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id, occurred_at);
  CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(session_id, created_at);
`;

function migrateDatabase(db) {
  const userColumns = new Set(db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
  if (!userColumns.has("status")) db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled'))");
  if (!userColumns.has("last_login_at")) db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
}

function initializeDatabase(db, plan) {
  const now = new Date().toISOString();
  const insertSchool = db.prepare("INSERT INTO schools (id, name, created_at) VALUES (?, ?, ?)");
  const insertUser = db.prepare("INSERT INTO users (id, school_id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");

  if (plan.mode === "bootstrap") {
    insertSchool.run("school-primary", plan.schoolName, now);
    insertUser.run("user-admin", "school-primary", plan.adminEmail, hashPassword(plan.adminPassword), plan.adminName, "admin", now);
    return;
  }

  insertSchool.run("school-demo", "未来物理实验学校", now);

  insertUser.run("user-admin", "school-demo", "admin@physics.local", hashPassword("Admin123!"), "学校管理员", "admin", now);
  insertUser.run("user-teacher", "school-demo", "teacher@physics.local", hashPassword("Teacher123!"), "李老师", "teacher", now);
  const demoStudents = ["陈一诺", "王子墨", "林书言", "周予安", "许星遥", "宋知远", "江雨桐", "沈嘉树", "叶可欣", "顾言川"];
  const insertStudent = db.prepare(`INSERT INTO users (id, school_id, email, password_hash, name, role, created_at)
    VALUES (?, 'school-demo', ?, ?, ?, 'student', ?)`);
  demoStudents.forEach((name, index) => {
    const number = index + 1;
    insertStudent.run(`user-student-${number}`, `student${String(number).padStart(2, "0")}@physics.local`, hashPassword("Student123!"), name, now);
  });

  const insertClass = db.prepare("INSERT INTO classes (id, school_id, name, grade, join_code, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertClass.run("class-801", "school-demo", "八年级（1）班", "八年级", "PHY801", "user-teacher", now);
  const insertMember = db.prepare("INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)");
  demoStudents.forEach((_, index) => insertMember.run("class-801", `user-student-${index + 1}`, now));

  const insertLesson = db.prepare(`INSERT INTO lessons
    (id, school_id, created_by, experiment_id, title, objective, inquiry_question, prediction_prompt, controlled_variable, evidence_requirement, reflection_prompt, duration_minutes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const seededLessons = [
    ["lesson-reflection", "reflection", "镜面反射：角度之间藏着什么规律？", "通过改变入射角并记录数据，自主归纳反射规律。", "当入射光线逐渐贴近镜面，反射光线会怎样变化？", "先画出预测的反射光线方向。", "固定镜面位置，每次只改变入射角。", "记录至少三组入射角与反射角。", "反向入射时原光路是否仍然成立？", 40, "ready"],
    ["lesson-lens-image", "lens", "凸透镜成像：像的位置由什么决定？", "通过移动物体和光屏，建立物距、像距与成像性质的联系。", "物体从二倍焦距外逐渐靠近焦点，像会怎样移动和变化？", "先预测物体跨过二倍焦距时像的大小和位置。", "固定透镜焦距，每轮只改变物距并重新对焦。", "记录三组物距、像距、正倒与大小，并保存清晰像证据。", "如果物体进入焦点以内，光屏为什么接不到像？", 45, "ready"],
    ["lesson-sound-medium", "sound-medium", "声音传播：抽走空气后还能听见吗？", "区分声源振动和声音传播条件，用证据说明介质的作用。", "闹钟仍在振动时，玻璃罩中的空气越少，听到的声音为何越弱？", "预测空气保留程度与接收响度之间的关系。", "固定声源与接收距离，只改变罩内空气保留程度。", "记录至少四档空气条件下的响度指标和声源振动状态。", "月球表面两名航天员为什么不能直接交谈？", 35, "ready"],
    ["lesson-sound-features", "sound-features", "看波形辨声音：响度、音调与音色", "通过单独改变振幅和频率，建立波形特征与听觉特性的对应。", "波形变高和变密，分别意味着声音发生了什么变化？", "先在图中画出更响和更高音调的预测波形。", "先固定频率改变振幅，再固定振幅改变频率。", "保存两轮对照波形，并标注振幅、频率与听觉变化。", "频率相同的钢琴和小提琴为何听起来仍不一样？", 35, "ready"],
    ["lesson-motion-speed", "mechanics-speed", "光电门测速：高度怎样影响平均速度？", "固定光电门间路程，比较轨道高度对计时和平均速度的影响。", "路程不变，提高轨道高度后，小车通过时间和平均速度怎样变化？", "先预测路程不变时，提高高度会使平均速度增大、不变还是减小。", "固定同一小车与光电门间路程，只改变轨道高度至少0.1 m；每次装好两门、小车从静止释放。时间是测量结果，不能直接设定。", "保存同一路程的两组高度h、路程s、计时t和s/t，核对高度与速度变化方向；只改变路程不计高度证据。", "区间平均速度能否说明小车每一时刻都同样快？", 35, "ready"],
    ["lesson-friction", "mechanics-friction", "滑动摩擦：重一点还是粗一点影响更大？", "用控制变量法研究压力和接触面粗糙程度对滑动摩擦力的影响。", "木块更重或桌面更粗糙时，匀速拉动所需的力怎样变化？", "分别预测增大压力和增大粗糙程度的结果。", "保持匀速，每轮只改变压力或接触面粗糙程度。", "每种条件测量三次拉力，比较稳定示数并说明误差。", "自行车刹车和轴承润滑分别利用了哪条摩擦规律？", 40, "ready"],
    ["lesson-lever", "mechanics-lever", "杠杆平衡：小力怎样撬起重物？", "通过改变力和力臂，归纳杠杆平衡条件。", "动力变小时，动力作用点应向哪个方向移动才能保持平衡？", "先用转动效果预测杠杆会向哪一侧倾斜。", "固定阻力和阻力臂，每轮只改变动力臂。", "记录四组力与力臂，比较两侧乘积。", "为什么省力杠杆往往需要移动更长距离？", 40, "ready"],
    ["lesson-buoyancy", "mechanics-buoyancy", "称重法测浮力：更换液体后示数怎样变？", "用空气中与液中的测力计示数差求浮力，研究液体密度的影响。", "同一物体完全浸没且不碰底时，提高液体密度会怎样改变液中拉力？", "预测液中拉力F′和浮力G−F′的变化方向。", "保持同一物体完全浸没、静止且不碰底，每轮只改变液体密度。", "记录液体密度、空气中重力G、液中拉力F′和浮力G−F′；完成碰底误差演练。", "物体碰底后，为什么不能再把G−F′都当成浮力？", 40, "ready"],
    ["lesson-circuit-basic", "circuit-basic", "串联与并联：电流到底有几条路？", "通过搭建、断开和追踪路径，辨认串并联电路的结构特点。", "取下一只灯泡后，另一只灯泡能否继续发光取决于什么？", "分别预测串联和并联电路断开一个支路后的现象。", "保持电源和灯泡不变，只改变连接方式。", "画出两种电路图，记录断开前后各灯泡状态。", "家庭照明为什么通常采用并联而不是串联？", 40, "ready"],
    ["lesson-ohm", "circuit-ohm", "欧姆定律：电流怎样响应电压和电阻？", "通过两轮控制变量实验建立电流、电压和电阻的定量关系。", "保持电阻不变时增大电压，电流会按什么规律变化？", "先画出电流随电压变化的预测图像。", "第一轮固定电阻改变电压，第二轮固定电压改变电阻。", "每轮记录至少四组数据，绘图并检查 I、U、R 的关系。", "更换另一只电阻后，电流—电压图像的斜率为何改变？", 45, "ready"],
    ["lesson-electric-power", "circuit-power", "电功率与电能：两类对照怎样建立？", "固定同一用电器，分别研究电压对功率、时间对电能的影响。", "同一用电器改变电压或工作时间，实际功率和电能分别怎样变化？", "根据铭牌预测安全欠压时的功率，再预测同一电压下延长时间的耗电变化。", "同一用电器、同一时间下只改变安全电压至少1.5 V；同一用电器、同一电压下只改变时间至少10 s。电流是读数，不能独立设定；改动前断开开关。", "计时结束保存完成快照中的U、I、P、t、W，补齐两类对照；只换用电器不算完成。选择7.5 V只观察保护锁定，再恢复6 V或更低。", "功率较大的短时运行与功率较小的长时运行，哪组电能更多？这种双变量拓展为什么不能替代核心单变量对照？", 40, "ready"],
    ["lesson-electromagnet", "circuit-magnet", "电磁铁：怎样吸起更多铁钉？", "分别研究电流、线圈匝数和铁芯对电磁铁强弱的影响。", "增加线圈匝数和增大电流，哪一种变化更容易增强磁性？", "为两种增强方案分别作出预测。", "每轮只改变电流或匝数，保持铁芯和被吸物一致。", "用吸起铁钉数量记录至少三档条件下的磁性强弱。", "电磁起重机为什么能迅速吸起又放下钢铁？", 40, "ready"],
    ["lesson-boiling", "thermal-boiling", "水的沸腾：持续吸热为何不再升温？", "记录升温段与沸腾平台，比较同水量、同功率下气压对沸点的影响。", "水沸腾后继续加热，温度为何稳定；更换气压后平台又会怎样变化？", "画出从室温加热到沸腾后的预测曲线，再预测升高气压的影响。", "保持水量和加热功率不变，每轮只更换气压环境。", "保存升温点和相隔至少10秒的平台点，完成至少两种气压下的完整曲线对照。", "高原上水的沸点降低，会怎样影响煮熟食物的时间？", 40, "ready"],
    ["lesson-evaporation", "thermal-evaporation", "蒸发快慢：怎样让湿衣服干得更快？", "用定时称量分别比较温度、液面面积和空气流动对蒸发快慢的影响。", "升温、展开液面和加快空气流动，分别会怎样改变蒸发速率？", "分别预测改变三种因素后的失重和速率变化。", "统一使用50 g水样，每轮只改变温度、液面面积或空气流动之一。", "保存初末质量、失重与计时时长；同时间比较失重，不同时长换算平均g/min，补齐三因素对照。", "刚游泳上岸时有风为什么会感觉更冷？请区分本次称量证据与降温原理的解释。", 35, "ready"],
    ["lesson-density", "measurement-density", "不规则石块：体积和密度怎样测？", "综合使用天平和排水法测量不规则固体密度。", "不能用刻度尺直接计算体积的石块，怎样获得它的体积？", "先写出测量质量、体积和计算密度的操作顺序。", "天平测量和量筒读数使用同一石块，完全浸没且不触底。", "保存砝码、游码和两次液面读数，写出密度计算式。", "如果先测体积后测质量，石块表面的水会带来什么误差？", 45, "ready"]
  ];
  seededLessons.forEach(([id, experimentId, title, objective, inquiryQuestion, predictionPrompt, controlledVariable, evidenceRequirement, reflectionPrompt, durationMinutes, status]) => {
    insertLesson.run(id, "school-demo", "user-teacher", experimentId, title, objective, inquiryQuestion, predictionPrompt, controlledVariable, evidenceRequirement, reflectionPrompt, durationMinutes, status, now, now);
  });

  const insertTask = db.prepare(`INSERT INTO tasks
    (id, school_id, class_id, lesson_id, title, mode, status, opens_at, due_at, allow_retry, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const seededTasks = [
    ["task-reflection", "lesson-reflection", "光的反射课堂探究", "in-class", "published", 1],
    ["task-lens-preview", "lesson-lens-image", "凸透镜成像课前预测", "before-class", "published", 1],
    ["task-sound-medium", "lesson-sound-medium", "真空罩中的声音证据课", "in-class", "published", 1],
    ["task-sound-features", "lesson-sound-features", "声音波形辨识练习", "after-class", "draft", 1],
    ["task-speed-preview", "lesson-motion-speed", "运动快慢公平比较", "before-class", "published", 1],
    ["task-friction", "lesson-friction", "滑动摩擦控制变量实验", "in-class", "published", 1],
    ["task-lever-review", "lesson-lever", "杠杆平衡迁移挑战", "after-class", "closed", 0],
    ["task-buoyancy", "lesson-buoyancy", "物体浮沉课堂探究", "in-class", "published", 1],
    ["task-circuit-basic", "lesson-circuit-basic", "串并联电路搭建任务", "in-class", "published", 1],
    ["task-ohm", "lesson-ohm", "欧姆定律数据证据课", "in-class", "published", 1],
    ["task-electric-power", "lesson-electric-power", "家庭电器功率调查", "before-class", "draft", 1],
    ["task-electromagnet", "lesson-electromagnet", "自制电磁铁强弱探究", "in-class", "published", 1],
    ["task-boiling", "lesson-boiling", "水的沸腾曲线记录", "in-class", "published", 0],
    ["task-evaporation", "lesson-evaporation", "蒸发降温生活解释", "after-class", "published", 1],
    ["task-density", "lesson-density", "不规则石块密度测量", "in-class", "published", 1]
  ];
  seededTasks.forEach(([id, lessonId, title, mode, status, allowRetry]) => {
    insertTask.run(id, "school-demo", "class-801", lessonId, title, mode, status, status === "published" ? now : null, null, allowRetry, "user-teacher", now, now);
  });
}

function wrapSqlite(nativeDb) {
  return {
    dialect: "sqlite",
    async get(sql, params = []) { return nativeDb.prepare(sql).get(...params); },
    async all(sql, params = []) { return nativeDb.prepare(sql).all(...params); },
    async run(sql, params = []) { return nativeDb.prepare(sql).run(...params); },
    async exec(sql) { nativeDb.exec(sql); },
    async transaction(work) {
      nativeDb.exec("BEGIN");
      try {
        const result = await work(this);
        nativeDb.exec("COMMIT");
        return result;
      } catch (error) {
        nativeDb.exec("ROLLBACK");
        throw error;
      }
    },
    close() { nativeDb.close(); },
    native: nativeDb
  };
}

async function execInitializationLock(nativeDb, sql, deadline) {
  // Changing journal mode can return SQLITE_BUSY immediately even with a busy
  // handler installed. Retry only lock contention, sharing one bounded deadline
  // with BEGIN IMMEDIATE so another initializer can finish without an unbounded
  // startup wait. Schema and business data are still untouched at this point.
  while (true) {
    const remaining = Math.max(0, Math.ceil(deadline - performance.now()));
    nativeDb.exec(`PRAGMA busy_timeout = ${remaining}`);
    try { nativeDb.exec(sql); return; }
    catch (error) {
      if ((error.errcode & 0xff) !== 5 || performance.now() >= deadline) throw error;
      await delay(Math.min(25, Math.max(1, deadline - performance.now())));
    }
  }
}

export async function openDatabase(config) {
  if (config.databaseUrl) {
    const { openPostgresDatabase } = await import("./database-postgres.js");
    return openPostgresDatabase(config);
  }
  if (config.databasePath !== ":memory:") mkdirSync(dirname(config.databasePath), { recursive: true });
  const nativeDb = new DatabaseSync(config.databasePath);
  let transactionOpen = false;
  try {
    // Connection/journal settings must precede the transaction. A bounded busy
    // wait allows a different process to finish its first initialization.
    nativeDb.exec("PRAGMA foreign_keys = ON;");
    const deadline = performance.now() + 5000;
    await execInitializationLock(nativeDb, "PRAGMA journal_mode = WAL", deadline);
    await execInitializationLock(nativeDb, "BEGIN IMMEDIATE", deadline);
    transactionOpen = true;
    nativeDb.exec("PRAGMA busy_timeout = 5000");
    nativeDb.exec(schema);
    migrateDatabase(nativeDb);
    const state = {
      dialect: "sqlite",
      schoolCount: nativeDb.prepare("SELECT COUNT(*) AS total FROM schools").get().total,
      userCount: nativeDb.prepare("SELECT COUNT(*) AS total FROM users").get().total,
      orphanUserCount: nativeDb.prepare("SELECT COUNT(*) AS total FROM users u LEFT JOIN schools s ON s.id=u.school_id WHERE s.id IS NULL").get().total,
      invalidIdentityCount: countInvalidDatabaseIdentities(
        nativeDb.prepare("SELECT id FROM schools").all(),
        nativeDb.prepare("SELECT id, school_id FROM users").all()
      ),
      administrators: nativeDb.prepare("SELECT email, password_hash AS passwordHash FROM users WHERE role='admin'").all()
    };
    const plan = planDatabaseInitialization(state, config);
    if (plan.mode !== "existing") initializeDatabase(nativeDb, plan);
    const initialization = initializationResult(plan);
    nativeDb.exec("COMMIT");
    transactionOpen = false;
    return { ...wrapSqlite(nativeDb), initialization };
  } catch (error) {
    if (transactionOpen) { try { nativeDb.exec("ROLLBACK"); } catch { /* retain the original initialization failure */ } }
    try { nativeDb.close(); } catch { /* retain the original failure even if close also fails */ }
    throw error;
  }
}
