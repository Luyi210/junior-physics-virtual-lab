import type { HighSchoolExperimentId } from "./types";
import { finiteNumber } from "@physics-lab/physics/high-school/types";
import { highSchoolExperiment } from "@physics-lab/physics/high-school/catalog";
import { calculatePendulumPeriod } from "@physics-lab/physics/high-school/pendulum";
import { HIGH_SCHOOL_GRAVITY } from "@physics-lab/physics/high-school/types";
import { calculateMechanicalEnergy, mechanicalEnergyTapePoints, MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS } from "@physics-lab/physics/high-school/mechanicalEnergy";

export const MANUAL_TIME_RESOLUTION_SECONDS = 0.01;
export const MANUAL_SCREEN_RESOLUTION_MM = 0.1;
export const MANUAL_TAPE_RESOLUTION_MM = 0.1;
export const MECHANICAL_ENERGY_TAPE_READING_KEYS = ["mass", "dropHeight", "resistanceRatio", "indexA", "indexB",
  "aBeforeMm", "aCenterMm", "aAfterMm", "bBeforeMm", "bCenterMm", "bAfterMm"] as const;
export type MechanicalEnergyTapeMeasurementInput = { [Key in typeof MECHANICAL_ENERGY_TAPE_READING_KEYS[number]]: number };

export interface PendulumTimingMeasurementInput {
  startTimeSeconds: number;
  endTimeSeconds: number;
  /** Complete oscillations between the same phase and direction, not half swings. */
  periodCount: number;
  length: number;
  amplitudeDegrees: number;
}
export interface DoubleSlitPositionMeasurementInput {
  leftPositionMm: number;
  rightPositionMm: number;
  /** Adjacent bright-fringe intervals, not the number of bright fringes. */
  intervalCount: number;
  slitSeparationMm: number;
  screenDistance: number;
}
export interface ManualMeasurementMetric { key: string; label: string; value: number; unit: string }
export interface ManualMeasurementResult {
  kind: "pendulum-timing" | "double-slit-positions" | "mechanical-energy-tape";
  provenance: "virtual-manual";
  /** The actual displayed readings used in the calculation, plus the given settings. */
  readings: Record<string, number>;
  metrics: ManualMeasurementMetric[];
  assumptions: string[];
  warnings: string[];
  resolution: { value: number; unit: "s" | "mm" };
}

function objectInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RangeError("手动读数必须是完整的输入对象。");
}
function setting(id: HighSchoolExperimentId, key: string, value: number) {
  const parameter = highSchoolExperiment(id).parameters.find((entry) => entry.key === key)!;
  return finiteNumber(value, parameter.label, parameter.min, parameter.max);
}
function integerCount(value: number, label: string) {
  finiteNumber(value, label, 1, 100);
  if (!Number.isInteger(value)) throw new RangeError(`${label}必须是 1 至 100 的整数。`);
  return value;
}
/** Symmetric rounding: positive and negative screen coordinates use the same rule. */
function displayed(value: number, resolution: number) {
  const scaled = Math.abs(value) / resolution;
  const result = Math.sign(value) * Math.round(scaled + Number.EPSILON * Math.max(1, scaled)) * resolution;
  return Number(result.toFixed(2));
}
export function quantizeManualTimeSeconds(timeSeconds: number) {
  return displayed(finiteNumber(timeSeconds, "虚拟计时读数", 0, 3600), MANUAL_TIME_RESOLUTION_SECONDS);
}
export function quantizeManualScreenPositionMm(positionMm: number) {
  return displayed(setting("double-slit", "screenPositionMm", positionMm), MANUAL_SCREEN_RESOLUTION_MM);
}
export function quantizeMechanicalEnergyTapePositionMm(positionMm: number) {
  return displayed(finiteNumber(positionMm, "纸带向下位置读数", 0, 2000), MANUAL_TAPE_RESOLUTION_MM);
}
const metric = (key: string, label: string, value: number, unit: string): ManualMeasurementMetric => ({ key, label, value, unit });

