/** Independent senior-high catalogue. No junior-high IDs, storage or routes are reused. */
export { getHighSchoolLifeConnection, highSchoolLifeConnections } from './lifeConnections.ts';
export type { LifeConnection } from './lifeConnections.ts';
export type HighSchoolVolumeId = 'required-1' | 'required-2' | 'required-3' | 'elective-1' | 'elective-2' | 'elective-3';
export type HighSchoolDomain = 'mechanics' | 'electricity' | 'magnetism' | 'waves' | 'optics' | 'thermal' | 'modern';
export type HighSchoolExperimentStatus = 'ready' | 'planned';
/** curriculum means matched against the explicitly dated baseline, not an unqualified latest-standard claim. */
export type HighSchoolRequirementLevel = 'curriculum' | 'textbook' | 'extension';

export interface HighSchoolExperiment {
  id: string;
  name: string;
  volume: HighSchoolVolumeId;
  chapter: string;
  domain: HighSchoolDomain;
  status: HighSchoolExperimentStatus;
  learningGoal: string;
  variables: {
    independent: readonly string[];
    dependent: readonly string[];
    controlled: readonly string[];
  };
  evidence: readonly string[];
  sourceUrls: readonly string[];
  requirementLevel: HighSchoolRequirementLevel;
  assumptions: readonly string[];
  verificationNote?: string;
}

export const highSchoolVolumes: readonly { id: HighSchoolVolumeId; name: string }[] = [
  { id: 'required-1', name: '必修第一册' },
  { id: 'required-2', name: '必修第二册' },
  { id: 'required-3', name: '必修第三册' },
  { id: 'elective-1', name: '选择性必修第一册' },
  { id: 'elective-2', name: '选择性必修第二册' },
  { id: 'elective-3', name: '选择性必修第三册' },
];

export const highSchoolDomains: readonly { id: HighSchoolDomain; name: string }[] = [
  { id: 'mechanics', name: '力与运动' },
  { id: 'electricity', name: '电场与电路' },
  { id: 'magnetism', name: '磁场与电磁感应' },
  { id: 'waves', name: '振动与波' },
  { id: 'optics', name: '光学' },
  { id: 'thermal', name: '热学' },
  { id: 'modern', name: '近代物理' },
];

export const highSchoolCurriculumCheckedAt = '2026-11-11';
export const highSchoolCurriculumNote = '按人教版高中六册组织；课标实验关联以已核验的2017年版2020年修订文本为基准。已确认2025年日常修订版发布，逐条差异与学校实际教材版次仍需校核；虚拟探究不代替实体实验操作。';
export const highSchoolCurriculumSources = {
  baselineStandard: 'https://www.pep.com.cn/xw/zt/rjwy/gzkb2020/202205/P020220517520664858048.pdf',
  revision2025: 'https://jcjk.cbpt.cnki.net/portal/journal/portal/client/paper/32d06370842f6d5e20fe8ae300ef65e9',
  textbookPortal: 'https://basic.smartedu.cn/tchMaterial',
  required1: 'https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/708256b6-6f06-4d14-89c7-4df16dfe3b81.pkg/pdf.pdf',
  required2: 'https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/55baa3cc-156f-4358-8e28-bfa21a864450.pkg/pdf.pdf',
  required3: 'https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/dcd8cc6b-5380-4008-a2d0-a061f24d34dd.pkg/pdf.pdf',
  elective1: 'https://r1-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/346c3c04-1663-472c-849e-ff876dcf293f.pkg/pdf.pdf',
  elective3: 'https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/2109c25c-2e52-4da3-8ab3-18cbe632ec11.pkg/pdf.pdf',
  courseDirectory: 'https://v1.ykt.cbern.com.cn/65/document/1e3b7fe7535a4cb4a8ab1f903f802247/pdf.pdf',
} as const;

const sources = (book?: string): readonly string[] => [
  highSchoolCurriculumSources.baselineStandard,
  book ?? highSchoolCurriculumSources.textbookPortal,
];

