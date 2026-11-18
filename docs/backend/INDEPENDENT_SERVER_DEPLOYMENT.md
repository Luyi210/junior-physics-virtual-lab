# 物理平台独立部署模板（已安装未启动）

核对日期：2026-11-12（Asia/Shanghai）。用户已选择 `physics.xianghuiacademy.cn` 作为物理平台专用子域名；尚未核验其 DNS 管理权、备案接入状态和证书，也未创建解析或启用站点。用户先前从腾讯云检查并提供结果：Node v24.22.2、npm 11.19.1；检查时 18080/18787 没有 TCP 监听；现有相辉的 assistant、portrait-api、web 服务均在运行。服务器根分区可用 26G、内存可用约 2.9Gi。主机 ED25519 公钥已通过认证控制台取得并用于严格 SSH 校验；本机现有密钥登录 ubuntu/root 均被拒绝。当前已通过受控的腾讯云 Edge 页面上传并逐文件验证 Stage44 发布包，安装 Linux 依赖、构建 Web，创建独立服务账号与数据目录，安装并校验未启用的 systemd 模板；尚未初始化账号或启动服务，未修改相辉站点、DNS 或防火墙。

物理实验平台与相辉学堂是两个产品。可以共用主机，但不共享应用目录、服务账号、数据库、令牌密钥、备份或站点配置。物理平台只使用所选的 `physics.xianghuiacademy.cn`；相辉主域和其他子域保持原有配置。当前方案先以回环地址运行，操作人员需要浏览器检查时使用 SSH 本地隧道；不直接开放应用端口。子域名的选择本身不会产生网站或改变现有服务。

## 先接入服务器，再开放测试网站

用户目前选择先准备物理平台的服务器部署，继续修改产品，之后再开放测试入口。按以下顺序分别验证：

1. **服务器准备**：只读核对现有服务和端口，准备独立 Node 24、版本目录、Linux 依赖和构建产物。此时不改主站、不配测试域名、不开放公网入口。
2. **内部运行**：安全配置首次管理员与独立数据库，经过启动预检后仅监听回环地址，核验健康接口及课堂流程。上传文件、安装依赖不等于后台已经运行。
3. **测试入口**：发布用户准备验收的版本，再为 `physics.xianghuiacademy.cn` 完成 DNS、所需备案核验、匹配证书和独立 Nginx 站点，并配置整个测试站点的访问限制。学生/教师账号登录不能代替整个网站的访问限制，因为实验探索页面可以匿名浏览。

本地开发中的改动不会自动同步到服务器；每次发布应使用明确的版本包，保留上一个版本和数据备份。当前没有建立自动上传或自动发布任务。

## 准备可核验的源码包

在主工程运行 `node deploy/linux/create-release.mjs`，会生成唯一的 `.runtime/deployment-releases/<id>/source/` 和最后写入的 `manifest.json`。也可用 `--id` 指定一个未使用的版本名；同名输出不会被覆盖。该工具只做本地文件复制，不安装依赖、构建、上传或启动服务。

工具按固定清单收集七个 workspace、构建配置、公开素材和部署文件，逐项记录大小和 SHA-256；不依赖 Git 跟踪状态，包含尚未提交的源码修改。环境文件、`.local`、数据库、备份、日志、依赖和构建目录、符号链接等均在读取内容前排除。文件名排除不等于检测普通源码里硬编码的秘密，上传前仍须复核清单。新增 workspace 或修改目录结构时先更新允许清单。

