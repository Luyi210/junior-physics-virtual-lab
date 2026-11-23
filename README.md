# 初中物理虚拟实验平台 V2

第一次看代码，先打开[代码导览](docs/代码导览.md)；详细的模块边界和开发方式见[代码架构说明](docs/CODE_ARCHITECTURE.md)。周边教材与参赛资料见工作区的[目录导航](../00_目录导航.md)。本目录是继续开发的主工程。

第一次使用产品，请看[用户使用指南](docs/用户使用指南.md)，或在网页首页打开“使用指南”。

持续升级的流程与当前进展见 [开发 workflow](docs/DEVELOPMENT_WORKFLOW.md) 和 [开发状态](docs/DEVELOPMENT_STATUS.md)。独立高中专区的设计、课程来源和力力助手见 [高中产品设计](docs/high-school/PRODUCT_DESIGN.md)。

面向初中与高中物理教学的虚拟实验平台，包含初中六大领域、独立高中实验室、教师教学空间，以及光光和力力两位实验助手。GitHub Pages 发布初高中合版的前端演示；学校账号、课堂任务和跨设备记录仍需独立后台服务。

## 在线访问

GitHub Pages 初高中合版：<https://luyi210.github.io/junior-physics-virtual-lab/>

`main` 分支更新后，GitHub Actions 先运行类型、测试、知识评估和生产构建，再发布静态网站。学生端和教师端以演示模式打开，不需要登录或配置教学后台；演示记录保存在当前浏览器。

首页的“版本更新通知”由 `apps/web/src/features/home/releaseNotes.ts` 维护。每次发布时把新版本放在数组最前面，写明实际变更；访客关闭旧版本提示后，新版本仍会重新提醒。代码仅保存在本地不会改变公开网站，需推送到 `main` 且 Pages 发布成功后才会显示。

- 初中探索：<https://luyi210.github.io/junior-physics-virtual-lab/#/student>
- 高中实验室：<https://luyi210.github.io/junior-physics-virtual-lab/#/high-school>
- 教师演示：<https://luyi210.github.io/junior-physics-virtual-lab/#/teacher>

## 技术结构

- `apps/web`：React + TypeScript + Vite 网页端
- `apps/api`：账号、班级、教学任务、过程记录和知识检索后台
- `apps/optics-research`：光学论文研究应用
- `packages/physics`：不依赖界面的物理计算核心
- `packages/harness`：光光的学习证据、概念图谱、提示和对话规则
- `packages/knowledge`：前后端共用的教材知识与物理知识图谱
- `packages/contracts`：前后端共享的数据契约

开发前可用 `npm run architecture:check` 检查模块依赖。`npm run verify` 会执行类型检查、测试、知识检索验收和生产构建；构建也会检查架构边界。

持续开发推荐运行 `npm run quality:checkpoint`，自动保存分阶段日志并在失败时停止，支持超时与取消清理。CI配置、运行锁处理和仍需实机验收的边界见 [开发流程](docs/DEVELOPMENT_WORKFLOW.md)。

## 本地运行

安装 Node.js 24 和项目依赖后，双击 `启动格物实验室.command`，或执行：

```bash
npm run start:platform
```

默认只启动 5173 演示网页，不启动 8787 教学后台。双击 `关闭格物实验室.command` 可关闭演示网页。

确实需要真实账号与教学数据库时，可显式执行 `npm run start:platform -- --with-api`。开发调试仍可使用：

```bash
npm install
npm run dev
```

`.command` 是依赖本项目的启动脚本，不能单独复制后运行。旧版 Windows/macOS 安装包及局域网扫码体验文件已清理；产品升级后，如需桌面分发或扫码体验，应重新构建安装包或生成二维码。

教学SQLite可使用`db:backup`、`db:verify-backup`与`db:restore`创建、核验和恢复独立副本；恢复不会覆盖现库，启动器也不再自动删除旧备份。具体路径参数、数据范围和限制见[备份与恢复说明](docs/backend/SQLITE_BACKUP_RECOVERY.md)。

## 同一服务器上的独立部署

物理平台与相辉学堂计划共用服务器、分别部署。独立服务、内部端口、数据库、备份及测试入口的配置见[独立部署说明](docs/backend/INDEPENDENT_SERVER_DEPLOYMENT.md)，模板位于 `deploy/linux/`。已选定 `physics.xianghuiacademy.cn` 作为物理平台专用子域名；DNS、证书和服务器部署尚未完成，目前不能通过该地址访问。先完成独立内部部署，再开放受限测试站点。已完成的服务器只读检查范围见[第三十六阶段记录](docs/backend/ACCEPTANCE_STAGE_36.md)。

## Render 公网部署

