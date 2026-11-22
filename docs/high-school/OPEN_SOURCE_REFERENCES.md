# 高中实验的 GitHub 开源参考

核对日期：**2026-11-11（Asia/Shanghai）**。

本轮采用开源项目的模型分层、实验操作和渲染性能设计思路。保留本平台的 React、TypeScript、Three.js 架构；没有克隆完整 PhET 依赖树，没有复制其仿真源码、图片、音频、题目或商标。物理计算依教材关系自行实现。

## 官方仓库、维护情况与取舍

| 项目与精确仓库 | 本次核实的状态与许可证 | 学习与采用方向 | 本轮未采用 |
| --- | --- | --- | --- |
| [PhET phet-info](https://github.com/phetsims/phet-info) | 当前README明确说明该仓库不再维护，并提及其库迁移到暂未公开的monorepo；不把旧文档描述为当前完整开发底座 | 认识仿真开发与验证的分工，跟踪上游状态变化 | 旧环境安装脚本、整套构建流程；该文档库未在本轮确认统一许可证，不复制内容 |
| [PhET Pendulum Lab](https://github.com/phetsims/pendulum-lab) | 可检索的官方仓库标GPL-3.0，目录具有intro、energy、lab等层次；未核实到当前最后提交日期 | 将入门观察、定量测量、模型解释分开；摆长、摆角、重力参数独立；对照大小角度条件 | 仿真算法实现、摆球美术资源、现成教学文案；不声称本平台获PhET背书 |
| [PhET Projectile Motion](https://github.com/phetsims/projectile-motion) | 历史官方仓库链接；本次仓库正文请求超时，所试LICENSE路径不可取，**当前许可证与维护状态未核定**。[官方仿真页面](https://phet.colorado.edu/en/simulations/projectile-motion)仍可找到 | 作为抛体参数、轨迹、分运动表现的交互比较对象；当前平抛模型按教材独立设计 | 不把未经读取的许可证默认为MIT或GPL，不引入该仓库依赖或代码 |
| [PhET Joist](https://github.com/phetsims/joist) | 仓库当前标MIT，公开可访问；未核实精确最近提交日期 | [Screen模型与视图分离](https://github.com/phetsims/joist/blob/main/js/Screen.ts)、屏幕切换和按需创建的设计 | 不引入其Screen基类、品牌、PhET-iO及Grunt依赖体系 |
| [PhET Scenery](https://github.com/phetsims/scenery) | 仓库当前标MIT，公开可访问；支持WebGL、SVG、Canvas等呈现方式，未核实精确最近提交日期 | 同一模型可有多种视图；在3D之外保留清晰、可读的2D表示 | 不替换现有渲染框架，不因某个基础库为MIT就推断所有仿真及素材均为MIT |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | MIT；本次官方GitHub API返回未归档，最近推送为2026-10-21；属于本工程已有依赖 | 以React组件组织3D仪器，按需渲染、限制像素比、保持模型时间与视觉呈现分离 | 不增加另一套游戏引擎，不把渲染器当物理计算引擎 |
| [Drei](https://github.com/pmndrs/drei) | MIT；仓库与官方文档可访问，具体最新提交日期因公开API限流未核实；属于本工程已有依赖 | 使用已有的OrbitControls、Html、Line、Grid等能力，统一相机观察与空间标注 | 不为演示加入额外远端模型、环境贴图或不必要的视觉特效 |

维护状态只描述本次实际获取的证据。公开仓库、Issue数量或星标数量本身不等于持续维护保证；PhET项目整体、某个历史仿真仓库与Scenery等基础库也不能混为同一维护结论。

## 已落实到本轮工作区的设计

| 设计 | 上游依据 | 本平台落点 |
| --- | --- | --- |
| 物理模型独立于React和绘图 | [Joist Screen中模型与视图的独立构建](https://github.com/phetsims/joist/blob/main/js/Screen.ts) | [纯计算包](../../packages/physics/src/highSchool/index.ts)接收参数与显式时间；[2D视图](../../apps/web/src/features/high-school/components/ExperimentDiagram2D.tsx)和[3D视图](../../apps/web/src/features/high-school/components/ExperimentScene3D.tsx)读取同一模拟结果 |
| 暂停、单步与重置属于实验时钟 | [PhET单摆的分层实验组织](https://github.com/phetsims/pendulum-lab/tree/main/js)以及[渲染循环文档](https://r3f.docs.pmnd.rs/api/hooks) | [useExperimentClock](../../apps/web/src/features/high-school/experiments/useExperimentClock.ts)独立推进时间；标签页隐藏时暂停，不为2D和3D各运行一个独立物理时钟 |
| 静止场景按需渲染 | [R3F性能指南](https://r3f.docs.pmnd.rs/advanced/scaling-performance) | 3D Canvas采用`frameloop="demand"`和受限DPR；变更参数或视角时更新，保持场景的成本可控 |
| 相机交互使用成熟组件 | [Drei Controls文档](https://drei.docs.pmnd.rs/controls/introduction) | 当前3D视图使用OrbitControls，限制观察距离和极角，防止相机轻易进入地板或远离仪器 |
| 计算与显示分层验证 | [R3F测试文档](https://r3f.docs.pmnd.rs/api/testing) | [物理测试](../../packages/physics/src/highSchool/highSchool.test.ts)覆盖数值及边界；交互与WebGL实际显示仍需要相应浏览器验收 |

上表是设计对应关系，不表示从所链接文件逐行翻译或复制。现有单摆采用非线性方程，双缝采用几何光程差；其数学依据和计算边界记录在[物理计算层说明](../../packages/physics/src/highSchool/README.md)，不能以“参考了开源项目”代替物理正确性验证。

## 第二十阶段：机械能与耗散对照

本轮核对PhET Energy Skate Park及myPhysicsLab官方说明，借鉴模型、测量、图表分开，以及耗散单列和方程边界显式化；未复制源码、素材或引入依赖，未用能量修正算法改动学生读数。PhET仓库README已声明停止维护，package.json有GPL-3.0声明而独立LICENSE未取得；myPhysicsLab的Apache-2.0 LICENSE可读，近期维护频率未核定。逐项URL、许可证据和教学取舍见[机械能研究依据](MECHANICAL_ENERGY_RESEARCH.md)。

## 第二十七阶段：宇宙视觉与空间界面

2026-11-11核对以下官方示例、仓库和许可。借鉴构图、光色及空间层次，保持现有React架构；本轮未复制上游源码或图像，也未安装新依赖。官方[R3F展示索引](https://github.com/pmndrs/react-three-fiber/blob/master/docs/getting-started/examples.mdx)用于发现参考，不把展示收录当作质量保证。

| 参考与许可来源 | 采用方向 | 本轮具体落点与范围 |
| --- | --- | --- |
| [Drei Stars](https://drei.docs.pmnd.rs/staging/stars)、[官方仓库](https://github.com/pmndrs/drei)、[MIT许可](https://github.com/pmndrs/drei/blob/master/LICENSE) | 用疏密、亮度和视差产生空间感，避免背景抢走教学主体 | 首页独立Canvas2D星场、深度投影与点云；没有在首页导入Stars或Three.js |
| [Three.js selective bloom示例](https://threejs.org/examples/webgl_postprocessing_unreal_bloom_selective.html)、[官方仓库](https://github.com/mrdoob/three.js)、[MIT许可](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | 发光集中在少数轨迹、卫星与边缘，维持深色背景和文字对比 | Canvas径向光晕、轨道亮线及CSS按钮高光；没有接入Bloom后处理，不宣称与上游渲染方式相同 |
| [Bruno Simon 2019作品](https://2019.bruno-simon.com/)、[folio-2019仓库](https://github.com/brunosimon/folio-2019)、[MIT许可](https://github.com/brunosimon/folio-2019/blob/master/license.md) | 场景作为首屏主角，交互让空间成为导航和探索的一部分 | 首屏大幅无框观测舱、拖动/键盘视角和三个意象入口；不复制汽车、模型、纹理或完整物理世界 |

MIT核对仅针对链接仓库的许可证文件，不延伸推断所有外部展示素材。宇宙意象由本平台独立生成，标注为非定量实验；正式模型预览仍使用现有物理包。上述参考未用于证明物理正确性，也未核定这些项目本月的维护频率。实现和验证见[第二十七阶段](STAGE_27_COSMIC_DESIGN.md)。

## 后续值得继续学习的内容

- 无障碍：与滑块等效的键盘操作、文本读数和图像说明；3D不是唯一的实验操作入口。
- 测量工具：先设置条件、再测量和比较多组证据，避免只显示公式直接算出的答案。
- 性能：在真实低性能设备测试暂停、切换实验和释放GPU资源；不能只凭按需渲染配置就宣称流畅。
- 测试：需要复杂3D对象交互测试时再评估`@react-three/test-renderer`。本轮未仅为参考文档新增此依赖，其测试也不能替代浏览器里的遮挡、触控和图像验收。

工作区已有 `03_开源参考/01_PhET_物理仿真/` 等历史学习材料，可供只读比较；与主工程运行依赖分离，使用前重新核对版本。PhET品牌和素材授权还可能有独立条款，参考[官方品牌说明](https://github.com/phetsims/brand/blob/main/README.md)，不能用源码许可证概括全部资源。

## 2026-11-22：运动过程的动态呈现

查阅 [PhET Projectile Motion 模型说明](https://github.com/phetsims/projectile-motion/blob/main/doc/model.md) 与 [Collision Lab 模型说明](https://github.com/phetsims/collision-lab/blob/main/doc/model.md)，参考随时间形成轨迹、保留位置痕迹和用可读标记帮助观察运动的表达方式。当前公开的 Projectile Motion 仓库 README 已说明旧仓库不再维护；这些链接是设计参考，不代表使用了其当前代码。平台独立使用既有物理计算结果，在抛体与自由落体二维、三维画面中显示已走轨迹和等物理时间间隔的位置点；时间轴回看时同步更新。没有复制上游源码、图像、文案或商标，也没有新增运行依赖。

## 第十三阶段：弹簧静态实验

本轮重新浏览官方仓库与说明，仅采用以下两项的设计思路，不复制实现、图像或活动题目，也不新增运行依赖。

| 官方参考 | 本轮核验与许可边界 | 采纳的设计及本平台落点 | 未采用 |
| --- | --- | --- | --- |
| [PhET Masses and Springs](https://github.com/phetsims/masses-and-springs)、[模型说明](https://github.com/phetsims/masses-and-springs/blob/main/doc/model.md)、[实现说明](https://github.com/phetsims/masses-and-springs/blob/main/doc/implementation-notes.md) | 当前README明确停止维护并迁往暂未公开的monorepo；模型与实现说明仍可读。当前main的LICENSE请求为404，不能据其他PhET仓库的GPL/MIT标签推定本仓库当前授权。仅作历史设计参考，未复用任何GPL或许可未核定源码/素材 | 同一模型服务不同呈现，显示使用明确的模型—视图变换；本轮弹簧的原长、总长和伸长量共用比例，原长参考线与平衡位置分开。目录明确静态读数和模型限制 | 上游阻尼振动、能量屏、拖拽动力学、动画回收、无单位向量长度；不采用其“对象全程存活无需释放”的生命周期假设 |
| [myPhysicsLab](https://github.com/myphysicslab/myphysicslab)、[Single Spring官方说明](https://www.myphysicslab.com/springs/single-spring-en.html) | 仓库及[LICENSE全文](https://github.com/myphysicslab/myphysicslab/blob/master/LICENSE)可读，确认Apache-2.0；本次未核定最后提交日期，不宣称持续维护频率。公式解释和源码分开可查 | 定义原长与伸长的参考位置，参数变化配合图像和关系解释；本轮采用`x=L−L₀`，以保存的F—x数据估k，并与模型关系区分 | 上游是水平弹簧振子，不能直接把其振动方程当作悬挂静态模型；不引入Runge–Kutta积分器、终端或完整仿真框架，不复用Apache源码 |

同时核查的[PhET Hooke’s Law仓库](https://github.com/phetsims/hookes-law)也已明确停止维护；官方仿真页和许可页本次仅返回动态页面外壳，LICENSE未获取。因此不把它列作已核实许可、可直接移植的当前实现，也不据未读到的页面宣称已体验其操作。

上述借鉴落实为本轮的模型/视图分工、长度标注与数据分析约定；运行与交互是否完成由阶段验收另行记录。教材对应与范围详见[弹簧实验设计](./SPRING_FORCE_DESIGN.md)。开源参考不提供真实弹簧的材料参数，也不能支持本平台声称识别了真实弹性限度。

## 第十六阶段：共点力与独立试配

仅核对以下两个官方项目。没有复制源码、图像、题目或商标，没有新增运行依赖。

| 官方参考 | 本轮证据与许可 | 采用的设计 | 未采用与限制 |
| --- | --- | --- | --- |
| [PhET Vector Addition](https://github.com/phetsims/vector-addition)、[模型说明](https://raw.githubusercontent.com/phetsims/vector-addition/main/doc/model.md) | 模型说明可读，区分二维分量与大小/方向表示，并描述拖动矢量头端；README明确停止维护，monorepo暂未公开。当前main的LICENSE返回404，当前授权未核定 | 借鉴端点调节和分量对照；本平台固定共同作用点，并让单个试配力独立于模型矢量和，保留学生原始选择 | 不移植上游依赖树、多个自由移动矢量集合、整数及5°吸附规则；未运行官方页面，不宣称已验证其当前浏览器体验；许可未核定代码/素材不复用 |
| [PhET Dot](https://github.com/phetsims/dot)、[Vector2文档及实现](https://raw.githubusercontent.com/phetsims/dot/main/js/Vector2.ts)、[LICENSE](https://github.com/phetsims/dot/blob/main/LICENSE) | 官方README及LICENSE确认MIT，二维向量文档可读；未核定最近维护日期 | 参考分量、模长、角度与零向量分开处理的设计；本平台显式发布方向/夹角有效标记，助教不把零向量占位角当作物理方向 | 不复制源码，不引入对象池、可变向量对象、PhET序列化或依赖链；Dot的MIT不能代表Vector Addition及美术资源的授权 |

本轮物理公式按共点力分量关系独立实现，力力对照原始试配参数与模型残差；数据分析采用固定两个非零力的R²—cosθ关系。工作台接入后该实验已开放，目录现为8项开放、16项规划。试配残差和拟合属于虚拟模型对照，不能以开源项目背书把它们称为实体测量或操作精度。实现与验收边界见[共点力实验设计](./FORCE_COMPOSITION_DESIGN.md)。
