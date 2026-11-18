import { calculateAppliancePower } from "@physics-lab/physics";
import type { HarnessApparatusSnapshot } from "@physics-lab/harness";

export const powerAppliances = {
  lamp: { label: "小灯泡", ratedVoltage: 6, ratedPower: 3, symbol: "LAMP" },
  motor: { label: "直流电机", ratedVoltage: 6, ratedPower: 2.4, symbol: "MOTOR" },
  resistor: { label: "电热电阻", ratedVoltage: 6, ratedPower: 1.5, symbol: "HEATER" }
} as const;
export type PowerApplianceKey = keyof typeof powerAppliances;
export type PowerInstrument = "ammeter" | "voltmeter" | "energy";
export interface PowerLabConfiguration {
  applianceKey: PowerApplianceKey;
  voltage: number;
  duration: number;
  connected: PowerInstrument[];
}
export interface CompletedPowerMeasurement {
  configuration: PowerLabConfiguration;
  appliance: string;
  voltage: number;
  current: number;
  power: number;
  seconds: number;
  energy: number;
  state: string;
}
export interface PowerLabState {
  configuration: PowerLabConfiguration;
  phase: "idle" | "running" | "paused" | "completed";
  elapsed: number;
  energyJoules: number;
  energyKilowattHours: number;
  completedMeasurement: CompletedPowerMeasurement | null;
}
export type PowerLabAction =
  | { type: "toggle" }
  | { type: "tick"; seconds: number }
  | { type: "appliance"; key: PowerApplianceKey }
  | { type: "voltage"; value: number }
  | { type: "duration"; value: number }
  | { type: "connection"; instrument: PowerInstrument };

function freshRun(configuration: PowerLabConfiguration): PowerLabState {
  return { configuration: { ...configuration, connected: [...configuration.connected] }, phase: "idle", elapsed: 0, energyJoules: 0, energyKilowattHours: 0, completedMeasurement: null };
}
export function createPowerLabState(): PowerLabState {
  return freshRun({ applianceKey: "lamp", voltage: 6, duration: 30, connected: [] });
}
export function powerLabLiveState(state: PowerLabState) {
  const configuration = state.configuration;
  const appliance = powerAppliances[configuration.applianceKey];
  // Prediction describes what would happen with a closed circuit; it is never an instrument reading.
  const prediction = calculateAppliancePower(appliance.ratedVoltage, appliance.ratedPower, configuration.voltage, 0);
  const fullyConnected = (["ammeter", "voltmeter", "energy"] as const).every((instrument) => configuration.connected.includes(instrument));
  const unsafe = prediction.operatingState === "overvoltage";
  const conducting = state.phase === "running" && fullyConnected && !unsafe;
  const loadVoltage = conducting ? configuration.voltage : 0;
  const electrical = calculateAppliancePower(appliance.ratedVoltage, appliance.ratedPower, loadVoltage, 0);
  const stateLabel = unsafe ? "过压保护，开关已锁定" : conducting ? prediction.operatingState === "undervoltage" ? "开关闭合，欠压运行" : "开关闭合，额定附近运行" : state.phase === "completed" ? "计时完成，开关已断开" : state.phase === "paused" ? "开关断开，计时暂停" : "开关断开，等待计时";
  return {
    appliance, prediction, fullyConnected, unsafe, conducting, stateLabel, loadVoltage,
    current: electrical.current, power: electrical.actualPower,
    ammeter: configuration.connected.includes("ammeter") ? electrical.current : null,
    voltmeter: configuration.connected.includes("voltmeter") ? loadVoltage : null,
    wattmeter: configuration.connected.includes("ammeter") && configuration.connected.includes("voltmeter") ? electrical.actualPower : null,
    energyMeter: configuration.connected.includes("energy") ? state.energyJoules : null
  };
}
function sameConfiguration(a: PowerLabConfiguration, b: PowerLabConfiguration) {
  return a.applianceKey === b.applianceKey && a.voltage === b.voltage && a.duration === b.duration
    && a.connected.length === b.connected.length && a.connected.every((instrument) => b.connected.includes(instrument));
}
export function savablePowerMeasurement(state: PowerLabState) {
  const measurement = state.completedMeasurement;
  return state.phase === "completed" && measurement && sameConfiguration(measurement.configuration, state.configuration) ? measurement : null;
}

