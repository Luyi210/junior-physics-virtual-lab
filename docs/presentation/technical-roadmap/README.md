# 物理虚拟实验平台技术总路线图

[查看高清图片](技术总路线图.png) · [下载可编辑 PowerPoint](output/技术总路线图_可编辑_v2.pptx)

这张图分为两条线：

1. **产品运行链**：学生与教师在电脑或手机打开 `apps/web`；前端使用 `packages/physics` 的纯物理结果展示二维／三维装置、图表和读数。`packages/knowledge` 提供课程与生活案例，`packages/harness` 提供光光、力力的本地实验提示；`packages/contracts` 统一前后端数据约定。需要身份、班级、任务、报告和助手服务时，网页调用 `apps/api`，后台使用独立数据存储。
2. **工程交付链**：本地功能与自动检查已有记录；教师审阅、真实手机与 GPU 操作、独立服务器启动、子域名联调和试点反馈仍属于后续验收。Stage44 已在腾讯云完成上传、依赖安装、网页构建和停用的服务模板；最后可核查记录尚不能证明物理服务已启动或子域名可公开访问。

技术栈与目录依据：[代码架构](../../CODE_ARCHITECTURE.md)、[前端依赖](../../../apps/web/package.json)、[后端依赖](../../../apps/api/package.json)。状态依据：[开发状态](../../DEVELOPMENT_STATUS.md)、[Stage44 服务器记录](../../backend/ACCEPTANCE_STAGE_44.md)。这是一张技术路线总览，箭头表示主要依赖和数据流，不表示所有模块之间只有这一条调用路径。
