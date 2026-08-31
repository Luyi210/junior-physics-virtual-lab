export type TaskId = "reflection" | "bench" | "dispersion" | "correction";
export type PoeStage = "predict" | "observe" | "reconsider" | "explain" | "transfer" | "complete";

export interface PredictionOption {
  id: string;
  label: string;
  misconception?: string;
}

export interface ResearchTask {
  id: TaskId;
  index: string;
  title: string;
  subtitle: string;
  module: string;
  accent: "cyan" | "amber" | "violet" | "coral";
  predictionPrompt: string;
  predictionContext: string;
  predictionOptions: PredictionOption[];
  correctPrediction: string;
  claim: string;
  evidenceIndicators: string[];
  observationGoal: string;
  minimumTrials: number;
  evidencePrompt: string;
  transferPrompt: string;
  transferOptions: PredictionOption[];
  correctTransfer: string;
}

export interface LabTrial {
  id: string;
  createdAt: string;
  taskId: TaskId;
  summary: string;
  values: Record<string, string | number | boolean>;
}

export interface TaskProgress {
  stage: PoeStage;
  prediction?: string;
  predictionCorrect?: boolean;
  predictionReason: string;
  initialConfidence: number;
  observationConflict?: "match" | "conflict" | "uncertain";
  revisedPrediction?: string;
  revisedCorrect?: boolean;
  revisedConfidence?: number;
  revisionReason: string;
  predictionRevised?: boolean;
  trials: LabTrial[];
  explanation: string;
  evidenceScore: number;
  reasoningScore: number;
  transfer?: string;
  transferCorrect?: boolean;
  hintsUsed: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ResearchSession {
  schemaVersion: 1;
  participantId: string;
  startedAt: string;
  updatedAt: string;
  activeTask: TaskId;
  consented: boolean;
  tasks: Record<TaskId, TaskProgress>;
}

export const TASKS: ResearchTask[] = [
  {
    id: "reflection",
    index: "01",
    title: "反射定律",
    subtitle: "从法线出发测量角度",
    module: "reflection",
    accent: "cyan",
    predictionPrompt: "入射光线与镜面的夹角为 30°，入射角是多少？",
    predictionContext: "先独立判断。提交后再进入实验，不会立刻公布答案。",
    predictionOptions: [
      { id: "30", label: "30°", misconception: "把光线与镜面的夹角直接当成入射角" },
      { id: "60", label: "60°" },
      { id: "90", label: "90°", misconception: "忽略法线与镜面垂直的几何关系" }
    ],
    correctPrediction: "60",
    claim: "学生能够以法线为测角基准，并用多组数据支持反射角等于入射角。",
    evidenceIndicators: ["指出法线是测角基准", "形成三组不同入射角记录", "比较每组入射角与反射角", "迁移到漫反射的局部光路"],
    observationGoal: "至少记录三组不同入射角，比较入射角与反射角。",
    minimumTrials: 3,
    evidencePrompt: "根据三组读数，解释反射角与入射角的关系，并说明角度是相对谁测量的。",
    transferPrompt: "粗糙纸面发生漫反射时，每一束光是否仍遵守反射定律？",
    transferOptions: [
      { id: "yes", label: "仍然遵守" },
      { id: "no", label: "不再遵守", misconception: "认为漫反射没有局部法线和反射规律" },
      { id: "unknown", label: "只看亮暗无法判断" }
    ],
    correctTransfer: "yes"
  },
  {
    id: "bench",
    index: "02",
    title: "凸透镜成像",
    subtitle: "用光屏寻找真实像面",
    module: "bench",
    accent: "amber",
    predictionPrompt: "物距大于二倍焦距时，凸透镜通常形成什么像？",
    predictionContext: "选择后要用光具座找到清晰像，不能只背口诀。",
    predictionOptions: [
      { id: "real-small", label: "倒立、缩小的实像" },
      { id: "virtual-big", label: "正立、放大的虚像", misconception: "没有根据物距与焦距判断像的虚实" },
      { id: "anywhere", label: "光屏放哪里都能成清晰像", misconception: "认为光屏位置不影响清晰成像" }
    ],
    correctPrediction: "real-small",
    claim: "学生能够把光线实际会聚、像面位置和光屏作用联系起来，而不是只背成像口诀。",
    evidenceIndicators: ["物距跨越焦点与二倍焦距", "实像条件下重新寻找清晰像面", "区分光线会聚与光屏接收", "迁移解释相机对焦"],
    observationGoal: "记录至少三种物距，并为每一组重新寻找最清晰的光屏位置。",
    minimumTrials: 3,
    evidencePrompt: "比较物距跨越二倍焦距前后的成像结果，用物距、像距和像的性质说明规律。",
    transferPrompt: "相机从远景切换到近景后，为什么往往需要重新对焦？",
    transferOptions: [
      { id: "image-plane", label: "清晰像面位置发生变化" },
      { id: "brighter", label: "只因为近景更亮" },
      { id: "upright", label: "为了把倒像直接变正" }
    ],
    correctTransfer: "image-plane"
  },
  {
    id: "dispersion",
    index: "03",
    title: "三棱镜色散",
    subtitle: "追踪不同色光的落点",
    module: "dispersion",
    accent: "violet",
    predictionPrompt: "白光通过三棱镜后出现连续色带，最合理的解释是什么？",
    predictionContext: "随后可以切换白光与单色光，直接比较光屏证据。",
    predictionOptions: [
      { id: "separate", label: "白光中的不同成分被分开" },
      { id: "create", label: "三棱镜制造了新的颜色", misconception: "认为棱镜凭空制造颜色" },
      { id: "screen", label: "光屏自己给光着色", misconception: "混淆接收屏与色散元件的作用" }
    ],
    correctPrediction: "separate",
    claim: "学生能够依据单色光与复色光的光屏证据，解释色散是不同光成分的空间分离。",
    evidenceIndicators: ["比较白光和单色光", "读取不同颜色落点", "控制棱镜姿态或光屏距离", "否定棱镜制造颜色的解释"],
    observationGoal: "改变光源成分或光屏距离，形成至少两组可比较的色带记录。",
    minimumTrials: 2,
    evidencePrompt: "比较白光和红色单色光的光屏落点，说明三棱镜是否制造了颜色。",
    transferPrompt: "红色单色光通过三棱镜后通常会怎样？",
    transferOptions: [
      { id: "bend", label: "发生偏折，但不会形成完整连续色带" },
      { id: "rainbow", label: "仍形成完整彩虹" },
      { id: "straight", label: "一定完全不偏折" }
    ],
    correctTransfer: "bend"
  },
  {
    id: "correction",
    index: "04",
    title: "视力矫正",
    subtitle: "先诊断焦点，再选择镜片",
    module: "correction",
    accent: "coral",
    predictionPrompt: "近视眼看远处物体时，像落在视网膜前，应选择什么镜片矫正？",
    predictionContext: "先判断需要让入眼光线发散还是会聚，再选择镜片。",
    predictionOptions: [
      { id: "concave", label: "凹透镜" },
      { id: "convex", label: "凸透镜", misconception: "认为近视应使用凸透镜矫正" },
      { id: "plane", label: "平面玻璃" }
    ],
    correctPrediction: "concave",
    claim: "学生能够先诊断未矫正焦点位置，再依据镜片对光线的作用选择矫正镜片。",
    evidenceIndicators: ["读取无镜片焦点位置", "分别尝试凹透镜与凸透镜", "比较焦点相对视网膜的位置", "迁移判断远视矫正"],
    observationGoal: "分别尝试无镜片、凹透镜和凸透镜，比较焦点相对视网膜的位置。",
    minimumTrials: 3,
    evidencePrompt: "根据焦点落点，解释凹透镜为什么能够矫正近视。",
    transferPrompt: "远视眼的焦点落在视网膜后，通常需要哪种镜片？",
    transferOptions: [
      { id: "convex", label: "凸透镜" },
      { id: "concave", label: "凹透镜" },
      { id: "mirror", label: "平面镜" }
    ],
    correctTransfer: "convex"
  }
];

export function emptyProgress(): TaskProgress {
  return {
    stage: "predict",
    predictionReason: "",
    initialConfidence: 3,
    revisionReason: "",
    trials: [],
    explanation: "",
    evidenceScore: 0,
    reasoningScore: 0,
    hintsUsed: 0
  };
}

export function createResearchSession(participantId: string): ResearchSession {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    participantId,
    startedAt: now,
    updatedAt: now,
    activeTask: "reflection",
    consented: true,
    tasks: {
      reflection: emptyProgress(),
      bench: emptyProgress(),
      dispersion: emptyProgress(),
      correction: emptyProgress()
    }
  };
}

export function taskById(id: TaskId): ResearchTask {
  return TASKS.find((task) => task.id === id)!;
}
