import { LEARNING_RECORD_FIELD_LIMITS } from '@physics-lab/contracts';
import {
  calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement,
  highSchoolExperiment, PENDULUM_OBSERVATION_SECONDS, quantizeManualTimeSeconds,
  simulateHighSchoolExperiment, validatedHighSchoolParameters,
  type HighSchoolExperimentDefinition, type ManualMeasurementResult,
} from '@physics-lab/physics/high-school';
import type { HighSchoolMeasurement } from './workbench';
import type { ManualMeasurementRecord } from './manualMeasurementRepository';
import { checkedMechanicalEnergyTape, mechanicalEnergyReadingLabels } from './mechanicalEnergyEvidence';
import { capacitorHistoryLines, checkedCapacitorRecord } from './capacitorEvidence';

export interface ClassroomEvidenceSelection { automaticIds: string[]; manualIds: string[] }
export interface ClassroomEvidencePreview { text: string; automaticCount: number; manualCount: number; fingerprint: string }

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const quote = (value: string) => JSON.stringify(value);
const units = (unit: string) => unit || '无量纲';
const readingLabels: Record<string, { label: string; unit: string }> = {
  ...mechanicalEnergyReadingLabels,
  startTimeSeconds: { label: '起始秒表读数', unit: 's' }, endTimeSeconds: { label: '结束秒表读数', unit: 's' },
  periodCount: { label: '完整周期数', unit: '次' }, length: { label: '摆长', unit: 'm' }, amplitudeDegrees: { label: '释放摆角', unit: '°' },
  leftPositionMm: { label: '左侧屏坐标', unit: 'mm' }, rightPositionMm: { label: '右侧屏坐标', unit: 'mm' },
  intervalCount: { label: '相邻亮纹间隔数', unit: '个' }, slitSeparationMm: { label: '双缝间距', unit: 'mm' }, screenDistance: { label: '双缝到屏距离', unit: 'm' },
};

function fail(message: string): never { throw new Error(`无法生成课堂证据副本：${message}`); }

function selected<T extends HighSchoolMeasurement>(records: readonly T[], ids: string[], source: string): T[] {
  if (!Array.isArray(records) || !Array.isArray(ids) || Array.from(ids).some((id) => !nonempty(id))) fail(`${source}记录或选择编号格式无效。`);
  if (new Set(ids).size !== ids.length) fail(`${source}选择了重复编号。`);
  const byId = new Map<string, T>();
  for (const record of records as readonly T[]) {
    if (!isObject(record) || !nonempty(record.id)) fail(`${source}记录缺少编号。`);
    if (byId.has(record.id)) fail(`${source}档案包含重复编号 ${quote(record.id)}，请先核对。`);
    byId.set(record.id, record);
  }
  return ids.map((id) => byId.get(id) ?? fail(`选中的${source}记录 ${quote(id)} 已不存在，请重新预览。`));
}

function validateBase(record: HighSchoolMeasurement, definition: HighSchoolExperimentDefinition) {
  if (typeof record.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.createdAt)
    || !Number.isFinite(Date.parse(record.createdAt)) || new Date(record.createdAt).toISOString() !== record.createdAt) fail(`记录 ${quote(record.id)} 的UTC创建时间无效。`);
  if (!finite(record.timeSeconds) || record.timeSeconds < 0) fail(`记录 ${quote(record.id)} 的仿真时刻无效。`);
  if (!isObject(record.parameters) || definition.parameters.some((parameter) => !Object.hasOwn(record.parameters, parameter.key))) fail(`记录 ${quote(record.id)} 缺少完整参数，不能用默认值补齐。`);
  try { validatedHighSchoolParameters(definition.id, record.parameters); }
  catch (error) { fail(`记录 ${quote(record.id)} 的参数无效：${error instanceof Error ? error.message : '请核对保存内容'}。`); }
  if (!Array.isArray(record.metrics) || record.metrics.length === 0 || record.metrics.some((metric) => !isObject(metric)
    || !nonempty(metric.key) || !nonempty(metric.label) || typeof metric.unit !== 'string' || !finite(metric.value))) fail(`记录 ${quote(record.id)} 包含缺失或非法读数。`);
  if (new Set(record.metrics.map((metric) => metric.key)).size !== record.metrics.length) fail(`记录 ${quote(record.id)} 含有重名读数。`);
}

function validateMetrics(record: HighSchoolMeasurement, expected: HighSchoolMeasurement['metrics'], verifyArithmetic = false) {
  if (record.metrics.length !== expected.length) fail(`记录 ${quote(record.id)} 的读数项目不完整或不属于本实验。`);
  for (const metric of expected) {
    const saved = record.metrics.find((entry) => entry.key === metric.key);
    if (!saved || saved.unit !== metric.unit) fail(`记录 ${quote(record.id)} 的 ${metric.key} 缺失或单位不符。`);
    if (verifyArithmetic && Math.abs(saved.value - metric.value) > 1e-10 * Math.max(1, Math.abs(metric.value))) fail(`记录 ${quote(record.id)} 的手动推导值 ${metric.key} 与原始读数不一致。`);
  }
}

