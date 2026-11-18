import { describe, expect, it } from 'vitest';
import { commitParameterDraft } from './parameterInput';

describe('committed numeric parameter drafts', () => {
  it('keeps partial negative/decimal inputs and deletion from becoming an unintended zero', () => {
    for (const draft of ['', ' ', '-', '+', '.', '-.', '1e-', 'Infinity', 'NaN', '3 N']) expect(commitParameterDraft(draft, -3, 3)).toBeNull();
  });
  it('accepts negative decimals and scientific notation only when the complete value is submitted', () => {
    expect(commitParameterDraft(' -.75 ', -3, 3)).toEqual({ value: -.75, clamped: false });
    expect(commitParameterDraft('−1.25', -3, 3)).toEqual({ value: -1.25, clamped: false });
    expect(commitParameterDraft('3e-2', 0, 1)).toEqual({ value: .03, clamped: false });
  });
  it('bounds completed values and rejects overflow rather than passing nonfinite physics parameters', () => {
    expect(commitParameterDraft('-10', -3, 3)).toEqual({ value: -3, clamped: true });
    expect(commitParameterDraft('1e999', -3, 3)).toBeNull();
    expect(commitParameterDraft('0', 0, 3)).toEqual({ value: 0, clamped: false });
  });
});
