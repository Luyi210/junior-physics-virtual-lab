import type { HighSchoolExperimentId } from "./types";
import { HIGH_SCHOOL_GRAVITY } from "@physics-lab/physics/high-school/types";
import { highSchoolExperiment, validatedHighSchoolParameters } from "@physics-lab/physics/high-school/catalog";
import { SPRING_LINEAR_EXTENSION_LIMIT } from "@physics-lab/physics/high-school/elasticity";
import type { CapacitorHistory } from "@physics-lab/contracts";
import { capacitorDurationSeconds, validateCapacitorHistory } from "@physics-lab/physics/high-school/capacitor";
import { expandedRelationships, validateExpandedAnalysisReading } from "@physics-lab/physics/high-school/expandedMeasurementAnalysis";

/** Saved virtual readings. createdAt and browser storage are deliberately not required. */
export interface HighSchoolAnalysisMeasurement {
  id: string;
  timeSeconds: number;
  parameters: Record<string, number>;
  metrics: { key: string; value: number; unit?: string; label?: string }[];
  capacitorHistory?: CapacitorHistory;
}
export interface HighSchoolAnalysisValue { key: string; label: string; value: number; unit: string }
export interface HighSchoolAnalysisFit {
  /** Coefficients and quality statistics use one mean y per distinct x. */
  statisticsBasis: "distinct-x-means";
  slope: number;
  intercept: number;
  /** Null for a constant dependent variable: R² has a zero denominator. */
  rSquared: number | null;
  rmse: number;
  points: { x: number; y: number }[];
}
export interface HighSchoolAnalysisGroup {
  id: string;
  relationshipId: string;
  title: string;
  status: "ready" | "insufficient" | "unsupported";
  xAxis: { label: string; unit: string };
  yAxis: { label: string; unit: string };
  controls: HighSchoolAnalysisValue[];
  pointSource: "saved-reading" | "position-interval";
  points: {
    recordId: string; x: number; y: number;
    sourceRecordIds?: string[];
    interval?: { startTimeSeconds: number; endTimeSeconds: number; startPosition: number; endPosition: number };
  }[];
  distinctXCount: number;
  fit: HighSchoolAnalysisFit | null;
  estimates: HighSchoolAnalysisValue[];
  conditions: string[];
  reasons: string[];
  nextStep: string;
}
export interface HighSchoolMeasurementAnalysis {
  experimentId: HighSchoolExperimentId;
  provenance: "simulation";
  notice: string;
  recordCount: number;
  acceptedCount: number;
  excluded: { recordId: string; reason: string }[];
  groups: HighSchoolAnalysisGroup[];
}

type Reading = HighSchoolAnalysisMeasurement;
type Point = HighSchoolAnalysisGroup["points"][number];
export interface Relationship {
  id: string;
  title: string;
  xAxis: HighSchoolAnalysisGroup["xAxis"];
  yAxis: HighSchoolAnalysisGroup["yAxis"];
  controls(reading: Reading): HighSchoolAnalysisValue[];
  point(reading: Reading): { x: number; y: number };
  pointSource?: HighSchoolAnalysisGroup["pointSource"];
  groupPoints?(readings: Reading[]): Point[];
  estimates(fit: HighSchoolAnalysisFit, reading: Reading): HighSchoolAnalysisValue[];
  conditions: string[];
  nextStep: string;
  extraConditions?(reading: Reading): string[];
  groupingKey?(reading: Reading): string;
  unsupported?(reading: Reading): string | null;
}
const value = (key: string, label: string, amount: number, unit: string): HighSchoolAnalysisValue => ({ key, label, value: Object.is(amount, -0) ? 0 : amount, unit });
const finite = (amount: unknown): amount is number => typeof amount === "number" && Number.isFinite(amount);
const object = (candidate: unknown): candidate is Record<string, unknown> => candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);
// Ignore floating-point addition noise (e.g. two ways of transferring the same mass),
// but do not merge visibly different experimental settings.
const numberKey = (amount: number) => Number(amount.toPrecision(12)).toString();

function metric(reading: Reading, key: string, unit: string) {
  const entry = reading.metrics.find((item) => item.key === key);
  if (!entry) throw new RangeError(`缺少已保存的 ${key} 读数，不能用当前模型补造历史数据。`);
  if (entry.unit !== unit) throw new RangeError(`${key} 缺少有效单位，单位应明确为 ${unit || "无量纲"}。`);
  return entry.value;
}
function parameter(reading: Reading, key: string) { return reading.parameters[key]!; }
function positiveSlope(fit: HighSchoolAnalysisFit) {
  if (!(fit.slope > 0)) throw new RangeError("拟合斜率不为正，不能据此给出有物理意义的估计值。");
  return fit.slope;
}

function movingSystemNetForce(reading: Reading) {
  const drivingForce = parameter(reading, "hangingMass") * HIGH_SCHOOL_GRAVITY;
  const resistance = parameter(reading, "resistance");
  const force = drivingForce - resistance;
  // Match the model's static-threshold tolerance, including decimal mg = f settings.
  if (!(force > 1e-12 * Math.max(1, drivingForce, resistance))) throw new RangeError("挂码重力未超过静摩擦阈值：静止时实际合外力为零，不能将 mg−最大静摩擦力当作负的合外力参加运动拟合。");
  return force;
}