仓库根目录的 `render.yaml` 可创建免费的 Render 网页与 API 服务，并连接免费的 Neon PostgreSQL 保存登录、班级、任务和实验记录。首次上线、GitHub Pages 连接和取消步骤见 [Render 部署与取消说明](docs/Render部署与取消说明.md)。

## 当前能力

- 最近一轮修复学生页内跳转、账号异步检查、教师创建后的分班恢复、机械能图像选择与麦克风取消清理；24个高中入口已做本机浏览器巡检，实机GPU与触屏仍待验收，见[网站修复与验证记录](docs/ACCEPTANCE_STAGE_30.md)
- 高中专区采用深空观测站风格，首页展示带体积光与轨道光迹的天体、干涉波面和量子云，支持拖动、暂停、展开观测及视角滑块；下方保留单摆、抛体和碰撞模型展台，目录、数字仪表工作台、三维环境和力力界面同步升级，见[界面升级与验证范围](docs/high-school/STAGE_28_OBSERVATORY_UPGRADE.md)
- 独立高中课程目录，24项实验的二维／三维视图、参数、适用的时间控制、图表和本机记录；包含弹簧逐级加载、共点力独立试配、机械能虚拟纸带六位置读尺与阻力对照，以及保留开关历史的电容器充放电
- 新补14项高中实验覆盖向心力、精密尺、电阻率、多用电表、碰撞、折射、电磁感应、变压器、传感器、油膜、气体、自由落体、光电效应和带电粒子；实现与验收见[补齐记录](docs/high-school/EXPANSION_ACCEPTANCE.md)
- 单摆、碰撞、多用电表与折射率的重点器材交互已升级，增加释放点、前后对照、挡位接法和精确临界角操作；24项实机验收仍未完成，见[本轮改进及验证边界](docs/high-school/STAGE_25_ACCEPTANCE.md)
- 高中柯基助手“力力”：当前实验引导、独立 AI 接口、校验后的模型上下文与异常降级；新增五张透明柯基照片轮换、手动固定、聊天时暂停和素材署名页，见[形象升级记录](docs/high-school/STAGE_29_LILI_PHOTO_AVATARS.md)
- 高中本机档案按账号、访客、演示分开；旧公共档案只读保留，切换身份时同步隔离力力上下文
- 24项开放高中实验接入班级任务与四段课堂报告；学生明确选择和预览本机读数后可加入文字副本，保存到账号供任课教师查看，原始仪器档案不自动云同步
- 课堂报告、活动会话与初中待同步操作按后台、学校和学生隔离；旧报告、其他页草稿及异常副本可显式查看和备份，刷新前草稿和未落盘正文可核对后恢复，完成实验前检查尚未同步内容
- 后台区分首次空库初始化与普通重启；现有账号、密码、停用状态及课堂数据保留，不因启动配置变化重新演示seed；规则见[后台初始化说明](apps/api/README.md#首次初始化与普通重启)
- 平台实验导航与统一工作台
- 学生开放探索首页、学科领域地图和生活问题入口
- 凸透镜探索岛：放大镜、自由光具座、照相机、人眼、视力矫正、组合透镜
- 动态声音实验：振动频率、振幅、传播波形和粒子动画
- 动态杠杆实验：力、力臂、力矩与自动扫描平衡
- 动态电路实验：串并联、电压、电阻、开关与电流粒子
- 动态沸腾实验：加热、水量、温度计、气泡和温度曲线
- 动态密度实验：天平、排水法、量筒水位和材料识别
- 所有学生模块自由进入、随时切换，无强制关卡与必做进度
- 开放发现笔记和本地自动保存
- 班级任务的结构化实验档案：学生保存预测、数据、结论与疑问，教师按任务查看并针对具体报告版本留下反馈；学生可查看反馈对应的原文，进行中的报告可自行修订。需启用教学后台，见 [实验档案说明](docs/LEARNING_RECORDS_V1.md)
- “光光”支持受限的 DeepSeek Harness 对话增强；未配置、断网或上游异常时自动回退本地物理规则
- 凸透镜、物体和光屏的组件化场景
- 拖动物体和光屏、参数精确控制
- 实像、虚像、焦点临界状态实时计算
- 三条典型光路、焦点和二倍焦距标记
- 操作撤销、重做、复位
- 实验数据记录和 CSV 导出
- IndexedDB 本地项目保存
- 后端项目接口数据契约预留

“光光”的 DeepSeek Harness 接入、API Key 和模型配置见 [配置说明](docs/光光DeepSeekHarness配置说明.md)。

## PhET 参考边界

项目参考 PhET 的模型/视图分离、场景图和独立仿真模块思想，没有复制 PhET 的 GPL 源码、界面或素材。
