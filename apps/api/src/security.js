import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, digest] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signAccessToken(user, config) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, schoolId: user.schoolId, role: user.role, name: user.name, iat: now, exp: now + config.tokenTtlSeconds };
  const encoded = encode(payload);
  const signature = createHmac("sha256", config.tokenSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyAccessToken(token, config) {
  const [encoded, signature] = String(token ?? "").split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", config.tokenSecret).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.sub || !payload.schoolId || !payload.role || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