function springForcePoint(reading: Reading) {
  const extension = metric(reading, "extension", "m");
  const force = metric(reading, "force", "N");
  const naturalLength = metric(reading, "naturalLength", "m");
  const length = metric(reading, "length", "m");
  if (extension < 0 || extension > SPRING_LINEAR_EXTENSION_LIMIT || force < 0) throw new RangeError("只分析伸长量 0–0.25 m、非负弹力大小的预设线性范围；不能用超限记录推断真实弹性限度。");
  const tolerance = 1e-10 * Math.max(1, Math.abs(length), Math.abs(naturalLength));
  if (Math.abs(naturalLength - parameter(reading, "naturalLength")) > tolerance || Math.abs(length - naturalLength - extension) > tolerance) {
    throw new RangeError("保存的原长、总长与伸长量不一致，不能把总长当伸长量或用当前条件改写历史读数。");
  }
  // Never replace force/extension with mg or F/k: these are the saved graph coordinates.
  return { x: extension, y: force };
}

function forceCompositionPoint(reading: Reading) {
  const force1 = parameter(reading, "force1N"); const force2 = parameter(reading, "force2N");
  if (!(force1 > 0 && force2 > 0)) throw new RangeError("任一分力为零时两力夹角无定义，R²–cosθ 分析要求固定的 F₁、F₂ 都大于零。");
  const savedForce1 = metric(reading, "force1N", "N"); const savedForce2 = metric(reading, "force2N", "N");
  if (Math.abs(savedForce1 - force1) > 1e-10 || Math.abs(savedForce2 - force2) > 1e-10) throw new RangeError("保存的分力大小与参数条件不一致，不能混入另一组控制条件。");
  const angle = metric(reading, "angleBetweenDegrees", "°");
  const difference = Math.abs(parameter(reading, "angle2Degrees") - parameter(reading, "angle1Degrees"));
  const expectedAngle = Math.min(difference, 360 - difference);
  if (angle < 0 || angle > 180 || Math.abs(angle - expectedAngle) > 1e-9) throw new RangeError("保存的两力夹角与方向参数不一致，不能用当前角度覆盖历史记录。");
  const magnitude = metric(reading, "resultantMagnitude", "N");
  if (magnitude < 0) throw new RangeError("合力大小必须非负，有向分量不能当作合力大小。");
  // Use the saved angle and magnitude, not recomputed resultant components or
  // the learner's trial force. Exact 90° shares x=0 under rotations/reflections.
  return { x: angle === 90 ? 0 : Math.cos(angle * Math.PI / 180), y: magnitude ** 2 };
}

function positionIntervalPoints(readings: Reading[]): Point[] {
  const byTime = new Map<number, Reading[]>();
  for (const reading of readings) {
    const repeats = byTime.get(reading.timeSeconds) ?? [];
    repeats.push(reading); byTime.set(reading.timeSeconds, repeats);
  }
  const endpoints = [...byTime].sort(([a], [b]) => a - b).map(([time, repeats]) => ({
    time, position: repeats.reduce((sum, reading) => sum + metric(reading, "position", "m") / repeats.length, 0),
    ids: repeats.map((reading) => reading.id).sort()
  }));
  return endpoints.slice(1).map((end, index) => {
    const start = endpoints[index]!;
    const elapsed = end.time - start.time;
    if (elapsed <= 1e-10 * Math.max(1, Math.abs(start.time), Math.abs(end.time))) throw new RangeError("相邻记录的时间间隔过小或数值退化，不能稳定计算 Δx/Δt；请拉开记录时刻后重新采样。");
    const x = start.time + elapsed / 2;
    const y = (end.position - start.position) / elapsed;
    if (![start.position, end.position, x, y].every(Number.isFinite)) throw new RangeError("区间位置差或速度发生数值溢出，不能用于拟合。");
    const sourceRecordIds = [...start.ids, ...end.ids];
    return { recordId: `interval:${JSON.stringify([start.time, end.time, sourceRecordIds])}`, x, y, sourceRecordIds,
      interval: { startTimeSeconds: start.time, endTimeSeconds: end.time, startPosition: start.position, endPosition: end.position } };
  });
}

