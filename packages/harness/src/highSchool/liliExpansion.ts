import type { LiliExperimentContext } from '@physics-lab/contracts';

/** Teaching notes for the expanded catalogue. Model conditions remain the source of truth. */
export interface ExperimentGuidance {
  next: string;
  variables: string;
  graph: string;
  error: string;
}

export const expansionGuidance: Record<string, ExperimentGuidance> = {
  'centripetal-force': {
    next: '先预测径向合力朝向哪里，再固定半径r和角速度ω，只改变质量m，保存至少3种质量条件的F。另做固定m/ω改变r、固定m/r改变ω的两组对照。速度箭头沿切线，力指向圆心；这些是理想模型读数，不是实体测力计实测。',
    variables: '研究质量时固定r、ω；研究半径时固定m、ω；研究角速度时固定m、r。速率v=|ω|r，改变半径时不能同时保持非零v和ω。固定ω时F随r增大，固定v时F随r减小，两种条件不能混成一组。',
    graph: '分别比较保存的F—m、F—r和F—ω²，先按固定条件分组，至少3个不同自变量再拟合。F=mω²r是模型关系；匀速指速率不变，速度方向仍变化。重复保存同一条件的不同时刻，不会增加质量、半径或角速度取值。',
    error: '半径量到质点中心，角速度用rad/s，不能把转每分直接代入。向心力是径向合力的作用效果，不是另加的一种力；本页不模拟真实塔轮传动、测力套筒或校准误差。ω=0时v与F为零，不能给静止物体指定转动周期。',
  },
  'precision-length': {
    next: '先选游标卡尺或螺旋测微器，将接触模式设为合拢检查零点，再改为夹住物体并开启扣除零点，比较示值与修正长度。未接触不能保存为有效测量，合拢零点不是物体长度；这仍是参数驱动练习，不是实体装夹。',
    variables: '比较两种工具时保持被测长度和零偏不变；研究零偏时固定工具和长度，只改变零偏。修正值=示值−量化后的零点读数，正零偏要减、负零偏要加；不因多显示几位小数就提高精度。',
    graph: '固定工具、零偏与扣零点选项，夹住物体后改变至少3种长度，比较修正长度—设定长度。游标由主尺与对齐格贡献组成，螺旋尺由固定尺与转动刻度组成；量化后的修正值可能仍有差别，不能强制凑成一样。零点检查和未接触状态不混入物体长度拟合。',
    error: '核对mm与m、零偏符号以及分度，区分显示分辨率和测量精度。当前读数是仪器量化模型，不代表真实接触力、夹持倾斜、棘轮或多位置重复测量；模型示值不能冒称学生独立读尺。',
  },
  resistivity: {
    next: '先固定金属丝材料、长度和直径，改变电压保存至少3组U、I，再比较U—I。用R与截面积πd²/4计算ρ=Rπd²/(4L)，记录直径从mm到m的换算；不要用零电压的一点单独求U/I。',
    variables: 'U—I组固定电阻率、长度与直径，只改变电压。研究长度影响另固定材料和直径；研究直径影响另固定材料和长度。改了几何或材料的记录必须分组，不能混入同一条U—I拟合。',
    graph: '同条件U—I斜率为R，再由ρ=Rπd²/(4L)计算电阻率。固定材料和直径可比较R—L，固定材料和长度可比较R—1/d²。这里是均匀欧姆导线模型，拟合吻合不是独立实测验证。',
    error: '直径需要平方，mm换成m后再算面积；不要把半径代到直径公式。U=I=0时U/I无定义，不能说导线电阻为0。当前理想模型未模拟温升、接触电阻及电表内阻误差，也没有独立手动测径。',
  },
  multimeter: {
    next: '先判断要测电压、电流还是电阻，选择对应功能和足够大的量程，再设置接法。电压挡并联、电流挡串联；电阻挡要隔离外部电源。保存正确设置下的有效读数；错误设置只观察提示并用文字说明原因，恢复正确条件后再保存，不把无效占位值记为测量。',
    variables: '比较量程时固定被测元件、功能和接法，只改量程；比较接法时保留其他条件。电阻测量必须断开外部电源，功能、量程与电源状态都应随记录保存。虚拟错误操作辨析不代替真实仪表安全训练。',
    graph: '先看有效性；固定功能、量程与正确接法，改变供电或待测电阻以得到至少3个不同目标值，再比较表读数—模型目标值。超量程、错误接法或带电测阻的占位值不能拟合。电压用V、电流用A、电阻用Ω；这是数字表模型，不代表指针表欧姆调零与非线性刻度训练。',
    error: '电流挡并联电源有短路风险，真实器材不要这样连接；电压挡串联也不是正确测压。带电测阻或超量程先纠正设置再重新记录，错误记录原条件保留。无效显示不是元件真实为零，也不能证明保险丝已熔断。',
  },
  'momentum-conservation': {
    next: '将两个碰撞物体作为系统，先约定正方向，保存两质量和碰撞前后的带符号速度。比较总动量m₁v₁+m₂v₂，再改变恢复系数观察动能变化；总动量守恒不等于每个物体动量不变。',
    variables: '比较恢复系数时固定两质量和碰前速度；比较质量时另开一组，保留相同初始速度。判断是否真正相向接近并发生碰撞，未相遇的状态不能当作已完成碰撞。',
    graph: '只用已碰后状态：固定两质量、第二物体初速度、间距和恢复系数，改变第一物体初速度，保存至少3种初始总动量，比较碰后—碰前总动量。另固定完整初态、只改恢复系数，比较碰后动能—e²。弹性碰撞e=1保留动能，非弹性碰撞动能一般减少，e=0时共同速度并不一定为0。初始总动量为0时用有符号差值或绝对差，不用除以初动量的相对百分比。',
    error: '速度必须带方向符号，研究对象包含两个物体；不能只加速度大小。模型忽略外冲量、摩擦及碰撞形变过程，能量损失不是总能量消失；无碰撞情形不伪造碰后测量。',
  },
  'refractive-index': {
    next: '先固定两侧介质折射率，改变入射角，保存至少3个非零且有折射光的角度。入射角和折射角都相对法线量取；用sin i与sin r比较折射率比，不需要真实插针也不能称已完成实体玻璃砖测量。',
    variables: '同组固定入射侧n₁与折射侧n₂，只改变入射角。交换传播方向后另成一组；不能将空气入玻璃与玻璃入空气的角度混合拟合。正入射的0/0不能单独估比值。',
    graph: '按n₁sin i=n₂sin r，横轴sin r、纵轴sin i时斜率为n₂/n₁。高折射率到低折射率才有临界角；恰好临界时r=90°沿界面，超过临界时没有传播折射光，不能把占位折射角0当有效样本。',
    error: '先核对角度相对法线而非界面、介质顺序和角度单位。正入射没有偏折，同折射率也不偏折；全反射不是折射角变成0。当前几何光学模型不模拟玻璃砖插针、光束宽度、吸收及实体测角误差。',
  },
  'induced-current': {
    next: '先固定线圈匝数、面积、转动频率和电阻，在恒定匀强磁场中运行旋转线圈，保存磁通Φ、感应电动势ε与电流I；比较磁通最大与过零时刻。这里的正弦磁通来自线圈转动，不是条形磁铁插拔。',
    variables: '统一线圈正法向和回路正方向的约定，ε=−N dΦ/dt，纯电阻回路I=ε/R。研究频率时固定磁场幅值、面积、匝数和电阻；研究匝数或电阻时分别另分组。改变相位会改变同一时刻的符号，须保留。',
    graph: '固定全部条件保存不同时刻，比较磁通—时间与电动势—时间，再以−dΦ/dt为横轴、ε为纵轴，斜率为匝数N。磁通极值处电动势可以为0，磁通过零时变化率却可能最大。至少3个不同变化率再拟合，正负值要联系约定方向解释。',
    error: '楞次定律反抗磁通的变化，不是永远反抗原磁场。恒定磁场中的旋转线圈仍可感应；磁通恒定、磁场为0或转动频率为0时才没有本模型的感应电动势。开路I=0但ε仍可非零。模型忽略自感和机械反作用，不代表真实磁铁插拔。',
  },
  'transformer-ratio': {
    next: '先固定原线圈匝数、输入交流有效值与频率，改变副线圈匝数，保存两侧电压有效值和匝数比。再保持匝数比改变负载，比较两侧电流和功率；不要用某一瞬时电压0代替交流有效值。',
    variables: '研究变比时固定输入有效值、频率和原边匝数，只改副边匝数；研究负载时固定输入与两侧匝数。理想变压器U₂/U₁=N₂/N₁，电流比相反；当前模型不研究真实铁损或直流暂态。',
    graph: '固定两侧匝数、频率、负载与交流模式，改变原边有效值并保存至少3组，比较U₂—U₁，斜率为N₂/N₁。也可按表比较匝数比，但输入为0时不能直接除以U₁。升压不产生额外功率，正弦有效值、峰值和瞬时值分别标明。',
    error: '匝数不以电压单位代替，交流有效值不是峰值；提高副边电压时同一功率下电流减小。恒定直流不能按此关系持续变压，本页无真实损耗、饱和和漏磁模型，不把理想效率当实物效率。',
  },
  'sensor-control': {
    next: '先设定初始温度与环境温度，观察一阶传感器响应，保存温度、输出电压、上下阈值和执行器状态。比较升温跨上阈值与降温跨下阈值；阈值之间需结合初态和此前过程解释。',
    variables: '研究响应快慢时固定初始/环境温度和阈值，只改时间常量。研究阈值时保持响应条件，改变设定阈值或滞回宽度。这里是线性温度传感器模型，不是NTC热敏电阻，也不是完整房间闭环热控。',
    graph: '固定整轮条件，保存至少3个不同时刻的温度与输出电压。比较V—T，或以ln|T−T环境|对时间拟合、由−1/斜率估τ；初始已等于环境温度时不能估τ。上下阈值形成滞回区，同一温度可能因初态不同而有不同开关状态，不能混作单值曲线。',
    error: '显示温度不等于瞬间环境温度；响应时间常量、阈值和滞回宽度不是同一量。执行器状态不等于模型已包含其对环境的反馈。当前没有真实器件精度、接线噪声或机械继电器寿命的测量证据。',
  },
  'oil-film': {
    next: '先保留溶液总体积、滴数、油酸体积分数和油膜面积，求一滴中的纯油体积，再算d=V纯油/S。逐项检查mL、cm²到SI单位的换算，保存原条件与尺度估计，不把图中膜厚当分子直接成像。',
    variables: '比较面积估计影响时固定纯油体积，只改面积；比较稀释比例时保留溶液体积与滴数。分子尺度推算依赖单分子层和紧密排列近似，输入误差对照不是证明真实分子大小改变。',
    graph: '先列标定溶液体积/标定滴数×使用滴数×油酸体积分数得到本次V纯油，再除以S。固定纯油体积时d与1/S成正比；固定S时d随纯油体积增大。此计算检验估算方法，不是由模型生成面积后独立测出分子。',
    error: '不能把整滴溶液体积当纯油体积，不能忘记除以滴数；1 mL=10⁻⁶ m³，1 cm²=10⁻⁴ m²。未完全铺展、多层膜和面积边界计数会影响真实实验，本页不模拟这些真实铺展过程或独立数格。',
  },
  'gas-pressure-volume': {
    next: '固定气体物质的量和温度，只改变体积，保存至少3个不同体积的绝对压强，比较pV和p—1/V。先写清这是理想气体平衡态；模型直接设定等温，不等于已实测慢压缩的热交换。',
    variables: '同组n和T保持不变，改变V；温度用K。改变温度或气体量后另分组。不能把表压直接代入pV=nRT，也不能在改变体积同时漏气却仍称同一封闭气体。',
    graph: 'p=nRT/V，p—V是反比例曲线，p—1/V才是直线，斜率为nRT。保存的p、V先统一单位再比较pV；理论关系吻合只说明理想模型一致，不代表真实气体无偏差。',
    error: '检查绝对压强与表压、mL与m³、摄氏温度与K。理想气体不能任意用于高密度或接近液化条件；当前平衡态模型不模拟气密性、活塞摩擦和压缩产生的温升。',
  },
  'free-fall': {
    next: '从静止释放，先保存落地前至少3个不同时刻的下落距离和速度，比较s与t²；再改变释放高度，比较落地时间。模型不含空气阻力，不用已落地后的重复位置充当新的自由落体点。',
    variables: '同一轨迹固定释放高度、质量与g，只改变观察时刻；比较高度时固定质量、g和零初速度。另改质量可比较能量，它不改变本模型轨迹或落地时间；当前没有空气阻力对照。',
    graph: '下落距离s=gt²/2，速度大小v=gt；s—t²斜率g/2。落地时间由高度与g决定，与质量无关。落地帧表示碰撞前一瞬，不当碰撞后继续加速；已结束的时钟应复位后再采集落地前时刻。',
    error: '下落距离不是当前离地高度，二者之和才是释放高度。先检查起点、时间和g单位；本页为恒g无阻力、零初速度的理想运动，不包含反弹或真实空气阻力。',
  },
  'photoelectric-effect': {
    next: '先固定逸出功，改变光频率，比较是否达到阈值和最大动能、截止电压；再固定频率，只改光强观察电流。最后比较收集电压，不把所有光电子都当成具有最大动能。',
    variables: '频率对照固定逸出功，光强对照固定频率与收集电压，收集电压对照固定光源。hν−W对应最大动能；低于阈值时增加光强不能弥补单个光子的能量不足。',
    graph: '在可发射范围比较最大动能—频率或截止电压—频率；低于阈值的零值不与阈值以上点混成同一直线。截止电压是遏止最大能量电子的电压大小；实际收集电流还取决于光强与收集电压。',
    error: '光强与光频率不同，截止电压不是外加电压的任意读数。均匀能量分布的收集曲线是教学假设，不是材料实测I—U；量子效率、表面状态与接触电势等未建模，零光强时无光电流。',
  },
  'charged-particle-field': {
    next: '先确定电荷符号、磁场方向和初速度，预测qv×B的方向，再运行保存轨迹半径与周期。固定电荷质量比和磁场，只改速度比较半径；反转电荷或磁场后另记方向对照。',
    variables: '研究速度影响时固定q/m、B；研究磁场时固定q/m、速度。半径用r=v/|qB/m|，周期用2π/|qB/m|；正负号控制转向，不能把负电荷算成负半径。',
    graph: '在非零场和非零横向速度下，固定q/m、B时r与v成正比，周期不随速度改变。磁力垂直速度、不做功，改变运动方向而不改变速率；零磁场或零q/m的直线分支不参与圆轨道周期拟合。',
    error: '核对电荷符号、磁场方向、q/m与速度的单位，洛伦兹力不能当成总是向固定屏幕方向。磁场或q/m为0时是直线，没有圆轨道半径和周期；非相对论平面匀强磁场模型不代表电场加速、辐射损耗或三维螺旋轨迹。',
  },
};

