import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import {
  createError,
  deleteCookie,
  getCookie,
  setCookie,
  type H3Event
} from "h3";

const COOKIE_NAME = "ganaderia_session";
const SESSION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  userId: number;
  expiresAt: number;
};

function getSecret(event: H3Event) {
  return String(useRuntimeConfig(event).sessionSecret);
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function setUserSession(event: H3Event, userId: number) {
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + SESSION_SECONDS * 1000
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${encoded}.${sign(encoded, getSecret(event))}`;

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS
  });
}

export function clearUserSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: "/" });
}

export function getSessionUserId(event: H3Event) {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!safeEqual(signature, sign(encoded, getSecret(event)))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!Number.isInteger(payload.userId) || payload.userId <= 0) return null;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
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