专项检查：`node --test deploy/linux/create-release.test.mjs deploy/linux/preflight.test.mjs`。Stage35 和 Stage43 旧候选包已过时。Stage44 包为 `.runtime/deployment-releases/internal-prep-20261112-stage44-host-ready.tar.gz`，大小 **4,470,142 字节**，SHA-256 为 `013a9f8f727457e34c80ab27f0e5a1dfa3b2dc69e8e3320416c5b7a410767ed8`，含 733 个源码文件及一份清单；同目录 `.verification.json` 已记录清单和归档的逐项核验。此版本将 Unit 的两处 Node 路径对齐到目标主机已确认的 `/opt/node-v24.22.2-linux-x64/bin/node`。服务器已通过腾讯云文件管理将此包上传至 `/root`，服务器端 SHA-256 匹配，已解压至 `/srv/physics-lab/releases/internal-prep-20261112-stage44-host-ready/`，并逐文件验证 manifest 返回 `MANIFEST_OK 733`。源码包本身不含 `node_modules` 或 `apps/web/dist`；服务器已在该版本目录完成 Linux 依赖安装与正式 Web 构建，服务未启动，域名未公开。后续本地源码变更不会自动同步此已上传包，需另建版本发布。

每个新压缩包顶层是其唯一 `<release-id>/`，其中 `manifest.json` 与 `source/` 并列。解压至 `/srv/physics-lab/releases/` 后，应用根目录为 `/srv/physics-lab/releases/<release-id>/source/`；安装依赖、构建和 `current` 软链接均使用这一层，不能指向只有清单与 `source/` 的外层目录。

## 模板与隔离路径

| 文件 | 用途和默认阻断 |
| --- | --- |
| [physics-lab.service](../../deploy/linux/physics-lab.service) | 独立 systemd 服务；不存在 `/etc/physics-lab/deployment-reviewed` 时跳过启动。模板没有执行安装/启用。 |
| [environment.example](../../deploy/linux/environment.example) | 仅示例，AI、演示数据、外部向量库关闭；密钥为不能通过预检的占位，首次管理员字段为空。 |
| [preflight.mjs](../../deploy/linux/preflight.mjs) | 启动前只读检查配置和发布文件。不会打开 SQLite、监听端口、安装或写系统配置；拒绝未填写密钥及不符合本模板的配置。 |
| [nginx-new-domain.conf.example.disabled](../../deploy/linux/nginx-new-domain.conf.example.disabled) | 已填入所选专用子域名的 HTTPS 示例，**所有指令均为注释**，误 include 也不产生站点。不能替换默认站点或相辉站点；受限测试阶段须启用整站访问限制。 |

建议固定布局：

```text
/opt/node-v24.22.2-linux-x64/bin/node    已由用户从目标主机确认的 Node 24 可执行文件
/srv/physics-lab/releases/<release-id>/  发布包外层，含 manifest.json 与 source/
/srv/physics-lab/releases/<release-id>/source/  完整应用根目录，每版保留
/srv/physics-lab/current                指向当前版本 source/ 的软链接
/etc/physics-lab/physics-lab.env         私有运行配置，root:root 0600
/etc/physics-lab/deployment-reviewed    完成人工复核后才创建的启动许可标记
/var/lib/physics-lab/data/               独立 SQLite 数据目录
/var/lib/physics-lab/restores/<id>/      恢复时新建的副本目录
/var/backups/physics-lab/                独立受限备份根目录，不在网站目录
```

`physics-lab` 是待管理员创建的独立无交互登录服务账号；不能复用相辉的运行账号。发布内容由管理员/部署账号管理，服务账号只能读取；`/var/lib/physics-lab` 和其运行数据子目录需允许该服务账号写入，备份目录仅授予执行备份的受信任操作人员。不要把数据目录或数据库软链到另一个产品。systemd 的只读文件系统设置不替代目录权限。

源码包工具生成的文件权限为 `0600` 或 `0700`；本机 UID/GID 和这些权限都不能直接作为 Linux 服务权限。解压时不继承本机属主编号；安装、构建后核对发布目录由管理员/部署账号拥有，`physics-lab` 组可读取文件、遍历全部父目录但不可写入。可采用目录 `0750`、普通文件 `0640`、需要执行的文件 `0750`；不要一律去掉依赖工具的执行位。私有环境文件仍为 `root:root 0600`，数据目录另授服务账号写权限，仅调整物理平台独立路径。

