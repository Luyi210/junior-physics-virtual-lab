import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCapacitorHistory, defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics';
import { ExperimentPlot } from './ExperimentPlot';

function horizontalTicks(html: string) {
  return [...html.matchAll(/<text x="[^"]+" y="275" text-anchor="middle">([^<]+)<\/text>/g)].map(match => Number(match[1].replaceAll(',', '')));
}

describe('model plot scales retain the physical data range', () => {
  it('spans the gas volume domain in SI units without adding a spurious 1 litre range', () => {
    const parameters = defaultHighSchoolParameters('gas-pressure-volume');
    const graph = simulateHighSchoolExperiment('gas-pressure-volume', parameters).series[0];
    const html = renderToStaticMarkup(<ExperimentPlot series={graph} />);
    const ticks = horizontalTicks(html);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBeCloseTo(10e-6, 12);
    expect(ticks[4]).toBeCloseTo(100e-6, 12);
    expect(ticks.every((value, index) => index === 0 || value > ticks[index - 1])).toBe(true);
    const curve = html.match(/<path d="([^"]+)" fill="none" stroke="#235540"/)![1];
    expect(curve).toMatch(/^M66\.00,/);
    expect(curve).toMatch(/L678\.00,[\d.]+$/);
  });

  it('keeps all initial RC tick labels increasing when the history only contains t=0', () => {
    const graph = simulateHighSchoolExperiment('capacitor-charge', defaultHighSchoolParameters('capacitor-charge'), 0, createCapacitorHistory('initial-axis')).series[0];
    const html = renderToStaticMarkup(<ExperimentPlot series={graph} historyOnly />);
    const ticks = horizontalTicks(html);
    expect(ticks).toHaveLength(5);
    expect(ticks.every((value, index) => index === 0 || value > ticks[index - 1])).toBe(true);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('preserves the full normal time domain and exact live marker', () => {
    const simulation = simulateHighSchoolExperiment('uniform-acceleration', defaultHighSchoolParameters('uniform-acceleration'), 1);
    const graph = simulation.series[0];
    const html = renderToStaticMarkup(<ExperimentPlot series={graph} currentPoint={{ x: simulation.state.time, y: simulation.state.position }} />);
    expect(horizontalTicks(html).at(-1)).toBe(simulation.durationSeconds);
    expect(html).toContain(`data-current-point="1,${simulation.state.position}"`);
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
