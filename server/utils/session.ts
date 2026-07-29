import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import {
  createError,
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestProtocol,
  setCookie,
  type H3Event
} from "h3";

export const SESSION_COOKIE_NAME = "ganaderia_session";
const SESSION_SECONDS = 60 * 60 * 12;
const LOCAL_DEVELOPMENT_SECRET = "ganaderia-ai-local-dev-change-me";

type SessionPayload = {
  userId: number;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
};

type AuthContext = {
  authHydrated?: boolean;
  authUserId?: number;
  authSessionHash?: string;
};

const DUMMY_PASSWORD_SALT = Buffer.from("ganaderia-ai-login-timing-v1", "utf8");
const DUMMY_PASSWORD_HASH = `scrypt$${DUMMY_PASSWORD_SALT.toString("base64url")}$${scryptSync(
  "invalid-login-password",
  DUMMY_PASSWORD_SALT,
  64
).toString("base64url")}`;

function getSecret(event?: H3Event) {
  const configuredSecret = String(useRuntimeConfig(event).sessionSecret ?? "");
  const publicOrProduction =
    process.env.NODE_ENV === "production" ||
    (event ? getRequestProtocol(event) === "https" : false);

  const placeholderSecret = /^(change|replace|example|ganaderia-ai-local)/i.test(configuredSecret);
  if (publicOrProduction && (configuredSecret.length < 32 || placeholderSecret)) {
    throw createError({
      statusCode: 500,
      statusMessage: "Configuracion de sesion incompleta",
      data: {
        success: false,
        code: "SESSION_SECRET_REQUIRED",
        message: "Configura NUXT_SESSION_SECRET con al menos 32 caracteres aleatorios antes de publicar la aplicacion."
      }
    });
  }

  return configuredSecret || LOCAL_DEVELOPMENT_SECRET;
}

function encryptionKey(secret: string) {
  return createHash("sha256")
    .update(`ganaderia-ai-session:${secret}`)
    .digest();
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function decodeCanonicalBase64Url(value: string) {
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new Error("Non-canonical Base64URL value");
  }
  return decoded;
}

function sessionHash(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

function sessionOperationError(code: string, cause: unknown) {
  const typedCause = cause as { name?: unknown; code?: unknown } | null;
  console.error("Session operation failed", {
    code,
    cause_type: String(typedCause?.name ?? "Error"),
    cause_code: typeof typedCause?.code === "string" ? typedCause.code : null
  });
  const error = new Error("No fue posible completar la operacion de sesion", {
    cause
  }) as Error & { code: string };
  error.code = code;
  return error;
}

function userAgentHash(event: H3Event) {
  const userAgent = String(getRequestHeader(event, "user-agent") ?? "");
  return userAgent
    ? createHash("sha256").update(userAgent).digest("hex")
    : null;
}

function isLoopbackHost(event: H3Event) {
  const host = String(getRequestHeader(event, "host") ?? "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function secureCookie(event: H3Event) {
  return getRequestProtocol(event) === "https" ||
    (process.env.NODE_ENV === "production" && !isLoopbackHost(event));
}

function decodeSessionPayload(
  token: string | null | undefined,
  secret: string,
  now = Date.now()
): SessionPayload | null {
  if (!token?.startsWith("v3.")) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [, ivText, encryptedText, authTagText] = parts;
    if (!ivText || !encryptedText || !authTagText) return null;

    const iv = decodeCanonicalBase64Url(ivText);
    const authTag = decodeCanonicalBase64Url(authTagText);
    if (iv.length !== 12 || authTag.length !== 16) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(decodeCanonicalBase64Url(encryptedText)),
      decipher.final()
    ]).toString("utf8");
    const payload = JSON.parse(decrypted) as SessionPayload;

    if (!Number.isInteger(payload.userId) || payload.userId <= 0) return null;
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(payload.sessionId)) return null;
    if (!Number.isFinite(payload.issuedAt) || payload.issuedAt > now + 60_000) return null;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) return null;
    if (payload.expiresAt - payload.issuedAt > SESSION_SECONDS * 1000 + 60_000) return null;

    return payload;
  } catch {
    return null;
  }
}

export function createUserSessionToken(
  userId: number,
  secret: string,
  now = Date.now(),
  sessionId = randomBytes(32).toString("base64url")
) {
  const payload: SessionPayload = {
    userId,
    sessionId,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS * 1000
  };
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v3",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    authTag.toString("base64url")
  ].join(".");
}

