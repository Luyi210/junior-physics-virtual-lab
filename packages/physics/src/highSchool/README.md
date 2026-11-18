# 高中实验纯计算层

浏览器与 Node 24 都可以从 `@physics-lab/physics/high-school` 导入。
不依赖 React，不读取网络、时钟或存储。动画时间必须由调用方传入。

```ts
import {
  HIGH_SCHOOL_EXPERIMENTS,
  defaultHighSchoolParameters,
  simulateHighSchoolExperiment
} from "@physics-lab/physics/high-school";

const parameters = defaultHighSchoolParameters("newton-second-law");
const simulation = simulateHighSchoolExperiment("newton-second-law", parameters, 0.5);
// 默认条件：M=0.5 kg、m=0.05 kg、阻力0.05 N；a=0.8 m/s²、T=0.45 N。
```

`catalog.ts` 给出参数名称、单位、范围、步进、默认值与物理假设。
缺失参数使用默认值；显式传入的非法类型、非有限值、越界值和未知参数会抛出 `RangeError`。
一般实验把有限时间限制在当前有效时段内；电容分段模型则严格拒绝窗口外时间，以免改变已保存过程的含义。电源、双缝、静态弹簧与共点力矢量板的 `durationSeconds` 为 0。
`state` 向场景提供物理状态，`metrics` 提供带单位的读数，`series` 提供含坐标轴单位的采样数据。
每条曲线的 `xKey` 和 `key` 对应 `state` 中相同单位的当前横、纵坐标，可直接用于精确当前读数标记，无需取最近采样点。
一般实验曲线按参数缓存；电容曲线另按调用所给完整历史重放，只画已经发生的过程。调用方应把返回的曲线、公式和提示视为只读数据。

## 计算边界

- 匀变速：初位置为零，速度有方向，位移不等于总路程。
- 牛顿第二定律：小车与挂码一起加速，因此分母为总质量；绳张力不能直接替换为挂码重力。静摩擦采用与动摩擦同阈值的简化模型，未超过阈值不启动。到达行程终点只呈现碰撞前状态。
- 弹簧：理想轻弹簧静态平衡，忽略弹簧自重；`loadMassGrams` 是包含托盘/挂钩的悬挂总质量，先从克换算为千克，固定 `g=9.8 m/s²`。`force` 表示弹力大小，静态时等于总重力；`extension = force/stiffness`，`length = naturalLength + extension`。0 g 表示未挂载荷，没有隐含托盘质量，也不保留卸载后的形变。模型预设伸长量 0–0.25 m 为线性范围，纯计算函数拒绝向范围外外推；工作台的 10–50 N/m、0–250 g 所有组合最多伸长 0.245 m。该范围是教学假设，不是真实弹性限度测定；不模拟振荡、自重、噪声、非线性或永久形变。
- 共点力：同一作用点的二维静态矢量合成，+x 轴起逆时针角为正；不模拟物体运动、测力计读数或橡皮筋形变。试配力独立于两个分力，模型只报告它与合力的矢量差，不自动替学生填等效力。
- 抛体：忽略空气阻力，使用统一的 `g=9.8 m/s²`，只计算第一次落地前的轨迹，保留碰撞前末速度。
- 单摆：摆角不超过75°，轻绳始终绷紧，质点摆球无阻尼。位置使用四阶 Runge–Kutta 对非线性方程求解；周期使用256区间复合 Simpson 求积。对周期积分作 `sin(θ/2)=sin(θ₀/2)sin u` 换元，避免转折点积分奇性。小角周期只作为对照，动画不套用大角度失效的余弦公式。观察窗固定60秒，这是显示设置，与理论周期和用户所数周期无关；曲线每周期48点，复用单周期RK4采样后按周期平移，当前参数范围最多约2700点，当前时刻仍由非线性方程求解。
- 电源：稳恒直流、理想电表、固定内阻，区分电动势、端电压和内阻压降；检查电源功率等于负载功率与内耗功率之和。负载曲线采用低阻区加密的几何采样，并包含当前负载与范围内的最大功率点 `R=r`；零内阻不添加无穷电流的零负载点。
- 双缝：两相干点源同相、等振幅，忽略有限缝宽包络。使用两条几何距离的光程差，并通过平方差有理化减少浮点相消。`λL/d` 仅是近轴条纹间距，未用它替代实际光强计算。

## 静态弹簧接口与证据

