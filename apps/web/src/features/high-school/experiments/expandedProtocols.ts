/** Learner actions shared by the workbench and new teacher lesson drafts. */
export interface ExpandedProtocol {
  inquiryQuestion: string;
  predictionPrompt: string;
  controlledVariable: string;
  evidenceRequirement: string;
  steps: [string, string, string];
  formula: string;
}

export const expandedProtocols: Record<string, ExpandedProtocol> = {
  'centripetal-force': {
    inquiryQuestion: '质量、半径和角速度分别怎样影响向心力？',
    predictionPrompt: '固定质量与半径，预测角速度加倍时向心力变为几倍；再说明固定角速度与固定线速度的区别。',
    controlledVariable: '每轮只研究m、r、ω中的一项，另外两项保持不变。半径对照固定ω，线速度v=ωr随r变化；改变条件开始新一轮。',
    evidenceRequirement: '分别保存至少三种角速度下的F，再作F—ω²图。质量和半径关系分别分组，不能把不同时刻但条件相同的读数视为新的控制条件。ω=0没有转动周期。',
    steps: ['先固定质量和半径，预测转速的作用。', '调整角速度并播放，暂停观察速度切线与向内的力，手动保存三组。', '到下方选择F—ω²分析，再以固定ω的半径对照检验解释。'], formula: 'F = mω²r',
  },
  'precision-length': {
    inquiryQuestion: '怎样把主尺、辅助尺读数与零点偏差合成为长度？',
    predictionPrompt: '预测正零误差会使直接读数偏大还是偏小；比较两种仪器的分辨率。',
    controlledVariable: '同次读数固定待测长度、仪器与零误差。先检查零点，再观察夹持样品后的主尺和辅助尺，切换仪器重新核对量程和分辨率。',
    evidenceRequirement: '保存仪器类型、主尺、辅助尺、直接读数、零误差与修正长度。独立读尺练习与自动模型记录区分；量化分辨率不能宣称实际测量准确度。',
    steps: ['选择游标卡尺或螺旋测微器，检查零点和量程。', '观察主尺及对齐刻线，先自行读数，再核对修正结果。', '改变样品或零误差，保存当时条件并比较两种分辨率。'], formula: 'L = 示数 − 零误差',
  },
  resistivity: {
    inquiryQuestion: '同种金属丝的长度和横截面积怎样改变电阻？',
    predictionPrompt: '分别预测长度加倍、直径加倍时电阻的变化；直径与面积的变化是否相同？',
    controlledVariable: '保持材料、电阻率及直径不变，只改变长度；另一组固定长度和直径只改变电压。模型忽略导线、电表内阻与通电温升。',
    evidenceRequirement: '保存L、d、U、I和R；分别分析R—L或U—I，由A=πd²/4换算ρ=RA/L，注明mm与m的转换。读数为虚拟模型，不冒充真实金属丝测量。',
    steps: ['查看电流表串联、电压表并联，确定材料和直径。', '只改变金属丝长度，手动保存至少三组电阻与条件。', '从R—L斜率和横截面积估计电阻率，再检查单位。'], formula: 'ρ = (U/I)·πd²/(4L)',
  },
  multimeter: {
    inquiryQuestion: '怎样依据待测量选择功能、量程和表笔接法？',
    predictionPrompt: '预测电流挡并接电源、电阻挡测带电元件或量程过小时会出现什么问题。',
    controlledVariable: '每次固定待测对象和电路条件，选择相应功能、量程及接法；测电阻须断开外部电源。改变一项错误设置作对照后恢复。',
    evidenceRequirement: '保存正确功能、量程、接法和有效示数；用文字解释错误状态。超量程或错误接法不能以零值或占位数字保存为有效读数，不模拟实体损坏。',
    steps: ['先选择要测电压、电流还是电阻，再选量程与表笔接法。', '检查有效状态，读取并保存；改变量程比较显示。', '设置一次错误接法或超量程，解释提示后恢复正确条件。'], formula: '功能 · 量程 · 接法',
  },
  'momentum-conservation': {
    inquiryQuestion: '两物体相碰时，总动量和总动能分别怎样变化？',
    predictionPrompt: '预测等质量弹性碰撞后的速度，再预测完全非弹性碰撞后的共同速度。',
    controlledVariable: '固定质量、初始速度与初始间隔，播放并确认实际相碰。另组只改变恢复系数，比较相同初态下动量与能量。速度均带正负方向。',
    evidenceRequirement: '保存碰前与碰后状态、是否已碰撞、两个速度、总动量及总动能。未碰撞或相互远离的设置不能作为碰撞后的证据；恢复系数为0时两物体同速。',
    steps: ['设定两车质量和带方向的初速度，预测是否会相碰。', '播放，在碰前、碰后各暂停保存，核对碰撞状态。', '只改变恢复系数，比较总动量与动能，说明守恒条件。'], formula: 'm₁u₁ + m₂u₂ = m₁v₁ + m₂v₂',
  },
  'refractive-index': {
    inquiryQuestion: '折射角怎样随入射角和两侧介质变化？',
    predictionPrompt: '从低折射率进入高折射率时，预测光线偏向还是偏离法线；反向传播是否总有折射光？',
    controlledVariable: '固定两侧折射率，只改变相对法线的入射角；不同介质组合分组分析。反射与折射光线均以同一界面和法线确定方向。',
    evidenceRequirement: '保存角度及正弦值，分析sin i—sin r；全反射时没有传播折射光，不能把占位角度参与折射率拟合。正入射不单独用0/0计算折射率。',
    steps: ['确定入射侧、两侧折射率与法线方向。', '改变入射角，保存至少三组有折射光的读数。', '反转折射率大小关系，寻找临界条件并解释全反射。'], formula: 'n₁ sin i = n₂ sin r',
  },
  'induced-current': {
    inquiryQuestion: '磁通量的变化如何决定感应电动势与电流方向？',
    predictionPrompt: '区分磁通量大、磁通量变化快和磁通量不变，预测哪一种会产生较大感应电动势。',
    controlledVariable: '按本装置的磁通变化模型固定磁场、面积和匝数，观察不同时刻；另组只改变运动速率或匝数。保持正法线与电流正方向约定。',
    evidenceRequirement: '保存磁通量、变化率、电动势与有符号电流，比较ε—(−dΦ/dt)。静止时或变化率为0时不因磁场非零而认定有感应电流。',
    steps: ['先辨认线圈正法线和电流正方向。', '播放并在不同阶段暂停，比较磁通变化率与电流正负。', '保存三组不同变化率，核对匝数与感应电动势关系。'], formula: 'ε = −N dΦ/dt',
  },
  'transformer-ratio': {
    inquiryQuestion: '理想变压器的电压比、电流比和匝数比怎样对应？',
    predictionPrompt: '预测增加次级匝数时次级电压和输入电流如何改变；不把交流有效值当成瞬时值。',
    controlledVariable: '使用交流电源。固定原副线圈匝数、频率和负载，只改变输入电压；另组固定输入电压改变匝比。模型忽略铁损、铜损和漏磁。',
    evidenceRequirement: '保存匝数、原副边电压和电流有效值，核对U₂/U₁=N₂/N₁及输入输出功率。直流状态不作理想稳态变压读数。',
    steps: ['确认交流电源，设置两侧匝数与负载。', '固定匝比，保存三种输入电压对应的输出有效值。', '比较升压与降压，结合电流与功率解释能量关系。'], formula: 'U₂/U₁ = N₂/N₁',
  },
  'sensor-control': {
    inquiryQuestion: '传感器的响应速度和控制阈值怎样共同影响输出切换？',
    predictionPrompt: '预测环境温度突然升高后传感器是否立即显示终值，以及上下两个阈值之间会保持什么状态。',
    controlledVariable: '固定起止温度、阈值、滞回宽度与继电器初态，只改变响应时间常量；另组只调整阈值。使用理想线性温度传感器和单调阶跃响应，不模拟具体NTC或商品器件。',
    evidenceRequirement: '保存时刻、环境终温、传感器当前温度、输出电压、上下阈值与继电器状态。比较温差对数随时间的变化；阈值间保留原状态，不能用环境终值代替尚未稳定的温度。',
    steps: ['设置环境温度阶跃，预测传感器的响应及继电器切换。', '播放，在接近上下阈值前后暂停并保存读数。', '只改变时间常量或滞回宽度，比较响应快慢与保持状态。'], formula: 'T = T终 + (T初 − T终)e^(−t/τ)',
  },
  'oil-film': {
    inquiryQuestion: '怎样由一滴溶液中的纯油体积和油膜面积估计厚度？',
    predictionPrompt: '固定纯油体积，预测膜面积增大时估算厚度怎样变化；稀释液体积能否直接当作纯油体积？',
    controlledVariable: '固定校准溶液体积、校准滴数和油体积分数，只改变铺展面积；滴体积按校准平均值估计。假设油形成均匀单分子层。',
    evidenceRequirement: '保留校准体积、滴数、浓度和面积，展示纯油体积的单位换算，再用d=V/S估算厚度。不称为直接看到单个分子或精确测得其形状。',
    steps: ['先用体积与滴数校准平均滴体积，核对油的体积分数。', '观察网格水盘面积，保存不同面积及相同油量的对照。', '检查体积、面积和厚度单位，讨论铺展不均匀的影响。'], formula: 'd ≈ V纯油/S',
  },
  'gas-pressure-volume': {
    inquiryQuestion: '固定质量气体在恒温条件下，压强和体积怎样对应？',
    predictionPrompt: '预测体积减半时绝对压强怎样变化；摄氏温度和表压能否直接代入理想气体方程？',
    controlledVariable: '固定气体物质的量和绝对温度，只改变密闭活塞体积。理想气体、准静态恒温；改变温度另成一组，不模拟真实快速压缩的温升过程。',
    evidenceRequirement: '保存绝对温度、体积和绝对压强，分析p—1/V并核对pV。至少三种不同体积，不能把p—V曲线当成正比直线。',
    steps: ['确认密闭与恒温条件，查看绝对温度和绝对压强。', '移动活塞或调整体积，手动保存至少三组。', '比较p—1/V和pV，说明为何不用表压直接计算。'], formula: 'pV = nRT',
  },
  'free-fall': {
    inquiryQuestion: '从静止下落时，位移与时间平方是什么关系？',
    predictionPrompt: '预测同一重力加速度下不同质量的下落运动是否不同，并说明忽略阻力的条件。',
    controlledVariable: '同一组固定释放高度和重力加速度，从静止释放，只比较落地前不同时刻。到地面前停止，不将停止后的同一位置当作自由落体采样。',
    evidenceRequirement: '保存时间、下落位移和速度，拟合x—t²得到g/2；记录至少三种落地前时刻，并区分动画时间与真实秒表测量。',
    steps: ['设置高度与重力加速度，确认初速度为零。', '播放并在落地前的三个不同时刻暂停保存。', '从x—t²的斜率估计g，再改变高度核对模型条件。'], formula: 'x = ½gt²',
  },
  'photoelectric-effect': {
    inquiryQuestion: '频率、光强和遏止电压分别影响哪些光电现象？',
    predictionPrompt: '预测低于阈频时增强光照能否出射电子，以及改变光强会不会改变最大初动能。',
    controlledVariable: '固定金属逸出功与光功率，只改变光频率；另组固定高于阈值的频率，只改变光功率。采用固定量子效率及教学用电子动能分布，不能把示意伏安曲线当成通用实测规律。',
    evidenceRequirement: '保存频率、逸出功、是否出射、最大动能和遏止电压；仅有出射电子的记录用于遏止电压—频率拟合。另比较同频率不同光强的电流。',
    steps: ['选定金属逸出功，从低频向高频寻找阈值。', '在阈值以上保存三种频率，比较遏止电压。', '固定频率改变光强，再调反向电压观察电流被阻止。'], formula: 'Kmax = hν − W',
  },
  'charged-particle-field': {
    inquiryQuestion: '电荷符号、磁场和速度如何决定粒子的偏转？',
    predictionPrompt: '预测反转电荷符号或磁场方向时轨迹怎样变化；磁力是否改变速率？',
    controlledVariable: '粒子速度垂直于匀强磁场。固定有符号荷质比、速率、初速度方向和磁场，只观察同一轨迹；另组只改变一项。零场或零荷质比为直线且没有回旋周期。',
    evidenceRequirement: '保存有符号荷质比与磁场、速率、位置、轨迹半径和周期有效性，核对力与速度垂直。零场或无偏转的占位半径不参加回旋关系拟合。',
    steps: ['先确定速度、磁场方向和电荷正负，预测偏转方向。', '播放并暂停观察轨迹与速度，保存不同设置的读数。', '分别反转电荷或磁场，并以零场作直线运动对照。'], formula: 'F = qv×B；r = mv/|qB|',
  },
};
