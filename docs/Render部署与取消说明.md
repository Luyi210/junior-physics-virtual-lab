# Render 免费部署与取消说明

项目根目录已提供 `render.yaml`，使用一个 Render Free Web Service 同时运行网页和 Node.js API。后台数据使用 Neon 免费 PostgreSQL 保存，不依赖 Render 会被清空的本地磁盘。

## 这套方案包含什么

- Render：运行网页和后台 API，选择 Free，费用为 0 美元。
- Neon：保存账号、班级、课例、任务和学生实验记录，选择 Free，费用为 0 美元。
- Render 免费服务连续 15 分钟没有请求后会休眠。下一次打开会自动唤醒，第一次进入通常需要等待约 1 分钟。
- Render 休眠、重启或重新部署不会清除 Neon 中的数据。
- 免费套餐适合展示、试用和小规模教学；正式长期使用前应配置备份并评估付费套餐。

## 第一步：创建免费数据库

1. 打开 [Neon](https://neon.com/)，注册并新建一个 Free 项目。
2. 在项目的 **Connect** 页面复制连接字符串，优先选择带 `-pooler` 的 pooled connection string。
3. 连接字符串类似 `postgresql://用户名:密码@主机名/数据库名?sslmode=require`。它相当于数据库密码，不要写进代码、截图或发给别人。

## 第二步：创建 Render 免费服务

1. 将本项目的最新代码提交并推送到 GitHub 的 `main` 分支。
2. 打开 [Render Dashboard](https://dashboard.render.com/)，选择 **New > Blueprint**，连接这个 GitHub 仓库。
3. Render 读取 `render.yaml` 后，确认服务方案显示 **Free**，并填写以下私密环境变量：
   - `DATABASE_URL`：上一步复制的 Neon pooled connection string。
   - `SILICONFLOW_API_KEY`：硅基流动 API Key，用于 BGE-M3 向量化与重排序；不要填写到 `VITE_*` 变量。
   - `PHYSICS_BOOTSTRAP_SCHOOL_NAME`：学校或平台名称。
   - `PHYSICS_BOOTSTRAP_ADMIN_NAME`：首位管理员姓名。
   - `PHYSICS_BOOTSTRAP_ADMIN_EMAIL`：管理员登录邮箱。
   - `PHYSICS_BOOTSTRAP_ADMIN_PASSWORD`：至少 12 位，建议包含大小写字母、数字和符号。
4. 创建 Blueprint，等待状态变成 **Live**。
5. 打开 Render 提供的 `https://...onrender.com` 地址，用刚填写的管理员邮箱和密码登录。

首次启动时后台会自动建表和创建首位管理员。以后重新部署不会覆盖已有账号和教学数据。

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
