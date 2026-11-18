# 第二十七阶段：深空物理实验舱

日期：2026-11-11（Asia/Shanghai）。用户希望比上一版更强的科技感，并提出天体、量子与GitHub开源展示参考。本轮将高中专区从暖纸教材风改为深空实验室，代码与完整自动检查已完成；真实浏览器视觉验收仍未完成。

## 界面变化

- 首页采用黑蓝背景、冰蓝轨道光和少量暖橙高光，改用现代无衬线标题与等宽读数。首屏独立展示大幅宇宙意象，保留进入实验与课程目录入口；开放数量从实际注册表读取。
- 宇宙观测舱可切换“天体轨道”“波的干涉”“量子云”。支持拖动旋转、方向键调整、Home重置、空格和按钮播放/暂停。背景使用确定性星点，轨道与球体有前后遮挡，量子云以双叶点密度表达空间意象。
- 三种画面明确标注“物理意象 · 非定量实验”。轨道没有对应具体天体参数；概率云没有求解波函数，也不把散点或动画解释成电子运动轨迹。波场采用两个同频源的线性叠加，但画面坐标不作为测量读数。
- 原单摆、抛体和碰撞模型展台移到首屏下方，继续调用现有纯物理计算。24项实验的目录、搜索、册别/领域筛选、档案身份与教材来源保留。
- 工作台的导航、控制、主要读数、图表和记录统一深色仪表风；三维共用环境改为深蓝台面、冷色主光与暖色边缘光。精密读数、二维器材和手动工作表保留清晰的浅色测量面，修复相应按钮、提示和展开记录的对比度。
- 力力的柯基形象保留，浮层、对话与操作区改用同一深空配色。

## 文件与职责

以下路径均相对 `apps/web/src/features/high-school/`：

| 内容 | 文件位置 |
| --- | --- |
| 首页排版、目录与响应式样式 | `pages/HighSchoolHomePage.tsx`、`pages/HighSchoolHome.css` |
| 宇宙组件、输入与静态降级 | `components/cosmos/CosmicObservatory.tsx`、同名CSS |
| 确定性点云、投影与波场 | `components/cosmos/cosmicGeometry.ts` |
| Canvas2D绘图 | `components/cosmos/cosmicPainter.ts` |
| 动画预算、可见性暂停与清理 | `components/cosmos/cosmicLoop.ts` |
| 高中主题、品牌标记 | `styles/HighSchoolTheme.css`、`components/HighSchoolHeader.tsx` |
| 实验页与三维环境 | `pages/HighSchoolWorkbench.css`、`pages/HighSchoolExperimentPage.tsx`、`components/SceneEnvironment3D.tsx` |
| 力力局部主题 | `assistant/LiliCosmicTheme.css`，由 `LiliAssistant.tsx` 导入 |

宇宙组件最多30次绘制/秒，DPR不超过1.5，不做逐帧React状态更新。隐藏页面、离开视口时停止调度，不补算离开期间时间；减少动态偏好默认静态，仍可主动播放。卸载清理帧、观察器、指针捕获与监听器。Canvas不可用时显示可切换的SVG静态意象。

首页没有新增Three.js、后处理、远端纹理或运行依赖。宇宙动画时间与正式实验时钟分开，不写档案或向力力发布实验上下文。本轮未更改后端、物理公式、数据契约或数据库，也未部署。

## 开源参考

核对官方项目的视觉示例与许可：Drei Stars的空间星场、Three.js selective bloom的局部发光，以及Bruno Simon 2019作品的场景主导构图。本轮借鉴视觉组织，Canvas投影与绘制独立实现，没有复制源码或素材，也没有实际接入Drei Stars或Bloom后处理。直接链接与具体取舍见[开源参考](OPEN_SOURCE_REFERENCES.md#第二十七阶段宇宙视觉与空间界面)。

## 验证与限制

完整报告：`.runtime/quality-checkpoints/2026-11-11T05-45-29-598Z.json`，上海时间13:46:24完成，四阶段退出码均为0。

- **2271项测试通过，1项Linux专用检查跳过**：workflow30、API204、光学4、web1373、harness306、knowledge12、physics342。
- 类型检查、33题检索评价、323模块架构检查、生产构建及首页资源检查通过；应用入口264.2 KiB gzip，未提前加载Three.js。该大小是构建脚本的应用入口统计，不代表整个高中路由的全部资源。
- 新增12项专项检查覆盖投影/拖动边界、同频波叠加、三模式有限绘图、SSR与SVG降级、30fps调度、减少动态、暂停、离屏/隐藏、StrictMode清理及迟到回调。测试使用受控浏览器对象，不能证明真实设备帧率。
- 首页/工作台渲染33项回归通过并包含在完整检查中；样式已解析及检查手机断点、自然换行和减少动态规则。
- 本机5174首页与新宇宙组件模块均实际返回HTTP 200。这只确认开发服务和模块可加载，不是浏览器交互验收。
- 另以现有esbuild、React SSR和sharp生成并观察三模式静态联系图，文件为 `/private/tmp/physics-stage27-cosmic-art/cosmic-static-contact.png`。它只检查SVG降级美术，不是页面截图，也不是实际Canvas动态帧。

本轮浏览器连接通道提示不可用，原生Edge取窗返回 `cgWindowNotFound`，未获取新版页面截图。因此整页视觉、Canvas动态、WebGL与手机触屏尚未标记实机通过；不能据工具错误判断产品失效或电脑锁屏。

本地预览：`http://127.0.0.1:5174/#/high-school`。上一版展台与工作台功能边界见[第二十六阶段](STAGE_26_VISUAL_UPGRADE.md)。
