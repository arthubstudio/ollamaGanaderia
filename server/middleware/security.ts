import {
  getMethod,
  getRequestHeader,
  getRequestPath,
  removeResponseHeader,
  sendRedirect,
  setResponseHeaders
} from "h3";
import { apiError } from "~/server/utils/api";
import {
  assertAllowedRequestHost,
  assertTrustedRequestOrigin,
  getCanonicalRequestHost,
  getConfiguredPublicOrigin,
  isSecureRequest
} from "~/server/utils/requestSecurity";
import {
  enforceRateLimit,
  getClientAddress,
  rateLimitKeyPart
} from "~/server/utils/rateLimit";
import { getSessionUserId, hydrateUserSession } from "~/server/utils/session";

const MAX_API_BODY_BYTES = 1024 * 1024;

export default defineEventHandler(async (event) => {
  assertAllowedRequestHost(event);

  const path = getRequestPath(event).split("?")[0] ?? "/";
  if (path === "/api/ia/tools" || path.startsWith("/api/ia/tools/")) {
    apiError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "La ruta solicitada no existe."
    });
  }

  const publicOrigin = getConfiguredPublicOrigin();
  const requestHost = getCanonicalRequestHost(event);
  if (
    process.env.NODE_ENV === "production" &&
    publicOrigin?.startsWith("https://") &&
    requestHost?.hostname === new URL(publicOrigin).hostname.toLowerCase() &&
    !isSecureRequest(event)
  ) {
    return sendRedirect(
      event,
      `${publicOrigin}${event.node.req.url || "/"}`,
      308
    );
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const scriptPolicy = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'";
  const stylePolicy = isDevelopment
    ? "style-src 'self' 'unsafe-inline'"
    : "style-src 'self'";
  const connectPolicy = isDevelopment
    ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:* ws://[::1]:*"
    : "connect-src 'self'";

  setResponseHeaders(event, {
    "Content-Security-Policy": [
      "default-src 'self'",
      scriptPolicy,
      stylePolicy,
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      connectPolicy,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-DNS-Prefetch-Control": "off"
  });

  if (isSecureRequest(event)) {
    setResponseHeaders(event, {
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
    });
  }

  if (path === "/login" || path === "/register" || path.startsWith("/api/")) {
    setResponseHeaders(event, {
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Surrogate-Control": "no-store"
    });

    if (path.startsWith("/api/")) {
      const contentLength = Number(getRequestHeader(event, "content-length") ?? 0);
      if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
        apiError({
          statusCode: 413,
          code: "PAYLOAD_TOO_LARGE",
          message: "La solicitud supera el limite permitido de 1 MB."
        });
      }
    }
  }

  removeResponseHeader(event, "X-Powered-By");
  removeResponseHeader(event, "Server-Timing");
  event.node.res.removeHeader("X-Powered-By");
  event.node.res.removeHeader("Server-Timing");

  assertTrustedRequestOrigin(event);
  await hydrateUserSession(event);

  if (path.startsWith("/api/")) {
    const method = getMethod(event).toUpperCase();
    const userId = getSessionUserId(event);
    const identity = userId
      ? `user:${rateLimitKeyPart(userId)}`
      : `ip:${rateLimitKeyPart(getClientAddress(event))}`;
    const readOnly = method === "GET" || method === "HEAD" || method === "OPTIONS";

    await enforceRateLimit(event, {
      key: `api:global:${identity}:${readOnly ? "read" : "write"}`,
      limit: readOnly ? 180 : 90,
      windowMs: 60 * 1000,
      message: "Se alcanzo el limite global de solicitudes API. Espera un minuto."
    });
  }
});
