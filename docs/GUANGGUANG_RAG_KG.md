# 光光 RAG 与知识图谱建设说明

## 当前版本

`kg-rag-v2` 是光光的实验状态感知检索底座；配置 Neon 与 SiliconFlow 后会自动升级为 `hybrid-context-kg-vector-rerank-v3`。它不会取代物理计算模型和本地规则，而是在调用 DeepSeek Harness 前，把学生问题、当前装置状态、操作阶段和平台知识共同用于检索与回答策略选择。

当前索引由以下已有内容组合生成：

- `packages/harness/src/conceptGraph.ts`：探究问题、前置知识、证据标准、误区、分层提示和应用连接。
- `apps/web/src/features/student/physicsKnowledgeGraph.ts`：概念词、生活问题信号、实验路由和实验间关系。
- `apps/web/src/features/student/textbookKnowledge.ts`：教材章节映射。

当前自动生成：

- 36 个实验节点；
- 365 个可检索知识片段；
- 389 个知识图谱顶点；
- 495 条带类型、带权重的关系。

## 检索流程

1. 读取问题、受众、当前实验和实时装置快照。
2. 提取控件、器材、读数、模型量、有效性问题、状态变化、观察记录和近期操作。
3. 识别安全、故障排查、步骤、证据、计算、误区、迁移、教材或概念意图。
4. 判断实验处于准备、操作、采集、观察、证据完成或反思阶段。
5. 选择 `clarify-context`、`guided-next-step`、`safety-first` 或 `answer-with-evidence` 回答策略。
6. 扩展受控同义表达，对问题、实验状态、内容类型和中文二元片段分别评分。
7. 当前实验和当前领域获得确定性上下文加权，再沿实验关系图进行一跳扩展。
8. 启用向量层后，用 `BAAI/bge-m3` 对问题和知识片段做语义召回，并与规则/KG 分数融合。
9. 用 `BAAI/bge-reranker-v2-m3` 对候选片段精排，最多选择 6 个片段传给 DeepSeek Harness，并返回最多 3 条紧凑来源。

当学生只问“现在怎么办”且没有实验上下文时，系统会要求补充一个关键事实，而不是猜测；存在装置缺口时只给一个可执行的下一步；证据完成后才转入解释和结论；危险状态始终优先安全处理。

规则/KG 入口位于 `apps/api/src/knowledge.js`，向量层位于 `apps/api/src/vector-knowledge.js`，调用注入位于 `apps/api/src/guangguang.js`。向量服务、网络或数据库异常时会自动退回 `kg-rag-v2`，不会中断光光和实验页面。

## 向量层配置

向量层复用平台的 PostgreSQL `DATABASE_URL`，在 Neon 中自动启用 `pgvector`、建立 `physics_knowledge_vectors` 表和 HNSW 余弦索引。首次启动会为当前 365 个片段批量生成向量；以后只更新内容哈希发生变化的片段。

Render 需要配置两个私密变量：

- `DATABASE_URL`：Neon pooled connection string。
- `SILICONFLOW_API_KEY`：硅基流动 API Key。

`render.yaml` 已预设模型与开关。不要把连接字符串或 Key 写进代码、前端变量、日志、截图或 GitHub。可选参数如下：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PHYSICS_VECTOR_RAG_ENABLED` | 有数据库与 Key 时启用 | 向量检索总开关 |
| `PHYSICS_VECTOR_RAG_SYNC_ON_START` | `true` | 服务启动后增量同步知识向量 |
| `PHYSICS_VECTOR_RAG_SEARCH_LIMIT` | `12` | 向量候选数 |
| `PHYSICS_EMBEDDING_BASE_URL` | `https://api.siliconflow.cn/v1` | Embedding/Rerank API 地址 |
| `PHYSICS_EMBEDDING_MODEL` | `BAAI/bge-m3` | 中文语义向量模型 |
| `PHYSICS_EMBEDDING_DIMENSIONS` | `1024` | 必须与数据库向量列一致 |
| `PHYSICS_EMBEDDING_BATCH_SIZE` | `32` | 首次建库批量大小 |
| `PHYSICS_RERANK_ENABLED` | `true` | 是否进行候选精排 |
| `PHYSICS_RERANK_MODEL` | `BAAI/bge-reranker-v2-m3` | 精排模型 |

部署后查看 `/api/health`：当 `guangguang.rag.vector.ready` 为 `true` 且 `indexedChunks` 等于 `totalChunks` 时，向量库已完成初始化。

## 可信边界

回答时必须遵守以下优先级：

1. 平台确定性物理模型与装置有效性；
2. 当前学生真实操作、读数和观察；
3. 当前课程和教师任务；
4. RAG 检索到的审核知识；
5. 生成模型的通用知识。

RAG 不能制造实验读数，不能覆盖平台计算结果，也不能把其他学生的数据作为当前学生的事实。

## 评价基线

基础六领域检索题位于 `config/knowledge/rag-evaluation-v1.json`，实验状态、意图、澄清和安全评价位于 `config/knowledge/rag-evaluation-v2.json`。当前共 33 个检索场景，自动报告 Recall@1、Recall@3、MRR 和意图识别准确率。新增知识、关系或检索算法时必须同步扩充评价集。

运行检查：

```bash
npm run typecheck
npm test
npm run knowledge:evaluate
npm run build
```

## 下一阶段

1. 把三处已有知识迁移成一个独立的权威知识包，前端、Harness 和 API 只读取生成产物。
2. 增加 `knowledge_sources`、`knowledge_relations` 和脱敏的 `retrieval_logs`，让教师可追踪引用和低置信度问题。
3. 把评价集逐步扩充到 300 题，增加向量 Recall@5、引用正确率、拒答正确率和提示层级适配测试。
4. 对低置信度、用户点踩和人工纠正建立待审核队列；只有教师审核通过的内容才能进入公共知识库，禁止运行时自动改写权威物理知识。
5. 学生长期记忆单独分区并按学校、班级和学生隔离，不写入公共物理知识库。
