import { EXPANDED_HIGH_SCHOOL_EXPERIMENTS } from "@physics-lab/physics/high-school/expansionCatalog";
import type { HighSchoolExperimentDefinition, HighSchoolExperimentId } from "./types";
import { finiteNumber } from "@physics-lab/physics/high-school/types";

export const HIGH_SCHOOL_EXPERIMENTS: HighSchoolExperimentDefinition[] = [
  {
    id: "uniform-acceleration", title: "匀变速直线运动", field: "力学",
    description: "用位置和速度曲线辨认加速度，区分位移、路程与运动方向。",
    assumptions: ["一维质点运动，初位置为 0 m，加速度在观察期间保持不变。", "速度和加速度均带方向；负速度表示沿负方向运动，不代表速度大小为负。"],
    parameters: [
      { key: "initialVelocity", label: "初速度", unit: "m/s", min: -5, max: 5, step: 0.5, defaultValue: 1 },
      { key: "acceleration", label: "加速度", unit: "m/s²", min: -3, max: 3, step: 0.1, defaultValue: 0.8 },
      { key: "duration", label: "观察时长", unit: "s", min: 1, max: 10, step: 0.5, defaultValue: 5 }
    ]
  },
  {
    id: "newton-second-law", title: "小车与挂码：牛顿第二定律", field: "力学",
    description: "同时分析小车和挂码，比较系统合外力、总质量、加速度与绳张力。",
    assumptions: ["轻绳不可伸长，滑轮质量及轴摩擦忽略；小车与挂码从静止开始具有相同加速度。", "g = 9.8 m/s²；等效阻力采用最大静摩擦等于滑动摩擦的简化模型。", "驱动力不足时保持静止；到达可用行程终点便停止演示，不模拟碰撞。"],
    parameters: [
      { key: "cartMass", label: "小车质量", unit: "kg", min: 0.2, max: 2, step: 0.05, defaultValue: 0.5 },
      { key: "hangingMass", label: "挂码质量", unit: "kg", min: 0.01, max: 0.5, step: 0.01, defaultValue: 0.05 },
      { key: "resistance", label: "等效阻力", unit: "N", min: 0, max: 2, step: 0.01, defaultValue: 0.05 },
      { key: "travelDistance", label: "可用行程", unit: "m", min: 0.25, max: 2, step: 0.05, defaultValue: 1 }
    ]
  },
  {
    id: "projectile-motion", title: "平抛与斜抛运动", field: "力学",
    description: "分别追踪水平与竖直分运动，用轨迹和速度检验运动的独立性。",
    assumptions: ["忽略空气阻力，g = 9.8 m/s² 为常量；地面水平，竖直向上为正。", "轨迹计算到第一次落地为止，末速度指碰撞前速度，不模拟反弹。"],
    parameters: [
      { key: "initialSpeed", label: "初速度大小", unit: "m/s", min: 0, max: 25, step: 0.5, defaultValue: 8 },
      { key: "angleDegrees", label: "抛射角", unit: "°", min: 0, max: 90, step: 1, defaultValue: 0 },
      { key: "initialHeight", label: "初始高度", unit: "m", min: 0, max: 10, step: 0.1, defaultValue: 2 }
    ]
  },
  {
    id: "pendulum", title: "单摆周期与摆角", field: "力学",
    description: "测量摆长和周期，并比较小角公式与大角度下的实际运动。",
    assumptions: ["理想轻绳、质点摆球，无阻尼，g = 9.8 m/s²；摆长从悬点量到摆球中心。", "使用 θ″ = −(g/L)sinθ 数值积分；不把大摆角当作简谐运动。", "摆角限制在 0°–75°以保持轻绳绷紧；周期用椭圆积分数值求积，小角公式仅作对照。"],
    parameters: [
      { key: "length", label: "摆长", unit: "m", min: 0.3, max: 2, step: 0.05, defaultValue: 1 },
      { key: "amplitudeDegrees", label: "释放摆角", unit: "°", min: 2, max: 75, step: 1, defaultValue: 10 },
      { key: "mass", label: "摆球质量", unit: "kg", min: 0.05, max: 0.5, step: 0.05, defaultValue: 0.1 }
    ]
  },
  {
    id: "emf-internal-resistance", title: "电动势与电源内阻", field: "电学",
    description: "改变负载测量端电压与电流，从 U–I 图像识别电动势和内阻。",
    assumptions: ["稳恒直流，电源用恒定电动势和串联内阻表示，电表理想。", "端电压 U = E − Ir；接有负载且内阻非零时，端电压小于电动势。", "只计算稳态工作点，不模拟电池放电、温升和瞬态；负载至少 0.1 Ω。"],
    parameters: [
      { key: "emf", label: "电动势", unit: "V", min: 1, max: 12, step: 0.1, defaultValue: 3 },
      { key: "internalResistance", label: "电源内阻", unit: "Ω", min: 0, max: 5, step: 0.1, defaultValue: 1 },
      { key: "loadResistance", label: "负载电阻", unit: "Ω", min: 0.1, max: 50, step: 0.1, defaultValue: 5 }
    ]
  },
  {
    id: "double-slit", title: "双缝干涉与波长", field: "光学",
    description: "改变波长、缝间距和屏距，比较干涉条纹与光程差。",
    assumptions: ["两狭缝视作同相、等振幅的相干点光源；忽略有限缝宽的衍射包络。", "光强由两条几何路径的精确光程差计算，显示的是归一化相对光强。", "条纹间距 λL/d 仅作为近轴近似；屏幕显示范围为中心两侧各 20 mm。"],
    parameters: [
      { key: "wavelengthNm", label: "光波长", unit: "nm", min: 400, max: 700, step: 5, defaultValue: 550 },
      { key: "slitSeparationMm", label: "缝间距", unit: "mm", min: 0.1, max: 0.5, step: 0.01, defaultValue: 0.25 },
      { key: "screenDistance", label: "双缝到屏距离", unit: "m", min: 0.5, max: 3, step: 0.1, defaultValue: 1.5 },
      { key: "screenPositionMm", label: "观察点位置", unit: "mm", min: -20, max: 20, step: 0.1, defaultValue: 0 }
    ]
  },
  {
    id: "spring-force", title: "弹簧伸长与弹力", field: "力学",
    description: "保持同一弹簧，只改变悬挂总质量，比较弹力与伸长量并用保存的数据拟合劲度系数。",
    assumptions: ["理想轻弹簧静态平衡，忽略弹簧自重；悬挂总质量包含托盘或挂钩，g = 9.8 m/s²。", "原长是未挂载荷时的长度，伸长量为总长减原长；弹力大小 F = mg = kΔL 只用于静态平衡。", "预设线性适用范围为伸长量 0–0.25 m；不是测得的真实弹性限度，不模拟非线性、永久形变、振荡或读数噪声。"],
    parameters: [
      { key: "stiffness", label: "模型劲度系数", unit: "N/m", min: 10, max: 50, step: 1, defaultValue: 20 },
      { key: "naturalLength", label: "弹簧原长", unit: "m", min: 0.1, max: 0.3, step: 0.01, defaultValue: 0.15 },
      { key: "loadMassGrams", label: "悬挂总质量（含托盘）", unit: "g", min: 0, max: 250, step: 10, defaultValue: 100 }
    ]
  },
  {
    id: "force-composition", title: "共点力的合成", field: "力学",
    description: "在二维矢量板上调节两个共点力，并独立试配一个等效拉力，比较大小、方向及矢量差。",
    assumptions: ["二维静态共点力矢量板，方向角从 +x 轴起逆时针为正；不模拟物体运动或真实测力计、橡皮筋器材。", "合力按两个力的分量相加；等效力与合力同向，平衡力与合力反向。", "试配力由学生独立调节，不自动填入模型答案；矢量差为试配力减合力，不是仪器测量误差。", "零合力没有方向；任一分力为零时，两力夹角无定义。曲线和保存读数均为模型计算，不能代替独立实测。"],
    parameters: [
      { key: "force1N", label: "力 F₁ 大小", unit: "N", min: 0, max: 5, step: 0.1, defaultValue: 3 },
      { key: "angle1Degrees", label: "力 F₁ 方向角", unit: "°", min: -180, max: 180, step: 1, defaultValue: 0 },
      { key: "force2N", label: "力 F₂ 大小", unit: "N", min: 0, max: 5, step: 0.1, defaultValue: 4 },
      { key: "angle2Degrees", label: "力 F₂ 方向角", unit: "°", min: -180, max: 180, step: 1, defaultValue: 90 },
      { key: "trialForceN", label: "试配等效拉力大小", unit: "N", min: 0, max: 10, step: 0.1, defaultValue: 5 },
      { key: "trialAngleDegrees", label: "试配力方向角", unit: "°", min: -180, max: 180, step: 1, defaultValue: 0 }
    ]
  },
  {
    id: "mechanical-energy", title: "机械能守恒与纸带读数", field: "力学",
    description: "比较重力势能减少与动能增加；用自己输入的纸带位置估计两个内部点的速度，区分模型与手动证据。",
    assumptions: ["质点与虚拟计时器同步从静止释放，竖直向下位移为正，g = 9.8 m/s²；真实纸带第一个可辨点不一定对应零初速度。", "向上恒定阻力 f = rmg，r 为设置的阻力与重力之比；这不是空气阻力模型。", "计时点固定每 0.02 s 出现；只包含落地前的等时点，非等时落地帧不补为纸带点。", "停在首次到达地面前一瞬，不模拟碰撞、反弹或落地后运动；手动六位置独立输入，模型答案不会回填。"],
    parameters: [
      { key: "mass", label: "下落物体质量", unit: "kg", min: 0.05, max: 1, step: 0.05, defaultValue: 0.2 },
      { key: "dropHeight", label: "释放高度", unit: "m", min: 0.5, max: 2, step: 0.1, defaultValue: 1.2 },
      { key: "resistanceRatio", label: "恒定阻力与重力之比 r", unit: "", min: 0, max: 0.4, step: 0.02, defaultValue: 0 }
    ]
  },
  {
    id: "capacitor-charge", title: "电容器充放电", field: "电学",
    description: "切换接电源、经电阻放电与断路保持，保存完整过程并比较电压、电流、电荷与能量。",
    assumptions: ["理想电容、固定正电压电源、有限串联电阻和理想电表；忽略漏电、寄生参数和击穿。", "每轮从零电压开始，R/C/E固定；切换开关延续电压，改变数值参数重新开始一轮。", "正电流流入标记极板，Q指该极板有符号电荷，另一极板为−Q；电荷不穿过介质。", "20RC仅为观察窗口，不在5τ或终点强制充满/放空；模型采样不代表实体测量。"],
    parameters: [
      { key: "resistanceKOhm", label: "串联电阻 R", unit: "kΩ", min: 1, max: 10, step: 1, defaultValue: 10 },
      { key: "capacitanceMicrofarads", label: "电容 C", unit: "μF", min: 100, max: 1000, step: 10, defaultValue: 470 },
      { key: "emf", label: "电源电动势 E", unit: "V", min: 1, max: 12, step: 0.5, defaultValue: 6 }
    ]
  }
  ,...EXPANDED_HIGH_SCHOOL_EXPERIMENTS
];

