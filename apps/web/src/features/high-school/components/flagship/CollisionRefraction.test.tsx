import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { collisionComparison, collisionScene, collisionExamples } from './CollisionModelView';
import { CollisionLearningPanel } from './CollisionLearningPanel';
import { CollisionDiagram } from './CollisionDiagram';
import { CollisionApparatus3D } from './CollisionApparatus3D';
import { RefractionLearningPanel } from './RefractionLearningPanel';
import { formatRefractionAngle, refractionAnglePoint, refractionArc, refractionBoardPoint, refractionPointerAngle, refractionRays, refractionStatus } from './RefractionGeometry';

vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useId: () => 'refraction-test-id' }));
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''; }
function button(node: ReactNode, label: string) { return walk(node).find(e => e.type === 'button' && text(e.props.children as ReactNode) === label)!; }
function click(element: Element) { (element.props.onClick as () => void)(); }
function collision(overrides: Record<string, number> = {}, time = 0) { const parameters = { ...defaultHighSchoolParameters('momentum-conservation'), ...overrides }; return { experimentId: 'momentum-conservation' as const, parameters, simulation: simulateHighSchoolExperiment('momentum-conservation', parameters, time) }; }
function refraction(overrides: Record<string, number> = {}) { const parameters = { ...defaultHighSchoolParameters('refractive-index'), ...overrides }; return { experimentId: 'refractive-index' as const, parameters, simulation: simulateHighSchoolExperiment('refractive-index', parameters) }; }

describe('collision flagship comparison is a model aid, not a saved measurement', () => {
  it('does not reveal imaginary post-collision values before a collision occurs', () => {
    const before = collision({}, .1), after = collision({}, .6);
    const first = renderToStaticMarkup(<CollisionLearningPanel {...before} />), second = renderToStaticMarkup(<CollisionLearningPanel {...after} />);
    expect(first).toContain('碰前当前'); expect(first).not.toContain('碰后当前');
    expect(first).toContain('不会提前填入碰后结果');
    expect(second).toContain('碰后当前'); expect(second).toContain('e=1为理想弹性碰撞');
    expect(second).toContain('不会自动加入实验档案'); expect(second).toContain('不以它作相对误差的分母');
    expect(collisionComparison(after.parameters, after.simulation.state).initialMomentum).toBe(0);
  });
  it('separates a nonmeeting pair from a meeting outside the observation window', () => {
    expect(renderToStaticMarkup(<CollisionLearningPanel {...collision({ velocity1: -1, velocity2: 1 })} />)).toContain('不会相遇');
    expect(renderToStaticMarkup(<CollisionLearningPanel {...collision({ velocity1: .1, velocity2: 0, separation: 3 })} />)).toContain('超出6 s观察窗');
  });
  it('reports common nonzero velocity and retained centre-of-mass energy for e=0', () => {
    const props = collision({ velocity1: 2, velocity2: .5, restitution: 0 }, 1);
    expect(props.simulation.state.velocity1).toBe(1.25);
    expect(props.simulation.state.velocity2).toBe(1.25);
    expect(props.simulation.state.kineticEnergy).toBeGreaterThan(0);
    expect(renderToStaticMarkup(<CollisionLearningPanel {...props} />)).toContain('两车同速，不一定静止');
  });
  it('restitution buttons change only e and examples explicitly retain the selected e', () => {
    const change = vi.fn(), props = collision(); const tree = CollisionLearningPanel({ ...props, onChange: change });
    click(button(tree, '0 · 完全非弹性')); expect(change).toHaveBeenLastCalledWith({ restitution: 0 });
    for (const example of collisionExamples) { click(button(tree, example.label)); expect(change).toHaveBeenLastCalledWith({ ...example.patch }); expect(example.patch).not.toHaveProperty('restitution'); }
    expect(text(tree)).toContain('每次点击都从头计时'); expect(text(tree)).toContain('已有档案保留');
    expect(props.parameters.restitution).toBe(1);
    expect(walk(CollisionLearningPanel(props)).filter(e => e.type === 'button').every(e => e.props.disabled)).toBe(true);
  });
  it.each([0, .5, 1])('uses the same position reference at the contact boundary for e=%s in 2D/3D', restitution => {
    const props = collision({ restitution }, .5), scene = collisionScene(props.parameters, props.simulation);
    expect(props.simulation.state.collided).toBe(1);
    expect(scene.svgCart1 + 28).toBeCloseTo(scene.svgCart2 - 28, 12);
    expect(scene.worldCart1 + .35).toBeCloseTo(scene.worldCart2 - .35, 12);
    const later = collision({ restitution }, 1), lateScene = collisionScene(later.parameters, later.simulation);
    expect(lateScene.svgCart1 + 28).toBeLessThanOrEqual(lateScene.svgCart2 - 28);
    expect(lateScene.extent).toBe(scene.extent);
    const html = renderToStaticMarkup(<CollisionDiagram {...props} />);
    expect(html).toContain('初始位置'); expect(html).toContain('kg·m/s'); expect(html).not.toMatch(/NaN|undefined/);
    expect(text(CollisionApparatus3D(props))).toContain('碰后对照');
  });
});

