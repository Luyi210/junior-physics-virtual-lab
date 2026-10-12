# 初中物理虚拟实验平台 V2

现代化、组件化、前后端可扩展的初中物理实验平台。当前第一阶段实现网页端平台首页与凸透镜实验工作台。

## 在线访问

GitHub Pages：<https://luyi210.github.io/junior-physics-virtual-lab/>

每次更新 `main` 分支后，GitHub Actions 会自动构建并发布最新演示网页。学生端和教师端直接进入本地演示，不需要登录或配置教学后台，记录保存在当前浏览器。

- 学生演示：<https://luyi210.github.io/junior-physics-virtual-lab/#/student>
- 教师演示：<https://luyi210.github.io/junior-physics-virtual-lab/#/teacher>

## 技术结构

- `apps/web`：React + TypeScript + Vite 网页端
- `packages/physics`：不依赖界面的物理计算核心
- `packages/contracts`：未来前后端共享的数据契约

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

`.command` 是依赖本项目的启动脚本，不能单独复制后运行。已打包的桌面软件自带运行环境；分发时使用完整的 Windows 便携 `.exe` 或 Mac `.dmg` 安装包。

## Render 公网部署

仓库根目录的 `render.yaml` 可创建免费的 Render 网页与 API 服务，并连接免费的 Neon PostgreSQL 保存登录、班级、任务和实验记录。首次上线、GitHub Pages 连接和取消步骤见 [Render 部署与取消说明](docs/Render部署与取消说明.md)。

## 当前能力

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