function relationships(id: HighSchoolExperimentId): Relationship[] {
  const expanded = expandedRelationships(id);
  if (expanded) return expanded;
  const definition = highSchoolExperiment(id);
  const controlsExcept = (except: string[]) => (reading: Reading) => definition.parameters.filter((entry) => !except.includes(entry.key)).map((entry) => value(entry.key, entry.label, parameter(reading, entry.key), entry.unit));
  if (id === "capacitor-charge") {
    const segment = (reading: Reading) => reading.capacitorHistory!.segments.at(-1)!;
    const difference = (reading: Reading) => metric(reading, "voltage", "V") - (segment(reading).mode === "charge" ? parameter(reading, "emf") : 0);
    const unsupported = (reading: Reading) => segment(reading).mode === "open" ? "本段为断路保持，电压不衰减，不能由水平线拟合RC时间常量。" : difference(reading) === 0 ? "保存电压已等于本段平衡电压，电压差为零，不能取对数或据此估计时间常量。" : null;
    const point = (reading: Reading) => ({ x: reading.timeSeconds - segment(reading).startTimeSeconds, y: unsupported(reading) ? 0 : Math.log(Math.abs(difference(reading))) });
    return [{ id: "capacitor-log-voltage-time", title: "电压差对数—段内时间：估计时间常量", xAxis: { label: "段内时间 Δt", unit: "s" }, yAxis: { label: "ln(|U−U∞|/1 V)", unit: "" },
      controls: (reading) => [...controlsExcept([])(reading), value("segmentStartTime", "本段起始时刻", segment(reading).startTimeSeconds, "s")],
      // Prefix equality separates runs, modes and all prior switching conditions.
      groupingKey: (reading) => JSON.stringify([reading.capacitorHistory, unsupported(reading)]),
      point, groupPoints: (readings) => readings.filter((reading) => !unsupported(reading)).map((reading) => ({ recordId: reading.id, ...point(reading) })), unsupported,
      estimates: (fit) => { if (!(fit.slope < 0)) throw new RangeError("对数电压差的拟合斜率须为负，不能从不衰减或增长的数据推断正的RC时间常量。"); return [value("timeConstant", "拟合时间常量 τ", -1 / fit.slope, "s"), value("decayRate", "对数衰减斜率", fit.slope, "s⁻¹"), value("logVoltageIntercept", "对数电压差截距", fit.intercept, "")]; },
      conditions: ["仅比较同一轮、同一开关段及相同完整R/C/E条件的保存读数；不能把充电、放电和断路段混在一条直线上。", "接电源段U∞=E，经R放电段U∞=0；横轴为本段已过时间，纵轴由保存的电压差除以1 V后取自然对数，未用当前模型电压补造历史点。", "对ln(|U−U∞|/1 V)作带截距拟合，斜率为−1/RC；断路或零电压差不适用。接近平衡时读数舍入和相减会放大相对误差。", "记录来自解析模型，拟合一致只用于检验模型关系，不能称为真实电容测量或实体仪器精度。"],
      extraConditions: (reading) => [`轮次 ${reading.capacitorHistory!.runId}；第 ${reading.capacitorHistory!.segments.length} 段：${{ charge: "接电源", discharge: "经R放电", open: "断路保持" }[segment(reading).mode]}。`],
      nextStep: "在同一轮的同一充电或放电段内，保持R/C/E不变，在至少3个间隔充分且电压差非零的时刻保存读数；切换后另成一组。" }];
  }
  if (id === "uniform-acceleration") return [{
    id: "velocity-time", title: "速度—时间：估计加速度", xAxis: { label: "时间 t", unit: "s" }, yAxis: { label: "速度 v", unit: "m/s" },
    controls: controlsExcept([]), point: (reading) => ({ x: reading.timeSeconds, y: metric(reading, "velocity", "m/s") }),
    estimates: (fit) => [value("acceleration", "拟合加速度", fit.slope, "m/s²"), value("initialVelocity", "拟合初速度", fit.intercept, "m/s")],
    conditions: ["同组保持初速度、加速度和观察时长不变，只比较不同时刻。", "对 v = v₀ + at 作带截距直线拟合；有向速度允许为负。"],
    nextStep: "保持当前条件，复位后在至少 3 个不同的时刻记录速度。"
  }, {
    id: "interval-velocity-time", title: "由位置求区间速度—时间：估计加速度", xAxis: { label: "区间中点时间", unit: "s" }, yAxis: { label: "区间平均速度 Δx/Δt", unit: "m/s" },
    controls: controlsExcept([]), point: (reading) => ({ x: reading.timeSeconds, y: metric(reading, "position", "m") }),
    pointSource: "position-interval", groupPoints: positionIntervalPoints,
    estimates: (fit) => [value("acceleration", "由位置区间拟合的加速度", fit.slope, "m/s²"), value("initialVelocity", "由位置区间拟合的初速度", fit.intercept, "m/s")],
    conditions: ["同组保持初速度、加速度和观察时长不变；只使用保存的位置和时刻，不读取保存的速度，也不重新计算模型答案。", "同一时刻的重复位置先取均值，再按时间排序，用相邻位置差 Δx 除以时间差 Δt；图点横轴为两端时刻的中点。", "仅在本实验的匀变速模型中，区间平均速度等于该区间中点的瞬时速度；这一等式不适用于任意变速运动。", "至少 4 个不同时刻才能形成 3 个相邻区间；保留每个区间两端的原记录编号、时刻和位置。区间共享端点，不应视为独立的实体测量。"],
    nextStep: "保持同一初速度、加速度和观察时长，复位后在至少 4 个间隔充分的不同时刻保存位置，形成至少 3 个区间；各区间不必等长。"
  }];
  if (id === "newton-second-law") return [{
    id: "acceleration-net-force", title: "加速度—系统合外力：检验牛顿第二定律", xAxis: { label: "系统合外力 mg − f", unit: "N" }, yAxis: { label: "系统加速度 a", unit: "m/s²" },
    controls: (reading) => [value("totalMass", "小车与挂码总质量", parameter(reading, "cartMass") + parameter(reading, "hangingMass"), "kg"), ...controlsExcept(["cartMass", "hangingMass"])(reading)],
    point: (reading) => ({ x: movingSystemNetForce(reading), y: metric(reading, "acceleration", "m/s²") }),
    estimates: (fit) => [value("totalMass", "由斜率估计的系统总质量", 1 / positiveSlope(fit), "kg"), value("accelerationIntercept", "加速度截距", fit.intercept, "m/s²")],
    conditions: ["把小车和挂码作为整体，M总 = M车 + m挂；固定总质量、阻力和行程，在两者之间转移质量。", "仅分析能够启动的情况，系统合外力为 mg−f，g=9.8 m/s²；mg 是挂码重力，不是绳张力。", "a = F合/M总，拟合斜率为 1/M总；从保存的加速度读数拟合，不用当前模型代填。"],
    nextStep: "保持小车与挂码总质量、阻力和行程相同，在小车与挂码间转移质量，记录至少 3 个不同且能启动的系统合外力。"
  }, {
    id: "acceleration-inverse-mass", title: "加速度—总质量倒数：保持系统合外力", xAxis: { label: "系统总质量倒数 1/(M车 + m挂)", unit: "kg⁻¹" }, yAxis: { label: "系统加速度 a", unit: "m/s²" },
    controls: controlsExcept(["cartMass"]),
    point: (reading) => { movingSystemNetForce(reading); return { x: 1 / (parameter(reading, "cartMass") + parameter(reading, "hangingMass")), y: metric(reading, "acceleration", "m/s²") }; },
    estimates: (fit) => [value("netForce", "由斜率估计的系统合外力", positiveSlope(fit), "N"), value("accelerationIntercept", "加速度截距", fit.intercept, "m/s²")],
    conditions: ["固定挂码质量、等效阻力和行程，只改变小车质量，使系统合外力 mg−f 保持不变。", "横轴使用小车与挂码总质量的倒数 1/(M车 + m挂)，不能只用小车质量，也不能把挂码重力 mg 当成绳张力。", "仅分析能够启动的情况；a = (mg−f)·1/M总，带截距拟合的斜率估计系统合外力，纵轴使用保存的加速度读数。"],
    nextStep: "固定挂码质量、等效阻力和行程，确认系统能够启动，只改变小车质量并保存至少 3 种总质量的加速度。"
  }];
  if (id === "projectile-motion") {
    const common = { controls: controlsExcept([]), conditions: ["同组固定初速度大小、抛射角与抛出高度；仅使用落地前的采样。", "忽略空气阻力，水平加速度为零，竖直向上为正；x = vₓt，vᵧ = vᵧ₀ − gt。"], nextStep: "保持同一抛出条件，复位后在至少 3 个不同的飞行时刻记录读数。", extraConditions: (reading: Reading) => [parameter(reading, "initialSpeed") === 0 ? "当前初速度大小为零，竖直初速度也为零；设置了角度也不会产生斜抛初速度。" : parameter(reading, "angleDegrees") === 0 ? "当前为平抛设置，竖直初速度为零。" : "当前为非零角度的斜抛设置，竖直初速度不为零，必须保留拟合截距，不能套用平抛的零竖直初速。"] };
    return [
      { ...common, id: "horizontal-position-time", title: "水平位移—时间：检验水平分运动", xAxis: { label: "时间 t", unit: "s" }, yAxis: { label: "水平位移 x", unit: "m" }, point: (reading) => ({ x: reading.timeSeconds, y: metric(reading, "x", "m") }), estimates: (fit) => [value("horizontalVelocity", "拟合水平速度", fit.slope, "m/s"), value("horizontalOrigin", "拟合水平起点", fit.intercept, "m")] },
      { ...common, id: "vertical-velocity-time", title: "竖直速度—时间：估计重力加速度", xAxis: { label: "时间 t", unit: "s" }, yAxis: { label: "竖直速度 vᵧ", unit: "m/s" }, point: (reading) => ({ x: reading.timeSeconds, y: metric(reading, "vy", "m/s") }), estimates: (fit) => {
        if (!(fit.slope < 0)) throw new RangeError("竖直速度斜率不为负，不能按竖直向上的约定推断重力加速度。");
        return [value("gravity", "拟合重力加速度", -fit.slope, "m/s²"), value("initialVerticalVelocity", "拟合竖直初速度", fit.intercept, "m/s")];
      } },
      { ...common, id: "vertical-drop-time-squared", title: "竖直下落距离—时间平方：平抛分运动", xAxis: { label: "时间平方 t²", unit: "s²" }, yAxis: { label: "竖直下落距离 h₀ − y", unit: "m" },
        point: (reading) => ({ x: reading.timeSeconds ** 2, y: parameter(reading, "initialHeight") - metric(reading, "y", "m") }),
        estimates: (fit) => [value("gravity", "由下落距离拟合的重力加速度", 2 * positiveSlope(fit), "m/s²"), value("verticalDropIntercept", "下落距离截距", fit.intercept, "m")],
        unsupported: (reading) => parameter(reading, "angleDegrees") !== 0 && parameter(reading, "initialSpeed") !== 0 ? "当前竖直初速度不为零，h₀−y = −vᵧ₀t + ½gt²，不能直接对 t² 作直线拟合；请使用竖直速度—时间关系，或改为平抛/零初速设置。" : null,
        conditions: ["固定初速度大小、抛射角与初始高度，只使用首次落地前及落地瞬间的保存读数。", "仅在竖直初速度为零（抛射角为 0°，或初速度大小为 0）时，h₀−y = ½gt²；纵轴是从初始高度向下的距离，不是离地高度 y。", "用保存的离地高度 y 与该记录的初始高度 h₀ 求差，不读取竖直速度或重新计算轨迹；带截距拟合斜率为 g/2。"],
        nextStep: "将抛射角设为 0°，或将初速度设为 0，并设置正的初始高度；保持同一条件，在至少 3 个不同的飞行时刻记录离地高度。" }
    ];
  }
  if (id === "pendulum") return [{
    id: "period-squared-length", title: "周期平方—摆长：小角近似分析", xAxis: { label: "摆长 L", unit: "m" }, yAxis: { label: "周期平方 T²", unit: "s²" }, controls: controlsExcept(["length"]),
    point: (reading) => { const period = metric(reading, "period", "s"); if (!(period > 0)) throw new RangeError("周期必须大于零。"); return { x: parameter(reading, "length"), y: period * period }; },
    estimates: (fit) => [value("gravity", "小角近似估计的 g", 4 * Math.PI ** 2 / positiveSlope(fit), "m/s²"), value("periodSquaredIntercept", "周期平方截距", fit.intercept, "s²")],
    unsupported: (reading) => parameter(reading, "amplitudeDegrees") > 10 ? "释放摆角超过 10°，本分析不使用小角公式反推 g；数值周期仍可展示，但不提供错误的重力加速度估计。" : null,
    conditions: ["固定摆球质量与释放摆角，只改变悬点到球心的摆长。", "仅在释放摆角 ≤10° 时使用 T²≈(4π²/g)L；结果仍含有限摆角造成的近似偏差，不是精确反推。", "保存的周期来自非线性模型计算，不是学生用秒表独立测得的周期。"],
    nextStep: "把释放摆角设为 10° 或更小，并保持摆角与质量不变，记录至少 3 种摆长的周期。"
  }];
  if (id === "emf-internal-resistance") return [{
    id: "terminal-voltage-current", title: "端电压—电流：估计电动势与内阻", xAxis: { label: "电流 I", unit: "A" }, yAxis: { label: "端电压 U", unit: "V" }, controls: controlsExcept(["loadResistance"]),
    point: (reading) => ({ x: metric(reading, "current", "A"), y: metric(reading, "terminalVoltage", "V") }),
    estimates: (fit) => {
      if (fit.slope > 1e-10 || !(fit.intercept > 0)) throw new RangeError("拟合结果不满足被动内阻电源的 E>0、r≥0，不能给出有效的电源参数。");
      return [value("emf", "拟合电动势 E", fit.intercept, "V"), value("internalResistance", "拟合内阻 r", Math.max(0, -fit.slope), "Ω")];
    },
    conditions: ["同组保持电动势和内阻不变，只改变负载电阻，不能混合不同电源设置。", "对 U = E − Ir 作带截距拟合：纵轴截距是 E，斜率的负值是 r；I>0 且 r>0 时 U<E，理想零内阻 r=0 时 U=E。", "理想零内阻电源的端电压恒定，R²无定义，用残差与斜率描述拟合。"],
    nextStep: "保持电动势与内阻不变，改变负载电阻并记录至少 3 个不同的电流值。"
  }];
  if (id === "spring-force") return [{
    id: "force-extension", title: "弹力—伸长量：估计劲度系数", xAxis: { label: "伸长量 ΔL", unit: "m" }, yAxis: { label: "弹力大小 F", unit: "N" },
    controls: controlsExcept(["loadMassGrams"]), point: springForcePoint,
    estimates: (fit) => [value("stiffness", "由斜率估计的劲度系数 k", positiveSlope(fit), "N/m"), value("forceIntercept", "弹力截距（核对零点）", fit.intercept, "N")],
    conditions: ["同组保持劲度系数与原长不变，只改变包含托盘或挂钩的悬挂总质量；g 固定为 9.8 m/s²。", "横轴使用保存的伸长量 ΔL=L−L₀，不是弹簧总长；纵轴使用保存的弹力大小。静态平衡时弹力大小等于悬挂总重力。", "作带截距的 F–ΔL 拟合，不强制经过原点；斜率估计劲度系数，截距用于核对零点。", "本模型预设伸长量 0–0.25 m 内为线性关系；拟合检查保存的理想模型采样，不是独立测量，也不能由此测定真实弹性限度、噪声或仪器精度。"],
    nextStep: "保持同一劲度系数和原长，只改变悬挂总质量，保存至少 3 个不同伸长量；可包含 0 g 的未挂载荷点，先核对原长与总长。"
  }];
  if (id === "force-composition") return [{
    id: "resultant-squared-cosine", title: "合力大小的平方—夹角余弦：检查矢量合成", xAxis: { label: "两分力夹角余弦 cosθ", unit: "" }, yAxis: { label: "合力大小的平方 R²", unit: "N²" },
    controls: controlsExcept(["angle1Degrees", "angle2Degrees", "trialForceN", "trialAngleDegrees"]), point: forceCompositionPoint,
    estimates: (fit) => [value("forceProductCoefficient", "拟合斜率（对照 2F₁F₂）", positiveSlope(fit), "N²"), value("forceSquaresIntercept", "拟合截距（对照 F₁²+F₂²）", fit.intercept, "N²")],
    conditions: ["同组固定两个非零分力的大小 F₁、F₂，改变夹角；整体旋转不改变 R²–cosθ 关系，试配力不作为控制变量。", "横轴由保存的夹角求 cosθ，纵轴由保存的合力大小求平方；不把试配力大小或按当前模型重算的合力填入历史数据。", "对 R² = F₁²+F₂²+2F₁F₂cosθ 作带截距拟合：斜率对照 2F₁F₂，截距对照 F₁²+F₂²。这里 R² 是合力大小的平方，不能与拟合优度 R² 混淆。", "这是理想矢量模型的一致性分析，不是实体测力计或橡皮筋实验，也不是独立实测或操作精度评价。"],
    nextStep: "保持两个非零分力大小不变，改变夹角并保存至少 3 个不同 cosθ；可选 0°、90°、180°，不要只整体旋转或只改变试配力。"
  }];
  if (id === "mechanical-energy") return [{
    id: "kinetic-gain-potential-loss", title: "自动模型：动能增加—势能减少", xAxis: { label: "自释放点起势能减少量 ΔEp", unit: "J" }, yAxis: { label: "自释放点起动能增加量 ΔK", unit: "J" },
    controls: controlsExcept([]),
    point: (reading) => {
      const x = metric(reading, "potentialEnergyLoss", "J"); const y = metric(reading, "kineticEnergy", "J");
      if (x < 0 || y < 0) throw new RangeError("从静止释放的模型能量读数必须非负，不能把其他区间或手动来源混入本组。");
      return { x, y };
    },
    estimates: (fit) => [value("kineticGainFraction", "模型采样拟合斜率 ΔK/ΔEp", positiveSlope(fit), ""), value("energyIntercept", "能量截距（核对起点）", fit.intercept, "J")],
    conditions: ["同组固定质量、释放高度、恒定阻力比，只改变从释放点起的记录时刻；不同条件不能混合拟合。", "自动模型从静止同步释放，所以保存的 K 等于自释放点起的 ΔK；横纵坐标都来自保存读数，不重新计算缺失能量。", "恒定向上阻力 f=rmg 时 ΔK=(1−r)ΔEp；r=0 的理论斜率为1，r>0 的机械能差对应阻力做功，不能统称空气阻力。", "这是自动模型的一致性分析，不是独立测量。手动纸带以 A/B 六个位置求 vA/vB 和 ½m(vB²−vA²)，来源和区间不同，不进入本拟合。"],
    nextStep: "保持质量、释放高度和恒定阻力比不变，在下落过程保存至少 3 个不同势能减少量；若检验自主读数，请另用纸带的两个内部点和六个位置。"
  }];
  return [{
    id: "fringe-spacing-distance", title: "近轴条纹间距—屏距：检查模型关系", xAxis: { label: "双缝到屏距离 L", unit: "m" }, yAxis: { label: "近轴条纹间距 Δx", unit: "m" }, controls: controlsExcept(["screenDistance"]),
    point: (reading) => ({ x: parameter(reading, "screenDistance"), y: metric(reading, "fringeSpacing", "m") }),
    estimates: (fit, reading) => [value("wavelengthNm", "由近轴关系反推的模型波长", positiveSlope(fit) * parameter(reading, "slitSeparationMm") * 1e6, "nm")],
    conditions: ["固定波长、缝间距和观察位置，只改变屏距，使用近轴关系 Δx≈λL/d。", "保存的 fringeSpacing 本身由模型公式计算；拟合只检查模型关系，不能当作独立测量波长的证据。", "当前记录没有实际亮纹位置与多间隔计数，不能计算真实测量精度或实验误差。"],
    nextStep: "保持波长、缝间距和观察位置不变，记录至少 3 种屏距；若要做独立测量，还需记录亮纹位置及间隔数。"
  }];
}