/** Derived quantities use only user-operated readings. The model period is a separate review hint, never a replacement. */
export function calculatePendulumTimingMeasurement(input: PendulumTimingMeasurementInput): ManualMeasurementResult {
  objectInput(input);
  const startTimeSeconds = quantizeManualTimeSeconds(input.startTimeSeconds);
  const endTimeSeconds = quantizeManualTimeSeconds(input.endTimeSeconds);
  const periodCount = integerCount(input.periodCount, "完整周期数");
  const length = setting("pendulum", "length", input.length);
  const amplitudeDegrees = setting("pendulum", "amplitudeDegrees", input.amplitudeDegrees);
  if (input.endTimeSeconds <= input.startTimeSeconds) throw new RangeError("停止计时必须晚于开始计时；如果实验已复位，请重新开始计时。");
  const elapsedTime = displayed(endTimeSeconds - startTimeSeconds, MANUAL_TIME_RESOLUTION_SECONDS);
  if (elapsedTime <= 0) throw new RangeError("起止读数在 0.01 s 显示分辨率下相同，请延长计时区间。");
  const period = elapsedTime / periodCount;
  const metrics = [metric("elapsedTime", "虚拟计时区间 Δt", elapsedTime, "s"), metric("period", "按完整周期数求得的周期 T", period, "s")];
  const warnings = ["这些读数来自虚拟场景中的手动计时，不是真实器材实测；显示分辨率不能当作测量精度。"];
  if (amplitudeDegrees <= 10) {
    metrics.push(metric("gravity", "小角近似估计的 g", 4 * Math.PI ** 2 * length / period ** 2, "m/s²"));
    warnings.push("当前摆角不超过 10°，g 使用小角近似，仍可能包含有限摆角、起止时机与周期计数造成的偏差。");
  } else warnings.push("摆角超过 10°，小角公式不适用本次 g 估计；只给出由计时读数求得的周期，不输出 g。");
  // The ideal pendulum period is mass-independent; this positive mass only satisfies the shared model input.
  // A discrepancy prompts review without repairing the student's count, changing derived metrics, or grading the operation.
  const referencePeriod = calculatePendulumPeriod({ length, amplitudeDegrees, mass: 0.1 }).period;
  if (Math.abs(period / referencePeriod - 1) > 0.25) {
    warnings.unshift(`计时周期与同条件模型相差超过 25%，请核对起止时机和完整周期数；${amplitudeDegrees <= 10 ? "本次数值不应当作有效 g 估计；" : ""}原始读数和算术结果保留。这是复核提示，不是测量精度或自动操作判分。`);
  }
  return {
    kind: "pendulum-timing", provenance: "virtual-manual",
    readings: { startTimeSeconds, endTimeSeconds, periodCount, length, amplitudeDegrees }, metrics,
    assumptions: ["完整周期指回到同一位置且运动方向相同的一次往返；开始与停止应选择相同相位和方向。", "起止计时读数各按 0.01 s 分辨率显示，再计算 Δt = t停止 − t开始、T = Δt/N。", "0.01 s 只是显示读数分辨率；实验时钟按 1/60 s 步进，不能把显示小数位称为实体秒表精度。", "摆长从悬点量到摆球重心；小角公式为 g≈4π²L/T²，只在本模块限定的摆角 ≤10° 时给出。", "周期数由使用者输入，本模块没有自动数摆动次数，也没有使用理论周期替代起止读数。", "25% 仅为相对同条件非线性模型周期的复核提示阈值，不代表测量精度，也不用于自动操作判分；未触发提醒不等于计数或时机正确。"],
    warnings, resolution: { value: MANUAL_TIME_RESOLUTION_SECONDS, unit: "s" }
  };
}

/** Uses two independently selected virtual screen positions; wavelength is not an input. */
export function calculateDoubleSlitPositionMeasurement(input: DoubleSlitPositionMeasurementInput): ManualMeasurementResult {
  objectInput(input);
  const leftPositionMm = quantizeManualScreenPositionMm(input.leftPositionMm);
  const rightPositionMm = quantizeManualScreenPositionMm(input.rightPositionMm);
  const intervalCount = integerCount(input.intervalCount, "相邻亮纹间隔数");
  const slitSeparationMm = setting("double-slit", "slitSeparationMm", input.slitSeparationMm);
  const screenDistance = setting("double-slit", "screenDistance", input.screenDistance);
  if (input.rightPositionMm < input.leftPositionMm) throw new RangeError("右侧读数必须位于左侧读数右边，请交换读数顺序；屏坐标以向右为正。");
  const spanMm = displayed(rightPositionMm - leftPositionMm, MANUAL_SCREEN_RESOLUTION_MM);
  if (spanMm <= 0) throw new RangeError("两位置在 0.1 mm 显示分辨率下重合，请选择分开的两条亮纹。");
  const fringeSpacingMm = spanMm / intervalCount;
  const wavelengthNm = fringeSpacingMm * slitSeparationMm / screenDistance * 1000;
  const warnings = ["这是虚拟屏幕上手动选点得到的近轴估计，不是真实光学器材测量；0.1 mm 是显示分辨率，不代表测量精度。", "必须自行辨认两条亮纹和中间的相邻间隔数；计算不会判断选点是否恰好落在亮纹中心。"];
  const wavelengthRange = highSchoolExperiment("double-slit").parameters.find((entry) => entry.key === "wavelengthNm")!;
  if (wavelengthNm < wavelengthRange.min || wavelengthNm > wavelengthRange.max) warnings.push(`估计波长超出本实验 ${wavelengthRange.min}–${wavelengthRange.max} nm 的设置范围，请检查坐标、单位和相邻间隔数。`);
  return {
    kind: "double-slit-positions", provenance: "virtual-manual",
    readings: { leftPositionMm, rightPositionMm, intervalCount, slitSeparationMm, screenDistance },
    metrics: [metric("spanMm", "两亮纹之间的总跨度", spanMm, "mm"), metric("fringeSpacingMm", "平均相邻亮纹间距 Δx", fringeSpacingMm, "mm"), metric("wavelengthNm", "近轴估计波长 λ", wavelengthNm, "nm")],
    assumptions: ["屏坐标以向右为正，右读数必须大于左读数；两坐标先按 0.1 mm 分辨率显示后再求差。", "N 表示相邻亮纹间隔数；数到 k 条亮纹时通常只有 k−1 个间隔，不能直接把亮纹条数当成 N。", "Δx = (x右−x左)/N，近轴条件下 λ≈Δx·d/L；毫米转米后再把波长换算为纳米。", "两点应属于同一双缝设置，且位于近轴屏区；缝间距 d 不是单条狭缝宽度。", "估计仅使用选定坐标、间隔数、缝间距与屏距，不读取已知波长或理论条纹间距。"],
    warnings, resolution: { value: MANUAL_SCREEN_RESOLUTION_MM, unit: "mm" }
  };
}

