import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const apiRoot = fileURLToPath(new URL("..", import.meta.url));

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(overrides = {}) {
  const dataDirectory = overrides.dataDirectory ?? process.env.PHYSICS_API_DATA_DIR ?? resolve(apiRoot, "data");
  return {
    host: overrides.host ?? process.env.PHYSICS_API_HOST ?? "127.0.0.1",
    port: overrides.port ?? numberFromEnv(process.env.PHYSICS_API_PORT, 8787),
    databasePath: overrides.databasePath ?? process.env.PHYSICS_API_DATABASE ?? resolve(dataDirectory, "physics-lab.sqlite"),
    tokenSecret: overrides.tokenSecret ?? process.env.PHYSICS_API_TOKEN_SECRET ?? "local-development-secret-change-before-deployment",
    tokenTtlSeconds: overrides.tokenTtlSeconds ?? numberFromEnv(process.env.PHYSICS_API_TOKEN_TTL, 8 * 60 * 60),
    allowedOrigins: overrides.allowedOrigins ?? (process.env.PHYSICS_API_ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean),
    bodyLimitBytes: overrides.bodyLimitBytes ?? 1024 * 1024
  };
}
