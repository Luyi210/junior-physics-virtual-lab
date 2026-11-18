import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { SPRING_SCENE, springSceneGeometry } from './springSceneGeometry';
import { ExperimentDiagram2D } from './ExperimentDiagram2D';
import { measurementsToCsv } from '../experiments/workbench';
import { highSchoolExperiment } from '@physics-lab/physics/high-school';

describe('spring apparatus calibrated geometry', () => {
  for (const stiffness of [10, 50]) for (const naturalLength of [.1, .3]) for (const loadMassGrams of [0, 250]) {
    it(`preserves length, extension and base clearance at k=${stiffness}, L0=${naturalLength}, m=${loadMassGrams}`, () => {
      const parameters = { stiffness, naturalLength, loadMassGrams };
      const simulation = simulateHighSchoolExperiment('spring-force', parameters);
      const { length, extension } = simulation.state;
      const scene = springSceneGeometry(naturalLength, length);
      expect((scene.svgEnd - scene.svgTop) / SPRING_SCENE.svgPixelsPerMetre).toBeCloseTo(length, 12);
      expect((scene.svgEnd - scene.svgNaturalEnd) / SPRING_SCENE.svgPixelsPerMetre).toBeCloseTo(extension, 12);
      expect((scene.worldTop - scene.worldEnd) / SPRING_SCENE.worldUnitsPerMetre).toBeCloseTo(length, 12);
      expect((scene.worldNaturalEnd - scene.worldEnd) / SPRING_SCENE.worldUnitsPerMetre).toBeCloseTo(extension, 12);
      expect(scene.coilPoints[0]).toEqual([0, scene.worldTop, 0]);
      expect(scene.coilPoints.at(-1)![1]).toBeCloseTo(scene.worldEnd, 12);
      expect(scene.weightCenter[1] - SPRING_SCENE.weightHeight / 2).toBeGreaterThan(SPRING_SCENE.baseTop);
      expect(scene.svgEnd + 39).toBeLessThan(335);
      const html = renderToStaticMarkup(<ExperimentDiagram2D experimentId="spring-force" parameters={parameters} simulation={simulation} trajectory={[]} />);
      expect(html).not.toMatch(/NaN|Infinity/);
      expect(html).toContain(`d="M290 ${scene.svgEnd}H368"`);
      expect(html.includes('未加载：弹簧恢复原长。')).toBe(loadMassGrams === 0);
      // An unloaded scene has no copper mass that would contradict zero force.
      expect(html.includes('fill="#b66a3e"')).toBe(loadMassGrams > 0);
    });
  }

  it('keeps every ruler tick fixed when both the spring and load change', () => {
    const original = springSceneGeometry(.15, .199);
    const changed = springSceneGeometry(.3, .545);
    expect(changed.ticks).toEqual(original.ticks);
    for (const tick of changed.ticks) {
      expect((tick.svgY - changed.svgTop) / SPRING_SCENE.svgPixelsPerMetre).toBeCloseTo(tick.centimetres / 100, 12);
      expect((changed.worldTop - tick.worldY) / SPRING_SCENE.worldUnitsPerMetre).toBeCloseTo(tick.centimetres / 100, 12);
    }
  });

  it('exports the saved load, original and total lengths with units for independent recomputation', () => {
    const parameters = defaultHighSchoolParameters('spring-force');
    const simulation = simulateHighSchoolExperiment('spring-force', parameters);
    const csv = measurementsToCsv([{ id: 'spring', createdAt: '2026-11-11T00:00:00Z', timeSeconds: 0, parameters, metrics: simulation.metrics }], highSchoolExperiment('spring-force'));
    expect(csv).toContain(' / g');
    expect(csv).toContain(' / N/m');
    for (const key of ['naturalLength', 'length', 'extension', 'force']) {
      const metric = simulation.metrics.find((item) => item.key === key)!;
      expect(csv).toContain(`${metric.label} / ${metric.unit}`);
      expect(csv).toContain(`"${metric.value}"`);
    }
  });
});