/** All run transitions are atomic, so a condition change cannot reuse an old completion latch. */
export function powerLabReducer(state: PowerLabState, action: PowerLabAction): PowerLabState {
  const configuration = state.configuration;
  if (action.type === "appliance") {
    if (!Object.hasOwn(powerAppliances, action.key)) return state;
    const next = { ...configuration, applianceKey: action.key, voltage: powerAppliances[action.key].ratedVoltage };
    return sameConfiguration(next, configuration) ? state : freshRun(next);
  }
  if (action.type === "voltage" || action.type === "duration") {
    if (!Number.isFinite(action.value) || action.value < 0 || (action.type === "duration" && action.value === 0)) return state;
    if (configuration[action.type] === action.value) return state;
    return freshRun({ ...configuration, [action.type]: action.value });
  }
  if (action.type === "connection") {
    const connected = configuration.connected.includes(action.instrument) ? configuration.connected.filter((instrument) => instrument !== action.instrument) : [...configuration.connected, action.instrument];
    return freshRun({ ...configuration, connected });
  }
  const live = powerLabLiveState(state);
  if (action.type === "toggle") {
    if (state.phase === "running") return { ...state, phase: "paused" };
    if (!live.fullyConnected || live.unsafe) return state;
    const next = state.phase === "completed" ? freshRun(configuration) : state;
    return { ...next, phase: "running", completedMeasurement: null };
  }
  if (!live.conducting || !Number.isFinite(action.seconds) || action.seconds <= 0) return state;
  const elapsed = Math.min(configuration.duration, state.elapsed + action.seconds);
  const interval = calculateAppliancePower(live.appliance.ratedVoltage, live.appliance.ratedPower, configuration.voltage, elapsed - state.elapsed);
  const energyJoules = state.energyJoules + interval.energyJoules;
  const energyKilowattHours = state.energyKilowattHours + interval.energyKilowattHours;
  const completed = elapsed >= configuration.duration;
  return {
    ...state, elapsed, energyJoules, energyKilowattHours, phase: completed ? "completed" : "running",
    completedMeasurement: completed ? {
      configuration: { ...configuration, connected: [...configuration.connected] },
      appliance: live.appliance.label, voltage: configuration.voltage, current: live.current, power: live.power,
      seconds: elapsed, energy: energyJoules, state: live.prediction.operatingState === "undervoltage" ? "欠压运行" : "额定附近正常运行"
    } : null
  };
}

/** Assistant telemetry uses the same live readings as the meters; latched results have explicit separate IDs. */
export function powerLabInstrumentSnapshot(state: PowerLabState): Pick<HarnessApparatusSnapshot, "readings" | "derived"> {
  const live = powerLabLiveState(state);
  const completed = savablePowerMeasurement(state);
  return {
    readings: [
      { id: "U", label: "负载端实时电压", value: live.voltmeter, unit: "V", source: "reading" },
      { id: "I", label: "实时电流", value: live.ammeter, unit: "A", source: "reading" },
      { id: "P", label: "实时功率", value: live.wattmeter, unit: "W", source: "reading" },
      { id: "W", label: "本轮累计电能（断开后保留）", value: live.energyMeter, unit: "J", source: "reading" },
      { id: "elapsed", label: "本轮已通电时间", value: state.configuration.connected.includes("energy") ? state.elapsed : null, unit: "s", source: "reading" }
    ],
    derived: [
      { id: "state", label: "实时运行状态", value: live.stateLabel, source: "model" },
      { id: "measurement-ready", label: "本轮有独立完成快照可保存", value: Boolean(completed), source: "model" },
      { id: "completed-U", label: "本轮完成快照：负载电压", value: completed?.voltage ?? null, unit: "V", source: "reading" },
      { id: "completed-I", label: "本轮完成快照：工作电流", value: completed?.current ?? null, unit: "A", source: "reading" },
      { id: "completed-P", label: "本轮完成快照：工作功率", value: completed?.power ?? null, unit: "W", source: "reading" },
      { id: "completed-t", label: "本轮完成快照：通电时间", value: completed?.seconds ?? null, unit: "s", source: "reading" },
      { id: "completed-W", label: "本轮完成快照：累计电能", value: completed?.energy ?? null, unit: "J", source: "reading" }
    ]
  };
}