`calculateSpringForce({ stiffness, naturalLength, loadMassGrams })` 独立于界面，输出 `time: 0`、`force`（N）、`extension`/`length`/`naturalLength`（m）、`stiffness`（N/m）与 `loadMassKg`（kg）。统一模拟入口注册为 `spring-force`；默认 20 N/m、原长 0.15 m、总载荷 100 g，得到 0.98 N、伸长 0.049 m、总长 0.199 m。曲线横轴为伸长量、纵轴为弹力大小，展示同一弹簧在允许载荷范围内的理想工作点，包含当前精确工作点。

保存时同时保留 `force`、`extension`、`length`、`naturalLength` 及完整参数。`force-extension` 分析按劲度系数和原长分组，只改变载荷，至少三个不同伸长量才拟合；横轴取已保存的伸长量，不能拿总长代替或用当前模型补值。保存的原长、总长、伸长量须相互一致且单位明确，静态记录时刻为 0。拟合保留截距，斜率估计劲度系数，截距供核对零点；不会用参数中的劲度系数或 `mg` 重写保存的图点。它仍是模型采样的一致性分析，不是学生独立读尺或真实测量精度的证据。

## 共点力矢量板接口与证据

`calculateForceComposition({ force1N, angle1Degrees, force2N, angle2Degrees, trialForceN, trialAngleDegrees })` 输出静态 `time: 0`。两个分力各为 0–5 N，试配等效力为 0–10 N，三个输入方向角为 −180°–180°。默认 3 N@0°、4 N@90°，合力为 `(3,4)` N、大小 5 N、方向约 53.13°；默认试配力保持 5 N@0°，不会自动改为合力方向。

状态包括分力、合力、试配力的 x/y 分量，合力大小、方向与 `resultantSquared`，两分力夹角与 `angleBetweenCosine`。`residualX/Y` 定义为 **试配力减合力**，其模为 `residualMagnitude`；等效力与合力同向，平衡力则反向。模型不给试配成功次数或掌握程度评分，也不把矢量差叫作实体测量误差。

合力方向规范为 `[−180°,180°)`。零合力的 `resultantDirectionDefined` 为 0；任一分力为零时，`angleBetweenDefined` 为 0。对应角度及夹角余弦的数值 0 仅是占位，界面必须检查标志；`metrics` 省略无定义的角，零分力时不生成夹角曲线。等大反向时只消除相对力尺度 `64×Number.EPSILON` 内的舍入残差，这不是测量分辨率或试配成功阈值；微小但可分辨的非零力仍保留方向。

`resultant-squared-cosine` 分析按两个非零分力大小分组；整体旋转和试配力变化不影响这条关系。图点使用保存的合力大小平方及保存夹角的余弦，检查完整参数、静态时刻、N/° 单位和夹角与方向快照的一致性，不重算或修补历史合力。至少 3 个不同 `cosθ` 才作自由截距拟合；斜率 `forceProductCoefficient` 对照 `2F₁F₂`，截距 `forceSquaresIntercept` 对照 `F₁²+F₂²`，两者单位均为 N²。两分力抵消的零合力可以参与分析；零分力使夹角无定义，不能参与。这里的合力平方 R² 不同于统计拟合优度 R²；此分析是理想模型一致性核对，不是独立器材实验。

## 电容器的完整分段过程

`capacitor-charge` 使用 `resistanceKOhm`（1–10 kΩ，默认10）、`capacitanceMicrofarads`（100–1000 μF，默认470）、`emf`（1–12 V，默认6）。内部统一为 Ω/F/V，`τ=RC`；`capacitorDurationSeconds(parameters)` 返回 `20τ`（2–200 s），仅为有限观察窗口，既不是放空/充满判定，也不是5τ后的硬截断。参数在一轮中固定；改变参数由调用方从零电压新建一轮。

统一模拟入口增加第4参数：`simulateHighSchoolExperiment(id, parameters, timeSeconds, capacitorHistory?)`。电容实验必须给历史，缺失时拒绝，不能默认补成“从零充电”；其他实验拒收此字段。`CapacitorHistory` 由共享 contracts 定义并从 physics 导出：

```ts
type CapacitorMode = "charge" | "discharge" | "open";
type CapacitorHistory = {
  kind: "capacitor-rc-v1";
  runId: string;
  initialVoltage: 0;
  segments: { startTimeSeconds: number; mode: CapacitorMode }[];
};
```