export function verifyUserSessionToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now()
) {
  return decodeSessionPayload(token, secret, now)?.userId ?? null;
}

export async function validateActiveUserSessionToken(
  token: string | null | undefined,
  secret: string
) {
  const payload = decodeSessionPayload(token, secret);
  if (!payload) return null;

  const { sql } = await import("~/lib/db");
  const idHash = sessionHash(payload.sessionId);
  const rows = await sql`
    SELECT user_id
    FROM auth_sessions
    WHERE id_hash = ${idHash}
      AND user_id = ${payload.userId}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `;

  return rows[0]?.user_id ? Number(rows[0].user_id) : null;
}

export async function setUserSession(event: H3Event, userId: number) {
  const { sql } = await import("~/lib/db");
  const sessionId = randomBytes(32).toString("base64url");
  const idHash = sessionHash(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  let storeStage = "fingerprint";

  try {
    const agentHash = userAgentHash(event);
    await sql.begin(async (tx) => {
      storeStage = "lock";
      await tx`SELECT pg_advisory_xact_lock(94721, ${userId})`;
      storeStage = "revoke";
      await tx`
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE user_id = ${userId}
          AND revoked_at IS NULL
      `;
      storeStage = "insert";
      await tx`
        INSERT INTO auth_sessions (
          id_hash,
          user_id,
          expires_at,
          user_agent_hash
        )
        VALUES (
          ${idHash},
          ${userId},
          ${expiresAt}::timestamptz,
          ${agentHash}
        )
      `;
      storeStage = "cleanup";
      await tx`
        DELETE FROM auth_sessions
        WHERE expires_at < NOW() - INTERVAL '1 day'
           OR revoked_at < NOW() - INTERVAL '7 days'
      `;
    });
  } catch (error) {
    throw sessionOperationError(
      `SESSION_STORE_${storeStage.toUpperCase()}_FAILED`,
      error
    );
  }

  let token: string;
  try {
    token = createUserSessionToken(
      userId,
      getSecret(event),
      Date.now(),
      sessionId
    );
  } catch (error) {
    throw sessionOperationError("SESSION_TOKEN_FAILED", error);
  }

  try {
    setCookie(event, SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: secureCookie(event),
      path: "/",
      maxAge: SESSION_SECONDS
    });
  } catch (error) {
    throw sessionOperationError("SESSION_COOKIE_FAILED", error);
  }
}

export async function clearUserSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE_NAME);
  const payload = decodeSessionPayload(token, getSecret(event));

  if (payload) {
    const { sql } = await import("~/lib/db");
    await sql`
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE id_hash = ${sessionHash(payload.sessionId)}
        AND user_id = ${payload.userId}
    `;
  }

  deleteCookie(event, SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie(event),
    path: "/"
  });
}

export async function hydrateUserSession(event: H3Event) {
  const context = event.context as AuthContext;
  if (context.authHydrated) return context.authUserId ?? null;
  context.authHydrated = true;

  const token = getCookie(event, SESSION_COOKIE_NAME);
  if (!token) return null;

  const payload = decodeSessionPayload(token, getSecret(event));
  if (!payload) return null;

  const { sql } = await import("~/lib/db");
  const idHash = sessionHash(payload.sessionId);
  const rows = await sql`
    SELECT user_id
    FROM auth_sessions
    WHERE id_hash = ${idHash}
      AND user_id = ${payload.userId}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `;

  if (!rows[0]?.user_id) return null;
  context.authUserId = Number(rows[0].user_id);
  context.authSessionHash = idHash;
  return context.authUserId;
}

export function getSessionUserId(event: H3Event) {
  const userId = Number((event.context as AuthContext).authUserId);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function requireUserId(event: H3Event) {
  const userId = getSessionUserId(event);
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: "No autenticado",
      data: {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Debes iniciar sesion."
      }
    });
  }
  return userId;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt$")) {
    return safeEqual(password, stored);
  }

  const [, saltText, hashText] = stored.split("$");
  if (!saltText || !hashText) return false;

  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = scryptSync(password, Buffer.from(saltText, "base64url"), 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function verifyLoginPassword(password: string, stored?: string | null) {
  if (!stored) {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return false;
  }

  if (!stored.startsWith("scrypt$")) {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return safeEqual(password, stored);
  }

  return verifyPassword(password, stored);
}