function validateAutomatic(record: HighSchoolMeasurement, definition: HighSchoolExperimentDefinition) {
  validateBase(record, definition);
  if (Object.hasOwn(record, 'manual')) fail(`记录 ${quote(record.id)} 是手动读数，不能标为自动模型采样。`);
  if (definition.id !== 'capacitor-charge' && Object.hasOwn(record, 'capacitorHistory')) fail(`记录 ${quote(record.id)} 的开关过程不属于当前实验。`);
  const model = definition.id === 'capacitor-charge' ? checkedCapacitorRecord(record) : simulateHighSchoolExperiment(definition.id, record.parameters, record.timeSeconds);
  if (model.state.readingValid === 0 || record.metrics.some((metric) => metric.key === 'readingValid' && metric.value !== 1)) fail(`记录 ${quote(record.id)} 的器材状态、接法或量程无效，不能作为有效测量证据。`);
  if (record.timeSeconds > model.durationSeconds + (model.durationSeconds > 0 ? 1e-9 : 0)) fail(`记录 ${quote(record.id)} 的仿真时刻超出本组观察窗口。`);
  // Check the metric schema only. The copy must retain saved numbers, not regenerate historical readings.
  validateMetrics(record, model.metrics);
}

function validateManual(record: ManualMeasurementRecord, definition: HighSchoolExperimentDefinition): ManualMeasurementResult {
  validateBase(record, definition);
  const manual = record.manual;
  if (!isObject(manual) || manual.provenance !== 'virtual-manual' || !isObject(manual.readings)
    || !stringArray(manual.assumptions) || !stringArray(manual.warnings) || !isObject(manual.resolution)
    || !finite(manual.resolution.value) || manual.resolution.value <= 0) fail(`记录 ${quote(record.id)} 缺少合法的手动来源、原始读数或分辨率。`);
  const r = manual.readings;
  let expected: ManualMeasurementResult;
  try {
    if (definition.id === 'pendulum' && manual.kind === 'pendulum-timing') {
      if (record.timeSeconds > PENDULUM_OBSERVATION_SECONDS || quantizeManualTimeSeconds(record.timeSeconds) !== r.endTimeSeconds
        || r.length !== record.parameters.length || r.amplitudeDegrees !== record.parameters.amplitudeDegrees) fail(`记录 ${quote(record.id)} 的手动计时与保存时刻或摆长/摆角不一致。`);
      expected = calculatePendulumTimingMeasurement({ startTimeSeconds: r.startTimeSeconds!, endTimeSeconds: r.endTimeSeconds!, periodCount: r.periodCount!, length: r.length!, amplitudeDegrees: r.amplitudeDegrees! });
    } else if (definition.id === 'double-slit' && manual.kind === 'double-slit-positions') {
      if (record.timeSeconds !== 0 || r.slitSeparationMm !== record.parameters.slitSeparationMm || r.screenDistance !== record.parameters.screenDistance) fail(`记录 ${quote(record.id)} 的手动坐标与保存时刻或双缝条件不一致。`);
      expected = calculateDoubleSlitPositionMeasurement({ leftPositionMm: r.leftPositionMm!, rightPositionMm: r.rightPositionMm!, intervalCount: r.intervalCount!, slitSeparationMm: r.slitSeparationMm!, screenDistance: r.screenDistance! });
    } else if (definition.id === 'mechanical-energy' && manual.kind === 'mechanical-energy-tape') {
      expected = checkedMechanicalEnergyTape(record.parameters, r, record.timeSeconds);
    } else fail(`记录 ${quote(record.id)} 的手动仪器类型不属于当前实验。`);
  } catch (error) { fail(`记录 ${quote(record.id)} 的手动数据无效：${error instanceof Error ? error.message : '请核对原始读数'}。`); }
  if (Object.keys(r).length !== Object.keys(expected.readings).length || Object.entries(expected.readings).some(([key, value]) => r[key] !== value)) fail(`记录 ${quote(record.id)} 的原始读数缺失、未按仪器显示保存或含有未知项目。`);
  if (manual.resolution.unit !== expected.resolution.unit || manual.resolution.value !== expected.resolution.value) fail(`记录 ${quote(record.id)} 的显示分辨率与仪器不符。`);
  validateMetrics(record, expected.metrics, true);
  return expected;
}

