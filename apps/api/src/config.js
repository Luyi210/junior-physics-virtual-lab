import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const projectRoot = resolve(apiRoot, "../..");

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanFromEnv(value, fallback) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function loadConfig(overrides = {}) {
  const dataDirectory = overrides.dataDirectory ?? process.env.PHYSICS_API_DATA_DIR ?? resolve(apiRoot, "data");
  const deepseekApiKey = overrides.deepseekApiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  const siliconflowApiKey = overrides.siliconflowApiKey ?? process.env.SILICONFLOW_API_KEY ?? "";
  const databaseUrl = overrides.databaseUrl ?? process.env.DATABASE_URL ?? "";
  const configuredOrigins = (process.env.PHYSICS_API_ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean);
  const renderOrigin = process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : "";
  const production = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
  return {
    host: overrides.host ?? process.env.PHYSICS_API_HOST ?? "127.0.0.1",
    port: overrides.port ?? numberFromEnv(process.env.PHYSICS_API_PORT, 8787),
    databaseUrl,
    databasePath: overrides.databasePath ?? process.env.PHYSICS_API_DATABASE ?? resolve(dataDirectory, "physics-lab.sqlite"),
    tokenSecret: overrides.tokenSecret ?? process.env.PHYSICS_API_TOKEN_SECRET ?? "local-development-secret-change-before-deployment",
    tokenTtlSeconds: overrides.tokenTtlSeconds ?? numberFromEnv(process.env.PHYSICS_API_TOKEN_TTL, 8 * 60 * 60),
    allowedOrigins: overrides.allowedOrigins ?? [...new Set([...configuredOrigins, renderOrigin].filter(Boolean))],
    bodyLimitBytes: overrides.bodyLimitBytes ?? 1024 * 1024,
    seedDemoData: overrides.seedDemoData ?? booleanFromEnv(process.env.PHYSICS_API_SEED_DEMO, !production),
    bootstrapSchoolName: overrides.bootstrapSchoolName ?? process.env.PHYSICS_BOOTSTRAP_SCHOOL_NAME ?? "格物实验室",
    bootstrapAdminName: overrides.bootstrapAdminName ?? process.env.PHYSICS_BOOTSTRAP_ADMIN_NAME ?? "平台管理员",
    bootstrapAdminEmail: overrides.bootstrapAdminEmail ?? process.env.PHYSICS_BOOTSTRAP_ADMIN_EMAIL ?? "",
    bootstrapAdminPassword: overrides.bootstrapAdminPassword ?? process.env.PHYSICS_BOOTSTRAP_ADMIN_PASSWORD ?? "",
    guangguangEnabled: overrides.guangguangEnabled ?? booleanFromEnv(process.env.PHYSICS_GUANGGUANG_AI_ENABLED, Boolean(deepseekApiKey)),
    guangguangProvider: overrides.guangguangProvider ?? process.env.PHYSICS_GUANGGUANG_PROVIDER ?? "deepseek-official",
    guangguangModel: overrides.guangguangModel ?? process.env.PHYSICS_GUANGGUANG_MODEL ?? "deepseek-v4-flash",
    guangguangProfile: overrides.guangguangProfile ?? process.env.PHYSICS_GUANGGUANG_DSH_PROFILE ?? "sdk",
    guangguangPatchPath: overrides.guangguangPatchPath ?? process.env.PHYSICS_GUANGGUANG_DSH_PATCH ?? resolve(projectRoot, "config/deepseek-harness/guangguang.cordis.patch.yml"),
    guangguangHome: overrides.guangguangHome ?? process.env.PHYSICS_GUANGGUANG_DSH_HOME ?? resolve(projectRoot, ".runtime/deepseek-harness"),
    guangguangWorkspace: overrides.guangguangWorkspace ?? process.env.PHYSICS_GUANGGUANG_WORKSPACE ?? resolve(projectRoot, ".runtime/guangguang-workspace"),
    guangguangDshBin: overrides.guangguangDshBin ?? process.env.PHYSICS_GUANGGUANG_DSH_BIN ?? "",
    guangguangMaxTokens: overrides.guangguangMaxTokens ?? numberFromEnv(process.env.PHYSICS_GUANGGUANG_MAX_TOKENS, 2048),
    guangguangTurnTimeoutMs: overrides.guangguangTurnTimeoutMs ?? numberFromEnv(process.env.PHYSICS_GUANGGUANG_TIMEOUT_MS, 150_000),
    guangguangQueueLimit: overrides.guangguangQueueLimit ?? numberFromEnv(process.env.PHYSICS_GUANGGUANG_QUEUE_LIMIT, 8),
    guangguangRequestsPerMinute: overrides.guangguangRequestsPerMinute ?? numberFromEnv(process.env.PHYSICS_GUANGGUANG_REQUESTS_PER_MINUTE, 12),
    vectorRagEnabled: overrides.vectorRagEnabled ?? booleanFromEnv(process.env.PHYSICS_VECTOR_RAG_ENABLED, Boolean(databaseUrl && siliconflowApiKey)),
    vectorRagSyncOnStart: overrides.vectorRagSyncOnStart ?? booleanFromEnv(process.env.PHYSICS_VECTOR_RAG_SYNC_ON_START, true),
    vectorRagSearchLimit: overrides.vectorRagSearchLimit ?? numberFromEnv(process.env.PHYSICS_VECTOR_RAG_SEARCH_LIMIT, 12),
    embeddingBaseUrl: overrides.embeddingBaseUrl ?? process.env.PHYSICS_EMBEDDING_BASE_URL ?? "https://api.siliconflow.cn/v1",
    embeddingModel: overrides.embeddingModel ?? process.env.PHYSICS_EMBEDDING_MODEL ?? "BAAI/bge-m3",
    embeddingDimensions: overrides.embeddingDimensions ?? numberFromEnv(process.env.PHYSICS_EMBEDDING_DIMENSIONS, 1024),
    embeddingBatchSize: overrides.embeddingBatchSize ?? numberFromEnv(process.env.PHYSICS_EMBEDDING_BATCH_SIZE, 32),
    embeddingTimeoutMs: overrides.embeddingTimeoutMs ?? numberFromEnv(process.env.PHYSICS_EMBEDDING_TIMEOUT_MS, 30_000),
    rerankModel: overrides.rerankModel ?? process.env.PHYSICS_RERANK_MODEL ?? "BAAI/bge-reranker-v2-m3",
    rerankEnabled: overrides.rerankEnabled ?? booleanFromEnv(process.env.PHYSICS_RERANK_ENABLED, true),
    siliconflowApiKey,
    deepseekApiKey,
    deepseekBaseUrl: overrides.deepseekBaseUrl ?? process.env.DEEPSEEK_BASE_URL ?? ""
  };
}