`createCapacitorHistory(runId, mode="charge")` 创建首段。`switchCapacitorMode(parameters, history, timeSeconds, nextMode)` 返回新的完整副本：同模式不新增段，同一时刻更改零时长末段，必要时与前一同模式段合并。保存的历史必须从0 s开始、时刻严格递增、模式相邻不同，不含未来切换或额外字段，最多32段。达到上限拒绝新增，不截断旧段。`validateCapacitorHistory(value, timeSeconds, durationSeconds)` 返回严格验证后的独立副本；轮次编号限1–100个安全字符。每条保存记录和力力样本都单独保留 `capacitorHistory`，不能以当前轮次的历史代替。

`calculateCapacitorState(parameters, history, timeSeconds)` 从完整历史重算各段U₀，不接受客户端声称的段初电压。接电源段 `U=E+(U₀−E)e^(−Δt/RC)`，经R放电段 `U=U₀e^(−Δt/RC)`，断路段U保持；I统一以流入标记极板为正，放电时为负。U、Q和储能跨开关连续，I可跳变。Q=CU是标记极板电荷，另一极板−Q，整体净电荷为零；不表示电荷穿过介质。

数值状态包括 `time/voltage/current/charge/storedEnergy/resistorPower/timeConstant/segmentStartTime/segmentElapsedTime/segmentInitialVoltage/sourceWork/dissipatedEnergy`，使用SI单位。`simulation.capacitor={mode,segmentIndex}` 单独传递离散状态。每段解析积分电阻热与电源功，累计满足 `sourceWork = storedEnergy + dissipatedEnergy`（初始储能0）；零初值完全充电的极限为电源CE²、储能½CE²、热½CE²。使用 `expm1` 保持很短历时的数值分辨，电流由指数差值直接求得。四条U/I/Q/储能曲线只绘制0到当前时刻，每段至少每τ 24个间隔，在切换点保留电流左右极限，不用缓慢斜线替代跳变，也不预测未来开关操作。

`capacitor-log-voltage-time` 分析按相同完整R/C/E、runId以及当前段的全部历史前缀分组。横轴是段内时间，纵轴为 `ln(|保存U−U∞|/1 V)`；接电源U∞=E，经R放电U∞=0。至少三个不同时刻才自由截距拟合，斜率须负，估计 `timeConstant=-1/slope`（s）、`decayRate=slope`（s⁻¹）和 `logVoltageIntercept`（无量纲）。断路或零电压差组明确不支持拟合。缺单位、缺历史、未来切换、非有限或超出0–E的电压均不补造；实际图点使用保存电压，不由模型回填。接近平衡时相减和读数舍入会放大相对误差。此分析检验模型一致性，不是独立实测；首版没有手动电表读数或学生自行求图像面积的记录。