function recordLines(record: HighSchoolMeasurement, definition: HighSchoolExperimentDefinition) {
  return [
    `原记录ID：${quote(record.id)}`, `创建时间（UTC）：${record.createdAt}`, `仿真时刻：${String(record.timeSeconds)} s`,
    '当时参数：', ...definition.parameters.map((parameter) => `- ${parameter.label} [${parameter.key}] = ${String(record.parameters[parameter.key])} ${units(parameter.unit)}${parameter.choices?.find((choice) => choice.value === record.parameters[parameter.key])?.label ? `（${parameter.choices.find((choice) => choice.value === record.parameters[parameter.key])!.label}）` : ''}`),
    ...(definition.id === 'capacitor-charge' ? capacitorHistoryLines(record) : []),
  ];
}
const metricLines = (record: HighSchoolMeasurement) => record.metrics.map((metric) => `- ${quote(metric.label)} [${quote(metric.key)}] = ${String(metric.value)} ${units(metric.unit)}`);

/** Callers supply only the current owner's normal archives, never recovery/legacy collections.
 * A preview is a textual copy; it neither claims ownership nor uploads anything.
 */
export function createClassroomEvidencePreview(definition: HighSchoolExperimentDefinition, automaticRecords: readonly HighSchoolMeasurement[], manualRecords: readonly ManualMeasurementRecord[], selection: ClassroomEvidenceSelection): ClassroomEvidencePreview {
  if (!definition || !isObject(selection)) fail('实验或选择格式无效。');
  const canonicalDefinition = highSchoolExperiment(definition.id);
  if (definition.title !== canonicalDefinition.title || JSON.stringify(definition.parameters) !== JSON.stringify(canonicalDefinition.parameters)) fail('实验参数定义已变化，请重新打开预览。');
  const automatic = selected(automaticRecords, selection.automaticIds, '自动');
  const manual = selected(manualRecords, selection.manualIds, '手动');
  if (!automatic.length && !manual.length) fail('请至少选择一条正常档案中的记录。');
  const ids = [...automatic, ...manual].map((record) => record.id);
  if (new Set(ids).size !== ids.length) fail('自动与手动选择使用了相同编号，请先核对来源。');
  automatic.forEach((record) => validateAutomatic(record, definition));
  const manualReadings = manual.map((record) => validateManual(record, definition));
  const lines = [
    `【高中课堂证据副本｜${definition.title}｜${definition.id}】`,
    '这是从本机正常档案明确选取的可编辑文字副本，包含虚拟模型或手动虚拟仪器读数，不是实物实测，也不是系统认证的原始证据附件。编辑后请自行说明改动。',
    '此副本由明确选择与预览生成；账号保存状态见课堂记录页面。未含待恢复副本、旧公共档案或助手生成的结论。',
    `自动模型记录：${automatic.length} 条；手动虚拟读数：${manual.length} 条。`,
  ];
  if (automatic.length) {
    lines.push('', '【自动模型采样｜来源 simulation】', '以下为当时保存的模型读数，未以当前模型值替换，也不作为独立手动测量。');
    automatic.forEach((record, index) => lines.push('', `自动记录 ${index + 1}`, ...recordLines(record, definition), '原保存的模型读数：', ...metricLines(record)));
  }
  if (manual.length) {
    lines.push('', '【手动虚拟仪器｜来源 virtual-manual】', '保留学生操作得到的起止读数、坐标与计数；推导值来自这些读数，不用理论值替换。');
    manual.forEach((record, index) => {
      lines.push('', `手动记录 ${index + 1}`, ...recordLines(record, definition), `仪器类型：${record.manual.kind}`, '原始手动读数：');
      for (const key of Object.keys(manualReadings[index]!.readings)) {
        const field = readingLabels[key]!;
        lines.push(`- ${field.label} [${key}] = ${String(record.manual.readings[key])} ${field.unit}`);
      }
      lines.push(`显示分辨率：${String(record.manual.resolution.value)} ${record.manual.resolution.unit}（不是测量精度）`, '原保存的派生读数：', ...metricLines(record),
        '原记录的假设：', ...record.manual.assumptions.map((text) => `- ${quote(text)}`), '原记录的复核提示：', ...(record.manual.warnings.length ? record.manual.warnings.map((text) => `- ${quote(text)}`) : ['- 无额外提示；这不代表读数或计数已验证正确。']));
    });
  }
  const text = lines.join('\n');
  // Exact, deterministic comparison instead of a collision-prone short hash; not an authorization token.
  return { text, automaticCount: automatic.length, manualCount: manual.length, fingerprint: `classroom-evidence-v1:${text}` };
}

export function appendClassroomEvidence(existingMeasurements: string, previewText: string): string {
  if (typeof existingMeasurements !== 'string' || typeof previewText !== 'string' || !previewText.trim()) throw new Error('测量文字或证据预览无效，未追加。');
  const next = existingMeasurements + (existingMeasurements.length ? '\n\n' : '') + previewText;
  if (next.length > LEARNING_RECORD_FIELD_LIMITS.measurements) throw new Error(`追加后超过测量数据与观察的 ${LEARNING_RECORD_FIELD_LIMITS.measurements} 字上限，请减少选择或另行导出；原文和读数均未截断。`);
  return next;
}