/** Independent position readings determine velocities/energies. The motion
 * model is used ONLY to bound valid tape indices, never to repair a position or
 * derive a replacement speed from time, height or an energy conservation law. */
export function calculateMechanicalEnergyTapeMeasurement(input: MechanicalEnergyTapeMeasurementInput): ManualMeasurementResult {
  objectInput(input);
  if (Object.keys(input).length !== MECHANICAL_ENERGY_TAPE_READING_KEYS.length ||
      MECHANICAL_ENERGY_TAPE_READING_KEYS.some((key) => !Object.hasOwn(input, key))) {
    throw new RangeError("纸带记录必须包含完整的三个条件、A/B编号和六个独立位置读数。");
  }
  const mass = setting("mechanical-energy", "mass", input.mass);
  const dropHeight = setting("mechanical-energy", "dropHeight", input.dropHeight);
  const resistanceRatio = setting("mechanical-energy", "resistanceRatio", input.resistanceRatio);
  const lastIndex = mechanicalEnergyTapePoints({ mass, dropHeight, resistanceRatio }).at(-1)!.index;
  const indexA = finiteNumber(input.indexA, "A 点编号", 1, lastIndex - 1);
  const indexB = finiteNumber(input.indexB, "B 点编号", 1, lastIndex - 1);
  if (!Number.isInteger(indexA) || !Number.isInteger(indexB) || indexB <= indexA) {
    throw new RangeError("A/B 必须是具有左右相邻计时点的内部整数编号，并且 B>A。");
  }
  const positions = ["aBeforeMm", "aCenterMm", "aAfterMm", "bBeforeMm", "bCenterMm", "bAfterMm"] as const;
  // A displayed endpoint may round slightly above the exact geometric height.
  // Check the stored reading against the same ruler resolution, not hidden digits.
  const displayedMaximumMm = quantizeMechanicalEnergyTapePositionMm(dropHeight * 1000);
  const readings: MechanicalEnergyTapeMeasurementInput = { mass, dropHeight, resistanceRatio, indexA, indexB,
    ...Object.fromEntries(positions.map((key) => [key, quantizeMechanicalEnergyTapePositionMm(finiteNumber(input[key], key, 0, Math.max(dropHeight * 1000, displayedMaximumMm)))]))
  } as MechanicalEnergyTapeMeasurementInput;
  if (positions.some((key) => readings[key] > displayedMaximumMm)) throw new RangeError("量化后的位置读数超出本轮显示的下落范围。");
  const indexed = new Map<number, number>();
  for (const [index, position] of [[indexA - 1, readings.aBeforeMm], [indexA, readings.aCenterMm], [indexA + 1, readings.aAfterMm],
    [indexB - 1, readings.bBeforeMm], [indexB, readings.bCenterMm], [indexB + 1, readings.bAfterMm]]) {
    if (indexed.has(index!) && indexed.get(index!) !== position) throw new RangeError("A/B 两组三点共享同一个计时点时，原始位置读数必须一致，不能把它记成两个位置。");
    indexed.set(index!, position!);
  }
  const ordered = [...indexed.entries()].sort((a, b) => a[0] - b[0]);
  if (ordered.some((entry, index) => index > 0 && entry[1] <= ordered[index - 1]![1])) {
    throw new RangeError("纸带位置应随计时点编号严格向下递增；请检查次序、单位和重合读数。");
  }
  const interval = MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS;
  const velocityA = (readings.aAfterMm - readings.aBeforeMm) / 1000 / (2 * interval);
  const velocityB = (readings.bAfterMm - readings.bBeforeMm) / 1000 / (2 * interval);
  const dropDistance = (readings.bCenterMm - readings.aCenterMm) / 1000;
  const kineticEnergyIncrease = 0.5 * mass * (velocityB ** 2 - velocityA ** 2);
  const potentialEnergyLoss = mass * HIGH_SCHOOL_GRAVITY * dropDistance;
  const energyDifference = potentialEnergyLoss - kineticEnergyIncrease;
  const warnings = ["这是虚拟纸带上的自主读数，不是真实器材实测；0.1 mm 仅是显示读数分辨率，不代表测量精度或已完成正确操作。", "读数和点号由使用者输入，系统只检查范围、次序、共享点一致性，不会用模型位置、gt 或 √(2gh) 替换你的读数或速度。", "能量差保留原始算术结果；不能仅凭接近零就判定测量准确、已掌握或真实装置机械能严格守恒。"];
  if (kineticEnergyIncrease < 0 || energyDifference < -1e-12) warnings.unshift("本次读数算出的动能增加为负或大于势能减少；请复核六个位置、点号和单位。保留原值，不自动修正，也不把算术差解释为装置产生了能量。");
  return { kind: "mechanical-energy-tape", provenance: "virtual-manual", readings,
    metrics: [metric("sampleIntervalSeconds", "相邻计时点间隔 Δt", interval, "s"), metric("velocityA", "由相邻位置估计的 A 点速度", velocityA, "m/s"), metric("velocityB", "由相邻位置估计的 B 点速度", velocityB, "m/s"),
      metric("dropDistance", "A 到 B 的下降距离", dropDistance, "m"), metric("kineticEnergyIncrease", "A 到 B 的动能增加量 ΔK", kineticEnergyIncrease, "J"), metric("potentialEnergyLoss", "A 到 B 的势能减少量 ΔEp", potentialEnergyLoss, "J"), metric("energyDifference", "算术差 ΔEp−ΔK", energyDifference, "J")],
    assumptions: ["向下位置以同一零点为参考，输入单位为 mm；先按 0.1 mm 显示分辨率量化，再换为 m 计算。", "计时点固定间隔 Δt=0.02 s。A/B 均是有两侧相邻点的内部点；共享点必须给出相同的原始位置。", "vA≈(yA+1−yA−1)/(2Δt)，vB≈(yB+1−yB−1)/(2Δt)。匀变速模型中两侧平均速度等于中点瞬时速度，不能泛化为任意运动的精确公式。", "ΔK=½m(vB²−vA²)，ΔEp=mg(yB−yA)，g=9.8 m/s²；A 不是释放点，不能把 B 点动能直接当成动能增加量。", "本页模型的释放和计时同步、初速度为零；真实纸带首个可辨点未必是释放瞬间，手动计算不假定 A 点速度为零。", "resistanceRatio 仅用于核对当前模型的有效计时点范围，不参与由六个读数求速度或能量变化的算术计算；不修正学生读数。"],
    warnings, resolution: { value: MANUAL_TAPE_RESOLUTION_MM, unit: "mm" } };
}

