# 力力助手的实现与配置

| 职责 | 文件 |
| --- | --- |
| 原创柯基图形与聊天界面 | `apps/web/src/features/high-school/assistant/` |
| 当前实验上下文 | `apps/web/src/data/highSchoolContext.ts` |
| 本机档案归属、切换与过期 | `apps/web/src/data/highSchoolRecordScope.ts` |
| 按档案决定联网或本地引导 | `apps/web/src/features/high-school/assistant/liliRequest.ts` |
| 请求与回复类型 | `packages/contracts/src/index.ts` 中 `Lili*` |
| 确定性教学引导和参数校验 | `packages/harness/src/highSchool/lili.ts` |
| 手动虚拟读数白名单及算术重算 | `packages/harness/src/highSchool/liliManual.ts` |
| 模型计算 | `packages/physics/src/highSchool/` |
| 后台 AI 服务 | `apps/api/src/lili.js` |
| 独立人格与工具限制 | `config/deepseek-harness/lili.cordis.patch.yml` |

`POST /api/lili/chat` 需要有效登录令牌。正文包含 `conversationId`、`question`、`context`；上下文为 `null` 或 `{experimentId, parameters, timeSeconds, recordCount}`。参数必须对应已开放实验的允许范围。服务端重新计算模型，不接受客户端传入的 `snapshot` 作为事实。

上下文可另带最近最多30条自动模型采样 `samples`，每条包含编号、当时参数和时刻；电容器还必须包含各自完整的开关历史。单摆/双缝/机械能纸带支持独立的 `manualRecordCount` 与最近最多10条 `manualSamples`，字段为 `id/kind/parameters/readings/timeSeconds`，不接收客户端计算结果、说明文字作为可信资料。原始读数须符合显示分辨率与保存时刻，并与当时参数一致；时刻、范围、重复编号及数量不合法时返回422。

`capacitor-charge` 当前上下文及每条采样均要求 `capacitorHistory`，含轮次、从零电压开始的完整切换事件，最多32段。服务端按固定R/C/E重放，缺历史、未来段、伪造段初电压或其他实验混入历史直接拒绝；模式、段号和校验后的历史进入模型参考。充电、断路、放电不能只用全局时间和当前参数解释。`capacitor-log-voltage-time` 按轮次及同段完整前缀分组，由重算的模型电压差拟合时间常量；断路或零电压差不能拟合。请求正文上限128KiB，仍保留30采样/32段的语义限制，不截断合法完整过程；详见[电容器设计](CAPACITOR_CHARGE_DESIGN.md)。

自动采样分析先按学生明确提出的关系筛选，再选择最多6个条件组。引用包含 `requestedRelationshipId`、每组的 `relationshipId` 与 `pointSource`；a–1/M总不能借用a–F结果，斜抛不能借用水平关系来回答下落距离—时间平方。`position-interval` 表示先由相邻位置和时刻求区间平均速度，再配到中点时间，至少需要4个不同时刻；`saved-reading` 为直接模型读数。两者都属于仿真，不能称为真实测量。

新增`spring-force`的`force-extension`关系：固定劲度系数与原长，按保存条件重算弹力和伸长量，不能用当前换过的弹簧替代历史条件。引导解释总质量含托盘、g/kg换算和x=L−L₀，明确0.25m是模型预设范围，不能推断真实弹性限度。静态当前上下文时刻规范为0；非零保存采样时刻拒绝。弹簧尚无手动读尺，相关提问不会被引向单摆/双缝仪器。接口证据见[第十三阶段记录](ACCEPTANCE_STAGE_13.md)。

手动记录仅在学生提问时附带，保存/切换条件不会触发联网。服务端按原始计时/坐标/计数作算术重算，不用理论周期、已知波长或模型亮纹位置替换学生读数。提示分别标注 `simulation-recomputed` 和 `virtual-manual`；双来源都有而问题不明确时，本地引导先让学生选择。单摆大角不估计g；周期与同条件模型偏离超过25%时提示复核，此阈值不是测量精度或操作判分标准。

机械能的`mechanical-energy-tape`保留三个参数、A/B编号及六位置共11字段。只接受已出现的内部点，B>A且共享点原始位置一致；0.1mm是显示分辨率。服务器按六读数求vA/vB、A至B的ΔK与ΔEp，不用gt或√(2gh)反填，不把A视为静止。自动`kinetic-gain-potential-loss`关系以同步静止释放点为起点，与手动区间分开；恒定向上阻力比r只是教学模型，不解释为真实空气阻力。原始负差保留并提示核对，不自动判定学生掌握。详见[机械能设计](MECHANICAL_ENERGY_DESIGN.md)。

未知本机档案状态下产生的待恢复副本，不进入自动或手动上下文。使用者核对并显式恢复到当前档案后，才随正常记录发布；异常手动副本的原始JSON备份也不会交给力力。

只有选择有效学生账号档案时，前端才请求联网帮助；访客、演示、教师入口及过期只读档案使用本地规则，不借用残留的另一入口令牌。后台未配置或不可用时也保留本地引导。回复的 `mode` 为 `guided` 或 `ai`，界面据此标注。本地规则不等同于通用大模型对话。

实验上下文绑定当前本机档案 key 与会话 revision；切换身份、退出、续期或到期会使旧上下文失效。旧页面的迟到发布/清理不能覆盖新身份，旧联网等待会被取消，回复到达后还会复核归属。只读账号允许重新发布自己的记录用于本地解释。旧v1/v2公共档案仅供显式查看导出，不发布给力力。前端令牌解析只用于本机分类，服务端仍独立校验签名和权限。

配置使用已有服务端 `DEEPSEEK_API_KEY`、provider/model 设置，并可通过 `PHYSICS_LILI_AI_ENABLED=false` 单独禁用力力联网增强。`PHYSICS_LILI_TIMEOUT_MS` 控制等待上限。密钥不进入前端构建；力力独立使用 `.runtime/lili-harness`、`.runtime/lili-workspace` 和 `lili-` 会话编号。

每个登录用户有请求速率限制，服务有有界队列；排队、初始化和执行共享同一总期限，过期排队任务不会继续启动模型。上游错误、超时、空回复和非文本回复均返回本地引导。`guided` 只说明当前回答来源，不能据此声称从未尝试联网。人格配置关闭外部工具、文件、Shell、网络搜索与子代理；它不能操作装置、读取其他学生记录或自动提交实验作业。

当前时间在播放中以约 5 Hz 同步，在暂停和单步时精确更新。后端只将校验后的参数、状态、指标、关系式、采样摘要、手动虚拟读数和警告传给 AI，不发送完整曲线或学校任务档案。手动读数进入一次提问上下文不等于同步到学校实验档案；即使模型拿到了计算数值，也必须区分仿真结果与真实测量，不依据条数断言学生理解或完成。

本轮验证以本地规则和模拟模型服务为主，真实上游 AI 的稳定性与教学质量需要在配置完成后单独验收，不因模拟测试通过而宣称已验证。
