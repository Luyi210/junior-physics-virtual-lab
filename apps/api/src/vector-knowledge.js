import { createHash } from "node:crypto";
import pg from "pg";
import { listPhysicsKnowledgeChunks } from "./knowledge.js";

const { Pool } = pg;
const VECTOR_MODE = "hybrid-context-kg-vector-rerank-v3";
const MAX_RETRIES = 3;

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function vectorLiteral(values, dimensions) {
  if (!Array.isArray(values) || values.length !== dimensions || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`嵌入向量维度异常：期望 ${dimensions}，实际 ${Array.isArray(values) ? values.length : 0}`);
  }
  return `[${values.join(",")}]`;
}

function chunkDocument(chunk) {
  return [
    chunk.title,
    chunk.section,
    chunk.content,
    chunk.keywords.length ? `关键词：${chunk.keywords.join("、")}` : ""
  ].filter(Boolean).join("\n");
}

function queryDocument(question, context = {}) {
  const current = context?.apparatus?.current;
  const facts = Array.isArray(current?.readings)
    ? current.readings.slice(0, 8).map((item) => `${item.label ?? item.id}:${item.value}${item.unit ?? ""}`)
    : [];
  const issues = Array.isArray(current?.validity?.issues) ? current.validity.issues.slice(0, 5) : [];
  return [
    question,
    context.module || current?.module ? `当前实验：${context.module ?? current?.module}` : "",
    issues.length ? `当前问题：${issues.join("；")}` : "",
    facts.length ? `当前读数：${facts.join("；")}` : ""
  ].filter(Boolean).join("\n");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function apiErrorMessage(response, payload) {
  const detail = typeof payload === "string" ? payload : payload?.message ?? payload?.error?.message;
  return `SiliconFlow API ${response.status}${detail ? `: ${String(detail).slice(0, 240)}` : ""}`;
}

export function createSiliconFlowClient(config, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = String(config.embeddingBaseUrl).replace(/\/$/, "");
  const timeoutMs = clampInteger(config.embeddingTimeoutMs, 30_000, 2_000, 120_000);

  async function request(path, body) {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetchImpl(`${baseUrl}${path}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.siliconflowApiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs)
        });
        const payload = await response.json().catch(() => undefined);
        if (response.ok) return payload;
        const error = new Error(apiErrorMessage(response, payload));
        error.retryable = [429, 500, 502, 503, 504].includes(response.status);
        if (!error.retryable) throw error;
        lastError = error;
      } catch (error) {
        lastError = error;
        if (error?.retryable === false) throw error;
        if (attempt === MAX_RETRIES - 1) break;
      }
      await sleep(400 * 2 ** attempt);
    }
    throw lastError ?? new Error("SiliconFlow API 请求失败");
  }

  return {
    async embed(inputs) {
      const payload = await request("/embeddings", {
        model: config.embeddingModel,
        input: inputs,
        encoding_format: "float"
      });
      if (!Array.isArray(payload?.data) || payload.data.length !== inputs.length) throw new Error("SiliconFlow embeddings 返回数量异常");
      return [...payload.data]
        .sort((left, right) => left.index - right.index)
        .map((item) => vectorLiteral(item.embedding, config.embeddingDimensions));
    },
    async rerank(query, documents, topN) {
      if (!config.rerankEnabled || documents.length < 2) return [];
      const payload = await request("/rerank", {
        model: config.rerankModel,
        query,
        documents,
        top_n: Math.min(topN, documents.length),
        return_documents: false
      });
      return Array.isArray(payload?.results) ? payload.results : [];
    }
  };
}

function mergeResults(localRetrieval, vectorHits, rerankResults, limit) {
  const candidates = new Map();
  for (const [index, item] of localRetrieval.results.entries()) {
    candidates.set(item.sourceId, {
      ...item,
      fusionScore: item.score + Math.max(0, 12 - index * 1.5),
      vectorSimilarity: 0,
      rerankScore: 0
    });
  }

  for (const hit of vectorHits) {
    const existing = candidates.get(hit.sourceId);
    const semanticPoints = Math.max(0, Math.min(42, hit.similarity * 42));
    if (existing) {
      existing.fusionScore += semanticPoints;
      existing.vectorSimilarity = hit.similarity;
      existing.reasons = [...new Set([...existing.reasons, "BGE-M3语义召回"])] ;
      existing.scoreBreakdown = { ...existing.scoreBreakdown, vector: Number(semanticPoints.toFixed(2)) };
      continue;
    }
    candidates.set(hit.sourceId, {
      ...hit,
      score: semanticPoints,
      fusionScore: semanticPoints,
      vectorSimilarity: hit.similarity,
      rerankScore: 0,
      reasons: ["BGE-M3语义召回"],
      matchedTerms: [],
      scoreBreakdown: { question: 0, context: 0, intent: 0, graph: 0, vector: Number(semanticPoints.toFixed(2)) }
    });
  }

  const orderedForRerank = [...candidates.values()].sort((left, right) => right.fusionScore - left.fusionScore);
  for (const result of rerankResults) {
    const candidate = orderedForRerank[result.index];
    const relevance = Number(result.relevance_score);
    if (!candidate || !Number.isFinite(relevance)) continue;
    const rerankPoints = Math.max(0, Math.min(36, relevance * 36));
    candidate.fusionScore += rerankPoints;
    candidate.rerankScore = relevance;
    candidate.reasons = [...new Set([...candidate.reasons, "BGE重排序"])] ;
    candidate.scoreBreakdown = { ...candidate.scoreBreakdown, rerank: Number(rerankPoints.toFixed(2)) };
  }

  return orderedForRerank
    .sort((left, right) => right.fusionScore - left.fusionScore)
    .slice(0, limit)
    .map(({ fusionScore, vectorSimilarity, rerankScore, ...item }) => ({
      ...item,
      score: Number(fusionScore.toFixed(2)),
      vectorSimilarity: Number(vectorSimilarity.toFixed(4)),
      rerankScore: Number(rerankScore.toFixed(4))
    }));
}

export function createVectorKnowledgeService(config, options = {}) {
  const chunks = listPhysicsKnowledgeChunks();
  const batchSize = clampInteger(config.embeddingBatchSize, 32, 1, 64);
  const searchLimit = clampInteger(config.vectorRagSearchLimit, 12, 4, 32);
  const configured = Boolean(config.databaseUrl && config.siliconflowApiKey);
  const enabled = Boolean(config.vectorRagEnabled && configured);
  const client = options.client ?? (enabled ? createSiliconFlowClient(config, options) : undefined);
  const pool = options.pool ?? (enabled ? new Pool({ connectionString: config.databaseUrl, max: 2, connectionTimeoutMillis: 10_000 }) : undefined);
  const state = {
    enabled,
    configured,
    ready: false,
    syncing: false,
    indexedChunks: 0,
    totalChunks: chunks.length,
    lastSyncedAt: undefined,
    lastError: undefined
  };
  let syncPromise;

  function status() {
    return {
      enabled: state.enabled,
      configured: state.configured,
      ready: state.ready,
      syncing: state.syncing,
      indexedChunks: state.indexedChunks,
      totalChunks: state.totalChunks,
      lastSyncedAt: state.lastSyncedAt,
      degraded: Boolean(state.lastError),
      mode: VECTOR_MODE,
      embeddingModel: config.embeddingModel,
      rerankModel: config.rerankEnabled ? config.rerankModel : undefined
    };
  }

  async function createSchema() {
    const dimensions = clampInteger(config.embeddingDimensions, 1024, 64, 2000);
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS physics_knowledge_vectors (
        chunk_id TEXT PRIMARY KEY,
        source_version TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        node_id TEXT NOT NULL,
        module TEXT NOT NULL,
        audience TEXT NOT NULL,
        title TEXT NOT NULL,
        section TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        route TEXT,
        embedding vector(${dimensions}) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_physics_vectors_module ON physics_knowledge_vectors(module)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_physics_vectors_hnsw ON physics_knowledge_vectors USING hnsw (embedding vector_cosine_ops)");
  }

  async function sync() {
    if (!enabled || syncPromise) return syncPromise;
    syncPromise = (async () => {
      state.syncing = true;
      const existingRows = (await pool.query("SELECT chunk_id, content_hash FROM physics_knowledge_vectors WHERE source_version = $1", [chunks[0]?.sourceVersion ?? ""])).rows;
      const existing = new Map(existingRows.map((row) => [row.chunk_id, row.content_hash]));
      const pending = chunks.filter((chunk) => existing.get(chunk.id) !== hash(chunkDocument(chunk)));
      for (let offset = 0; offset < pending.length; offset += batchSize) {
        const batch = pending.slice(offset, offset + batchSize);
        const embeddings = await client.embed(batch.map(chunkDocument));
        const values = [];
        const parameters = [];
        for (let index = 0; index < batch.length; index += 1) {
          const chunk = batch[index];
          const start = parameters.length;
          values.push(`(${Array.from({ length: 12 }, (_, item) => `$${start + item + 1}`).join(",")},$${start + 13}::vector,NOW())`);
          parameters.push(
            chunk.id, chunk.sourceVersion, hash(chunkDocument(chunk)), chunk.nodeId, chunk.module, chunk.audience,
            chunk.title, chunk.section, chunk.contentType, chunk.content, chunk.source, chunk.route ?? null, embeddings[index]
          );
        }
        await pool.query(`
          INSERT INTO physics_knowledge_vectors
            (chunk_id, source_version, content_hash, node_id, module, audience, title, section, content_type, content, source, route, embedding, updated_at)
          VALUES ${values.join(",")}
          ON CONFLICT (chunk_id) DO UPDATE SET
            source_version = EXCLUDED.source_version,
            content_hash = EXCLUDED.content_hash,
            node_id = EXCLUDED.node_id,
            module = EXCLUDED.module,
            audience = EXCLUDED.audience,
            title = EXCLUDED.title,
            section = EXCLUDED.section,
            content_type = EXCLUDED.content_type,
            content = EXCLUDED.content,
            source = EXCLUDED.source,
            route = EXCLUDED.route,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
        `, parameters);
        state.indexedChunks = Math.min(chunks.length, existingRows.length + offset + batch.length);
      }
      await pool.query(
        "DELETE FROM physics_knowledge_vectors WHERE source_version <> $1 OR NOT (chunk_id = ANY($2::text[]))",
        [chunks[0]?.sourceVersion ?? "", chunks.map((chunk) => chunk.id)]
      );
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM physics_knowledge_vectors WHERE source_version = $1", [chunks[0]?.sourceVersion ?? ""]);
      state.indexedChunks = Number(count.rows[0]?.count ?? 0);
      state.ready = state.indexedChunks > 0;
      state.lastSyncedAt = new Date().toISOString();
      state.lastError = undefined;
    })().catch((error) => {
      state.lastError = String(error?.message ?? error).slice(0, 300);
      console.error("Vector knowledge sync failed", error);
    }).finally(() => {
      state.syncing = false;
      syncPromise = undefined;
    });
    return syncPromise;
  }

  async function initialize() {
    if (!enabled) return status();
    try {
      await createSchema();
      const count = await pool.query("SELECT COUNT(*)::int AS count FROM physics_knowledge_vectors WHERE source_version = $1", [chunks[0]?.sourceVersion ?? ""]);
      state.indexedChunks = Number(count.rows[0]?.count ?? 0);
      state.ready = state.indexedChunks > 0;
      if (config.vectorRagSyncOnStart) void sync();
    } catch (error) {
      state.lastError = String(error?.message ?? error).slice(0, 300);
      console.error("Vector knowledge initialization failed; local RAG remains active", error);
    }
    return status();
  }

  async function search(question, audience, context) {
    const query = queryDocument(question, context);
    const [embedding] = await client.embed([query]);
    const result = await pool.query(`
      SELECT chunk_id AS "sourceId", node_id AS "nodeId", module, title, section,
        content_type AS "contentType", content, source, route,
        GREATEST(0, 1 - (embedding <=> $1::vector))::float8 AS similarity
      FROM physics_knowledge_vectors
      WHERE source_version = $2 AND (audience = 'both' OR audience = $3)
      ORDER BY embedding <=> $1::vector
      LIMIT $4
    `, [embedding, chunks[0]?.sourceVersion ?? "", audience, searchLimit]);
    return { query, hits: result.rows.map((row) => ({ ...row, similarity: Number(row.similarity) })) };
  }

  async function enhance(localRetrieval, { question, audience, context, limit = 6 }) {
    const safeLimit = clampInteger(limit, 6, 1, 8);
    if (!enabled || !state.ready) return { ...localRetrieval, results: localRetrieval.results.slice(0, safeLimit) };
    try {
      const { query, hits } = await search(question, audience, context);
      const preliminary = mergeResults(localRetrieval, hits, [], Math.max(searchLimit, safeLimit));
      const documents = preliminary.map((item) => `${item.title}\n${item.section}\n${item.content}`);
      let reranked = [];
      try {
        reranked = await client.rerank(query, documents, documents.length);
      } catch (error) {
        state.lastError = String(error?.message ?? error).slice(0, 300);
        console.error("Knowledge rerank failed; using vector fusion without reranking", error);
      }
      const results = mergeResults(localRetrieval, hits, reranked, safeLimit);
      if (reranked.length || !config.rerankEnabled) state.lastError = undefined;
      return {
        ...localRetrieval,
        id: `ragv-${hash(`${localRetrieval.id}|${results.map((item) => item.sourceId).join("|")}`).slice(0, 16)}`,
        mode: VECTOR_MODE,
        confidence: Number(Math.min(.99, localRetrieval.confidence + (results[0]?.vectorSimilarity ?? 0) * .12).toFixed(2)),
        results
      };
    } catch (error) {
      state.lastError = String(error?.message ?? error).slice(0, 300);
      console.error("Vector retrieval failed; using local RAG", error);
      return { ...localRetrieval, results: localRetrieval.results.slice(0, safeLimit) };
    }
  }

  async function close() {
    if (syncPromise) await syncPromise;
    if (pool) await pool.end();
  }

  return { initialize, sync, enhance, close, status };
}

export const vectorKnowledgeInternals = { chunkDocument, mergeResults, queryDocument, vectorLiteral };
