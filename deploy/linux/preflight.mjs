#!/usr/bin/env node
import { stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only fail-closed checks. Never read .env files, open SQLite, install,
// reserve ports, print secrets, modify permissions or contact a network.
export function validateEnvironment(env, nodeVersion = process.versions.node) {
  const errors = [];
  if (Number(nodeVersion.split('.')[0]) !== 24) errors.push('Use the reviewed Node.js 24 executable.');
  const expected = {
    NODE_ENV: 'production', PHYSICS_WEB_HOST: '127.0.0.1', PHYSICS_API_HOST: '127.0.0.1',
    PHYSICS_DEMO_ONLY: 'false', PHYSICS_API_SEED_DEMO: 'false',
    PHYSICS_GUANGGUANG_AI_ENABLED: 'false', PHYSICS_LILI_AI_ENABLED: 'false',
    PHYSICS_VECTOR_RAG_ENABLED: 'false', PHYSICS_VECTOR_RAG_SYNC_ON_START: 'false', PHYSICS_RERANK_ENABLED: 'false',
  };
  for (const [key, value] of Object.entries(expected)) if (env[key] !== value) errors.push(`${key} must be ${value} in this baseline.`);
  for (const key of ['DATABASE_URL', 'DEEPSEEK_API_KEY', 'SILICONFLOW_API_KEY', 'NODE_OPTIONS', 'RENDER', 'RENDER_EXTERNAL_HOSTNAME']) {
    if (env[key]) errors.push(`${key} must be empty in this baseline.`);
  }
  const port = (value) => /^\d+$/.test(value ?? '') && Number(value) >= 1024 && Number(value) <= 65535;
  if (!port(env.PORT) || !port(env.PHYSICS_RENDER_API_PORT)) errors.push('Configure valid non-privileged web/API ports.');
  if (Number(env.PORT) === Number(env.PHYSICS_RENDER_API_PORT)) errors.push('Web and API ports must differ.');
  if (env.PHYSICS_API_PORT !== env.PHYSICS_RENDER_API_PORT) errors.push('PHYSICS_API_PORT must match PHYSICS_RENDER_API_PORT.');
  if (!/^[a-fA-F0-9]{64}$/.test(env.PHYSICS_API_TOKEN_SECRET ?? '') || /^(.)\1+$/.test(env.PHYSICS_API_TOKEN_SECRET ?? '')) {
    errors.push('Replace the token-secret placeholder with a private random 32-byte hex secret.');
  }
  for (const key of ['PHYSICS_API_DATA_DIR', 'PHYSICS_API_DATABASE']) {
    const value = env[key] ?? '';
    const inside = relative('/var/lib/physics-lab', resolve(value));
    if (!isAbsolute(value) || !inside || inside.startsWith('..') || isAbsolute(inside)) errors.push(`${key} must be inside /var/lib/physics-lab/.`);
  }
  const origins = (env.PHYSICS_API_ALLOWED_ORIGINS ?? '').split(',');
  // This release has one reviewed public hostname. Keep the local SSH-tunnel
  // origin for internal checks, but never grant CORS to the parent site or an
  // arbitrary sibling/wildcard subdomain on the shared server.
  const reviewedOrigins = new Set([
    `http://127.0.0.1:${env.PORT}`,
    'https://physics.xianghuiacademy.cn',
  ]);
  if (!origins.length || origins.some((value) => !reviewedOrigins.has(value))) {
    errors.push('PHYSICS_API_ALLOWED_ORIGINS must contain only the reviewed loopback origin and/or https://physics.xianghuiacademy.cn.');
  }
  return errors;
}

export async function runPreflight(env = process.env) {
  const errors = validateEnvironment(env);
  if (errors.length) throw new Error(errors.join('\n'));
  const release = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  for (const path of ['apps/web/dist/index.html', 'apps/api/src/server.js', 'scripts/serve-render.mjs', 'node_modules']) {
    try { await stat(resolve(release, path)); } catch { errors.push(`Release is incomplete: ${path}`); }
  }
  try {
    const info = await stat(env.PHYSICS_API_DATABASE || '/nonexistent-physics-database');
    if (!info.isFile()) errors.push('Configured database path is not a regular file.');
  } catch (error) {
    if (error.code !== 'ENOENT') errors.push('Cannot inspect the configured database path.');
    else {
      for (const key of ['PHYSICS_BOOTSTRAP_SCHOOL_NAME', 'PHYSICS_BOOTSTRAP_ADMIN_NAME', 'PHYSICS_BOOTSTRAP_ADMIN_EMAIL', 'PHYSICS_BOOTSTRAP_ADMIN_PASSWORD']) {
        if (!env[key]?.trim() || /REPLACE|PLACEHOLDER/.test(env[key])) errors.push(`New database requires a private ${key} value.`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return 'Preflight passed. This does not verify port availability, database contents or HTTP readiness.';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPreflight().then((message) => console.log(message)).catch((error) => {
    console.error(`Physics deployment preflight refused startup:\n${error.message}`);
    process.exitCode = 1;
  });
}
