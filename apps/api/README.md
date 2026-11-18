# Physics Lab API

物理虚拟实验平台的教学后台。使用 Node.js 原生 HTTP 服务；本地默认使用 Node 24 内置 SQLite，设置 `DATABASE_URL` 后使用 PostgreSQL。

## 启动

```bash
cd /Users/g/Desktop/初中物理实验平台软件/初中物理虚拟实验平台_V2
npm run dev:api
```

默认地址：`http://127.0.0.1:8787/api`

首次打开空的本地开发 SQLite 库时，默认创建以下演示账号：

| 身份 | 邮箱 | 密码 |
| --- | --- | --- |
| 教师 | `teacher@physics.local` | `Teacher123!` |
| 学生（01—10） | `student01@physics.local` … `student10@physics.local` | `Student123!` |
| 管理员 | `admin@physics.local` | `Admin123!` |

首次演示初始化会将十名学生加入“八年级（1）班”，姓名和完整账号见 [`docs/DEMO_ACCOUNTS.md`](../../docs/DEMO_ACCOUNTS.md)。这些账号只用于本地开发；已有库中的账号可能已改名、改密或停用，不应把上表当成其当前登录凭据。正式部署应使用独立的正式数据库并设置高强度 `PHYSICS_API_TOKEN_SECRET`，保留原演示库及其中的教学记录，不靠删除原有数据切换环境。

## 首次初始化与普通重启

初始化策略读取数据库真实状态，不因修改环境变量而重置账号。学校与用户均为空、且没有孤立用户时才进入首次初始化；已有学校和用户、没有孤立用户，并存在邮箱格式有效且密码哈希非空的管理员时，进入普通重启。停用的管理员保持停用；这项检查确认已有管理员身份，不等于验证其能够登录。

| 数据库与状态 | 启动行为 |
| --- | --- |
| 空 SQLite，本地开发默认配置 | 一次性创建演示学校、账号、班级、课例与任务 |
| 空 SQLite，`PHYSICS_API_SEED_DEMO=false` | 校验首次管理员配置后，创建正式学校与首位管理员 |
| 空 PostgreSQL | 默认不启用演示数据；需要首次管理员配置 |
| 空 PostgreSQL，显式设置 `PHYSICS_API_SEED_DEMO=true` | 拒绝启动，错误码 `DATABASE_DEMO_UNSUPPORTED`；可改为正式初始化，或另用独立 SQLite 演示库 |
| 已有符合上述条件的账号库 | 保留学校、账号与课堂内容；不再要求或应用 bootstrap 配置，演示开关也不会触发补种 |
| 已有学校或用户，但状态不完整 | 拒绝启动并保留原有业务数据，错误码 `DATABASE_INITIALIZATION_INCOMPLETE` |

普通重启不会重置姓名、邮箱、密码或停用状态，不会增建 `school-primary`，不会补回已删除的演示账号、成员关系、课例或任务。代码中新增或修订的演示课例也不会自动覆盖、补入已有数据库；需要由教师明确新建，或另行制定并审核数据迁移。把已有演示库的开关改成 `false` 不会将其转换为一个新正式学校。

首次正式建库的配置要求：

| 环境变量 | 规则 |
| --- | --- |
| `PHYSICS_BOOTSTRAP_SCHOOL_NAME` | 去除首尾空白后为 1–160 个字符；默认“格物实验室” |
| `PHYSICS_BOOTSTRAP_ADMIN_NAME` | 去除首尾空白后为 1–120 个字符；默认“平台管理员” |
| `PHYSICS_BOOTSTRAP_ADMIN_EMAIL` | 有效邮箱，最长 254 个字符；保存前去除首尾空白并转为小写 |
| `PHYSICS_BOOTSTRAP_ADMIN_PASSWORD` | 12–200 个字符，不能全部为空白；密码本身不做去空白处理 |

空库凭据无效时返回 `DATABASE_INITIALIZATION_CONFIG_INVALID`，不会先留下学校或管理员的部分记录。确认首次初始化成功并验证管理员登录后，可从部署环境移除四项 `PHYSICS_BOOTSTRAP_*` 配置；普通重启不再需要初始密码。管理员登录密码仍应妥善保管。若改连另一个空库，需要重新提供首次配置。

登录接口支持上述最长254字符的管理员邮箱。登录、创建账号和重置密码均按输入的原始密码验证或散列，首尾空白属于密码本身；全空白和超过200字符的输入会被拒绝。已有账号不会因此重算哈希；旧版接口曾去除首尾空白的账号应使用当时实际保存的密码。

