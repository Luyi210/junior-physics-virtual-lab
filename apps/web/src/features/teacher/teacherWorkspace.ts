export type TeacherClass = {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
  joinCode: string;
  color: string;
};

export type LessonStatus = "draft" | "ready" | "completed";

export type TeacherLesson = {
  id: string;
  title: string;
  experimentId: string;
  classId: string;
  duration: number;
  objective: string;
  inquiryQuestion: string;
  predictionPrompt?: string;
  controlledVariable?: string;
  evidenceRequirement?: string;
  reflectionPrompt?: string;
  status: LessonStatus;
  scheduledAt: string;
};

export type LearnerState = "exploring" | "recording" | "thinking" | "offline";

export type LiveLearner = {
  id: string;
  name: string;
  state: LearnerState;
  stage: string;
  progress: number;
  observations: number;
};

export type ClassroomPrompt = {
  id: string;
  text: string;
  createdAt: string;
};

export type TeacherLiveSession = {
  id: string;
  lessonId: string;
  classId: string;
  status: "running" | "paused";
  startedAt: string;
  learners: LiveLearner[];
  prompts: ClassroomPrompt[];
};

export type TeacherReport = {
  id: string;
  lessonTitle: string;
  className: string;
  createdAt: string;
  participationRate: number;
  observationCount: number;
  averageProgress: number;
  evidence: string[];
  followUp: string;
};

export type TeacherWorkspace = {
  version: 1;
  teacherName: string;
  classes: TeacherClass[];
  lessons: TeacherLesson[];
  liveSession: TeacherLiveSession | null;
  reports: TeacherReport[];
};

export type ExperimentCatalogItem = {
  id: string;
  field: string;
  title: string;
  subtitle: string;
  path: string;
  formula: string;
  accent: string;
};

export const teacherExperimentCatalog: ExperimentCatalogItem[] = [
  { id: "light", field: "光学", title: "光的反射与折射", subtitle: "改变入射角，比较两种传播规律", path: "/student/explore/light", formula: "∠i = ∠r", accent: "#78ddff" },
  { id: "lens", field: "光学", title: "凸透镜成像", subtitle: "移动物距，寻找清晰像与规律", path: "/lab/lens", formula: "1/f = 1/u + 1/v", accent: "#8ca7ff" },
  { id: "mechanics", field: "力学", title: "力与运动", subtitle: "控制变量，观察运动状态变化", path: "/student/explore/mechanics", formula: "F = ma", accent: "#55e5c1" },
  { id: "circuit", field: "电学", title: "串并联电路", subtitle: "搭建电路，读取电压与电流", path: "/student/explore/circuit", formula: "U = IR", accent: "#ffd36a" },
  { id: "sound", field: "声学", title: "声音的特性", subtitle: "调节振幅与频率，对照波形", path: "/student/explore/sound", formula: "v = fλ", accent: "#ef8dff" },
  { id: "thermal", field: "热学", title: "物态变化", subtitle: "记录温度，分析加热曲线", path: "/student/explore/thermal", formula: "Q = cmΔt", accent: "#ff9d87" },
  { id: "measurement", field: "测量", title: "质量与密度", subtitle: "组合天平与量筒形成测量证据", path: "/student/explore/measurement", formula: "ρ = m/V", accent: "#b99aff" },
  { id: "reflection", field: "光学", title: "光的反射定律", subtitle: "测量入射角与反射角，验证光路", path: "/student/explore/light?mode=reflection", formula: "∠i = ∠r", accent: "#72def4" },
  { id: "sound-medium", field: "声学", title: "声音的产生与传播", subtitle: "区分声源振动与传播介质", path: "/student/explore/sound?module=sound-medium", formula: "真空不能传声", accent: "#72bfff" },
  { id: "sound-features", field: "声学", title: "响度、音调与音色", subtitle: "对照振幅、频率和波形变化", path: "/student/explore/sound?module=sound-features", formula: "音调 ↔ 频率", accent: "#9c8cff" },
  { id: "mechanics-speed", field: "力学", title: "运动与速度", subtitle: "统一单位，公平比较运动快慢", path: "/student/explore/mechanics?module=mechanics-speed", formula: "v = s/t", accent: "#55d8c0" },
  { id: "mechanics-friction", field: "力学", title: "滑动摩擦力", subtitle: "控制压力和接触面粗糙程度", path: "/student/explore/mechanics?module=mechanics-friction", formula: "匀速时 F拉 = f", accent: "#e8b75f" },
  { id: "mechanics-lever", field: "力学", title: "杠杆平衡", subtitle: "改变力和力臂，比较转动效果", path: "/student/explore/mechanics?module=mechanics-lever", formula: "F₁l₁ = F₂l₂", accent: "#f2c667" },
  { id: "mechanics-buoyancy", field: "力学", title: "浮力与浮沉", subtitle: "比较浮力、重力和液体密度", path: "/student/explore/mechanics?module=mechanics-buoyancy", formula: "F浮 与 G", accent: "#5cd1df" },
  { id: "circuit-basic", field: "电学", title: "串联与并联电路", subtitle: "追踪闭合路径和支路关系", path: "/student/explore/circuit?module=circuit-basic", formula: "串联一条路", accent: "#ffb66f" },
  { id: "circuit-ohm", field: "电学", title: "欧姆定律", subtitle: "两轮控制变量实验建立定量关系", path: "/student/explore/circuit?module=circuit-ohm", formula: "I = U/R", accent: "#ff8d76" },
  { id: "circuit-power", field: "电学", title: "电功率与电能", subtitle: "从仪表和铭牌读取用电快慢", path: "/student/explore/circuit?module=circuit-power", formula: "P = UI", accent: "#ffc96b" },
  { id: "circuit-magnet", field: "电磁", title: "电磁铁", subtitle: "比较电流、匝数和铁芯的作用", path: "/student/explore/circuit?module=circuit-magnet", formula: "电流产生磁场", accent: "#aa91ff" },
  { id: "thermal-boiling", field: "热学", title: "水的沸腾", subtitle: "同步记录温度曲线和物态现象", path: "/student/explore/thermal?module=thermal-boiling", formula: "沸腾持续吸热", accent: "#ff9278" },
  { id: "thermal-evaporation", field: "热学", title: "蒸发与蒸发降温", subtitle: "比较温度和空气流动的影响", path: "/student/explore/thermal?module=thermal-evaporation", formula: "蒸发吸热", accent: "#ffad7b" },
  { id: "measurement-density", field: "测量", title: "不规则固体密度", subtitle: "用天平和排水法完成组合测量", path: "/student/explore/measurement?module=measurement-density", formula: "ρ = m/V", accent: "#b292ff" }
];

