import { simulateHighSchoolExperiment, validatedHighSchoolParameters, highSchoolExperiment } from '@physics-lab/physics/high-school';
import type { CapacitorMode } from '@physics-lab/contracts';
import type { HighSchoolMeasurement } from './workbench';

export const capacitorModeLabels: Record<CapacitorMode, string> = {
  charge: '接电源', discharge: '经电阻放电', open: '断路保持',
};

/** Validate the complete process, without replacing the saved measurement values. */
export function checkedCapacitorRecord(record: HighSchoolMeasurement) {
  const keys = highSchoolExperiment('capacitor-charge').parameters.map((parameter) => parameter.key);
  if (!record.parameters || Object.keys(record.parameters).length !== keys.length || keys.some((key) => !Object.hasOwn(record.parameters, key))) {
    throw new RangeError('电容器记录必须保留完整的 R、C、E，不能补默认条件。');
  }
  validatedHighSchoolParameters('capacitor-charge', record.parameters);
  if (!record.capacitorHistory) throw new RangeError('电容器记录缺少完整开关过程，不能假设从零电压充电。');
  const simulation = simulateHighSchoolExperiment('capacitor-charge', record.parameters, record.timeSeconds, record.capacitorHistory);
  if (record.timeSeconds > simulation.durationSeconds) throw new RangeError('电容器记录超过本轮观察时段。');
  return simulation;
}

export function capacitorHistoryLines(record: HighSchoolMeasurement): string[] {
  if (!record.capacitorHistory) return [];
  const simulation = checkedCapacitorRecord(record);
  const history = record.capacitorHistory;
  return [
    `实验轮次：${JSON.stringify(history.runId)}`,
    '该轮从零电压开始；R、C、E 在整轮中固定。各段初始电压由完整开关过程连续计算。',
    ...history.segments.map((segment, index) => `- 第 ${index + 1} 段：${segment.startTimeSeconds} s 起，${capacitorModeLabels[segment.mode]}`),
    `记录所在段：第 ${(simulation.capacitor?.segmentIndex ?? 0) + 1} 段；段内历时 ${simulation.state.segmentElapsedTime} s；段初电压 ${simulation.state.segmentInitialVoltage} V（按保存过程重算）。`,
    `完整开关过程（JSON）：${JSON.stringify(history)}`,
  ];
}