function validatedReading(id: HighSchoolExperimentId, raw: unknown): Reading {
  if (!object(raw) || typeof raw.id !== "string" || !raw.id.trim()) throw new RangeError("记录缺少有效编号。");
  if (!finite(raw.timeSeconds) || raw.timeSeconds < 0) throw new RangeError("记录时间必须是非负有限数值。");
  if (!object(raw.parameters)) throw new RangeError("记录缺少完整的实验参数。");
  const definition = highSchoolExperiment(id);
  if (definition.parameters.some((entry) => !Object.hasOwn(raw.parameters as object, entry.key))) throw new RangeError("记录参数不完整，不能用默认值补齐后混入分析。");
  const parameters = validatedHighSchoolParameters(id, raw.parameters as Record<string, number>);
  if (!Array.isArray(raw.metrics) || raw.metrics.some((entry: unknown) => !object(entry) || typeof entry.key !== "string" || !finite(entry.value))) throw new RangeError("记录包含缺失或非有限的读数。");
  const reading = { id: raw.id, timeSeconds: raw.timeSeconds, parameters, metrics: raw.metrics } as Reading;
  if (id === "capacitor-charge") {
    reading.capacitorHistory = validateCapacitorHistory(raw.capacitorHistory, reading.timeSeconds, capacitorDurationSeconds({ resistanceKOhm: parameters.resistanceKOhm!, capacitanceMicrofarads: parameters.capacitanceMicrofarads!, emf: parameters.emf! }));
    const voltage = metric(reading, "voltage", "V");
    if (voltage < 0 || voltage > parameters.emf!) throw new RangeError("本轮从零电压开始且电源固定，保存电压应在0与E之间。");
  } else if (raw.capacitorHistory !== undefined) throw new RangeError("非电容实验不能混入电容分段历史。");
  if (new Set(reading.metrics.map((entry) => entry.key)).size !== reading.metrics.length) throw new RangeError("记录含重名读数，无法确定应使用哪个值。");
  if (id === "spring-force" && reading.timeSeconds !== 0) throw new RangeError("弹簧实验为静态模型，记录时刻应为 0，不能把改变载荷后的平衡读数作为振荡过程。");
  if (id === "force-composition" && reading.timeSeconds !== 0) throw new RangeError("共点力矢量板为静态模型，记录时刻应为 0；不同参数状态不是物体的运动轨迹。");
  if (id === "uniform-acceleration" && reading.timeSeconds > parameter(reading, "duration")) throw new RangeError("记录时刻超过本组观察时长。");
  if (id === "projectile-motion") {
    const flightTime = metric(reading, "flightTime", "s");
    if (flightTime < 0) throw new RangeError("保存的飞行时间必须非负，才能确认有效采样窗口。");
    if (reading.timeSeconds > flightTime + 1e-9) throw new RangeError("记录时刻已超过首次落地时间，不能作为飞行段采样。");
  }
  if (id === "mechanical-energy") {
    const duration = metric(reading, "durationSeconds", "s");
    const position = metric(reading, "position", "m");
    if (!(duration > 0) || reading.timeSeconds > duration + 1e-9) throw new RangeError("记录时刻超出保存的碰撞前运动时段，不能把落地后的状态混入分析。");
    if (position < 0 || position > parameter(reading, "dropHeight") + 1e-10) throw new RangeError("保存的向下位移超出本轮释放高度。");
  }
  validateExpandedAnalysisReading(id, reading);
  return reading;
}

