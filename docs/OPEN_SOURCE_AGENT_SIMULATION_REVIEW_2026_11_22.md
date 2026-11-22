# 开源智能体与物理仿真学习清单

核对日期：2026-11-22。本文只采用官方仓库、官方文档与本工程当前源码作为依据。此轮没有复制第三方源码或素材，也没有新增运行依赖。

## 对照当前平台

本工程已经用 `packages/physics/` 提供确定性计算，用 `packages/harness/` 承载光光、力力的规则；`apps/api/src/guangguang.js`、`apps/api/src/lili.js` 可选调用 DeepSeek Harness。本机工作区另有**尚未提交、公开仓库暂时看不到**的 `packages/harness/src/agent/` 教学状态图草稿，涵盖题目映射、情境自测、记忆和轨迹记录。该草稿的专门测试为 6 项通过，但这只能证明已写规则的行为，不能证明任意题目理解能力或真实教学效果。旧的 `HARNESS_ARCHITECTURE.md` 记录的是无 LLM 的 v0.1 设计，不应当作今日完整能力清单。

## 选择什么来学

| 项目 | 官方证据与许可边界 | 对格物实验室有用的做法 | 本轮取舍 |
| --- | --- | --- | --- |
| [OATutor](https://github.com/CAHLR/OATutor) | 官方 README 描述知识成分、分级提示与答题记录；内容另有 CC BY 4.0 署名要求，具体文件复用前需逐项核对 | 把“概念、操作证据、误解、逐级提示”关联成结构化教学条目 | 优先学习提示结构；开放实验不按答题正误直接推断掌握程度 |
| [H5P Branching Scenario](https://github.com/h5p/h5p-branching-scenario) | 官方 README 声明 MIT；[语义定义](https://github.com/h5p/h5p-branching-scenario/blob/master/semantics.json)将分支、回退、反馈写成数据 | 让教师编排“预测→操作→检查→追问”的可选路径 | 借鉴数据结构，不引入整套 H5P 运行环境 |
| [LangGraphJS](https://github.com/langchain-ai/langgraphjs) | [MIT 许可](https://github.com/langchain-ai/langgraphjs/blob/main/LICENSE)；[持久化文档](https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/persistence.md)说明检查点、恢复和人工介入 | 将跨轮辅导的状态、工具结果和中断点保存到后端 | 有真实跨设备、长流程需求时再评估；本机同步规则图无需立即替换 |
| [OpenAI Agents SDK JS](https://github.com/openai/openai-agents-js) | [MIT 许可](https://github.com/openai/openai-agents-js/blob/main/LICENSE)；官方 README 列出工具、护栏、会话和追踪 | 参考工具输入输出校验、运行轨迹和错误回退 | 作为 LLM 服务端适配候选；先确认模型提供方、成本与学生数据边界 |
| [Mastra](https://github.com/mastra-ai/mastra) | [许可映射](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md)：核心多为 Apache-2.0，`ee/` 另受企业许可约束 | 参考工作流、评估与可观测性组织 | 属于较完整的平台层方案，不与现有 Harness 和其他编排框架叠加安装 |
| [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | 官方[安全说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md)称开发预览、尚未经过安全审计；仓库为 MIT | 学习运行轨迹、权限限制与工具边界 | 已有可选接入继续保持有限权限；不把通用命令执行能力交给公开学生聊天 |
| [myPhysicsLab](https://github.com/myphysicslab/myphysicslab) | 官方 README 与 [Apache-2.0 许可](https://github.com/myphysicslab/myphysicslab/blob/master/LICENSE)可查；提供实时交互仿真与数学解释 | 参考物理模型、数值求解、视图与图表的分层 | 适合研究新动力学模型；先在 `packages/physics/` 做独立公式与边界测试 |
| [PhET Projectile Motion](https://github.com/phetsims/projectile-motion) | [旧仓库 README](https://github.com/phetsims/projectile-motion/blob/main/README.md)明确不再维护，当前单体仓库不是现行开发底座；[模型说明](https://github.com/phetsims/projectile-motion/blob/main/doc/model.md)仍可作历史参考 | 对照轨迹历史、分量矢量、参数改变时机和测量表现 | 只借鉴交互思路，不移植旧代码或素材，也不据此宣称物理正确 |
| [CircuitJS1](https://github.com/sharpie7/circuitjs1) | 官方 [README 许可](https://github.com/sharpie7/circuitjs1/blob/master/README.md)为 GPL-2.0 或更高版本 | 研究任意电路节点、元件与示波器的设计 | 当前固定实验电路继续用自有模型；若将来要完整任意电路编辑器，先单独评估许可和架构成本 |

## 建议的落地顺序

1. **先提高辅导可信度。** 每次回答携带实验编号、当前参数、真实操作事件和模型读数；模型数值只能从 `packages/physics/` 获取。把“模型预计”“学生记录”“真实测量”分开，不靠替换几个敏感词作为唯一护栏。
2. **再提高教学适应性。** 为高频误解建立“证据要求→一级提示→二级提示→操作验证→反思”数据表，先在凸透镜、欧姆定律、单摆各做一条完整路径。提示要根据实际操作推进，不以聊天轮数代表学会。
3. **最后考虑重型编排。** 只有当后台需要跨设备恢复、多步工具调用、教师审核或大量会话追踪时，再选一个服务端框架做小规模试验；不要同时引入 LangGraphJS、Mastra 和 Agents SDK。

下一轮可以做一组教学验收题：同一概念分别输入正确理解、典型误解、数据不足和超出模型范围的问法，核查两位助手是否会给出不同而可验证的下一步。任何开源项目的星标、演示效果或许可证都不能替代这项验收。
