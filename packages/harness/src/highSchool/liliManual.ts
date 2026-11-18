import type { LiliExperimentContext, LiliManualSample } from "@physics-lab/contracts";
import {
  calculateDoubleSlitPositionMeasurement,
  calculatePendulumTimingMeasurement,
  calculateMechanicalEnergyTapeMeasurement,
  MECHANICAL_ENERGY_TAPE_READING_KEYS,
  validateMechanicalEnergyTapeObservation,
  highSchoolExperiment,
  PENDULUM_OBSERVATION_SECONDS,
  quantizeManualTimeSeconds,
  validatedHighSchoolParameters
} from "@physics-lab/physics/high-school";
import type { ManualMeasurementResult, MechanicalEnergyTapeMeasurementInput } from "@physics-lab/physics/high-school";

type ManualContext = Pick<LiliExperimentContext, "manualRecordCount" | "manualSamples">;
type ManualExperimentId = "pendulum" | "double-slit" | "mechanical-energy";
export interface LiliManualReferenceRecord extends LiliManualSample {
  metrics: ManualMeasurementResult["metrics"];
  assumptions: string[];
  warnings: string[];
  resolution: ManualMeasurementResult["resolution"];
}
export interface LiliManualReference {
  provenance: "virtual-manual";
  totalSavedCount: number;
  includedCount: number;
  omittedCount: number;
  notice: string;
  records: LiliManualReferenceRecord[];
}

const readingKeys = {
  pendulum: ["startTimeSeconds", "endTimeSeconds", "periodCount", "length", "amplitudeDegrees"],
  "double-slit": ["leftPositionMm", "rightPositionMm", "intervalCount", "slitSeparationMm", "screenDistance"],
  "mechanical-energy": MECHANICAL_ENERGY_TAPE_READING_KEYS
} as const;
const expectedKind = { pendulum: "pendulum-timing", "double-slit": "double-slit-positions", "mechanical-energy": "mechanical-energy-tape" } as const;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function numericFields(value: unknown, keys: readonly string[], label: string): Record<string, number> {
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new RangeError(`${label}必须保留完整且明确的字段`);
  if (Object.values(value).some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) throw new RangeError(`${label}必须是有限数值`);
  return { ...value } as Record<string, number>;
}

/** Recompute arithmetic from user readings only; no model time, period or wavelength is substituted. */
function calculateReadings(kind: LiliManualSample["kind"], readings: Record<string, number>): ManualMeasurementResult {
  if (kind === "mechanical-energy-tape") return calculateMechanicalEnergyTapeMeasurement(readings as MechanicalEnergyTapeMeasurementInput);
  return kind === "pendulum-timing"
    ? calculatePendulumTimingMeasurement({ startTimeSeconds: readings.startTimeSeconds!, endTimeSeconds: readings.endTimeSeconds!, periodCount: readings.periodCount!, length: readings.length!, amplitudeDegrees: readings.amplitudeDegrees! })
    : calculateDoubleSlitPositionMeasurement({ leftPositionMm: readings.leftPositionMm!, rightPositionMm: readings.rightPositionMm!, intervalCount: readings.intervalCount!, slitSeparationMm: readings.slitSeparationMm!, screenDistance: readings.screenDistance! });
}

