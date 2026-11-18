import { highSchoolExperiment } from '@physics-lab/physics/high-school/catalog';
import type { HighSchoolExperimentId } from './types';
import type { HighSchoolAnalysisMeasurement as Reading, HighSchoolAnalysisFit as Fit, HighSchoolAnalysisValue as Value, Relationship } from './measurementAnalysis';

const ids = new Set(['centripetal-force', 'precision-length', 'resistivity', 'multimeter', 'momentum-conservation', 'refractive-index', 'induced-current', 'transformer-ratio', 'sensor-control', 'oil-film', 'gas-pressure-volume', 'free-fall', 'photoelectric-effect', 'charged-particle-field']);
const p = (r: Reading, key: string) => r.parameters[key]!;
const v = (key: string, label: string, value: number, unit = ''): Value => ({ key, label, value, unit });
function m(r: Reading, key: string, unit: string) {
  const value = r.metrics.find((entry) => entry.key === key);
  if (!value || value.unit !== unit || !Number.isFinite(value.value)) throw new RangeError(`缺少保存的 ${key} 及其单位 ${unit || '无量纲'}，不能用模型补造原读数。`);
  return value.value;
}
function requireFlag(r: Reading, key: string, message: string) { if (m(r, key, '') !== 1) throw new RangeError(message); }
function positive(value: number) { if (!(value > 0)) throw new RangeError('此关系的拟合斜率须为正，不能据当前数据给出物理估计值。'); return value; }

/** Validate the saved observation window, without regenerating the saved measurements. */
export function validateExpandedAnalysisReading(id: HighSchoolExperimentId, r: Reading) {
  if (!ids.has(id)) return;
  const duration = id === 'centripetal-force' ? 8 : id === 'momentum-conservation' ? 6 : id === 'induced-current' ? 4 : id === 'sensor-control' ? 12 : id === 'charged-particle-field' ? 1 : id === 'transformer-ratio' ? 3 / p(r, 'frequency') : id === 'free-fall' ? Math.sqrt(2 * p(r, 'dropHeight') / p(r, 'gravity')) : 0;
  if (r.timeSeconds > duration + (duration > 0 ? 1e-9 : 0)) throw new RangeError('保存时刻超出本实验观察窗口；静态读数时刻须为0。');
  if (['precision-length', 'multimeter', 'refractive-index', 'transformer-ratio'].includes(id)) requireFlag(r, 'readingValid', '保存的器材读数无效，不能把未接触、错误接法、超量程或无折射光的占位值用于拟合。');
}

