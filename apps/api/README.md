# Physics Lab API

初中物理虚拟实验平台的本地后台 MVP。使用 Node.js 原生 HTTP 服务和 Node 24 内置 SQLite，不需要额外数据库或服务端框架。

## 启动

```bash
cd /Users/g/Desktop/初中物理实验平台软件/初中物理虚拟实验平台_V2
npm run dev:api
```

默认地址：`http://127.0.0.1:8787/api`

本地演示账号：

| 身份 | 邮箱 | 密码 |
| --- | --- | --- |
| 教师 | `teacher@physics.local` | `Teacher123!` |
| 学生（01—10） | `student01@physics.local` … `student10@physics.local` | `Student123!` |
| 管理员 | `admin@physics.local` | `Admin123!` |

十名学生均已加入“八年级（1）班”，姓名和完整账号见 [`docs/DEMO_ACCOUNTS.md`](../../docs/DEMO_ACCOUNTS.md)。这些账号只用于本地开发。部署前必须删除或替换演示账号，并设置高强度 `PHYSICS_API_TOKEN_SECRET`。

## 已实现模块

- 身份认证：scrypt 密码散列、HMAC 签名访问令牌、8 小时有效期
- 角色权限：`admin`、`teacher`、`student`
- 账号管理：管理员创建并维护教师/学生账号；教师仅维护学生；支持停用/恢复、密码重置和最近登录时间
- 学校与班级：学校隔离、班级、学生成员、入口码
- 实验课例：探究目标、问题、预测、变量、证据和反思
- 教学任务：课前、课中、课后模式；草稿、发布、关闭和归档状态
- 任务开放控制：学生只能启动属于自己班级、已发布且处于开放时间内的任务
- 实验会话：学生进入任务、批量上传事件、保存观察、完成会话
- 学生实验档案：读取本人历史会话、任务/班级/课例标题与操作、观察证据计数；不可重做任务由服务端强制限制
- 实时课堂读模型：在线会话、事件数、观察数和教师追问
- 班级报告：参与者、完成会话、事件和观察汇总
- 光光智能体：DeepSeek Harness SDK 子进程、学生/教师上下文隔离、频率限制和本地规则兜底
- 基础防护：JSON 大小限制、登录限流、CORS 白名单、请求 ID、统一错误结构

## 主要接口

```text
GET    /api/health
POST   /api/auth/login
GET    /api/auth/me
POST   /api/guangguang/chat

GET    /api/users
POST   /api/users                         # role: teacher | student（教师只能创建 student）
PATCH  /api/users/:userId/status
PATCH  /api/users/:userId/password

GET    /api/classes
POST   /api/classes
GET    /api/classes/:classId
POST   /api/classes/:classId/members
DELETE /api/classes/:classId/members/:userId
GET    /api/classes/:classId/live
POST   /api/classes/:classId/prompts
GET    /api/classes/:classId/report

GET    /api/lessons
POST   /api/lessons

GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/:taskId/status

POST   /api/sessions
GET    /api/sessions
POST   /api/sessions/:sessionId/events
POST   /api/sessions/:sessionId/observations
PATCH  /api/sessions/:sessionId/complete
```

成功响应统一为：

```json
{
  "data": {},
  "requestId": "..."
}
```

失败响应统一为：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  },
  "requestId": "..."
}
```

## 配置

| 环境变量 | 默认值 |
| --- | --- |
| `PHYSICS_API_HOST` | `127.0.0.1` |
| `PHYSICS_API_PORT` | `8787` |
| `PHYSICS_API_DATABASE` | `apps/api/data/physics-lab.sqlite` |
| `PHYSICS_API_TOKEN_SECRET` | 仅本地开发默认值 |
| `PHYSICS_API_TOKEN_TTL` | `28800` 秒 |
| `PHYSICS_API_ALLOWED_ORIGINS` | 本地 Vite 地址 |
| `DEEPSEEK_API_KEY` | 空；设置后默认启用光光 AI |
| `DEEPSEEK_BASE_URL` | DeepSeek Harness 默认地址 |
| `PHYSICS_GUANGGUANG_AI_ENABLED` | 有 Key 时为 `true` |
| `PHYSICS_GUANGGUANG_MODEL` | `deepseek-v4-flash` |
| `PHYSICS_GUANGGUANG_PROVIDER` | `deepseek-official` |
| `PHYSICS_GUANGGUANG_MAX_TOKENS` | `2048` |
| `PHYSICS_GUANGGUANG_TIMEOUT_MS` | `90000` 毫秒 |

前端可以通过 `VITE_API_URL` 指向部署后的 API；开发模式默认探测 `http://127.0.0.1:8787/api`。后台不可用时，教师端继续使用原有本地工作区，不会丢失当前演示能力。

## 测试

```bash
npm test --workspace @physics-lab/api
```

接口测试覆盖健康检查、鉴权、角色权限、账号状态与密码管理、班级/课例/任务创建、任务开放时间、学生实验事件上传、个人实验档案、完成会话写入限制、不可重做任务、课堂实时读模型和报告汇总。

## 下一阶段

当前 SQLite 适合单机演示与开发，不适合多实例生产部署。正式进入学校前建议迁移为 PostgreSQL，并增加刷新令牌、密码重置、审计日志、WebSocket 推送、文件导出、数据库备份和学校级数据保留策略。