/** Relation selection is explicit, so a mass question cannot silently get an omega fit. */
export function expansionRequestedRelationship(id: string, text: string): string | null {
  if (id === 'centripetal-force') {
    if (/centripetal-force-mass|质量|f-m/.test(text)) return 'centripetal-force-mass';
    if (/centripetal-force-radius|半径|f-r/.test(text)) return 'centripetal-force-radius';
    if (/centripetal-force-omega-squared|角速度|转速|ω|拟合|图像|斜率/.test(text)) return 'centripetal-force-omega-squared';
  }
  if (id === 'momentum-conservation') {
    if (/collision-energy-restitution-squared|动能|恢复系数|e\^?2/.test(text)) return 'collision-energy-restitution-squared';
    if (/momentum-after-before|动量|拟合|图像|斜率/.test(text)) return 'momentum-after-before';
  }
  if (id === 'resistivity') {
    if (/resistivity-resistance-length|长度|r-l/.test(text)) return 'resistivity-resistance-length';
    if (/resistivity-voltage-current|电阻率|电压|电流|u-i|拟合|图像|斜率/.test(text)) return 'resistivity-voltage-current';
  }
  if (id === 'sensor-control') {
    if (/sensor-voltage-temperature|电压|标定|输出/.test(text)) return 'sensor-voltage-temperature';
    if (/sensor-log-response-time|时间常|响应|对数|拟合|图像|斜率/.test(text)) return 'sensor-log-response-time';
  }
  const single: Record<string, string> = {
    'precision-length': 'precision-corrected-length', multimeter: 'multimeter-reading-reference',
    'refractive-index': 'refraction-sines', 'induced-current': 'induced-emf-flux-rate',
    'transformer-ratio': 'transformer-secondary-primary', 'oil-film': 'oil-thickness-inverse-area',
    'gas-pressure-volume': 'gas-pressure-inverse-volume', 'free-fall': 'free-fall-distance-time-squared',
    'photoelectric-effect': 'photo-stopping-frequency', 'charged-particle-field': 'particle-radius-speed',
  };
  const relationship = single[id];
  return relationship && (text.includes(relationship) || /拟合|图像|图线|斜率|分析.*(?:采样|数据)|正弦|折射率比|截止电压.*频率/.test(text)) ? relationship : null;
}

