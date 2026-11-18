import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CapacitorMode } from '@physics-lab/contracts';
import { createCapacitorHistory, simulateHighSchoolExperiment, switchCapacitorMode } from '@physics-lab/physics/high-school';
import { CapacitorDiagram } from './CapacitorDiagram';
import { CapacitorSwitchControl, signedCapacitorReading } from './CapacitorSwitchControl';
import { ExperimentViewport } from './ExperimentViewport';
import { CAPACITOR_BOARD as B, CAPACITOR_WIRES, capacitorCurrentArrow, capacitorPlateSigns, capacitorSwitchEnd, capacitorWorldPoint, isCapacitorSwitchClick, type CapacitorPoint } from './capacitorGeometry';

const parameters = { resistanceKOhm: 10, capacitanceMicrofarads: 470, emf: 6 };
function sample(mode: CapacitorMode = 'charge', timeSeconds = 4.7) {
  let history = createCapacitorHistory('capacitor-ui-fixture');
  if (mode !== 'charge') history = switchCapacitorMode(parameters, history, 4.7, mode);
  return { parameters, mode, simulation: simulateHighSchoolExperiment('capacitor-charge', parameters, timeSeconds, history) };
}
function connected(mode: CapacitorMode, from: CapacitorPoint, to: CapacitorPoint) {
  const paths: readonly CapacitorPoint[][] = [
    ...CAPACITOR_WIRES.filter((wire) => wire.branch !== 'voltmeter').map((wire) => [...wire.points]),
    [B.resistorLeft, B.resistorRight], [B.ammeterLeft, B.ammeterRight],
    ...(mode === 'open' ? [] : [[B.common, capacitorSwitchEnd(mode)]]),
  ];
  const points = [...paths.flat(), from, to];
  const key = (point: CapacitorPoint) => `${point.x},${point.y}`;
  const graph = new Map<string, Set<string>>();
  const join = (a: CapacitorPoint, b: CapacitorPoint) => { const k = key(a); if (!graph.has(k)) graph.set(k, new Set()); graph.get(k)!.add(key(b)); };
  // Split painted wire segments at actual branch junctions, including interior joins.
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    const onSegment = points.filter((p) => Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) < 1e-8
      && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y));
    for (const first of onSegment) for (const second of onSegment) join(first, second);
  }
  const seen = new Set<string>(), queue = [key(from)];
  while (queue.length) { const current = queue.shift()!; if (current === key(to)) return true; if (seen.has(current)) continue; seen.add(current); queue.push(...graph.get(current) ?? []); }
  return false;
}

describe('capacitor shared physical connection geometry', () => {
  it('connects the marked plate to the selected source or return, with neither selected in the open position', () => {
    expect(connected('charge', B.plateP, B.sourcePositive)).toBe(true);
    expect(connected('charge', B.plateP, B.sourceNegative)).toBe(false);
    expect(connected('discharge', B.plateP, B.sourceNegative)).toBe(true);
    expect(connected('discharge', B.plateP, B.sourcePositive)).toBe(false);
    expect(connected('open', B.plateP, B.sourcePositive)).toBe(false);
    expect(connected('open', B.plateP, B.sourceNegative)).toBe(false);
    for (const mode of ['charge', 'discharge', 'open'] as const) expect(connected(mode, B.plateN, B.sourceNegative)).toBe(true);
  });

  it('ends voltmeter leads at their real meter terminals and leaves the dielectric gap without a conducting path', () => {
    const top = CAPACITOR_WIRES.find((wire) => wire.id === 'voltmeter-positive')!, bottom = CAPACITOR_WIRES.find((wire) => wire.id === 'voltmeter-negative')!;
    expect(top.points[0]).toEqual({ x: B.plateP.x, y: 175 }); expect(top.points.at(-1)).toEqual(B.voltmeterTop);
    expect(bottom.points[0]).toEqual({ x: B.plateN.x, y: 240 }); expect(bottom.points.at(-1)).toEqual(B.voltmeterBottom);
    for (const wire of CAPACITOR_WIRES) for (const point of wire.points) {
      expect(point.x >= 535 && point.x <= 585 && point.y > B.plateP.y && point.y < B.plateN.y).toBe(false);
    }
    expect(capacitorSwitchEnd('open')).not.toEqual(B.contacts.open);
  });

  it('maps both views to one fixed plane without shortening component gaps or reversing the current reference', () => {
    for (const wire of CAPACITOR_WIRES) for (const point of wire.points) {
      const world = capacitorWorldPoint(point);
      expect(world.every(Number.isFinite)).toBe(true); expect(world[0] * 80 + 350).toBeCloseTo(point.x, 12);
      expect(world[2] * 80 + 190).toBeCloseTo(point.y, 12); expect(world[1]).toBe(-.55);
    }
    expect(capacitorWorldPoint(B.plateN)[2] - capacitorWorldPoint(B.plateP)[2]).toBe(.4375);
    const positive = capacitorCurrentArrow(.001)!, negative = capacitorCurrentArrow(-.001)!;
    expect(capacitorWorldPoint(positive.end)[0]).toBeGreaterThan(capacitorWorldPoint(positive.start)[0]);
    expect(negative.start).toEqual(positive.end); expect(negative.end).toEqual(positive.start);
  });

  it('uses measured signs rather than switch names, and never invents charge or current at zero', () => {
    expect(capacitorCurrentArrow(0)).toBeNull(); expect(capacitorCurrentArrow(-0)).toBeNull(); expect(capacitorCurrentArrow(NaN)).toBeNull();
    expect(capacitorPlateSigns(0)).toEqual({ p: null, n: null });
    expect(capacitorPlateSigns(.003)).toEqual({ p: '+', n: '−' }); expect(capacitorPlateSigns(-.003)).toEqual({ p: '−', n: '+' });
    expect(signedCapacitorReading(-0)).toBe('0'); expect(signedCapacitorReading(1e-12)).toBe('+1.00e-12');
    expect(signedCapacitorReading(-.0004, 1000)).toBe('−0.4');
  });

  it('rejects orbit drags, right clicks and missing movement evidence', () => {
    expect(isCapacitorSwitchClick({ delta: 0, button: 0 })).toBe(true); expect(isCapacitorSwitchClick({ delta: 4, button: 0 })).toBe(true);
    for (const event of [{ delta: 4.01 }, { delta: 10 }, { delta: NaN }, { delta: -1 }, { delta: 0, button: 2 }, {}]) expect(isCapacitorSwitchClick(event)).toBe(false);
  });
});