export function highSchoolExperiment(id: HighSchoolExperimentId) {
  const experiment = HIGH_SCHOOL_EXPERIMENTS.find((item) => item.id === id);
  if (!experiment) throw new RangeError("未知的高中实验");
  return experiment;
}

export function defaultHighSchoolParameters(id: HighSchoolExperimentId): Record<string, number> {
  return Object.fromEntries(highSchoolExperiment(id).parameters.map((parameter) => [parameter.key, parameter.defaultValue]));
}

export function validatedHighSchoolParameters(id: HighSchoolExperimentId, values: Record<string, number>) {
  const experiment = highSchoolExperiment(id);
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new RangeError("实验参数必须是数值配置对象");
  for (const key of Object.keys(values)) if (!experiment.parameters.some((parameter) => parameter.key === key)) throw new RangeError(`未知的实验参数：${key}`);
  return Object.fromEntries(experiment.parameters.map((parameter) => {
    const value = finiteNumber(Object.hasOwn(values, parameter.key) ? values[parameter.key]! : parameter.defaultValue, parameter.label, parameter.min, parameter.max);
    if (parameter.integral && !Number.isSafeInteger(value)) throw new RangeError(`${parameter.label} 必须是整数`);
    if (parameter.choices && !parameter.choices.some((choice) => choice.value === value)) throw new RangeError(`${parameter.label} 必须选择有效选项`);
    return [parameter.key, value];
  }));
}
