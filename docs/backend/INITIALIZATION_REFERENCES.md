# 数据库首次初始化：官方依据与验证边界

访问与本机核对日期：**2026-11-11（Asia/Shanghai）**。本文件服务于第十七阶段“首次初始化与普通重启分离”，不表示已完成真实 PostgreSQL 并发验收。本轮只读审阅源码、查询官方资料，并运行了独立的纯内存 pg-mem 探针；未连接、修改或重启现有数据库。

## PostgreSQL：采用事务级 advisory lock

[PostgreSQL advisory locks 官方说明](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)区分两种生命周期：session级锁即使事务回滚仍会保留，直到明确释放或会话结束；transaction级锁在事务结束时自动释放，没有独立解锁操作。锁只是应用约定，不会自动阻止不遵守该约定的其他写入者。

[官方锁函数表](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)确认，`pg_advisory_xact_lock`取得排他事务级锁，必要时等待；`pg_try_advisory_xact_lock`则立即返回是否成功。可用一个bigint或一对integer作为锁键。初始化参与者必须使用同一固定键和同一数据库，不能按当前时间、实例ID或随机值生成各自的键。

本项目适用流程是：取得专用client → `BEGIN` → 取得初始化事务锁 → **获锁后重新检查**初始化标记与既有业务数据 → 执行必要的首次建表、种子及标记 → `COMMIT`。失败则回滚，并释放client。全部语句必须走同一个client，不能用`pool.query`分派到不同连接；这一要求也由[node-postgres事务文档](https://node-postgres.com/features/transactions)明确说明。

采用边界：

- 不把“锁调用成功”当作“已经初始化”，状态判定必须在锁内重新读取。锁的作用是序列化参与本协议的初始化者，初始化标记负责区分首次与重启。
- 首次种子和标记应在同一事务中；不能先提交“已完成”标记，再异步写学校、管理员或课例。普通重启不按当前配置重写账号、密码、课例或用户报告。
- 无初始化标记但已有业务数据的旧库不能简单等同于空库；应按明确的旧库识别规则保留原业务内容，不以重启为机会补回用户已删除的演示资料。
- `ON CONFLICT DO NOTHING`只能处理相应唯一约束冲突，不能替代“检查状态＋整批初始化”的事务协议，也不代表允许重写用户数据。
- 可以按[官方`lock_timeout`说明](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT)限制等待；超时必须报告失败，不能跳过锁继续初始化。真实死锁、断连、进程退出及等待行为要由真实PostgreSQL验证。不要在生产代码里因测试替身缺少函数而忽略锁错误。

## SQLite：采用 BEGIN IMMEDIATE 与有限等待

[SQLite事务文档](https://www.sqlite.org/lang_transaction.html#deferred_immediate_and_exclusive_transactions)说明，同一数据库可有多个读事务，但同时只允许一个写事务。默认`DEFERRED`可能先读后升级写锁；升级失败会返回`SQLITE_BUSY`。`BEGIN IMMEDIATE`则在开始时尝试取得写事务，适合先取得写入权，再判断是否需要初始化；它仍可能因另一写事务存在而失败。

初始化状态、必要数据和标记应在同一写事务中处理。不能先在事务外读“空库”，等待后仍使用那个旧判断。失败应回滚已开始的事务，不留下部分种子或成功标记。`BEGIN`不支持嵌套；已有事务内需要不同设计或savepoint，不能无条件再次`BEGIN IMMEDIATE`。[SQLite官方事务规则](https://www.sqlite.org/lang_transaction.html)

[`PRAGMA busy_timeout`](https://www.sqlite.org/pragma.html#pragma_busy_timeout)和[`sqlite3_busy_timeout`](https://www.sqlite.org/c3ref/busy_timeout.html)提供按连接设置的有限等待。每个连接只有一个busy handler，设置新handler会替换旧handler；不是全应用共享的一把互斥锁，也不是保证最终成功的重试机制。超时后仍可能得到`SQLITE_BUSY`。

[busy handler官方文档](https://www.sqlite.org/c3ref/busy_handler.html)还明确：为了避免死锁，SQLite可能不调用handler而直接返回busy。因此不能把设定超时理解为“每次锁冲突必定等待指定时长”。WAL模式也没有取消同一时刻只能有一个writer的约束；遇busy、I/O或提交失败要保留失败状态，不自动改写既有业务数据。

## 本机 PostgreSQL 工具检查

只执行了`command -v psql`、`command -v postgres`、`command -v initdb`，三项在本次shell的PATH中均未找到。未安装软件、未启动数据库、未探测其他目录或远程连接。这只证明当前PATH没有这些命令，不能证明机器其他位置或外部服务绝不存在PostgreSQL。

## pg-mem 能验证什么

本项目安装版本为`pg-mem 3.0.14`。调研起点的[postgres.test.js](../../apps/api/test/postgres.test.js)、[learning-records.test.js](../../apps/api/test/learning-records.test.js)、[classroom-high-school.test.js](../../apps/api/test/classroom-high-school.test.js)使用`newDb().adapters.createPg().Pool`，并非真实PostgreSQL服务。既有课堂测试也已注明，`FOR UPDATE`顺序检查不能证明真实并发行锁。

上游[README](https://github.com/oguimbal/pg-mem#readme)将其定位为尽力模拟PostgreSQL的内存测试工具；`backup()/restore()`是供测试使用的快照机制，不能与服务端事务等同。上游[事务语句实现](https://github.com/oguimbal/pg-mem/blob/master/src/execution/transaction-statements.ts)确实接受BEGIN/COMMIT/ROLLBACK，但接受语法本身不足以证明通过createPg多次query的连接事务行为。对应adapter在线源码本轮请求超时，以下结论以本机已安装包和一次性纯内存探针为依据。

| 探针 | 本次实际结果 | 不能据此宣称 |
| --- | --- | --- |
| `SELECT pg_advisory_xact_lock(17420,1)` | 报函数不存在 | 已验证真实advisory锁等待、互斥或释放 |
| 同一createPg client分别执行`BEGIN`、`INSERT`、`ROLLBACK`后查询 | 插入行仍存在，计数为1 | 已验证失败初始化能完整回滚数据 |
| 分别执行`BEGIN`、`CREATE TABLE`、`ROLLBACK`后查询 | 新表仍存在 | 已验证PostgreSQL事务DDL回滚 |

本机包的createPg adapter把查询转交给同一内存schema；内部事务实现也对并发事务设有限制。因此新测试如果注册一个空的advisory函数、拦截查询或以快照模拟回滚，应明确标成**测试替身**：可以检查应用是否先取锁、获锁后检查标记、失败时调用回滚并释放连接，不能把这些测试当作PostgreSQL的真实锁与隔离级别验收。DDL改变后的快照恢复也不能直接假定支持，需与数据快照分开处理。

## 有意义的后续验收

1. 空库首次成功后记录初始化状态；再次打开或修改启动配置不重写既有学校、账号、密码及课程。旧库没有标记但已有业务数据时，验证保留规则。
2. 初始化中途注入失败，确认业务行和成功标记未部分提交，再用原配置重试。真实SQLite文件可直接验证；pg-mem仅能验证明确模拟的路径。
3. 两个独立初始化者并发打开同一空库，第二个必须在取得写事务或advisory锁后重读状态，最终只有一批种子。SQLite需独立连接/进程；PostgreSQL需真实服务与独立连接。
4. 超时或锁失败不得降级为无锁初始化；普通重启不得补种、删除或重写用户数据。测试专用模拟行为不进入生产分支。

本轮没有运行全量门禁，也没有启动真实PostgreSQL；实现与最终测试数量由阶段验收单独记录。
