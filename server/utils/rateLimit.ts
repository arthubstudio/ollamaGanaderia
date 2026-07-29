import { createHash } from "node:crypto";
import { isIP } from "node:net";
import {
  getRequestHeader,
  getRequestIP,
  setResponseHeader,
  type H3Event
} from "h3";
import { apiError } from "~/server/utils/api";
import { isTrustedProxyConnection } from "~/server/utils/requestSecurity";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const STORE_KEY = Symbol.for("ganaderia-ai.rate-limit-store");
const globalState = globalThis as any;
const store = globalState[STORE_KEY] ?? new Map<string, RateLimitEntry>();
globalState[STORE_KEY] = store;

let operations = 0;
let persistentOperations = 0;

function cleanupExpired(now: number) {
  operations += 1;
  if (operations % 250 !== 0) return;

  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  cleanupExpired(now);

  const current = store.get(input.key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + input.windowMs }
    : current;

  if (entry.count >= input.limit) {
    store.set(input.key, entry);
    return {
      allowed: false,
      limit: input.limit,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    };
  }

  entry.count += 1;
  store.set(input.key, entry);

  return {
    allowed: true,
    limit: input.limit,
    remaining: Math.max(0, input.limit - entry.count),
    resetAt: entry.resetAt,
    retryAfterSeconds: 0
  };
}

export async function resetRateLimit(key: string) {
  store.delete(key);

  const { sql } = await import("~/lib/db");
  await sql`
    DELETE FROM security_rate_limits
    WHERE key_hash = ${persistentKey(key)}
  `;
}

export function resetRateLimitStore() {
  store.clear();
}

export function rateLimitKeyPart(value: unknown) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex")
    .slice(0, 24);
}

function persistentKey(value: string) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

async function consumePersistentRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { sql } = await import("~/lib/db");
  const keyHash = persistentKey(input.key);
  const rows = await sql`
    INSERT INTO security_rate_limits (
      key_hash,
      request_count,
      window_started_at,
      expires_at,
      updated_at
    )
    VALUES (
      ${keyHash},
      1,
      NOW(),
      NOW() + (${input.windowMs}::double precision * INTERVAL '1 millisecond'),
      NOW()
    )
    ON CONFLICT (key_hash)
    DO UPDATE SET
      request_count = CASE
        WHEN security_rate_limits.expires_at <= NOW() THEN 1
        ELSE security_rate_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN security_rate_limits.expires_at <= NOW() THEN NOW()
        ELSE security_rate_limits.window_started_at
      END,
      expires_at = CASE
        WHEN security_rate_limits.expires_at <= NOW()
          THEN NOW() + (${input.windowMs}::double precision * INTERVAL '1 millisecond')
        ELSE security_rate_limits.expires_at
      END,
      updated_at = NOW()
    RETURNING request_count, expires_at
  `;

  const count = Number(rows[0]?.request_count ?? input.limit + 1);
  const resetAt = new Date(rows[0]?.expires_at ?? Date.now()).getTime();
  const now = Date.now();

  persistentOperations += 1;
  if (persistentOperations % 250 === 0) {
    await sql`
      DELETE FROM security_rate_limits
      WHERE expires_at < NOW() - INTERVAL '1 day'
    `;
  }

  return {
    allowed: count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    resetAt,
    retryAfterSeconds: count <= input.limit
      ? 0
      : Math.max(1, Math.ceil((resetAt - now) / 1000))
  };
}

export function resolveClientAddress(input: {
  directAddress?: string | null;
  trustedProxy: boolean;
  cloudflareAddress?: string | null;
  forwardedFor?: string | null;
}) {
  const directAddress = String(input.directAddress ?? "")
    .trim()
    .replace(/^::ffff:/, "");
  if (!input.trustedProxy) return isIP(directAddress) ? directAddress : "unknown";

  const cloudflareAddress = String(input.cloudflareAddress ?? "").trim();
  if (isIP(cloudflareAddress)) return cloudflareAddress;

  const forwardedAddress = String(input.forwardedFor ?? "")
    .split(",")[0]
    ?.trim()
    .replace(/^::ffff:/, "");
  if (isIP(forwardedAddress)) return forwardedAddress;

  return isIP(directAddress) ? directAddress : "unknown";
}

export function getClientAddress(event: H3Event) {
  return resolveClientAddress({
    directAddress: getRequestIP(event, { xForwardedFor: false }),
    trustedProxy: isTrustedProxyConnection(event),
    cloudflareAddress: getRequestHeader(event, "cf-connecting-ip"),
    forwardedFor: getRequestHeader(event, "x-forwarded-for")
  });
}

export async function enforceRateLimit(
  event: H3Event,
  input: {
    key: string;
    limit: number;
    windowMs: number;
    message?: string;
  }
) {
  const result = await consumePersistentRateLimit(input);
  setResponseHeader(event, "RateLimit-Limit", String(result.limit));
  setResponseHeader(event, "RateLimit-Remaining", String(result.remaining));
  setResponseHeader(event, "RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    setResponseHeader(event, "Retry-After", result.retryAfterSeconds);
    apiError({
      statusCode: 429,
      code: "RATE_LIMITED",
      message: input.message ?? "Demasiadas solicitudes. Espera un momento antes de intentar nuevamente."
    });
  }

  return result;
}