/** Independent of lili.ts so both local guidance and the server can validate without an import cycle. */
export function prepareLiliManualContext(experimentId: string, value: unknown): ManualContext {
  if (!object(value)) throw new RangeError("手动虚拟读数上下文格式不正确");
  if (value.manualRecordCount === undefined && value.manualSamples === undefined) return {};
  if (experimentId !== "pendulum" && experimentId !== "double-slit" && experimentId !== "mechanical-energy") throw new RangeError("当前实验不支持手动虚拟仪器记录");
  if (!Number.isSafeInteger(value.manualRecordCount) || Number(value.manualRecordCount) < 0 || Number(value.manualRecordCount) > 2000) throw new RangeError("手动记录条数必须是 0 至 2000 的整数");
  const result: ManualContext = { manualRecordCount: Number(value.manualRecordCount) };
  if (value.manualSamples === undefined) return result;
  if (!Array.isArray(value.manualSamples) || value.manualSamples.length > 10 || value.manualSamples.length > result.manualRecordCount!) throw new RangeError("仅支持最近最多 10 条已保存的手动虚拟读数，不能超过总记录数");
  const id: ManualExperimentId = experimentId;
  const parameterKeys = highSchoolExperiment(id).parameters.map((parameter) => parameter.key);
  const ids = new Set<string>();
  result.manualSamples = value.manualSamples.map((raw: unknown): LiliManualSample => {
    if (!object(raw)) throw new RangeError("手动虚拟读数格式不正确");
    if (typeof raw.id !== "string" || !/^[A-Za-z0-9._:-]{1,100}$/.test(raw.id) || ids.has(raw.id)) throw new RangeError("手动记录编号无效或重复");
    ids.add(raw.id);
    const kind = expectedKind[id];
    if (raw.kind !== kind) throw new RangeError("手动读数类型与实验不匹配");
    const parameters = numericFields(raw.parameters, parameterKeys, "手动记录的实验条件");
    validatedHighSchoolParameters(id, parameters);
    const readings = numericFields(raw.readings, readingKeys[id], "手动原始读数");
    const settings = id === "pendulum" ? ["length", "amplitudeDegrees"] : id === "mechanical-energy" ? ["mass", "dropHeight", "resistanceRatio"] : ["slitSeparationMm", "screenDistance"];
    if (settings.some((key) => readings[key] !== parameters[key])) throw new RangeError("手动读数的条件与当时的参数快照不一致");
    if (typeof raw.timeSeconds !== "number" || !Number.isFinite(raw.timeSeconds) || raw.timeSeconds < 0) throw new RangeError("手动记录时间必须是非负有限数值");
    if (id === "pendulum") {
      if (raw.timeSeconds > PENDULUM_OBSERVATION_SECONDS || readings.startTimeSeconds! > PENDULUM_OBSERVATION_SECONDS || readings.endTimeSeconds! > PENDULUM_OBSERVATION_SECONDS) throw new RangeError("单摆手动计时超出 60 s 观察窗口");
      if (quantizeManualTimeSeconds(raw.timeSeconds) !== readings.endTimeSeconds) throw new RangeError("手动记录时间与停止秒表读数不一致");
    } else if (id === "mechanical-energy") validateMechanicalEnergyTapeObservation(parameters, readings, raw.timeSeconds);
    else if (raw.timeSeconds !== 0) throw new RangeError("双缝稳态手动记录时间必须为 0");
    const calculated = calculateReadings(kind, readings);
    // Reject unquantized input rather than silently changing the student's stored readings.
    if (readingKeys[id].some((key) => readings[key] !== calculated.readings[key])) throw new RangeError("原始读数必须使用仪器已显示的分辨率，不能由服务端改写");
    return { id: raw.id, kind, parameters, readings, timeSeconds: raw.timeSeconds };
  });
  return result;
}

/** Whitelisted prompt reference: saved user operations and derived arithmetic remain distinct from model samples. */
export function liliManualReference(context: LiliExperimentContext | null): LiliManualReference | null {
  if (!context) return null;
  try {
    const validated = prepareLiliManualContext(context.experimentId, context);
    if (validated.manualRecordCount === undefined) return null;
    const records = (validated.manualSamples ?? []).map((sample): LiliManualReferenceRecord => {
      const { metrics, assumptions, warnings, resolution } = calculateReadings(sample.kind, sample.readings);
      return { ...sample, metrics, assumptions, warnings, resolution };
    });
    return {
      provenance: "virtual-manual", totalSavedCount: validated.manualRecordCount,
      includedCount: records.length, omittedCount: validated.manualRecordCount - records.length,
      notice: "这是最近最多 10 条本机保存的手动虚拟仪器读数，与自动模型采样分开。起止读数、选点和计数保留原值；仅按原值重新计算派生量，不使用理论周期、已知波长、理想亮纹位置或纸带模型速度回填。纸带以六个自主位置作中央差分求 vA/vB，再求 A/B 间动能与势能变化；不能用 gt 或 √(2gh) 循环证明守恒。服务端只校验范围、已出现点和共享点一致性，未验证完整周期计数、亮纹或纸带定位正确，不能证明操作已经完成或理解程度；也不是真实器材实测。0.01 s / 0.1 mm 是显示分辨率，不能当作测量精度。",
      records
    };
  } catch { return null; }
}
