import type { CapacitorHistory, LiliChatReply, LiliDialogueTurn, LiliExperimentContext, LiliSimulationSample } from "@physics-lab/contracts";
import { getHighSchoolExperiment, getHighSchoolLifeConnection } from "@physics-lab/knowledge/high-school";
import { analyzeHighSchoolMeasurements, defaultHighSchoolParameters, HIGH_SCHOOL_EXPERIMENTS, simulateHighSchoolExperiment, validateCapacitorHistory } from "@physics-lab/physics/high-school";
import type { HighSchoolExperimentId } from "@physics-lab/physics/high-school";
import { liliManualReference, prepareLiliManualContext } from "@physics-lab/harness/lili-manual";
import { expansionCurrentGuidance, expansionGuidance, expansionRequestedRelationship } from "@physics-lab/harness/lili-expansion";
import { createLiliScaffold, liliHintConstraint, liliHintLevel } from "@physics-lab/harness/lili-scaffolding";
import { isLiliCurrentCheck, isLiliLifeConnectionRequest, resolveLiliFollowUp } from "@physics-lab/harness/lili-dialogue";
import { createLiliEvidenceCoach, isLiliEvidenceCoachRequest } from "@physics-lab/harness/lili-evidence-coach";
export { isLiliCurrentCheck, isLiliLifeConnectionRequest, isLiliSimplificationRequest, resolveLiliFollowUp } from "@physics-lab/harness/lili-dialogue";
export { isLiliEvidenceCoachRequest } from "@physics-lab/harness/lili-evidence-coach";
export { liliHintLevel } from "@physics-lab/harness/lili-scaffolding";
export type { LiliHintLevel } from "@physics-lab/harness/lili-scaffolding";

