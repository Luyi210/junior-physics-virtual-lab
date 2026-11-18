import { describe, expect, it } from 'vitest';
import type { LiliExperimentContext } from '@physics-lab/contracts';
import { defaultHighSchoolParameters, simulateHighSchoolExperiment, type HighSchoolExperimentId } from '@physics-lab/physics/high-school';
import { createLiliGuidance, liliAnalysisReference, liliReferenceNotes, liliRequestedRelationship, prepareLiliContext } from './lili';

const ids: HighSchoolExperimentId[] = ['centripetal-force', 'precision-length', 'resistivity', 'multimeter', 'momentum-conservation', 'refractive-index', 'induced-current', 'transformer-ratio', 'sensor-control', 'oil-film', 'gas-pressure-volume', 'free-fall', 'photoelectric-effect', 'charged-particle-field'];
function context(id: HighSchoolExperimentId, overrides: Record<string, number> = {}, time = 0): LiliExperimentContext {
  return { experimentId: id, parameters: { ...defaultHighSchoolParameters(id), ...overrides }, timeSeconds: time, recordCount: 0 };
}
function current(id: HighSchoolExperimentId, overrides: Record<string, number> = {}, time = 0) {
  return createLiliGuidance('当前状态怎样？', context(id, overrides, time)).text;
}
function sampled(id: HighSchoolExperimentId, changes: Record<string, number>[], times: number[] = []) {
  const result = context(id); result.recordCount = changes.length;
  result.samples = changes.map((change, i) => ({ id: `expanded-${i}`, parameters: { ...result.parameters, ...change }, timeSeconds: times[i] ?? 0 }));
  return result;
}

const relations: [HighSchoolExperimentId, string, string][] = [
  ['centripetal-force', '分析质量对向心力的影响', 'centripetal-force-mass'],
  ['centripetal-force', '分析半径与向心力', 'centripetal-force-radius'],
  ['centripetal-force', '分析角速度平方图像', 'centripetal-force-omega-squared'],
  ['precision-length', '怎么分析图像？', 'precision-corrected-length'],
  ['resistivity', '分析电阻与长度', 'resistivity-resistance-length'],
  ['resistivity', '分析U—I', 'resistivity-voltage-current'],
  ['multimeter', '怎么分析图像？', 'multimeter-reading-reference'],
  ['momentum-conservation', '分析碰前碰后动量', 'momentum-after-before'],
  ['momentum-conservation', '分析恢复系数与动能', 'collision-energy-restitution-squared'],
  ['refractive-index', '怎么分析正弦图像？', 'refraction-sines'],
  ['induced-current', '怎么分析图像？', 'induced-emf-flux-rate'],
  ['transformer-ratio', '怎么分析图像？', 'transformer-secondary-primary'],
  ['sensor-control', '怎样拟合响应时间常量？', 'sensor-log-response-time'],
  ['sensor-control', '分析输出电压与温度', 'sensor-voltage-temperature'],
  ['oil-film', '怎么分析图像？', 'oil-thickness-inverse-area'],
  ['gas-pressure-volume', '怎么分析图像？', 'gas-pressure-inverse-volume'],
  ['free-fall', '怎么分析图像？', 'free-fall-distance-time-squared'],
  ['photoelectric-effect', '截止电压与频率图像', 'photo-stopping-frequency'],
  ['charged-particle-field', '怎么分析图像？', 'particle-radius-speed'],
];

