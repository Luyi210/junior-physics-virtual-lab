import type { HighSchoolSimulation } from '@physics-lab/physics/high-school';
import { formatMetric } from '../experiments/measurementPresentation';
import './ExperimentReadings.css';
const flags = new Set(['readingValid','objectReadingValid','configurationValid','overRange','periodDefined','radiusDefined','estimateDefined','criticalDefined','totalInternalReflection','transmissionValid','emissionAllowed','emitting','collisionPredicted','collisionWithinWindow','collided','collisionTimeDefined']);
export function ExperimentReadings({ simulation }: { simulation: HighSchoolSimulation }) {
  const main = simulation.metrics.filter(metric => !flags.has(metric.key)).slice(0, 6);
  const remaining = simulation.metrics.filter(metric => !main.includes(metric));
  return <section className="hs-instrument-readings" aria-label="当前模型读数"><div className="hs-live-readings">{main.map(metric => <div key={metric.key}><span>{metric.label}</span><strong>{formatMetric(metric, simulation.state)}<small>{metric.unit}</small></strong></div>)}</div>{remaining.length > 0 && <details className="hs-more-readings"><summary>更多读数与器材状态 <span>{remaining.length} 项</span></summary><dl>{remaining.map(metric => <div key={metric.key}><dt>{metric.label}</dt><dd>{formatMetric(metric, simulation.state)} {metric.unit}</dd></div>)}</dl></details>}</section>;
}