export interface ExpansionReply { text: string; suggestions?: string[] }

/** Current-state notes only. Saved evidence is handled separately by the caller. */
export function expansionCurrentGuidance(question: string, context: LiliExperimentContext, state: Record<string, number>): ExpansionReply | null {
  const id = context.experimentId;
  const profile = expansionGuidance[id];
  if (!profile) return null;
  if (/完成|通过|满分|掌握/iu.test(question)) return { text: '不能按保存条数、理想拟合或有效状态标记认定已完成学习。请说明控制变量、原始条件与结论的关系；这些是虚拟模型对照，不是实体实测或器材技能认证。', suggestions: ['怎样控制变量？', '我应该记录哪些证据？'] };
  if (/手动|读尺|秒表|计时读数|周期数|纸带|实测|真实测量|插针|磁铁.*(?:插入|拔出)|实体/iu.test(question)) return { text: `当前力力上下文尚未接入本项独立手动读数档案；参数操作和自动模型读数不能称为实体实测，也不能代替学生自主填写的读数。${profile.next}`, suggestions: ['怎样控制变量？', '有哪些模型限制？'] };
  if (!/当前|现在|状态|为什么|为何|无效|错误|不动|方向|全反射|临界|正入射|阈值|截止|零点|零偏|接法|量程|反接|直流|零场|零速|开路|断路|不相遇|未碰撞|感应|静止/iu.test(question)) return null;
  const value = (key: string) => Number(state[key]!.toPrecision(6));
  const p = context.parameters;
  let text: string;
  switch (id) {
    case 'centripetal-force':
      text = state.periodDefined === 0
        ? '当前ω=0，模型保持静止，v和径向力都为0，转动周期没有定义；周期的数值占位0不能解释成0秒一周。暂停播放只是停止仿真时钟，与把ω设为0不同。'
        : `当前ω=${p.angularSpeed} rad/s，速率${value('speed')} m/s，径向合力大小${value('force')} N，周期${value('period')} s。角速度的正负改变转向，力大小含ω²始终非负；速度切向、力向心。固定ω改变r与固定v改变r不是同一对照。`;
      break;
    case 'precision-length':
      text = state.readingValid === 0 ? '当前尚未接触，不能把占位数值当作长度。先合拢检查零点，再选择夹住物体；保存物体长度须满足物体接触状态。'
        : state.objectReadingValid === 0 ? `当前是合拢零点检查，零读数${value('zeroReadingMm')} mm；这不是物体长度。下一步夹住物体，保留这次零偏条件再比较示值与修正值。`
          : `当前示值${value('indicatedLengthMm')} mm，零点读数${value('zeroReadingMm')} mm，分度${value('divisionMm')} mm。${p.zeroCorrection === 1 ? `已扣除量化后的零点，修正值${value('correctedLengthMm')} mm。` : '尚未选择扣除零点；先开启零点修正，再比较。'}正零偏需减去，负零偏需加回；这是量化模型，不是实体装夹精度。`;
      break;
    case 'resistivity':
      text = state.estimateDefined === 0 ? '当前U=0且I=0，不能用0/0求电阻率；估计值占位0不是材料电阻率为零。先用非零电压保存读数，或比较同条件多个U—I点。'
        : `当前模型R=${value('resistance')} Ω，I=${value('current')} A，ρ估计=${value('estimatedResistivity')} Ω·m。它由理想U/I和圆截面积计算，不是独立测径证据；固定材料、长度与直径后再改变电压。`;
      break;
    case 'multimeter':
      text = state.configurationValid === 0 ? '当前接法或供电状态不满足所选功能。电压需并联、电流需串联，电阻需断开外部电源并隔离元件；无效占位0不能解释成测得0。真实电流挡并联电源可能短路，不能照做。'
        : state.overRange === 1 ? `当前超过所选量程${value('selectedRange')}，先提高量程；无效占位0不是被测量为零，不能用于拟合。`
          : `当前读数${value('meterValue')} ${p.functionMode === 0 ? 'V' : p.functionMode === 1 ? 'A' : 'Ω'}，分辨率${value('resolution')}。${p.functionMode !== 2 && p.probesReversed === 1 ? '表笔反接使有符号读数反向；负号不是测量大小为负。' : ''}${p.functionMode !== 2 && (!p.powerOn || !p.circuitClosed) ? '被测电源关闭或回路开路，负载电压/电流为0。' : ''}数字表的量化分辨率不等于真实精度。`;
      break;
    case 'momentum-conservation':
      text = state.collisionPredicted === 0 ? '两质点当前初速度不满足左侧追近右侧的条件，模型中不会相遇；请让v₁>v₂后重新开始，不能把当前速度称为碰后速度。'
        : state.collisionWithinWindow === 0 ? `按条件预计在${value('collisionTime')} s相遇，超过本轮6 s观察窗；当前没有观察到碰撞。可缩短初始间距或增大接近速度，另开一轮保存。`
          : state.collided === 0 ? `当前尚未碰撞，预计碰撞时刻${value('collisionTime')} s；现在保存的是碰前状态，需运行到碰后再作前后对照。`
            : `当前已碰撞，总动量${value('totalMomentum')} kg·m/s、动能${value('kineticEnergy')} J，较初态损失${value('energyLoss')} J。e=${p.restitution}改变动能保持程度；e=0共同速度未必为零。初动量为0时不要除以它求相对偏差。`;
      break;
    case 'refractive-index':
      text = state.totalInternalReflection === 1 ? `当前从较高折射率侧入射且超过临界角${value('criticalAngleDegrees')}°，发生全反射，没有传播折射光。折射角的占位0不是0°折射，不能用于正弦拟合。`
        : state.estimateDefined === 0 ? '当前正入射，入射角与折射角都为0，光线不偏折；sin i/sin r为0/0，不能单点估折射率比。改用多个非零入射角并保留相同介质。'
          : `当前i=${value('incidentAngleDegrees')}°，r=${value('refractedAngleDegrees')}°，两角相对法线，正弦比估计n₂/n₁=${value('indexRatioEstimate')}。${Math.abs(state.refractedAngleDegrees! - 90) < 1e-7 ? '这是临界掠射，折射光沿界面，不是超过临界角的全反射。' : p.incidentIndex === p.transmittedIndex ? '两侧折射率相同，光线不偏折。' : '保持两侧介质不变，采集多个角度再比较。'}`;
      break;
    case 'induced-current':
      text = `当前每匝磁通${value('flux')} Wb，ε=${value('emf')} V，I=${value('current')} A。${p.closed === 0 ? '回路开路，I=0，但磁通变化时ε仍可非零。' : '闭路纯电阻模型I=ε/R。'}恒定磁场中的线圈转动仍能改变磁通；电流正向按线圈正法向的右手规则，楞次定律反抗磁通变化，不是磁通本身。${p.rotationFrequency === 0 || p.fieldAmplitude === 0 ? '当前转动频率或磁场幅值为0，因此没有该感应电动势。' : ''}`;
      break;
    case 'transformer-ratio':
      text = state.readingValid === 0 ? '当前选了直流输入，理想交流变压器关系不适用；输出占位0不是对真实直流暂态或铁芯损坏的预测。请改为交流正弦再记录匝数与有效值。'
        : `当前原边有效值${value('primaryRmsVoltage')} V、副边${value('secondaryRmsVoltage')} V，匝数比${value('turnsRatio')}。${p.primaryRmsVoltage === 0 ? '输入为0，电流和功率也为0，不能直接除以U₁求电压比。' : `理想输出功率${value('secondaryPower')} W，不因升压而产生额外功率。`}瞬时过零不是有效值为0；本模型不含真实损耗与饱和。`;
      break;
    case 'sensor-control':
      text = `当前传感器${value('sensorTemperature')} ℃，环境${value('environmentTemperature')} ℃，输出${value('outputVoltage')} V，执行器${state.relayOn ? '开' : '关'}；上下阈值为${value('upperThreshold')}、${value('lowerThreshold')} ℃。到上限开、到下限关，中间依初态/此前状态保持；无滞回且恰在阈值时模型规定开。一阶响应不是NTC，执行器没有反过来改变本模型环境温度。`;
      break;
    case 'oil-film':
      text = `本次${p.usedDrops}滴溶液中的纯油体积${value('pureOilVolume')} m³，面积${value('filmArea')} m²，估计厚度${value('thicknessNm')} nm。先用标定体积除以标定滴数，再乘使用滴数和纯油体积分数；示意面积是输入，不是自动识别出的真实膜轮廓。`;
      break;
    case 'gas-pressure-volume':
      text = `当前绝对压强${value('pressureKPa')} kPa，表压${value('gaugePressureKPa')} kPa，温度${value('temperatureKelvin')} K。表压可为负，表示低于外界大气压，不是绝对压强为负；pV=nRT必须用绝对压强。固定气体量和温度后比较体积。`;
      break;
    case 'free-fall':
      text = `当前下落距离${value('position')} m，剩余高度${value('height')} m，向下速度${value('velocity')} m/s；落地时间${value('durationSeconds')} s。质量改变能量大小，不改变给定高度和g下的轨迹。${state.time! >= state.durationSeconds! ? '已到碰撞前一瞬的终点，不模拟反弹；复位后再采集落地前时刻。' : '这是无阻力、零初速度模型。'}`;
      break;
    case 'photoelectric-effect':
      text = state.emissionAllowed === 0 ? `当前光子能量${value('photonEnergyEv')} eV未超过逸出功${p.workFunctionEv} eV；等阈值对应最大动能为零的边界，低于阈值则不能逸出。增加光强不能补足单光子能量；截止电压占位0不是已测得0 V。`
        : `当前最大动能${value('maxKineticEnergyEv')} eV，理论截止电压大小${value('stoppingVoltage')} V，光电流${value('current')} A。${p.opticalPowerMilliwatts === 0 ? '光功率为0，因此没有实际发射电流；理论阈值仍由频率和逸出功决定。' : '外加负收集电压可阻挡电子，达到遏止条件时电流为0。'}最大动能不代表所有电子；本页I—V使用均匀能量分布和固定10%量子效率的教学假设。`;
      break;
    case 'charged-particle-field':
      text = state.radiusDefined === 0 || state.periodDefined === 0 ? '当前圆轨道半径或周期没有可用定义；当磁场或q/m为0时轨迹为直线，不应把占位0解释成零半径圆或0秒周期。接近零场时也须按有效标记处理。'
        : `当前半径${value('radius')} m，周期${value('period')} s，速率${value('speed')} m/s。当前${state.angularFrequency! > 0 ? '顺时针' : '逆时针'}转动；B正向为+z，正q、正B且初速+x时向−y偏，反转q或B改变转向。磁力垂直速度不做功，半径始终取非负大小。`;
      break;
    default: return null;
  }
  return { text: `${text}这些是当前模型条件，不是实体实测。`, suggestions: ['怎样控制变量？', '我应该记录哪些证据？'] };
}
