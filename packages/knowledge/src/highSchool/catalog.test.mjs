import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHighSchoolExperiment,
  highSchoolCurriculumNote,
  highSchoolCurriculumSources,
  highSchoolExperiments,
  highSchoolLifeConnections,
  getHighSchoolLifeConnection,
} from './catalog.ts';

test('all ready high-school experiments share a concrete life connection with its model boundary', () => {
  const ids = highSchoolExperiments.filter((entry) => entry.status === 'ready').map((entry) => entry.id).sort();
  assert.deepEqual(Object.keys(highSchoolLifeConnections).sort(), ids);
  for (const id of ids) {
    const entry = getHighSchoolLifeConnection(id);
    assert.ok(entry, id);
    for (const field of ['scene', 'connection', 'boundary']) assert.ok(entry[field].trim().length > 15, `${id}: ${field}`);
  }
  assert.equal(getHighSchoolLifeConnection('unknown-experiment'), null);
});

test('stage 24 exposes all twenty-four integrated experiments', () => {
  assert.equal(highSchoolExperiments.length, 24);
  assert.equal(highSchoolExperiments.filter((entry) => entry.status === 'ready').length, 24);
  assert.equal(highSchoolExperiments.filter((entry) => entry.status === 'planned').length, 0);
  assert.equal(new Set(highSchoolExperiments.map((entry) => entry.id)).size, 24);
});

test('mechanical energy preserves six raw readings and differentiates two-point kinetic gain from the release model', () => {
  const energy = getHighSchoolExperiment('mechanical-energy');
  assert.ok(energy);
  assert.equal(energy.volume, 'required-2');
  assert.equal(energy.requirementLevel, 'curriculum');
  assert.deepEqual(energy.sourceUrls, [highSchoolCurriculumSources.baselineStandard, highSchoolCurriculumSources.required2]);
  assert.match(energy.verificationNote, /95—98页.*截图.*未核定/);
  assert.match(energy.variables.dependent.join(' '), /vB²−vA²/);
  assert.match(energy.evidence.join(' '), /六个原始位置.*mm.*点号.*仿真时刻/);
  const conditions = energy.assumptions.join(' ');
  for (const text of ['内部A点速度不等于零', '不是真实空气阻力', 'B>A', '同一点时读数须一致', '不是读数精度', '不用模型速度或理论位置回填', '不是实体实测']) assert.ok(conditions.includes(text));
  assert.match(energy.variables.controlled.join(' '), /0\.02s/);
});

test('capacitor teaching keeps switching history, same-segment evidence and the dated textbook boundary', () => {
  const capacitor = getHighSchoolExperiment('capacitor-charge');
  assert.ok(capacitor);
  assert.equal(capacitor.volume, 'required-3');
  assert.equal(capacitor.domain, 'electricity');
  assert.equal(capacitor.requirementLevel, 'curriculum');
  assert.deepEqual(capacitor.sourceUrls, [highSchoolCurriculumSources.baselineStandard, highSchoolCurriculumSources.required3]);
  assert.match(capacitor.verificationNote, /第10\.4节.*印刷38—40页/);
  assert.match(capacitor.verificationNote, /I—t.*拓展学习.*2025.*未核定/);
  assert.match(capacitor.learningGoal, /同一分段.*模型读数.*时间常量/);
  assert.match(capacitor.variables.controlled.join(' '), /零电压.*完整切换过程/);
  assert.match(capacitor.evidence.join(' '), /完整开关过程.*切换时刻.*R\/C\/E/);
  assert.match(capacitor.evidence.join(' '), /ln\(\|U−U∞\|\/1V\).*截距不强制为0/);
  const limits = capacitor.assumptions.join(' ');
  for (const required of ['电压连续', '电流可跃变', '暂停仿真不等于断路', '开路或段初已平衡', '不同运行或切换分段不混合', '20RC是观察窗口', '不是实体实测', '没有独立手动电表', '不以记录条数']) assert.ok(limits.includes(required));
});

test('spring-force retains the dated curriculum baseline and required-first-volume evidence', () => {
  const spring = getHighSchoolExperiment('spring-force');
  assert.ok(spring);
  assert.equal(spring.volume, 'required-1');
  assert.equal(spring.domain, 'mechanics');
  assert.equal(spring.requirementLevel, 'curriculum');
  assert.match(spring.chapter, /第三章.*弹力/);
  assert.deepEqual(spring.sourceUrls, [highSchoolCurriculumSources.baselineStandard, highSchoolCurriculumSources.required1]);
  assert.match(highSchoolCurriculumNote, /2020.*基准/);
  assert.match(highSchoolCurriculumNote, /2025.*仍需校核/);
});

test('spring evidence distinguishes total suspended mass, natural length and extension before fitting stiffness', () => {
  const spring = getHighSchoolExperiment('spring-force');
  assert.ok(spring);
  assert.match(spring.variables.independent.join(' '), /总质量.*含托盘.*g/);
  assert.match(spring.variables.dependent.join(' '), /x=L−L₀/);
  const controls = spring.variables.controlled.join(' ');
  for (const required of ['劲度系数', '原长', '9.8', '静态平衡']) assert.ok(controls.includes(required));
  const evidence = spring.evidence.join(' ');
  for (const required of ['L₀', '总长L', '伸长量x', 'F=mg', '单位', 'F—x', '斜率', '同条件加载与卸载']) assert.ok(evidence.includes(required));
});