describe('capacitor diagram and instrument semantics', () => {
  it('renders an initially uncharged capacitor without imaginary surface charges, using explicit history', () => {
    const props = sample('charge', 0), html = renderToStaticMarkup(<CapacitorDiagram {...props} onModeChange={() => {}} />);
    expect(html).toContain('class="hs-diagram"'); expect(html).toContain('电容器充放电交互电路板');
    expect(html).not.toContain('data-capacitor-charge-signs'); expect(html).toContain('data-capacitor-current-direction="1"');
    expect(html.match(/data-capacitor-switch=/g)).toHaveLength(3); expect(html.match(/role="button" tabindex="0"/g)).toHaveLength(3);
    expect(html).toContain('电流表串联，电压表并联电容'); expect(html).toContain('无电荷跨越');
  });

  it('keeps positive voltage and opposite plate signs when open, but removes the current arrow', () => {
    const props = sample('open', 9.4), html = renderToStaticMarkup(<CapacitorDiagram {...props} />);
    expect(props.simulation.state.voltage).toBeCloseTo(3.79272335297, 10);
    expect(html).toContain('+3.793 V'); expect(html).toContain('P极板+，N极板−');
    expect(html).not.toContain('data-capacitor-current-direction'); expect(html).toContain('I 0 mA');
    expect(html.match(/tabindex="-1" aria-disabled="true"/g)).toHaveLength(3);
    const control = renderToStaticMarkup(<CapacitorSwitchControl {...props} />);
    expect(control).toContain('U、Q 与储能保持'); expect(control).toContain('不是整个电容器带净电荷 Q');
  });

  it('shows a negative discharge current without changing the fixed positive voltage reference', () => {
    const props = sample('discharge', 9.4), html = renderToStaticMarkup(<CapacitorDiagram {...props} />);
    expect(props.simulation.state.current).toBeLessThan(0); expect(props.simulation.state.voltage).toBeGreaterThan(0);
    expect(html).toContain('data-capacitor-current-direction="-1"'); expect(html).toContain('I −0.14 mA');
    expect(html).toContain('P极板+，N极板−'); expect(html).toContain('I 正方向 → 流入 P');
  });

  it.each([
    { resistanceKOhm: 1, capacitanceMicrofarads: 100, emf: 1 },
    { resistanceKOhm: 10, capacitanceMicrofarads: 1000, emf: 12 },
  ])('keeps extreme parameter drawings finite without inventing an exactly full charge', (conditions) => {
    const history = createCapacitorHistory('extreme-ui'), initial = simulateHighSchoolExperiment('capacitor-charge', conditions, 0, history);
    const simulation = simulateHighSchoolExperiment('capacitor-charge', conditions, initial.durationSeconds, history);
    const html = renderToStaticMarkup(<CapacitorDiagram parameters={conditions} simulation={simulation} mode="charge" />);
    expect(html).not.toMatch(/NaN|Infinity/); expect(simulation.state.current).toBeGreaterThan(0);
    expect(html).toContain('data-capacitor-current-direction="1"');
    expect(html).not.toContain('完全充满');
  });

  it('integrates the accessible SVG fallback with current mode and per-instance arrow markers', () => {
    const props = sample('discharge', 9.4);
    const html = renderToStaticMarkup(<><ExperimentViewport experimentId="capacitor-charge" {...props} trajectory={[]} capacitorMode={props.mode} onCapacitorModeChange={() => {}} /><CapacitorDiagram {...props} /></>);
    expect(html).toContain('hs-capacitor-viewport-stage'); expect(html).toContain('data-capacitor-switch-blade="discharge"');
    const ids = [...html.matchAll(/<marker id="([^"]+)"/g)].map((match) => match[1]); expect(new Set(ids).size).toBe(2);
    expect(html).toContain('键盘同样可操作');
  });
});
