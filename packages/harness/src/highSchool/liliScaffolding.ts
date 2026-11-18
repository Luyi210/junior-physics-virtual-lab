import type { LiliExperimentContext } from "@physics-lab/contracts";
import type { HighSchoolExperiment } from "@physics-lab/knowledge/high-school";
import type { HighSchoolExperimentId } from "@physics-lab/physics/high-school";

export type LiliHintLevel = 1 | 2 | 3;
const levels = ["一", "二", "三"] as const;

/** Explicit requests work identically in local guidance and the API fallback. */
export function liliHintLevel(question: string): LiliHintLevel | null {
  const match = question.normalize("NFKC").trim().match(/^(?:请)?(?:给我)?第?([一二三123])级提示[。！!？?]?$/u);
  if (!match) return null;
  return ({ 一: 1, 二: 2, 三: 3, "1": 1, "2": 2, "3": 3 } as const)[match[1] as "一" | "二" | "三" | "1" | "2" | "3"];
}

const questions: Record<HighSchoolExperimentId, { predict: string; check: string }> = {
  "uniform-acceleration": { predict: "相同时间内，小车通过的位移会一样吗？先说出你的预测。", check: "区间平均速度对应哪一段时间？你把它放在了哪个时刻，为什么？" },
  "newton-second-law": { predict: "你要研究合力还是质量的影响？先把小车与挂码选作同一系统。", check: "这组记录真正保持不变的是什么？系统总质量是否包含挂码？" },
  "projectile-motion": { predict: "同一高度水平抛出，改变水平初速度会不会改变落地时间？", check: "你记录的是下落距离还是离地高度？这些记录的竖直初速度是否为零？" },
  pendulum: { predict: "想研究摆长还是摆角的影响？先约定怎样数一次完整往返。", check: "起止是否同向通过同一位置？摆长是否量到球心，小角近似是否适用？" },
  "emf-internal-resistance": { predict: "只改变外接负载时，端电压和电流可能怎样一起变化？", check: "这些点是否来自同一电源条件？你区分了端电压与电动势吗？" },
  "double-slit": { predict: "先选波长、缝距、屏距中的一项：改变它时，条纹间距可能怎样变化？", check: "数的是亮纹条数还是相邻间隔？选点是否在亮纹中心，是否满足近轴条件？" },
  "spring-force": { predict: "加载后的总长和伸长量有什么不同？先找出零载荷时的参照。", check: "横轴是否用了伸长量？质量是否包含托盘，g与kg是否换算正确？" },
  "force-composition": { predict: "两个力共同作用时，一个等效力应怎样选？先判断合力方向是否有定义，再自主试配。", check: "合力非零时，你的试配同时比较了大小和方向吗？是否把平衡力当成了等效力？" },
  "mechanical-energy": { predict: "下落时，动能增加和重力势能减少可能怎样比较？先保留你对阻力影响的预测。", check: "A点速度是否被误设为零？六个位置是否同一零点、共享点一致，并保留原始读数？" },
  "centripetal-force": { predict: "先选质量、半径或角速度中的一项，预测它对径向合力的影响。", check: "研究半径时固定的是角速度还是线速度？不同控制条件是否分组？" },
  "capacitor-charge": { predict: "接电源、断路、经电阻放电时，电压和电流会怎样变化？先分别预测。", check: "保存了完整开关历史吗？用于比较的点是否来自同一轮、同一分段？" },
  "precision-length": { predict: "同一物体，仪器没有接触、合拢检查零点、夹住物体，哪种状态能代表物体长度？", check: "零点检查是否被误当作物体长度？扣零点的符号是否正确？" },
  resistivity: { predict: "要比较电压和电流，金属丝的哪些条件必须保持相同？", check: "直径与半径有没有混淆？平方前是否把mm换成m？" },
  multimeter: { predict: "你准备测电压、电流还是电阻？先判断功能、接法与电源状态。", check: "读数是否有效、量程是否合适？无效占位值有没有混进记录？" },
  "momentum-conservation": { predict: "把两个物体看成一个系统，先约定速度正方向，再预测碰撞前后可比较什么。", check: "碰撞真的发生了吗？速度有没有保留符号，是否把动量与动能混为一谈？" },
  "refractive-index": { predict: "固定两侧介质，改变入射角时，折射光的方向可能怎样变化？", check: "角度是否相对法线？是否把全反射的占位角度当成了有效折射角？" },
  "induced-current": { predict: "线圈在恒定磁场中转动，磁通的大小和变化快慢是一回事吗？", check: "线圈正法向与回路正方向是否统一？开路电流为零能否直接说明电动势为零？" },
  "transformer-ratio": { predict: "固定原线圈和输入交流条件，改变副线圈匝数，输出电压可能怎样变化？", check: "比较的是有效值、峰值还是瞬时值？输入与负载条件是否保持一致？" },
  "sensor-control": { predict: "环境温度变化后，传感器会立即到达环境温度吗？先预测响应过程。", check: "阈值之间的开关状态是否考虑了初态与此前过程？时间常量是否被当成阈值？" },
  "oil-film": { predict: "一滴溶液的总体积能直接当作纯油体积吗？先列清需要保留的原始量。", check: "是否计入标定滴数、使用滴数和体积分数？面积与体积是否都换成一致单位？" },
  "gas-pressure-volume": { predict: "同一份气体保持温度不变，改变体积时压强可能怎样变化？", check: "用的是绝对压强还是表压？气体量与温度是否在同一组保持不变？" },
  "free-fall": { predict: "从静止下落，相同时间内通过的距离会一样吗？先预测再运行。", check: "下落距离与离地高度是否分清？是否误用了落地后的重复位置？" },
  "photoelectric-effect": { predict: "改变光频率和改变光强是同一种操作吗？先分别预测发射条件与电流。", check: "是否区分阈值上下的数据、光强与频率，以及截止电压与外加收集电压？" },
  "charged-particle-field": { predict: "先判断电荷符号、磁场方向与初速度，再预测轨迹向哪侧弯曲。", check: "是否把电荷符号当成负半径？零场的直线状态是否被误用于圆轨道比较？" },
};