/** Ready entries must have a registered simulator before a release exposes their experiment route. */
export const highSchoolExperiments: readonly HighSchoolExperiment[] = [
  {
    id: 'uniform-acceleration', name: '小车运动与速度—时间图像', volume: 'required-1',
    chapter: '第二章 匀变速直线运动的研究 · 第1节', domain: 'mechanics', status: 'ready',
    learningGoal: '由位置与时间数据估计瞬时速度，用速度—时间图像判断加速度是否近似恒定。',
    variables: { independent: ['观测时刻', '加速度'], dependent: ['位置', '速度'], controlled: ['初始位置', '同组初速度', '采样间隔'] },
    evidence: ['等时间间隔的位置记录', '速度—时间散点与拟合斜率', '模型适用条件及偏差说明'],
    sourceUrls: sources(highSchoolCurriculumSources.required1), requirementLevel: 'curriculum',
    assumptions: ['直线运动', '同次观测加速度保持恒定', '理论轨迹与模拟读数应区分'],
    verificationNote: '对应2020修订版必修实验中的瞬时速度测量；本条采用教材2.1的探究情境，不将二者标题视为完全相同。',
  },
  {
    id: 'newton-second-law', name: '加速度与合力、质量', volume: 'required-1',
    chapter: '第四章 运动和力的关系 · 第2节', domain: 'mechanics', status: 'ready',
    learningGoal: '分两组控制变量，分别检验加速度与合力、质量倒数的关系。',
    variables: { independent: ['合力', '系统质量'], dependent: ['加速度'], controlled: ['每组保持质量或合力不变', '轨道阻力条件'] },
    evidence: ['固定质量的力—加速度记录', '固定合力的质量—加速度记录', 'a—F与a—1/m图像'],
    sourceUrls: sources(highSchoolCurriculumSources.required1), requirementLevel: 'curriculum',
    assumptions: ['惯性参考系', '受力与质量采用同一研究对象', '不能直接把悬挂物重力当作任意条件下的小车合力'],
  },
  {
    id: 'projectile-motion', name: '平抛运动的分解', volume: 'required-2',
    chapter: '第五章 抛体运动 · 第3节', domain: 'mechanics', status: 'ready',
    learningGoal: '比较同一时刻的水平与竖直位移，用数据检验两个方向的运动特点。',
    variables: { independent: ['水平初速度', '释放高度', '观测时刻'], dependent: ['水平位移', '下落距离', '落地时间'], controlled: ['重力加速度', '竖直初速度为零'] },
    evidence: ['逐时刻坐标表', 'x—t与y—t²图像', '相同高度改变初速度的对照记录'],
    sourceUrls: sources(highSchoolCurriculumSources.required2), requirementLevel: 'curriculum',
    assumptions: ['忽略空气阻力', '均匀重力场', '仅分析落地前轨迹'],
  },
  {
    id: 'pendulum', name: '单摆周期与重力加速度', volume: 'elective-1',
    chapter: '第二章 机械振动 · 单摆', domain: 'waves', status: 'ready',
    learningGoal: '用多周期计时和摆长数据估计重力加速度，检验小角度近似的适用范围。',
    variables: { independent: ['摆长', '初始摆角'], dependent: ['周期', '估计重力加速度'], controlled: ['摆球与悬点条件', '同组重力加速度', '计时周期数'] },
    evidence: ['摆长和多周期计时表', 'T²—L图像', '摆长定义与小角度近似的误差分析'],
    sourceUrls: sources(highSchoolCurriculumSources.elective1), requirementLevel: 'curriculum',
    assumptions: ['细线质量及伸长忽略', '摆球视作质点', '小角度公式仅用于其近似有效范围'],
  },
  {
    id: 'emf-internal-resistance', name: '电源电动势与内阻测量', volume: 'required-3',
    chapter: '第十二章 电能 能量守恒定律 · 第3节', domain: 'electricity', status: 'ready',
    learningGoal: '改变负载记录端电压与电流，用直线截距和斜率估计电动势、内阻。',
    variables: { independent: ['外电阻'], dependent: ['电流', '端电压'], controlled: ['同一电源', '温度与测量条件'] },
    evidence: ['不少于多个负载点的U、I数据', 'U—I拟合图', '截距、斜率及仪表影响说明'],
    sourceUrls: sources(highSchoolCurriculumSources.required3), requirementLevel: 'curriculum',
    assumptions: ['电源采用恒定电动势和欧姆内阻模型', '外电阻为正', '理想电表条件应明确'],
  },
  {
    id: 'double-slit', name: '双缝干涉测量波长', volume: 'elective-1',
    chapter: '第四章 光 · 第4节', domain: 'optics', status: 'ready',
    learningGoal: '测量多条干涉条纹的间距，结合双缝间距和屏距反推单色光波长。',
    variables: { independent: ['双缝间距', '屏距', '单色光波长'], dependent: ['条纹间距', '估计波长'], controlled: ['同次实验的光源', '双缝方向', '多条纹计数规则'] },
    evidence: ['选定条纹中心与间隔数', '屏距、缝距和单位换算表', '重复测量结果及近轴条件说明'],
    sourceUrls: sources(highSchoolCurriculumSources.elective1), requirementLevel: 'curriculum',
    assumptions: ['相干单色光', '条纹间距估波长使用远场近轴近似，光强模型另按几何光程差计算', '忽略单缝衍射包络时不把图样称为完整实测光强'],
  },
  {
    id: 'spring-force', name: '弹簧伸长与弹力', volume: 'required-1',
    chapter: '第三章 相互作用——力 · 弹力', domain: 'mechanics', status: 'ready',
    learningGoal: '在模型给定的线性范围内，记录悬挂总质量和静态伸长量，用F—x图像斜率估计劲度系数，并比较加载与卸载的同条件结果。',
    variables: {
      independent: ['悬挂总质量（含托盘，g）'],
      dependent: ['总长L（m）', '伸长量x=L−L₀（m）', '弹力大小F（N）'],
      controlled: ['同组劲度系数', '原长L₀', '重力加速度9.8m/s²', '静态平衡条件'],
    },
    evidence: ['悬挂总质量、原长L₀、总长L与伸长量x记录', '由F=mg换算载荷的单位检查', 'F—x散点与拟合斜率估计劲度系数', '同条件加载与卸载记录及理想模型限制说明'],
    sourceUrls: sources(highSchoolCurriculumSources.required1), requirementLevel: 'curriculum',
    assumptions: ['理想轻弹簧，逐次改变载荷后直接取静态平衡，不模拟振动过程', '模型预设伸长量0～0.25m为线性有效范围；本页参数组合最大伸长量为0.245m', '不预测真实弹性限度、塑性形变或滞回；加载卸载重合是模型假设', '读数由理想模型生成，不代表实体器材测量或独立手动读尺'],
    verificationNote: '关联已核验的2020修订版弹力与形变量学生实验；教材保留第三章弹力的章节定位，未新增未经核实的页码或2025版逐条一致声明。',
  },
  {
    id: 'force-composition', name: '两个力的矢量合成', volume: 'required-1',
    chapter: '第三章 相互作用——力 · 力的合成和分解', domain: 'mechanics', status: 'ready',
    learningGoal: '在静态共点力模型中独立选择单个试配等效力，对照两力矢量和；固定两力大小改变夹角，用合力大小平方—夹角余弦图像检验模型关系。',
    variables: {
      independent: ['两力方向与夹角θ（°）', '学生独立选择的试配力大小（N）和方向（°）'],
      dependent: ['合力分量与大小R（N）', '非零合力方向（°）', '试配力与合力的矢量差大小（N）'],
      controlled: ['同组两力大小F₁、F₂均大于0且固定', '共同作用点与同一平面', '统一坐标方向与N单位比例'],
    },
    evidence: ['两力与独立试配力的原始大小、方向及合力分量记录', '同一比例下平行四边形对角线与试配力的对照', '至少3个不同cosθ的R²—cosθ散点、自由截距拟合及模型限制', '零合力无方向、合力与平衡力相反的边界说明'],
    sourceUrls: sources(highSchoolCurriculumSources.required1), requirementLevel: 'curriculum',
    assumptions: ['静态二维共点矢量板，不模拟橡皮筋运动、实体安装、测力计校零或仪表误差', '独立试配力由学生选择；其保存值是虚拟操作参数，不是实体实测或单独手动仪器读数', '合力为零时没有方向；任一分力为零时夹角不定义，不纳入夹角关系拟合', '0.05N仅为教学对照阈值，不是测量精度或学习完成判据', 'R²表示合力大小平方，拟合属于模型一致性检查，不能证明实物实验规律已被独立验证'],
    verificationNote: '关联已核验的2020修订版正文第43页必修1第3项及条款1.2.2；教材保留第三章力的合成和分解定位。虚拟矢量对照不代表完成真实橡皮筋等效替代操作，2025正文差异仍待核对。',
  },
  {
    id: 'mechanical-energy', name: '机械能守恒检验', volume: 'required-2',
    chapter: '第八章 机械能守恒定律 · 第5节 实验', domain: 'mechanics', status: 'ready',
    learningGoal: '独立读取虚拟纸带六个位置，估计A、B两点速度，比较重力势能减少量与动能增加量，并区分读数偏差与设定的恒定阻力耗散。',
    variables: {
      independent: ['同次纸带的A、B内部点位置', '分组比较时的恒定阻力与重力之比r'],
      dependent: ['由相邻位置推导的速度vA、vB（m/s）', '重力势能减少量mg(xB−xA)与动能增加量½m(vB²−vA²)（J）'],
      controlled: ['同次质量、释放高度与阻力比不变', '虚拟同步从静止释放', '固定等时采样间隔0.02s，g=9.8m/s²'],
    },
    evidence: ['A、B及各自前后相邻点的六个原始位置（mm）、点号、仿真时刻与参数', '由中央差分分别求vA、vB，再比较两点间ΔEp与ΔK，保留有符号差值', '自动模型采样与虚拟手动读数分别标注，说明读尺分辨率、非重力做功及模型限制'],
    sourceUrls: sources(highSchoolCurriculumSources.required2), requirementLevel: 'curriculum',
    assumptions: ['质点同步从静止释放；选取的内部A点速度不等于零，不能只用B点动能代替动能增加量', 'r=0时仅重力做功；r为0～0.4的向上恒定阻力比例，不是真实空气阻力定律', '只使用已出现且带前后邻点的等时点，B>A；共用同一点时读数须一致，所有不同点的位置严格递增，落地后不补造纸带点', '0.02s是虚拟采样间隔，不是读数精度；六位置由学生输入，可能包含共用点，不用模型速度或理论位置回填', '模型能量关系与虚拟纸带读数均不是实体实测，不代表完成真实器材安装、释放及误差测量'],
    verificationNote: '关联已核验的2020修订版实验清单。2026-11-11读取国家平台人教版必修第二册可检索正文及印刷页标：8.5位于95—98页，包含自由落体纸带和中间时刻速度方法；页面截图、版权页印次及2025课标全文差异未核定。',
  },
  {
    id: 'centripetal-force', name: '向心力的影响因素', volume: 'required-2',
    chapter: '第六章 圆周运动 · 向心力', domain: 'mechanics', status: 'ready',
    learningGoal: '分组控制质量、半径和角速度，比较已保存的径向合力模型读数，区分固定角速度和固定线速度的半径关系。',
    variables: { independent: ['质量m（kg）', '半径r（m）', '角速度ω（rad/s）'], dependent: ['径向合力F（N）', '线速度v（m/s）', '有效转动周期'], controlled: ['研究m时固定r和ω；研究r时固定m和ω；研究ω时固定m和r', '水平匀速圆周运动'] },
    evidence: ['三组完整控制条件与模型F记录', 'F—m、F—r、F—ω²的分组比较', '速度切向、径向合力向内及零角速度边界说明'], sourceUrls: sources(highSchoolCurriculumSources.required2),
    requirementLevel: 'curriculum', assumptions: ['向心力是径向合力的作用效果，不是额外的一种力', '速率v=|ω|r，改变r时不能同时固定非零v和ω；ω=0时没有转动周期', '理想水平约束，不模拟教材真实塔轮、杠杆、弹簧套筒的校准与摩擦', '自动模型读数不是实体实测，也不代表独立手动测力'],
    verificationNote: '2026-11-11读取人教必修第二册6.2印刷27—30页，其中演示器实验在28—29页；PDF文件页序、截图与学校版权页印次未核，2025课标全文差异未核。',
  },
  {
    id: 'capacitor-charge', name: '电容器充放电', volume: 'required-3',
    chapter: '第十章 静电场中的能量 · 电容器的电容', domain: 'electricity', status: 'ready',
    learningGoal: '比较接电源、经电阻放电与断路保持时的电压和电流；由同一分段的已保存模型读数估计时间常量并与RC对照，解释切换时电压连续及电荷储能。',
    variables: {
      independent: ['开关模式及切换时刻', '新一轮对照中的串联电阻R（kΩ）或电容C（μF）'],
      dependent: ['电容电压U（V）与有符号电流I', '同一分段的电压差衰减时间常量τ（s）', '指定极板电荷Q与电容储能'],
      controlled: ['同一轮R、C、电源电压E保持不变', '每轮从零电压开始，后续段初电压由完整切换过程决定', '同一段内比较不同历时，改变数值参数须重新开始'],
    },
    evidence: ['完整开关过程、切换时刻、当时R/C/E、仿真时刻及U/I模型读数', '同一运行、同一充放电分段至少3个不同时刻的ln(|U−U∞|/1V)—段内时间图，斜率估计−1/τ，截距不强制为0', '断路前后U可非零而I为0的对照，以及电容储能与电阻耗散的区别'],
    sourceUrls: sources(highSchoolCurriculumSources.required3), requirementLevel: 'curriculum',
    assumptions: ['理想恒定RC电路与理想电表，不计漏电、寄生参数、击穿和实体安装误差', '每轮初始电压为0；普通模式切换保持电压连续，电流可跃变，暂停仿真不等于断路', '开路或段初已平衡时不能估计时间常量；不同运行或切换分段不混合拟合', '20RC是观察窗口而非恰好充满或放空；63.2%E仅适用于零初值充电', '电源提供的能量不全存入电容；指定极板电荷不是整个电容器的净电荷', '读数与拟合来自理想模型，不是实体实测；当前没有独立手动电表读数工具，不以记录条数判定学习完成'],
    verificationNote: '关联已核验的2020修订版实验清单。2026-11-11读取国家平台人教版必修第三册第10.4节可检索正文及印刷38—40页：含充放电观察，I—t面积估计电荷量属于拓展学习；截图、版权页印次及2025课标全文差异未核定。',
  },
  {
    id: 'precision-length', name: '游标卡尺与螺旋测微器', volume: 'required-3',
    chapter: '第十一章 电路及其应用 · 第3节长度测量', domain: 'electricity', status: 'ready',
    learningGoal: '比较游标与螺旋分度模型的示值、零偏和修正值，区分量化分辨率与真实测量精度。',
    variables: { independent: ['工具类型', '被测长度设定', '零点偏差', '接触模式与扣零点选择'], dependent: ['示值', '修正长度', '量化偏差'], controlled: ['比较工具时固定长度与零偏', '比较零偏时固定工具与长度'] },
    evidence: ['工具、分度、长度设定、接触状态与示值快照', '示值减量化零点读数的修正记录', '主尺和细分刻度贡献及单位说明'], sourceUrls: sources(highSchoolCurriculumSources.required3),
    requirementLevel: 'curriculum', assumptions: ['长度技能关联电阻率实验准备，不只属于电学', '自动读数由参数与量化规则生成，不是学生独立读尺或实体实测；未接触与合拢零点不能当作物体长度', '不模拟真实装夹、接触力、棘轮与多位置测量，分辨率不等于精度'],
    verificationNote: '本轮读取人教必修第三册11.3印刷62页起的工具内容与64页螺旋分度说明；未核PDF文件页序和学校印次。',
  },
  {
    id: 'resistivity', name: '金属丝电阻率', volume: 'required-3',
    chapter: '第十一章 电路及其应用 · 第3节', domain: 'electricity', status: 'ready',
    learningGoal: '固定材料与几何采集U、I模型读数，用电阻、有效长度和直径推算电阻率并比较控制变量关系。',
    variables: { independent: ['外加电压', '分组对照中的长度或直径'], dependent: ['电流', '电阻', '电阻率估计值'], controlled: ['同一U—I组材料、长度、直径不变', '恒定温度的欧姆模型'] },
    evidence: ['保存当时材料、长度、直径、U和I', 'U—I与几何关系的分组比较', 'ρ=Rπd²/(4L)及mm到m换算'], sourceUrls: sources(highSchoolCurriculumSources.required3),
    requirementLevel: 'curriculum', assumptions: ['均匀导线和理想电表，不模拟温升、接触电阻与电表内阻', '长度和直径是模型设定，自动读数不是独立手动测径或实体实测', 'U=I=0时单点U/I无定义，不能据此说电阻为零'],
  },
  {
    id: 'multimeter', name: '多用电表的选择与读数', volume: 'required-3',
    chapter: '第十一章 电路及其应用 · 多用电表', domain: 'electricity', status: 'ready',
    learningGoal: '根据待测量选择功能、量程和接法，解释有效读数、超量程及带电测阻等无效状态。',
    variables: { independent: ['功能挡', '量程', '表笔接法'], dependent: ['读数', '测量有效性'], controlled: ['待测元件', '仪表条件'] },
    evidence: ['功能、量程、接法与电源状态快照', '读数单位及有效性原因', '正确设置与错误设置的对照'], sourceUrls: sources(highSchoolCurriculumSources.required3),
    requirementLevel: 'curriculum', assumptions: ['电压并联、电流串联、电阻测量前隔离外部电源', '无效数值不是实际被测量为零，不纳入定量拟合', '数字读数模型不代表已完成真实指针表欧姆调零、倍率刻度或实体安全训练', '自动模型读数不是实体实测'],
    verificationNote: '本轮读取人教必修第三册11.5印刷72—74页；当前模型任务与教材完整仪器操作要求区分，未核PDF文件页序与学校印次。',
  },
  {
    id: 'momentum-conservation', name: '一维碰撞与动量', volume: 'elective-1',
    chapter: '第一章 动量守恒定律 · 实验', domain: 'mechanics', status: 'ready',
    learningGoal: '比较系统碰撞前后的总动量，并区分动量守恒和动能守恒。',
    variables: { independent: ['两物体质量', '初速度', '碰撞类型'], dependent: ['末速度', '总动量', '动能'], controlled: ['系统边界', '外力冲量条件'] },
    evidence: ['两物体质量、碰撞前后带符号速度和碰撞状态', '系统总动量的有符号差值与动能变化', '初始总动量为零时不用其作相对误差分母'], sourceUrls: sources(highSchoolCurriculumSources.elective1),
    requirementLevel: 'curriculum', assumptions: ['一维理想碰撞、系统外力冲量忽略，不模拟真实形变过程', '恢复系数改变动能保持程度，非弹性不等于动量不守恒', '未相遇的物体不能当作已经碰撞；自动模型读数不是实体实测'],
    verificationNote: '本轮读取选择性必修一1.4印刷17—18页的系统选择、质量与前后速度证据要求；未核PDF文件页序和学校印次。',
  },
  {
    id: 'refractive-index', name: '玻璃折射率测量', volume: 'elective-1',
    chapter: '第四章 光 · 光的折射', domain: 'optics', status: 'ready',
    learningGoal: '从保存的单界面入射角与折射角模型读数估计折射率比，并区分正入射、临界掠射与全反射。',
    variables: { independent: ['入射角'], dependent: ['折射角'], controlled: ['同一材料', '单色光', '界面法线'] },
    evidence: ['两侧折射率、入射角、有效折射角与法线', 'sin i—sin r图像及斜率n₂/n₁', '正入射0/0与全反射无传播折射光的排除说明'], sourceUrls: sources(highSchoolCurriculumSources.elective1),
    requirementLevel: 'curriculum', assumptions: ['均匀透明介质的单界面几何光学，角度相对法线', '不模拟真实玻璃砖插针或独立手动测角；自动模型读数不是实体实测', '高折射率到低折射率才有临界角，临界掠射不等于超过临界角'],
    verificationNote: '本轮官方教材文本确认选择性必修一4.1印刷85页起、4.2印刷90页起；未核PDF文件页序和学校印次。',
  },
  {
    id: 'induced-current', name: '感应电流方向', volume: 'elective-2',
    chapter: '第二章 电磁感应 · 楞次定律', domain: 'magnetism', status: 'ready',
    learningGoal: '比较恒定匀强磁场中旋转线圈的磁通及其变化率与感应电动势、电流的符号，解释楞次定律反抗磁通变化。',
    variables: { independent: ['观测时刻', '分组变化的磁场幅值、转动频率或初相位'], dependent: ['磁通', '感应电动势', '闭路电流'], controlled: ['同组线圈面积、匝数和电阻', '统一正法向与回路正方向'] },
    evidence: ['完整条件及磁通、变化率、感应电动势、电流的时间记录', '磁通极值与过零时刻的符号对照'], sourceUrls: sources(),
    requirementLevel: 'curriculum', assumptions: ['恒定匀强磁场中旋转线圈的正弦磁通，闭路仅含纯电阻，忽略自感和机械反作用；开路电流为0但电动势可非零', '不是实体磁铁插拔或电表接线过程；自动模型读数不是实体实测', '方向必须结合约定参考方向；磁通不为零时电动势仍可能为零'],
    verificationNote: '课标对应已核；选择性必修第二册具体节号与学校用书版次待复核。',
  },
  {
    id: 'transformer-ratio', name: '变压器电压与匝数', volume: 'elective-2',
    chapter: '第三章 交变电流 · 变压器', domain: 'magnetism', status: 'ready',
    learningGoal: '改变匝数比较交流电压有效值比，并用负载电流和功率解释理想变压器升压不增功率。',
    variables: { independent: ['原线圈匝数', '副线圈匝数'], dependent: ['原副线圈电压比'], controlled: ['交流输入', '频率', '铁芯耦合条件'] },
    evidence: ['匝数、负载与两侧交流有效值表', '电压比与匝数比比较', '瞬时值、峰值、有效值及理想功率说明'], sourceUrls: sources(),
    requirementLevel: 'curriculum', assumptions: ['理想无损耦合，不模拟铁损、漏磁、饱和或直流暂态', '恒定直流不能按该关系持续变压', '自动模型读数不是实体实测；理想效率不代表真实效率'],
    verificationNote: '课标对应已核；选择性必修第二册具体节号与学校用书版次待复核。',
  },
  {
    id: 'sensor-control', name: '传感器自动控制', volume: 'elective-2',
    chapter: '第五章 传感器 · 自动控制实验', domain: 'electricity', status: 'ready',
    learningGoal: '比较一阶线性温度传感器的响应与带滞回阈值开关，说明执行器状态和初始条件的关系。',
    variables: { independent: ['环境温度', '响应时间常量', '设定阈值与滞回宽度'], dependent: ['传感器温度与输出电压', '执行器状态'], controlled: ['每轮初始温度与开关初态', '同组未研究的响应或阈值条件'] },
    evidence: ['初始与环境条件、仿真时间、响应温度和电压', '上下阈值附近动作及历史依赖说明', '输入—响应—阈值—执行器的控制链'], sourceUrls: sources(),
    requirementLevel: 'curriculum', assumptions: ['一阶线性温度传感器教学模型，不是真实NTC热敏电阻', '执行器状态不代表已经模拟其对环境的闭环反馈', '不模拟器件精度、噪声或接线误差；自动模型读数不是实体实测'],
    verificationNote: '课标对应已核；选择性必修第二册具体节号与学校用书版次待复核。',
  },
  {
    id: 'oil-film', name: '油膜估测分子尺度', volume: 'elective-3',
    chapter: '第一章 分子动理论 · 分子大小估测', domain: 'thermal', status: 'ready',
    learningGoal: '用溶液体积、滴数、纯油比例与面积设定估算分子尺度，解释换算和单层近似。',
    variables: { independent: ['溶液体积与滴数', '纯油体积分数', '油膜面积'], dependent: ['单滴纯油体积', '厚度尺度估计值'], controlled: ['每次仅改变一个输入', '单层紧密排列假设'] },
    evidence: ['原始体积、滴数、纯油比例和面积设定', 'd=V纯油/S的单位换算与数量级', '输入偏差及单层假设说明'], sourceUrls: sources(highSchoolCurriculumSources.elective3),
    requirementLevel: 'curriculum', assumptions: ['单分子层和紧密排列的简化估算，不是分子直接成像', '面积与体积为模型输入，不模拟真实铺展、蒸发或独立手动数格', '自动模型读数不是实体实测'],
    verificationNote: '本轮读取选择性必修三1.2印刷7—8页的方法文本；PDF文件页序、学校版权页印次及2025全文差异未核。',
  },
  {
    id: 'gas-pressure-volume', name: '等温气体压强与体积', volume: 'elective-3',
    chapter: '第二章 气体、固体和液体 · 气体的等温变化', domain: 'thermal', status: 'ready',
    learningGoal: '固定气体量与温度，比较不同体积的平衡态绝对压强模型读数，检验p—1/V和pV关系。',
    variables: { independent: ['气体体积'], dependent: ['绝对压强'], controlled: ['气体质量', '温度', '密封条件'] },
    evidence: ['同组气体量、温度、体积和绝对压强', 'p—1/V图像与pV比较', 'K、Pa和体积单位换算'], sourceUrls: sources(highSchoolCurriculumSources.elective3),
    requirementLevel: 'curriculum', assumptions: ['理想气体平衡态，不以表压代替绝对压强', '同组直接规定温度不变，不模拟缓慢压缩热交换、活塞摩擦或漏气', '自动模型读数不是实体实测'],
    verificationNote: '本轮读取选择性必修三2.2印刷23页起的等温实验文本；未核PDF文件页序与学校印次。',
  },
  {
    id: 'free-fall', name: '自由落体的模型与测量', volume: 'required-1',
    chapter: '第二章 匀变速直线运动的研究 · 自由落体运动', domain: 'mechanics', status: 'ready',
    learningGoal: '比较从静止释放的落地前距离—时间平方关系，并由不同高度的落地时间解释恒g无阻力模型。',
    variables: { independent: ['仿真时刻', '另组对照中的释放高度或质量'], dependent: ['下落距离', '下落时间', '末速度与能量'], controlled: ['同轨迹固定释放高度、质量与重力加速度', '初速度为零，无阻力'] },
    evidence: ['固定完整条件的下落距离s—t²关系', '斜率g/2与重力加速度估计', '质量改变能量而不改变本模型轨迹的对照'], sourceUrls: sources(highSchoolCurriculumSources.required1),
    requirementLevel: 'textbook', assumptions: ['近地面恒g、零初速度和无阻力模型，没有空气阻力对照', '终点表示撞地前一瞬，不模拟撞地反弹；质量只影响能量，不影响运动轨迹', '自动模型读数不是实体实测，落地后的重复位置不是新自由落体样本'],
  },
  {
    id: 'photoelectric-effect', name: '光电效应的频率阈值', volume: 'elective-3',
    chapter: '第四章 原子结构和波粒二象性 · 光电效应', domain: 'modern', status: 'ready',
    learningGoal: '区分光频率与光强的作用，解释截止电压和逸出功的关系。',
    variables: { independent: ['光频率', '光强', '金属材料'], dependent: ['截止电压', '光电流'], controlled: ['同组金属表面', '收集电极条件'] },
    evidence: ['频率、逸出功、光强、收集电压与阈值状态', '有效发射范围内频率—截止电压模型比较', '光强和收集电压各自变化的电流对照'], sourceUrls: sources(highSchoolCurriculumSources.elective3),
    requirementLevel: 'textbook', assumptions: ['单光子光电效应；hν−W表示最大动能，不是所有电子的动能', '低于阈值时增强光强不能补足单光子能量', '均匀电子能量分布的收集电流是教学假设，不是材料实测I—U', '不模拟接触电势、表面变化与真实量子效率；自动模型读数不是实体实测'],
    verificationNote: '教材概念探究，不列作2020基线学生必做；本轮读取选择性必修三4.2印刷71页起文本，未核PDF文件页序与学校印次。',
  },
  {
    id: 'charged-particle-field', name: '带电粒子轨迹设计', volume: 'elective-2',
    chapter: '第一章 安培力与洛伦兹力 · 带电粒子在磁场中的运动', domain: 'magnetism', status: 'ready',
    learningGoal: '用电荷、速度与磁场方向设计粒子轨迹，比较定量预测与模拟结果。',
    variables: { independent: ['电荷质量比', '入射速度', '磁感应强度'], dependent: ['轨迹半径', '转向', '周期'], controlled: ['同组固定电荷质量比、磁场与平面内初速度方向', '速度始终垂直磁场'] },
    evidence: ['完整电荷质量比、速度、磁场与模型半径/周期', '方向预测与观察对照', '零磁场或零电荷质量比时圆轨道不适用的说明'], sourceUrls: sources(),
    requirementLevel: 'extension', assumptions: ['忽略重力及辐射损失，非相对论匀强磁场', '平面垂直入射模型，不模拟电场加速或三维螺旋轨迹', '洛伦兹力不做功；零磁场或零电荷质量比时为直线，没有圆轨道半径和周期', '自动模型读数不是独立手动测径或实体实测'],
  },
];

export function getHighSchoolExperiment(id: string): HighSchoolExperiment | undefined {
  return highSchoolExperiments.find((experiment) => experiment.id === id);
}
