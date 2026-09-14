import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(projectRoot, "apps/web/dist");
const host = process.env.PHYSICS_WEB_HOST ?? "127.0.0.1";
const port = Number(process.env.PHYSICS_WEB_PORT ?? process.env.PORT ?? 5173);
const apiUpstream = new URL(process.env.PHYSICS_API_UPSTREAM ?? "http://127.0.0.1:8787");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function safePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = resolve(publicRoot, `.${decoded === "/" ? "/index.html" : decoded}`);
  return candidate === publicRoot || candidate.startsWith(`${publicRoot}${sep}`) ? candidate : null;
}

async function existingFile(candidate) {
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
    if (info.isDirectory()) {
      const indexFile = resolve(candidate, "index.html");
      if ((await stat(indexFile)).isFile()) return indexFile;
    }
  } catch {
    return null;
  }
  return null;
}

async function requestBody(request, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyApi(request, response, url) {
  try {
    const upstreamUrl = new URL(`${url.pathname}${url.search}`, apiUpstream);
    const headers = {};
    for (const name of ["accept", "authorization", "content-type"]) {
      const value = request.headers[name];
      if (typeof value === "string") headers[name] = value;
    }
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await requestBody(request);
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(15_000)
    });
    const responseBody = request.method === "HEAD" ? undefined : Buffer.from(await upstreamResponse.arrayBuffer());
    const responseHeaders = {
      "content-type": upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    };
    const requestId = upstreamResponse.headers.get("x-request-id");
    if (requestId) responseHeaders["x-request-id"] = requestId;
    response.writeHead(upstreamResponse.status, responseHeaders);
    response.end(responseBody);
  } catch (error) {
    const status = error?.statusCode === 413 ? 413 : 502;
    response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: { code: status === 413 ? "PAYLOAD_TOO_LARGE" : "API_PROXY_UNAVAILABLE", message: status === 413 ? "请求内容过大" : "教学数据服务暂时不可用" } }));
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    await proxyApi(request, response, url);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  let file = await existingFile(safePath(url.pathname));
  if (!file && request.headers.accept?.includes("text/html")) file = resolve(publicRoot, "index.html");
  if (!file) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  try {
    const body = await readFile(file);
    const isIndex = file.endsWith(`${sep}index.html`);
    const isHashedAsset = file.includes(`${sep}assets${sep}`) && /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(file);
    response.writeHead(200, {
      "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
      "cache-control": isIndex ? "no-cache" : isHashedAsset ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      "x-content-type-options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    console.error("Static file response failed", error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Physics Lab failed to load this resource.");
  }
});

server.listen(port, host, () => {
  console.log(`Physics Lab web running at http://${host}:${port}/`);
});

function shutdown(signal) {
  console.log(`\n${signal}: closing Physics Lab web`);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