const STORAGE_KEY = "physics-lab-v2-teacher-workspace";

const learnerNames = ["陈一诺", "王子墨", "林书言", "周予安", "许星遥", "宋知远", "江雨桐", "沈嘉树", "叶可欣", "顾言川", "苏小满", "唐亦辰"];

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeLearners(): LiveLearner[] {
  const states: LearnerState[] = ["exploring", "recording", "thinking", "exploring", "recording", "exploring", "thinking", "exploring", "recording", "exploring", "offline", "thinking"];
  return learnerNames.map((name, index) => ({
    id: `learner-${index + 1}`,
    name,
    state: states[index],
    stage: index % 3 === 0 ? "调整变量" : index % 3 === 1 ? "记录现象" : "形成解释",
    progress: 38 + ((index * 7) % 57),
    observations: index % 4
  }));
}

export function createDefaultTeacherWorkspace(): TeacherWorkspace {
  return {
    version: 1,
    teacherName: "物理教师",
    classes: [
      { id: "class-801", name: "八年级（1）班", grade: "八年级", studentCount: 42, joinCode: "PHY801", color: "#78ddff" },
      { id: "class-802", name: "八年级（2）班", grade: "八年级", studentCount: 40, joinCode: "PHY802", color: "#8ca7ff" },
      { id: "class-901", name: "九年级（1）班", grade: "九年级", studentCount: 38, joinCode: "PHY901", color: "#55e5c1" }
    ],
    lessons: [
      {
        id: "lesson-reflection",
        title: "镜面反射：角度之间藏着什么规律？",
        experimentId: "light",
        classId: "class-801",
        duration: 40,
        objective: "通过改变入射角并记录数据，自主归纳反射角与入射角的关系。",
        inquiryQuestion: "当入射光线逐渐贴近镜面，反射光线会怎样变化？",
        predictionPrompt: "先画出你预测的反射光线方向，并说明理由。",
        controlledVariable: "固定镜面和光源位置，每次只改变入射角。",
        evidenceRequirement: "至少记录三组入射角和反射角，并比较两者关系。",
        reflectionPrompt: "如果从反方向射入，原来的光路是否仍然成立？",
        status: "ready",
        scheduledAt: "今天 14:20"
      },
      {
        id: "lesson-circuit",
        title: "串联电路中的电流处处相等吗？",
        experimentId: "circuit",
        classId: "class-802",
        duration: 35,
        objective: "在多个测量点读取电流，使用证据判断串联电路电流规律。",
        inquiryQuestion: "换一个测量位置，电流表读数会改变吗？",
        predictionPrompt: "画出串联电路中你认为电流最大的测量位置。",
        controlledVariable: "保持电源与用电器不变，只改变电流表位置。",
        evidenceRequirement: "记录三个位置的电流表示数，注明单位与量程。",
        reflectionPrompt: "如果再串联一个灯泡，各点电流关系会改变吗？",
        status: "draft",
        scheduledAt: "周三 10:10"
      }
    ],
    liveSession: null,
    reports: [
      {
        id: "report-lens-demo",
        lessonTitle: "凸透镜成像规律探究",
        className: "九年级（1）班",
        createdAt: "08月08日 15:18",
        participationRate: 97,
        observationCount: 86,
        averageProgress: 82,
        evidence: ["31 名学生完成三组以上物距记录", "多数学生能区分实像与虚像", "8 条记录提到像距随物距变化的趋势"],
        followUp: "下一课先用两组反例澄清“像越大越清晰”的混淆，再进入公式表达。"
      }
    ]
  };
}

