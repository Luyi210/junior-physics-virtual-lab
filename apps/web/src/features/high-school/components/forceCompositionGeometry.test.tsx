import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { ForceCompositionDiagram } from './ForceCompositionDiagram';
import { ForceCompositionControl } from './ForceCompositionControl';
import { FORCE_BOARD, FORCE_HANDLES, FORCE_PRESETS, forceArrowGeometry, forceClientPoint, forceDragPatch, forceKeyboardPatch, forceVectorPoint } from './forceCompositionGeometry';

const defaults = defaultHighSchoolParameters('force-composition');
function scene(changes: Record<string, number> = {}) {
  const parameters = { ...defaults, ...changes };
  return { parameters, simulation: simulateHighSchoolExperiment('force-composition', parameters) };
}
function arrowTip(html: string, id: string) {
  const points = html.match(new RegExp(`data-force-arrowhead="${id}" points="([^"]+)"`))![1]!;
  return points.split(' ')[0]!.split(',').map(Number);
}

describe('force board shared geometric scale', () => {
  it('uses equal lengths for equal forces in every quadrant, including the maximum resultant', () => {
    for (const angle of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
      const { simulation } = scene({ force1N: 5, force2N: 5, angle1Degrees: angle, angle2Degrees: angle, trialForceN: 10, trialAngleDegrees: angle });
      const s = simulation.state;
      const first = forceVectorPoint(s.force1X, s.force1Y), total = forceVectorPoint(s.resultantX, s.resultantY), trial = forceVectorPoint(s.trialX, s.trialY);
      const distance = (point: { x: number; y: number }) => Math.hypot(point.x - FORCE_BOARD.origin.x, point.y - FORCE_BOARD.origin.y);
      expect(distance(first)).toBeCloseTo(5 * FORCE_BOARD.pixelsPerNewton, 10);
      expect(distance(total)).toBeCloseTo(2 * distance(first), 10);
      expect(trial).toEqual(total);
      for (const point of forceArrowGeometry(total)!.head) {
        expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(FORCE_BOARD.width);
        expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(FORCE_BOARD.height);
      }
    }
  });

  it.each([
    { left: 20, top: 30, width: 700, height: 380 },
    { left: 12, top: 90, width: 350, height: 280 },
    { left: 100, top: 40, width: 1000, height: 380 },
  ])('inverts SVG meet scaling and letterboxing for $width × $height', (rect) => {
    const point = forceVectorPoint(-3, 4);
    const scale = Math.min(rect.width / FORCE_BOARD.width, rect.height / FORCE_BOARD.height);
    const clientX = rect.left + (rect.width - FORCE_BOARD.width * scale) / 2 + point.x * scale;
    const clientY = rect.top + (rect.height - FORCE_BOARD.height * scale) / 2 + point.y * scale;
    const mapped = forceClientPoint(clientX, clientY, rect)!;
    expect(mapped.x).toBeCloseTo(point.x, 10); expect(mapped.y).toBeCloseTo(point.y, 10);
    expect(forceDragPatch('force1', mapped, 0)).toEqual({ force1N: 5, angle1Degrees: 126.9 });
  });

  it('rejects invalid pointer rectangles rather than sending a NaN parameter patch', () => {
    const rect = { left: 0, top: 0, width: 700, height: 380 };
    expect(forceClientPoint(1, 2, { ...rect, width: 0 })).toBeNull();
    expect(forceClientPoint(1, 2, { ...rect, height: -1 })).toBeNull();
    expect(forceClientPoint(Infinity, 2, rect)).toBeNull();
    expect(forceDragPatch('trial', { x: NaN, y: 190 }, 0)).toBeNull();
  });

  it('clamps only magnitude while sending magnitude and direction together, with no trial autofill', () => {
    expect(forceDragPatch('force2', forceVectorPoint(-6, -8), 0)).toEqual({ force2N: 5, angle2Degrees: -126.9 });
    expect(forceDragPatch('trial', forceVectorPoint(-6, -8), 0)).toEqual({ trialForceN: 10, trialAngleDegrees: -126.9 });
    expect(forceDragPatch('force1', FORCE_BOARD.origin, 73)).toEqual({ force1N: 0, angle1Degrees: 73 });
    expect(forceArrowGeometry(FORCE_BOARD.origin)).toBeNull();
    const tiny = forceArrowGeometry(forceVectorPoint(.001, 0))!;
    expect(tiny.shaftEnd.x).toBeGreaterThan(FORCE_BOARD.origin.x);
    expect(tiny.head.every((point) => point.x >= FORCE_BOARD.origin.x)).toBe(true);
  });

  it('supports keyboard rotation, bounded magnitude, faster shift steps and zero without consuming unrelated keys', () => {
    expect(forceKeyboardPatch('force1', { ...defaults, angle1Degrees: 180 }, 'ArrowLeft')).toEqual({ force1N: 3, angle1Degrees: -179 });
    expect(forceKeyboardPatch('force1', { ...defaults, angle1Degrees: -180 }, 'ArrowRight', true)).toEqual({ force1N: 3, angle1Degrees: 170 });
    expect(forceKeyboardPatch('force2', defaults, 'ArrowUp', true)).toEqual({ force2N: 5, angle2Degrees: 90 });
    expect(forceKeyboardPatch('force2', { ...defaults, force2N: 0 }, 'ArrowDown')).toEqual({ force2N: 0, angle2Degrees: 90 });
    expect(forceKeyboardPatch('trial', defaults, 'Home')).toEqual({ trialForceN: 0, trialAngleDegrees: 0 });
    expect(forceKeyboardPatch('trial', defaults, 'End')).toEqual({ trialForceN: 10, trialAngleDegrees: 0 });
    expect(forceKeyboardPatch('trial', defaults, 'Tab')).toBeNull();
  });

  it('keeps all presets independent of the learner trial and agrees with model reference results', () => {
    const results: Record<string, number> = { same: 7, perpendicular: 5, opposite: 1, cancel: 0 };
    for (const preset of FORCE_PRESETS) {
      expect(Object.keys(preset.patch).sort()).toEqual(['angle1Degrees', 'angle2Degrees', 'force1N', 'force2N']);
      const simulation = scene({ ...preset.patch, trialForceN: 2.7, trialAngleDegrees: -37 }).simulation;
      expect(simulation.state.resultantMagnitude).toBeCloseTo(results[preset.id]!, 12);
      expect(simulation.state.trialForceN).toBe(2.7);
      expect(simulation.state.residualMagnitude).toBeGreaterThan(0);
    }
  });
});