function distinctPoints(points: Point[]) {
  const clusters = new Map<string, { x: number; values: number[] }>();
  for (const point of points) {
    const key = numberKey(point.x);
    let entry = clusters.get(key);
    if (!entry) { entry = { x: point.x, values: [] }; clusters.set(key, entry); }
    entry.values.push(point.y);
  }
  return [...clusters.values()].map(({ x, values }) => ({ x, y: values.reduce((sum, item) => sum + item / values.length, 0) })).sort((a, b) => a.x - b.x);
}

function linearFit(points: { x: number; y: number }[]): HighSchoolAnalysisFit {
  const first = points[0]!; const last = points.at(-1)!;
  const span = last.x - first.x;
  if (!Number.isFinite(span) || span <= 1e-10 * Math.max(1, Math.abs(first.x), Math.abs(last.x))) throw new RangeError("自变量变化过小或数值退化，不能稳定拟合；请扩大采样范围。");
  const meanX = points.reduce((sum, point) => sum + point.x / points.length, 0);
  const meanY = points.reduce((sum, point) => sum + point.y / points.length, 0);
  const xx = points.reduce((sum, point) => sum + ((point.x - meanX) / span) ** 2, 0);
  const xy = points.reduce((sum, point) => sum + (point.x - meanX) / span * (point.y - meanY), 0);
  const slope = xy / xx / span;
  const intercept = meanY - slope * meanX;
  const residual = points.reduce((sum, point) => sum + (point.y - (slope * point.x + intercept)) ** 2, 0);
  const variance = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const rmse = Math.sqrt(residual / points.length);
  const ySpan = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
  const constantY = ySpan <= 1e-12 * Math.max(1, Math.abs(meanY));
  const rSquared = constantY ? null : Math.max(0, Math.min(1, 1 - residual / variance));
  const line = [first, last].map((point) => ({ x: point.x, y: slope * point.x + intercept }));
  if (![slope, intercept, rmse, ...line.flatMap((point) => [point.x, point.y])].every(Number.isFinite) || (rSquared !== null && !Number.isFinite(rSquared))) throw new RangeError("拟合数据发生数值溢出或退化，不能给出可信结果。");
  return { statisticsBasis: "distinct-x-means", slope, intercept, rSquared, rmse, points: line };
}

