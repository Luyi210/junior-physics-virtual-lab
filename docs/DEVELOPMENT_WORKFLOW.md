# 持续开发与验收流程

本轮开始日期：2026-11-11（Asia/Shanghai）。运行目标由当前会话的 Goal 持续推进；本文是可续接的工作规则，不是定时调度器，不会单独启动 AI 或消耗额度。

## 每一轮怎样工作

1. 读取本文件、`docs/DEVELOPMENT_STATUS.md` 和当前 Git 差异，保留已有修改、实验档案和数据库。
2. 从待办中选择可验证的一项。先复现故障或定义可见结果；物理问题写出适用条件、单位和参考依据。
3. 按目录边界实现。多人并行时分开文件所有权，先约定接口，避免两人同时编辑相同文件。
4. 运行有意义的模型/服务测试与相关页面检查。修正缺陷后再运行全工程 `npm run verify`。
5. 在可用浏览器中检查真实操作、3D、触屏布局和降级模式；自动测试通过不等于视觉验收完成。工具不可用时写明缺口，不伪造截图或通过记录。
6. 记录本轮修改、命令结果、已知限制和下一项。确认阶段结果后继续下一轮；无法独立处理的阻碍写明所需条件。

`npm run quality:checkpoint` 可执行一次完整自动检查，并将各阶段日志、退出码和时间写入 `.runtime/quality-checkpoints/`。失败会停止后续阶段，防止留下错误的通过记录。它只执行验证，不自动修改代码、不代替持续目标或真实浏览器验收。

有状态实验必须先约定完整过程合同，再并行制作模型、视图和课堂连接。电容器的第二十二阶段实现将开关历史一并贯穿存储、失败恢复、CSV、力力和报告，示例见[电容器设计](high-school/CAPACITOR_CHARGE_DESIGN.md)。不能只在画面里保存一个当前状态，却用当前参数重算历史证据。

每个阶段最长10分钟；取消时会终止本轮命令及其子进程，2秒宽限后强制结束。macOS/Linux 使用本轮独立进程组，不会停止已有预览服务。报告记录取消、信号、超时和退出码；正常失败或取消后释放运行锁。断电、系统强杀等无法执行清理的情况仍可能留锁，应先检查锁中PID及对应进程，不要直接删除其他正在运行的检查锁。Windows任务树分支尚未经Windows实机验证。

`npm run test:workflow` 单独验证检查器的成功、失败、取消、并发锁、进程后代、日志错误等行为；它也被纳入根目录 `npm test`。Linux专用的 `/dev/full` 写入失败回归在macOS上跳过。

## GitHub 质量检查

- `.github/workflows/quality.yml` 在拉取请求与手动触发时运行完整检查，只授予读取代码权限，不部署、不配置AI密钥。
- 已有 `deploy-pages.yml` 保留主分支推送/手动触发方式，将原来的网页专项检查升级为同一完整检查。只有成功后才上传站点并进入部署；构建任务只有代码读取权限，Pages/OIDC写权限只在部署任务中。
- 安装使用 `npm ci` 和Node24；依赖安装与分阶段报告上传保留7天。上传仅限 `.runtime/quality-checkpoints/` 下的日志与JSON，不包含预览数据库、账号令牌或整个运行目录。主动取消的CI不保证上传报告。
- 新使用的checkout、setup-node和upload-artifact已按官方release核实并固定完整提交SHA。PR不使用 `pull_request_target` 或部署环境；`npm ci | tee` 在bash pipefail下不会掩盖安装失败。

这些配置目前仅在本地工作区，未推送或执行远端工作流。YAML解析和本地完整检查不能替代首次Ubuntu CI，尤其需确认原生依赖安装。分支保护是否要求质量检查也属于仓库设置，尚未改动。

版本与行为依据（2026-11-11核对）：[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)、[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)、[upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)、[工作流权限与依赖](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)、[状态函数](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions)。

## 目录边界