export function loadTeacherWorkspace(): TeacherWorkspace {
  if (typeof window === "undefined") return createDefaultTeacherWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultTeacherWorkspace();
    const parsed = JSON.parse(raw) as TeacherWorkspace;
    return parsed.version === 1 ? parsed : createDefaultTeacherWorkspace();
  } catch {
    return createDefaultTeacherWorkspace();
  }
}

export function saveTeacherWorkspace(workspace: TeacherWorkspace) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export function createTeacherClass(input: Pick<TeacherClass, "name" | "grade" | "studentCount">): TeacherClass {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const colors = ["#78ddff", "#8ca7ff", "#55e5c1", "#ffd36a"];
  return { ...input, id: id("class"), joinCode: `PHY${suffix}`, color: colors[Math.floor(Math.random() * colors.length)] };
}

export function createTeacherLesson(input: Omit<TeacherLesson, "id" | "status">): TeacherLesson {
  return { ...input, id: id("lesson"), status: "ready" };
}

export function createLiveSession(lesson: TeacherLesson): TeacherLiveSession {
  return {
    id: id("session"),
    lessonId: lesson.id,
    classId: lesson.classId,
    status: "running",
    startedAt: new Date().toISOString(),
    learners: makeLearners(),
    prompts: []
  };
}

export function createClassReport(workspace: TeacherWorkspace, session: TeacherLiveSession): TeacherReport {
  const lesson = workspace.lessons.find((item) => item.id === session.lessonId);
  const classItem = workspace.classes.find((item) => item.id === session.classId);
  const online = session.learners.filter((learner) => learner.state !== "offline");
  const averageProgress = Math.round(online.reduce((sum, learner) => sum + learner.progress, 0) / Math.max(online.length, 1));
  return {
    id: id("report"),
    lessonTitle: lesson?.title ?? "未命名探究课",
    className: classItem?.name ?? "未分配班级",
    createdAt: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()),
    participationRate: Math.round((online.length / Math.max(session.learners.length, 1)) * 100),
    observationCount: session.learners.reduce((sum, learner) => sum + learner.observations, 0),
    averageProgress,
    evidence: [
      `${online.length} 名学生进入实验并产生操作轨迹`,
      `${session.learners.filter((learner) => learner.observations > 0).length} 名学生留下观察记录`,
      `课堂发布了 ${session.prompts.length} 条追问提示`
    ],
    followUp: averageProgress >= 75 ? "多数学生已形成初步规律，建议下一课增加迁移情境验证解释。" : "建议保留关键变量设置，下一课先进行对照演示与小组复盘。"
  };
}
