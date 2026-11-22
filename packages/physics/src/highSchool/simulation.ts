import { createExpandedModel } from "@physics-lab/physics/high-school/expandedSimulation";
import type { HighSchoolExperimentId, HighSchoolSeries, HighSchoolSimulation } from "./types";
import { finiteNumber } from "@physics-lab/physics/high-school/types";
import { highSchoolExperiment, validatedHighSchoolParameters } from "@physics-lab/physics/high-school/catalog";
import { calculateNewtonSecondLaw, calculateProjectileMotion, calculateUniformAcceleration } from "@physics-lab/physics/high-school/kinematics";
import { calculatePendulum } from "@physics-lab/physics/high-school/pendulum";
import { assessDoubleSlitScreen, calculateDoubleSlit, calculateEmfInternalResistance } from "@physics-lab/physics/high-school/electricityOptics";
import { calculateSpringForce } from "@physics-lab/physics/high-school/elasticity";
import { calculateForceComposition } from "@physics-lab/physics/high-school/forceComposition";
import { calculateMechanicalEnergy } from "@physics-lab/physics/high-school/mechanicalEnergy";
import type { CapacitorHistory } from "@physics-lab/contracts";
import { simulateCapacitorExperiment } from "@physics-lab/physics/high-school/capacitor";

type Model = Omit<HighSchoolSimulation, "state" | "metrics"> & {
  at(time: number): Record<string, number>;
  metricFields: [key: string, label: string, unit: string][];
};

function numeric(values: Record<string, number>, key: string): number {
  const value = values[key];
  if (typeof value !== "number") throw new RangeError(`模型缺少数值字段：${key}`);
  return finiteNumber(value, key);
}

function samples(end: number, at: (time: number) => Record<string, number>, count = 120) {
  return Array.from({ length: count + 1 }, (_, i) => at(end * i / count));
}

function periodicSamples(end: number, period: number, at: (time: number) => Record<string, number>) {
  // This undamped model repeats exactly. Integrate only one cycle, then shift
  // the samples in time; 48 samples/cycle gives <2700 rows at the allowed L≥0.3m.
  const step = period / 48;
  const phases = Array.from({ length: 48 }, (_, index) => at(index * step));
  const rows: Record<string, number>[] = [];
  for (let index = 0; index * step < end; index += 1) {
    // One global time grid avoids a rounded cycle boundary overlapping a phase.
    rows.push({ ...phases[index % phases.length]!, time: index * step });
  }
  rows.push(at(end));
  return rows;
}

function series(key: string, label: string, xKey: string, xLabel: string, xUnit: string, yUnit: string, rows: Record<string, number>[]): HighSchoolSeries {
  return { key, xKey, label, xLabel, xUnit, yUnit, points: rows.map((row) => ({ x: numeric(row, xKey), y: numeric(row, key) })) };
}