候选端口是 **Web `127.0.0.1:18080`、API `127.0.0.1:18787`**。2026-11-12 00:27:52（Asia/Shanghai）检查时无 TCP 监听；未预留，启动前仍须复核。不要添加安全组或防火墙放行规则；若占用，选择另一对经检查的端口，并同步环境文件、隧道与未来 Nginx 上游。不要停止占用端口的未知进程。

## 部署前的只读核对

已取得的部分资源信息见开头；优先用[短输出检查](HOST_CHECK_SHORT.md)补齐 Node/npm、候选端口和服务列表。以下保留完整核对清单，不代表各项均已通过；资源和端口在实际启动前还需复核：

```bash
uname -m
cat /etc/os-release
command -v node
node --version
systemctl --version
systemctl list-units --type=service --state=running --no-pager
ss -ltnp
ss -ltnp '( sport = :18080 or sport = :18787 )'
df -h /srv /var/lib /var/backups
free -h
```

同时核对现有网站配置的拥有者、实际 include 路径、监听地址、资源余量和备份位置。按主机现有权限只读查看，不把配置/日志/环境原文发到公共聊天或 Git；不要读取相辉数据库或改变其服务。这里不提供 `nginx -T` 全量输出收集命令，也不运行端口清理工具。

用户从目标主机确认 `node` 经符号链接解析为 `/opt/node-v24.22.2-linux-x64/bin/node`，版本为 v24.22.2；Unit 现使用该绝对路径。安装前仍须复核路径、可执行权限和实际版本，确保在 systemd 的服务账号下可读取/执行。该主机运行时是已存在的共享依赖，不改动其安装、链接或其他产品服务。不要依赖交互 shell 的 nvm、`~/.bashrc` 或不确定的 `/usr/bin/node`；`ProtectHome=true` 也不适合从个人 home 目录启动 Node。现项目声明 `>=24 <25`，后端使用 Node 内置 SQLite；预检拒绝其他主版本。

## 发布内容与首次初始化

1. 为物理平台准备新的带版本目录；只带项目源码、配置模板、锁文件和必要资产，排除 `.env*`、旧 SQLite、`.runtime/`、本机未同步档案、日志及另一产品文件。不要把 macOS 的 `node_modules` 当成 Linux 依赖包。
2. 在隔离发布版的 `source/` 应用根目录，使用已核验的独立 Node 24 安装锁定依赖并构建；让该 Node 的 `bin` 位于本次命令的 PATH 前端，确保 npm 及依赖安装脚本也使用同一运行时，不替换其他产品的 Node。下面是准备步骤，不会由模板自动执行：

   ```bash
   npm ci --include=dev
   VITE_API_URL=/api VITE_DEMO_ONLY=false npm run build --workspace @physics-lab/web
   ```

   使用完整 monorepo，保留 `apps/api`、`packages`、根 `node_modules` 及 workspace 链接、`scripts`、`config`、`apps/web/dist`。这里需要 `apps/web/dist`，不能只拷贝为其他托管平台生成的根 `dist/client`。`VITE_*` 是构建期配置，修改 systemd 环境文件不能改变已经打包的浏览器代码。准备阶段应完成项目要求的质量检查；本模板不宣称未经构建的源码可直接上线。