/** Shared boundary check for UI, local repositories and server revalidation. */
export function validateMechanicalEnergyTapeObservation(parameters: Record<string, number>, readings: Record<string, number>, timeSeconds: number): void {
  objectInput(parameters); objectInput(readings);
  const keys = ["mass", "dropHeight", "resistanceRatio"] as const;
  if (Object.keys(parameters).length !== keys.length || keys.some((key) => !Object.hasOwn(parameters, key) || parameters[key] !== readings[key])) {
    throw new RangeError("纸带读数条件与当时完整参数快照不一致。");
  }
  const result = calculateMechanicalEnergyTapeMeasurement(readings as MechanicalEnergyTapeMeasurementInput);
  if (MECHANICAL_ENERGY_TAPE_READING_KEYS.some((key) => readings[key] !== result.readings[key])) throw new RangeError("保存的纸带原始位置必须已经按 0.1 mm 显示，不能由校验过程改写。");
  const state = calculateMechanicalEnergy({ mass: parameters.mass!, dropHeight: parameters.dropHeight!, resistanceRatio: parameters.resistanceRatio! });
  finiteNumber(timeSeconds, "纸带记录时刻", 0, state.durationSeconds);
  const lastVisible = mechanicalEnergyTapePoints(parameters, timeSeconds).at(-1)!.index;
  if (readings.indexB! + 1 > lastVisible) throw new RangeError("B 点右侧相邻计时点尚未出现；请保留输入并继续运行到所需等时点可见后再保存。");
}