`capacitor.test.ts` 覆盖τ比例、5τ/20τ尾部、开关连续与电流跳变、断路保持、能量账目、角点与微小时刻、完整历史校验/32段限制、同刻切换和保存读数分组。原始物理说明见 [OpenStax RC Circuits](https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits) 与 [Energy Stored in a Capacitor](https://openstax.org/books/university-physics-volume-2/pages/8-3-energy-stored-in-a-capacitor)；本层独立实现解析公式，教材操作范围与证据限制见项目 `docs/high-school/CAPACITOR_CHARGE_RESEARCH.md`。

## 虚拟手动读数

`manualMeasurements.ts` 独立计算用户操作所得读数，不把理论周期或条纹间距填入操作结果。
单摆使用开始/停止的虚拟时钟读数与用户填写的完整周期数，先把起止读数量化为0.01秒，再求周期；0.01秒是显示分辨率，前端实验时钟仍按1/60秒步进，不能称作实体秒表精度。
只有摆角不超过10°时输出小角近似的 `g`。双缝使用用户选择的两个屏坐标（0.1毫米显示分辨率）和相邻间隔数，得到近轴波长估计，不读取已知波长。
两类结果均标记 `provenance: "virtual-manual"`，保留量化后的输入读数、计算值、单位与适用条件；这些结果均不是真实器材实测。

## 物理依据

以下为教材作者/大学原始教学资料，本层实现为自行编写的数值计算，并未复制第三方程序：

- [OpenStax：恒定加速度运动](https://openstax.org/books/university-physics-volume-1/pages/3-4-motion-with-constant-acceleration)：位移、速度和加速度的关系。
- [UCSB：水平阿特伍德机](https://web.physics.ucsb.edu/~lecturedemonstrations/Composer/Pages/12.36.html)：小车与挂码的两条受力方程和系统质量。
- [OpenStax：胡克定律与竖直弹簧](https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion)：弹簧恢复力及竖直静态平衡关系。本平台仅取静态平衡部分，不把该节振动模型作为本实验动画。
- [OpenStax：矢量代数](https://openstax.org/books/university-physics-volume-1/pages/2-3-algebra-of-vectors)：分量相加、矢量相等和零矢量无方向；用于共点力矢量板的计算边界。
- [OpenStax：抛体运动](https://openstax.org/books/university-physics-volume-1/pages/4-3-projectile-motion)：水平、竖直分运动与忽略空气阻力的适用条件。
- [OpenStax：单摆](https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums)：非线性摆方程与小角近似条件。
- [OpenStax：电动势](https://openstax.org/books/university-physics-volume-2/pages/10-1-electromotive-force)：电源内阻与端电压。
- [OpenStax：干涉数学](https://openstax.org/books/university-physics-volume-3/pages/3-2-mathematics-of-interference)：光程差、干涉级次与近轴近似。

`highSchool.test.ts` 检验已知数值、几何边界、能量守恒、独立参数控制以及无效输入；单摆另以60°时椭圆积分周期倍率 `1.0731820071493644` 为参考。
`springForce.test.ts` 单独覆盖克/千克换算、原长与伸长、卸载归零、控制变量、允许参数角点、预设线性范围、静态接口、自由截距拟合及保存证据校验。
`forceComposition.test.ts` 覆盖正交、反平行、抵消、旋转不变、负方向规范化、零分力和小非零力、试配力独立性、平方关系边界、记录分组及已保存读数溯源。

## 机械能与虚拟纸带

`mechanical-energy` 的参数为质量 `mass`（0.05–1 kg）、释放高度 `dropHeight`（0.5–2 m）、恒定向上阻力与重力之比 `resistanceRatio`（0–0.4）。默认 0.2 kg、1.2 m、无阻力。`calculateMechanicalEnergy(parameters, timeSeconds)` 假设释放和计时同步、初速度为零，向下位移为正：`a=g(1−r)`、`y=at²/2`、`v=at`，固定 `g=9.8 m/s²`。向上阻力 `f=rmg` 是恒力教学模型，不是真实空气阻力定律；终点表示第一次落地前一瞬，保留碰撞前速度，不模拟撞击或反弹。

状态同时给出 `position`、剩余 `height`、`velocity`、`kineticEnergy`、`potentialEnergy`、`potentialEnergyLoss`、`dissipatedEnergy` 与 `totalMechanicalEnergy`。总账为 `K+U+E耗散=mgH`；r=0 时机械能守恒，r>0 时 `E耗散=f·y`。动画和连续曲线是模型输出，不能用来冒充独立测量。

`mechanicalEnergyTapePoints(parameters, timeSeconds?)` 提供 `{ index, timeSeconds, positionMm }[]`。计时间隔由导出常量 `MECHANICAL_ENERGY_SAMPLE_INTERVAL_SECONDS=0.02` 固定，不是可调参数；只生成已经出现且不晚于落地时刻的整数等时点 `n×0.02`，不把非网格落地帧补成纸带末点。未给时间时返回全部有效点；当前时间仍由调用方传入。

`calculateMechanicalEnergyTapeMeasurement(input)` 独立处理 `mechanical-energy-tape` 手动虚拟读数。`MECHANICAL_ENERGY_TAPE_READING_KEYS` 列出完整 11 个字段：三个条件、内部整数点号 `indexA/indexB`，以及 `aBeforeMm/aCenterMm/aAfterMm/bBeforeMm/bCenterMm/bAfterMm` 六个独立坐标。B>A；相邻 A/B 或只隔一个点均允许，但两组三点引用同一计时点时，保存的原始位置必须一致。按点号排序后的不同位置须严格递增，全部在本轮下落范围内。

读数先按 0.1 mm 显示分辨率量化，再转为 m；这是虚拟显示分辨率，不是真实仪器精度。最终上边界也使用相同量化规则，避免几何高度 687.568 mm 显示为 687.6 mm 后被误拒绝。派生值仅使用六个读数、质量、固定计时间隔及 g：`vA=(yA+1−yA−1)/(2Δt)`，B 同理；`ΔK=½m(vB²−vA²)`、`ΔEp=mg(yB−yA)`、`difference=ΔEp−ΔK`。中央差分在本匀变速模型中精确对应中心瞬时速度，不能泛化为任意运动。A 点不是释放点，真实纸带首个可辨点也未必是释放瞬间，不能把 B 点动能直接当成增加量。

`validateMechanicalEnergyTapeObservation(parameters, readings, timeSeconds)` 检查完整参数与读数条件一致、已量化原值不被改写、时间在有效窗口，且 B+1 点已经出现。模型仅用于有效点号和时间范围校验，不用模型位置、`gt` 或 `√(2gh)` 替换学生读数、反推速度或循环证明守恒。读数算出的负能量增加或 ΔK>ΔEp 保留原算术值并提示复核，不自动修正或判分。结果为 `provenance: "virtual-manual"`，与自动采样分开。

自动分析 `kinetic-gain-potential-loss` 按完整质量/高度/阻力比隔离，使用保存的 `potentialEnergyLoss`（横轴 J）与 `kineticEnergy`（纵轴 J）；因模型从静止释放，后者才等于从释放点起的 ΔK。至少三个不同横坐标才自由截距拟合，斜率 `kineticGainFraction` 对照 `1−r`，截距 `energyIntercept` 单位 J。缺失或单位错误的记录不由当前模型补造；手动 A/B 的区间能量不混进该拟合。它仅检验模型采样一致性，不表示独立测量精度或学习掌握程度。

`mechanicalEnergy.test.ts` 覆盖参数角点能量总账、质量独立性、碰前终点、严格等时点、六位置算术、共享点、量化边界、已出现点、自动控制条件隔离和保存值溯源。纸带中央差分方法与人教版《普通高中教科书·物理·必修第二册》8.5（印刷页 95–98，尤其第 97 页等时两侧平均速度）一致；模型的同步释放和恒定阻力为明确的教学假设，不能替代实物实验操作。


## 阶段24：其余14项理想模型

参数及状态的逐项合同见 `docs/high-school/EXPANSION_MODEL_CONTRACT.md`（仓库根目录）。新增实现由 `expansionCatalog.ts`、`expandedModels.ts`、`expandedSimulation.ts` 分别负责参数/适用条件、纯计算、曲线与指标；统一入口仍为 `simulateHighSchoolExperiment`。原10项与电容器完整分段历史不改变。

- 圆周、自由落体、碰撞：真实时间推进。碰撞仅在两质点实际相遇后改变速度，未相遇/观察窗外不得产生“碰后”数据。自由落体终点是碰撞前状态。零角速度没有周期。
- 精密长度与多用电表：离散仪器/接触/接法、供电、量程选择。量化和零误差分别建模；无效示数使用有限占位并配 `readingValid=0`，消费者必须读取标识。零点检查有效也不等于物体读数。
- 电阻率、油膜与气体：显式SI转换、体积分数/整数滴数、绝压与Kelvin；电阻率模型固定温度，气体设置表示平衡态。
- 折射：临界角与全反射区分，正入射不能从0/0推折射率，透射方向无定义有独立标识。
- 感应：外驱旋转线圈的每匝磁通及解析导数，`fluxRate` 保存为独立模型指标；开路电动势可以非零，但电流为零。变压器使用AC有效值，DC为不适用，不伪造直流升压。
- 传感器：自定线性温度输出、一阶阶跃响应及上下阈值滞回，非NTC或商业器件拟真。输入单调，初态可重放；改变参数开始新轮。
- 光电：最大初动能与遏止电压由频率和逸出功决定，光强只改变电流。I–V示意另假设均匀初动能分布、10%量子效率，不能推广为实际光电管普遍曲线。
- 磁场粒子：有符号荷质比，轨迹/速度/洛伦兹加速度来自同一解析解；采用sinc形式保证趋近零磁场时的直线极限，不输出无限半径/周期。

参数的 `choices` 与 `integral` 用于严格验证枚举和整数计数，普通连续参数的 `step` 仍仅作为控件步长。每条曲线的 `xKey/key` 都在当前state有有限对应值。以上自动曲线和读数始终是模型采样，不能作为实体测量或未实施的手动操作证据。