function model(id: HighSchoolExperimentId, p: Record<string, number>): Model {
  const expanded = createExpandedModel(id, p);
  if (expanded) return expanded;
  if (id === "mechanical-energy") {
    const at = (time: number) => calculateMechanicalEnergy({ mass: numeric(p, "mass"), dropHeight: numeric(p, "dropHeight"), resistanceRatio: numeric(p, "resistanceRatio") }, time);
    const initial = at(0); const rows = samples(initial.durationSeconds, at);
    return { at, durationSeconds: initial.durationSeconds,
      metricFields: [["position", "向下位移", "m"], ["height", "离地高度", "m"], ["velocity", "模型速度", "m/s"], ["acceleration", "模型加速度", "m/s²"], ["kineticEnergy", "动能 K（模型从静止释放）", "J"], ["potentialEnergy", "重力势能 U", "J"], ["potentialEnergyLoss", "自释放点起势能减少量", "J"], ["dissipatedEnergy", "恒定阻力耗散能量", "J"], ["totalMechanicalEnergy", "总机械能 K+U", "J"], ["durationSeconds", "碰撞前运动时长", "s"]],
      series: [series("kineticEnergy", "动能—时间", "time", "时间", "s", "J", rows), series("potentialEnergy", "势能—时间", "time", "时间", "s", "J", rows), series("totalMechanicalEnergy", "总机械能—时间", "time", "时间", "s", "J", rows), series("kineticEnergy", "自动模型：动能增加—势能减少", "potentialEnergyLoss", "自释放点起势能减少量", "J", "J", rows)],
      equations: ["a = g(1−r)，f = rmg（向上恒定阻力）", "x = ½at²，v = at（同步从静止释放的模型）", "K = ½mv²，U = mg(H−x)，ΔEp = mgx", "ΔEp = K + fx；r=0 时 K+U 守恒", "手动纸带：vᵢ≈(yᵢ₊₁−yᵢ₋₁)/(2Δt)，Δt=0.02 s"],
      warnings: ["自动能量曲线来自理想模型，不是独立验证。手动 A/B 两点的 ΔK 必须为 ½m(vB²−vA²)，不能直接用 B 点动能代替。", "阻力设置为向上恒力，不代表真实空气阻力；到终点显示碰撞前状态，不模拟撞地。"] };
  }
  if (id === "uniform-acceleration") {
    const at = (time: number) => calculateUniformAcceleration({ initialVelocity: numeric(p, "initialVelocity"), acceleration: numeric(p, "acceleration"), duration: numeric(p, "duration") }, time);
    const rows = samples(numeric(p, "duration"), at);
    return { at, durationSeconds: numeric(p, "duration"),
      metricFields: [["position", "位移", "m"], ["velocity", "瞬时速度", "m/s"], ["acceleration", "加速度", "m/s²"]],
      series: [series("position", "位置—时间", "time", "时间", "s", "m", rows), series("velocity", "速度—时间", "time", "时间", "s", "m/s", rows)],
      equations: ["x = v₀t + ½at²", "v = v₀ + at"], warnings: [] };
  }
  if (id === "newton-second-law") {
    const at = (time: number) => calculateNewtonSecondLaw({ cartMass: numeric(p, "cartMass"), hangingMass: numeric(p, "hangingMass"), resistance: numeric(p, "resistance"), travelDistance: numeric(p, "travelDistance") }, time);
    const initial = at(0); const rows = samples(initial.durationSeconds, at);
    return { at, durationSeconds: initial.durationSeconds,
      metricFields: [["acceleration", "系统加速度", "m/s²"], ["tension", "绳张力", "N"], ["totalMass", "系统总质量", "kg"], ["position", "小车位移", "m"]],
      series: [series("velocity", "速度—时间", "time", "时间", "s", "m/s", rows), series("position", "位置—时间", "time", "时间", "s", "m", rows)],
      equations: ["a = (mg − f)/(M + m)（能够启动时）", "T − f = Ma；mg − T = ma"],
      warnings: initial.acceleration === 0 ? ["挂码重力不超过最大静摩擦力，系统保持静止；不能把它解释为反向加速。"] : [] };
  }
  if (id === "projectile-motion") {
    const at = (time: number) => calculateProjectileMotion({ initialSpeed: numeric(p, "initialSpeed"), angleDegrees: numeric(p, "angleDegrees"), initialHeight: numeric(p, "initialHeight") }, time);
    const initial = at(0); const rows = samples(initial.flightTime, at);
    return { at, durationSeconds: initial.flightTime,
      metricFields: [["x", "水平位移", "m"], ["y", "离地高度", "m"], ["vx", "水平速度", "m/s"], ["vy", "竖直速度", "m/s"], ["flightTime", "飞行时间", "s"], ["range", "水平射程", "m"]],
      series: [series("y", "运动轨迹", "x", "水平位移", "m", "m", rows), series("vy", "竖直速度—时间", "time", "时间", "s", "m/s", rows)],
      equations: ["x = v₀ cosθ · t", "y = h₀ + v₀ sinθ · t − ½gt²"],
      warnings: initial.flightTime === 0 ? ["物体从地面水平静止或水平抛出时没有离地飞行段，请增加高度或抛射角。"] : [] };
  }
  if (id === "pendulum") {
    const at = (time: number) => calculatePendulum({ length: numeric(p, "length"), amplitudeDegrees: numeric(p, "amplitudeDegrees"), mass: numeric(p, "mass") }, time);
    const initial = at(0);
    const rows = periodicSamples(initial.durationSeconds, initial.period, at);
    return { at, durationSeconds: initial.durationSeconds,
      metricFields: [["period", "数值周期", "s"], ["smallAnglePeriod", "小角近似周期", "s"], ["periodIncreasePercent", "周期增幅", "%"], ["totalEnergy", "机械能", "J"]],
      series: [series("angleDegrees", "摆角—时间", "time", "时间", "s", "°", rows), series("kineticEnergy", "动能—时间", "time", "时间", "s", "J", rows), series("potentialEnergy", "势能—时间", "time", "时间", "s", "J", rows)],
      equations: ["θ″ = −(g/L)sinθ", "T₀ = 2π√(L/g)（小角近似）", "E = ½mL²ω² + mgL(1 − cosθ)"],
      warnings: numeric(p, "amplitudeDegrees") > 15 ? ["摆角已超过 15°：当前动画使用非线性方程，小角周期只作比较，不能当作精确值。"] : [] };
  }
  if (id === "emf-internal-resistance") {
    const at = () => calculateEmfInternalResistance({ emf: numeric(p, "emf"), internalResistance: numeric(p, "internalResistance"), loadResistance: numeric(p, "loadResistance") });
    const minimumLoad = 0.1; const maximumLoad = 50;
    // Geometric spacing resolves the low-resistance peak. Always retain the exact
    // working point and R = r maximum when it is inside the displayed domain.
    const loads = new Set([minimumLoad, maximumLoad, numeric(p, "loadResistance")]);
    for (let i = 1; i < 120; i += 1) loads.add(minimumLoad * (maximumLoad / minimumLoad) ** (i / 120));
    const internalResistance = numeric(p, "internalResistance");
    if (internalResistance >= minimumLoad && internalResistance <= maximumLoad) loads.add(internalResistance);
    const rows = [...loads].sort((a, b) => a - b).map((loadResistance) => calculateEmfInternalResistance({ emf: numeric(p, "emf"), internalResistance, loadResistance }));
    const characteristic = series("terminalVoltage", "电源端电压—电流", "current", "电流", "A", "V", rows);
    characteristic.points.push({ x: 0, y: numeric(p, "emf") });
    characteristic.points.sort((a, b) => a.x - b.x);
    return { at, durationSeconds: 0,
      metricFields: [["emf", "电动势 E", "V"], ["terminalVoltage", "端电压 U", "V"], ["current", "电流 I", "A"], ["loadPower", "负载功率", "W"], ["internalPower", "内阻发热功率", "W"]],
      series: [characteristic, series("loadPower", "负载功率—电阻", "loadResistance", "负载电阻", "Ω", "W", rows)],
      equations: ["I = E/(R + r)", "U = IR = E − Ir", "EI = I²R + I²r"], warnings: [] };
  }
  if (id === "spring-force") {
    const parameters = { stiffness: numeric(p, "stiffness"), naturalLength: numeric(p, "naturalLength"), loadMassGrams: numeric(p, "loadMassGrams") };
    const at = () => calculateSpringForce(parameters);
    const loadRange = highSchoolExperiment(id).parameters.find((parameter) => parameter.key === "loadMassGrams")!;
    const loads = new Set([loadRange.min, loadRange.max, parameters.loadMassGrams]);
    for (let i = 1; i < 50; i++) loads.add(loadRange.min + (loadRange.max - loadRange.min) * i / 50);
    const rows = [...loads].sort((a, b) => a - b).map((loadMassGrams) => calculateSpringForce({ ...parameters, loadMassGrams }));
    return { at, durationSeconds: 0,
      metricFields: [["force", "弹力大小 F", "N"], ["extension", "伸长量 ΔL", "m"], ["length", "弹簧总长 L", "m"], ["naturalLength", "弹簧原长 L₀", "m"]],
      series: [series("force", "弹力—伸长量", "extension", "伸长量 ΔL", "m", "N", rows)],
      equations: ["F = mg（静态平衡；m 为含托盘的悬挂总质量）", "ΔL = L − L₀", "F = kΔL（预设线性范围内）"],
      warnings: ["本模型预设伸长量 0–0.25 m 内为线性关系；这些理想采样不能用来测定真实弹性限度。0 g 表示未挂载荷，不暗含额外托盘质量。"] };
  }
  if (id === "force-composition") {
    const parameters = { force1N: numeric(p, "force1N"), angle1Degrees: numeric(p, "angle1Degrees"), force2N: numeric(p, "force2N"), angle2Degrees: numeric(p, "angle2Degrees"), trialForceN: numeric(p, "trialForceN"), trialAngleDegrees: numeric(p, "trialAngleDegrees") };
    const at = () => calculateForceComposition(parameters);
    const state = at();
    const cosineValues = new Set([state.angleBetweenCosine, ...Array.from({ length: 101 }, (_, index) => -1 + index / 50)]);
    const rows = [...cosineValues].sort((a, b) => a - b).map((angleBetweenCosine) => ({ angleBetweenCosine,
      resultantSquared: angleBetweenCosine === state.angleBetweenCosine ? state.resultantSquared : Math.max(0, parameters.force1N ** 2 + parameters.force2N ** 2 + 2 * parameters.force1N * parameters.force2N * angleBetweenCosine) }));
    const metricFields: Model["metricFields"] = [["force1N", "分力 F₁ 大小", "N"], ["force2N", "分力 F₂ 大小", "N"], ["resultantX", "合力 x 分量", "N"], ["resultantY", "合力 y 分量", "N"], ["resultantMagnitude", "合力大小 R", "N"], ["trialForceN", "试配等效拉力大小", "N"], ["residualMagnitude", "试配力与合力的矢量差大小", "N"]];
    if (state.resultantDirectionDefined) metricFields.push(["resultantAngleDegrees", "合力方向角", "°"]);
    if (state.angleBetweenDefined) metricFields.push(["angleBetweenDegrees", "两分力夹角 θ", "°"]);
    return { at, durationSeconds: 0, metricFields,
      series: state.angleBetweenDefined ? [series("resultantSquared", "合力大小的平方—夹角余弦", "angleBetweenCosine", "夹角余弦 cosθ", "", "N²", rows)] : [],
      equations: ["Rₓ = F₁ cosα + F₂ cosβ；Rᵧ = F₁ sinα + F₂ sinβ", "R² = F₁² + F₂² + 2F₁F₂ cosθ（两力均非零）", "矢量差 ΔF = F试 − R；等效力为 R，平衡力为 −R"],
      warnings: ["这是理想共点力矢量板；试配力由你独立调节，矢量差不是实体仪器的测量误差。", ...(!state.resultantDirectionDefined ? ["合力为零，没有合力方向；不要把角度占位值 0° 当作方向。"] : []), ...(!state.angleBetweenDefined ? ["至少一个分力为零，两力夹角无定义，不能进行 R²–cosθ 拟合。"] : [])] };
  }
  const screen = assessDoubleSlitScreen({ wavelengthNm: numeric(p, "wavelengthNm"), slitSeparationMm: numeric(p, "slitSeparationMm"), screenDistance: numeric(p, "screenDistance") });
  const at = () => ({ ...calculateDoubleSlit({ wavelengthNm: numeric(p, "wavelengthNm"), slitSeparationMm: numeric(p, "slitSeparationMm"), screenDistance: numeric(p, "screenDistance"), screenPositionMm: numeric(p, "screenPositionMm") }), visibleBrightFringeCount: screen.visibleBrightFringeCount, canMeasureFringeSpacing: screen.canMeasureFringeSpacing ? 1 : 0 });
  const rows = Array.from({ length: 1601 }, (_, i) => calculateDoubleSlit({ wavelengthNm: numeric(p, "wavelengthNm"), slitSeparationMm: numeric(p, "slitSeparationMm"), screenDistance: numeric(p, "screenDistance"), screenPositionMm: -20 + i / 40 }));
  return { at, durationSeconds: 0,
    metricFields: [["pathDifference", "光程差", "m"], ["intensity", "相对光强", ""], ["fringeSpacing", "近轴条纹间距", "m"], ["visibleBrightFringeCount", "屏内亮纹数", "条"]],
    series: [series("intensity", "屏幕干涉光强", "screenPositionMm", "距屏幕中心位置", "mm", "相对光强", rows)],
    equations: ["Δ = √(L² + (y + d/2)²) − √(L² + (y − d/2)²)", "I/Imax = cos²(πΔ/λ)", "Δy ≈ λL/d（近轴）"],
    warnings: ["光强曲线使用精确几何光程差；等间距公式仅用于近轴比较，未包含有限缝宽的衍射包络。", ...(!screen.canMeasureFringeSpacing ? ["当前 ±20 mm 屏区内只有中央一条亮纹，无法选择两条亮纹测间距；请缩短屏距或增大缝间距，再进行虚拟读尺。"] : [])] };
}

