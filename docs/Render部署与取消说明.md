# Render 免费部署与取消说明

项目根目录已提供 `render.yaml`，使用一个 Render Free Web Service 同时运行网页和 Node.js API。后台数据使用 Neon 免费 PostgreSQL 保存，不依赖 Render 会被清空的本地磁盘。

## 这套方案包含什么

- Render：运行网页和后台 API，选择 Free，费用为 0 美元。
- Neon：保存账号、班级、课例、任务和学生实验记录，选择 Free，费用为 0 美元。
- Render 免费服务连续 15 分钟没有请求后会休眠。下一次打开会自动唤醒，第一次进入通常需要等待约 1 分钟。
- Render 休眠、重启或重新部署不会清除 Neon 中的数据。
- 免费套餐适合展示、试用和小规模教学；正式长期使用前应配置备份并评估付费套餐。

## 第一步：创建免费数据库

1. 打开 [Neon](https://neon.com/)，注册并为正式环境新建独立的 Free 项目或空数据库。保留本地演示数据库及其已有记录，不需要删除演示账号或教学数据才能部署。
2. 在项目的 **Connect** 页面复制连接字符串，优先选择带 `-pooler` 的 pooled connection string。
3. 连接字符串类似 `postgresql://用户名:密码@主机名/数据库名?sslmode=require`。它相当于数据库密码，不要写进代码、截图或发给别人。

## 第二步：创建 Render 免费服务

1. 将本项目的最新代码提交并推送到 GitHub 的 `main` 分支。
2. 打开 [Render Dashboard](https://dashboard.render.com/)，选择 **New > Blueprint**，连接这个 GitHub 仓库。
3. Render 读取 `render.yaml` 后，确认服务方案显示 **Free**，并填写以下私密环境变量：
   - `DATABASE_URL`：上一步复制的 Neon pooled connection string。
   - `SILICONFLOW_API_KEY`：硅基流动 API Key，用于 BGE-M3 向量化与重排序；不要填写到 `VITE_*` 变量。
   - `PHYSICS_BOOTSTRAP_SCHOOL_NAME`：首次建库的学校或平台名称，去除首尾空白后为 1–160 个字符。
   - `PHYSICS_BOOTSTRAP_ADMIN_NAME`：首位管理员姓名，去除首尾空白后为 1–120 个字符。
   - `PHYSICS_BOOTSTRAP_ADMIN_EMAIL`：首次管理员的有效邮箱，最长 254 个字符；保存时去除首尾空白并转为小写。
   - `PHYSICS_BOOTSTRAP_ADMIN_PASSWORD`：12–200 个字符且不能全为空白，建议包含大小写字母、数字和符号；密码本身不会自动去除首尾空白。
4. 创建 Blueprint，等待状态变成 **Live**。
5. 打开 Render 提供的 `https://...onrender.com` 地址，用刚填写的管理员邮箱和密码登录。

Blueprint 已设置 `PHYSICS_API_SEED_DEMO=false`，并生成运行所需的 `PHYSICS_API_TOKEN_SECRET`。仅学校与用户均为空、且没有孤立用户的数据库会创建学校和首位管理员；已有账号库的重启规则见下文。首次配置无效会拒绝启动，不会先写入部分学校或管理员。

## 初始化成功后与后续重启

第一次成功启动的日志会显示 `Database: initial administrator created (<管理员邮箱>)`。此提示来自实际数据库初始化结果，不只是读取配置；日志不会输出管理员密码、密码哈希或令牌密钥，但仍包含该管理员邮箱。用配置的邮箱和密码确认能够登录后，可从 Render 环境变量中移除四项 `PHYSICS_BOOTSTRAP_*` 配置，减少长期保留初始密码；登录密码本身仍需妥善保管。若 Blueprint 再次要求填写初始配置，它们也不会改写已有账号；应用的普通重启不依赖这些值。

请持续保留 `DATABASE_URL`、`PHYSICS_API_TOKEN_SECRET` 及实际启用功能需要的运行配置。初始化密码不是令牌签名密钥：不要在清理 `PHYSICS_BOOTSTRAP_ADMIN_PASSWORD` 时移除或重新生成 `PHYSICS_API_TOKEN_SECRET`。主动轮换签名密钥会使旧访问令牌失效，需要重新登录。改连新的空数据库则必须重新提供首次管理员配置。

已有学校和用户、没有孤立用户或空身份标识，并至少有一个邮箱格式有效且密码哈希非空的管理员时，重新部署会使用现有账号。日志显示：

```text
Database: existing accounts and classroom data preserved; initialization settings were not reapplied
```

重启不会修改姓名、邮箱、密码、账号停用状态或学校归属，不会新增 `school-primary`，也不会补回已删除的演示账号、班级成员、课例和任务。代码中新添或修订的演示课例不会自动升级已有数据库，需由教师明确新建或另行审核迁移。停用管理员仍保持停用；上述完整性检查不保证已有密码能够登录。

本地开发 SQLite 在空库时默认初始化演示数据；生产环境和 PostgreSQL 默认关闭演示 seed。空 PostgreSQL 若显式设置 `PHYSICS_API_SEED_DEMO=true`，会以 `DATABASE_DEMO_UNSUPPORTED` 拒绝启动；保持 `false` 并提供正式初始化配置即可。已有合格账号库不会因演示开关变化而补种或重置，也不会通过该开关转换学校。

若出现 `DATABASE_INITIALIZATION_INCOMPLETE`，表示数据库已有学校或账号，但状态不完整。例如旧版曾创建空邮箱管理员、只有学校而没有用户、没有可识别管理员，存在学校归属缺失的用户，或学校/用户标识为空。先备份并人工核对，再安排明确的修复操作；更换 bootstrap 邮箱或密码不会自动修复旧账号，启动流程不会自动提升权限、重设密码或删库。`DATABASE_INITIALIZATION_CONFIG_INVALID` 则表示空库的首次配置不合规则，应核对上面的字段要求。

代码中的 PostgreSQL 初始化已使用同一连接的事务级 advisory lock；本轮验证是 pg-mem 兼容及 SQL 调用顺序检查，尚未完成真实 PostgreSQL 并发启动、锁等待和失败回滚验收。部署后仍需独立验证。详见[后台初始化规则](../apps/api/README.md#首次初始化与普通重启)、[修复前的审查记录](backend/INITIALIZATION_REVIEW.md)与[官方依据和验证边界](backend/INITIALIZATION_REFERENCES.md)。

## 知识向量初始化

首次同时配置 `DATABASE_URL` 和 `SILICONFLOW_API_KEY` 后，后台还会自动启用 Neon `pgvector` 并增量写入光光知识向量。可打开 `https://<你的服务>/api/health` 查看 `guangguang.rag.vector`；`ready: true` 且 `indexedChunks` 与 `totalChunks` 相同表示完成。未配置 Key 或第三方接口临时失败时，光光会继续使用本地知识图谱检索。

## 让原 GitHub Pages 地址使用同一个后台

Render 地址本身已经可以直接给别人访问。如果仍想保留原来的 GitHub Pages 地址：

1. 在 GitHub 仓库进入 **Settings > Secrets and variables > Actions > Variables**。
2. 新建变量 `VITE_API_URL`，值为 `https://<你的 Render 服务名>.onrender.com/api`。
3. 在 **Actions** 中重新运行 **Deploy website to GitHub Pages**。

这样 Render 地址和 GitHub Pages 地址会连接同一个 Neon 数据库。GitHub Pages 只承载前端；登录和数据请求仍由 Render 处理，因此后台休眠后的第一次登录也可能需要等待。

## 如何随时取消

1. 如需保留数据，先在 Neon 导出数据库。
2. 在 Render Dashboard 删除 `gewu-physics-lab` Web Service；删除后 Render 公网后台立即停止。
3. 在 Neon 删除对应项目；只有这一步才会删除云端账号和实验数据。
4. 若 GitHub Pages 不再连接后台，删除仓库变量 `VITE_API_URL`，再重新部署 Pages。

删除 Render 服务不会自动删除 Neon 数据库，两边需要分别取消。GitHub Pages 的静态网页和游客体验不依赖后台，仍可继续打开。

## 免费套餐注意事项

- 不要把 `DATABASE_URL` 或管理员密码提交到 GitHub；它们只填写在 Render 的环境变量界面。
- Render 免费额度和 Neon 免费额度都有上限，接近上限时以两家控制台的用量页面为准。
- 如果网站需要随时秒开、大量学生同时使用、自动备份或服务保障，再升级套餐；升级不会要求重写当前代码。