export function prepareLiliContext(value: unknown) {
  if (value === null || value === undefined) return { context: null, snapshot: null };
  if (typeof value !== "object" || Array.isArray(value)) throw new RangeError("实验上下文格式不正确");
  const candidate = value as Record<string, unknown>;
  const experimentId = candidate.experimentId;
  if (typeof experimentId !== "string" || !HIGH_SCHOOL_EXPERIMENTS.some((item) => item.id === experimentId)) throw new RangeError("请先选择已开放的高中实验");
  if (!candidate.parameters || typeof candidate.parameters !== "object" || Array.isArray(candidate.parameters)) throw new RangeError("实验参数格式不正确");
  const parameters = candidate.parameters as Record<string, number>;
  if (Object.keys(parameters).length > 16 || Object.values(parameters).some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new RangeError("实验参数必须是有限数值");
  if (typeof candidate.timeSeconds !== "number" || !Number.isFinite(candidate.timeSeconds) || candidate.timeSeconds < 0) throw new RangeError("实验时间必须是非负有限数值");
  if (!Number.isSafeInteger(candidate.recordCount) || Number(candidate.recordCount) < 0 || Number(candidate.recordCount) > 2000) throw new RangeError("记录条数无效");
  const id = experimentId as HighSchoolExperimentId;
  const normalized = { ...defaultHighSchoolParameters(id), ...parameters };
  if (id === "capacitor-charge" && Object.keys(parameters).length !== HIGH_SCHOOL_EXPERIMENTS.find((item) => item.id === id)!.parameters.length) throw new RangeError("电容分段过程必须保留整轮完整的R/C/E参数");
  const snapshot = simulateHighSchoolExperiment(id, normalized, candidate.timeSeconds, candidate.capacitorHistory as CapacitorHistory | undefined);
  const context: LiliExperimentContext = { experimentId, parameters: normalized, timeSeconds: Math.min(candidate.timeSeconds, snapshot.durationSeconds), recordCount: Number(candidate.recordCount) };
  if (id === "capacitor-charge") context.capacitorHistory = validateCapacitorHistory(candidate.capacitorHistory, candidate.timeSeconds, snapshot.durationSeconds);
  if (candidate.samples !== undefined) {
    if (!Array.isArray(candidate.samples) || candidate.samples.length > 30 || candidate.samples.length > context.recordCount) throw new RangeError("仅支持分析最近30条已保存的仿真采样");
    const ids = new Set<string>();
    context.samples = candidate.samples.map((sample: unknown): LiliSimulationSample => {
      if (!sample || typeof sample !== "object" || Array.isArray(sample)) throw new RangeError("采样格式不正确");
      const entry = sample as Record<string, unknown>;
      if (typeof entry.id !== "string" || !/^[A-Za-z0-9._:-]{1,100}$/.test(entry.id) || ids.has(entry.id)) throw new RangeError("采样编号无效或重复");
      ids.add(entry.id);
      if (!entry.parameters || typeof entry.parameters !== "object" || Array.isArray(entry.parameters)) throw new RangeError("采样参数格式不正确");
      const sampleParameters = entry.parameters as Record<string, number>;
      const expectedKeys = HIGH_SCHOOL_EXPERIMENTS.find((definition) => definition.id === id)!.parameters.map((parameter) => parameter.key);
      if (Object.keys(sampleParameters).length !== expectedKeys.length || expectedKeys.some((key) => !Object.hasOwn(sampleParameters, key)) || Object.values(sampleParameters).some((value) => typeof value !== "number" || !Number.isFinite(value))) throw new RangeError("采样必须保留当时完整的实验条件");
      if (typeof entry.timeSeconds !== "number" || !Number.isFinite(entry.timeSeconds) || entry.timeSeconds < 0) throw new RangeError("采样时间无效");
      const result = simulateHighSchoolExperiment(id, sampleParameters, entry.timeSeconds, entry.capacitorHistory as CapacitorHistory | undefined);
      if (entry.timeSeconds > result.durationSeconds + 1e-8) throw new RangeError("采样时间超出该条件的实验时段");
      return { id: entry.id, parameters: { ...sampleParameters }, timeSeconds: entry.timeSeconds, ...(id === "capacitor-charge" ? { capacitorHistory: validateCapacitorHistory(entry.capacitorHistory, entry.timeSeconds, result.durationSeconds) } : {}) };
    });
  }
  Object.assign(context, prepareLiliManualContext(id, candidate));
  return { context, snapshot };
}

/** Analyze only recalculated local simulation samples; never trust supplied fit/metric fields. */
export function analyzeLiliSamples(context: LiliExperimentContext | null) {
  if (!context?.samples?.length) return null;
  try {
    const validated = prepareLiliContext(context).context!;
    const id = validated.experimentId as HighSchoolExperimentId;
    const measurements = validated.samples!.map((sample) => ({ ...sample, metrics: simulateHighSchoolExperiment(id, sample.parameters, sample.timeSeconds, sample.capacitorHistory).metrics }));
    return analyzeHighSchoolMeasurements(id, measurements);
  } catch { return null; }
}

/** Match the requested relation before ranking or limiting condition groups. */
export function liliRequestedRelationship(experimentId: string, question: string): string | null {
  const text = question.normalize("NFKC").toLowerCase().replace(/[\s_]/g, "").replace(/[—–−－]/g, "-").replace(/ᵧ/g, "y");
  const expanded = expansionRequestedRelationship(experimentId, text);
  if (expanded) return expanded;
  if (experimentId === "capacitor-charge" && /capacitor-log-voltage-time|拟合|时间常量|时间常数|对数|斜率|衰减率|估计.*(?:rc|τ)/.test(text)) return "capacitor-log-voltage-time";
  if (experimentId === "spring-force" && /force-extension|f(?:-|与|对|和)(?:x|δl|δx|伸长)|弹力.*伸长|伸长.*弹力|劲度系数|胡克|图像|图线|斜率|拟合/.test(text)) return "force-extension";
  if (experimentId === "force-composition" && /resultant-squared-cosine|cos|余弦|合力.*平方|r(?:\^?2|\*\*2)|拟合|图像|图线|斜率/.test(text)) return "resultant-squared-cosine";
  if (experimentId === "mechanical-energy" && /kinetic-gain-potential-loss|拟合|图像|图线|斜率|动能.*势能|势能.*动能/.test(text)) return "kinetic-gain-potential-loss";
  if (experimentId === "newton-second-law") {
    if (/acceleration-inverse-mass|a(?:-|与|对|和)1\/?m|质量倒数|固定(?:系统)?(?:合力|合外力|外力|驱动力)|保持(?:系统)?(?:合力|合外力|外力|驱动力)不变/.test(text)) return "acceleration-inverse-mass";
    if (/acceleration-net-force|a(?:-|与|对|和)f|固定(?:系统)?(?:总)?质量|保持(?:系统)?(?:总)?质量不变/.test(text)) return "acceleration-net-force";
    if (/加速度.*质量|质量.*加速度/.test(text)) return "acceleration-inverse-mass";
    if (/加速度.*(?:合力|外力)|(?:合力|外力).*加速度/.test(text)) return "acceleration-net-force";
  }
  if (experimentId === "uniform-acceleration") {
    if (/interval-velocity-time|(?:位置|位移).*(?:速度|估速)|速度.*(?:位置|位移)|区间速度|平均速度|相邻区间|差分/.test(text)) return "interval-velocity-time";
    if (/velocity-time|v-t|速度.*时间|瞬时速度/.test(text)) return "velocity-time";
  }
  if (experimentId === "projectile-motion") {
    if (/vertical-drop-time-squared|下落距离|竖直位移|时间(?:的)?平方|(?:y|h-y)-t(?:\^?2|\*\*2)|t(?:\^2|\*\*2)/.test(text)) return "vertical-drop-time-squared";
    if (/vertical-velocity-time|vy-t|竖直速度|纵向速度/.test(text)) return "vertical-velocity-time";
    if (/horizontal-position-time|x-t|水平位移|水平分运动/.test(text)) return "horizontal-position-time";
  }
  return null;
}

export function liliAnalysisReference(context: LiliExperimentContext | null, question = "") {
  const analysis = analyzeLiliSamples(context);
  if (!analysis) return null;
  const requestedRelationshipId = liliRequestedRelationship(context!.experimentId, question);
  const matching = requestedRelationshipId ? analysis.groups.filter((group) => group.relationshipId === requestedRelationshipId) : analysis.groups;
  const groups = [...matching].sort((a, b) => Number(b.status === "ready") - Number(a.status === "ready")).slice(0, 6);
  return {
    provenance: "simulation-recomputed",
    requestedRelationshipId,
    totalSavedCount: context!.recordCount,
    includedCount: analysis.recordCount,
    omittedCount: Math.max(0, context!.recordCount - analysis.recordCount),
    note: "仅分析最近最多30条本机保存的仿真条件；数值由这些条件重新计算，不是真实测量，也不是学生理解程度的证据。不同控制条件分组分析。position-interval表示由保存条件对应的位置和时间先求相邻区间平均速度，再配到区间中点；不是直接读取模型瞬时速度，也不是手动测量。同一横坐标的读数先取均值，再等权拟合；统计决定系数R²与RMSE针对这些均值，不能表示原始读数的离散程度。明确指定关系时先筛选该关系，再按可拟合状态排序，不能用其他关系的结果代答。" + (context!.experimentId === "force-composition" ? "本项纵轴R²表示合力大小的平方（N²），不是fit.rSquared中的统计决定系数。试配力保留学生的原始选择，拟合只检查模型合力关系，不能据此判断试配正确或学生已掌握。" : ""),
    groups: groups.map((group) => ({ relationshipId: group.relationshipId, pointSource: group.pointSource, title: group.title, status: group.status, sampleCount: group.points.length, distinctXCount: group.distinctXCount, controls: group.controls, estimates: group.estimates, fit: group.fit ? { statisticsBasis: group.fit.statisticsBasis, slope: group.fit.slope, intercept: group.fit.intercept, rSquared: group.fit.rSquared, rmse: group.fit.rmse } : null, conditions: group.conditions, reasons: group.reasons, nextStep: group.nextStep })),
    omittedGroupCount: matching.length - groups.length,
    otherRelationshipGroupCount: analysis.groups.length - matching.length
  };
}

const guidance: Record<string, { next: string; variables: string; graph: string; error: string }> = {
  ...expansionGuidance,
  "capacitor-charge": {
    next: "本轮从零电压开始。先接电源，预测电压与电流怎样变化，再保存0、1、2 s等不同时刻的模型读数；随后切到断路观察电压保持，再经电阻放电。切换保留当前电压，改变R/C/E则开始新轮。所有保存记录须含轮次编号和完整开关历史，不能只留下当前模式。",
    variables: "整轮固定R、C、E；开关切换保留U/Q/储能，电流可瞬间变化。改变数值参数须新建一轮，保留旧记录。拟合只比较同一轮、同一开关段和相同完整条件；不要把不同段或不同轮的时刻混在一起。",
    graph: "电压、电荷和电容储能在切换时连续，电流可垂直跳变。选同一充电或放电段，横轴用段内时间，纵轴用ln(|U−U∞|/1 V)：接电源U∞=E，经R放电U∞=0。至少3个电压差非零的不同时刻作自由截距拟合，τ=−1/斜率；断路或平衡态不能估计τ。模型拟合一致不是独立实测验证；I—t有符号面积对应标记极板电荷变化，不是电源全部能量。",
    error: "先核对kΩ/Ω与μF/F换算、同一轮同一段以及电流参考方向。接近平衡时电压差很小，显示舍入和相减会放大相对差异；不要把显示0当严格无电荷。理想模型未包含漏电、电表负载、寄生参数或击穿；20RC只是观察截止，5τ后仍有指数尾部。保留原记录，不能凭拟合好或保存次数判定完成实体测量。"
  },
  "mechanical-energy": {
    next: "先预测无阻力时的动能、势能和总机械能变化，再从静止运行。纸带每0.02 s出现一个等时点，不补非等时落地点；等B+1点出现后，自选两个内部点A/B，分别输入两组三个位置。系统不自动填入读数，也不把真实纸带首点认作零初速度。",
    variables: "同组固定质量、释放高度和恒定阻力比，比较不同下落时刻。研究阻力影响时从新的一轮开始，改变r后另成一组。r代表向上恒力f=rmg相对重力之比，不是真实空气阻力；采样间隔固定0.02 s，不能调成答案。",
    graph: "自动模型从静止释放，横轴为自释放点起的势能减少ΔEp=mgx，纵轴为保存的动能K即该区间ΔK。固定全部条件保存至少3个不同x，作带截距拟合，理论斜率1−r；r=0时为1。模型拟合不能独立验证守恒。手动纸带另用vA=(yA+1−yA−1)/(2Δt)、vB=(yB+1−yB−1)/(2Δt)，比较½m(vB²−vA²)和mg(yB−yA)，不能把KB当作ΔK，也不能用gt或√(2gh)先算速度再证明守恒。",
    error: "先核对六个位置是否共用同一零点、mm是否转为m、A/B是否内部点且共享点记录一致。0.1 mm是显示分辨率，不是测量精度。恒定阻力会使机械能减少；自主读数差还可能来自定位和量化，不能为凑守恒改写原值。本页不模拟真实空气阻力或撞地反弹，也不凭差值接近零评判掌握程度。"
  },
  "force-composition": {
    next: "先设F₁=3 N、方向0°，F₂=4 N、方向90°，预测合力的大致方向。独立拖动试配力端点或手调它的大小和方向，再对照两力分量和与平行四边形对角线，用记录按钮保存原始试配选择和模型读数。系统不会自动把试配力改成答案。这是静态二维矢量板，无需播放，也不模拟橡皮筋伸长。",
    variables: "同组固定F₁和F₂的大小且均大于0，例如3 N和4 N；固定第一力方向0°，只改变第二力方向为60°、90°、120°，分别保存。这样至少得到3个不同cosθ。θ指两力之间0°到180°的夹角，不是任意一个力相对x轴的方向；θ和−θ的余弦相同，不能当作两个不同横坐标。更换任一力的大小应另成一组。试配力保持学生自己的选择，不用于代替模型合力拟合。",
    graph: "横轴用夹角余弦cosθ（无量纲），纵轴用合力大小平方R²（N²）。固定两力大小时，R²=F₁²+F₂²+2F₁F₂cosθ；斜率对应2F₁F₂，截距对应F₁²+F₂²，拟合不强制过原点。至少保存3个不同cosθ；任一分力为0时夹角没有定义，不能用于这组关系。这里R²是合力大小平方，不是拟合优度的统计决定系数。拟合接近只说明模型一致，不能证明实物测量准确，也不能证明试配力已等效。",
    error: "先同时核对大小与方向，不能只比较两个力的数值之和，或把角度的算术平均当作合力方向。试配力应与合力同向，平衡力才与合力反向。残差是试配力减去模型合力的矢量差，0.05 N仅用于教学对照，不是仪表精度。本页未模拟实体安装、橡皮筋动态、测力计校零或视差；保存的试配选择与模型读数都不是实体实测。"
  },
  "spring-force": {
    next: "先将总悬挂质量设为0 g，记录原长；保持劲度系数和原长不变，依次设置50、100、150 g，每次用记录按钮保存弹力、伸长量和总长。总悬挂质量包含托盘。这是静态模型，调参即得到平衡读数，无需播放；当前仅有自动模型记录，尚未提供手动读尺。",
    variables: "在同一组中固定劲度系数和原长，只改变总悬挂质量（含托盘），至少保存3个不同伸长量。g固定为9.8 m/s²。更换劲度系数或原长后应另成一组，不把不同弹簧条件混在同一条拟合直线上。",
    graph: "横轴用伸长量x=L−L₀（m），纵轴用弹力F（N），理想静态关系为F=kx，斜率对应劲度系数k（N/m）。至少需要3个不同伸长量；拟合截距不强制为0。总长L含原长L₀，不能把F/L当作k。拟合好只说明模型关系一致，不能证明实测精度或真实弹性限度。",
    error: "先检查是否把总长当成伸长量、是否遗漏托盘质量，以及g和kg是否换算正确。实物还会受视差、零点和振动影响；当前是理想轻弹簧的静态模型，未模拟这些误差。预设伸长量不超过0.25 m的线性范围，不能用仿真确定真实弹性限度。当前没有手动读尺，自动记录不是真实测量。"
  },
  "uniform-acceleration": {
    next: "先预测：相同时间内，小车的位移会一样吗？保持本轮条件，运行后在至少4个不同时刻记录位置；在记录分析中选择由位置求区间速度，比较相邻位移与对应时长。",
    variables: "固定初速度和采样时间间隔，只改变加速度。每一组都从复位开始，比较同一时刻的速度与位移。",
    graph: "完整曲线中的 v–t 是模型瞬时速度。要由位置估速，请至少保存4个时刻的位置，在记录分析中选“由位置求区间速度”；用相邻位置差除以时长，并放在区间中点时间。匀加速模型下它等于中点瞬时速度，不能泛化到任意运动。",
    error: "先检查时间间隔、位移单位和起点是否一致。用一段时间内的位移求出的是平均速度；要估计某时刻的速度，需要说明取样区间。"
  },
  "newton-second-law": {
    next: "先把小车和挂码作为一个系统，画出沿绳方向的外力。记录总质量，再比较不同挂码条件下的加速度。",
    variables: "验证加速度与外力关系时，要控制小车与挂码总质量，并保持阻力、行程不变，在两者之间转移质量。验证质量倒数关系时，固定挂码、阻力和行程，只改变小车质量，至少记录3组；横轴使用小车与挂码总质量的倒数。",
    graph: "想验证正比关系，可画 a–F 图；验证反比关系时，试试 a–1/M。这里 M 包含小车与挂码，不要只写小车质量。",
    error: "能够启动时，挂码自身也在加速，因此绳张力小于挂码重力；保持静止时则有 T=mg。理想系统需要把挂码质量计入总质量；真实装置还要讨论摩擦、滑轮惯量与绳的影响。"
  },
  "projectile-motion": {
    next: "先固定抛出高度，改变水平初速度。预测落地时间是否变化，再用相同高度的两次实验比较。",
    variables: "只改变水平初速度，保持高度与重力加速度不变。另做一组只改变高度的实验，不要两项一起改。",
    graph: "保持平抛条件，在至少3个不同飞行时刻保存坐标。在记录分析中分别选择水平位移—时间和竖直下落距离—时间平方；下落距离是初始高度减去当前高度。后一个直线关系要求竖直初速度为零，轨迹不是速度图像。",
    error: "先确认是水平抛出，且竖直初速度为零。真实实验中的空气阻力、相机透视与时间同步会影响测量；当前理想模型不代表已模拟这些误差。"
  },
  pendulum: {
    next: "选取较小初始摆角，从同方向通过最低点开始计时，测量多个完整周期，再除以周期数。先分清一次往返和半个周期。",
    variables: "研究摆长时保持初始摆角和重力加速度不变。摆长指悬点到摆球重心的距离，不只是绳的长度。",
    graph: "用周期 T 的平方对摆长 L 作图，可检验小角度近似下的关系。T≈2π√(L/g) 有适用条件，大摆角不能直接当作同样精确。",
    error: "检查计时是否包含完整往返，以及摆长是否量到球心。初始摆角过大、小球转动、阻力和支点运动都可能让实际结果偏离理想模型。"
  },
  "emf-internal-resistance": {
    next: "先选择较大的负载电阻，再逐次减小负载并记录电流 I 与端电压 U。比较不同负载的多个点，而不是只用一组读数。",
    variables: "保持电源的电动势和内阻不变，只改变外接负载。不要把改变电源设置后的读数混入同一条 U–I 拟合直线。",
    graph: "将 U 放在纵轴、I 放在横轴。按 U=E−Ir，纵轴截距对应电动势，斜率的负值对应内阻；I>0 且 r>0 时 U<E，理想零内阻 r=0 时 U=E。",
    error: "先分清电动势 E 和电压表测得的端电压 U。理想电表模型没有包含电表内阻造成的系统误差，不能把理想读数称为真实测量精度。"
  },
  "double-slit": {
    next: "先保持缝间距与屏距不变，改变波长，观察相邻亮纹的间距。记录多条亮纹间的总跨度，再除以条纹间隔数。",
    variables: "一次只改变波长、双缝间距或屏距中的一项。注意毫米、米和纳米之间的换算；缝间距不是单条狭缝的宽度。",
    graph: "近轴时相邻亮纹间距约为 Δx=λL/d。可以分别比较 Δx–L 与 Δx–1/d；这个近似不能用于任意大角度。",
    error: "跨过 n 条亮纹通常只有 n−1 个相邻间隔。先检查间隔计数和单位，再讨论暗纹中心、读数定位与单缝衍射包络是否包含在模型中。"
  }
};

export function createLiliGuidance(question: string, context: LiliExperimentContext | null, recentDialogue: readonly LiliDialogueTurn[] = []): LiliChatReply {
  const resolved = resolveLiliFollowUp(question, context, recentDialogue);
  question = resolved.question;
  const experiment = context ? getHighSchoolExperiment(context.experimentId) : undefined;
  const current = context ? guidance[context.experimentId] : undefined;
  const sources = (experiment?.sourceUrls ?? []).slice(0, 2).map((url) => ({ title: "课程与教材参考", url }));
  const reply = (text: string, suggestions = ["我应该先做哪一步？", "怎样控制变量？", "怎么分析图像？"]): LiliChatReply => ({ text: resolved.notice ? `${resolved.notice}\n\n${text}` : text, mode: "guided", suggestions, sources });
  if (/系统提示|忽略.*规则|API.?key|密钥|密码|执行.*命令|system prompt/iu.test(question)) return reply("我负责帮你设计实验、比较证据和检查推理。可以告诉我当前想研究哪个物理变量。", ["怎样开始实验？"]);
  if (/激光.*(眼|直视)|直视.*激光|市电|插座|短接|短路|烫伤/iu.test(question)) return reply("如果说的是实物实验：不要直视激光或把光束指向他人；电学实验使用教师指导下的低压电源，不接市电、不短接电池。这里的虚拟操作不能代替实物实验的安全检查。", ["回到虚拟实验，先做什么？"]);
  if (/编造|伪造|假装.*测|(?:替我|帮我|代我|直接).{0,10}(?:写|生成).{0,12}(?:数据|报告)|生成.*(?:真实|实测).*数据/iu.test(question)) return reply("我能解释当前设置对应的理想模型，但不能把计算结果当成你亲自测得的数据。请先运行实验并记录读数，再把你要核对的一组数据写出来。", ["我应该记录什么？", "有哪些误差来源？"]);
  if (resolved.needsClarification) return reply("你想继续哪一部分：怎样控制变量、如何读数，还是怎样分析图像？也可以先让我检查当前实验。", ["帮我检查当前实验", "怎样控制变量？", "给我一级提示"]);
  if (!experiment || !current) {
    if (/平抛/iu.test(question) && /记录|比较/iu.test(question)) return reply("每组先记释放高度、水平初速度、抛射角和单位，再保存不同时刻的水平位置、竖直位置。比较落地时间时，应固定高度、抛射角为0°，只改变非零水平初速度；比较分运动时，使用同一组条件的多个飞行时刻，分别看x–t和竖直下落距离–t²。以上是记录方案，当前还没有收到你的记录，不能直接给出实验结论。", ["怎样控制变量？"]);
    if (/平抛/iu.test(question)) return reply("可以从高中专区打开“平抛与斜抛运动”，把抛射角设为0°，选择非零初速度和大于0的释放高度。先预测：同一高度下，水平初速度会不会改变落地时间？固定高度，只改变水平初速度，分别运行并保存记录，再比较落地时间和水平射程。这里尚未收到你的实验条件或记录，以上是探究步骤。", ["怎样控制变量？", "平抛运动要记录什么？"]);
    if (/变量|保持|改变|控制/iu.test(question)) return reply("先明确要研究哪两个量，再让其他会影响结果的条件保持相同。例如研究平抛落地时间与水平初速度的关系时，固定释放高度和重力加速度，只改变水平初速度，且每组抛射角都为0°。每组保存完整条件、读数和单位，再比较结果。选择具体实验后，我可以按那项实验继续引导。", ["平抛运动怎么探究？"]);
    return reply("我是力力，你的柯基实验伙伴。先选择一个高中实验，我会和你一起明确问题、只改变一个变量，再用记录支持结论。当前提供本地实验引导，联网 AI 会单独标明。", ["平抛运动怎么探究？", "怎样控制变量？"]);
  }
  const slitScreenHint = context!.experimentId === "double-slit" && simulateHighSchoolExperiment("double-slit", context!.parameters, 0).state.canMeasureFringeSpacing === 0
    ? "当前±20 mm虚拟屏内只有中央一条亮纹，无法选出两个亮纹中心，因此暂时不能用读尺测量间距或保存这项手动读数。先保持波长不变，缩短屏距或增大缝间距，直到屏内出现至少两条亮纹；每次只调一项，确认后固定新的d、L，再开始一组读尺。已有历史记录仍按保存时的条件分析。" : null;
  if (isLiliLifeConnectionRequest(question)) {
    const life = getHighSchoolLifeConnection(context!.experimentId);
    if (life) {
      const snapshot = simulateHighSchoolExperiment(context!.experimentId as HighSchoolExperimentId, context!.parameters, context!.timeSeconds, context!.capacitorHistory);
      const constraint = context!.experimentId === "capacitor-charge" && snapshot.capacitor?.mode === "open"
        ? "当前为断路保持段，不能用这一段估计充放电时间常量；切换前的记录仍按原条件保留。"
        : liliHintConstraint(context!, snapshot.state, slitScreenHint);
      return reply(`生活中可以先看：${life.scene}\n在这项实验里：${life.connection}\n类比的边界：${life.boundary}${constraint ? `\n当前条件提醒：${constraint}` : ""}\n先说说你预计会看到什么变化，再动一个参数验证；这里的数值仍是虚拟模型，不是生活场景的实测结果。`, ["帮我检查当前实验", "怎样控制变量？"]);
    }
  }
  const nextStep = slitScreenHint ?? current.next;
  const hintLevel = liliHintLevel(question);
  const checksCurrent = isLiliCurrentCheck(question);
  const explainsVariables = /^为什么要控制变量[？?]?$/u.test(question);
  const explainsGraph = question === "怎样理解这项实验的图像分析方法？";
  const coachesEvidence = isLiliEvidenceCoachRequest(question) || (resolved.style === "simple" && question === "我应该记录哪些证据？");
  if (hintLevel || checksCurrent || explainsVariables || explainsGraph || coachesEvidence || resolved.style === "simple") {
    const snapshot = simulateHighSchoolExperiment(context!.experimentId as HighSchoolExperimentId, context!.parameters, context!.timeSeconds, context!.capacitorHistory);
    const constraint = context!.experimentId === "capacitor-charge" && snapshot.capacitor?.mode === "open"
      ? "当前为断路保持段，不能用这一段估计充放电时间常量。保留本轮完整开关历史，切到接电源或经电阻放电后，只比较同轮同段的有效采样。"
      : liliHintConstraint(context!, snapshot.state, slitScreenHint);
    if (coachesEvidence) {
      const coach = createLiliEvidenceCoach({ context: context!, name: experiment.name, constraint,
        analysis: liliAnalysisReference(context!), manual: liliManualReference(context!), profile: current, evidence: experiment.evidence });
      return reply(coach.text, coach.suggestions);
    }
    if (resolved.style === "simple") {
      const introduction = constraint ? `先确认这一点：${constraint}\n` : "";
      if (checksCurrent) return reply(constraint
        ? `换个说法：现在先核对这一项，不急着补记录。\n${constraint}\n这说的是当前操作条件或方法的适用范围，不能据此说你以前的记录都错了。\n这次只做：按提示调整或确认后，再问“现在呢”；我会重新检查新条件，不自动替你改参数。`
        : `换个说法：这次已检查的条件没有发现阻断，但我还不能据此说每一步操作都正确。\n这次先做：${current.next.split("。")[0]}。\n把实际观察保留下来，再点“检查我的记录”；有了具体证据，才能继续判断。`, ["现在呢", "检查我的记录"]);
      if (explainsVariables) return reply(`${introduction}换个说法：想知道哪一项带来了变化，就先只动这一项，其余条件先不动。\n放到这个实验里：${current.variables.split("。")[0]}。\n现在只回答一个问题：你准备改变哪个量？`, ["帮我规划下一步", "帮我检查当前实验"]);
      if (explainsGraph) return reply(`${introduction}换个说法：每个点就是一组“横轴数值、纵轴数值”，先弄清横轴、纵轴各代表什么，再看它们怎样一起变。\n${current.graph.split("。").slice(0, 2).join("。")}。\n先做一个小检查：从同一条件组挑一个点，说出两个坐标的含义和单位。画出直线还不能证明实测准确。`, ["检查我的记录", "怎样控制变量？"]);
      if (question === "手动读数有哪些误差来源？") {
        if (!["pendulum", "double-slit", "mechanical-energy"].includes(context!.experimentId)) return reply("换个说法：这个实验目前没有独立的手动虚拟仪器记录。记录按钮保存的是模型采样，不能把它说成你用实物器材测得的读数。先保留参数与单位，再检查同条件的一组采样。", ["检查我的记录", "帮我规划下一步"]);
        const simple = context!.experimentId === "pendulum"
          ? "秒表总时长除以完整往返次数，才得到一次往返的时间。先别改读数，回想你数的是一次完整往返，还是只摆过去的一半；起止应同向经过同一位置。"
          : context!.experimentId === "double-slit"
            ? "从第1条亮纹到第6条，中间只有5个间隔。先核对两个点是不是亮纹中心，再数中间的间隔；不要照着已知波长改坐标。"
            : "先把纸带上的六个位置看作六次原始读尺。分别用A、B两侧的位置差求速度，再比较两点之间的能量变化；不能只用B点的动能，也不能用gt替你读位置。";
        return reply(`${introduction}换个说法：${simple}\n现在先核对这一处，再告诉我你实际怎样读的；我不能只凭结果判断操作正确。`, ["看看我的手动读数", "检查我的记录"]);
      }
      if (question === "有哪些误差来源？") return reply(`${introduction}换个说法：先找可能让读数改变的一步，再去核对原记录；结果有偏差，不能直接认定是哪一步错了。\n这项实验先查：${current.error.split("。")[0]}。\n你先说出哪一条读数让你觉得不对，保留原值再比较。`, ["检查我的记录", "帮我检查当前实验"]);
    }
    if (checksCurrent) return reply(`当前条件检查 · ${experiment.name}\n${constraint ?? "在本次已检查的操作条件中，没有发现需要先纠正的阻断；这不表示所有实验步骤都已验证。"}\n下一步：${constraint ? "先按上面的条件提示调整或确认，再重新检查；保留原记录，不把新旧条件混在一起。" : current.next}\n这里只核对当前虚拟条件，不判定已完成实验、测量准确或掌握程度。`, ["为什么？", "再给一点提示", "怎样控制变量？"]);
    if (explainsVariables) return reply(`${constraint ? `先检查当前条件：${constraint}\n` : ""}一次只改变要研究的一个量，才能比较观察到的差异与哪项条件有关；如果几项一起变，就难以区分各自影响。\n在这项实验中：${current.variables}\n先告诉我：这一次你准备改变哪个量，保持哪些量不变？`, ["给我二级提示", "帮我检查当前实验"]);
    if (explainsGraph) return reply(`${constraint ? `先检查当前条件：${constraint}\n` : ""}先写清横轴、纵轴各代表什么，再把同一控制条件下的记录放在一起比较。拟合只是整理这些证据，不能代替读数或证明实测准确。\n${current.graph}\n你现在不清楚的是坐标、分组，还是斜率的含义？`, ["怎样控制变量？", "我应该记录哪些证据？"]);
    const scaffold = createLiliScaffold(hintLevel!, experiment, current, constraint);
    if (scaffold) return reply(scaffold.text, scaffold.suggestions);
  }
  const asksManual = /手动|秒表|计时读数|读尺|周期数|亮纹.*读数|纸带|中央差分|六个?(?:位置|坐标)|两侧.*平均|vA|vB|(?:上次|历史|已保存|最后一条).*(?:测量|波长|计时|坐标)/iu.test(question);
  const asksEvidence = /记录|拟合|分析|斜率|数据|证据|结论/iu.test(question);
  const asksAutomatic = /自动|模型.*采样/iu.test(question);
  const requestedRelationship = liliRequestedRelationship(context!.experimentId, question);
  const supportsManual = context!.experimentId === "pendulum" || context!.experimentId === "double-slit" || context!.experimentId === "mechanical-energy";
  if (expansionGuidance[context!.experimentId]) {
    if (/变量|控制|保持.*不变/iu.test(question) && !asksEvidence) return reply(current.variables);
    if (/误差|精度|模型限制|有哪些限制/iu.test(question) && !asksEvidence) return reply(current.error);
    // Historical groups remain usable even when current controls are invalid.
    // Current-state explanations must not substitute those controls into old records.
    if ((!asksEvidence && !/拟合|图像|图线|斜率/iu.test(question)) || /完成|通过|满分|掌握/iu.test(question) || asksManual) {
      const state = simulateHighSchoolExperiment(context!.experimentId as HighSchoolExperimentId, context!.parameters, context!.timeSeconds).state;
      const expanded = expansionCurrentGuidance(question, context!, state);
      if (expanded) return reply(expanded.text, expanded.suggestions);
    }
    if (requestedRelationship && !context!.samples?.length) return reply(`目前没有收到可用于这项关系的已保存采样，不能声称已经测得。${current.graph}`, ["怎样控制变量？", "我应该先做哪一步？"]);
  }
  if (context!.experimentId === "capacitor-charge") {
    const simulation = simulateHighSchoolExperiment("capacitor-charge", context!.parameters, context!.timeSeconds, context!.capacitorHistory);
    const state = simulation.state; const currentMode = simulation.capacitor!.mode;
    const amount = (key: string) => Number(state[key]!.toPrecision(6));
    if (/完成|通过|满分|掌握/iu.test(question)) return reply("不能按保存条数或曲线吻合认定已经掌握，也不能把20RC观察截止叫作完全充满/放空。请用同轮记录说明开关切换时U/Q/储能的连续、电流的跳变，并区分模型采样与实体仪器实验。", ["怎样控制变量？", "怎样估计时间常量？"]);
    if (/能量|储能|耗散|热量|做功/iu.test(question)) return reply(`本轮模型从零储能开始，电源累计做功${amount("sourceWork")} J，电容储能${amount("storedEnergy")} J，电阻累计耗散${amount("dissipatedEnergy")} J；前者等于后两者之和，不能把电源功全部当成储能。断路保持储能且热功率为0，经R放电把已有储能变为电阻热。零初值充电到稳态的极限为电源CE²、储能½CE²、耗散½CE²；有限观察时间只是趋近。`, ["电流为什么反向？", "怎样估计时间常量？"]);
    if (/净电荷|极板|介质|穿过|电荷.*(?:正负|符号)|面积/iu.test(question)) return reply(`Q=${amount("charge")} C指固定标记极板的电荷，另一极板为−Q，整个电容器净电荷为0。正电流流入标记极板，I=dQ/dt；经R放电时I为负，表示该极板电荷减少。I—t有符号面积给出电荷变化ΔQ，不是整个电容器净电荷，也不是能量。导线中电荷重新分布，模型不画成电荷穿过绝缘介质。`, ["断路时为什么还有电压？", "怎样控制变量？"]);
    if (/误差|不一致|错误|不对|偏大|偏小|精度/iu.test(question)) return reply(current.error);
    if (/变量|控制|改变.*(?:电阻|电容|电源)|参数/iu.test(question) && !asksEvidence) return reply(current.variables);
    if (!asksEvidence && !requestedRelationship && /当前|现在|状态|断路|放电|电流|反向|切换|充满|放空|5\s*[τt]|五个|截止|终点/iu.test(question)) return reply(`当前第${simulation.capacitor!.segmentIndex + 1}段为${{ charge: "接电源", discharge: "经电阻放电", open: "断路保持" }[currentMode]}，从${amount("segmentStartTime")} s开始，段初电压由完整历史重算为${amount("segmentInitialVoltage")} V；此时U=${amount("voltage")} V，I=${amount("current")} A。${currentMode === "open" ? "断路使I=0，电压、电荷和储能保持，不等于放空。" : currentMode === "discharge" ? "放电时I按固定参考方向为负（零电压时为0），不是电流大小为负。" : "接电源时电压向E趋近、电流逐渐减小。"}开关切换时U/Q/储能连续，I可以瞬间改变。5τ或20RC观察截止都不强制U变为E/0。`, ["怎样估计时间常量？", "能量去了哪里？"]);
    if (requestedRelationship && !context!.samples?.length) return reply(`还没有收到可拟合的保存采样，不能称为已经测得时间常量。${current.graph}`, ["我应该先做哪一步？"]);
  }
  if (context!.experimentId === "mechanical-energy") {
    if (/完成|通过|满分|掌握/iu.test(question)) return reply("不能按保存数量或能量差接近零判定已完成学习。请先说明六个自主位置怎样得到A/B两点速度，并区分阻力损耗、显示量化与读数选择；自动模型吻合不等于独立测量准确。", ["查看我的纸带读数", "怎样控制变量？"]);
    if (!asksManual && !asksEvidence && !requestedRelationship && /当前|现在|状态|阻力|守恒|碰撞|反弹|空气/iu.test(question)) {
      const state = simulateHighSchoolExperiment("mechanical-energy", context!.parameters, context!.timeSeconds).state;
      const value = (key: string) => Number(state[key]!.toPrecision(5));
      return reply(`当前模型向下位移${value("position")} m，动能${value("kineticEnergy")} J，势能${value("potentialEnergy")} J，总机械能${value("totalMechanicalEnergy")} J。${context!.parameters.resistanceRatio === 0 ? "设置r=0，只有重力做功，模型机械能守恒。" : `向上恒定阻力f=rmg使机械能减少，当前模型耗散${value("dissipatedEnergy")} J；这不是真实空气阻力定律。`}这是同步从静止释放的模型结果，不是手动纸带测量；终点表示碰撞前一瞬，不模拟反弹。`, ["查看我的纸带读数", "自动模型怎样拟合？"]);
    }
  }
  if (context!.experimentId === "force-composition") {
    const state = simulateHighSchoolExperiment("force-composition", context!.parameters, 0).state;
    const value = (key: string) => Number(state[key]!.toPrecision(5));
    if (/完成|通过|满分|掌握/iu.test(question)) return reply("不能按保存条数、拖动次数或试配残差小于0.05 N认定已经完成学习。请保留自己的试配选择，说明为什么要同时匹配大小和方向，再用不同夹角的同条件记录支持矢量关系。模型吻合也不代表完成了实体器材操作。", ["怎样控制变量？", "怎么分析合力平方与夹角余弦？"]);
    if (/平衡力|平衡.*合力|合力.*平衡/iu.test(question)) return reply(state.resultantDirectionDefined === 0
      ? "当前两力合力为零，因此没有合力方向；要平衡这两力，不需要再添加非零力。零向量也没有所谓反向角度。试配等效力应为零，而不是选一个方向的非零平衡力。"
      : "单个等效力要与两力合力大小相等、方向相同；平衡力则大小相等、方向相反，使总力为零。请用试配力代表原来两个力的共同作用，不要将它转到合力的反方向；平衡的三力装置与这里的等效替代不是同一件事。", ["当前试配残差是多少？", "怎样控制变量？"]);
    if (/阈值|0[.．]05|精度|允差|误差范围/iu.test(question)) return reply(`当前模型残差大小为${value("residualMagnitude")} N，是试配力减去模型合力的矢量差的大小。0.05 N只是教学对照阈值，不是测量精度、仪表分辨率或实物误差范围；阈值内也不能据此判定学习完成。`, ["合力和平衡力有什么区别？", "怎么分析图像？"]);
    if (asksManual || /校零|校准|实体|实测|橡皮筋/iu.test(question)) return reply("你可以拖动端点或手调试配力，原始选择会随模型记录保存；这是独立的虚拟操作参数，不是手动测力计实测。本页没有橡皮筋动态、器材安装、校零或独立手动仪器记录。先保持两力不变，自主试配并保存，再比较大小、方向及矢量残差。", ["我应该先做哪一步？", "怎样控制变量？"]);
    if (/变量|控制|固定|保持.*不变/iu.test(question) && !/拟合|分析|图像|图线/iu.test(question)) return reply(current.variables);
    if (/误差|不一致|错误|不对|偏大|偏小/iu.test(question)) return reply(current.error);
    if (/当前|现在|状态|残差|差值|零合力|合力.*(?:为零|为0)|相消|没有方向/iu.test(question) && !asksEvidence && !requestedRelationship) {
      const direction = state.resultantDirectionDefined === 0 ? "合力为零，没有方向，不能把占位角度0°当作物理方向" : `合力大小${value("resultantMagnitude")} N、方向${value("resultantAngleDegrees")}°（从x轴正向逆时针计）`;
      const angle = state.angleBetweenDefined === 0 ? "至少一个分力为零，两力夹角没有定义；改变零力的方向不会改变矢量，不能把它用于cosθ拟合。" : `两力夹角为${value("angleBetweenDegrees")}°。`;
      return reply(`当前模型两力分量和为(${value("resultantX")}, ${value("resultantY")}) N；${direction}。${angle}你的试配选择仍为${context!.parameters.trialForceN} N、方向${context!.parameters.trialAngleDegrees}°，其矢量残差大小为${value("residualMagnitude")} N；试配力为零时该设置角度也没有物理方向含义。这是当前虚拟操作与模型对照，不是真实测量，系统不会自动改写试配值。`, ["合力和平衡力有什么区别？", "怎样控制变量？"]);
    }
  }
  if (asksManual && !supportsManual) return reply(context!.experimentId === "spring-force"
    ? "当前弹簧实验尚未提供手动读尺，只能保存自动模型读数。先将总悬挂质量设为0 g核对原长，再固定劲度系数和原长、改变总悬挂质量，记录伸长量与弹力；这些不是实际器材测量。"
    : "当前实验尚未提供手动虚拟仪器记录。可以用记录按钮保存当前模型读数，再比较同一控制条件下的多组自动采样；这些不是实际器材测量。", ["我应该先做哪一步？", "怎样控制变量？"]);
  if (context!.experimentId === "double-slit" && !asksAutomatic && /读尺|测量|读数|间隔/iu.test(question)) {
    const asksSaved = /上次|历史|已保存|最后一条|这条记录|我的.*(?:读数|记录)|保存的.*(?:读数|记录)/iu.test(question);
    const asksCurrent = !context!.manualSamples?.length || (!asksSaved && /当前|现在|屏幕|只有/iu.test(question));
    if (asksCurrent) {
      if (slitScreenHint) return reply(slitScreenHint, ["怎样控制变量？", "读尺时如何数亮纹间隔？"]);
      if (!context!.manualSamples?.length) return reply("还没有收到可引用的手动虚拟读数。先保持波长、缝间距d和屏距L不变，在屏幕上分别把A、B定位到两条亮纹中心，数清两者之间的相邻间隔数N，再计算并保存。第1条到第6条亮纹有5个间隔；不要把亮纹条数当成N，也不要用已知波长倒填坐标。0.1 mm只是虚拟尺显示分辨率。", ["读尺时如何数亮纹间隔？", "怎样控制变量？"]);
    }
  }
  if (asksManual || (context!.experimentId === "mechanical-energy" && !asksAutomatic && /误差|偏大|偏小|不一致|不对|错误/iu.test(question)) || (asksEvidence && !asksAutomatic && context?.manualSamples?.length && !context.samples?.length)) {
    const manual = liliManualReference(context);
    const record = manual?.records.at(-1);
    const tapeError = "先核对六个位置是否使用同一零点、mm到m的换算、选点编号和共享点是否一致。0.1 mm量化及选点偏差会影响两侧位置差；A/B区间太短时，能量变化较小，相同读数差异的相对影响会放大。中央差分在本匀变速模型中等于中心瞬时速度，任意运动只能近似使用。恒定向上阻力造成的模型能量损耗不是读尺误差，也不是真实空气阻力定律；保留原值，不为凑守恒改写读数或自动判分。";
    if ((!manual || !record) && context!.experimentId === "mechanical-energy" && /误差|偏大|偏小|不一致|不对|错误/iu.test(question)) return reply(`还没有收到可引用的纸带自主读数，以下是核对方法，不能断言你已经出现哪一种误差。${tapeError}`, ["我应该先做哪一步？"]);
    if (!manual || !record) return reply(context!.experimentId === "mechanical-energy"
      ? "还没有收到可引用的纸带自主读数。请运行到B+1点可见，选两个内部点A/B并独立输入两组三个位置，再保存。用两侧位置差除以0.04 s估计各中心速度，不用gt、√(2gh)或自动模型速度填答案。"
      : "还没有收到可引用的手动虚拟读数。请先在单摆秒表或双缝读尺中保存一次读数，再问我。自动模型采样不能替代你操作得到的这组记录。", ["我应该先做哪一步？"]);
    const scope = `已收到最近 ${manual.includedCount} 条手动虚拟读数${manual.omittedCount ? `（共 ${manual.totalSavedCount} 条）` : ""}，先看最后一条。`;
    const value = (key: string) => Number(record.metrics.find((metric) => metric.key === key)!.value.toPrecision(4));
    const r = record.readings;
    if (record.kind === "mechanical-energy-tape") {
      const warning = record.warnings.find((entry) => entry.startsWith("本次读数算出")) ?? "";
      if (/误差|偏大|偏小|不一致|不对|错误/iu.test(question)) return reply(`${scope}这条记录选A=${r.indexA}、B=${r.indexB}，中心位置分别为${r.aCenterMm}、${r.bCenterMm} mm，当时恒定阻力比r=${r.resistanceRatio}。${warning}${tapeError}`, ["看看我的纸带读数", "自动模型怎样拟合？"]);
      return reply(`${scope}这条记录选A=${r.indexA}、B=${r.indexB}；六个向下位置分别为(${r.aBeforeMm}, ${r.aCenterMm}, ${r.aAfterMm})与(${r.bBeforeMm}, ${r.bCenterMm}, ${r.bAfterMm}) mm。固定Δt=0.02 s，由两侧位置中央差分得vA≈${value("velocityA")} m/s、vB≈${value("velocityB")} m/s。按原质量${r.mass} kg计算A到B的ΔK≈${value("kineticEnergyIncrease")} J、ΔEp≈${value("potentialEnergyLoss")} J，算术差ΔEp−ΔK≈${value("energyDifference")} J。${warning}A点速度没有被设为零；没有用gt、√(2gh)或模型答案替代六个位置。请核对共享点、单位和选点；0.1 mm只是显示分辨率，不是真实测量精度或守恒已验证的证明。`, ["纸带有哪些误差来源？", "自动模型怎样拟合？"]);
    }
    if (record.kind === "pendulum-timing") {
      const timingWarning = record.warnings.find((warning) => warning.startsWith("计时周期与同条件模型")) ?? "";
      if (/误差|偏大|偏小|不一致|不对|错误/iu.test(question)) return reply(`${scope}${timingWarning}先核对这条记录中的 ${r.periodCount} 个周期是不是完整往返，以及起止是否同向经过同一位置；半周期误记和起止错位都会改变T。保持摆长 ${r.length} m不变，再做一次多周期计时比较。0.01 s只是显示分辨率，仿真按1/60 s推进；不能据此宣称实体秒表精度。${r.amplitudeDegrees! > 10 ? "这次摆角超过10°，不要用小角公式反推g。" : "即使摆角不超过10°，小角公式仍有近似偏差。"}`, ["看看我的手动读数", "怎样控制变量？"]);
      const gravity = record.metrics.find((metric) => metric.key === "gravity");
      return reply(`${scope}${timingWarning}起止读数 ${r.startTimeSeconds!.toFixed(2)}→${r.endTimeSeconds!.toFixed(2)} s，输入了 ${r.periodCount} 个完整周期，因此 T=Δt/N≈${value("period")} s。这条记录的摆长为 ${r.length} m、摆角为 ${r.amplitudeDegrees}°。${gravity ? `${timingWarning ? "仅按原始读数作算术计算" : "按小角近似推算"} g≈${Number(gravity.value.toPrecision(4))} m/s²。` : "摆角超过10°，本次不按小角公式估计g。"}这是按你保存的虚拟读数计算，不是真实器材实测，也不能据此确认计数正确。先核对：起止是否同向经过同一位置，N数的是否是完整往返？`, ["手动计时有哪些误差来源？", "怎样控制变量？"]);
    }
    if (/(?:怎么|如何|怎样).*(?:数|间隔)|间隔.*(?:怎么|如何|怎样)/iu.test(question)) return reply(`${scope}从一条亮纹中心数到另一条亮纹中心，数的是相邻中心之间的间隔。例如第1条到第6条亮纹只有5个间隔，不是6个。你这条记录填的是N=${r.intervalCount}；请对照屏幕自行核对，系统不会自动判断两点属于哪条亮纹。先保持d=${r.slitSeparationMm} mm和L=${r.screenDistance} m不变，再定位一遍。`, ["看看我的手动读数", "读尺误差怎样检查？"]);
    if (/误差|偏大|偏小|不一致|不对|错误/iu.test(question)) return reply(`${scope}先保持这条记录的d=${r.slitSeparationMm} mm、L=${r.screenDistance} m，核对A/B是否在亮纹中心、N=${r.intervalCount}是否是相邻间隔数。位置差增大会使估计波长增大，间隔数填大则使估计波长减小；仅凭结果不能确定是哪一项出错。可以跨更多条纹重复读尺，但不要为了接近已知波长改写原始坐标。0.1 mm只是虚拟尺显示分辨率。`, ["看看我的手动读数", "读尺时如何数亮纹间隔？"]);
    const rangeWarning = record.warnings.find((warning) => warning.startsWith("估计波长超出")) ?? "";
    return reply(`${scope}A=${r.leftPositionMm} mm，B=${r.rightPositionMm} mm，输入 ${r.intervalCount} 个相邻间隔，平均间距约 ${value("fringeSpacingMm")} mm。按这条记录的 d=${r.slitSeparationMm} mm、L=${r.screenDistance} m，近轴估计 λ≈${value("wavelengthNm")} nm。${rangeWarning}这是按虚拟屏手动读数推算，不是真实器材实测；系统没有判断选点和计数是否正确。先核对：两点是否在亮纹中心，数的是间隔而非亮纹条数？`, ["读尺时如何数亮纹间隔？", "怎样控制变量？"]);
  }
  if (asksEvidence && !asksAutomatic && context?.manualSamples?.length && context.samples?.length) return reply("这里同时有自动模型采样和手动虚拟读数，它们的来源不同。请选择要讨论哪组：自动采样可以检验模型关系；手动读数需要核对起止、选点和计数。", ["看看我的手动读数", "分析自动模型采样"]);
  if (context?.experimentId === "spring-force") {
    if (/弹性限度|弹性极限|线性范围|超出.*范围/iu.test(question)) return reply("本实验把伸长量不超过0.25 m设为预设线性范围，使用理想轻弹簧的静态模型；这不是通过仿真测出的真实弹性限度。真实弹簧的弹性限度需要实物证据，不能从这里的直线或最大设置推断。", ["怎样控制变量？", "怎么分析弹力与伸长量？"]);
    if (/控制|哪些量|保持.*不变|固定/iu.test(question) && !/拟合|分析|图像|图线/iu.test(question)) return reply(current.variables);
    const state = simulateHighSchoolExperiment("spring-force", context.parameters, 0).state;
    const value = (key: string) => Number(state[key]!.toPrecision(5));
    if (/原长|总长|总长度|l[₀0]/iu.test(question) && !/拟合|分析|图像|图线/iu.test(question)) return reply(`原长L₀是不受外部拉力时的长度，总长L是加载后的长度，伸长量x=L−L₀。当前模型给出L₀=${value("naturalLength")} m、L=${value("length")} m，因此x=${value("extension")} m；应以x而非L作F–x图的横轴。先设0 g核对原长，再固定原长与劲度系数改变总悬挂质量。`, ["怎样控制变量？", "怎么分析弹力与伸长量？"]);
    if (/千克|克|kg|\bg\b|换算|托盘|质量.*单位/iu.test(question)) return reply(`质量控件以g为单位，计算前按1 kg=1000 g换算：当前${context.parameters.loadMassGrams} g=${value("loadMassKg")} kg。总悬挂质量包含托盘；g固定为9.8 m/s²，理想静态平衡时弹力大小F=mg，当前模型值为${value("force")} N。不能直接把以克表示的数值代入kg单位的公式，也不应重复加一次托盘质量。`, ["原长和总长有什么区别？", "怎样控制变量？"]);
    if (/误差|不一致|错误|不对|偏大|偏小/iu.test(question)) return reply(current.error);
    if (/当前|现在|读数是多少|力是多少|伸长多少|工作点|状态/iu.test(question) && !/拟合|分析|记录/iu.test(question)) return reply(`当前是理想轻弹簧的静态平衡：总悬挂质量${context.parameters.loadMassGrams} g（含托盘），弹力${value("force")} N，伸长量${value("extension")} m，总长${value("length")} m，原长${value("naturalLength")} m。${state.force === 0 ? "当前无外部悬挂载荷，伸长量为0、总长等于原长；这可作为零载荷基线。" : "调参会立即更新平衡值，不需要播放或等待振动停止。"}这些是自动模型读数，尚未提供手动读尺。`, ["我应该先做哪一步？", "怎样控制变量？"]);
  }
  const projectileInitial = context?.experimentId === "projectile-motion" ? simulateHighSchoolExperiment("projectile-motion", context.parameters, 0) : null;
  const noFlightReply = () => reply("当前物体已在地面，且没有向上的初速度，因此没有离地飞行段；非零水平速度也不会让它离开地面。先增加释放高度，再观察平抛或自由下落；如果选择向上抛出，则应按相应的竖直初速度分析。", ["怎样控制变量？", "我应该先做哪一步？"]);
  // Old saved flights remain analyzable after changing controls; empty current runs
  // must not be sent to an impossible three-flight-time sampling task.
  if (projectileInitial?.durationSeconds === 0 && !context?.samples?.length) return noFlightReply();
  if (requestedRelationship && !context?.samples?.length) {
    const group = analyzeHighSchoolMeasurements(context!.experimentId as HighSchoolExperimentId, []).groups.find((entry) => entry.relationshipId === requestedRelationship);
    if (group) return reply(`你要研究“${group.title}”。目前没有收到这项实验的已保存仿真采样。${group.nextStep} ${group.conditions.join("；")}${context!.experimentId === "spring-force" || context!.experimentId === "force-composition" ? ` ${current.graph}` : ""}`, ["怎样控制变量？", "我应该记录哪些读数？"]);
  }
  if ((asksEvidence || requestedRelationship) && context?.samples?.length) {
    const analysis = liliAnalysisReference(context, question);
    if (!analysis) return reply("当前保存的仿真条件不完整，暂时不能可靠分析。请先检查记录中的参数和单位，保留原记录后再采集一组完整条件。", ["怎样控制变量？"]);
    const ready = analysis.groups.find((group) => group.status === "ready");
    const scope = `我查看了最近 ${analysis.includedCount} 条本机仿真采样${analysis.omittedCount ? `（总共 ${analysis.totalSavedCount} 条）` : ""}。`;
    if (ready) {
      const estimates = ready.estimates.map((estimate) => `${estimate.label}约为 ${Number(estimate.value.toPrecision(4))} ${estimate.unit}`).join("；");
      const source = ready.pointSource === "position-interval" ? "这里先由保存条件对应的相邻位置差除以时长，得到区间平均速度，再配到区间中点时间；没有直接把模型瞬时速度当作这些区间读数。" : ready.relationshipId === "velocity-time" ? "这里拟合的是保存条件对应的模型瞬时速度，尚未用位置差独立估速。" : "";
      return reply(`${scope}按相同控制条件分组后，“${ready.title}”有 ${ready.distinctXCount} 个不同横坐标，可用于拟合。${estimates}。${source}这些结果来自模型采样，拟合接近不等于真实测量准确。${ready.conditions.join("；")} ${ready.nextStep}`, ["有哪些误差来源？", "怎样控制变量？"]);
    }
    const group = analysis.groups[0];
    return reply(`${scope}${group ? `对于“${group.title}”，` : ""}目前还不能得出可靠的拟合结论。${group?.reasons.join("；") ?? "请保留每组完整的实验条件。"} ${group?.nextStep ?? current.next}`, ["怎样控制变量？", "有哪些误差来源？"]);
  }
  if (projectileInitial) {
    const { state: initial, durationSeconds } = projectileInitial;
    if (durationSeconds === 0) return noFlightReply();
    if (initial.vx === 0 && initial.vy === 0) return reply("当前初速度大小为0，水平、竖直初速度都为0；设置角度不会产生初速度。这是从当前高度自由下落，可以比较下落距离与时间平方。若要研究有水平位移的平抛，请把抛射角设为0°并给定非零初速度。", ["分析下落距离与时间平方", "怎样控制变量？"]);
    if (initial.vy !== 0) return reply(Math.abs(initial.vx!) < 1e-12 ? "当前是竖直上抛，水平速度为0、竖直初速度不为0。不能把下落距离—时间平方当作过原点的平抛关系；可以分析竖直速度—时间。若要研究平抛，请把抛射角设为0°。" : "你目前设置了非零抛射角，演示的是斜抛运动，竖直初速度不为零。要研究教材中的平抛运动，先把抛射角设为 0°；若保留当前角度，应分别分析水平、竖直初速度。", ["怎么分析图像？", "怎样控制变量？"]);
  }
  if (context?.experimentId === "newton-second-law" && /误差|不一致|错误|不对|偏大|偏小|为什么|张力|拉力|启动|动起来/iu.test(question)) {
    const state = simulateHighSchoolExperiment("newton-second-law", context.parameters, 0).state;
    if (state.acceleration === 0 && /启动|动起来/iu.test(question)) return reply("可以减小等效阻力，或增大挂码质量，直到挂码重力 mg 严格超过最大静摩擦力；本模型用等效阻力作为该阈值。然后重新播放，确认系统开始运动。为后续控制变量实验重新设定并固定相应条件，不能把这次为启动而调整阻力或挂码的读数混入原来的同条件组。", ["怎样控制变量？", "怎样比较加速度与质量倒数？"]);
    if (state.acceleration === 0) return reply("当前挂码重力没有超过最大静摩擦力，系统保持静止，加速度为0。由 mg−T=ma 可得此时绳张力 T 等于挂码重力 mg，小车受到的静摩擦力与绳张力平衡。只有能够启动并加速时，才不能直接把挂码重力当成绳张力。", ["怎样让系统启动？", "怎样控制变量？"]);
  }
  if (/误差|不一致|错误|不对|偏大|偏小|为什么/iu.test(question)) return reply(current.error);
  if (/图|拟合|斜率|公式|结论|答案/iu.test(question)) return reply(current.graph);
  if (/变量|保持|改变|控制/iu.test(question)) return reply(current.variables);
  if (/记录|证据|单位|数据/iu.test(question)) return reply(`这项实验建议留下：${experiment.evidence.join("；")}。请同时记录参数和单位，并把模型生成的数据与真实器材的测量分开。`);
  if (/你好|名字|是谁|柯基|力力/iu.test(question)) return reply(`我是力力，一只喜欢追问“证据在哪里”的柯基。现在我们在做“${experiment.name}”。${nextStep}`);
  return reply(nextStep);
}

export function liliReferenceNotes(experimentId: string) {
  return guidance[experimentId] ?? null;
}
