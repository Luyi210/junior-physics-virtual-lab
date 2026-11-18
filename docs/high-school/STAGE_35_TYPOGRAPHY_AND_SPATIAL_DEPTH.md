# 第三十五阶段：高中字体与空间层次

日期：2026-11-12（Asia/Shanghai）。本轮回应“字体不美观，增加 3D 感”的要求，仅修改本地前端和字体资源，未部署服务器。

## 字体

- 增加 `styles/HighSchoolTypography.css`，分别管理标题、中文正文、课程信息、数字仪表、控件及力力。高中 Header 和作为页面 sibling 渲染的力力均导入该样式。
- 旧的三个共享样式文件使用 `!important` 强制所有元素的字体、字重和字号，导致高中自身规则失效。本轮在这些原选择器中排除 `.hs-page`、`.lili-assistant` 及其后代；排除条件用 `:where` 保持原有 specificity，其余页面沿用原声明。
- 中文使用本地 Noto Sans SC 可变字体衍生子集；大号数字使用 Barlow Condensed 500/600 衍生子集。全部 32 个 WOFF2 合计 381,500 bytes（372.6 KiB），不请求第三方字体服务，未新增网页运行依赖。
- 原始 npm tarball SHA512 校验、输入/输出 SHA256、字形范围、完整 OFL 许可与制作说明保存在 `apps/web/public/fonts/high-school/`。当前扫描到的高中中文均覆盖；后续新增字、用户内容和部分数学符号保留系统回退。
- `scripts/prepare-high-school-fonts.py` 可离线复现。保持原分片，不合并变量字体；逐字核对实际 cmap、字重轴、轮廓与字宽，两次生成结果 SHA 一致。制作缓存和 Python 工具位于 `.runtime/stage35/`，不属于运行依赖。
- 主图刻度恢复为 12px，避免取消全局覆盖后退回原组件的 10px；没有统一放大精密仪器自身刻线文字。

字体原项目与许可：[Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)、[Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)。具体版本与完整性值以字体目录的 `manifest.json` 为准。

## 空间效果

- 24 张课程卡的装置展示增加透视台座、厚边、接触阴影和轻微鼠标视差。只倾斜展示区；标题与入口保持稳定。一个共享控制器按指针事件申请一帧，不给每张卡创建 Canvas 或常驻动画。
- 天体观测舱增加统一光源下的明暗分界、大气亮边、前后轨道光带及透视网格。干涉增加起伏波面和遮挡；量子云增加深度，仍不绘制确定电子轨道。Canvas 和静态 SVG 使用共同几何。
- 观测舱保持“物理意象、非定量实验”说明，保留暂停、方向键、拖动、离屏停绘、减少动态偏好、30 fps 和背板尺寸预算。
- 正式 Three.js 实验环境增加厚台面、下层地面、侧边细条和多方向布光，改善通用仪器材质。台面顶仍为 y=-1.5，不调整仪器坐标和物理模型。保留一个 1024 阴影图以及二维降级。
- 实机单摆检查发现原浅色操作浮层与继承的浅字冲突；已调整为深色高对比控制条，桌面加宽以减少换行。该最后修正尚未取得修后截图。

## 验证

- 完整前端：111 文件、1484 项测试通过，日志 `.runtime/stage35/web-tests.log`。
- 生产构建（含 TypeScript）：通过；336 模块架构检查通过。初始资源 264.7 KiB gzip，无提前加载 Three.js、无 source maps。日志 `.runtime/stage35/build.log`。
- 新增 14 项测试覆盖卡片静态结构/交互清理、观测舱深度几何、三维台面与全部 24 项实验相机及阴影覆盖。
- 字体字形与复现核验通过；全部 32 个生产 CSS 字体路径可解析到产物，与源文件逐字节一致。本地新版字体样式和抽查字体 HTTP 200。
- Edge 原生截图实际看到新版桌面首页、目录卡片、单摆三维工作台、仪器及数值字体。观察过全屏与正常窗口布局。窗口捕捉间歇返回灰屏，切换全屏恢复后完成上述观察。
- 随后工具再次返回 `cgWindowNotFound`；没有把手机窄屏、真实触屏、全 24 项 GPU 操作、字体浏览器逐字覆盖或单摆控制条修后视觉标记为通过。力力 launcher 已见，聊天面板本轮未实机展开。
- CSS 层叠与卡片生命周期已由另一位协作者只读复核。物理模型、账号、实验记录及后台数据逻辑没有修改。

## 文件位置

- 字体策略：`features/high-school/styles/HighSchoolTypography.css`、`HighSchoolFontFaces.css`。
- 字体资产：`apps/web/public/fonts/high-school/`。
- 卡片空间交互：`features/high-school/components/spatial/`；布局仍在 `pages/HighSchoolHome.css`。
- 观测舱几何与绘制：`features/high-school/components/cosmos/`。
- 正式三维舞台：`SceneEnvironment3D.tsx`、`ScenePrimitives3D.tsx`；浮层主题在 `ExperimentViewport.css`。
- 本轮修改前文件基线：`.runtime/stage35/baseline/`。本仓库原有未提交重构保留，没有执行 reset、clean 或提交。

本轮未上传、未启动生产服务、未修改既有网站。旧 Stage33 部署包不包含此轮修改。
