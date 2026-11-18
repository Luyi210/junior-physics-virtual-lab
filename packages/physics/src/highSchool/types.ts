import type { CapacitorMode } from "@physics-lab/contracts";
export type { CapacitorMode, CapacitorHistory } from "@physics-lab/contracts";
export type HighSchoolExperimentId = "uniform-acceleration" | "newton-second-law" | "projectile-motion" | "pendulum" | "emf-internal-resistance" | "double-slit" | "spring-force" | "force-composition" | "mechanical-energy" | "capacitor-charge" | "centripetal-force" | "precision-length" | "resistivity" | "multimeter" | "momentum-conservation" | "refractive-index" | "induced-current" | "transformer-ratio" | "sensor-control" | "oil-film" | "gas-pressure-volume" | "free-fall" | "photoelectric-effect" | "charged-particle-field";

export interface HighSchoolParameter {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  choices?: { value: number; label: string }[];
  integral?: boolean;
}

export interface HighSchoolExperimentDefinition {
  id: HighSchoolExperimentId;
  title: string;
  field: "力学" | "电学" | "光学" | "电磁学" | "热学" | "近代物理" | "测量";
  description: string;
  assumptions: string[];
  parameters: HighSchoolParameter[];
}

export interface HighSchoolSeries {
  key: string;
  xKey: string;
  label: string;
  xLabel: string;
  xUnit: string;
  yUnit: string;
  points: { x: number; y: number }[];
}

export interface HighSchoolSimulation {
  capacitor?: { mode: CapacitorMode; segmentIndex: number };
  durationSeconds: number;
  state: Record<string, number>;
  metrics: { key: string; label: string; value: number; unit: string }[];
  series: HighSchoolSeries[];
  equations: string[];
  warnings: string[];
}

export const HIGH_SCHOOL_GRAVITY = 9.8;

export function finiteNumber(value: number, label: string, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label} 必须是 ${min} 至 ${max} 范围内的有限数值`);
  return value;
}

export function positiveNumber(value: number, label: string) {
  finiteNumber(value, label);
  if (value <= 0) throw new RangeError(`${label} 必须大于零`);
  return value;
}

export function boundedTime(value: number, end: number) {
  finiteNumber(value, "时间");
  return Math.max(0, Math.min(value, end));
}