// Parameter changes rebuild the sampled curves; animation frames only evaluate the current state.
const models = new Map<string, Model>();
export function simulateHighSchoolExperiment(id: HighSchoolExperimentId, parameters: Record<string, number>, timeSeconds = 0, history?: CapacitorHistory): HighSchoolSimulation {
  finiteNumber(timeSeconds, "时间");
  const p = validatedHighSchoolParameters(id, parameters);
  if (id === "capacitor-charge") return simulateCapacitorExperiment({ resistanceKOhm: numeric(p, "resistanceKOhm"), capacitanceMicrofarads: numeric(p, "capacitanceMicrofarads"), emf: numeric(p, "emf") }, history!, timeSeconds);
  if (history !== undefined) throw new RangeError("只有电容器充放电实验接收开关分段历史。");
  const key = `${id}:${JSON.stringify(p)}`;
  let current = models.get(key);
  if (!current) {
    current = model(id, p);
    models.set(key, current);
    if (models.size > 12) models.delete(models.keys().next().value!);
  }
  const state = current.at(timeSeconds);
  return { durationSeconds: current.durationSeconds, state, series: current.series, equations: current.equations, warnings: current.warnings,
    metrics: current.metricFields.map(([field, label, unit]) => ({ key: field, label, value: numeric(state, field), unit })) };
}