export function expandedRelationships(id: HighSchoolExperimentId): Relationship[] | null {
  if (!ids.has(id)) return null;
  const definition = highSchoolExperiment(id);
  const controls = (omit: string[]) => (r: Reading) => definition.parameters.filter((entry) => !omit.includes(entry.key)).map((entry) => v(entry.key, entry.label, p(r, entry.key), entry.unit));
  type Options = { id: string; title: string; x: [string, string]; y: [string, string]; omit?: string[]; point: Relationship['point']; estimates?: Relationship['estimates']; conditions: string; next: string; unsupported?: Relationship['unsupported']; groupingKey?: Relationship['groupingKey'] };
  function relation(o: Options): Relationship {
    return { id: o.id, title: o.title, xAxis: { label: o.x[0], unit: o.x[1] }, yAxis: { label: o.y[0], unit: o.y[1] }, controls: controls(o.omit ?? []), point: o.point,
      estimates: o.estimates ?? ((fit: Fit) => [v('slope', '保存数据拟合斜率', fit.slope, `${o.y[1] || '1'}/${o.x[1] || '1'}`), v('intercept', '拟合截距', fit.intercept, o.y[1])]),
      conditions: [o.conditions, '坐标来自当时保存的参数和读数，保留自由截距；模型采样的一致性不代表实体测量或学生已经掌握。'], nextStep: o.next,
      ...(o.unsupported ? { unsupported: o.unsupported } : {}), ...(o.groupingKey ? { groupingKey: o.groupingKey } : {}) };
  }
  if (id === 'centripetal-force') return [
    relation({ id: 'centripetal-force-mass', title: '向心力—质量', x: ['质量 m', 'kg'], y: ['向心力大小 F', 'N'], omit: ['mass'], point: r => ({ x: p(r, 'mass'), y: m(r, 'force', 'N') }), conditions: '固定半径及有符号角速度，仅改变质量。', next: '固定r、ω，保存至少三种质量的F。' }),
    relation({ id: 'centripetal-force-radius', title: '固定角速度：向心力—半径', x: ['半径 r', 'm'], y: ['向心力大小 F', 'N'], omit: ['radius'], point: r => ({ x: p(r, 'radius'), y: m(r, 'force', 'N') }), conditions: '固定质量和角速度；此时改变半径会改变线速度，不能声称固定线速度。', next: '固定m、ω，保存至少三种半径；同时检查v=ωr的变化。' }),
    relation({ id: 'centripetal-force-omega-squared', title: '向心力—角速度平方', x: ['角速度平方 ω²', 's⁻²'], y: ['向心力大小 F', 'N'], omit: ['angularSpeed'], point: r => ({ x: p(r, 'angularSpeed') ** 2, y: m(r, 'force', 'N') }), estimates: fit => [v('massRadius', '由斜率估计 m·r', positive(fit.slope), 'kg·m')], conditions: '固定质量和半径，比较不同ω²；仅反转转向不增加一种ω²取值。', next: '固定m、r，取三个不同大小的角速度保存F，不要只改变正负号。' }),
  ];
  if (id === 'free-fall') return [relation({ id: 'free-fall-distance-time-squared', title: '下落位移—时间平方', x: ['时间平方 t²', 's²'], y: ['向下位移 x', 'm'], point: r => ({ x: r.timeSeconds ** 2, y: m(r, 'position', 'm') }), estimates: fit => [v('gravity', '由位移拟合的重力加速度', 2 * positive(fit.slope), 'm/s²')], conditions: '同一组固定高度、质量和g，从静止释放，仅使用落地前的观察时刻；纵轴不是剩余高度。', next: '保持本轮条件，分别在落地前三个不同时刻保存下落位移。' })];
  if (id === 'momentum-conservation') {
    const collided = (r: Reading) => { requireFlag(r, 'collided', '这条记录尚未发生碰撞，保留作碰前观察，不能混入碰后拟合。'); requireFlag(r, 'collisionWithinWindow', '本组碰撞不在观察窗内。'); };
    return [relation({ id: 'momentum-after-before', title: '碰后总动量—初始总动量', x: ['初始总动量', 'kg·m/s'], y: ['保存的碰后总动量', 'kg·m/s'], omit: ['velocity1'], point: r => { collided(r); return { x: p(r, 'mass1') * p(r, 'velocity1') + p(r, 'mass2') * p(r, 'velocity2'), y: m(r, 'totalMomentum', 'kg·m/s') }; }, conditions: '固定两质量、第二物体初速、间隔及恢复系数，只改变第一物体初速，并确保每组均已发生碰撞；碰前记录不参与。', next: '改变第一物体初速，在每组真实碰撞后各保存一次，取得三种初始总动量。' }),
      relation({ id: 'collision-energy-restitution-squared', title: '碰后动能—恢复系数平方', x: ['恢复系数平方 e²', ''], y: ['碰后总动能 K', 'J'], omit: ['restitution'], point: r => { collided(r); return { x: p(r, 'restitution') ** 2, y: m(r, 'kineticEnergy', 'J') }; }, conditions: '初始质量、速度与间隔全部相同，只改变恢复系数。自由截距对应质心平移动能；完全非弹性碰撞不一定使总动能为零。', next: '使用相同初态，分别设e为0、0.5、1，播放至碰撞后再保存。' })];
  }
  if (id === 'precision-length') return [relation({ id: 'precision-corrected-length', title: '修正长度—模型样品长度', x: ['模型样品长度', 'mm'], y: ['已保存的修正长度', 'mm'], omit: ['objectLengthMm'], point: r => { requireFlag(r, 'objectReadingValid', '零点检查不是样品长度，未夹住物体的记录不参与长度拟合。'); return { x: p(r, 'objectLengthMm'), y: m(r, 'correctedLengthMm', 'mm') }; }, conditions: '保持仪器、零误差和接触方式，改变样品长度；保存的修正读数独立保留量化结果。此图检查仪器模型，不代替学生自主读尺。', next: '先检查零点并启用零点扣除，再夹住三种不同长度样品分别保存。', unsupported: r => p(r, 'zeroCorrection') !== 1 ? '本组没有扣除零点，请把它作为未修正对照，不报告修正长度拟合。' : null })];
  if (id === 'resistivity') return [relation({ id: 'resistivity-resistance-length', title: '电阻—金属丝长度', x: ['长度 L', 'm'], y: ['保存的电阻 R', 'Ω'], omit: ['length'], point: r => ({ x: p(r, 'length'), y: m(r, 'resistance', 'Ω') }), estimates: (fit, r) => [v('resistivity', '由R—L斜率估计的电阻率', positive(fit.slope) * Math.PI * (p(r, 'diameterMm') / 1000) ** 2 / 4, 'Ω·m')], conditions: '固定材料电阻率、直径和电压，只改变长度；面积由直径换算为米后平方。', next: '固定直径和材料，保存至少三种金属丝长度。' }), relation({ id: 'resistivity-voltage-current', title: '电压—电流', x: ['保存电流 I', 'A'], y: ['保存电压 U', 'V'], omit: ['voltage'], point: r => ({ x: m(r, 'current', 'A'), y: m(r, 'voltage', 'V') }), estimates: fit => [v('resistance', 'U—I拟合电阻', positive(fit.slope), 'Ω')], conditions: '固定长度、直径和材料，只改变电压；零电压可作为原点，但不能单独用0/0计算电阻。', next: '固定同一根金属丝，保存三个不同电压下的U、I。' })];
  if (id === 'multimeter') {
    const unit = (r: Reading) => ['V', 'A', 'Ω'][p(r, 'functionMode')]!;
    const reference = (r: Reading) => {
      const mode = p(r, 'functionMode'); const sign = p(r, 'probesReversed') ? -1 : 1;
      const voltage = p(r, 'powerOn') && p(r, 'circuitClosed') ? p(r, 'supplyVoltage') : 0;
      return mode === 0 ? voltage * sign : mode === 1 ? voltage / p(r, 'resistanceOhms') * sign : p(r, 'resistanceOhms');
    };
    const result = relation({ id: 'multimeter-reading-reference', title: '有效示数—回路参考值（按挡位分组）', x: ['当时回路参考值', '按组：V/A/Ω'], y: ['保存的表显示值', '按组：V/A/Ω'], point: r => { requireFlag(r, 'configurationValid', '表笔接法与功能不符。'); if (m(r, 'overRange', '') !== 0) throw new RangeError('超量程不是有效的零示数。'); return { x: reference(r), y: m(r, 'meterValue', unit(r)) }; }, conditions: '只比较同功能、量程、接法及供电状态；目标值来自当时回路条件，纵轴保留量化显示。同一模式内才有统一单位，不能用此模型一致性宣称校准实体仪器。', next: '正确电压/电流挡改变供电电压，正确断电隔离电阻挡改变待测电阻，分别保存三种有效示数。' });
    result.controls = r => controls(p(r, 'functionMode') === 2 ? ['resistanceOhms'] : ['supplyVoltage'])(r);
    return [result];
  }
  if (id === 'refractive-index') return [relation({ id: 'refraction-sines', title: '入射角正弦—折射角正弦', x: ['保存的 sin r', ''], y: ['保存的 sin i', ''], omit: ['incidentAngleDegrees'], point: r => { requireFlag(r, 'transmissionValid', '全反射时没有折射角，不能把占位角度用于拟合。'); return { x: m(r, 'sinRefracted', ''), y: m(r, 'sinIncident', '') }; }, estimates: fit => [v('relativeIndex', '相对折射率 n₂/n₁', positive(fit.slope))], conditions: '固定两介质折射率，只改变入射角，角度从法线量起。正入射可以是原点，但不单独用0/0计算折射率；全反射记录排除。', next: '保持同一介质组合，保存三个有折射光且角度不同的读数。' })];
  if (id === 'induced-current') return [relation({ id: 'induced-emf-flux-rate', title: '感应电动势—每匝磁通量负变化率', x: ['保存的 −dΦ/dt', 'Wb/s'], y: ['保存的 ε', 'V'], point: r => ({ x: -m(r, 'fluxRate', 'Wb/s'), y: m(r, 'emf', 'V') }), estimates: fit => [v('turns', '由斜率估计匝数', positive(fit.slope), '匝')], conditions: '每匝磁通量与磁链区分，固定匝数及全部运动条件，比较同一周期内不同变化率。开路有电动势但没有闭路电流。', next: '保持条件并播放，在三个不同磁通变化率的时刻保存，不要只取每个周期的同相位。' })];
  if (id === 'transformer-ratio') return [relation({ id: 'transformer-secondary-primary', title: '次级—初级电压有效值', x: ['保存的初级电压有效值', 'V'], y: ['保存的次级电压有效值', 'V'], omit: ['primaryRmsVoltage'], point: r => ({ x: m(r, 'primaryRmsVoltage', 'V'), y: m(r, 'secondaryRmsVoltage', 'V') }), estimates: fit => [v('turnsRatio', '由有效值拟合的匝比 N₂/N₁', positive(fit.slope))], conditions: '固定匝数、频率、负载，使用交流正弦有效值；直流不适用。不同仿真时刻的同一有效值不增加独立取值。', next: '固定匝比，分别保存三个不同交流输入有效值。' })];
  if (id === 'sensor-control') {
    const difference = (r: Reading) => Math.abs(m(r, 'sensorTemperature', '°C') - p(r, 'temperatureEnd'));
    const unsupported = (r: Reading) => difference(r) === 0 ? '传感器温度已等于环境终值，温差为零，不能取对数拟合响应时间。' : null;
    return [relation({ id: 'sensor-log-response-time', title: '温差对数—响应时间', x: ['时间 t', 's'], y: ['ln(|T−T终|/1℃)', ''], point: r => ({ x: r.timeSeconds, y: unsupported(r) ? 0 : Math.log(difference(r)) }), estimates: fit => { if (!(fit.slope < 0)) throw new RangeError('温差没有指数衰减，不能估计正的响应时间。'); return [v('responseTime', '拟合时间常量', -1 / fit.slope, 's')]; }, conditions: '固定起止温度、时间常量及控制阈值，只比较同次阶跃内时刻。不是NTC热敏电阻模型；阈值切换与传感器响应时间分开。', next: '让起止温度不同，在温差尚非零的三个时刻保存温度。', unsupported, groupingKey: r => unsupported(r) ?? 'finite-difference' }), relation({ id: 'sensor-voltage-temperature', title: '输出电压—传感器温度', x: ['保存的传感器温度', '°C'], y: ['保存的输出电压', 'V'], point: r => ({ x: m(r, 'sensorTemperature', '°C'), y: m(r, 'outputVoltage', 'V') }), conditions: '同次阶跃中比较传感器温度和线性输出电压，环境终值不能代替尚未稳定的传感器温度。', next: '在传感器尚在响应时保存三个不同温度对应的输出电压。' })];
  }
  if (id === 'oil-film') return [relation({ id: 'oil-thickness-inverse-area', title: '油膜厚度—面积倒数', x: ['面积倒数 1/S', 'm⁻²'], y: ['保存的厚度 d', 'm'], omit: ['filmAreaCm2'], point: r => ({ x: 1 / (p(r, 'filmAreaCm2') * 1e-4), y: m(r, 'thickness', 'm') }), estimates: fit => [v('pureOilVolume', '由斜率估计纯油体积', positive(fit.slope), 'm³')], conditions: '固定标定体积、滴数、使用滴数和体积分数，只改变面积；厚度为单分子层假设下的估计，不是直接看见分子。', next: '保持同一纯油量，保存三个不同膜面积的厚度估算，并检查cm²到m²。' })];
  if (id === 'gas-pressure-volume') return [relation({ id: 'gas-pressure-inverse-volume', title: '绝对压强—体积倒数', x: ['体积倒数 1/V', 'm⁻³'], y: ['保存的绝对压强 p', 'Pa'], omit: ['volumeMl'], point: r => ({ x: 1 / (p(r, 'volumeMl') * 1e-6), y: m(r, 'pressure', 'Pa') }), estimates: fit => [v('nRT', '由斜率估计 nRT', positive(fit.slope), 'J')], conditions: '固定气体量、温度及外界压强，仅改变体积；纵轴用绝对压强，温度换算为K，不能把表压代入。', next: '恒温密闭条件下取三种不同体积，保存绝对压强并选择p—1/V分析。' })];
  if (id === 'photoelectric-effect') return [relation({ id: 'photo-stopping-frequency', title: '遏止电压—光频率', x: ['光频率 ν', 'THz'], y: ['保存的理论遏止电压', 'V'], omit: ['frequencyTHz'], point: r => { requireFlag(r, 'emissionAllowed', '频率未超过阈值，无出射电子的占位遏止电压不能拟合。'); if (!(p(r, 'opticalPowerMilliwatts') > 0)) throw new RangeError('光功率为零，没有出射电子可用于遏止条件观察。'); return { x: p(r, 'frequencyTHz'), y: m(r, 'stoppingVoltage', 'V') }; }, estimates: fit => [v('planckOverCharge', '模型采样估计 h/e', positive(fit.slope) / 1e12, 'V·s'), v('workFunctionEv', '模型采样估计逸出功', -fit.intercept, 'eV')], conditions: '固定逸出功、非零光功率及收集电压，仅改变超过阈值的频率。拟合的是理论遏止条件，不是从手动I—V测量提取的独立值。', next: '设置非零光功率，选择三个超过阈值的不同频率并保存。' })];
  return [relation({ id: 'particle-radius-speed', title: '磁场轨迹半径—速率', x: ['初始速率 v', 'm/s'], y: ['保存的轨迹半径 r', 'm'], omit: ['speedKmPerSecond'], point: r => { requireFlag(r, 'radiusDefined', '零场或零荷质比是直线，没有可用于回旋拟合的半径。'); return { x: p(r, 'speedKmPerSecond') * 1000, y: m(r, 'radius', 'm') }; }, estimates: fit => [v('angularFrequencyMagnitude', '由斜率估计 |qB/m|', 1 / positive(fit.slope), 's⁻¹')], conditions: '固定有符号荷质比、磁场和初速度方向，仅改变速率；全部速度垂直于磁场。正负号决定弯曲方向，半径是非负大小。', next: '选非零荷质比和磁场，保存三种不同速率的半径；零场单独作为直线对照。' })];
}
