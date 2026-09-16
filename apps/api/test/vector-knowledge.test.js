import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { createSiliconFlowClient, createVectorKnowledgeService, vectorKnowledgeInternals } from "../src/vector-knowledge.js";

test("SiliconFlow client uses the documented embedding and rerank payloads", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if (url.endsWith("/embeddings")) {
      return { ok: true, json: async () => ({ data: [
        { index: 1, embedding: [0.4, 0.5, 0.6] },
        { index: 0, embedding: [0.1, 0.2, 0.3] }
      ] }) };
    }
    return { ok: true, json: async () => ({ results: [{ index: 1, relevance_score: 0.91 }] }) };
  };
  const client = createSiliconFlowClient(loadConfig({
    siliconflowApiKey: "test-only-key",
    embeddingDimensions: 3,
    embeddingTimeoutMs: 2_000,
    rerankEnabled: true
  }), { fetchImpl });

  assert.deepEqual(await client.embed(["甲", "乙"]), ["[0.1,0.2,0.3]", "[0.4,0.5,0.6]"]);
  assert.deepEqual(await client.rerank("问题", ["文档甲", "文档乙"], 2), [{ index: 1, relevance_score: 0.91 }]);
  assert.equal(calls[0].url, "https://api.siliconflow.cn/v1/embeddings");
  assert.equal(calls[0].body.model, "BAAI/bge-m3");
  assert.deepEqual(calls[0].body.input, ["甲", "乙"]);
  assert.equal(calls[1].url, "https://api.siliconflow.cn/v1/rerank");
  assert.equal(calls[1].body.model, "BAAI/bge-reranker-v2-m3");
  assert.equal(calls[1].body.return_documents, false);
});

test("fusion keeps deterministic context scores while adding vector and rerank evidence", () => {
  const local = { results: [
    { sourceId: "a", title: "反射", section: "方法", content: "调整入射角", score: 70, reasons: ["当前实验"], scoreBreakdown: { context: 48 } },
    { sourceId: "b", title: "折射", section: "证据", content: "记录折射角", score: 60, reasons: ["关键词"], scoreBreakdown: { question: 20 } }
  ] };
  const vector = [
    { sourceId: "b", title: "折射", section: "证据", content: "记录折射角", similarity: .94 },
    { sourceId: "c", title: "透镜", section: "概念", content: "焦距与成像", similarity: .82 }
  ];
  const firstPass = vectorKnowledgeInternals.mergeResults(local, vector, [], 3);
  const rerank = [{ index: firstPass.findIndex((item) => item.sourceId === "b"), relevance_score: .99 }];
  const fused = vectorKnowledgeInternals.mergeResults(local, vector, rerank, 3);
  assert.equal(fused[0].sourceId, "b");
  assert.ok(fused[0].reasons.includes("BGE-M3语义召回"));
  assert.ok(fused[0].reasons.includes("BGE重排序"));
  assert.equal(fused[0].vectorSimilarity, .94);
  assert.equal(fused[0].rerankScore, .99);
});

test("vector service stays disabled without cloud secrets and preserves local retrieval", async () => {
  const service = createVectorKnowledgeService(loadConfig({
    databaseUrl: "",
    siliconflowApiKey: "",
    vectorRagEnabled: true
  }));
  assert.equal(service.status().enabled, false);
  assert.equal(service.status().configured, false);
  await service.initialize();
  const local = { mode: "hybrid-context-kg-v2", results: [{ sourceId: "a" }, { sourceId: "b" }] };
  const result = await service.enhance(local, { question: "为什么", audience: "student", context: {}, limit: 1 });
  assert.equal(result.mode, "hybrid-context-kg-v2");
  assert.deepEqual(result.results, [{ sourceId: "a" }]);
  await service.close();
});

test("initial knowledge sync batches vector writes instead of inserting one row per request", async () => {
  const insertParameterCounts = [];
  let countQueries = 0;
  let ended = false;
  const pool = {
    async query(sql, parameters = []) {
      if (sql.includes("SELECT chunk_id, content_hash")) return { rows: [] };
      if (sql.includes("INSERT INTO physics_knowledge_vectors")) {
        insertParameterCounts.push(parameters.length);
        return { rows: [] };
      }
      if (sql.includes("COUNT(*)::int")) {
        countQueries += 1;
        return { rows: [{ count: countQueries === 1 ? 0 : 365 }] };
      }
      return { rows: [] };
    },
    async end() { ended = true; }
  };
  const client = {
    async embed(documents) { return documents.map(() => "[0.1,0.2,0.3]"); },
    async rerank() { return []; }
  };
  const service = createVectorKnowledgeService(loadConfig({
    databaseUrl: "postgresql://example.invalid/test",
    siliconflowApiKey: "test-only-key",
    vectorRagEnabled: true,
    vectorRagSyncOnStart: false,
    embeddingDimensions: 3,
    embeddingBatchSize: 32
  }), { pool, client });

  await service.initialize();
  await service.sync();
  assert.equal(insertParameterCounts.length, 12);
  assert.ok(insertParameterCounts.every((count) => count <= 32 * 13 && count % 13 === 0));
  assert.equal(service.status().indexedChunks, 365);
  assert.equal(service.status().ready, true);
  await service.close();
  assert.equal(ended, true);
});

test("invalid embedding dimensions fail closed", () => {
  assert.throws(() => vectorKnowledgeInternals.vectorLiteral([0.1, 0.2], 3), /维度异常/);
});
