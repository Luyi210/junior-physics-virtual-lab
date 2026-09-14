# 光光 DeepSeek Harness 配置说明

平台已经把 DeepSeek Harness 配置为“光光”的可选对话引擎。学生端和教师端仍保留原有本地规则回答；没有 API Key、Harness 启动失败、请求超时或服务不可用时，界面会自动使用本地规则，不影响实验操作。

## 本地启用

在启动 API 前设置环境变量：

```bash
export DEEPSEEK_API_KEY="你的 DeepSeek API Key"
export PHYSICS_GUANGGUANG_AI_ENABLED=true
npm run start:platform
```

不要把 Key 写入仓库、前端环境变量或 `VITE_*` 配置。Key 只由 `apps/api` 读取，并通过经过筛选的子进程环境传给 Harness。

启动后访问 `http://127.0.0.1:8787/api/health`。当响应的 `guangguang.enabled` 为 `true`，且 `capabilities` 包含 `deepseek-harness-guangguang` 时，后台配置已生效。学生或教师仍需登录，前端才会调用 AI 接口。

## Render 启用

`render.yaml` 已声明 `DEEPSEEK_API_KEY` 为私密变量，并启用 `PHYSICS_GUANGGUANG_AI_ENABLED`。在 Render 服务的 Environment 页面填入真实 Key，保存并重新部署即可。不要在 Blueprint 或 GitHub 仓库中写明 Key。

## 光光专用边界

Harness 使用 [guangguang.cordis.patch.yml](../config/deepseek-harness/guangguang.cordis.patch.yml) 覆盖 SDK profile：

- 系统人设固定为初中物理实验伙伴“光光”。
- 关闭 Shell、文件读写、文件检索、网页访问、Skills 和工作流；只开放五个受限教学子智能体。
- 使用只读 sandbox，并禁止权限升级。
- 不加载项目 `AGENTS.md`，不允许模型把自己变成代码智能体。
- 禁用 Harness 会话遥测和 DeepSeek 会话日志上传插件。
- 后台只发送当前实验的有限事件、观察、装置快照或当前教师页面证据，不发送数据库密码、Token 或 API Key。
- 相同登录用户和本地对话使用稳定的 Harness session；不同学校、用户、教师/学生身份互相隔离。

## 可选参数

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PHYSICS_GUANGGUANG_MODEL` | `deepseek-v4-flash` | Harness 模型 ID |
| `PHYSICS_GUANGGUANG_PROVIDER` | `deepseek-official` | Harness provider route |
| `PHYSICS_GUANGGUANG_DSH_PROFILE` | `sdk` | 必须包含 SDK JSON-RPC server 的 profile |
| `PHYSICS_GUANGGUANG_DSH_PATCH` | 项目内光光 patch | 自定义 Harness patch 的绝对或启动目录相对路径 |
| `PHYSICS_GUANGGUANG_DSH_HOME` | `.runtime/deepseek-harness` | Harness 会话数据目录 |
| `PHYSICS_GUANGGUANG_MAX_TOKENS` | `2048` | 单次模型输出上限 |
| `PHYSICS_GUANGGUANG_TIMEOUT_MS` | `150000` | 单轮最大等待时间（包含子智能体调用） |
| `PHYSICS_GUANGGUANG_QUEUE_LIMIT` | `8` | 单实例最大排队请求数 |
| `PHYSICS_GUANGGUANG_REQUESTS_PER_MINUTE` | `12` | 每位登录用户每分钟请求上限 |
| `DEEPSEEK_BASE_URL` | Harness 默认 | 私有或兼容 DeepSeek endpoint |
| `PHYSICS_GUANGGUANG_DSH_BIN` | SDK 同版本 `dsh` | 自定义 dsh CLI 入口 |

当前锁定 `@deepseek-ai/dsh-sdk-client@0.1.5-alpha.2`，与工作区参考源码版本一致。Harness 仍处于开发预览阶段，升级版本时应先校验配置 patch，再运行平台测试与构建。

## 自适应教学智能体团队

光光是唯一面向用户的主智能体，并按任务类型选择最少的内部角色：

| 子智能体 | 使用场景 | 输出预算 |
| --- | --- | --- |
| `experiment_diagnostician` | 实验步骤、变量控制、异常读数、误差和证据缺口 | 768 tokens |
| `learning_guide` | 学生渐进提示、探究追问和分层支架 | 640 tokens |
| `teacher_copilot` | 教师课堂证据、解释、行动建议及确认边界 | 720 tokens |
| `safety_guard` | 真实器材和现实操作的安全检查 | 480 tokens |
| `answer_critic` | 复杂候选答复的证据、教学、安全和泄露质检 | 560 tokens |

后台会根据登录身份、问题和有限实验上下文生成可信路由建议。简单问题由光光直接回答；独立专业任务可在同一轮调用，通常最多两个专家；安全、教师评价、数值结论、证据冲突或多专家合并时，再调用 `answer_critic`。每次回答总计最多调用三个子智能体。

所有子智能体都采用进程内 `spawn`、一次性前台调用。它们继承光光当前使用的 DeepSeek 模型，但使用独立上下文；不能调用任何工具、不能访问文件或网络、不能递归委派，也不直接向学生或教师输出。光光会核对并整合结果，界面仍只显示“光光”的最终回复。
