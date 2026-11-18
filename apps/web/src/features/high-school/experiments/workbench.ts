import { simulateHighSchoolExperiment, type HighSchoolExperimentDefinition, type HighSchoolExperimentId, type HighSchoolSimulation } from "@physics-lab/physics";
import { createMeasurementStore } from "./measurementStorage";
import type { CapacitorHistory } from "@physics-lab/contracts";

export interface HighSchoolMeasurement {
  id: string;
  createdAt: string;
  timeSeconds: number;
  parameters: Record<string, number>;
  metrics: HighSchoolSimulation["metrics"];
  capacitorHistory?: CapacitorHistory;
}

export { FIXED_TIME_STEP, advanceExperimentClock } from '../../../shared/hooks/simulationClock';

export function formatMeasurement(value: number, digits = 3) {
  if (!Number.isFinite(value)) return "—";
  if (value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 100000)) return value.toExponential(2);
  return Number(value.toFixed(digits)).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

export function formatParameterValue(parameter: HighSchoolExperimentDefinition['parameters'][number], amount: number) {
  return parameter.choices?.find((choice) => choice.value === amount)?.label ?? formatMeasurement(amount);
}

export function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function measurementColumnKey(metric: { key: string; unit: string }) { return JSON.stringify([metric.key, metric.unit]); }
export function measurementColumns(records: readonly HighSchoolMeasurement[]) {
  return [...new Map(records.flatMap((record) => record.metrics).map((metric) => [measurementColumnKey(metric), metric])).values()];
}
export function savedMetric(record: HighSchoolMeasurement, column: { key: string; unit: string }) {
  return record.metrics.find((entry) => entry.key === column.key && entry.unit === column.unit);
}