3. 检查发布版 `serve-render.mjs` 已包含 `process.env.PHYSICS_WEB_HOST ?? "0.0.0.0"` 覆盖逻辑。本模板强制传 `127.0.0.1`；旧版忽略该值会暴露 Web，不能混用。启动器同时管理网页和 API，API 固定回环，网页将 `/api` 转发至该内部 API；不使用开发 Vite 服务器。
4. 管理员在服务器私有配置管理流程中创建 `/etc/physics-lab/physics-lab.env`，参考 example，权限为 root:root 0600。令牌密钥应由密码管理器或系统安全随机源生成 **32 字节随机数的 64 位十六进制编码**；不要复制示例占位、在聊天发送、写进提交、通过命令行参数传递或输出到日志。API 当前通过环境变量接收凭据；受限 EnvironmentFile 是兼容方案，并不等于凭据保险库。环境会传给子进程，root/具备进程检查权限的用户仍可能读取；不要使用 `systemctl show ... Environment` 或 `printenv` 收集诊断。systemd 官方优先建议 credentials 机制，后续采用需要适配应用的读取方式。[systemd 环境与凭据说明](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.exec.xml)
5. 新正式库使用 `PHYSICS_API_SEED_DEMO=false`，安全注入学校名称、管理员名称、邮箱及 12–200 字符的初始密码。字段规则和失败行为见 [初始化说明](../../apps/api/README.md#首次初始化与普通重启)。首次成功建库并验证管理员身份后移除 `PHYSICS_BOOTSTRAP_*`，保留签名密钥和数据库路径。不能通过改 bootstrap 来覆盖已有管理员；也不能将相辉或本地演示库当成新正式库。
6. 预检不读取数据库内容：若文件尚不存在，要求 bootstrap 字段已填写；已有文件是否为空、归属完整、是否需迁移，仍由后端正式初始化策略核对。已有库启动可能执行结构迁移，不能称启动绝对只读；升级前必须备份。密钥轮换会使旧令牌失效，不能每次发布生成新密钥。

EnvironmentFile 不是 shell 脚本，变量不会按 shell 的 `$VAR`/命令替换规则展开；有空白/特殊字符的密码需按 systemd 文件规则正确引用。不要 `source` 未审核配置，也不要把示例中的空 bootstrap 字段当成可用凭据。

## 人工启用与检查（以后执行）

用户已授权物理平台内部接入。电脑控制工具此前曾禁止操作腾讯云页面，但本次已成功操作 Edge 的腾讯云“文件管理”和“执行命令”完成上传、校验、解压、依赖安装和 Web 构建；后续仍以工具实际可用状态为准。首次管理员邮箱已写入服务器受限环境文件；密码与独立签名密钥仍由用户在私下流程设置，不能经聊天传递。独立 unit 已安装到 `/etc/systemd/system/physics-lab.service`，`current` 已指向核验版本 `source/`，`systemd-analyze verify` 成功并已 `daemon-reload`；unit 未启用、未运行，`deployment-reviewed` 标记不存在。配置、两端口及现有服务再核验后，才创建 root 管理的启动许可标记并启动 `physics-lab.service`。启动并通过健康检查、课堂流程检查后，再考虑开机启动。当前不能将准备完成写成服务已运行。

2026-11-13 已上传并核验的旧初始化脚本（SHA-256 `ee9f178abbff1089c1b8742b161ad859c771e0692df9467f45f82d94d47f2531`）在读取密码前返回 `PRIVATE_CONFIG_NOT_CHANGED: File or stream is not seekable.`，没有写入凭据。[交互初始化脚本](../../deploy/linux/initialize-private-config.py) 已修正终端检查，修正版 SHA-256 为 `ba94a5ace59a26cab31b625588d6962b0f81a990694721ce3d2582ba69a30839`。用户运行 [修复命令](PRIVATE_CONFIG_REPAIR_COMMAND.txt) 后返回匹配该哈希的 `HELPER_UPDATED`，服务器脚本已更新。下一步由用户在 OrcaTerm Shell 亲自运行 `sudo -n python3 /home/ubuntu/initialize-private-config.py` 并输入两次新密码。初始化脚本不在 Stage44 发布包中，在服务器本地生成签名密钥，不输出密码或密钥。只有出现 `PRIVATE_CONFIG_READY` 后才继续预检；目前尚未确认初始化完成。不要通过“执行命令”批处理运行初始化脚本。

`Type=exec` 只证明主程序已成功执行，不代表数据库初始化或 HTTP 就绪；必须进一步检查：

```bash
systemctl is-active physics-lab.service
systemctl status physics-lab.service --no-pager
systemctl show physics-lab.service -p MainPID -p SubState -p FragmentPath
journalctl -u physics-lab.service -n 60 --no-pager
ss -ltnp '( sport = :18080 or sport = :18787 )'
curl --fail --silent --show-error http://127.0.0.1:18080/api/health
curl --fail --silent --show-error -I http://127.0.0.1:18080/
```

核对服务 PID/cgroup、两个监听地址确实是 `127.0.0.1`、健康 JSON 为 `physics-lab-api`、数据库类型符合预期、AI 关闭，以及日志实际报告 `bootstrap` 或 `existing`。现有库不应报告演示初始化。不满足时停止本物理服务并核对，不能把网站首页可打开当成后端成功。日志可能含管理员邮箱，只在受控环境查看。

在专用子域名尚未启用时，可在操作者电脑使用经过确认的 SSH 账号/主机：

```bash
ssh -N -L 127.0.0.1:18080:127.0.0.1:18080 DEPLOY_USER@SERVER_IP
```

再访问 `http://127.0.0.1:18080/`。这不是给学生公开使用的发布地址；无须修改 Nginx 或开放上述端口。局部隧道中的浏览器存储以该本机 origin 为边界，未来正式域名不会自动继承浏览器本机档案，需要使用既有显式导出/恢复流程。

## 备份、升级与回滚

使用项目已有 SQLite 一致性工具，不能直接拼接复制活动中的 `.sqlite/-wal/-shm`。以下路径中的 `BACKUP_ID` / `RESTORE_ID` 需人工替换，命令不自动寻找“最新”备份：

首次恢复前，由管理员创建受控的 `/var/lib/physics-lab/restores` **父目录**；恢复工具要求父目录已存在，而最后一级 `RESTORE_ID` 必须不存在。不要预先创建 `RESTORE_ID`。

```bash
/opt/node-v24.22.2-linux-x64/bin/node /srv/physics-lab/current/scripts/database-backup.mjs backup --source /var/lib/physics-lab/data/physics-lab.sqlite --output /var/backups/physics-lab
/opt/node-v24.22.2-linux-x64/bin/node /srv/physics-lab/current/scripts/database-backup.mjs verify --backup /var/backups/physics-lab/BACKUP_ID
/opt/node-v24.22.2-linux-x64/bin/node /srv/physics-lab/current/scripts/database-backup.mjs restore --backup /var/backups/physics-lab/BACKUP_ID --destination /var/lib/physics-lab/restores/RESTORE_ID
```

若已经切换数据库位置，备份 `--source` 必须取当前已核验的 `PHYSICS_API_DATABASE`，不能继续备份上述旧默认文件。备份包含账号哈希和课堂资料，应限制目录访问并按明确保留策略复制到受保护的异地位置；本模板没有自动异地上传、定时删除或备份任务。源库可以活跃 WAL 下备份，副本经完整检查后才登记成功；时间点、恢复范围和容量限制见 [SQLite 备份恢复说明](SQLITE_BACKUP_RECOVERY.md)。

每次升级：先保留当前发布版本、运行配置和经核验备份，再准备新的不可变发布目录。维护窗口停止 **physics-lab.service**，核实其监听已关闭，切换 `current` 到确认的新版本并启动，重新做健康/页面/课堂流程检查。不要用通配进程杀除，也不要操作相辉服务。若只回退代码且旧版本兼容当前数据库 schema，可停止物理服务后将 `current` 指回旧版本；数据目录不移动。未知迁移兼容性不能凭“旧版能启动”判定安全。

需要数据回退时，先对当前故障状态再备份，恢复到**不存在的新目录**，保留旧库和旧备份。人工核验副本及运行账号权限后，停止物理服务，在私有环境文件中将 `PHYSICS_API_DATABASE` 指向 `.../RESTORE_ID/database.sqlite`，再启动兼容的发布版。不得覆盖运行库或将旧 WAL 拼到副本上。恢复后的写入不会继续匹配恢复时 manifest；再次备份应生成新备份包。恢复会丢失所选备份时间点之后的业务变更，需由数据负责人确认。仅 SQLite 不包含环境密钥、浏览器本机草稿/仪器档案和其他外部资源。

工具生成的恢复目录权限为 0700、文件为 0600，归运行工具的账号所有（可能是 root）。核验后，管理员需把**这一个新恢复目录及其中的 `database.sqlite`、`manifest.json`** 的属主/属组授予 `physics-lab:physics-lab`，保留受限权限，使 SQLite 能在同目录创建 WAL/SHM；不要递归改变原数据库、备份根目录或其他产品的权限。授权完成后才切换运行配置。

## 已选子域名与 Nginx 边界

已选择 `physics.xianghuiacademy.cn`，本地预检只允许该 HTTPS origin 和与当前 Web 端口匹配的 `127.0.0.1` 隧道 origin；它拒绝相辉主域、其他子域和通配来源。这不代表已取得 DNS 管理权、备案接入条件或证书。腾讯云说明，已在腾讯云备案的二级域名对应的三级域名一般无需单独备案，但使用境内服务器时仍须确认主域备案及腾讯云接入状态；现有备案服务名对应另一产品，还须核对物理平台的实际服务内容与备案信息是否需要变更，不能仅凭“子域名免单独备案”直接对外解析或公开。[腾讯云备案场景](https://cloud.tencent.com/document/product/243/19630)、[备案信息变更与服务名称](https://cloud.tencent.com/document/product/243/73180)。上述事项、现有 Nginx 站点的 `server_name`/默认站点/监听配置，以及整站受限访问方案都核验后，才考虑启用示例。新建独立站点文件，不更改相辉的 `server_name`、上游、证书、路由和默认站点；示例不设 `default_server`，但仍须核实现有默认站点及监听配置，不能仅凭没有该指令就保证不会影响无匹配 Host 的请求。

人工替换证书占位、取消必要注释，受限预览阶段启用示例中的整站 Basic Auth 并在服务器私有位置准备其密码文件；审查配置差异，`nginx -t` 通过后才执行明确的 reload。若选用其他整站访问限制，也必须先验证匿名实验页无法绕过；正式公开时再按计划移除限制。Nginx 代理全部路径到独立回环 Web，由 Web 转发 API，不能把两个产品拼进同一应用路由。`PHYSICS_API_ALLOWED_ORIGINS` 已在示例中列出精确 HTTPS origin 与内部隧道 origin；绝不使用父域或通配域。Nginx 的 180 秒读取超时、2 MiB 请求上限不扩大应用内部限额；当前关闭 AI，不宣称已验证在线 AI 的超时链路。[Nginx 反向代理](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)、[Nginx HTTPS](https://nginx.org/en/docs/http/configuring_https_servers.html)、[监听与默认站点](https://nginx.org/en/docs/http/ngx_http_core_module.html#listen)

## 核对依据与本轮限制

已读取本地启动器、API配置/初始化、备份实现和文档；已核对官方 systemd v255 文档源码的 `Type=exec`、`EnvironmentFile`、`ProtectSystem`/`ReadWritePaths`、退出 cgroup 以及条件启动语义。在线 man 镜像访问超时，使用官方仓库同版本原文；目标主机仍需以其安装版 `systemd-analyze verify` 实测。[systemd service](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.service.xml)、[systemd exec](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.exec.xml)、[systemd kill](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.kill.xml)、[systemd unit](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.unit.xml)

本机没有 `systemd-analyze` 或 `nginx`，因此没有宣称通过 Ubuntu unit/Nginx 原生校验、真实启动、TLS、服务器容量、端口空闲或跨产品隔离实机验收。本轮校验仅为本地模板/脚本语法与合成配置的拒绝路径；没有读取 `.env`、密钥或现有数据库。全注释 Nginx、缺省启动许可标记与密钥预检，均不能代替目标环境核实、私密配置及实际启动检查。

本地部署专项检查覆盖 Node 24、合法基线、密钥占位、精确子域名、主域/兄弟子域/伪造来源拒绝、公网绑定/端口冲突、演示与付费配置、独立路径和全注释 Nginx；只用公开 example 和合成值。测试通过不表示目标主机 unit、Nginx、DNS、TLS 或服务已验证；定向测试位于部署目录，不自动计入现有工作流测试 glob。