describe('Lili expanded experiments retain model provenance and executable teaching', () => {
  it.each(ids)('%s validates real model conditions and provides specific instructions without an old-experiment fallback', (id) => {
    const input = context(id);
    const result = prepareLiliContext({ ...input, state: { forgedAnswer: 123 }, fit: { slope: 999 } });
    expect(result.context!.experimentId).toBe(id);
    expect(result.snapshot!.state).not.toHaveProperty('forgedAnswer');
    expect(result.context).not.toHaveProperty('fit');
    for (const q of ['我应该先做哪一步？', '怎样控制变量？', '有哪些模型限制？', '当前状态怎样？']) {
      const reply = createLiliGuidance(q, result.context);
      expect(reply.mode).toBe('guided');
      expect(reply.sources.length).toBeGreaterThan(0);
      expect(reply.text.length).toBeGreaterThan(40);
      expect(reply.text).not.toMatch(/先选择一个高中实验|单摆秒表|双缝读尺|undefined|NaN|Infinity/);
    }
    const notes = liliReferenceNotes(id)!;
    expect(notes.next.length).toBeGreaterThan(50);
    expect(notes.graph.length).toBeGreaterThan(50);
  });

  it.each(ids)('%s never converts a count or model fit into learning completion or physical measurements', (id) => {
    const input = context(id); input.recordCount = 100;
    expect(createLiliGuidance('已保存100条，完成了吗？', input).text).toContain('不能按保存条数');
    const manual = createLiliGuidance('看看我的手动实测记录', input).text;
    expect(manual).toContain('不能称为实体实测');
    expect(manual).not.toMatch(/已收到最近|单摆|双缝/);
    expect(() => prepareLiliContext({ ...input, manualRecordCount: 1, manualSamples: [] })).toThrow();
  });

  it.each(relations)('%s selects the requested relation: %s', (id, question, relation) => {
    expect(liliRequestedRelationship(id, question)).toBe(relation);
    expect(liliRequestedRelationship(id, relation)).toBe(relation);
    const reply = createLiliGuidance(question, context(id));
    expect(reply.text).toContain('没有收到');
    expect(reply.text).toContain('不能声称已经测得');
  });

  it('preserves original sample conditions and ignores client-provided derived results', () => {
    for (const id of ids) {
      const original = sampled(id, [{}]);
      const sample = original.samples![0]!;
      const prepared = prepareLiliContext({ ...original, samples: [{ ...sample, metrics: [{ key: 'force', value: 999, unit: 'N' }], state: { current: 999 } }] });
      expect(prepared.context!.samples![0]).toEqual(sample);
      expect(prepared.context!.samples![0]!.parameters).not.toBe(sample.parameters);
      const missing = { ...sample.parameters }; delete missing[Object.keys(missing)[0]!];
      expect(() => prepareLiliContext({ ...original, samples: [{ ...sample, parameters: missing }] })).toThrow('完整');
    }
  });

  it.each([
    ['precision-length', { contactMode: 1.5 }], ['multimeter', { functionMode: 1.5 }],
    ['transformer-ratio', { inputMode: 2 }], ['oil-film', { calibrationDrops: 20.5 }],
    ['induced-current', { closed: .5 }], ['sensor-control', { initialRelayOn: .5 }],
  ] as [HighSchoolExperimentId, Record<string, number>][])('rejects invalid discrete settings for %s before guidance', (id, override) => {
    expect(() => prepareLiliContext(context(id, override))).toThrow();
  });
});

