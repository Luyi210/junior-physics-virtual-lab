import { describe, expect, it } from 'vitest';
import { LEARNING_RECORD_FIELD_LIMITS } from '@physics-lab/contracts';
import {
  calculateDoubleSlitPositionMeasurement, calculatePendulumTimingMeasurement,
  defaultHighSchoolParameters, highSchoolExperiment, simulateHighSchoolExperiment,
  type HighSchoolExperimentId,
} from '@physics-lab/physics/high-school';
import { appendClassroomEvidence, createClassroomEvidencePreview } from './classroomEvidence';
import type { HighSchoolMeasurement } from './workbench';
import type { ManualMeasurementRecord } from './manualMeasurementRepository';

const createdAt = '2026-11-11T01:23:45.678Z';
function automatic(id = 'auto-1', experimentId: HighSchoolExperimentId = 'spring-force', timeSeconds = 0): HighSchoolMeasurement {
  const parameters = defaultHighSchoolParameters(experimentId);
  return { id, createdAt, timeSeconds, parameters, metrics: simulateHighSchoolExperiment(experimentId, parameters, timeSeconds).metrics };
}
function pendulum(id = 'manual-1'): ManualMeasurementRecord {
  const parameters = { ...defaultHighSchoolParameters('pendulum'), length: 1, amplitudeDegrees: 5 };
  const timeSeconds = 10.016666666666667;
  const { metrics, ...manual } = calculatePendulumTimingMeasurement({ startTimeSeconds: .31, endTimeSeconds: timeSeconds, periodCount: 5, length: parameters.length, amplitudeDegrees: parameters.amplitudeDegrees });
  return { id, createdAt, timeSeconds, parameters, metrics, manual };
}
function slit(id = 'slit-1'): ManualMeasurementRecord {
  const parameters = defaultHighSchoolParameters('double-slit');
  const { metrics, ...manual } = calculateDoubleSlitPositionMeasurement({ leftPositionMm: -2.3, rightPositionMm: 3.7, intervalCount: 3, slitSeparationMm: parameters.slitSeparationMm!, screenDistance: parameters.screenDistance! });
  return { id, createdAt, timeSeconds: 0, parameters, metrics, manual };
}
const previewAutomatic = (records: HighSchoolMeasurement[], ids = records.map((record) => record.id)) => createClassroomEvidencePreview(highSchoolExperiment('spring-force'), records, [], { automaticIds: ids, manualIds: [] });
const previewPendulum = (records: ManualMeasurementRecord[]) => createClassroomEvidencePreview(highSchoolExperiment('pendulum'), [], records, { automaticIds: [], manualIds: records.map((record) => record.id) });

