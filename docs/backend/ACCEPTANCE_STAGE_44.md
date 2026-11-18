# 第四十四阶段：独立服务器预部署

日期：2026-11-12（Asia/Shanghai）。物理平台已上传、安装 Linux 依赖、构建网页并安装未启用的服务模板；尚未设置首次管理员、启动应用或解析公开。此记录不是上线证明。

## 目标主机已确认

- 用户从同一台腾讯云实例返回：`node` 位于 `/usr/local/bin/node`，解析后的实际可执行文件为 `/opt/node-v24.22.2-linux-x64/bin/node`，运行 `v24.22.2`。
- 根分区共 40G、已用 13G、可用 26G；`/srv/physics-lab` 不存在。此前确认 80/443 正在监听、候选 18080/18787 未监听，Nginx 已有相辉主域默认站点，但没有物理子域名站点。端口和资源仍需在安装当天刷新。
- 将独立 systemd 模板的 `ExecStartPre` 和 `ExecStart` 两处改为上述经确认的绝对路径。不会修改现有 Node 安装或相辉服务。目标环境安装时仍要检查该文件可执行。

## 本地候选包

- `.runtime/deployment-releases/internal-prep-20261112-stage44-host-ready.tar.gz`，4,470,142 字节，SHA-256 `013a9f8f727457e34c80ab27f0e5a1dfa3b2dc69e8e3320416c5b7a410767ed8`。733 个源码文件加 1 份清单；清单与归档逐文件 SHA-256 核对通过，未发现链接或危险归档路径。Linux 依赖和构建产物需在服务器独立安装、构建。
- 部署与打包专项测试 15/15 通过。应用源码未改；Stage43 的完整 `npm run verify` 曾通过 2765 项自动测试、类型检查、知识评测、架构检查及 Web 构建。Stage44 仅改动服务模板 Node 路径，未重做全量应用测试。
- Stage43 及更早包已过时，不应上传。Stage44 归档已由已认证的腾讯云实例文件管理上传至 `/root/internal-prep-20261112-stage44-host-ready.tar.gz`。服务器执行 `sha256sum` 返回 `013a9f8f727457e34c80ab27f0e5a1dfa3b2dc69e8e3320416c5b7a410767ed8`，与本地一致。
- 服务器创建新的 `/srv/physics-lab/releases`，将归档解压在 `internal-prep-20261112-stage44-host-ready/`，再逐一按 manifest 校验 733 个源码文件的 SHA-256，返回 `MANIFEST_OK 733`。解压时 GNU tar 对 macOS 的 provenance 扩展头给出忽略提示，但命令退出码为 0，逐文件内容核验通过。
- 重新检查安装资源：主机 `x86_64`，目标可执行文件 Node `v24.22.2`、npm `11.19.1`，内存 3.6 GiB 总量、约 2.9 GiB 可用，根分区可用 26G；`18080` 与 `18787` 仍无 TCP 监听。此检查在安装依赖前完成，启动服务前还需再次确认端口。
- 直接通过腾讯云“执行命令”运行 `npm ci` 遇到该页面 60 秒命令超时；日志没有完成标记，也无残留 npm 进程。随后在物理平台版本目录内创建受限安装脚本，通过独立 transient unit `physics-lab-stage44-npm.service` 完成安装；只读核验确认 `npm-ci.exit=0`、unit `Result=success` 且已结束。该 unit 只用于本次构建，内存上限 2G。
- 以 `VITE_API_URL=/api`、`VITE_DEMO_ONLY=false` 通过另一个临时 unit 构建正式 Web；只读核验确认 `web-build.exit=0`、unit `Result=success`、`apps/web/dist/index.html` 存在，Web 构建验收通过。
- 新建 `physics-lab` 无登录服务账号及独立 `/var/lib/physics-lab/data`。发布树仅允许该账号读取，数据目录允许写入，私有 `/etc/physics-lab/physics-lab.env` 由 root 拥有、权限 0600，账号不能读取；权限检查返回 `PHYSICS_PERMISSIONS_OK`。运行配置仍是不可通过预检的占位模板，未填写密码或密钥。`current` 指向核验过的版本。
- 已安装 `/etc/systemd/system/physics-lab.service`，`systemd-analyze verify` 成功，服务未启用、未运行，`/etc/physics-lab/deployment-reviewed` 启动许可标记不存在。相辉三个服务仍为 `active`、`nginx -t` 通过，物理端口 18080/18787 仍无监听；没有改动 Nginx、DNS 或防火墙。

## 下一步

用户已提供首次管理员邮箱，已写入服务器受限环境文件；腾讯云命令返回 `ADMIN_EMAIL_SET`，不在此文档记录个人邮箱。下一步由用户在受控服务器页面私下设置首次管理员密码与独立签名密钥；不可在聊天或命令执行记录中暴露密码。随后核验环境配置，通过预检后才创建启动许可标记、启动仅监听回环地址的物理服务，并做健康与课堂流程验收。公网子域名还须另行核验备案、证书和独立 Nginx 站点。[腾讯云文件管理说明](https://cloud.tencent.com/document/product/1207/127300)。

2026-11-13：已在本地准备一次性交互脚本 `deploy/linux/initialize-private-config.py`，3 项定向测试及语法检查通过。通过腾讯云 OrcaTerm 文件管理器单独上传到服务器 `/home/ubuntu/initialize-private-config.py`，服务器 `sha256sum` 与本地 `ee9f178abbff1089c1b8742b161ad859c771e0692df9467f45f82d94d47f2531` 一致。脚本本身不含凭据，不属于已经核验的 Stage44 发布包。OrcaTerm 已建立 `ubuntu` 会话，私有环境文件存在且 `sudo -n` 可读取；用户仍需本人在交互终端运行脚本、输入并确认新密码。当前未观察到 `PRIVATE_CONFIG_READY`，不可视为初始化完成。

随后用户返回 `PRIVATE_CONFIG_NOT_CHANGED: File or stream is not seekable.`。旧脚本在隐藏密码输入前以 `r+` 包装 `/dev/tty`，该模式要求可定位的流；此次失败未写入新凭据。OrcaTerm 只读检查已返回 `True True True`、`FD_OK` 和 `TERM_OK`，说明终端和 termios 可用。本地修正为文件描述符与 termios 检查，继续禁止 getpass 回退到可见输入；3 项测试通过。修正版 SHA-256 为 `ba94a5ace59a26cab31b625588d6962b0f81a990694721ce3d2582ba69a30839`，**尚未在服务器确认更新**。Edge 控制通道重连后仍出现 `noWindowsAvailable` 或点击无效果，不能把工具调用当作远端操作完成。

已准备 [修复命令](PRIVATE_CONFIG_REPAIR_COMMAND.txt)，供用户整份复制到腾讯云“执行命令”。它仅在旧脚本哈希符合上述值时备份并原子替换初始化脚本，核验新哈希；不会运行初始化、读写环境文件、设置密码或启动服务。更新、备份、重复执行及拒绝未知文件的本地模拟验证通过。只有远端返回 `HELPER_UPDATED ba94a5ace59a26cab31b625588d6962b0f81a990694721ce3d2582ba69a30839` 后，用户才在交互 Shell 运行初始化并私下输入密码。

用户随后返回 `HELPER_UPDATED ba94a5ace59a26cab31b625588d6962b0f81a990694721ce3d2582ba69a30839`，与修正版哈希一致，修复命令已在服务器成功完成。下一步是用户在 OrcaTerm 的交互 Shell 运行初始化、亲自输入并确认密码；尚未收到 `PRIVATE_CONFIG_READY`，服务启动仍待后续预检。