/** Describe only prerequisites. Do not expose computed answers or fill in students' readings. */
export function liliHintConstraint(context: LiliExperimentContext, state: Record<string, number>, slitScreenHint: string | null): string | null {
  switch (context.experimentId) {
    case "double-slit": return slitScreenHint;
    case "pendulum": return context.parameters.amplitudeDegrees! > 10 ? "当前摆角超过10°，不要用小角公式反推g；可以另开一组较小摆角的多周期计时，保留原记录。" : null;
    case "newton-second-law": return state.acceleration === 0 ? "当前系统未启动。先检查挂码重力能否克服本模型的静摩擦阈值；为启动而改变条件后应另成一组，不混入原记录。" : null;
    case "projectile-motion": return context.parameters.initialSpeed === 0 ? "当前初速度为零，是从静止下落；研究有水平位移的平抛前先给定非零水平初速度。" : context.parameters.angleDegrees !== 0 ? "当前不是水平抛出。要做平抛对照，先把抛射角设为0°并给定非零初速度；原来的斜抛条件另作一组。" : context.parameters.initialHeight === 0 ? "当前水平抛出的释放高度为零，没有可用的落地前飞行时段；先设置大于零的高度再作对照。" : null;
    case "precision-length": return state.objectReadingValid === 0 ? "当前没有有效的物体长度读数。先合拢检查零点，再选择夹住物体；未接触占位值和合拢零点都不能当作物体长度。" : null;
    case "resistivity": return state.estimateDefined === 0 ? "当前U与I都为零，不能用0/0估计电阻率；改用非零电压或同条件多个U—I点，占位0不代表材料电阻率为零。" : null;
    case "multimeter": return state.configurationValid === 0 ? "当前接法或供电状态无效。先核对所选功能：电压并联、电流串联，电阻测量须断开外部电源并隔离元件；无效占位值不能保存为测量。" : state.overRange === 1 ? "当前超过量程，先提高量程，再检查读数是否有效；不要记录无效占位值。" : null;
    case "momentum-conservation": return state.collisionPredicted === 0 ? "当前两物体不会相遇，不能把现有速度当成碰后速度。改变接近条件后另开一轮。" : state.collisionWithinWindow === 0 ? "碰撞在本轮观察窗之外；改变间距或接近速度后另开一轮，不能声称已经观察到碰撞。" : state.collided === 0 ? "当前尚未碰撞；先保存碰前条件，运行到碰后再作比较。" : null;
    case "refractive-index": return state.totalInternalReflection === 1 ? "当前为全反射，没有传播折射光。占位折射角不能用于拟合；先保持介质不变，减小入射角，选择非零且有折射光的角度。" : state.estimateDefined === 0 ? "当前正入射，不能用0/0单点估计折射率比；保持两侧介质不变，选择多个非零入射角。" : null;
    case "transformer-ratio": return state.readingValid === 0 ? "当前是直流输入，交流变压器关系不适用；改为交流正弦后再记录，不能用当前占位值作交流比较。" : null;
    case "photoelectric-effect": return state.emissionAllowed === 0 ? "当前未处于正超额能量的发射范围。先辨认阈值边界，再单独采集可发射范围；不要把阈值以下的占位截止电压混入直线拟合。" : state.emitting === 0 ? "当前光功率为零，虽然频率满足能量条件，模型没有发射电流，不能说已观察到发射。研究光电流前先设置非零光功率，零光功率记录保留为对照。" : null;
    case "force-composition": {
      const limits = [];
      if (state.resultantDirectionDefined === 0) limits.push("当前合力为零，没有合力方向；不必预测一个方向，也不能把占位角度当作方向");
      if (state.angleBetweenDefined === 0) limits.push("当前存在零分力，两力夹角没有定义，不能把占位夹角用于余弦拟合");
      return limits.length ? `${limits.join("；")}。保留零值对照；研究夹角关系时另设两个非零分力并另成一组。` : null;
    }
    case "charged-particle-field": return state.radiusDefined === 0 || state.periodDefined === 0 ? "当前圆轨道半径或周期没有可用定义；零磁场或零荷质比时是直线，不把占位值用于圆轨道比较。" : null;
    case "centripetal-force": return state.periodDefined === 0 ? "当前角速度为零，没有转动周期；可以保留静止对照，但不能把周期占位0解释为0秒一周。" : null;
    case "free-fall": return state.time! >= state.durationSeconds! ? "当前已到碰撞前一瞬的观察终点；先复位，再采集落地前不同时刻。终点的重复位置不是新的自由落体证据，本页不模拟反弹。" : null;
    default: return null;
  }
}

export function createLiliScaffold(level: LiliHintLevel, experiment: HighSchoolExperiment, profile: { next: string; variables: string }, constraint: string | null) {
  const prompts = questions[experiment.id as HighSchoolExperimentId];
  if (!prompts) return null;
  const content = level === 1
    ? `一级提示 · 先作预测\n${prompts.predict}\n先说出你准备改变的一项，以及要观察的量，暂不急着写结论。`
    : level === 2
      ? `二级提示 · 设计一次对照\n${profile.variables}\n${constraint ? "先完成上面的条件检查，再开始一组对照。" : profile.next}\n把预测和实际观察分开记录。`
      : `三级提示 · 用证据自检\n建议整理：${experiment.evidence.join("；")}。\n${prompts.check}\n先核对证据再写判断；不要为凑结论修改原始读数。`;
  return {
    text: `${constraint ? `先检查当前条件：${constraint}\n\n` : ""}${content}\n这是探究提示，不代表你已经完成测量或掌握；模型采样与虚拟手动读数须分开，均不是真实器材实测。`,
    suggestions: level < 3 ? [`给我${levels[level === 1 ? 1 : 2]}级提示`, "怎样控制变量？"] : ["我应该记录哪些读数？", "有哪些误差来源？"],
  };
}
