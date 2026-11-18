# 高中其余十四项实验：教学与模型依据

核对日期：2026-11-11（Asia/Shanghai）。本文件记录本轮教学范围、主源依据及实现约束。研究和本地模型对照不代表完成真实器材测量；目录状态及发布验收由集成结果决定，不由本文件自动开放。

## 来源层级

课标关联继续使用已核验的[2017年版2020年修订课标](https://www.pep.com.cn/xw/zt/rjwy/gzkb2020/202205/P020220517520664858048.pdf)基线。2025日常修订版全文差异仍未完成核对，本轮没有重复请求此前失败的路径。

本轮读取国家平台官方PDF可检索文本，以下均为正文标注的**印刷页**，没有核定PDF文件页序、页面截图、版权页印次或学校具体用书。直接请求一度失败的文件，经官方域名搜索结果取得文本；不把搜索摘要单独当作完整正文。

| 官方教材 | 本轮核到的位置与事实 |
| --- | --- |
| [人教必修第二册](https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/55baa3cc-156f-4358-8e28-bfa21a864450.pkg/pdf.pdf) | 6.2印刷27—30页；演示器控制变量与受力比在28—29页。详细边界见[向心力研究](CENTRIPETAL_FORCE_RESEARCH.md)。 |
| [人教必修第三册](https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/dcd8cc6b-5380-4008-a2d0-a061f24d34dd.pkg/pdf.pdf) | 11.3印刷62页起含长度工具；64页含螺旋刻度，随后衔接电阻率。11.5印刷72—74页含多用表功能、量程、接法及读数。 |
| [人教选择性必修第一册](https://r1-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/346c3c04-1663-472c-849e-ff876dcf293f.pkg/pdf.pdf) | 1.4印刷17—18页要求确定碰撞系统并记录质量及前后速度；4.1从85页开始，4.2全反射从90页开始。 |
| [人教选择性必修第三册](https://r2-ndr.ykt.cbern.com.cn/edu_product/esp/assets_document/2109c25c-2e52-4da3-8ab3-18cbe632ec11.pkg/pdf.pdf) | 1.2印刷7—8页讲油膜尺度估测；2.2印刷23页起讲封闭气体等温对照；4.2印刷71页起讲光电效应。 |

选择性必修第二册本轮未取得足以逐页核验的官方教材正文，保留原有章级关联，不猜感应、变压器、传感器与带电粒子条目的页码。自由落体沿用已核教材章级定位，物理关系另由下列公开主源支持。下文操作是平台模型设计，不是抄录教材完整操作规程。

## 十四项可执行探究与边界

| 实验 | 建议的可执行证据任务 | 必须明确的模型边界 |
| --- | --- | --- |
| 向心力影响因素 | 分别固定r/ω、m/ω、m/r，改变另一量并保存F；比较F—m、F—r、F—ω²。 | F是径向合力效果；r从轴到质点中心。固定ω与固定v的半径对照不能混合；ω=0时无有限转动周期。 |
| 长度工具 | 先合拢检查零点，再夹物并选择扣零点；比较游标/螺旋分度，记录示值、量化零点与修正值。 | 参数生成的尺读数不是学生完成真实装夹、接触力控制或独立读尺；分辨率不等于测量精度。 |
| 金属丝电阻率 | 固定材料与几何，改变电压保存U/I；用R和L、d计算ρ，再分别比较几何变化。 | 均匀欧姆导线与理想电表；直径先转m，截面积为πd²/4。零电压点不能单独作U/I。 |
| 多用电表 | 改功能、量程、接法和电源状态，比较有效/无效读数与原因，用文字保留错误设置与提示，恢复正确条件后才保存有效读数。 | 电压并联、电流串联，电阻测量隔离外部电源。仿真无效值/占位值不能解释成元件真实为零；未建模的熔断、内阻和表笔校零不能称已操作。 |
| 一维动量 | 保存两物体质量、带符号的碰前/碰后速度，比较系统总动量与动能，改变恢复系数。 | 总动量守恒依赖系统外冲量忽略；非弹性碰撞通常不守恒动能。系统初动量为零时不报告除以零的相对误差。 |
| 折射率 | 固定两介质，改变入射角，保存相对法线的i/r并比较正弦；另做高折射率到低折射率的临界对照。 | 单界面几何光学，不等于真实玻璃砖插针/测角；正入射0/0不能单点求比，全反射无传播折射角，临界掠射与超临界分开。 |
| 感应电流 | 按同一线圈正法向约定保存磁通、变化率、感应电动势和电流；改变频率/相位并比较符号。 | 恒定匀强磁场中的旋转线圈，磁通随转角成余弦；闭路为纯电阻，开路I=0但ε可非零；不是实体磁铁插拔。反抗的是磁通的变化，不是永远反抗外磁场；电动势为零不等于磁通为零。 |
| 变压器 | 固定原边交流输入，改变匝数比保存两边有效值；比较负载电流与功率。 | 理想耦合及无损模型，升压不增加功率；区分瞬时值、峰值、有效值。无直流暂态、磁饱和或真实损耗时不承诺研究这些因素。 |
| 传感器控制 | 保存环境输入、传感器响应、上下阈值及执行器状态，比较阈值附近和响应过程。 | 明确为一阶线性温度传感器与带滞回开关，不冒称NTC热敏电阻；阈值区间内状态依赖初态/既往响应，不能只凭当前温度推断。 |
| 油膜尺度 | 保留溶液体积、滴数、纯油比例与面积，换算纯油体积后估d=V/S，比较输入偏差。 | 单层紧密排列近似；示意轮廓不能当真实面积测量。体积是纯油体积，滴数/稀释/面积单位分别核对，不称分子直接成像。 |
| 等温p—V | 固定气体量和温度，改变体积保存绝对压强，比较p—1/V及pV。 | 理想气体平衡态；温度用K，不用表压代绝对压强。若模型直接指定等温，不能声称已模拟缓慢压缩的热交换过程。 |
| 自由落体 | 从静止释放，保存落地前时间、下落距离与速度，比较s—t²；改变高度比较落地时间。 | 无阻力、恒g；落地终点是碰撞前瞬间或明确终止，不补成继续自由落体，不承诺空气阻力对照。 |
| 光电效应 | 固定逸出功改变频率，比较最大动能/截止电压；固定频率另改光强和收集电压比较电流。 | 单光子阈值；hν−W是最大动能，不是所有电子动能。电流—电压曲线若采用均匀能量分布，须标作教学假设而非材料实测曲线。 |
| 带电粒子磁场 | 固定q/m、B改变速度，保存半径/周期和转向；反转q或B比较方向。 | 非相对论匀强磁场模型；洛伦兹力不做功。零磁场或零q/m的直线分支不能保留虚假圆轨道与周期；未实现电场/三维螺旋时不承诺。 |

## 物理主源与推导范围

下列公开原始资料用于核对定律，不代表它们实现了本平台相同仪器或教学流程。

- [OpenStax向心力](https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force)：径向加速度、合力与两种速度形式。
- [OpenStax电阻与电阻率](https://openstax.org/books/university-physics-volume-2/pages/9-3-resistivity-and-resistance)：R=ρL/A、材料与温度的区分。
- [OpenStax折射](https://openstax.org/books/university-physics-volume-3/pages/1-3-refraction)：n₁sin i=n₂sin r，角度相对法线。临界条件由sin r=1独立推导。
- [OpenStax楞次定律](https://openstax.org/books/university-physics-volume-2/pages/13-2-lenzs-law)：电动势符号来自磁通变化；平台的正弦Φ(t)和纯电阻负载是额外建模选择。
- [OpenStax变压器](https://openstax.org/books/university-physics-volume-2/pages/15-6-transformers)：理想交流匝数、电压、电流关系；不能从此推出任意直流稳态也能变压。
- [ADI线性温度传感器说明](https://www.analog.com/en/products/tmp36.html)与[TI滞回比较器设计](https://www.ti.com/tool/TIPD144)：支持线性电压响应类型和上下阈值思路。平台不是这两个实际产品的数字孪生，不移用其精度、响应速度、认证或电路图；一阶响应系数由教学模型明确给定。
- [OpenStax理想气体](https://openstax.org/books/university-physics-volume-2/pages/2-1-molecular-model-of-an-ideal-gas)：固定温度/物质的量时绝对压强与体积反比。
- [OpenStax自由落体](https://openstax.org/books/university-physics-volume-1/pages/3-5-free-fall)：近地面恒重力加速度的直线模型。
- [OpenStax光电效应](https://openstax.org/books/university-physics-volume-3/pages/6-2-photoelectric-effect)：阈值、最大动能、光强及截止电压的不同作用。
- [OpenStax带电粒子](https://openstax.org/books/university-physics-volume-2/pages/11-3-motion-of-a-charged-particle-in-a-magnetic-field)：磁力垂直速度、半径/周期及带电符号；平台必须按实际实现说明是否限于垂直入射。

本轮OpenStax动量9.4直接请求不可读，未据此伪称已读；动量任务改用上述已取得的官方教材原文支持。传感器指数响应、光电电流收集曲线、油膜面积取值及仪器量化均应标明额外模型选择，不能冒充主源给出的器材精密误差模型。

## 开源学习范围

| 官方源头 | 本轮证据与许可 | 可借鉴的设计与限制 |
| --- | --- | --- |
| [PhET Bending Light](https://github.com/phetsims/bending-light)，[模型说明](https://raw.githubusercontent.com/phetsims/bending-light/main/doc/model.md) | [package.json](https://raw.githubusercontent.com/phetsims/bending-light/main/package.json)声明GPL-3.0；[README](https://raw.githubusercontent.com/phetsims/bending-light/main/README.md)明确旧仓库停止维护、迁移后的monorepo当时未公开。仓库HTML一度超时，原始文档可读。 | 参考界面、法线与反射/折射分支同源的组织；上游还描述Fresnel光强与色散，平台未实现时不能因引用它就声称拥有。未复制GPL源码/素材或导入依赖。 |
| [VPython GlowScript](https://github.com/vpython/glowscript)，[箭头表示](https://www.glowscript.org/docs/VPythonDocs/arrow.html)、[动画节奏](https://www.glowscript.org/docs/VPythonDocs/rate.html) | 同轮已核[LICENSE](https://raw.githubusercontent.com/vpython/glowscript/master/LICENSE.txt)的MIT主体与另列BSD式/第三方说明，见[向心力研究](CENTRIPETAL_FORCE_RESEARCH.md)。未核当前维护频率。 | 借鉴箭头尾点/方向的明确约定和计算时间与重绘分离；沿用平台现有时钟与Three.js，不复制例子或引入编译器。 |

所有十四项共同遵守：原参数与已保存证据不被当前设置改写；自动模型、独立虚拟读数、实体测量三者分开；理论曲线不假装实测散点；力力先辨具体实验和关系，再检查控制变量及异常状态。没有数据时给实际可执行步骤，不能按保存条数或理想拟合程度推断学生已经完成或掌握。
