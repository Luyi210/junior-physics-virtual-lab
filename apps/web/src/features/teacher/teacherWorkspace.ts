import { expandedProtocols } from "../high-school/experiments/expandedProtocols";
import { classroomExperiments, getClassroomExperiment } from "@physics-lab/knowledge/classroom";
import { getHighSchoolExperiment, highSchoolDomains } from "@physics-lab/knowledge/high-school";

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
  stage: "junior" | "high-school";
  field: string;
  title: string;
  subtitle: string;
  path: string;
  formula: string;
  accent: string;
};

const juniorExperimentCatalog: Omit<ExperimentCatalogItem, "stage">[] = [
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

export const teacherStageLabels = { junior: "初中", "high-school": "高中" } as const;
const highSchoolFormulas: Record<string, string> = {
  "uniform-acceleration": "v = v₀ + at", "newton-second-law": "F合 = Ma", "projectile-motion": "x = v₀t",
  pendulum: "T² ≈ 4π²L/g", "emf-internal-resistance": "U = E − Ir", "double-slit": "Δx ≈ λL/d", "spring-force": "F = k(L − L₀)", "force-composition": "F⃗合 = F⃗₁ + F⃗₂", "mechanical-energy": "ΔK 与 mgΔh 对照", "capacitor-charge": "τ = RC；断路保持电压"
};
export const teacherExperimentCatalog: ExperimentCatalogItem[] = [
  ...juniorExperimentCatalog.map((item) => ({ ...item, stage: "junior" as const, path: getClassroomExperiment(item.id)?.path ?? item.path })),
  ...classroomExperiments.filter((item) => item.stage === "high-school").flatMap((item): ExperimentCatalogItem[] => {
    const experiment = getHighSchoolExperiment(item.id);
    return experiment?.status === "ready" ? [{ id: item.id, stage: "high-school", title: item.title,
      field: highSchoolDomains.find((domain) => domain.id === experiment.domain)?.name ?? "高中物理",
      subtitle: experiment.learningGoal, path: item.path, formula: highSchoolFormulas[item.id] ?? expandedProtocols[item.id]?.formula ?? "比较变量与证据", accent: "#85c5a4" }] : [];
  })
];

export type TeacherLessonDefaults = Pick<TeacherLesson, "title" | "objective" | "inquiryQuestion"> &
  Required<Pick<TeacherLesson, "predictionPrompt" | "controlledVariable" | "evidenceRequirement" | "reflectionPrompt">>;

const highSchoolLessonPrompts: Record<string, Pick<TeacherLessonDefaults, "inquiryQuestion" | "predictionPrompt" | "controlledVariable" | "evidenceRequirement">> = {
  "capacitor-charge": {
    inquiryQuestion: "为什么断开回路后电压仍可保持？接电源和经电阻放电的快慢怎样随R、C变化？",
    predictionPrompt: "预测切换瞬间电容电压和电流是否突变，以及固定C时增大R怎样改变快慢；区分断路与暂停仿真。",
    controlledVariable: "同一轮固定R、C、E，从零电压接电源。默认R=10 kΩ、C=470 μF、E=6 V，τ=4.7 s；在0、1、2 s各保存一次，再断路观察保持，之后经R放电。只改变R的对照须重新开始，保持C、E和零初始电压相同；切换模式延续电压，数值调参重开一轮。",
    evidenceRequirement: "同一运行、同一充或放电段至少保存3个不同时刻，保留完整开关过程与当时条件；以ln(|U−U∞|/1V)对段内时间作带截距拟合，接电源U∞=E、放电U∞=0，斜率估计−1/τ。断路及初始已平衡的段不能估τ；另保存断路前后U、I，解释I=0但U可非零。不混合不同段，不将模型拟合称为实体实测，也不以条数判完成；当前没有独立手动电表读数工具。"
  },
  "mechanical-energy": {
    inquiryQuestion: "怎样由纸带六个位置求A、B两点的速度，再比较重力势能减少量和动能增加量？",
    predictionPrompt: "分别预测阻力比r=0与r>0时两种能量变化的关系；选取的A点已有速度，为什么不能把B点动能直接当作动能增加量？",
    controlledVariable: "同次纸带固定质量、释放高度及恒定阻力比，虚拟同步从静止释放，采样间隔固定0.02 s。先用默认条件播放至所需邻点出现，选内部A、B且B>A；共享同一点的读数须一致，各不同点位置须严格递增。另组只改变阻力比r，不能将其称为真实空气阻力。",
    evidenceRequirement: "独立输入A−1、A、A+1、B−1、B、B+1六个位置（mm）并保存点号、时刻和参数；用v=(x后−x前)/(2Δt)分别求vA、vB，以ΔK=½m(vB²−vA²)对照mg(xB−xA)，保留差值与读数限制。自动关系另存同条件至少3个不同时刻，分析从释放起的K—ΔEp；不得用模型答案回填手动位置或把两种来源混成实测。"
  },
  "uniform-acceleration": {
    inquiryQuestion: "如何由位置和时间记录求区间平均速度，再用速度—时间图像判断加速度？",
    predictionPrompt: "固定初速度与加速度，预测相同时间间隔内的位置变化是否相同；说明加速度改变时图像斜率怎样变化。",
    controlledVariable: "同一组固定初速度、加速度和总时长，按相同时间间隔记录；另做一组时只改变加速度，不把不同条件混成同一条拟合线。",
    evidenceRequirement: "同一组至少保存4个不同时刻的位置与时间，分析相邻区间平均速度及区间中点时刻；区分它与直接采样的模型瞬时速度。"
  },
  "newton-second-law": {
    inquiryQuestion: "怎样分别检验系统加速度与合外力、系统总质量倒数的关系？",
    predictionPrompt: "分别预测总质量不变时增大合外力，以及合外力不变时增大总质量，加速度怎样变化。",
    controlledVariable: "力关系组固定小车与挂码总质量、阻力和行程，在小车与挂码间转移质量；质量倒数组固定挂码质量、阻力和行程，只改变小车质量。研究对象始终是小车与挂码整体。",
    evidenceRequirement: "两组各保存至少3个不同横坐标的条件，分别分析a—F合与a—1/M；M包含小车和挂码，并核对挂码重力大于阻力、系统能够启动。"
  },
  "projectile-motion": {
    inquiryQuestion: "平抛运动的水平位移与时间、竖直下落距离与时间平方分别有什么关系？",
    predictionPrompt: "预测相同高度、不同水平初速度的落地时间是否相同，并分别描述水平和竖直方向的运动。",
    controlledVariable: "把抛射角设为0°；同一轨迹固定非零初速度和正的释放高度，改变采样时刻。比较两次平抛时固定高度，只改变水平初速度；g固定。",
    evidenceRequirement: "同一轨迹至少保存3个不同的落地前时刻，记录坐标并分析x—t、下落距离—t²；下落距离是释放高度减当前高度，不直接使用当前高度代替。"
  },
  pendulum: {
    inquiryQuestion: "小摆角时周期平方与摆长有什么关系？多周期虚拟计时如何估计周期？",
    predictionPrompt: "保持小摆角，预测摆长增加时周期如何变化；说明一个完整周期与半周期的区别。",
    controlledVariable: "比较摆长时保持初始摆角不超过10°、摆球质量和g不变；摆长从悬点量到球心。手动计时时保持这一轮参数，起止取同一位置、同一方向。",
    evidenceRequirement: "自动模型采样至少取3个不同摆长，分析T²—L；若使用虚拟秒表，另存起止时间和自行数出的完整周期数，不能把模型周期当作手动读数，也不与自动采样混为一组。"
  },
  "emf-internal-resistance": {
    inquiryQuestion: "改变外接负载时，端电压与电流如何变化？怎样由U—I图估计电动势和内阻？",
    predictionPrompt: "预测减小负载电阻后电流与端电压的变化，并区分电动势与端电压。",
    controlledVariable: "固定同一电源的电动势和内阻，只改变外接负载电阻。当前采用理想电表，不能操作或假定已加入电表内阻误差。",
    evidenceRequirement: "至少保存3个不同负载点的U、I及负载条件，横轴I、纵轴U；用截距估计E、斜率的负值估计r，说明理想电表假设。"
  },
  "double-slit": {
    inquiryQuestion: "条纹间距怎样随屏距变化？如何从两条亮纹中心和间隔数估计波长？",
    predictionPrompt: "固定波长和缝间距，预测屏距增大时条纹间距的变化；先区分亮纹条数与亮纹之间的间隔数。",
    controlledVariable: "自动关系组固定波长和缝间距，只改变屏距；虚拟读尺每轮固定波长、缝距和屏距，自行定位两条亮纹中心并填写相邻间隔数。",
    evidenceRequirement: "自动模型采样至少取3个不同屏距，分析条纹间距—屏距；虚拟手动读尺另存A/B坐标和间隔数、缝距与屏距，注明mm、m、nm换算及近轴条件，不用已知波长回填读数。"
  },
  "force-composition": {
    inquiryQuestion: "两个共点力怎样合成为一个等效力？等效力与平衡力的方向有什么区别？",
    predictionPrompt: "先预测同向、垂直、反向时的合力，再独立调整试配力的大小和方向；合力为零时不指定方向。",
    controlledVariable: "关系组固定F₁=3 N、F₂=4 N及F₁方向，只改变F₂方向，使夹角依次为0°、60°、90°、120°、180°。预设不替学生调整试配力。",
    evidenceRequirement: "保存至少3个不同cosθ条件的模型读数及原始六项参数，保留自己试配的力和残差；分析R²—cosθ的斜率2F₁F₂与截距F₁²+F₂²。0.05 N仅为教学比较阈值；模型一致性不等于橡皮条或测力计的实测验证。"
  },
  "spring-force": {
    inquiryQuestion: "固定同一弹簧，弹力与伸长量有什么关系？总长为什么不能直接代替伸长量？",
    predictionPrompt: "先预测增加含托盘的总悬挂质量后，总长和伸长量如何变化；说明零载荷时的长度。",
    controlledVariable: "固定劲度系数和原长，只改变含托盘的总悬挂质量；g固定为9.8 m/s²，调参后直接取理想静态平衡。",
    evidenceRequirement: "先设0 g记录原长，再设置50、100、150 g保存自动模型读数：总质量、原长、总长、伸长量和弹力；核对g转kg，以F—伸长量拟合k，截距不强制为0。可比较同条件加载和卸载；当前没有手动读尺。"
  }
};

/** Defaults are used only when creating a new lesson; stored lessons are never rewritten. */
export function teacherLessonDefaults(experiment: ExperimentCatalogItem): TeacherLessonDefaults {
  const catalog = experiment.stage === "high-school" ? getHighSchoolExperiment(experiment.id) : undefined;
  const expanded = expandedProtocols[experiment.id];
  const prompts = catalog && (highSchoolLessonPrompts[experiment.id] ?? (expanded ? { inquiryQuestion: expanded.inquiryQuestion, predictionPrompt: expanded.predictionPrompt, controlledVariable: expanded.controlledVariable, evidenceRequirement: expanded.evidenceRequirement } : undefined));
  if (catalog && prompts) return {
    title: `${experiment.title}探究课`, objective: `${catalog.learningGoal} 本课使用虚拟实验，模型采样与虚拟手动读数分别标注，不称为实体器材实测。`,
    ...prompts,
    evidenceRequirement: `${prompts.evidenceRequirement} 目录证据：${catalog.evidence.join("；")}。本机记录需经学生核对后加入课堂档案，保存到账号才供教师查看。`,
    reflectionPrompt: `哪些证据支持或反驳预测？结合以下条件说明模型与实物的差别：${catalog.assumptions.join("；")}。`
  };
  return { title: `${experiment.title}探究课`, objective: "通过改变一个关键变量、记录多组现象，用自己的证据形成物理解释。",
    inquiryQuestion: `改变实验条件时，${experiment.title}中的关键现象会怎样变化？`, predictionPrompt: "操作前写下预测，并说明判断依据。",
    controlledVariable: "固定其他条件，每轮只改变一个关键变量。", evidenceRequirement: "记录至少三组可比较的数据或现象，并注明实验条件。",
    reflectionPrompt: "换一个情境或设置反例，形成的解释仍然成立吗？" };
}

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