describe('force board semantic SSR', () => {
  it('renders model-provided endpoints, an actual parallelogram and accessible controls', () => {
    const html = renderToStaticMarkup(<ForceCompositionDiagram {...scene()} onChange={() => {}} />);
    expect(html).toContain('class="hs-diagram"');
    expect(html).toContain('共点力二维矢量板');
    expect(html).toContain('不是实体测力计读数');
    expect(arrowTip(html, 'force1')).toEqual([392, 190]);
    expect(arrowTip(html, 'force2')).toEqual([350, 134]);
    expect(arrowTip(html, 'resultant')).toEqual([392, 134]);
    expect(arrowTip(html, 'trial')).toEqual([420, 190]);
    expect(html).toContain('data-force-parallelogram="true" d="M392 190L392 134L350 134"');
    expect(html.match(/data-force-handle=/g)).toHaveLength(3);
    expect(html.match(/role="button" tabindex="0"/g)).toHaveLength(3);
    expect(html.match(/vector-effect="non-scaling-stroke"/g)).toHaveLength(3);
    expect(html).toContain('Shift ×10');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('does not draw an invented direction when nonzero opposing forces cancel', () => {
    const html = renderToStaticMarkup(<ForceCompositionDiagram {...scene({ force2N: 3, angle2Degrees: 180 })} onChange={() => {}} />);
    expect(html).toContain('F参考 = 0；方向未定义');
    expect(html).not.toContain('data-force-arrowhead="resultant"');
    expect(html).toContain('data-force-arrowhead="force1"');
    expect(html).toContain('data-force-arrowhead="force2"');
  });

  it('keeps three independently selectable handles at zero without any arrowhead or fake parallelogram', () => {
    const html = renderToStaticMarkup(<ForceCompositionDiagram {...scene({ force1N: 0, force2N: 0, trialForceN: 0, angle1Degrees: -125, angle2Degrees: 45, trialAngleDegrees: 90 })} onChange={() => {}} />);
    expect(html).not.toContain('data-force-arrowhead=');
    expect(html).not.toContain('data-force-parallelogram=');
    expect(html.match(/零力，方向未定义/g)).toHaveLength(3);
    for (const spec of Object.values(FORCE_HANDLES)) expect(html).toContain(spec.label);
    expect(html.match(/aria-pressed=/g)).toHaveLength(3);
  });

  it('describes a read-only diagram with no keyboard-mutable handle when callbacks are absent', () => {
    const html = renderToStaticMarkup(<ForceCompositionDiagram {...scene()} />);
    expect(html).toContain('只读矢量示意');
    expect(html.match(/tabindex="-1" aria-disabled="true"/g)).toHaveLength(3);
  });

  it('calls the comparison threshold educational and leaves recording an explicit action', () => {
    const base = scene();
    const close = { ...base.simulation, state: { ...base.simulation.state, residualMagnitude: .05 } };
    const html = renderToStaticMarkup(<ForceCompositionControl {...base} simulation={close} onChange={() => {}} onRecord={() => {}} />);
    expect(html).toContain('当前单力与合力参考接近');
    expect(html).toContain('0.05 N 是教学对照阈值，不是测量精度');
    expect(html).toContain('记录这一组');
    expect(html).toContain('不会自动记录');
    const outside = renderToStaticMarkup(<ForceCompositionControl {...base} simulation={{ ...close, state: { ...close.state, residualMagnitude: .05001 } }} />);
    expect(outside).toContain('继续调整 F试');
    expect(outside).not.toContain('当前单力与合力参考接近');
  });
});