describe('refraction flagship retains exact critical values and accessible controls', () => {
  it('changes the requested angle only and swapping media preserves angle', () => {
    const change = vi.fn(), props = refraction(); const tree = RefractionLearningPanel({ ...props, onChange: change });
    click(button(tree, '−1°')); expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: 39 });
    click(button(tree, '+1°')); expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: 41 });
    click(button(tree, '交换两侧介质，保留入射角')); expect(change).toHaveBeenLastCalledWith({ incidentIndex: 1.5, transmittedIndex: 1 });
    const range = walk(tree).find(e => e.type === 'input')!;
    (range.props.onChange as (e: unknown) => void)({ target: { value: '26.3' } });
    expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: 26.3 });
    expect(props.parameters.incidentAngleDegrees).toBe(40);
  });
  it('passes exact critical angle rather than the rounded displayed value and selects only that state', () => {
    const change = vi.fn(), props = refraction({ incidentIndex: 1.5, transmittedIndex: 1 });
    const critical = props.simulation.state.criticalAngleDegrees;
    const tree = RefractionLearningPanel({ ...props, onChange: change });
    click(button(tree, '恰好临界 C'));
    expect(change).toHaveBeenLastCalledWith({ incidentAngleDegrees: critical });
    expect(critical).not.toBe(Number(critical.toFixed(2)));
    const exact = refraction({ ...props.parameters, incidentAngleDegrees: critical });
    const exactTree = RefractionLearningPanel({ ...exact, onChange: change });
    expect(button(exactTree, '恰好临界 C').props['aria-pressed']).toBe(true);
    expect(text(exactTree)).toContain('临界掠射'); expect(text(exactTree)).toContain('≈41.81°');
    const above = refraction({ ...props.parameters, incidentAngleDegrees: critical + .5 });
    expect(button(RefractionLearningPanel({ ...above, onChange: change }), '恰好临界 C').props['aria-pressed']).toBe(false);
    expect(refractionStatus(above.parameters, above.simulation.state)).toContain('全反射');
    expect(formatRefractionAngle(40)).toBe('40°');
  });
  it('does not offer impossible critical targets outside the model angle range', () => {
    const change = vi.fn();
    const props = refraction({ incidentIndex: 1.001, transmittedIndex: 1 });
    const tree = RefractionLearningPanel({ ...props, onChange: change });
    expect(props.simulation.state.criticalAngleDegrees).toBeGreaterThan(85);
    expect(button(tree, '恰好临界 C').props.disabled).toBe(true);
    expect(text(tree)).toContain('当前临界点超出范围');
    const normal = RefractionLearningPanel({ ...refraction({ incidentAngleDegrees: 0 }), onChange: change });
    expect(text(normal)).toContain('0/0不能单独估折射率比'); expect(button(normal, '−1°').props.disabled).toBe(true);
    expect(button(RefractionLearningPanel({ ...refraction({ incidentAngleDegrees: 85 }), onChange: change }), '+1°').props.disabled).toBe(true);
    expect(walk(RefractionLearningPanel(props)).filter(e => e.type === 'button' || e.type === 'input').every(e => e.props.disabled)).toBe(true);
  });
  it('keeps propagation direction and angle sectors consistent across the SVG and world planes', () => {
    for (const angle of [0, 20, 40, 85]) {
      const props = refraction({ incidentAngleDegrees: angle }), rays = refractionRays(props.simulation.state);
      expect(rays.incident.x).toBeLessThanOrEqual(rays.origin.x); expect(rays.incident.y).toBeLessThan(rays.origin.y);
      expect(rays.transmitted.x).toBeGreaterThanOrEqual(rays.origin.x); expect(rays.transmitted.y).toBeGreaterThan(rays.origin.y);
      const incident = refractionBoardPoint(rays.incident), transmitted = refractionBoardPoint(rays.transmitted);
      expect(incident[2]).toBeLessThan(0); expect(transmitted[2]).toBeGreaterThan(0);
      const endpoint = refractionAnglePoint(angle, 49, 'incident');
      expect(refractionArc(angle, 49, 'incident')).toContain(`${endpoint.x} ${endpoint.y}`);
    }
  });
  it('maps a narrow letterboxed pointer position to the same angle as a full-size view', () => {
    const point = refractionAnglePoint(40, 141, 'incident');
    expect(refractionPointerAngle(point.x, point.y, { left: 0, top: 0, width: 700, height: 400 })).toBe(40);
    expect(refractionPointerAngle(12 + point.x / 2, 90 + 40 + point.y / 2, { left: 12, top: 90, width: 350, height: 280 })).toBe(40);
    expect(refractionPointerAngle(0, 0, { left: 0, top: 0, width: 0, height: 400 })).toBeNull();
    expect(refractionPointerAngle(285, 198, { left: 0, top: 0, width: 700, height: 400 })).toBeNull();
  });
});
