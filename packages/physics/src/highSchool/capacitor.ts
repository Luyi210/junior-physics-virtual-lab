import type { CapacitorHistory, CapacitorMode } from "@physics-lab/contracts";
import type { HighSchoolSimulation } from "./types";
import { finiteNumber } from "@physics-lab/physics/high-school/types";

export interface CapacitorParameters { resistanceKOhm: number; capacitanceMicrofarads: number; emf: number }
export const CAPACITOR_MAX_SEGMENTS = 32;
export const CAPACITOR_OBSERVATION_TIME_CONSTANTS = 20;
const modes: readonly CapacitorMode[] = ["charge", "discharge", "open"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function exactKeys(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function mode(value: unknown): asserts value is CapacitorMode { if (!modes.includes(value as CapacitorMode)) throw new RangeError("开关状态只能为接电源、经电阻放电或断路。"); }
function electrical(parameters: CapacitorParameters) {
  const resistance = finiteNumber(parameters.resistanceKOhm, "电阻（kΩ）", 1, 10) * 1000;
  const capacitance = finiteNumber(parameters.capacitanceMicrofarads, "电容（μF）", 100, 1000) * 1e-6;
  const emf = finiteNumber(parameters.emf, "电动势（V）", 1, 12);
  return { resistance, capacitance, emf, timeConstant: resistance * capacitance };
}
export function capacitorDurationSeconds(parameters: CapacitorParameters) { return electrical(parameters).timeConstant * CAPACITOR_OBSERVATION_TIME_CONSTANTS; }

/** Every run starts with an uncharged capacitor; U0 is never accepted from a client. */
export function createCapacitorHistory(runId: string, initialMode: CapacitorMode = "charge"): CapacitorHistory {
  return validateCapacitorHistory({ kind: "capacitor-rc-v1", runId, initialVoltage: 0, segments: [{ startTimeSeconds: 0, mode: initialMode }] }, 0, 0);
}
export function validateCapacitorHistory(value: unknown, timeSeconds: number, durationSeconds: number): CapacitorHistory {
  finiteNumber(durationSeconds, "观察时长", 0); finiteNumber(timeSeconds, "记录时刻", 0, durationSeconds);
  if (!object(value) || !exactKeys(value, ["kind", "runId", "initialVoltage", "segments"]) || value.kind !== "capacitor-rc-v1" || typeof value.runId !== "string" || !/^[A-Za-z0-9._:-]{1,100}$/.test(value.runId) || value.initialVoltage !== 0) throw new RangeError("电容记录必须保留有效轮次编号和从零电压开始的完整分段历史。");
  if (!Array.isArray(value.segments) || value.segments.length < 1 || value.segments.length > CAPACITOR_MAX_SEGMENTS) throw new RangeError(`每轮须保留 1–${CAPACITOR_MAX_SEGMENTS} 个开关段，不能截断或省略历史。`);
  let previousTime = -1; let previousMode: CapacitorMode | undefined;
  const segments = value.segments.map((segment: unknown, index) => {
    if (!object(segment) || !exactKeys(segment, ["startTimeSeconds", "mode"]) || typeof segment.startTimeSeconds !== "number") throw new RangeError("开关段只允许起始时刻与模式，不能传入推测电压或其他字段。");
    finiteNumber(segment.startTimeSeconds, "段起始时刻", 0, timeSeconds); mode(segment.mode);
    if ((index === 0 && segment.startTimeSeconds !== 0) || segment.startTimeSeconds <= previousTime || segment.mode === previousMode) throw new RangeError("首段必须从 0 s 开始，后续段时刻严格递增且模式必须发生变化。");
    previousTime = segment.startTimeSeconds; previousMode = segment.mode;
    return { startTimeSeconds: segment.startTimeSeconds, mode: segment.mode };
  });
  return { kind: "capacitor-rc-v1", runId: value.runId, initialVoltage: 0, segments };
}

export function switchCapacitorMode(parameters: CapacitorParameters, history: CapacitorHistory, timeSeconds: number, nextMode: CapacitorMode): CapacitorHistory {
  const valid = validateCapacitorHistory(history, timeSeconds, capacitorDurationSeconds(parameters)); mode(nextMode);
  const last = valid.segments.at(-1)!;
  if (last.mode === nextMode) return valid;
  if (last.startTimeSeconds === timeSeconds) {
    valid.segments.pop();
    if (valid.segments.at(-1)?.mode !== nextMode) valid.segments.push({ startTimeSeconds: timeSeconds, mode: nextMode });
  } else valid.segments.push({ startTimeSeconds: timeSeconds, mode: nextMode });
  return validateCapacitorHistory(valid, timeSeconds, capacitorDurationSeconds(parameters));
}

type Electrical = ReturnType<typeof electrical>;
function segmentState(p: Electrical, selectedMode: CapacitorMode, initialVoltage: number, elapsed: number) {
  const target = selectedMode === "charge" ? p.emf : 0;
  const change = selectedMode === "open" ? 0 : (target - initialVoltage) * -Math.expm1(-elapsed / p.timeConstant);
  const voltage = initialVoltage + change;
  // Compute I directly from the decaying difference to preserve small currents.
  const current = selectedMode === "open" ? 0 : (target - initialVoltage) * Math.exp(-elapsed / p.timeConstant) / p.resistance;
  const dissipatedEnergy = selectedMode === "open" ? 0 : 0.5 * p.capacitance * (target - initialVoltage) ** 2 * -Math.expm1(-2 * elapsed / p.timeConstant);
  return { voltage, current, dissipatedEnergy, sourceWork: selectedMode === "charge" ? p.emf * p.capacitance * change : 0 };
}

/** SI quantities. Positive I enters the marked plate; Q is that plate's charge. */
function replay(p: Electrical, history: CapacitorHistory, timeSeconds: number) {
  let voltage = 0; let sourceWork = 0; let dissipatedEnergy = 0;
  for (let index = 0; index < history.segments.length; index++) {
    const segment = history.segments[index]!;
    const end = history.segments[index + 1]?.startTimeSeconds ?? timeSeconds;
    const elapsed = end - segment.startTimeSeconds;
    const part = segmentState(p, segment.mode, voltage, elapsed);
    sourceWork += part.sourceWork; dissipatedEnergy += part.dissipatedEnergy;
    if (index === history.segments.length - 1) return {
      time: timeSeconds, voltage: part.voltage, current: part.current, charge: p.capacitance * part.voltage,
      storedEnergy: 0.5 * p.capacitance * part.voltage ** 2, resistorPower: part.current ** 2 * p.resistance,
      timeConstant: p.timeConstant, segmentStartTime: segment.startTimeSeconds, segmentElapsedTime: elapsed,
      segmentInitialVoltage: voltage, sourceWork, dissipatedEnergy
    };
    voltage = part.voltage;
  }
  throw new RangeError("电容过程缺少开关段。");
}

export function calculateCapacitorState(parameters: CapacitorParameters, history: CapacitorHistory, timeSeconds: number) {
  const p = electrical(parameters);
  const valid = validateCapacitorHistory(history, timeSeconds, p.timeConstant * CAPACITOR_OBSERVATION_TIME_CONSTANTS);
  return replay(p, valid, timeSeconds);
}

/** Only elapsed history is drawn. Each switch retains both current limits at the same x. */
export function simulateCapacitorExperiment(parameters: CapacitorParameters, history: CapacitorHistory, timeSeconds: number): HighSchoolSimulation {
  const p = electrical(parameters); const durationSeconds = capacitorDurationSeconds(parameters);
  const valid = validateCapacitorHistory(history, timeSeconds, durationSeconds);
  const rows: ReturnType<typeof replay>[] = [];
  for (let index = 0; index < valid.segments.length; index++) {
    const start = valid.segments[index]!.startTimeSeconds;
    const end = valid.segments[index + 1]?.startTimeSeconds ?? timeSeconds;
    const prefix = { ...valid, segments: valid.segments.slice(0, index + 1) };
    // At least 24 samples/tau, plus exact left/right switch endpoints. Finite 20τ
    // observation windows and 32 segments keep the curve naturally bounded.
    const intervals = Math.max(1, Math.ceil((end - start) / p.timeConstant * 24));
    for (let point = 0; point <= intervals; point++) {
      if (end === start && point > 0) continue;
      rows.push(replay(p, prefix, point === intervals ? end : start + (end - start) * point / intervals));
    }
  }
  const state = replay(p, valid, timeSeconds);
  const fields: [keyof typeof state, string, string][] = [["voltage", "电容电压 U", "V"], ["current", "流入标记极板的电流 I", "A"], ["charge", "标记极板电荷 Q", "C"], ["storedEnergy", "电容储能", "J"], ["resistorPower", "电阻热功率", "W"], ["timeConstant", "时间常量 RC", "s"], ["sourceWork", "本轮电源累计做功", "J"], ["dissipatedEnergy", "电阻累计耗散", "J"]];
  return { durationSeconds, state, capacitor: { mode: valid.segments.at(-1)!.mode, segmentIndex: valid.segments.length - 1 },
    metrics: fields.map(([key, label, unit]) => ({ key, label, unit, value: state[key] })),
    series: fields.filter(([key]) => ["voltage", "current", "charge", "storedEnergy"].includes(key)).map(([key, label, unit]) => ({ key, xKey: "time", label: `${label}—时间（已发生过程）`, xLabel: "本轮时间", xUnit: "s", yUnit: unit, points: rows.map((row) => ({ x: row.time, y: row[key] })) })),
    equations: ["接电源：U = E+(U₀−E)e^(−Δt/RC)，I=(E−U)/R", "经R放电：U=U₀e^(−Δt/RC)，I=−U/R；断路：U=U₀，I=0", "Q=CU（标记极板），Wc=½CU²，PR=I²R", "电源累计做功 = 电容储能增加 + 电阻累计耗散"],
    warnings: ["每次切换保留电容电压、电荷和储能；电流可跳变。断路不等于放空。", "20RC 是本轮观察窗口；终点不代表恰好充满或放空，5τ后仍保留指数尾部。", "理想模型忽略漏电、介质击穿和仪表负载；模型读数不是实体测量。Q是指定极板电荷，整个电容器净电荷仍为零。"] };
}