`DATABASE_URL`（或 SQLite 文件路径）和 `PHYSICS_API_TOKEN_SECRET` 属于运行配置，不能随初始化密码一并移除。令牌签名密钥应持续保留且不得回退为开发默认值；主动轮换会使旧访问令牌失效，需要用户重新登录。

服务开始监听后，只按实际结果打印以下一种数据库提示，不打印密码、密码哈希或令牌密钥；正式建库提示仍会包含管理员邮箱：

```text
Database: new SQLite demo data initialized; see API README for demo sign-in instructions
Database: initial administrator created (<规范化后的管理员邮箱>)
Database: existing accounts and classroom data preserved; initialization settings were not reapplied
```

若旧版 PostgreSQL 已留下空邮箱管理员、无管理员账号的学校或用户与学校归属不完整，不要反复改 bootstrap 值尝试“修复”。先备份并人工核对账号与学校归属，再制定明确的修复操作；当前启动流程不会自动提升权限、启用停用账号或重设密码，也不会自动删库重建。

策略实现见 [`database-initialization.js`](src/database-initialization.js)，修复前的问题记录见[初始化审查](../../docs/backend/INITIALIZATION_REVIEW.md)，事务依据与测试限制见[初始化参考说明](../../docs/backend/INITIALIZATION_REFERENCES.md)。SQLite 使用写事务保护首次初始化；PostgreSQL 使用同一连接内的事务级 advisory lock。当前 PostgreSQL 初始化验证包含 pg-mem SQL 兼容和连接调用顺序测试，真实 PostgreSQL 的并发锁等待、断连与回滚仍需单独验收。

## 已实现模块

- 身份认证：scrypt 密码散列、HMAC 签名访问令牌、8 小时有效期
- 角色权限：`admin`、`teacher`、`student`
- 账号管理：管理员创建并维护教师/学生账号；教师仅维护学生；支持停用/恢复、密码重置和最近登录时间
- 学校与班级：学校隔离、班级、学生成员、入口码
- 实验课例：探究目标、问题、预测、变量、证据和反思
- 教学任务：课前、课中、课后模式；草稿、发布、关闭和归档状态
- 课堂目录：新建课例、任务与会话校验共享的21项初中及9项开放高中入口；筹备或未知实验返回`422 EXPERIMENT_NOT_AVAILABLE`，历史记录保留
- 教师任务写入：创建和更新任务状态限于本人创建的班级，同校管理员保留管理权限
- 任务开放控制：学生只能启动属于自己班级、已发布且处于开放时间内的任务
- 实验会话：学生进入任务、批量上传事件、保存观察、完成会话
- 学生实验档案：读取本人历史会话、任务/班级/课例标题与操作、观察证据计数；不可重做任务由服务端强制限制
- 结构化实验记录：按实验会话保存预测、测量记录、结论和疑问；支持版本冲突检查和重复请求去重，教师可查看自己创建班级的任务记录
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
POST   /api/lili/chat                     # 高中力力，需要登录；未启用 AI 时返回本地引导

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
GET    /api/tasks/:taskId/records           # 班级创建教师或同校管理员
POST   /api/tasks
PATCH  /api/tasks/:taskId/status