export function measurementsToCsv(records: HighSchoolMeasurement[], definition: HighSchoolExperimentDefinition) {
  const metrics = measurementColumns(records);
  const withHistory = definition.id === "capacitor-charge" || records.some((record) => record.capacitorHistory !== undefined);
  const header = ["记录时间", "实验时间 / s", ...definition.parameters.map((parameter) => `${parameter.label}${parameter.unit ? ` / ${parameter.unit}` : ""}`), ...metrics.map((metric) => `${metric.label}${metric.unit ? ` / ${metric.unit}` : ""}`), ...(withHistory ? ["实验轮次", "完整开关过程 / JSON"] : [])];
  return "\uFEFF" + [header, ...records.map((record) => [record.createdAt, record.timeSeconds, ...definition.parameters.map((parameter) => parameter.choices?.find((choice) => choice.value === record.parameters[parameter.key])?.label ?? record.parameters[parameter.key] ?? ""), ...metrics.map((metric) => savedMetric(record, metric)?.value ?? ""), ...(withHistory ? [record.capacitorHistory?.runId ?? "", record.capacitorHistory ? JSON.stringify(record.capacitorHistory) : ""] : [])])].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function readMeasurements(experimentId: string): HighSchoolMeasurement[] {
  return createMeasurementStore(experimentId).read().records;
}

export function createTrajectory(id: HighSchoolExperimentId, parameters: Record<string, number>, duration: number) {
  if (id !== "projectile-motion") return [];
  return Array.from({ length: 65 }, (_, index) => {
    const state = simulateHighSchoolExperiment(id, parameters, duration * index / 64).state;
    return { x: state.x, y: state.y };
  });
}

export function positionExtent(simulation: HighSchoolSimulation) {
  const position = simulation.series.find((series) => /position|displacement/.test(series.key));
  const values = [0, simulation.state.position ?? 0, ...(position?.points.map((point) => point.y) ?? [])];
  const low = Math.min(...values);
  return { low, high: Math.max(low + 1, ...values) };
}

export const sceneDescriptions: Record<HighSchoolExperimentId, string> = {
  "centripetal-force": "水平圆周运动的速度沿切线，约束力向圆心。半径量到质点中心；固定角速度时改变半径也改变线速度。零转速没有周期，三维比例为装置示意。",
  "precision-length": "先合拢检查零点，再夹住物体。游标卡尺和测微器使用不同主尺与辅助刻度，修正长度等于示数减零点读数；量化分辨率不代表实体测量准确度。",
  resistivity: "均匀圆金属丝与理想电表，电流表串联、电压表并联。直径先换成米再计算面积；温度固定，不模拟通电导致的电阻率变化。",
  multimeter: "选择功能、量程和接法；电压并联、电流串联，电阻测量须断电隔离。错误接法与超量程不给出有效数字，不模拟真实仪表损坏。",
  "momentum-conservation": "两物体沿同一直线运动，到真正相遇时才应用碰撞关系。速度有正负方向；完全非弹性碰撞后共速，不意味着总动能一定为零。模型按相向接触端的参考位置相遇判定碰撞，车体尺寸仅为示意。",
  "refractive-index": "光线角度均从法线量起。调整两侧折射率和入射角；全反射时不画不存在的传播折射光，也不以零角度占位冒充读数。",
  "induced-current": "匀强磁场中由外部驱动线圈旋转，法线改变产生磁通变化。线圈正法向约定电流正方向；开路仍可有感应电动势，但电流为零。忽略自感和机械反作用。",
  "transformer-ratio": "闭合铁芯与两绕组表示理想无损变压器。仪表读取交流有效值，曲线显示三个周期的瞬时电压；不把动画墙钟速度当作真实交流频率。直流不适用。",
  "sensor-control": "理想线性温度传感器对环境阶跃作一阶响应，继电器在上下阈值间保持状态。它不是NTC器件模型；改参数开始新一轮，起止温度和初始输出随记录保存。",
  "oil-film": "由标定滴体积、使用滴数与油体积分数求纯油体积，再除以水盘油膜面积。侧面的厚度只作放大示意，不是按真实比例看见单分子。",
  "gas-pressure-volume": "密闭活塞中的理想气体处于设定温度的平衡态。绝对压强与表压分别显示；移动活塞改变体积，不模拟快速压缩的升温过程。",
  "free-fall": "真空中从静止释放，向下位移为正。质量不影响下落加速度；到地面前一瞬停止，不模拟碰撞或反弹。",
  "photoelectric-effect": "单色光照射理想阴极，频率与逸出功决定阈值和最大初动能。收集电压改变收集电流，光功率改变光子通量；伏安曲线使用明确的教学分布假设。",
  "charged-particle-field": "粒子速度垂直于匀强磁场。正荷质比、正磁场且初速向右时向下偏；零场或零荷质比为直线。场景示意缩放，速度大小和单位由模型给出。",
  "capacitor-charge": "转换开关选择接电源、经电阻放电或断路。切换时电压和电荷连续，电流可以改变；固定正方向为流入 P 极板。理想断路不漏电，暂停只停止时钟，电荷不会穿过两极板间的介质。",
  "mechanical-energy": "从静止释放重物，用等时虚拟纸带的相邻位置读数求速度，再比较两个内部点间的动能增加与重力势能减少。阻力对照采用恒定向上阻力；终点读数为碰撞前，不模拟碰撞。",
  "force-composition": "在共点矢量板上调整两个力，再独立试配一个等效力；用残差比较，区分等效力与方向相反的平衡力。二维可拖动箭头，三维可旋转观察；固定力的比例尺，不模拟实物测力计或橡皮条。",
  "spring-force": "对照原长 L₀ 与总长 L，伸长量 x = L − L₀。加载与卸载保持刻度比例不变；当前显示静态平衡，不模拟振荡或塑性变形。",
  "uniform-acceleration": "沿标尺观察小车的位置和速度，比较速度—时间图线与位置—时间图线。",
  "newton-second-law": "小车与悬挂重物由轻绳连接。改变质量或阻力，观察同一系统的加速度。",
  "projectile-motion": "观察斜抛物体的轨迹与速度分量。地面为高度零点，落地时停止计时。",
  pendulum: "观察摆球位置与机械能变化。二维可调整释放角并观察摆动；切到三维后，可改变视角观察装置。",
  "emf-internal-resistance": "改变外电阻，比较电路电流、路端电压与电源内部的电压降。",
  "double-slit": "双缝装置的尺寸经过示意放大，屏上亮度分布由双缝干涉模型计算。"
};