describe('expanded model boundary explanations match the actual state', () => {
  it('distinguishes stationary angular speed from pause and keeps force positive for both rotations', () => {
    expect(current('centripetal-force', { angularSpeed: 0 })).toContain('周期没有定义');
    expect(current('centripetal-force', { angularSpeed: 0 })).toContain('暂停播放');
    for (const angularSpeed of [-2, 2]) expect(current('centripetal-force', { angularSpeed })).toContain('径向合力大小0.4 N');
    expect(createLiliGuidance('怎样控制变量？', context('centripetal-force')).text).toContain('不能同时保持非零v和ω');
  });

  it('keeps no-contact, zero-check and corrected object readings distinct', () => {
    expect(current('precision-length')).toContain('尚未接触');
    expect(current('precision-length', { contactMode: 1 })).toContain('不是物体长度');
    expect(current('precision-length', { contactMode: 2, zeroCorrection: 0 })).toContain('尚未选择扣除零点');
    const corrected = current('precision-length', { contactMode: 2, zeroCorrection: 1, zeroErrorMm: -.04 });
    expect(corrected).toContain('零点读数-0.04 mm');
    expect(corrected).toContain('修正值12.34 mm');
  });

  it('does not infer zero resistance or zero resistivity from zero excitation', () => {
    const reply = current('resistivity', { voltage: 0 });
    expect(reply).toContain('不能用0/0'); expect(reply).toContain('不是材料电阻率为零');
  });

  it('explains wrong connection, overrange, correct reversed probes and isolated resistance separately', () => {
    expect(current('multimeter', { functionMode: 1, connection: 0 })).toContain('接法或供电状态不满足');
    expect(current('multimeter', { rangeIndex: 0 })).toContain('超过所选量程2');
    expect(current('multimeter', { probesReversed: 1 })).toContain('当前读数-6 V');
    expect(current('multimeter', { powerOn: 0 })).toContain('负载电压/电流为0');
    expect(current('multimeter', { functionMode: 2, connection: 2, powerOn: 1 })).toContain('隔离元件');
    expect(current('multimeter', { functionMode: 2, connection: 2, powerOn: 0, probesReversed: 1 })).toContain('当前读数1000 Ω');
  });

  it('does not instruct students to save a multimeter state that the workbench rejects', () => {
    const input = context('multimeter', { functionMode: 1, connection: 0 });
    expect(prepareLiliContext(input).snapshot!.state.readingValid).toBe(0);
    const text = createLiliGuidance('我应该先做哪一步？', input).text;
    expect(text).toContain('错误设置只观察提示并用文字说明原因');
    expect(text).toContain('恢复正确条件后再保存');
    expect(text).not.toContain('保存一种错误设置');
  });

  it('does not call a nonmeeting pair, a late collision or a pre-collision frame post-collision', () => {
    expect(current('momentum-conservation', { velocity1: -1, velocity2: 1 })).toContain('不会相遇');
    expect(current('momentum-conservation', { velocity1: .1, velocity2: 0, separation: 3 })).toContain('超过本轮6 s');
    expect(current('momentum-conservation')).toContain('尚未碰撞');
    const after = current('momentum-conservation', { velocity2: 0, restitution: 0 }, 2);
    expect(after).toContain('当前已碰撞'); expect(after).toContain('共同速度未必为零');
  });

  it('differentiates normal incidence, total reflection, exact critical grazing and equal indices', () => {
    expect(current('refractive-index', { incidentAngleDegrees: 0 })).toContain('0/0');
    expect(current('refractive-index', { incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: 50 })).toContain('没有传播折射光');
    const critical = Math.asin(1 / 1.5) * 180 / Math.PI;
    const grazing = current('refractive-index', { incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees: critical });
    expect(grazing).toContain('临界掠射'); expect(grazing).toContain('r=90°');
    expect(current('refractive-index', { incidentIndex: 1.5, transmittedIndex: 1.5 })).toContain('两侧折射率相同');
  });

  it('keeps open-circuit induced voltage and nonzero flux with zero voltage distinct', () => {
    const open = current('induced-current', { closed: 0 }, .5);
    expect(open).toContain('I=0'); expect(open).toContain('ε=0.15708 V'); expect(open).toContain('恒定磁场');
    const peak = current('induced-current');
    expect(peak).toContain('磁通0.0005 Wb'); expect(peak).toContain('ε=0 V');
    expect(current('induced-current', { rotationFrequency: 0 }, .5)).toContain('没有该感应电动势');
  });

  it('does not mistake AC zero crossings or invalid DC for RMS transformer measurements', () => {
    expect(current('transformer-ratio')).toContain('原边有效值6 V、副边12 V');
    expect(current('transformer-ratio')).toContain('瞬时过零不是有效值为0');
    expect(current('transformer-ratio', { primaryRmsVoltage: 0 })).toContain('不能直接除以U₁');
    expect(current('transformer-ratio', { inputMode: 1 })).toContain('直流暂态');
  });

  it('explains sensor hysteresis from the initial condition, not just current temperature', () => {
    const conditions = { temperatureStart: 40, temperatureEnd: 40, threshold: 40, hysteresis: 2 };
    expect(current('sensor-control', { ...conditions, initialRelayOn: 0 }, 1)).toContain('执行器关');
    expect(current('sensor-control', { ...conditions, initialRelayOn: 1 }, 1)).toContain('执行器开');
    expect(current('sensor-control', { ...conditions, hysteresis: 0, initialRelayOn: 0 }, 1)).toContain('执行器开');
    expect(current('sensor-control')).toContain('不是NTC');
    expect(current('sensor-control')).toContain('没有反过来改变');
  });

  it('includes both calibration drops and used drops in the oil-volume explanation', () => {
    const text = current('oil-film', { usedDrops: 2 });
    expect(text).toContain('本次2滴'); expect(text).toContain('纯油体积4e-11 m³');
    expect(createLiliGuidance('怎么分析图像？', context('oil-film')).text).toContain('×使用滴数');
  });

  it('recognizes negative gauge pressure while retaining positive absolute pressure', () => {
    const text = current('gas-pressure-volume', { amountMilliMol: .1, volumeMl: 100 });
    expect(text).toContain('表压-'); expect(text).toContain('不是绝对压强为负');
  });

  it('describes landing as the pre-impact endpoint and does not add mass-dependent acceleration', () => {
    const input = context('free-fall');
    const duration = simulateHighSchoolExperiment('free-fall', input.parameters, 0).durationSeconds;
    const text = current('free-fall', {}, duration);
    expect(text).toContain('下落距离5 m，剩余高度0 m');
    expect(text).toContain('碰撞前一瞬'); expect(text).toContain('不改变给定高度和g下的轨迹');
  });

  it('distinguishes insufficient photon energy, zero illumination and collector cutoff', () => {
    expect(current('photoelectric-effect', { frequencyTHz: 100, opticalPowerMilliwatts: 5 })).toContain('增加光强不能补足');
    expect(current('photoelectric-effect', { opticalPowerMilliwatts: 0 })).toContain('没有实际发射电流');
    const stopped = current('photoelectric-effect', { collectorVoltage: -5 });
    expect(stopped).toContain('光电流0 A'); expect(stopped).toContain('最大动能不代表所有电子');
    expect(stopped).toContain('固定10%量子效率');
  });

  it('uses actual charge-field sign for rotation and never presents undefined radius as a zero-size circle', () => {
    for (const overrides of [{ magneticFieldMicrotesla: 0 }, { chargeToMassMillions: 0 }] as Record<string, number>[]) {
      expect(current('charged-particle-field', overrides)).toContain('轨迹为直线');
      expect(current('charged-particle-field', overrides)).toContain('不应把占位0');
    }
    expect(current('charged-particle-field')).toContain('当前顺时针');
    expect(current('charged-particle-field', { chargeToMassMillions: -1 })).toContain('当前逆时针');
  });
});