POST   /api/sessions
GET    /api/sessions
GET    /api/sessions/:sessionId/record      # 学生本人、班级创建教师或同校管理员
PUT    /api/sessions/:sessionId/record      # 仅学生本人，且会话仍在进行中
GET    /api/sessions/:sessionId/feedback    # 学生本人、班级创建教师或同校管理员
POST   /api/sessions/:sessionId/feedback    # 班级创建教师或同校管理员
POST   /api/sessions/:sessionId/events
POST   /api/sessions/:sessionId/observations
PATCH  /api/sessions/:sessionId/complete
```

记录接口的 GET / PUT 返回 `{ session, learnerName, taskTitle, className, lessonTitle, record }`。
尚未写过记录时 `record` 为 `null`；任务记录列表也会包含这类已经开始实验的学生会话。

PUT 接收 `prediction`、`measurements`、`conclusion`、`question` 四个字符串，以及非负整数 `expectedRevision` 和唯一请求标识 `mutationId`。首次保存使用 `expectedRevision: 0`，成功后版本从 1 开始递增；后续保存传入上次读取的版本号。四段文字都允许为空，长度上限分别为 4000、12000、8000、4000 字符。

网络重试必须复用原来的 `mutationId`、版本号和正文；重复请求返回同一版本。版本过期，或同一个请求标识对应不同正文时返回 `409 RECORD_CONFLICT`，客户端应先读取新版本并由学生决定如何处理差异。已完成的会话只读，保存返回 `409 SESSION_COMPLETED`。旧版自由记录本和已有事件、观察接口保持可用。

高中课堂使用同样四段文本接口。学生明确选择、预览后加入的本机读数是文字副本，不是带类型的原始附件，也不会因采样自动写入后台。完成会话允许报告为空，不能据此推断学生已提交有效证据或教师已审核。

反馈使用独立追加表`session_learning_feedback`；健康接口新增`learning-feedback`能力。GET返回反馈数组。POST仅接收`body`、`expectedRevision`、`mutationId`，成功及完全相同的重试均返回201和原反馈。正文保留首尾空白与换行，不能全为空白，最多4000个JavaScript字符串长度单位，不接受NUL或不成对代理项；版本须为至少1的安全整数，操作编号沿用1至160位字母、数字及`. _ : -`格式。

后台通过一条条件INSERT从当前报告复制四段全文、版本和更新时间，同时核对班级归属、学校和真实作者；不接受客户端提供的快照。每条反馈还保存作者当时的姓名/角色、学校/班级/任务/会话/学生标识、正文、创建时间与操作编号。同一作者、会话、编号的相同正文和版本重试返回原反馈，即使学生后来已修改报告；复用编号提交不同内容返回`409 FEEDBACK_CONFLICT`，新操作的报告版本过期返回`409 RECORD_CONFLICT`，尚无已保存报告返回`409 RECORD_REQUIRED`。客户端应保留草稿，并重新读取、核对后再明确提交，不能静默改用新版本。

反馈不会改变学生报告版本、会话状态或重做权限；已完成或已关闭任务的已有报告仍可收到反馈，学生原报告继续只读。当前没有反馈覆盖、删除、评分、已读回执或已完成报告修订接口。旧库启动只增加表和索引，不补写演示资料；权限、迁移与验证边界见[反馈说明](../../docs/TEACHER_FEEDBACK_DESIGN.md)。

首次启动同一任务并发到达时复用活动会话：进程内按数据库、任务和学生排队；SQLite单语句条件插入避免独立连接重复创建，PostgreSQL事务锁定任务行后重读。无表结构迁移，不清除历史重复数据。真实SQLite独立连接已测试，PostgreSQL目前只有pg-mem兼容与锁顺序测试，真实多进程验收仍待完成。

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

高中柯基助手“力力”使用独立会话与人格，配置和降级行为见 [力力助手说明](../../docs/high-school/LILI_ASSISTANT.md)。

| 环境变量 | 默认值 |
| --- | --- |
| `PHYSICS_API_HOST` | `127.0.0.1` |
| `PHYSICS_API_PORT` | `8787` |
| `PHYSICS_API_DATABASE` | `apps/api/data/physics-lab.sqlite` |
| `DATABASE_URL` | 空；非空时选择 PostgreSQL，优先于 SQLite 文件配置 |
| `PHYSICS_API_SEED_DEMO` | 本地开发 SQLite 默认 `true`；生产环境或 PostgreSQL 默认 `false`；只影响首次空库初始化 |
| `PHYSICS_BOOTSTRAP_SCHOOL_NAME` / `PHYSICS_BOOTSTRAP_ADMIN_NAME` | “格物实验室” / “平台管理员”；仅首次正式建库使用 |
| `PHYSICS_BOOTSTRAP_ADMIN_EMAIL` / `PHYSICS_BOOTSTRAP_ADMIN_PASSWORD` | 空；首次正式建库时必填，规则见上文 |
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

## 备份与恢复

SQLite运维使用根目录的`db:backup`、`db:verify-backup`、`db:restore`。工具保存完整提交快照并核验，仅恢复到不存在的新目录，不覆盖运行库或自动切换服务；不会自动删除历史备份。PostgreSQL不使用这套SQLite工具。命令与边界见[备份恢复说明](../../docs/backend/SQLITE_BACKUP_RECOVERY.md)。

## 测试

```bash
npm test --workspace @physics-lab/api
```

接口测试覆盖健康检查、鉴权、角色权限、账号状态与密码管理、班级/课例/任务创建、任务开放时间、学生实验事件上传、个人实验档案、完成会话写入限制、不可重做任务、课堂实时读模型和报告汇总。

## 下一阶段

当前 SQLite 适合单机演示与开发，不适合多实例生产部署。正式学校部署可使用已有 PostgreSQL 适配器，并继续完善刷新令牌、审计日志、WebSocket 推送、文件导出、PostgreSQL及异地备份和学校级数据保留策略；真实数据库与部署环境仍需独立验收。
