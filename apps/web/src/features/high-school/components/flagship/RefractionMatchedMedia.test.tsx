import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics';
import { Arrow3D } from '../expanded/ApparatusPrimitives3D';
import { RefractionDiagram } from './RefractionDiagram';
import { RefractionApparatus3D } from './RefractionApparatus3D';

function walk(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : [];
}
function props(incidentIndex: number, transmittedIndex: number, incidentAngleDegrees: number) {
  const parameters = { ...defaultHighSchoolParameters('refractive-index'), incidentIndex, transmittedIndex, incidentAngleDegrees };
  return { experimentId: 'refractive-index' as const, parameters, simulation: simulateHighSchoolExperiment('refractive-index', parameters) };
}
function reflectedArrowCount(input: ReturnType<typeof props>) {
  return walk(RefractionApparatus3D(input)).filter(node => node.type === Arrow3D && node.props.color === '#849565').length;
}

describe('refraction apparatus at an index-matched interface', () => {
  it('shows only straight transmission when both ordinary dielectric indices are equal', () => {
    for (const angle of [0, 40, 85]) {
      const input = props(1.5, 1.5, angle);
      expect(input.simulation.state.refractedAngleDegrees).toBeCloseTo(angle, 10);
      const html = renderToStaticMarkup(<RefractionDiagram {...input} />);
      expect(html).not.toContain('stroke="#8b9b69"');
      expect(html).toContain('同折射率：无反射光');
      expect(html).toContain('data-transmitted-ray="true"');
      expect(reflectedArrowCount(input)).toBe(0);
    }
  });

  it('retains reflection for unequal media, including normal incidence and total internal reflection', () => {
    for (const input of [props(1, 1.5, 0), props(1, 1.5, 40), props(1.5, 1, 60)]) {
      const html = renderToStaticMarkup(<RefractionDiagram {...input} />);
      expect(html).toContain('stroke="#8b9b69"');
      expect(reflectedArrowCount(input)).toBe(1);
      expect(html.includes('data-transmitted-ray="true"')).toBe(Boolean(input.simulation.state.transmissionValid));
    }
  });
});
