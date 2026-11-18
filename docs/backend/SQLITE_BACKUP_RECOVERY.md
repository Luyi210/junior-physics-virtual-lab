# SQLite 教学数据备份与隔离恢复

适用环境：项目使用的Node.js 24、单机SQLite。命令从主工程根目录执行。备份包含账号密码哈希、学校和课堂记录；应保存在有访问限制的本地或离线存储，不放进Git或公开网页。

## 创建与核验

```sh
npm run db:backup -- --source ./apps/api/data/physics-lab.sqlite --output ./.runtime/database-backups
```

`--source`必须是已经存在的SQLite数据库文件；`--output`为备份根目录。每次生成独立的`sqlite-...`目录，成功后输出其绝对路径。目录内只有`database.sqlite`与`manifest.json`，没有可单独拼接的WAL/SHM。工具不会删掉旧备份。

使用输出的单份备份目录进行核验：

```sh
npm run db:verify-backup -- --backup ./.runtime/database-backups/sqlite-替换为实际目录
```

核验检查文件摘要、完整`integrity_check`、`foreign_key_check`、schema和每张表的内容摘要，而非只判断文件能否打开。64位整数及BLOB按原类型参与摘要；manifest不写业务行、密码哈希原文或报告正文。校验和用于发现损坏或文件不匹配，不是数字签名，不能证明备份来自可信机构。

## 恢复到独立的新目录

```sh
npm run db:restore -- --backup ./.runtime/database-backups/sqlite-替换为实际目录 --destination ./.runtime/restored-classroom
```

目标目录必须不存在；已有目录、文件或同名符号链接均拒绝，没有`--force`。恢复先核验原备份，再复制到新目录，重新核验副本后才写完成标记。不会覆盖原库、修改API配置、自动启动服务或重置账号。备份源和现有教学数据库保留原状。

恢复目录最初也含`database.sqlite`与manifest。该副本一旦作为运行库启动并产生写入，原manifest就不再代表它的当前内容；再次备份应运行`db:backup`生成新一代备份，不应强行修改旧manifest来使校验通过。

确认恢复内容后，实际切换服务属于单独的运维步骤：停止正确的旧服务，保存其数据库与配置，将`PHYSICS_API_DATABASE`指向恢复副本，再按现有初始化规则启动。此工具没有执行这一切换。正式环境还需核定备份时间、允许丢失的数据窗口、账号密钥与其他资源依赖；仅恢复SQLite不包含浏览器中的本机仪器档案、未同步草稿、AI配置或外部文件。

## 为什么替换原启动器备份

旧启动器依次复制主库、`-wal`、`-shm`，随后只保留按名称排序的10个目录，且没有恢复核验。这种文件拷贝不能保证各部分来自同一提交状态；同秒目录名也可能复用。SQLite官方说明，活动事务期间直接复制数据库可能产生混合状态，因此应使用数据库提供的备份机制。[SQLite备份与损坏说明](https://www.sqlite.org/howtocorrupt.html#_backup_or_restore_while_a_transaction_is_active)

现在`start:platform -- --with-api`需要启动SQLite API时，按API实际配置的数据库路径调用相同工具，检查失败则不继续启动新API。历史备份全部保留。新空库不伪造备份；`DATABASE_URL`非空时明确提示PostgreSQL需要独立备份方案，不拿默认SQLite文件冒充它的备份。启动器的端口与进程管理流程没有在本轮整体重写。

## 实现与失败处理

核心位于`scripts/lib/sqlite-backup.mjs`，命令入口为`scripts/database-backup.mjs`；启动器路径选择在`scripts/lib/platform-backup.mjs`。源连接只读，在读事务第一次读取时确定已提交快照；使用Node内置SQLite Backup API，不逐个复制活动文件。目标是新建私有目录，随后仅对副本转成独立主文件并验证。[Node 24.14 SQLite文档](https://raw.githubusercontent.com/nodejs/node/v24.14.0/doc/api/sqlite.md)、[SQLite Online Backup API](https://www.sqlite.org/backup.html)

仅全部检查完成才写`manifest.json`成功标记。异常、损坏、外键不一致、目标冲突或写入失败均返回非零退出状态；可能留下本次不完整目录，但不会将它登记为成功或删掉旧备份。保留错误输出与不完整目录便于检查，修复原因后使用新目录重试。不要将旧裸拷贝目录补一个manifest就当成通过；旧备份是否完整仍需独立核对。

源锁等待有限；复制阶段有30秒进度截止，超时抛错取消本次native backup，不用仅停止等待的`Promise.race`掩盖仍在写入的后台任务。完整性检查和全部表摘要仍需随数据量耗时，当前没有经过大型学校数据库的容量评估。

## 验收范围

回归测试覆盖CLI、真实SQLite WAL、提交一致性、损坏与篡改检查、目标冲突及历史备份保留。真实产品HTTP恢复演练另记入[第二十一阶段验收](ACCEPTANCE_STAGE_21.md)，不能由工具测试推断生产切换已完成。

未验证断电、磁盘损坏、跨机恢复、Windows文件权限、自动异地备份或大型数据库耗时。PostgreSQL备份/恢复、并发与回滚需真实PG环境；本机目前未发现可用PostgreSQL或容器运行时，未安装或连接外部部署库。
