import { formatMeasurement } from './workbench';

type Metric = { key: string; value: number };
const flags = new Set(['readingValid', 'objectReadingValid', 'configurationValid', 'overRange', 'periodDefined', 'radiusDefined', 'estimateDefined', 'criticalDefined', 'totalInternalReflection', 'transmissionValid', 'emissionAllowed', 'emitting', 'collisionTimeDefined', 'collisionPredicted', 'collisionWithinWindow', 'collided']);
export function metricState(metrics: readonly Metric[]) { return Object.fromEntries(metrics.map((metric) => [metric.key, metric.value])); }

/** Undefined quantities stay visibly undefined; a finite serialization placeholder is not a measurement. */
export function formatMetric(metric: Metric, state: Record<string, number>) {
  if (!Number.isFinite(metric.value)) return '—';
  if (flags.has(metric.key)) return metric.value === 1 ? '是' : '否';
  if (metric.key === 'relayOn') return metric.value === 1 ? '开启' : '关闭';
  if (metric.key === 'period' && state.periodDefined === 0) return '无周期';
  if (metric.key === 'radius' && state.radiusDefined === 0) return '无回旋半径';
  if (metric.key === 'criticalAngleDegrees' && state.criticalDefined === 0) return '无临界角';
  if ((metric.key === 'refractedAngleDegrees' || metric.key === 'sinRefracted') && state.transmissionValid === 0) return '无折射光';
  if ((metric.key === 'estimatedResistivity' || metric.key === 'indexRatioEstimate') && state.estimateDefined === 0) return '尚不可估计';
  if (metric.key === 'collisionTime' && state.collisionPredicted === 0) return '不会相遇';
  if (metric.key === 'collisionTime' && state.collisionTimeDefined === 0) return '超出可表示时间';
  if ((metric.key === 'stoppingVoltage' || metric.key === 'maxKineticEnergyEv') && state.emissionAllowed === 0) return '无出射电子';
  if (state.readingValid === 0 && ['meterValue', 'indicatedLengthMm', 'correctedLengthMm', 'mainScaleMm', 'vernierDivision', 'thimbleDivision', 'secondaryRmsVoltage', 'secondaryCurrentRms', 'secondaryPower', 'primaryCurrentRms', 'primaryPower'].includes(metric.key)) return '无有效读数';
  return formatMeasurement(metric.value);
}