test('spring learning goals stay inside the prescribed ideal range instead of promising discovery of real limits', () => {
  const spring = getHighSchoolExperiment('spring-force');
  assert.ok(spring);
  assert.match(spring.learningGoal, /模型给定的线性范围/);
  assert.doesNotMatch(spring.learningGoal + spring.evidence.join(' '), /识别近似线性范围|非线性区间|测出弹性限度/);
  const assumptions = spring.assumptions.join(' ');
  assert.match(assumptions, /0～0\.25m.*0\.245m/);
  assert.match(assumptions, /不预测真实弹性限度、塑性形变或滞回/);
  assert.match(assumptions, /加载卸载重合是模型假设/);
  assert.match(assumptions, /不代表实体器材测量或独立手动读尺/);
});

test('force composition keeps dated curriculum evidence and distinguishes an independent trial from physical measurement', () => {
  const force = getHighSchoolExperiment('force-composition');
  assert.ok(force);
  assert.equal(force.volume, 'required-1');
  assert.equal(force.requirementLevel, 'curriculum');
  assert.deepEqual(force.sourceUrls, [highSchoolCurriculumSources.baselineStandard, highSchoolCurriculumSources.required1]);
  assert.match(force.verificationNote, /2020.*第43页.*1\.2\.2/);
  assert.match(force.learningGoal, /独立选择.*试配/);
  assert.match(force.variables.controlled.join(' '), /F₁、F₂均大于0且固定/);
  assert.match(force.evidence.join(' '), /不同cosθ.*自由截距/);
  assert.doesNotMatch(force.variables.controlled.join(' '), /测力计校准/);
  const limits = force.assumptions.join(' ');
  for (const required of ['不模拟橡皮筋运动', '不是实体实测', '合力为零时没有方向', '夹角不定义', '0.05N', '不是测量精度', '模型一致性']) assert.ok(limits.includes(required));
});

test('fourteen expansion entries retain specific model boundaries instead of promising physical instrument skills', () => {
  const limitsById = {
    'centripetal-force': ['径向合力', '|ω|', 'ω=0', '不是实体实测'],
    'precision-length': ['未接触', '合拢零点', '分辨率不等于精度', '不是学生独立读尺'],
    resistivity: ['温升', '电表内阻', 'U=I=0', '不是独立手动测径'],
    multimeter: ['无效数值不是实际被测量为零', '数字读数模型', '欧姆调零', '不是实体实测'],
    'momentum-conservation': ['外力冲量忽略', '未相遇', '非弹性不等于动量不守恒', '不是实体实测'],
    'refractive-index': ['单界面', '插针', '临界掠射不等于超过临界角', '不是实体实测'],
    'induced-current': ['恒定匀强磁场中旋转线圈', '开路电流为0但电动势可非零', '不是实体磁铁插拔', '忽略自感'],
    'transformer-ratio': ['理想无损', '直流暂态', '理想效率不代表真实效率', '不是实体实测'],
    'sensor-control': ['一阶线性', '不是真实NTC', '闭环反馈', '不是实体实测'],
    'oil-film': ['单分子层', '不是分子直接成像', '面积与体积为模型输入', '不是实体实测'],
    'gas-pressure-volume': ['不以表压代替绝对压强', '不模拟缓慢压缩热交换', '不是实体实测'],
    'free-fall': ['没有空气阻力对照', '撞地前一瞬', '质量只影响能量', '不是实体实测'],
    'photoelectric-effect': ['最大动能', '均匀电子能量分布', '不是材料实测I—U', '不是实体实测'],
    'charged-particle-field': ['平面垂直入射', '零磁场或零电荷质量比', '没有圆轨道半径和周期', '不是独立手动测径'],
  };
  assert.equal(Object.keys(limitsById).length, 14);
  for (const [id, expected] of Object.entries(limitsById)) {
    const entry = getHighSchoolExperiment(id);
    assert.ok(entry, id);
    for (const phrase of expected) assert.ok(entry.assumptions.join(' ').includes(phrase), `${id}: ${phrase}`);
    assert.ok(entry.learningGoal.length > 15, id);
    assert.ok(entry.evidence.length >= 2, id);
    assert.ok(entry.sourceUrls.includes(highSchoolCurriculumSources.baselineStandard), id);
  }
});

test('expanded evidence uses available controls and qualifies official page evidence', () => {
  const induction = getHighSchoolExperiment('induced-current');
  assert.match(induction.variables.independent.join(' '), /转动频率/);
  assert.doesNotMatch(induction.learningGoal, /移动磁铁|磁铁插拔/);
  const precision = getHighSchoolExperiment('precision-length');
  assert.match(precision.evidence.join(' '), /接触状态.*量化零点读数/);
  const particle = getHighSchoolExperiment('charged-particle-field');
  assert.match(particle.variables.controlled.join(' '), /平面内初速度方向.*速度始终垂直磁场/);
  assert.doesNotMatch(particle.evidence.join(' '), /零速/);
  const falling = getHighSchoolExperiment('free-fall');
  assert.match(falling.evidence.join(' '), /距离s—t².*斜率g\/2/);
  assert.doesNotMatch(falling.assumptions.join(' '), /零释放高度/);
  for (const [id, printedPage] of [['precision-length', '62'], ['multimeter', '72—74'], ['momentum-conservation', '17—18'], ['refractive-index', '85'], ['oil-film', '7—8'], ['gas-pressure-volume', '23'], ['photoelectric-effect', '71']]) {
    const entry = getHighSchoolExperiment(id);
    assert.ok(entry.verificationNote.includes(printedPage), id);
    assert.match(entry.verificationNote, /未核/);
    assert.match(entry.verificationNote, /PDF文件页序/);
  }
  for (const id of ['induced-current', 'transformer-ratio', 'sensor-control']) {
    assert.match(getHighSchoolExperiment(id).verificationNote, /具体节号.*待复核/);
  }
});