describe('classroom evidence textual preview', () => {
  it('preserves saved IDs, UTC, exact numbers and parameter units without regenerating automatic values', () => {
    const record = automatic('编号\n含"引号');
    record.parameters.loadMassGrams = 137.25;
    record.metrics = simulateHighSchoolExperiment('spring-force', record.parameters).metrics;
    record.metrics[0]!.value = .9800000000000001;
    const before = structuredClone(record);
    const preview = previewAutomatic([record]);
    expect(preview).toMatchObject({ automaticCount: 1, manualCount: 0 });
    expect(preview.text).toContain(JSON.stringify(record.id));
    expect(preview.text).toContain(createdAt);
    expect(preview.text).toContain('仿真时刻：0 s');
    expect(preview.text).toContain('[loadMassGrams] = 137.25 g');
    expect(preview.text).toContain('[stiffness] = 20 N/m');
    expect(preview.text).toContain('0.9800000000000001 N');
    expect(preview.text).toContain('可编辑文字副本');
    expect(preview.text).toContain('不是实物实测');
    expect(preview.text).toContain('此副本由明确选择与预览生成；账号保存状态见课堂记录页面');
    expect(record).toEqual(before);
  });

  it('selects only explicit IDs and fingerprints the full selected payload', () => {
    const one = automatic('one'), two = automatic('two');
    const first = previewAutomatic([one, two], ['two']);
    expect(first.text).not.toContain('原记录ID："one"');
    expect(first.text).toContain('原记录ID："two"');
    expect(previewAutomatic([two, one], ['two']).fingerprint).toBe(first.fingerprint);
    expect(previewAutomatic([one, structuredClone(two)], ['two']).fingerprint).toBe(first.fingerprint);
    two.metrics[0]!.value += 1e-12;
    expect(previewAutomatic([one, two], ['two']).fingerprint).not.toBe(first.fingerprint);
  });

  it('keeps both sources separate without the assistant thirty/ten sample truncation', () => {
    const auto = Array.from({ length: 31 }, (_, i) => automatic(`auto-${i}`, 'pendulum', i));
    const manual = Array.from({ length: 11 }, (_, i) => pendulum(`manual-${i}`));
    const result = createClassroomEvidencePreview(highSchoolExperiment('pendulum'), auto, manual, { automaticIds: auto.map((r) => r.id), manualIds: manual.map((r) => r.id) });
    expect(result).toMatchObject({ automaticCount: 31, manualCount: 11 });
    expect(result.text).toContain('来源 simulation');
    expect(result.text).toContain('来源 virtual-manual');
    for (const record of [...auto, ...manual]) expect(result.text).toContain(`原记录ID：${JSON.stringify(record.id)}`);
    expect(() => appendClassroomEvidence('', result.text)).toThrow(/12000.*未截断/);
  });

  it('preserves pendulum raw timestamps/counts, unrounded clock and all archived warnings/assumptions', () => {
    const record = pendulum();
    record.manual.assumptions.push('原记录附带说明\n保留第二行');
    record.manual.warnings.push('<script>这只是文字</script>');
    const result = previewPendulum([record]);
    for (const [key, value] of Object.entries(record.manual.readings)) expect(result.text).toContain(`[${key}] = ${String(value)}`);
    expect(result.text).toContain('仿真时刻：10.016666666666667 s');
    expect(result.text).toContain('显示分辨率：0.01 s（不是测量精度）');
    for (const text of [...record.manual.assumptions, ...record.manual.warnings]) expect(result.text).toContain(JSON.stringify(text));
    for (const metric of record.metrics) expect(result.text).toContain(`= ${String(metric.value)} ${metric.unit}`);
  });

  it('preserves double-slit positions and interval count instead of substituting the known wavelength', () => {
    const record = slit();
    const result = createClassroomEvidencePreview(highSchoolExperiment('double-slit'), [], [record], { automaticIds: [], manualIds: [record.id] });
    expect(result.text).toContain('[leftPositionMm] = -2.3 mm');
    expect(result.text).toContain('[rightPositionMm] = 3.7 mm');
    expect(result.text).toContain('相邻亮纹间隔数 [intervalCount] = 3 个');
    expect(result.text).toContain('显示分辨率：0.1 mm');
    const measured = record.metrics.find((metric) => metric.key === 'wavelengthNm')!;
    expect(measured.value).not.toBe(record.parameters.wavelengthNm);
    expect(result.text).toContain(`= ${String(measured.value)} nm`);
  });

  it('rejects missing, duplicated, empty or ambiguous selected IDs', () => {
    const record = automatic();
    expect(() => previewAutomatic([record], ['missing'])).toThrow(/已不存在/);
    expect(() => previewAutomatic([record], [record.id, record.id])).toThrow(/重复编号/);
    expect(() => previewAutomatic([record, { ...record }])).toThrow(/重复编号/);
    expect(() => previewAutomatic([], [])).toThrow(/至少选择一条/);
    expect(() => previewAutomatic([record], new Array<string>(1))).toThrow(/选择编号格式无效/);
    const auto = automatic('same', 'pendulum');
    expect(() => createClassroomEvidencePreview(highSchoolExperiment('pendulum'), [auto], [pendulum('same')], { automaticIds: ['same'], manualIds: ['same'] })).toThrow(/相同编号/);
  });

  it.each([
    ['nonfinite metric', (r: HighSchoolMeasurement) => { r.metrics[0]!.value = NaN; }],
    ['nonfinite clock', (r: HighSchoolMeasurement) => { r.timeSeconds = Infinity; }],
    ['wrong static clock', (r: HighSchoolMeasurement) => { r.timeSeconds = 1; }],
    ['missing parameter', (r: HighSchoolMeasurement) => { delete r.parameters.stiffness; }],
    ['unknown parameter', (r: HighSchoolMeasurement) => { r.parameters.other = 1; }],
    ['out of range parameter', (r: HighSchoolMeasurement) => { r.parameters.loadMassGrams = 251; }],
    ['wrong units', (r: HighSchoolMeasurement) => { r.metrics[0]!.unit = 'kg'; }],
    ['missing metric', (r: HighSchoolMeasurement) => { r.metrics.pop(); }],
    ['duplicate metric', (r: HighSchoolMeasurement) => { r.metrics[1] = { ...r.metrics[0]! }; }],
    ['non-UTC timestamp', (r: HighSchoolMeasurement) => { r.createdAt = '2026-11-11T09:23:45.678+08:00'; }],
    ['normalized invalid date', (r: HighSchoolMeasurement) => { r.createdAt = '2026-02-30T00:00:00.000Z'; }],
  ])('rejects malformed automatic data: %s', (_name, mutate) => {
    const record = automatic(); mutate(record);
    expect(() => previewAutomatic([record])).toThrow();
  });

  it('rejects source mixing and manual data inconsistent with its original readings', () => {
    const record = pendulum();
    expect(() => createClassroomEvidencePreview(highSchoolExperiment('pendulum'), [record], [], { automaticIds: [record.id], manualIds: [] })).toThrow(/不能标为自动/);
    const brokenCount = structuredClone(record); brokenCount.manual.readings.periodCount = 0;
    expect(() => previewPendulum([brokenCount])).toThrow(/周期数/);
    const brokenMetric = structuredClone(record); brokenMetric.metrics[0]!.value = 99;
    expect(() => previewPendulum([brokenMetric])).toThrow(/推导值/);
    const brokenTime = structuredClone(record); brokenTime.timeSeconds = 9;
    expect(() => previewPendulum([brokenTime])).toThrow(/保存时刻/);
    const brokenConditions = structuredClone(record); brokenConditions.parameters.length = 1.2;
    expect(() => previewPendulum([brokenConditions])).toThrow(/摆长/);
    const brokenSource = structuredClone(record); brokenSource.manual.provenance = 'real' as 'virtual-manual';
    expect(() => previewPendulum([brokenSource])).toThrow(/手动来源/);
    const brokenResolution = structuredClone(record); brokenResolution.manual.resolution.value = 1;
    expect(() => previewPendulum([brokenResolution])).toThrow(/分辨率/);
    const extraRaw = structuredClone(record); extraRaw.manual.readings.hidden = 1;
    expect(() => previewPendulum([extraRaw])).toThrow(/未知项目/);
    expect(() => createClassroomEvidencePreview(highSchoolExperiment('spring-force'), [], [record], { automaticIds: [], manualIds: [record.id] })).toThrow();
  });

  it('invalidates confirmation when any selected manual raw or explanatory content changes', () => {
    const record = pendulum();
    const first = previewPendulum([record]);
    const copy = structuredClone(record);
    copy.manual.warnings.push('额外复核说明');
    expect(previewPendulum([copy]).fingerprint).not.toBe(first.fingerprint);
    const changedRaw = pendulum();
    const { metrics, ...manual } = calculatePendulumTimingMeasurement({ ...changedRaw.manual.readings, startTimeSeconds: .32, endTimeSeconds: 10.02, periodCount: 5, length: 1, amplitudeDegrees: 5 });
    changedRaw.metrics = metrics; changedRaw.manual = manual;
    expect(previewPendulum([changedRaw]).fingerprint).not.toBe(first.fingerprint);
  });
});

describe('append classroom evidence to student measurements', () => {
  it('retains original whitespace and all authored text before appending', () => {
    const original = '  我的观察\n\n已有数据\t  ';
    const text = previewAutomatic([automatic()]).text;
    expect(appendClassroomEvidence(original, text)).toBe(original + '\n\n' + text);
    expect(appendClassroomEvidence('', text)).toBe(text);
  });

  it('accepts the exact character limit and rejects overflow without truncation', () => {
    const limit = LEARNING_RECORD_FIELD_LIMITS.measurements;
    expect(appendClassroomEvidence('a'.repeat(limit - 3), 'b')).toHaveLength(limit);
    expect(() => appendClassroomEvidence('a'.repeat(limit - 2), 'b')).toThrow(/12000.*未截断/);
    expect(() => appendClassroomEvidence('原文', '   ')).toThrow(/无效/);
  });
});