| 内容 | 放置位置 |
| --- | --- |
| 初中实验 | `apps/web/src/features/experiments/`，保留原六领域 |
| 高中课程入口与工作台 | `apps/web/src/features/high-school/pages/` |
| 高中时钟与工作台逻辑 | `apps/web/src/features/high-school/experiments/` |
| 高中仪器场景、图表与通用界面 | `apps/web/src/features/high-school/components/` |
| 柯基力力界面 | `apps/web/src/features/high-school/assistant/` |
| 跨页面数据服务 | `apps/web/src/data/` |
| 高中物理模型 | `packages/physics/src/highSchool/` |
| 高中教材与课标目录 | `packages/knowledge/src/highSchool/` |
| 力力引导规则 | `packages/harness/src/highSchool/` |
| 前后端契约 | `packages/contracts/src/` |
| 服务器接口与 AI 服务 | `apps/api/src/` |
| 课程、设计和开源核对 | `docs/high-school/` |
| 临时验收、日志和预览数据 | `.runtime/`（不提交） |

物理模型不依赖 React；场景消费物理输出，不在绘图代码重写公式。课程目录不导入页面。初高中使用独立实验标识、路由和本地存储键。主页保持轻量，Three.js 随实验页面按需加载。

## 本轮可验收目标

- 独立高中入口、按教材册次/领域筛选、明确可用与筹备中的实验。
- 首批六项：匀变速直线运动、加速度与力和质量、平抛运动、单摆、电源电动势与内阻、双缝干涉。最终名称与教材归属以官方资料核对结果为准。
- 工作台具备参数控制、运行/暂停/复位、读数、比较数据、可解释图像，以及模型假设。3D帮助理解空间关系，2D可用于读数与低性能设备。
- 力力为柯基形象；围绕当前实验引导预测、控制变量、记录与反思。区分模型计算、学生记录和 AI 建议；离线规则与联网 AI 状态明确。
- 审查初中仿真中可复现的科学性问题，优先修正数值、单位、边界和交互反馈。

## 商业试用门槛

SQLite运维新增`db:backup`、`db:verify-backup`、`db:restore`，详见[备份恢复说明](backend/SQLITE_BACKUP_RECOVERY.md)。恢复只进入不存在的新目录；副本经正式server.js与合成数据HTTP核验后仍不自动切换生产服务。备份完成标记必须在全部校验后写入，历史备份不自动删除。工具/演练结果与真实断电、异地和大容量恢复分开记录。

后台修改先用独立临时数据库验证首次初始化、普通重启和失败保留；不得用现有预览数据库做可变测试fixture。预览服务刷新前核对完整进程命令、进程组和端口，备份数据库，并对所有业务表比较前后内容摘要。保留历史演示数据和学生记录，新增课例不借启动seed覆盖旧库。PostgreSQL替身的SQL测试必须与真实锁、并发和回滚验收区分，参考[第十七阶段记录](backend/ACCEPTANCE_STAGE_17.md)。

账号生命周期修改还应覆盖请求前、响应解析前后和页面异步动作，分别验证教师固定通道与学生固定通道，不以高中档案选择代替登录身份。真实HTTP联调使用隔离数据库并核对监听PID；测试开始先使结果标为未通过，失败不能遗留上一次成功标记。只检查当前源码可达时不必重启预览，但仍只读比较完整业务表并标明未做浏览器验收，参考[第十八阶段记录](ACCEPTANCE_STAGE_18.md)。

增量新表更新先保存一致性备份，再比较原有每张业务表的完整内容摘要；预期的新表单独核验，不通过改变旧数据来满足旧计数。Python的SQLite连接须显式close，`with connection`只结束事务。在此Mac上，干净关闭后没有WAL/SHM的主文件可能无法用`mode=ro`打开；只有核实原进程终止、目标端口空闲、WAL/SHM均不存在且数据库无打开句柄，才可离线使用`immutable`比对。活跃数据库必须读取WAL，不能用该选项绕过已有日志。中途停止后续接应保留失败证据、复核备份与运行态，不再次停止旧PID或覆盖现库，见[第十九阶段记录](ACCEPTANCE_STAGE_19.md)。

不能以完成页面数量或测试数直接宣布可以销售。候选版本至少要完成：物理教师审阅与课程版本核对；真实浏览器与低性能设备验收；账号隔离、备份恢复和数据删除流程检查；部署监控与容量验证；素材及依赖许可核对；有真实教师/学生参与的试用反馈。付费、发布、生产数据迁移和对外承诺另行安排。

## 开源采纳

优先阅读官方仓库和文档，记录具体可借鉴设计与许可证。不能把“参考”写成官方合作或授权。引入依赖或复制代码前检查许可、维护状态、体积和必要性；已有 React / Three.js 栈能完成的功能优先在现有架构内实现。
