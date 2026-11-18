import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { evaluatePrecisionReading } from './precisionReading';
import { PrecisionReadingPractice } from '../components/PrecisionReadingPractice';
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock('react', async original => ({...await original<typeof import('react')>(), useState(initial: unknown) { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = initial; return [hooks.slots[i], (value: unknown) => { hooks.slots[i] = value; }]; } }));
type Element = ReactElement<Record<string, unknown>>;
function walk(node: ReactNode): Element[] { return Array.isArray(node) ? node.flatMap(walk) : isValidElement<Record<string, unknown>>(node) ? [node, ...walk(node.props.children as ReactNode)] : []; }
function text(node: ReactNode): string { return Array.isArray(node) ? node.map(text).join('') : isValidElement<Record<string, unknown>>(node) ? text(node.props.children as ReactNode) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''; }
describe('independent precision reading practice', () => {
  it('combines caliper and micrometer scales and subtracts signed zero', () => {
    expect(evaluatePrecisionReading(0, '12', '19', '.04')).toMatchObject({indicatedMm: 12.38});
    expect(evaluatePrecisionReading(0, '12', '19', '.04').correctedMm).toBeCloseTo(12.34);
    expect(evaluatePrecisionReading(1, '12.5', '20', '-.03').correctedMm).toBeCloseTo(12.73);
    expect(evaluatePrecisionReading(0, '-1', '48', '-.04').correctedMm).toBeCloseTo(0);
  });
  it.each([['', '3', '0'], ['12', '50', '0'], ['12', '1.5', '0'], ['12.5', '3', '0'], ['12', '3', '.01'], ['12', '3', 'Infinity']])('rejects invalid or unfilled raw inputs %s/%s/%s', (a,b,c) => { expect(() => evaluatePrecisionReading(0,a,b,c)).toThrow(); });
  it('starts blank, uses actual input callbacks, checks only after click, and leaves mismatches visible', () => {
    hooks.slots = [];
    let contactMode = 2;
    function render() { hooks.cursor = 0; return PrecisionReadingPractice({instrument: 0, contactMode, indicatedLengthMm: 12.38, zeroReadingMm: .04}); }
    let tree = render();
    expect(walk(tree).filter(n => n.type === 'input').map(n => n.props.value)).toEqual(['','','']);
    function fill(id: string, value: string) { const input = walk(tree).find(n => n.props.id === id)!; (input.props.onChange as (e: unknown) => void)({target: {value}}); tree=render(); }
    function check() { (walk(tree).find(n => n.type === 'button')!.props.onClick as () => void)(); tree=render(); }
    check(); expect(text(tree)).toContain('请自主填写');
    fill('precision-main','12'); fill('precision-division','19'); fill('precision-zero','.04');
    expect(text(tree)).not.toContain('与当前虚拟仪器一致'); check(); expect(text(tree)).toContain('修正后 12.34 mm'); expect(text(tree)).toContain('与当前虚拟仪器一致');
    fill('precision-division','18'); check(); expect(text(tree)).toContain('有差异'); expect(walk(tree).find(n=>n.props.id==='precision-division')!.props.value).toBe('18');
    contactMode = 0; tree=render(); expect(walk(tree).find(n=>n.type==='button')!.props.disabled).toBe(true); check(); expect(text(tree)).not.toContain('与当前虚拟仪器一致');
    expect(text(tree)).toContain('不会自动保存到模型记录或发送给力力');
  });
});
