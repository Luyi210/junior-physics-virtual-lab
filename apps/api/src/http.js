import { randomUUID } from "node:crypto";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function readJson(request, limitBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) throw new ApiError(413, "BODY_TOO_LARGE", "请求内容超过允许大小");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON", "请求内容不是有效 JSON");
  }
}

export function requiredString(body, key, options = {}) {
  const value = typeof body?.[key] === "string" ? body[key].trim() : "";
  if (!value) throw new ApiError(422, "VALIDATION_ERROR", `${key} 不能为空`);
  if (options.max && value.length > options.max) throw new ApiError(422, "VALIDATION_ERROR", `${key} 不能超过 ${options.max} 个字符`);
  return value;
}

export function optionalString(body, key, options = {}) {
  if (body?.[key] === undefined || body?.[key] === null || body?.[key] === "") return null;
  return requiredString(body, key, options);
}

export function requiredEnum(body, key, values) {
  const value = requiredString(body, key);
  if (!values.includes(value)) throw new ApiError(422, "VALIDATION_ERROR", `${key} 必须是 ${values.join("、")} 之一`);
  return value;
}

export function requiredNumber(body, key, { min = -Infinity, max = Infinity } = {}) {
  const value = Number(body?.[key]);
  if (!Number.isFinite(value) || value < min || value > max) throw new ApiError(422, "VALIDATION_ERROR", `${key} 必须在 ${min} 到 ${max} 之间`);
  return value;
}

export function sendJson(response, status, data, requestId, extraHeaders = {}) {
  const payload = JSON.stringify(status >= 400 ? data : { data, requestId });
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload), ...extraHeaders });
  response.end(payload);
}

export function requestId(request) {
  const supplied = request.headers["x-request-id"];
  return typeof supplied === "string" && supplied.length < 100 ? supplied : randomUUID();
}
