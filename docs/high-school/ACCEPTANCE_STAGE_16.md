# 第十六阶段：共点力合成与独立试配

日期：2026-11-11（Asia/Shanghai）。本阶段新增第8项开放高中实验`force-composition`，目录其余16项继续标记筹备中。本地模型、交互回调、课堂连接和生产构建已通过；不据此宣称完成实物实验技能、真实触控或WebGL画面验收。

## 学生可以做什么

- 在同一原点和固定力的比例下，独立调整两分力与试配等效力。二维端点拖动同时更新大小和方向，支持键盘、明确选中重合手柄及参数数值输入；三维矢量板可旋转观察共点与平行四边形关系。
- 比较同向、垂直、反向与相抵预设。预设只改变两分力，试配力原值保留，调参不自动保存。默认3 N@0°与4 N@90°的合力为5 N@约53.13°，默认试配5 N@0°的残差仍约4.472 N，避免把大小相等当成等效。
- 明确记录全部六项参数和模型读数。零合力省略无定义的方向角，任一分力为零时不画夹角图线；表格采用历史读数项目并集，当前状态不隐藏旧记录的角度列。CSV保留缺失值为空，不填0°。
- 固定两个非零分力大小，保存至少三种不同夹角余弦，分析R²–cosθ。斜率对照2F₁F₂、截距对照F₁²+F₂²；不同分力大小分组，试配值不被当成合力或拟合输入。图中R²为合力大小平方，不是拟合优度的统计决定系数。
- 教师发布该实验的课例与任务，学生选择并预览本机记录生成文字副本，保存至账号，教师读取原文。未增加原始读数附件的自动云同步。

## 科学性和助手边界

残差向量为试配力减合力。0.05 N是教学比较阈值，不代表测量精度或学习完成标准。合力与等效力同向，平衡力反向；零合力没有方向，零分力没有与另一力的夹角。

这是共点力的静态几何模型，没有橡皮条伸长、测力计安装/校准、视差或实物误差。3D的显示层高度只用于区分重合线，物理量仍来自同一二维分量；不把图示长度称为绳长或位移。力力保留独立试配设置，服务端按合法参数重新计算，不信任提交的伪造状态或拟合结果，也不按记录条数或残差判定完成。无有效AI配置时明确使用本地引导。

课程依据与访问限制见[共点力设计](FORCE_COMPOSITION_DESIGN.md)。沿用已核对的2020版课标原文，未声称已核验2025全文。GitHub参考及许可逐项目列在[开源参考](OPEN_SOURCE_REFERENCES.md)，未复制第三方源码、素材或题目。

## 文件边界

| 职责 | 入口 |
| --- | --- |
| 分量、零向量、独立试配 | [forceComposition.ts](../../packages/physics/src/highSchool/forceComposition.ts) |
| 目录、统一模拟与保存读数分析 | `packages/physics/src/highSchool/{catalog,simulation,measurementAnalysis}.ts` |
| 拖动与键盘、预设与明确记录 | [ForceCompositionDiagram.tsx](../../apps/web/src/features/high-school/components/ForceCompositionDiagram.tsx)、[ForceCompositionControl.tsx](../../apps/web/src/features/high-school/components/ForceCompositionControl.tsx) |
| 指针/绘图映射与三维几何 | `apps/web/src/features/high-school/components/forceCompositionGeometry.ts`、`forceCompositionScene3D.ts` |
| 懒加载三维板 | [ForceCompositionApparatus3D.tsx](../../apps/web/src/features/high-school/components/ForceCompositionApparatus3D.tsx) |
| 工作台、参数批量更新与记录 | [HighSchoolExperimentPage.tsx](../../apps/web/src/features/high-school/pages/HighSchoolExperimentPage.tsx) |
| 课程、助手及课堂模板 | `packages/knowledge/src/highSchool/catalog.ts`、`packages/harness/src/highSchool/lili.ts`、`apps/web/src/features/teacher/teacherWorkspace.ts` |

## 检查证据

完整`npm run quality:checkpoint`通过，UTC时间`2026-11-10T21:23:45.813Z`至`2026-11-10T21:24:24.553Z`，报告：[2026-11-10T21-23-45-812Z.json](../../.runtime/quality-checkpoints/2026-11-10T21-23-45-812Z.json)。四阶段均正常退出，无取消或超时。

1296项通过，另1项Linux专用`/dev/full`回归在macOS跳过，比第十五阶段增加84项。通过项为工作流11、API90、光学4、Web794、Harness176、Knowledge8、Physics213。类型检查、248模块架构边界与生产构建通过；首页gzip仍264.1 KiB，无首屏Three.js或source map。33题检索硬性条件通过：Recall@1 90.6%、Recall@3 100%、MRR 0.948、意图匹配100%。

6组实际页面与控件回调联调通过，报告：[interaction.json](../../.runtime/stage16/interaction.json)。覆盖参数原子更新/无效输入整组拒绝、预设保留试配、三条件拟合、力力原始上下文、零向量与历史列、实际SVG指针回调、五组CSV及复位不清记录。使用实际TSX、物理模块和记录仓库，配合内存hook/Storage/SVG对象替身，不代表真实React调度或浏览器操作。

7组实际前端数据模块与隔离SQLite的真实HTTP联调通过，报告：[client-http-smoke.json](../../.runtime/stage16/client-http-smoke.json)。课例/任务/会话采用新实验ID；真实课堂加载器验证归属；实际证据格式器保留五组原值并经报告仓库保存，教师原样读取；力力本地回复分析24/25拟合系数并区分零方向；超范围及伪造手动仪器请求被拒；已完成会话拒绝改写，新重试档案独立，另一学生不能读取。使用临时8788服务与临时数据库，付费AI关闭，结束后关闭临时服务。Storage为内存替身，未调用浏览器。

API自动测试还在SQLite与pg-mem中覆盖全部8项实验的课堂链路；pg-mem不证明真实PostgreSQL行锁或部署行为。

既有本地预览已刷新至新代码，报告：[preview-check.json](../../.runtime/stage16/preview-check.json)。`8787` API健康、`5174`首页和5个新增/接入模块源码响应正常，认证后的力力HTTP请求使用新共点力模型并返回本地引导。新入口先备份现有SQLite，再直接打开已初始化数据库，不执行seed或迁移；11张业务表内容摘要在刷新前后完全一致，仍有12个账号、1个班级、15个课例、16个任务、1个会话及1份报告。原`5173`服务未动。

为保持全表不变，该项未调用会更新登录时间的login接口，而在运行脚本内存中为既有账号生成短期预览令牌，再由真实API验证账号。令牌不落盘，付费AI关闭。此入口只用于已有预览库；产品启动/初始化问题另见[后台初始化审查](../backend/INITIALIZATION_REVIEW.md)，不能把本次绕行当成产品已修复。以上仍是HTTP与数据库核对，不是浏览器画面验收。

## 仍需验收

真实鼠标/触屏拖动、键盘焦点与屏幕阅读器、窄屏文字遮挡、3D视角及弱GPU表现未完成。静态SVG与指针回调测试不能代替这些验收。教师教学审阅、真实AI对话质量、完整原始档案同步、部署容量、备份恢复与商业试用反馈仍是后续工作。当前没有发布到线上或推送仓库。
