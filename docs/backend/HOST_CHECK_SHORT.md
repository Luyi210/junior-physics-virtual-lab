# 腾讯云短输出检查

适用于腾讯云“执行命令”的长结果被界面截断时。以下命令只读取运行环境和候选端口，不安装软件、修改配置、启动服务，也不读取环境变量、凭据或数据库。

在目标主机执行整段，复制输出即可。不要在本机运行后把结果当成服务器状态。

```bash
python3 - <<'PY'
import shutil
import subprocess

for name in ('node', 'npm'):
    path = shutil.which(name)
    if path is None:
        print(name + ': missing')
        continue
    try:
        result = subprocess.run([path, '--version'], capture_output=True, text=True, timeout=10)
        version = result.stdout.strip() if result.returncode == 0 else 'version-check-failed'
        print(name + ': ' + path + ' ' + version)
    except Exception:
        print(name + ': version-check-failed')

for port in (18080, 18787):
    try:
        result = subprocess.run(['ss', '-H', '-ltn', 'sport = :' + str(port)],
                                capture_output=True, text=True, timeout=10)
        status = 'unknown' if result.returncode else ('listening' if result.stdout.strip() else 'not-listening')
    except Exception:
        status = 'unknown'
    print(str(port) + ': ' + status)
PY
```

`not-listening` 仅表示检查时未发现 TCP 监听，不代表已预留端口；启动前还要复核。`unknown` 或版本检查失败需要查明原因，不能按可用处理。

如需补齐服务列表，另执行以下只读命令并单独复制结果；它只列服务名，不显示启动参数或环境值：

```bash
systemctl list-units --type=service --state=running --no-legend --plain --no-pager | awk '{print $1}'
```

2026-11-11：旧巡检任务已显示成功并读到部分资源信息。后续工具读取仍发生窗口变化、屏幕捕捉失败（ScreenCaptureKit `-3811`）；本文短命令尚未在服务器执行。物理平台仍未上传或启动，原有相辉站点、DNS及防火墙未修改。


## 2026-11-12 补查结果

多行内容复制时曾丢失换行，出现 `awk` 将后续 `cat` 当作文件名的错误；改用单行 Python 收集命令后成功。Node v24.22.2、npm 11.19.1；18080/18787 无 TCP 监听。运行服务包括 nginx、ssh、tat_agent，以及 xianghui-assistant / xianghui-portrait-api / xianghui-web。用户已从该认证控制台提供 SSH 公钥；严格主机校验可通过，但本机现有密钥尚不能登录 ubuntu/root。此结果是安装前的环境观察，不代表上传、安装或服务运行完成。

## Stage43：独立站点部署前复核

选定 `physics.xianghuiacademy.cn` 后，可在已登录的腾讯云网页终端执行下面**单行只读命令**，把输出提供给部署人员。它只报告 80/443 和候选内部端口监听、Nginx 启用文件名、目标域名出现的文件名与磁盘余量；不会打印配置正文、密码或数据库。

```sh
python3 -c 'import subprocess,json; c={"ports":"ss -H -ltn \"( sport = :80 or sport = :443 or sport = :18080 or sport = :18787 )\"","nginx_files":"find /etc/nginx/sites-enabled /etc/nginx/conf.d -maxdepth 1 -type f -o -type l","target_host_files":"grep -R -l -F physics.xianghuiacademy.cn /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null","free_disk":"df -h / /var"}; print(json.dumps({k:subprocess.getoutput(v) for k,v in c.items()},ensure_ascii=False,indent=2))'
```

这只是部署前的初步筛查。文件名和端口清单不能替代管理员在服务器内检查实际 `server_name`、默认站点、完整 include 链、证书、运行账号及资源占用；无输出也不代表端口已经预留。不得把 Nginx 全量配置或其他产品的私密环境文件发到聊天中。