describe('expanded saved-relation selection uses original model conditions', () => {
  it('selects radius or mass before ranking/truncating other ready centripetal groups', () => {
    const input = sampled('centripetal-force', [{ mass: .1 }, { mass: .2 }, { mass: .3 }, { radius: .3 }, { radius: .5 }, { radius: .7 }]);
    input.parameters = { ...input.parameters, angularSpeed: 0 };
    const mass = liliAnalysisReference(input, '分析质量对向心力的影响')!;
    expect(mass.groups.every((g) => g.relationshipId === 'centripetal-force-mass')).toBe(true);
    expect(mass.groups.find((g) => g.status === 'ready')!.fit!.slope).toBeCloseTo(2, 10);
    const radius = liliAnalysisReference(input, '分析半径与向心力')!;
    expect(radius.groups.every((g) => g.relationshipId === 'centripetal-force-radius')).toBe(true);
    expect(radius.groups.find((g) => g.status === 'ready')!.fit!.slope).toBeCloseTo(.8, 10);
    expect(createLiliGuidance('分析半径与向心力', input).text).toContain('模型采样');
    expect(createLiliGuidance('分析半径与向心力', input).text).not.toContain('当前ω=0');
  });

  it('matches sensor time-constant or voltage calibration requests without substituting another relation', () => {
    const input = sampled('sensor-control', [{}, {}, {}], [0, 1, 2]);
    const response = liliAnalysisReference(input, '怎样拟合响应时间常量？')!;
    expect(response.groups).toHaveLength(1);
    expect(response.groups[0]).toMatchObject({ relationshipId: 'sensor-log-response-time', status: 'ready' });
    expect(response.groups[0]!.fit!.slope).toBeCloseTo(-1, 10);
    const voltage = liliAnalysisReference(input, '分析输出电压与温度')!;
    expect(voltage.groups[0]!.relationshipId).toBe('sensor-voltage-temperature');
    expect(voltage.groups[0]!.fit!.slope).toBeCloseTo(.025, 10);
  });

  it('does not manufacture ready fits from invalid meter, TIR or uncollided states', () => {
    for (const input of [
      sampled('multimeter', [3, 4, 5].map((supplyVoltage) => ({ supplyVoltage, functionMode: 1, connection: 0 }))),
      sampled('refractive-index', [50, 60, 70].map((incidentAngleDegrees) => ({ incidentIndex: 1.5, transmittedIndex: 1, incidentAngleDegrees }))),
      sampled('momentum-conservation', [1, 2, 3].map((velocity1) => ({ velocity1 }))),
    ]) {
      const reference = liliAnalysisReference(input, '怎么分析图像？')!;
      expect(reference.groups.every((g) => g.status !== 'ready')).toBe(true);
      expect(createLiliGuidance('怎么分析图像？', input).text).toContain('还不能');
    }
  });
});
