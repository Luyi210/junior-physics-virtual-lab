import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment } from '@physics-lab/physics/high-school';
import { ElectricDiagram } from '../expanded/ElectricDiagrams';
import { ElectricApparatus3D } from '../expanded/ElectricApparatus3D';
import { multimeterDialDirection, multimeterPresentation, multimeterWiring } from '../expanded/multimeterGeometry';
import { MultimeterControlPanel } from './MultimeterControlPanel';

function model(patch: Record<string, number> = {}) {
  const parameters = { ...defaultHighSchoolParameters('multimeter'), ...patch };
  return { experimentId: 'multimeter' as const, parameters, simulation: simulateHighSchoolExperiment('multimeter', parameters, 0) };
}
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(nodes) : isValidElement<Record<string, unknown>>(node) ? [node, ...nodes(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : ''; }

describe('multimeter same-model display and instrument geometry', () => {
  it.each([
    [0,0,{supplyVoltage:1},'1.000 V','0.001 V'],[0,1,{},'6.00 V','0.01 V'],[0,2,{},'6.0 V','0.1 V'],
    [1,0,{supplyVoltage:1},'1.000 mA','0.001 mA'],[1,1,{},'6.00 mA','0.01 mA'],[1,2,{},'6.0 mA','0.1 mA'],
    [2,0,{resistanceOhms:100},'100.0 Ω','0.1 Ω'],[2,1,{},'1.000 kΩ','0.001 kΩ'],[2,2,{},'1.00 kΩ','0.01 kΩ'],
  ] as const)('keeps meaningful decimal places for mode %s range %s', (functionMode,rangeIndex,patch,display,resolution) => {
    const props = model({ functionMode, rangeIndex, connection:functionMode, powerOn:functionMode===2?0:1, ...patch });
    const before = JSON.stringify(props), view = multimeterPresentation(props.parameters, props.simulation.state);
    expect(view.display).toBe(display); expect(view.resolutionLabel).toBe(resolution);
    expect(renderToStaticMarkup(<ElectricDiagram {...props}/>)).toContain(display);
    expect(text(ElectricApparatus3D(props))).toContain(display);
    expect(renderToStaticMarkup(<MultimeterControlPanel {...props}/>)).toContain(display);
    expect(JSON.stringify(props)).toBe(before);
  });

  it('separates valid zero, negative polarity, invalid connection and over-range', () => {
    const view = (patch:Record<string,number>) => { const props=model(patch); return multimeterPresentation(props.parameters,props.simulation.state); };
    expect(view({powerOn:0}).display).toBe('0.00 V'); expect(view({circuitClosed:0}).display).toBe('0.00 V');
    expect(view({probesReversed:1}).display).toBe('-6.00 V');
    expect(view({functionMode:1}).display).toBe('接法无效'); expect(view({functionMode:1}).reasons.join('')).toContain('串入');
    const resistance=view({functionMode:2}); expect(resistance.display).toBe('接法无效'); expect(resistance.reasons).toHaveLength(2);
    expect(resistance.reasons.join('')).toContain('外部供电'); expect(resistance.reasons.join('')).toContain('隔离');
    const overload=view({rangeIndex:0}); expect(overload.display).toBe('超量程'); expect(overload.numeric).toBeNull();
    expect(view({rangeIndex:0,supplyVoltage:2}).display).toBe('2.000 V');
    expect(view({functionMode:2,connection:2,powerOn:0,probesReversed:1}).display).toBe('1.000 kΩ');
  });

  it('uses a visible pointer in both views aligned to the selected function mark', () => {
    for (const functionMode of [0,1,2]) {
      const props=model({functionMode}),direction=multimeterDialDirection(functionMode);
      expect(Math.hypot(direction.x,direction.y)).toBeCloseTo(1);
      const svg=nodes(ElectricDiagram(props)).find(node=>node.props['data-multimeter-pointer']===functionMode)!;
      expect(svg.props.d).toBe(`M163 202L${163+direction.x*35} ${202+direction.y*35}`);
      const marker=nodes(ElectricApparatus3D(props)).find(node=>(node.props.userData as {multimeterPointer?:number})?.multimeterPointer===functionMode)!;
      const rod=nodes(marker).find(node=>node.props.start && node.props.end)!;
      const start=rod.props.start as number[],end=rod.props.end as number[];
      expect(end[0]-start[0]).toBeCloseTo(direction.x*.34); expect(end[2]-start[2]).toBeCloseTo(direction.y*.34);
      expect(start[1]).toBeGreaterThan(.01); // Above the cylinder top, not hidden inside its symmetric body.
    }
  });

  it('retains topology and swaps only probe endpoints when polarity is reversed', () => {
    for (const connection of [0,1,2]) {
      const p=model({connection}).parameters, normal=multimeterWiring(p), reverse=multimeterWiring({...p,probesReversed:1});
      expect(normal.wires).toEqual(reverse.wires); expect(normal.resistor).toEqual(reverse.resistor);
      expect(normal.redProbe.at(-1)).toEqual(reverse.blackProbe.at(-1)); expect(normal.blackProbe.at(-1)).toEqual(reverse.redProbe.at(-1));
      if(connection===1) expect(normal.wires.some(line=>line.length===2&&line[0].x===430&&line[0].y===140&&line[1].y===185)).toBe(false);
    }
  });
});