/** Fits saved simulation readings only. It never calls a simulator to replace missing evidence. */
export function analyzeHighSchoolMeasurements(experimentId: HighSchoolExperimentId, records: readonly HighSchoolAnalysisMeasurement[]): HighSchoolMeasurementAnalysis {
  const definitions = relationships(experimentId);
  if (!Array.isArray(records)) throw new RangeError("采样记录必须是数组。");
  const excluded: HighSchoolMeasurementAnalysis["excluded"] = [];
  const accepted: Reading[] = []; const ids = new Set<string>();
  records.forEach((raw, index) => {
    try {
      const reading = validatedReading(experimentId, raw);
      if (ids.has(reading.id)) throw new RangeError("记录编号重复，已排除重复副本。");
      for (const definition of definitions) {
        const point = definition.point(reading);
        if (![point.x, point.y].every(Number.isFinite)) throw new RangeError("分析坐标不是有限数值，可能发生了换算溢出。");
      }
      ids.add(reading.id); accepted.push(reading);
    } catch (error) {
      excluded.push({ recordId: object(raw) && typeof raw.id === "string" ? raw.id : `invalid-${index + 1}`, reason: error instanceof Error ? error.message : "无效记录。" });
    }
  });
  const groups: HighSchoolAnalysisGroup[] = [];
  for (const definition of definitions) {
    const sets = new Map<string, { controls: HighSchoolAnalysisValue[]; records: Reading[] }>();
    for (const reading of accepted) {
      const controls = definition.controls(reading);
      const controlKey = controls.map((control) => [control.key, numberKey(control.value)]);
      const key = JSON.stringify(definition.groupingKey ? [controlKey, definition.groupingKey(reading)] : controlKey);
      let entry = sets.get(key);
      if (!entry) { entry = { controls, records: [] }; sets.set(key, entry); }
      entry.records.push(reading);
    }
    if (!sets.size) sets.set("empty", { controls: [], records: [] });
    for (const [key, entry] of sets) {
      let points: Point[] = []; let pointError: string | undefined;
      try {
        points = (definition.groupPoints ? definition.groupPoints(entry.records) : entry.records.map((reading) => ({ recordId: reading.id, ...definition.point(reading) }))).sort((a, b) => a.x - b.x);
      } catch (error) { pointError = error instanceof Error ? error.message : "无法从保存的位置构造区间速度。"; }
      const distinct = distinctPoints(points); const first = entry.records[0];
      const group: HighSchoolAnalysisGroup = { id: `${definition.id}:${key}`, relationshipId: definition.id, title: definition.title, status: "insufficient", xAxis: definition.xAxis, yAxis: definition.yAxis, controls: entry.controls, pointSource: definition.pointSource ?? "saved-reading", points, distinctXCount: distinct.length, fit: null, estimates: [], conditions: [...definition.conditions, ...(first ? definition.extraConditions?.(first) ?? [] : []), "同一自变量的重复读数先取均值；至少 3 个不同自变量才作带截距拟合，重复点击不能增加独立取值数量。"], reasons: [], nextStep: definition.nextStep };
      const unsupported = first ? definition.unsupported?.(first) : null;
      if (unsupported) { group.status = "unsupported"; group.reasons.push(unsupported); }
      else if (pointError) group.reasons.push(pointError);
      else if (distinct.length < 3) group.reasons.push(group.pointSource === "position-interval" ? `本组有 ${new Set(entry.records.map((reading) => reading.timeSeconds)).size} 个不同时刻，只形成 ${points.length} 个相邻区间；至少需要 4 个不同时刻和 3 个有效区间，重复时刻或其他条件组不能补足数量。` : points.length ? `本组只有 ${distinct.length} 个不同的自变量取值，至少需要 3 个；其他控制条件不同的记录不会混入本组。` : "还没有可分析的有效采样，请先保存实验读数。");
      else if (first) {
        try {
          const fit = linearFit(distinct);
          const estimates = definition.estimates(fit, first);
          if (!estimates.every((estimate) => Number.isFinite(estimate.value))) throw new RangeError("估计值发生数值溢出，不能给出可信结果。");
          group.fit = fit; group.estimates = estimates; group.status = "ready";
        } catch (error) { group.reasons.push(error instanceof Error ? error.message : "拟合无法完成。"); }
      }
      groups.push(group);
    }
  }
  return { experimentId, provenance: "simulation", notice: "这是已保存的虚拟模型采样分析，不是真实器材测量。拟合一致性不代表实验精度，也不能代替独立测量或误差分析。", recordCount: records.length, acceptedCount: accepted.length, excluded, groups };
}
