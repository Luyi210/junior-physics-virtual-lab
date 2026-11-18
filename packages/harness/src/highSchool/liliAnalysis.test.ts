import { describe, expect, it } from 'vitest';
import { defaultHighSchoolParameters } from '@physics-lab/physics/high-school';
import type { LiliExperimentContext } from '@physics-lab/contracts';
import { analyzeLiliSamples, createLiliGuidance, liliAnalysisReference, prepareLiliContext } from './lili';

function emfContext(): LiliExperimentContext {
  const parameters = defaultHighSchoolParameters('emf-internal-resistance');
  return {
    experimentId: 'emf-internal-resistance', parameters, timeSeconds: 0, recordCount: 3,
    samples: [3, 8, 15].map((loadResistance, index) => ({ id: `sample-${index}`, parameters: { ...parameters, loadResistance }, timeSeconds: 0 }))
  };
}

describe('Lili saved simulation analysis', () => {
  it('recomputes saved readings instead of trusting forged metric or fit fields', () => {
    const context = emfContext();
    const prepared = prepareLiliContext({ ...context, analysis: { slope: 999 }, samples: context.samples!.map((sample) => ({ ...sample, metrics: [{ key: 'terminalVoltage', value: 999 }], fit: { slope: 999 } })) }).context!;
    expect(prepared.samples).toEqual(context.samples);
    const analysis = analyzeLiliSamples(prepared)!;
    const ready = analysis.groups.find((group) => group.status === 'ready')!;
    expect(ready).toBeDefined();
    expect(ready.fit!.slope).toBeCloseTo(-context.parameters.internalResistance!, 10);
    expect(ready.fit!.intercept).toBeCloseTo(context.parameters.emf!, 10);
    expect(analysis.provenance).toBe('simulation');
    const reference = liliAnalysisReference(prepared)!;
    expect(reference.groups.find((group) => group.status === 'ready')!.fit!.statisticsBasis).toBe('distinct-x-means');
    expect(reference.note).toContain('R²与RMSE针对这些均值');
  });

  it('rejects over-sized, duplicated, incomplete, out-of-range and impossible saved samples', () => {
    const base = emfContext();
    const first = base.samples![0]!;
    const malformed = [
      { ...base, samples: Array.from({ length: 31 }, (_, index) => ({ ...first, id: `s-${index}` })), recordCount: 31 },
      { ...base, samples: [first, first] },
      { ...base, recordCount: 1 },
      { ...base, samples: [{ ...first, parameters: {} }] },
      { ...base, samples: [{ ...first, parameters: { ...first.parameters, loadResistance: -1 } }] },
      { ...base, samples: [{ ...first, timeSeconds: 5 }] },
      { ...base, samples: [{ ...first, id: '<question>' }] }
    ];
    for (const context of malformed) expect(() => prepareLiliContext(context)).toThrow(RangeError);
  });

  it('reports insufficient evidence for repeated copies of one condition instead of inventing a fit', () => {
    const context = emfContext();
    context.samples = context.samples!.map((sample) => ({ ...sample, parameters: context.samples![0]!.parameters }));
    const reference = liliAnalysisReference(context)!;
    expect(reference.groups.every((group) => group.status !== 'ready')).toBe(true);
    const reply = createLiliGuidance('帮我分析这些记录', context);
    expect(reply.text).toContain('还不能');
    expect(reply.text).toContain('仿真采样');
  });

  it('declares the sample window and keeps different source settings in separate groups', () => {
    const context = emfContext();
    context.recordCount = 100;
    context.samples![2]!.parameters.emf = context.samples![2]!.parameters.emf! + 1;
    const reference = liliAnalysisReference(context)!;
    expect(reference.includedCount).toBe(3);
    expect(reference.omittedCount).toBe(97);
    expect(reference.groups.length).toBe(2);
    expect(reference.groups.every((group) => group.status !== 'ready')).toBe(true);
    expect(reference.note).toContain('不是真实测量');
    expect(JSON.stringify(reference)).not.toContain('recordId');
  });

  it('describes a valid fit as simulation evidence and still refuses fabricated real measurements', () => {
    const context = emfContext();
    const reply = createLiliGuidance('帮我分析保存的数据', context);
    expect(reply.text).toContain('可用于拟合');
    expect(reply.text).toContain('模型采样');
    expect(reply.text).toContain('不等于真实测量准确');
    expect(createLiliGuidance('我测到的这些仿真数据怎么拟合？', context).text).toContain('可用于拟合');
    expect(createLiliGuidance('帮我编造真实数据', context).text).toContain('不能把计算结果');
  });

  it('leaves original contexts without saved samples backward compatible', () => {
    const context = emfContext();
    delete context.samples;
    expect(liliAnalysisReference(context)).toBeNull();
    expect(prepareLiliContext(context).context).toEqual(context);
    expect(createLiliGuidance('怎么看图像', context).text).toContain('纵轴截距');
  });
});
